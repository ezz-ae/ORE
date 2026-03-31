"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function DashboardLoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: "", password: "" })
  const [setupForm, setSetupForm] = useState({
    name: "CRM Admin",
    email: "",
    password: "",
    setupKey: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isSetupLoading, setIsSetupLoading] = useState(false)
  const [error, setError] = useState("")
  const [setupError, setSetupError] = useState("")

  const handleChange = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
  }

  const handleSetupChange =
    (key: keyof typeof setupForm) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setSetupForm((prev) => ({ ...prev, [key]: event.target.value }))
    }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsLoading(true)
    setError("")
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "Login failed.")
      }
      router.push("/crm/overview")
    } catch (err: any) {
      setError(err?.message || "Login failed.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSetupSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSetupLoading(true)
    setSetupError("")
    try {
      const response = await fetch("/api/auth/bootstrap-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(setupForm),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "Failed to initialize admin access.")
      }
      router.push("/crm/overview")
    } catch (err: any) {
      setSetupError(err?.message || "Failed to initialize admin access.")
    } finally {
      setIsSetupLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:p-7">
        <Badge
          className="mb-3 border border-[#D4AC50]/25 bg-[#D4AC50]/12 text-[#E7C56B] hover:bg-[#D4AC50]/12"
          variant="secondary"
        >
          Broker Dashboard
        </Badge>
        <h1 className="font-serif text-3xl font-bold text-white">Sign in to the CRM</h1>
        <p className="text-sm text-white/60">
          Use your ORE company email to access the sales portal.
        </p>
      </section>

      <Card className="mt-6 border-white/10 bg-[#0F241C]/88 shadow-[0_24px_72px_rgba(0,0,0,0.2)] backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-white">Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              type="email"
              placeholder="you@company.com"
              value={form.email}
              onChange={handleChange("email")}
              className="border-white/10 bg-background/55"
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange("password")}
              className="border-white/10 bg-background/55"
              required
            />
            {error && <div className="text-xs text-destructive">{error}</div>}
            <Button type="submit" className="w-full ore-gradient text-[#152E24]" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
          <div className="mt-4 text-xs text-white/50">
            Forgot your password?{" "}
            <Link href="/crm/reset" className="text-primary underline-offset-4 hover:underline">
              Reset it here
            </Link>
            .
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4 border-white/10 bg-[#0B1D16]/86 shadow-[0_24px_72px_rgba(0,0,0,0.18)] backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-white">Initialize Admin Access</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={handleSetupSubmit}>
            <Input
              type="text"
              placeholder="Admin name"
              value={setupForm.name}
              onChange={handleSetupChange("name")}
              className="border-white/10 bg-background/55"
              required
            />
            <Input
              type="email"
              placeholder="admin@company.com"
              value={setupForm.email}
              onChange={handleSetupChange("email")}
              className="border-white/10 bg-background/55"
              required
            />
            <Input
              type="password"
              placeholder="Admin password (min 8)"
              value={setupForm.password}
              onChange={handleSetupChange("password")}
              className="border-white/10 bg-background/55"
              required
            />
            <Input
              type="password"
              placeholder="Setup key (CRM_ADMIN_SETUP_KEY)"
              value={setupForm.setupKey}
              onChange={handleSetupChange("setupKey")}
              className="border-white/10 bg-background/55"
              required
            />
            {setupError && <div className="text-xs text-destructive">{setupError}</div>}
            <Button
              type="submit"
              variant="outline"
              className="w-full border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06] hover:text-white"
              disabled={isSetupLoading}
            >
              {isSetupLoading ? "Initializing..." : "Create / Reset Admin Login"}
            </Button>
          </form>
          <p className="mt-3 text-xs text-white/45">
            This uses a secure setup key and should be used only by the website owner.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
