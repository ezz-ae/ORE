import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AiTrainingForm, TrainingProject } from "@/components/ai-training-form"
import { AiTrainingRequestList } from "@/components/ai-training-request-list"
import { Badge } from "@/components/ui/badge"
import { AiTrainingRequest } from "@/lib/ai-training"

interface AiTrainingCardProps {
  projects: TrainingProject[]
  requests: AiTrainingRequest[]
}

export function AiTrainingCard({ projects, requests }: AiTrainingCardProps) {
  const pendingCount = requests.filter((request) => request.status === "pending").length
  const trainedCount = requests.filter((request) => request.status === "trained").length

  return (
    <Card className="rounded-[2rem] border-border shadow-lg overflow-hidden">
      <CardHeader className="p-8 border-b border-border/50 bg-muted/20">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="font-serif text-2xl font-bold">Model Training Protocol</CardTitle>
            <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
              Direct Knowledge injection for Gemini
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Badge variant="secondary" className="rounded-full px-3 bg-amber-500/10 text-amber-600 border-amber-500/20 font-bold text-[10px]">{pendingCount} Active Requests</Badge>
            <Badge variant="outline" className="rounded-full px-3 border-emerald-500/20 text-emerald-600 bg-emerald-500/5 font-bold text-[10px]">{trainedCount} Model updates</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid divide-y lg:divide-y-0 lg:divide-x divide-border/50 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="p-8">
            <h4 className="font-serif text-lg font-bold mb-6">Inject Knowledge</h4>
            <AiTrainingForm projects={projects} />
          </div>
          <div className="p-8 bg-muted/10">
            <h4 className="font-serif text-lg font-bold mb-6">Instruction History</h4>
            <AiTrainingRequestList requests={requests} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
