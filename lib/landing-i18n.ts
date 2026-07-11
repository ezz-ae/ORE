// Trilingual (EN / AR / RU) support for the public landing page at
// app/lp/[slug]/page.tsx.
//
// Two concerns live here:
//   1. LP_CHROME — a static dictionary for every inline hardcoded English UI
//      label in the page (eyebrows, headings, buttons, footer, form, etc.).
//   2. translateLandingContent — a live, cached, single-call Gemini translation
//      of the DYNAMIC content (title/subtitle/cta + section data + amenities +
//      faqs). Honest fallback: on any failure it returns the original English
//      page so the visitor never sees blank/partial content.

import { geminiGenerate } from "@/lib/gemini-rest"
import type { LandingPageData } from "@/lib/landing-pages"

export type LpLang = "en" | "ar" | "ru"

export function normalizeLpLang(v: unknown): LpLang {
  const raw = Array.isArray(v) ? v[0] : v
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : ""
  if (s === "ar" || s.startsWith("ar")) return "ar"
  if (s === "ru" || s.startsWith("ru")) return "ru"
  return "en"
}

export function lpDir(lang: LpLang): "rtl" | "ltr" {
  return lang === "ar" ? "rtl" : "ltr"
}

// Simple {token} interpolation for chrome strings that carry dynamic values.
export function lpFill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) =>
    k in vars ? String(vars[k]) : `{${k}}`,
  )
}

// ─── Chrome dictionary ─────────────────────────────────────────────────────
// The brand token "FREEHOLD" is rendered separately and never translated.

