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
      // כל הצורות שמזוהות כטריק הזה
      keys: [normalize(t.baseName), normalize(alias)].filter(Boolean),
    });
  }

  return [...byBase.values()];
})();

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
    SELECT name, verified_by, ai_verdict FROM bag WHERE user_id = ?`).all(userId);

  /** מזהה טריק -> איך הוא הוכח (הדרגה הגבוהה ביותר שנמצאה). */
  const landed = new Map();
  const unmatched = [];

  for (const row of rows) {
    const id = KEY_TO_ID.get(normalize(row.name));
    if (!id) {
      unmatched.push(row.name);
      continue;
    }

    const proof = row.verified_by ? 'coach' : row.ai_verdict === 'landed' ? 'ai' : 'self';
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
