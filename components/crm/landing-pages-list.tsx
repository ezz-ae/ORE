"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { LandingPageDashboardRow } from "@/lib/landing-pages"

const formatDate = (value: string | null) => {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-AE")
}

const isLiveNow = (status: string, publishFrom: string | null, publishTo: string | null) => {
  if (status !== "published") return false
  const now = Date.now()
  const fromTime = publishFrom ? new Date(publishFrom).getTime() : null
  const toTime = publishTo ? new Date(publishTo).getTime() : null
  if (fromTime && Number.isFinite(fromTime) && now < fromTime) return false
  if (toTime && Number.isFinite(toTime) && now > toTime) return false
  return true
}

const statusTone = (status: string) =>
  status === "published" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"

export function LandingPagesList({ initialPages }: { initialPages: LandingPageDashboardRow[] }) {
  const router = useRouter()
  const [pages, setPages] = useState(initialPages)
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null)

  const publishedCount = useMemo(() => pages.filter((page) => page.isLiveNow).length, [pages])
  const totalViews = useMemo(() => pages.reduce((sum, page) => sum + page.pageViews, 0), [pages])
  const totalLeads = useMemo(() => pages.reduce((sum, page) => sum + page.leadCount, 0), [pages])

  const updateStatus = async (slug: string, status: "draft" | "published") => {
    setLoadingSlug(slug)
    try {
      const response = await fetch(`/api/crm/landing-pages/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "Failed to update landing page.")
      }

      setPages((current) =>
        current.map((page) => {
          if (page.slug !== slug) return page
          const publishFrom = data?.landingPage?.publishFrom
            ? new Date(data.landingPage.publishFrom).toISOString()
            : null
          const publishTo = data?.landingPage?.publishTo
            ? new Date(data.landingPage.publishTo).toISOString()
            : null
          return {
            ...page,
            status: data?.landingPage?.status || status,
            publishFrom,
            publishTo,
            isLiveNow: isLiveNow(data?.landingPage?.status || status, publishFrom, publishTo),
          }
        }),
      )
      router.refresh()
    } finally {
      setLoadingSlug(null)
    }
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Campaign Pages</p>
            <p className="mt-2 font-serif text-3xl font-bold">{pages.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Published</p>
            <p className="mt-2 font-serif text-3xl font-bold">{publishedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Leads / Views</p>
            <p className="mt-2 font-serif text-3xl font-bold">{totalLeads} / {totalViews}</p>
          </CardContent>
        </Card>
      </section>

      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
        <div className="grid grid-cols-10 gap-3 border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <div className="col-span-3">Campaign</div>
          <div className="col-span-2">Project</div>
          <div>Status</div>
          <div>Views</div>
          <div>Leads</div>
          <div>Window</div>
          <div>Actions</div>
        </div>

        {pages.map((page) => (
          <div key={page.slug} className="grid grid-cols-10 gap-3 border-b border-border px-4 py-4 text-sm last:border-b-0">
            <div className="col-span-3 min-w-0">
              <div className="font-semibold truncate">{page.headline}</div>
              <div className="text-xs text-muted-foreground truncate">{page.slug}</div>
            </div>
            <div className="col-span-2 text-muted-foreground truncate">{page.projectSlug || "—"}</div>
            <div>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusTone(page.status)}`}>
                {page.status}
              </span>
            </div>
            <div className="text-muted-foreground">{page.pageViews}</div>
            <div className="text-muted-foreground">{page.leadCount}</div>
            <div className="text-xs text-muted-foreground">
              {formatDate(page.publishFrom)} → {formatDate(page.publishTo)}
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" asChild>
                <Link href={`/crm/landing-pages/${page.slug}`}>Edit</Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/lp/${page.slug}`} target="_blank">Open</Link>
              </Button>
              <Button
                size="sm"
                className={page.status === "published" ? "" : "ore-gradient"}
                variant={page.status === "published" ? "outline" : "default"}
                disabled={loadingSlug === page.slug}
                onClick={() => updateStatus(page.slug, page.status === "published" ? "draft" : "published")}
              >
                {loadingSlug === page.slug ? "Saving..." : page.status === "published" ? "Unpublish" : "Publish"}
              </Button>
            </div>
          </div>
        ))}

        {pages.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            No campaign pages have been created yet.
          </div>
        ) : null}
      </div>

      <div className="space-y-3 md:hidden">
        {pages.map((page) => (
          <Card key={page.slug}>
            <CardContent className="space-y-3 p-4">
              <div>
                <div className="font-semibold">{page.headline}</div>
                <div className="text-xs text-muted-foreground">{page.slug}</div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className={`inline-flex rounded-full px-2 py-0.5 font-medium ${statusTone(page.status)}`}>
                  {page.status}
                </span>
                <span className="text-muted-foreground">{page.projectSlug || "—"}</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <div className="text-muted-foreground">Views</div>
                  <div className="font-semibold">{page.pageViews}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Leads</div>
                  <div className="font-semibold">{page.leadCount}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Window</div>
                  <div className="font-semibold">{formatDate(page.publishFrom)}</div>
                </div>
              </div>
              <div className="grid gap-2">
                <Button size="sm" variant="outline" asChild className="w-full">
                  <Link href={`/crm/landing-pages/${page.slug}`}>Edit Landing Page</Link>
                </Button>
                <Button
                  size="sm"
                  className={page.status === "published" ? "w-full" : "ore-gradient w-full"}
                  variant={page.status === "published" ? "outline" : "default"}
                  disabled={loadingSlug === page.slug}
                  onClick={() => updateStatus(page.slug, page.status === "published" ? "draft" : "published")}
                >
                  {loadingSlug === page.slug ? "Saving..." : page.status === "published" ? "Unpublish" : "Publish"}
                </Button>
                <Button size="sm" variant="outline" asChild className="w-full">
                  <Link href={`/lp/${page.slug}`} target="_blank">Open Landing Page</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {pages.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            No campaign pages have been created yet.
          </div>
        ) : null}
      </div>
    </div>
  )
}
