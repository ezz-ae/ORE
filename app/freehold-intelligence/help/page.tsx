'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  BookOpen, Compass, Play, Link2, Search, Sparkles, ChevronDown, Loader2,
  ArrowRight, Users, Megaphone, Package, DollarSign, TrendingUp, ShieldCheck,
  Settings, UserCircle, Rocket, CheckCircle2, Circle,
} from 'lucide-react'
import { useCoach } from '@/components/freehold/coach/coach-marks'
import { howtosForRole, ESSENTIAL_HOWTOS, type HowToFlow } from '@/lib/freehold/howto'
import { loadAccountMemory, saveAccountMemory } from '@/lib/freehold/account-memory'
import { useSession } from '@/lib/freehold/use-session'
import { useI18n } from '@/lib/i18n/provider'

const ESSENTIALS_PREF_KEY = 'helpEssentialsDone'

const FI = '/freehold-intelligence'

// ─── The Q&A catalogue — the full system, department by department ───────────
// Fully trilingual: every question, answer and link label carries EN/AR/RU
// inline (selected by the active locale). Every answer either launches the
// REAL coach (the user does the thing, not just reads about it), links to the
// exact page, or both.

type L10n = { en: string; ar: string; ru: string }
const T = (en: string, ar: string, ru: string): L10n => ({ en, ar, ru })

interface QA {
  q: L10n
  a: L10n
  /** HowTo flow id — renders the "Guide me step by step" coach button. */
  flow?: string
  /** Direct links rendered as chips. */
  links?: Array<{ label: L10n; href: string }>
  /** Restrict to roles (undefined = everyone). */
  roles?: string[]
}

interface QASection {
  id: string
  title: L10n
  Icon: typeof Users
  items: QA[]
}

const MGMT = ['admin', 'ceo', 'director', 'sales_manager']
const MGMT_MKT = [...MGMT, 'marketing']

