/* ==========================================================================
   UI — ניווט בין מסכים + רכיבים משותפים
   כל מסך הוא אובייקט ב-Screens עם html(params) ו-bind(params) אופציונלי.
   ========================================================================== */

const app = document.getElementById('app');

/** מרשם המסכים. onboarding.js ו-app.js מוסיפים אליו. */
const Screens = {};

let ME = null;          // המשתמש המחובר, מרוענן בכל ניווט
let PENDING = 0;        // בקשות חברות שממתינות לאישור שלי
let WAITING = 0;        // תגובות על הסרטונים שלי שעוד לא עניתי עליהן
let errors = {};        // שגיאות ולידציה של המסך הנוכחי
let current = null;     // {name, params} של המסך שמוצג עכשיו
const trail = [];       // היסטוריית ניווט לכפתור החזרה

/*
 * הגנה מפני מעבר כפול בין מסכים.
 * כפתור "המשך" וחץ החזרה יושבים בדיוק באותו מקום בכל שלב בהרשמה, ולכן לחיצה
 * כפולה (או קליק רפאים של מגע במובייל) נוחתת על הכפתור של המסך *הבא* ומדלגת
 * עליו — מבחוץ זה נראה כאילו האפליקציה מדלגת בין דפים לבד.
 */
let navBusy = false;
let paintedAt = 0;
const SETTLE_MS = 300;

/** עולה בכל כניסה למסך (ולא ברענון במקום) — משמש לספירת צפייה פעם אחת. */
let visitSeq = 0;

/* ---------- עזרים ---------- */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const $ = (sel) => app.querySelector(sel);
const $$ = (sel) => Array.from(app.querySelectorAll(sel));

const errorFor = (key) =>
  errors[key] ? `<p class="field__error">${esc(errors[key])}</p>` : '';

/** "12 סרטונים" אבל "סרטון אחד" — בעברית אי אפשר לכתוב "1 סרטונים". */
const countLabel = (n, one, many) => (n === 1 ? one : `${n} ${many}`);

/**
 * "לפני 3 ימים" וכו'. בעברית צורת היחיד והזוגי שונות מצורת הרבים,
 * אז "לפני 1 ימים" או "לפני 2 חודשים" הם שגיאה.
 */
function timeAgo(iso) {
  const plural = (n, one, two, many) => (n === 1 ? one : n === 2 ? two : `לפני ${n} ${many}`);

  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'עכשיו';
  if (mins < 60) return plural(mins, 'לפני דקה', 'לפני שתי דקות', 'דקות');

  const hours = Math.floor(mins / 60);
  if (hours < 24) return plural(hours, 'לפני שעה', 'לפני שעתיים', 'שעות');

  const days = Math.floor(hours / 24);
  if (days < 30) return plural(days, 'אתמול', 'לפני יומיים', 'ימים');

  const months = Math.floor(days / 30);
  if (months < 12) return plural(months, 'לפני חודש', 'לפני חודשיים', 'חודשים');

  const years = Math.floor(months / 12);
  return plural(years, 'לפני שנה', 'לפני שנתיים', 'שנים');
}

/* ---------- ניווט ---------- */

