// Integrations cluster — EN/AR/RU. Provider names (Meta, Google, HubSpot,
// WhatsApp, GitHub) are brand names and stay untranslated.
type Dict = Record<string, string>

const en: Dict = {
  'integrations.apps': 'Apps',
  'integrations.title': 'Integrations',
  'integrations.tab.overview': 'Overview',
  'integrations.headerHint': 'Connect your tools',
}

const ar: Dict = {
  'integrations.apps': 'التطبيقات',
  'integrations.title': 'التكاملات',
  'integrations.tab.overview': 'نظرة عامة',
  'integrations.headerHint': 'اربط أدواتك',
}

const ru: Dict = {
  'integrations.apps': 'Приложения',
  'integrations.title': 'Интеграции',
  'integrations.tab.overview': 'Обзор',
  'integrations.headerHint': 'Подключите инструменты',
}

export const integrations = { en, ar, ru }
