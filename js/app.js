/* ==========================================================================
   App — המסכים הראשיים: פיד, מאמנים, העלאה, חיפוש, צ'אטים, פרופיל
   ========================================================================== */

/** מצב הפילטרים של הפיד — נשמר בין מעברי טאבים. */
const feedFilter = { region: null, kind: null, onlyFollowed: false };

/** קובץ הווידאו והתמונה הממוזערת שנבחרו במסך ההעלאה, עד לפרסום. */
let pendingFile = null;
let pendingThumb = null;
let pendingThumbUrl = null;

function clearPendingThumb() {
  if (pendingThumbUrl) URL.revokeObjectURL(pendingThumbUrl);
  pendingThumb = null;
  pendingThumbUrl = null;
}

/**
 * איפוס כל מצב המסכים ביציאה מהחשבון.
 * בלי זה המשתמש הבא יורש את הסינון, את הטופס — ואפילו את קובץ הווידאו
 * שהמשתמש הקודם בחר ולא פרסם.
 */
function resetScreenState() {
  editDraft = null;
  trail.length = 0;
  clearPendingThumb();
  pendingFile = null;
  Object.assign(feedFilter, { region: null, kind: null, onlyFollowed: false });
  Object.assign(coachFilter, { region: null, style: null, query: '', onlyFollowed: false });
  Object.assign(search, { query: '', region: null, kind: null, tab: 'videos' });
  Object.assign(upload, { kind: undefined, title: '', desc: '', level: null, region: undefined, styles: [], poster: '🛹' });
}

/** שורת צ'יפים לסינון לפי אזור. */
function regionFilterRow(selected, attr = 'data-region') {
  return `
    <div class="filterrow">
      <button class="chip chip--sm" ${attr}="" aria-pressed="${!selected}">כל האזורים</button>
      ${Store.REGIONS.map((r) => `
        <button class="chip chip--sm" ${attr}="${esc(r)}"
                aria-pressed="${selected === r}">${r}</button>`).join('')}
    </div>`;
}

/** סינון לפי סוג הסרטון: שיעור ממאמן מול טריק שהועלה לפידבק. */
function kindFilterRow(selected) {
  return `
    <div class="segmented" style="margin-top:12px">
      <button class="seg ${!selected ? 'is-on' : ''}" data-kind="">הכל</button>
      ${Store.KINDS.map((k) => `
        <button class="seg ${selected === k.id ? 'is-on' : ''}" data-kind="${k.id}">
          ${k.icon} ${k.label}
        </button>`).join('')}
    </div>`;
}

/** הודעת "אין תוצאות" שמסבירה איזה סינון בדיוק ריקן את הרשימה. */
function emptyVideos({ kind, onlyFollowed, region }) {
  if (onlyFollowed) {
    if (!(ME?.following || []).length) {
      return empty('⭐️', 'אין כאן עדיין כלום',
                   `${gt('הוסף','הוסיפי','הוסיפו')} מאמנים למועדפים בלשונית "מאמנים", והסרטונים שלהם יופיעו כאן.`);
    }
    return empty('⭐️', 'אין סרטונים בסינון הזה',
                 `למאמנים שבמועדפים ${gt('שלך','שלך','שלכם')} אין סרטונים שמתאימים לסינון. ${gt('נסה','נסי','נסו')} סוג אחר או אזור אחר.`);
  }
  if (kind === 'lesson') {
    return empty('🎓', 'עדיין אין שיעורים',
                 region ? `אין שיעורים באזור הזה. ${gt('נסה','נסי','נסו')} אזור אחר.` : 'ברגע שיעלו שיעורים הם יופיעו כאן.');
  }
  if (kind === 'clip') {
    return empty('⭐️', 'אין טריקים לפידבק',
                 region ? 'אף רוכב באזור הזה לא העלה טריק עדיין.'
                        : `${gt('היה הראשון','היי הראשונה','היו הראשונים')} — ${gt('העלה','העלי','העלו')} טריק ${gt('וקבל','וקבלי','וקבלו')} עליו פידבק.`);
  }
  return region
    ? empty('🎬', 'אין סרטונים באזור הזה', `${gt('נסה','נסי','נסו')} אזור אחר או ${gt('הסר','הסירי','הסירו')} את הסינון.`)
    : empty('🎬', 'אין עדיין סרטונים', 'ברגע שיעלו סרטונים הם יופיעו כאן.');
}

/* ==========================================================================
   פיד
   ========================================================================== */

Screens.feed = {
  async html() {
    const videos = await Store.listVideos({
      region: feedFilter.region,
      kind: feedFilter.kind,
      onlyFollowed: feedFilter.onlyFollowed,
    });

    const list = videos.length
      ? videos.map(videoCard).join('')
      : emptyVideos(feedFilter);

    return `
      <div class="screen__body has-tabs">
        ${header('הפיד שלי', {
          action: '<button class="iconbtn" data-goto-search aria-label="חיפוש">🔍</button>',
        })}

        <div class="segmented">
          <button class="seg ${!feedFilter.onlyFollowed ? 'is-on' : ''}" data-scope="all">הכל</button>
          <button class="seg ${feedFilter.onlyFollowed ? 'is-on' : ''}" data-scope="fav">המועדפים שלי</button>
        </div>

        ${kindFilterRow(feedFilter.kind)}
        ${regionFilterRow(feedFilter.region)}

        <p class="small muted" style="margin:14px 0 10px">${countLabel(videos.length, 'סרטון אחד', 'סרטונים')}</p>
        <div class="vlist">${list}</div>
      </div>
      ${tabbar('feed')}`;
  },

  bind() {
    $('[data-goto-search]').onclick = () => navigate('search');

    $$('[data-scope]').forEach((btn) => {
      btn.onclick = () => {
        feedFilter.onlyFollowed = btn.dataset.scope === 'fav';
        rerender();
      };
    });

    $$('[data-region]').forEach((btn) => {
      btn.onclick = () => {
        feedFilter.region = btn.dataset.region || null;
        rerender();
      };
    });

    $$('[data-kind]').forEach((btn) => {
      btn.onclick = () => {
        feedFilter.kind = btn.dataset.kind || null;
        rerender();
      };
    });

    bindCards();
  },
};

/* ==========================================================================
   מאמנים — סינון לפי אזור, סגנון וחיפוש חופשי
   ========================================================================== */

/** role: null = כולם, אחרת מזהה תפקיד מתוך Store.ROLES. */
const coachFilter = { region: null, style: null, query: '', role: 'coach', onlyFollowed: false };

/** לשוניות התפקיד בראש מסך האנשים. */
const PEOPLE_TABS = [
  { id: 'coach', label: '🎓 מאמנים' },
  { id: null, label: '🛹 כולם' },
  { id: 'fav', label: '★ מועדפים' },
];

Screens.coaches = {
  async html() {
    return `
      <div class="screen__body has-tabs">
        ${header('אנשים')}

        <div class="searchbar">
          <span class="searchbar__icon">🔍</span>
          <input id="coach-q" class="input input--search" placeholder="שם, פארק או סגנון"
                 value="${esc(coachFilter.query)}">
        </div>

        <div class="segmented" style="margin-top:12px">
          ${PEOPLE_TABS.map((t) => {
            const on = t.id === 'fav'
              ? coachFilter.onlyFollowed
              : !coachFilter.onlyFollowed && coachFilter.role === t.id;
            return `<button class="seg ${on ? 'is-on' : ''}" data-ptab="${t.id ?? ''}">${t.label}</button>`;
          }).join('')}
        </div>

        ${regionFilterRow(coachFilter.region)}

        <div class="filterrow">
          <button class="chip chip--sm" data-style="" aria-pressed="${!coachFilter.style}">כל הסגנונות</button>
          ${Store.STYLES.map((s) => `
            <button class="chip chip--sm" data-style="${esc(s)}"
                    aria-pressed="${coachFilter.style === s}">${s}</button>`).join('')}
        </div>

        <div id="coach-results" style="margin-top:16px">${await Screens.coaches.results()}</div>
      </div>
      ${tabbar('coaches')}`;
  },

  /** רק רשימת התוצאות — מצויר מחדש בנפרד כדי שתיבת החיפוש לא תאבד פוקוס. */
  async results() {
    const people = coachFilter.onlyFollowed
      ? await Store.listCoaches({ ...coachFilter, onlyFollowed: true })
      : await Store.listPeople(coachFilter);

    if (!people.length) {
      const noOtherFilter = !coachFilter.region && !coachFilter.style && !coachFilter.query.trim();
      if (coachFilter.onlyFollowed && noOtherFilter) {
        return empty('⭐️', 'אין עדיין מועדפים',
                     `${gt('עבור','עברי','עברו')} ל"מאמנים" ${gt('והוסף','והוסיפי','והוסיפו')} את מי ${gt('שאתה רוצה','שאת רוצה','שאתם רוצים')} לעקוב אחריו.`);
      }
      return empty('🔍', 'לא נמצא אף אחד',
                   `${gt('נסה','נסי','נסו')} אזור אחר או סגנון אחר, או ${gt('מחק','מחקי','מחקו')} את מה ${gt('שכתבת','שכתבת','שכתבתם')} בחיפוש.`);
    }

    const following = ME?.following || [];
    return `
      <p class="small muted" style="margin-bottom:10px">${countLabel(people.length, 'תוצאה אחת', 'תוצאות')}</p>
      <div class="clist">
        ${people.map((p) => personCard(p, following.includes(p.id))).join('')}
      </div>`;
  },

  bind() {
    const refresh = async () => {
      $('#coach-results').innerHTML = await Screens.coaches.results();
      bindCards();
    };

    const input = $('#coach-q');
    input.oninput = () => { coachFilter.query = input.value; refresh(); };

    $$('[data-ptab]').forEach((btn) => {
      btn.onclick = () => {
        const value = btn.dataset.ptab;
        coachFilter.onlyFollowed = value === 'fav';
        if (value !== 'fav') coachFilter.role = value || null;
        rerender();
      };
    });

    $$('[data-region]').forEach((btn) => {
      btn.onclick = () => { coachFilter.region = btn.dataset.region || null; rerender(); };
    });

    $$('[data-style]').forEach((btn) => {
      btn.onclick = () => { coachFilter.style = btn.dataset.style || null; rerender(); };
    });

    bindCards();
  },
};

/* ==========================================================================
   פרופיל של משתמש אחר — מאמן או רוכב
   ========================================================================== */

/** כפתור בקשת החברות, לפי מצב הקשר בינינו. */
function friendButton(id, state) {
  if (state === 'self' || (state === 'none' && !ME)) return '';
  switch (state) {
    case 'friends':
      return `<button class="btn btn--primary" data-open-chat="${id}">💬 לצ׳אט</button>`;
    case 'sent':
      return `<button class="btn btn--ghost" disabled>⏳ ממתין לאישור</button>`;
    case 'incoming':
      return `<button class="btn btn--primary" data-accept-from="${id}">✓ אישור הבקשה</button>`;
    default:
      return `<button class="btn btn--primary" data-add-friend="${id}">➕ בקשת חברות</button>`;
  }
}

