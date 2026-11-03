/* בדיקת עשן לקבצי הצד-לקוח.
   node --check מאתר רק שגיאות תחביר; כאן הקבצים באמת מורצים,
   כדי לתפוס שורות יתומות ומשתנים לא מוגדרים שנוצרים בעריכה. */
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

/* שני דפים, שני הקשרים: דף השופט נטען לבד ולא יחד עם האפליקציה, ושניהם
   מגדירים TRICK_LIST. בהקשר אחד זה נכשל על הגדרה כפולה שלא קורית בדפדפן. */
const PAGES = [
  ['js/store.js', 'js/media.js', 'js/ui.js', 'js/onboarding.js', 'js/app.js'],
  ['js/judge-tricks.js', 'js/judge.js', 'js/judge-ui.js'],
];

const noop = () => {};
const el = new Proxy(function () {}, {
  get: (t, k) => k === 'style' || k === 'dataset' || k === 'classList' ? el
    : k === 'children' || k === 'files' ? [] : el,
  set: () => true,
  apply: () => el,
});

const makeSandbox = () => {
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
  return sandbox;
};

let failed = false;
const contexts = [];
for (const files of PAGES) {
  const sandbox = makeSandbox();
  contexts.push(sandbox);
  for (const f of files) {
    try {
      vm.runInContext(await readFile(f, 'utf8'), sandbox, { filename: f });
      console.log(`  ✓ ${f}`);
    } catch (err) {
      failed = true;
      console.error(`  ✗ ${f} — ${err.message}`);
    }
  }
}
const sandbox = contexts[0];

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
