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

/** קריאה אחת ל-API. מחזירה טקסט, או זורקת שגיאה עם הודעה בעברית. */
async function ask(messages, { maxTokens = 400 } = {}) {
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
      system: SYSTEM,
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

/** טיוטת פידבק למאמן על ניסיון של רוכב. המאמן עורך ושולח בעצמו. */
export function draftFeedback({ trickId, riderName, riderLevel, note }) {
  const trick = trickId ? trickById[trickId] : null;

  const prompt = [
    `כתוב טיוטת פידבק קצר לרוכב בשם ${riderName}${riderLevel ? ` (רמה: ${riderLevel})` : ''}.`,
    trick ? `הוא ניסה: ${trick.baseName} (${trick.alias}) — ${trick.desc}` : '',
    note ? `המאמן ציין: ${note}` : '',
    'תן שתי נקודות מעשיות לתרגול, בטון מעודד. אל תקבע אם הטריק נחת — אתה לא רואה את הסרטון.',
  ].filter(Boolean).join('\n');

  return ask([{ role: 'user', content: prompt }]);
}

/**
 * בדיקת סרטון של טריק, על סמך פריימים שהדפדפן חילץ ממנו.
 *
 * מה שהמודל באמת יודע: להבחין בין "הלוח מתחת לרגליים והרוכב ממשיך"
 * לבין "הלוח עף והרוכב על הרצפה".
 * מה שהוא לא יודע: להבדיל בין טריקים דומים, ולא לזהות סרטון גנוב.
 * לכן זה מסנן ראשון בלבד, ואישור אנושי של מאמן תמיד גובר עליו.
 *
 * מחזיר { verdict: 'landed'|'unclear'|'bail', reason }
 */
export async function checkAttempt(frames, trickName) {
  if (!frames?.length) return { verdict: 'unclear', reason: 'לא התקבלו פריימים מהסרטון.' };

  const images = frames.slice(0, 8).map((data) => ({
    type: 'image',
    source: { type: 'base64', media_type: 'image/jpeg', data },
  }));

  const raw = await ask([{
    role: 'user',
    content: [
      ...images,
      { type: 'text', text:
        `אלה פריימים לפי הסדר מתוך סרטון קצר. הרוכב טוען שהוא נחת: "${trickName}".\n` +
        'שאלה אחת בלבד: האם נראה שהרוכב סיים את הניסיון על הלוח וממשיך לנסוע, ' +
        'או שהוא נפל / הלוח עף ממנו?\n' +
        'אל תנסה לזהות איזה טריק זה — אתה לא יכול לדעת מפריימים בודדים.\n' +
        'ענה בשורה אחת בדיוק בפורמט: VERDICT | סיבה קצרה בעברית\n' +
        'כאשר VERDICT הוא אחד מ: LANDED (נראה שנחת), BAIL (נראה שנפל), ' +
        'UNCLEAR (אי אפשר לקבוע מהפריימים).' },
    ],
  }], { maxTokens: 150 });

  const [head, ...rest] = raw.split('|');
  const key = (head || '').trim().toUpperCase();
  const verdict = key.includes('LANDED') ? 'landed'
    : key.includes('BAIL') ? 'bail' : 'unclear';

  return { verdict, reason: rest.join('|').trim() || raw.trim() };
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