const EN: Record<string, string> = {
  "topbar.brandSuffix": "Property UAE",
  "topbar.from": "From",
  "topbar.whatsapp": "WhatsApp",
  "topbar.call": "Call",
  "topbar.draft": "DRAFT — not published · Go to CRM → Landing Pages to publish",

  "hero.badge.dld": "DLD Registered",
  "hero.badge.rera": "RERA Certified",
  "hero.badge.award": "Award-Winning Agency",
  "hero.form.eyebrow": "Free Consultation",
  "hero.form.title": "Request Investment Pack",
  "hero.form.subtitle": "Floor plans, pricing, and ROI analysis — delivered within 24 hours.",
  "hero.whatsapp": "WhatsApp",

  "desc.eyebrow": "About the Project",
  "desc.aboutPrefix": "About",
  "desc.highlights": "Highlights",

  "gallery.eyebrow": "Visuals",
  "gallery.title": "Project Gallery",
  "gallery.requestFloorPlans": "Request floor plans →",

  "units.eyebrow": "Residences",
  "units.title": "Available Residences",
  "units.disclaimer": "All prices are indicative · Subject to availability",
  "units.unitType": "Unit Type",
  "units.size": "Size",
  "units.price": "Price",
  "units.requestFloorPlan": "Request Floor Plan",

  "payment.eyebrow": "Finance",
  "payment.title": "Flexible Payment Plan",
  "payment.intro":
    "Developer-backed payment structure designed to minimise your upfront commitment while securing your investment in one of Dubai's most coveted addresses.",
  "payment.stage.down": "Down Payment",
  "payment.stage.downSub": "On booking",
  "payment.stage.during": "During Construction",
  "payment.stage.duringSub": "Paid in instalments",
  "payment.stage.handover": "On Handover",
  "payment.stage.handoverSub": "Keys handover",
  "payment.stage.post": "Post Handover",
  "payment.stage.postSub": "After completion",
  "payment.card1.title": "Developer-Backed Plan",
  "payment.card1.desc":
    "Payment milestones tied to construction progress — your capital is protected at every stage.",
  "payment.card2.title": "Build Equity Immediately",
  "payment.card2.desc":
    "Properties historically appreciate during construction in Dubai, often delivering returns before handover.",
  "payment.card3.title": "0% Commission",
  "payment.card3.desc":
    "All Freehold transactions are fee-free to buyers. You pay only the agreed purchase price.",

  "roi.eyebrow": "Investment Returns",
  "roi.title": "Why This Investment Works",
  "roi.disclaimer": "Projections — not financial advice",
  "roi.projectedYield": "Projected Yield",
  "roi.projectedYieldSub": "Estimated net annual return",
  "roi.annual": "Annual Income",
  "roi.annualSub": "Gross rental income",
  "roi.monthly": "Monthly Income",
  "roi.monthlySub": "Average per month",
  "roi.fiveYear": "5-Year Rental",
  "roi.fiveYearSub": "Cumulative income",

  "location.eyebrow": "Location",
  "location.lifeInPrefix": "Life in",
  "location.dubaiSuffix": ", Dubai",
  "location.uae": "United Arab Emirates",
  "location.defaultDesc":
    "{area} is one of Dubai's most sought-after addresses, combining world-class infrastructure with exceptional lifestyle amenities and strong capital appreciation fundamentals.",

  "whyDubai.eyebrow": "Why Dubai",
  "whyDubai.title": "The World's Most Compelling Investment City",
  "whyDubai.1.label": "Safest city globally",
  "whyDubai.1.sub": "Global Peace Index 2024",
  "whyDubai.2.label": "Income & capital gains tax",
  "whyDubai.2.sub": "For all residents",
  "whyDubai.3.label": "Nationalities call Dubai home",
  "whyDubai.3.sub": "Most cosmopolitan city",
  "whyDubai.4.label": "Real estate transactions 2024",
  "whyDubai.4.sub": "Record-breaking year",
  "whyDubai.5.label": "Global luxury market",
  "whyDubai.5.sub": "Knight Frank 2024",
  "whyDubai.6.label": "Golden Visa residency",
  "whyDubai.6.sub": "For qualifying investors",

  "goldenVisa.eyebrow": "UAE Golden Visa",
  "goldenVisa.title": "Golden Visa Eligible Property",
  "goldenVisa.desc":
    "Properties at {threshold}+ threshold unlock the UAE 10-year Golden Visa — giving you and your family full residency rights with no sponsor required.",
  "goldenVisa.cta": "Check Eligibility",
  "goldenVisa.whatYouGet": "What You Get",
  "goldenVisa.benefit1": "10-year renewable UAE residency",
  "goldenVisa.benefit2": "Sponsor spouse and children under 25",
  "goldenVisa.benefit3": "No UAE local sponsor required",
  "goldenVisa.benefit4": "Own property outright in all freehold zones",
  "goldenVisa.benefit5": "Renewable indefinitely while owning property",

  "amenities.eyebrow": "Amenities",
  "amenities.title": "World-Class Amenities",

  "developer.eyebrow": "Developer",
  "developer.builtByPrefix": "Built by",

  "social.eyebrow": "Social Proof",
  "social.title": "Investor Experiences",
  "social.average": "average",

  "neighborhood.eyebrow": "Neighbourhood",
  "neighborhood.lifeInPrefix": "Life in",
  "neighborhood.default1": "{area} is one of Dubai's most connected and sought-after communities",
  "neighborhood.default2": "Access to world-class schools, retail, dining, and lifestyle infrastructure",
  "neighborhood.default3": "Strong rental demand driven by young professionals and families",
  "neighborhood.default4": "Capital growth track record with continued development investment",

  "market.title": "AI Market Analysis",
  "market.subtitle": "Investment-grade context from live market data",
  "market.live": "Live",

  "ai.eyebrow": "AI Advisor",
  "ai.title": "Ask Our AI Advisor",
  "ai.subtitle":
    "Get instant, expert-level answers about {name} — from yield analysis to buyer profiles to area comparisons. Powered by Freehold AI.",
  "ai.whatsappTitle": "WhatsApp AI — instant answers",
  "ai.whatsappSub": "Tap any question below to start",

  "leadForm.eyebrow": "Contact Us",
  "leadForm.title": "Get the Full Investment Pack",
  "leadForm.subtitle":
    "Floor plans, pricing, ROI analysis, and brochure — delivered within 24 hours by a senior Freehold consultant.",
  "leadForm.benefit1": "Response within 24 hours, guaranteed",
  "leadForm.benefit2": "No pressure sales — honest, expert advice",
  "leadForm.benefit3": "Dedicated investment consultant assigned",
  "leadForm.benefit4": "0% buyer commission — always",

  "brochure.eyebrow": "Free Download",
  "brochure.title": "Download the Full Brochure",
  "brochure.subtitle":
    "Floor plans, specifications, payment schedule, and full investment analysis in one document.",

  "faq.eyebrow": "FAQ",
  "faq.title": "Common Questions",
  "faq.subtitle": "Everything investors typically ask before committing to a Dubai off-plan purchase.",

  "footer.brandSuffix": "Property UAE",
  "footer.address": "Sobha Sapphire, Office 904\nBusiness Bay, Dubai, UAE",
  "footer.contact": "Contact",
  "footer.certifications": "Certifications",
  "footer.cert1": "RERA Licensed Agency",
  "footer.cert2": "DLD Registered Broker",
  "footer.cert3": "Dubai Chamber Member",
  "footer.legal":
    "Freehold Property UAE. All rights reserved. Prices, yields, and availability subject to change without notice. Projected returns are estimates only and do not constitute financial advice. Regulated by the Dubai Land Department.",

  "notFound.title": "Page not found",
  "notFound.desc": "This property page is not available or has been removed.",
  "notFound.back": "← Back to Freehold",

  "sticky.startingFrom": "Starting from",
  "sticky.whatsapp": "WhatsApp",

  "form.name": "Full Name",
  "form.namePlaceholder": "Your full name",
  "form.phone": "Phone / WhatsApp",
  "form.email": "Email",
  "form.sending": "Sending…",
  "form.defaultCta": "Request Brochure & Pricing",
  "form.disclaimer": "By submitting, you agree to be contacted by Freehold Property UAE. No spam, ever.",
  "form.successTitle": "Request received",
  "form.successPrefix": "Our team will send you the brochure and pricing for",
  "form.successSuffix": "within a few hours.",
  "form.error": "Unable to send your request.",
}

