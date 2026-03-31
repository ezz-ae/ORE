"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Download } from "lucide-react"

interface ProjectPdfDownloadProps {
  slug: string
}

export function ProjectPdfDownload({ slug }: ProjectPdfDownloadProps) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    if (!name.trim() || !phone.trim()) {
      return
    }
    setLoading(true)
    try {
      const response = await fetch("/api/pdf/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          name,
          phone,
          email,
          source: "project-page-download",
        }),
      })

      if (!response.ok) {
        throw new Error("PDF download failed")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${slug}-project.pdf`
      link.click()
      window.URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="lg" className="ore-gradient">
          <Download className="mr-2 h-5 w-5" />
          Download Project PDF
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Download Project Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="lead-name">Full Name *</Label>
            <Input id="lead-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="lead-phone">Phone Number *</Label>
            <Input id="lead-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="lead-email">Email (optional)</Label>
            <Input id="lead-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button className="w-full ore-gradient" disabled={loading || !name || !phone} onClick={handleDownload}>
            {loading ? "Preparing PDF..." : "Download Now"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
