/* ==========================================================================
   Judge — מנוע המדידה של דף השופט

   חלוקת העבודה בין הדפדפן לשרת, ולמה דווקא ככה:

   הדפדפן מודד, השרת שופט. זמן אוויר, גובה, מרחק וסיבוב הם פיזיקה —
   הם נמדדים מהפיקסלים ויוצאים אותו דבר בכל פעם, ואין שום סיבה לשלם
   על מודל שינחש אותם. מה שהמודל כן צריך לעשות זה לזהות *איזה* טריק
   ולתת ציון, וזה מה שנשלח אליו: פריימים חתוכים ומספרים מוכנים.

   המדידה עובדת על הפרש בין פריימים עוקבים, בלי שום ספרייה חיצונית.
   מה שזז בין שני פריימים הוא הרוכב, והתיבה שחוסמת אותו היא העקומה
   שאנחנו עוקבים אחריה. תנועת מצלמה (הליכה, רעד, פאן) מנוכה לפני
   ההשוואה; זום תוך כדי צילום לא, וזאת המגבלה האמיתית של השיטה. הדף
   אומר אותה למשתמש במקום להחזיר מספר שגוי.

   הסרגל הוא גובה הרוכב, והוא רשות: בלעדיו אין מטרים מהפיקסלים, אבל
   זמן האוויר והגובה שנגזר ממנו עובדים במלואם.
   ========================================================================== */

