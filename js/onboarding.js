/* ==========================================================================
   Onboarding — מסך הפתיחה, ההרשמה בארבעה שלבים והכניסה לחשבון קיים
   ========================================================================== */

const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
                'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

const STEPS = ['name', 'birth', 'role', 'details', 'password'];

let draft = Store.getDraft();
let busy = false;
let needsInvite = false;   // נקבע פעם אחת מהשרת
let inviteCode = '';       // נשמר כדי שלא ייעלם ברענון המסך
const persist = () => Store.saveDraft(draft);

function progressBar(step) {
  const index = STEPS.indexOf(step);
  const pct = ((index + 1) / STEPS.length) * 100;
  return `
    <div class="topbar">
      <button class="iconbtn" data-back aria-label="חזרה">→</button>
      <div class="progress"><div class="progress__bar" style="width:${pct}%"></div></div>
      <span class="progress__label">${index + 1}/${STEPS.length}</span>
    </div>`;
}

/* ---------- פתיחה ---------- */

Screens.welcome = {
  html: () => `
    <div class="hero">
      <div class="hero__mark">🛹</div>
      <div class="wordmark">SKATE<br><span>LAB</span></div>
      <p class="lead">הקהילה שבה מאמנים מלמדים, רוכבים מתקדמים,<br>וכל שאלה מקבלת תשובה.</p>

      <div class="hero__points">
        <div class="hero__point"><i>🎬</i><span><b>סרטוני הדרכה</b> ממאמנים אמיתיים</span></div>
        <div class="hero__point"><i>📍</i><span><b>מאמנים באזור שלכם</b> — סינון לפי אזור</span></div>
        <div class="hero__point"><i>⭐️</i><span><b>פידבק אישי</b> על הטריקים שאתם מעלים</span></div>
      </div>
    </div>

    <div class="screen__footer">
      <button class="btn btn--primary" data-start>יאללה, מתחילים</button>
      <button class="btn btn--text" data-login>כבר יש לי חשבון</button>
    </div>`,

  bind() {
    $('[data-start]').onclick = () => navigate('name');
    $('[data-login]').onclick = () => navigate('login');
  },
};

/* ---------- שלב 1: שם ואווטאר ---------- */

