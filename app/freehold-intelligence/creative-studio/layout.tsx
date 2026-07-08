// The Creative Studio manages its own full-height node canvas, so it opts out
// of the default padded/scrolling content wrapper (mirrors the Notebook).
export default function CreativeStudioLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
