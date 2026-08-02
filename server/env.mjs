/* ==========================================================================
   Env — טעינת server/.env אם קיים
   מיובא כשורה הראשונה ב-server.js, לפני כל מודול שקורא process.env,
   כדי שסדר טעינת ה-ESM יבטיח שהמפתח כבר יושב שם.
   משתנה שכבר קיים בסביבה (export רגיל) תמיד גובר על הקובץ.
   ========================================================================== */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const path = join(dirname(fileURLToPath(import.meta.url)), '.env');

try {
  const text = await readFile(path, 'utf8');
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
  // אין server/.env — זה תקין, פשוט לא הוגדר מפתח
}
