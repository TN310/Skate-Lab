/* ==========================================================================
   Achievements — הישג לכל טריק
   כל טריק בקטלוג הוא הישג בפני עצמו: קיקפליפ, אוליי, טרה פליפ.
   ההישג נפתח כשהטריק נכנס לתיק — כלומר עם סרטון שמוכיח אותו.

   התיק מקבל שם חופשי בכוונה (לאותו טריק יש כמה שמות), ולכן ההתאמה
   לקטלוג היא גמישה: "קיקפליפ", "kickflip", "Kick Flip" — כולם אותו הישג.
   טריק שלא מזוהה בקטלוג עדיין נשמר בתיק, הוא פשוט לא פותח הישג עם שם.
   ========================================================================== */

import { db } from './db.js';
import { TRICKS, DISCIPLINES } from './tricks.js';

/**
 * מנקה שם לצורך השוואה: אותיות קטנות, בלי רווחים, מקפים, גרשיים
 * וקידומות כיוון. ככה "פרונטסייד בורדסלייד" ו-"בורדסלייד" מזוהים כאותו טריק.
 */
function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[׳״'"`־\-–—_.,!?]/g, '')
    .replace(/\b(fs|bs)\b/g, '')
    .replace(/פרונטסייד|בקסייד|פרונט סייד|בק סייד/g, '')
    .replace(/\s+/g, '')
    .trim();
}

/** רשימת ההישגים: טריק אחד לכל baseId, בלי כפילות פרונטסייד/בקסייד. */
export const ACHIEVEMENTS = (() => {
  const byBase = new Map();

  for (const t of TRICKS) {
    if (byBase.has(t.baseId)) continue;
    const alias = t.alias.replace(/^(FS|BS)\s+/, '');

    byBase.set(t.baseId, {
      id: t.baseId,
      title: t.baseName,
      alias,
      desc: t.desc,
      discipline: t.discipline,
      level: t.level,
      // סדר הלימוד המומלץ מהקטלוג — הבסיס להצעת "הבא בתור"
      after: t.after,
      // כל הצורות שמזוהות כטריק הזה
      keys: [normalize(t.baseName), normalize(alias)].filter(Boolean),
    });
  }

  return [...byBase.values()];
})();

/** מיפוי מהיר: מזהה -> ההישג המלא, ומזהה -> שם תצוגה. */
const BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
const TITLE_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a.title]));

/** מיפוי מהיר: צורה מנורמלת -> מזהה הטריק. */
const KEY_TO_ID = (() => {
  const map = new Map();
  for (const a of ACHIEVEMENTS) {
    for (const k of a.keys) if (!map.has(k)) map.set(k, a.id);
  }
  return map;
})();

/**
 * מצב ההישגים של רוכב.
 * `unmatched` הם טריקים שבתיק שלא זוהו בקטלוג — הם נספרים בנפרד
 * כדי שלא ייעלמו בשקט, אבל אינם פותחים הישג עם שם.
 */
export async function achievementsFor(userId) {
  const rows = await db.prepare(`
    SELECT name, trick_id, verified_by, ai_verdict, ai_match FROM bag WHERE user_id = ?`)
    .all(userId);

  /** מזהה טריק -> איך הוא הוכח (הדרגה הגבוהה ביותר שנמצאה). */
  const landed = new Map();
  const unmatched = [];

  for (const row of rows) {
    // מזהה שנקבע מהצהרת הסרטון גובר על זיהוי מהשם החופשי
    const id = row.trick_id && BY_ID.has(row.trick_id)
      ? row.trick_id
      : KEY_TO_ID.get(normalize(row.name));
    if (!id) {
      unmatched.push(row.name);
      continue;
    }

    /*
     * ה-AI מעיד על הנחיתה בלבד, אף פעם לא על שם הטריק. לכן כשהוא ראה
     * סתירה בין הסרטון לשם, ההוכחה יורדת ל-'self' — ההישג עדיין נפתח,
     * כי אולי הרוכב צודק, אבל הוא לא נחשב מגובה.
     */
    const proof = row.verified_by ? 'coach'
      : row.ai_verdict === 'landed' && row.ai_match !== 'no' ? 'ai'
      : 'self';
    // אם אותו טריק נחת כמה פעמים, שומרים את ההוכחה החזקה ביותר
    const rank = { self: 0, ai: 1, coach: 2 };
    if (!landed.has(id) || rank[proof] > rank[landed.get(id)]) landed.set(id, proof);
  }

  const list = ACHIEVEMENTS.map((a) => ({
    ...a,
    keys: undefined,
    earned: landed.has(a.id),
    proof: landed.get(a.id) || null,
  }));

  const byDiscipline = Object.fromEntries(DISCIPLINES.map((d) => {
    const all = list.filter((a) => a.discipline === d.id);
    return [d.id, { done: all.filter((a) => a.earned).length, total: all.length }];
  }));

  return {
    list,
    disciplines: DISCIPLINES,
    byDiscipline,
    unmatched,
    done: landed.size,
    total: ACHIEVEMENTS.length,
    // כמה מהם אושרו על ידי מאמן — הדרגה שהכי שווה להתגאות בה
    verified: [...landed.values()].filter((p) => p === 'coach').length,
  };
}

