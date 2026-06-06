export default function LpLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        body > div > header,
        body > div > footer { display: none !important; }
        * { box-sizing: border-box; }
      `}</style>
      {children}
    </>
  )
}