async function paint(entry, dir) {
  const screen = Screens[entry.name];
  const cls = dir === 'back' ? ' back' : dir === 'none' ? ' no-anim' : '';
  const scroll = dir === 'none' ? app.scrollTop : 0;

  let body;
  try {
    body = await screen.html(entry.params);
  } catch (err) {
    // בלי זה כשל בציור משאיר את המסך הישן על המסך בלי שום סימן שמשהו נשבר
    console.error(`ציור המסך ${entry.name} נכשל:`, err);
    body = `<div class="screen__body">${empty('⚠️', 'משהו השתבש',
      'לא הצלחנו לטעון את המסך הזה. בדקו את החיבור לשרת ונסו שוב.')}
      <button class="btn btn--ghost" data-retry style="margin-top:16px">ניסיון חוזר</button></div>`;
  }

  app.innerHTML = `<section class="screen${cls}">${body}</section>`;
  app.scrollTop = scroll;

  const retry = $('[data-retry]');
  if (retry) retry.onclick = () => paint(entry, 'none');

  // חיווט הניווט קודם ל-bind: אם bind ייפול, המשתמש עדיין יוכל לצאת מהמסך
  const backBtn = $('[data-back]');
  if (backBtn) backBtn.onclick = goBack;
  $$('[data-tab]').forEach((btn) => {
    btn.onclick = () => navigate(btn.dataset.tab);
  });

  try {
    await screen.bind?.(entry.params);
  } catch (err) {
    console.error(`bind נכשל במסך ${entry.name}:`, err);
  }

  // רענון במקום (סינון, שגיאת ולידציה) לא אמור להשהות את הלחיצה הבאה
  if (dir !== 'none') {
    paintedAt = Date.now();

    // חסימת הקלקות על המסך הטרי: הלחיצה השנייה של קליק כפול נוחתת על הכפתור
    // של המסך החדש. חסימת ניווט בלבד לא הספיקה — הלחיצה עדיין הפעילה ולידציה
    // והמשתמש קיבל שגיאה אדומה על שדה שעוד לא הספיק למלא.
    const section = app.firstElementChild;
    section.classList.add('is-settling');
    setTimeout(() => section.classList.remove('is-settling'), SETTLE_MS);
  }
}

/**
 * האם לחסום מעבר מסך שנגרם מלחיצה?
 * חוסם רק מעברים שמקורם באינטראקציה — רענון יזום (dir === 'none') תמיד עובר.
 */
function blocked(dir) {
  if (dir === 'none') return false;
  if (navBusy) return true;
  return Date.now() - paintedAt < SETTLE_MS;
}

/** מעבר למסך חדש. מרענן את המשתמש המחובר ומנקה שגיאות. */
async function navigate(name, params = {}, dir) {
  if (blocked(dir)) return;
  navBusy = true;
  if (dir !== 'none') visitSeq += 1;
  try {
    errors = {};
    ME = await Store.currentUser();
    [PENDING, WAITING] = ME
      ? await Promise.all([Store.countIncomingRequests(), Store.countWaiting()])
      : [0, 0];
    current = { name, params };

    // רענון במקום מחליף את הרשומה הנוכחית. אחרת כל הודעה בצ'אט הייתה
    // מוסיפה כניסה להיסטוריה, וכפתור החזרה היה נראה כאילו הוא לא עושה כלום.
    if (dir === 'none' && trail.length) trail[trail.length - 1] = current;
    else trail.push(current);

    await paint(current, dir);
  } finally {
    navBusy = false;
  }
}

/** חזרה למסך הקודם. */
async function goBack() {
  if (blocked()) return;
  if (trail.length < 2) return navigate('feed');

  navBusy = true;
  visitSeq += 1;
  try {
    trail.pop();
    current = trail[trail.length - 1];
    errors = {};
    ME = await Store.currentUser();
    [PENDING, WAITING] = ME
      ? await Promise.all([Store.countIncomingRequests(), Store.countWaiting()])
      : [0, 0];
    await paint(current, 'back');
  } finally {
    navBusy = false;
  }
}

/** ציור מחדש של אותו מסך — שומר על errors ועל מיקום הגלילה. */
const rerender = () => paint(current, 'none');

/**
 * רענון המונים על סרגל הטאבים בלי לצייר מחדש את המסך.
 * נחוץ אחרי פעולה שמשנה מונה בזמן שנשארים באותו מסך — למשל מאמן שעונה
 * על שאלה ולא אמור להמשיך לראות "1 מחכה".
 */
async function refreshBadges() {
  if (!ME) return;
  [PENDING, WAITING] = await Promise.all([
    Store.countIncomingRequests(), Store.countWaiting(),
  ]);

  TABS.forEach((t) => {
    if (!t.badge) return;
    const icon = app.querySelector(`[data-tab="${t.id}"] .tab__icon`);
    if (!icon) return;

    const n = badgeCount(t);
    const existing = icon.querySelector('.tab__badge');
    if (!n) return existing?.remove();

    if (existing) existing.textContent = n;
    else icon.insertAdjacentHTML('beforeend', `<span class="tab__badge">${n}</span>`);
  });
}

