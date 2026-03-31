import { Button } from "@/components/ui/button"
import { Phone, Mail, MapPin, MessageCircle, Instagram } from "lucide-react"
import Link from "next/link"
import { ContactEnquiryForm } from "@/components/contact-enquiry-form"

export const metadata = {
  title: "Contact Us | ORE Real Estate",
  description: "Get in touch with ORE Real Estate - Schedule a consultation, ask questions, or visit our Dubai office.",
}

export default function ContactPage() {
  return (
    <>
        {/* Hero Section */}
        <section className="relative bg-[#0a0a0a] pt-32 pb-24 md:pt-40 md:pb-32 border-b border-border/10 overflow-hidden">
          <div className="absolute inset-0 z-0">
            {/* Animated bg glows */}
            <div className="absolute top-0 right-1/4 w-[600px] h-[300px] bg-gradient-to-b from-[#D4AF37]/20 to-transparent blur-[80px] opacity-60" />
            <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.15)_0%,transparent_50%)] rounded-full blur-[80px] mix-blend-screen animate-pulse duration-1000" />
          </div>
          <div className="container relative z-10">
            <div className="mx-auto max-w-4xl text-center flex flex-col items-center">
              <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-white/80 backdrop-blur-sm mb-8">
                  <span className="flex h-2 w-2 rounded-full bg-[#AA8122] mr-2"></span>
                  24/7 Priority Support
              </div>
              <h1 className="font-serif text-5xl font-bold tracking-tight md:text-6xl lg:text-7xl text-white leading-[1.1]">
                Get In <br className="hidden md:block"/>
                <span className="text-[#AA8122] italic">Touch</span>
              </h1>
              <p className="mt-8 text-xl text-white/70 leading-relaxed font-light max-w-2xl mx-auto">
                Connect with our premium advisory team. We provide expert, data-driven guidance for your next major investment in Dubai real estate.
              </p>
            </div>
          </div>
        </section>

        {/* Contact Content */}
        <section className="py-12 md:py-24">
          <div className="container">
            <div className="grid gap-12 lg:grid-cols-[1fr,1.8fr]">
              {/* Contact Info */}
              <div className="space-y-8 order-2 lg:order-1">
                <div>
                  <h2 className="font-serif text-3xl font-bold">Contact Details</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Direct access to our advisory team.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="flex items-start gap-4 p-5 rounded-2xl border bg-card shadow-sm">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ore-gradient">
                      <Phone className="h-6 w-6 text-black" />
                    </div>
                    <div>
                      <div className="font-bold text-sm">Call Center</div>
                      <a href="tel:+971526326541" className="text-base text-muted-foreground hover:text-primary transition-colors">
                        +971526326541
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-5 rounded-2xl border bg-card shadow-sm border-primary/20 bg-primary/5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-500 shadow-lg shadow-green-500/20">
                      <MessageCircle className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <div className="font-bold text-sm">WhatsApp</div>
                      <a href="https://wa.me/971526326541" className="text-base text-muted-foreground hover:text-green-600 transition-colors">
                        Available 24/7
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-5 rounded-2xl border bg-card shadow-sm">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ore-gradient">
                      <Mail className="h-6 w-6 text-black" />
                    </div>
                    <div>
                      <div className="font-bold text-sm">Email Support</div>
                      <a href="mailto:info@orerealestate.ae" className="text-base text-muted-foreground hover:text-primary transition-colors">
                        info@orerealestate.ae
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-5 rounded-2xl border bg-card shadow-sm">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ore-gradient">
                      <MapPin className="h-6 w-6 text-black" />
                    </div>
                    <div>
                      <div className="font-bold text-sm">Headquarters</div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Office 38 floor, Building The One Tower, Dubai Media City, Sheikh Zayed Road, Dubai
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-5 rounded-2xl border bg-card shadow-sm">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ore-gradient">
                      <Instagram className="h-6 w-6 text-black" />
                    </div>
                    <div>
                      <div className="font-bold text-sm">Instagram</div>
                      <a
                        href="https://www.instagram.com/ore.realestate/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base text-muted-foreground hover:text-primary transition-colors"
                      >
                        @ore.realestate
                      </a>
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-2xl border bg-muted/40 backdrop-blur-sm">
                  <h3 className="font-bold text-xs uppercase tracking-widest text-muted-foreground mb-4">Support Hours</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Mon - Sat</span>
                      <span className="text-foreground font-semibold">9:00 AM - 7:00 PM</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sunday</span>
                      <span className="text-foreground font-semibold">Online Only</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Form */}
              <div className="order-1 lg:order-2">
                <div className="rounded-[2rem] border border-border bg-card p-6 md:p-12 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16" />
                  
                  <h2 className="font-serif text-3xl md:text-4xl font-bold">Send Enquiry</h2>
                  <p className="mt-3 text-muted-foreground leading-relaxed">
                    Fill out the form and a senior investment consultant will contact you with a curated portfolio.
                  </p>

                  <ContactEnquiryForm />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Office Location */}
        <section className="border-t border-border bg-muted/30 py-12">
          <div className="container">
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="grid gap-6 bg-card p-8 md:grid-cols-2">
                  <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <div className="font-semibold">ORE Real Estate</div>
                    <div className="text-sm text-muted-foreground">
                      Office 38 floor, Building The One Tower, Media City, Dubai
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      Mon - Sat: 9:00 AM - 7:00 PM
                    </div>
                  </div>
                </div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div>
                      <span className="font-medium text-foreground">Phone:</span> +971526326541
                    </div>
                  <div>
                    <span className="font-medium text-foreground">Email:</span> info@orerealestate.ae
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Consultations:</span> By appointment
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Instagram:</span>{" "}
                    <a
                      href="https://www.instagram.com/ore.realestate/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary transition-colors"
                    >
                      @ore.realestate
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Links */}
        <section className="py-20">
          <div className="container">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="font-serif text-3xl font-bold">Prefer to Explore First?</h2>
              <p className="mt-4 text-muted-foreground">
                Browse our properties and market insights before reaching out
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Button size="lg" variant="outline" asChild>
                  <Link href="/properties">Browse Properties</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/market">Dubai Market Insights</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/chat">Ask AI Assistant</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
    </>
  )
}
