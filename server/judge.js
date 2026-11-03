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

import { TRICKS } from './tricks.js';

const apiKey = () => process.env.ANTHROPIC_API_KEY;
const MODEL = () => process.env.SKATELAB_JUDGE_MODEL
                 || process.env.SKATELAB_AI_MODEL
                 || 'claude-sonnet-5';
const ENDPOINT = 'https://api.anthropic.com/v1/messages';

/* מעל הפער הזה בין שני השופטים נקרא שלישי. 2.0 מתוך 10 הוא לא חילוקי
 * דעות על סטייל אלא סימן שאחד מהם ראה טריק אחר. */
const PANEL_SPLIT = 2.0;

/* קריאה שנתקעה לא אמורה להשאיר את הדף על "הפאנל עובד" לנצח */
const TIMEOUT_MS = 60_000;

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
const trickKey = (name) => KEY.get(norm(name)) || norm(name);

const SYSTEM = `אתה שופט בתחרות סקייטבורד מקצועית, בסגנון Street League.
אתה נותן ציון מספרי אחד לכל טריק, בין 0.0 ל-10.0, עם ספרה אחת אחרי הנקודה.
הציון משקלל ארבעה דברים יחד, ולא בנפרד: קושי הטריק, ביצוע ונחיתה, סטייל, והתאמה למכשול.
10.0 הוא טריק ברמת תחרות עולמית. 8 הוא טריק קשה שנוחת נקי. 5 הוא טריק פשוט שנוחת.
2 הוא ניסיון שלא נחת. 0 הוא נפילה מלאה.
אתה שופט ילדים ונוער, אז אתה הוגן ולא אכזרי, אבל אתה גם לא מחלק עשרות.
אתה עונה בעברית, קצר ויבש, בדיוק בפורמט שמתבקש ובלי משפטי פתיחה.`;

/** הקטלוג כשמות בלבד — השופט צריך לקרוא לטריק בשם שקיים באפליקציה. */
const names = () => TRICKS
  .filter((t) => !t.side || t.side === 'fs')
  .map((t) => t.baseName)
  .join(', ');

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
        max_tokens: maxTokens,
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
  return [
    `משטח: ${rail ? 'מעקה או קרב' : 'קרקע'}`,
    `זווית הצילום: ${m.view === 'front' ? 'מלפנים או מאחור' : 'מהצד'}`,
    `${rail ? 'זמן על המכשול' : 'זמן אוויר'}: ${(+m.air).toFixed(2)} שניות`,
    height != null ? `גובה: ${height.toFixed(2)} מטר` : '',
    dist != null ? `מרחק: ${dist.toFixed(2)} מטר` : '',
    rail ? `החלקה: ${(+m.grind).toFixed(2)} שניות` : '',
    m.cameraMoved ? 'המצלמה זזה בצילום, והתזוזה שלה נוכתה מהמדידות' : '',
  ].filter(Boolean).join(', ');
}

const SHAPE = '{"trick":"שם הטריק","landed":true,"score":7.4,"rotation":180,"grab":"",'
  + '"feet":"על הברגים","frames":"בפריימים 7 עד 11 הלוח משלים סיבוב סביב הציר הארוך",'
  + '"note":"משפט אחד בעברית עם טיפ מעשי"}';

/** שופט אחד, קריאה אחת. `seat` רק כדי שהתשובות לא יהיו זהות לחלוטין. */
async function oneJudge(sheets, m, { overview, combo, claimed, seat }) {
  const text =
    `${overview ? 'התמונה הראשונה היא סקירה של כל הסרטון, פריימים פרושים על אורכו עם חותמת זמן, כדי שתראה את המקום ואת המכשול. שאר התמונות' : 'התמונות'} הן טריק אחד, מפורק לפריימים לפי הסדר, ממוספרים, משמאל למעלה לימין למטה, חתוכים סביב הרגליים והלוח.\n\n`
    + `מה שנמדד מהסרטון עצמו: ${measured(m)}.\n`
    + (combo ? `${combo}\n` : '')
    + (claimed ? `הרוכב אומר שזה "${claimed}". בדוק את הטענה מול הפריימים: אם היא מתיישבת, השתמש בשם הזה; אם היא נסתרת, רשום את מה שאתה רואה והסבר ב-note מה לא מסתדר. אל תקבל את השם רק כי נאמר.\n` : '')
    + '\nעבור על הפריימים לפי הסדר ועקוב אחרי הלוח. סיבוב סביב הציר הארוך הוא קיקפליפ או היילפליפ, '
    + 'סיבוב סביב הציר הקצר הוא שאב-איט, שילוב של שניהם הוא ואריאל או טרה פליפ, בלי סיבוב של הלוח זה אולי. '
    + 'על מכשול קבע לפי אילו טראקים נוגעים ובאיזו זווית הלוח למכשול.\n'
    + `קרא לטריק בשם מתוך הרשימה הזאת, ואם שום שם לא מתאים כתוב "לא ברור": ${names()}\n`
    + 'תן ציון אחד בין 0.0 ל-10.0. ציון מתחת ל-3 שמור לטריק שלא נחת.\n'
    + 'קבע גם כמה מעלות הרוכב הסתובב סביב עצמו: 0, 180, 360 או 540. זה נקבע ממך ולא מהמדידות, '
    + 'כי רוחב הלוח מסתיר את הסיבוב בכל מדידה אוטומטית. אם אי אפשר לראות, החזר 0.\n'
    + 'ציין אם תפס את הלוח ביד ואיפה (אינדי בצד הבהונות, מלון בצד העקבים, נוזגראב בחרטום, טייגראב בזנב), '
    + 'ואיפה הרגליים נחתו על הלוח.\n'
    + 'בשדה frames כתוב באילו מספרי פריימים ראית את מה שהכריע. אם הפריימים מטושטשים מכדי לקבוע, '
    + 'כתוב זאת ב-note ותן ציון שמרני במקום לנחש.\n'
    + `שופט מספר ${seat}. שפוט לפי מה שאתה רואה, בלי להתחשב בשופטים אחרים.\n`
    + `החזר רק אובייקט JSON יחיד, בדיוק בצורה הזאת: ${SHAPE}`;

  const content = [
    ...(overview ? [image(overview)] : []),
    ...sheets.map(image),
    { type: 'text', text },
  ];

  const a = parseJson(await ask(content, { maxTokens: 500 }));
  return {
    trick: String(a.trick || 'לא ברור').slice(0, 60),
    landed: a.landed !== false,
    score: round1(clamp(a.score, 0, 10)),
    rotation: Math.min(540, Math.max(0, Math.round((Number(a.rotation) || 0) / 180) * 180)),
    grab: String(a.grab || '').slice(0, 60),
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
export async function judgeTrick(sheets, m, { overview = null, combo = '', claimed = '' } = {}) {
  const [a, b] = await Promise.all([
    oneJudge(sheets, m, { overview, combo, claimed, seat: 1 }),
    oneJudge(sheets, m, { overview, combo, claimed, seat: 2 }),
  ]);

  const judges = [a, b];
  let score = round1((a.score + b.score) / 2);
  let dropped = null;
  const out = new Set();          // אינדקסים של השופטים שהושמטו

  const split = Math.abs(a.score - b.score) > PANEL_SPLIT;
  const named = trickKey(a.trick) !== trickKey(b.trick);
  if (split || named) {
    const c = await oneJudge(sheets, m, { overview, combo, claimed, seat: 3 });
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
