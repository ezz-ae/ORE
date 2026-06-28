// Coach marks — guided, role-aware onboarding tours.
//
// Keys are dotted under the `coach.` namespace:
//   coach.ui.*               — engine chrome (Next / Back / Skip / step counter / replay)
//   coach.common.*           — steps reused by several roles (nav, expert, account, done)
//   coach.<role>.<step>.*    — role-specific welcome + focus steps
//
// Each step exposes `.title` and `.body`. Bodies may carry {name} for the
// signed-in user's first name. Missing keys fall back to English, then to the
// raw key, so an untranslated string is never blank.
type Dict = Record<string, string>

const en: Dict = {
  // ── engine chrome ──────────────────────────────────────────────────────────
  'coach.ui.next': 'Next',
  'coach.ui.back': 'Back',
  'coach.ui.skip': 'Skip tour',
  'coach.ui.done': 'Got it',
  'coach.ui.start': 'Start tour',
  'coach.ui.step': 'Step {n} of {total}',
  'coach.ui.replay': 'Take a tour',
  'coach.ui.replayHint': 'Replay the guided tour for your role',

  // ── shared steps ───────────────────────────────────────────────────────────
  'coach.common.nav.title': 'Your apps live up here',
  'coach.common.nav.body': 'This is your workspace spine. Every app you can use — CRM, Ads, Inventory, Finance and more — sits one click away. You only see the apps your role is allowed to open.',
  'coach.common.expert.title': 'Freehold Expert, always on',
  'coach.common.expert.body': 'Your AI partner reads the live system. Ask it to plan, draft a campaign, design a landing page or review work — it answers right here, grounded in your real data. Every app also has quick "Ask the Expert" prompts that feed this same conversation. Press ⌘J / Ctrl-J anytime.',
  'coach.common.account.title': 'Account & language',
  'coach.common.account.body': 'Open this menu to switch the interface between English, العربية and Русский, reach your settings, or sign out. The layout flips to right-to-left automatically for Arabic.',
  'coach.common.serverai.title': 'Ask the Intelligence Server',
  'coach.common.serverai.body': 'Type a question about today and the server answers from your live tasks, alerts and approvals — or tap a suggested question to start.',
  'coach.common.done.title': "You're all set",
  'coach.common.done.body': 'That\'s the tour. You can replay it anytime from the account menu under "Take a tour". Now go close some deals.',

  // ── broker ─────────────────────────────────────────────────────────────────
  'coach.broker.welcome.title': 'Welcome, {name} 👋',
  'coach.broker.welcome.body': 'This is your personal Workspace — your leads, campaigns, credits and AI in one place. Let me show you around in under a minute.',
  'coach.broker.workspace.title': 'My Workspace tab',
  'coach.broker.workspace.body': 'This tab is your home base. It always brings you back to your dashboard with your urgent leads, active pipeline and credit balance.',
  'coach.broker.apps.title': 'Everything you need, daily',
  'coach.broker.apps.body': 'Jump into My Leads to work your pipeline, Campaigns to promote a property, Credits to top up, or the Notebook for AI research. Badges flag what needs you first.',
  'coach.broker.depth.title': 'Ask the Expert, in context',
  'coach.broker.depth.body': 'These quick prompts open the docked Expert with your real data — what to focus on, a follow-up for your hottest lead, or a plan to hit target. Every app has its own set.',

  // ── admin ──────────────────────────────────────────────────────────────────
  'coach.admin.welcome.title': 'Welcome, {name} 👋',
  'coach.admin.welcome.body': 'You have full administrative access. This quick tour shows where the company-wide controls live so you can set the team up for success.',
  'coach.admin.settings.title': 'Settings — team, roles & billing',
  'coach.admin.settings.body': 'Add team members, assign roles, manage automation and billing here. What you grant in Settings is exactly what each role can see across the platform.',

  // ── sales manager ──────────────────────────────────────────────────────────
  'coach.manager.welcome.title': 'Welcome, {name} 👋',
  'coach.manager.welcome.body': 'You run the floor. This tour points you at the two surfaces you live in: the CRM pipeline and team performance reporting.',
  'coach.manager.crm.title': 'CRM — pipeline & agents',
  'coach.manager.crm.body': 'Watch every lead, reassign work, and unblock deals stuck in the pipeline. Approvals your agents raise land here for your sign-off.',
  'coach.manager.management.title': 'Management — team performance',
  'coach.manager.management.body': 'Company-wide reporting that rolls up across apps: agent leaderboards, deal ROI and team activity. Your single view of how the floor is performing.',

  // ── director ───────────────────────────────────────────────────────────────
  'coach.director.welcome.title': 'Welcome, {name} 👋',
  'coach.director.welcome.body': 'A 30-second tour of the reporting and financial surfaces you oversee, so the whole operation is visible at a glance.',
  'coach.director.management.title': 'Management — the company view',
  'coach.director.management.body': 'System-level reporting aggregated across every app: team, deals, ROI and events. Start your day here for the full picture.',
  'coach.director.finance.title': 'Finance — money in motion',
  'coach.director.finance.body': 'Invoices, payments, credits and budget. Approvals that move money flow through here for your oversight.',

  // ── ceo ────────────────────────────────────────────────────────────────────
  'coach.ceo.welcome.title': 'Welcome, {name} 👋',
  'coach.ceo.welcome.body': 'The shortest possible tour — just the surfaces that give you the whole company in one glance.',
  'coach.ceo.briefing.title': 'Your morning briefing',
  'coach.ceo.briefing.body': 'The day distilled: what is urgent, what is blocked, what is awaiting approval. Read it first, then ask the AI anything below it.',
  'coach.ceo.management.title': 'Management — the bird\'s-eye view',
  'coach.ceo.management.body': 'Every app rolled into one report: team, deals, ROI and growth. This is your command centre.',
  'coach.ceo.finance.title': 'Finance — the bottom line',
  'coach.ceo.finance.body': 'Revenue, spend and budget health at a glance, with the approvals that move real money.',

  // ── marketing ──────────────────────────────────────────────────────────────
  'coach.marketing.welcome.title': 'Welcome, {name} 👋',
  'coach.marketing.welcome.body': 'A quick tour of your growth stack: ads, the web studio and analytics — everything you need to fill the pipeline.',
  'coach.marketing.ads.title': 'Ads — campaigns end to end',
  'coach.marketing.ads.body': 'Build and track campaigns across Meta and Google, generate creatives, and follow attribution from click to lead.',
  'coach.marketing.studio.title': 'Web Studio — content engine',
  'coach.marketing.studio.body': 'Generate listings, landing pages and SEO content automatically, and keep your data quality high so ads have somewhere to send traffic.',
  'coach.marketing.analytics.title': 'Analytics — what is working',
  'coach.marketing.analytics.body': 'Traffic, conversions and page performance over time. Close the loop: see which campaigns and pages actually drive leads.',
}

