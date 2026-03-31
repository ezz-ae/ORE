import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Badge } from "@/components/ui/badge"
import { MapPin, Layers, Target } from "lucide-react"

export default function MapPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 relative min-h-[600px] bg-muted/10 overflow-hidden">
        {/* Placeholder Map Background */}
        <div className="absolute inset-0 bg-[url('/images/map-placeholder.png')] bg-cover bg-center opacity-40 grayscale" />
        
        {/* Map UI Overlay */}
        <div className="absolute top-10 left-10 z-10 space-y-4">
          <div className="bg-background/90 backdrop-blur border border-border rounded-lg p-6 shadow-xl max-w-md">
            <Badge className="mb-3 ore-gradient">Spatial View</Badge>
            <h1 className="font-serif text-3xl font-bold">Project Clusters</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Visualize supply and demand across Dubai’s master-planned communities.
            </p>
            
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50 border border-border">
                <Layers className="h-5 w-5 text-primary" />
                <div className="text-sm font-medium">Heatmap: Absorption Rate</div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50 border border-border">
                <MapPin className="h-5 w-5 text-primary" />
                <div className="text-sm font-medium">Clusters: 975 Active Sites</div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50 border border-border">
                <Target className="h-5 w-5 text-primary" />
                <div className="text-sm font-medium">Selected: Dubai Marina</div>
              </div>
            </div>
          </div>
        </div>

        {/* Cluster dots placeholder */}
        <div className="absolute top-1/4 left-1/2 w-12 h-12 rounded-full ore-gradient opacity-80 animate-pulse border-4 border-white shadow-2xl" />
        <div className="absolute top-1/2 left-1/3 w-8 h-8 rounded-full bg-primary/60 animate-pulse border-2 border-white" />
        <div className="absolute top-2/3 left-2/3 w-10 h-10 rounded-full bg-primary/60 animate-pulse border-2 border-white" />
      </main>
      <SiteFooter />
    </div>
  )
}
