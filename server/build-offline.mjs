/* בונה את דף השופט כקובץ HTML יחיד שעובד בלי שרת.
   הסקריפטים נכנסים לתוך הדף, styles.css מוחלף בבסיס מינימלי, והקישור
   חזרה לאפליקציה יורד — אין לאן לחזור. בלי שרת אין פאנל, אבל המדידה,
   הציון המקומי ובחירת שם הטריק עובדים במלואם.

   node server/build-offline.mjs [יעד]   (ברירת מחדל: ליד תיקיית skate-lab) */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(root, '..', 'שופט-הסקייט-אופליין.html'));

const BASE_CSS = `:root{color-scheme:dark;--bg:#111214}
body{margin:0;background:#111214;color:#ecebe7;font-family:"Heebo","Assistant",system-ui,Arial,sans-serif;font-size:16px;line-height:1.55}
h1{font-weight:800} a{color:#f5c518}
@media (prefers-color-scheme: light){:root{color-scheme:light;--bg:#f2f1ee}body{background:#f2f1ee;color:#17181b}}
`;

let html = await readFile(path.join(root, 'judge.html'), 'utf8');
const swap = (from, to) => {
  if (!html.includes(from)) throw new Error(`judge.html השתנה: לא נמצא ${from.slice(0, 50)}`);
  html = html.replace(from, () => to);
};

swap('<title>השופט — Skate Lab</title>', '<title>השופט — מצב לא מקוון</title>');
swap('  <link rel="stylesheet" href="styles.css">\n', '');
swap('<style>\n', `<style>\n${BASE_CSS}\n`);
swap('    <a href="/" class="jpill" style="text-decoration:none">→ חזרה</a>\n', '');

for (const src of ['js/judge-tricks.js', 'js/judge.js', 'js/judge-ui.js']) {
  // </script> בתוך קוד היה סוגר את התגית באמצע
  const code = (await readFile(path.join(root, src), 'utf8')).replace(/<\/script/gi, '<\\/script');
  swap(`<script src="${src}"></script>`, `<script>\n${code}\n</script>`);
}

await writeFile(out, html);
console.log(`נכתב ${out} (${Math.round(html.length / 1024)}KB)`);
