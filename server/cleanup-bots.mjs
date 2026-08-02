/* ==========================================================================
   ניקוי חשבונות בדיקה
   מוחק את חשבונות הבוטים וה-QA שנוצרו במהלך הפיתוח, ומשאיר את
   החשבונות האמיתיים ואת מאמני הדמו.

   הרצה:  node server/cleanup-bots.mjs
   בדיקה בלי למחוק:  node server/cleanup-bots.mjs --dry
   ========================================================================== */

import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { db, UPLOADS } from './db.js';

/** חשבונות אמיתיים — לא נוגעים בהם לעולם. */
const KEEP = ['עומר ארז', 'נועם', 'רון מאמן'];

const dryRun = process.argv.includes('--dry');

// מאמני הדמו מסומנים is_demo=1 ונשארים; מוחקים רק חשבונות אמיתיים
// שאינם ברשימת השמורים — כלומר הבוטים.
const doomed = db.prepare('SELECT id, name FROM users WHERE is_demo = 0').all()
  .filter((u) => !KEEP.includes(u.name));

if (!doomed.length) {
  console.log('אין חשבונות בדיקה למחיקה.');
  process.exit(0);
}

console.log(dryRun ? 'הרצת בדיקה — לא נמחק כלום:' : 'מוחק:');

for (const user of doomed) {
  const videos = db.prepare('SELECT id FROM videos WHERE author_id = ?').all(user.id);
  console.log(`  ${user.name} — ${videos.length} סרטונים`);
  if (dryRun) continue;

  // המחיקה מדורגת דרך המפתחות הזרים: תגובות, לייקים, צ׳אטים והתיק
  db.prepare('DELETE FROM users WHERE id = ?').run(user.id);

  for (const video of videos) {
    await rm(join(UPLOADS, `video_${video.id}`), { force: true });
    await rm(join(UPLOADS, `thumb_${video.id}`), { force: true });
  }
}

if (dryRun) {
  console.log(`\nסה"כ ${doomed.length} חשבונות היו נמחקים.`);
  console.log('להרצה אמיתית: node server/cleanup-bots.mjs');
} else {
  const count = (table) => db.prepare(`SELECT COUNT(*) c FROM ${table}`).get().c;
  console.log(`\nנשארו ${count('users')} משתמשים ו-${count('videos')} סרטונים.`);
}
