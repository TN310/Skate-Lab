/* בדיקות לשופט. הן לא נוגעות ברשת: fetch מוחלף בתשובה מוכנה, כי מה
   שנבדק כאן הוא ההיגיון של הפאנל — איך שני ציונים הופכים לאחד, מתי
   נקרא שופט שלישי, ומה יורד — ולא מה המודל חושב. */
import assert from 'node:assert/strict';
import test from 'node:test';

process.env.ANTHROPIC_API_KEY = 'test-key';

/** תור של תשובות; כל קריאה שולפת את הבאה בתור. */
let queue = [];
globalThis.fetch = async () => {
  const body = queue.shift();
  if (body === undefined) throw new Error('נקראו יותר שופטים מהצפוי');
  return { ok: true, json: async () => ({ content: [{ type: 'text', text: body }] }) };
};

const { judgeTrick, judgeFlow, slsTotal } = await import('./judge.js');

const reply = (trick, score, landed = true, rotation = 0) => JSON.stringify({
  trick, score, landed, rotation, grab: '', feet: 'על הברגים',
  frames: 'פריימים 4 עד 8', note: 'טיפ',
});
const M = { air: 0.45, height: 0.24, dist: 0.9, surface: 'flat', grind: 0, grindLen: 0 };

test('שני שופטים קרובים: הציון הוא הממוצע, ואין שופט שלישי', async () => {
  queue = [reply('אולי', 7.0), reply('אולי', 7.4)];
  const r = await judgeTrick(['x'], M);
  assert.equal(r.score, 7.2);
  assert.equal(r.judges.length, 2);
  assert.equal(r.dropped, null);
  assert.equal(r.trick, 'אולי');
  assert.equal(r.agreed, true);
  assert.equal(queue.length, 0);
});

test('פער גדול: נקרא שלישי, והגבוה והנמוך יורדים', async () => {
  queue = [reply('אולי', 4.0), reply('קיקפליפ', 8.0), reply('קיקפליפ', 6.5)];
  const r = await judgeTrick(['x'], M);
  assert.equal(r.score, 6.5);                    // האמצעי
  assert.deepEqual(r.dropped, [4.0, 8.0]);
  assert.equal(r.judges.length, 3);
  assert.equal(r.trick, 'קיקפליפ');              // רוב של שניים
  assert.equal(r.agreed, true);
});

test('בלי רוב על השם, הרוכב רואה שלא הייתה הסכמה', async () => {
  queue = [reply('אולי', 3.0), reply('קיקפליפ', 8.0), reply('שאב-איט', 6.0)];
  const r = await judgeTrick(['x'], M);
  assert.equal(r.agreed, false);
  assert.equal(r.score, 6.0);
  assert.equal(r.trick, 'שאב-איט');              // זה שציונו נבחר
});

test('נחיתה נקבעת ברוב ולא על ידי שופט בודד', async () => {
  queue = [reply('אולי', 7.0, false), reply('אולי', 7.2, true)];
  const r = await judgeTrick(['x'], M);
  assert.equal(r.landed, false);                 // 1 מתוך 2 אינו רוב
});

test('שם שונה עם ציונים קרובים: גם זה מזמין שופט שלישי', async () => {
  queue = [reply('אולי', 6.0), reply('קיקפליפ', 6.5), reply('קיקפליפ', 6.4)];
  const r = await judgeTrick(['x'], M);
  assert.equal(r.judges.length, 3);
  assert.equal(r.trick, 'קיקפליפ');
  assert.equal(r.agreed, true);
  assert.equal(r.score, 6.4);
  assert.equal(queue.length, 0);
});

test('אותו טריק בכתיב אחר הוא הסכמה, בלי שופט שלישי', async () => {
  queue = [reply('קיקפליפ', 7.0), reply('Kickflip', 7.4)];
  const r = await judgeTrick(['x'], M);
  assert.equal(r.judges.length, 2);
  assert.equal(r.agreed, true);
  assert.equal(queue.length, 0);
});

test('ציון כפול: רק מושב אחד מסומן כמושמט', async () => {
  queue = [reply('אולי', 5.0), reply('אולי', 8.0), reply('אולי', 5.0)];
  const r = await judgeTrick(['x'], M);
  assert.equal(r.score, 5.0);
  assert.equal(r.judges.filter((j) => j.out).length, 2);   // אחד מה-5 ו-8, לא שלושתם
  assert.equal(r.judges[1].out, true);
});

test('הפרטים נלקחים משופט שראה את הטריק שנבחר', async () => {
  queue = [reply('אולי', 6.0, true, 0), reply('פרונטסייד 180', 6.2, true, 180),
           reply('פרונטסייד 180', 6.1, true, 180)];
  const r = await judgeTrick(['x'], M);
  assert.equal(r.trick, 'פרונטסייד 180');
  assert.equal(r.rotation, 180);
});

test('ציון מחוץ לטווח נחתך, ולא מתפוצץ', async () => {
  // 10 מול 0 הוא גם הפער הגדול ביותר שיש, ולכן נקרא שופט שלישי
  queue = [reply('אולי', 99), reply('אולי', -5), reply('אולי', 6.0)];
  const r = await judgeTrick(['x'], M);
  assert.equal(r.judges[0].score, 10);
  assert.equal(r.judges[1].score, 0);
  assert.equal(r.score, 6.0);
  assert.deepEqual(r.dropped, [0, 10]);
});

test('תשובה בתוך גדר קוד עדיין נקראת', async () => {
  queue = ['```json\n' + reply('אולי', 7.0) + '\n```', 'בבקשה: ' + reply('אולי', 7.0)];
  const r = await judgeTrick(['x'], M);
  assert.equal(r.score, 7.0);
});

test('הסיבוב מגיע מהשופט ונעגל לחצאי סיבוב', async () => {
  queue = [reply('פרונטסייד 180', 7.0, true, 170), reply('פרונטסייד 180', 7.2, true, 180)];
  const r = await judgeTrick(['x'], M);
  assert.equal(r.rotation, 180);
});

test('Flow הוא ציון אחד בטווח', async () => {
  queue = [JSON.stringify({ flow: 12, note: 'רץ יפה' })];
  const r = await judgeFlow('x', { tricks: 3, duration: 20, landed: 2 });
  assert.equal(r.flow, 10);
});

test('הניקוד בנוי כמו ב-SLS: Flow + ארבעה הטובים + הגדול שבהם', () => {
  const s = slsTotal([6.5, 8.1, 7.0, 5.5, 4.0], 7.2);
  assert.equal(s.control, 27.1);                 // 8.1+7.0+6.5+5.5
  assert.equal(s.impact, 8.1);
  assert.equal(s.total, 42.4);
  assert.equal(s.counted, 4);
});

test('פחות מארבעה טריקים: Control סופר רק את מה שיש', () => {
  const s = slsTotal([9.0, 6.0], 5.0);
  assert.equal(s.control, 15);
  assert.equal(s.impact, 9);
  assert.equal(s.total, 29);
  assert.equal(s.counted, 2);
});
