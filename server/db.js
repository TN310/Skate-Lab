/* ==========================================================================
   DB — סכימה וגישה לנתונים (Postgres)

   שני מנועים, אותו SQL בדיוק:
   • בייצור — Postgres מרוחק דרך DATABASE_URL (Neon).
   • מקומית — PGlite, שהוא Postgres אמיתי שרץ בתוך התהליך ושומר לתיקייה.
     ככה מה שנבדק מקומית מתנהג בדיוק כמו בשרת, בלי להתקין כלום.

   הגישה נשארה `db.prepare(sql).get/all/run(...)` כמו קודם, רק שעכשיו
   היא מחזירה הבטחה וצריך await. סימני השאלה מתורגמים ל-$1, $2 אוטומטית.
   ========================================================================== */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || here;

/* ---------- בחירת המנוע ---------- */

let query;      // (text, params) -> { rows, rowCount }
let execMulti;  // הרצת כמה פקודות בבת אחת (הסכימה) — נתיב נפרד בכוונה,
                // כי שאילתה עם פרמטרים לא יכולה להכיל יותר מפקודה אחת

if (process.env.DATABASE_URL) {
  const { default: pg } = await import('pg');

  /*
   * COUNT מחזיר bigint, ו-node-postgres מחזיר bigint כמחרוזת כדי לא לאבד
   * דיוק. המונים שלנו קטנים, ובלי ההמרה הזאת "3" היה מגיע למסכים במקום 3.
   */
  pg.types.setTypeParser(20, Number);

  /*
   * ה-SSL נקבע ממחרוזת החיבור (Neon שולח sslmode=require), והתעודה שלהם
   * נבדקת מול רשויות האישור הרגילות. לא מבטלים כאן את הבדיקה: בלעדיה
   * אפשר היה להתחזות למסד ולקרוא את כל מה שעובר בחיבור.
   */
  /*
   * Neon נותן sslmode=require. היום הספרייה מתייחסת אליו כאל בדיקה מלאה,
   * אבל בגרסה הבאה המשמעות תיחלש ובדיקת התעודה תיעלם בשקט. מקבעים כאן
   * verify-full כדי שהחיבור יישאר מאומת גם אחרי עדכון גרסה.
   */
  const url = process.env.DATABASE_URL.replace(/sslmode=(require|prefer|verify-ca)\b/,
                                               'sslmode=verify-full');

  const pool = new pg.Pool({
    connectionString: url,
    max: 5,                      // התוכנית החינמית מוגבלת בחיבורים
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
  });

  query = (text, params) => pool.query(text, params);
  execMulti = (sql) => pool.query(sql);
} else {
  const { PGlite } = await import('@electric-sql/pglite');
  mkdirSync(DATA_DIR, { recursive: true });
  const pglite = await PGlite.create(join(DATA_DIR, 'pgdata'));

  query = async (text, params) => {
    const result = await pglite.query(text, params);
    return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
  };
  execMulti = (sql) => pglite.exec(sql);
}

/**
 * מתרגם סימני שאלה לסימני הפרמטרים של Postgres.
 * לא מתחכם עם מחרוזות — אין בקוד הזה סימן שאלה בתוך טקסט SQL.
 */
