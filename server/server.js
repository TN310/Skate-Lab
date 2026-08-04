/* ==========================================================================
   Skate Lab — שרת
   מגיש את קבצי הצד-לקוח ואת ה-API. מריצים עם: npm start
   ========================================================================== */

import './env.mjs';   // חייב לרוץ ראשון — טוען server/.env לפני שai.js קורא ממנו

import express from 'express';
import { createHash } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { db, now, newId, slugify, publicUser, privateUser, publicVideo,
         getUserRow, getUserBySlug, USER_SELECT } from './db.js';
import { put as putFile, remove as removeFiles, UPLOADS, usingCloud } from './storage.js';
import { hashPassword, verifyPassword, createSession, destroySession,
         attachUser, requireUser, cookies, setSessionCookie, clearSessionCookie } from './auth.js';
import { seedIfEmpty, greetNewUser, DEMO_GREETINGS } from './seed.js';
import { aiAvailable, askCoach, draftFeedback, guessFromThumb, checkAttempt, chatReply } from './ai.js';
import { achievementsFor } from './achievements.js';
import { rateLimit, aiQuotaExceeded, inviteRequired, inviteOk } from './guard.js';
import { adminEnabled, checkPassword, createAdminSession, destroyAdminSession,
         isAdmin, requireAdmin, setAdminCookie, clearAdminCookie } from './admin.js';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.env.PORT) || 3000;

/*
 * תוכן הדמו כבוי כברירת מחדל — האפליקציה מתחילה ריקה, בלי מאמנים
 * ובלי שיעורים שלא נוצרו על ידי משתמשים אמיתיים. להחזרה: SEED_DEMO=1
 */
if (process.env.SEED_DEMO === '1' && await seedIfEmpty()) {
  console.log('נזרעו מאמני ושיעורי הדמו');
}

const app = express();
app.set('trust proxy', 1);   // ב-Render יש proxy לפני השרת

/*
 * הנתיבים שמקבלים פריימים מהסרטון שולחים תמונות base64, והם חורגים
 * מהמגבלה הרגילה. הם חייבים להירשם *לפני* המפרסר הגלובלי: המפרסר
 * הראשון שרץ הוא זה שקורא את הגוף, ואם הגלובלי מגיע קודם הוא דוחה
 * את הבקשה ב-413 והמגבלה הגדולה יותר לעולם לא נבדקת.
 */
app.use('/api/bag', express.json({ limit: '12mb' }));
app.use('/api/ai/feedback', express.json({ limit: '12mb' }));

app.use(express.json({ limit: '1mb' }));
app.use(cookies);
app.use(attachUser);

/** עוטף handler אסינכרוני כדי שחריגה תגיע ל-error handler ולא תפיל את התהליך. */
const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const bad = (res, message, code = 400) => res.status(code).json({ error: message });

/**
 * האווטארים והפוסטרים מוצגים בממשק בלי escape (הם אמורים להיות אימוג׳י).
 * לכן הם נבדקים כאן מול רשימה סגורה — אחרת אפשר היה לשמור HTML
 * ולהריץ סקריפט אצל כל מי שרואה את הפרופיל או את התגובה.
 */
const ALLOWED_EMOJI = new Set(
  ['🛹', '🤙', '🔥', '⚡️', '🦈', '🐺', '🐉', '👽', '🤖', '🌊', '💀', '🌈']);

const safeEmoji = (value) => ALLOWED_EMOJI.has(value) ? value : '🛹';

/*
 * התפקידים המותרים. רשימה אחת שמשמשת גם להרשמה וגם לסינון, כדי
 * שהוספת תפקיד לא תדרוש לזכור לעדכן שני מקומות.
 * רק 'coach' מקבל הרשאות נוספות (אימות טריקים, טיוטת פידבק) — כל
 * השאר, כולל 'other', מתנהגים כרוכב רגיל.
 */
const ROLE_IDS = ['coach', 'student', 'fan', 'other'];

/**
 * מנקה ובודק כתובת מייל.
 * מחזיר null כשלא נמסרה כתובת (זה תקין — השדה אופציונלי),
 * false כשהיא לא תקינה, או את הכתובת המנורמלת.
 * הבדיקה מכוונת לתפוס שגיאות הקלדה, לא לאמת שהתיבה באמת קיימת.
 */
function cleanEmail(value) {
  const mail = String(value ?? '').trim().toLowerCase();
  if (!mail) return null;
  if (mail.length > 254) return false;
  return /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(mail) ? mail : false;
}

/** האם המייל כבר תפוס. `exceptId` מאפשר למשתמש לשמור את הכתובת של עצמו. */
async function emailTaken(mail, exceptId = null) {
  const row = await db.prepare(
    'SELECT id FROM users WHERE LOWER(email) = ? AND id <> ?').get(mail, exceptId || '');
  return !!row;
}

/* ==========================================================================
   התחברות והרשמה
   ========================================================================== */

/** האם ההרשמה דורשת קוד — כדי שהמסך ידע אם להציג את השדה. */
/** Render בודק את הכתובת הזאת כדי לדעת שהשרת חי. */
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/auth/invite-required', (req, res) => res.json({ required: inviteRequired() }));

/*
 * 20 ולא 5: קבוצה שנרשמת מאותו wifi (פארק, בית ספר, נקודה חמה) נראית
 * לשרת ככתובת אחת, ותקרה נמוכה הייתה נועלת את כולם אחרי כמה הרשמות.
 * ההגנה האמיתית מפני הרשמות לא רצויות היא קוד ההזמנה; זה רק בלם הצפה.
 * לכוונון בלי פריסה מחדש: REGISTER_LIMIT_HOUR.
 */
