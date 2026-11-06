/* ==========================================================================
   Judge — שיפוט בסגנון SLS

   מה זה עושה, ומה ההבדל מ-ai.js. הקובץ שם שואל שאלות כן/לא על פריימים:
   נחת או נפל, מתיישב עם השם או סותר אותו. הוא במכוון לא נותן ציון ולא
   מזהה טריק. כאן בדיוק ההפך: זה שופט שנותן ציון מספרי לכל טריק, ולכן
   הוא בנוי אחרת.

   למה פאנל ולא שופט אחד. ציון של מודל בודד על אותה תמונה זז בקלות
   בנקודה שלמה בין קריאה לקריאה. זה לא רעש שאפשר להתעלם ממנו כשהמספר
   הוא כל התוצר. לכן כל טריק נשפט פעמיים, בשתי קריאות בלתי תלויות:
   • פער קטן  — הציון הוא הממוצע, ושני השופטים מוצגים לרוכב
   • פער גדול — נקרא שופט שלישי, והציון הוא זה שבאמצע
   • שם שונה  — גם כן שופט שלישי, גם כשהציונים קרובים: שני שופטים
                שראו טריקים שונים לא הסכימו, גם אם במקרה נתנו מספר דומה
   זה בדיוק מה שפאנל אנושי עושה כשמשמיטים את הגבוה ואת הנמוך, ובניגוד
   לבקשה "תן שלושה ציונים" בפרומפט אחד, שלושת הציונים כאן באמת נפרדים.

   מה השופט *לא* עושה: הוא לא נוגע בתיק, לא מאשר טריק ולא משנה שום
   הישג. הציון שלו הוא חוות דעת, לא הוכחה. שרשרת האמון של האפליקציה
   (ai → חיישן → קהילה → מאמן) נשארת כפי שהיא.
   ========================================================================== */

import { TRICKS, SIDES, DISCIPLINES } from './tricks.js';

const apiKey = () => process.env.ANTHROPIC_API_KEY;
/*
 * השופט רץ על Opus ולא על Sonnet כמו שאר האפליקציה. בהשוואה על שידור
 * X Games, על אותם פריימים, Sonnet קרא לאייר עם גראב "בקסייד 50-50
 * גריינד" ופספס פליפ, ו-Opus זיהה את שניהם נכון. Opus 5.5 עולה פי שניים
 * לטוקן. SKATELAB_JUDGE_MODEL גובר, כדי שאפשר יהיה לחזור בלי שינוי קוד;
 * SKATELAB_AI_MODEL כבר לא משפיע על השופט, כי הוא נועד לשאר האפליקציה.
 */
const MODEL = () => process.env.SKATELAB_JUDGE_MODEL || 'claude-opus-5-5';
const ENDPOINT = 'https://api.anthropic.com/v1/messages';

/* מעל הפער הזה בין שני השופטים נקרא שלישי. 2.0 מתוך 10 הוא לא חילוקי
 * דעות על סטייל אלא סימן שאחד מהם ראה טריק אחר. */
const PANEL_SPLIT = 2.0;

/* קריאה שנתקעה לא אמורה להשאיר את הדף על "הפאנל עובד" לנצח. 60 שניות
 * לא הספיקו: כשהמודל חושב לפני שהוא עונה, שופט על שלושה גיליונות לוקח
 * לפעמים יותר, ובבדיקה על שידור X Games שלושה שופטים נחתכו באמצע. */
const TIMEOUT_MS = 150_000;

/**
 * מפתח להשוואת שמות בין שופטים: "קיקפליפ", "Kickflip" ו-"kick flip"
 * הם אותו טריק. אותו ניקוי כמו ב-achievements.js, בלי לייבא אותו —
 * הוא מושך איתו את המסד, והשופט לא צריך מסד.
 */