Screens.name = {
  html: () => `
    ${progressBar('name')}
    <div class="screen__body">
      <p class="eyebrow">שלב 1</p>
      <h1>מה השם שלכם?</h1>
      <p class="lead">ככה יראו אתכם בפיד ובתגובות.</p>

      <div class="field" style="margin-top:28px">
        <label class="field__label" for="name">שם</label>
        <input id="name" class="input ${errors.name ? 'input--error' : ''}"
               value="${esc(draft.name || '')}" placeholder="למשל: עומר לוי"
               autocomplete="name" maxlength="30">
        ${errorFor('name')}
      </div>

      <div class="field">
        <label class="field__label">מגדר</label>
        <div class="chips">
          ${Store.GENDERS.map((g) => `
            <button type="button" class="chip" data-gender="${g.id}"
                    aria-pressed="${draft.gender === g.id}">${g.label}</button>`).join('')}
        </div>
        ${errorFor('gender')}
      </div>

      <div class="field">
        <label class="field__label">איזו רגל קדימה?</label>
        <div class="choices">
          ${Store.STANCES.map((s) => `
            <button type="button" class="choice choice--slim" data-stance="${s.id}"
                    aria-pressed="${draft.stance === s.id}">
              <span style="flex:1">
                <span class="choice__title">${s.label}</span>
                <span class="choice__desc">${s.hint}</span>
              </span>
              <span class="choice__check">✓</span>
            </button>`).join('')}
        </div>
        ${errorFor('stance')}
      </div>

      <div class="field">
        <label class="field__label">בחרו אווטאר</label>
        <div class="avatars">
          ${Store.AVATARS.map((a) => `
            <button type="button" class="avatar-opt" data-avatar="${a}"
                    aria-pressed="${(draft.avatar || '🛹') === a}">${a}</button>`).join('')}
        </div>
      </div>
    </div>

    <div class="screen__footer">
      <button class="btn btn--primary" data-next>המשך</button>
    </div>`,

  bind() {
    const input = $('#name');
    input.oninput = () => { draft.name = input.value; persist(); };

    $$('[data-gender]').forEach((btn) => {
      btn.onclick = () => {
        draft.gender = btn.dataset.gender;
        persist();
        $$('[data-gender]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      };
    });

    $$('[data-stance]').forEach((btn) => {
      btn.onclick = () => {
        draft.stance = btn.dataset.stance;
        persist();
        $$('[data-stance]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      };
    });

    $$('[data-avatar]').forEach((btn) => {
      btn.onclick = () => {
        draft.avatar = btn.dataset.avatar;
        persist();
        $$('[data-avatar]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      };
    });

    $('[data-next]').onclick = () => {
      errors = {};
      if ((draft.name || '').trim().length < 2) errors.name = 'צריך שם של שני תווים לפחות';
      if (!draft.gender) errors.gender = 'בחרו אחת מהאפשרויות';
      if (!draft.stance) errors.stance = 'בחרו רגולר, גופי או "עוד לא יודע"';
      if (Object.keys(errors).length) return rerender();
      navigate('birth');
    };
  },
};

/* ---------- שלב 2: תאריך לידה ---------- */

Screens.birth = {
  html() {
    const dob = draft.dob || {};
    const thisYear = new Date().getFullYear();
    const years = Array.from({ length: 85 }, (_, i) => thisYear - 4 - i);
    const cls = errors.dob ? 'select select--error' : 'select';

    return `
      ${progressBar('birth')}
      <div class="screen__body">
        <p class="eyebrow">שלב 2</p>
        <h1>מתי נולדתם?</h1>
        <p class="lead">לפי הגיל נתאים לכם תרגילים ותכנים ברמה הנכונה.</p>

        <div class="field" style="margin-top:28px">
          <label class="field__label">תאריך לידה</label>
          <div class="row">
            <select class="${cls}" data-dob="d" aria-label="יום">
              <option value="">יום</option>
              ${Array.from({ length: 31 }, (_, i) => i + 1).map((d) =>
                `<option value="${d}" ${dob.d === d ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
            <select class="${cls}" data-dob="m" aria-label="חודש" style="flex:1.4">
              <option value="">חודש</option>
              ${MONTHS.map((name, i) =>
                `<option value="${i + 1}" ${dob.m === i + 1 ? 'selected' : ''}>${name}</option>`).join('')}
            </select>
            <select class="${cls}" data-dob="y" aria-label="שנה">
              <option value="">שנה</option>
              ${years.map((y) =>
                `<option value="${y}" ${dob.y === y ? 'selected' : ''}>${y}</option>`).join('')}
            </select>
          </div>
          ${errorFor('dob')}
          <p class="field__hint">התאריך המלא לא מוצג לאף אחד — בפרופיל מופיע רק הגיל.</p>
        </div>
      </div>

      <div class="screen__footer">
        <button class="btn btn--primary" data-next>המשך</button>
      </div>`;
  },

  bind() {
    $$('[data-dob]').forEach((sel) => {
      sel.onchange = () => {
        draft.dob = { ...(draft.dob || {}), [sel.dataset.dob]: Number(sel.value) || null };
        persist();
      };
    });

    $('[data-next]').onclick = () => {
      const dob = draft.dob || {};
      if (!dob.d || !dob.m || !dob.y) {
        errors.dob = 'צריך למלא יום, חודש ושנה';
        return rerender();
      }
      if (!Store.isRealDate(dob)) {
        errors.dob = 'התאריך הזה לא קיים בלוח השנה';
        return rerender();
      }
      navigate('role');
    };
  },
};

/* ---------- שלב 3: תפקיד ---------- */

Screens.role = {
  html: () => `
    ${progressBar('role')}
    <div class="screen__body">
      <p class="eyebrow">שלב 3</p>
      <h1>מה מביא אתכם לפה?</h1>
      <p class="lead">אפשר לשנות את זה בכל רגע בהגדרות.</p>

      <div class="choices" style="margin-top:28px">
        ${Object.values(Store.ROLES).map((r) => `
          <button type="button" class="choice" data-role="${r.id}"
                  aria-pressed="${draft.role === r.id}">
            <span class="choice__icon">${r.icon}</span>
            <span style="flex:1">
              <span class="choice__title">${r.title}</span>
              <span class="choice__desc">${r.desc}</span>
            </span>
            <span class="choice__check">✓</span>
          </button>`).join('')}
      </div>
      ${errorFor('role')}
    </div>

    <div class="screen__footer">
      <button class="btn btn--primary" data-next>המשך</button>
    </div>`,

  bind() {
    $$('[data-role]').forEach((btn) => {
      btn.onclick = () => {
        draft.role = btn.dataset.role;
        persist();
        $$('[data-role]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      };
    });

    $('[data-next]').onclick = () => {
      if (!draft.role) {
        errors.role = 'בחרו אחת מהאפשרויות';
        return rerender();
      }
      navigate('details');
    };
  },
};

/* ---------- שלב 4: פרטים לפי תפקיד ---------- */

Screens.details = {
  html() {
    const isCoach = draft.role === 'coach';

    const levelBlock = isCoach ? '' : `
      <div class="field">
        <label class="field__label">איפה אתם עומדים היום?</label>
        <div class="chips">
          ${Store.LEVELS.map((l) => `
            <button type="button" class="chip" data-level="${esc(l)}"
                    aria-pressed="${draft.level === l}">${l}</button>`).join('')}
        </div>
        ${errorFor('level')}
      </div>`;

    const yearsBlock = !isCoach ? '' : `
      <div class="field">
        <label class="field__label" for="years">כמה שנים אתם רוכבים?</label>
        <select id="years" class="select ${errors.years ? 'select--error' : ''}">
          <option value="">בחרו</option>
          ${[1, 2, 3, 5, 7, 10, 15, 20].map((y) =>
            `<option value="${y}" ${draft.years === y ? 'selected' : ''}>${y}+ שנים</option>`).join('')}
        </select>
        ${errorFor('years')}
      </div>`;

    return `
      ${progressBar('details')}
      <div class="screen__body">
        <p class="eyebrow">שלב 4</p>
        <h1>${isCoach ? 'ספרו קצת על עצמכם' : 'עוד כמה שאלות קטנות'}</h1>
        <p class="lead">${isCoach
          ? 'זה מה שרוכבים יראו כשהם יחפשו מאמן באזור שלהם.'
          : 'ככה נדע אילו סרטונים ואילו מאמנים להראות לכם ראשונים.'}</p>

        <div style="margin-top:28px">
          <div class="field">
            <label class="field__label" for="region">באיזה אזור אתם רוכבים?</label>
            <select id="region" class="select ${errors.region ? 'select--error' : ''}">
              <option value="">בחרו אזור</option>
              ${Store.REGIONS.map((r) =>
                `<option value="${esc(r)}" ${draft.region === r ? 'selected' : ''}>${r}</option>`).join('')}
            </select>
            ${errorFor('region')}
          </div>

          ${levelBlock}
          ${yearsBlock}

          <div class="field">
            <label class="field__label" for="city">פארק ביתי <span class="muted">(לא חובה)</span></label>
            <input id="city" class="input" value="${esc(draft.city || '')}"
                   placeholder="למשל: פארק גלית, תל אביב" maxlength="40">
          </div>

          <div class="field">
            <label class="field__label">${isCoach ? 'במה אתם מתמחים?' : 'מה הכי מעניין אתכם?'}</label>
            <div class="chips">
              ${Store.STYLES.map((s) => `
                <button type="button" class="chip" data-style="${esc(s)}"
                        aria-pressed="${(draft.styles || []).includes(s)}">${s}</button>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="screen__footer">
        <button class="btn btn--primary" data-next>סיימנו, יוצרים חשבון</button>
      </div>`;
  },

  bind() {
    const isCoach = draft.role === 'coach';

    $$('[data-level]').forEach((btn) => {
      btn.onclick = () => {
        draft.level = btn.dataset.level;
        persist();
        $$('[data-level]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      };
    });

    $$('[data-style]').forEach((btn) => {
      btn.onclick = () => {
        const styles = new Set(draft.styles || []);
        const value = btn.dataset.style;
        styles.has(value) ? styles.delete(value) : styles.add(value);
        draft.styles = [...styles];
        persist();
        btn.setAttribute('aria-pressed', String(styles.has(value)));
      };
    });

    const region = $('#region');
    region.onchange = () => { draft.region = region.value || null; persist(); };

    const city = $('#city');
    city.oninput = () => { draft.city = city.value; persist(); };

    const years = $('#years');
    if (years) years.onchange = () => { draft.years = Number(years.value) || null; persist(); };

    $('[data-next]').onclick = () => {
      errors = {};
      if (!draft.region) errors.region = 'בחרו אזור';
      if (isCoach && !draft.years) errors.years = 'בחרו כמה שנים אתם רוכבים';
      if (!isCoach && !draft.level) errors.level = 'בחרו רמה';
      if (Object.keys(errors).length) return rerender();

      navigate('password');
    };
  },
};

/* ---------- שלב 5: סיסמה ---------- */

Screens.password = {
  async html() {
    needsInvite = await Store.inviteRequired();
    return `
    ${progressBar('password')}
    <div class="screen__body">
      <p class="eyebrow">שלב 5</p>
      <h1>בחרו סיסמה</h1>
      <p class="lead">תצטרכו אותה בפעם הבאה שתתחברו.</p>

      <div class="field" style="margin-top:28px">
        <label class="field__label" for="pw1">סיסמה</label>
        <input id="pw1" type="password" class="input ${errors.password ? 'input--error' : ''}"
               placeholder="לפחות ${Store.MIN_PASSWORD} תווים" autocomplete="new-password">
        ${errorFor('password')}
      </div>

      <div class="field">
        <label class="field__label" for="pw2">אימות סיסמה</label>
        <input id="pw2" type="password" class="input ${errors.password2 ? 'input--error' : ''}"
               placeholder="שוב, בשביל לוודא" autocomplete="new-password">
        ${errorFor('password2')}
      </div>

      ${needsInvite ? `
        <div class="field">
          <label class="field__label" for="invite">קוד הזמנה</label>
          <input id="invite" class="input ${errors.invite ? 'input--error' : ''}"
                 value="${esc(inviteCode)}" placeholder="הקוד שקיבלתם" autocomplete="off">
          <p class="field__hint">האפליקציה סגורה כרגע. בלי קוד אי אפשר להירשם.</p>
          ${errorFor('invite')}
        </div>` : ''}
      ${errorFor('submit')}
    </div>

    <div class="screen__footer">
      <button class="btn btn--primary" data-next ${busy ? 'disabled' : ''}>
        ${busy ? 'יוצרים חשבון…' : 'סיימנו, יוצרים חשבון'}
      </button>
    </div>`;
  },

  bind() {
    const submit = async () => {
      const pw1 = $('#pw1').value;
      const pw2 = $('#pw2').value;

      errors = {};
      if (pw1.length < Store.MIN_PASSWORD) {
        errors.password = `הסיסמה צריכה להיות באורך ${Store.MIN_PASSWORD} תווים לפחות`;
      }
      if (pw1 !== pw2) errors.password2 = 'הסיסמאות לא זהות';
      if (Object.keys(errors).length) return rerender();

      inviteCode = $('#invite')?.value || '';
      if (needsInvite && !inviteCode.trim()) {
        errors.invite = 'צריך קוד הזמנה';
        return rerender();
      }

      busy = true;
      rerender();
      try {
        await Store.register(draft, pw1, inviteCode);
        draft = {};
        inviteCode = '';
        navigate('done');
      } catch (err) {
        errors.submit = err.message;
      } finally {
        busy = false;
        rerender();
      }
    };

    $('[data-next]').onclick = submit;
    $('#pw2').onkeydown = (e) => { if (e.key === 'Enter') submit(); };
  },
};

/* ---------- סיום ---------- */

Screens.done = {
  html: () => `
    <div class="hero" style="gap:0">
      <div class="hero__mark" style="animation:none">🎉</div>
      <h1>החשבון מוכן!</h1>
      <p class="lead">ברוכים הבאים ל-Skate Lab. בואו נראה מה מחכה לכם.</p>
    </div>
    <div class="screen__footer">
      <button class="btn btn--primary" data-home>קחו אותי לפיד</button>
    </div>`,

  bind() {
    $('[data-home]').onclick = () => navigate('feed');
  },
};

/* ---------- כניסה לחשבון קיים ---------- */

Screens.login = {
  html: () => `
    <div class="topbar">
      <button class="iconbtn" data-back aria-label="חזרה">→</button>
    </div>
    <div class="screen__body">
      <h1>ברוכים השבים</h1>
      <p class="lead">הכניסו את השם והסיסמה שנרשמתם איתם.</p>

      <div class="field" style="margin-top:28px">
        <label class="field__label" for="login-name">שם</label>
        <input id="login-name" class="input ${errors.login ? 'input--error' : ''}"
               value="${esc(errors.loginValue || '')}" placeholder="למשל: עומר לוי" autocomplete="username">
      </div>

      <div class="field">
        <label class="field__label" for="login-pw">סיסמה</label>
        <input id="login-pw" type="password" class="input ${errors.login ? 'input--error' : ''}"
               placeholder="הסיסמה שלכם" autocomplete="current-password">
        ${errorFor('login')}
      </div>
    </div>
    <div class="screen__footer">
      <button class="btn btn--primary" data-enter ${busy ? 'disabled' : ''}>
        ${busy ? 'נכנסים…' : 'כניסה'}
      </button>
      <button class="btn btn--text" data-signup>אין לי חשבון — הרשמה</button>
    </div>`,

  bind() {
    const name = $('#login-name');
    const pw = $('#login-pw');
    (name.value ? pw : name).focus();

    const submit = async () => {
      errors = {};
      busy = true;
      rerender();
      try {
        await Store.login(name.value, pw.value);
        navigate('feed');
      } catch (err) {
        errors.login = err.message;
        errors.loginValue = name.value;
      } finally {
        busy = false;
        rerender();
      }
    };

    $('[data-enter]').onclick = submit;
    pw.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
    $('[data-signup]').onclick = () => navigate('name');
  },
};
