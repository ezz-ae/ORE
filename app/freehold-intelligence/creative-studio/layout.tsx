// The Creative Studio manages its own full-height node canvas, so it opts out
// of the default padded/scrolling content wrapper (mirrors the Notebook).
//
// It also ports v0 nodes that read the shadcn design tokens, which default to a
// light theme. We scope the ORE dark palette here (`cs-dark`) plus `dark` so the
// Studio matches the rest of the product. `display:contents` keeps the wrapper
// invisible to layout while still cascading the CSS variables and enabling the
// `dark:` utility variants used inside the nodes.
export default function CreativeStudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark cs-dark" style={{ display: "contents" }}>
      {children}
    </div>
  )
}
