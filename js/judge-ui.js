/* ==========================================================================
   Judge UI — דף השופט

   סדר העבודה, ולמה הוא מפוצל לשני שלבים:
   1. מדידה בדפדפן, מיד כשהסרטון נטען. היא מהירה, חינם, ותמיד רצה.
   2. שיפוט בשרת, רק בלחיצה. כל טריק הוא קריאה בתשלום, ולכן זה אף פעם
      לא קורה מעצמו.
   ========================================================================== */

(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const vid = $('#vid'), stage = $('#stage'), prog = $('#prog'), progwrap = $('#progwrap');
  const results = $('#results'), player = $('#player');

  let state = null;     // { res, tricks, flow, sls }
  let overviewSheet = null;
  let videoUrl = null;  // כתובת ה-blob הנוכחית, כדי לשחרר אותה כשנטען סרטון אחר
  let busy = false;
  let signedIn = false, aiReady = false;
  // קובץ שנפתח בלחיצה כפולה אין לו שרת לדבר איתו, ולכן גם אין פאנל
  const OFFLINE = location.protocol === 'file:';

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const say = (t) => { stage.textContent = t; };

  /* ---------- הגדרות ---------- */

  try {
    const saved = localStorage.getItem('sl_judge_h');
    if (saved) $('#h').value = saved;
  } catch { /* דפדפן בלי אחסון — ברירת המחדל תקפה */ }

  $('#h').addEventListener('change', () => {
    try { localStorage.setItem('sl_judge_h', $('#h').value); } catch { /* לא קריטי */ }
  });

  $('#shoot').addEventListener('click', shoot);
  const shootLabel = () => {
    $('#shoot').textContent = RECORDER_OK ? `צלם רן · ${mmss(runSeconds())}` : 'צלם רן';
  };
  $('#runlen').addEventListener('change', shootLabel);
  $('#pick').addEventListener('click', () => $('#filePick').click());
  /* איפוס הערך: בלי זה בחירה חוזרת של אותו קובץ לא יורה change, והכפתור נראה מת */
  const fromInput = (e) => { const f = e.target.files[0]; e.target.value = ''; load(f); };
  $('#fileShoot').addEventListener('change', fromInput);
  $('#filePick').addEventListener('change', fromInput);

  /* ---------- הקלטת רן עם שעון ---------- */

  /*
   * למה הדף מקליט בעצמו, ולא פותח את המצלמה של הטלפון.
   *
   * `<input capture>` מעביר את המשתמש לאפליקציית המצלמה של המערכת.
   * משם הדף לא רואה כלום: הוא לא יכול להציג שעון, לא לספור אחורה ולא
   * לעצור את ההקלטה בתום הזמן. רן מוגבל בזמן הוא כל הרעיון של תחרות,
   * ולכן ההקלטה חייבת לקרות כאן, במסך שהדף שולט בו.
   *
   * זה עובד רק בהקשר מאובטח: האתר עצמו (גם http://localhost נחשב),
   * אבל לא קובץ שנפתח בלחיצה כפולה. שם נשארת הדרך הישנה דרך מצלמת
   * המערכת, בלי שעון, והדף אומר זאת במקום להיכשל בשקט.
   */
  const RECORDER_OK = !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

  function noTimerNote(text) {
    let el = document.getElementById('notimer');
    if (!el) {
      el = document.createElement('p');
      el.id = 'notimer';
      el.className = 'jsub';
      el.style.margin = '10px 0 0';
      document.getElementById('tips')?.appendChild(el);
    }
    el.textContent = text;
  }

  if (!RECORDER_OK) {
    noTimerNote('בקובץ שנפתח בלחיצה כפולה אין שעון רן: הקלטה עם שעון דורשת לפתוח את הדף '
      + 'מהשרת של Skate Lab. כאן נפתחת מצלמת המערכת, והסרטון נמדד אחרי שהוא חוזר.');
  }

  let stream = null, recorder = null, ticker = null, chunks = [], endAt = 0, startAt = 0, cancelled = false;

  const runSeconds = () => Number($('#runlen').value) || 60;
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  function pickMime() {
    // ספארי מקליט mp4, כרום webm. מי שלא עונה מקבל את ברירת המחדל שלו
    const want = ['video/mp4;codecs=avc1', 'video/mp4',
                  'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    return want.find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
  }

  async function shoot() {
    if (!RECORDER_OK) return $('#fileShoot').click();
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' },
                 width: { ideal: 1280 }, height: { ideal: 720 },
                 frameRate: { ideal: 60 } },
        audio: false,
      });
    } catch (err) {
      // סירוב או אין מצלמה: נופלים למצלמת המערכת, בלי שעון
      noTimerNote('המצלמה לא נפתחה, אז נפתחת מצלמת המערכת ובה אין שעון רן.');
      $('#fileShoot').click();
      return;
    }

    cancelled = false;
    chunks = [];
    $('#preview').srcObject = stream;
    $('#rec').hidden = false;

    const mime = pickMime();
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
    recorder.onstop = finishRun;
    recorder.start(250);          // פלחים קצרים, אחרת הפסקה פתאומית מאבדת הכל

    const total = runSeconds();
    startAt = performance.now();
    endAt = startAt + total * 1000;
    paintClock(total, total);
    ticker = setInterval(() => {
      const left = Math.max(0, (endAt - performance.now()) / 1000);
      paintClock(left, total);
      if (left <= 0) stopRun();      // תם הזמן, הרן נגמר מעצמו
    }, 100);
  }

  function paintClock(left, total) {
    const el = $('#clock');
    el.textContent = mmss(Math.ceil(left));
    el.classList.toggle('warn', left <= 15 && left > 5);
    el.classList.toggle('last', left <= 5);
    $('#recBar').style.width = `${Math.max(0, left / total * 100)}%`;
  }

  function closeRec() {
    clearInterval(ticker); ticker = null;
    $('#rec').hidden = true;
    $('#preview').srcObject = null;
    stream?.getTracks().forEach((t) => t.stop());   // בלי זה נורית המצלמה נשארת דולקת
    stream = null;
  }

  function stopRun() {
    clearInterval(ticker); ticker = null;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    else closeRec();
  }

  function finishRun() {
    const type = chunks[0]?.type || 'video/mp4';
    const blob = new Blob(chunks, { type });
    const took = (performance.now() - startAt) / 1000;
    closeRec();
    if (cancelled || blob.size < 1000) return;
    // webm מהמקליט מדווח אורך אינסופי; האורך האמיתי ידוע כאן, אז מעבירים אותו
    load(new File([blob], `run.${type.includes('mp4') ? 'mp4' : 'webm'}`, { type }), took);
  }

  shootLabel();
  $('#recStop').addEventListener('click', stopRun);
  $('#recCancel').addEventListener('click', () => { cancelled = true; stopRun(); });

  /* ---------- מי מחובר ומה זמין ---------- */

  (async () => {
    if (OFFLINE) return;
    try {
      const me = await JudgeApi.me();
      signedIn = !!me?.id;
    } catch { signedIn = false; }
    try {
      aiReady = !!(await JudgeApi.aiStatus()).available;
    } catch { aiReady = false; }
    if (signedIn) loadHistory();
  })();

  /* ---------- מדידה ---------- */

  /*
   * נעילת הכפתורים בזמן ניתוח.
   *
   * בלי זה, בחירת סרטון שני באמצע ניתוח הראשון פשוט נבלעה: הקריאה
   * חזרה מיד בגלל `busy`, המשתמש לא קיבל שום הודעה, ועל המסך הופיעו
   * בסוף התוצאות של הסרטון *הראשון*. עדיף כפתור מכובה מאשר תוצאה
   * שמתייחסת לקובץ אחר ממה שנבחר.
   */
  function setBusy(on) {
    busy = on;
    $('#shoot').disabled = on;
    $('#pick').disabled = on;
  }

  async function load(file, hintDur) {
    if (!file || busy) return;
    results.innerHTML = '';
    state = null; overviewSheet = null;
    player.hidden = false;
    Judge.setRider($('#h').value, $('#fps').value);
    setBusy(true);

    /*
     * קובץ שהדפדפן לא יודע לפענח לא יורה loadedmetadata לעולם, והדף
     * היה נשאר תקוע על "טוען את הסרטון" בלי שום הסבר. שני שומרים:
     * אירוע שגיאה, ופסק זמן למקרה שגם הוא לא מגיע.
     */
    let settled = false;
    const fail = (msg) => {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      progwrap.hidden = true;
      setBusy(false);
      say(msg);
    };
    const guard = setTimeout(() => fail('הסרטון לא נטען. אולי הפורמט לא נתמך בדפדפן הזה.'), 20000);

    vid.onerror = () => fail('לא הצלחנו לקרוא את הקובץ הזה. צריך קובץ וידאו.');
    vid.onloadedmetadata = async () => {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      progwrap.hidden = false;
      prog.style.width = '0%';
      say('קורא פריימים');
      try {
        const cap = await Judge.capture(vid, (pr) => {
          prog.style.width = `${Math.min(100, pr * 100)}%`;
        }, hintDur);
        say('מחפש תנועה');
        const res = Analyse.findTricks(Judge.track(cap));
        res.duration = cap.duration;      // האורך שנמדד, לא מה שהקובץ מצהיר
        progwrap.hidden = true;
        state = { res, tricks: res.tricks };
        setBusy(false);                   // לפני הציור, אחרת הכפתור נתקע על "עובד"
        say('');                          // אחרת "מחפש תנועה" נשאר מעל התוצאות
        render();
      } catch (err) {
        progwrap.hidden = true;
        setBusy(false);
        say(`הניתוח נכשל: ${err.message}`);
      }
    };

    if (videoUrl) URL.revokeObjectURL(videoUrl);   // סרטון קודם של דקה הוא עשרות מגה בזיכרון
    videoUrl = URL.createObjectURL(file);
    vid.src = videoUrl;
    vid.load();
    say('טוען את הסרטון');
  }

  /* ---------- שיפוט ---------- */

  /*
   * אילו טריקים נשלחים לפאנל. התקרה היא שש, כי כל טריק עולה שתיים-שלוש
   * קריאות. קודם נשלחו *ששת הראשונים*, ורן שהטריק הגדול שלו בסוף פשוט
   * לא קיבל עליו ציון. עכשיו נבחרים ששת החזקים לפי המדידה, וזה מה
   * ש-Control ו-Impact סופרים ממילא.
   */
  const MAX_JUDGED = 6;
  function toJudge() {
    const est = (tk) => Analyse.localScore(tk, tk.chosen != null ? TRICKS[tk.chosen]?.d : null).total;
    return state.tricks.slice().sort((x, y) => est(y) - est(x)).slice(0, MAX_JUDGED)
      .sort((x, y) => x.t0 - y.t0);
  }

  async function judgeAll() {
    if (busy || !state) return;
    setBusy(true);
    state.sls = null;               // שיפוט חוזר הוא ריצה חדשה, לא "נשמר"
    render();

    const tricks = toJudge();
    const groups = Analyse.groupCombos(state.tricks);
    const comboOf = (tk) => {
      const g = groups.find((gr) => gr.length > 1 && gr.includes(tk));
      if (!g) return '';
      return `הטריק הזה הוא חלק ${g.indexOf(tk) + 1} מתוך ${g.length} ברצף רצוף.`;
    };

    try {
      if (!overviewSheet) {
        say('מכין סקירה של כל הסרטון');
        overviewSheet = await Sheets.overview(vid, state.res);
      }

      for (let i = 0; i < tricks.length; i += 1) {
        const tk = tricks[i];
        const info = await Sheets.forTrick(vid, state.res, tk, 4, (k, n) => {
          say(`טריק ${i + 1} מתוך ${tricks.length}: ${k} מתוך ${n} פריימים`);
        });
        say(`טריק ${i + 1} מתוך ${tricks.length}: הפאנל שופט ${info.count} פריימים`);

        tk.frames = info;
        const claimed = tk.chosen != null && TRICKS[tk.chosen]
          ? `${TRICKS[tk.chosen].he} (${TRICKS[tk.chosen].en})` : '';
        tk.verdict = await JudgeApi.trick({
          claimed,
          sheets: info.sheets,
          overview: i === 0 ? overviewSheet : null,   // ההקשר נחוץ פעם אחת
          combo: comboOf(tk),
          measure: {
            air: tk.air, height: tk.height, dist: tk.dist, view: tk.view,
            surface: tk.surface, grind: tk.grind, grindLen: tk.grindLen, slow: tk.slow,
            scaled: state.res.scaled, cameraMoved: state.res.cameraMoved,
          },
        });
        render();
      }

      say('ציון Flow לרן כולו');
      const landed = tricks.filter((t) => t.verdict?.landed).length;
      state.flow = await JudgeApi.flow({
        overview: overviewSheet,
        duration: state.res.duration || 0,
        tricks: state.tricks.length,
        landed,
      });

      say('');
      setBusy(false);
      render();
      if (signedIn) save();
    } catch (err) {
      setBusy(false);
      say(err.message);
      render();
    }
  }

  async function save() {
    try {
      /*
       * השם שנשמר הוא השם שמופיע על הכרטיס, כלומר בחירה ידנית גוברת על
       * השופטים — אחרת ההיסטוריה שומרת שם אחר ממה שהרוכב רואה, וזה
       * בדיוק מה שנתפס בבדיקה: הכרטיס אמר קיקפליפ והשורה נשמרה כאוליי.
       */
      const tricks = state.tricks.filter((t) => t.verdict).map((t) => ({
        trick: (t.chosen != null && TRICKS[t.chosen])
          ? `${TRICKS[t.chosen].he} (${TRICKS[t.chosen].en})` : t.verdict.trick,
        score: t.verdict.score, landed: t.verdict.landed,
        surface: t.surface, air: t.air, height: t.height, note: t.verdict.note,
      }));
      if (!tricks.length) return;
      state.sls = await JudgeApi.save({ tricks, flow: state.flow?.flow || 0 });
      render();
      loadHistory();
    } catch { /* השמירה פרטית וחד-פעמית — כישלון בה לא מוחק את התוצאה מהמסך */ }
  }

  /* ---------- תצוגה ---------- */

  function sls() {
    const scores = state.tricks.filter((t) => t.verdict).map((t) => t.verdict.score);
    if (!scores.length) return null;
    const sorted = scores.slice().sort((a, b) => b - a);
    const r1 = (n) => Math.round(n * 10) / 10;
    const control = r1(sorted.slice(0, 4).reduce((s, n) => s + n, 0));
    const impact = r1(sorted[0]);
    const flow = r1(state.flow?.flow || 0);
    return { flow, control, impact, total: r1(flow + control + impact),
             counted: Math.min(4, sorted.length) };
  }

  /*
   * הערכה מהמדידות בלבד, כשאין עדיין ציון מהפאנל. בלי שרת (הקובץ
   * הלא-מקוון) זה כל מה שיש, ועד עכשיו לא הוצג שום סכום — רק ציון
   * לכל טריק. Flow נשאר ריק: הוא שאלה על הרן כולו, ואין לו מדידה.
   */
  function localBoard() {
    const scores = state.tricks.map((tk) =>
      Analyse.localScore(tk, tk.chosen != null ? TRICKS[tk.chosen]?.d : null).total)
      .sort((a, b) => b - a);
    if (!scores.length) return null;
    const r1 = (n) => Math.round(n * 10) / 10;
    const control = r1(scores.slice(0, 4).reduce((s, n) => s + n, 0));
    const impact = r1(scores[0]);
    return { control, impact, total: r1(control + impact), counted: Math.min(4, scores.length) };
  }

  function render() {
    if (!state) return;
    results.innerHTML = '';

    if (!state.tricks.length) {
      const tip = state.res.cameraMoved
        ? 'המצלמה זזה הרבה. הליכה, רעד וזום מנוכים, אבל סיבוב מהיר של הטלפון לא.'
        : 'בדוק שכל הגוף בפריים, גם בשיא הקפיצה, ושהרוכב לא קטן מדי.';
      results.innerHTML = `<div class="jcard"><b>לא זוהה אף טריק</b>
        <p class="jsub" style="margin:8px 0 0">${esc(state.res.why)}. ${esc(tip)}</p></div>`;
      return;
    }

    const judged = state.tricks.filter((t) => t.verdict).length;
    const notes = [];
    if (state.res.cameraMoved) notes.push('המצלמה זזה בצילום. התנועה והזום שלה חושבו ונוכו.');
    if (state.res.tooShaky) notes.push('בחלק מהסרטון המצלמה זזה מהר מדי ולא נמדד שם כלום. ייתכן שטריק משם חסר.');
    if (state.res.view === 'front') notes.push('הצילום נראה מלפנים או מאחור, ולכן אין מרחק: מהזווית הזאת הוא לא נראה בכלל.');
    if (!state.res.scaled) notes.push('לא מילאת גובה, אז הגובה מחושב מזמן האוויר לפי הפיזיקה ואין מרחק במטרים. השיפוט עצמו לא תלוי בזה.');
    if (notes.length) {
      results.insertAdjacentHTML('beforeend',
        `<div class="jcard"><p class="jsub" style="margin:0">${notes.map(esc).join('<br>')}</p></div>`);
    }
    const board = sls();

    if (board) {
      results.insertAdjacentHTML('beforeend', `
        <div class="board">
          <div class="board__total">
            <div><b>${board.total.toFixed(1)}</b> <span>/ 60</span>
              <div class="trick__meta">${judged} טריקים נשפטו${
                state.sls ? ' · נשמר בריצות שלי' : ''}</div></div>
          </div>
          <div class="board__parts">
            <div class="part"><b>${board.flow.toFixed(1)}</b><span>FLOW</span>
              <em>הרן כולו</em></div>
            <div class="part"><b>${board.control.toFixed(1)}</b><span>CONTROL</span>
              <em>${board.counted} הטריקים הטובים</em></div>
            <div class="part"><b>${board.impact.toFixed(1)}</b><span>IMPACT</span>
              <em>הטריק הגדול</em></div>
          </div>
        </div>`);
      if (state.flow?.note) {
        results.insertAdjacentHTML('beforeend',
          `<p class="jsub" style="margin:-6px 0 14px">${esc(state.flow.note)}</p>`);
      }
    } else {
      const est = localBoard();
      if (est) {
        results.insertAdjacentHTML('beforeend', `
          <div class="board">
            <div class="board__total">
              <div><b>${est.total.toFixed(1)}</b> <span>/ 50</span>
                <div class="trick__meta">הערכה מהמדידות · ${state.tricks.length} טריקים · בלי Flow</div></div>
            </div>
            <div class="board__parts">
              <div class="part"><b>—</b><span>FLOW</span><em>רק מהפאנל</em></div>
              <div class="part"><b>${est.control.toFixed(1)}</b><span>CONTROL</span>
                <em>${est.counted} הטריקים הטובים</em></div>
              <div class="part"><b>${est.impact.toFixed(1)}</b><span>IMPACT</span>
                <em>הטריק הגדול</em></div>
            </div>
          </div>`);
      }
    }

    // כפתור השיפוט, או מה שמונע ממנו לרוץ
    const blocked = OFFLINE
      ? 'הקובץ הזה רץ בלי שרת, אז אין פאנל שופטים. המדידות והציון שנגזר מהן עובדים במלואם.'
      : !signedIn ? 'צריך להיות מחובר ל-Skate Lab כדי להפעיל את הפאנל.'
      : !aiReady ? 'השופט לא מוגדר בשרת (חסר ANTHROPIC_API_KEY).' : '';
    results.insertAdjacentHTML('beforeend', `
      <div class="jcard">
        <button class="jbtn" id="go" ${busy || blocked ? 'disabled' : ''}>
          ${busy ? 'הפאנל עובד…' : judged ? 'שפוט שוב' : 'שלח לפאנל השופטים'}</button>
        <p class="jsub" style="margin:9px 0 0">${blocked ? esc(blocked)
          : 'כל טריק נשפט פעמיים בשתי קריאות נפרדות. כשהציונים רחוקים זה מזה, או שהשופטים ראו טריקים שונים, נקרא שופט שלישי והגבוה והנמוך יורדים.'}${
          !blocked && state.tricks.length > MAX_JUDGED
            ? ` נמצאו ${state.tricks.length} טריקים, ונשלחים ${MAX_JUDGED} החזקים שבהם לפי המדידה.` : ''}</p>
      </div>`);
    $('#go')?.addEventListener('click', judgeAll);

    const groups = Analyse.groupCombos(state.tricks);
    let n = 0;
    groups.forEach((gr) => {
      let host = results;
      if (gr.length > 1) {
        const box = document.createElement('div');
        box.className = 'combo';
        box.innerHTML = `<div class="combo__head">
          <span class="jpill">קומבו</span> ${gr.length} טריקים ברצף</div>`;
        results.appendChild(box);
        host = box;
      }
      gr.forEach((tk) => { n += 1; host.appendChild(card(tk, n)); });
    });
  }

  /*
   * בחירת שם ידנית.
   *
   * השופטים נותנים שם, אבל הם לא תמיד כאן: בקובץ שרץ בלי שרת אין
   * פאנל בכלל, ולפעמים הם פשוט לא בטוחים. הרוכב יודע מה הוא ניסה
   * לעשות, ולכן השם שהוא בוחר גובר תמיד. הקושי נגזר מהרמה שבקטלוג
   * של האפליקציה, אותו קטלוג שמאחורי ההישגים, ולא ממספר שהומצא כאן.
   */
  const TRICKS = (typeof TRICK_LIST !== 'undefined') ? TRICK_LIST : [];

  function nameSelect(tk) {
    const sel = document.createElement('select');
    sel.className = 'jname';
    sel.innerHTML = '<option value="">— בחר שם טריק —</option>'
      + TRICKS.map((t, i) => `<option value="${i}"${tk.chosen === i ? ' selected' : ''}>`
          + `${esc(t.he)} · ${esc(t.en)}</option>`).join('');
    sel.addEventListener('click', (e) => e.stopPropagation());
    sel.addEventListener('change', function () {
      tk.chosen = this.value === '' ? null : Number(this.value);
      render();
    });
    return sel;
  }

  function card(tk, n) {
    const el = document.createElement('div');
    el.className = 'trick';
    const v = tk.verdict;
    const chosen = tk.chosen != null ? TRICKS[tk.chosen] : null;
    const local = Analyse.localScore(tk, chosen ? chosen.d : null);
    const score = v ? v.score : local.total;
    const name = chosen ? `${chosen.he} · ${chosen.en}`
               : v ? v.trick
               : 'עוד לא נקבע שם';
    const who = chosen ? 'אתה קבעת'
              : v ? (v.agreed ? 'השופטים הסכימו' : 'השופטים חלוקים')
              : (TRICKS.length ? 'אפשר לבחור למטה' : '');
    const surf = tk.surface === 'rail' ? 'מעקה או קרב' : 'קרקע';

    const bar = (label, val, txt) => `<div class="jmini"><span>${label}</span>
      <u><i style="width:${Math.max(0, Math.min(100, val * 10))}%"></i></u>
      <span>${txt}</span></div>`;

    el.innerHTML = `
      <div class="trick__top">
        <div>
          <div class="trick__name">${n}. ${esc(name)}</div>
          <div class="trick__meta">${tk.t0.toFixed(2)}s–${tk.t1.toFixed(2)}s ·
            <span class="jpill">${surf}</span>
            ${tk.slow > 1 ? `<span class="jpill">הילוך איטי ×${tk.slow}</span>` : ''}
            ${who ? `<span class="jpill">${esc(who)}</span>` : ''}
            ${v && !v.landed ? '<span class="jpill jpill--warn">לא נראתה נחיתה</span>' : ''}
            ${v && !v.agreed ? '<span class="jpill jpill--warn">אין הסכמה על השם</span>' : ''}
          </div>
        </div>
        <div class="trick__score">${score.toFixed(1)}</div>
      </div>
      ${bar(tk.surface === 'rail' ? 'זמן על המכשול' : 'זמן אוויר',
            local.c.air, `${tk.air.toFixed(2)}s`)}
      ${tk.height != null ? bar('גובה', local.c.height, `${tk.height.toFixed(2)}m`) : ''}
      ${tk.dist != null ? bar('מרחק', local.c.dist, `${tk.dist.toFixed(2)}m`) : ''}
      ${v && v.rotation
        ? bar('סיבוב (לפי השופטים)', Math.min(10, v.rotation / 540 * 10), `${v.rotation}°`) : ''}
      ${tk.surface === 'rail'
        ? bar('אורך גריינד', Math.min(10, tk.grind / 1.5 * 10), `${tk.grind.toFixed(2)}s`) : ''}
      ${bar('ניקיון נחיתה', local.c.clean, local.c.clean.toFixed(1))}
      ${local.c.diff != null ? bar('קושי הטריק', local.c.diff, local.c.diff.toFixed(1)) : ''}
      ${v ? panel(v) : ''}
      ${v?.grab ? `<div class="jnote"><b>תפיסת הקרש:</b> ${esc(v.grab)}</div>` : ''}
      ${v?.feet ? `<div class="jnote"><b>נחיתה על הלוח:</b> ${esc(v.feet)}</div>` : ''}
      ${v?.frames ? `<div class="jnote"><b>על סמך:</b> ${esc(v.frames)}</div>` : ''}
      ${v?.note ? `<div class="jnote">${esc(v.note)}</div>` : ''}
      <div class="jnote">${tk.surface === 'rail'
        ? (tk.height == null
            ? 'על מכשול אין נפילה חופשית, ולכן בלי סרגל אין דרך למדוד את גובה המכשול.'
            : 'על מכשול הגובה נמדד מהפיקסלים בלבד, כי הגוף נישא ולא נופל.')
        : (tk.unc == null
            ? `הגובה ${tk.hTime.toFixed(2)}m מחושב מזמן האוויר לפי h=g·t²/8${
                tk.view === 'front'
                  ? ', כי מזווית חזיתית המדידה מהפיקסלים לא אמינה' : ', בלי סרגל'}.`
            : `הגובה נמדד ${tk.hPix.toFixed(2)}m מהפיקסלים ו-${tk.hTime.toFixed(2)}m מזמן האוויר, אי ודאות ±${tk.unc.toFixed(2)}m.`)}
        ${tk.frames ? `נשלחו ${tk.frames.count} פריימים לשופטים.` : ''}</div>`;

    if (TRICKS.length) {
      const wrap = document.createElement('div');
      wrap.className = 'jnote';
      wrap.appendChild(nameSelect(tk));
      el.appendChild(wrap);
    }

    el.addEventListener('click', () => { vid.currentTime = Math.max(0, tk.t0 - 0.4); });
    return el;
  }

  /** מה כל שופט נתן, כולל ציון שהושמט — מספר בלי הסבר הוא לא שיפוט. */
  function panel(v) {
    // `out` מגיע מהשרת לפי מושב; לפי ציון, 5-5-8 סימן את שני החמישיות
    const out = (j) => (j.out != null ? j.out : (v.dropped || []).includes(j.score));
    return `<div class="panel">${v.judges.map((j, i) =>
      `<span class="seat ${out(j) ? 'out' : ''}">שופט ${i + 1}: ${j.score.toFixed(1)}</span>`
    ).join('')}${v.dropped ? '<span class="seat">הגבוה והנמוך ירדו</span>' : ''}</div>`;
  }

  async function loadHistory() {
    try {
      const { runs } = await JudgeApi.history();
      if (!runs.length) return;
      $('#histbox').hidden = false;
      $('#hist').innerHTML = runs.map((r) => `
        <div class="hist">
          <span>${new Date(r.createdAt).toLocaleDateString('he-IL')} ·
            ${r.tricks.length} טריקים</span>
          <b>${r.total.toFixed(1)}</b>
        </div>`).join('');
    } catch { /* ההיסטוריה היא תוספת, לא תנאי */ }
  }
})();
