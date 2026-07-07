// Self-service integration setup guides — EN/AR/RU. Provider/product names
// (Meta, HubSpot, Google Ads, WhatsApp, OAuth) and permission identifiers stay
// untranslated; click-paths are rendered as literal chips by the component.
type Dict = Record<string, string>

const en: Dict = {
  'guide.open': 'How do I get this? Step-by-step',

  'guide.meta.1': 'In Meta Business Settings, create a System User (role: Admin) — a robot team member whose token never expires.',
  'guide.meta.2': 'Add assets to it: your ad account (Manage) and your Facebook Page (Manage).',
  'guide.meta.3': 'Generate a token with these permissions: ads_management, ads_read, pages_show_list, pages_manage_ads, leads_retrieval.',
  'guide.meta.4': 'Copy the token immediately — Meta shows it only once.',
  'guide.meta.5': 'Paste it here, pick your ad account and Facebook Page, then Save. We validate it with Meta before storing it encrypted.',

  'guide.wa.1': 'Open your app’s WhatsApp API Setup and copy the Phone number ID (the numeric ID, not the phone number itself).',
  'guide.wa.2': 'For a permanent connection use a System User token with whatsapp_business_messaging + whatsapp_business_management (the token shown on the API Setup page expires in 24 hours).',
  'guide.wa.3': 'Paste both here and Save — we validate against the WhatsApp Cloud API before storing.',

  'guide.hub.1': 'In HubSpot, create a Private App.',
  'guide.hub.2': 'Enable two scopes — crm.objects.contacts.read and crm.objects.contacts.write — then copy the token (starts with pat-).',
  'guide.hub.3': 'Paste it here and Connect — your dashboard loads and two-way sync activates automatically.',

  'guide.goog.1': 'Developer token: from your Google Ads Manager (MCC) account’s API Center. Google’s approval can take days — request it early.',
  'guide.goog.2': 'OAuth Client ID + secret: create an OAuth client in Google Cloud Console and enable the Google Ads API for the project.',
  'guide.goog.3': 'Refresh token: authorize once in Google’s OAuth 2.0 Playground using your own client with the adwords scope, then copy the refresh token.',
  'guide.goog.4': 'Customer ID: the 10-digit number at the top of your Google Ads account (enter it without dashes).',
  'guide.goog.5': 'Paste all five here and Save — we validate with Google (token refresh + a test query) before storing.',
  'howto.metaAd.name': 'Run a Meta lead campaign',
  'howto.metaAd.s1.title': 'Step 1 — Connect Meta',
  'howto.metaAd.s1.body': 'Paste your access token, pick the ad account and Facebook Page, then Save. Already connected? Press Next.',
  'howto.metaAd.s2.title': 'Step 2 — Pick a project',
  'howto.metaAd.s2.body': 'Choose the property you want leads for. The name, photo and landing page fill in automatically.',
  'howto.metaAd.s3.title': 'Step 3 — Your creative',
  'howto.metaAd.s3.body': 'On the Creative step: keep the property photo, upload your own image, and adjust the AI-written copy.',
  'howto.metaAd.s4.title': 'Step 4 — Budget & audience',
  'howto.metaAd.s4.body': 'On the Targeting step: set the daily budget (AED) and confirm cities, age range and interests.',
  'howto.metaAd.s5.title': 'Step 5 — Launch paused',
  'howto.metaAd.s5.body': 'Review the summary and press Launch. Keep it Paused for the first run — no money is spent until you flip it live.',
  'howto.metaAd.s6.title': 'Step 6 — Watch it live',
  'howto.metaAd.s6.body': 'Your campaign appears here with its real Meta ID. When a test lead arrives it lands in CRM → Leads automatically. Done!',

}

