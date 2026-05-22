"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"

const SearchIcon = ({ className }: { className?: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
  </svg>
)
const SparklesIcon = ({ className }: { className?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
  </svg>
)
const ArrowRightIcon = ({ className }: { className?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
  </svg>
)

// Instant match: what will the AI do with this query?
const matchHint = (q: string): string | null => {
  const t = q.trim().toLowerCase()
  if (!t) return null
  // Developer names
  const developers = ['damac', 'emaar', 'nakheel', 'meraas', 'aldar', 'sobha', 'ellington', 'select', 'azizi', 'mag', 'omniyat']
  const matchedDev = developers.find((d) => t.includes(d))
  // Area names
  const areas = ['marina', 'downtown', 'jvc', 'palm', 'creek', 'hills', 'bay', 'jumeirah', 'meydan', 'arjan', 'dubai south']
  const matchedArea = areas.find((a) => t.includes(a))
  // Intent keywords
  if (t.includes('golden visa') || t.includes('golde')) return 'Shortlisting Golden Visa eligible projects…'
  if (t.includes('roi') || t.includes('return') || t.includes('yield')) return 'Finding highest-yield Freehold opportunities…'
  if (t.includes('off-plan') || t.includes('offplan')) return 'Pulling off-plan inventory across Dubai…'
  if (t.includes('under') && /\d/.test(t)) return 'Filtering by your budget…'
  // Specific project + developer (long enough query)
  if (matchedDev && t.length > matchedDev.length + 2) {
    return `Finding "${q.trim()}" project…`
  }
  if (matchedDev) return `Browsing all ${matchedDev.charAt(0).toUpperCase() + matchedDev.slice(1)} projects…`
  if (matchedArea) return `Searching projects in ${matchedArea.charAt(0).toUpperCase() + matchedArea.slice(1)}…`
  if (t.length > 3) return 'Ask Freehold AI anything…'
  return null
}

interface AISearchBarProps {
  placeholder?: string
  showSuggestions?: boolean
}

export function AISearchBar({
  placeholder = "Developer, area, budget, or ask anything…",
  showSuggestions = true
}: AISearchBarProps) {
  const [query, setQuery] = useState("")
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const hint = matchHint(query)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    router.push(q ? `/chat?q=${encodeURIComponent(q)}` : '/chat')
  }

  const handleSuggestionClick = (suggestion: string) => {
    router.push(`/chat?q=${encodeURIComponent(suggestion)}`)
  }

  const suggestions = [
    "Damac Lagoons project details",
    "Golden Visa-ready projects under AED 2M",
    "Off-plan in Dubai Marina",
    "Compare Emaar vs Sobha",
  ]

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          {/* Search icon */}
          <SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30 z-10" />

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 150)}
            placeholder={placeholder}
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.05] px-14 py-4 pr-[130px] text-[14px] font-medium text-white backdrop-blur-md transition-all focus:border-[#C69B3E]/30 focus:bg-white/[0.08] focus:outline-none placeholder:text-white/25 sm:text-[15px]"
          />

          {/* Hint overlay — shows what AI will do */}
          {hint && query && (
            <div className="absolute left-14 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:flex items-center gap-1.5">
              <span className="invisible text-[14px] font-medium sm:text-[15px]">{query}</span>
              <span className="flex items-center gap-1 rounded-full bg-[#C69B3E]/15 px-2.5 py-0.5 text-[11px] font-medium text-[#D4AC50]">
                <SparklesIcon className="shrink-0" />
                {hint}
              </span>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex items-center gap-2 rounded-lg bg-[#C69B3E] px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#0A1F17] shadow-lg transition-all hover:bg-[#D4AC50]"
          >
            <span className="hidden sm:inline">Ask AI</span>
            <ArrowRightIcon />
          </button>
        </div>
      </form>

      {/* Mobile hint */}
      {hint && query && (
        <div className="mt-2 flex items-center gap-1.5 pl-1 sm:hidden">
          <SparklesIcon className="text-[#D4AC50]" />
          <span className="text-[11px] text-[#D4AC50]">{hint}</span>
        </div>
      )}

      {showSuggestions && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/20">Trending:</span>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="text-[11px] text-white/30 transition-colors hover:text-[#C69B3E]"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