app.post('/api/auth/register',
  rateLimit({ max: 20, windowMs: 3_600_000, envKey: 'REGISTER_LIMIT_HOUR',
              message: 'יותר מדי הרשמות מהכתובת הזאת.' }),
  route(async (req, res) => {
  const { name, password, email, avatar, gender, stance, dob, role, level, region, city, years,
          styles, invite } = req.body || {};

  // קוד ההזמנה נבדק ראשון: בלעדיו אין טעם להמשיך
  if (!inviteOk(invite)) return bad(res, 'קוד ההזמנה לא נכון', 403);

  if (!name || name.trim().length < 2) return bad(res, 'צריך שם של שני תווים לפחות');

  /*
   * רווחים בקצוות נחתכים בשני המסלולים — הרשמה והתחברות. העתקה־הדבקה
   * גוררת לא פעם רווח נסתר, ובלי הקיצוץ המשתמש נרשם עם סיסמה שהוא לא
   * יוכל להקליד שוב.
   */
  const pass = String(password ?? '').trim();
  if (pass.length < 4) return bad(res, 'הסיסמה צריכה להיות באורך 4 תווים לפחות');
  if (!ROLE_IDS.includes(role)) return bad(res, 'תפקיד לא תקין');

  // המייל אופציונלי — מי שלא רוצה למסור, לא חייב
  const mail = cleanEmail(email);
  if (mail === false) return bad(res, 'כתובת המייל לא נראית תקינה');
  if (mail && await emailTaken(mail)) return bad(res, 'כתובת המייל הזאת כבר רשומה', 409);

  // תאריך הלידה נשמר כמחרוזת ISO. כל דבר אחר נדחה כאן, אחרת SQLite זורק
  // שגיאה והתשובה היא 500 מבלבל במקום הודעה ברורה.
  const birth = typeof dob === 'string' && dob.trim() ? dob.trim() : null;
  if (dob != null && !birth) return bad(res, 'תאריך לידה לא תקין');

  const slug = slugify(name);
  if (await getUserBySlug(slug)) return bad(res, 'השם הזה כבר תפוס', 409);

  const id = newId('u');
  await db.prepare(`
    INSERT INTO users (id, slug, name, email, password_hash, avatar, gender, stance, dob, role,
                       level, region, city, years, bio, styles, base_followers, is_demo, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 0, 0, ?)`)
    .run(id, slug, name.trim(), mail, await hashPassword(pass), safeEmoji(avatar),
         gender || 'na', stance || 'unknown', birth, role, level || null, region || null,
         (city || '').trim() || null, years || null, JSON.stringify(styles || []), now());

  await greetNewUser(id);
  setSessionCookie(res, await createSession(id));
  res.json(await privateUser(await getUserRow(id)));
}));

app.post('/api/auth/login',
  rateLimit({ max: 30, windowMs: 900_000, envKey: 'LOGIN_LIMIT_QUARTER',
              message: 'יותר מדי נסיונות התחברות.' }),
  route(async (req, res) => {
  const { name, password } = req.body || {};
  const row = await getUserBySlug(slugify(name || ''));

  // אותה הודעה לשם לא קיים ולסיסמה שגויה, כדי לא לחשוף מי רשום
  if (!row || !row.password_hash ||
      !await verifyPassword(String(password ?? '').trim(), row.password_hash)) {
    return bad(res, 'שם או סיסמה לא נכונים', 401);
  }

  setSessionCookie(res, await createSession(row.id));
  res.json(await privateUser(row));
}));

app.post('/api/auth/logout', route(async (req, res) => {
  await destroySession(req.cookies?.skatelab_session);
  clearSessionCookie(res);
  res.json({ ok: true });
}));

app.get('/api/auth/me', (req, res) => res.json(req.user));

/**
 * עריכת הפרופיל.
 * רק שדות שנשלחו מתעדכנים, כדי שמסך שמעדכן חלק מהשדות לא ימחק את השאר.
 *
 * מה שאי אפשר לשנות כאן בכוונה: התפקיד (משנה את כל ההרשאות),
 * תאריך הלידה (הגיל מוצג לכולם) והסיסמה — כל אלה דורשים מסלול נפרד.
 */
app.patch('/api/me', requireUser, route(async (req, res) => {
  const body = req.body || {};
  const sets = [];
  const values = [];

  const put = (column, value) => { sets.push(`${column} = ?`); values.push(value); };

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (name.length < 2) return bad(res, 'צריך שם של שני תווים לפחות');

    // השם הוא גם המזהה להתחברות, אז שינוי שלו חייב להישאר ייחודי
    const slug = slugify(name);
    const clash = await getUserBySlug(slug);
    if (clash && clash.id !== req.user.id) return bad(res, 'השם הזה כבר תפוס', 409);

    put('name', name);
    put('slug', slug);
  }

  if (body.email !== undefined) {
    const mail = cleanEmail(body.email);
    if (mail === false) return bad(res, 'כתובת המייל לא נראית תקינה');
    if (mail && await emailTaken(mail, req.user.id)) {
      return bad(res, 'כתובת המייל הזאת כבר רשומה', 409);
    }
    put('email', mail);
  }

  if (body.avatar !== undefined) put('avatar', safeEmoji(body.avatar));
  if (body.region !== undefined) put('region', body.region || null);
  if (body.city !== undefined) put('city', String(body.city).trim() || null);
  if (body.bio !== undefined) put('bio', String(body.bio).trim().slice(0, 300) || null);
  if (body.level !== undefined) put('level', body.level || null);

  if (body.gender !== undefined) {
    if (!['male', 'female', 'na'].includes(body.gender)) return bad(res, 'מגדר לא תקין');
    put('gender', body.gender);
  }

  if (body.stance !== undefined) {
    if (!['regular', 'goofy', 'unknown'].includes(body.stance)) return bad(res, 'סטאנס לא תקין');
    put('stance', body.stance);
  }

  if (body.years !== undefined) {
    const years = Number(body.years);
    if (body.years !== null && body.years !== '' && (!Number.isFinite(years) || years < 0 || years > 80)) {
      return bad(res, 'מספר שנות הרכיבה לא תקין');
    }
    put('years', body.years === null || body.years === '' ? null : Math.floor(years));
  }

  if (body.styles !== undefined) {
    if (!Array.isArray(body.styles)) return bad(res, 'סגנונות לא תקינים');
    put('styles', JSON.stringify(body.styles));
  }

  if (!sets.length) return bad(res, 'לא נשלח שום שדה לעדכון');

  values.push(req.user.id);
  await db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...values);

  res.json(await privateUser(await getUserRow(req.user.id)));
}));

/**
 * מחיקת חשבון. דורשת הזנת הסיסמה מחדש, כי הפעולה בלתי הפיכה.
 * מחיקת השורה מוחקת בשרשור גם סרטונים, תגובות, לייקים, בקשות והודעות.
 */
