/* ==========================================================================
   Tricks — קטלוג הטריקים
   הרשימה בנויה על הקאנון המקובל של הסקייטבורד ומחולקת לדיסציפלינות.
   כל הטריקים פתוחים תמיד — השדה `after` הוא סדר לימוד מומלץ בלבד.
   טריק נחשב "נחת" רק אחרי שמאמן אישר את ההגשה.
   ========================================================================== */

export const DISCIPLINES = [
  { id: 'basics', label: 'יסודות', icon: '🛹',
    desc: 'מה שצריך לדעת לפני הכל — עמידה, דחיפה, בלימה ונפילה נכונה.' },
  { id: 'flat', label: 'פלאט ופליפים', icon: '🏙',
    desc: 'אוליי וכל משפחת הפליפים והשאביטים. הבסיס של הסטריט.' },
  { id: 'grind', label: 'גריינדים', icon: '⚙️',
    desc: 'החלקה על הטראקים — מאבן שפה נמוכה ועד רייל.' },
  { id: 'slide', label: 'סלײדים', icon: '🛝',
    desc: 'החלקה על הלוח עצמו: בורדסלייד, נוזסלייד, בלאנט ומה שביניהם.' },
  { id: 'park', label: 'פארק ואוויר', icon: '🪂',
    desc: 'טרנזישן, גראבים וסיבובים באוויר.' },
  { id: 'mini', label: 'מיני ראמפ', icon: '〽️',
    desc: 'ליפ טריקס על הקופינג — המקום הכי טוב ללמוד טרנזישן.' },
  { id: 'pool', label: 'פול ואינוורטים', icon: '🌊',
    desc: 'דפנות עגולות, קופינג, והטריקים שהופכים אותך על הראש.' },
  { id: 'old', label: 'פריסטייל ואולד סקול', icon: '📻',
    desc: 'קספר, פוגו, ווק דה דוג — הטריקים שהתחילו הכל.' },
];

/**
 * כל שורה: [id, discipline, level, שם עברי, שם לועזי, תיאור, after, sided?]
 * `after` = הטריקים שכדאי לנחות לפני. זו המלצה בלבד — כל הטריקים
 * פתוחים תמיד, ואפשר להגיש כל אחד מהם לאישור בכל רגע.
 * `sided` = לטריק יש גרסת פרונטסייד וגרסת בקסייד, שכל אחת מאושרת בנפרד.
 */