const SECTIONS: QASection[] = [
  {
    id: 'start',
    title: T('Getting started & your account', 'البداية وحسابك', 'Начало работы и ваш аккаунт'),
    Icon: Rocket,
    items: [
      {
        q: T('How do I sign in?', 'كيف أسجّل الدخول؟', 'Как войти?'),
        a: T(
          'Go to the sign-in page, pick your profile and enter your password. "Remember me" keeps the session for 30 days on that device.',
          'افتح صفحة تسجيل الدخول، اختر ملفك الشخصي وأدخل كلمة المرور. «تذكرني» تُبقي الجلسة 30 يوماً على هذا الجهاز.',
          'Откройте страницу входа, выберите профиль и введите пароль. «Запомнить меня» сохраняет сессию на 30 дней на этом устройстве.',
        ),
      },
      {
        q: T('Where do I change the language (English / العربية / Русский)?', 'أين أغيّر اللغة (English / العربية / Русский)؟', 'Где сменить язык (English / العربية / Русский)?'),
        a: T(
          "Account menu (top-right) → Language. Arabic flips the whole layout right-to-left automatically. On a first visit the app opens in your device's language.",
          'قائمة الحساب (أعلى الصفحة) ← اللغة. العربية تقلب الواجهة كاملة من اليمين لليسار تلقائياً. وفي أول زيارة يفتح النظام بلغة جهازك.',
          'Меню аккаунта (сверху справа) → Язык. Арабский автоматически переворачивает весь интерфейс справа налево. При первом визите приложение открывается на языке устройства.',
        ),
        flow: 'personalize',
      },
      {
        q: T('How do I switch between Day and Night?', 'كيف أبدّل بين النهار والليل؟', 'Как переключить режим День/Ночь?'),
        a: T(
          'Account menu → the Day / Night screen-light toggle. Your choice is saved to your account.',
          'قائمة الحساب ← مفتاح إضاءة الشاشة نهار / ليل. اختيارك يُحفظ في حسابك.',
          'Меню аккаунта → переключатель День / Ночь. Ваш выбор сохраняется в аккаунте.',
        ),
        flow: 'personalize',
      },
      {
        q: T('Will my settings follow me to another device?', 'هل تتبعني إعداداتي إلى جهاز آخر؟', 'Перенесутся ли настройки на другое устройство?'),
        a: T(
          "Yes. Language, theme, dismissed notices, tour progress, even an unfinished campaign draft — all live on your ACCOUNT, not the browser. Sign in anywhere and it's your setup.",
          'نعم. اللغة والمظهر والإشعارات المغلقة وتقدّم الجولات وحتى مسودة حملة غير مكتملة — كلها في حسابك لا في المتصفح. سجّل الدخول من أي مكان وستجد إعدادك.',
          'Да. Язык, тема, закрытые уведомления, прогресс туров и даже незаконченный черновик кампании — всё хранится в АККАУНТЕ, а не в браузере. Войдите откуда угодно — и всё на месте.',
        ),
      },
      {
        q: T('What is the gold AI button on every screen?', 'ما هو زر الذكاء الاصطناعي الذهبي في كل شاشة؟', 'Что за золотая кнопка ИИ на каждом экране?'),
        a: T(
          'The Expert — press it (or ⌘J / Ctrl-J) and ask anything about your live data. Whatever it produces can be saved to the Notebook.',
          'الخبير — اضغطه (أو ⌘J / Ctrl-J) واسأل أي شيء عن بياناتك الحية. وكل ما ينتجه يمكن حفظه في الدفتر.',
          'Это Эксперт — нажмите её (или ⌘J / Ctrl-J) и спросите что угодно о ваших живых данных. Всё, что он создаёт, можно сохранить в Блокнот.',
        ),
        links: [{ label: T('Notebook', 'الدفتر', 'Блокнот'), href: `${FI}/notebook` }],
      },
      {
        q: T("How do I replay a page's tour?", 'كيف أعيد تشغيل جولة الصفحة؟', 'Как повторить тур по странице?'),
        a: T(
          'Account menu → "Take a tour" replays the guided tour for the app you\'re on. The walkthroughs on this page go deeper — across pages, task by task.',
          'قائمة الحساب ← «خذ جولة» تعيد الجولة الإرشادية للتطبيق الحالي. أمّا الجولات في هذه الصفحة فتذهب أعمق — عبر الصفحات، مهمة بمهمة.',
          'Меню аккаунта → «Пройти тур» повторяет тур по текущему приложению. Гиды на этой странице идут глубже — через страницы, задача за задачей.',
        ),
      },
      {
        q: T("Where do I see what's new in the system?", 'أين أرى الجديد في النظام؟', 'Где посмотреть, что нового в системе?'),
        a: T(
          "Account menu → What's new. When something ships you'll also get a small corner note — dismissing it once dismisses it on all your devices.",
          'قائمة الحساب ← «الجديد». وعند صدور شيء جديد يظهر تنبيه صغير في الزاوية — إغلاقه مرة يغلقه على كل أجهزتك.',
          'Меню аккаунта → «Что нового». Когда выходит новинка, появляется маленькая заметка в углу — закрыв её один раз, вы закрываете её на всех устройствах.',
        ),
      },
    ],
  },
  {
    id: 'crm',
    title: T('CRM & leads', 'إدارة العملاء والليدز', 'CRM и лиды'),
    Icon: Users,
    items: [
      {
        q: T('How do I add a lead manually?', 'كيف أضيف عميلاً يدوياً؟', 'Как добавить лид вручную?'),
        a: T(
          'CRM → Leads → Add lead. Name and phone are enough to start.',
          'إدارة العملاء ← العملاء ← إضافة عميل. الاسم ورقم الهاتف يكفيان للبدء.',
          'CRM → Лиды → Добавить лид. Для начала хватит имени и телефона.',
        ),
        flow: 'add-lead',
        links: [{ label: T('CRM → Leads', 'إدارة العملاء ← العملاء', 'CRM → Лиды'), href: `${FI}/crm/leads` }],
      },
      {
        q: T('Where do new leads from ads arrive?', 'أين تصل العملاء الجدد من الإعلانات؟', 'Куда приходят новые лиды из рекламы?'),
        a: T(
          'The CRM Inbox — the moment a Meta form or landing page captures someone, the lead appears there unassigned, with its source attached.',
          'صندوق الوارد في إدارة العملاء — لحظة التقاط نموذج Meta أو صفحة هبوط لأحدهم، يظهر العميل هناك غير مُسند ومعه مصدره.',
          'Во «Входящие» CRM — как только форма Meta или посадочная страница ловит человека, лид появляется там нераспределённым, с указанием источника.',
        ),
        links: [{ label: T('CRM → Inbox', 'إدارة العملاء ← الوارد', 'CRM → Входящие'), href: `${FI}/crm/inbox` }],
      },
      {
        q: T('How do I assign a lead to a broker?', 'كيف أُسند عميلاً إلى وسيط؟', 'Как назначить лид брокеру?'),
        a: T(
          'From the Inbox or the Assignment screen — every broker shows live capacity so no one gets overloaded. The broker is emailed instantly.',
          'من الوارد أو شاشة الإسناد — كل وسيط يعرض طاقته الاستيعابية مباشرة فلا يُحمَّل أحد فوق طاقته. ويصل بريد للوسيط فوراً.',
          'Из «Входящих» или экрана «Назначение» — у каждого брокера видна живая загрузка, никого не перегрузите. Брокер мгновенно получает письмо.',
        ),
        flow: 'assign-lead',
        roles: MGMT_MKT,
      },
      {
        q: T("How do I know which leads I'm late on?", 'كيف أعرف العملاء الذين تأخرت عليهم؟', 'Как узнать, по каким лидам я опаздываю?'),
        a: T(
          'CRM → Follow-up. Every overdue lead is queued by urgency — start each morning at the top.',
          'إدارة العملاء ← المتابعة. كل عميل متأخر يصطف حسب الإلحاح — ابدأ كل صباح من الأعلى.',
          'CRM → Фоллоу-ап. Каждый просроченный лид стоит в очереди по срочности — начинайте утро с верха списка.',
        ),
        flow: 'follow-up',
        links: [{ label: T('Follow-up queue', 'طابور المتابعة', 'Очередь фоллоу-апов'), href: `${FI}/crm/follow-up` }],
      },
      {
        q: T('How do I call or WhatsApp a lead?', 'كيف أتصل أو أراسل عميلاً عبر واتساب؟', 'Как позвонить лиду или написать в WhatsApp?'),
        a: T(
          "Call and WhatsApp buttons sit on every lead row and inside the lead's 360° view. Every touch lands in the timeline automatically.",
          'زرا الاتصال وواتساب موجودان في كل صف عميل وداخل العرض الشامل 360°. وكل تواصل يُسجَّل تلقائياً في الخط الزمني.',
          'Кнопки «Звонок» и WhatsApp есть в каждой строке лида и в обзоре 360°. Каждый контакт автоматически попадает в таймлайн.',
        ),
        links: [{ label: T('CRM → Leads', 'إدارة العملاء ← العملاء', 'CRM → Лиды'), href: `${FI}/crm/leads` }],
      },
      {
        q: T('How do I move a lead through the pipeline?', 'كيف أحرّك عميلاً عبر خط المبيعات؟', 'Как двигать лид по воронке?'),
        a: T(
          'Drag it across the Board. Dropping it on Closed opens the deal window so the sale is recorded with its commission.',
          'اسحبه عبر اللوحة. إسقاطه على «مغلق» يفتح نافذة الصفقة لتسجيل البيع بعمولته.',
          'Перетащите его по Доске. Бросок на «Закрыто» открывает окно сделки — продажа записывается с комиссией.',
        ),
        flow: 'close-deal',
        links: [{ label: T('CRM → Board', 'إدارة العملاء ← اللوحة', 'CRM → Доска'), href: `${FI}/crm/board` }],
      },
      {
        q: T('What is the FH-#### code on each lead?', 'ما هو الرمز FH-#### على كل عميل؟', 'Что за код FH-#### у каждого лида?'),
        a: T(
          "The lead's permanent serial code — use it in chats and reports so everyone knows exactly which lead you mean.",
          'الرمز التسلسلي الدائم للعميل — استخدمه في المحادثات والتقارير ليعرف الجميع أي عميل تقصد بالضبط.',
          'Постоянный серийный код лида — используйте его в чатах и отчётах, чтобы все точно понимали, о каком лиде речь.',
        ),
      },
      {
        q: T('How do I find duplicate leads?', 'كيف أجد العملاء المكررين؟', 'Как найти дубликаты лидов?'),
        a: T(
          'CRM → Duplicates lists likely matches (same phone/email) so you can merge or dismiss them.',
          'إدارة العملاء ← المكررات تعرض التطابقات المحتملة (نفس الهاتف/البريد) لدمجها أو تجاهلها.',
          'CRM → Дубликаты показывает вероятные совпадения (один телефон/email) — их можно объединить или отклонить.',
        ),
        links: [{ label: T('CRM → Duplicates', 'إدارة العملاء ← المكررات', 'CRM → Дубликаты'), href: `${FI}/crm/duplicates` }],
      },
      {
        q: T("Where is a lead's full history?", 'أين السجل الكامل للعميل؟', 'Где полная история лида?'),
        a: T(
          "Open the lead — the 360° view holds every call, message, note, status change, source page and deal in one timeline.",
          'افتح العميل — العرض الشامل 360° يضم كل مكالمة ورسالة وملاحظة وتغيير حالة وصفحة مصدر وصفقة في خط زمني واحد.',
          'Откройте лид — обзор 360° хранит каждый звонок, сообщение, заметку, смену статуса, страницу-источник и сделку в одном таймлайне.',
        ),
      },
    ],
  },
  {
    id: 'ads',
    title: T('Ads, campaigns & landing pages', 'الإعلانات والحملات وصفحات الهبوط', 'Реклама, кампании и посадочные страницы'),
    Icon: Megaphone,
    items: [
      {
        q: T('What is the Ads Machine and how do I start it?', 'ما هي آلة الإعلانات وكيف أشغّلها؟', 'Что такое Машина рекламы и как её запустить?'),
        a: T(
          'The Ads Machine is the autonomous engine: pick projects from the dropdown, set ONE hard daily cap, and it builds a cross-channel plan (Meta audience trials + Google search), launches with in-ad qualification forms, watches real results, asks your team lead-quality questions, and rotates budget from losers to winners — always inside the cap. Review the plan it shows before you press Start; the dashboard shows what it is doing now and what happens next.',
          'آلة الإعلانات هي المحرك الذاتي: اختر المشاريع من القائمة، وحدد سقفاً يومياً واحداً صارماً، فتبني خطة عبر القنوات (تجارب جماهير ميتا + بحث جوجل)، وتطلق بنماذج تأهيل داخل الإعلان، وتراقب النتائج الحقيقية، وتسأل فريقك عن جودة العملاء، وتنقل الميزانية من الخاسر إلى الرابح — دائماً داخل السقف. راجع الخطة المعروضة قبل الضغط على «ابدأ»؛ وتعرض اللوحة ما تفعله الآن وما التالي.',
          'Машина рекламы — автономный движок: выберите проекты, задайте ОДИН жёсткий дневной лимит — она строит кросс-канальный план (аудитории Meta + поиск Google), запускает с квалификационными формами в объявлении, следит за реальными результатами, задаёт команде вопросы о качестве лидов и переносит бюджет от проигравших к выигравшим — всегда в пределах лимита. Проверьте план перед стартом; дашборд показывает, что она делает сейчас и что дальше.',
        ),
        links: [{ label: T('Open Ads Machine', 'افتح آلة الإعلانات', 'Открыть Машину рекламы'), href: '/freehold-intelligence/lead-machine/ads-machine' }],
        roles: MGMT_MKT,
      },
      {
        q: T('How do I build a Meta instant lead form without going to Ads Manager?', 'كيف أنشئ نموذج عملاء ميتا الفوري دون الذهاب إلى مدير الإعلانات؟', 'Как создать мгновенную лид-форму Meta без Ads Manager?'),
        a: T(
          'Lead Machine → Forms → New form. Five steps by intent: form type (More volume vs Higher intent), introduction from the listing’s real facts, contact details (full prefill catalog + SMS phone verification), qualify-the-buyer questions (budget bands built around the listing’s actual price, timeline, purpose), and after-submit buttons. Start from a ready template — Brochure request, Book a viewing, Investor qualification, Off-plan interest — or duplicate any existing form. Every form auto-carries attribution so its leads reach the CRM tied to their campaign.',
          'ماكينة العملاء ← النماذج ← نموذج جديد. خمس خطوات حسب الهدف: نوع النموذج (حجم أكبر أو نية أعلى)، ومقدمة من حقائق العقار الحقيقية، وبيانات التواصل (كل حقول التعبئة + التحقق من الهاتف برسالة SMS)، وأسئلة تأهيل المشتري (شرائح ميزانية حول سعر العقار الفعلي، الإطار الزمني، الغرض)، وأزرار ما بعد الإرسال. ابدأ من قالب جاهز — طلب بروشور، حجز معاينة، تأهيل مستثمر، اهتمام على الخارطة — أو كرّر أي نموذج قائم. كل نموذج يحمل الإسناد تلقائياً فتصل عملاؤه إلى CRM مرتبطين بحملتهم.',
          'Машина лидов → Формы → Новая форма. Пять шагов по цели: тип формы (больше объёма или выше намерение), введение из реальных фактов объекта, контактные данные (полный каталог полей + SMS-проверка телефона), квалификационные вопросы (диапазоны бюджета вокруг реальной цены, сроки, цель) и кнопки после отправки. Начните с готового шаблона — брошюра, просмотр, квалификация инвестора, интерес к офф-плану — или продублируйте любую форму. Каждая форма несёт атрибуцию: её лиды попадают в CRM со своей кампанией.',
        ),
        links: [{ label: T('Open Forms', 'افتح النماذج', 'Открыть Формы'), href: '/freehold-intelligence/lead-machine/forms' }],
        roles: MGMT_MKT,
      },
      {
        q: T('How do I build and reuse audiences?', 'كيف أبني الجماهير وأعيد استخدامها؟', 'Как создавать и переиспользовать аудитории?'),
        a: T(
          'Ads → Audiences. Search Meta’s live vocabulary for real interests and behaviors (each shows its true segment size), narrow with AND-rules, exclude who you don’t want — or upload a lead list CSV to build a lookalike. Every saved audience attaches to a campaign in one click, and the AI can rank the best match for a listing.',
          'الإعلانات ← الجماهير. ابحث في قاموس ميتا الحي عن اهتمامات وسلوكيات حقيقية (كلٌّ بحجمه الفعلي)، وضيّق بقواعد «و»، واستبعد من لا تريده — أو ارفع ملف CSV بعملائك لبناء جمهور مشابه. كل جمهور محفوظ يُرفق بالحملة بنقرة، ويمكن للذكاء الاصطناعي ترتيب الأنسب لعقارك.',
          'Реклама → Аудитории. Ищите в живом словаре Meta реальные интересы и поведение (у каждого — настоящий размер сегмента), сужайте AND-правилами, исключайте лишних — или загрузите CSV с лидами для lookalike. Любая сохранённая аудитория подключается к кампании в один клик, а ИИ ранжирует лучшую для объекта.',
        ),
        links: [{ label: T('Open Audiences', 'افتح الجماهير', 'Открыть Аудитории'), href: '/freehold-intelligence/lead-machine/audiences' }],
        roles: MGMT_MKT,
      },
      {
        q: T('The project is a new launch with no landing page — can I still run ads?', 'المشروع إطلاق جديد بلا صفحة هبوط — هل أستطيع الإعلان؟', 'Новый запуск без посадочной — можно ли запускать рекламу?'),
        a: T(
          'Yes. On step 1 of campaign setup, add Campaign Sources: upload the brochure/fact sheet (the AI extracts the real facts) or paste the listing/developer link. The ad copy is written from that material, and the landing URL is optional — when empty, the ad points to the project’s public page.',
          'نعم. في الخطوة 1 من إعداد الحملة أضف مصادر الحملة: ارفع البروشور/ورقة الحقائق (يستخرج الذكاء الاصطناعي الحقائق) أو الصق رابط الإعلان أو المطوّر. يُكتب نص الإعلان من هذه المواد، وصفحة الهبوط اختيارية — الفراغ يوجّه الإعلان إلى صفحة المشروع العامة.',
          'Да. На шаге 1 добавьте Источники кампании: загрузите брошюру/фактлист (ИИ извлечёт факты) или вставьте ссылку на листинг/застройщика. Текст объявления пишется из этих материалов, а посадочная необязательна — пустое поле ведёт на публичную страницу проекта.',
        ),
        links: [{ label: T('New campaign', 'حملة جديدة', 'Новая кампания'), href: '/freehold-intelligence/lead-machine/campaigns/new' }],
        roles: MGMT_MKT,
      },
      {
        q: T('Can I see the ad on every placement before launch?', 'هل أرى الإعلان في كل المواضع قبل الإطلاق؟', 'Можно увидеть объявление на всех плейсментах до запуска?'),
        a: T(
          'Yes — on the creative step, “Preview all placements” opens a wall showing your image and copy across Facebook Feed, Instagram Feed, both Stories and Reels.',
          'نعم — في خطوة الإبداع، «معاينة كل المواضع» تفتح جداراً يعرض صورتك ونصك عبر فيسبوك وإنستغرام والقصص وريلز.',
          'Да — на шаге креатива «Все плейсменты» открывает стену: ваша картинка и текст в ленте Facebook, Instagram, Stories и Reels.',
        ),
        roles: MGMT_MKT,
      },
      {
        q: T('What can the AI chat actually DO in ads?', 'ما الذي تستطيع المحادثة فعله حقاً في الإعلانات؟', 'Что чат ИИ реально ДЕЛАЕТ в рекламе?'),
        a: T(
          'Real actions, not advice: analyse a campaign’s live numbers, list its ads with their current copy, EDIT a live ad (headline, text, link, image, CTA), create a Meta lead form that syncs to the CRM, rank your saved audiences for a listing, plan a campaign from your own lead outcomes, and launch it paused. Every action shows as an “Actions taken” chip on the reply.',
          'إجراءات حقيقية لا نصائح: تحليل أرقام الحملة الحية، وسرد إعلاناتها بنصوصها الحالية، وتعديل إعلان مباشر (العنوان، النص، الرابط، الصورة، الزر)، وإنشاء نموذج عملاء ميتا يتزامن مع CRM، وترتيب جماهيرك لعقار، وتخطيط حملة من نتائج عملائك، وإطلاقها متوقفة. كل إجراء يظهر كشارة «الإجراءات المنفَّذة» على الرد.',
          'Реальные действия, а не советы: анализ живых цифр кампании, список её объявлений с текущими текстами, РЕДАКТИРОВАНИЕ живого объявления (заголовок, текст, ссылка, картинка, CTA), создание лид-формы Meta с синхронизацией в CRM, ранжирование аудиторий, план кампании на ваших данных и запуск на паузе. Каждое действие видно чипом «Выполненные действия».',
        ),
        roles: MGMT_MKT,
      },
      {
        q: T('How do I run a Meta lead campaign?', 'كيف أطلق حملة عملاء على Meta؟', 'Как запустить лид-кампанию Meta?'),
        a: T(
          'The wizard walks you from project → creative → budget → launch. Launch paused first — nothing spends until you flip it live.',
          'المعالج يقودك من المشروع ← التصميم ← الميزانية ← الإطلاق. أطلقها متوقفة أولاً — لا يُنفق شيء حتى تفعّلها.',
          'Мастер ведёт от проекта → креатива → бюджета → запуска. Сначала запустите на паузе — деньги не тратятся, пока вы не включите.',
        ),
        flow: 'meta-ad',
      },
      {
        q: T('How do I connect the company Meta ad account?', 'كيف أربط حساب إعلانات Meta الخاص بالشركة؟', 'Как подключить рекламный аккаунт Meta компании?'),
        a: T(
          'Integrations → Meta Ads has the exact steps ("How do I get this?") — create a System User token, paste it, pick the ad account and Page. It\'s validated with Meta before being stored encrypted.',
          'التكاملات ← إعلانات Meta فيها الخطوات الدقيقة («كيف أحصل على هذا؟») — أنشئ رمز مستخدم نظام، الصقه، اختر الحساب الإعلاني والصفحة. يُتحقق منه لدى Meta قبل تخزينه مشفّراً.',
          'В Интеграции → Meta Ads есть точные шаги («Как это получить?») — создайте токен системного пользователя, вставьте его, выберите рекламный аккаунт и Страницу. Он проверяется в Meta перед зашифрованным сохранением.',
        ),
        links: [{ label: T('Integrations → Meta', 'التكاملات ← Meta', 'Интеграции → Meta'), href: `${FI}/integrations/meta` }],
      },
      {
        q: T('I have several ad accounts — how do I pick the active one?', 'لدي عدة حسابات إعلانية — كيف أختار النشط؟', 'У меня несколько рекламных аккаунтов — как выбрать активный?'),
        a: T(
          'On Integrations → Meta Ads every account shows as a card; press "Set active" on the one campaigns should use. The active one wears the gold border.',
          'في التكاملات ← إعلانات Meta يظهر كل حساب كبطاقة؛ اضغط «تعيين نشطاً» على الحساب الذي ستستخدمه الحملات. النشط يحمل الإطار الذهبي.',
          'В Интеграции → Meta Ads каждый аккаунт показан карточкой; нажмите «Сделать активным» на нужном. Активный носит золотую рамку.',
        ),
        links: [{ label: T('Integrations → Meta', 'التكاملات ← Meta', 'Интеграции → Meta'), href: `${FI}/integrations/meta` }],
      },
      {
        q: T('How do I create and publish a landing page?', 'كيف أنشئ صفحة هبوط وأنشرها؟', 'Как создать и опубликовать посадочную страницу?'),
        a: T(
          'Lead Machine → Landing pages → Create. The page is generated from live project data and publishes at /lp/<name>.',
          'ماكينة العملاء ← صفحات الهبوط ← إنشاء. تُولَّد الصفحة من بيانات المشروع الحية وتُنشر على ‎/lp/<الاسم>.',
          'Lead Machine → Посадочные страницы → Создать. Страница собирается из живых данных проекта и публикуется на /lp/<имя>.',
        ),
        flow: 'landing-page',
      },
      {
        q: T('How do I turn a landing page into a campaign?', 'كيف أحوّل صفحة هبوط إلى حملة؟', 'Как превратить посадочную страницу в кампанию?'),
        a: T(
          "Every landing-page row has a Campaign button — it opens the ad builder prefilled with that page as the ad's destination.",
          'كل صف صفحة هبوط فيه زر «حملة» — يفتح منشئ الإعلانات معبأً بهذه الصفحة كوجهة الإعلان.',
          'В каждой строке посадочной страницы есть кнопка «Кампания» — она открывает конструктор рекламы с этой страницей как целью объявления.',
        ),
        flow: 'landing-page',
      },
      {
        q: T('How do I generate ad copy with AI?', 'كيف أولّد نص الإعلان بالذكاء الاصطناعي؟', 'Как сгенерировать рекламный текст с ИИ?'),
        a: T(
          'Lead Machine → Creatives → Generate. AI drafts headlines and copy from the real listing; refine and use it in the campaign builder.',
          'ماكينة العملاء ← التصاميم ← توليد. يكتب الذكاء الاصطناعي العناوين والنصوص من الإعلان الحقيقي؛ حسّنها واستخدمها في منشئ الحملات.',
          'Lead Machine → Креативы → Генерация. ИИ пишет заголовки и тексты из реального листинга; доработайте и используйте в конструкторе кампаний.',
        ),
        flow: 'ai-creative',
      },
      {
        q: T('Can I upload my own ad image?', 'هل يمكنني رفع صورتي الإعلانية؟', 'Могу ли я загрузить своё рекламное изображение?'),
        a: T(
          "Yes — in the campaign wizard's Creative step: keep the property photo, upload your own, and the image is pushed to your Meta ad account on launch.",
          'نعم — في خطوة التصميم داخل معالج الحملة: أبقِ صورة العقار أو ارفع صورتك، وتُرفع الصورة إلى حسابك الإعلاني في Meta عند الإطلاق.',
          'Да — на шаге «Креатив» мастера кампании: оставьте фото объекта или загрузите своё; при запуске изображение отправляется в ваш рекламный аккаунт Meta.',
        ),
        flow: 'meta-ad',
      },
      {
        q: T('How do I run a Google search campaign?', 'كيف أطلق حملة بحث على Google؟', 'Как запустить поисковую кампанию Google?'),
        a: T(
          'Connect Google Ads once, then build the campaign: project, keywords, budget — AI drafts the ad text.',
          'اربط Google Ads مرة واحدة ثم ابنِ الحملة: المشروع والكلمات المفتاحية والميزانية — والذكاء الاصطناعي يكتب نص الإعلان.',
          'Подключите Google Ads один раз, затем соберите кампанию: проект, ключевые слова, бюджет — текст объявления пишет ИИ.',
        ),
        flow: 'google-ad',
      },
      {
        q: T('Where do I watch spend and leads in real time?', 'أين أتابع الإنفاق والعملاء مباشرة؟', 'Где смотреть расходы и лиды в реальном времени?'),
        a: T(
          "Ads → Live. The green light up top means a platform is genuinely connected — the numbers are your real account's.",
          'الإعلانات ← مباشر. الضوء الأخضر أعلى الصفحة يعني أن منصة متصلة فعلاً — والأرقام أرقام حسابك الحقيقي.',
          'Реклама → Live. Зелёный индикатор сверху означает, что платформа действительно подключена — цифры из вашего реального аккаунта.',
        ),
        links: [{ label: T('Ads Live', 'الإعلانات المباشرة', 'Живая реклама'), href: `${FI}/ads-live` }],
      },
      {
        q: T('Why does Ads Live say "Not connected"?', 'لماذا تقول «الإعلانات المباشرة» غير متصل؟', 'Почему в Ads Live написано «Не подключено»?'),
        a: T(
          'No ad platform is connected yet. Connect Meta or Google in Integrations and the live numbers appear; campaigns built before connecting are kept as drafts.',
          'لا توجد منصة إعلانية متصلة بعد. اربط Meta أو Google في التكاملات وستظهر الأرقام الحية؛ الحملات المُنشأة قبل الربط تبقى كمسودات.',
          'Ни одна рекламная платформа ещё не подключена. Подключите Meta или Google в Интеграциях — появятся живые цифры; кампании, созданные до подключения, сохраняются как черновики.',
        ),
        links: [{ label: T('Integrations', 'التكاملات', 'Интеграции'), href: `${FI}/integrations` }],
      },
      {
        q: T('How do I pause or resume a campaign?', 'كيف أوقف حملة أو أستأنفها؟', 'Как поставить кампанию на паузу или возобновить?'),
        a: T(
          'Open the campaign from Ads Live or Lead Machine → Campaigns — Pause / Resume acts on the real platform campaign.',
          'افتح الحملة من الإعلانات المباشرة أو ماكينة العملاء ← الحملات — الإيقاف / الاستئناف يعمل على الحملة الحقيقية في المنصة.',
          'Откройте кампанию из Ads Live или Lead Machine → Кампании — Пауза / Возобновить действуют на реальную кампанию платформы.',
        ),
        links: [{ label: T('Campaigns', 'الحملات', 'Кампании'), href: `${FI}/lead-machine/campaigns` }],
      },
      {
        q: T('Where do leads from my ads go?', 'أين تذهب عملاء إعلاناتي؟', 'Куда попадают лиды из моей рекламы?'),
        a: T(
          'Straight into CRM → Inbox with the campaign and page attached — no exports, no copy-paste.',
          'مباشرة إلى إدارة العملاء ← الوارد ومعها الحملة والصفحة — بلا تصدير ولا نسخ ولصق.',
          'Прямо в CRM → Входящие с прикреплённой кампанией и страницей — без экспортов и копипаста.',
        ),
        links: [{ label: T('CRM → Inbox', 'إدارة العملاء ← الوارد', 'CRM → Входящие'), href: `${FI}/crm/inbox` }],
      },
    ],
  },
  {
    id: 'inventory',
    title: T('Inventory & projects', 'المخزون والمشاريع', 'Инвентарь и проекты'),
    Icon: Package,
    items: [
      {
        q: T('Where do I see all projects?', 'أين أرى كل المشاريع؟', 'Где посмотреть все проекты?'),
        a: T(
          'Inventory → Projects — every project with its data-quality and ad-readiness scores.',
          'المخزون ← المشاريع — كل مشروع مع درجتي جودة البيانات وجاهزية الإعلان.',
          'Инвентарь → Проекты — каждый проект с оценками качества данных и готовности к рекламе.',
        ),
        links: [{ label: T('Inventory → Projects', 'المخزون ← المشاريع', 'Инвентарь → Проекты'), href: `${FI}/inventory/projects` }],
      },
      {
        q: T('How do I advertise a project?', 'كيف أعلن عن مشروع؟', 'Как рекламировать проект?'),
        a: T(
          'Open the project and start a campaign from it, or go straight to the campaign wizard — picking the project fills in the name, photo, price and landing page.',
          'افتح المشروع وابدأ حملة منه، أو اذهب مباشرة إلى معالج الحملات — اختيار المشروع يملأ الاسم والصورة والسعر وصفحة الهبوط.',
          'Откройте проект и запустите кампанию из него, или сразу в мастер кампаний — выбор проекта подставит название, фото, цену и посадочную страницу.',
        ),
        flow: 'advertise-project',
      },
      {
        q: T('What do the data-quality scores mean?', 'ماذا تعني درجات جودة البيانات؟', 'Что означают оценки качества данных?'),
        a: T(
          "They grade how complete a project's data is (photos, prices, payment plan…). High scores make better ads and landing pages; the Data quality page shows exactly what's missing.",
          'تقيّم اكتمال بيانات المشروع (صور، أسعار، خطة دفع…). الدرجات العالية تصنع إعلانات وصفحات هبوط أفضل؛ وصفحة جودة البيانات تعرض بالضبط ما الناقص.',
          'Они оценивают полноту данных проекта (фото, цены, план оплаты…). Высокие оценки дают лучшую рекламу и страницы; страница «Качество данных» показывает, чего именно не хватает.',
        ),
        links: [{ label: T('Data quality', 'جودة البيانات', 'Качество данных'), href: `${FI}/inventory/data-quality` }],
      },
    ],
  },
  {
    id: 'finance',
    title: T('Deals, commission & finance', 'الصفقات والعمولات والمالية', 'Сделки, комиссии и финансы'),
    Icon: DollarSign,
    items: [
      {
        q: T('How do I record a deal?', 'كيف أسجّل صفقة؟', 'Как записать сделку?'),
        a: T(
          'Close the lead on the CRM board (the deal window opens itself), or add it manually in Management → Deals — project and broker autofill.',
          'أغلق العميل على لوحة إدارة العملاء (تفتح نافذة الصفقة تلقائياً)، أو أضفها يدوياً في الإدارة ← الصفقات — المشروع والوسيط يُملآن تلقائياً.',
          'Закройте лид на доске CRM (окно сделки откроется само) или добавьте вручную в Менеджмент → Сделки — проект и брокер заполнятся сами.',
        ),
        flow: 'commission',
        roles: MGMT,
      },
      {
        q: T('How is commission split?', 'كيف تُقسَّم العمولة؟', 'Как делится комиссия?'),
        a: T(
          'The waterfall on each deal: agency commission → referral & cashback → expenses & growth fund → broker payout → company net. Finance rolls all approved deals into company totals.',
          'الشلال على كل صفقة: عمولة الوكالة ← الإحالة والكاش باك ← المصاريف وصندوق النمو ← مستحقات الوسيط ← صافي الشركة. والمالية تجمع كل الصفقات المعتمدة في إجماليات الشركة.',
          'Водопад на каждой сделке: комиссия агентства → реферал и кэшбэк → расходы и фонд роста → выплата брокеру → чистое компании. Финансы сводят все одобренные сделки в итоги компании.',
        ),
        links: [{ label: T('Finance', 'المالية', 'Финансы'), href: `${FI}/finance` }],
      },
      {
        q: T('How does deal approval work?', 'كيف يعمل اعتماد الصفقات؟', 'Как работает одобрение сделок?'),
        a: T(
          'Two steps: the deal is submitted, management approves it, and only then does it count in Finance. Pending deals are clearly marked.',
          'خطوتان: تُقدَّم الصفقة، تعتمدها الإدارة، وعندها فقط تُحتسب في المالية. الصفقات المعلقة معلّمة بوضوح.',
          'Два шага: сделка подаётся, менеджмент одобряет, и только тогда она учитывается в Финансах. Ожидающие сделки чётко помечены.',
        ),
        links: [{ label: T('Management → Deals', 'الإدارة ← الصفقات', 'Менеджмент → Сделки'), href: `${FI}/management/deals` }],
        roles: MGMT,
      },
      {
        q: T('How do I give an agent ad credits?', 'كيف أمنح وسيطاً رصيداً إعلانياً؟', 'Как выдать агенту рекламные кредиты?'),
        a: T(
          'Finance → Credits — pick the agent, set the amount, apply. Their available balance updates immediately.',
          'المالية ← الأرصدة — اختر الوسيط، حدد المبلغ، طبّق. رصيده المتاح يتحدث فوراً.',
          'Финансы → Кредиты — выберите агента, задайте сумму, примените. Его доступный баланс обновится сразу.',
        ),
        links: [{ label: T('Finance → Credits', 'المالية ← الأرصدة', 'Финансы → Кредиты'), href: `${FI}/finance/credits` }],
        roles: MGMT,
      },
      {
        q: T('Where do I pay out broker commissions?', 'أين أدفع عمولات الوسطاء؟', 'Где выплачивать комиссии брокерам?'),
        a: T(
          'Finance → Payments lists every outstanding payout per broker with a one-tap record-payment action.',
          'المالية ← المدفوعات تعرض كل مستحق غير مدفوع لكل وسيط مع زر تسجيل دفعة بنقرة واحدة.',
          'Финансы → Платежи показывают каждую невыплаченную сумму по брокеру с записью платежа в один тап.',
        ),
        links: [{ label: T('Finance → Payments', 'المالية ← المدفوعات', 'Финансы → Платежи'), href: `${FI}/finance/payments` }],
        roles: MGMT,
      },
    ],
  },
  {
    id: 'team',
    title: T('Team & management', 'الفريق والإدارة', 'Команда и менеджмент'),
    Icon: Settings,
    items: [
      {
        q: T('How do I add a team member?', 'كيف أضيف عضواً للفريق؟', 'Как добавить участника команды?'),
        a: T(
          'Settings → Team — add them with a role (broker, marketing, management). The role decides exactly which apps they see.',
          'الإعدادات ← الفريق — أضفه بدور (وسيط، تسويق، إدارة). الدور يحدد بالضبط أي التطبيقات يرى.',
          'Настройки → Команда — добавьте с ролью (брокер, маркетинг, менеджмент). Роль решает, какие приложения он видит.',
        ),
        flow: 'invite-user',
        roles: MGMT,
      },
      {
        q: T('How do I control what someone can see?', 'كيف أتحكم فيما يراه كل شخص؟', 'Как управлять тем, что видит человек?'),
        a: T(
          'Roles do it: brokers see their workspace and CRM; marketing sees ads; management sees everything. Adjust in Settings → Roles.',
          'الأدوار تتكفل بذلك: الوسطاء يرون مساحتهم وإدارة العملاء؛ التسويق يرى الإعلانات؛ الإدارة ترى كل شيء. عدّل في الإعدادات ← الأدوار.',
          'Это делают роли: брокеры видят своё пространство и CRM; маркетинг — рекламу; менеджмент — всё. Настройте в Настройки → Роли.',
        ),
        links: [{ label: T('Settings → Roles', 'الإعدادات ← الأدوار', 'Настройки → Роли'), href: `${FI}/settings/roles` }],
        roles: MGMT,
      },
      {
        q: T('Can leads route to brokers automatically?', 'هل يمكن توجيه العملاء للوسطاء تلقائياً؟', 'Могут ли лиды распределяться брокерам автоматически?'),
        a: T(
          'Yes — Settings → Automation: rules by source, project or round-robin with capacity limits. Manual assignment always stays available.',
          'نعم — الإعدادات ← الأتمتة: قواعد حسب المصدر أو المشروع أو بالتناوب مع حدود الطاقة. والإسناد اليدوي يبقى متاحاً دائماً.',
          'Да — Настройки → Автоматизация: правила по источнику, проекту или по кругу с лимитами загрузки. Ручное назначение всегда доступно.',
        ),
        links: [{ label: T('Settings → Automation', 'الإعدادات ← الأتمتة', 'Настройки → Автоматизация'), href: `${FI}/settings/automation` }],
        roles: MGMT,
      },
      {
        q: T("Where is a broker's full profile?", 'أين الملف الكامل للوسيط؟', 'Где полный профиль брокера?'),
        a: T(
          'Management → Team → open the broker: contact, leads, deals, commission — the complete record in one place.',
          'الإدارة ← الفريق ← افتح الوسيط: التواصل والعملاء والصفقات والعمولة — السجل الكامل في مكان واحد.',
          'Менеджмент → Команда → откройте брокера: контакты, лиды, сделки, комиссия — полная запись в одном месте.',
        ),
        links: [{ label: T('Management → Team', 'الإدارة ← الفريق', 'Менеджмент → Команда'), href: `${FI}/management/team` }],
        roles: MGMT,
      },
    ],
  },
  {
    id: 'analytics',
    title: T('Analytics & reporting', 'التحليلات والتقارير', 'Аналитика и отчёты'),
    Icon: TrendingUp,
    items: [
      {
        q: T('How do I see company performance?', 'كيف أرى أداء الشركة؟', 'Как посмотреть показатели компании?'),
        a: T(
          'Analytics opens on the Company lens — live leads, deals, spend and revenue from real records.',
          'التحليلات تفتح على عدسة الشركة — عملاء وصفقات وإنفاق وإيرادات حية من سجلات حقيقية.',
          'Аналитика открывается на линзе «Компания» — живые лиды, сделки, расходы и выручка из реальных записей.',
        ),
        flow: 'team-performance',
        roles: MGMT_MKT,
      },
      {
        q: T("How do I see one person's numbers?", 'كيف أرى أرقام شخص واحد؟', 'Как посмотреть цифры одного человека?'),
        a: T(
          'Analytics → Team → open the member: leads handled, response times, deals closed, commission earned.',
          'التحليلات ← الفريق ← افتح العضو: العملاء وأزمنة الاستجابة والصفقات المغلقة والعمولة المكتسبة.',
          'Аналитика → Команда → откройте участника: лиды, скорость ответа, закрытые сделки, заработанная комиссия.',
        ),
        links: [{ label: T('Analytics → Team', 'التحليلات ← الفريق', 'Аналитика → Команда'), href: `${FI}/analytics/team` }],
        roles: MGMT_MKT,
      },
      {
        q: T('Which campaigns bring the best leads?', 'أي الحملات تجلب أفضل العملاء؟', 'Какие кампании приводят лучших лидов?'),
        a: T(
          'Analytics → Marketing breaks performance down by campaign and landing page — spend, leads, cost per lead, conversions.',
          'التحليلات ← التسويق تفصّل الأداء حسب الحملة وصفحة الهبوط — الإنفاق والعملاء وتكلفة العميل والتحويلات.',
          'Аналитика → Маркетинг раскладывает результаты по кампаниям и посадочным страницам — расход, лиды, цена лида, конверсии.',
        ),
        links: [{ label: T('Analytics → Marketing', 'التحليلات ← التسويق', 'Аналитика → Маркетинг'), href: `${FI}/analytics/marketing` }],
        roles: MGMT_MKT,
      },
    ],
  },
  {
    id: 'integrations',
    title: T('Integrations', 'التكاملات', 'Интеграции'),
    Icon: ShieldCheck,
    items: [
      {
        q: T('How do I connect WhatsApp Business?', 'كيف أربط واتساب للأعمال؟', 'Как подключить WhatsApp Business?'),
        a: T(
          'Integrations → WhatsApp — paste your Phone number ID and a permanent token; the page\'s "How do I get this?" steps show exactly where to find both.',
          'التكاملات ← واتساب — الصق معرّف رقم الهاتف ورمزاً دائماً؛ وخطوات «كيف أحصل على هذا؟» في الصفحة تريك بالضبط أين تجد الاثنين.',
          'Интеграции → WhatsApp — вставьте Phone number ID и постоянный токен; шаги «Как это получить?» на странице показывают, где найти оба.',
        ),
        links: [{ label: T('Integrations → WhatsApp', 'التكاملات ← واتساب', 'Интеграции → WhatsApp'), href: `${FI}/integrations/whatsapp` }],
      },
      {
        q: T('How do I connect HubSpot — and control the sync direction?', 'كيف أربط HubSpot — وأتحكم في اتجاه المزامنة؟', 'Как подключить HubSpot и управлять направлением синхронизации?'),
        a: T(
          'Integrations → HubSpot: paste a Private App token, then choose Push (Freehold → HubSpot), Pull, or Both. Each run reports exactly how many contacts moved.',
          'التكاملات ← HubSpot: الصق رمز تطبيق خاص ثم اختر دفع (Freehold ← HubSpot) أو سحب أو الاثنين. وكل تشغيل يبلغ بالضبط كم جهة اتصال انتقلت.',
          'Интеграции → HubSpot: вставьте токен Private App, затем выберите Push (Freehold → HubSpot), Pull или Оба. Каждый запуск сообщает, сколько контактов перенесено.',
        ),
        links: [{ label: T('Integrations → HubSpot', 'التكاملات ← HubSpot', 'Интеграции → HubSpot'), href: `${FI}/integrations/hubspot` }],
      },
      {
        q: T('How do I connect Google Ads?', 'كيف أربط Google Ads؟', 'Как подключить Google Ads?'),
        a: T(
          'Integrations → Google Ads needs five values; the in-page guide walks through each one (developer token, OAuth client, refresh token, customer ID).',
          'التكاملات ← Google Ads تحتاج خمس قيم؛ والدليل داخل الصفحة يشرح كل واحدة (رمز المطوّر، عميل OAuth، رمز التحديث، معرّف العميل).',
          'Интеграции → Google Ads требуют пять значений; встроенный гид проводит по каждому (токен разработчика, OAuth-клиент, refresh token, customer ID).',
        ),
        links: [{ label: T('Integrations → Google', 'التكاملات ← Google', 'Интеграции → Google'), href: `${FI}/integrations/google` }],
      },
      {
        q: T('Are my tokens and keys safe?', 'هل رموزي ومفاتيحي آمنة؟', 'Мои токены и ключи в безопасности?'),
        a: T(
          'Every credential is validated live with the provider before saving, stored encrypted (AES-256), and never displayed again — pages only ever show that a connection exists.',
          'كل بيانات اعتماد تُتحقق مباشرة لدى المزود قبل الحفظ، وتُخزَّن مشفّرة (AES-256)، ولا تُعرض مجدداً أبداً — الصفحات تعرض فقط وجود اتصال.',
          'Каждый ключ проверяется у провайдера перед сохранением, хранится зашифрованным (AES-256) и никогда больше не показывается — страницы показывают лишь факт подключения.',
        ),
      },
      {
        q: T('Can I connect everything myself, without a developer?', 'هل أستطيع ربط كل شيء بنفسي دون مطوّر؟', 'Могу ли я подключить всё сам, без разработчика?'),
        a: T(
          'Yes — that\'s the point. Every integration page has numbered "How do I get this?" steps written for non-technical users, and the Save button verifies your values before storing them.',
          'نعم — هذا هو المقصود. كل صفحة تكامل فيها خطوات مرقّمة «كيف أحصل على هذا؟» مكتوبة لغير التقنيين، وزر الحفظ يتحقق من قيمك قبل تخزينها.',
          'Да — в этом и смысл. На каждой странице интеграции есть пронумерованные шаги «Как это получить?» для нетехнических пользователей, а кнопка сохранения проверяет значения перед записью.',
        ),
        links: [{ label: T('All integrations', 'كل التكاملات', 'Все интеграции'), href: `${FI}/integrations` }],
      },
    ],
  },
  {
    id: 'broker',
    title: T('My Workspace (brokers)', 'مساحتي (للوسطاء)', 'Моё пространство (брокерам)'),
    Icon: UserCircle,
    items: [
      {
        q: T('How do I set up my Bio Link?', 'كيف أجهّز رابطي التعريفي؟', 'Как настроить мой био-линк?'),
        a: T(
          'My Workspace → Bio Link: photo, contact buttons, featured projects — then share the link or QR in your Instagram / WhatsApp bio. Form fills become YOUR leads automatically.',
          'مساحتي ← الرابط التعريفي: صورة وأزرار تواصل ومشاريع مميزة — ثم شارك الرابط أو QR في سيرة إنستغرام / واتساب. تعبئات النموذج تصبح عملاءك أنت تلقائياً.',
          'Моё пространство → Био-линк: фото, кнопки связи, избранные проекты — затем поделитесь ссылкой или QR в био Instagram / WhatsApp. Заполнения формы автоматически становятся ВАШИМИ лидами.',
        ),
        flow: 'bio-link',
        roles: ['broker'],
      },
      {
        q: T('Where are my leads?', 'أين عملائي؟', 'Где мои лиды?'),
        a: T(
          'My Workspace → Leads shows only yours — assigned to you or captured by your bio page.',
          'مساحتي ← العملاء تعرض عملاءك فقط — المُسندين إليك أو الملتقطين من صفحتك التعريفية.',
          'Моё пространство → Лиды показывает только ваши — назначенные вам или пойманные вашей био-страницей.',
        ),
        links: [{ label: T('My leads', 'عملائي', 'Мои лиды'), href: `${FI}/agent/leads` }],
        roles: ['broker'],
      },
      {
        q: T('Where do I see my commission?', 'أين أرى عمولتي؟', 'Где посмотреть мою комиссию?'),
        a: T(
          'My Workspace → Account: gross, received and outstanding commission from your real deals.',
          'مساحتي ← الحساب: العمولة الإجمالية والمستلمة والمستحقة من صفقاتك الحقيقية.',
          'Моё пространство → Аккаунт: общая, полученная и невыплаченная комиссия из ваших реальных сделок.',
        ),
        links: [{ label: T('My account', 'حسابي', 'Мой аккаунт'), href: `${FI}/agent/account` }],
        roles: ['broker'],
      },
    ],
  },
]