app.post('/api/auth/delete', requireUser, route(async (req, res) => {
  const row = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!await verifyPassword(req.body?.password || '', row.password_hash)) {
    return bad(res, 'הסיסמה לא נכונה', 403);
  }

  const mine = await db.prepare('SELECT id FROM videos WHERE author_id = ?').all(req.user.id);
  await db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);

  for (const v of mine) await removeFiles(v.id);

  clearSessionCookie(res);
  res.json({ ok: true });
}));

/* ==========================================================================
   משתמשים, מאמנים ומועדפים
   ========================================================================== */

/** רשימת המאמנים שאני עוקב אחריהם. */
const followingOf = async (userId) => !userId ? [] :
  (await db.prepare('SELECT coach_id FROM follows WHERE follower_id = ?').all(userId))
    .map((r) => r.coach_id);

app.get('/api/users/:id', route(async (req, res) => {
  const user = await publicUser(await getUserRow(req.params.id));
  if (!user) return bad(res, 'המשתמש לא נמצא', 404);
  res.json(user);
}));

/**
 * חיפוש אנשים. `role` מגביל לתפקיד מסוים (למשל רק מאמנים), ובלעדיו
 * מוחזרים כל המשתמשים — כדי שרוכבים יוכלו למצוא זה את זה, לא רק מאמנים.
 */
async function searchPeople(req, { role } = {}) {
  const { region, style, query, onlyFollowed } = req.query;
  const followed = await followingOf(req.user?.id);

  let rows = await Promise.all((await db.prepare(USER_SELECT).all()).map(publicUser));

  if (role) rows = rows.filter((u) => u.role === role);
  if (region) rows = rows.filter((u) => u.region === region);
  if (style) rows = rows.filter((u) => u.styles.includes(style));
  if (onlyFollowed === 'true') rows = rows.filter((u) => followed.includes(u.id));

  // את עצמי אני לא צריך למצוא ברשימת אנשים
  if (req.user) rows = rows.filter((u) => u.id !== req.user.id);

  const q = (query || '').trim().toLowerCase();
  if (q) {
    rows = rows.filter((u) =>
      u.name.toLowerCase().includes(q) ||
      (u.city || '').toLowerCase().includes(q) ||
      (u.bio || '').toLowerCase().includes(q) ||
      u.styles.some((s) => s.toLowerCase().includes(q)));
  }

  return rows.sort((a, b) => b.stats.followers - a.stats.followers);
}

app.get('/api/coaches', route(async (req, res) => {
  res.json(await searchPeople(req, { role: 'coach' }));
}));

app.get('/api/people', route(async (req, res) => {
  const role = ROLE_IDS.includes(req.query.role) ? req.query.role : null;
  res.json(await searchPeople(req, { role }));
}));

app.get('/api/me/following', requireUser,
  route(async (req, res) => res.json(await followingOf(req.user.id))));

app.post('/api/users/:id/follow', requireUser, route(async (req, res) => {
  const coachId = req.params.id;
  if (coachId === req.user.id) return bad(res, 'אי אפשר לעקוב אחרי עצמכם');
  if (!await getUserRow(coachId)) return bad(res, 'המשתמש לא נמצא', 404);

  const has = await db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND coach_id = ?')
    .get(req.user.id, coachId);

  if (has) {
    await db.prepare('DELETE FROM follows WHERE follower_id = ? AND coach_id = ?').run(req.user.id, coachId);
  } else {
    await db.prepare('INSERT INTO follows (follower_id, coach_id) VALUES (?, ?)').run(req.user.id, coachId);
  }

  res.json({ following: !has, coach: await publicUser(await getUserRow(coachId)) });
}));

/* ==========================================================================
   סרטונים
   ========================================================================== */

app.get('/api/videos', route(async (req, res) => {
  const { region, style, level, kind, query, authorId, onlyFollowed } = req.query;

  const videoRows = await db.prepare('SELECT * FROM videos ORDER BY created_at DESC').all();
  let rows = await Promise.all(videoRows.map((r) => publicVideo(r, req.user?.id)));

  if (region) rows = rows.filter((v) => v.region === region);
  if (style) rows = rows.filter((v) => v.styles.includes(style));
  if (level) rows = rows.filter((v) => v.level === level);
  if (kind) rows = rows.filter((v) => v.kind === kind);
  if (authorId) rows = rows.filter((v) => v.authorId === authorId);

  if (onlyFollowed === 'true') {
    const followed = await followingOf(req.user?.id);
    rows = rows.filter((v) => followed.includes(v.authorId));
  }

  const q = (query || '').trim().toLowerCase();
  if (q) {
    rows = rows.filter((v) =>
      v.title.toLowerCase().includes(q) ||
      (v.desc || '').toLowerCase().includes(q) ||
      v.author.name.toLowerCase().includes(q) ||
      v.styles.some((s) => s.toLowerCase().includes(q)));
  }

  res.json(rows);
}));

app.get('/api/videos/:id', route(async (req, res) => {
  const row = await db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
  if (!row) return bad(res, 'הסרטון לא נמצא', 404);
  res.json(await publicVideo(row, req.user?.id));
}));

app.post('/api/videos', requireUser, route(async (req, res) => {
  const { title, desc, level, region, styles, poster, kind } = req.body || {};

  if (!title || title.trim().length < 3) return bad(res, 'צריך כותרת של לפחות 3 תווים');
  if (!region) return bad(res, 'בחרו אזור');
  if (!level) return bad(res, 'בחרו רמה');
  if (!Array.isArray(styles) || !styles.length) return bad(res, 'בחרו לפחות סגנון אחד');
  // כל תפקיד יכול להעלות גם שיעור וגם טריק לפידבק — הבחירה נעשית בטופס,
  // לא נגזרת מהתפקיד. בלי ולידציה כאן, ערך שרירותי היה נשמר כ-kind.
  if (!['lesson', 'clip'].includes(kind)) return bad(res, 'בחרו סוג סרטון');

  const id = newId('v');
  await db.prepare(`
    INSERT INTO videos (id, author_id, kind, title, descr, level, region, styles,
                        poster, trick_id, has_file, has_thumb, is_demo, views, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?)`)
    .run(id, req.user.id, kind,
         title.trim(), (desc || '').trim(), level, region,
         JSON.stringify(styles), safeEmoji(poster), null, now());

  res.json(await publicVideo(await db.prepare('SELECT * FROM videos WHERE id = ?').get(id), req.user.id));
}));