const Judge = (() => {
  'use strict';

  const CW = 192;            // רוחב העבודה של המדידה; גבוה מזה רק מאט
  const MOTION_TH = 20;      // הפרש בהירות שנחשב תנועה ולא רעש חיישן

  let personH = null;        // מטרים, או null כשלא נמסר סרגל
  let slowmo = 1;            // פי כמה הסרטון הואט בצילום
  let capDt = 1 / 30;        // משך פריים בקובץ, נמדד בפועל

  /*
   * הגובה הוא רשות ולא חובה.
   *
   * הוא משמש רק להמרת פיקסלים למטרים, ואין בלעדיו שום פגיעה בשיפוט:
   * זמן האוויר נמדד בשניות בלי שום סרגל, וגובה הקפיצה נגזר ממנו דרך
   * h=g·t²/8. גם ב-SLS אף אחד לא מודד סנטימטרים — השופטים מסתכלים
   * ונותנים ציון. מי שכן ממלא מקבל בנוסף מרחק במטרים ומדידת גובה
   * שנייה, בלתי תלויה, שמוצגת לצד הראשונה.
   */
  const setRider = (heightCm, slowFactor) => {
    const cm = Number(heightCm);
    personH = (cm >= 80 && cm <= 220) ? cm / 100 : null;
    slowmo = Number(slowFactor) || 1;
  };

  /* ---------- קריאת הפריימים ---------- */

  /*
   * ניגון במקום דילוגים. seek לכל פריים בנפרד לוקח עשרות אלפיות שנייה
   * לפריים ומצטבר לחצי דקה על קליפ קצר; ניגון עם requestVideoFrameCallback
   * נותן את אותם פריימים בזמן אמת, עם חותמת זמן מדויקת של המדיה עצמה.
   */
  function capture(video, onProgress, hintDur) {
    const h = Math.max(8, Math.round(CW * video.videoHeight / Math.max(1, video.videoWidth)));
    const c = document.createElement('canvas');
    c.width = CW; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });

    const grab = () => {
      ctx.drawImage(video, 0, 0, CW, h);
      const d = ctx.getImageData(0, 0, CW, h).data;
      const g = new Uint8Array(CW * h);
      for (let i = 0, j = 0; i < d.length; i += 4, j += 1) {
        g[j] = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
      }
      return g;
    };

    const frames = [];
    /*
     * סרטון שהוקלט בדפדפן מדווח duration אינסופי עד שמדלגים בו — זה
     * ידוע ב-MediaRecorder, ונמדד כאן: webm שהוקלט החזיר Infinity.
     * לכן התקרה היא זמן, לא אורך הקובץ, והאורך האמיתי נגזר בסוף
     * מחותמת הזמן של הפריים האחרון.
     */
    const maxT = Number.isFinite(video.duration) ? Math.min(video.duration, 70) : 70;
    // רק לפס ההתקדמות: בלי זה רן של 30 שניות נעצר על 43%
    const shown = Number.isFinite(video.duration) ? maxT : Math.min(70, hintDur || 70);

    return new Promise((resolve) => {
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        try { video.pause(); } catch { /* הדפדפן כבר עצר */ }
        const dts = [];
        for (let i = 1; i < frames.length; i += 1) dts.push(frames[i].t - frames[i - 1].t);
        capDt = median(dts) || 1 / 30;
        const last = frames.length ? frames[frames.length - 1].t : 0;
        resolve({ frames, w: CW, h, duration: last });
      };

      if (typeof video.requestVideoFrameCallback !== 'function') {
        return seekCapture(video, grab, frames, maxT, onProgress, done, shown);
      }

      const step = (now, meta) => {
        frames.push({ t: meta.mediaTime, g: grab() });
        onProgress?.(meta.mediaTime / shown);
        if (meta.mediaTime >= maxT - 0.02 || video.ended) return done();
        video.requestVideoFrameCallback(step);
      };

      video.onended = done;
      video.currentTime = 0;
      video.play()
        .then(() => video.requestVideoFrameCallback(step))
        .catch(() => seekCapture(video, grab, frames, maxT, onProgress, done, shown));
    });
  }

  /** נפילה אחורה לדפדפן בלי requestVideoFrameCallback. */
  function seekCapture(video, grab, frames, maxT, onProgress, done, shown) {
    let t = 0;
    const next = () => {
      if (t > maxT) return done();
      video.onseeked = () => {
        // מעבר לסוף הקובץ הדפדפן נשאר על הפריים האחרון — אין טעם להמשיך
        const last = frames[frames.length - 1];
        if (last && video.currentTime <= last.t + 1e-4) return done();
        frames.push({ t: video.currentTime, g: grab() });
        onProgress?.(t / shown);
        t += 1 / 30;
        next();
      };
      video.currentTime = t;
    };
    next();
  }

  /* ---------- מעקב אחרי הרוכב ---------- */

  /*
   * ביטול תנועת המצלמה.
   *
   * השיטה כולה נשענת על "מה שזז בין שני פריימים הוא הרוכב", ומצלמה
   * שזזה הורסת בדיוק את ההנחה הזאת: כשכל הפריים נע, כל הפריים נראה
   * כמו רוכב. לכן לפני כל השוואה מחפשים את ההזזה שהכי מיישרת את שני
   * הפריימים, ומשווים לפריים הקודם *אחרי* שהוזז.
   *
   * החיפוש מסתכל רק על מסגרת השוליים של התמונה, כי שם הרקע ולא
   * הרוכב: אם היינו מודדים על כל הפריים, התנועה של הרוכב עצמו הייתה
   * נמשכת פנימה לתוך ההערכה והמצלמה "הייתה רודפת" אחריו.
   *
   * מה שזה פותר: הליכה, רעד יד, פאן אחרי הרוכב. מה שזה לא פותר: זום
   * תוך כדי וסיבוב של המצלמה, כי שניהם אינם הזזה.
   *
   * המוסכמה: ההזזה (dx,dy) היא כזו ש-a[x+dx] ≈ b[x], כלומר התוכן זז
   * ב-+dx בין הפריימים. המצלמה עצמה זזה בכיוון ההפוך.
   */
  const SEARCH = 7;           // פיקסלים לכל כיוון, ברזולוציית העבודה
  const EDGE_K = 0.5;         // קיזוז ההפרש לפי עוצמת הקצה; ראו ב-track

  function cameraShift(a, b, w, h) {
    const band = Math.max(3, Math.round(h * 0.22));
    const inBorder = (x, y) => y < band || y >= h - band
                            || x < band || x >= w - band;

    const cost = (dx, dy) => {
      let sum = 0, n = 0;
      for (let y = SEARCH; y < h - SEARCH; y += 2) {
        for (let x = SEARCH; x < w - SEARCH; x += 2) {
          if (!inBorder(x, y)) continue;
          let d = a[(y + dy) * w + (x + dx)] - b[y * w + x];
          if (d < 0) d = -d;
          sum += d; n += 1;
        }
      }
      return n ? sum / n : Infinity;
    };

    /*
     * אם המצלמה לא זזה, אין מה לחפש — ובעיקר אסור למצוא.
     *
     * זה לא זהירות יתר אלא באג שנתפס בבדיקה: בסרטון ממצלמה יציבה עם
     * רקע חלק, כל ההזזות עולות בערך אותו דבר, והמנצחת היא זו שבמקרה
     * מיישרת את הרוכב. המצלמה "רדפה" אחריו, המדידות קפצו, ומקליפ עם
     * קפיצה אחת יצאו ארבע. לכן הזזה מתקבלת רק כשהיא משפרת את ההתאמה
     * בשליש לפחות, ורק כשיש בשוליים מספיק מרקם כדי שההשוואה תהיה
     * בעלת משמעות.
     */
    const still = cost(0, 0);
    if (still < 2.0) return { dx: 0, dy: 0, fx: 0, fy: 0, c: still };

    let best = { dx: 0, dy: 0, c: still };
    for (let dy = -SEARCH + 1; dy <= SEARCH - 1; dy += 3) {
      for (let dx = -SEARCH + 1; dx <= SEARCH - 1; dx += 3) {
        const c = cost(dx, dy);
        if (c < best.c) best = { dx, dy, c };
      }
    }
    const c0 = { ...best };
    for (let dy = c0.dy - 2; dy <= c0.dy + 2; dy += 1) {
      for (let dx = c0.dx - 2; dx <= c0.dx + 2; dx += 1) {
        if (Math.abs(dx) >= SEARCH || Math.abs(dy) >= SEARCH) continue;
        const c = cost(dx, dy);
        if (c < best.c) best = { dx, dy, c };
      }
    }
    const pick = best.c < still * 0.67 ? best : { dx: 0, dy: 0, c: still };

    /*
     * תת-פיקסל. בלי זה הפיצוי כמעט חסר תועלת ביד רועדת: מצלמה שזזה
     * חצי פיקסל בפריים לא מוזזת בכלל על ידי חיפוש בשלמים, והשארית
     * מצטברת ונראית בדיוק כמו תנועה של הרוכב. שלוש נקודות על עקומת
     * המחיר מגדירות פרבולה, והקודקוד שלה הוא ההזזה האמיתית.
     */
    const sub = (axis) => {
      const at = (d) => (axis === 'x' ? cost(pick.dx + d, pick.dy)
                                      : cost(pick.dx, pick.dy + d));
      const c1 = at(-1), c2 = pick.c, c3 = at(1);
      const den = c1 - 2 * c2 + c3;
      if (!(den > 0)) return 0;
      return Math.max(-0.5, Math.min(0.5, (c1 - c3) / (2 * den)));
    };

    return { dx: pick.dx, dy: pick.dy, fx: sub('x'), fy: sub('y'), c: pick.c };
  }

  /**
   * לכל זוג פריימים: איפה הרוכב, בקואורדינטות של העולם.
   *
   * שלושה שלבים, וכל אחד מהם נולד מכישלון אמיתי בבדיקה:
   * 1. ביטול תזוזת המצלמה, כדי שפאן לא ייראה כמו קפיצה.
   * 2. סף תנועה שמתכוונן לפי הרעש בפריים עצמו. מצלמה ביד ודחיסת
   *    וידאו מרעידות את כל הפיקסלים קצת; סף קבוע סופר את הרעש הזה
   *    כתנועה. הסף נגזר מהחציון של ההפרשים, שהוא הרעש עצמו.
   * 3. חלון סביב הצפיפות הגדולה ביותר. הרוכב הוא גוש אחד צפוף, ואילו
   *    רעש מצלמה פרוש על כל הפריים. בלי השלב הזה גם אדם שעובר ברקע
   *    נכנס לתוך המדידה.
   */
  function track(cap) {
    const { frames: f, w, h } = cap;
    const out = [];
    let camX = 0, camY = 0, moved = 0, loose = 0;

    const diffs = new Uint8Array(w * h);

    for (let k = 1; k < f.length; k += 1) {
      const a = f[k].g, b = f[k - 1].g;
      const sh = cameraShift(a, b, w, h);
      /*
       * ההפרשים למטה ממופים לקואורדינטות של הפריים *הקודם*, ולכן ההמרה
       * לעולם משתמשת בהזזה המצטברת עד אליו, ובסימן מינוס: נקודה קבועה
       * בעולם נראית ב-x = X + C, אז X = x − C.
       *
       * כאן היה באג: ההזזה נוספה במקום להיות מופחתת, וזה *הכפיל* את
       * תנועת המצלמה במקום לבטל אותה. בסימולציה עם רעד של 3 פיקסלים
       * יצאו חמש קפיצות שלא היו, והקפיצה האמיתית לא זוהתה.
       */
      const pX = camX, pY = camY;
      camX += sh.dx + (sh.fx || 0); camY += sh.dy + (sh.fy || 0);
      if (sh.dx || sh.dy || Math.abs(sh.fx || 0) > 0.15 || Math.abs(sh.fy || 0) > 0.15) moved += 1;

      /*
       * שלב 2: ההפרשים עצמם, ומהם הסף.
       *
       * הפריים מוזז בתת-פיקסל (דגימה בילינארית), לא רק בשלמים. בסצנה
       * עם קצוות חדים — קיר, אריחים, רמפה — חצי פיקסל שנשאר הדליק כל
       * קצה בפריים כ"תנועה", הרוכב טבע ברעש, ורן שצולם ביד סומן כולו
       * "המצלמה זזה יותר מדי". ההזזה החלקית כבר חושבה; היא פשוט לא
       * הופעלה כאן.
       */
      const fx = sh.fx || 0, fy = sh.fy || 0;
      const ox = sh.dx + Math.floor(fx), oy = sh.dy + Math.floor(fy);
      const u = fx - Math.floor(fx), v = fy - Math.floor(fy);
      const w00 = (1 - u) * (1 - v), w10 = u * (1 - v), w01 = (1 - u) * v, w11 = u * v;
      /*
       * וגם אחרי זה נשאר יישור לא מושלם, בסדר גודל של עשירית פיקסל. על
       * קצה בניגודיות גבוהה זה מספיק כדי לעבור את הסף, והרקע "זז" כמו
       * הרוכב. לכן כל הפרש מקוזז בעוצמת הקצה במקום: הזזה של ε פיקסלים
       * על קצה בשיפוע g נותנת הפרש של בערך ε·g, אז קיזוז של EDGE_K·g
       * משאיר רק תזוזה של יותר מחצי פיקסל — והרוכב זז כמה פיקסלים.
       */
      let sum = 0, cnt = 0;
      for (let y = SEARCH; y < h - SEARCH; y += 1) {
        for (let x = SEARCH; x < w - SEARCH; x += 1) {
          const i = (y + oy) * w + (x + ox), j = y * w + x;
          let d = (a[i] * w00 + a[i + 1] * w10 + a[i + w] * w01 + a[i + w + 1] * w11) - b[j];
          if (d < 0) d = -d;
          let gx = b[j + 1] - b[j - 1], gy = b[j + w] - b[j - w];
          if (gx < 0) gx = -gx;
          if (gy < 0) gy = -gy;
          d -= EDGE_K * (gx + gy) / 2;
          if (d < 0) d = 0;
          diffs[j] = d;
          sum += d; cnt += 1;
        }
      }
      const mean = cnt ? sum / cnt : 0;
      const TH = Math.max(MOTION_TH, mean * 3);

      // שלב 3: עמודות, ומהן החלון הצפוף ביותר
      const colS = new Float32Array(w);
      let total = 0;
      for (let y = SEARCH; y < h - SEARCH; y += 1) {
        for (let x = SEARCH; x < w - SEARCH; x += 1) {
          if (diffs[y * w + x] > TH) { colS[x] += 1; total += 1; }
        }
      }
      if (total < w * h * 0.002) { out.push(null); continue; }

      const win = Math.max(14, Math.round(w * 0.22));
      let run = 0, bestSum = -1, bestX = 0;
      for (let x = 0; x < w; x += 1) {
        run += colS[x];
        if (x >= win) run -= colS[x - win];
        if (x >= win - 1 && run > bestSum) { bestSum = run; bestX = x - win + 1; }
      }
      const x0w = Math.max(SEARCH, bestX), x1w = Math.min(w - SEARCH, bestX + win);

      const colIn = new Float32Array(w), rowIn = new Float32Array(h);
      let mass = 0, sx = 0, sy = 0;
      for (let y = SEARCH; y < h - SEARCH; y += 1) {
        for (let x = x0w; x < x1w; x += 1) {
          if (diffs[y * w + x] > TH) {
            colIn[x] += 1; rowIn[y] += 1; mass += 1; sx += x; sy += y;
          }
        }
      }
      if (mass < 30) { out.push(null); continue; }

      /*
       * רשת ביטחון: הרוכב הוא גוש אחד, אז רוב התנועה חייבת להיות בתוך
       * החלון שנמצא. כשרק חלק קטן ממנה שם, מה שזז הוא הרקע כולו —
       * מצלמה שזזה יותר מדי, או זום. במצב כזה עדיף להודות שאי אפשר
       * למדוד מאשר להחזיר קפיצה של מטר וחצי שלא הייתה.
       */
      if (mass < total * 0.5) { out.push(null); loose += 1; continue; }

      out.push({
        t: (f[k].t + f[k - 1].t) / 2,
        cx: sx / mass - pX, cy: sy / mass - pY, mass,
        x0: pct(colIn, mass, 0.04) - pX, x1: pct(colIn, mass, 0.96) - pX,
        y0: pct(rowIn, mass, 0.04) - pY, y1: pct(rowIn, mass, 0.96) - pY,
        camX: pX, camY: pY,
        /* הגוף נחתך בצד או למעלה. בתחתית לא בודקים — רגליים על קצה
         * הפריים זה צילום טלפון רגיל, ושיא הקפיצה נמצא למעלה. */
        cut: pct(colIn, mass, 0.04) <= SEARCH + 1 || pct(colIn, mass, 0.96) >= w - SEARCH - 2
          || pct(rowIn, mass, 0.04) <= SEARCH + 1,
      });
    }

    out.cameraMoved = moved > f.length * 0.2;
    out.tooShaky = loose > f.length * 0.35;
    return out;
  }

  const pct = (arr, total, p) => {
    const want = total * p;
    let acc = 0;
    for (let i = 0; i < arr.length; i += 1) { acc += arr[i]; if (acc >= want) return i; }
    return arr.length - 1;
  };

  const pctl = (a, p) => {
    if (!a.length) return 0;
    const s = a.slice().sort((x, y) => x - y);
    return s[Math.max(0, Math.min(s.length - 1, Math.floor(s.length * p)))];
  };
  const median = (a) => pctl(a, 0.5);

  const smooth = (a, n) => a.map((_, i) => {
    let s = 0, c = 0;
    for (let j = i - n; j <= i + n; j += 1) {
      if (j >= 0 && j < a.length && a[j] != null) { s += a[j]; c += 1; }
    }
    return c ? s / c : null;
  });

  return { setRider, capture, track, pct, pctl, median, smooth,
           get capDt() { return capDt; },
           get personH() { return personH; },
           get slowmo() { return slowmo; } };
})();