const KEY = new Map();
const norm = (text) => String(text || '')
  .toLowerCase()
  .replace(/\([^)]*\)/g, ' ')                     // "קיקפליפ (Kickflip)" -> השם הראשון
  .replace(/[׳״'"`־\-–—_.,!?]/g, '')
  .replace(/\b(fs|bs|frontside|backside)\b/g, '')
  .replace(/פרונטסייד|בקסייד|פרונט סייד|בק סייד/g, '')
  .replace(/\s+/g, '')
  .trim();
TRICKS.forEach((t) => {
  [t.baseName, t.alias, t.name].forEach((n) => { if (norm(n)) KEY.set(norm(n), t.baseId); });
});
const sideOf = (name) => (/פרונטסייד|frontside|\bfs\b/i.test(name) ? 'fs'
  : /בקסייד|backside|\bbs\b/i.test(name) ? 'bs' : '');
/* פרונטסייד 180 ובקסייד 180 הם טריקים שונים, אז הכיוון חלק מהמפתח */
const trickKey = (name) => {
  const k = KEY.get(norm(name)) || norm(name);
  const sd = sideOf(String(name || ''));
  return sd ? `${k}|${sd}` : k;
};

const SYSTEM = `אתה שופט בתחרות סקייטבורד מקצועית, בסגנון Street League.
אתה נותן ציון מספרי אחד לכל טריק, בין 0.0 ל-10.0, עם ספרה אחת אחרי הנקודה.
הציון משקלל ארבעה דברים יחד, ולא בנפרד: קושי הטריק, ביצוע ונחיתה, סטייל, והתאמה למכשול.
10.0 הוא טריק ברמת תחרות עולמית. 8 הוא טריק קשה שנוחת נקי. 5 הוא טריק פשוט שנוחת.
2 הוא ניסיון שלא נחת. 0 הוא נפילה מלאה.
אתה שופט ילדים ונוער, אז אתה הוגן ולא אכזרי, אבל אתה גם לא מחלק עשרות.
אתה עונה בעברית, קצר ויבש, בדיוק בפורמט שמתבקש ובלי משפטי פתיחה.`;

/*
 * הקטלוג כשמות בלבד — השופט צריך לקרוא לטריק בשם שקיים באפליקציה.
 *
 * מחולק לפי סוג. כרשימה אחת ארוכה שמתחילה בטריקי רחוב, השופט בחר
 * בשידור פארק "קיקפליפ" ו"אוליי מעל מכשול" ל-33 מתוך 60 טריקים — השמות
 * הראשונים והמוכרים — גם כשהלוח לא הסתובב בכלל.
 */
const names = () => DISCIPLINES.map((d) => {
  const list = TRICKS.filter((t) => t.discipline === d.id && (!t.side || t.side === 'fs'))
    .map((t) => t.baseName);
  return list.length ? `${d.label}: ${list.join(', ')}` : '';
}).filter(Boolean).join('\n');

/** הטריקים שיש להם כיוון — רק בהם השופט חייב לקבוע פרונטסייד או בקסייד. */
const sidedNames = () => [...new Set(TRICKS.filter((t) => t.side).map((t) => t.baseName))].join(', ');

const SIDE_LABEL = Object.fromEntries(SIDES.map((x) => [x.id, x.label]));

/*
 * פרונטסייד ובקסייד, בהגדרה שלא תלויה בזווית הצילום.
 *
 * הגדרה לפי "שעון" (נגד כיוון השעון לרגולר) נכונה רק במבט מלמעלה,
 * והמצלמה כמעט אף פעם לא שם. לכן ההגדרה כאן היא לפי מה שהרוכב עצמו
 * רואה: לאן פונה החזה. היא עובדת מכל זווית, וגם על מכשול וגם בסיבוב.
 */
const SIDE_RULES = 'פרונטסייד ובקסייד:\n'
  + '• סיבוב (180, 360, האף קאב, אייר בבול): פרונטסייד כשהחזה נפתח קודם לכיוון הנסיעה '
  + 'או לקופינג והרוכב רואה לאן הוא מסתובב; בקסייד כשהגב פונה קודם והסיבוב עיוור.\n'
  + '• גריינד או סלייד: פרונטסייד כשהרוכב ניגש למכשול כשהחזה ואצבעות הרגליים פונות אליו; '
  + 'בקסייד כשהגב והעקבים פונים אליו.\n'
  + '• שאב-איט: פרונטסייד כשהזנב מסתובב מלפני הרוכב (צד הבהונות); בקסייד כשהוא עובר מאחוריו (צד העקבים).\n';

/* תיאור לפני שם: המודל כותב לפי הסדר, ושם שנבחר אחרי תיאור צריך להתיישב איתו */
const NAMING_RULES = 'לפני השם, תאר בשלושה שדות מה ראית:\n'
  + '• board — מה הלוח עשה: "נשאר מתחת לרגליים", "התהפך סביב הציר הארוך", "הסתובב שטוח 180", '
  + '"הסתובב שטוח 360", "התהפך והסתובב יחד", "ביד של הרוכב (גראב)", "החליק על המכשול".\n'
  + '• body — בכמה מעלות הגוף הסתובב: 0, 180, 360, 540.\n'
  + '• contact — "אוויר" (בלי מגע), "גריינד" (טראקים על המכשול), "סלייד" (הלוח עצמו על המכשול), '
  + '"סטול" (עצירה על הקופינג), "אינוורט" (יד על הקופינג והגוף הפוך), "בלי מכשול".\n'
  + 'השם חייב להתיישב עם התיאור: פליפ (קיקפליפ, הילפליפ וכו׳) רק אם board הוא "התהפך"; '
  + 'גריינד רק אם contact הוא גריינד; אייר עם גראב נקרא לפי הגראב (אינדי, מלון, מיוט, סטיילפיש...).\n'
  + 'בפארק ובבול רוב הטריקים הם איירים מעל הקופינג, גראבים, אינוורטים, גריינדים וסטולים על הקופינג — '
  + 'אל תבחר שם של רחוב כמו "אוליי מעל מכשול" או "קיקפליפ" רק כי הוא מוכר.\n';

/** שם, כיוון וציון מתשובה של שופט — אותו עיבוד לשופט בפאנל ולרשימת טריקים בחלון. */
function shapeTrick(a) {
  const side = a.side === 'fs' || a.side === 'bs' ? a.side : sideOf(String(a.trick || ''));
  // אם המודל בכל זאת כתב את הכיוון בשם, מוציאים אותו משם כדי שלא יוכפל
  const base = String(a.trick || 'לא ברור')
    .replace(/^\s*(פרונטסייד|בקסייד|frontside|backside|fs|bs)\s+/i, '').slice(0, 60);
  return {
    trick: side ? `${SIDE_LABEL[side]} ${base}` : base,
    side,
    landed: a.landed !== false,
    score: round1(clamp(a.score, 0, 10)),
    rotation: Math.min(540, Math.max(0, Math.round((Number(a.rotation ?? a.body) || 0) / 180) * 180)),
    grab: String(a.grab || '').slice(0, 60),
    board: String(a.board || '').slice(0, 60),
    contact: String(a.contact || '').slice(0, 30),
  };
}

const stanceText = (stance) => (stance === 'regular' ? 'רגולר (רגל שמאל קדימה)'
  : stance === 'goofy' ? 'גופי (רגל ימין קדימה)' : '');

/*
 * מקום למחשבה, מעבר לאורך התשובה.
 *
 * המודל חושב לפני שהוא עונה, והמחשבה נספרת בתוך max_tokens. עם תקרה
 * של 500 קרה בפועל שהמחשבה לבדה מילאה את כל ה-500, והתשובה חזרה
 * ריקה או חתוכה באמצע מילה: בחיפוש טריקים בשידור X Games ארבעה
 * גיליונות מתוך שמונה חזרו בלי אף שורה. `maxTokens` נשאר אורך התשובה,
 * והמקום למחשבה נוסף מעליו. משלמים רק על מה שנוצל בפועל.
 */
const THINKING_ROOM = 3000;

async function ask(content, { maxTokens = 500 } = {}) {
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey(),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL(),
        max_tokens: maxTokens + THINKING_ROOM,
        system: SYSTEM,
        messages: [{ role: 'user', content }],
      }),
    });
  } catch (err) {
    console.warn('שיפוט נכשל:', err.name, err.message);
    throw new Error(err.name === 'TimeoutError' ? 'השופט לא ענה בזמן, נסו שוב'
                                                 : 'שירות השיפוט לא זמין כרגע');
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.warn('שיפוט נכשל:', res.status, detail.slice(0, 300));
    throw new Error(res.status === 401 ? 'מפתח ה-AI לא תקין'
                  : res.status === 429 ? 'השופט עמוס כרגע, נסו שוב בעוד דקה'
                  : 'שירות השיפוט לא זמין כרגע');
  }

  const data = await res.json();
  return (data.content || []).filter((c) => c.type === 'text')
    .map((c) => c.text).join('').trim();
}