/**
 * העלאת קובץ — הגוף הוא הבינארי הגולמי, בלי multipart.
 * הצד-לקוח שולח את ה-File ישירות כ-body, אז אין צורך במפרסר נוסף.
 */
function uploadHandler(kindOfFile) {
  return [requireUser, express.raw({ type: '*/*', limit: process.env.MAX_UPLOAD || '60mb' }), route(async (req, res) => {
    const row = await db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
    if (!row) return bad(res, 'הסרטון לא נמצא', 404);
    if (row.author_id !== req.user.id) return bad(res, 'זה לא הסרטון שלכם', 403);
    if (!req.body?.length) return bad(res, 'לא התקבל קובץ');

    const url = await putFile(kindOfFile, row.id, req.body);

    // הכתובת נשמרת במסד: ב-Cloudinary היא כתובת CDN מלאה, ומקומית /media
    const flag = kindOfFile === 'thumb' ? 'has_thumb' : 'has_file';
    const urlColumn = kindOfFile === 'thumb' ? 'thumb_url' : 'video_url';
    await db.prepare(`UPDATE videos SET ${flag} = 1, ${urlColumn} = ? WHERE id = ?`)
      .run(url, row.id);

    // טביעת אצבע של קובץ הווידאו — כך מזהים העלאה חוזרת של אותו קליפ
    // על ידי מישהו אחר, וזה בדיוק מה ש-AI לא יכול לתפוס.
    let duplicate = null;
    if (kindOfFile === 'video') {
      const hash = createHash('sha256').update(req.body).digest('hex');
      await db.prepare('UPDATE videos SET file_hash = ? WHERE id = ?').run(hash, row.id);

      const other = await db.prepare(`
        SELECT v.id, u.name FROM videos v JOIN users u ON u.id = v.author_id
         WHERE v.file_hash = ? AND v.id <> ? AND v.author_id <> ?
         ORDER BY v.created_at LIMIT 1`).get(hash, row.id, req.user.id);

      if (other) duplicate = other.name;
    }

    res.json({ ok: true, bytes: req.body.length, duplicate });
  })];
}

app.post('/api/videos/:id/file', ...uploadHandler('video'));
app.post('/api/videos/:id/thumb', ...uploadHandler('thumb'));

app.delete('/api/videos/:id', requireUser, route(async (req, res) => {
  const row = await db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
  if (!row) return bad(res, 'הסרטון לא נמצא', 404);
  if (row.author_id !== req.user.id) return bad(res, 'זה לא הסרטון שלכם', 403);

  await db.prepare('DELETE FROM videos WHERE id = ?').run(row.id);
  await removeFiles(row.id);
  res.json({ ok: true });
}));

app.post('/api/videos/:id/like', requireUser, route(async (req, res) => {
  const row = await db.prepare('SELECT id FROM videos WHERE id = ?').get(req.params.id);
  if (!row) return bad(res, 'הסרטון לא נמצא', 404);

  const has = await db.prepare('SELECT 1 FROM likes WHERE video_id = ? AND user_id = ?')
    .get(row.id, req.user.id);

  if (has) await db.prepare('DELETE FROM likes WHERE video_id = ? AND user_id = ?').run(row.id, req.user.id);
  else await db.prepare('INSERT INTO likes (video_id, user_id) VALUES (?, ?)').run(row.id, req.user.id);

  const { n } = await db.prepare('SELECT COUNT(*) AS n FROM likes WHERE video_id = ?').get(row.id);
  res.json({ likes: n, liked: !has });
}));

app.post('/api/videos/:id/view', route(async (req, res) => {
  const row = await db.prepare('SELECT author_id, views FROM videos WHERE id = ?').get(req.params.id);
  if (!row) return bad(res, 'הסרטון לא נמצא', 404);

  // צפייה של הבעלים על עצמו לא נספרת — אחרת הסטטיסטיקה לא אומרת כלום
  if (req.user?.id === row.author_id) return res.json({ views: row.views });

  await db.prepare('UPDATE videos SET views = views + 1 WHERE id = ?').run(req.params.id);
  res.json({ views: row.views + 1 });
}));

app.post('/api/videos/:id/comments', requireUser, route(async (req, res) => {
  const text = (req.body?.text || '').trim();
  if (!text) return bad(res, 'צריך לכתוב משהו לפני ששולחים');

  const row = await db.prepare('SELECT id FROM videos WHERE id = ?').get(req.params.id);
  if (!row) return bad(res, 'הסרטון לא נמצא', 404);

  // תשובה חייבת להתייחס לתגובה שקיימת על אותו סרטון, ורק בעומק אחד
  let parentId = req.body?.parentId || null;
  if (parentId) {
    const parent = await db.prepare('SELECT id, parent_id, video_id FROM comments WHERE id = ?').get(parentId);
    if (!parent || parent.video_id !== row.id) return bad(res, 'התגובה שעליה עניתם לא נמצאה', 404);
    parentId = parent.parent_id || parent.id;
  }

  const id = newId('c');
  const at = now();
  await db.prepare(`INSERT INTO comments (id, video_id, author_id, parent_id, body, created_at)
              VALUES (?, ?, ?, ?, ?, ?)`)
    .run(id, row.id, req.user.id, parentId, text.slice(0, 300), at);

  res.json({
    id,
    parentId,
    authorId: req.user.id,
    authorName: req.user.name,
    authorAvatar: req.user.avatar,
    authorRole: req.user.role,
    text: text.slice(0, 300),
    createdAt: at,
    replies: [],
  });
}));

/* ==========================================================================
   תגובות שהגיעו אליי — התיבה של בעל הסרטון
   ========================================================================== */

/**
 * כל התגובות שאנשים אחרים כתבו על הסרטונים שלי, עם סימון אם כבר עניתי.
 * זה מה שהופך שאלה של תלמיד למשהו שמאמן באמת רואה.
 */