Screens.user = {
  async html({ id }) {
    const user = await Store.getUser(id);
    if (!user) return `${header('פרופיל', { back: true })}${empty('🤷', 'המשתמש לא נמצא', '')}${tabbar('coaches')}`;

    const isCoach = user.role === 'coach';
    const role = Store.ROLES[user.role];
    const videos = await Store.listVideos({ authorId: id });
    const following = (ME?.following || []).includes(id);
    const state = ME ? await Store.friendState(id) : 'none';
    const gender = Store.GENDERS.find((g) => g.id === user.gender);
    const stance = Store.STANCES.find((s) => s.id === user.stance);

    const meta = [
      user.age ? `${user.age}` : '',
      `📍 ${user.region || '—'}`,
      user.city || '',
      user.level || '',
      stance && stance.id !== 'unknown' ? stance.label : '',
      user.years ? `${user.years}+ שנות רכיבה` : '',
      gender && gender.id !== 'na' ? gender.label : '',
    ].filter(Boolean).map(esc).join(' · ');

    return `
      <div class="screen__body has-tabs">
        ${header(isCoach ? 'פרופיל מאמן' : 'פרופיל רוכב', { back: true })}

        <div class="card profile">
          <div class="profile__avatar">${esc(user.avatar)}</div>
          <div class="profile__name">${esc(user.name)}</div>
          <div class="profile__role">${role.icon} ${role.title}</div>
          <p class="small muted" style="margin-top:10px">${meta}</p>
          ${user.bio ? `<p class="small" style="margin-top:12px;line-height:1.6">${esc(user.bio)}</p>` : ''}
          ${user.styles.length ? `
            <div class="chips" style="justify-content:center;margin-top:14px">
              ${user.styles.map((s) => `<span class="tag">${esc(s)}</span>`).join('')}
            </div>` : ''}
          <div class="stats">
            <div class="stat"><div class="stat__num">${user.stats.videos}</div><div class="stat__label">סרטונים</div></div>
            ${isCoach ? `<div class="stat"><div class="stat__num">${user.stats.answers}</div><div class="stat__label">תשובות</div></div>` : ''}
            <div class="stat"><div class="stat__num">${user.stats.followers}</div><div class="stat__label">עוקבים</div></div>
          </div>
        </div>

        <div class="btnstack">
          ${friendButton(id, state)}
          ${errorFor('friend')}
          ${isCoach && state !== 'self' ? `
            <button class="btn btn--ghost" data-follow-big="${id}">
              ${following ? '★ במועדפים שלי' : `☆ ${gt('הוסף','הוסיפי','הוסיפו')} למועדפים`}
            </button>` : ''}
        </div>

        ${await bagSection(id, { mine: false })}

        <h3 style="margin:26px 0 12px">הסרטונים של ${esc(user.name)}</h3>
        <div class="vlist">
          ${videos.length ? videos.map(videoCard).join('') : empty('🎬', 'אין עדיין סרטונים', '')}
        </div>
      </div>
      ${tabbar('coaches')}`;
  },

  bind({ id }) {
    bindBag(id, () => rerender());

    const follow = $('[data-follow-big]');
    if (follow) {
      follow.onclick = async () => {
        await Store.toggleFollow(id);
        ME = await Store.currentUser();
        rerender();
      };
    }

    const add = $('[data-add-friend]');
    if (add) {
      add.onclick = async () => {
        errors = {};
        try {
          // מאמן דמו מאשר את הבקשה מיד בצד השרת, אז המצב עשוי לקפוץ ישר ל"חברים"
          await Store.sendFriendRequest(id);
        } catch (err) {
          errors.friend = err.message;
        }
        await navigate('user', { id }, 'none');
      };
    }

    const accept = $('[data-accept-from]');
    if (accept) {
      accept.onclick = async () => {
        const incoming = await Store.listIncomingRequests();
        const req = incoming.find((r) => r.fromId === id);
        if (req) await Store.acceptRequest(req.id);
        await navigate('user', { id }, 'none');
      };
    }

    const chat = $('[data-open-chat]');
    if (chat) {
      chat.onclick = async () => {
        const existing = await Store.chatWith(id);
        if (existing) navigate('chat', { id: existing.id });
      };
    }

    bindCards();
  },
};

/* ==========================================================================
   סרטון בודד — נגן, לייק ותגובות
   ========================================================================== */

/** בועת תגובה בודדת — משמשת גם לשאלה וגם לתשובה שמתחתיה. */
function commentBubble(x, { isReply = false, canReply = false, videoAuthorId = null } = {}) {
  return `
    <div class="comment ${isReply ? 'comment--reply' : ''}">
      <button class="mini-avatar mini-avatar--lg" data-user="${esc(x.authorId)}"
              aria-label="הפרופיל של ${esc(x.authorName)}">${esc(x.authorAvatar)}</button>
      <div class="comment__body">
        <div class="comment__head">
          <button class="linkname" data-user="${esc(x.authorId)}">${esc(x.authorName)}</button>
          ${x.authorRole === 'coach' ? '<span class="tag tag--coach">מאמן</span>' : ''}
          ${x.authorId === videoAuthorId ? '<span class="tag tag--author">בעל הסרטון</span>' : ''}
          <span class="dot">·</span>
          <span class="muted small">${timeAgo(x.createdAt)}</span>
        </div>
        <p class="comment__text">${esc(x.text)}</p>
        ${!isReply && canReply
          ? `<button class="comment__reply" data-reply="${esc(x.id)}"
                     data-reply-to="${esc(x.authorName)}">↩ תשובה</button>`
          : ''}
      </div>
    </div>`;
}

/**
 * שרשור תגובה אחת: השאלה, התשובות שמתחתיה, וכפתור מענה.
 * `canReply` נכון רק כשיש משתמש מחובר — אורח רואה את הדיון אבל לא משיב.
 */
function commentRow(c, opts = {}) {
  return `
    <div class="thread-item" data-thread="${esc(c.id)}">
      ${commentBubble(c, { ...opts, isReply: false })}
      <div class="comment__replies" data-replies="${esc(c.id)}">
        ${(c.replies || []).map((r) => commentBubble(r, { ...opts, isReply: true })).join('')}
      </div>
    </div>`;
}

/** עולה בכל כניסה חדשה למסך סרטון (לא ברענון), כדי לספור צפייה פעם אחת בלבד. */
let lastViewedAt = '';

/** פרטי הסרטון המוצג, כדי ש-bind ידע למי שייך הסרטון בלי לשלוף אותו שוב. */
/*
 * הסרטון שמוצג כרגע. bind() רץ אחרי ש-html() סיים, ואין לו גישה
 * למשתנים שלו — לכן מה שהוא צריך נשמר כאן.
 */
let shownVideo = { id: null, authorId: null, kind: null, hasFile: false, videoUrl: null };

