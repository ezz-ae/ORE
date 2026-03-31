import { Button } from "@/components/ui/button"
import { getBlogPostBySlug, getBlogPosts } from "@/lib/entrestate"
import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"

export async function generateStaticParams() {
  const posts = await getBlogPosts(20, 0)
  return posts.map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = await getBlogPostBySlug(slug)
  if (!post) {
    return { title: "Article Not Found" }
  }
  return {
    title: `${post.title} | ORE Real Estate`,
    description: post.excerpt || post.title,
    openGraph: post.hero_image ? { images: [post.hero_image] } : undefined,
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = await getBlogPostBySlug(slug)

  if (!post) {
    notFound()
  }

  return (
    <>
        <section className="border-b border-border bg-muted/30 py-12">
          <div className="container">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {post.category && (
                  <span className="rounded-full border border-border px-2 py-1 text-foreground">
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
                {post.read_time && <span>{post.read_time} min read</span>}
                {post.author && <span>By {post.author}</span>}
              </div>
              <h1 className="mt-4 font-serif text-4xl font-bold md:text-5xl">{post.title}</h1>
              {post.excerpt && (
                <p className="mt-4 text-lg text-muted-foreground">{post.excerpt}</p>
              )}
              <div className="mt-6">
                <Button variant="outline" asChild>
                  <Link href="/blog">Back to Blog</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="container">
            <div className="mx-auto max-w-4xl space-y-8">
              {post.hero_image && (
                <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-border bg-muted">
                  <Image src={post.hero_image} alt={post.title} fill className="object-cover" />
                </div>
              )}
              <div className="prose prose-lg max-w-none prose-headings:font-serif prose-a:text-primary">
                {(post.body || "").split("\n").map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </div>
          </div>
        </section>
    </>
  )
}
