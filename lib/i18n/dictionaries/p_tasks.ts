// Freehold Intelligence — Tasks page.
type Dict = Record<string, string>

const en: Dict = {
  'ptasks.eyebrow': 'Tasks',
  'ptasks.headline.open': '{n} tasks open.',
  'ptasks.headline.due': '{n} due today.',
  'ptasks.intro': 'Owned, dated and tracked. Created from review comments, blockers and internal decisions. Resolve critical and blocked items first.',
  // Stat strip
  'ptasks.stat.open': 'Open',
  'ptasks.stat.critical': 'Critical',
  'ptasks.stat.blocked': 'Blocked',
  'ptasks.stat.dueToday': 'Due today',
  // Status filter options
  'ptasks.status.all': 'All',
  'ptasks.status.open': 'Open',
  'ptasks.status.inProgress': 'In Progress',
  'ptasks.status.blocked': 'Blocked',
  'ptasks.status.done': 'Done',
  // Priority filter options
  'ptasks.priority.all': 'All',
  'ptasks.priority.critical': 'Critical',
  'ptasks.priority.high': 'High',
  'ptasks.priority.medium': 'Medium',
  'ptasks.priority.low': 'Low',
  // Misc
  'ptasks.clear': 'Clear',
  'ptasks.empty': 'No tasks match the current filters.',
  'ptasks.markDone': 'Mark done',
  'ptasks.openIn': 'Open in {app}',
  // Create form
  'ptasks.create.title': 'Create a task',
  'ptasks.create.success': 'Task created',
  'ptasks.create.titlePlaceholder': 'Task title',
  'ptasks.create.descPlaceholder': 'Describe the task, expected outcome, and what success looks like…',
  'ptasks.create.assigneePlaceholder': 'Assign to…',
  'ptasks.create.duePlaceholder': 'Due date',
  'ptasks.create.submit': 'Create task',
  // AI take
  'ptasks.ai.title': 'AI take',
  'ptasks.ai.body': 'The two blocked tasks (Meta billing, auth middleware) have the highest downstream impact. Billing unblocks the entire campaign pipeline. After that, the Palm landing approval and the CRM lead review are both achievable today and unlock agent momentum immediately.',
}

const ar: Dict = {
  'ptasks.eyebrow': 'المهام',
  'ptasks.headline.open': '{n} مهمة مفتوحة.',
  'ptasks.headline.due': '{n} مستحقة اليوم.',
  'ptasks.intro': 'مملوكة ومؤرّخة ومتابَعة. أُنشئت من تعليقات المراجعة والعوائق والقرارات الداخلية. عالِج العناصر الحرجة والمعطّلة أولاً.',
  // Stat strip
  'ptasks.stat.open': 'مفتوحة',
  'ptasks.stat.critical': 'حرجة',
  'ptasks.stat.blocked': 'معطّلة',
  'ptasks.stat.dueToday': 'مستحقة اليوم',
  // Status filter options
  'ptasks.status.all': 'الكل',
  'ptasks.status.open': 'مفتوحة',
  'ptasks.status.inProgress': 'قيد التنفيذ',
  'ptasks.status.blocked': 'معطّلة',
  'ptasks.status.done': 'مكتملة',
  // Priority filter options
  'ptasks.priority.all': 'الكل',
  'ptasks.priority.critical': 'حرجة',
  'ptasks.priority.high': 'عالية',
  'ptasks.priority.medium': 'متوسطة',
  'ptasks.priority.low': 'منخفضة',
  // Misc
  'ptasks.clear': 'مسح',
  'ptasks.empty': 'لا توجد مهام تطابق عوامل التصفية الحالية.',
  'ptasks.markDone': 'وضع علامة كمكتملة',
  'ptasks.openIn': 'فتح في {app}',
  // Create form
  'ptasks.create.title': 'إنشاء مهمة',
  'ptasks.create.success': 'تم إنشاء المهمة',
  'ptasks.create.titlePlaceholder': 'عنوان المهمة',
  'ptasks.create.descPlaceholder': 'صِف المهمة والنتيجة المتوقعة وكيف يبدو النجاح…',
  'ptasks.create.assigneePlaceholder': 'إسناد إلى…',
  'ptasks.create.duePlaceholder': 'تاريخ الاستحقاق',
  'ptasks.create.submit': 'إنشاء المهمة',
  // AI take
  'ptasks.ai.title': 'رأي الذكاء الاصطناعي',
  'ptasks.ai.body': 'المهمتان المعطّلتان (فوترة Meta، الوسيط البرمجي للمصادقة) لهما أكبر أثر لاحق. تُحرِّر الفوترة خط أنابيب الحملات بالكامل. بعد ذلك، تُعد موافقة صفحة هبوط Palm ومراجعة العميل المحتمل في CRM قابلتين للإنجاز اليوم وتُطلقان زخم الوكلاء على الفور.',
}

const ru: Dict = {
  'ptasks.eyebrow': 'Задачи',
  'ptasks.headline.open': 'Открыто задач: {n}.',
  'ptasks.headline.due': 'Со сроком сегодня: {n}.',
  'ptasks.intro': 'С владельцем, датой и отслеживанием. Созданы из комментариев к ревью, блокеров и внутренних решений. Сначала решайте критичные и заблокированные пункты.',
  // Stat strip
  'ptasks.stat.open': 'Открыто',
  'ptasks.stat.critical': 'Критичные',
  'ptasks.stat.blocked': 'Заблокировано',
  'ptasks.stat.dueToday': 'Срок сегодня',
  // Status filter options
  'ptasks.status.all': 'Все',
  'ptasks.status.open': 'Открытые',
  'ptasks.status.inProgress': 'В работе',
  'ptasks.status.blocked': 'Заблокированные',
  'ptasks.status.done': 'Готово',
  // Priority filter options
  'ptasks.priority.all': 'Все',
  'ptasks.priority.critical': 'Критичный',
  'ptasks.priority.high': 'Высокий',
  'ptasks.priority.medium': 'Средний',
  'ptasks.priority.low': 'Низкий',
  // Misc
  'ptasks.clear': 'Сбросить',
  'ptasks.empty': 'Нет задач, соответствующих текущим фильтрам.',
  'ptasks.markDone': 'Отметить выполненной',
  'ptasks.openIn': 'Открыть в {app}',
  // Create form
  'ptasks.create.title': 'Создать задачу',
  'ptasks.create.success': 'Задача создана',
  'ptasks.create.titlePlaceholder': 'Название задачи',
  'ptasks.create.descPlaceholder': 'Опишите задачу, ожидаемый результат и как выглядит успех…',
  'ptasks.create.assigneePlaceholder': 'Назначить…',
  'ptasks.create.duePlaceholder': 'Срок выполнения',
  'ptasks.create.submit': 'Создать задачу',
  // AI take
  'ptasks.ai.title': 'Мнение ИИ',
  'ptasks.ai.body': 'Две заблокированные задачи (биллинг Meta, middleware авторизации) имеют наибольшее влияние на остальные. Биллинг разблокирует весь конвейер кампаний. После этого одобрение лендинга Palm и проверка лида в CRM выполнимы уже сегодня и сразу запускают импульс агентов.',
}

export const p_tasks = { en, ar, ru }
