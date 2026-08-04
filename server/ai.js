/* ==========================================================================
   AI — עוזר האימון
   משתמש ב-Claude API. דורש משתנה סביבה ANTHROPIC_API_KEY; בלעדיו כל
   הפונקציות מחזירות { available: false } והממשק מציג הודעה במקום ליפול.

   מה ה-AI כן עושה: עונה על שאלות טכניקה, מנסח טיוטת פידבק למאמן, ובודק
   פריימים מסרטון כדי להעריך אם הרוכב סיים על הלוח או נפל.
   מה הוא לא עושה: לא מזהה איזה טריק זה, ולא מזהה סרטון גנוב. לכן הוא
   מסנן ראשון בלבד, ואישור אנושי של מאמן גובר עליו תמיד.
   ========================================================================== */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readThumb } from './storage.js';
import { TRICKS, trickById } from './tricks.js';

// המפתח נקרא בכל קריאה, לא נשמר בקבוע בזמן טעינת המודול. אם היה קבוע,
// הערך היה ננעל ל-undefined: env.mjs טוען את server/.env באופן א-סינכרוני,
// וב-ESM קובץ אח שלא תלוי בו (כמו הקובץ הזה) לא ממתין לו — הוא מתחיל
// לרוץ באותו טיק, לפני שהמפתח בכלל הגיע מהדיסק.
const apiKey = () => process.env.ANTHROPIC_API_KEY;
const MODEL = () => process.env.SKATELAB_AI_MODEL || 'claude-sonnet-5';
const ENDPOINT = 'https://api.anthropic.com/v1/messages';

export const aiAvailable = () => !!apiKey();

/** קטלוג מקוצר שנשלח כהקשר, כדי שהתשובות יישארו בתוך העולם של האפליקציה. */
const catalogue = () => TRICKS
  .filter((t) => !t.side || t.side === 'fs')
  .map((t) => `${t.baseName} (${t.alias.replace(/^(FS|BS) /, '')}) — ${t.level}`)
  .join('\n');

const SYSTEM = `אתה מאמן סקייטבורד ישראלי באפליקציה "Skate Lab".
אתה מדבר עברית פשוטה, בגוף שני רבים ("תנסו", "שימו לב"), בלי סלנג מוגזם.
הקהל הוא ילדים ונוער, אז בטיחות קודמת לכל: אם טריק מסוכן לרמה שתוארה, אמור זאת.
תשובות קצרות — עד 4 משפטים, ממוקדות בתיקון אחד או שניים.
אל תמציא שמות טריקים שלא קיימים ברשימה הבאה:

${catalogue()}`;

/*
 * פרומפט מערכת רזה לבדיקות הראייה.
 *
 * הקטלוג המלא הוא כ-5,000 טוקנים, והוא נשלח בכל קריאה — גם באלה
 * שכל תפקידן לענות "נחת / נפל" בשורה אחת. הן לא מזכירות שמות טריקים
 * ולכן אין מה למנוע מהן להמציא, וההוצאה הזאת הייתה שני שלישים
 * מהעלות של כל בדיקת סרטון.
 */
const VISION_SYSTEM = `אתה בודק פריימים מסרטוני סקייטבורד באפליקציה ישראלית.
אתה עונה בעברית, קצר ויבש, בדיוק בפורמט שמתבקש ובלי משפטי פתיחה.
אתה לא מזהה איזה טריק זה — רק מה שרואים בתמונה.`;

/** קריאה אחת ל-API. מחזירה טקסט, או זורקת שגיאה עם הודעה בעברית. */
async function ask(messages, { maxTokens = 400, system = SYSTEM } = {}) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey(),
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL(),
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.warn('AI נכשל:', res.status, detail.slice(0, 300));
    throw new Error(res.status === 401
      ? 'מפתח ה-AI לא תקין'
      : 'שירות ה-AI לא זמין כרגע');
  }

  const data = await res.json();
  return (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
}