const image = (data) => ({
  type: 'image',
  source: { type: 'base64', media_type: 'image/jpeg', data },
});

/*
 * קריאת JSON מתשובה של מודל. גדר קוד, משפט לפני או אחרי, או סוגריים
 * מיותרים — כולם קורים, וכולם לא שווים קריאה חוזרת בתשלום.
 */
function parseJson(raw) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : raw;
  const start = body.search(/[{[]/);
  const end = Math.max(body.lastIndexOf('}'), body.lastIndexOf(']'));
  if (start < 0 || end <= start) throw new Error('השופט לא החזיר תשובה קריאה');
  return JSON.parse(body.slice(start, end + 1));
}

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Number(n) || 0));
const round1 = (n) => Math.round(n * 10) / 10;

/** תיאור המדידות שהדפדפן כבר עשה, כדי שהשופט לא ינחש מה שכבר נמדד. */
/*
 * רק מה שבאמת נמדד נכנס לפרומפט.
 *
 * בלי גובה הרוכב אין סרגל, ואז אין מטרים — והשופט לא צריך אותם:
 * הוא רואה את הפריימים. מספר שלא נמדד פשוט לא נאמר, במקום להישלח
 * כאפס או כניחוש.
 */
function measured(m) {
  const rail = m.surface === 'rail';
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
  const height = num(m.height), dist = num(m.dist);
  // טריק שה-AI מצא או שהרוכב סימן: אין מדידות, רק הפריימים
  if (m.source === 'ai' || m.source === 'manual') {
    return 'אין מדידה אוטומטית לטריק הזה — הוא סומן לפי הפריימים בלבד. קבע הכל מהתמונות';
  }
  return [
    `משטח: ${rail ? 'מעקה או קרב' : 'קרקע'}`,
    `זווית הצילום: ${m.view === 'front' ? 'מלפנים או מאחור' : 'מהצד'}`,
    num(m.air) != null ? `${rail ? 'זמן על המכשול' : 'זמן אוויר'}: ${(+m.air).toFixed(2)} שניות` : '',
    height != null ? `גובה: ${height.toFixed(2)} מטר` : '',
    dist != null ? `מרחק: ${dist.toFixed(2)} מטר` : '',
    rail && num(m.grind) != null ? `החלקה: ${(+m.grind).toFixed(2)} שניות` : '',
    m.cameraMoved ? 'המצלמה זזה בצילום, והתזוזה שלה נוכתה מהמדידות' : '',
    Number(m.slow) > 1 ? `הקטע צולם בהילוך איטי ×${Number(m.slow)}, והזמנים כבר מומרים לשניות אמיתיות` : '',
  ].filter(Boolean).join(', ');
}

