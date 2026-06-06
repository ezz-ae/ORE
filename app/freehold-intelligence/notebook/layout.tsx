export default function NotebookLayout({ children }: { children: React.ReactNode }) {
  // Remove the default padding/scrolling from the parent main element
  // so the notebook can manage its own 3-panel full-height layout.
  return <>{children}</>
}
