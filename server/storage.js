/* ==========================================================================
   Storage — איפה יושבים קבצי הווידאו והתמונות

   שני מנועים, אותו ממשק:
   • Cloudinary — כשמוגדרים המפתחות. הקבצים יושבים אצלם ומוגשים דרך CDN.
   • דיסק מקומי — כברירת מחדל בפיתוח, מוגש מ-/media.

   למה בכלל: בשרת החינמי הדיסק נמחק בכל הפעלה מחדש, אז קובץ שנשמר עליו
   נעלם. Cloudinary הוא המקום היחיד שבו הסרטון באמת שורד.
   ========================================================================== */

import { createWriteStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';

const here = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || here;

export const UPLOADS = join(DATA_DIR, 'uploads');
mkdirSync(UPLOADS, { recursive: true });

const CLOUD = process.env.CLOUDINARY_CLOUD_NAME;
const KEY = process.env.CLOUDINARY_API_KEY;
const SECRET = process.env.CLOUDINARY_API_SECRET;

export const usingCloud = () => !!(CLOUD && KEY && SECRET);

/* ---------- Cloudinary ---------- */

/**
 * Cloudinary מאמת בקשות בחתימת SHA-1 על הפרמטרים לפי סדר אלפביתי,
 * עם הסוד בסוף. ככה אין צורך בספריית לקוח שלמה בשביל העלאה אחת.
 */
async function signature(params) {
  const { createHash } = await import('node:crypto');
  const canonical = Object.keys(params).sort()
    .map((k) => `${k}=${params[k]}`).join('&');
  return createHash('sha1').update(canonical + SECRET).digest('hex');
}

async function cloudUpload(buffer, { publicId, video }) {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { public_id: publicId, timestamp };

  const form = new FormData();
  form.append('file', new Blob([buffer]));
  form.append('api_key', KEY);
  form.append('timestamp', String(timestamp));
  form.append('public_id', publicId);
  form.append('signature', await signature(params));

  const kind = video ? 'video' : 'image';
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD}/${kind}/upload`,
    { method: 'POST', body: form });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`ההעלאה ל-Cloudinary נכשלה (${res.status}): ${detail.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.secure_url;
}

async function cloudDestroy(publicId, video) {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { public_id: publicId, timestamp };

  const form = new FormData();
  form.append('api_key', KEY);
  form.append('timestamp', String(timestamp));
  form.append('public_id', publicId);
  form.append('signature', await signature(params));

  const kind = video ? 'video' : 'image';
  // כישלון במחיקה לא אמור להפיל את המחיקה מהמסד — הרשומה חשובה יותר
  await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/${kind}/destroy`,
    { method: 'POST', body: form }).catch(() => {});
}

/* ---------- הממשק ---------- */

/**
 * שומר קובץ ומחזיר את הכתובת שממנה יוגש.
 * `kind` הוא 'video' או 'thumb'.
 */
export async function put(kind, videoId, buffer) {
  const publicId = `skatelab/${kind}_${videoId}`;
  const isVideo = kind === 'video';

  if (usingCloud()) return cloudUpload(buffer, { publicId, video: isVideo });

  const path = join(UPLOADS, `${kind}_${videoId}`);
  await pipeline([buffer], createWriteStream(path));
  return `/media/${kind}_${videoId}`;
}

/** מוחק את שני הקבצים של סרטון. שקט בכוונה — מחיקה חלקית עדיפה על שגיאה. */
export async function remove(videoId) {
  if (usingCloud()) {
    await cloudDestroy(`skatelab/video_${videoId}`, true);
    await cloudDestroy(`skatelab/thumb_${videoId}`, false);
    return;
  }

  await rm(join(UPLOADS, `video_${videoId}`), { force: true });
  await rm(join(UPLOADS, `thumb_${videoId}`), { force: true });
}

/**
 * מחזיר את התמונה הממוזערת כ-Buffer, לא משנה איפה היא יושבת.
 * ה-AI צריך את הבייטים עצמם, וב-Cloudinary אין קובץ מקומי לקרוא.
 */
export async function readThumb(videoId, thumbUrl) {
  if (usingCloud()) {
    if (!thumbUrl) return null;
    const res = await fetch(thumbUrl);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  }

  const { readFile } = await import('node:fs/promises');
  return readFile(join(UPLOADS, `thumb_${videoId}`)).catch(() => null);
}
