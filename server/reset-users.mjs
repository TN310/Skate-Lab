/* ==========================================================================
   איפוס משתמשים
   מוחק את *כל* החשבונות ואת כל מה שתלוי בהם: סרטונים, קבצים, תגובות,
   לייקים, בקשות חברות, צ׳אטים, התיק ושיחות ה-AI.

   מאמני הדמו והשיעורים לדוגמה חוזרים לבד בהפעלה הבאה של השרת —
   הזריעה רצה כשטבלת המשתמשים ריקה. אין דרך לבטל את המחיקה עצמה.

   בדיקה בלי למחוק:  node server/reset-users.mjs --dry
   מחיקה אמיתית:     node server/reset-users.mjs --yes
   ========================================================================== */

import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { db, UPLOADS } from './db.js';

const dryRun = process.argv.includes('--dry');
const confirmed = process.argv.includes('--yes');

const count = (table) => db.prepare(`SELECT COUNT(*) c FROM ${table}`).get().c;

const users = db.prepare('SELECT id, name, is_demo FROM users').all();
const videos = db.prepare('SELECT id FROM videos').all();

if (!users.length) {
  console.log('אין משתמשים למחוק.');
  process.exit(0);
}

console.log(`משתמשים: ${users.length}`);
for (const u of users) console.log(`  ${u.name}${u.is_demo ? ' (דמו)' : ''}`);
console.log(`סרטונים: ${videos.length}`);
console.log(`תגובות: ${count('comments')}   צ׳אטים: ${count('chats')}   תיק: ${count('bag')}`);

// שתי הגנות: ריצה יבשה כברירת מחדל, ודגל אישור מפורש למחיקה.
// בלי זה טעות הקלדה אחת מוחקת הכל.
if (dryRun || !confirmed) {
  console.log('\nלא נמחק כלום.');
  console.log('למחיקה אמיתית:  node server/reset-users.mjs --yes');
  process.exit(0);
}

db.prepare('DELETE FROM users').run();   // המחיקה מדורגת לכל שאר הטבלאות

for (const video of videos) {
  await rm(join(UPLOADS, `video_${video.id}`), { force: true });
  await rm(join(UPLOADS, `thumb_${video.id}`), { force: true });
}

console.log('\nנמחק. עכשיו נשאר:');
for (const table of ['users', 'videos', 'comments', 'chats', 'bag', 'sessions']) {
  console.log(`  ${table}: ${count(table)}`);
}
console.log('\nהפעילו את השרת מחדש — מאמני הדמו והשיעורים ייזרעו שוב.');
