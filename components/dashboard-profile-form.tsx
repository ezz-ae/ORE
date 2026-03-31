"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"

interface ProfileFormProps {
  initialProfile?: {
    id?: string
    name?: string
    email?: string
    role?: string
    org_title?: string | null
    phone?: string | null
    commission_rate?: number | null
    language?: string | null
    ai_tone?: string | null
    ai_verbosity?: string | null
    notifications?: Record<string, boolean> | null
  } | null
  canEditRole?: boolean
}

const roles = ["CEO", "General Manager", "Admin", "Sales Manager", "Broker"]
const tones = ["Professional", "Concise", "Consultative", "Executive"]
const verbosityLevels = ["Short", "Balanced", "Detailed"]
const languages = ["English", "Arabic"]

export function DashboardProfileForm({ initialProfile, canEditRole }: ProfileFormProps) {
  const [form, setForm] = useState({
    id: initialProfile?.id || "",
    name: initialProfile?.name || "",
    email: initialProfile?.email || "",
    role: initialProfile?.org_title || initialProfile?.role || "Broker",
    phone: initialProfile?.phone || "",
    commissionRate: initialProfile?.commission_rate?.toString() || "",
    language: initialProfile?.language || "English",
    aiTone: initialProfile?.ai_tone || "Professional",
    aiVerbosity: initialProfile?.ai_verbosity || "Balanced",
    notifications: {
      email: initialProfile?.notifications?.email ?? true,
      whatsapp: initialProfile?.notifications?.whatsapp ?? false,
      sms: initialProfile?.notifications?.sms ?? false,
    },
    password: "",
  })
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [message, setMessage] = useState<string>("")

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    window.location.href = "/crm/login"
  }

  const handleChange = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setStatus("saving")
    setMessage("")
    try {
      const response = await fetch("/api/dashboard/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          notifications: form.notifications,
          password: form.password || undefined,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "Failed to save profile")
      }
      setForm({
        id: data.profile.id,
        name: data.profile.name,
        email: data.profile.email,
        role: data.profile.org_title || data.profile.role,
        phone: data.profile.phone || "",
        commissionRate: data.profile.commission_rate?.toString() || "",
        language: data.profile.language || "English",
        aiTone: data.profile.ai_tone || "Professional",
        aiVerbosity: data.profile.ai_verbosity || "Balanced",
        notifications: {
          email: data.profile.notifications?.email ?? true,
          whatsapp: data.profile.notifications?.whatsapp ?? false,
          sms: data.profile.notifications?.sms ?? false,
        },
        password: "",
      })
      setStatus("saved")
      setMessage("Profile saved.")
    } catch (error: any) {
      setStatus("error")
      setMessage(error?.message || "Failed to save profile.")
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Personal details</div>
            <p className="text-sm text-muted-foreground">
              Keep your contact details and AI working style up to date.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Input placeholder="Full Name" value={form.name} onChange={handleChange("name")} required />
            <Input placeholder="Email" type="email" value={form.email} onChange={handleChange("email")} required />
            <Input placeholder="Phone" value={form.phone} onChange={handleChange("phone")} />
            <Input
              placeholder="Commission Rate (%)"
              type="number"
              value={form.commissionRate}
              onChange={handleChange("commissionRate")}
            />
            <select
              value={form.role}
              onChange={handleChange("role")}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              disabled={!canEditRole}
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <Input placeholder="Your CRM access ID" value={form.id} readOnly disabled />
          </div>
          {!canEditRole ? (
            <p className="text-xs text-muted-foreground">Your access level is managed by leadership.</p>
          ) : null}

          <div className="space-y-1 pt-2">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">How AI should help you</div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <select
              value={form.language}
              onChange={handleChange("language")}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              {languages.map((language) => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}
            </select>
            <select
              value={form.aiTone}
              onChange={handleChange("aiTone")}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              {tones.map((tone) => (
                <option key={tone} value={tone}>
                  {tone}
                </option>
              ))}
            </select>
            <select
              value={form.aiVerbosity}
              onChange={handleChange("aiVerbosity")}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              {verbosityLevels.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 md:grid-cols-3 text-xs text-muted-foreground">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.notifications.email}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    notifications: { ...prev.notifications, email: event.target.checked },
                  }))
                }
              />
              Email notifications
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.notifications.whatsapp}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    notifications: { ...prev.notifications, whatsapp: event.target.checked },
                  }))
                }
              />
              WhatsApp alerts
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.notifications.sms}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    notifications: { ...prev.notifications, sms: event.target.checked },
                  }))
                }
              />
              SMS alerts
            </label>
          </div>

          <Input
            placeholder="Set a new password if needed"
            type="password"
            value={form.password}
            onChange={handleChange("password")}
          />
          <div className="flex flex-wrap gap-3">
            <Button type="submit" className="ore-gradient" disabled={status === "saving"}>
              {status === "saving" ? "Saving..." : "Save Profile"}
            </Button>
            <Button type="button" variant="outline" onClick={handleLogout}>
              Logout
            </Button>
          </div>
          {message && (
            <div className={`text-xs ${status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
              {message}
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
