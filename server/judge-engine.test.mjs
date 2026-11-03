/* בדיקות למנוע המדידה של דף השופט (js/judge.js), על סרטונים סינתטיים.
   רקע עם מרקם, מצלמה שזזה כמו יד, ורוכב שקופץ פרבולה אמיתית — כך ידוע
   מראש כמה קפיצות היו ומה זמן האוויר, ואפשר לבדוק שהמנוע מוצא בדיוק
   אותן. שני הבאגים שנתפסו כאן: ניכוי המצלמה בסימן הפוך (רעד יד ייצר
   קפיצות שלא היו), וגריינד שלא זוהה בסלואו מושן. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../js/judge.js', import.meta.url), 'utf8');
const ctx = { Math, Number, Array, Uint8Array, Float32Array, Object, JSON, document: {} };
vm.createContext(ctx);
vm.runInContext(`${src};globalThis.J = { Judge, Analyse };`, ctx);
const { Judge, Analyse } = ctx.J;

const W = 192, H = 108, FPS = 30, BG = 600;

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// מרקם חלק בכמה קני מידה, כמו קיר או אספלט — לא רעש לבן ולא משבצות
const layer = (sc) => {
  const n = Math.ceil(BG / sc) + 2;
  const c = new Float32Array(n * n).map(() => rnd());
  return (x, y) => {
    const fx = x / sc, fy = y / sc, ix = Math.floor(fx), iy = Math.floor(fy), u = fx - ix, v = fy - iy;
    return c[iy * n + ix] * (1 - u) * (1 - v) + c[iy * n + ix + 1] * u * (1 - v)
         + c[(iy + 1) * n + ix] * (1 - u) * v + c[(iy + 1) * n + ix + 1] * u * v;
  };
};
const L = [layer(3), layer(9), layer(27)];
const bg = new Float32Array(BG * BG);
for (let y = 0; y < BG; y += 1) {
  for (let x = 0; x < BG; x += 1) bg[y * BG + x] = 40 + 60 * L[0](x, y) + 60 * L[1](x, y) + 40 * L[2](x, y);
}
/* רקע שני: מלבנים חדים, כמו קיר אריחים או רמפה. כאן כל שארית של
 * יישור מצלמה מדליקה קצוות, וזה מה שהפיל רן שצולם ביד. */
const sharp = new Float32Array(BG * BG).fill(90);
for (let i = 0; i < 900; i += 1) {
  const v = 40 + rnd() * 150, rw = 6 + rnd() * 40, rh = rw * (0.5 + rnd());
  const x0 = Math.floor(rnd() * BG), y0 = Math.floor(rnd() * BG);
  for (let y = y0; y < Math.min(BG, y0 + rh); y += 1) {
    for (let x = x0; x < Math.min(BG, x0 + rw); x += 1) sharp[y * BG + x] = v;
  }
}
// דגימת שטח 3x3 — כמו חיישן שמסכם אור על פיקסל, ולא דגימת נקודה עם כינוס
const atSharp = (x, y) => {
  let acc = 0;
  for (let sy = 0; sy < 3; sy += 1) {
    for (let sx = 0; sx < 3; sx += 1) acc += sharp[Math.floor(y + sy / 3) * BG + Math.floor(x + sx / 3)];
  }
  return acc / 9;
};

const at = (x, y) => {
  const ix = Math.floor(x), iy = Math.floor(y), u = x - ix, v = y - iy;
  return bg[iy * BG + ix] * (1 - u) * (1 - v) + bg[iy * BG + ix + 1] * u * (1 - v)
       + bg[(iy + 1) * BG + ix] * (1 - u) * v + bg[(iy + 1) * BG + ix + 1] * u * v;
};