/* ---------- רכיבים משותפים ---------- */

const TABS = [
  { id: 'feed', icon: '🏠', label: 'פיד' },
  { id: 'coaches', icon: '🎓', label: 'אנשים' },
  { id: 'myvideos', icon: '🎬', label: 'סרטונים', primary: true, badge: 'waiting' },
  { id: 'chats', icon: '💬', label: 'צ׳אטים', badge: 'pending' },
  { id: 'aicoach', icon: '🤖', label: 'AI' },
  { id: 'profile', icon: '👤', label: 'פרופיל' },
];

function tabbar(active) {
  const badgeFor = (t) => {
    const n = badgeCount(t);
    return n ? `<span class="tab__badge">${n}</span>` : '';
  };

  return `
    <nav class="tabbar">
      ${TABS.map((t) => `
        <button class="tab ${t.primary ? 'tab--primary' : ''} ${active === t.id ? 'is-active' : ''}"
                data-tab="${t.id}" aria-current="${active === t.id}">
          <span class="tab__icon">
            ${t.icon}
            ${badgeFor(t)}
          </span>
          <span class="tab__label">${t.label}</span>
        </button>`).join('')}
    </nav>`;
}

/** כמה להציג על התג של טאב מסוים. */
const badgeCount = (t) =>
  t.badge === 'pending' ? PENDING :
  t.badge === 'waiting' ? WAITING :
  0;

/** כותרת מסך עם כפתור חזרה אופציונלי. */
function header(title, { back = false, action = '' } = {}) {
  return `
    <div class="header">
      ${back ? '<button class="iconbtn" data-back aria-label="חזרה">→</button>' : ''}
      <h2 class="header__title">${esc(title)}</h2>
      ${action}
    </div>`;
}

/** כרטיס סרטון בפיד. */
function videoCard(v) {
  const liked = ME && (v.likedBy || []).includes(ME.id);
  return `
    <article class="vcard" data-video="${v.id}" role="button" tabindex="0">
      <div class="vcard__poster">
        <!-- האימוג׳י תמיד מצויר מתחת. אם התמונה לא נטענת היא מסירה את עצמה
             והאימוג׳י נחשף — כך שאף פעם אין כרטיס ריק. -->
        <span class="vcard__emoji">${esc(v.poster || '🛹')}</span>
        ${v.hasThumb
          ? `<img class="vcard__img" src="${Media.thumbUrl(v)}" alt=""
                  loading="lazy" onerror="this.remove()">`
          : ''}
        <span class="vcard__play">▶</span>
        ${v.kind === 'clip' ? '<span class="vcard__badge">טריק לפידבק</span>' : ''}
        ${v.isDemo ? '<span class="vcard__demo">דוגמה</span>' : ''}
      </div>
      <div class="vcard__body">
        <h3 class="vcard__title">${esc(v.title)}</h3>
        <div class="vcard__meta">
          <span class="mini-avatar">${esc(v.author.avatar)}</span>
          <span>${esc(v.author.name)}</span>
          ${v.author.role === 'coach' ? '<span class="tag tag--coach">מאמן</span>' : ''}
          <span class="dot">·</span>
          <span>${timeAgo(v.createdAt)}</span>
        </div>
        <div class="vcard__chips">
          ${v.region ? `<span class="tag">📍 ${esc(v.region)}</span>` : ''}
          ${v.level ? `<span class="tag">${esc(v.level)}</span>` : ''}
          ${(v.styles || []).slice(0, 2).map((s) => `<span class="tag">${esc(s)}</span>`).join('')}
        </div>
        <div class="vcard__actions">
          <span class="vaction ${liked ? 'is-on' : ''}">${liked ? '❤️' : '🤍'} ${(v.likedBy || []).length}</span>
          <span class="vaction">💬 ${v.commentCount ?? (v.comments || []).length}</span>
          <span class="vaction">👁 ${v.views || 0}</span>
        </div>
      </div>
    </article>`;
}

/**
 * כרטיס של אדם בקהילה — מאמן, תלמיד או סקייטר.
 * למאמן מוצג כפתור מועדפים; לרוכב מוצג כפתור צ׳אט, כי אחריו לא עוקבים.
 */