/* ==========================================================================
   Analyse — מקפיצות לטריקים

   השאלה היחידה כאן: מתי הרוכב היה באוויר. כל השאר נגזר מזה.
   ========================================================================== */

const Analyse = (() => {
  'use strict';

  /**
   * קו הקרקע הוא האחוזון הנמוך של חלון רחב, ולא החציון שלו.
   *
   * עם חציון, גריינד ארוך מושך את הבסיס למעלה יחד איתו ואז "העלייה"
   * מתאפסת והמכשול נעלם מהמדידה. הרוכב נמצא נמוך רוב הזמן, ולכן
   * האחוזון ה-30 של חלון רחב הוא הקרקע גם כשיש עליו קטע ארוך גבוה.
   */
  function groundLine(up, t) {
    const W = 1.6 * Judge.slowmo;
    // t ממוין, אז החלון הוא שני מצביעים ולא סריקה של כל הרן לכל נקודה
    let lo = 0, hi = 0;
    return up.map((_, i) => {
      while (t[lo] <= t[i] - W) lo += 1;
      while (hi < t.length && t[hi] < t[i] + W) hi += 1;
      return Judge.pctl(up.slice(lo, hi), 0.3);
    });
  }

  function findTricks(tr) {
    const cameraMoved = !!tr.cameraMoved;
    const tooShaky = !!tr.tooShaky;
    const pts = tr.filter(Boolean);
    if (tooShaky) {
      return { tricks: [], cameraMoved, tooShaky,
               why: 'המצלמה זזה יותר מדי מכדי להפריד בין הרוכב לרקע. '
                  + 'אפשר ללכת ולרעוד, אבל לא לעשות זום תוך כדי ולא להסתובב מהר' };
    }
    if (pts.length < 8) return { tricks: [], why: 'כמעט ולא זוהתה תנועה בסרטון' };

    const bodyH = Judge.median(pts.map((p) => p.y1 - p.y0));
    const bodyW = Judge.median(pts.map((p) => p.x1 - p.x0));
    if (bodyH < 6) return { tricks: [], why: 'הרוכב קטן מדי בפריים. כדאי לצלם קרוב יותר' };

    /*
     * כל המדידות נעשות ביחידות של גובה-גוף, והמרה למטרים קורית רק אם
     * נמסר סרגל. כך אותו קוד עובד בשני המצבים, ושום סף לא תלוי במטרים.
     */
    const pxPerM = Judge.personH ? bodyH / Judge.personH : null;
    const toM = (px) => (pxPerM ? px / pxPerM : null);

    /*
     * זווית הצילום, לפי כמה הרוכב חוצה את הפריים לרוחבו.
     * מהצד הוא עובר כמה גופים לרוחב; מלפנים או מאחור הוא כמעט לא זז
     * אופקית, ואז "מרחק" הוא מספר חסר משמעות ולא מוצג בכלל.
     */
    const xs = pts.map((p) => (p.x0 + p.x1) / 2);
    const travel = (Math.max(...xs) - Math.min(...xs)) / bodyH;
    const view = travel > 1.2 ? 'side' : 'front';
    const t = pts.map((p) => p.t);

    /*
     * הגובה נמדד ממרכז התיבה החוסמת ולא ממרכז המסה של הפיקסלים שזזו.
     *
     * זה לא פרט טכני אלא תיקון של באג שנמצא בבדיקה בדפדפן: הפרש בין
     * פריימים מסמן גם את המקום שהרוכב עזב וגם את זה שאליו הגיע, ובזמן
     * המראה ונחיתה השובל שנשאר ליד הקרקע מוסיף מסה נמוכה שמושכת את
     * מרכז המסה למטה — דווקא בשני הרגעים שמגדירים את הקפיצה. במדידה
     * אמיתית מרכז המסה *ירד* ב-6 פיקסלים ברגע הפופ, והקפיצה יצאה
     * 0.18 שניות במקום 0.45. קצוות התיבה נקיים מזה ועלו יפה.
     */
    const up = Judge.smooth(pts.map((p) => -(p.y0 + p.y1) / 2), 1);   // ציר המסך הפוך
    const base = groundLine(up, t);
    const rise = up.map((v, i) => v - base[i]);

    const thr = Math.max(1.0, bodyH * 0.04);
    const runs = [];
    let cur = null;
    rise.forEach((v, i) => {
      if (v > thr) { if (!cur) cur = { a: i, b: i }; else cur.b = i; }
      else if (cur) { runs.push(cur); cur = null; }
    });
    if (cur) runs.push(cur);

    const tricks = [];
    let why = '';

    runs.forEach((r) => {
      let peak = 0;
      for (let i = r.a; i <= r.b; i += 1) if (rise[i] > peak) peak = rise[i];
      /*
       * תקרת רעש: 8% מגובה הגוף, כ-13 ס"מ לרוכב של 1.60. היה 4%, וזה
       * שני פיקסלים — בדיוק גודל הרעש של מצלמה ביד. בסימולציה כמעט כל
       * הקפיצות המדומות עלו פחות מ-7%, וכל האמיתיות יותר מ-12%. הופ
       * קטן מזה פשוט לא נבדל מרעש ברזולוציה הזאת.
       */
      if (peak < Math.max(1.2, bodyH * 0.08)) {
        why = why || 'התנועה שזוהתה נמוכה מכדי להיחשב קפיצה';
        return;
      }

      /* החלון נחתך בסף שנמצא מעל הקרקע, אז קודם פותחים אותו חזרה עד
       * 12% מהשיא. אי-שוויון רופף בכוונה: הגובה נמדד בפיקסלים שלמים,
       * ושני פריימים עם אותו ערך עצרו את הפתיחה באמצע. */
      let a = r.a, b = r.b;
      const edge = peak * 0.12;
      while (a > 0 && rise[a - 1] > edge && rise[a - 1] <= rise[a]) a -= 1;
      while (b < rise.length - 1 && rise[b + 1] > edge && rise[b + 1] <= rise[b]) b += 1;

      const span = t[b] - t[a];

      // גוף שנחתך בקצה הפריים מזיז את התיבה בלי שהרוכב זז
      let cutN = 0;
      for (let i = a; i <= b; i += 1) if (pts[i].cut) cutN += 1;
      if (cutN > (b - a + 1) * 0.25) {
        why = why || 'הרוכב יצא מהפריים באמצע הקפיצה. כל הגוף צריך להיות בפריים';
        return;
      }

      const hPix = toM(peak);                        // null בלי סרגל
      const mid = (p) => (p.x0 + p.x1) / 2;          // מאותה סיבה כמו הגובה
      const distPx = Math.abs(mid(pts[b]) - mid(pts[a]));
      const dist = view === 'side' ? toM(distPx) : null;

      /*
       * אין כאן הערכת סיבוב, בכוונה.
       *
       * הייתה כזאת: ספירה של כמה פעמים הגוף נראה צר, כלומר פונה אל
       * המצלמה. בבדיקה על קליפ עם חצי סיבוב מובהק היא החזירה אפס, ועל
       * גריינד ישר לגמרי היא החזירה 360. הסיבה פשוטה ולא ניתנת לתיקון
       * בשיטה הזאת: הלוח רחב מהגוף, ולכן רוחב התיבה הוא רוחב הלוח —
       * הגוף יכול להסתובב לגמרי בלי שהמספר יזוז.
       *
       * מספר שנראה כמו מדידה אבל אינו מדידה גרוע ממספר חסר, במיוחד
       * כשהוא נכנס לציון. הסיבוב נקבע היום על ידי השופטים, שרואים את
       * הפריימים ואת הלוח שבתוכם.
       */
      /* מכשול: קטע ארוך שבו הגובה כמעט לא משתנה והגוף ממשיך הצידה */
      let grind = 0, grindLen = 0, g0 = -1;
      for (let i = a; i <= b; i += 1) {
        const flat = Math.abs(rise[i] - peak) < Math.max(0.8, bodyH * 0.04);
        if (flat) { if (g0 < 0) g0 = i; }
        else if (g0 >= 0) {
          if (t[i - 1] - t[g0] > grind) {
            grind = t[i - 1] - t[g0];
            grindLen = Math.abs(mid(pts[i - 1]) - mid(pts[g0])) / bodyH;   // גופים
          }
          g0 = -1;
        }
      }
      if (g0 >= 0 && t[b] - t[g0] > grind) {
        grind = t[b] - t[g0];
        grindLen = Math.abs(mid(pts[b]) - mid(pts[g0])) / bodyH;         // גופים
      }
      // היחס נבדק בזמן המדיה, לפני ההמרה לשניות אמיתיות. אחרת בסלואו
      // מושן ×4 הגריינד חולק בארבע ו-span לא, ושום מעקה לא זוהה.
      const longFlat = grind > span * 0.45;
      grind /= Judge.slowmo;

      const surface = (grind > 0.3 && grindLen > 0.25 && longFlat) ? 'rail' : 'flat';
      if (surface !== 'rail') { grind = 0; grindLen = 0; }

      /*
       * אורך המעוף, מתוקן לפי צורת הפרבולה.
       *
       * החלון שנמדד הוא הרוחב של הפרבולה בגובה החיתוך, לא בבסיסה, ולכן
       * הוא תמיד קצר מהמעוף האמיתי. לפרבולה הרוחב בגובה L הוא
       * T·√(1−L/P), אז חלוקה באותו שורש מחזירה את T. בלי זה קפיצה של
       * 0.45 שניות נמדדה 0.35, והגובה שנגזר ממנה יצא נמוך בהתאמה.
       *
       * על מכשול אין פרבולה — הגוף נישא ולא נופל — ולכן שם הזמן הנמדד
       * הוא הזמן, בלי תיקון.
       */
      /*
       * מבחן הפרבולה: האם זו באמת קפיצה.
       *
       * גוף בתעופה חופשית מצייר פרבולה, נקודה. כל מה שלא מתאים לפרבולה
       * הוא משהו אחר: מצלמה שנסחפה, אדם שעבר ברקע, או שגיאת מעקב. לכן
       * עושים התאמה ריבועית לעלייה ומודדים כמה היא מסבירה (R²), ומה
       * שלא עובר נדחה במקום להפוך למספר.
       *
       * על מכשול אין פרבולה אלא רמה — שם המבחן לא חל, וזו הסיבה שהוא
       * רץ רק אחרי שידוע איזה משטח זה.
       */
      const fitR2 = () => {
        let n = 0, sx = 0, sx2 = 0, sx3 = 0, sx4 = 0, sy = 0, sxy = 0, sx2y = 0;
        for (let i = a; i <= b; i += 1) {
          const x = t[i] - t[a], y = rise[i];
          const x2 = x * x;
          n += 1; sx += x; sx2 += x2; sx3 += x2 * x; sx4 += x2 * x2;
          sy += y; sxy += x * y; sx2y += x2 * y;
        }
        if (n < 5) return 1;                       // מעט מדי נקודות למבחן
        // פתרון 3x3 בשיטת קרמר
        const M = [[n, sx, sx2], [sx, sx2, sx3], [sx2, sx3, sx4]];
        const V = [sy, sxy, sx2y];
        const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
                         - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
                         + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
        const D = det(M);
        if (!D) return 0;
        const sub = (col) => det(M.map((row, i2) => row.map((v, j) => (j === col ? V[i2] : v))));
        const c0 = sub(0) / D, c1 = sub(1) / D, c2 = sub(2) / D;
        if (c2 >= 0) return 0;                     // פרבולה שפונה למעלה אינה קפיצה
        const mean = sy / n;
        let ssRes = 0, ssTot = 0;
        for (let i = a; i <= b; i += 1) {
          const x = t[i] - t[a];
          const pred = c0 + c1 * x + c2 * x * x;
          ssRes += (rise[i] - pred) ** 2;
          ssTot += (rise[i] - mean) ** 2;
        }
        return ssTot > 0 ? 1 - ssRes / ssTot : 0;
      };

      const r2 = surface === 'rail' ? 1 : fitR2();
      if (r2 < 0.6) { why = why || 'זוהתה תנועה שאינה נראית כמו קפיצה'; return; }

      const tk_rise = peak / bodyH;                  // העלייה ביחידות גובה-גוף
      const cut = Math.max(rise[a], rise[b]);
      const shape = Math.sqrt(Math.max(0.2, Math.min(1, 1 - cut / peak)));
      const air = (surface === 'rail' ? span : span / shape) / Judge.slowmo;
      // מתחת ל-0.18 שניות אין טריק, יש רעידה
      if (air < 0.18 || air > 2.5) { why = why || 'זוהתה תנועה אבל לא קפיצה ברורה'; return; }

      /*
       * גובה: שתי מדידות בלתי תלויות, וההצגה אומרת איזו מהן יש.
       * hTime עובד בלי שום סרגל כי הוא נגזר מזמן המעוף לבדו; hPix
       * דורש סרגל. על מכשול הגוף נישא ולא נופל, ולכן שם רק hPix תקף,
       * ובלי סרגל פשוט אין גובה למכשול.
       */
      const hTime = 9.81 * air * air / 8;          // h = g·t²/8

      /*
       * מבחן העקביות: שתי דרכים למדוד את אותו גובה חייבות להסכים.
       *
       * העלייה נמדדת ביחידות של גובה-גוף מהתמונה, וזמן המעוף נותן
       * גובה במטרים מהפיזיקה. היחס ביניהם הוא גובה הרוכב במטרים —
       * ואם הוא יוצא 2.9 מטר או 40 סנטימטר, מה שנמדד אינו אדם קופץ.
       * זה בדיוק מה שתפס תנועת מצלמה שנסחפה: היא ציירה פרבולה יפה
       * (R² גבוה), אבל פרבולה של ענק בן שלושה מטרים.
       *
       * המבחן הזה לא דורש שהמשתמש ימלא את גובהו — הוא בודק את היחס,
       * לא את הערך — ולכן הוא עובד גם במצב שבו אין סרגל בכלל.
       */
      const impliedH = tk_rise > 0 ? hTime / tk_rise : 0;
      if (surface !== 'rail') {
        /*
         * תקרת זמן: קפיצה היא נפילה חופשית, וזמן המעוף קובע את הגובה.
         * שנייה שלמה באוויר פירושה גובה של 1.2 מטר, שאיש לא קופץ על
         * סקייטבורד. לכן כל מה שארוך מזה על הקרקע אינו קפיצה — וזה
         * בדיוק מה שתפס את סחף המצלמה, שצייר "קפיצות" של שנייה וחצי.
         */
        if (air > 1.0) { why = why || 'התנועה ארוכה מכדי להיות קפיצה'; return; }
        // ובדיקה רופפת של היחס, לגרסאות קיצוניות של חוסר התאמה
        if (impliedH && (impliedH < 0.4 || impliedH > 4.0)) {
          why = why || 'התנועה שזוהתה לא מתאימה לפיזיקה של קפיצה';
          return;
        }
      }
      /*
       * מלפנים או מאחור המדידה מהפיקסלים לא אמינה: הרוכב לא חוצה את
       * הפריים, הצללית שלו כמעט חופפת בין פריימים, וההפרש מסמן רק
       * פסים דקים בקצוות. שם סומכים על זמן המעוף בלבד.
       */
      const height = surface === 'rail' ? hPix
                   : (hPix == null || view === 'front') ? hTime
                   : (hPix + hTime) / 2;
      const unc = (surface === 'rail' || hPix == null || view === 'front') ? null
                : Math.abs(hPix - hTime) / 2;

      /* ניקיון הנחיתה: כמה רעד יש מיד אחריה לעומת לפני הפופ */
      const after = [], before = [];
      const sm = Judge.slowmo;           // החלונות בשניות אמיתיות, הזמנים בזמן מדיה
      pts.forEach((p) => {
        if (p.t > t[b] + 0.05 * sm && p.t < t[b] + 0.55 * sm) after.push(p.mass);
        if (p.t < t[a] - 0.1 * sm && p.t > t[a] - 0.7 * sm) before.push(p.mass);
      });
      const wobble = (after.length && before.length)
        ? Judge.median(after) / Math.max(1, Judge.median(before)) : 1.4;

      tricks.push({ t0: t[a], t1: t[b], air, height, unc, dist, surface, view,
                    grind, grindLen, wobble, hPix, hTime, r2,
                    riseBodies: tk_rise, impliedH });
    });

    if (!tricks.length && !why) why = 'לא נמצאה עלייה ברורה של הגוף מעל גובה הנסיעה הרגיל';
    return { tricks, why, pxPerM, bodyH, pts, view, cameraMoved, tooShaky,
             scaled: !!pxPerM };
  }

  /** רצף עם פחות מ-0.9 שניות בין טריקים הוא קומבו אחד. */
  function groupCombos(tricks) {
    const groups = [];
    let cur = [];
    tricks.forEach((tk) => {
      if (!cur.length) { cur = [tk]; return; }
      const gap = (tk.t0 - cur[cur.length - 1].t1) / Judge.slowmo;
      if (gap < 0.9) cur.push(tk); else { groups.push(cur); cur = [tk]; }
    });
    if (cur.length) groups.push(cur);
    return groups;
  }

  /**
   * ציון מקומי לטריק, מהמדידות בלבד. הוא לא מחליף את השופט — הוא מה
   * שמוצג לפני שהשופט ענה, וגם מה שנשאר אם ה-AI לא זמין.
   */
  /*
   * `diff` הוא דרגת הקושי מהקטלוג, כשהרוכב בחר שם לטריק. בלי שם אין
   * קושי ואין לו משקל — ולכן אוליי וקיקפליפ עם אותו זמן אוויר מקבלים
   * אותו ציון, עד שמישהו אומר איזה מהם זה.
   */
  function localScore(tk, diff) {
    const clamp = (v) => Math.max(0, Math.min(10, v));
    const c = {
      air: clamp(tk.surface === 'rail' ? tk.air / 1.4 * 10 : tk.air / 0.65 * 10),
      height: tk.height == null ? null : clamp(tk.height / 0.5 * 10),
      dist: tk.dist == null ? null : clamp(tk.dist / 2.2 * 10),
      clean: clamp(10 - (tk.wobble - 1) * 6),
    };
    // מה שלא נמדד לא מקבל משקל, והמשקלים מנורמלים מחדש
    c.diff = (diff == null) ? null : clamp(diff);
    const parts = [[c.air, 0.26], [c.height, 0.26], [c.dist, 0.1],
                   [c.clean, 0.24], [c.diff, 0.3]]
      .filter(([v]) => v != null);
    const w = parts.reduce((s2, [, k]) => s2 + k, 0) || 1;
    return { c, total: clamp(parts.reduce((s2, [v, k]) => s2 + v * k, 0) / w) };
  }

  return { findTricks, groupCombos, localScore };
})();

