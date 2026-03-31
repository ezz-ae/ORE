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
        <section className="border-b border-border bg-gradient-to-b from-background to-muted py-16">
          <div className="container text-center">
            <Badge className="mb-4 ore-gradient" variant="secondary">
              Blog
            </Badge>
            <h1 className="font-serif text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
              ORE Insights
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              Market updates, investment guides, and expert commentary on Dubai real estate.
            </p>
          </div>
        </section>

        {featured && (
          <section className="py-16">
            <div className="container">
              <div className="grid gap-8 lg:grid-cols-[1.4fr,0.8fr]">
                <article className="rounded-2xl border border-border bg-card overflow-hidden shadow-lg transition hover:border-primary/40">
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
                      <Button variant="outline" asChild>
                        <Link href={`/blog/${featured.slug}`}>Read the CEO Perspective</Link>
                      </Button>
                    </div>
                  </div>
                </article>

                <div className="space-y-4">
                  {highlights.map((post) => (
                    <article key={post.id} className="rounded-2xl border border-border bg-card p-5 transition hover:border-primary/40">
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
                      <div className="mt-4 flex justify-between text-sm font-semibold text-primary">
                        <Link href={`/blog/${post.slug}`}>Explore</Link>
                        {post.read_time && <span>{post.read_time} min read</span>}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="py-16 bg-muted/30">
          <div className="container">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {stories.map((post) => (
                <article
                  key={post.id}
                  className="flex flex-col rounded-2xl border border-border bg-card overflow-hidden transition hover:border-primary/40"
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
                      <Button variant="outline" asChild>
                        <Link href={`/blog/${post.slug}`}>Read article</Link>
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