const inboxRows = async (userId) => await db.prepare(`
  SELECT c.id, c.author_id, c.body, c.created_at,
         u.name AS author_name, u.avatar AS author_avatar, u.role AS author_role,
         v.id AS video_id, v.title AS video_title, v.kind AS video_kind,
         v.poster AS video_poster, v.has_thumb AS video_has_thumb,
         v.thumb_url AS video_thumb_url,
         (SELECT COUNT(*) FROM comments r
           WHERE r.parent_id = c.id AND r.author_id = ?)::int AS my_replies,
         -- מי כתב אחרון בשרשור: אם זה לא אני, מחכה לי תשובה
         (SELECT r2.author_id FROM comments r2
           WHERE r2.parent_id = c.id
           ORDER BY r2.created_at DESC LIMIT 1)         AS last_reply_by
    FROM comments c
    JOIN videos v ON v.id = c.video_id
    JOIN users  u ON u.id = c.author_id
   WHERE v.author_id = ? AND c.author_id <> ? AND c.parent_id IS NULL
   ORDER BY c.created_at DESC`).all(userId, userId, userId);

/** נענה רק אם עניתי *ואף אחד לא כתב אחריי* — אחרת יש שאלת המשך פתוחה. */
const isAnswered = (r, meId) =>
  r.my_replies > 0 && (!r.last_reply_by || r.last_reply_by === meId);

app.get('/api/inbox', requireUser, route(async (req, res) => {
  const rows = await inboxRows(req.user.id);
  res.json(rows.map((r) => ({
    id: r.id,
    text: r.body,
    createdAt: r.created_at,
    answered: isAnswered(r, req.user.id),
    author: {
      id: r.author_id, name: r.author_name,
      avatar: r.author_avatar, role: r.author_role,
    },
    video: {
      id: r.video_id, title: r.video_title, kind: r.video_kind,
      poster: r.video_poster, hasThumb: !!r.video_has_thumb,
      thumbUrl: r.video_thumb_url || null,
    },
  })));
}));

app.get('/api/inbox/count', requireUser, route(async (req, res) => {
  const rows = await inboxRows(req.user.id);
  const waiting = rows.filter((r) => !isAnswered(r, req.user.id));
  res.json({ waiting: waiting.length });
}));

/* ==========================================================================
   AI — עוזר האימון
   ========================================================================== */

app.get('/api/ai/status', (req, res) => res.json({ available: aiAvailable() }));

/*
 * סינכרוני בכוונה — אין כאן שום המתנה. כשזה היה async, שגיאה סינכרונית
 * בתוכו הייתה הופכת לדחייה לא מטופלת שמפילה את התהליך במקום להחזיר 500.
 */
const needsAi = (req, res, next) => {
  if (!aiAvailable()) {
    return bad(res, 'ה-AI לא מוגדר בשרת. צריך להגדיר ANTHROPIC_API_KEY.', 503);
  }
  // תקרה לכל משתמש, כדי שחשבון בודד לא יוכל לצבור עלות בלי גבול
  const over = aiQuotaExceeded(req.user.id);
  if (over) return bad(res, `${over} נסו שוב מאוחר יותר.`, 429);
  next();
};

/** שאלת טכניקה חופשית, עם הטריק שנצפה כרגע כהקשר. */
app.post('/api/ai/ask', requireUser, needsAi, route(async (req, res) => {
  const question = (req.body?.question || '').trim();
  if (question.length < 3) return bad(res, 'כתבו שאלה');
  res.json({ answer: await askCoach(question.slice(0, 500)) });
}));

/**
 * לשונית "צ׳אט עם ה-AI" — שיחה מתמשכת שנשמרת לכל משתמש.
 * GET לא דורש שה-AI יהיה מוגדר, כדי שההיסטוריה עדיין תוצג אם המפתח נופל.
 */
app.get('/api/ai/chat', requireUser, route(async (req, res) => {
  const rows = await db.prepare(`SELECT id, role, body, created_at FROM ai_messages
                             WHERE user_id = ? ORDER BY created_at`).all(req.user.id);
  res.json({
    available: aiAvailable(),
    messages: rows.map((r) => ({ id: r.id, role: r.role, text: r.body, createdAt: r.created_at })),
  });
}));

app.post('/api/ai/chat', requireUser, needsAi, route(async (req, res) => {
  const text = (req.body?.text || '').trim();
  if (!text) return bad(res, 'כתבו הודעה לפני ששולחים');

  const history = await db.prepare(`SELECT role, body FROM ai_messages
                                WHERE user_id = ? ORDER BY created_at`).all(req.user.id);

  const insert = await db.prepare(`INSERT INTO ai_messages (id, user_id, role, body, created_at)
                              VALUES (?, ?, ?, ?, ?)`);
  insert.run(newId('am'), req.user.id, 'user', text.slice(0, 1000), now());

  let reply;
  try {
    reply = await chatReply(history, text.slice(0, 1000));
  } catch (err) {
    return bad(res, err.message, 502);
  }

  const replyId = newId('am');
  const replyAt = now();
  insert.run(replyId, req.user.id, 'assistant', reply, replyAt);

  res.json({ id: replyId, role: 'assistant', text: reply, createdAt: replyAt });
}));

app.delete('/api/ai/chat', requireUser, route(async (req, res) => {
  await db.prepare('DELETE FROM ai_messages WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
}));

/** טיוטת פידבק למאמן. הוא עורך ושולח בעצמו — ה-AI לא מפרסם כלום. */
app.post('/api/ai/feedback/:videoId', requireUser, needsAi, route(async (req, res) => {
  const video = await db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.videoId);
  if (!video) return bad(res, 'הסרטון לא נמצא', 404);

  const rider = await publicUser(await getUserRow(video.author_id));

  // הפריימים מגיעים מהדפדפן, שכבר יודע לפענח וידאו. מגבילים כאן את
  // הכמות ואת הגודל כדי ששדה אחד לא יתפח לבקשה ענקית.
  const frames = (Array.isArray(req.body?.frames) ? req.body.frames : [])
    .filter((f) => typeof f === 'string' && f.length < 400_000)
    .slice(0, 8);

  const [draft, look] = await Promise.all([
    draftFeedback({
      riderName: rider?.name || 'הרוכב',
      riderLevel: rider?.level,
      trickId: video.trick_id,
      note: (req.body?.note || '').trim(),
      frames,
    }),
    // כשיש פריימים אין טעם בניחוש מתמונה בודדת — הוא כבר ראה יותר
    frames.length ? null : guessFromThumb(video.id, video.trick_id, video.thumb_url).catch(() => null),
  ]);

  res.json({ draft, look, sawVideo: frames.length > 0 });
}));

