/* ==========================================================================
   Seed — מאמני ושיעורי הדמו
   רצים פעם אחת, בפעם הראשונה שהשרת עולה על מסד נתונים ריק.
   ========================================================================== */

import { db, now, newId, slugify } from './db.js';

const COACHES = [
  { id: 'c_dan', name: 'דניאל כהן', avatar: '🔥', gender: 'male', region: 'גוש דן',
    city: 'סקייטפארק גלית, תל אביב', years: 12, styles: ['סטריט'], followers: 248,
    bio: 'רוכב סטריט 12 שנה. מלמד קיקפליפ בשיטה של פירוק לשלבים — בלי לשבור את הקרסול.' },
  { id: 'c_shira', name: 'שירה לוי', avatar: '⚡️', gender: 'female', region: 'השרון',
    city: 'סקייטפארק הרצליה', years: 8, styles: ['פארק', 'פול'], followers: 176,
    bio: 'פארק ופול. מאמנת קבוצות ילדים והמון בנות שמתחילות עכשיו.' },
  { id: 'c_yossi', name: 'יוסי מזרחי', avatar: '🦈', gender: 'male', region: 'חיפה והקריות',
    city: 'סקייטפארק הכט, חיפה', years: 15, styles: ['פול', 'פארק'], followers: 312,
    bio: 'ותיק הפול בחיפה. אם יש לכם פחד מהקיר — אני האיש.' },
  { id: 'c_alex', name: 'אלכס רוזן', avatar: '👽', gender: 'male', region: 'ירושלים',
    city: 'סקייטפארק גן סאקר, ירושלים', years: 10, styles: ['סטריט'], followers: 141,
    bio: 'ריילים ומדרגות. מאמין בהרבה חזרות על דברים קטנים לפני שקופצים.' },
  { id: 'c_noa', name: 'נועה בר', avatar: '🌊', gender: 'female', region: 'דרום',
    city: 'סקייטפארק באר שבע', years: 6, styles: ['פול', 'פארק'], followers: 98,
    bio: 'רוכבת פול ופארק. הכי אוהבת ללמד מאפס — כולל איך להפסיק לפחד מהקצה.' },
  { id: 'c_ido', name: 'עידו שמש', avatar: '🐺', gender: 'male', region: 'צפון',
    city: 'סקייטפארק כרמיאל', years: 9, styles: ['סטריט', 'פארק'], followers: 133,
    bio: 'מלמד בצפון כבר 9 שנים. אוליי, גריינדים והמון סבלנות.' },
];

const VIDEOS = [
  { by: 'c_dan', title: 'אוליי מושלם ב-4 שלבים', level: 'מתחיל', styles: ['סטריט'], poster: '🛹',
    desc: 'מפרקים את האוליי לארבעה שלבים: עמידה, פופ, גרירה ונחיתה. התאמנו על כל שלב בנפרד לפני שמחברים.' },
  { by: 'c_dan', title: 'קיקפליפ — למה הרגל מחליקה', level: 'בינוני', styles: ['סטריט'], poster: '🔥',
    desc: 'הטעות הכי נפוצה היא שהכתף פתוחה מדי. בסרטון אני מראה איך לתקן את זה בשלוש חזרות.' },
  { by: 'c_shira', title: 'דרופ-אין ראשון בפול', level: 'מתחיל', styles: ['פול', 'פארק'], poster: '⚡️',
    desc: 'הפחד מהדרופ-אין הוא עניין של משקל גוף. אני מסבירה בדיוק לאן להטות את הכתפיים.' },
  { by: 'c_shira', title: 'פאמפינג — לצבור מהירות בלי לדחוף', level: 'בינוני', styles: ['פארק', 'פול'], poster: '🌊',
    desc: 'ברגע שתבינו את הפאמפינג תפסיקו להתעייף בפארק. תרגיל פשוט שאפשר לחזור עליו 20 פעם.' },
  { by: 'c_yossi', title: 'רוק טו פייקי על הקיר', level: 'מתקדם', styles: ['פול'], poster: '🦈',
    desc: 'טריק שנראה מפחיד ובעצם הוא מהבטוחים שיש על הקופינג. אני מפרק את התזמון פריים אחרי פריים.' },
  { by: 'c_yossi', title: 'איך נופלים נכון (וזה חשוב)', level: 'מתחיל', styles: ['פארק', 'פול'], poster: '💀',
    desc: 'השיעור הראשון שכל רוכב צריך: להתגלגל במקום לבלום עם היד. חוסך שברים.' },
  { by: 'c_alex', title: '50-50 גריינד על רייל נמוך', level: 'בינוני', styles: ['סטריט'], poster: '⚡️',
    desc: 'מתחילים על אבן שפה נמוכה, לא על רייל. אני מראה את זווית הגישה הנכונה.' },
  { by: 'c_alex', title: 'לקפוץ 3 מדרגות בפעם הראשונה', level: 'מתקדם', styles: ['סטריט'], poster: '👽',
    desc: 'העניין הוא מהירות, לא כוח. אם אתם איטיים מדי תיפלו קדימה — ואני מסביר בדיוק למה.' },
  { by: 'c_noa', title: 'שלוש דרכים לעצור בביטחון', level: 'מתחיל', styles: ['סטריט'], poster: '🌈',
    desc: 'פוט ברייק, הילס דראג ועצירה בסיבוב. כל אחת מתאימה למהירות אחרת, ואני מראה מתי להשתמש בכל אחת.' },
  { by: 'c_noa', title: 'הקארב הראשון בפול', level: 'יודע קצת', styles: ['פול'], poster: '🌊',
    desc: 'בפול אין קצה ישר, אז הכל עניין של להבין את הצורה. אני מראה איך לקרוא את הדופן לפני שנכנסים אליה.' },
  { by: 'c_ido', title: 'מניואל — למצוא את נקודת האיזון', level: 'יודע קצת', styles: ['סטריט', 'פארק'], poster: '🐺',
    desc: 'תרגיל הקיר שבזכותו למדתי מניואל תוך שבועיים. אפשר לעשות אותו בבית.' },
  { by: 'c_ido', title: 'פופ שאביט — הרגל האחורית עושה הכל', level: 'בינוני', styles: ['סטריט'], poster: '🤙',
    desc: 'רוב האנשים מנסים לסובב עם הרגל הקדמית וזה בדיוק ההפך. תיקון קטן שמשנה הכל.' },
];