/** שאלה חופשית של רוכב, עם הטריק שהוא מסתכל עליו כהקשר. */
export function askCoach(question, trickId) {
  const trick = trickId ? trickById[trickId] : null;
  const context = trick
    ? `הרוכב שואל בהקשר של הטריק "${trick.baseName}" (${trick.alias}, רמה ${trick.level}): ${trick.desc}\n\n`
    : '';

  return ask([{ role: 'user', content: `${context}${question}` }]);
}

/**
 * תשובה בתוך שיחה מתמשכת עם עוזר ה-AI.
 * `history` הוא ההודעות הקודמות בשיחה (לכל היותר עשרים האחרונות, כדי
 * שהעלות לא תגדל בלי גבול ככל שהשיחה מתארכת).
 */
export function chatReply(history, question) {
  const messages = [
    ...history.slice(-20).map((m) => ({ role: m.role, content: m.body })),
    { role: 'user', content: question },
  ];
  return ask(messages, { maxTokens: 500 });
}

/**
 * טיוטת פידבק למאמן על ניסיון של רוכב. המאמן עורך ושולח בעצמו.
 *
 * `frames` הם פריימים שהדפדפן חילץ מהסרטון. כשהם קיימים העוזר באמת
 * מסתכל על התנועה ויכול להתייחס לתנוחה, לתזמון ולמיקום הרגליים.
 * בלעדיהם הוא נשאר עיוור ומנסח פידבק כללי — לכן הניסוח בפרומפט שונה
 * בין שני המצבים, כדי שהוא לא ידבר על מה שלא ראה.
 */
export function draftFeedback({ trickId, riderName, riderLevel, note, frames }) {
  const trick = trickId ? trickById[trickId] : null;
  const hasFrames = Array.isArray(frames) && frames.length > 0;

  const prompt = [
    `כתוב טיוטת פידבק קצר לרוכב בשם ${riderName}${riderLevel ? ` (רמה: ${riderLevel})` : ''}.`,
    trick ? `הוא ניסה: ${trick.baseName} (${trick.alias}) — ${trick.desc}` : '',
    note ? `המאמן ציין: ${note}` : '',
    hasFrames
      ? 'הפריימים שלמעלה הם מתוך הסרטון עצמו, לפי הסדר. התייחס למה שאתה ' +
        'באמת רואה בהם — תנוחה, כיפוף ברכיים, מיקום הרגליים על הלוח, ' +
        'ומאזן הגוף. תן שתי נקודות מעשיות לתרגול, בטון מעודד. ' +
        'אל תקבע סופית אם הטריק נחת — הקביעה הזאת שמורה למאמן.'
      : 'תן שתי נקודות מעשיות לתרגול, בטון מעודד. ' +
        'אל תקבע אם הטריק נחת — אתה לא רואה את הסרטון.',
  ].filter(Boolean).join('\n');

  if (!hasFrames) return ask([{ role: 'user', content: prompt }]);

  const images = frames.slice(0, 8).map((data) => ({
    type: 'image',
    source: { type: 'base64', media_type: 'image/jpeg', data },
  }));

  return ask([{ role: 'user', content: [...images, { type: 'text', text: prompt }] }],
             { maxTokens: 500 });
}

/**
 * בדיקת סרטון של טריק, על סמך פריימים שהדפדפן חילץ ממנו.
 *
 * שתי שאלות נפרדות, ובכוונה:
 *   1. נחיתה — האם הרוכב סיים על הלוח או נפל.
 *   2. התאמה — האם מה שנראה מתיישב עם *שם* הטריק שנרשם.
 *
 * בלי שאלה 2 היה אפשר לצלם אוליי, לרשום "קיקפליפ", ולקבל חותמת ירוקה:
 * הבדיקה הישנה כלל לא הסתכלה על השם.
 *
 * שאלה 2 מוטה בכוונה לטובת הרוכב. שמונה פריימים לא מספיקים כדי לראות
 * סיבוב שלם של הלוח, ולכן NO נאמר רק כשיש סתירה גלויה — למשל טענה
 * לטריק שדורש היפוך, כשהלוח נראה יציב לכל אורך הקפיצה. בכל ספק:
 * UNSURE, שלא מאשים אף אחד ורק לא נותן חותמת.
 *
 * מחזיר { verdict: 'landed'|'unclear'|'bail', match: 'yes'|'no'|'unsure', reason }
 */