/* ==========================================================================
   Sheets — מה שהשופט בעצם רואה

   המודל לא מקבל וידאו, רק תמונות. "לראות את הטריק" פירושו לדחוס
   פריימים לגיליון אחד. שם יש תקרה שאי אפשר לעקוף: כל תמונה מוקטנת
   אצל המודל לכ-1.2 מיליון פיקסלים, וזה תקציב קבוע שמתחלק בין
   הפריימים שבתוכה. 16 פריימים נותנים לכל אחד ריבוע של כ-290 פיקסלים,
   מספיק כדי לראות לאן הלוח מסתובב. מאה פריימים באותה תמונה היו
   נותנים לכל אחד כתם של 110 פיקסלים — יותר פריימים, פחות ראייה.
   ========================================================================== */

const Sheets = (() => {
  'use strict';

  const PER = 16, GRID = 4, CELL = 290;

  const blank = () => {
    const c = document.createElement('canvas');
    c.width = CELL * GRID; c.height = CELL * GRID;
    const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
    return { c, x };
  };

  const encode = (sh) => sh.c.toDataURL('image/jpeg', 0.86).split(',')[1];

  /** חיתוך סביב הרוכב לפי המסלול שנמדד, ולא סביב מרכז הפריים. */
  function cell(sh, video, res, time, zoom, slot, label) {
    let best = res.pts[0];
    res.pts.forEach((p) => {
      if (Math.abs(p.t - time) < Math.abs(best.t - time)) best = p;
    });

    const sc = video.videoWidth / 192;
    let size = Math.max(res.bodyH * (zoom ? 1.5 : 2.8), 30) * sc;
    // המסלול נשמר בקואורדינטות עולם (X = x − C); לחיתוך מחזירים את המצלמה
    const cx = ((best.x0 + best.x1) / 2 + best.camX) * sc;
    const cy = ((best.y0 + best.y1) / 2 + best.camY + (zoom ? res.bodyH * 0.26 : 0)) * sc;
    const sx = Math.max(0, Math.min(video.videoWidth - size, cx - size / 2));
    const sy = Math.max(0, Math.min(video.videoHeight - size, cy - size / 2));
    size = Math.min(size, video.videoWidth - sx, video.videoHeight - sy);

    const col = slot % GRID, row = Math.floor(slot / GRID);
    sh.x.imageSmoothingQuality = 'high';
    sh.x.drawImage(video, sx, sy, size, size, col * CELL, row * CELL, CELL, CELL);

    // הכיתוב באנגלית ובספרות בלבד — טקסט עברי על קנבס מתהפך בחלק מהדפדפנים
    sh.x.fillStyle = 'rgba(0,0,0,.72)';
    sh.x.fillRect(col * CELL, row * CELL, 54, 20);
    sh.x.fillStyle = '#fff';
    sh.x.font = 'bold 13px monospace';
    sh.x.textAlign = 'left';
    sh.x.fillText(label, col * CELL + 6, row * CELL + 15);
    sh.x.strokeStyle = 'rgba(255,255,255,.35)';
    sh.x.lineWidth = 1;
    sh.x.strokeRect(col * CELL + 0.5, row * CELL + 0.5, CELL - 1, CELL - 1);
  }

  const seek = (video, t) => new Promise((resolve) => {
    if (Math.abs(video.currentTime - t) < 0.01) return resolve();
    video.onseeked = resolve;
    video.currentTime = t;
    setTimeout(resolve, 1500);   // פריים שלא נטען לא שווה המתנה ארוכה
  });

  /** סקירה של כל הסרטון — ההקשר: המקום, המכשול, הקו. */
  async function overview(video, res) {
    const sh = blank();
    const D = res.duration || (Number.isFinite(video.duration) ? video.duration : 1);
    for (let i = 0; i < PER; i += 1) {
      const at = Math.min(D - 0.01, D * (i + 0.5) / PER);
      await seek(video, at);
      cell(sh, video, res, at, false, i, `${at.toFixed(1)}s`);
    }
    return encode(sh);
  }

  /**
   * טריק אחד, פריים אחרי פריים, מקורב לרגליים וללוח.
   * `budget` הוא כמה גיליונות מותר — מעבר לזה מדלגים על פריימים.
   */
  async function forTrick(video, res, tk, budget, onProgress) {
    const span = Math.max(0.05, tk.t1 - tk.t0);
    const from = Math.max(0, tk.t0 - span * 0.2);
    const D = res.duration || (Number.isFinite(video.duration) ? video.duration : tk.t1 + 1);
    const to = Math.min(D - 0.01, tk.t1 + span * 0.25);

    const total = Math.max(1, Math.round((to - from) / Judge.capDt));
    const cap = budget * PER;
    const every = Math.max(1, Math.ceil(total / cap));
    const take = Math.min(total, cap);

    const out = [];
    let sh = null, slot = 0;

    for (let i = 0; i < take; i += 1) {
      const at = Math.min(to, from + (i * every) * Judge.capDt);
      await seek(video, at);
      if (!sh) { sh = blank(); slot = 0; }
      cell(sh, video, res, at, true, slot, String(i + 1));
      slot += 1;
      onProgress?.(i + 1, take);
      if (slot >= PER) { out.push(encode(sh)); sh = null; }
    }
    if (sh && slot > 0) out.push(encode(sh));

    return { sheets: out, count: take, every, total };
  }

  return { overview, forTrick, PER };
})();

/* ==========================================================================
   JudgeApi — הדיבור עם השרת
   ========================================================================== */

const JudgeApi = (() => {
  'use strict';

  async function post(path, body) {
    const res = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'השרת לא ענה');
    return data;
  }

  async function get(path) {
    const res = await fetch(path, { credentials: 'same-origin' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'השרת לא ענה');
    return data;
  }

  return {
    me: () => get('/api/auth/me'),
    aiStatus: () => get('/api/ai/status'),
    trick: (body) => post('/api/judge/trick', body),
    flow: (body) => post('/api/judge/flow', body),
    save: (body) => post('/api/judge/run', body),
    history: () => get('/api/judge/history'),
  };
})();