function personCard(p, following) {
  const isCoach = p.role === 'coach';
  const role = Store.ROLES[p.role];

  const stats = isCoach
    ? `${countLabel(p.stats.videos, 'סרטון אחד', 'סרטונים')} ·
       <span data-followers>${countLabel(p.stats.followers, 'עוקב אחד', 'עוקבים')}</span>
       ${p.years ? ` · ${p.years}+ שנים` : ''}`
    : `${countLabel(p.stats.videos, 'סרטון אחד', 'סרטונים')}${p.level ? ` · ${esc(p.level)}` : ''}`;

  const action = isCoach
    ? `<button class="follow ${following ? 'is-on' : ''}" data-follow="${p.id}"
               aria-pressed="${following}">${following ? '★ במועדפים' : '☆ הוסיפו'}</button>`
    : `<button class="follow" data-message="${p.id}">💬 צ׳אט</button>`;

  return `
    <article class="ccard">
      <button class="ccard__main" data-user="${p.id}">
        <span class="ccard__avatar">${esc(p.avatar)}</span>
        <span class="ccard__info">
          <span class="ccard__name">
            ${esc(p.name)}
            ${isCoach ? '<span class="tag tag--coach">מאמן</span>' : `<span class="tag">${role.icon} ${role.title}</span>`}
          </span>
          <span class="ccard__where">📍 ${esc(p.region || '—')}${p.city ? ` · ${esc(p.city)}` : ''}</span>
          <span class="ccard__stats">${stats}</span>
          <span class="ccard__chips">
            ${p.styles.slice(0, 3).map((s) => `<span class="tag">${esc(s)}</span>`).join('')}
          </span>
        </span>
      </button>
      ${action}
    </article>`;
}

/** שם ישן שנשאר בשימוש במסכים שמציגים מאמנים בלבד. */
const coachCard = personCard;

/** מצב ריק אחיד. */
const empty = (icon, title, text) => `
  <div class="empty">
    <div class="empty__icon">${icon}</div>
    <h3>${esc(title)}</h3>
    <p class="small muted">${esc(text)}</p>
  </div>`;

/** מחבר את הלחיצות על כרטיסי סרטון ומאמן — משותף לכמה מסכים. */
function bindCards() {

  $$('[data-video]').forEach((el) => {
    const open = () => navigate('video', { id: el.dataset.video });
    el.onclick = open;
    el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
  });

  $$('[data-user]').forEach((el) => {
    el.onclick = () => navigate('user', { id: el.dataset.user });
  });

  // כפתור הצ׳אט על כרטיס של רוכב: פותח שיחה קיימת, או שולח בקשת חברות
  $$('[data-message]').forEach((el) => {
    el.onclick = async (e) => {
      e.stopPropagation();
      const id = el.dataset.message;

      const existing = await Store.chatWith(id);
      if (existing) return navigate('chat', { id: existing.id });

      const state = await Store.friendState(id);
      if (state === 'sent') {
        el.textContent = '⏳ ממתין';
        el.disabled = true;
        return;
      }
      // כל שאר המצבים (בקשה נכנסת, עוד לא נשלח כלום) נפתרים בפרופיל עצמו
      navigate('user', { id });
    };
  });

  $$('[data-follow]').forEach((el) => {
    el.onclick = async (e) => {
      e.stopPropagation();
      const on = await Store.toggleFollow(el.dataset.follow);
      ME = await Store.currentUser();
      el.classList.toggle('is-on', on);
      el.setAttribute('aria-pressed', String(on));
      el.textContent = on ? '★ במועדפים' : '☆ הוסיפו';

      // עדכון מספר העוקבים על אותו כרטיס, אחרת הוא נשאר תקוע עד ניווט
      const coach = await Store.getUser(el.dataset.follow);
      const counter = el.closest('.ccard')?.querySelector('[data-followers]');
      if (coach && counter) {
        counter.textContent = countLabel(coach.stats.followers, 'עוקב אחד', 'עוקבים');
      }
    };
  });
}
