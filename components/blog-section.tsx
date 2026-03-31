import Link from "next/link"
import Image from "next/image"
import { getHomepageBlogPosts } from "@/lib/ore"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

const ArrowRightIcon = ({ className }: { className?: string }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
)

const FileEditIcon = ({ className }: { className?: string }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M4 21h16" />
    <path d="M14.4 3.6a2 2 0 0 1 2.8 2.8L8 15.6 4 16l.4-4z" />
    <path d="M13.5 4.5 19.5 10.5" />
  </svg>
)

export async function BlogSection() {
  const posts = await getHomepageBlogPosts(6)

  if (!posts.length) return null

  return (
    <section id="blog" className="py-20">
      <div className="container">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#152E24]/[0.08] bg-white/80 px-4 py-2 shadow-sm backdrop-blur-sm mb-6">
            <FileEditIcon className="h-4 w-4 text-[#C69B3E]" />
            <span className="text-xs uppercase tracking-widest text-[#152E24]/55">Blog</span>
          </div>
          <h2 className="font-serif text-3xl font-bold text-[#152E24] md:text-4xl">Latest Insights</h2>
          <p className="mt-4 max-w-2xl mx-auto text-[#152E24]/55">
            Market updates, investment guides, and Dubai real estate insights from the ORE team.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-10">
          {posts.map((post) => (
            <Link key={post.id} href={`/blog/${post.slug}`} className="group block h-full">
              <Card className="h-full overflow-hidden border-[#152E24]/[0.08] bg-white hover:-translate-y-1 hover:border-[#C69B3E]/25 hover:shadow-[0_28px_60px_-28px_rgba(21,46,36,0.28)]">
                <div className="relative aspect-[4/3] overflow-hidden bg-[#EFEAE3]">
                  {post.hero_image ? (
                    <>
                      <Image
                        src={post.hero_image}
                        alt={post.title}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#152E24]/60 via-transparent to-transparent" />
                    </>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(198,155,62,0.18),transparent_55%),linear-gradient(135deg,#f7f2ea,#efe6d8)] text-[#C69B3E]">
                      <FileEditIcon className="h-8 w-8" />
                    </div>
                  )}

                  <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-2">
                    {post.category ? (
                      <Badge className="border-none bg-white/90 text-[#152E24] shadow-sm backdrop-blur-md hover:bg-white">
                        {post.category}
                      </Badge>
                    ) : (
                      <span />
                    )}
                    {post.featured && (
                      <Badge className="border-none bg-[#C69B3E] text-white shadow-sm">
                        Featured
                      </Badge>
                    )}
                  </div>
                </div>

                <CardContent className="flex h-full flex-col p-6">
                  <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium uppercase tracking-[0.14em] text-[#152E24]/40">
                    {post.published_at && (
                      <span>
                        {new Date(post.published_at).toLocaleDateString("en-AE", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                    {post.read_time && <span>{post.read_time} min read</span>}
                  </div>

                  <h3 className="mt-4 font-serif text-xl font-bold leading-tight text-[#152E24] transition-colors group-hover:text-[#C69B3E] line-clamp-2">
                    {post.title}
                  </h3>

                  {post.excerpt && (
                    <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-[#152E24]/55">
                      {post.excerpt}
                    </p>
                  )}

                  <div className="mt-auto flex items-center justify-between gap-4 pt-6">
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#C69B3E]/75">
                        ORE Journal
                      </div>
                      <div className="truncate text-sm text-[#152E24]/55">
                        {post.author || "ORE Editorial Team"}
                      </div>
                    </div>

                    <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#152E24]/55 transition-colors group-hover:text-[#C69B3E]">
                      <span>Read article</span>
                      <ArrowRightIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="flex justify-center">
          <Link
            href="/blog"
            className="flex items-center gap-2 rounded-full border border-[#152E24]/[0.08] bg-white px-5 py-2 text-sm text-[#152E24] transition hover:border-[#C69B3E]/35 hover:text-[#C69B3E] hover:shadow-sm"
          >
            Browse all articles
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
