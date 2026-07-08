"use client"

import type React from "react"
import { memo, useRef } from "react"
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import { Package, Upload, X } from "lucide-react"
import { getStatusColor } from "@/lib/creative-studio/node-utils"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export type ProductUploadNodeData = {
  productImage?: string
  productName?: string
  status?: "idle" | "running" | "completed" | "error"
  output?: string
  isExpanded?: boolean
  onUpdate?: (data: any) => void
}

function ProductUploadNode({ data, selected }: NodeProps<Node<ProductUploadNodeData>>) {
  const status = data.status || "idle"
  const isExpanded = data.isExpanded || false
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpdate = (field: string, value: any) => {
    if (data.onUpdate) {
      const { isExpanded, onUpdate, ...restData } = data
      data.onUpdate({ ...restData, [field]: value })
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const base64 = event.target?.result as string
        handleUpdate("productImage", base64)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveImage = () => {
    handleUpdate("productImage", undefined)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  return (
    <div
      className={`w-[260px] rounded-md border bg-card transition-colors duration-150 ${getStatusColor(status, selected)}`}
    >
      <div className="p-3">
        <div className="flex items-center gap-2">
          <Package className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-medium text-foreground">Product Image</span>
        </div>

        {!isExpanded && (
          <div className="mt-2 text-[10px] text-muted-foreground font-mono truncate">
            {data.productImage ? (data.productName || "Image uploaded") : "No image uploaded"}
          </div>
        )}

        {isExpanded && (
          <div className="mt-3 space-y-3" onClick={stopPropagation}>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-foreground font-medium">Product Name (required for best results)</Label>
              <Input
                value={data.productName || ""}
                onChange={(e) => handleUpdate("productName", e.target.value)}
                onMouseDown={stopPropagation}
                placeholder="e.g., White Skincare Serum Bottle"
                className="h-8 text-xs font-mono"
              />
              <p className="text-[9px] text-amber-600 dark:text-amber-400">
                Describe your product clearly - this is used in the image generation prompt.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground">Product Image</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              
              {data.productImage ? (
                <div className="relative rounded border border-border overflow-hidden">
                  <img 
                    src={data.productImage || "/placeholder.svg"} 
                    alt="Product" 
                    className="w-full h-auto max-h-[150px] object-contain bg-muted/30"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-1 right-1 h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveImage()
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full h-24 flex flex-col gap-2 border-dashed bg-transparent"
                  onClick={(e) => {
                    e.stopPropagation()
                    fileInputRef.current?.click()
                  }}
                >
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Click to upload product image</span>
                </Button>
              )}
            </div>

            <p className="text-[9px] text-muted-foreground">
              The product name is used to describe what the model is holding in the generated image.
              The uploaded image is for reference only (most AI models cannot copy exact products).
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

      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="!bg-muted-foreground/40 !border-0 !w-2 !h-2"
        style={{ top: "50%" }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="!bg-muted-foreground/40 !border-0 !w-2 !h-2"
      />
    </div>
  )
}

export default memo(ProductUploadNode)
