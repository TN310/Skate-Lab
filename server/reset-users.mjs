/* ==========================================================================
   איפוס משתמשים
   מוחק את *כל* החשבונות ואת כל מה שתלוי בהם: סרטונים, קבצים, תגובות,
   לייקים, בקשות חברות, צ׳אטים, התיק ושיחות ה-AI.

   הקבצים נמחקים גם מ-Cloudinary, לא רק מהמסד. אין דרך לבטל.
   פועל על המסד שמוגדר ב-server/.env — כלומר על הענן, אם הוגדר שם.

   בדיקה בלי למחוק:  node server/reset-users.mjs --dry
   מחיקה אמיתית:     node server/reset-users.mjs --yes
   ========================================================================== */

// חייב להיות ראשון: בלעדיו הסקריפט מתחבר למסד המקומי במקום לזה שבענן,
// מדווח "נמחק הכל" — ולא נוגע במסד האמיתי בכלל
import './env.mjs';
import { db } from './db.js';
import { remove as removeFiles } from './storage.js';

const dryRun = process.argv.includes('--dry');
const confirmed = process.argv.includes('--yes');

const count = async (table) => (await db.prepare(`SELECT COUNT(*)::int c FROM ${table}`).get()).c;

const users = await db.prepare('SELECT id, name, is_demo FROM users').all();
const videos = await db.prepare('SELECT id FROM videos').all();

if (!users.length) {
  console.log('אין משתמשים למחוק.');
  process.exit(0);
}

console.log(`משתמשים: ${users.length}`);
for (const u of users) console.log(`  ${u.name}${u.is_demo ? ' (דמו)' : ''}`);
console.log(`סרטונים: ${videos.length}`);
console.log(`תגובות: ${await count('comments')}   צ׳אטים: ${await count('chats')}   תיק: ${await count('bag')}`);

// שתי הגנות: ריצה יבשה כברירת מחדל, ודגל אישור מפורש למחיקה.
// בלי זה טעות הקלדה אחת מוחקת הכל.
if (dryRun || !confirmed) {
  console.log('\nלא נמחק כלום.');
  console.log('למחיקה אמיתית:  node server/reset-users.mjs --yes');
  process.exit(0);
}

await db.prepare('DELETE FROM users').run();   // המחיקה מדורגת לכל שאר הטבלאות

// דרך שכבת האחסון, כדי שגם הקבצים ב-Cloudinary יימחקו ולא רק המקומיים
for (const video of videos) await removeFiles(video.id);

console.log('\nנמחק. עכשיו נשאר:');
for (const table of ['users', 'videos', 'comments', 'chats', 'bag', 'sessions']) {
  console.log(`  ${table}: ${await count(table)}`);
}
process.exit(0);