/* ==========================================================================
   התיק — הטריקים שהרוכב נחת
   ========================================================================== */

/** שורת תיק בצורה שהמסכים מצפים לה. */
const bagShape = (r) => ({
  id: r.id,
  name: r.name,
  createdAt: r.created_at,
  video: { id: r.video_id, title: r.video_title, poster: r.video_poster,
           hasThumb: !!r.video_has_thumb, hasFile: !!r.video_has_file,
           thumbUrl: r.video_thumb_url || null, videoUrl: r.video_video_url || null },
  ai: r.ai_verdict ? { verdict: r.ai_verdict, reason: r.ai_reason } : null,
  verifiedBy: r.verifier_name || null,
  // סרטון שמישהו אחר העלה *לפני* — סימן מובהק לקליפ שאינו שלכם
  stolenFrom: r.stolen_from || null,
  /*
   * דירוג אמון: אישור אנושי של מאמן הוא הגבוה ביותר וגובר גם על סימון
   * הכפילות — הוא בן אדם שבדק. הסימון עצמו נשאר גלוי בכרטיס בכל מקרה.
   */
  trust: r.verified_by ? 'coach'
    : r.stolen_from ? 'stolen'
    : r.ai_verdict === 'landed' ? 'ai'
    : r.ai_verdict ? 'ai-doubt' : 'none',
});

const BAG_SELECT = `
  SELECT b.*, v.title AS video_title, v.poster AS video_poster,
         v.has_thumb AS video_has_thumb, v.has_file AS video_has_file,
         v.thumb_url AS video_thumb_url, v.video_url AS video_video_url,
         u.name AS verifier_name,
         (SELECT u2.name FROM videos v2 JOIN users u2 ON u2.id = v2.author_id
           WHERE v2.file_hash IS NOT NULL AND v2.file_hash = v.file_hash
             AND v2.author_id <> b.user_id
             AND v2.created_at < v.created_at
           ORDER BY v2.created_at LIMIT 1)          AS stolen_from
    FROM bag b
    JOIN videos v ON v.id = b.video_id
    LEFT JOIN users u ON u.id = b.verified_by`;

app.get('/api/bag/:userId', route(async (req, res) => {
  if (!await getUserRow(req.params.userId)) return bad(res, 'המשתמש לא נמצא', 404);
  const rows = await db.prepare(`${BAG_SELECT} WHERE b.user_id = ? ORDER BY b.created_at DESC`)
    .all(req.params.userId);
  res.json(rows.map(bagShape));
}));

/**
 * הוספת טריק לתיק. סרטון הוא חובה — הוא ההוכחה.
 * `frames` הם תמונות base64 שהדפדפן חילץ מהסרטון, לבדיקת ה-AI.
 */