const ar: Dict = {
  'guide.open': 'كيف أحصل على هذا؟ خطوة بخطوة',

  'guide.meta.1': 'في إعدادات Meta Business أنشئ مستخدم نظام (System User) بدور مدير — عضو آلي في الفريق لا تنتهي صلاحية رمزه.',
  'guide.meta.2': 'أضف الأصول إليه: حسابك الإعلاني (إدارة) وصفحة فيسبوك (إدارة).',
  'guide.meta.3': 'أنشئ رمزاً بهذه الصلاحيات: ads_management وads_read وpages_show_list وpages_manage_ads وleads_retrieval.',
  'guide.meta.4': 'انسخ الرمز فوراً — تعرضه Meta مرة واحدة فقط.',
  'guide.meta.5': 'الصقه هنا، اختر الحساب الإعلاني وصفحة فيسبوك ثم احفظ. نتحقق منه لدى Meta قبل تخزينه مشفّراً.',

  'guide.wa.1': 'افتح WhatsApp API Setup في تطبيقك وانسخ معرّف رقم الهاتف (المعرّف الرقمي وليس رقم الهاتف نفسه).',
  'guide.wa.2': 'للاتصال الدائم استخدم رمز مستخدم نظام بصلاحيتي whatsapp_business_messaging وwhatsapp_business_management (رمز صفحة الإعداد تنتهي صلاحيته خلال 24 ساعة).',
  'guide.wa.3': 'الصق الاثنين هنا واحفظ — نتحقق لدى WhatsApp Cloud API قبل التخزين.',

  'guide.hub.1': 'في HubSpot أنشئ تطبيقاً خاصاً (Private App).',
  'guide.hub.2': 'فعّل صلاحيتين — crm.objects.contacts.read وcrm.objects.contacts.write — ثم انسخ الرمز (يبدأ بـ pat-).',
  'guide.hub.3': 'الصقه هنا واتصل — تُحمَّل لوحتك وتُفعَّل المزامنة الثنائية تلقائياً.',

  'guide.goog.1': 'رمز المطوّر: من API Center في حساب مدير Google Ads‏ (MCC). قد تستغرق موافقة Google أياماً — اطلبه مبكراً.',
  'guide.goog.2': 'معرّف عميل OAuth والسر: أنشئ عميل OAuth في Google Cloud Console وفعّل Google Ads API للمشروع.',
  'guide.goog.3': 'رمز التحديث: فوّض مرة واحدة في OAuth 2.0 Playground باستخدام عميلك مع نطاق adwords ثم انسخ رمز التحديث.',
  'guide.goog.4': 'معرّف العميل: الرقم المكوّن من 10 خانات أعلى حساب Google Ads (أدخله بدون شرطات).',
  'guide.goog.5': 'الصق الخمسة هنا واحفظ — نتحقق لدى Google (تحديث الرمز واستعلام تجريبي) قبل التخزين.',
  'howto.metaAd.name': 'إطلاق حملة عملاء على Meta',
  'howto.metaAd.s1.title': 'الخطوة 1 — اتصل بـ Meta',
  'howto.metaAd.s1.body': 'الصق رمز الوصول، اختر الحساب الإعلاني وصفحة فيسبوك ثم احفظ. متصل بالفعل؟ اضغط التالي.',
  'howto.metaAd.s2.title': 'الخطوة 2 — اختر مشروعاً',
  'howto.metaAd.s2.body': 'اختر العقار الذي تريد عملاء له. يُملأ الاسم والصورة وصفحة الهبوط تلقائياً.',
  'howto.metaAd.s3.title': 'الخطوة 3 — التصميم الإعلاني',
  'howto.metaAd.s3.body': 'في خطوة التصميم: أبقِ صورة العقار أو ارفع صورتك، وعدّل النص المكتوب بالذكاء الاصطناعي.',
  'howto.metaAd.s4.title': 'الخطوة 4 — الميزانية والجمهور',
  'howto.metaAd.s4.body': 'في خطوة الاستهداف: حدد الميزانية اليومية (درهم) وأكد المدن والفئة العمرية والاهتمامات.',
  'howto.metaAd.s5.title': 'الخطوة 5 — أطلقها متوقفة',
  'howto.metaAd.s5.body': 'راجع الملخص واضغط إطلاق. أبقِها متوقفة في أول تشغيل — لا يُنفق أي مبلغ حتى تفعّلها.',
  'howto.metaAd.s6.title': 'الخطوة 6 — تابعها مباشرة',
  'howto.metaAd.s6.body': 'تظهر حملتك هنا بمعرّف Meta الحقيقي. وعند وصول عميل تجريبي يصل تلقائياً إلى إدارة العملاء. انتهيت!',

}

