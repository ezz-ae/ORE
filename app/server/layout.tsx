export const metadata = { title: 'Freehold Property — Team Sign In' }

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