const ROWS = [
  /* ================= יסודות ================= */
  ['stance', 'basics', 'מתחיל', 'עמידה ודחיפה', 'Pushing', 'רגולר או גופי, דחיפה עם הרגל האחורית ומבט קדימה.', []],
  ['stop', 'basics', 'מתחיל', 'עצירה מבוקרת', 'Foot Brake', 'לגרור את הסוליה על האספלט עד עצירה מלאה.', ['stance']],
  ['falling', 'basics', 'מתחיל', 'נפילה נכונה', 'Bailing', 'להתגלגל במקום לבלום עם היד. השיעור שחוסך שברים.', ['stance']],
  ['turn', 'basics', 'מתחיל', 'פנייה וקארב', 'Carving', 'להטות משקל על העקבים ועל האצבעות בלי להרים גלגלים.', ['stop']],
  ['kickturn', 'basics', 'מתחיל', 'קיקטרן', 'Kickturn', 'הרמת החרטום ופנייה של 90° במקום.', ['turn']],
  ['tictac', 'basics', 'יודע קצת', 'טיק-טק', 'Tic-Tac', 'הרמות קטנות של החרטום כדי לצבור מהירות ולתמרן.', ['kickturn', 'falling']],
  ['fakie', 'basics', 'יודע קצת', 'נסיעה בפייקי', 'Fakie', 'נסיעה אחורה באותה עמידה. מרגיש הפוך בהתחלה.', ['tictac']],
  ['switch', 'basics', 'בינוני', 'נסיעה בסוויץ׳', 'Switch', 'לרכוב בעמידה ההפוכה שלך. כמו ללמוד לכתוב ביד שנייה.', ['fakie']],
  ['powerslide', 'basics', 'יודע קצת', 'פאוורסלייד', 'Powerslide', 'סיבוב הלוח 90° והחלקה על הגלגלים לעצירה.', ['turn']],
  ['manual', 'basics', 'יודע קצת', 'מניואל', 'Manual', 'נסיעה על שני הגלגלים האחוריים — נקודת איזון.', ['tictac']],
  ['nosemanual', 'basics', 'בינוני', 'נוז מניואל', 'Nose Manual', 'אותו דבר, אבל על הגלגלים הקדמיים.', ['manual']],

  /* ================= פלאט ופליפים ================= */
  ['ollie', 'flat', 'יודע קצת', 'אוליי', 'Ollie', 'הפופ הראשון. הבסיס כמעט לכל טריק אחר.', ['tictac']],
  ['ollie_curb', 'flat', 'יודע קצת', 'אוליי מעל מכשול', 'Ollie over', 'אותו אוליי, בתנועה ומעל אבן שפה.', ['ollie']],
  ['nollie', 'flat', 'בינוני', 'נולי', 'Nollie', 'פופ מהחרטום במקום מהזנב.', ['ollie_curb', 'fakie']],
  ['fakie_ollie', 'flat', 'יודע קצת', 'פייקי אוליי', 'Fakie Ollie', 'אוליי תוך כדי נסיעה אחורה.', ['ollie', 'fakie']],
  ['switch_ollie', 'flat', 'מתקדם', 'סוויץ׳ אוליי', 'Switch Ollie', 'אוליי בעמידה ההפוכה.', ['ollie_curb', 'switch']],
  ['shifty', 'flat', 'יודע קצת', 'שיפטי', 'Shifty', 'סיבוב קל של הכתפיים והלוח וחזרה באוויר.', ['ollie']],
  ['ollie180', 'flat', 'בינוני', 'אוליי 180', 'Ollie 180', 'חצי סיבוב באוויר. בקסייד = הגב לכיוון הנסיעה.', ['ollie_curb'], 1],
  ['halfcab', 'flat', 'בינוני', 'האף קאב', 'Half-Cab', 'פייקי 180 חזרה לכיוון הנסיעה.', ['fakie_ollie', 'ollie180'], 1],
  ['fullcab', 'flat', 'מתקדם', 'פול קאב', 'Caballerial', 'פייקי 360 מלא.', ['halfcab'], 1],
  ['shuvit', 'flat', 'יודע קצת', 'שאביט', 'Shove-it', 'הלוח מסתובב 180° מתחת לרגליים בלי פופ.', ['ollie']],
  ['popshuvit', 'flat', 'בינוני', 'פופ שאביט', 'Pop Shove-it', 'שאביט עם פופ — הרגל האחורית עושה הכל.', ['shuvit', 'ollie_curb'], 1],
  ['shuvit360', 'flat', 'מתקדם', '360 שאביט', '360 Shove-it', 'סיבוב מלא של הלוח מתחת לרגליים.', ['popshuvit'], 1],
  ['bigspin', 'flat', 'מתקדם', 'ביגספין', 'Bigspin', '360 שאביט של הלוח יחד עם 180 של הגוף.', ['shuvit360', 'ollie180'], 1],
  ['kickflip', 'flat', 'בינוני', 'קיקפליפ', 'Kickflip', 'אוליי עם בעיטה שמסובבת את הלוח סביב הציר הארוך.', ['ollie_curb']],
  ['heelflip', 'flat', 'בינוני', 'הילפליפ', 'Heelflip', 'כמו קיקפליפ, אבל הסיבוב עם העקב לכיוון ההפוך.', ['kickflip']],
  ['varial_kickflip', 'flat', 'מתקדם', 'ורייל קיקפליפ', 'Varial Kickflip', 'בקסייד שאביט משולב עם קיקפליפ.', ['kickflip', 'popshuvit']],
  ['varial_heelflip', 'flat', 'מתקדם', 'ורייל הילפליפ', 'Varial Heelflip', 'פרונטסייד שאביט משולב עם הילפליפ.', ['heelflip', 'popshuvit']],
  ['hardflip', 'flat', 'מתקדם', 'הארדפליפ', 'Hardflip', 'פרונטסייד שאביט עם קיקפליפ — הלוח עובר בין הרגליים.', ['varial_kickflip']],
  ['inward_heel', 'flat', 'מתקדם', 'אינוורד הילפליפ', 'Inward Heelflip', 'בקסייד שאביט עם הילפליפ.', ['varial_heelflip']],
  ['treflip', 'flat', 'מתקדם', 'טרה פליפ', '360 Flip', '360 שאביט וקיקפליפ יחד. הטריק שכולם רוצים.', ['varial_kickflip', 'shuvit360']],
  ['laserflip', 'flat', 'מקצוען', 'לייזר פליפ', 'Laser Flip', '360 שאביט קדימה עם הילפליפ.', ['treflip', 'inward_heel']],
  ['bigflip', 'flat', 'מקצוען', 'ביגפליפ', 'Bigflip', 'ביגספין עם קיקפליפ.', ['bigspin', 'treflip']],
  ['bigheel', 'flat', 'מקצוען', 'ביג הילפליפ', 'Big Heelflip', 'ביגספין עם הילפליפ.', ['bigflip', 'heelflip']],
  ['double_kickflip', 'flat', 'מקצוען', 'דאבל קיקפליפ', 'Double Kickflip', 'שתי סיבובים מלאים של הלוח באוליי אחד.', ['treflip']],
  ['double_heelflip', 'flat', 'מקצוען', 'דאבל הילפליפ', 'Double Heelflip', 'אותו דבר עם העקב.', ['double_kickflip', 'inward_heel']],
  ['kickflip180', 'flat', 'מקצוען', 'קיקפליפ 180', 'Kickflip 180', 'קיקפליפ יחד עם חצי סיבוב של הגוף.', ['kickflip', 'ollie180'], 1],
  ['heelflip180', 'flat', 'מקצוען', 'הילפליפ 180', 'Heelflip 180', 'הילפליפ יחד עם חצי סיבוב.', ['heelflip', 'ollie180'], 1],
  ['impossible', 'flat', 'מקצוען', 'אימפוסיבל', 'Impossible', 'הלוח מתגלגל סביב הרגל האחורית.', ['popshuvit', 'manual']],
  ['casperflip', 'flat', 'מקצוען', 'קספר פליפ', 'Casper Flip', 'הלוח מתהפך, נתפס עם הרגל ומוחזר.', ['impossible', 'kickflip']],
  ['pressure_flip', 'flat', 'מקצוען', 'פרשר פליפ', 'Pressure Flip', 'סיבוב שנוצר מלחץ של הרגל האחורית בלבד.', ['impossible']],
  ['underflip', 'flat', 'מקצוען', 'אנדרפליפ', 'Underflip', 'הפליפ מתחיל מהצד התחתון של הלוח.', ['varial_heelflip']],
  ['gazelle', 'flat', 'מקצוען', 'גאזל פליפ', 'Gazelle Flip', 'ביגפליפ עם 540 של הגוף. מפלצת.', ['bigflip', 'fullcab']],
  ['hospital', 'flat', 'מתקדם', 'הוספיטל פליפ', 'Hospital Flip', 'חצי פליפ שנתפס עם הרגל ומתהפך חזרה.', ['kickflip']],
  ['nocomply', 'flat', 'בינוני', 'נו קומפליי', 'No Comply', 'הרגל הקדמית יורדת לקרקע והלוח מסתובב.', ['ollie']],
  ['boneless', 'flat', 'בינוני', 'בונלס', 'Boneless', 'תופסים את הלוח ביד וקופצים עם רגל על הקרקע.', ['nocomply']],
  ['nollie_flip', 'flat', 'מקצוען', 'נולי קיקפליפ', 'Nollie Flip', 'קיקפליפ מהחרטום.', ['nollie', 'kickflip']],
  ['switch_flip', 'flat', 'מקצוען', 'סוויץ׳ קיקפליפ', 'Switch Flip', 'קיקפליפ בעמידה ההפוכה.', ['switch_ollie', 'kickflip']],
  ['fingerflip', 'flat', 'מתקדם', 'פינגר פליפ', 'Fingerflip', 'היד מסובבת את הלוח באוויר.', ['boneless']],

  /* ================= גריינדים ================= */
  ['grind5050', 'grind', 'בינוני', '50-50 גריינד', '50-50', 'שני הטראקים על המכשול. מתחילים על אבן שפה.', ['ollie_curb'], 1],
  ['grind5o', 'grind', 'מתקדם', '5-0 גריינד', '5-0', 'רק הטראק האחורי על הקצה, החרטום באוויר.', ['grind5050', 'manual'], 1],
  ['nosegrind', 'grind', 'מתקדם', 'נוזגריינד', 'Nosegrind', 'רק הטראק הקדמי, הזנב באוויר.', ['grind5o', 'nosemanual'], 1],
  ['crooked', 'grind', 'מתקדם', 'קרוקד גריינד', 'Crooked Grind', 'נוזגריינד בזווית, החרטום נוגע.', ['nosegrind'], 1],
  ['overcrook', 'grind', 'מקצוען', 'אוברקרוק', 'Overcrook', 'קרוקד עם הלוח נוטה לצד השני.', ['crooked'], 1],
  ['feeble', 'grind', 'מתקדם', 'פיבל גריינד', 'Feeble Grind', 'הטראק האחורי גורד והחרטום מעבר לרייל.', ['grind5o'], 1],
  ['smith', 'grind', 'מתקדם', 'סמית׳ גריינד', 'Smith Grind', 'כמו פיבל, אבל החרטום נוטה למטה בצד הקרוב.', ['feeble'], 1],
  ['salad', 'grind', 'מקצוען', 'סלאד גריינד', 'Salad Grind', '5-0 עם החרטום מופנה החוצה.', ['feeble'], 1],
  ['suski', 'grind', 'מקצוען', 'סוסקי גריינד', 'Suski Grind', 'הגרסה הפרונטסיידית של הסלאד.', ['salad']],
  ['willy', 'grind', 'מקצוען', 'ווילי גריינד', 'Willy Grind', 'פרונטסייד פיבל.', ['feeble'], 1],
  ['losi', 'grind', 'מקצוען', 'לוסי גריינד', 'Losi Grind', 'פרונטסייד סמית׳.', ['smith'], 1],
  ['hurricane', 'grind', 'מקצוען', 'הוריקן', 'Hurricane', 'פייקי 5-0 אחרי 180 לתוך הרייל.', ['grind5o', 'ollie180'], 1],
  ['sugarcane', 'grind', 'מקצוען', 'שוגרקיין', 'Sugarcane', 'ההפך מהוריקן — נוז בזווית אחורית.', ['hurricane', 'nosegrind'], 1],
  ['crail_grind', 'grind', 'מקצוען', 'קרייל גריינד', 'Crail Grind', 'גריינד עם תפיסת החרטום ביד הקדמית.', ['nosegrind'], 1],
  ['pogo_grind', 'grind', 'מקצוען', 'פוגו גריינד', 'Pogo Grind', 'גריינד על הזנב בעמידה אנכית.', ['grind5o'], 1],
  ['grind_onefoot', 'grind', 'מקצוען', 'גריינד ברגל אחת', 'One-Footed Grind', '50-50 עם רגל אחת מורמת.', ['grind5050']],

  /* ================= סליידים ================= */
  ['boardslide', 'slide', 'מתקדם', 'בורדסלייד', 'Boardslide', 'הלוח מאונך לרייל ומחליק על מרכזו.', ['grind5050'], 1],
  ['lipslide', 'slide', 'מתקדם', 'ליפסלייד', 'Lipslide', 'כמו בורדסלייד, אבל הזנב עובר את הרייל ראשון.', ['boardslide'], 1],
  ['noseslide', 'slide', 'מתקדם', 'נוזסלייד', 'Noseslide', 'החלקה על החרטום בלבד.', ['boardslide'], 1],
  ['tailslide', 'slide', 'מתקדם', 'טיילסלייד', 'Tailslide', 'החלקה על הזנב בלבד.', ['noseslide'], 1],
  ['bluntslide', 'slide', 'מקצוען', 'בלאנטסלייד', 'Bluntslide', 'החלקה על הזנב כשהגלגלים מעל הקצה.', ['tailslide'], 1],
  ['nosebluntslide', 'slide', 'מקצוען', 'נוזבלאנט סלייד', 'Noseblunt Slide', 'אותו רעיון מצד החרטום.', ['bluntslide', 'noseslide'], 1],
  ['darkslide', 'slide', 'מקצוען', 'דארקסלייד', 'Darkslide', 'החלקה על הלוח כשהוא הפוך.', ['bluntslide', 'casperflip']],
  ['casperslide', 'slide', 'מקצוען', 'קספרסלייד', 'Casper Slide', 'החלקה על הלוח ההפוך עם רגל על הזנב.', ['darkslide']],
  ['bertslide', 'slide', 'בינוני', 'ברט סלייד', 'Bert Slide', 'סליד עם יד על הרצפה, אולד סקול.', ['powerslide']],
  ['colemanslide', 'slide', 'בינוני', 'קולמן סלייד', 'Coleman Slide', 'סליד עם יד, מסורת הדאונהיל.', ['bertslide']],
  ['crailslide', 'slide', 'מקצוען', 'קרייל סלייד', 'Crail Slide', 'סלייד עם תפיסת חרטום.', ['tailslide', 'crail_grind']],
  ['primo', 'slide', 'מקצוען', 'פרימו סלייד', 'Primo Slide', 'החלקה על צד הלוח.', ['darkslide']],

  /* ================= פארק ואוויר ================= */
  ['dropin', 'park', 'יודע קצת', 'דרופ-אין', 'Drop-in', 'הכניסה מהקצה. עניין של משקל גוף ואומץ.', ['kickturn', 'falling']],
  ['pumping', 'park', 'יודע קצת', 'פאמפינג', 'Pumping', 'לצבור מהירות בטרנזישן בלי לדחוף אף פעם.', ['dropin']],
  ['kickturn_quarter', 'park', 'בינוני', 'קיקטרן על קוורטר', 'Quarter Kickturn', 'פנייה של 180° בדופן בלי לרדת מהלוח.', ['pumping'], 1],
  ['ollie_transition', 'park', 'בינוני', 'אוליי בטרנזישן', 'Transition Ollie', 'פופ תוך כדי עלייה בדופן.', ['kickturn_quarter', 'ollie']],
  ['air_bs', 'park', 'מתקדם', 'בקסייד אייר', 'Backside Air', 'יציאה מהקצה עם הגב לדופן.', ['ollie_transition'], 1],
  ['air_fs', 'park', 'מתקדם', 'פרונטסייד אייר', 'Frontside Air', 'יציאה מהקצה עם החזה לדופן.', ['air_bs'], 1],
  ['grab_indy', 'park', 'מתקדם', 'אינדי גראב', 'Indy Grab', 'תפיסת אמצע הלוח ביד האחורית.', ['air_bs']],
  ['grab_mute', 'park', 'מתקדם', 'מיוט גראב', 'Mute Grab', 'היד הקדמית תופסת בצד האצבעות.', ['grab_indy']],
  ['grab_melon', 'park', 'מתקדם', 'מלון גראב', 'Melon', 'היד הקדמית תופסת בצד העקבים.', ['grab_indy']],
  ['grab_stalefish', 'park', 'מקצוען', 'סטיילפיש', 'Stalefish', 'היד האחורית מאחורי הרגליים בצד העקבים.', ['grab_melon']],
  ['grab_nose', 'park', 'מתקדם', 'נוזגראב', 'Nose Grab', 'תפיסת החרטום באוויר.', ['grab_indy']],
  ['grab_tail', 'park', 'מתקדם', 'טייל גראב', 'Tail Grab', 'תפיסת הזנב באוויר.', ['grab_nose']],
  ['method', 'park', 'מקצוען', 'מת׳וד אייר', 'Method Air', 'הברכיים מתקפלות והלוח נמשך לגב. הקלאסיקה.', ['grab_melon']],
  ['japan', 'park', 'מקצוען', 'ג׳פן אייר', 'Japan Air', 'הרגל הקדמית מתקפלת מתחת ללוח.', ['method']],
  ['airwalk', 'park', 'מקצוען', 'איירווק', 'Airwalk', 'שתי הרגליים יוצאות מהלוח לצדדים.', ['grab_nose']],
  ['benihana', 'park', 'מקצוען', 'בניהאנה', 'Benihana', 'הרגל האחורית יוצאת והיד תופסת זנב.', ['grab_tail']],
  ['rocket', 'park', 'מקצוען', 'רוקט אייר', 'Rocket Air', 'שתי הרגליים על הזנב והלוח אנכי.', ['grab_tail']],
  ['air360', 'park', 'מקצוען', '360 אייר', '360 Air', 'סיבוב מלא באוויר מעל הקצה.', ['air_fs', 'grab_indy'], 1],
  ['air540', 'park', 'מקצוען', '540', '540', 'סיבוב וחצי. מקטרנס מלא.', ['air360', 'method']],
  ['mctwist', 'park', 'מקצוען', 'מקטוויסט', 'McTwist', '540 עם סלטה קדימה.', ['air540']],
  ['air720', 'park', 'מקצוען', '720', '720', 'שני סיבובים מלאים.', ['air540']],
  ['air900', 'park', 'מקצוען', '900', '900', 'שניים וחצי סיבובים. טוני הוק, 1999.', ['air720', 'mctwist']],

  /* ================= מיני ראמפ ================= */
  ['mini_dropin', 'mini', 'יודע קצת', 'דרופ-אין במיני', 'Mini Drop-in', 'הראמפה הנמוכה — הכי פחות מפחיד ללמוד עליה.', ['dropin']],
  ['rocktofakie', 'mini', 'בינוני', 'רוק טו פייקי', 'Rock to Fakie', 'לנוח רגע על הקופינג ולחזור אחורה.', ['mini_dropin', 'pumping'], 1],
  ['rocknroll', 'mini', 'בינוני', 'רוק אנד רול', 'Rock and Roll', 'רוק עם סיבוב 180 בחזרה.', ['rocktofakie'], 1],
  ['axlestall', 'mini', 'מתקדם', 'אקסל סטול', 'Axle Stall', 'עצירה על שני הטראקים בקופינג.', ['rocknroll'], 1],
  ['tailstall', 'mini', 'מתקדם', 'טייל סטול', 'Tail Stall', 'עצירה על הזנב בלבד.', ['axlestall'], 1],
  ['nosestall', 'mini', 'מתקדם', 'נוז סטול', 'Nose Stall', 'עצירה על החרטום.', ['tailstall'], 1],
  ['boardstall', 'mini', 'מתקדם', 'בורדסטול', 'Board Stall', 'עצירה עם מרכז הלוח על הקופינג.', ['axlestall'], 1],
  ['blunt_fakie', 'mini', 'מקצוען', 'בלאנט טו פייקי', 'Blunt to Fakie', 'עצירה על הזנב עם הגלגלים מעל, וחזרה.', ['tailstall']],
  ['nosepick', 'mini', 'מקצוען', 'נוז פיק', 'Nose Pick', 'עצירה קצרה על הטראק הקדמי בקופינג.', ['nosestall'], 1],
  ['disaster', 'mini', 'מתקדם', 'דיזסטר', 'Disaster', '180 שנוחת עם מרכז הלוח על הקצה.', ['boardstall', 'ollie180'], 1],
  ['smith_stall', 'mini', 'מקצוען', 'סמית׳ סטול', 'Smith Stall', 'סמית׳ שנעצר על הקופינג.', ['axlestall', 'smith'], 1],
  ['feeble_stall', 'mini', 'מקצוען', 'פיבל סטול', 'Feeble Stall', 'פיבל שנעצר על הקופינג.', ['smith_stall'], 1],
  ['sweeper', 'mini', 'מקצוען', 'סוויפר', 'Sweeper', 'היד על הקופינג והלוח נסחף מתחת.', ['boardstall']],
  ['pivot_fakie', 'mini', 'מקצוען', 'פיבוט טו פייקי', 'Pivot to Fakie', 'סיבוב על הטראק האחורי בקופינג.', ['nosepick']],

  /* ================= פול ואינוורטים ================= */
  ['pool_carve', 'pool', 'בינוני', 'קארב בדופן', 'Pool Carve', 'בפול אין קצה ישר — צריך לקרוא את הצורה.', ['pumping']],
  ['pool_grind', 'pool', 'מתקדם', 'גריינד בפול', 'Pool Grind', 'החלקה על הקופינג בזווית שמשתנה.', ['pool_carve', 'axlestall'], 1],
  ['pool_air', 'pool', 'מקצוען', 'אייר מעל הבריכה', 'Pool Air', 'יציאה מלאה מהקצה. הטריק שכולם מצלמים.', ['pool_grind', 'air_fs'], 1],
  ['invert', 'pool', 'מקצוען', 'אינוורט', 'Invert', 'עמידת יד על הקופינג עם תפיסת לוח.', ['pool_air'], 1],
  ['eggplant', 'pool', 'מקצוען', 'אג׳פלנט', 'Egg Plant', 'אינוורט על היד הקדמית.', ['invert']],
  ['hoho', 'pool', 'מקצוען', 'הו-הו', 'Ho-Ho', 'אינוורט על שתי הידיים.', ['eggplant']],
  ['millerflip', 'pool', 'מקצוען', 'מילר פליפ', 'Miller Flip', 'אינוורט עם 360 חזרה לתוך הדופן.', ['invert']],
  ['sadplant', 'pool', 'מקצוען', 'סאד פלאנט', 'Sad Plant', 'אינוורט עם רגל קדמית ישרה.', ['eggplant']],
  ['andrecht', 'pool', 'מקצוען', 'אנדרכט', 'Andrecht', 'אינוורט בקסייד עם תפיסת עקבים.', ['invert']],
  ['layback', 'pool', 'מתקדם', 'לייבק', 'Layback', 'היד נשענת אחורה בדופן תוך כדי סיבוב.', ['pool_carve'], 1],
  ['stiffy', 'pool', 'מקצוען', 'סטיפי', 'Stiffy', 'אייר עם שתי רגליים ישרות.', ['pool_air']],

  /* ================= פריסטייל ואולד סקול ================= */
  ['walkdog', 'old', 'בינוני', 'ווק דה דוג', 'Walk the Dog', 'סיבוב הלוח מתחת לרגליים בצעדים.', ['manual']],
  ['endover', 'old', 'בינוני', 'אנד-אובר', 'End-Over', 'סיבובי 180 חוזרים על החרטום והזנב.', ['walkdog']],
  ['casper', 'old', 'מתקדם', 'קספר', 'Casper', 'עמידה על הלוח ההפוך עם רגל תחת הזנב.', ['walkdog']],
  ['railstand', 'old', 'מתקדם', 'רייל סטנד', 'Railstand', 'עמידה על צד הלוח.', ['casper']],
  ['primo_stand', 'old', 'מקצוען', 'פרימו', 'Primo Stand', 'הלוח על הצד והרגליים עליו.', ['railstand']],
  ['pogo', 'old', 'מתקדם', 'פוגו', 'Pogo', 'קפיצות על הזנב כשהלוח אנכי.', ['casper']],
  ['handstand', 'old', 'מקצוען', 'עמידת ידיים', 'Handstand', 'עמידת ידיים על הלוח בנסיעה.', ['railstand']],
  ['spacewalk', 'old', 'מתקדם', 'ספייסווק', 'Spacewalk', 'מניואל ארוך עם נדנוד החרטום.', ['manual', 'endover']],
  ['oldschool_kickflip', 'old', 'בינוני', 'קיקפליפ אולד סקול', 'Old School Kickflip', 'הלוח מתהפך עם הרגל מהצד, בלי אוליי.', ['manual']],
  ['fingerflip_old', 'old', 'מתקדם', 'פינגר פליפ אולד סקול', 'Finger Flip', 'היד מהפכת את הלוח בקפיצה.', ['oldschool_kickflip']],
  ['boneless_old', 'old', 'בינוני', 'בונלס אולד סקול', 'Boneless One', 'רגל לקרקע, יד תופסת, קפיצה חזרה.', ['oldschool_kickflip']],
  ['daffy', 'old', 'מקצוען', 'דאפי', 'Daffy', 'מניואל על שני לוחות בו זמנית.', ['spacewalk']],
  ['coco', 'old', 'מתקדם', 'קוקו ווילי', 'Coco Wheelie', 'מניואל עם רגל אחת על החרטום.', ['nosemanual']],
  ['tvstand', 'old', 'מקצוען', 'טי-וי סטנד', 'TV Stand', 'עמידה על הלוח בזווית עם שתי רגליים בקצוות.', ['railstand']],
  ['m80', 'old', 'מקצוען', 'אם-80', 'M-80', 'קפיצה עם סיבוב מהזנב, אולד סקול.', ['pogo']],

  /* ---- תוספות: קומבו טרנזישן וליפ טריקס ---- */
  ['fakie_rocknroll', 'mini', 'מתקדם', 'פייקי רוק אנד רול', 'Fakie Rock and Roll', 'רוק אנד רול בכניסה אחורית.', ['rocknroll'], 1],
  ['halfcab_rocknroll', 'mini', 'מקצוען', 'האף קאב רוק אנד רול', 'Half-Cab Rock and Roll', 'רוק, ואז האף קאב במקום סיבוב רגיל.', ['fakie_rocknroll', 'halfcab'], 1],
  ['rock_fakie_180', 'mini', 'מקצוען', 'רוק טו פייקי 180', 'Rock to Fakie 180', 'רוק, וסיבוב מלא ביציאה.', ['rocktofakie', 'ollie180']],
  ['blunt_stall', 'mini', 'מקצוען', 'בלאנט סטול', 'Blunt Stall', 'עצירה על הזנב עם הגלגלים מעל הקופינג.', ['blunt_fakie'], 1],
  ['nosebluntstall', 'mini', 'מקצוען', 'נוזבלאנט סטול', 'Noseblunt Stall', 'אותו דבר מצד החרטום.', ['blunt_stall', 'nosepick'], 1],
  ['tailslide_coping', 'mini', 'מקצוען', 'טיילסלייד על הקופינג', 'Coping Tailslide', 'החלקה על הזנב לאורך שפת הראמפ.', ['tailstall', 'tailslide'], 1],
  ['stalefish_stall', 'mini', 'מקצוען', 'סטיילפיש סטול', 'Stalefish Stall', 'סטול עם תפיסת סטיילפיש.', ['boardstall', 'grab_stalefish']],
  ['bs_boardslide_coping', 'mini', 'מקצוען', 'בורדסלייד על הקופינג', 'Coping Boardslide', 'בורדסלייד לרוחב שפת המיני ראמפ.', ['boardstall', 'boardslide'], 1],
  ['tailtap', 'mini', 'בינוני', 'טייל טאפ', 'Tail Tap', 'נגיעה קצרה של הזנב בקופינג וחזרה.', ['rocktofakie']],

  /* ---- תוספות: אוויר וסיבובים ---- */
  ['fs_air_180', 'park', 'מתקדם', 'פרונטסייד 180 אייר', 'FS 180 Air', 'חצי סיבוב מעל הקצה.', ['air_fs']],
  ['alleyoop', 'park', 'מקצוען', 'אלי-אופ', 'Alley-oop', 'סיבוב לכיוון ההפוך מכיוון הנסיעה בדופן.', ['air_fs'], 1],
  ['judo', 'park', 'מקצוען', 'ג׳ודו אייר', 'Judo Air', 'הרגל הקדמית בועטת קדימה באוויר.', ['airwalk']],
  ['madonna', 'park', 'מקצוען', 'מדונה', 'Madonna', 'טייל גראב עם בעיטה של הרגל הקדמית.', ['benihana']],
  ['lien_air', 'park', 'מקצוען', 'ליין אייר', 'Lien Air', 'תפיסה בצד העקבים עם נטייה אחורה.', ['grab_melon']],
  ['crail_air', 'park', 'מקצוען', 'קרייל אייר', 'Crail Air', 'היד האחורית תופסת את החרטום.', ['grab_nose']],
  ['roastbeef', 'park', 'מקצוען', 'רוסטביף', 'Roast Beef', 'היד האחורית עוברת בין הרגליים ותופסת.', ['grab_stalefish']],
  ['cannonball', 'park', 'מקצוען', 'קנונבול', 'Cannonball', 'שתי ידיים תופסות חרטום וזנב.', ['grab_tail', 'grab_nose']],
  ['saran_wrap', 'park', 'מקצוען', 'סרן ראפ', 'Saran Wrap', 'היד עוברת סביב הרגל הקדמית.', ['airwalk']],
  ['gay_twist', 'park', 'מקצוען', 'גיי טוויסט', 'Gay Twist', 'פייקי 360 עם גראב.', ['air360', 'fullcab']],
  ['backflip', 'park', 'מקצוען', 'בקפליפ', 'Backflip', 'סלטה אחורית מלאה עם הלוח.', ['air720']],
  ['air1080', 'park', 'מקצוען', '1080', '1080', 'שלושה סיבובים מלאים. טום שאר, 2012.', ['air900']],

  /* ---- תוספות: גריינדים וסליידים ---- */
  ['nosegrind_overcrook', 'grind', 'מקצוען', 'נוזגריינד אוברטרן', 'Nosegrind Overturn', 'נוזגריינד עם סיבוב ביציאה.', ['nosegrind'], 1],
  ['grind5o_overturn', 'grind', 'מקצוען', '5-0 אוברטרן', '5-0 Overturn', 'יציאה מ-5-0 עם סיבוב.', ['grind5o'], 1],
  ['barley', 'grind', 'מקצוען', 'בארלי גריינד', 'Barley Grind', 'פיבל בגישה פרונטסיידית עם סיבוב.', ['willy'], 1],
  ['darkslide_50', 'grind', 'מקצוען', 'דארק 50-50', 'Dark 50-50', 'גריינד כשהלוח הפוך.', ['darkslide', 'grind5050']],
  ['tailslide_shuv', 'slide', 'מקצוען', 'טיילסלייד שאביט אאוט', 'Tailslide Shove-out', 'יציאה מטיילסלייד עם שאביט.', ['tailslide', 'popshuvit'], 1],
  ['crook_bigspin', 'grind', 'מקצוען', 'קרוקד ביגספין אאוט', 'Crook Bigspin Out', 'יציאה מקרוקד עם ביגספין.', ['crooked', 'bigspin'], 1],

  /* ---- תוספות: פלאט ---- */
  ['nollie_heel', 'flat', 'מקצוען', 'נולי הילפליפ', 'Nollie Heelflip', 'הילפליפ מהחרטום.', ['nollie_flip', 'heelflip']],
  ['switch_heel', 'flat', 'מקצוען', 'סוויץ׳ הילפליפ', 'Switch Heelflip', 'הילפליפ בעמידה ההפוכה.', ['switch_flip', 'heelflip']],
  ['fakie_flip', 'flat', 'מתקדם', 'פייקי קיקפליפ', 'Fakie Flip', 'קיקפליפ בנסיעה אחורה.', ['fakie_ollie', 'kickflip']],
  ['halfcab_flip', 'flat', 'מקצוען', 'האף קאב פליפ', 'Half-Cab Flip', 'האף קאב עם קיקפליפ.', ['halfcab', 'fakie_flip']],
  ['cab_flip', 'flat', 'מקצוען', 'קאב פליפ', 'Cab Flip', 'פול קאב עם קיקפליפ.', ['fullcab', 'halfcab_flip']],
  ['dolphin_flip', 'flat', 'מקצוען', 'דולפין פליפ', 'Dolphin Flip', 'הלוח מתהפך קדימה מעל הראש.', ['hospital']],
  ['jesus_flip', 'flat', 'מקצוען', 'ג׳יזוס פליפ', 'Jesus Flip', 'פליפ שנתפס ביד ומוחזר לרגליים.', ['fingerflip']],
  ['ghetto_bird', 'flat', 'מקצוען', 'גטו בירד', 'Ghetto Bird', 'הארדפליפ עם 180 אחורה.', ['hardflip', 'ollie180']],
  ['360_hardflip', 'flat', 'מקצוען', '360 הארדפליפ', '360 Hardflip', 'הארדפליפ עם 360 של הלוח.', ['hardflip', 'shuvit360']],
  ['nightmare', 'flat', 'מקצוען', 'נייטמר פליפ', 'Nightmare Flip', 'דאבל קיקפליפ עם 360 שאביט.', ['double_kickflip', 'treflip']],
  ['daydream', 'flat', 'מקצוען', 'דיידרים פליפ', 'Daydream Flip', 'דאבל הילפליפ עם 360 שאביט.', ['double_heelflip', 'laserflip']],
  ['semi_flip', 'flat', 'מקצוען', 'סמי פליפ', 'Semi-Flip', 'קספר עם חצי סיבוב וחזרה.', ['casperflip']],
  ['360_shuv_underflip', 'flat', 'מקצוען', 'שאביט אנדרפליפ', 'Shove Underflip', 'שאביט עם אנדרפליפ מאוחר.', ['underflip', 'shuvit360']],
  ['late_flip', 'flat', 'מקצוען', 'לייט פליפ', 'Late Flip', 'הפליפ מתבצע אחרי שהאוליי כבר בשיא.', ['kickflip', 'fullcab']],
  ['bigspin_flip', 'flat', 'מקצוען', 'ביגספין פליפ', 'Bigspin Flip', 'ביגספין עם קיקפליפ מלא.', ['bigflip']],

  /* ---- תוספות: פריסטייל ואולד סקול ---- */
  ['casper_disaster', 'old', 'מקצוען', 'קספר דיזסטר', 'Casper Disaster', 'קספר על שפת מכשול.', ['casper']],
  ['anti_casper', 'old', 'מקצוען', 'אנטי קספר', 'Anti-Casper', 'קספר מהצד ההפוך של הלוח.', ['casper']],
  ['yoyo_plant', 'old', 'מקצוען', 'יו-יו פלאנט', 'YoYo Plant', 'עמידת יד עם סיבוב הלוח.', ['handstand']],
  ['gymnast_plant', 'old', 'מקצוען', 'ג׳ימנסט פלאנט', 'Gymnast Plant', 'פלאנט על שתי ידיים.', ['handstand']],
  ['street_plant', 'old', 'מתקדם', 'סטריט פלאנט', 'Street Plant', 'יד על הקרקע והלוח נתפס ביד השנייה.', ['boneless_old']],
  ['butter_flip', 'old', 'מקצוען', 'באטר פליפ', 'Butter Flip', 'פליפ מתוך רייל סטנד.', ['railstand']],
  ['godzilla_flip', 'old', 'מקצוען', 'גודזילה פליפ', 'Godzilla Flip', 'פינגר פליפ עם 360.', ['fingerflip_old']],
  ['jaywalk', 'old', 'מתקדם', 'ג׳ייווק', 'Jaywalk', 'צעדים לרוחב הלוח בנסיעה.', ['walkdog']],
  ['monster_walk', 'old', 'מקצוען', 'מונסטר ווק', 'Monster Walk', 'הליכה שמסובבת את הלוח 360.', ['jaywalk']],
  ['ho_ho_plant', 'old', 'מקצוען', 'הו-הו פלאנט', 'Ho-Ho Plant', 'עמידת ידיים על שתי ידיים בקרקע.', ['gymnast_plant']],
  ['nosehook_impossible', 'old', 'מקצוען', 'נוזהוק אימפוסיבל', 'Nosehook Impossible', 'אימפוסיבל סביב החרטום.', ['impossible', 'railstand']],
  ['sf_flip', 'old', 'מקצוען', 'סן פרנסיסקו פליפ', 'San Francisco Flip', 'פליפ מעל הראש בעמידת ידיים.', ['handstand', 'fingerflip_old']],
  ['carousel', 'old', 'מקצוען', 'קרוסלה', 'Carousel', 'סיבוב מתמשך על גלגל אחד.', ['spacewalk']],
  ['switchfoot_pogo', 'old', 'מקצוען', 'סוויצ׳פוט פוגו', 'Switchfoot Pogo', 'פוגו עם החלפת רגליים באוויר.', ['pogo']],
  ['broken_fingers', 'old', 'מקצוען', 'ברוקן פינגרס', 'Broken Fingers', 'שילוב של קספר ורייל סטנד.', ['casper', 'railstand']],

  /* ---- מה שהיה חסר: פלאט ופליפים ---- */
  ['nollie_shuv', 'flat', 'מתקדם', 'נולי שאביט', 'Nollie Shove-it', 'שאביט מהחרטום.', ['nollie'], 1],
  ['switch_shuv', 'flat', 'מתקדם', 'סוויץ׳ שאביט', 'Switch Shove-it', 'שאביט בעמידה ההפוכה.', ['switch_ollie'], 1],
  ['fakie_shuv', 'flat', 'בינוני', 'פייקי שאביט', 'Fakie Shove-it', 'שאביט בנסיעה אחורה.', ['fakie_ollie'], 1],
  ['fakie_heel', 'flat', 'מתקדם', 'פייקי הילפליפ', 'Fakie Heelflip', 'הילפליפ בנסיעה אחורה.', ['fakie_flip', 'heelflip']],
  ['nollie_180', 'flat', 'מתקדם', 'נולי 180', 'Nollie 180', 'חצי סיבוב מהחרטום.', ['nollie', 'ollie180'], 1],
  ['switch_180', 'flat', 'מתקדם', 'סוויץ׳ 180', 'Switch 180', 'חצי סיבוב בעמידה ההפוכה.', ['switch_ollie', 'ollie180'], 1],
  ['ollie360', 'flat', 'מקצוען', 'אוליי 360', 'Ollie 360', 'סיבוב מלא של הגוף והלוח יחד.', ['ollie180'], 1],
  ['nollie_bigspin', 'flat', 'מקצוען', 'נולי ביגספין', 'Nollie Bigspin', 'ביגספין מהחרטום.', ['nollie_shuv', 'bigspin'], 1],
  ['anti_casper_flip', 'flat', 'מקצוען', 'אנטי קספר פליפ', 'Anti-Casper Flip', 'קספר מהצד ההפוך של הלוח.', ['casperflip']],
  ['tre_flip_late', 'flat', 'מקצוען', 'לייט טרה פליפ', 'Late Tre Flip', 'הטרה מתחיל אחרי שהאוליי בשיא.', ['treflip', 'late_flip']],
  ['dolphin_heel', 'flat', 'מקצוען', 'דולפין הילפליפ', 'Dolphin Heel', 'דולפין פליפ עם עקב.', ['dolphin_flip', 'heelflip']],
  ['pressure_360', 'flat', 'מקצוען', '360 פרשר פליפ', '360 Pressure Flip', 'פרשר פליפ עם סיבוב מלא.', ['pressure_flip']],
  ['sex_change', 'flat', 'מקצוען', 'סקס צ׳יינג׳', 'Sex Change', 'הרגליים מתחלפות באוויר.', ['ollie180', 'kickflip']],
  ['nerd_flip', 'flat', 'מקצוען', 'נרד פליפ', 'Nerd Flip', 'ורייל עם אנדרפליפ.', ['underflip', 'varial_kickflip']],
  ['bull_flip', 'flat', 'מקצוען', 'בול פליפ', 'Bullflip', 'הארדפליפ עם 360 של הגוף.', ['hardflip', 'ollie360']],
  ['grape_flip', 'flat', 'מקצוען', 'גרייפ פליפ', 'Grape Flip', 'האף קאב עם הילפליפ מוקדם.', ['halfcab_flip', 'heelflip']],
  ['scissor_flip', 'flat', 'מקצוען', 'סייזר פליפ', 'Scissor Flip', 'הרגליים נחצות באוויר תוך כדי פליפ.', ['sex_change']],
  ['kiwi_flip', 'flat', 'מקצוען', 'קיווי פליפ', 'Kiwi Flip', 'פליפ עם סיבוב גוף הפוך לסיבוב הלוח.', ['scissor_flip']],
  ['hangten', 'flat', 'מקצוען', 'האנג טן', 'Hang Ten', 'שתי רגליים על החרטום במניואל.', ['nosemanual']],
  ['toe_flip', 'flat', 'מקצוען', 'טו פליפ', 'Toe Flip', 'הפליפ נעשה עם קצות האצבעות.', ['kickflip']],
  ['no_comply_180', 'flat', 'מתקדם', 'נו קומפליי 180', 'No Comply 180', 'נו קומפליי עם חצי סיבוב.', ['nocomply'], 1],
  ['no_comply_flip', 'flat', 'מקצוען', 'נו קומפליי פליפ', 'No Comply Flip', 'נו קומפליי עם קיקפליפ.', ['no_comply_180', 'kickflip']],
  ['wrap_around', 'flat', 'מתקדם', 'ראפ אראונד', 'Wrap Around', 'הלוח מקיף את הרגל הקדמית.', ['nocomply']],
  ['helipop', 'flat', 'מקצוען', 'הליפופ', 'Helipop', 'נולי 360 בלי סיבוב של הלוח בנפרד.', ['nollie_180', 'ollie360']],
  ['dragonflip', 'flat', 'מקצוען', 'דרגון פליפ', 'Dragonflip', 'דאבל פליפ עם 360 שאביט.', ['nightmare']],

  /* ---- מה שהיה חסר: גריינדים וסליידים ---- */
  ['bluntgrind', 'grind', 'מקצוען', 'בלאנט גריינד', 'Blunt Grind', 'גריינד על הזנב עם הגלגלים מעל הקצה.', ['grind5o'], 1],
  ['nosebluntgrind', 'grind', 'מקצוען', 'נוזבלאנט גריינד', 'Noseblunt Grind', 'אותו דבר מצד החרטום.', ['bluntgrind', 'nosegrind'], 1],
  ['tailgrind', 'grind', 'מתקדם', 'טייל גריינד', 'Tail Grind', 'גריינד על הטראק האחורי בלבד.', ['grind5o'], 1],
  ['halfcab_grind', 'grind', 'מקצוען', 'האף קאב גריינד', 'Half-Cab Grind', 'כניסה לגריינד עם האף קאב.', ['grind5050', 'halfcab'], 1],
  ['grind_5050_180out', 'grind', 'מקצוען', '50-50 עם 180 ביציאה', '50-50 to 180 Out', 'יציאה מהגריינד עם חצי סיבוב.', ['grind5050', 'ollie180'], 1],
  ['nosegrind_180out', 'grind', 'מקצוען', 'נוזגריינד 180 אאוט', 'Nosegrind 180 Out', 'יציאה מנוזגריינד עם סיבוב.', ['nosegrind', 'ollie180'], 1],
  ['smith_180out', 'grind', 'מקצוען', 'סמית׳ 180 אאוט', 'Smith 180 Out', 'יציאה מסמית׳ עם סיבוב.', ['smith', 'ollie180'], 1],
  ['kgrind', 'grind', 'מקצוען', 'קיי-גריינד', 'K-Grind', 'השם הרחוב של קרוקד גריינד.', ['crooked'], 1],
  ['bs_lipslide', 'slide', 'מקצוען', 'ליפסלייד עם 270', 'Lipslide 270 In', 'כניסה לליפסלייד עם 270.', ['lipslide', 'ollie360'], 1],
  ['noseslide_shuv', 'slide', 'מקצוען', 'נוזסלייד שאביט אאוט', 'Noseslide Shove Out', 'יציאה מנוזסלייד עם שאביט.', ['noseslide', 'popshuvit'], 1],
  ['bluntslide_flipout', 'slide', 'מקצוען', 'בלאנטסלייד פליפ אאוט', 'Bluntslide Flip Out', 'יציאה מבלאנטסלייד עם קיקפליפ.', ['bluntslide', 'kickflip'], 1],
  ['salad_slide', 'slide', 'מקצוען', 'סלאד סלייד', 'Salad Slide', 'סלייד עם החרטום מופנה החוצה.', ['tailslide'], 1],
  ['hurricane_slide', 'slide', 'מקצוען', 'הוריקן סלייד', 'Hurricane Slide', 'הוריקן שמחליק על הלוח.', ['hurricane'], 1],
  ['nose_pickup', 'slide', 'מתקדם', 'נוז פיקאפ', 'Nose Pickup', 'הרמת הלוח מהחרטום בסוף סלייד.', ['noseslide']],

  /* ---- מה שהיה חסר: פארק, מיני ופול ---- */
  ['fs_rock_slide', 'mini', 'מקצוען', 'רוק סלייד', 'Rock Slide', 'החלקה על מרכז הלוח לרוחב הקופינג.', ['rocknroll'], 1],
  ['blunt_revert', 'mini', 'מקצוען', 'בלאנט ריוורט', 'Blunt Revert', 'בלאנט עם סיבוב ביציאה.', ['blunt_stall'], 1],
  ['crailtap', 'mini', 'מקצוען', 'קרייל טאפ', 'Crailtap', 'נגיעה בקופינג עם תפיסת חרטום.', ['nosepick'], 1],
  ['beanplant', 'mini', 'מתקדם', 'בין פלאנט', 'Bean Plant', 'רגל על הקופינג ותפיסת לוח.', ['boardstall']],
  ['staple_gun', 'mini', 'מתקדם', 'סטייפל גאן', 'Staple Gun', 'רגל אחת דוחפת את הלוח על הדופן.', ['beanplant']],
  ['tail_drop', 'mini', 'בינוני', 'טייל דרופ', 'Tail Drop', 'כניסה לראמפה מהזנב בלבד.', ['mini_dropin']],
  ['thruster', 'mini', 'מקצוען', 'ת׳רסטר', 'Thruster', 'סטול עם דחיפה החוצה מהקופינג.', ['axlestall'], 1],
  ['fastplant', 'park', 'מתקדם', 'פאסטפלאנט', 'Fastplant', 'בונלס מהיר בטרנזישן.', ['boneless', 'ollie_transition']],
  ['tuckknee', 'park', 'מקצוען', 'טאק-ני', 'Tuck Knee', 'מיוט גראב עם ברך מקופלת.', ['grab_mute']],
  ['slob_air', 'park', 'מקצוען', 'סלוב אייר', 'Slob Air', 'מיוט גראב בפרונטסייד.', ['grab_mute'], 1],
  ['seatbelt', 'park', 'מקצוען', 'סיטבלט', 'Seatbelt', 'היד האחורית תופסת מעבר לגוף.', ['grab_melon']],
  ['nose_bone', 'park', 'מקצוען', 'נוז בון', 'Nose Bone', 'נוזגראב עם רגל קדמית ישרה.', ['grab_nose']],
  ['tail_bone', 'park', 'מקצוען', 'טייל בון', 'Tail Bone', 'טיילגראב עם רגל אחורית ישרה.', ['grab_tail']],
  ['christ_air', 'park', 'מקצוען', 'קרייסט אייר', 'Christ Air', 'הלוח ביד אחת והידיים פרושות.', ['airwalk', 'rocket']],
  ['ollie_north', 'park', 'מקצוען', 'אוליי נורת׳', 'Ollie North', 'הרגל הקדמית יוצאת קדימה באוויר.', ['airwalk']],
  ['fs_invert', 'pool', 'מקצוען', 'פרונטסייד אינוורט', 'FS Invert', 'אינוורט בכיוון הקדמי.', ['invert']],
  ['phillips66', 'pool', 'מקצוען', 'פיליפס 66', 'Phillips 66', 'אינוורט עם סיבוב 360.', ['millerflip']],
  ['fingerflip_invert', 'pool', 'מקצוען', 'פינגרפליפ אינוורט', 'Fingerflip Invert', 'אינוורט עם היפוך הלוח ביד.', ['invert', 'fingerflip']],
  ['disaster_pool', 'pool', 'מקצוען', 'דיזסטר בפול', 'Pool Disaster', 'דיזסטר על הקופינג של הבריכה.', ['pool_grind', 'disaster'], 1],
  ['smith_pool', 'pool', 'מקצוען', 'סמית׳ בפול', 'Pool Smith', 'סמית׳ גריינד לאורך דופן הבריכה.', ['pool_grind', 'smith'], 1],
  ['bert', 'pool', 'מתקדם', 'ברט', 'Bert', 'יד על הדופן וסיבוב רחב, שנות ה-70.', ['layback']],

  /* ---- מה שהיה חסר: פריסטייל ---- */
  ['truckstand', 'old', 'מקצוען', 'טראק סטנד', 'Truckstand', 'עמידה על טראק אחד כשהלוח אנכי.', ['railstand']],
  ['rail_flip', 'old', 'מקצוען', 'רייל פליפ', 'Rail Flip', 'מעבר מרייל סטנד חזרה לגלגלים בהיפוך.', ['railstand']],
  ['pivot_manual', 'old', 'מתקדם', 'פיבוט מניואל', 'Pivot Manual', 'סיבוב 180 בתוך מניואל.', ['manual', 'endover']],
  ['one_foot_manual', 'old', 'מתקדם', 'מניואל ברגל אחת', 'One-Foot Manual', 'מניואל עם רגל אחת מורמת.', ['manual']],
  ['fifty_fifty_manual', 'old', 'מקצוען', 'מניואל על שני הצירים', '50-50 Manual', 'איזון על שני הטראקים בקצה.', ['nosemanual', 'manual']],
  ['caveman', 'old', 'בינוני', 'קייבמן', 'Caveman', 'קפיצה על הלוח מהיד תוך כדי ריצה.', ['boneless_old']],
  ['acid_drop', 'old', 'מתקדם', 'אסיד דרופ', 'Acid Drop', 'נפילה חופשית מגובה ישר לנסיעה.', ['caveman', 'falling']],
  ['bomb_drop', 'old', 'מקצוען', 'בומב דרופ', 'Bomb Drop', 'קפיצה מגובה עם הלוח ביד.', ['acid_drop']],
  ['gingersnap', 'old', 'מקצוען', 'ג׳ינג׳רסנאפ', 'Gingersnap', 'האנג טן עם היפוך הלוח.', ['hangten']],
  ['yoho_plant', 'old', 'מקצוען', 'יוהו פלאנט', 'YoHo Plant', 'עמידת יד עם תפיסה כפולה.', ['yoyo_plant']],
];