const AR: Record<string, string> = {
  "topbar.brandSuffix": "عقارات الإمارات",
  "topbar.from": "من",
  "topbar.whatsapp": "واتساب",
  "topbar.call": "اتصال",
  "topbar.draft": "مسودة — غير منشورة · انتقل إلى نظام إدارة العملاء ← صفحات الهبوط للنشر",

  "hero.badge.dld": "مسجّل لدى دائرة الأراضي والأملاك",
  "hero.badge.rera": "معتمد من مؤسسة التنظيم العقاري",
  "hero.badge.award": "وكالة حائزة على جوائز",
  "hero.form.eyebrow": "استشارة مجانية",
  "hero.form.title": "اطلب الحزمة الاستثمارية",
  "hero.form.subtitle": "مخططات الطوابق والأسعار وتحليل العائد على الاستثمار — تصلك خلال 24 ساعة.",
  "hero.whatsapp": "واتساب",

  "desc.eyebrow": "عن المشروع",
  "desc.aboutPrefix": "عن",
  "desc.highlights": "أبرز المزايا",

  "gallery.eyebrow": "صور",
  "gallery.title": "معرض المشروع",
  "gallery.requestFloorPlans": "اطلب مخططات الطوابق ←",

  "units.eyebrow": "الوحدات السكنية",
  "units.title": "الوحدات المتاحة",
  "units.disclaimer": "جميع الأسعار استرشادية · تخضع للتوفر",
  "units.unitType": "نوع الوحدة",
  "units.size": "المساحة",
  "units.price": "السعر",
  "units.requestFloorPlan": "اطلب مخطط الطابق",

  "payment.eyebrow": "التمويل",
  "payment.title": "خطة سداد مرنة",
  "payment.intro":
    "هيكل سداد مدعوم من المطوّر مصمّم لتقليل التزامك المبدئي مع تأمين استثمارك في أحد أرقى العناوين في دبي.",
  "payment.stage.down": "الدفعة الأولى",
  "payment.stage.downSub": "عند الحجز",
  "payment.stage.during": "أثناء الإنشاء",
  "payment.stage.duringSub": "تُدفع على أقساط",
  "payment.stage.handover": "عند التسليم",
  "payment.stage.handoverSub": "تسليم المفاتيح",
  "payment.stage.post": "بعد التسليم",
  "payment.stage.postSub": "بعد الإنجاز",
  "payment.card1.title": "خطة مدعومة من المطوّر",
  "payment.card1.desc":
    "مراحل السداد مرتبطة بتقدّم الإنشاء — رأس مالك محمي في كل مرحلة.",
  "payment.card2.title": "بناء الملكية فوراً",
  "payment.card2.desc":
    "ترتفع قيمة العقارات تاريخياً أثناء الإنشاء في دبي، وغالباً ما تحقق عوائد قبل التسليم.",
  "payment.card3.title": "عمولة 0%",
  "payment.card3.desc":
    "جميع معاملات فريهولد بدون رسوم على المشترين. تدفع فقط سعر الشراء المتفق عليه.",

  "roi.eyebrow": "عوائد الاستثمار",
  "roi.title": "لماذا ينجح هذا الاستثمار",
  "roi.disclaimer": "تقديرات — وليست نصيحة مالية",
  "roi.projectedYield": "العائد المتوقع",
  "roi.projectedYieldSub": "صافي العائد السنوي التقديري",
  "roi.annual": "الدخل السنوي",
  "roi.annualSub": "إجمالي الدخل الإيجاري",
  "roi.monthly": "الدخل الشهري",
  "roi.monthlySub": "المتوسط شهرياً",
  "roi.fiveYear": "إيجار 5 سنوات",
  "roi.fiveYearSub": "الدخل التراكمي",

  "location.eyebrow": "الموقع",
  "location.lifeInPrefix": "الحياة في",
  "location.dubaiSuffix": "، دبي",
  "location.uae": "الإمارات العربية المتحدة",
  "location.defaultDesc":
    "يُعد {area} أحد أكثر العناوين رواجاً في دبي، حيث يجمع بين البنية التحتية العالمية ووسائل الراحة الاستثنائية وأساسيات قوية لنمو رأس المال.",

  "whyDubai.eyebrow": "لماذا دبي",
  "whyDubai.title": "أكثر مدن العالم جاذبية للاستثمار",
  "whyDubai.1.label": "الأكثر أماناً عالمياً",
  "whyDubai.1.sub": "مؤشر السلام العالمي 2024",
  "whyDubai.2.label": "ضريبة الدخل والأرباح الرأسمالية",
  "whyDubai.2.sub": "لجميع المقيمين",
  "whyDubai.3.label": "جنسية تتخذ من دبي موطناً",
  "whyDubai.3.sub": "أكثر المدن عالمية",
  "whyDubai.4.label": "معاملات عقارية في 2024",
  "whyDubai.4.sub": "عام قياسي",
  "whyDubai.5.label": "سوق الفخامة العالمي",
  "whyDubai.5.sub": "نايت فرانك 2024",
  "whyDubai.6.label": "إقامة التأشيرة الذهبية",
  "whyDubai.6.sub": "للمستثمرين المؤهلين",

  "goldenVisa.eyebrow": "التأشيرة الذهبية الإماراتية",
  "goldenVisa.title": "عقار مؤهل للتأشيرة الذهبية",
  "goldenVisa.desc":
    "العقارات عند حد {threshold}+ تفتح لك التأشيرة الذهبية الإماراتية لمدة 10 سنوات — منحك أنت وعائلتك حقوق إقامة كاملة دون الحاجة إلى كفيل.",
  "goldenVisa.cta": "تحقق من الأهلية",
  "goldenVisa.whatYouGet": "ما الذي تحصل عليه",
  "goldenVisa.benefit1": "إقامة إماراتية قابلة للتجديد لمدة 10 سنوات",
  "goldenVisa.benefit2": "استقدام الزوج/الزوجة والأبناء دون سن 25",
  "goldenVisa.benefit3": "لا حاجة إلى كفيل محلي في الإمارات",
  "goldenVisa.benefit4": "تملّك العقار بالكامل في جميع مناطق التملك الحر",
  "goldenVisa.benefit5": "قابلة للتجديد بلا حدود طالما تملك العقار",

  "amenities.eyebrow": "المرافق",
  "amenities.title": "مرافق عالمية المستوى",

  "developer.eyebrow": "المطوّر",
  "developer.builtByPrefix": "من تطوير",

  "social.eyebrow": "آراء العملاء",
  "social.title": "تجارب المستثمرين",
  "social.average": "المتوسط",

  "neighborhood.eyebrow": "الحي",
  "neighborhood.lifeInPrefix": "الحياة في",
  "neighborhood.default1": "يُعد {area} أحد أكثر مجتمعات دبي ترابطاً ورواجاً",
  "neighborhood.default2": "قرب المدارس العالمية والمتاجر والمطاعم والبنية التحتية لأسلوب الحياة",
  "neighborhood.default3": "طلب إيجاري قوي مدفوع بالمهنيين الشباب والعائلات",
  "neighborhood.default4": "سجل حافل بنمو رأس المال مع استمرار الاستثمار في التطوير",

  "market.title": "تحليل السوق بالذكاء الاصطناعي",
  "market.subtitle": "سياق استثماري مبني على بيانات سوق مباشرة",
  "market.live": "مباشر",

  "ai.eyebrow": "المستشار الذكي",
  "ai.title": "اسأل مستشارنا الذكي",
  "ai.subtitle":
    "احصل على إجابات فورية بمستوى الخبراء عن {name} — من تحليل العوائد إلى ملفات المشترين ومقارنات المناطق. مدعوم بذكاء فريهولد.",
  "ai.whatsappTitle": "واتساب الذكي — إجابات فورية",
  "ai.whatsappSub": "اضغط على أي سؤال أدناه للبدء",

  "leadForm.eyebrow": "تواصل معنا",
  "leadForm.title": "احصل على الحزمة الاستثمارية الكاملة",
  "leadForm.subtitle":
    "مخططات الطوابق والأسعار وتحليل العائد والكتيّب — تصلك خلال 24 ساعة عبر مستشار استثماري أول من فريهولد.",
  "leadForm.benefit1": "رد خلال 24 ساعة، مضمون",
  "leadForm.benefit2": "بلا ضغوط بيعية — نصيحة صادقة من الخبراء",
  "leadForm.benefit3": "تخصيص مستشار استثماري مخصّص",
  "leadForm.benefit4": "عمولة 0% على المشتري — دائماً",

  "brochure.eyebrow": "تحميل مجاني",
  "brochure.title": "حمّل الكتيّب الكامل",
  "brochure.subtitle":
    "مخططات الطوابق والمواصفات وجدول السداد والتحليل الاستثماري الكامل في مستند واحد.",

  "faq.eyebrow": "الأسئلة الشائعة",
  "faq.title": "أسئلة متكررة",
  "faq.subtitle": "كل ما يسأل عنه المستثمرون عادةً قبل الالتزام بشراء عقار على الخارطة في دبي.",

  "footer.brandSuffix": "عقارات الإمارات",
  "footer.address": "صبحا سفير، مكتب 904\nالخليج التجاري، دبي، الإمارات",
  "footer.contact": "تواصل",
  "footer.certifications": "الاعتمادات",
  "footer.cert1": "وكالة مرخّصة من مؤسسة التنظيم العقاري",
  "footer.cert2": "وسيط مسجّل لدى دائرة الأراضي والأملاك",
  "footer.cert3": "عضو غرفة تجارة دبي",
  "footer.legal":
    "عقارات فريهولد الإمارات. جميع الحقوق محفوظة. الأسعار والعوائد والتوفر عرضة للتغيير دون إشعار. العوائد المتوقعة تقديرية فقط ولا تُعد نصيحة مالية. خاضعة لتنظيم دائرة الأراضي والأملاك في دبي.",

  "notFound.title": "الصفحة غير موجودة",
  "notFound.desc": "صفحة هذا العقار غير متاحة أو تمت إزالتها.",
  "notFound.back": "← العودة إلى فريهولد",

  "sticky.startingFrom": "يبدأ من",
  "sticky.whatsapp": "واتساب",

  "form.name": "الاسم الكامل",
  "form.namePlaceholder": "اسمك الكامل",
  "form.phone": "الهاتف / واتساب",
  "form.email": "البريد الإلكتروني",
  "form.sending": "جارٍ الإرسال…",
  "form.defaultCta": "اطلب الكتيّب والأسعار",
  "form.disclaimer": "بإرسالك للنموذج، فإنك توافق على أن تتواصل معك عقارات فريهولد الإمارات. لا رسائل مزعجة إطلاقاً.",
  "form.successTitle": "تم استلام طلبك",
  "form.successPrefix": "سيرسل لك فريقنا الكتيّب والأسعار الخاصة بـ",
  "form.successSuffix": "خلال ساعات قليلة.",
  "form.error": "تعذّر إرسال طلبك.",
}

