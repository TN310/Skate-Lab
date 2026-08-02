/* ==========================================================================
   DB — סכימה וגישה לנתונים
   משתמש ב-SQLite המובנה של Node (node:sqlite), בלי תלויות חיצוניות.
   ========================================================================== */

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * איפה נשמרים המסד והקבצים.
 * מקומית: בתוך תיקיית server/. באירוח: על דיסק קבוע שמוגדר ב-DATA_DIR,
 * כי הדיסק הרגיל של השרת נמחק בכל פריסה מחדש.
 */
const DATA_DIR = process.env.DATA_DIR || here;
mkdirSync(DATA_DIR, { recursive: true });

export const UPLOADS = join(DATA_DIR, 'uploads');
mkdirSync(UPLOADS, { recursive: true });

export const db = new DatabaseSync(join(DATA_DIR, 'data.db'));

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id             TEXT PRIMARY KEY,
    slug           TEXT NOT NULL UNIQUE,
    name           TEXT NOT NULL,
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

  /* התיק: טריק שהרוכב הוסיף לעצמו, תמיד עם סרטון. */
  CREATE TABLE IF NOT EXISTS bag (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    video_id      TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    ai_verdict    TEXT,              -- landed | unclear | bail | null (טרם נבדק)
    ai_reason     TEXT,
    verified_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at    TEXT NOT NULL,
    UNIQUE (user_id, video_id)
  );

  CREATE INDEX IF NOT EXISTS idx_bag_user      ON bag(user_id);

  /* היסטוריית השיחה עם עוזר ה-AI, לכל משתמש בנפרד. */
  CREATE TABLE IF NOT EXISTS ai_messages (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role       TEXT NOT NULL,   -- user | assistant
    body       TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_ai_messages_user ON ai_messages(user_id);
  CREATE INDEX IF NOT EXISTS idx_videos_author   ON videos(author_id);
  CREATE INDEX IF NOT EXISTS idx_comments_video  ON comments(video_id);
  CREATE INDEX IF NOT EXISTS idx_messages_chat   ON messages(chat_id);
  CREATE INDEX IF NOT EXISTS idx_requests_to     ON friend_requests(to_id, status);
`);

// מסד נתונים שנוצר לפני שהתגובות היו מקוננות — הוספת העמודה בדיעבד.
// חייב לרוץ לפני יצירת האינדקס עליה.
try {
  db.exec('ALTER TABLE comments ADD COLUMN parent_id TEXT REFERENCES comments(id) ON DELETE CASCADE');
} catch {
  // העמודה כבר קיימת
}

db.exec('CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id)');

// עמודת הטריק נוספה כשהתווסף סוג הסרטון "ניסיון טריק"
try {
  db.exec('ALTER TABLE videos ADD COLUMN trick_id TEXT');
} catch {
  // העמודה כבר קיימת
}

// טביעת האצבע של הקובץ נוספה יחד עם בדיקת הסרטונים הגנובים
try {
  db.exec('ALTER TABLE videos ADD COLUMN file_hash TEXT');
} catch {
  // העמודה כבר קיימת
}
db.exec('CREATE INDEX IF NOT EXISTS idx_videos_hash ON videos(file_hash)');

// עמודת הסטאנס נוספה אחרי שכבר היו משתמשים
try {
  db.exec("ALTER TABLE users ADD COLUMN stance TEXT NOT NULL DEFAULT 'unknown'");
} catch {
  // העמודה כבר קיימת
}

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
export function publicUser(row) {
  if (!row) return null;
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
    following: db.prepare('SELECT coach_id FROM follows WHERE follower_id = ?')
      .all(row.id).map((r) => r.coach_id),
    stats: {
      videos: row.video_count ?? 0,
      answers: row.answer_count ?? 0,
      followers: (row.base_followers || 0) + (row.follower_count ?? 0),
    },
  };
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

/** שאילתת המשתמש הבסיסית, כולל המונים המחושבים. */
export const USER_SELECT = `
  SELECT u.*,
    (SELECT COUNT(*) FROM videos v WHERE v.author_id = u.id)            AS video_count,
    (SELECT COUNT(*) FROM follows f WHERE f.coach_id = u.id)            AS follower_count,
    (SELECT COUNT(*) FROM comments c
       JOIN videos v2 ON v2.id = c.video_id
      WHERE c.author_id = u.id AND v2.author_id <> u.id)                AS answer_count
  FROM users u`;

export const getUserRow = (id) => db.prepare(`${USER_SELECT} WHERE u.id = ?`).get(id);
export const getUserBySlug = (slug) => db.prepare(`${USER_SELECT} WHERE u.slug = ?`).get(slug);

/** המרת שורת סרטון לצורה שהמסכים מצפים לה. */
export function publicVideo(row, viewerId) {
  if (!row) return null;

  const likedBy = db.prepare('SELECT user_id FROM likes WHERE video_id = ?')
    .all(row.id).map((r) => r.user_id);

  const comments = db.prepare(`
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
    author: publicUser(getUserRow(row.author_id)),
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