export async function checkAttempt(frames, trickName) {
  if (!frames?.length) {
    return { verdict: 'unclear', match: 'unsure', reason: 'לא התקבלו פריימים מהסרטון.' };
  }

  const images = frames.slice(0, 8).map((data) => ({
    type: 'image',
    source: { type: 'base64', media_type: 'image/jpeg', data },
  }));

  const raw = await ask([{
    role: 'user',
    content: [
      ...images,
      { type: 'text', text:
        `אלה פריימים לפי הסדר מתוך קטע וידאו. ייתכן שזה חלק מסרטון ארוך יותר ` +
        `שיש בו כמה ניסיונות — התייחס אך ורק למה שנראה בפריימים שלפניך.\n` +
        `הרוכב טוען שהוא נחת: "${trickName}".\n` +
        'ענה על שתי שאלות:\n' +
        '1. נחיתה — האם נראה שהרוכב סיים את הניסיון על הלוח וממשיך לנסוע, ' +
        'או שהוא נפל / הלוח עף ממנו?\n' +
        `2. התאמה — האם מה שנראה בפריימים מתיישב עם הטענה "${trickName}"?\n` +
        '   חשוב: אל תנסה לזהות איזה טריק זה. אתה רק בודק סתירה גלויה — ' +
        'למשל טענה לטריק שדורש היפוך או סיבוב של הלוח, כשהלוח נראה יציב ' +
        'ובאותו כיוון בכל הפריימים.\n' +
        '   שמונה פריימים לא מספיקים כדי לראות סיבוב מלא, ולכן בכל מקרה של ' +
        'ספק ענה UNSURE. אל תענה NO אלא אם הסתירה ברורה לחלוטין.\n' +
        'ענה בשורה אחת בדיוק בפורמט: VERDICT | MATCH | סיבה קצרה בעברית\n' +
        'כאשר VERDICT הוא אחד מ: LANDED (נראה שנחת), BAIL (נראה שנפל), ' +
        'UNCLEAR (אי אפשר לקבוע מהפריימים),\n' +
        'ו-MATCH הוא אחד מ: YES (מתיישב עם השם), NO (סותר את השם), ' +
        'UNSURE (אי אפשר לדעת).' },
    ],
  }], { maxTokens: 200, system: VISION_SYSTEM });

  const [head, second, ...rest] = raw.split('|');
  const key = (head || '').trim().toUpperCase();
  const verdict = key.includes('LANDED') ? 'landed'
    : key.includes('BAIL') ? 'bail' : 'unclear';

  /*
   * המודל עלול לוותר על השדה השני ולכתוב את הסיבה במקומו. לכן מזהים
   * אותו לפי תוכן ולא לפי מיקום: בלי מילת מפתח, השדה הוא הסיבה —
   * וההתאמה נשארת 'unsure', ברירת המחדל שאינה מאשימה ואינה מאשרת.
   */
  const matchKey = (second || '').trim().toUpperCase();
  const isMatchField = /\b(YES|NO|UNSURE)\b/.test(matchKey);
  const match = !isMatchField ? 'unsure'
    : /\bYES\b/.test(matchKey) ? 'yes'
    : /\bNO\b/.test(matchKey) ? 'no' : 'unsure';

  const reason = (isMatchField ? rest.join('|') : [second, ...rest].join('|')).trim();

  return { verdict, match, reason: reason || raw.trim() };
}