app.post('/api/bag', requireUser, route(async (req, res) => {
  const name = (req.body?.name || '').trim();
  const videoId = req.body?.videoId;

  if (name.length < 2) return bad(res, 'כתבו את שם הטריק');
  if (!videoId) return bad(res, 'צריך לצרף סרטון — הוא ההוכחה');

  const video = await db.prepare('SELECT * FROM videos WHERE id = ?').get(videoId);
  if (!video) return bad(res, 'הסרטון לא נמצא', 404);
  if (video.author_id !== req.user.id) return bad(res, 'אפשר לצרף רק סרטון שלכם', 403);
  if (!video.has_file) return bad(res, 'לסרטון הזה אין קובץ וידאו, אז אי אפשר לאמת אותו');

  const already = await db.prepare('SELECT id FROM bag WHERE user_id = ? AND video_id = ?')
    .get(req.user.id, videoId);
  if (already) return bad(res, 'הסרטון הזה כבר בתיק');

  // הבדיקה רצה עכשיו כדי שהתשובה תחזור עם התוצאה. אם אין מפתח או שהיא
  // נכשלת, הטריק נכנס בכל זאת ומסומן כלא-נבדק.
  let ai = null;
  if (aiAvailable()) {
    try {
      ai = await checkAttempt(req.body?.frames || [], name);
    } catch (err) {
      console.warn('בדיקת הסרטון נכשלה:', err.message);
    }
  }

  const id = newId('b');
  await db.prepare(`INSERT INTO bag (id, user_id, name, video_id, ai_verdict, ai_reason, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(id, req.user.id, name.slice(0, 60), videoId, ai?.verdict || null, ai?.reason || null, now());

  res.json(bagShape(await db.prepare(`${BAG_SELECT} WHERE b.id = ?`).get(id)));
}));

app.delete('/api/bag/:id', requireUser, route(async (req, res) => {
  const row = await db.prepare('SELECT * FROM bag WHERE id = ?').get(req.params.id);
  if (!row) return bad(res, 'לא נמצא', 404);
  if (row.user_id !== req.user.id) return bad(res, 'זה לא התיק שלכם', 403);
  await db.prepare('DELETE FROM bag WHERE id = ?').run(row.id);
  res.json({ ok: true });
}));

/** אימות אנושי של מאמן — גובר על ה-AI לשני הכיוונים. */
app.post('/api/bag/:id/verify', requireUser, route(async (req, res) => {
  if (req.user.role !== 'coach') return bad(res, 'רק מאמן יכול לאמת', 403);

  const row = await db.prepare('SELECT * FROM bag WHERE id = ?').get(req.params.id);
  if (!row) return bad(res, 'לא נמצא', 404);
  if (row.user_id === req.user.id) return bad(res, 'אי אפשר לאמת לעצמכם');

  const on = req.body?.verified !== false;
  await db.prepare('UPDATE bag SET verified_by = ? WHERE id = ?').run(on ? req.user.id : null, row.id);
  res.json(bagShape(await db.prepare(`${BAG_SELECT} WHERE b.id = ?`).get(row.id)));
}));

/* ==========================================================================
   הישגים
   ========================================================================== */

app.get('/api/achievements/:id', route(async (req, res) => {
  if (!await getUserRow(req.params.id)) return bad(res, 'המשתמש לא נמצא', 404);
  res.json(await achievementsFor(req.params.id));
}));

/* ==========================================================================
   בקשות חברות
   ========================================================================== */

async function chatBetween(a, b) {
  return await db.prepare(`SELECT * FROM chats
    WHERE (a_id = ? AND b_id = ?) OR (a_id = ? AND b_id = ?)`).get(a, b, b, a);
}

async function openChat(a, b) {
  const existing = await chatBetween(a, b);
  if (existing) return existing;
  const id = newId('chat');
  await db.prepare('INSERT INTO chats (id, a_id, b_id, created_at) VALUES (?, ?, ?, ?)').run(id, a, b, now());
  return await db.prepare('SELECT * FROM chats WHERE id = ?').get(id);
}

app.get('/api/friends/state/:id', requireUser, route(async (req, res) => {
  const other = req.params.id;
  if (other === req.user.id) return res.json({ state: 'self' });
  if (await chatBetween(req.user.id, other)) return res.json({ state: 'friends' });

  const pending = await db.prepare(`SELECT * FROM friend_requests
    WHERE status = 'pending' AND ((from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?))`)
    .get(req.user.id, other, other, req.user.id);

  if (!pending) return res.json({ state: 'none' });
  res.json({ state: pending.from_id === req.user.id ? 'sent' : 'incoming' });
}));

app.post('/api/friends/request', requireUser, route(async (req, res) => {
  const toId = req.body?.toId;
  const target = await getUserRow(toId);
  if (!target) return bad(res, 'המשתמש לא נמצא', 404);
  if (toId === req.user.id) return bad(res, 'אי אפשר לשלוח בקשה לעצמכם');
  if (await chatBetween(req.user.id, toId)) return bad(res, 'אתם כבר חברים');

  const pending = await db.prepare(`SELECT id FROM friend_requests
    WHERE status = 'pending' AND ((from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?))`)
    .get(req.user.id, toId, toId, req.user.id);
  if (pending) return bad(res, 'כבר יש בקשה פתוחה');

  const id = newId('r');
  await db.prepare(`INSERT INTO friend_requests (id, from_id, to_id, status, created_at)
              VALUES (?, ?, ?, 'pending', ?)`).run(id, req.user.id, toId, now());

  // מאמני הדמו עונים לבד, אחרת אי אפשר להדגים את הזרימה בלי משתמש שני
  if (target.is_demo) {
    await db.prepare("UPDATE friend_requests SET status = 'accepted' WHERE id = ?").run(id);
    const chat = await openChat(req.user.id, toId);
    await db.prepare('INSERT INTO messages (id, chat_id, from_id, body, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(newId('m'), chat.id, toId, DEMO_GREETINGS[toId] || 'היי! 🛹', now());
    return res.json({ state: 'friends', chatId: chat.id });
  }

  res.json({ state: 'sent' });
}));

const withUser = async (row, key) => ({
  id: row.id,
  fromId: row.from_id,
  toId: row.to_id,
  status: row.status,
  createdAt: row.created_at,
  [key]: await publicUser(await getUserRow(key === 'from' ? row.from_id : row.to_id)),
});

app.get('/api/friends/incoming', requireUser, route(async (req, res) => {
  const rows = await db.prepare(`SELECT * FROM friend_requests
    WHERE to_id = ? AND status = 'pending' ORDER BY created_at DESC`).all(req.user.id);
  res.json(await Promise.all(rows.map((r) => withUser(r, 'from'))));
}));

app.get('/api/friends/outgoing', requireUser, route(async (req, res) => {
  const rows = await db.prepare(`SELECT * FROM friend_requests
    WHERE from_id = ? AND status = 'pending' ORDER BY created_at DESC`).all(req.user.id);
  res.json(await Promise.all(rows.map((r) => withUser(r, 'to'))));
}));

app.post('/api/friends/:id/accept', requireUser, route(async (req, res) => {
  const row = await db.prepare("SELECT * FROM friend_requests WHERE id = ? AND status = 'pending'")
    .get(req.params.id);
  if (!row) return bad(res, 'הבקשה לא נמצאה', 404);
  if (row.to_id !== req.user.id) return bad(res, 'הבקשה הזאת לא אליכם', 403);

  await db.prepare("UPDATE friend_requests SET status = 'accepted' WHERE id = ?").run(row.id);
  res.json({ chatId: (await openChat(row.from_id, row.to_id)).id });
}));

app.post('/api/friends/:id/decline', requireUser, route(async (req, res) => {
  const row = await db.prepare("SELECT * FROM friend_requests WHERE id = ? AND status = 'pending'")
    .get(req.params.id);
  if (!row) return bad(res, 'הבקשה לא נמצאה', 404);
  if (row.to_id !== req.user.id) return bad(res, 'הבקשה הזאת לא אליכם', 403);

  await db.prepare("UPDATE friend_requests SET status = 'declined' WHERE id = ?").run(row.id);
  res.json({ ok: true });
}));

/* ==========================================================================
   צ'אטים
   ========================================================================== */

async function chatShape(row, meId) {
  const otherId = row.a_id === meId ? row.b_id : row.a_id;
  const last = await db.prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(row.id);
  return {
    id: row.id,
    other: await publicUser(await getUserRow(otherId)),
    last: last && { id: last.id, fromId: last.from_id, text: last.body, createdAt: last.created_at },
    activeAt: last ? last.created_at : row.created_at,
    createdAt: row.created_at,
  };
}

app.get('/api/chats', requireUser, route(async (req, res) => {
  const rows = await db.prepare('SELECT * FROM chats WHERE a_id = ? OR b_id = ?').all(req.user.id, req.user.id);
  const shaped = await Promise.all(rows.map((r) => chatShape(r, req.user.id)));
  res.json(shaped
                .filter((c) => c.other)
                .sort((a, b) => b.activeAt.localeCompare(a.activeAt)));
}));

app.get('/api/chats/:id', requireUser, route(async (req, res) => {
  const row = await db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.id);
  if (!row || (row.a_id !== req.user.id && row.b_id !== req.user.id)) {
    return bad(res, 'הצ׳אט לא נמצא', 404);
  }
  const messages = await db.prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at').all(row.id);

  /*
   * ה-await כאן קריטי: chatShape אסינכרונית מאז המעבר ל-Postgres, ופיזור
   * של הבטחה מייצר אובייקט ריק במקום לזרוק. התוצאה הייתה צ׳אט בלי `other`,
   * והמסך נפל על קריאת השם של הצד השני.
   */
  res.json({
    ...(await chatShape(row, req.user.id)),
    messages: messages.map((m) => ({ id: m.id, fromId: m.from_id, text: m.body, createdAt: m.created_at })),
  });
}));

app.post('/api/chats/:id/messages', requireUser, route(async (req, res) => {
  const text = (req.body?.text || '').trim();
  if (!text) return bad(res, 'ההודעה ריקה');

  const row = await db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.id);
  if (!row || (row.a_id !== req.user.id && row.b_id !== req.user.id)) {
    return bad(res, 'הצ׳אט לא נמצא', 404);
  }

  const id = newId('m');
  const at = now();
  await db.prepare('INSERT INTO messages (id, chat_id, from_id, body, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, row.id, req.user.id, text.slice(0, 1000), at);

  res.json({ id, fromId: req.user.id, text: text.slice(0, 1000), createdAt: at });
}));

/* ==========================================================================
   לוח הבקרה — מחיקת משתמשים וסרטונים
   נפרד לגמרי מהתחברות המשתמשים: סיסמה משותפת אחת (ADMIN_PASSWORD),
   בלי תלות בטבלת users. ראו server/admin.js.
   ========================================================================== */

app.get('/api/admin/session', (req, res) =>
  res.json({ enabled: adminEnabled(), loggedIn: isAdmin(req) }));

app.post('/api/admin/login',
  rateLimit({ max: 10, windowMs: 900_000, message: 'יותר מדי נסיונות התחברות ללוח הבקרה.' }),
  route(async (req, res) => {
    if (!adminEnabled()) return bad(res, 'לוח הבקרה לא הוגדר בשרת', 503);
    if (!checkPassword(req.body?.password)) return bad(res, 'סיסמה שגויה', 403);

    setAdminCookie(res, createAdminSession());
    res.json({ ok: true });
  }));

app.post('/api/admin/logout', (req, res) => {
  destroyAdminSession(req.cookies?.skatelab_admin);
  clearAdminCookie(res);
  res.json({ ok: true });
});

app.get('/api/admin/users', requireAdmin, route(async (req, res) => {
  const rows = await db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.region, u.is_demo, u.created_at,
           (SELECT COUNT(*)::int FROM videos v WHERE v.author_id = u.id) AS video_count
      FROM users u
     ORDER BY u.created_at DESC`).all();

  res.json(rows.map((r) => ({
    id: r.id, name: r.name, email: r.email || null, role: r.role, region: r.region,
    isDemo: !!r.is_demo, createdAt: r.created_at, videoCount: r.video_count,
  })));
}));