/** מזהה הטריק בקטלוג לפי שם חופשי, או null אם לא זוהה. */
export const trickIdFor = (name) => KEY_TO_ID.get(normalize(name)) || null;

/** האם המזהה הוא טריק אמיתי בקטלוג (מזהה בסיס, כמו בהישגים). */
export const isTrickId = (id) => BY_ID.has(id);

/** שם התצוגה של טריק לפי מזהה. */
export const trickTitle = (id) => BY_ID.get(id)?.title || id;

/**
 * האם שני שמות הם אותו טריק.
 *
 * "קיקפליפ", "kickflip" ו-"Kick Flip" הם אותו הישג, ולכן הם גם אותה
 * שורה בתיק. השוואת טקסט בלבד הייתה מאפשרת להוסיף את אותו טריק
 * מאותו סרטון פעמיים, פשוט בכתיב אחר.
 *
 * שם שאינו בקטלוג מושווה כטקסט מנורמל — לפחות רווחים ורישיות לא יעבדו.
 */
export function sameTrick(a, b) {
  const idA = KEY_TO_ID.get(normalize(a));
  const idB = KEY_TO_ID.get(normalize(b));
  if (idA && idB) return idA === idB;
  return normalize(a) === normalize(b);
}

/* ==========================================================================
   הבא בתור
   ========================================================================== */

/** סדר הרמות כפי שהן מופיעות בקטלוג ובפרופיל. */
const LEVEL_ORDER = ['מתחיל', 'יודע קצת', 'בינוני', 'מתקדם', 'מקצוען'];

/**
 * מה כדאי ללמוד עכשיו.
 *
 * הקטלוג כבר נושא סדר לימוד מומלץ (`after`), אז אין כאן ניחוש —
 * הדירוג הוא לפי כמה טריקים חסרים עד לטריק הזה, כולל הוא עצמו.
 * "1" פירושו שהכול מוכן והוא הצעד הבא ממש.
 *
 * הספירה לא עוצרת על מה שמוכן, כי בתחילת העץ יש בדיוק טריק אחד בלי
 * דרישות — ורוכב חדש היה מקבל כרטיס בודד. שני הבאים אחריו מראים
 * לאן זה הולך, וזה כל ההבדל בין רשימה למסלול.
 *
 * לתיק ריק מוחזרים היסודות, וזה בדיוק העניין: משתמש ראשון, בלי חברים
 * ובלי פיד, עדיין מקבל מסלול להתקדם בו לבד.
 *
 * מי שהצהיר על רמה לא יראה טריקים שנמוכים ממנה בשתי דרגות, אלא אם
 * בלעדיהם אין מספיק הצעות. אף טריק לא נחסם — זו המלצה, לא שער.
 */
export async function nextTricksFor(userId, limit = 3) {
  const user = await db.prepare('SELECT level FROM users WHERE id = ?').get(userId);
  const rows = await db.prepare('SELECT name, trick_id FROM bag WHERE user_id = ?').all(userId);

  const done = new Set(rows
    .map((r) => (r.trick_id && BY_ID.has(r.trick_id) ? r.trick_id : KEY_TO_ID.get(normalize(r.name))))
    .filter(Boolean));

  /* כמה טריקים חסרים עד שהטריק הזה בהישג יד, כולל הוא עצמו.
     0 = כבר בתיק, 1 = הצעד הבא, 2 ומעלה = יש מה ללמוד לפניו. */
  const cache = new Map();
  const distance = (id) => {
    if (done.has(id)) return 0;
    if (cache.has(id)) return cache.get(id);

    // הקטלוג נבדק מפני מעגלים בטעינה, אבל ערך זמני שומר על הרקורסיה
    // סופית גם אם מישהו יוסיף תלות מעגלית בעתיד
    cache.set(id, Number.MAX_SAFE_INTEGER);
    const trick = BY_ID.get(id);
    const cost = 1 + (trick?.after || []).reduce((sum, need) => sum + distance(need), 0);
    cache.set(id, cost);
    return cost;
  };

  const open = ACHIEVEMENTS.filter((a) => !done.has(a.id));

  const userLevel = LEVEL_ORDER.indexOf(user?.level);
  const atLevel = userLevel > 0
    ? open.filter((a) => LEVEL_ORDER.indexOf(a.level) >= userLevel - 1)
    : open;

  // סדר הרשימה הוא סדר הקטלוג, שהוא סדר לימוד מסודר. sort יציב שומר עליו.
  return (atLevel.length >= limit ? atLevel : open)
    .toSorted((a, b) => distance(a.id) - distance(b.id)
                     || LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level))
    .slice(0, limit)
    .map((a) => ({
      id: a.id,
      title: a.title,
      alias: a.alias,
      desc: a.desc,
      level: a.level,
      // האייקון והשם של הדיסציפלינה נשלחים מוכנים, כדי שהכרטיס בפיד
      // לא יצטרך למשוך את כל טבלת ההישגים רק בשביל אימוג׳י
      icon: DISCIPLINES.find((d) => d.id === a.discipline)?.icon || '🛹',
      discipline: a.discipline,
      // על מה הוא נשען, בשמות — כדי שהכרטיס יסביר למה דווקא עכשיו
      after: a.after.map((id) => TITLE_BY_ID.get(id)).filter(Boolean),
    }));
}
