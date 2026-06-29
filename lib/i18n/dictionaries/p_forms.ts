// Lead-form builder surfaces: the new-form wizard (forms/new) and the form
// detail page (forms/[formId]). Keys are dotted under the `pforms.` namespace.
// en / ar / ru carry an identical key set (strict parity); missing keys fall
// back to English upstream.
type Dict = Record<string, string>

const en: Dict = {
  // shared
  'pforms.allForms': 'All forms',

  // new wizard — header
  'pforms.new.eyebrow': 'New lead form',
  'pforms.step.basics': 'Basics',
  'pforms.step.questions': 'Questions',
  'pforms.step.thankYou': 'Thank you',
  'pforms.step.review': 'Review',

  // new wizard — success
  'pforms.created.title': 'Form created.',
  'pforms.created.subtitle': 'Your lead gen form is live on Meta and ready to attach to campaigns.',
  'pforms.created.viewForm': 'View form',

  // step 1 — basics
  'pforms.basics.listing': 'Listing',
  'pforms.basics.selectListing': 'Select listing…',
  'pforms.basics.formName': 'Form name',
  'pforms.basics.formNamePlaceholder': 'e.g. Palm Jumeirah — Lead Form',
  'pforms.basics.landingUrl': 'Landing page URL',
  'pforms.basics.landingUrlPlaceholder': 'https://… (used for thank-you redirect)',
  'pforms.basics.privacyUrl': 'Privacy policy URL',

  // step 2 — questions
  'pforms.questions.standardFields': 'Standard fields',
  'pforms.questions.required': 'Required',
  'pforms.questions.custom': 'Qualifying questions (custom)',
  'pforms.questions.totalNote': '{n} questions total — shorter forms convert better. 3–4 questions is optimal for real estate leads.',

  // standard question labels + descriptions
  'pforms.q.fullName': 'Full name',
  'pforms.q.phone': 'Phone number',
  'pforms.q.email': 'Email address',
  'pforms.q.city': 'City',
  'pforms.q.autoFilled': 'Auto-filled by Meta',
  'pforms.q.currentCity': 'Current city',

  // custom presets — labels
  'pforms.preset.budget': 'Budget range',
  'pforms.preset.intent': 'Buying intent',
  'pforms.preset.timeline': 'Purchase timeline',

  // budget options
  'pforms.budget.under1m': 'Under AED 1M',
  'pforms.budget.1m2m': 'AED 1M – 2M',
  'pforms.budget.2m3m': 'AED 2M – 3M',
  'pforms.budget.3m5m': 'AED 3M – 5M',
  'pforms.budget.above5m': 'Above AED 5M',

  // intent options
  'pforms.intent.invest': 'Investment / rental yield',
  'pforms.intent.ownUse': 'Own use / family home',
  'pforms.intent.goldenVisa': 'Golden Visa residency',
  'pforms.intent.comparing': 'Still comparing options',

  // timeline options
  'pforms.timeline.immediate': 'Ready to buy now',
  'pforms.timeline.3months': 'Within 3 months',
  'pforms.timeline.6months': 'Within 6 months',
  'pforms.timeline.exploring': 'Just exploring',

  // step 3 — thank you
  'pforms.thankYou.intro': 'Shown to the lead immediately after form submission. Keep it warm and action-forward.',
  'pforms.thankYou.headline': 'Thank you headline',
  'pforms.thankYou.headlinePlaceholder': "Thank you — we'll be in touch.",
  'pforms.thankYou.message': 'Thank you message',
  'pforms.thankYou.messagePlaceholder': 'A senior advisor will contact you within 24 hours…',
  'pforms.thankYou.preview': 'Preview',
  'pforms.thankYou.previewHeadline': 'Thank you headline',
  'pforms.thankYou.previewBody': 'Thank you message body…',
  // defaults pre-filled into the form
  'pforms.default.thankYouTitle': "Thank you — we'll be in touch shortly.",
  'pforms.default.thankYouBody': 'A senior advisor will contact you within 24 hours to discuss your options.',

  // step 4 — review
  'pforms.review.formDetails': 'Form details',
  'pforms.review.name': 'Name',
  'pforms.review.listing': 'Listing',
  'pforms.review.landingUrl': 'Landing URL',
  'pforms.review.privacyPolicy': 'Privacy policy',
  'pforms.review.questions': 'Questions',
  'pforms.review.thankYouPage': 'Thank you page',
  'pforms.review.headline': 'Headline',
  'pforms.review.message': 'Message',
  'pforms.review.customWithOptions': 'Custom · {n} options',
  'pforms.review.standardAutofill': 'Standard (Meta auto-fill)',

  // navigation / actions
  'pforms.nav.back': 'Back',
  'pforms.nav.next': 'Next',
  'pforms.nav.create': 'Create form',
  'pforms.nav.creating': 'Creating…',

  // errors
  'pforms.error.createFailed': 'Failed to create form',
  'pforms.error.unexpected': 'Unexpected error',

  // detail page
  'pforms.detail.eyebrow': 'Lead Form',
  'pforms.detail.created': 'Created {date}',
  'pforms.detail.loading': 'Loading form…',
  'pforms.detail.loadFailed': 'Failed to load form',
  'pforms.detail.loadLeadsFailed': 'Failed to load leads',

  // stats
  'pforms.stat.totalLeads': 'Total leads',
  'pforms.stat.questions': 'Questions',
  'pforms.stat.status': 'Status',
  'pforms.stat.syncedLeads': 'Synced leads',

  // leads table
  'pforms.leads.title': 'Lead submissions',
  'pforms.leads.synced': '{n} synced',
  'pforms.leads.refresh': 'Refresh',
  'pforms.leads.exportCsv': 'Export CSV',
  'pforms.leads.emptyTitle': 'No leads synced yet',
  'pforms.leads.emptyBody': 'Attach this form to a campaign to start capturing leads.',
  'pforms.leads.ad': 'Ad: {id}',

  // sidebar
  'pforms.sidebar.questions': 'Questions',
  'pforms.sidebar.landingPage': 'Landing page',
  'pforms.sidebar.formId': 'Form ID',
  'pforms.sidebar.formIdNote': 'Use this ID when attaching the form to a campaign ad set.',
}

