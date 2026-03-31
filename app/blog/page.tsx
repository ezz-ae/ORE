import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getBlogPosts } from "@/lib/ore"
import Image from "next/image"
import Link from "next/link"

export default async function BlogPage() {
  const posts = await getBlogPosts(100, 0)
  const featured = posts[0]
  const highlights = posts.slice(1, 4)
  const stories = posts.slice(4)

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-white/5 bg-[#0A1F17] py-16 md:py-24">
          <div className="absolute inset-0 z-0">
            <div className="absolute right-0 top-0 h-[420px] w-[420px] bg-[radial-gradient(circle_at_50%_50%,rgba(198,155,62,0.16),transparent_55%)] blur-[80px]" />
            <div className="absolute bottom-0 left-0 h-[360px] w-[360px] bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.10),transparent_55%)] blur-[80px]" />
          </div>
          <div className="container text-center">
            <div className="relative z-10">
            <Badge className="mb-4 border-none bg-[#C69B3E]/10 px-4 py-1.5 text-[#F0D792]" variant="secondary">
              Blog
            </Badge>
            <h1 className="font-serif text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl">
              ORE Insights
            </h1>
            <p className="mt-6 text-lg text-white/65">
              Market updates, investment guides, and expert commentary on Dubai real estate.
            </p>
            </div>
          </div>
        </section>

        {featured && (
          <section className="bg-[#FAF8F5] py-16 md:py-20">
            <div className="container">
              <div className="rounded-[32px] border border-[#152E24]/[0.08] bg-white p-6 shadow-[0_24px_80px_-40px_rgba(21,46,36,0.18)] md:p-8 lg:p-10">
                <div className="mb-8">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#C69B3E]">Editorial Briefing</p>
                  <h2 className="mt-2 font-serif text-2xl font-bold text-[#152E24] md:text-3xl">Latest market reads and investor guidance</h2>
                </div>
              <div className="grid gap-8 lg:grid-cols-[1.4fr,0.8fr]">
                <article className="overflow-hidden rounded-[28px] border border-[#152E24]/10 bg-[#FAF8F5] shadow-none transition hover:border-[#C69B3E]/25">
                  <div className="relative aspect-[4/3] bg-muted">
                    {featured.hero_image && (
                      <Image src={featured.hero_image} alt={featured.title} fill className="object-cover" />
                    )}
                  </div>
                  <div className="p-8">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {featured.category && (
                        <Badge variant="secondary">{featured.category}</Badge>
                      )}
                      {featured.published_at && (
                        <span>
                          {new Date(featured.published_at).toLocaleDateString("en-AE", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
                      {featured.read_time && <span>{featured.read_time} min read</span>}
                    </div>
                    <h2 className="mt-3 font-serif text-3xl font-bold">{featured.title}</h2>
                    <p className="mt-4 text-base text-muted-foreground">{featured.excerpt}</p>
                    <div className="mt-6">
                      <Button variant="outline" className="border-[#152E24]/10 bg-white text-[#152E24] hover:border-[#C69B3E]/25 hover:bg-[#C69B3E]/[0.08] hover:text-[#152E24]" asChild>
                        <Link href={`/blog/${featured.slug}`}>Read the CEO Perspective</Link>
                      </Button>
                    </div>
                  </div>
                </article>

                <div className="space-y-4">
                  {highlights.map((post) => (
                    <article key={post.id} className="rounded-2xl border border-[#152E24]/10 bg-[#FAF8F5] p-5 transition hover:border-[#C69B3E]/25">
                      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                        <span>{post.category || "Market Update"}</span>
                        {post.published_at && (
                          <span>
                            {new Date(post.published_at).toLocaleDateString("en-AE", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-3 text-lg font-semibold">{post.title}</h3>
                      {post.excerpt && (
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{post.excerpt}</p>
                      )}
                      <div className="mt-4 flex justify-between text-sm font-semibold text-[#C69B3E]">
                        <Link href={`/blog/${post.slug}`}>Explore</Link>
                        {post.read_time && <span>{post.read_time} min read</span>}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
              </div>
            </div>
          </section>
        )}

        <section className="bg-[#FAF8F5] pb-20">
          <div className="container">
            <div className="rounded-[32px] border border-[#152E24]/[0.08] bg-white p-6 shadow-[0_24px_80px_-40px_rgba(21,46,36,0.18)] md:p-8 lg:p-10">
            <div className="mb-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#C69B3E]">Archive</p>
              <h2 className="mt-2 font-serif text-2xl font-bold text-[#152E24] md:text-3xl">More ORE stories</h2>
            </div>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {stories.map((post) => (
                <article
                  key={post.id}
                  className="flex flex-col overflow-hidden rounded-[28px] border border-[#152E24]/10 bg-[#FAF8F5] transition hover:border-[#C69B3E]/25"
                >
                  <div className="relative aspect-[4/3] bg-muted">
                    {post.hero_image && (
                      <Image src={post.hero_image} alt={post.title} fill className="object-cover" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {post.category && (
                        <span className="rounded-full border border-border px-2 py-1 text-foreground">
                          {post.category}
                        </span>
                      )}
                      {post.read_time && <span>{post.read_time} min read</span>}
                    </div>
                    <h2 className="mt-4 font-serif text-xl font-semibold">{post.title}</h2>
                    {post.excerpt && (
                      <p className="mt-3 text-sm text-muted-foreground line-clamp-3">{post.excerpt}</p>
                    )}
                    <div className="mt-6">
                      <Button variant="outline" className="border-[#152E24]/10 bg-white text-[#152E24] hover:border-[#C69B3E]/25 hover:bg-[#C69B3E]/[0.08] hover:text-[#152E24]" asChild>
                        <Link href={`/blog/${post.slug}`}>Read article</Link>
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
