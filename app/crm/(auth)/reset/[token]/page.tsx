"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function DashboardResetPage() {
  const router = useRouter()
  const params = useParams<{ token: string }>()
  const token = params?.token || ""
  const [password, setPassword] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [error, setError] = useState("")

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setStatus("loading")
    setError("")
    try {
      const response = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "Failed to reset password.")
      }
      setStatus("success")
      setTimeout(() => router.push("/crm/login"), 800)
    } catch (err: any) {
      setStatus("error")
      setError(err?.message || "Failed to reset password.")
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <section className="rounded-2xl border border-border bg-gradient-to-b from-background to-muted/70 p-6">
        <Badge className="mb-3 ore-gradient" variant="secondary">
          Password Reset
        </Badge>
        <h1 className="font-serif text-3xl font-bold">Set a new password</h1>
        <p className="text-sm text-muted-foreground">
          Choose a secure password to regain access to the dashboard.
        </p>
      </section>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>New password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              type="password"
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            {error && <div className="text-xs text-destructive">{error}</div>}
            <Button type="submit" className="w-full ore-gradient" disabled={status === "loading"}>
              {status === "loading" ? "Saving..." : "Update password"}
            </Button>
          </form>

          {status === "success" && (
            <div className="text-xs text-muted-foreground">
              Password updated. Redirecting to login...
            </div>
          )}

          <Link href="/crm/login" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
            Return to login
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