const ar: Dict = {
  'coach.ui.next': 'التالي',
  'coach.ui.back': 'السابق',
  'coach.ui.skip': 'تخطّي الجولة',
  'coach.ui.done': 'تمّ',
  'coach.ui.start': 'ابدأ الجولة',
  'coach.ui.step': 'الخطوة {n} من {total}',
  'coach.ui.replay': 'ابدأ الجولة التعريفية',
  'coach.ui.replayHint': 'إعادة الجولة التعريفية الخاصة بدورك',

  'coach.common.nav.title': 'تطبيقاتك موجودة هنا في الأعلى',
  'coach.common.nav.body': 'هذا هو الشريط الرئيسي لمساحة عملك. كل تطبيق يمكنك استخدامه — إدارة العملاء والإعلانات والمخزون والمالية وغيرها — على بُعد نقرة واحدة. تظهر لك فقط التطبيقات المسموح بها لدورك.',
  'coach.common.expert.title': 'خبير فريهولد، جاهز دائماً',
  'coach.common.expert.body': 'مساعدك الذكي يقرأ حالة النظام مباشرة. اطلب منه التخطيط أو صياغة حملة أو تصميم صفحة هبوط أو مراجعة العمل — يجيبك هنا مباشرةً بالاعتماد على بياناتك الفعلية. كما يحتوي كل تطبيق على إرشادات سريعة «اسأل الخبير» تصبّ في المحادثة نفسها. اضغط ⌘J / Ctrl-J في أي وقت.',
  'coach.common.account.title': 'الحساب واللغة',
  'coach.common.account.body': 'افتح هذه القائمة لتبديل واجهة الاستخدام بين الإنجليزية والعربية والروسية، أو للوصول إلى إعداداتك، أو لتسجيل الخروج. تتحوّل الواجهة تلقائياً إلى الاتجاه من اليمين إلى اليسار للعربية.',
  'coach.common.serverai.title': 'اسأل خادم الذكاء',
  'coach.common.serverai.body': 'اكتب سؤالاً عن يومك ويجيبك الخادم من مهامك وتنبيهاتك وطلبات الموافقة المباشرة — أو اضغط على سؤال مقترَح للبدء.',
  'coach.common.done.title': 'كل شيء جاهز',
  'coach.common.done.body': 'انتهت الجولة. يمكنك إعادتها في أي وقت من قائمة الحساب عبر «ابدأ الجولة التعريفية». والآن أنجِز بعض الصفقات.',

  'coach.broker.welcome.title': 'مرحباً، {name} 👋',
  'coach.broker.welcome.body': 'هذه مساحة عملك الشخصية — عملاؤك وحملاتك ورصيدك والذكاء الاصطناعي في مكان واحد. دعني أرشدك في أقل من دقيقة.',
  'coach.broker.workspace.title': 'تبويب مساحتي',
  'coach.broker.workspace.body': 'هذا التبويب هو نقطة انطلاقك. يعيدك دائماً إلى لوحتك مع عملائك العاجلين ومسار مبيعاتك النشط ورصيدك.',
  'coach.broker.apps.title': 'كل ما تحتاجه يومياً',
  'coach.broker.apps.body': 'انتقل إلى «عملائي» لإدارة مسارك، أو «الحملات» للترويج لعقار، أو «الرصيد» لإعادة الشحن، أو «دفتر الملاحظات» للبحث بالذكاء الاصطناعي. تشير الشارات إلى ما يحتاج انتباهك أولاً.',
  'coach.broker.depth.title': 'اسأل الخبير ضمن السياق',
  'coach.broker.depth.body': 'تفتح هذه الإرشادات السريعة الخبير المثبّت مستنداً إلى بياناتك الفعلية — علام تركّز، أو رسالة متابعة لأهم عملائك، أو خطة لتحقيق الهدف. لكل تطبيق مجموعته الخاصة.',

  'coach.admin.welcome.title': 'مرحباً، {name} 👋',
  'coach.admin.welcome.body': 'لديك صلاحية إدارية كاملة. تعرض لك هذه الجولة السريعة مكان عناصر التحكم على مستوى الشركة لتجهيز فريقك للنجاح.',
  'coach.admin.settings.title': 'الإعدادات — الفريق والأدوار والفوترة',
  'coach.admin.settings.body': 'أضف أعضاء الفريق وعيّن الأدوار وأدِر الأتمتة والفوترة من هنا. ما تمنحه في الإعدادات هو بالضبط ما يراه كل دور عبر المنصة.',

  'coach.manager.welcome.title': 'مرحباً، {name} 👋',
  'coach.manager.welcome.body': 'أنت تدير الميدان. توجّهك هذه الجولة إلى الواجهتين اللتين تعمل فيهما دائماً: مسار إدارة العملاء وتقارير أداء الفريق.',
  'coach.manager.crm.title': 'إدارة العملاء — المسار والوكلاء',
  'coach.manager.crm.body': 'راقب كل عميل، وأعد توزيع العمل، وافتح الصفقات المتوقفة في المسار. تصل إليك طلبات الموافقة من وكلائك لاعتمادها.',
  'coach.manager.management.title': 'الإدارة — أداء الفريق',
  'coach.manager.management.body': 'تقارير على مستوى الشركة تجمع عبر التطبيقات: ترتيب الوكلاء وعائد الصفقات ونشاط الفريق. رؤيتك الموحَّدة لأداء الميدان.',

  'coach.director.welcome.title': 'مرحباً، {name} 👋',
  'coach.director.welcome.body': 'جولة من 30 ثانية على واجهات التقارير والمالية التي تشرف عليها، لتكون العملية كلها واضحة في لمحة.',
  'coach.director.management.title': 'الإدارة — رؤية الشركة',
  'coach.director.management.body': 'تقارير على مستوى النظام مجمّعة عبر كل تطبيق: الفريق والصفقات والعائد والأحداث. ابدأ يومك هنا للصورة الكاملة.',
  'coach.director.finance.title': 'المالية — حركة الأموال',
  'coach.director.finance.body': 'الفواتير والمدفوعات والرصيد والميزانية. تمرّ الموافقات المالية من هنا لإشرافك.',

  'coach.ceo.welcome.title': 'مرحباً، {name} 👋',
  'coach.ceo.welcome.body': 'أقصر جولة ممكنة — فقط الواجهات التي تمنحك الشركة كاملةً في لمحة واحدة.',
  'coach.ceo.briefing.title': 'إحاطتك الصباحية',
  'coach.ceo.briefing.body': 'خلاصة اليوم: ما هو عاجل، وما هو متوقف، وما ينتظر الموافقة. اقرأها أولاً ثم اسأل الذكاء الاصطناعي أي شيء أسفلها.',
  'coach.ceo.management.title': 'الإدارة — النظرة الشاملة',
  'coach.ceo.management.body': 'كل تطبيق مجمّع في تقرير واحد: الفريق والصفقات والعائد والنمو. هذا مركز قيادتك.',
  'coach.ceo.finance.title': 'المالية — المحصّلة النهائية',
  'coach.ceo.finance.body': 'الإيرادات والإنفاق وصحة الميزانية في لمحة، مع الموافقات التي تحرّك الأموال الفعلية.',

  'coach.marketing.welcome.title': 'مرحباً، {name} 👋',
  'coach.marketing.welcome.body': 'جولة سريعة في منظومة النمو لديك: الإعلانات واستوديو الويب والتحليلات — كل ما تحتاجه لملء المسار.',
  'coach.marketing.ads.title': 'الإعلانات — حملات من البداية للنهاية',
  'coach.marketing.ads.body': 'أنشئ الحملات وتتبّعها عبر ميتا وجوجل، وولّد التصاميم، وتابع الإسناد من النقرة إلى العميل.',
  'coach.marketing.studio.title': 'استوديو الويب — محرّك المحتوى',
  'coach.marketing.studio.body': 'ولّد القوائم وصفحات الهبوط ومحتوى تحسين محركات البحث تلقائياً، وحافظ على جودة بياناتك ليكون للإعلانات وجهة ترسل إليها الزيارات.',
  'coach.marketing.analytics.title': 'التحليلات — ما الذي ينجح',
  'coach.marketing.analytics.body': 'الزيارات والتحويلات وأداء الصفحات عبر الزمن. أغلِق الحلقة: شاهد أي الحملات والصفحات تجلب العملاء فعلاً.',
}