Screens.video = {
  async html({ id }) {
    const v = await Store.getVideo(id);
    if (!v) return `${header('סרטון', { back: true })}${empty('🤷', 'הסרטון לא נמצא', '')}${tabbar('feed')}`;

    if (lastViewedAt !== `${id}:${visitSeq}`) {
      lastViewedAt = `${id}:${visitSeq}`;
      v.views = await Store.countView(id);
    }

    const player = v.hasFile
      ? `<video class="player" src="${Media.videoUrl(v)}" controls playsinline
                ${v.hasThumb ? `poster="${Media.thumbUrl(v)}"` : ''}></video>`
      : `<div class="player player--poster">
           ${v.hasThumb
             ? `<img class="player__img" src="${Media.thumbUrl(v)}" alt=""
                     onerror="this.remove()">`
             : `<span class="player__emoji">${esc(v.poster || '🛹')}</span>`}
           <span class="player__note">${v.isDemo ? 'סרטון לדוגמה — אין קובץ אמיתי' : 'הועלה בלי קובץ וידאו'}</span>
         </div>`;

    const liked = ME && (v.likedBy || []).includes(ME.id);
    const mine = ME && v.authorId === ME.id;
    const isCoachViewer = ME?.role === 'coach';
    const aiOn = await Store.aiStatus();

    const isLesson = v.kind === 'lesson';
    const opts = { canReply: !!ME, videoAuthorId: v.authorId };
    shownVideo = { id: v.id, authorId: v.authorId, kind: v.kind,
                   hasFile: v.hasFile, videoUrl: v.videoUrl };

    const comments = v.comments.length
      ? v.comments.map((c) => commentRow(c, opts)).join('')
      : `<p class="small muted" data-no-comments>${isLesson
          ? `אין עדיין שאלות. ${gt('תהיה הראשון','תהיי הראשונה','תהיו הראשונים')} לשאול את המאמן.`
          : `אין עדיין פידבק. ${gt('תהיה הראשון','תהיי הראשונה','תהיו הראשונים')} לכתוב לרוכב מה לתקן.`}</p>`;

    const heading = isLesson ? 'שאלות למאמן' : 'פידבק לרוכב';

    return `
      <div class="screen__body has-tabs">
        ${header(v.kind === 'lesson' ? 'שיעור' : 'טריק לפידבק', { back: true })}

        ${player}

        <h2 style="margin-top:16px">${esc(v.title)}</h2>

        <button class="authorline" data-user="${v.author.id}">
          <span class="mini-avatar mini-avatar--lg">${esc(v.author.avatar)}</span>
          <span>
            <b>${esc(v.author.name)}</b>
            ${v.author.role === 'coach' ? '<span class="tag tag--coach">מאמן</span>' : ''}
            <small class="muted"> · ${timeAgo(v.createdAt)}</small>
          </span>
        </button>

        <div class="chips" style="margin-top:12px">
          ${v.region ? `<span class="tag">📍 ${esc(v.region)}</span>` : ''}
          ${v.level ? `<span class="tag">${esc(v.level)}</span>` : ''}
          ${v.styles.map((s) => `<span class="tag">${esc(s)}</span>`).join('')}
        </div>

        ${v.desc ? `<p class="lead" style="margin-top:14px">${esc(v.desc)}</p>` : ''}

        <div class="actionbar">
          <button class="vaction vaction--btn ${liked ? 'is-on' : ''}" data-like="${v.id}" ${ME ? '' : 'disabled'}>
            <span data-like-icon>${liked ? '❤️' : '🤍'}</span>
            <span data-like-count>${(v.likedBy || []).length}</span>
          </button>
          <span class="vaction">💬 ${v.commentCount}</span>
          <span class="vaction">👁 ${countLabel(v.views || 0, 'צפייה אחת', 'צפיות')}</span>
          ${mine ? '<button class="vaction vaction--btn" data-delete>🗑 מחיקה</button>' : ''}
        </div>

        ${ME ? `
          <section class="ai ${aiOn ? '' : 'ai--off'}" id="ai">
            <div class="ai__head">🤖 ${mine && v.kind !== 'lesson' ? 'עוזר הפידבק' : gt('שאל את העוזר','שאלי את העוזר','שאלו את העוזר')}</div>
            ${aiOn ? `
              <div class="ai__body" data-ai-out hidden></div>
              ${isCoachViewer && v.authorId !== ME.id
                ? `<button class="btn btn--ghost btn--sm" data-ai-draft="${esc(v.id)}"
                           style="margin-top:12px;width:auto;padding:0 18px;min-height:44px">
                     נסחו לי טיוטת פידבק
                   </button>`
                : ''}
              <div class="ai__row">
                <input class="input" data-ai-q maxlength="300"
                       placeholder="שאלה על טכניקה…">
                <button class="btn btn--primary" data-ai-send>${gt('שאל','שאלי','שאלו')}</button>
              </div>
              <p class="ai__note">
                ${isCoachViewer && v.authorId !== ME.id && v.hasFile
                  ? 'בטיוטת הפידבק העוזר מסתכל על פריימים מהסרטון עצמו. הוא עדיין לא קובע אם הטריק נחת — זה תמיד תפקידו של המאמן.'
                  : 'העוזר עונה על טכניקה בלבד. הוא לא רואה את הסרטון ולא קובע אם הטריק נחת — זה תמיד תפקידו של המאמן.'}
              </p>`
              : `<p class="ai__note">
                   ה-AI לא מוגדר בשרת. כדי להפעיל אותו צריך להגדיר
                   <code>ANTHROPIC_API_KEY</code> ולהפעיל את השרת מחדש.
                 </p>`}
          </section>` : ''}

        <h3 style="margin:24px 0 12px">${heading} (<span data-comment-count>${v.commentCount}</span>)</h3>
        <div id="comments" class="comments">${comments}</div>

        ${ME ? `
          <div class="composer" id="composer">
            <textarea id="comment-input" class="input composer__box" maxlength="300" rows="1"
                      placeholder="${isLesson ? gt('שאל את המאמן…','שאלי את המאמן…','שאלו את המאמן…') : gt('תן פידבק לרוכב…','תני פידבק לרוכב…','תנו פידבק לרוכב…')}"></textarea>
            <button class="btn btn--primary btn--sm" data-send>שליחה</button>
          </div>
          <p class="composer__hint" data-reply-hint hidden></p>
          <p class="field__error" data-comment-error hidden></p>`
          : `<p class="small muted" style="margin-top:16px">${gt('התחבר','התחברי','התחברו')} כדי להגיב ולתת לייק.</p>`}
      </div>
      ${tabbar('feed')}`;
  },

  bind({ id }) {
    // מחובר או לא, אם הסרטון נמצא — הקישורים לפרופיל המחבר והמגיבים תמיד פעילים
    bindCards();

    const like = $('[data-like]');
    if (like) {
      like.onclick = async () => {
        const res = await Store.toggleLike(id);
        if (!res) return;
        like.classList.toggle('is-on', res.liked);
        like.querySelector('[data-like-icon]').textContent = res.liked ? '❤️' : '🤍';
        like.querySelector('[data-like-count]').textContent = res.likes;
      };
    }

    const input = $('#comment-input');
    if (!input) return; // לא מחוברים — אין תיבת כתיבה

    const error = $('[data-comment-error]');
    const hint = $('[data-reply-hint]');
    const { authorId, kind } = shownVideo;
    const opts = { canReply: true, videoAuthorId: authorId };

    /** null = תגובה חדשה, אחרת מזהה התגובה שעליה עונים. */
    let replyTo = null;

    const clearReply = () => {
      replyTo = null;
      hint.hidden = true;
      input.placeholder = kind === 'lesson' ? gt('שאל את המאמן…','שאלי את המאמן…','שאלו את המאמן…') : gt('תן פידבק לרוכב…','תני פידבק לרוכב…','תנו פידבק לרוכב…');
    };

    const startReply = (commentId, name) => {
      replyTo = commentId;
      hint.innerHTML = `עונים ל<b>${esc(name)}</b> · <button class="linkname" data-cancel-reply>ביטול</button>`;
      hint.hidden = false;
      hint.querySelector('[data-cancel-reply]').onclick = clearReply;
      input.placeholder = `${gt('התשובה שלך','התשובה שלך','התשובה שלכם')} ל${name}…`;
      input.focus();
      $('#composer').scrollIntoView({ block: 'center', behavior: 'smooth' });
    };

    const bindReplyButtons = () => {
      $$('[data-reply]').forEach((btn) => {
        btn.onclick = () => startReply(btn.dataset.reply, btn.dataset.replyTo);
      });
    };

    // התגובה נוספת ל-DOM ישירות ולא דרך rerender, אחרת הנגן היה מתאתחל
    // והצפייה הייתה קופצת חזרה ל-0:00 באמצע שיעור.
    const send = async () => {
      const text = input.value.trim();
      if (!text) {
        error.textContent = 'צריך לכתוב משהו לפני ששולחים';
        error.hidden = false;
        return input.focus();
      }
      error.hidden = true;

      let comment;
      try {
        comment = await Store.addComment(id, text, replyTo);
      } catch (err) {
        // בלי זה כישלון רשת או סשן שפג היו נבלעים בשקט
        error.textContent = err.message;
        error.hidden = false;
        return;
      }
      input.value = '';
      input.style.height = '';   // חזרה לגובה שורה אחת אחרי שליחה

      const placeholder = $('[data-no-comments]');
      if (placeholder) placeholder.remove();

      if (comment.parentId) {
        // תשובה נכנסת מתחת לשאלה שאליה היא שייכת
        $(`[data-replies="${comment.parentId}"]`)
          .insertAdjacentHTML('beforeend', commentBubble(comment, { ...opts, isReply: true }));
      } else {
        $('#comments').insertAdjacentHTML('beforeend', commentRow(comment, opts));
      }

      const counter = $('[data-comment-count]');
      counter.textContent = Number(counter.textContent) + 1;
      clearReply();
      bindCards();
      bindReplyButtons();
      refreshBadges();   // עניתי על שאלה — המונה בסרגל צריך לרדת מיד
    };

    // ----- עוזר ה-AI -----
    const aiOut = $('[data-ai-out]');
    const aiQ = $('[data-ai-q]');

    const showAi = (text) => {
      aiOut.textContent = text;
      aiOut.hidden = false;
    };

    if (aiQ) {
      const askAi = async () => {
        const question = aiQ.value.trim();
        if (!question) return aiQ.focus();
        showAi('חושב…');
        try {
          showAi(await Store.aiAsk(question));
          aiQ.value = '';
        } catch (err) {
          showAi(err.message);
        }
      };
      $('[data-ai-send]').onclick = askAi;
      aiQ.onkeydown = (e) => { if (e.key === 'Enter') askAi(); };
    }

    const draftBtn = $('[data-ai-draft]');
    if (draftBtn) {
      draftBtn.onclick = async () => {
        // כשיש קובץ וידאו, מחלצים ממנו פריימים כדי שהעוזר באמת יראה
        // את הניסיון ולא ינסח פידבק כללי. החילוץ לוקח כמה שניות.
        let frames = [];
        if (shownVideo.hasFile) {
          showAi('צופה בסרטון…');
          frames = await Media.extractFrames(shownVideo).catch(() => []);
        }

        showAi(frames.length ? 'מנסח על סמך מה שראיתי…' : 'מנסח…');
        try {
          const { draft, look } = await Store.aiFeedback(draftBtn.dataset.aiDraft, '', frames);
          showAi([look, draft].filter(Boolean).join('\n\n'));
          // הטיוטה נכנסת לתיבת התגובה כדי שהמאמן יערוך וישלח בעצמו
          input.value = draft;
          input.dispatchEvent(new Event('input'));   // שהתיבה תגדל לפי אורך הטיוטה
          input.focus();
        } catch (err) {
          showAi(err.message);
        }
      };
    }

    bindReplyButtons();
    $('[data-send]').onclick = send;

    /*
     * התיבה היא textarea, אז היא גדלה עם הטקסט. מאפסים את הגובה לפני
     * המדידה, אחרת scrollHeight נשאר תקוע על הגובה הקודם והתיבה לא
     * מתכווצת כשמוחקים שורות.
     */
    const autoGrow = () => {
      input.style.height = 'auto';
      input.style.height = `${input.scrollHeight}px`;
    };
    input.oninput = autoGrow;

    // Enter שולח כמו קודם; Shift+Enter יורד שורה. בלי preventDefault
    // ה-Enter היה גם שולח וגם מוסיף שורה ריקה לתיבה.
    input.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    };

    const del = $('[data-delete]');
    if (del) {
      del.onclick = async () => {
        // מחיקה היא בלתי הפיכה, וכפתור בודד קל מדי ללחוץ עליו בטעות
        if (!confirm('למחוק את הסרטון? אי אפשר לשחזר אותו אחר כך.')) return;
        await Store.deleteVideo(id);
        goBack();
      };
    }

    bindCards();
  },
};

/* ==========================================================================
   הסרטונים שלי — העלאה וסטטיסטיקה
   ========================================================================== */