const COMMENTS = {
  0: [
    { by: 'c_shira', text: 'ההסבר על הגרירה מעולה. אני מוסיפה לתלמידים שלי תרגיל של אוליי סטטי על הדשא, לפני שעולים על אספלט.' },
    { by: 'c_ido', text: 'שלב 2 הוא באמת המקום שכולם נתקעים בו 👌' },
  ],
  2: [{ by: 'c_yossi', text: 'הכי חשוב מה שאמרת על הכתפיים. מי שנופל בדרופ-אין כמעט תמיד נשען אחורה.' }],
  5: [{ by: 'c_dan', text: 'הסרטון הזה צריך להיות חובה לכל מי שקונה סקייטבורד ראשון.' }],
};

export function seedIfEmpty() {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  if (n > 0) return false;

  const insertUser = db.prepare(`
    INSERT INTO users (id, slug, name, password_hash, avatar, gender, stance, dob, role,
                       level, region, city, years, bio, styles, base_followers, is_demo, created_at)
    VALUES (?, ?, ?, NULL, ?, ?, ?, NULL, 'coach', NULL, ?, ?, ?, ?, ?, ?, 1, ?)`);

  for (const c of COACHES) {
    insertUser.run(c.id, slugify(c.name), c.name, c.avatar, c.gender, c.stance || 'regular', c.region,
                   c.city, c.years, c.bio, JSON.stringify(c.styles), c.followers,
                   new Date(2026, 0, 1).toISOString());
  }

  const insertVideo = db.prepare(`
    INSERT INTO videos (id, author_id, kind, title, descr, level, region, styles,
                        poster, has_file, has_thumb, is_demo, views, created_at)
    VALUES (?, ?, 'lesson', ?, ?, ?, ?, ?, ?, 0, 0, 1, ?, ?)`);

  const insertComment = db.prepare(`
    INSERT INTO comments (id, video_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)`);

  const regionOf = Object.fromEntries(COACHES.map((c) => [c.id, c.region]));
  const base = new Date(2026, 6, 1).getTime();

  VIDEOS.forEach((v, i) => {
    const id = `v_seed_${i}`;
    insertVideo.run(id, v.by, v.title, v.desc, v.level, regionOf[v.by],
                    JSON.stringify(v.styles), v.poster, 40 + i * 17,
                    new Date(base + i * 86400000).toISOString());

    (COMMENTS[i] || []).forEach((c, j) => {
      insertComment.run(`c_seed_${i}_${j}`, id, c.by, c.text,
                        new Date(base + i * 86400000 + j * 3600000).toISOString());
    });
  });

  return true;
}

/**
 * שני מאמני דמו שולחים בקשת חברות למשתמש חדש, כדי שיהיה מה לאשר.
 * זה קיים רק כדי שהזרימה תהיה ניתנת להדגמה מהרגע הראשון.
 */
export function greetNewUser(userId) {
  const insert = db.prepare(`
    INSERT INTO friend_requests (id, from_id, to_id, status, created_at)
    VALUES (?, ?, ?, 'pending', ?)`);

  ['c_shira', 'c_dan'].forEach((coachId, i) => {
    const exists = db.prepare('SELECT id FROM users WHERE id = ?').get(coachId);
    if (exists) {
      insert.run(newId('r'), coachId, userId,
                 new Date(Date.now() - (i + 1) * 3600000).toISOString());
    }
  });
}

export const DEMO_GREETINGS = {
  c_dan: 'היי! ראיתי שהוספתם אותי. תעלו סרטון של האוליי שלכם ואני אסתכל.',
  c_shira: 'נעים להכיר 🤙 אם יש שאלה על פארק או על ציוד — כתבו לי.',
  c_yossi: 'ברוכים הבאים. מה הטריק שהכי בא לכם לסגור החודש?',
  c_alex: 'היי! אם אתם מתחילים עם ריילים, תתחילו ממדרכה נמוכה. שאלו אותי מה שבא לכם.',
  c_noa: 'היי! שמחה שהתחברנו. מה הלוח שלכם?',
  c_ido: 'אהלן 🐺 שלחו לי סרטון ואני אגיד לכם מה לתקן.',
};
