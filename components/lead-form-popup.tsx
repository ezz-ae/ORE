"use client"

import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { LeadForm } from "@/components/lead-form"

// Inline SVG for Sparkles (to avoid lucide-react HMR issues)
const SparklesIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    <path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>
  </svg>
)

interface LeadFormPopupProps {
  buttonLabel?: string
  buttonClassName?: string
  buttonSize?: "default" | "sm" | "lg" | "icon"
}

export function LeadFormPopup({
  buttonLabel = "Request a Consultation",
  buttonClassName,
  buttonSize = "lg",
}: LeadFormPopupProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          className={cn("ore-gradient flex items-center justify-center rounded-full font-bold uppercase tracking-widest text-[10px] border-none shadow-xl", buttonClassName)}
          size={buttonSize}
        >
          <SparklesIcon className="mr-2" />
          {buttonLabel}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="w-[min(720px,92vw)] max-w-[720px] mx-auto border-none p-0 shadow-2xl bg-transparent">
        <SheetTitle className="sr-only">Request a consultation</SheetTitle>
        <div className="relative rounded-t-[3rem] bg-[#FBF9F6] p-10 lg:p-16 border-t border-[#163327]/05">
          <div className="mb-10 text-center max-w-lg mx-auto">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#C5A059] mb-4">
              Institutional Intelligence
            </p>
            <h2 className="font-serif text-4xl lg:text-5xl font-bold text-[#163327] mb-6">Briefing Request</h2>
            <p className="text-[15px] text-[#163327]/60 leading-relaxed font-light">
              Submit your requirements for a personalized project briefing from our senior conviction desk.
            </p>
          </div>
          <LeadForm />
          
          <div className="mt-12 pt-8 border-t border-[#163327]/05 text-center">
            <p className="text-[10px] text-[#163327]/30 uppercase tracking-[0.2em]">Media City Headquarters · Dubai, UAE</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