/** שני הכיוונים שבהם אפשר לגשת לטריק. */
export const SIDES = [
  { id: 'fs', label: 'פרונטסייד', short: 'FS', hint: 'החזה לכיוון המכשול' },
  { id: 'bs', label: 'בקסייד', short: 'BS', hint: 'הגב לכיוון המכשול' },
];

/**
 * טריק דו-צדדי מתפצל לשתי רשומות נפרדות — כל צד מאושר בנפרד —
 * אבל שתיהן חולקות `baseId`, כדי שהמסך יציג אותן ככרטיס אחד.
 */
export const TRICKS = ROWS.flatMap(([id, discipline, level, name, alias, desc, after, sided]) => {
  const base = { discipline, level, desc, after, baseId: id, baseName: name };
  if (!sided) return [{ ...base, id, name, alias, side: null }];

  return SIDES.map((s) => ({
    ...base,
    id: `${id}_${s.id}`,
    name: `${s.label} ${name}`,
    alias: `${s.short} ${alias}`,
    side: s.id,
  }));
});

export const trickById = Object.fromEntries(TRICKS.map((t) => [t.id, t]));

/** מזהה בסיס -> כל הווריאנטים שלו, לפי סדר הצדדים. */
export const variantsOf = TRICKS.reduce((acc, t) => {
  (acc[t.baseId] ||= []).push(t);
  return acc;
}, {});

