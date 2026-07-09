"use client"

import type React from "react"
import { memo, useRef, useState, useEffect } from "react"
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import { Building2, Upload, X, Search, Loader2, MapPin, Sparkles, FileText, ImagePlus } from "lucide-react"
import { toast } from "sonner"
import { getStatusColor } from "@/lib/creative-studio/node-utils"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useT } from "@/lib/i18n/provider"

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
  // Media & brief editor
  environmentImage?: string
  brochureName?: string
  brochureData?: string
  link?: string
  notes?: string
  brief?: string
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
  const t = useT()
  const status = data.status || "idle"
  const isExpanded = data.isExpanded || false
  const fileInputRef = useRef<HTMLInputElement>(null)
  const envInputRef = useRef<HTMLInputElement>(null)
  const brochureInputRef = useRef<HTMLInputElement>(null)

  const [properties, setProperties] = useState<InvProperty[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [q, setQ] = useState("")
  const [writing, setWriting] = useState(false)

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

  const readAsDataUrl = (file: File, onDone: (dataUrl: string) => void) => {
    const reader = new FileReader()
    reader.onload = (event) => onDone(event.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) readAsDataUrl(file, (d) => handleUpdate({ productImage: d }))
  }

  const handleEnvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) readAsDataUrl(file, (d) => handleUpdate({ environmentImage: d }))
  }

  const handleBrochureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) readAsDataUrl(file, (d) => handleUpdate({ brochureData: d, brochureName: file.name }))
  }

  // Ask the AI to write an image-generation prompt from the property + info.
  const handleWritePrompt = async () => {
    setWriting(true)
    try {
      const res = await fetch("/api/freehold/creative-studio/write-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property: { name: data.productName, area: data.area, developer: data.developer, price: data.price, bedrooms: data.bedrooms },
          notes: data.notes || "",
          link: data.link || "",
          brochureData: data.brochureData || "",
          brochureMime: "application/pdf",
        }),
      })
      const d = await res.json()
      if (d.prompt) { handleUpdate({ brief: d.prompt }); toast.success(t("pcsn.prop.briefDone")) }
      else toast.error(d.error || t("pcsn.prop.briefFail"))
    } catch {
      toast.error(t("pcsn.prop.briefFail"))
    } finally {
      setWriting(false)
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
          <span className="text-[11px] font-medium text-foreground">{t("pcsn.node.property")}</span>
        </div>

        {!isExpanded && (
          <div className="mt-2 text-[10px] text-muted-foreground font-mono truncate">
            {data.productName ? `${data.productName}${data.area ? ` · ${data.area}` : ""}` : t("pcsn.prop.noneSelected")}
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
              <Label className="text-[10px] text-foreground font-medium">{t("pcsn.prop.pick")}</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} onMouseDown={stop} placeholder={t("pcsn.prop.search")} className="h-8 pl-7 text-xs" />
              </div>
              <div className="max-h-[160px] overflow-y-auto rounded border border-border divide-y divide-border">
                {loading && <div className="flex items-center gap-2 p-2 text-[10px] text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />{t("pcsn.prop.loading")}</div>}
                {!loading && filtered.length === 0 && <div className="p-2 text-[10px] text-muted-foreground">{t("pcsn.prop.none")}</div>}
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
              <Label className="text-[10px] text-muted-foreground">{t("pcsn.prop.upload")}</Label>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              <Button variant="outline" className="w-full h-9 flex items-center gap-2 border-dashed bg-transparent" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}>
                <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">{t("pcsn.prop.uploadBtn")}</span>
              </Button>
            </div>

            {/* Media & brief editor */}
            <div className="space-y-2 rounded border border-border bg-muted/10 p-2">
              <Label className="text-[10px] text-foreground font-medium">{t("pcsn.prop.mediaBrief")}</Label>

              <div className="grid grid-cols-2 gap-1.5">
                <input ref={envInputRef} type="file" accept="image/*" onChange={handleEnvUpload} className="hidden" />
                <Button variant="outline" className="h-8 gap-1.5 border-dashed bg-transparent px-2" onClick={(e) => { e.stopPropagation(); envInputRef.current?.click() }}>
                  <ImagePlus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-[9px] text-muted-foreground truncate">{data.environmentImage ? t("pcsn.prop.envSet") : t("pcsn.prop.env")}</span>
                </Button>
                <input ref={brochureInputRef} type="file" accept="application/pdf" onChange={handleBrochureUpload} className="hidden" />
                <Button variant="outline" className="h-8 gap-1.5 border-dashed bg-transparent px-2" onClick={(e) => { e.stopPropagation(); brochureInputRef.current?.click() }}>
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-[9px] text-muted-foreground truncate">{data.brochureName || t("pcsn.prop.brochure")}</span>
                </Button>
              </div>

              <Input value={data.link || ""} onChange={(e) => handleUpdate({ link: e.target.value })} onMouseDown={stop}
                placeholder={t("pcsn.prop.linkPh")} className="h-8 text-xs" />
              <Textarea value={data.notes || ""} onChange={(e) => handleUpdate({ notes: e.target.value })} onMouseDown={stop}
                placeholder={t("pcsn.prop.notesPh")} className="min-h-[48px] text-xs resize-none" />

              <Button className="w-full h-8 gap-1.5 text-[10px]" disabled={writing} onClick={(e) => { e.stopPropagation(); handleWritePrompt() }}>
                {writing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {writing ? t("pcsn.prop.writing") : t("pcsn.prop.writePrompt")}
              </Button>

              {data.brief && (
                <div className="space-y-1">
                  <Label className="text-[9px] text-emerald-500">{t("pcsn.prop.brief")}</Label>
                  <Textarea value={data.brief} onChange={(e) => handleUpdate({ brief: e.target.value })} onMouseDown={stop}
                    className="min-h-[64px] text-xs resize-none border-emerald-500/30" />
                </div>
              )}
            </div>

            <p className="text-[9px] text-muted-foreground">{t("pcsn.prop.help")}</p>
          </div>
        )}

        {status === "running" && (
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground/50" />
            {t("pcsn.processing")}
          </div>
        )}
      </div>

      <Handle type="target" position={Position.Left} id="input" className="!bg-muted-foreground/40 !border-0 !w-2 !h-2" style={{ top: "50%" }} />
      <Handle type="source" position={Position.Right} id="output" className="!bg-muted-foreground/40 !border-0 !w-2 !h-2" />
    </div>
  )
}

export default memo(ProductUploadNode)
