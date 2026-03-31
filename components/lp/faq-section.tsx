import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { SectionShell } from "@/components/lp/section-shell"

interface FaqSectionProps {
  data: Record<string, unknown>
}

const DEFAULT_FAQS = [
  {
    question: "Is this project freehold for international buyers?",
    answer:
      "Yes, this campaign focuses on investor-friendly opportunities in eligible freehold zones with clear ownership transfer.",
  },
  {
    question: "Can I reserve a unit remotely?",
    answer:
      "Yes. Our team can guide you through reservation, documentation, and payment coordination without needing to be physically in Dubai.",
  },
  {
    question: "Do you provide payment-plan guidance?",
    answer:
      "Yes. We match you with suitable installment structures based on cashflow goals and target hold period.",
  },
  {
    question: "What happens after I submit the form?",
    answer:
      "A senior investment consultant will contact you with current availability, pricing, and a tailored shortlist.",
  },
]

export function FaqSection({ data }: FaqSectionProps) {
  const title = (typeof data.title === "string" && data.title) || "Frequently Asked Questions"
  const subtitle =
    (typeof data.subtitle === "string" && data.subtitle) || "Campaign-ready answers for common objections."

  const items = Array.isArray(data.items)
    ? data.items
        .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : null))
        .filter(Boolean)
        .map((item) => ({
          question: typeof item?.question === "string" ? item.question : "",
          answer: typeof item?.answer === "string" ? item.answer : "",
        }))
        .filter((item) => item.question && item.answer)
    : []
  const faqs = items.length ? items : DEFAULT_FAQS

  return (
    <SectionShell id="faq" title={title} subtitle={subtitle}>
      <Accordion type="single" collapsible className="rounded-2xl border bg-card px-5">
        {faqs.map((item, index) => (
          <AccordionItem key={`${item.question}-${index}`} value={`faq-${index}`}>
            <AccordionTrigger className="text-left">{item.question}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{item.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </SectionShell>
  )
}
