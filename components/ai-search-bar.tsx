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
  placeholder = "Ask me anything about Dubai real estate... e.g., '2BR apartment in Marina with sea view under 2M'",
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
    "2BR apartments under AED 2M",
    "Beachfront properties in Dubai Marina"
  ]

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="relative">
        <div className={`relative transition-all duration-500 ${isFocused ? 'scale-[1.01]' : 'scale-100'} rounded-full`}>
          <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 text-[#163327]/30" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            placeholder={placeholder}
            className="w-full rounded-full border border-[#163327]/05 bg-white/60 px-16 py-6 text-[15px] font-medium backdrop-blur-md transition-all focus:border-[#C5A059]/40 focus:bg-white focus:outline-none placeholder:text-[#163327]/30 shadow-[0_4px_32px_-8px_rgba(22,51,39,0.05)] focus:shadow-[0_24px_48px_-12px_rgba(22,51,39,0.1)]"
          />
          <Button 
            type="submit"
            size="lg" 
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full ore-gradient gap-3 h-12 px-8 shadow-2xl transition-all hover:translate-x-1"
          >
            <SparklesIcon />
            <span className="hidden sm:inline font-bold uppercase tracking-[0.2em] text-[10px]">Intelligence</span>
          </Button>
        </div>
      </form>

      {showSuggestions && (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-[11px] font-bold uppercase tracking-[0.2em]">
          <span className="text-[#163327]/20">Trends:</span>
          {suggestions.slice(0, 3).map((suggestion) => (
            <button 
              key={suggestion}
              type="button"
              className="text-[#163327]/40 hover:text-[#C5A059] transition-colors"
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