/* שלושת השדות הראשונים הם תיאור, והם לפני השם בכוונה: המודל כותב לפי
 * הסדר, ושם שנבחר אחרי תיאור צריך להתיישב איתו */
const SHAPE = '{"board":"מה הלוח עשה באוויר","body":180,"contact":"אוויר",'
  + '"trick":"שם הטריק בלי כיוון","side":"fs","landed":true,"score":7.4,"rotation":180,"grab":"",'
  + '"feet":"על הברגים","frames":"בפריימים 7 עד 11 הלוח משלים סיבוב סביב הציר הארוך",'
  + '"note":"משפט אחד בעברית עם טיפ מעשי"}';

/** שופט אחד, קריאה אחת. `seat` רק כדי שהתשובות לא יהיו זהות לחלוטין. */
async function oneJudge(sheets, m, { overview, combo, claimed, seat, stance, allowNone = false }) {
  const whole = m.source === 'ai' || m.source === 'manual';
  const text =
    `${overview ? 'התמונה הראשונה היא סקירה של כל הסרטון, פריימים פרושים על אורכו עם חותמת זמן, כדי שתראה את המקום ואת המכשול. שאר התמונות' : 'התמונות'} הן טריק אחד, מפורק לפריימים לפי הסדר, ממוספרים, משמאל למעלה לימין למטה, `
    + (whole ? 'פריימים שלמים מהסרטון. אם יש בהם כמה אנשים, שפוט את הרוכב שנמצא באמצע טריק.\n\n'
             : 'חתוכים סביב הרגליים והלוח.\n\n')
    + `מה שנמדד מהסרטון עצמו: ${measured(m)}.\n`
    + (combo ? `${combo}\n` : '')
    + (claimed ? `הרוכב אומר שזה "${claimed}". בדוק את הטענה מול הפריימים: אם היא מתיישבת, השתמש בשם הזה; אם היא נסתרת, רשום את מה שאתה רואה והסבר ב-note מה לא מסתדר. אל תקבל את השם רק כי נאמר.\n` : '')
    + '\nעבור על הפריימים לפי הסדר ועקוב אחרי הלוח. סיבוב סביב הציר הארוך הוא קיקפליפ או היילפליפ, '
    + 'סיבוב סביב הציר הקצר הוא שאב-איט, שילוב של שניהם הוא ואריאל או טרה פליפ, בלי סיבוב של הלוח זה אולי. '
    + 'על מכשול קבע לפי אילו טראקים נוגעים ובאיזו זווית הלוח למכשול.\n'
    + NAMING_RULES
    + `קרא לטריק בשם מתוך הרשימה הזאת, לפי סוג, ואם שום שם לא מתאים כתוב "לא ברור":\n${names()}\n`
    + `לטריקים האלה יש כיוון, ובהם חובה לקבוע side: ${sidedNames()}\n`
    + SIDE_RULES
    + (stanceText(stance) ? `הסטאנס של הרוכב: ${stanceText(stance)}. אם הוא רוכב פייקי או סוויץ׳, הכיוון נקבע לפי הגוף ולא לפי הסטאנס.\n` : '')
    + 'בשדה side כתוב "fs" לפרונטסייד, "bs" לבקסייד, או "" כשלטריק אין כיוון או שאי אפשר לראות. '
    + 'את הכיוון אל תכתוב בתוך trick — רק ב-side.\n'
    + 'תן ציון אחד בין 0.0 ל-10.0. ציון מתחת ל-3 שמור לטריק שלא נחת.\n'
    + 'קבע גם כמה מעלות הרוכב הסתובב סביב עצמו: 0, 180, 360 או 540. זה נקבע ממך ולא מהמדידות, '
    + 'כי רוחב הלוח מסתיר את הסיבוב בכל מדידה אוטומטית. אם אי אפשר לראות, החזר 0.\n'
    + 'ציין אם תפס את הלוח ביד ואיפה (אינדי בצד הבהונות, מלון בצד העקבים, נוזגראב בחרטום, טייגראב בזנב), '
    + 'ואיפה הרגליים נחתו על הלוח.\n'
    + 'בשדה frames כתוב באילו מספרי פריימים ראית את מה שהכריע. אם הפריימים מטושטשים מכדי לקבוע, '
    + 'כתוב זאת ב-note ותן ציון שמרני במקום לנחש.\n'
    + (allowNone ? 'אם בפריימים אין טריק בכלל — רק רכיבה רגילה, עמידה, הליכה, קהל או תקריב — '
                 + 'כתוב בשדה trick בדיוק "אין טריק" ותן score 0.\n' : '')
    + `שופט מספר ${seat}. שפוט לפי מה שאתה רואה, בלי להתחשב בשופטים אחרים.\n`
    + `החזר רק אובייקט JSON יחיד, בדיוק בצורה הזאת: ${SHAPE}`;

  const content = [
    ...(overview ? [image(overview)] : []),
    ...sheets.map(image),
    { type: 'text', text },
  ];

  // התשובה כוללת עכשיו תיאור לפני השם; 500 טוקנים בעברית חתכו אותה באמצע
  const a = parseJson(await ask(content, { maxTokens: 900 }));
  return {
    ...shapeTrick(a),
    feet: String(a.feet || '').slice(0, 60),
    frames: String(a.frames || '').slice(0, 200),
    note: String(a.note || '').slice(0, 300),
  };
}

