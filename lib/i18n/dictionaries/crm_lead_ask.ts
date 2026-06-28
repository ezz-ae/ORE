// "Ask the Expert about this lead" strip on the CRM lead detail page.
type Dict = Record<string, string>

const en: Dict = {
  'crm.lead.askTitle': 'Ask the Expert about this lead',
  'crm.lead.ask.q1': 'What is the best next step to convert {name}?',
  'crm.lead.ask.q2': 'Draft a follow-up message for {name}.',
  'crm.lead.ask.q3': "Assess {name}'s intent and risk of going cold.",
}

const ar: Dict = {
  'crm.lead.askTitle': 'اسأل الخبير عن هذا العميل المحتمل',
  'crm.lead.ask.q1': 'ما أفضل خطوة تالية لتحويل {name}؟',
  'crm.lead.ask.q2': 'صُغ رسالة متابعة لـ {name}.',
  'crm.lead.ask.q3': 'قيّم نية {name} وخطر فتوره.',
}

const ru: Dict = {
  'crm.lead.askTitle': 'Спросите Эксперта об этом лиде',
  'crm.lead.ask.q1': 'Какой следующий шаг лучше всего конвертирует {name}?',
  'crm.lead.ask.q2': 'Составьте сообщение-касание для {name}.',
  'crm.lead.ask.q3': 'Оцените намерение {name} и риск охлаждения.',
}

export const crm_lead_ask = { en, ar, ru }
