/* ==========================================================================
   Store — שכבת הנתונים של האפליקציה
   כל הנתונים מגיעים מהשרת. הקבצים מוגשים מ-/media, והזהות נשמרת
   בעוגיית סשן שהדפדפן שולח לבד — אין טוקן שמסתובב ב-JavaScript.
   ========================================================================== */

const Store = (() => {
  const DRAFT_KEY = 'skatelab.draft';

  /* ---------- גישה ל-API ---------- */

  /** שגיאה שמגיעה מהשרת עם הודעה בעברית שאפשר להציג כמו שהיא. */
  class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  }

  async function api(path, { method = 'GET', body, raw, params } = {}) {
    const url = new URL(`/api${path}`, location.origin);
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') url.searchParams.set(k, v);
    });

    const options = { method, credentials: 'same-origin' };

    if (raw) {
      options.body = raw;
      options.headers = { 'Content-Type': raw.type || 'application/octet-stream' };
    } else if (body !== undefined) {
      options.body = JSON.stringify(body);
      options.headers = { 'Content-Type': 'application/json' };
    }

    let res;
    try {
      res = await fetch(url, options);
    } catch {
      throw new ApiError('אין חיבור לשרת. בדקו שהוא רץ ונסו שוב.', 0);
    }

    const text = await res.text();
    const data = text ? JSON.parse(text) : null;

    if (!res.ok) throw new ApiError(data?.error || 'משהו השתבש', res.status);
    return data;
  }

  /* ---------- הגדרות תוכן (קבועות בצד-לקוח) ---------- */

  const ROLES = {
    coach: {
      id: 'coach',
      icon: '🎓',
      title: 'מאמן',
      desc: 'מעלה סרטוני הדרכה, עונה על שאלות ונותן פידבק לרוכבים',
    },
    student: {
      id: 'student',
      icon: '🛹',
      title: 'תלמיד',
      desc: 'מתאמן, מעלה סרטונים של טריקים ומקבל פידבק ממאמנים',
    },
    fan: {
      id: 'fan',
      icon: '👀',
      title: 'סתם סקייטר',
      desc: 'צופה בסרטונים, אוסף טיפים ושואל שאלות מתי שמתחשק',
    },
  };

  const REGIONS = ['צפון', 'חיפה והקריות', 'השרון', 'גוש דן',
                   'ירושלים', 'השפלה', 'דרום', 'אילת'];

  /** רגל קדמית: רגולר = שמאל קדימה, גופי = ימין קדימה. */
  const STANCES = [
    { id: 'regular', label: 'רגולר', hint: 'רגל שמאל קדימה' },
    { id: 'goofy', label: 'גופי', hint: 'רגל ימין קדימה' },
    { id: 'unknown', label: 'עוד לא יודע', hint: 'נגלה בפארק' },
  ];

  const GENDERS = [
    { id: 'male', label: 'זכר' },
    { id: 'female', label: 'נקבה' },
    { id: 'na', label: 'לא רוצה להשיב' },
  ];

  /** שני סוגי הסרטונים: שיעור ממאמן, וטריק שרוכב העלה כדי לקבל פידבק. */
  const KINDS = [
    { id: 'lesson', label: 'שיעורים', icon: '🎓' },
    { id: 'clip', label: 'טריקים לפידבק', icon: '⭐️' },
  ];

  const LEVELS = ['מתחיל', 'יודע קצת', 'בינוני', 'מתקדם', 'מקצוען'];

  const STYLES = ['סטריט', 'פארק', 'פול'];

  const AVATARS = ['🛹', '🤙', '🔥', '⚡️', '🦈', '🐺', '🐉', '👽', '🤖', '🌊', '💀', '🌈'];

  const MIN_PASSWORD = 4;

  /* ---------- עזרי תאריך ---------- */

  /** גיל בשנים מלאות לפי {d, m, y}. מחזיר null אם התאריך חסר. */
  function ageFrom(dob) {
    if (!dob || !dob.d || !dob.m || !dob.y) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.y;
    const passed =
      today.getMonth() + 1 > dob.m ||
      (today.getMonth() + 1 === dob.m && today.getDate() >= dob.d);
    if (!passed) age -= 1;
    return age;
  }

  /** בדיקה שהתאריך קיים באמת בלוח השנה (למשל 31.2 ייפסל). */
  function isRealDate(dob) {
    if (!dob || !dob.d || !dob.m || !dob.y) return false;
    const date = new Date(dob.y, dob.m - 1, dob.d);
    return (
      date.getFullYear() === dob.y &&
      date.getMonth() === dob.m - 1 &&
      date.getDate() === dob.d &&
      date <= new Date()
    );
  }

  const isoDate = (dob) => !dob?.y ? null :
    `${dob.y}-${String(dob.m).padStart(2, '0')}-${String(dob.d).padStart(2, '0')}`;

  /* ---------- טיוטת הרשמה ---------- */

  const getDraft = () => {
    try {
      return JSON.parse(localStorage.getItem(DRAFT_KEY)) || {};
    } catch {
      return {};
    }
  };

  const saveDraft = (draft) => localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  const clearDraft = () => localStorage.removeItem(DRAFT_KEY);

  /* ---------- חשבון ---------- */

  /* נשאל פעם אחת לכל טעינת דף — התשובה לא משתנה תוך כדי. */
  let invitePromise = null;
  const inviteRequired = () => {
    invitePromise ??= api('/auth/invite-required').then((r) => r.required, () => false);
    return invitePromise;
  };

  async function register(draft, password, invite) {
    const user = await api('/auth/register', {
      method: 'POST',
      body: {
        name: draft.name,
        password,
        invite,
        email: draft.email || null,
        avatar: draft.avatar || '🛹',
        gender: draft.gender || 'na',
        stance: draft.stance || 'unknown',
        dob: isoDate(draft.dob),
        role: draft.role,
        level: draft.level || null,
        region: draft.region || null,
        city: draft.city || null,
        years: draft.years || null,
        // סינון אחרון, למקרה שהטיוטה נשמרה לפני שסגנון כלשהו הוסר מהאפליקציה
        styles: (draft.styles || []).filter((s) => STYLES.includes(s)),
      },
    });
    clearDraft();
    return user;
  }

  const login = (name, password) => api('/auth/login', { method: 'POST', body: { name, password } });

  const logout = () => api('/auth/logout', { method: 'POST' });

  const deleteAccount = (password) => api('/auth/delete', { method: 'POST', body: { password } });

  const currentUser = () => api('/auth/me');

  /** עדכון הפרופיל. נשלחים רק השדות שהשתנו. */
  const updateProfile = (fields) => api('/me', { method: 'PATCH', body: fields });

  /* ---------- משתמשים, מאמנים ומועדפים ---------- */

  const getUser = (id) => api(`/users/${id}`).catch(() => null);

  const listCoaches = ({ region, style, query, onlyFollowed } = {}) =>
    api('/coaches', { params: { region, style, query, onlyFollowed: onlyFollowed || '' } });

  /** כל האנשים בקהילה — מאמנים, תלמידים וסקייטרים. `role` מגביל לתפקיד אחד. */
  const listPeople = ({ region, style, query, role } = {}) =>
    api('/people', { params: { region, style, query, role } });

  const toggleFollow = (coachId) =>
    api(`/users/${coachId}/follow`, { method: 'POST' }).then((r) => r.following);

  /* ---------- סרטונים ---------- */

  const listVideos = ({ region, style, level, kind, query, authorId, onlyFollowed } = {}) =>
    api('/videos', {
      params: { region, style, level, kind, query, authorId, onlyFollowed: onlyFollowed || '' },
    });

  const getVideo = (id) => api(`/videos/${id}`).catch(() => null);

  const addVideo = (data) => api('/videos', {
    method: 'POST',
    body: {
      title: data.title,
      desc: data.desc,
      level: data.level,
      region: data.region,
      styles: data.styles,
      poster: data.poster,
      kind: data.kind,
    },
  });

  const deleteVideo = (id) => api(`/videos/${id}`, { method: 'DELETE' }).then(() => true, () => false);

  const toggleLike = (id) => api(`/videos/${id}/like`, { method: 'POST' });

  const countView = (id) => api(`/videos/${id}/view`, { method: 'POST' }).then((r) => r.views, () => 0);

  /** `parentId` הופך את התגובה לתשובה על תגובה קיימת. */
  const addComment = (videoId, text, parentId = null) =>
    api(`/videos/${videoId}/comments`, { method: 'POST', body: { text, parentId } });

  /** התגובות שאנשים כתבו על הסרטונים שלי, עם סימון מה עדיין מחכה לתשובה. */
  const listInbox = () => api('/inbox');

  const countWaiting = () => api('/inbox/count').then((r) => r.waiting, () => 0);

  /** סיכום הביצועים של הסרטונים שלי, למסך "הסרטונים שלי". */
  async function myVideoStats(meId) {
    const mine = await listVideos({ authorId: meId });
    return mine.reduce((sum, v) => ({
      videos: sum.videos + 1,
      views: sum.views + (v.views || 0),
      likes: sum.likes + (v.likedBy || []).length,
      // סופרים גם תשובות בתוך שרשור, ומדלגים על מה שאני עצמי כתבתי
      comments: sum.comments + (v.comments || []).reduce(
        (n, c) => n + (c.authorId !== meId ? 1 : 0)
                    + (c.replies || []).filter((r) => r.authorId !== meId).length, 0),
    }), { videos: 0, views: 0, likes: 0, comments: 0 });
  }

  /* ---------- AI ---------- */

  const aiStatus = () => api('/ai/status').then((r) => r.available, () => false);

  const aiAsk = (question) =>
    api('/ai/ask', { method: 'POST', body: { question } }).then((r) => r.answer);

  const aiFeedback = (videoId, note, frames) =>
    api(`/ai/feedback/${videoId}`, { method: 'POST', body: { note, frames } });

  /** היסטוריית הצ׳אט עם ה-AI, ושליחת הודעה לתוכה. */
  const getAiChat = () => api('/ai/chat');
  const sendToAi = (text) => api('/ai/chat', { method: 'POST', body: { text } });
  const clearAiChat = () => api('/ai/chat', { method: 'DELETE' });

  /* ---------- התיק ---------- */

  const getBag = (userId) => api(`/bag/${userId}`);

  /** הוספת טריק לתיק. הפריימים נשלחים לבדיקת ה-AI. */
  const addToBag = (name, videoId, frames) =>
    api('/bag', { method: 'POST', body: { name, videoId, frames } });

  const removeFromBag = (id) => api(`/bag/${id}`, { method: 'DELETE' });

  const verifyBagEntry = (id, verified = true) =>
    api(`/bag/${id}/verify`, { method: 'POST', body: { verified } });

  /** ההישגים של משתמש — מה הושג וכמה חסר לכל אחד. */
  const getAchievements = (userId) => api(`/achievements/${userId}`);

  /* ---------- חברים וצ'אטים ---------- */

  const friendState = (id) => api(`/friends/state/${id}`).then((r) => r.state, () => 'none');

  const sendFriendRequest = (toId) => api('/friends/request', { method: 'POST', body: { toId } });

  const listIncomingRequests = () => api('/friends/incoming');
  const listOutgoingRequests = () => api('/friends/outgoing');

  const countIncomingRequests = () => api('/friends/incoming').then((r) => r.length, () => 0);

  const acceptRequest = (id) => api(`/friends/${id}/accept`, { method: 'POST' });
  const declineRequest = (id) => api(`/friends/${id}/decline`, { method: 'POST' }).then(() => true);

  const listChats = () => api('/chats');
  const getChat = (id) => api(`/chats/${id}`).catch(() => null);

  const chatWith = (userId) =>
    api('/chats').then((chats) => chats.find((c) => c.other?.id === userId) || null);

  const sendMessage = (chatId, text) =>
    api(`/chats/${chatId}/messages`, { method: 'POST', body: { text } });

  return {
    ApiError,
    ROLES, REGIONS, GENDERS, STANCES, KINDS, LEVELS, STYLES, AVATARS, MIN_PASSWORD,
    ageFrom, isRealDate,
    getDraft, saveDraft, clearDraft,
    register, login, logout, deleteAccount, currentUser, updateProfile, inviteRequired,
    getUser, listCoaches, listPeople, toggleFollow,
    listVideos, getVideo, addVideo, deleteVideo, toggleLike, countView, addComment, myVideoStats,
    listInbox, countWaiting,
    aiStatus, aiAsk, aiFeedback, getAchievements, getAiChat, sendToAi, clearAiChat,
    getBag, addToBag, removeFromBag, verifyBagEntry,
    friendState, sendFriendRequest, listIncomingRequests, listOutgoingRequests,
    countIncomingRequests, acceptRequest, declineRequest,
    listChats, getChat, chatWith, sendMessage,
  };
})();
