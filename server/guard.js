/* ==========================================================================
   Guard — הגנות שצריך כשהאפליקציה יוצאת לאינטרנט
   הכל נשמר בזיכרון בלבד: אחרי הפעלה מחדש המונים מתאפסים. זה מספיק
   לחסימת התקפות אוטומטיות, ולא דורש טבלה נוספת במסד.
   ========================================================================== */

const buckets = new Map();

/** מנקה מדי פעם רשומות ישנות, אחרת המפה תגדל בלי גבול. */
setInterval(() => {
  const now = Date.now();
  for (const [key, b] of buckets) if (now > b.until) buckets.delete(key);
}, 60_000).unref?.();

/**
 * מגביל כמה פעמים אפשר לבצע פעולה בחלון זמן.
 * `key` מזהה את המבצע (כתובת IP או מזהה משתמש), `max` הוא מספר
 * הפעולות המותר בתוך `windowMs`.
 */
export function tooMany(key, { max, windowMs }) {
  const now = Date.now();
  const b = buckets.get(key);

  if (!b || now > b.until) {
    buckets.set(key, { count: 1, until: now + windowMs });
    return false;
  }

  b.count += 1;
  return b.count > max;
}

/** כמה זמן נשאר עד שהחסימה משתחררת, בשניות. */
export const retryIn = (key) => {
  const b = buckets.get(key);
  return b ? Math.max(1, Math.ceil((b.until - Date.now()) / 1000)) : 0;
};

/** כתובת המבקש. מאחורי proxy (כמו ב-Render) הכתובת האמיתית בכותרת. */
export const ipOf = (req) =>
  (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
  req.socket.remoteAddress || 'unknown';

/**
 * מגביל קצב לפי כתובת IP.
 * שימו לב: זה חוסם רק הצפה אוטומטית. מי שמחליף כתובת יעקוף — לכן
 * זה נלווה לקוד ההזמנה ולא מחליף אותו.
 */
export const rateLimit = ({ max, windowMs, message, envKey }) => (req, res, next) => {
  // כשיש envKey אפשר לכוונן את התקרה בלי שינוי קוד ובלי פריסה מחדש
  const limit = envKey && Number(process.env[envKey]) > 0
    ? Number(process.env[envKey])
    : max;

  const key = `${req.method}:${req.path}:${ipOf(req)}`;
  if (tooMany(key, { max: limit, windowMs })) {
    res.setHeader('Retry-After', retryIn(key));
    return res.status(429).json({ error: `${message} נסו שוב בעוד ${retryIn(key)} שניות.` });
  }
  next();
};

/**
 * תקרת שימוש ב-AI, כדי שחשבון בודד לא יוכל לצבור עלות בלי גבול.
 * ברירת המחדל שמרנית ואפשר לשנות אותה במשתני סביבה.
 */
const aiPerHour = () => Number(process.env.AI_LIMIT_HOUR) || 20;
const aiPerDay = () => Number(process.env.AI_LIMIT_DAY) || 100;

export function aiQuotaExceeded(userId) {
  const perHour = aiPerHour();
  const perDay = aiPerDay();

  const hour = tooMany(`ai:h:${userId}`, { max: perHour, windowMs: 3_600_000 });
  const day = tooMany(`ai:d:${userId}`, { max: perDay, windowMs: 86_400_000 });

  if (hour) return `הגעתם למכסת ה-AI לשעה (${perHour} שאלות).`;
  if (day) return `הגעתם למכסת ה-AI ליום (${perDay} שאלות).`;
  return null;
}

/**
 * קוד הזמנה להרשמה. מוגדר ב-INVITE_CODE; אם לא הוגדר, ההרשמה פתוחה
 * (מצב פיתוח מקומי). ההשוואה מתעלמת מרישיות ומרווחים.
 *
 * המשתנה נקרא בכל קריאה ולא נשמר בקבוע בזמן טעינת המודול: ב-ESM שני
 * ייבואים אחים לא ממתינים זה לזה, אז env.mjs עדיין קורא את הקובץ
 * כשהמודול הזה נטען. קבוע היה נתפס ריק — וההרשמה הייתה נפתחת לכולם
 * בלי שאף אחד ישים לב.
 */
const invite = () => (process.env.INVITE_CODE || '').trim().toLowerCase();

export const inviteRequired = () => !!invite();

export const inviteOk = (code) => {
  const expected = invite();
  return !expected || String(code || '').trim().toLowerCase() === expected;
};