/** `after` מצביע על מזהי בסיס. מתרגמים לשם התצוגה של הבסיס. */
const baseName = (id) => variantsOf[id]?.[0]?.baseName || id;

/* ---------- בדיקת שפיות על העץ ---------- */

// תלות שמצביעה על טריק שלא קיים, או טריק שתלוי בעצמו, תשבור את העץ בשקט.
for (const t of TRICKS) {
  for (const n of t.after) {
    if (!variantsOf[n]) throw new Error(`הטריק "${t.id}" תלוי ב-"${n}" שלא קיים`);
    if (n === t.baseId) throw new Error(`הטריק "${t.id}" תלוי בעצמו`);
  }
}

// מעגל תלויות ימנע לנצח פתיחה של הטריקים שבתוכו
(function assertNoCycles() {
  const state = {};
  const walk = (baseId, path) => {
    if (state[baseId] === 'done') return;
    if (state[baseId] === 'open') throw new Error(`מעגל תלויות: ${[...path, baseId].join(' → ')}`);
    state[baseId] = 'open';
    (variantsOf[baseId]?.[0]?.after || []).forEach((n) => walk(n, [...path, baseId]));
    state[baseId] = 'done';
  };
  Object.keys(variantsOf).forEach((id) => walk(id, []));
})();