const ar: Dict = {
  'pforms.allForms': 'كل النماذج',

  'pforms.new.eyebrow': 'نموذج عملاء محتملين جديد',
  'pforms.step.basics': 'الأساسيات',
  'pforms.step.questions': 'الأسئلة',
  'pforms.step.thankYou': 'صفحة الشكر',
  'pforms.step.review': 'المراجعة',

  'pforms.created.title': 'تم إنشاء النموذج.',
  'pforms.created.subtitle': 'نموذج جمع العملاء المحتملين فعّال الآن على Meta وجاهز للربط بالحملات.',
  'pforms.created.viewForm': 'عرض النموذج',

  'pforms.basics.listing': 'القائمة',
  'pforms.basics.selectListing': 'اختر قائمة…',
  'pforms.basics.formName': 'اسم النموذج',
  'pforms.basics.formNamePlaceholder': 'مثال: نخلة جميرا — نموذج العملاء المحتملين',
  'pforms.basics.landingUrl': 'رابط صفحة الهبوط',
  'pforms.basics.landingUrlPlaceholder': 'https://… (يُستخدم لإعادة التوجيه بعد الشكر)',
  'pforms.basics.privacyUrl': 'رابط سياسة الخصوصية',

  'pforms.questions.standardFields': 'الحقول القياسية',
  'pforms.questions.required': 'مطلوب',
  'pforms.questions.custom': 'أسئلة التأهيل (مخصّصة)',
  'pforms.questions.totalNote': '{n} أسئلة إجمالاً — النماذج الأقصر تحقق تحويلاً أفضل. من 3 إلى 4 أسئلة هو الأمثل لعملاء العقارات المحتملين.',

  'pforms.q.fullName': 'الاسم الكامل',
  'pforms.q.phone': 'رقم الهاتف',
  'pforms.q.email': 'البريد الإلكتروني',
  'pforms.q.city': 'المدينة',
  'pforms.q.autoFilled': 'يُعبّأ تلقائياً بواسطة Meta',
  'pforms.q.currentCity': 'المدينة الحالية',

  'pforms.preset.budget': 'نطاق الميزانية',
  'pforms.preset.intent': 'نية الشراء',
  'pforms.preset.timeline': 'الجدول الزمني للشراء',

  'pforms.budget.under1m': 'أقل من مليون درهم',
  'pforms.budget.1m2m': 'مليون – مليونا درهم',
  'pforms.budget.2m3m': '2 – 3 مليون درهم',
  'pforms.budget.3m5m': '3 – 5 مليون درهم',
  'pforms.budget.above5m': 'أكثر من 5 مليون درهم',

  'pforms.intent.invest': 'استثمار / عائد إيجاري',
  'pforms.intent.ownUse': 'استخدام شخصي / منزل العائلة',
  'pforms.intent.goldenVisa': 'إقامة التأشيرة الذهبية',
  'pforms.intent.comparing': 'ما زلت أقارن الخيارات',

  'pforms.timeline.immediate': 'جاهز للشراء الآن',
  'pforms.timeline.3months': 'خلال 3 أشهر',
  'pforms.timeline.6months': 'خلال 6 أشهر',
  'pforms.timeline.exploring': 'مجرد استكشاف',

  'pforms.thankYou.intro': 'تظهر للعميل المحتمل فور إرسال النموذج. اجعلها ودودة ومحفّزة على اتخاذ إجراء.',
  'pforms.thankYou.headline': 'عنوان الشكر',
  'pforms.thankYou.headlinePlaceholder': 'شكراً لك — سنتواصل معك قريباً.',
  'pforms.thankYou.message': 'رسالة الشكر',
  'pforms.thankYou.messagePlaceholder': 'سيتواصل معك مستشار أول خلال 24 ساعة…',
  'pforms.thankYou.preview': 'معاينة',
  'pforms.thankYou.previewHeadline': 'عنوان الشكر',
  'pforms.thankYou.previewBody': 'نص رسالة الشكر…',
  'pforms.default.thankYouTitle': 'شكراً لك — سنتواصل معك قريباً.',
  'pforms.default.thankYouBody': 'سيتواصل معك مستشار أول خلال 24 ساعة لمناقشة خياراتك.',

  'pforms.review.formDetails': 'تفاصيل النموذج',
  'pforms.review.name': 'الاسم',
  'pforms.review.listing': 'القائمة',
  'pforms.review.landingUrl': 'رابط صفحة الهبوط',
  'pforms.review.privacyPolicy': 'سياسة الخصوصية',
  'pforms.review.questions': 'الأسئلة',
  'pforms.review.thankYouPage': 'صفحة الشكر',
  'pforms.review.headline': 'العنوان',
  'pforms.review.message': 'الرسالة',
  'pforms.review.customWithOptions': 'مخصّص · {n} خيارات',
  'pforms.review.standardAutofill': 'قياسي (تعبئة تلقائية من Meta)',

  'pforms.nav.back': 'رجوع',
  'pforms.nav.next': 'التالي',
  'pforms.nav.create': 'إنشاء النموذج',
  'pforms.nav.creating': 'جارٍ الإنشاء…',

  'pforms.error.createFailed': 'تعذّر إنشاء النموذج',
  'pforms.error.unexpected': 'خطأ غير متوقع',

  'pforms.detail.eyebrow': 'نموذج العملاء المحتملين',
  'pforms.detail.created': 'أُنشئ في {date}',
  'pforms.detail.loading': 'جارٍ تحميل النموذج…',
  'pforms.detail.loadFailed': 'تعذّر تحميل النموذج',
  'pforms.detail.loadLeadsFailed': 'تعذّر تحميل العملاء المحتملين',

  'pforms.stat.totalLeads': 'إجمالي العملاء المحتملين',
  'pforms.stat.questions': 'الأسئلة',
  'pforms.stat.status': 'الحالة',
  'pforms.stat.syncedLeads': 'العملاء المتزامنون',

  'pforms.leads.title': 'إرساليات العملاء المحتملين',
  'pforms.leads.synced': '{n} متزامن',
  'pforms.leads.refresh': 'تحديث',
  'pforms.leads.exportCsv': 'تصدير CSV',
  'pforms.leads.emptyTitle': 'لا يوجد عملاء محتملون متزامنون بعد',
  'pforms.leads.emptyBody': 'اربط هذا النموذج بحملة لبدء جمع العملاء المحتملين.',
  'pforms.leads.ad': 'إعلان: {id}',

  'pforms.sidebar.questions': 'الأسئلة',
  'pforms.sidebar.landingPage': 'صفحة الهبوط',
  'pforms.sidebar.formId': 'معرّف النموذج',
  'pforms.sidebar.formIdNote': 'استخدم هذا المعرّف عند ربط النموذج بمجموعة إعلانات الحملة.',
}