const ru: Dict = {
  'coach.ui.next': 'Далее',
  'coach.ui.back': 'Назад',
  'coach.ui.skip': 'Пропустить',
  'coach.ui.done': 'Готово',
  'coach.ui.start': 'Начать тур',
  'coach.ui.step': 'Шаг {n} из {total}',
  'coach.ui.replay': 'Пройти обучение',
  'coach.ui.replayHint': 'Повторить обучающий тур для вашей роли',

  'coach.common.nav.title': 'Ваши приложения — здесь, наверху',
  'coach.common.nav.body': 'Это основная панель рабочего пространства. Каждое доступное приложение — CRM, Реклама, Объекты, Финансы и другие — в одном клике. Вы видите только те приложения, которые разрешены вашей роли.',
  'coach.common.expert.title': 'Freehold Expert всегда на связи',
  'coach.common.expert.body': 'Ваш ИИ-помощник читает систему в реальном времени. Попросите его спланировать, составить кампанию, оформить лендинг или проверить работу — он ответит прямо здесь на основе ваших реальных данных. В каждом приложении есть быстрые подсказки «Спросите Эксперта», которые ведут в этот же диалог. Нажмите ⌘J / Ctrl-J в любой момент.',
  'coach.common.account.title': 'Аккаунт и язык',
  'coach.common.account.body': 'Откройте это меню, чтобы переключить интерфейс между English, العربية и Русским, перейти в настройки или выйти. Для арабского интерфейс автоматически разворачивается справа налево.',
  'coach.common.serverai.title': 'Спросите сервер аналитики',
  'coach.common.serverai.body': 'Задайте вопрос о текущем дне — сервер ответит на основе ваших задач, оповещений и согласований, либо нажмите готовый вопрос, чтобы начать.',
  'coach.common.done.title': 'Всё готово',
  'coach.common.done.body': 'Тур завершён. Вы можете повторить его в любой момент из меню аккаунта — «Пройти обучение». А теперь — за сделки.',

  'coach.broker.welcome.title': 'Добро пожаловать, {name} 👋',
  'coach.broker.welcome.body': 'Это ваше личное рабочее пространство — лиды, кампании, кредиты и ИИ в одном месте. Покажу всё меньше чем за минуту.',
  'coach.broker.workspace.title': 'Вкладка «Моё пространство»',
  'coach.broker.workspace.body': 'Эта вкладка — ваша база. Она всегда возвращает на дашборд со срочными лидами, активной воронкой и балансом кредитов.',
  'coach.broker.apps.title': 'Всё нужное — каждый день',
  'coach.broker.apps.body': 'Откройте «Мои лиды» для работы с воронкой, «Кампании» для продвижения объекта, «Кредиты» для пополнения или «Блокнот» для ИИ-исследований. Значки показывают, что требует внимания в первую очередь.',
  'coach.broker.depth.title': 'Спросите Эксперта в контексте',
  'coach.broker.depth.body': 'Эти быстрые подсказки открывают закреплённого Эксперта с вашими реальными данными — на чём сосредоточиться, касание для самого горячего лида или план достижения цели. В каждом приложении свой набор.',

  'coach.admin.welcome.title': 'Добро пожаловать, {name} 👋',
  'coach.admin.welcome.body': 'У вас полный административный доступ. Этот короткий тур показывает, где находятся настройки уровня компании, чтобы вы подготовили команду к работе.',
  'coach.admin.settings.title': 'Настройки — команда, роли и оплата',
  'coach.admin.settings.body': 'Добавляйте участников, назначайте роли, управляйте автоматизацией и оплатой здесь. То, что вы открываете в настройках, ровно то и видит каждая роль на платформе.',

  'coach.manager.welcome.title': 'Добро пожаловать, {name} 👋',
  'coach.manager.welcome.body': 'Вы управляете отделом. Этот тур укажет на две главные для вас поверхности: воронку CRM и отчёты по работе команды.',
  'coach.manager.crm.title': 'CRM — воронка и агенты',
  'coach.manager.crm.body': 'Следите за каждым лидом, перераспределяйте работу и разблокируйте застрявшие сделки. Запросы на согласование от агентов приходят сюда на ваше утверждение.',
  'coach.manager.management.title': 'Управление — работа команды',
  'coach.manager.management.body': 'Отчётность уровня компании, собранная по всем приложениям: рейтинги агентов, ROI по сделкам и активность команды. Ваш единый взгляд на работу отдела.',

  'coach.director.welcome.title': 'Добро пожаловать, {name} 👋',
  'coach.director.welcome.body': '30-секундный тур по отчётным и финансовым поверхностям под вашим контролем, чтобы вся работа была видна с одного взгляда.',
  'coach.director.management.title': 'Управление — взгляд на компанию',
  'coach.director.management.body': 'Отчётность уровня системы, собранная по всем приложениям: команда, сделки, ROI и события. Начинайте день здесь — для полной картины.',
  'coach.director.finance.title': 'Финансы — движение денег',
  'coach.director.finance.body': 'Счета, платежи, кредиты и бюджет. Согласования, которые двигают деньги, проходят здесь под вашим контролем.',

  'coach.ceo.welcome.title': 'Добро пожаловать, {name} 👋',
  'coach.ceo.welcome.body': 'Самый короткий тур — только те поверхности, что показывают всю компанию с одного взгляда.',
  'coach.ceo.briefing.title': 'Ваша утренняя сводка',
  'coach.ceo.briefing.body': 'День в концентрате: что срочно, что заблокировано, что ждёт согласования. Прочтите сначала её, затем спросите ИИ о чём угодно ниже.',
  'coach.ceo.management.title': 'Управление — вид с высоты',
  'coach.ceo.management.body': 'Все приложения в одном отчёте: команда, сделки, ROI и рост. Это ваш командный центр.',
  'coach.ceo.finance.title': 'Финансы — итоговая строка',
  'coach.ceo.finance.body': 'Выручка, расходы и состояние бюджета с одного взгляда, вместе с согласованиями, которые двигают реальные деньги.',

  'coach.marketing.welcome.title': 'Добро пожаловать, {name} 👋',
  'coach.marketing.welcome.body': 'Быстрый тур по вашему стеку роста: реклама, веб-студия и аналитика — всё, чтобы наполнять воронку.',
  'coach.marketing.ads.title': 'Реклама — кампании от и до',
  'coach.marketing.ads.body': 'Создавайте и отслеживайте кампании в Meta и Google, генерируйте креативы и следите за атрибуцией от клика до лида.',
  'coach.marketing.studio.title': 'Веб-студия — движок контента',
  'coach.marketing.studio.body': 'Автоматически генерируйте объявления, лендинги и SEO-контент и поддерживайте качество данных, чтобы рекламе было куда вести трафик.',
  'coach.marketing.analytics.title': 'Аналитика — что работает',
  'coach.marketing.analytics.body': 'Трафик, конверсии и эффективность страниц во времени. Замкните цикл: смотрите, какие кампании и страницы реально приводят лиды.',
}

export const coach = { en, ar, ru }
