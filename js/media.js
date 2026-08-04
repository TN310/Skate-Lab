/* ==========================================================================
   Media — קבצי הווידאו והתמונות הממוזערות

   הכתובת מגיעה מהשרת יחד עם הסרטון, כי היא תלויה במקום שבו הקובץ יושב:
   ב-Cloudinary זו כתובת CDN מלאה, ומקומית זו כתובת /media. הנפילה
   לכתובת המקומית קיימת רק בשביל סרטונים ישנים שנשמרו לפני המעבר.
   ========================================================================== */

const Media = (() => {
  /** מקבל אובייקט סרטון (מועדף) או מזהה בלבד. */
  const videoUrl = (v) => (typeof v === 'object' && v?.videoUrl)
    ? v.videoUrl
    : `/media/video_${encodeURIComponent(typeof v === 'object' ? v.id : v)}`;

  const thumbUrl = (v) => (typeof v === 'object' && v?.thumbUrl)
    ? v.thumbUrl
    : `/media/thumb_${encodeURIComponent(typeof v === 'object' ? v.id : v)}`;

  /**
   * מקטין תמונה לפני ההעלאה. תמונה מהטלפון היא כמה מגה-בייט, ובכרטיס
   * היא ממילא מוצגת ברוחב של כמה מאות פיקסלים.
   * מחזיר null אם הדפדפן לא הצליח לפענח את הקובץ.
   */
  async function shrinkImage(file, maxSide = 720) {
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      return null;
    }

    try {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    } catch (err) {
      console.warn('הקטנת התמונה נכשלה:', err);
      return null;
    } finally {
      // חשוב גם במסלול הכושל — bitmap מפוענח תופס עשרות מגה-בייט
      bitmap.close?.();
    }
  }

  /** בדיקה שהדפדפן בכלל יודע לפענח את הקובץ, לפני שמבטיחים למשתמש שהוא ייקלט. */
  async function canDecode(file) {
    try {
      const bitmap = await createImageBitmap(file);
      bitmap.close?.();
      return true;
    } catch {
      return false;
    }
  }

  async function upload(path, blob) {
    const res = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': blob.type || 'application/octet-stream' },
      body: blob,
    });
    if (!res.ok) return null;
    return res.json().catch(() => ({ ok: true }));
  }

  /** מחזיר את תשובת השרת, שכוללת סימון אם הקובץ כבר הועלה על ידי מישהו אחר. */
  const putVideo = (videoId, file) => upload(`/api/videos/${videoId}/file`, file);

  async function putThumb(videoId, file) {
    const small = await shrinkImage(file);
    if (!small) return false;
    return !!await upload(`/api/videos/${videoId}/thumb`, small);
  }

  /**
   * מחלץ פריימים מסרטון שכבר הועלה, לבדיקת ה-AI.
   * נעשה בדפדפן כי הוא כבר יודע לפענח וידאו — ככה אין צורך בכלי המרה בשרת.
   * מחזיר מערך של מחרוזות base64 (בלי הקידומת של data URL).
   *
   * המודל לא מקבל קובץ וידאו, רק תמונות — "לראות את הסרטון" פירושו
   * לדגום ממנו פריימים. `at` מצמצם את הדגימה לחלון של ±`window` שניות
   * סביב רגע מסוים, וזה מה שמאפשר לבדוק טריק אחד מתוך קו של כמה:
   * בלעדיו שמונה פריימים נמרחים על כל הסרטון ומפספסים את הרגע.
   */
  async function extractFrames(source, { count = 8, at = null, window = 2, maxSide = 512 } = {}) {
    const video = document.createElement('video');
    video.src = videoUrl(source);
    video.muted = true;
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';

    const ready = new Promise((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('לא הצלחנו לקרוא את הסרטון'));
      // סרטון פגום עלול לא לירות אף אירוע
      setTimeout(() => reject(new Error('פסק זמן בקריאת הסרטון')), 15000);
    });

    try {
      await ready;
      const duration = video.duration;
      if (!isFinite(duration) || duration <= 0) return [];

      const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext('2d');

      // חלון סביב רגע מסוים, או כל הסרטון כשלא סומן רגע
      const marked = Number.isFinite(at) && at !== null;

      const from = marked ? Math.max(0, at - window) : 0;
      const to = marked ? Math.min(duration, at + window) : duration;
      const span = Math.max(to - from, 0.1);

      // בערך ארבעה פריימים לשנייה לכל היותר — בקליפ של חצי שנייה אין
      // שמונה תמונות שונות, ורק היו נדגמות אותן תמונות שוב ושוב
      const total = Math.max(2, Math.min(count, Math.round(span * 4)));

      const frames = [];
      for (let i = 0; i < total; i += 1) {
        // דוגמים בפריסה אחידה, בלי ממש בהתחלה ובסוף
        const moment = from + span * ((i + 0.5) / total);
        await seek(video, moment);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL('image/jpeg', 0.7).split(',')[1]);
      }
      return frames;
    } catch (err) {
      console.warn('חילוץ פריימים נכשל:', err);
      return [];
    } finally {
      video.src = '';
    }
  }

  /*
   * דילוג לנקודה בסרטון. שתי מלכודות:
   * • כשכבר עומדים כמעט בדיוק שם, הדפדפן לא יורה seeked בכלל — ואז
   *   ההמתנה נגמרת רק בפסק הזמן. בסרטון קצר זה קרה כמעט בכל פריים,
   *   והחילוץ נמשך עשרות שניות במקום להיגמר מיד.
   * • גם אחרת עדיף פסק זמן קצר: פריים אחד שלא נטען לא שווה המתנה.
   */
  const seek = (video, time) => new Promise((resolve) => {
    if (Math.abs(video.currentTime - time) < 0.04) return resolve();
    video.onseeked = resolve;
    video.currentTime = time;
    setTimeout(resolve, 1200);
  });

  return { videoUrl, thumbUrl, shrinkImage, canDecode, putVideo, putThumb, extractFrames };
})();