/**
 * שיפוט טריק אחד על ידי פאנל.
 *
 * מחזיר { score, judges: [...], trick, agreed, ... } — `judges` הוא כל
 * מה שנאמר, כולל ציון שהושמט, כדי שהרוכב יראה שהיה ויכוח ולא יקבל
 * מספר אחד בלי הסבר.
 */
export async function judgeTrick(sheets, m, { overview = null, combo = '', claimed = '', stance = '' } = {}) {
  const ctx = { overview, combo, claimed, stance };
  const [a, b] = await Promise.all([
    oneJudge(sheets, m, { ...ctx, seat: 1 }),
    oneJudge(sheets, m, { ...ctx, seat: 2 }),
  ]);

  const judges = [a, b];
  let score = round1((a.score + b.score) / 2);
  let dropped = null;
  const out = new Set();          // אינדקסים של השופטים שהושמטו

  const split = Math.abs(a.score - b.score) > PANEL_SPLIT;
  const named = trickKey(a.trick) !== trickKey(b.trick);
  if (split || named) {
    const c = await oneJudge(sheets, m, { ...ctx, seat: 3 });
    judges.push(c);
    /* הגבוה והנמוך יורדים, מה שנשאר באמצע הוא הציון. ההשמטה נשמרת לפי
     * מושב ולא לפי ציון: עם 5, 5, 8 שני החמישיות היו מסומנות כמושמטות. */
    const order = [0, 1, 2].sort((x, y) => judges[x].score - judges[y].score);
    score = judges[order[1]].score;
    dropped = [judges[order[0]].score, judges[order[2]].score];
    out.add(order[0]); out.add(order[2]);
  }

  /* השם נקבע ברוב, לפי הטריק ולא לפי הכתיב. בלי רוב נשמר השם של השופט
   * שציונו נבחר, והרוכב רואה שלא הייתה הסכמה במקום שם שנראה ודאי. */
  const tally = new Map();
  judges.forEach((j) => {
    const k = trickKey(j.trick);
    tally.set(k, (tally.get(k) || 0) + 1);
  });
  const [topKey, topN] = [...tally.entries()].sort((x, y) => y[1] - x[1])[0];
  const agreed = topN > 1;
  /* הפרטים (סיבוב, נחיתה, הערה) נלקחים משופט שראה את הטריק שנבחר,
   * והקרוב ביותר לציון הסופי — לא משופט שתיאר טריק אחר. */
  const pool = agreed ? judges.filter((j) => trickKey(j.trick) === topKey) : judges;
  const picked = pool.slice().sort((x, y) => Math.abs(x.score - score) - Math.abs(y.score - score))[0];

  return {
    trick: picked.trick,
    agreed,
    score,
    dropped,
    landed: judges.filter((j) => j.landed).length > judges.length / 2,
    rotation: picked.rotation,
    grab: picked.grab,
    feet: picked.feet,
    frames: picked.frames,
    note: picked.note,
    judges: judges.map((j, i) => ({ score: j.score, trick: j.trick, out: out.has(i) })),
  };
}