Screens.myvideos = {
  async html() {
    if (!ME) {
      return `${header('הסרטונים שלי')}
              ${empty('🔒', gt('לא מחובר','לא מחוברת','לא מחוברים'), `${gt('התחבר','התחברי','התחברו')} כדי להעלות סרטונים.`)}
              ${tabbar('myvideos')}`;
    }

    const stats = await Store.myVideoStats(ME.id);
    const videos = await Store.listVideos({ authorId: ME.id });
    const inbox = await Store.listInbox();
    const isCoach = ME.role === 'coach';

    const best = videos.length
      ? [...videos].sort((a, b) => (b.views || 0) - (a.views || 0))[0]
      : null;

    const waiting = inbox.filter((i) => !i.answered);
    const answered = inbox.filter((i) => i.answered);

    /** שורה אחת בתיבה: מי כתב, על איזה סרטון, ומה. */
    const inboxRow = (item) => `
      <article class="inboxrow ${item.answered ? '' : 'is-waiting'}"
               data-video="${esc(item.video.id)}" role="button" tabindex="0">
        <span class="inboxrow__poster">
          ${item.video.hasThumb
            ? `<img src="${Media.thumbUrl(item.video)}" alt="" onerror="this.remove()">`
            : ''}
          <span>${esc(item.video.poster || '🛹')}</span>
        </span>
        <div class="inboxrow__body">
          <div class="inboxrow__head">
            <b>${esc(item.author.name)}</b>
            ${item.author.role === 'coach' ? '<span class="tag tag--coach">מאמן</span>' : ''}
            <span class="dot">·</span>
            <span class="muted small">${timeAgo(item.createdAt)}</span>
          </div>
          <p class="inboxrow__text">${esc(item.text)}</p>
          <span class="inboxrow__on">על ${esc(item.video.title)}</span>
        </div>
        <span class="inboxrow__state">${item.answered ? '✓' : '●'}</span>
      </article>`;

    const inboxSection = !inbox.length ? '' : `
      <h3 style="margin:26px 0 12px">
        ${isCoach ? 'שאלות על הסרטונים שלי' : 'פידבק שקיבלתי'}
        ${waiting.length ? `<span class="pill">${countLabel(waiting.length, 'אחת מחכה לתשובה', 'מחכות לתשובה')}</span>` : ''}
      </h3>
      <div class="inbox">
        ${[...waiting, ...answered].map(inboxRow).join('')}
      </div>`;

    return `
      <div class="screen__body has-tabs">
        ${header('הסרטונים שלי')}

        <div class="statgrid">
          <div class="statbox">
            <div class="statbox__num">${stats.videos}</div>
            <div class="statbox__label">סרטונים</div>
          </div>
          <div class="statbox">
            <div class="statbox__num">${stats.views}</div>
            <div class="statbox__label">צפיות</div>
          </div>
          <div class="statbox">
            <div class="statbox__num">${stats.likes}</div>
            <div class="statbox__label">לייקים</div>
          </div>
          <div class="statbox">
            <div class="statbox__num">${stats.comments}</div>
            <div class="statbox__label">${isCoach ? 'שאלות ותגובות' : 'פידבק שקיבלתי'}</div>
          </div>
        </div>

        ${best ? `
          <div class="highlight">
            <span class="highlight__icon">🏆</span>
            <div>
              <b>הסרטון הכי נצפה שלי</b>
              <small class="muted">${esc(best.title)} · ${countLabel(best.views || 0, 'צפייה אחת', 'צפיות')}</small>
            </div>
          </div>` : ''}

        <button class="btn btn--primary" data-goto-upload style="margin-top:20px">
          ➕ ${isCoach ? 'העלאת שיעור חדש' : 'העלאת טריק חדש'}
        </button>

        ${inboxSection}

        <h3 style="margin:26px 0 12px">כל הסרטונים שלי</h3>
        ${videos.length
          ? `<div class="vlist">${videos.map(videoCard).join('')}</div>`
          : empty('🎬', 'עדיין לא העליתם כלום',
                  isCoach
                    ? `${gt('העלה','העלי','העלו')} שיעור ראשון — הוא יופיע לרוכבים באזור ${gt('שלך','שלך','שלכם')}.`
                    : `${gt('העלה','העלי','העלו')} טריק ראשון ${gt('וקבל','וקבלי','וקבלו')} עליו פידבק ממאמן.`)}
      </div>
      ${tabbar('myvideos')}`;
  },

  bind() {
    const go = $('[data-goto-upload]');
    if (go) go.onclick = () => navigate('upload');
    bindCards();
  },
};

/* ==========================================================================
   העלאת סרטון
   ========================================================================== */

const upload = { kind: undefined, title: '', desc: '', level: null, region: undefined, styles: [], poster: '🛹' };