const RU: Record<string, string> = {
  "topbar.brandSuffix": "Недвижимость ОАЭ",
  "topbar.from": "От",
  "topbar.whatsapp": "WhatsApp",
  "topbar.call": "Позвонить",
  "topbar.draft": "ЧЕРНОВИК — не опубликовано · Перейдите в CRM → Лендинги для публикации",

  "hero.badge.dld": "Зарегистрировано в DLD",
  "hero.badge.rera": "Сертифицировано RERA",
  "hero.badge.award": "Отмеченное наградами агентство",
  "hero.form.eyebrow": "Бесплатная консультация",
  "hero.form.title": "Запросить инвестиционный пакет",
  "hero.form.subtitle": "Планировки, цены и анализ доходности — в течение 24 часов.",
  "hero.whatsapp": "WhatsApp",

  "desc.eyebrow": "О проекте",
  "desc.aboutPrefix": "О проекте",
  "desc.highlights": "Преимущества",

  "gallery.eyebrow": "Визуализация",
  "gallery.title": "Галерея проекта",
  "gallery.requestFloorPlans": "Запросить планировки →",

  "units.eyebrow": "Резиденции",
  "units.title": "Доступные резиденции",
  "units.disclaimer": "Все цены ориентировочные · В зависимости от наличия",
  "units.unitType": "Тип юнита",
  "units.size": "Площадь",
  "units.price": "Цена",
  "units.requestFloorPlan": "Запросить планировку",

  "payment.eyebrow": "Финансы",
  "payment.title": "Гибкий план оплаты",
  "payment.intro":
    "Схема оплаты при поддержке застройщика, разработанная для минимизации первоначального взноса при сохранении ваших инвестиций по одному из самых престижных адресов Дубая.",
  "payment.stage.down": "Первый взнос",
  "payment.stage.downSub": "При бронировании",
  "payment.stage.during": "В ходе строительства",
  "payment.stage.duringSub": "Выплачивается частями",
  "payment.stage.handover": "При передаче",
  "payment.stage.handoverSub": "Передача ключей",
  "payment.stage.post": "После передачи",
  "payment.stage.postSub": "После завершения",
  "payment.card1.title": "План при поддержке застройщика",
  "payment.card1.desc":
    "Этапы оплаты привязаны к ходу строительства — ваш капитал защищён на каждом этапе.",
  "payment.card2.title": "Наращивайте капитал сразу",
  "payment.card2.desc":
    "Недвижимость в Дубае исторически дорожает в процессе строительства, часто принося доход ещё до передачи.",
  "payment.card3.title": "Комиссия 0%",
  "payment.card3.desc":
    "Все сделки Freehold бесплатны для покупателей. Вы платите только согласованную цену покупки.",

  "roi.eyebrow": "Доходность инвестиций",
  "roi.title": "Почему эта инвестиция работает",
  "roi.disclaimer": "Прогнозы — не финансовая консультация",
  "roi.projectedYield": "Прогнозируемая доходность",
  "roi.projectedYieldSub": "Ориентировочный чистый годовой доход",
  "roi.annual": "Годовой доход",
  "roi.annualSub": "Валовой арендный доход",
  "roi.monthly": "Ежемесячный доход",
  "roi.monthlySub": "В среднем за месяц",
  "roi.fiveYear": "Аренда за 5 лет",
  "roi.fiveYearSub": "Накопленный доход",

  "location.eyebrow": "Расположение",
  "location.lifeInPrefix": "Жизнь в районе",
  "location.dubaiSuffix": ", Дубай",
  "location.uae": "Объединённые Арабские Эмираты",
  "location.defaultDesc":
    "{area} — один из самых востребованных адресов Дубая, сочетающий инфраструктуру мирового класса, исключительные удобства и прочные основы для роста капитала.",

  "whyDubai.eyebrow": "Почему Дубай",
  "whyDubai.title": "Самый привлекательный инвестиционный город мира",
  "whyDubai.1.label": "Самый безопасный город в мире",
  "whyDubai.1.sub": "Глобальный индекс мира 2024",
  "whyDubai.2.label": "Налог на доход и прирост капитала",
  "whyDubai.2.sub": "Для всех резидентов",
  "whyDubai.3.label": "Национальностей называют Дубай домом",
  "whyDubai.3.sub": "Самый космополитичный город",
  "whyDubai.4.label": "Сделки с недвижимостью в 2024",
  "whyDubai.4.sub": "Рекордный год",
  "whyDubai.5.label": "Мировой рынок люкса",
  "whyDubai.5.sub": "Knight Frank 2024",
  "whyDubai.6.label": "Резидентство по Золотой визе",
  "whyDubai.6.sub": "Для квалифицированных инвесторов",

  "goldenVisa.eyebrow": "Золотая виза ОАЭ",
  "goldenVisa.title": "Недвижимость с правом на Золотую визу",
  "goldenVisa.desc":
    "Недвижимость от порога {threshold}+ открывает 10-летнюю Золотую визу ОАЭ — полные права резидентства для вас и вашей семьи без спонсора.",
  "goldenVisa.cta": "Проверить право",
  "goldenVisa.whatYouGet": "Что вы получаете",
  "goldenVisa.benefit1": "10-летнее продлеваемое резидентство ОАЭ",
  "goldenVisa.benefit2": "Спонсорство супруга и детей до 25 лет",
  "goldenVisa.benefit3": "Местный спонсор в ОАЭ не требуется",
  "goldenVisa.benefit4": "Полное владение недвижимостью во всех зонах фрихолда",
  "goldenVisa.benefit5": "Продлевается бессрочно, пока вы владеете недвижимостью",

  "amenities.eyebrow": "Инфраструктура",
  "amenities.title": "Удобства мирового класса",

  "developer.eyebrow": "Застройщик",
  "developer.builtByPrefix": "Застройщик:",

  "social.eyebrow": "Отзывы",
  "social.title": "Опыт инвесторов",
  "social.average": "средняя оценка",

  "neighborhood.eyebrow": "Район",
  "neighborhood.lifeInPrefix": "Жизнь в районе",
  "neighborhood.default1": "{area} — одно из самых связанных и востребованных сообществ Дубая",
  "neighborhood.default2": "Доступ к школам мирового класса, торговле, ресторанам и инфраструктуре образа жизни",
  "neighborhood.default3": "Высокий арендный спрос со стороны молодых специалистов и семей",
  "neighborhood.default4": "Устойчивый рост капитала при продолжающихся инвестициях в развитие",

  "market.title": "ИИ-анализ рынка",
  "market.subtitle": "Инвестиционный контекст на основе актуальных рыночных данных",
  "market.live": "В реальном времени",

  "ai.eyebrow": "ИИ-консультант",
  "ai.title": "Спросите нашего ИИ-консультанта",
  "ai.subtitle":
    "Получите мгновенные экспертные ответы о {name} — от анализа доходности до профилей покупателей и сравнения районов. На основе Freehold AI.",
  "ai.whatsappTitle": "ИИ в WhatsApp — мгновенные ответы",
  "ai.whatsappSub": "Нажмите любой вопрос ниже, чтобы начать",

  "leadForm.eyebrow": "Свяжитесь с нами",
  "leadForm.title": "Получите полный инвестиционный пакет",
  "leadForm.subtitle":
    "Планировки, цены, анализ доходности и брошюра — в течение 24 часов от старшего консультанта Freehold.",
  "leadForm.benefit1": "Ответ в течение 24 часов, гарантированно",
  "leadForm.benefit2": "Без давления — честный экспертный совет",
  "leadForm.benefit3": "Персональный инвестиционный консультант",
  "leadForm.benefit4": "0% комиссии с покупателя — всегда",

  "brochure.eyebrow": "Бесплатная загрузка",
  "brochure.title": "Скачать полную брошюру",
  "brochure.subtitle":
    "Планировки, спецификации, график оплаты и полный инвестиционный анализ в одном документе.",

  "faq.eyebrow": "Вопросы",
  "faq.title": "Частые вопросы",
  "faq.subtitle": "Всё, что инвесторы обычно спрашивают перед покупкой строящейся недвижимости в Дубае.",

  "footer.brandSuffix": "Недвижимость ОАЭ",
  "footer.address": "Sobha Sapphire, офис 904\nБизнес Бэй, Дубай, ОАЭ",
  "footer.contact": "Контакты",
  "footer.certifications": "Сертификаты",
  "footer.cert1": "Агентство с лицензией RERA",
  "footer.cert2": "Брокер, зарегистрированный в DLD",
  "footer.cert3": "Член Торговой палаты Дубая",
  "footer.legal":
    "Freehold Property UAE. Все права защищены. Цены, доходность и наличие могут изменяться без уведомления. Прогнозируемая доходность является лишь оценкой и не является финансовой консультацией. Регулируется Земельным департаментом Дубая.",

  "notFound.title": "Страница не найдена",
  "notFound.desc": "Эта страница объекта недоступна или была удалена.",
  "notFound.back": "← Назад к Freehold",

  "sticky.startingFrom": "От",
  "sticky.whatsapp": "WhatsApp",

  "form.name": "Полное имя",
  "form.namePlaceholder": "Ваше полное имя",
  "form.phone": "Телефон / WhatsApp",
  "form.email": "Эл. почта",
  "form.sending": "Отправка…",
  "form.defaultCta": "Запросить брошюру и цены",
  "form.disclaimer": "Отправляя форму, вы соглашаетесь на связь с Freehold Property UAE. Никакого спама.",
  "form.successTitle": "Запрос получен",
  "form.successPrefix": "Наша команда пришлёт вам брошюру и цены по объекту",
  "form.successSuffix": "в течение нескольких часов.",
  "form.error": "Не удалось отправить запрос.",
}

