"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

// Inline SVGs for Stability
const SearchIcon = ({ className }: { className?: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
  </svg>
)
const SparklesIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
  </svg>
)

interface AISearchBarProps {
  placeholder?: string
  showSuggestions?: boolean
}

export function AISearchBar({
  placeholder = "Ask me anything about Dubai real estate...",
  showSuggestions = true
}: AISearchBarProps) {
  const [query, setQuery] = useState("")
  const [isFocused, setIsFocused] = useState(false)
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/chat?q=${encodeURIComponent(query)}`)
    } else {
      router.push('/chat')
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    router.push(`/chat?q=${encodeURIComponent(suggestion)}`)
  }

  const suggestions = [
    "Best ROI projects in 2026",
    "Golden Visa eligible properties",
    "Off-plan projects in Downtown Dubai",
  ]

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="relative">
        <div className={`relative transition-all duration-300 ${isFocused ? 'scale-[1.005]' : 'scale-100'} rounded-xl`}>
          <SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-[#152E24]/25" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            placeholder={placeholder}
            className="w-full rounded-xl border border-[#152E24]/[0.06] bg-white/70 px-14 py-5 pr-44 text-[15px] font-medium backdrop-blur-md transition-all focus:border-[#C69B3E]/30 focus:bg-white/90 focus:outline-none placeholder:text-[#152E24]/25 shadow-[0_2px_16px_-4px_rgba(21,46,36,0.04)] focus:shadow-[0_8px_32px_-8px_rgba(21,46,36,0.08)]"
          />
          <Button
            type="submit"
            size="lg"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg ore-gradient gap-2.5 h-11 px-6 shadow-lg transition-all"
          >
            <SparklesIcon />
            <span className="hidden sm:inline font-semibold text-[11px] uppercase tracking-[0.1em]">Search</span>
          </Button>
        </div>
      </form>

      {showSuggestions && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-[11px] font-medium">
          <span className="text-[#152E24]/20 uppercase tracking-[0.15em]">Trending:</span>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="text-[#152E24]/35 hover:text-[#C69B3E] transition-colors"
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