Screens.upload = {
  async html() {
    if (!ME) {
      return `${header('העלאה', { back: true })}
              ${empty('🔒', gt('לא מחובר','לא מחוברת','לא מחוברים'), `${gt('התחבר','התחברי','התחברו')} כדי להעלות סרטונים.`)}
              ${tabbar('myvideos')}`;
    }

    // ברירת המחדל תלויה בתפקיד, אבל כל אחד יכול להחליף — מאמן שמעלה
    // טריק לפידבק, או רוכב שמלמד משהו, שניהם לגיטימיים.
    if (upload.kind === undefined) upload.kind = ME.role === 'coach' ? 'lesson' : 'clip';
    if (upload.region === undefined) upload.region = ME.region;
    const isLesson = upload.kind === 'lesson';

    const file = pendingFile
      ? `<div class="filepick is-set">
           <span class="filepick__icon">🎞</span>
           <div>
             <b>${esc(pendingFile.name)}</b>
             <small class="muted">${(pendingFile.size / 1048576).toFixed(1)} MB</small>
           </div>
           <button class="btn--text" data-clear-file type="button">הסרה</button>
         </div>`
      : `<label class="filepick">
           <span class="filepick__icon">🎬</span>
           <div>
             <b>${gt('בחר','בחרי','בחרו')} קובץ וידאו</b>
             <small class="muted">אפשר גם לפרסם בלי קובץ — יוצג כרטיס עם אימוג׳י</small>
           </div>
           <input type="file" accept="video/*" id="file" hidden>
         </label>`;

    return `
      <div class="screen__body has-tabs">
        ${header(isLesson ? 'העלאת שיעור' : 'העלאת טריק', { back: true })}
        <p class="lead">${isLesson
          ? `הסרטון יופיע לרוכבים באזור ${gt('שלך','שלך','שלכם')} ולכל מי ${gt('שהוסיף אותך','שהוסיף אותך','שהוסיף אתכם')} למועדפים.`
          : `מאמנים יוכלו לצפות ולתת ${gt('לך','לך','לכם')} פידבק.`}</p>

        <div class="field" style="margin-top:20px">
          <label class="field__label">מה מעלים?</label>
          <div class="choices">
            <button type="button" class="choice choice--slim" data-up-kind="lesson"
                    aria-pressed="${isLesson}">
              <span style="flex:1">
                <span class="choice__title">🎓 שיעור</span>
                <span class="choice__desc">מלמדים משהו — טכניקה, טריק, טיפ</span>
              </span>
              <span class="choice__check">✓</span>
            </button>
            <button type="button" class="choice choice--slim" data-up-kind="clip"
                    aria-pressed="${!isLesson}">
              <span style="flex:1">
                <span class="choice__title">⭐️ טריק לפידבק</span>
                <span class="choice__desc">${gt('מעלה ניסיון שלך ומבקש','מעלה ניסיון שלך ומבקשת','מעלים ניסיון שלכם ומבקשים')} חוות דעת</span>
              </span>
              <span class="choice__check">✓</span>
            </button>
          </div>
        </div>

        <div style="margin-top:20px">
          ${file}

          <div class="field" style="margin-top:20px">
            <label class="field__label" for="up-title">כותרת</label>
            <input id="up-title" class="input ${errors.title ? 'input--error' : ''}"
                   value="${esc(upload.title)}" maxlength="60"
                   placeholder="${isLesson ? 'למשל: אוליי מושלם ב-4 שלבים' : 'למשל: ניסיון ראשון בקיקפליפ'}">
            ${errorFor('title')}
          </div>

          <div class="field">
            <label class="field__label" for="up-desc">תיאור <span class="muted">(לא חובה)</span></label>
            <textarea id="up-desc" class="input input--area" maxlength="400" rows="3"
                      placeholder="${isLesson ? 'מה לומדים בסרטון?' : gt('על מה תרצה פידבק?','על מה תרצי פידבק?','על מה תרצו פידבק?')}">${esc(upload.desc)}</textarea>
          </div>

          <div class="field">
            <label class="field__label" for="up-region">אזור</label>
            <select id="up-region" class="select ${errors.region ? 'select--error' : ''}">
              <option value="">${gt('בחר','בחרי','בחרו')} אזור</option>
              ${Store.REGIONS.map((r) =>
                `<option value="${esc(r)}" ${upload.region === r ? 'selected' : ''}>${r}</option>`).join('')}
            </select>
            ${errorFor('region')}
          </div>

          <div class="field">
            <label class="field__label">${isLesson ? 'לאיזו רמה מיועד?' : gt('באיזו רמה אתה?','באיזו רמה את?','באיזו רמה אתם?')}</label>
            <div class="chips">
              ${Store.LEVELS.map((l) => `
                <button type="button" class="chip" data-up-level="${esc(l)}"
                        aria-pressed="${upload.level === l}">${l}</button>`).join('')}
            </div>
            ${errorFor('level')}
          </div>

          <div class="field">
            <label class="field__label">סגנונות</label>
            <div class="chips">
              ${Store.STYLES.map((s) => `
                <button type="button" class="chip" data-up-style="${esc(s)}"
                        aria-pressed="${upload.styles.includes(s)}">${s}</button>`).join('')}
            </div>
            ${errorFor('styles')}
          </div>

          <div class="field">
            <label class="field__label">תמונה ממוזערת <span class="muted">(לא חובה)</span></label>
            ${pendingThumbUrl
              ? `<div class="thumbpick is-set">
                   <img class="thumbpick__preview" src="${pendingThumbUrl}" alt="">
                   <div>
                     <b>תמונה נבחרה</b>
                     <small class="muted">היא תוצג בכרטיס הסרטון בפיד</small>
                   </div>
                   <button class="btn--text" data-clear-thumb type="button">הסרה</button>
                 </div>`
              : `<label class="filepick">
                   <span class="filepick__icon">🖼</span>
                   <div>
                     <b>${gt('בחר','בחרי','בחרו')} תמונה</b>
                     <small class="muted">או ${gt('בחר','בחרי','בחרו')} אימוג׳י למטה</small>
                   </div>
                   <input type="file" accept="image/*" id="thumb" hidden>
                 </label>`}
            <p class="field__error" data-thumb-error hidden></p>
          </div>

          <div class="field">
            <label class="field__label">
              ${pendingThumbUrl ? 'אימוג׳י גיבוי <span class="muted">(אם התמונה לא נטענת)</span>' : 'אימוג׳י לכרטיס'}
            </label>
            <div class="avatars">
              ${Store.AVATARS.map((a) => `
                <button type="button" class="avatar-opt" data-up-poster="${a}"
                        aria-pressed="${upload.poster === a}">${a}</button>`).join('')}
            </div>
          </div>
        </div>

        <button class="btn btn--primary" data-publish style="margin-top:8px">פרסום</button>
        ${errorFor('submit')}
      </div>
      ${tabbar('myvideos')}`;
  },

  bind() {
    if (!ME) return;

    $$('[data-up-kind]').forEach((btn) => {
      btn.onclick = () => {
        upload.kind = btn.dataset.upKind;
        // מרנדרים מחדש כי הכותרת, הטקסט וה-placeholders תלויים בבחירה
        rerender();
      };
    });

    const fileInput = $('#file');
    if (fileInput) {
      fileInput.onchange = () => {
        pendingFile = fileInput.files[0] || null;
        rerender();
      };
    }

    const clear = $('[data-clear-file]');
    if (clear) clear.onclick = () => { pendingFile = null; rerender(); };

    const thumbInput = $('#thumb');
    if (thumbInput) {
      thumbInput.onchange = async () => {
        const picked = thumbInput.files[0];
        if (!picked) return;

        // בדיקה מוקדמת שהדפדפן בכלל יודע לפענח את הקובץ, כדי לא להבטיח
        // "תמונה נבחרה" על קובץ שבסוף יידחה בזמן ההעלאה
        if (!await Media.canDecode(picked)) {
          errors.thumb = `הקובץ הזה לא נראה כמו תמונה תקינה. ${gt('נסה','נסי','נסו')} קובץ אחר.`;
          return rerender();
        }

        errors.thumb = null;
        clearPendingThumb();
        pendingThumb = picked;
        pendingThumbUrl = URL.createObjectURL(picked);
        rerender();
      };
    }

    const thumbError = $('[data-thumb-error]');
    if (thumbError && errors.thumb) {
      thumbError.textContent = errors.thumb;
      thumbError.hidden = false;
    }

    const clearThumb = $('[data-clear-thumb]');
    if (clearThumb) clearThumb.onclick = () => { clearPendingThumb(); rerender(); };


    const title = $('#up-title');
    title.oninput = () => { upload.title = title.value; };

    const desc = $('#up-desc');
    desc.oninput = () => { upload.desc = desc.value; };

    const region = $('#up-region');
    region.onchange = () => { upload.region = region.value || null; };

    $$('[data-up-level]').forEach((btn) => {
      btn.onclick = () => {
        upload.level = btn.dataset.upLevel;
        $$('[data-up-level]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      };
    });

    $$('[data-up-style]').forEach((btn) => {
      btn.onclick = () => {
        const set = new Set(upload.styles);
        const value = btn.dataset.upStyle;
        set.has(value) ? set.delete(value) : set.add(value);
        upload.styles = [...set];
        btn.setAttribute('aria-pressed', String(set.has(value)));
      };
    });

    $$('[data-up-poster]').forEach((btn) => {
      btn.onclick = () => {
        upload.poster = btn.dataset.upPoster;
        $$('[data-up-poster]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      };
    });

    const publish = $('[data-publish]');
    publish.onclick = async () => {
      if (publish.disabled) return;
      const thumbError = errors.thumb;
      errors = {};
      if (thumbError) errors.thumb = thumbError;
      if (upload.title.trim().length < 3) errors.title = 'צריך כותרת של לפחות 3 תווים';
      if (!upload.region) errors.region = `${gt('בחר','בחרי','בחרו')} אזור`;
      if (!upload.level) errors.level = `${gt('בחר','בחרי','בחרו')} רמה`;
      if (!upload.styles.length) errors.styles = `${gt('בחר','בחרי','בחרו')} לפחות סגנון אחד`;
      // בודקים ערכים ולא מפתחות — מפתח עם undefined אינו שגיאה
      if (Object.values(errors).some(Boolean)) return rerender();

      // שמירת קובץ גדול לוקחת זמן. בלי הנעילה, לחיצה שנייה יוצרת סרטון כפול.
      publish.disabled = true;
      publish.textContent = 'מפרסם…';

      let saved;
      try {
        saved = await Store.addVideo(upload);
        if (pendingFile) {
          const result = await Media.putVideo(saved.id, pendingFile);
          if (result?.duplicate) {
            alert(`שימו לב: הקובץ הזה כבר הועלה על ידי ${result.duplicate}. ` +
                  'הסרטון נשמר, אבל הוא יסומן בתיק.');
          }
        }
        if (pendingThumb) await Media.putThumb(saved.id, pendingThumb);
      } catch (err) {
        errors.submit = err.message;
        publish.disabled = false;
        publish.textContent = 'פרסום';
        return rerender();
      }

      // איפוס הטופס לקראת ההעלאה הבאה
      clearPendingThumb();
      pendingFile = null;
      Object.assign(upload, { title: '', desc: '', level: null, styles: [], poster: '🛹' });

      // המסך הקודם הוא "הסרטונים שלי", כדי שחזרה מהסרטון תנחת שם ולא בטופס
      trail.pop();
      navigate('video', { id: saved.id });
    };
  },
};

/* ==========================================================================
   חיפוש — סרטונים ומאמנים יחד
   ========================================================================== */

const search = { query: '', region: null, kind: null, tab: 'videos' };

Screens.search = {
  async html() {
    return `
      <div class="screen__body has-tabs">
        ${header('חיפוש', { back: true })}

        <div class="searchbar">
          <span class="searchbar__icon">🔍</span>
          <input id="search-q" class="input input--search" value="${esc(search.query)}"
                 placeholder="טריק, מאמן, פארק או סגנון">
        </div>

        <div class="segmented" style="margin-top:12px">
          <button class="seg ${search.tab === 'videos' ? 'is-on' : ''}" data-stab="videos">סרטונים</button>
          <button class="seg ${search.tab === 'coaches' ? 'is-on' : ''}" data-stab="coaches">אנשים</button>
        </div>

        ${search.tab === 'videos' ? kindFilterRow(search.kind) : ''}
        ${regionFilterRow(search.region)}

        <div id="search-results" style="margin-top:16px">${await Screens.search.results()}</div>
      </div>
      ${tabbar('feed')}`;
  },

  async results() {
    if (search.tab === 'coaches') {
      const people = await Store.listPeople({ region: search.region, query: search.query });
      if (!people.length) return empty('🔍', 'לא נמצא אף אחד', `${gt('נסה','נסי','נסו')} מילה אחרת או אזור אחר.`);
      const following = ME?.following || [];
      return `
        <p class="small muted" style="margin-bottom:10px">${countLabel(people.length, 'תוצאה אחת', 'תוצאות')}</p>
        <div class="clist">${people.map((p) => personCard(p, following.includes(p.id))).join('')}</div>`;
    }

    const videos = await Store.listVideos({
      region: search.region,
      kind: search.kind,
      query: search.query,
    });
    if (!videos.length) {
      const kind = Store.KINDS.find((k) => k.id === search.kind);
      return empty('🔍', 'לא נמצאו סרטונים',
                   kind ? `אין תוצאות בסינון "${kind.label}". ${gt('נסה','נסי','נסו')} מילה אחרת, אזור אחר או "הכל".`
                        : `${gt('נסה','נסי','נסו')} מילה אחרת או אזור אחר.`);
    }
    return `
      <p class="small muted" style="margin-bottom:10px">${countLabel(videos.length, 'תוצאה אחת', 'תוצאות')}</p>
      <div class="vlist">${videos.map(videoCard).join('')}</div>`;
  },

  bind() {
    const refresh = async () => {
      $('#search-results').innerHTML = await Screens.search.results();
      bindCards();
    };

    const input = $('#search-q');
    input.oninput = () => { search.query = input.value; refresh(); };

    $$('[data-stab]').forEach((btn) => {
      btn.onclick = () => { search.tab = btn.dataset.stab; rerender(); };
    });

    $$('[data-region]').forEach((btn) => {
      btn.onclick = () => { search.region = btn.dataset.region || null; rerender(); };
    });

    $$('[data-kind]').forEach((btn) => {
      btn.onclick = () => { search.kind = btn.dataset.kind || null; rerender(); };
    });

    bindCards();
  },
};

/* ==========================================================================
   בקשות חברות וצ'אטים
   ========================================================================== */

Screens.chats = {
  async html() {
    if (!ME) return `${header('צ׳אטים')}${empty('🔒', gt('לא מחובר','לא מחוברת','לא מחוברים'), `${gt('התחבר','התחברי','התחברו')} כדי לשוחח.`)}${tabbar('chats')}`;

    const incoming = await Store.listIncomingRequests();
    const outgoing = await Store.listOutgoingRequests();
    const chats = await Store.listChats();

    const requestList = !incoming.length ? '' : `
      <h3 style="margin:4px 0 12px">בקשות חברות (${incoming.length})</h3>
      <div class="clist">
        ${incoming.filter((r) => r.from).map((r) => `
          <article class="ccard">
            <button class="ccard__main" data-user="${r.from.id}">
              <span class="ccard__avatar">${esc(r.from.avatar)}</span>
              <span class="ccard__info">
                <span class="ccard__name">${esc(r.from.name)}</span>
                <span class="ccard__where">${r.from.role === 'coach' ? '🎓 מאמן' : '🛹 רוכב'} · 📍 ${esc(r.from.region || '—')}</span>
                <span class="ccard__stats">${timeAgo(r.createdAt)}</span>
              </span>
            </button>
            <div class="reqbtns">
              <button class="follow is-on" data-accept="${r.id}">אישור</button>
              <button class="follow" data-decline="${r.id}">דחייה</button>
            </div>
          </article>`).join('')}
      </div>`;

    const outgoingList = !outgoing.length ? '' : `
      <h3 style="margin:26px 0 12px">בקשות שנשלחו</h3>
      <div class="clist">
        ${outgoing.filter((r) => r.to).map((r) => `
          <article class="ccard">
            <button class="ccard__main" data-user="${r.to.id}">
              <span class="ccard__avatar">${esc(r.to.avatar)}</span>
              <span class="ccard__info">
                <span class="ccard__name">${esc(r.to.name)}</span>
                <span class="ccard__where">ממתין לאישור · ${timeAgo(r.createdAt)}</span>
              </span>
            </button>
            <span class="tag">⏳</span>
          </article>`).join('')}
      </div>`;

    const chatList = chats.length ? `
      <div class="clist">
        ${chats.map((c) => `
          <article class="ccard ccard--chat" data-chat="${c.id}" role="button" tabindex="0">
            <span class="ccard__avatar">${esc(c.other.avatar)}</span>
            <span class="ccard__info">
              <span class="ccard__name">${esc(c.other.name)}</span>
              <span class="ccard__where">${c.last
                ? `${c.last.fromId === ME.id ? 'אני: ' : ''}${esc(c.last.text.slice(0, 44))}${c.last.text.length > 44 ? '…' : ''}`
                : 'התחילו לדבר 👋'}</span>
            </span>
            <span class="small muted">${timeAgo(c.activeAt)}</span>
          </article>`).join('')}
      </div>`
      : empty('💬', 'אין עדיין צ׳אטים',
              'שלחו בקשת חברות מהפרופיל של מאמן או רוכב. ברגע שהיא תאושר ייפתח כאן צ׳אט.');

    return `
      <div class="screen__body has-tabs">
        ${header('צ׳אטים')}
        ${requestList}
        <h3 style="margin:${incoming.length ? '26px' : '4px'} 0 12px">השיחות שלי</h3>
        ${chatList}
        ${outgoingList}
      </div>
      ${tabbar('chats')}`;
  },

  bind() {
    $$('[data-accept]').forEach((btn) => {
      btn.onclick = async () => {
        await Store.acceptRequest(btn.dataset.accept);
        navigate('chats', {}, 'none');
      };
    });

    $$('[data-decline]').forEach((btn) => {
      btn.onclick = async () => {
        await Store.declineRequest(btn.dataset.decline);
        navigate('chats', {}, 'none');
      };
    });

    $$('[data-chat]').forEach((el) => {
      const open = () => navigate('chat', { id: el.dataset.chat });
      el.onclick = open;
      el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
    });

    bindCards();
  },
};

Screens.chat = {
  async html({ id }) {
    const chat = await Store.getChat(id);
    if (!chat) return `${header('צ׳אט', { back: true })}${empty('🤷', 'הצ׳אט לא נמצא', '')}${tabbar('chats')}`;

    const bubbles = chat.messages.length
      ? chat.messages.map((m) => `
          <div class="bubble ${m.fromId === ME.id ? 'bubble--mine' : ''}">
            <p>${esc(m.text)}</p>
            <span class="bubble__time">${timeAgo(m.createdAt)}</span>
          </div>`).join('')
      : `<p class="small muted" style="text-align:center;padding:30px 0">
           ${gt('אתה חבר','את חברה','אתם חברים')} עכשיו. ${gt('תכתוב','תכתבי','תכתבו')} משהו 👋</p>`;

    return `
      <div class="screen__body has-tabs screen__body--chat">
        ${header(chat.other.name, {
          back: true,
          action: `<button class="mini-avatar mini-avatar--lg" data-user="${chat.other.id}"
                           aria-label="פרופיל">${esc(chat.other.avatar)}</button>`,
        })}

        <div class="thread" id="thread">${bubbles}</div>

        <div class="composer">
          <input id="msg" class="input" maxlength="500" placeholder="הודעה…" autocomplete="off">
          <button class="btn btn--primary btn--sm" data-send-msg>שליחה</button>
        </div>
      </div>
      ${tabbar('chats')}`;
  },

  bind({ id }) {
    const input = $('#msg');
    if (!input) return;   // מסך "הצ׳אט לא נמצא"
    app.scrollTop = app.scrollHeight;

    const send = async () => {
      const text = input.value.trim();
      if (!text) return;
      await Store.sendMessage(id, text);
      await navigate('chat', { id }, 'none');
    };

    $('[data-send-msg]').onclick = send;
    input.onkeydown = (e) => { if (e.key === 'Enter') send(); };
    input.focus();

    bindCards();
  },
};

/* ==========================================================================
   התיק — הטריקים שנחתו
   ========================================================================== */

/** מצב טופס ההוספה לתיק. */
const bagForm = { open: false, name: '', videoId: null, busy: false };

/** סולם האמון, מהגבוה לנמוך. הסרטון הוא תמיד ההוכחה — זה מה שמעליו. */
const TRUST = {
  coach:     { icon: '🥇', cls: 'ok',   label: (e) => `אימת ${e.verifiedBy}` },
  ai:        { icon: '🤖', cls: 'ok',   label: () => 'ה-AI: נראה שנחת' },
  'ai-doubt':{ icon: '⚠️', cls: 'meh',  label: (e) =>
                 e.ai.verdict === 'bail' ? 'ה-AI: נראה שלא נחת' : 'ה-AI: לא ברור' },
  none:      { icon: '○',  cls: 'meh',  label: () => 'טרם נבדק' },
  stolen:    { icon: '🚩', cls: 'bad',  label: (e) => `הסרטון הועלה קודם על ידי ${e.stolenFrom}` },
};

/**
 * כרטיס טריק בתיק. הסרטון הוא ההוכחה, ולכן הוא תמיד לחיץ —
 * מי שרוצה לבדוק פשוט צופה.
 */
function bagCard(entry, { mine, canVerify }) {
  const trust = TRUST[entry.trust] || TRUST.none;

  // סימון הכפילות נשאר גלוי גם אם מאמן אימת — לא מסתירים ראיה
  const dupNote = entry.stolenFrom && entry.trust !== 'stolen'
    ? `<span class="bagcard__stamp is-bad">🚩 הקובץ הועלה קודם על ידי ${esc(entry.stolenFrom)}</span>`
    : '';

  const stamp = `
    <span class="bagcard__stamp is-${trust.cls}" title="${esc(entry.ai?.reason || '')}">
      ${trust.icon} ${esc(trust.label(entry))}
    </span>${dupNote}`;

  return `
    <article class="bagcard ${entry.trust === 'stolen' ? 'is-flagged' : ''}">
      <button class="bagcard__media" data-video="${esc(entry.video.id)}">
        <span class="bagcard__emoji">${esc(entry.video.poster || '🛹')}</span>
        ${entry.video.hasThumb
          ? `<img src="${Media.thumbUrl(entry.video)}" alt="" loading="lazy"
                  onerror="this.remove()">`
          : ''}
        <span class="bagcard__play">▶</span>
      </button>
      <div class="bagcard__body">
        <b class="bagcard__name">${esc(entry.name)}</b>
        <span class="bagcard__when">${timeAgo(entry.createdAt)}</span>
        ${stamp}
      </div>
      <div class="bagcard__side">
        ${canVerify ? `<button class="follow ${entry.verifiedBy ? 'is-on' : ''}"
                               data-verify="${esc(entry.id)}"
                               data-on="${!entry.verifiedBy}">✓</button>` : ''}
        ${mine ? `<button class="bagcard__del" data-unbag="${esc(entry.id)}"
                          aria-label="הסרה מהתיק">🗑</button>` : ''}
      </div>
    </article>`;
}

/** מקטע התיק. מוצג גם בפרופיל שלי וגם בפרופיל של אחרים. */
async function bagSection(userId, { mine }) {
  const bag = await Store.getBag(userId).catch(() => []);
  const canVerify = ME?.role === 'coach' && ME.id !== userId;

  const list = bag.length
    ? `<div class="baglist">${bag.map((e) => bagCard(e, { mine, canVerify })).join('')}</div>`
    : empty('🎒', mine ? 'התיק ריק' : 'אין עדיין טריקים בתיק',
            mine ? 'כל טריק בתיק חייב סרטון — הסרטון הוא ההוכחה.' : '');

  const solid = bag.filter((e) => e.trust === 'coach' || e.trust === 'ai').length;
  const flagged = bag.filter((e) => e.trust === 'stolen').length;

  return `
    <h3 style="margin:26px 0 12px">
      ${mine ? 'התיק שלי' : 'התיק'}
      <span class="pill pill--quiet">${countLabel(bag.length, 'טריק אחד', 'טריקים')}</span>
      ${solid ? `<span class="pill">${solid} מאומתים</span>` : ''}
      ${flagged ? `<span class="pill pill--bad">${flagged} מסומנים</span>` : ''}
    </h3>
    ${mine ? bagAdder() : ''}
    ${list}`;
}

/** טופס ההוספה: שם חופשי + בחירת סרטון משלי. */
function bagAdder() {
  if (!bagForm.open) {
    return `<button class="btn btn--primary btn--sm" data-open-bag
                    style="width:auto;padding:0 20px;min-height:44px;margin-bottom:14px">
              ➕ הוספת טריק לתיק
            </button>`;
  }

  return `
    <div class="bagadd">
      <div class="field" style="margin-bottom:12px">
        <label class="field__label" for="bag-name">איזה טריק נחתת?</label>
        <input id="bag-name" class="input" maxlength="60" value="${esc(bagForm.name)}"
               placeholder="${gt('כתוב איך שאתה קורא','כתבי איך שאת קוראת','כתבו איך שאתם קוראים')} לזה" list="bag-suggest" autocomplete="off">
        <datalist id="bag-suggest"></datalist>
      </div>

      <div class="field" style="margin-bottom:12px">
        <label class="field__label">איזה סרטון מוכיח את זה?</label>
        <div id="bag-videos" class="bagpick"></div>
        <p class="field__hint">
          רק סרטונים ${gt('שלך','שלך','שלכם')} עם קובץ וידאו. ה-AI יבדוק את הסרטון ויסמן מה נראה לו.
        </p>
      </div>

      ${errorFor('bag')}

      <div class="ai__row" style="margin:0">
        <button class="btn btn--primary" data-save-bag ${bagForm.busy ? 'disabled' : ''}>
          ${bagForm.busy ? 'בודק את הסרטון…' : 'הוספה לתיק'}
        </button>
        <button class="btn btn--ghost" data-cancel-bag>ביטול</button>
      </div>
    </div>`;
}

/** חיווט טופס התיק והפעולות עליו. */
function bindBag(userId, refresh) {
  const open = $('[data-open-bag]');
  if (open) open.onclick = () => { bagForm.open = true; errors = {}; rerender(); };

  const cancel = $('[data-cancel-bag]');
  if (cancel) {
    cancel.onclick = () => {
      Object.assign(bagForm, { open: false, name: '', videoId: null });
      errors = {};
      rerender();
    };
  }

  const nameInput = $('#bag-name');
  if (nameInput) {
    nameInput.oninput = () => { bagForm.name = nameInput.value; };

    // הקטלוג הישן חוזר כאן בתור הצעות בלבד — הוא לא מגביל את מה שאפשר לכתוב
    fetch('/tricks.json').then((r) => r.json()).then((data) => {
      const seen = new Set();
      const names = data.tricks.map((x) => x.baseName).filter((n) => {
        if (seen.has(n)) return false;
        seen.add(n);
        return true;
      });
      const dl = $('#bag-suggest');
      if (dl) dl.innerHTML = names.map((n) => `<option value="${esc(n)}">`).join('');
    }).catch(() => {});

    // רק סרטונים שלי שיש להם קובץ — בלי קובץ אין מה לאמת
    Store.listVideos({ authorId: userId }).then((videos) => {
      const usable = videos.filter((v) => v.hasFile);
      const box = $('#bag-videos');
      if (!box) return;

      box.innerHTML = usable.length
        ? usable.map((v) => `
            <button type="button" class="bagpick__opt ${bagForm.videoId === v.id ? 'is-on' : ''}"
                    data-pick-video="${esc(v.id)}">
              <span>${esc(v.poster || '🛹')}</span>
              <b>${esc(v.title)}</b>
            </button>`).join('')
        : `<p class="small muted">אין ${gt('לך','לך','לכם')} סרטונים עם קובץ וידאו. ${gt('העלה','העלי','העלו')} אחד קודם.</p>`;

      $$('[data-pick-video]').forEach((b) => {
        b.onclick = () => {
          bagForm.videoId = b.dataset.pickVideo;
          // הכתובת נשמרת כאן כי חילוץ הפריימים קורא את הקובץ עצמו,
          // והוא כבר לא בהכרח יושב על השרת שלנו
          bagForm.video = usable.find((v) => v.id === bagForm.videoId) || null;
          $$('[data-pick-video]').forEach((x) => x.classList.toggle('is-on', x === b));
        };
      });
    });
  }

  const save = $('[data-save-bag]');
  if (save) {
    save.onclick = async () => {
      errors = {};
      if (bagForm.name.trim().length < 2) errors.bag = `${gt('כתוב','כתבי','כתבו')} את שם הטריק`;
      else if (!bagForm.videoId) errors.bag = `${gt('בחר','בחרי','בחרו')} סרטון — הוא ההוכחה`;
      if (errors.bag) return rerender();

      bagForm.busy = true;
      rerender();
      try {
        // הפריימים מחולצים בדפדפן ונשלחים לבדיקה
        const frames = await Media.extractFrames(bagForm.video || bagForm.videoId);
        await Store.addToBag(bagForm.name.trim(), bagForm.videoId, frames);
        Object.assign(bagForm, { open: false, name: '', videoId: null, video: null });
      } catch (err) {
        errors.bag = err.message;
      } finally {
        bagForm.busy = false;
        await refresh();
      }
    };
  }

  $$('[data-unbag]').forEach((b) => {
    b.onclick = async () => {
      if (!confirm('להוציא את הטריק מהתיק?')) return;
      await Store.removeFromBag(b.dataset.unbag);
      await refresh();
    };
  });

  $$('[data-verify]').forEach((b) => {
    b.onclick = async () => {
      try {
        await Store.verifyBagEntry(b.dataset.verify, b.dataset.on === 'true');
      } catch (err) {
        alert(err.message);
      }
      await refresh();
    };
  });
}

/* ==========================================================================
   צ'אט עם ה-AI
   ========================================================================== */

Screens.aicoach = {
  async html() {
    if (!ME) {
      return `${header('עוזר ה-AI')}
              ${empty('🔒', gt('לא מחובר','לא מחוברת','לא מחוברים'), `${gt('התחבר','התחברי','התחברו')} כדי לדבר עם העוזר.`)}
              ${tabbar('aicoach')}`;
    }

    const { available, messages } = await Store.getAiChat().catch(() => ({ available: false, messages: [] }));

    if (!available) {
      return `
        <div class="screen__body has-tabs">
          ${header('עוזר ה-AI')}
          ${empty('🤖', 'העוזר לא זמין כרגע',
                  'ה-AI לא מוגדר בשרת. כדי להפעיל אותו צריך להגדיר ANTHROPIC_API_KEY ולהפעיל את השרת מחדש.')}
        </div>
        ${tabbar('aicoach')}`;
    }

    const bubbles = messages.length
      ? messages.map(aiBubble).join('')
      : `<div class="ai-intro">
           <span class="ai-intro__icon">🤖</span>
           <p><b>${gt('שאל','שאלי','שאלו')} אותי כל שאלה על טכניקה בסקייטבורד.</b></p>
           <p class="small muted">
             אני עונה על שאלות טכניקה בלבד. אני לא רואה סרטונים ולא קובע אם טריק נחת —
             זה תמיד נשאר אצל מאמן אמיתי.
           </p>
         </div>`;

    return `
      <div class="screen__body has-tabs screen__body--chat">
        ${header('עוזר ה-AI', {
          action: messages.length
            ? '<button class="iconbtn" data-clear-ai aria-label="ניקוי השיחה">🗑</button>' : '',
        })}

        <div class="thread" id="thread">${bubbles}</div>

        <div class="composer">
          <input id="ai-msg" class="input" maxlength="500" placeholder="${gt('שאל','שאלי','שאלו')} על טכניקה…" autocomplete="off">
          <button class="btn btn--primary btn--sm" data-send-ai>שליחה</button>
        </div>
        <p class="ai__note" style="margin-top:8px">
          העוזר לא רואה סרטונים ולא קובע אם טריק נחת.
        </p>
      </div>
      ${tabbar('aicoach')}`;
  },

  bind() {
    const input = $('#ai-msg');
    if (!input) return;   // לא מחוברים, או שהעוזר לא זמין
    app.scrollTop = app.scrollHeight;

    const send = async () => {
      const text = input.value.trim();
      if (!text || input.disabled) return;

      // בועת המשתמש נכנסת מיד; בועת התשובה מוחלפת מ"חושב…" לתשובה האמיתית
      const thread = $('#thread');
      $('.ai-intro')?.remove();
      thread.insertAdjacentHTML('beforeend', aiBubble({ role: 'user', text, createdAt: new Date().toISOString() }));
      const pendingId = `pending-${Date.now()}`;
      thread.insertAdjacentHTML('beforeend',
        `<div class="bubble bubble--ai" id="${pendingId}"><p>חושב…</p></div>`);
      thread.scrollTop = thread.scrollHeight;

      input.value = '';
      input.disabled = true;

      try {
        const reply = await Store.sendToAi(text);
        $(`#${pendingId}`)?.replaceWith(aiBubbleEl(reply));
      } catch (err) {
        $(`#${pendingId}`)?.replaceWith(aiBubbleEl({ role: 'assistant', text: `⚠️ ${err.message}`, createdAt: new Date().toISOString() }));
      } finally {
        input.disabled = false;
        input.focus();
        thread.scrollTop = thread.scrollHeight;
      }
    };

    $('[data-send-ai]').onclick = send;
    input.onkeydown = (e) => { if (e.key === 'Enter') send(); };
    input.focus();

    const clear = $('[data-clear-ai]');
    if (clear) {
      clear.onclick = async () => {
        if (!confirm('למחוק את כל השיחה עם העוזר?')) return;
        await Store.clearAiChat();
        rerender();
      };
    }
  },
};

/** בועת שיחה — כמזהה HTML string. */
function aiBubble(m) {
  return `
    <div class="bubble ${m.role === 'user' ? 'bubble--mine' : 'bubble--ai'}">
      <p>${esc(m.text)}</p>
      <span class="bubble__time">${timeAgo(m.createdAt)}</span>
    </div>`;
}

/** אותו דבר, אבל כאלמנט DOM אמיתי — כדי להחליף את "חושב…" בלי לאבד מיקום גלילה. */
function aiBubbleEl(m) {
  const div = document.createElement('div');
  div.innerHTML = aiBubble(m).trim();
  return div.firstElementChild;
}

/* ==========================================================================
   הישגים
   ========================================================================== */

/** הדיסציפלינה שנבחרה ברשימת ההישגים. null = להראות רק מה שהושג. */
let achTab = null;

/** איך הטריק הוכח — מהחזק לחלש. */
const PROOF = {
  coach: { icon: '\ud83e\udd47', label: 'אימת מאמן' },
  ai:    { icon: '\ud83e\udd16', label: 'נבדק ב-AI' },
  self:  { icon: '\u2713',       label: 'בתיק' },
};

/**
 * הישג לכל טריק בנפרד: קיקפליפ, אוליי, טרה פליפ.
 * ההישג נפתח כשהטריק נכנס לתיק, כלומר עם סרטון שמוכיח אותו.
 * הרשימה ארוכה (266), אז כברירת מחדל מוצג רק מה שהושג.
 */
function achievementsBlock(ach) {
  if (!ach) return '';

  const earned = ach.list.filter((a) => a.earned);
  const shown = achTab ? ach.list.filter((a) => a.discipline === achTab) : earned;

  const card = (a) => {
    const proof = a.proof ? PROOF[a.proof] : null;
    return `
      <article class="ach ${a.earned ? 'is-earned' : ''}">
        <span class="ach__icon">${a.earned ? (proof ? proof.icon : '\u2713') : '\ud83d\udd12'}</span>
        <div class="ach__body">
          <b class="ach__title">${esc(a.title)}</b>
          <span class="ach__desc">${esc(a.alias)} \u00b7 ${esc(a.level)}</span>
        </div>
        ${a.earned && proof ? `<span class="ach__proof">${esc(proof.label)}</span>` : ''}
      </article>`;
  };

  const chips = `
    <div class="filterrow">
      <button class="chip chip--sm" data-ach-tab="" aria-pressed="${!achTab}">
        \u2713 שהשגתי <span class="chip__count">${ach.done}</span>
      </button>
      ${ach.disciplines.map((d) => `
        <button class="chip chip--sm" data-ach-tab="${esc(d.id)}" aria-pressed="${achTab === d.id}">
          ${d.icon} ${esc(d.label)}
          <span class="chip__count">${ach.byDiscipline[d.id].done}/${ach.byDiscipline[d.id].total}</span>
        </button>`).join('')}
    </div>`;

  const body = shown.length
    ? `<div class="achlist">${shown.map(card).join('')}</div>`
    : achTab
      ? empty('\ud83d\udd12', 'עוד לא נחתו טריקים בקטגוריה הזאת', '')
      : empty('\ud83c\udfc5', 'עוד אין הישגים',
              'כל טריק שתוסיפו לתיק פותח את ההישג שלו. קיקפליפ בתיק = הישג קיקפליפ.');

  return `
    <h3 style="margin:26px 0 12px">
      ההישגים שלי
      <span class="pill pill--quiet">${ach.done}/${ach.total}</span>
      ${ach.verified ? `<span class="pill">${ach.verified} אימת מאמן</span>` : ''}
    </h3>
    ${chips}
    <div style="margin-top:14px">${body}</div>
    ${ach.unmatched.length ? `
      <p class="field__hint" style="margin-top:12px">
        ${countLabel(ach.unmatched.length, 'טריק אחד בתיק', 'טריקים בתיק')}
        לא זוהו בקטלוג, אז אין להם הישג בשם:
        ${ach.unmatched.slice(0, 4).map(esc).join(', ')}
      </p>` : ''}`;
}

/* ==========================================================================
   הפרופיל שלי
   ========================================================================== */

/** האם אזור מחיקת החשבון פתוח כרגע, ומצב הטופס שלו. */
let dangerZoneOpen = false;

/*
 * טיוטת עריכת הפרופיל. null = לא עורכים כרגע.
 * מוחזקת בנפרד מ-ME כדי שאפשר יהיה לבטל בלי לגעת בנתונים האמיתיים.
 */
let editDraft = null;

/** טופס עריכת הפרופיל. עובד על editDraft, לא על ME. */
function profileEditor() {
  const d = editDraft;
  return `
    <div class="card">
      <h3 style="margin-bottom:16px">עריכת הפרופיל</h3>

      <div class="field">
        <label class="field__label">אווטאר</label>
        <div class="avatars">
          ${Store.AVATARS.map((a) => `
            <button type="button" class="avatar-opt" data-ed-avatar="${a}"
                    aria-pressed="${d.avatar === a}">${a}</button>`).join('')}
        </div>
      </div>

      <div class="field">
        <label class="field__label" for="ed-name">שם</label>
        <input id="ed-name" class="input ${errors.name ? 'input--error' : ''}"
               value="${esc(d.name)}" maxlength="30">
        ${errorFor('name')}
      </div>

      <div class="field">
        <label class="field__label" for="ed-email">מייל <span class="muted">(לא חובה)</span></label>
        <input id="ed-email" type="email" class="input ${errors.email ? 'input--error' : ''}"
               value="${esc(d.email || '')}" maxlength="254" autocomplete="email"
               placeholder="you@example.com">
        <p class="field__hint">לא מוצג לאף אחד אחר. שמור למקרה שנוסיף שחזור סיסמה.</p>
        ${errorFor('email')}
      </div>

      <div class="field">
        <label class="field__label" for="ed-bio">קצת עליי <span class="muted">(לא חובה)</span></label>
        <textarea id="ed-bio" class="input input--area" maxlength="300" rows="3"
                  placeholder="${gt('מה אתה אוהב','מה את אוהבת','מה אתם אוהבים')} לרכוב, איפה, כמה זמן…">${esc(d.bio || '')}</textarea>
      </div>

      <div class="field">
        <label class="field__label" for="ed-region">אזור</label>
        <select id="ed-region" class="select">
          <option value="">${gt('בחר','בחרי','בחרו')} אזור</option>
          ${Store.REGIONS.map((r) =>
            `<option value="${esc(r)}" ${d.region === r ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
      </div>

      <div class="field">
        <label class="field__label" for="ed-city">עיר <span class="muted">(לא חובה)</span></label>
        <input id="ed-city" class="input" value="${esc(d.city || '')}" maxlength="40">
      </div>

      <div class="field">
        <label class="field__label">הרמה שלי</label>
        <div class="chips">
          ${Store.LEVELS.map((l) => `
            <button type="button" class="chip" data-ed-level="${esc(l)}"
                    aria-pressed="${d.level === l}">${l}</button>`).join('')}
        </div>
      </div>

      <div class="field">
        <label class="field__label">סגנונות</label>
        <div class="chips">
          ${Store.STYLES.map((s) => `
            <button type="button" class="chip" data-ed-style="${esc(s)}"
                    aria-pressed="${d.styles.includes(s)}">${s}</button>`).join('')}
        </div>
      </div>

      <div class="field">
        <label class="field__label">איזו רגל קדימה?</label>
        <div class="chips">
          ${Store.STANCES.map((s) => `
            <button type="button" class="chip" data-ed-stance="${s.id}"
                    aria-pressed="${d.stance === s.id}">${s.label}</button>`).join('')}
        </div>
      </div>

      <div class="field">
        <label class="field__label">מגדר</label>
        <div class="chips">
          ${Store.GENDERS.map((g) => `
            <button type="button" class="chip" data-ed-gender="${g.id}"
                    aria-pressed="${d.gender === g.id}">${g.label}</button>`).join('')}
        </div>
      </div>

      <div class="field">
        <label class="field__label" for="ed-years">שנות רכיבה <span class="muted">(לא חובה)</span></label>
        <input id="ed-years" type="number" min="0" max="80" class="input"
               value="${d.years ?? ''}">
      </div>

      ${errorFor('save')}

      <div class="composer" style="margin-top:20px">
        <button class="btn btn--primary" data-save-profile style="flex:1">שמירה</button>
        <button class="btn btn--ghost btn--sm" data-cancel-edit>ביטול</button>
      </div>
    </div>`;
}

Screens.profile = {
  async html() {
    if (!ME) return `${header('הפרופיל שלי')}${empty('🔒', gt('לא מחובר','לא מחוברת','לא מחוברים'), `${gt('התחבר','התחברי','התחברו')} כדי לראות את הפרופיל.`)}${tabbar('profile')}`;

    const role = Store.ROLES[ME.role];
    const myVideos = await Store.listVideos({ authorId: ME.id });
    const favorites = await Store.listCoaches({ onlyFollowed: true });
    const chats = await Store.listChats();
    const gender = Store.GENDERS.find((g) => g.id === ME.gender);
    const stance = Store.STANCES.find((s) => s.id === ME.stance);
    const ach = await Store.getAchievements(ME.id).catch(() => null);

    return `
      <div class="screen__body has-tabs">
        ${header('הפרופיל שלי')}

        ${editDraft ? profileEditor() : `
        <div class="card profile">
          <div class="profile__avatar">${esc(ME.avatar)}</div>
          <div class="profile__name">${esc(ME.name)}</div>
          <div class="profile__role">${role.icon} ${role.title}</div>
          <p class="small muted" style="margin-top:10px">
            ${ME.age ? `${ME.age} · ` : ''}📍 ${esc(ME.region || '—')}${ME.city ? ` · ${esc(ME.city)}` : ''}
            ${ME.level ? ` · ${esc(ME.level)}` : ''}
            ${stance && stance.id !== 'unknown' ? ` · ${esc(stance.label)}` : ''}
            ${ME.years ? ` · ${ME.years}+ שנות רכיבה` : ''}
            ${gender && gender.id !== 'na' ? ` · ${esc(gender.label)}` : ''}
          </p>
          ${ME.bio ? `<p class="lead" style="margin-top:12px">${esc(ME.bio)}</p>` : ''}
          ${ME.email ? `<p class="small muted" style="margin-top:8px">✉️ ${esc(ME.email)}
            <span class="tag" style="margin-inline-start:6px">גלוי רק ${gt('לך','לך','לכם')}</span></p>` : ''}
          ${ME.styles.length ? `
            <div class="chips" style="justify-content:center;margin-top:14px">
              ${ME.styles.map((s) => `<span class="tag">${esc(s)}</span>`).join('')}
            </div>` : ''}
          <div class="stats">
            <div class="stat"><div class="stat__num">${myVideos.length}</div><div class="stat__label">סרטונים</div></div>
            <div class="stat"><div class="stat__num">${favorites.length}</div><div class="stat__label">מועדפים</div></div>
            <div class="stat"><div class="stat__num">${chats.length}</div><div class="stat__label">חברים</div></div>
          </div>
          <button class="btn btn--ghost" data-edit-profile style="margin-top:18px">✏️ עריכת הפרופיל</button>
        </div>`}

        ${await bagSection(ME.id, { mine: true })}

        ${achievementsBlock(ach)}

        <h3 style="margin:26px 0 12px">המאמנים המועדפים שלי</h3>
        ${favorites.length
          ? `<div class="clist">${favorites.map((c) => coachCard(c, true)).join('')}</div>`
          : empty('⭐️', 'אין עדיין מועדפים', `${gt('עבור','עברי','עברו')} ללשונית מאמנים ${gt('והוסף','והוסיפי','והוסיפו')} את מי ${gt('שאתה אוהב','שאת אוהבת','שאתם אוהבים')}.`)}

        <button class="btn btn--ghost" data-logout style="margin-top:26px">יציאה מהחשבון</button>

        <div class="dangerzone">
          <button class="dangerzone__toggle" data-toggle-danger>
            ${dangerZoneOpen ? '▲' : '▼'} מחיקת חשבון
          </button>
          ${dangerZoneOpen ? `
            <div class="dangerzone__body">
              <p class="small">
                כל הסרטונים, התגובות והצ׳אטים ${gt('שלך','שלך','שלכם')} יימחקו לצמיתות. אי אפשר לבטל את זה.
              </p>
              <div class="field">
                <label class="field__label" for="del-pw">${gt('הקלד','הקלידי','הקלידו')} את הסיסמה ${gt('שלך','שלך','שלכם')} לאישור</label>
                <input id="del-pw" type="password" class="input ${errors.delete ? 'input--error' : ''}"
                       autocomplete="current-password">
                ${errorFor('delete')}
              </div>
              <button class="btn" style="background:var(--danger);color:#fff" data-confirm-delete>
                מחיקת החשבון שלי לצמיתות
              </button>
            </div>` : ''}
        </div>
      </div>
      ${tabbar('profile')}`;
  },

  bind() {
    // ----- עריכת הפרופיל -----
    const startEdit = $('[data-edit-profile]');
    if (startEdit) {
      startEdit.onclick = () => {
        // עותק של הערכים הנוכחיים, כדי שביטול באמת יבטל
        editDraft = {
          name: ME.name, email: ME.email || '', bio: ME.bio || '',
          avatar: ME.avatar, region: ME.region || '', city: ME.city || '',
          level: ME.level || null, styles: [...(ME.styles || [])],
          stance: ME.stance || 'unknown', gender: ME.gender || 'na',
          years: ME.years ?? '',
        };
        errors = {};
        rerender();
      };
    }

    if (editDraft) {
      const d = editDraft;

      // שדות טקסט נקראים בזמן השמירה, אז מספיק לשמור את מה שנבחר בלחיצות
      $$('[data-ed-avatar]').forEach((b) => {
        b.onclick = () => {
          d.avatar = b.dataset.edAvatar;
          $$('[data-ed-avatar]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        };
      });

      $$('[data-ed-level]').forEach((b) => {
        b.onclick = () => {
          // לחיצה שנייה על אותה רמה מבטלת אותה
          d.level = d.level === b.dataset.edLevel ? null : b.dataset.edLevel;
          $$('[data-ed-level]').forEach((x) =>
            x.setAttribute('aria-pressed', String(x.dataset.edLevel === d.level)));
        };
      });

      $$('[data-ed-style]').forEach((b) => {
        b.onclick = () => {
          const set = new Set(d.styles);
          const v = b.dataset.edStyle;
          set.has(v) ? set.delete(v) : set.add(v);
          d.styles = [...set];
          b.setAttribute('aria-pressed', String(set.has(v)));
        };
      });

      $$('[data-ed-stance]').forEach((b) => {
        b.onclick = () => {
          d.stance = b.dataset.edStance;
          $$('[data-ed-stance]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        };
      });

      $$('[data-ed-gender]').forEach((b) => {
        b.onclick = () => {
          d.gender = b.dataset.edGender;
          $$('[data-ed-gender]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        };
      });

      const cancel = $('[data-cancel-edit]');
      if (cancel) cancel.onclick = () => { editDraft = null; errors = {}; rerender(); };

      const save = $('[data-save-profile]');
      if (save) {
        save.onclick = async () => {
          if (save.disabled) return;
          errors = {};

          const name = $('#ed-name').value.trim();
          if (name.length < 2) errors.name = 'צריך שם של שני תווים לפחות';
          if (Object.values(errors).some(Boolean)) return rerender();

          save.disabled = true;
          save.textContent = 'שומר…';

          try {
            const updated = await Store.updateProfile({
              name,
              email: $('#ed-email').value.trim(),
              bio: $('#ed-bio').value,
              city: $('#ed-city').value,
              years: $('#ed-years').value,
              avatar: d.avatar,
              region: $('#ed-region').value,
              level: d.level,
              styles: d.styles,
              stance: d.stance,
              gender: d.gender,
            });
            // ME מתעדכן מהתשובה של השרת, לא מהטיוטה — כך שמה שמוצג
            // הוא מה שבאמת נשמר, כולל נרמול של המייל
            ME = updated;
            editDraft = null;
          } catch (err) {
            errors.save = err.message;
            save.disabled = false;
            save.textContent = 'שמירה';
          }
          rerender();
        };
      }
    }

    const out = $('[data-logout]');
    if (out) {
      out.onclick = async () => {
        await Store.logout();
        resetScreenState();
        navigate('welcome');
      };
    }

    bindBag(ME.id, () => rerender());

    $$('[data-ach-tab]').forEach((b) => {
      b.onclick = () => { achTab = b.dataset.achTab || null; rerender(); };
    });

    const toggle = $('[data-toggle-danger]');
    if (toggle) {
      toggle.onclick = () => {
        dangerZoneOpen = !dangerZoneOpen;
        errors = {};
        rerender();
      };
    }

    const confirmBtn = $('[data-confirm-delete]');
    if (confirmBtn) {
      confirmBtn.onclick = async () => {
        const password = $('#del-pw').value;
        if (!password) {
          errors.delete = 'צריך להקליד את הסיסמה';
          return rerender();
        }
        if (!confirm(`${gt('בטוח','בטוחה','בטוחים')}? הפעולה הזאת סופית ואי אפשר לחזור ממנה.`)) return;

        try {
          await Store.deleteAccount(password);
          resetScreenState();
          dangerZoneOpen = false;
          navigate('welcome');
        } catch (err) {
          errors.delete = err.message;
          rerender();
        }
      };
    }

    bindCards();
  },
};

/* ==========================================================================
   הפעלה
   ========================================================================== */

(async function boot() {
  const user = await Store.currentUser().catch(() => null);
  navigate(user ? 'feed' : 'welcome');
})();
