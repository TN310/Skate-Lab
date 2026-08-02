/* ==========================================================================
   Env — טעינת server/.env אם קיים
   מיובא כשורה הראשונה ב-server.js, לפני כל מודול שקורא process.env.
   משתנה שכבר קיים בסביבה (למשל ב-Render) תמיד גובר על הקובץ.

   הקריאה סינכרונית בכוונה, וזה העיקר כאן: ב-ESM שני ייבואים אחים לא
   ממתינים זה לזה, אז מודול עם await בראש הקובץ עדיין תלוי באוויר בזמן
   שהמודול הבא כבר נטען. עם await כאן, כל מודול סינכרוני שקרא משתנה
   סביבה בזמן הטעינה קיבל undefined — וזה נכשל בשקט, בלי שגיאה: ה-AI
   פשוט לא נדלק, וקוד ההזמנה פשוט לא נאכף. readFileSync מסיים לפני
   שהייבוא הבא מתחיל, וכל המודולים רואים את הערכים.
   ========================================================================== */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const path = join(dirname(fileURLToPath(import.meta.url)), '.env');

try {
  const text = readFileSync(path, 'utf8');
  for (const line of text.split('\n')) {
    const clean = line.trim();
    if (!clean || clean.startsWith('#')) continue;

    const eq = clean.indexOf('=');
    if (eq === -1) continue;

    const key = clean.slice(0, eq).trim();
    const value = clean.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !(key in process.env)) process.env[key] = value;
  }
} catch {
  // אין server/.env — זה תקין, פשוט לא הוגדרו ערכים מקומיים
}