// Page chrome — trilingual, selected by the active locale.
const UI = {
  eyebrow: T('Help & guide', 'المساعدة والدليل', 'Справка и руководство'),
  title: T('The whole system, question by question', 'النظام كاملاً، سؤالاً بسؤال', 'Вся система, вопрос за вопросом'),
  intro1: T('Every answer can take you by the hand — press ', 'كل إجابة يمكنها أن تأخذ بيدك — اضغط ', 'Каждый ответ может взять вас за руку — нажмите '),
  introBtn: T('Guide me', '«أرشدني»', '«Проведи меня»'),
  intro2: T(
    ' and the coach walks you through the real screens, where you do the real thing (create it, not just read about it).',
    ' وسيمشي المدرب معك عبر الشاشات الحقيقية حيث تفعل الشيء بنفسك (تنشئه، لا تقرأ عنه فقط).',
    ' — и коуч проведёт вас по настоящим экранам, где вы делаете всё сами (создаёте, а не просто читаете).',
  ),
  searchPlaceholder: T('Search every question — or ask anything…', 'ابحث في كل الأسئلة — أو اسأل أي شيء…', 'Ищите по всем вопросам — или спросите что угодно…'),
  matches: T('answers below', 'إجابة أدناه', 'ответ(ов) ниже'),
  noBuiltIn: T('No built-in answer for that yet', 'لا إجابة جاهزة لهذا بعد', 'Готового ответа на это пока нет'),
  askAi: T('Ask the AI guide', 'اسأل المرشد الذكي', 'Спросить ИИ-гида'),
  aiTitle: T('AI guide', 'المرشد الذكي', 'ИИ-гид'),
  openPage: T('Open the page', 'افتح الصفحة', 'Открыть страницу'),
  aiNote: T(
    'AI-generated from the live system map — the built-in answers above are the fully guided ones.',
    'مولَّد بالذكاء الاصطناعي من خريطة النظام الحية — الإجابات الجاهزة أعلاه هي المرشَدة بالكامل.',
    'Сгенерировано ИИ по живой карте системы — встроенные ответы выше полностью сопровождаются гидом.',
  ),
  aiError: T('Could not reach the guide', 'تعذّر الوصول إلى المرشد', 'Не удалось связаться с гидом'),
  essentialsTitle: T('Start here — the essentials', 'ابدأ من هنا — الأساسيات', 'Начните здесь — основное'),
  essentialsSub: T(
    'The most important tasks, the same for everyone. Tick them off as you go — your progress follows you to any device.',
    'أهم المهام، نفسها للجميع. علّمها عند إنجازها — ويتبعك تقدّمك على أي جهاز.',
    'Самые важные задачи, одинаковые для всех. Отмечайте по мере выполнения — прогресс следует за вами на любом устройстве.',
  ),
  essentialsDone: T('done', 'مكتملة', 'готово'),
  essentialsAllDone: T('All essentials done — nice work.', 'اكتملت كل الأساسيات — عمل رائع.', 'Все основы пройдены — отличная работа.'),
  markDone: T('Mark done', 'تعليم كمكتمل', 'Отметить'),
  markNotDone: T('Mark not done', 'إلغاء الإكمال', 'Снять отметку'),
  walkthroughs: T('Guided walkthroughs', 'الجولات الإرشادية', 'Пошаговые гиды'),
  walkthroughsNote: T(
    'Each one moves through the real pages with you — you can act on every step.',
    'كل جولة تتنقل معك عبر الصفحات الحقيقية — ويمكنك التنفيذ في كل خطوة.',
    'Каждый гид идёт с вами по настоящим страницам — на каждом шаге можно действовать.',
  ),
  guideMe: T('Guide me step by step', 'أرشدني خطوة بخطوة', 'Проведи меня шаг за шагом'),
  noMatchCard: T(
    'No built-in answer matches — ask the AI guide above and it will build the steps for you.',
    'لا إجابة جاهزة تطابق سؤالك — اسأل المرشد الذكي أعلاه وسيبني لك الخطوات.',
    'Готовый ответ не найден — спросите ИИ-гида выше, и он соберёт шаги для вас.',
  ),
}

