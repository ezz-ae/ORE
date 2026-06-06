// WhatsApp link generators — no API, no credentials needed.
// These open the agent's own WhatsApp app with the lead's number + message pre-filled.

export function waAppLink(phone: string, text = ''): string {
  const clean = phone.replace(/\D/g, '')
  return text
    ? `https://wa.me/${clean}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${clean}`
}

export function waWebLink(phone: string, text = ''): string {
  const clean = phone.replace(/\D/g, '')
  return text
    ? `https://web.whatsapp.com/send?phone=${clean}&text=${encodeURIComponent(text)}`
    : `https://web.whatsapp.com/send?phone=${clean}`
}