function toPositional(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

export const db = {
  prepare(sql) {
    const text = toPositional(sql);
    return {
      async get(...params) {
        const { rows } = await query(text, params);
        return rows[0];
      },
      async all(...params) {
        const { rows } = await query(text, params);
        return rows;
      },
      async run(...params) {
        const { rowCount } = await query(text, params);
        return { changes: rowCount };
      },
    };
  },
  exec: (sql) => execMulti(sql),
};

/* ---------- הסכימה ---------- */

/*
 * דגלי אמת/שקר נשמרים כ-INTEGER ולא כ-BOOLEAN בכוונה: כל הקוד בצד-לקוח
 * כבר עובד עם 0/1, ומעבר ל-BOOLEAN היה דורש לגעת בכל מקום שקורא אותם.
 */
await db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id             TEXT PRIMARY KEY,
    slug           TEXT NOT NULL UNIQUE,
    name           TEXT NOT NULL,
    email          TEXT,
    password_hash  TEXT,
    avatar         TEXT NOT NULL DEFAULT '🛹',
    gender         TEXT NOT NULL DEFAULT 'na',
    stance         TEXT NOT NULL DEFAULT 'unknown',
    dob            TEXT,
    role           TEXT NOT NULL,
    level          TEXT,
    region         TEXT,
    city           TEXT,
    years          INTEGER,
    bio            TEXT,
    styles         TEXT NOT NULL DEFAULT '[]',
    base_followers INTEGER NOT NULL DEFAULT 0,
    is_demo        INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS videos (
    id         TEXT PRIMARY KEY,
    author_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind       TEXT NOT NULL,
    title      TEXT NOT NULL,
    descr      TEXT NOT NULL DEFAULT '',
    level      TEXT,
    region     TEXT,
    styles     TEXT NOT NULL DEFAULT '[]',
    poster     TEXT NOT NULL DEFAULT '🛹',
    trick_id   TEXT,
    file_hash  TEXT,
    video_url  TEXT,
    thumb_url  TEXT,
    has_file   INTEGER NOT NULL DEFAULT 0,
    has_thumb  INTEGER NOT NULL DEFAULT 0,
    is_demo    INTEGER NOT NULL DEFAULT 0,
    views      INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS likes (
    video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (video_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id         TEXT PRIMARY KEY,
    video_id   TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    author_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id  TEXT REFERENCES comments(id) ON DELETE CASCADE,
    body       TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS follows (
    follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    coach_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (follower_id, coach_id)
  );

  CREATE TABLE IF NOT EXISTS friend_requests (
    id         TEXT PRIMARY KEY,
    from_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status     TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chats (
    id         TEXT PRIMARY KEY,
    a_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    b_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id         TEXT PRIMARY KEY,
    chat_id    TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    from_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body       TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bag (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    video_id      TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    ai_verdict    TEXT,
    ai_reason     TEXT,
    verified_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at    TEXT NOT NULL,
    UNIQUE (user_id, video_id)
  );

  CREATE TABLE IF NOT EXISTS ai_messages (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role       TEXT NOT NULL,
    body       TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  /*
   * המסד כבר קיים בענן עם משתמשים, אז העמודה נוספת גם בדיעבד ולא רק
   * ב-CREATE TABLE שרץ פעם אחת. IF NOT EXISTS הופך את זה לבטוח לחזרה.
   */
  ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;

  /*
   * ייחודיות ללא תלות ברישיות, ורק על מי שמילא — כתובת ריקה היא NULL,
   * ו-Postgres לא סופר NULL כהתנגשות. בלי זה שני חשבונות היו יכולים
   * להירשם עם אותו מייל וכל שחזור סיסמה עתידי היה נשבר.
   */
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (LOWER(email));

  CREATE INDEX IF NOT EXISTS idx_bag_user          ON bag(user_id);
  CREATE INDEX IF NOT EXISTS idx_ai_messages_user  ON ai_messages(user_id);
  CREATE INDEX IF NOT EXISTS idx_videos_author     ON videos(author_id);
  CREATE INDEX IF NOT EXISTS idx_videos_hash       ON videos(file_hash);
  CREATE INDEX IF NOT EXISTS idx_comments_video    ON comments(video_id);
  CREATE INDEX IF NOT EXISTS idx_comments_parent   ON comments(parent_id);
  CREATE INDEX IF NOT EXISTS idx_messages_chat     ON messages(chat_id);
  CREATE INDEX IF NOT EXISTS idx_requests_to       ON friend_requests(to_id, status);
`);

/* ---------- עזרים ---------- */

export const now = () => new Date().toISOString();

export const slugify = (name) => name.trim().toLowerCase().replace(/\s+/g, '-');

export const newId = (prefix) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/**
 * המרת שורת משתמש לצורה שהמסכים מצפים לה.
 * המונים (סרטונים, עוקבים, תשובות) מחושבים בשאילתה ולא נשמרים בטבלה —
 * ככה הם לא יכולים להיסחף ולהציג מספר שקרי.
 */
export async function publicUser(row) {
  if (!row) return null;

  const following = await db.prepare('SELECT coach_id FROM follows WHERE follower_id = ?')
    .all(row.id);

  return {
    id: row.id,
    name: row.name,
    avatar: row.avatar,
    gender: row.gender,
    stance: row.stance || 'unknown',
    age: ageFrom(row.dob),
    role: row.role,
    level: row.level,
    region: row.region,
    city: row.city,
    years: row.years,
    bio: row.bio,
    styles: JSON.parse(row.styles || '[]'),
    isDemo: !!row.is_demo,
    createdAt: row.created_at,
    following: following.map((r) => r.coach_id),
    stats: {
      videos: row.video_count ?? 0,
      answers: row.answer_count ?? 0,
      followers: (row.base_followers || 0) + (row.follower_count ?? 0),
    },
  };
}

/**
 * כמו publicUser, אבל עם השדות הפרטיים.
 *
 * המייל *לא* נמצא ב-publicUser בכוונה: הוא מוחזר ברשימת כל הקהילה,
 * אצל מחברי סרטונים ובצ׳אטים — כלומר כל משתמש היה יכול לשלוף את
 * המיילים של כולם. השדה הזה מוחזר רק לבעל החשבון עצמו.
 */
export async function privateUser(row) {
  const user = await publicUser(row);
  if (!user) return null;
  return { ...user, email: row.email || null };
}

/** גיל בשנים מלאות מתוך תאריך לידה שנשמר כ-"YYYY-MM-DD". */
export function ageFrom(dob) {
  if (!dob) return null;
  const [y, m, d] = dob.split('-').map(Number);
  if (!y || !m || !d) return null;
  const today = new Date();
  let age = today.getFullYear() - y;
  const passed =
    today.getMonth() + 1 > m || (today.getMonth() + 1 === m && today.getDate() >= d);
  if (!passed) age -= 1;
  return age;
}

/**
 * שאילתת המשתמש הבסיסית, כולל המונים המחושבים.
 * ההמרה ל-int מפורשת כי COUNT מחזיר bigint.
 */
export const USER_SELECT = `
  SELECT u.*,
    (SELECT COUNT(*) FROM videos v WHERE v.author_id = u.id)::int            AS video_count,
    (SELECT COUNT(*) FROM follows f WHERE f.coach_id = u.id)::int            AS follower_count,
    (SELECT COUNT(*) FROM comments c
       JOIN videos v2 ON v2.id = c.video_id
      WHERE c.author_id = u.id AND v2.author_id <> u.id)::int                AS answer_count
  FROM users u`;

export const getUserRow = (id) => db.prepare(`${USER_SELECT} WHERE u.id = ?`).get(id);
export const getUserBySlug = (slug) => db.prepare(`${USER_SELECT} WHERE u.slug = ?`).get(slug);

/** המרת שורת סרטון לצורה שהמסכים מצפים לה. */
export async function publicVideo(row, viewerId) {
  if (!row) return null;

  const likes = await db.prepare('SELECT user_id FROM likes WHERE video_id = ?').all(row.id);
  const likedBy = likes.map((r) => r.user_id);

  const comments = await db.prepare(`
    SELECT c.id, c.author_id, c.parent_id, c.body, c.created_at,
           u.name AS author_name, u.avatar AS author_avatar, u.role AS author_role
      FROM comments c JOIN users u ON u.id = c.author_id
     WHERE c.video_id = ?
     ORDER BY c.created_at`).all(row.id);

  return {
    id: row.id,
    authorId: row.author_id,
    kind: row.kind,
    title: row.title,
    desc: row.descr,
    level: row.level,
    region: row.region,
    styles: JSON.parse(row.styles || '[]'),
    poster: row.poster,
    trickId: row.trick_id || null,
    videoUrl: row.video_url || null,
    thumbUrl: row.thumb_url || null,
    hasFile: !!row.has_file,
    hasThumb: !!row.has_thumb,
    isDemo: !!row.is_demo,
    views: row.views,
    createdAt: row.created_at,
    likedBy,
    liked: !!viewerId && likedBy.includes(viewerId),
    // התגובות מוחזרות כעץ בעומק אחד: שאלה, ומתחתיה התשובות עליה
    comments: nestComments(comments),
    commentCount: comments.length,
    author: await publicUser(await getUserRow(row.author_id)),
  };
}

/** ממיר רשימת תגובות שטוחה לעץ של שאלה + תשובות. */
export function nestComments(rows) {
  const shape = (c) => ({
    id: c.id,
    parentId: c.parent_id || null,
    authorId: c.author_id,
    authorName: c.author_name,
    authorAvatar: c.author_avatar,
    authorRole: c.author_role,
    text: c.body,
    createdAt: c.created_at,
    replies: [],
  });

  const byId = new Map();
  const roots = [];

  rows.map(shape).forEach((c) => byId.set(c.id, c));
  byId.forEach((c) => {
    const parent = c.parentId && byId.get(c.parentId);
    // תשובה שההורה שלה נמחק מטופלת כתגובה עצמאית, כדי שלא תיעלם
    if (parent) parent.replies.push(c);
    else roots.push(c);
  });

  return roots;
}
