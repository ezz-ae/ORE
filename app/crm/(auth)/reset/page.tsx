"use client"

import { useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function DashboardResetRequestPage() {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle")
  const [resetLink, setResetLink] = useState<string | null>(null)
  const [error, setError] = useState("")

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setStatus("loading")
    setError("")
    setResetLink(null)
    try {
      const response = await fetch("/api/auth/request-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "Failed to send reset link.")
      }
      setStatus("sent")
      if (data?.resetLink) {
        setResetLink(data.resetLink)
      }
    } catch (err: any) {
      setStatus("error")
      setError(err?.message || "Failed to send reset link.")
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <section className="rounded-2xl border border-border bg-gradient-to-b from-background to-muted/70 p-6">
        <Badge className="mb-3 ore-gradient" variant="secondary">
          Password Reset
        </Badge>
        <h1 className="font-serif text-3xl font-bold">Reset your access</h1>
        <p className="text-sm text-muted-foreground">
          Enter your company email. We will generate a secure reset link.
        </p>
      </section>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Request a reset link</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            {error && <div className="text-xs text-destructive">{error}</div>}
            <Button type="submit" className="w-full ore-gradient" disabled={status === "loading"}>
              {status === "loading" ? "Generating..." : "Send reset link"}
            </Button>
          </form>

          {status === "sent" && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              {resetLink ? (
                <>
                  Reset link generated.{" "}
                  <Link href={resetLink} className="text-primary underline-offset-4 hover:underline">
                    Continue to reset
                  </Link>
                </>
              ) : (
                <>If the email exists, a reset link has been generated.</>
              )}
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
