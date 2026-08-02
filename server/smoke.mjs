/* בדיקת עשן לקבצי הצד-לקוח.
   node --check מאתר רק שגיאות תחביר; כאן הקבצים באמת מורצים,
   כדי לתפוס שורות יתומות ומשתנים לא מוגדרים שנוצרים בעריכה. */
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const FILES = ['js/store.js', 'js/media.js', 'js/ui.js', 'js/onboarding.js', 'js/app.js'];

const noop = () => {};
const el = new Proxy(function () {}, {
  get: (t, k) => k === 'style' || k === 'dataset' || k === 'classList' ? el
    : k === 'children' || k === 'files' ? [] : el,
  set: () => true,
  apply: () => el,
});

const sandbox = {
  console, JSON, Math, Date, Promise, URL, Set, Map, Object, Array, String, Number, Boolean, RegExp,
  setTimeout: noop, clearTimeout: noop, fetch: () => new Promise(noop),
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  location: { origin: 'http://localhost:3000' },
  indexedDB: { open: () => el },
  document: { getElementById: () => el, querySelector: () => el, querySelectorAll: () => [],
              createElement: () => el, body: el },
  window: {}, navigator: {},
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

let failed = false;
for (const f of FILES) {
  try {
    vm.runInContext(await readFile(f, 'utf8'), sandbox, { filename: f });
    console.log(`  ✓ ${f}`);
  } catch (err) {
    failed = true;
    console.error(`  ✗ ${f} — ${err.message}`);
  }
}

// בדיקה שה-API שהמסכים משתמשים בו באמת קיים ב-Store
const used = (await readFile('js/app.js', 'utf8') + await readFile('js/onboarding.js', 'utf8'))
  .match(/Store\.(\w+)/g) || [];
// const בתוך vm לא נרשם על אובייקט ההקשר, אז קוראים אותו כביטוי באותו הקשר
const StoreApi = vm.runInContext('Store', sandbox);
const missing = [...new Set(used.map((u) => u.slice(6)))]
  .filter((name) => !(name in StoreApi));

if (missing.length) {
  failed = true;
  console.error('  ✗ המסכים קוראים ל-Store.' + missing.join(', Store.') + ' שלא קיים');
} else {
  console.log('  ✓ כל הקריאות ל-Store קיימות');
}

process.exit(failed ? 1 : 0);
