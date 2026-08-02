/* ==========================================================================
   Media — קבצי הווידאו והתמונות הממוזערות
   הקבצים יושבים על השרת ומוגשים מ-/media, אז אין כאן יותר אחסון מקומי:
   רק כתובות והעלאה. הכתובות קבועות, ולכן הדפדפן גם יכול לשמור אותן במטמון.
   ========================================================================== */

const Media = (() => {
  const videoUrl = (videoId) => `/media/video_${encodeURIComponent(videoId)}`;
  const thumbUrl = (videoId) => `/media/thumb_${encodeURIComponent(videoId)}`;

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
   */
  async function extractFrames(videoId, count = 6, maxSide = 512) {
    const video = document.createElement('video');
    video.src = videoUrl(videoId);
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

      const frames = [];
      for (let i = 0; i < count; i += 1) {
        // דוגמים בפריסה אחידה, בלי ממש בהתחלה ובסוף
        const at = duration * ((i + 0.5) / count);
        await seek(video, at);
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

  const seek = (video, time) => new Promise((resolve) => {
    video.onseeked = resolve;
    video.currentTime = time;
    setTimeout(resolve, 3000);   // לא נתקעים על פריים בודד
  });

  return { videoUrl, thumbUrl, shrinkImage, canDecode, putVideo, putThumb, extractFrames };
})();