/**
 * כל הטריקים שבחלון של כ-3 שניות, עם הפריימים של כל אחד, שופט אחד לחלון.
 *
 * חיפוש ה-AI בשידור מוצא עשרות רגעים, והפאנל המלא (2–3 שופטים) על כל
 * אחד יקר ואיטי — לכן הוא רץ רק על שמונה. כאן כל רגע מקבל שם, כיוון,
 * נחיתה וציון ראשוני.
 *
 * למה רשימה ולא שם אחד לחלון: בבדיקה על שידור X Games חלון אחד הכיל
 * פליפ מהבנק בפריימים 6–8 וגריינד על הקופינג בפריימים 25–28. שם אחד
 * לחלון בחר אחד מהם באקראי — פעם קיקפליפ, פעם 50-50 — וכל גרסה צדקה
 * בחצי. עם מספרי הפריימים כל טריק מקבל זמן מדויק משלו, ושני טריקים
 * בחלון אחד הופכים לשני כרטיסים.
 */
export async function nameTricks(items, { stance = '' } = {}) {
  return Promise.all(items.map(async ({ sheets, frames }) => {
    const text =
      `התמונות הן כ-3 שניות רצופות מסרטון סקייטבורד, מפורקות ל-${frames || sheets.length * 16} פריימים `
      + 'ממוספרים לפי הסדר, משמאל למעלה לימין למטה, ממשיכים מתמונה לתמונה. פריימים שלמים — '
      + 'אם יש בהם כמה אנשים, עקוב אחרי הרוכב שמבצע טריקים.\n'
      + 'מצא כל טריק שמתבצע בפריימים האלה: יכולים להיות שניים או שלושה ברצף, וטריק יכול להתחיל או '
      + 'להיגמר בקצה. רכיבה רגילה, קארב בלי טריק, עמידה, תקריב או קהל — לא טריק.\n'
      + 'לכל טריק כתוב from ו-to: מספר הפריים הראשון והאחרון שבהם הוא מתבצע (מהפופ או העלייה למכשול '
      + 'ועד הנחיתה).\n'
      + NAMING_RULES
      + `קרא לכל טריק בשם מתוך הרשימה הזאת, לפי סוג, ואם שום שם לא מתאים כתוב "לא ברור":\n${names()}\n`
      + `לטריקים האלה יש כיוון, ובהם חובה לקבוע side: ${sidedNames()}\n`
      + SIDE_RULES
      + (stanceText(stance) ? `הסטאנס של הרוכב: ${stanceText(stance)}.\n` : '')
      + 'side הוא "fs", "bs" או "". את הכיוון אל תכתוב בתוך trick.\n'
      + 'ציון לכל טריק בין 0.0 ל-10.0, מתחת ל-3 לטריק שלא נחת.\n'
      + 'החזר רק JSON: {"tricks":[{"from":6,"to":9,"board":"...","body":0,"contact":"...",'
      + '"trick":"...","side":"","landed":true,"score":6.5,"grab":""}]}. אם אין אף טריק: {"tricks":[]}';
    try {
      const a = parseJson(await ask([...sheets.map(image), { type: 'text', text }], { maxTokens: 1500 }));
      const list = Array.isArray(a) ? a : Array.isArray(a.tricks) ? a.tricks : [];
      return {
        tricks: list.slice(0, 5).map((t) => ({
          ...shapeTrick(t),
          from: Math.max(1, Math.round(Number(t.from) || 1)),
          to: Math.max(1, Math.round(Number(t.to ?? t.from) || 1)),
        })).filter((t) => !/^\s*(אין טריק|לא טריק)/.test(t.trick)),
      };
    } catch (err) {
      return { error: err.message };
    }
  }));
}