/**
 * סריקה של סרטון שלם — מוצא איפה קורים הניסיונות.
 *
 * `sheet` הוא תמונה אחת שהדפדפן הרכיב: רשת של פריימים לפי הסדר, כל
 * אחד ממוספר ומסומן בזמן שלו. זו הדרך היחידה לתת למודל להסתכל על כל
 * הסרטון בבת אחת — הוא לא מקבל וידאו, רק תמונות, ושש-עשרה תמונות
 * נפרדות עולות פי שלושה מגיליון אחד ומאבדות את רצף התנועה.
 *
 * מחזיר [{ cell, at, verdict, note }] — רגע לכל ניסיון שזוהה.
 * זו הצעה לסימון, לא קביעה: הרוכב בוחר מה להוסיף לתיק.
 */
export async function scanVideo(sheet, { cells, duration, times }) {
  const raw = await ask([{
    role: 'user',
    content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: sheet } },
      { type: 'text', text:
        `בתמונה רשת של ${cells} פריימים מתוך סרטון סקייטבורד באורך ` +
        `${Math.round(duration)} שניות, לפי הסדר, כל אחד ממוספר ומסומן בזמן שלו.\n` +
        'מצא את הניסיונות שנראים בסרטון — כל קפיצה, החלקה או ניסיון טריק.\n' +
        'לכל ניסיון כתוב שורה אחת בדיוק בפורמט:\n' +
        'מספר התא | LANDED או BAIL או UNCLEAR | תיאור קצר בעברית\n' +
        'התא הוא זה שבו הניסיון נראה הכי ברור.\n' +
        'אל תנסה לזהות איזה טריק זה — רק איפה קורה משהו ואיך זה נגמר.\n' +
        'אם לא נראה אף ניסיון, כתוב שורה אחת: NONE' },
    ],
  }], { maxTokens: 400, system: VISION_SYSTEM });

  if (/^\s*NONE/i.test(raw)) return [];

  return raw.split('\n')
    .map((line) => line.split('|'))
    .filter((parts) => parts.length >= 2)
    .map((parts) => {
      // מספר התא כפי שהמודל ראה אותו, 1 עד cells
      const cell = Math.round(Number(String(parts[0]).replace(/[^\d]/g, '')));
      if (!Number.isFinite(cell) || cell < 1 || cell > cells) return null;

      const key = String(parts[1]).toUpperCase();
      return {
        cell,
        // הזמן נלקח מהטבלה של הדפדפן ולא ממה שהמודל קרא בתמונה,
        // כי שעון שנקרא מפיקסלים הוא בדיוק סוג הדבר שהוא טועה בו
        at: times[cell - 1] ?? null,
        verdict: key.includes('LANDED') ? 'landed' : key.includes('BAIL') ? 'bail' : 'unclear',
        note: parts.slice(2).join('|').trim(),
      };
    })
    .filter((row) => row && row.at !== null)
    // אותו תא פעמיים הוא כפילות, לא שני ניסיונות
    .filter((row, i, all) => all.findIndex((x) => x.cell === row.cell) === i)
    .slice(0, 8);
}

/**
 * ניחוש על סמך התמונה הממוזערת של הניסיון.
 * זו הצעה בלבד — פריים אחד לא מספיק כדי לדעת אם הרוכב גלגל החוצה.
 */
export async function guessFromThumb(videoId, trickId, thumbUrl) {
  const image = await readThumb(videoId, thumbUrl);
  if (!image) return null;   // אין תמונה ממוזערת — אין על מה להסתכל

  const trick = trickId ? trickById[trickId] : null;

  const text = await ask([{
    role: 'user',
    content: [
      { type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: image.toString('base64') } },
      { type: 'text', text:
        `זו תמונה בודדת מתוך ניסיון של ${trick ? trick.baseName : 'טריק'}. ` +
        'תאר במשפט אחד מה נראה בתמונה מבחינת תנוחה ומיקום הלוח, ' +
        'וציין במפורש שאי אפשר לדעת מפריים אחד אם הטריק נחת.' },
    ],
  }], { maxTokens: 200 });

  return text;
}