/**
 * מצב הטריקים של רוכב: מה נעול, מה פתוח, מה ממתין ומה נחת.
 * `states` הוא מיפוי trickId -> 'pending' | 'approved' | 'rejected'.
 */
export function buildTree(states = {}) {
  const landed = new Set(
    Object.entries(states).filter(([, s]) => s === 'approved').map(([id]) => id));

  return TRICKS.map((t) => ({
    ...t,
    state: states[t.id] || null,
    // כל הטריקים פתוחים תמיד — הסדר המומלץ הוא הכוונה, לא מחסום
    unlocked: true,
    // מה שכדאי לנחות קודם, למי שרוצה ללכת לפי הסדר.
    // מספיק שאחד הצדדים של טריק הבסיס נחת כדי שהוא ייחשב מכוסה.
    suggested: t.after
      .filter((n) => !(variantsOf[n] || []).some((v) => landed.has(v.id)))
      .map(baseName),
  }));
}

/** כמה טריקים נחתו, בסך הכל ולפי דיסציפלינה. */
export function progressOf(states = {}) {
  // מסננים הגשות לטריקים שהוסרו מהקטלוג, אחרת הסכום הכולל
  // לא יתאים לסכום של הדיסציפלינות
  const landed = Object.entries(states)
    .filter(([id, s]) => s === 'approved' && trickById[id])
    .map(([id]) => id);

  const byDiscipline = Object.fromEntries(DISCIPLINES.map((d) => {
    const all = TRICKS.filter((t) => t.discipline === d.id);
    return [d.id, {
      done: all.filter((t) => landed.includes(t.id)).length,
      total: all.length,
    }];
  }));

  return { done: landed.length, total: TRICKS.length, byDiscipline };
}
