"use client"

import type React from "react"
import { memo, useRef, useState, useEffect } from "react"
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import { Building2, Upload, X, Search, Loader2, MapPin } from "lucide-react"
import { getStatusColor } from "@/lib/creative-studio/node-utils"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export type ProductUploadNodeData = {
  // productImage / productName kept for engine compatibility (downstream image/video nodes)
  productImage?: string
  productName?: string
  // Real listing fields, pulled from live inventory
  propertyId?: string
  area?: string
  developer?: string
  price?: number | null
  bedrooms?: string
  propertyType?: string
  status?: "idle" | "running" | "completed" | "error"
  output?: string
  isExpanded?: boolean
  onUpdate?: (data: any) => void
}

type InvProperty = {
  id: string
  name: string
  area: string
  developer: string
  type: string
  startingPriceAED: number | null
  heroImage: string | null
  bedrooms: string
}

function fmtAED(n?: number | null): string {
  if (!n) return ""
  return `AED ${new Intl.NumberFormat("en-US").format(n)}`
}

function ProductUploadNode({ data, selected }: NodeProps<Node<ProductUploadNodeData>>) {
  const status = data.status || "idle"
  const isExpanded = data.isExpanded || false
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [properties, setProperties] = useState<InvProperty[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [q, setQ] = useState("")

  // Pull the real inventory the first time the node is opened.
  useEffect(() => {
    if (!isExpanded || loaded) return
    setLoading(true)
    fetch("/api/freehold/inventory")
      .then((r) => r.json())
      .then((d) => setProperties(Array.isArray(d.properties) ? d.properties : []))
      .catch(() => setProperties([]))
      .finally(() => { setLoading(false); setLoaded(true) })
  }, [isExpanded, loaded])

  const handleUpdate = (patch: Record<string, unknown>) => {
    if (data.onUpdate) {
      const { isExpanded, onUpdate, ...restData } = data
      data.onUpdate({ ...restData, ...patch })
    }
  }

  const selectProperty = (p: InvProperty) => {
    handleUpdate({
      propertyId: p.id,
      productName: p.name,
      productImage: p.heroImage || undefined,
      area: p.area,
      developer: p.developer,
      price: p.startingPriceAED,
      bedrooms: p.bedrooms,
      propertyType: p.type,
    })
  }

  const clearProperty = () => handleUpdate({ propertyId: undefined, productImage: undefined })

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => handleUpdate({ productImage: event.target?.result as string })
      reader.readAsDataURL(file)
    }
  }

  const stop = (e: React.MouseEvent) => e.stopPropagation()
  const filtered = properties
    .filter((p) => {
      const s = q.trim().toLowerCase()
      return !s || p.name.toLowerCase().includes(s) || p.area.toLowerCase().includes(s) || p.developer.toLowerCase().includes(s)
    })
    .slice(0, 40)

  return (
    <div className={`w-[260px] rounded-md border bg-card transition-colors duration-150 ${getStatusColor(status, selected)}`}>
      <div className="p-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-medium text-foreground">Property</span>
        </div>

        {!isExpanded && (
          <div className="mt-2 text-[10px] text-muted-foreground font-mono truncate">
            {data.productName ? `${data.productName}${data.area ? ` · ${data.area}` : ""}` : "No property selected"}
          </div>
        )}

        {isExpanded && (
          <div className="mt-3 space-y-3" onClick={stop}>
            {/* Selected property preview */}
            {data.productName && (
              <div className="rounded border border-border overflow-hidden bg-muted/20">
                {data.productImage && (
                  <img src={data.productImage} alt={data.productName} className="w-full h-auto max-h-[120px] object-cover" />
                )}
                <div className="p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] font-medium text-foreground truncate">{data.productName}</div>
                      <div className="mt-0.5 flex items-center gap-1 text-[9px] text-muted-foreground">
                        {data.area && <><MapPin className="h-2.5 w-2.5" />{data.area}</>}
                        {data.bedrooms && <span>· {data.bedrooms}</span>}
                      </div>
                      {data.price ? <div className="mt-0.5 text-[10px] text-amber-600 dark:text-amber-400">{fmtAED(data.price)}</div> : null}
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={(e) => { e.stopPropagation(); clearProperty() }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Live inventory picker */}
            <div className="space-y-1.5">
              <Label className="text-[10px] text-foreground font-medium">Pick from inventory</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} onMouseDown={stop} placeholder="Search project, area, developer…" className="h-8 pl-7 text-xs" />
              </div>
              <div className="max-h-[160px] overflow-y-auto rounded border border-border divide-y divide-border">
                {loading && <div className="flex items-center gap-2 p-2 text-[10px] text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Loading inventory…</div>}
                {!loading && filtered.length === 0 && <div className="p-2 text-[10px] text-muted-foreground">No properties in inventory yet.</div>}
                {!loading && filtered.map((p) => (
                  <button key={p.id} onClick={() => selectProperty(p)} className="flex w-full items-center gap-2 p-1.5 text-left hover:bg-muted/50">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                      {p.heroImage ? <img src={p.heroImage} alt="" className="h-full w-full object-cover" /> : <Building2 className="h-3.5 w-3.5 text-muted-foreground" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] text-foreground">{p.name}</span>
                      <span className="block truncate text-[9px] text-muted-foreground">{p.area}{p.developer ? ` · ${p.developer}` : ""}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Manual image override */}
            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground">Or upload a render / photo</Label>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              <Button variant="outline" className="w-full h-9 flex items-center gap-2 border-dashed bg-transparent" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}>
                <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">Upload image</span>
              </Button>
            </div>

            <p className="text-[9px] text-muted-foreground">
              The selected listing (name, area, price, beds) feeds the image, script and video prompts — so the reel is about a real property from your inventory.
            </p>
          </div>
        )}

        {status === "running" && (
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground/50" />
            processing
          </div>
        )}
      </div>

      <Handle type="target" position={Position.Left} id="input" className="!bg-muted-foreground/40 !border-0 !w-2 !h-2" style={{ top: "50%" }} />
      <Handle type="source" position={Position.Right} id="output" className="!bg-muted-foreground/40 !border-0 !w-2 !h-2" />
    </div>
  )
}

export default memo(ProductUploadNode)