interface AiStep { title: string; detail: string; path?: string }

export default function HelpPage() {
  const { t, locale } = useI18n()
  const coach = useCoach()
  const { user } = useSession()
  const role = user?.role

  const L = (s: L10n) => s[locale as 'en' | 'ar' | 'ru'] ?? s.en

  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiAnswer, setAiAnswer] = useState<{ answer: string; steps: AiStep[] } | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)

  const flows = useMemo(() => howtosForRole(role), [role])
  const flowById = useMemo(() => new Map(flows.map((f) => [f.id, f] as [string, HowToFlow])), [flows])

  // The shared "Start here" essentials — same for everyone, universal flows only.
  const essentials = useMemo(
    () => ESSENTIAL_HOWTOS.map((id) => flowById.get(id)).filter((f): f is HowToFlow => !!f),
    [flowById],
  )
  // Completion ticks persist on the ACCOUNT (follow the user to any device).
  const [done, setDone] = useState<Set<string>>(new Set())
  useEffect(() => {
    loadAccountMemory()
      .then((m) => {
        const raw = (m as Record<string, unknown>)[ESSENTIALS_PREF_KEY]
        if (Array.isArray(raw)) setDone(new Set(raw.filter((x): x is string => typeof x === 'string')))
      })
      .catch(() => {})
  }, [])
  function toggleDone(id: string) {
    setDone((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveAccountMemory({ [ESSENTIALS_PREF_KEY]: [...next] })
      return next
    })
  }
  const doneCount = essentials.reduce((n, f) => n + (done.has(f.id) ? 1 : 0), 0)

  // Role-filtered sections; search filters across question + answer text in
  // the ACTIVE language (plus English as a fallback net).
  const visibleSections = useMemo(() => {
    const q = query.trim().toLowerCase()
    return SECTIONS.map((s) => ({
      ...s,
      items: s.items.filter((it) => {
        if (it.roles && (!role || !it.roles.includes(role))) return false
        if (!q) return true
        return (
          L(it.q).toLowerCase().includes(q) || L(it.a).toLowerCase().includes(q) ||
          it.q.en.toLowerCase().includes(q) || it.a.en.toLowerCase().includes(q)
        )
      }),
    })).filter((s) => s.items.length > 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, role, locale])

  const matchCount = visibleSections.reduce((n, s) => n + s.items.length, 0)

  async function askAi() {
    const question = query.trim()
    if (!question || aiLoading) return
    setAiLoading(true)
    setAiError(null)
    setAiAnswer(null)
    try {
      const res = await fetch('/api/freehold/help/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || L(UI.aiError))
      setAiAnswer({ answer: data.answer || '', steps: Array.isArray(data.steps) ? data.steps : [] })
    } catch (err) {
      setAiError(err instanceof Error ? err.message : L(UI.aiError))
    } finally {
      setAiLoading(false)
    }
  }

  function GuideButton({ flowId }: { flowId: string }) {
    const flow = flowById.get(flowId)
    if (!flow) return null
    return (
      <button
        onClick={() => coach.startHowTo(flowId)}
        className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:opacity-90"
      >
        <Play className="h-3 w-3" /> {L(UI.guideMe)}
      </button>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-8 sm:px-8">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold/85">
        <BookOpen className="h-4 w-4" /> {L(UI.eyebrow)}
      </div>
      <h1 className="mt-3 text-[28px] font-semibold tracking-tight text-white">{L(UI.title)}</h1>
      <p className="mt-1 max-w-[58ch] text-sm text-slate-400">
        {L(UI.intro1)}<b className="text-slate-200">{L(UI.introBtn)}</b>{L(UI.intro2)}
      </p>

      {/* Search + AI ask */}
      <div className="sticky top-16 z-30 -mx-2 mt-6 rounded-2xl border border-line bg-surface/95 p-2 backdrop-blur">
        <div className="relative">
          <Search className="absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setAiAnswer(null); setAiError(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter' && matchCount === 0) askAi() }}
            placeholder={L(UI.searchPlaceholder)}
            className="w-full rounded-xl border border-line bg-surface-2 py-2.5 ps-10 pe-4 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition focus:border-gold/50"
          />
        </div>
        {query.trim() && (
          <div className="flex items-center justify-between gap-3 px-2 pt-2 pb-1">
            <span className="text-xs text-slate-500">
              {matchCount > 0 ? `${matchCount} ${L(UI.matches)}` : L(UI.noBuiltIn)}
            </span>
            <button
              onClick={askAi}
              disabled={aiLoading}
              className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-60"
            >
              {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {L(UI.askAi)}
            </button>
          </div>
        )}
      </div>

      {/* AI answer */}
      {aiError && (
        <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/[0.05] px-4 py-3 text-sm text-red-300">{aiError}</div>
      )}
      {aiAnswer && (
        <div className="mt-4 rounded-2xl border border-gold/25 bg-gold/[0.04] p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold">
            <Sparkles className="h-3.5 w-3.5" /> {L(UI.aiTitle)}
          </div>
          {aiAnswer.answer && <p className="mt-2 text-sm leading-relaxed text-slate-200">{aiAnswer.answer}</p>}
          {aiAnswer.steps.length > 0 && (
            <ol className="mt-3 space-y-2.5">
              {aiAnswer.steps.map((s, i) => (
                <li key={i} className="flex gap-3 rounded-xl border border-line bg-surface p-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gold/15 text-xs font-bold text-gold">{i + 1}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">{s.title}</div>
                    {s.detail && <p className="mt-0.5 text-[13px] leading-relaxed text-slate-400">{s.detail}</p>}
                    {s.path && (
                      <Link href={s.path} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-gold hover:opacity-80">
                        {L(UI.openPage)} <ArrowRight className="h-3 w-3 rtl:rotate-180" />
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-3 text-[11px] text-slate-500">{L(UI.aiNote)}</p>
        </div>
      )}

      {/* Start here — the essentials (shared do-it-yourself checklist) */}
      {!query.trim() && essentials.length > 0 && (
        <section className="mt-8 rounded-2xl border border-gold/25 bg-gold/[0.04] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gold/90">
              <Rocket className="h-4 w-4" /> {L(UI.essentialsTitle)}
            </h2>
            <span className="text-xs font-medium tabular-nums text-slate-400">
              {doneCount} / {essentials.length} {L(UI.essentialsDone)}
            </span>
          </div>
          <p className="mt-1 max-w-[58ch] text-xs text-slate-400">{L(UI.essentialsSub)}</p>
          {/* Progress bar */}
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gold transition-all"
              style={{ width: `${Math.round((doneCount / essentials.length) * 100)}%` }}
            />
          </div>
          <ol className="mt-4 space-y-2">
            {essentials.map((flow, i) => {
              const isDone = done.has(flow.id)
              return (
                <li
                  key={flow.id}
                  className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3"
                >
                  <button
                    onClick={() => toggleDone(flow.id)}
                    aria-label={isDone ? L(UI.markNotDone) : L(UI.markDone)}
                    className="shrink-0 text-gold transition hover:opacity-80"
                  >
                    {isDone ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5 text-slate-500" />}
                  </button>
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/[0.06] text-xs font-bold text-slate-400">
                    {i + 1}
                  </span>
                  <span className={`min-w-0 flex-1 text-sm font-medium ${isDone ? 'text-slate-500 line-through' : 'text-slate-100'}`}>
                    {t(flow.titleKey)}
                  </span>
                  <button
                    onClick={() => coach.startHowTo(flow.id)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gold px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:opacity-90"
                  >
                    <Play className="h-3 w-3" /> {L(UI.guideMe)}
                  </button>
                </li>
              )
            })}
          </ol>
          {doneCount === essentials.length && (
            <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-gold">
              <CheckCircle2 className="h-3.5 w-3.5" /> {L(UI.essentialsAllDone)}
            </p>
          )}
        </section>
      )}

      {/* Guided walkthroughs strip */}
      {!query.trim() && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
            <Compass className="h-4 w-4" /> {L(UI.walkthroughs)}
          </h2>
          <div className="flex flex-wrap gap-2">
            {flows.map((flow) => (
              <button
                key={flow.id}
                onClick={() => coach.startHowTo(flow.id)}
                className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/[0.06] px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-gold/[0.14]"
              >
                <Play className="h-3.5 w-3.5 text-gold" /> {t(flow.titleKey)}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">{L(UI.walkthroughsNote)}</p>
        </section>
      )}

      {/* Q&A — department by department */}
      {visibleSections.map((section) => (
        <section key={section.id} className="mt-10">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
            <section.Icon className="h-4 w-4" /> {L(section.title)}
          </h2>
          <div className="space-y-2">
            {section.items.map((item) => {
              const id = `${section.id}:${item.q.en}`
              const open = openId === id
              return (
                <div key={id} className="overflow-hidden rounded-2xl border border-line bg-surface">
                  <button
                    onClick={() => setOpenId(open ? null : id)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-start transition hover:bg-white/[0.03]"
                  >
                    <span className="flex-1 text-sm font-medium text-slate-100">{L(item.q)}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && (
                    <div className="border-t border-line px-4 py-3.5">
                      <p className="text-[13.5px] leading-relaxed text-slate-300">{L(item.a)}</p>
                      {(item.flow || item.links?.length) && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {item.flow && <GuideButton flowId={item.flow} />}
                          {item.links?.map((l) => (
                            <Link key={l.href} href={l.href}
                              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3.5 py-1.5 text-xs text-slate-200 transition hover:border-gold/40 hover:text-white">
                              <Link2 className="h-3 w-3 text-gold" /> {L(l.label)}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ))}

      {/* Nothing matched at all */}
      {query.trim() && matchCount === 0 && !aiAnswer && !aiLoading && (
        <div className="mt-8 rounded-2xl border border-line bg-surface px-5 py-6 text-center">
          <p className="text-sm text-slate-400">{L(UI.noMatchCard)}</p>
        </div>
      )}
    </div>
  )
}
