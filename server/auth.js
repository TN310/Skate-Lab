/* ==========================================================================
   Auth — סיסמאות וסשנים
   הסיסמאות נשמרות כ-scrypt עם מלח אקראי לכל משתמש. לעולם לא בטקסט גלוי.
   ========================================================================== */

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { db, now, publicUser, getUserRow } from './db.js';

const scryptAsync = promisify(scrypt);

const KEYLEN = 64;
export const SESSION_COOKIE = 'skatelab_session';

/** מחזיר "מלח:גיבוב" לשמירה בטבלה. */
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scryptAsync(password, salt, KEYLEN);
  return `${salt}:${derived.toString('hex')}`;
}

/** השוואה בזמן קבוע, כדי לא לדלוף מידע דרך משך התגובה. */
export async function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hex] = stored.split(':');
  const expected = Buffer.from(hex, 'hex');
  const actual = await scryptAsync(password, salt, KEYLEN);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/* ---------- סשנים ---------- */

export async function createSession(userId) {
  const token = randomBytes(32).toString('hex');
  await db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)')
    .run(token, userId, now());
  return token;
}

export async function destroySession(token) {
  if (token) await db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

/** קורא את עוגיית הסשן ומצמיד את המשתמש ל-req. תמיד ממשיך הלאה. */
export async function attachUser(req, res, next) {
  req.user = null;
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) {
    const row = await db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token);
    if (row) req.user = await publicUser(await getUserRow(row.user_id));
  }
  next();
}

/** חוסם נתיבים שדורשים התחברות. */
export function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'צריך להתחבר' });
  next();
}

/** פענוח כותרת Cookie — מספיק לצורך עוגייה אחת, בלי תלות נוספת. */
export function cookies(req, res, next) {
  req.cookies = Object.fromEntries(
    (req.headers.cookie || '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const eq = part.indexOf('=');
        return [part.slice(0, eq), decodeURIComponent(part.slice(eq + 1))];
      }));
  next();
}

/*
 * בייצור העוגייה חייבת Secure — בלעדיה היא נשלחת גם ב-HTTP רגיל,
 * וכל מי שמאזין לרשת יכול לגנוב את הסשן. מקומית אין HTTPS, ולכן
 * הדגל נוסף רק כשמוגדר NODE_ENV=production.
 */
const secureFlag = () => process.env.NODE_ENV === 'production' ? '; Secure' : '';

export function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie',
    `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax${secureFlag()}` +
    `; Max-Age=${60 * 60 * 24 * 90}`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie',
    `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax${secureFlag()}; Max-Age=0`);
}