app.delete('/api/admin/users/:id', requireAdmin, route(async (req, res) => {
  const row = await db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!row) return bad(res, 'המשתמש לא נמצא', 404);

  const videos = await db.prepare('SELECT id FROM videos WHERE author_id = ?').all(row.id);
  await db.prepare('DELETE FROM users WHERE id = ?').run(row.id);   // מוחק בשרשור
  for (const v of videos) await removeFiles(v.id);

  res.json({ ok: true });
}));

app.get('/api/admin/videos', requireAdmin, route(async (req, res) => {
  const rows = await db.prepare(`
    SELECT v.id, v.title, v.kind, v.region, v.has_file, v.is_demo, v.created_at,
           u.name AS author_name, u.id AS author_id
      FROM videos v JOIN users u ON u.id = v.author_id
     ORDER BY v.created_at DESC`).all();

  res.json(rows.map((r) => ({
    id: r.id, title: r.title, kind: r.kind, region: r.region,
    hasFile: !!r.has_file, isDemo: !!r.is_demo, createdAt: r.created_at,
    authorId: r.author_id, authorName: r.author_name,
  })));
}));

app.delete('/api/admin/videos/:id', requireAdmin, route(async (req, res) => {
  const row = await db.prepare('SELECT id FROM videos WHERE id = ?').get(req.params.id);
  if (!row) return bad(res, 'הסרטון לא נמצא', 404);

  await db.prepare('DELETE FROM videos WHERE id = ?').run(row.id);
  await removeFiles(row.id);
  res.json({ ok: true });
}));

/* ==========================================================================
   קבצי מדיה והצד-לקוח
   ========================================================================== */

/** express.static תומך ב-Range, כך שאפשר לדלג באמצע סרטון. */
app.use('/media', express.static(UPLOADS, {
  maxAge: '1h',
  setHeaders: (res) => res.setHeader('Accept-Ranges', 'bytes'),
}));

/*
 * חוסמים כל בקשה לתיקיית השרת לפני שמגישים קבצים סטטיים.
 * בלי זה כתובת כמו /server/.env הייתה מחזירה את מפתח ה-API, וכתובת
 * /server/data.db את כל המסד. הבדיקה חסרת רישיות בכוונה — מערכת
 * הקבצים של macOS לא מבחינה בין server ל-SERVER.
 */
app.use((req, res, next) => {
  if (/^\/server(\/|$)/i.test(req.path)) return res.status(404).end();
  next();
});

app.use(express.static(ROOT, { index: 'index.html', dotfiles: 'ignore' }));

app.use((err, req, res, _next) => {
  console.error(err);
  if (res.headersSent) return;

  /*
   * שגיאות של מפרסר הגוף נושאות status משלהן (413 לגוף גדול מדי).
   * בלי הבדיקה הזאת כל אחת מהן הוצגה כ"שגיאת שרת", והמשתמש לא היה
   * מבין שהקובץ פשוט גדול מדי.
   */
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'הקובץ או הבקשה גדולים מדי' });
  }

  res.status(err.status >= 400 && err.status < 500 ? err.status : 500)
     .json({ error: err.status >= 400 && err.status < 500 ? err.message : 'שגיאת שרת' });
});

/*
 * רשת ביטחון אחרונה. Node מפיל את כל התהליך על דחייה לא מטופלת, וכאן
 * זה אומר שכל המשתמשים מקבלים שגיאה עד שהשרת עולה מחדש — בגלל באג
 * בבקשה בודדת של מישהו אחד. עדיף לרשום ליומן ולהמשיך לחיות.
 *
 * זה לא תחליף לטיפול נכון בשגיאות בנתיבים עצמם, אלא ביטוח למה שפספסנו.
 */
process.on('unhandledRejection', (reason) => {
  console.error('דחייה לא מטופלת:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('חריגה לא מטופלת:', err);
});

app.listen(PORT, () => {
  console.log(`Skate Lab רץ על http://localhost:${PORT}`);
});
