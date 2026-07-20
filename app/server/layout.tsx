import { BRAND } from '@/lib/freehold/brand'

export const metadata = { title: `${BRAND.legalName} — Team Sign In` }

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
