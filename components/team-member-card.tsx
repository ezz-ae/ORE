import { ArrowUpRight, Linkedin, User } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface TeamMemberCardProps {
  name: string
  title: string
  bio: string
  linkedinUrl?: string
  image?: string
  experience?: string
  specializations?: string[]
  specialties?: string[]
  className?: string
}

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")

export function TeamMemberCard({
  name,
  title,
  bio,
  linkedinUrl,
  image,
  experience,
  specializations,
  specialties,
  className,
}: TeamMemberCardProps) {
  const expertise = [...(specializations ?? specialties ?? [])].filter(Boolean).slice(0, 3)
  const initials = getInitials(name)

  return (
    <Card
      className={cn(
        "group h-full overflow-hidden border-border/60 bg-card hover:-translate-y-1 hover:border-[#C69B3E]/25 hover:shadow-[0_24px_48px_-24px_rgba(21,46,36,0.24)]",
        className,
      )}
    >
      <CardContent className="flex h-full flex-col p-6">
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16 rounded-2xl border border-[#C69B3E]/15 bg-[#C69B3E]/[0.08] shadow-sm">
            {image && <AvatarImage src={image} alt={name} className="object-cover" />}
            <AvatarFallback className="rounded-2xl bg-[#C69B3E]/[0.08] text-[#152E24]">
              {initials ? <span className="text-base font-semibold">{initials}</span> : <User className="h-5 w-5 text-[#C69B3E]" />}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <h3 className="font-serif text-xl font-bold leading-tight text-foreground group-hover:text-[#C69B3E] transition-colors">
              {name}
            </h3>
            <p className="mt-1 text-sm font-medium text-[#C69B3E]">{title}</p>
            {experience && (
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {experience}
              </p>
            )}
          </div>
        </div>

        {expertise.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {expertise.map((item) => (
              <Badge
                key={item}
                variant="secondary"
                className="rounded-full border-none bg-[#C69B3E]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8E6B21]"
              >
                {item}
              </Badge>
            ))}
          </div>
        )}

        <p className="mt-5 text-sm leading-relaxed text-muted-foreground line-clamp-4">{bio}</p>

        <div className="mt-auto flex items-center justify-between gap-4 border-t border-border/40 pt-5">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#C69B3E]/75">
              Advisory Team
            </div>
            <div className="text-sm text-muted-foreground">Premium Dubai real estate guidance</div>
          </div>

          {linkedinUrl && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-[#C69B3E]/20 bg-white px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#152E24] hover:border-[#C69B3E]/40 hover:bg-[#C69B3E]/[0.08] hover:text-[#152E24]"
              asChild
            >
              <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${name} LinkedIn profile`}>
                <Linkedin className="h-3.5 w-3.5" />
                LinkedIn
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
