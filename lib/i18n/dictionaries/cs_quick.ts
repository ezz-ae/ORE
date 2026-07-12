// Creative Studio — smart-form (quick) generation mode. The one-screen
// alternative to the node canvas: pick a presenter + property + format, hit
// Generate, save to the Drive. Trilingual for the handover.
type Dict = Record<string, string>

const en: Dict = {
  'cs.quick.title': 'Quick Creative',
  'cs.quick.subtitle': 'Pick a presenter, a property and a format — generate a marketing image in one screen.',
  'cs.quick.link': 'Quick Creative',
  'cs.quick.openCanvas': 'Open the canvas',
  'cs.quick.presenter': 'Presenter',
  'cs.quick.none': 'None',
  'cs.quick.noFace': 'No saved face yet — generate one on the canvas to reuse it.',
  'cs.quick.property': 'Property',
  'cs.quick.noProperty': 'No property',
  'cs.quick.format': 'Format',
  'cs.quick.brief': 'Brief',
  'cs.quick.briefPh': 'Optional art direction — mood, colours, focus…',
  'cs.quick.generate': 'Generate',
  'cs.quick.generating': 'Generating…',
  'cs.quick.save': 'Save to Drive',
  'cs.quick.saved': 'Saved to your Drive.',
  'cs.quick.regenerate': 'Regenerate',
  'cs.quick.failed': 'Generation failed. Try again.',
  'cs.quick.noPresenterUsed': 'No saved face for this presenter yet, so it was generated without one. Generate the face on the canvas to reuse it.',
  'cs.quick.reusable': 'Reusable face',
}

const ar: Dict = {
  'cs.quick.title': 'إبداع سريع',
  'cs.quick.subtitle': 'اختر مقدّمًا وعقارًا وصيغة — وأنشئ صورة تسويقية في شاشة واحدة.',
  'cs.quick.link': 'إبداع سريع',
  'cs.quick.openCanvas': 'افتح لوحة التصميم',
  'cs.quick.presenter': 'المقدّم',
  'cs.quick.none': 'بلا',
  'cs.quick.noFace': 'لا يوجد وجه محفوظ بعد — أنشئ واحدًا في لوحة التصميم لإعادة استخدامه.',
  'cs.quick.property': 'العقار',
  'cs.quick.noProperty': 'بدون عقار',
  'cs.quick.format': 'الصيغة',
  'cs.quick.brief': 'الموجز',
  'cs.quick.briefPh': 'توجيه فني اختياري — الأجواء والألوان ونقطة التركيز…',
  'cs.quick.generate': 'إنشاء',
  'cs.quick.generating': 'جارٍ الإنشاء…',
  'cs.quick.save': 'حفظ في Drive',
  'cs.quick.saved': 'تم الحفظ في Drive الخاص بك.',
  'cs.quick.regenerate': 'إعادة الإنشاء',
  'cs.quick.failed': 'فشل الإنشاء. حاول مرة أخرى.',
  'cs.quick.noPresenterUsed': 'لا يوجد وجه محفوظ لهذا المقدّم بعد، لذا تم الإنشاء بدونه. أنشئ الوجه في لوحة التصميم لإعادة استخدامه.',
  'cs.quick.reusable': 'وجه قابل لإعادة الاستخدام',
}

const ru: Dict = {
  'cs.quick.title': 'Быстрый креатив',
  'cs.quick.subtitle': 'Выберите ведущего, объект и формат — и создайте маркетинговое изображение на одном экране.',
  'cs.quick.link': 'Быстрый креатив',
  'cs.quick.openCanvas': 'Открыть холст',
  'cs.quick.presenter': 'Ведущий',
  'cs.quick.none': 'Нет',
  'cs.quick.noFace': 'Сохранённого лица пока нет — создайте его на холсте, чтобы использовать повторно.',
  'cs.quick.property': 'Объект',
  'cs.quick.noProperty': 'Без объекта',
  'cs.quick.format': 'Формат',
  'cs.quick.brief': 'Бриф',
  'cs.quick.briefPh': 'Необязательная арт-дирекция — настроение, цвета, акцент…',
  'cs.quick.generate': 'Создать',
  'cs.quick.generating': 'Создание…',
  'cs.quick.save': 'Сохранить в Drive',
  'cs.quick.saved': 'Сохранено в вашем Drive.',
  'cs.quick.regenerate': 'Создать заново',
  'cs.quick.failed': 'Не удалось создать. Попробуйте снова.',
  'cs.quick.noPresenterUsed': 'Для этого ведущего пока нет сохранённого лица, поэтому изображение создано без него. Создайте лицо на холсте, чтобы использовать повторно.',
  'cs.quick.reusable': 'Повторно используемое лицо',
}

export const cs_quick = { en, ar, ru }