const ru: Dict = {
  'guide.open': 'Как это получить? Пошагово',

  'guide.meta.1': 'В настройках Meta Business создайте системного пользователя (роль: администратор) — «робота» в команде, чей токен не истекает.',
  'guide.meta.2': 'Назначьте ему активы: рекламный аккаунт (Управление) и страницу Facebook (Управление).',
  'guide.meta.3': 'Сгенерируйте токен с правами: ads_management, ads_read, pages_show_list, pages_manage_ads, leads_retrieval.',
  'guide.meta.4': 'Сразу скопируйте токен — Meta показывает его только один раз.',
  'guide.meta.5': 'Вставьте его здесь, выберите рекламный аккаунт и страницу Facebook, затем сохраните. Мы проверяем токен в Meta перед зашифрованным сохранением.',

  'guide.wa.1': 'Откройте WhatsApp API Setup вашего приложения и скопируйте Phone number ID (числовой идентификатор, не сам номер).',
  'guide.wa.2': 'Для постоянного подключения используйте токен системного пользователя с правами whatsapp_business_messaging + whatsapp_business_management (токен со страницы настройки живёт 24 часа).',
  'guide.wa.3': 'Вставьте оба значения и сохраните — мы проверяем их в WhatsApp Cloud API перед сохранением.',

  'guide.hub.1': 'В HubSpot создайте Private App.',
  'guide.hub.2': 'Включите два права — crm.objects.contacts.read и crm.objects.contacts.write — затем скопируйте токен (начинается с pat-).',
  'guide.hub.3': 'Вставьте его здесь и подключитесь — панель загрузится, двусторонняя синхронизация включится автоматически.',

  'guide.goog.1': 'Токен разработчика: в API Center аккаунта-менеджера Google Ads (MCC). Одобрение Google может занять дни — запросите заранее.',
  'guide.goog.2': 'OAuth Client ID и секрет: создайте OAuth-клиент в Google Cloud Console и включите Google Ads API для проекта.',
  'guide.goog.3': 'Refresh token: авторизуйтесь один раз в OAuth 2.0 Playground со своим клиентом и областью adwords, затем скопируйте refresh token.',
  'guide.goog.4': 'Customer ID: 10-значный номер вверху аккаунта Google Ads (вводите без дефисов).',
  'guide.goog.5': 'Вставьте все пять значений и сохраните — мы проверяем их в Google (обновление токена + тестовый запрос) перед сохранением.',
  'howto.metaAd.name': 'Запустить лид-кампанию Meta',
  'howto.metaAd.s1.title': 'Шаг 1 — Подключите Meta',
  'howto.metaAd.s1.body': 'Вставьте токен, выберите рекламный аккаунт и страницу Facebook, затем сохраните. Уже подключено? Жмите Далее.',
  'howto.metaAd.s2.title': 'Шаг 2 — Выберите проект',
  'howto.metaAd.s2.body': 'Выберите объект, для которого нужны лиды. Название, фото и посадочная страница заполнятся сами.',
  'howto.metaAd.s3.title': 'Шаг 3 — Креатив',
  'howto.metaAd.s3.body': 'На шаге «Креатив»: оставьте фото объекта или загрузите своё и поправьте текст, написанный ИИ.',
  'howto.metaAd.s4.title': 'Шаг 4 — Бюджет и аудитория',
  'howto.metaAd.s4.body': 'На шаге «Таргетинг»: задайте дневной бюджет (AED) и подтвердите города, возраст и интересы.',
  'howto.metaAd.s5.title': 'Шаг 5 — Запуск на паузе',
  'howto.metaAd.s5.body': 'Проверьте сводку и нажмите «Запустить». Оставьте на паузе для первого запуска — деньги не тратятся, пока вы не включите.',
  'howto.metaAd.s6.title': 'Шаг 6 — Смотрите вживую',
  'howto.metaAd.s6.body': 'Кампания появится здесь с реальным ID Meta. Тестовый лид автоматически попадёт в CRM → Лиды. Готово!',

}

export const setup_guide = { en, ar, ru }
