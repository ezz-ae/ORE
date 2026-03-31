import Link from "next/link"
import Image from "next/image"
import { getHomepageBlogPosts } from "@/lib/entrestate"

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
  return (
    <section id="blog" className="py-20">
      <div className="container">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 border border-border bg-card">
            <FileEditIcon className="h-4 w-4 text-primary" />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Blog</span>
          </div>
          <h2 className="font-serif text-3xl font-bold md:text-4xl">Latest Insights</h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Market updates, investment guides, and Dubai real estate insights from the ORE team.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-10">
          {posts.map((post) => (
            <Link key={post.id} href={`/blog/${post.slug}`} className="group">
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-muted mb-4">
                {post.hero_image && (
                  <Image src={post.hero_image} alt={post.title} fill className="object-cover" />
                )}
              </div>
              <h3 className="text-foreground mb-3 group-hover:text-primary transition-colors text-lg font-semibold">
                {post.title}
              </h3>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {post.category && (
                  <span className="px-3 py-1 border border-border rounded-full text-xs text-foreground">
                    {post.category}
                  </span>
                )}
                {post.published_at && (
                  <span>
                    {new Date(post.published_at).toLocaleDateString("en-AE", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>

        <div className="flex justify-center">
          <Link
            href="/blog"
            className="flex items-center gap-2 rounded-full border border-border px-5 py-2 text-sm text-foreground transition hover:border-primary hover:text-primary"
          >
            Browse all articles
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