export const LP_CHROME: Record<LpLang, Record<string, string>> = { en: EN, ar: AR, ru: RU }

// ─── Dynamic content translation (Gemini, single call, cached) ──────────────

const LANG_NAMES: Record<Exclude<LpLang, "en">, string> = {
  ar: "Arabic",
  ru: "Russian",
}

// Cheap, stable, non-cryptographic hash so content edits invalidate the cache.
function stableHash(input: string): string {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

// Skip values that are not natural-language UI/content: URLs, paths, anchors,
// hex colors, pure numbers/prices, and very short tokens.
function shouldTranslate(s: string): boolean {
  const t = s.trim()
  if (t.length < 2) return false
  if (/^https?:/i.test(t)) return false
  if (t.includes("/")) return false
  if (t.startsWith("#")) return false
  if (/^#?[0-9a-fA-F]{3,8}$/.test(t)) return false
  if (/^[-+]?[\d][\d.,%\s]*$/.test(t)) return false
  return true
}

function collectStrings(node: unknown, out: string[]): void {
  if (typeof node === "string") {
    if (shouldTranslate(node)) out.push(node)
    return
  }
  if (Array.isArray(node)) {
    for (const x of node) collectStrings(x, out)
    return
  }
  if (node && typeof node === "object") {
    for (const k of Object.keys(node as Record<string, unknown>)) {
      collectStrings((node as Record<string, unknown>)[k], out)
    }
  }
}

function collectPage(page: LandingPageData): string[] {
  const out: string[] = []
  collectStrings(page.title, out)
  collectStrings(page.subtitle, out)
  collectStrings(page.ctaText, out)
  for (const s of page.sections) collectStrings(s.data, out)
  if (page.project) {
    collectStrings(page.project.amenities, out)
    for (const f of page.project.faqs) {
      collectStrings(f.question, out)
      collectStrings(f.answer, out)
    }
  }
  return out
}

// Rebuild a deep copy of `page`, replacing each translatable leaf (in the exact
// same traversal order as collectPage) with translated[counter]. Non-translatable
// leaves are preserved verbatim.
function rebuildPage(page: LandingPageData, translated: string[]): LandingPageData {
  let i = 0
  const mapNode = (node: unknown): unknown => {
    if (typeof node === "string") {
      return shouldTranslate(node) ? translated[i++] ?? node : node
    }
    if (Array.isArray(node)) return node.map(mapNode)
    if (node && typeof node === "object") {
      const o: Record<string, unknown> = {}
      for (const k of Object.keys(node as Record<string, unknown>)) {
        o[k] = mapNode((node as Record<string, unknown>)[k])
      }
      return o
    }
    return node
  }

  const title = mapNode(page.title) as string
  const subtitle = mapNode(page.subtitle) as string
  const ctaText = mapNode(page.ctaText) as string
  const sections = page.sections.map((s) => ({ ...s, data: mapNode(s.data) as Record<string, unknown> }))
  let project = page.project
  if (project) {
    const amenities = mapNode(project.amenities) as string[]
    const faqs = project.faqs.map((f) => ({
      question: mapNode(f.question) as string,
      answer: mapNode(f.answer) as string,
    }))
    project = { ...project, amenities, faqs }
  }
  return { ...page, title, subtitle, ctaText, sections, project }
}

const translationCache = new Map<string, Promise<LandingPageData>>()

async function runTranslation(
  page: LandingPageData,
  lang: Exclude<LpLang, "en">,
  originals: string[],
): Promise<LandingPageData> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return page
  try {
    const prompt = `Translate each string in the following JSON array into ${LANG_NAMES[lang]}.
Return ONLY a JSON array of translated strings with EXACTLY the same length and order as the input — element N of the output is the translation of element N of the input.
Do NOT translate brand names (e.g. Freehold, FREEHOLD), numbers, prices (e.g. AED 2.5M), or proper nouns such as property names, developer names, and area/neighbourhood names — keep those as they are.
Preserve punctuation, symbols and emphasis. Do not add, remove, merge or reorder any elements.
Input:
${JSON.stringify(originals)}`

    const data = await geminiGenerate(
      apiKey,
      [{ role: "user", parts: [{ text: prompt }] }],
      { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: "application/json" },
    )
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ""
    const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()
    const parsed = JSON.parse(cleaned) as unknown
    if (!Array.isArray(parsed) || parsed.length !== originals.length) return page
    if (!parsed.every((x) => typeof x === "string" && x.length > 0)) return page
    return rebuildPage(page, parsed as string[])
  } catch {
    return page
  }
}

/**
 * Translate the dynamic content of a landing page to `lang`. English returns the
 * page unchanged. On any failure (missing key, Gemini error, bad output) the
 * ORIGINAL English page is returned — never blank or partial content. Result is
 * cached per (slug, lang, content-hash) with a single Gemini call max.
 */
export async function translateLandingContent(
  page: LandingPageData,
  lang: LpLang,
): Promise<LandingPageData> {
  if (lang === "en") return page

  const originals = collectPage(page)
  if (!originals.length) return page

  const key = `${page.slug}:${lang}:${stableHash(originals.join(""))}`
  const cached = translationCache.get(key)
  if (cached) return cached

  const promise = runTranslation(page, lang, originals).catch(() => page)
  translationCache.set(key, promise)
  return promise
}