/**
 * מציאת הטריקים בסרטון כולו, מהתמונות בלבד.
 *
 * למה זה קיים לצד המדידה בדפדפן. המדידה עובדת מהפרש בין פריימים, וזה
 * טוב לסרטון טלפון של רן ברחוב. על שידור תחרות — חיתוכים בין מצלמות,
 * זום מקצועי, רוכב קטן בפריים ובול בלי "קרקע" — היא לא מוצאת כלום. כאן
 * המודל מסתכל על גיליונות של פריימים לאורך כל הסרטון ומצביע על התאים
 * שבהם קורה טריק.
 *
 * `times` הוא זמן כל תא, לפי הסדר על פני כל הגיליונות. המודל מחזיר
 * מספרי תאים, והזמן נלקח מהטבלה — שעון שנקרא מפיקסלים הוא בדיוק מה
 * שמודל טועה בו.
 */
export async function findMoments(sheets, times, per = 16) {
  const PER = per;
  const found = [];
  // גיליון אחד לקריאה: כל גיליון שואל רק על 16 התאים שלו, ומספור התאים לא מתבלבל
  await Promise.all(sheets.map(async (sheet, si) => {
    const first = si * PER;
    const cells = Math.min(PER, times.length - first);
    if (cells <= 0) return;
    const text =
      `בתמונה ${cells} פריימים מסרטון סקייטבורד, לפי הסדר, ממוספרים 1 עד ${cells} משמאל למעלה לימין למטה `
      + '(המספר בפינה של כל פריים). זה יכול להיות סרטון טלפון של רן ברחוב, או שידור של תחרות בפארק או בבול.\n'
      + 'מצא כל פריים שבו רוכב באמצע טריק. בפארק ובבול זה כולל:\n'
      + '• אוויר: הלוח והרוכב מעל הקופינג או מעל קצה הרמפה, כולל אינוורט והנדפלנט כשהרוכב הפוך\n'
      + '• גריינד, סלייד או סטול: הלוח על הקופינג, על מעקה, על שפה של קופסה או על לדג׳\n'
      + '• פליפים וסיבובים של הלוח, וקפיצה מעל מכשול או מעל גאפ\n'
      + 'לא טריק: רכיבה רגילה על הקיר או ברצפת הבול, עמידה, הליכה, תקריב של פנים, ראיון, קהל, גרפיקה.\n'
      + 'כשיש ספק אם זה טריק — כלול אותו. הרוכב יכול למחוק טריק מיותר בלחיצה, אבל טריק שלא נמצא פשוט חסר.\n'
      + 'לכל טריק שורה אחת בדיוק: מספר הפריים | ניחוש קצר של שם הטריק בעברית\n'
      + 'אם אותו טריק נראה בכמה פריימים צמודים, כתוב רק את הפריים שבו הוא הכי ברור.\n'
      + 'אם אין אף טריק, כתוב רק: NONE';
    const raw = await ask([image(sheet), { type: 'text', text }], { maxTokens: 500 });
    if (/^\s*NONE/i.test(raw)) return;
    raw.split('\n').forEach((line) => {
      const [cellPart, ...rest] = line.split('|');
      const cell = Math.round(Number(String(cellPart).replace(/[^\d]/g, '')));
      if (!Number.isFinite(cell) || cell < 1 || cell > cells) return;
      const at = Number(times[first + cell - 1]);
      const guess = rest.join('|').trim();
      // המודל לפעמים מוסיף שורה ואז מסביר שזה לא טריק
      if (/לא טריק|רכיבה רגילה|not a trick/i.test(guess)) return;
      if (Number.isFinite(at)) found.push({ at, guess: guess.slice(0, 40) });
    });
  }));
  // שני תאים קרובים מאוד הם אותו טריק שנראה פעמיים
  found.sort((x, y) => x.at - y.at);
  // התקרה גבוהה כדי ששידור ארוך לא ייחתך באמצע — הסדר הוא לפי זמן
  return found.filter((f, i) => i === 0 || f.at - found[i - 1].at > 1.2).slice(0, 150);
}