const ru: Dict = {
  'pforms.allForms': 'Все формы',

  'pforms.new.eyebrow': 'Новая форма лидов',
  'pforms.step.basics': 'Основное',
  'pforms.step.questions': 'Вопросы',
  'pforms.step.thankYou': 'Благодарность',
  'pforms.step.review': 'Проверка',

  'pforms.created.title': 'Форма создана.',
  'pforms.created.subtitle': 'Ваша форма генерации лидов запущена в Meta и готова к подключению к кампаниям.',
  'pforms.created.viewForm': 'Открыть форму',

  'pforms.basics.listing': 'Объект',
  'pforms.basics.selectListing': 'Выберите объект…',
  'pforms.basics.formName': 'Название формы',
  'pforms.basics.formNamePlaceholder': 'напр. Палм Джумейра — Форма лидов',
  'pforms.basics.landingUrl': 'URL лендинга',
  'pforms.basics.landingUrlPlaceholder': 'https://… (для перенаправления после благодарности)',
  'pforms.basics.privacyUrl': 'URL политики конфиденциальности',

  'pforms.questions.standardFields': 'Стандартные поля',
  'pforms.questions.required': 'Обязательно',
  'pforms.questions.custom': 'Квалифицирующие вопросы (свои)',
  'pforms.questions.totalNote': 'Всего вопросов: {n} — короткие формы конвертируют лучше. 3–4 вопроса оптимально для лидов по недвижимости.',

  'pforms.q.fullName': 'Полное имя',
  'pforms.q.phone': 'Номер телефона',
  'pforms.q.email': 'Адрес эл. почты',
  'pforms.q.city': 'Город',
  'pforms.q.autoFilled': 'Автозаполнение через Meta',
  'pforms.q.currentCity': 'Текущий город',

  'pforms.preset.budget': 'Диапазон бюджета',
  'pforms.preset.intent': 'Цель покупки',
  'pforms.preset.timeline': 'Сроки покупки',

  'pforms.budget.under1m': 'До 1 млн AED',
  'pforms.budget.1m2m': '1–2 млн AED',
  'pforms.budget.2m3m': '2–3 млн AED',
  'pforms.budget.3m5m': '3–5 млн AED',
  'pforms.budget.above5m': 'Свыше 5 млн AED',

  'pforms.intent.invest': 'Инвестиции / арендный доход',
  'pforms.intent.ownUse': 'Для себя / семейное жильё',
  'pforms.intent.goldenVisa': 'Резидентство по Golden Visa',
  'pforms.intent.comparing': 'Ещё сравниваю варианты',

  'pforms.timeline.immediate': 'Готов купить сейчас',
  'pforms.timeline.3months': 'В течение 3 месяцев',
  'pforms.timeline.6months': 'В течение 6 месяцев',
  'pforms.timeline.exploring': 'Просто присматриваюсь',

  'pforms.thankYou.intro': 'Показывается лиду сразу после отправки формы. Сделайте текст тёплым и побуждающим к действию.',
  'pforms.thankYou.headline': 'Заголовок благодарности',
  'pforms.thankYou.headlinePlaceholder': 'Спасибо — мы свяжемся с вами.',
  'pforms.thankYou.message': 'Текст благодарности',
  'pforms.thankYou.messagePlaceholder': 'Старший консультант свяжется с вами в течение 24 часов…',
  'pforms.thankYou.preview': 'Предпросмотр',
  'pforms.thankYou.previewHeadline': 'Заголовок благодарности',
  'pforms.thankYou.previewBody': 'Текст сообщения благодарности…',
  'pforms.default.thankYouTitle': 'Спасибо — мы свяжемся с вами в ближайшее время.',
  'pforms.default.thankYouBody': 'Старший консультант свяжется с вами в течение 24 часов, чтобы обсудить ваши варианты.',

  'pforms.review.formDetails': 'Детали формы',
  'pforms.review.name': 'Название',
  'pforms.review.listing': 'Объект',
  'pforms.review.landingUrl': 'URL лендинга',
  'pforms.review.privacyPolicy': 'Политика конфиденциальности',
  'pforms.review.questions': 'Вопросы',
  'pforms.review.thankYouPage': 'Страница благодарности',
  'pforms.review.headline': 'Заголовок',
  'pforms.review.message': 'Сообщение',
  'pforms.review.customWithOptions': 'Своё · {n} вариантов',
  'pforms.review.standardAutofill': 'Стандартное (автозаполнение Meta)',

  'pforms.nav.back': 'Назад',
  'pforms.nav.next': 'Далее',
  'pforms.nav.create': 'Создать форму',
  'pforms.nav.creating': 'Создание…',

  'pforms.error.createFailed': 'Не удалось создать форму',
  'pforms.error.unexpected': 'Непредвиденная ошибка',

  'pforms.detail.eyebrow': 'Форма лидов',
  'pforms.detail.created': 'Создана {date}',
  'pforms.detail.loading': 'Загрузка формы…',
  'pforms.detail.loadFailed': 'Не удалось загрузить форму',
  'pforms.detail.loadLeadsFailed': 'Не удалось загрузить лиды',

  'pforms.stat.totalLeads': 'Всего лидов',
  'pforms.stat.questions': 'Вопросы',
  'pforms.stat.status': 'Статус',
  'pforms.stat.syncedLeads': 'Синхронизировано лидов',

  'pforms.leads.title': 'Отправленные лиды',
  'pforms.leads.synced': 'Синхронизировано: {n}',
  'pforms.leads.refresh': 'Обновить',
  'pforms.leads.exportCsv': 'Экспорт CSV',
  'pforms.leads.emptyTitle': 'Лиды ещё не синхронизированы',
  'pforms.leads.emptyBody': 'Подключите эту форму к кампании, чтобы начать собирать лиды.',
  'pforms.leads.ad': 'Объявление: {id}',

  'pforms.sidebar.questions': 'Вопросы',
  'pforms.sidebar.landingPage': 'Лендинг',
  'pforms.sidebar.formId': 'ID формы',
  'pforms.sidebar.formIdNote': 'Используйте этот ID при подключении формы к группе объявлений кампании.',
}

export const p_forms = { en, ar, ru }
