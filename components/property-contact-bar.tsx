"use client"

import { Button } from "@/components/ui/button"
import { Phone, MessageSquare } from "lucide-react"
import { COMPANY_PHONE_E164, COMPANY_WHATSAPP_URL } from '@/lib/site'

export function PropertyContactBar() {
  return (
    <div className="sticky bottom-0 z-50 lg:hidden">
      <div className="grid grid-cols-2 gap-px border-t border-border bg-background">
        <Button
          size="lg"
          variant="ghost"
          className="rounded-none"
          asChild
        >
          <a href={`tel:${COMPANY_PHONE_E164}`}>
            <Phone className="mr-2 h-4 w-4" />
            Call Now
          </a>
        </Button>
        <Button
          size="lg"
          className="rounded-none ore-gradient text-black"
          asChild
        >
          <a href={COMPANY_WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
            <MessageSquare className="mr-2 h-4 w-4" />
            WhatsApp
          </a>
        </Button>
      </div>
    </div>
  )
}
