/* ==========================================================================
   Admin — לוח בקרה למחיקת משתמשים וסרטונים
   נפרד לגמרי ממערכת המשתמשים: אין "תפקיד admin" בטבלת users, יש סיסמה
   אחת משותפת שמוגדרת ב-ADMIN_PASSWORD. מי שיודע אותה נכנס ללוח.

   הסשן נשמר בזיכרון ולא בטבלה, כמו בהגבלת הקצב ב-guard.js — זה כלי
   לבעל האתר בלבד, נפח נמוך, ואין בעיה שהוא מתאפס בהפעלה מחדש.
   ========================================================================== */

import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

export const ADMIN_COOKIE = 'skatelab_admin';
const TTL_MS = 12 * 60 * 60 * 1000;   // 12 שעות

const sessions = new Map();   // token -> תפוגה

setInterval(() => {
  const now = Date.now();
  for (const [token, expires] of sessions) if (now > expires) sessions.delete(token);
}, 60_000).unref?.();

/*
 * הסיסמה נקראת בכל קריאה ולא נשמרת בקבוע בזמן טעינת המודול — אותו דפוס
 * שגרם לבאג עם קוד ההזמנה: env.mjs טוען סינכרונית עכשיו, אז זה כבר לא
 * הכרחי, אבל השארנו לעקביות ולביטחון כפול.
 */
const password = () => process.env.ADMIN_PASSWORD || '';

export const adminEnabled = () => !!password();

/** השוואה בזמן קבוע דרך גיבוב, כדי שאורך הסיסמה לא ידלוף ממשך התגובה. */
export function checkPassword(input) {
  const expected = password();
  if (!expected) return false;
  const a = createHash('sha256').update(String(input || '')).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export function createAdminSession() {
  const token = randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + TTL_MS);
  return token;
}

export function destroyAdminSession(token) {
  if (token) sessions.delete(token);
}

function validAdminSession(token) {
  const expires = sessions.get(token);
  if (!expires) return false;
  if (Date.now() > expires) { sessions.delete(token); return false; }
  return true;
}

export const isAdmin = (req) => validAdminSession(req.cookies?.[ADMIN_COOKIE]);

/** חוסם נתיבים שדורשים כניסת מנהל. */
export function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'צריך להתחבר ללוח הבקרה' });
  next();
}

const secureFlag = () => process.env.NODE_ENV === 'production' ? '; Secure' : '';

export function setAdminCookie(res, token) {
  res.setHeader('Set-Cookie',
    `${ADMIN_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax${secureFlag()}` +
    `; Max-Age=${Math.floor(TTL_MS / 1000)}`);
}

export function clearAdminCookie(res) {
  res.setHeader('Set-Cookie',
    `${ADMIN_COOKIE}=; HttpOnly; Path=/; SameSite=Lax${secureFlag()}; Max-Age=0`);
}
