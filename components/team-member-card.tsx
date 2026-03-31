import { Linkedin, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface TeamMemberCardProps {
  name: string
  title: string
  bio: string
  linkedinUrl?: string
}

export function TeamMemberCard({ name, title, bio, linkedinUrl }: TeamMemberCardProps) {
  return (
    <Card className="text-center">
      <CardContent className="p-6">
        <h3 className="font-serif text-xl font-bold">{name}</h3>
        <p className="text-sm font-medium text-primary">{title}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          {bio}
        </p>
        {linkedinUrl && (
          <Button variant="outline" size="icon" className="mt-4 rounded-full h-8 w-8" asChild>
            <a href={linkedinUrl} target="_blank" rel="noopener noreferrer">
              <Linkedin className="h-4 w-4" />
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