/** סרטון: `slow` הוא פי כמה הואט, `rail` הוא קטע שבו הרוכב נישא בגובה קבוע. */
function clip({ pan = 0, shake = 0, jumps = [{ t: 2, air: 0.5 }], dur = 5, walk = 0.6,
                slow = 1, rail = null, edges = false } = {}) {
  const bgAt = edges ? atSharp : at;
  const frames = [];
  const bodyH = 40, pxPerM = bodyH / 1.6;
  for (let k = 0; k < dur * FPS; k += 1) {
    const tm = k / FPS, t = tm / slow;          // זמן מדיה מול זמן אמיתי
    const cx = 200 + pan * tm + shake * Math.sin(tm * 9);
    const cy = 200 + shake * Math.cos(tm * 7);
    const g = new Uint8Array(W * H);
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) g[y * W + x] = bgAt(cx + x, cy + y) + (rnd() - 0.5) * 6;
    }
    let lift = 0;
    for (const j of jumps) {
      if (t > j.t && t < j.t + j.air) { const s = t - j.t; lift = 0.5 * 9.81 * s * (j.air - s); }
    }
    if (rail) {
      const { t0, len, hgt } = rail, up = 0.12;
      if (t > t0 && t < t0 + up) lift = hgt * (t - t0) / up;
      else if (t >= t0 + up && t <= t0 + up + len) lift = hgt;
      else if (t > t0 + up + len && t < t0 + 2 * up + len) lift = hgt * (1 - (t - t0 - up - len) / up);
    }
    const rx = 220 + walk * 40 * t, ry = 280 - lift * pxPerM;
    for (let y = Math.round(ry - bodyH); y < ry; y += 1) {
      for (let x = Math.round(rx); x < rx + 14; x += 1) {
        const ix = Math.round(x - cx), iy = Math.round(y - cy);
        if (ix >= 0 && ix < W && iy >= 0 && iy < H) g[iy * W + ix] = 250 - ((x + y) % 5) * 10;
      }
    }
    frames.push({ t: tm, g });
  }
  return { frames, w: W, h: H };
}

const run = (opt = {}) => {
  Judge.setRider('', opt.slow || 1);
  return Analyse.findTricks(Judge.track(clip(opt)));
};

test('מצלמה יציבה: קפיצה אחת, זמן אוויר נכון', () => {
  const r = run();
  assert.equal(r.tricks.length, 1);
  assert.ok(Math.abs(r.tricks[0].air - 0.5) < 0.08, `air ${r.tricks[0].air}`);
});

test('רעד יד לא מייצר קפיצות שלא היו', () => {
  for (const shake of [3, 5]) {
    const r = run({ shake });
    assert.equal(r.tricks.length, 1, `shake ${shake}: ${r.tricks.length} קפיצות`);
    assert.ok(Math.abs(r.tricks[0].t0 - 2) < 0.15);
  }
});

test('רעד יד מול רקע עם קצוות חדים', () => {
  const r = run({ shake: 1.5, edges: true, jumps: [{ t: 1.2, air: 0.5 }, { t: 3.2, air: 0.45 }] });
  assert.equal(r.tooShaky, false);
  assert.equal(r.tricks.length, 2, r.tricks.map((t) => t.t0.toFixed(2)).join(' ') || r.why);
});

test('פאן אחרי הרוכב ועוד רעד', () => {
  const r = run({ pan: 20, shake: 2.5 });
  assert.equal(r.tricks.length, 1);
});

test('שתי קפיצות נפרדות', () => {
  const r = run({ jumps: [{ t: 1.2, air: 0.45 }, { t: 3.3, air: 0.55 }] });
  assert.equal(r.tricks.length, 2);
});

test('מעקה מזוהה כמעקה', () => {
  const r = run({ jumps: [], rail: { t0: 1.5, len: 0.9, hgt: 0.5 } });
  assert.equal(r.tricks.length, 1);
  assert.equal(r.tricks[0].surface, 'rail');
});

test('סלואו מושן ×4: הזמנים מומרים לשניות אמיתיות', () => {
  const r = run({ slow: 4, dur: 8, jumps: [{ t: 0.8, air: 0.5 }] });
  assert.equal(r.tricks.length, 1);
  assert.ok(Math.abs(r.tricks[0].air - 0.5) < 0.1, `air ${r.tricks[0].air}`);
});

test('סלואו מושן ×4: מעקה עדיין מעקה', () => {
  const r = run({ slow: 4, dur: 12, walk: 0.4, jumps: [], rail: { t0: 0.8, len: 0.9, hgt: 0.5 } });
  assert.equal(r.tricks.length, 1);
  assert.equal(r.tricks[0].surface, 'rail');
});
