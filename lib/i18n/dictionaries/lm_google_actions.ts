// Interactive mutation strings for the Google Ads sub-pages (add/remove
// keywords, create audiences/extensions). Kept in their own file so EN/AR/RU
// parity is trivial to maintain.
type Dict = Record<string, string>

const en: Dict = {
  'lm.google.keywords.addPlaceholder': 'Add a keyword…',
  'lm.google.keywords.addBtn': 'Add',
  'lm.google.keywords.added': 'Keyword added',
  'lm.google.keywords.removed': 'Keyword removed',
  'lm.google.keywords.matchBroad': 'Broad',
  'lm.google.keywords.matchPhrase': 'Phrase',
  'lm.google.keywords.matchExact': 'Exact',
  'lm.google.audiences.newPlaceholder': 'New audience name…',
  'lm.google.audiences.addBtn': 'Create',
  'lm.google.audiences.added': 'Audience created',
  'lm.google.extensions.newPlaceholder': 'New sitelink or callout text…',
  'lm.google.extensions.addBtn': 'Create',
  'lm.google.extensions.added': 'Extension created',
  'lm.google.actions.failed': 'Action failed — try again',
}

const ar: Dict = {
  'lm.google.keywords.addPlaceholder': 'أضف كلمة مفتاحية…',
  'lm.google.keywords.addBtn': 'إضافة',
  'lm.google.keywords.added': 'تمت إضافة الكلمة المفتاحية',
  'lm.google.keywords.removed': 'تمت إزالة الكلمة المفتاحية',
  'lm.google.keywords.matchBroad': 'واسع',
  'lm.google.keywords.matchPhrase': 'عبارة',
  'lm.google.keywords.matchExact': 'مطابق',
  'lm.google.audiences.newPlaceholder': 'اسم جمهور جديد…',
  'lm.google.audiences.addBtn': 'إنشاء',
  'lm.google.audiences.added': 'تم إنشاء الجمهور',
  'lm.google.extensions.newPlaceholder': 'نص رابط فرعي أو وصف إضافي جديد…',
  'lm.google.extensions.addBtn': 'إنشاء',
  'lm.google.extensions.added': 'تم إنشاء الإضافة',
  'lm.google.actions.failed': 'فشل الإجراء — حاول مرة أخرى',
}

const ru: Dict = {
  'lm.google.keywords.addPlaceholder': 'Добавить ключевое слово…',
  'lm.google.keywords.addBtn': 'Добавить',
  'lm.google.keywords.added': 'Ключевое слово добавлено',
  'lm.google.keywords.removed': 'Ключевое слово удалено',
  'lm.google.keywords.matchBroad': 'Широкое',
  'lm.google.keywords.matchPhrase': 'Фразовое',
  'lm.google.keywords.matchExact': 'Точное',
  'lm.google.audiences.newPlaceholder': 'Название новой аудитории…',
  'lm.google.audiences.addBtn': 'Создать',
  'lm.google.audiences.added': 'Аудитория создана',
  'lm.google.extensions.newPlaceholder': 'Текст нового подссылки или уточнения…',
  'lm.google.extensions.addBtn': 'Создать',
  'lm.google.extensions.added': 'Расширение создано',
  'lm.google.actions.failed': 'Не удалось выполнить — попробуйте снова',
}

export const lm_google_actions = { en, ar, ru }
