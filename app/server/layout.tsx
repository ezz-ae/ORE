export const metadata = { title: 'Freehold Admin — Secure Access' }

export default function ServerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        body > div > header,
        body > div > footer { display: none !important; }
      `}</style>
      {children}
    </>
  )
}