/**
 * ציון ה-Flow של הרן כולו: עד כמה זה נראה כמו קו רצוף ולא כמו אוסף
 * ניסיונות. זאת קריאה אחת על גיליון הסקירה בלבד, כי השאלה היא על
 * הרצף ולא על טריק בודד.
 */
export async function judgeFlow(overview, { tricks, duration, landed }) {
  const text =
    `בתמונה פריימים מתוך רן סקייטבורד באורך ${Math.round(duration)} שניות, לפי הסדר, עם חותמת זמן בכל אחד.\n`
    + `נמדדו בו ${tricks} טריקים, מתוכם ${landed} נראו כנחיתה.\n`
    + 'תן ציון Flow אחד בין 0.0 ל-10.0 לרן כולו: עד כמה הרוכב שמר על מהירות ורצף, '
    + 'כמה הטריקים השתלבו בקו אחד במקום לעצור ולהתחיל מחדש, וכמה המכשולים נוצלו.\n'
    + 'החזר רק: {"flow":7.2,"note":"משפט אחד בעברית"}';

  const a = parseJson(await ask([image(overview), { type: 'text', text }], { maxTokens: 200 }));
  return { flow: round1(clamp(a.flow, 0, 10)), note: String(a.note || '').slice(0, 300) };
}

/**
 * הרכבת התוצאה בפורמט של SLS.
 *
 * כך בנוי הניקוד שם, לפי טבלאות התוצאות של התחרויות: הציון הסופי הוא
 * סכום של שלושה חלקים ולא ממוצע —
 *   Flow    ציון אחד לרן כולו                       עד 10
 *   Control סכום ארבעת הטריקים הטובים ביותר          עד 40
 *   Impact  הטריק הטוב ביותר, נספר שוב בנפרד         עד 10
 * סך הכל עד 60. בגלל ש-Impact סופר פעמיים את הטריק הגדול, המבנה הזה
 * מתגמל גם עקביות וגם רגע אחד חזק — וזה בדיוק מה שהוא אמור לעשות.
 */
export function slsTotal(scores, flow) {
  const sorted = scores.slice().sort((a, b) => b - a);
  const control = round1(sorted.slice(0, 4).reduce((s, n) => s + n, 0));
  const impact = sorted.length ? sorted[0] : 0;
  return {
    flow: round1(flow),
    control,
    impact: round1(impact),
    total: round1(flow + control + impact),
    counted: Math.min(4, sorted.length),
  };
}
