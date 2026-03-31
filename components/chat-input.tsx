"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Send, Loader2, Paperclip, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChatInputProps {
  onSend: (message: string) => void
  onFileUpload?: (file: File) => void
  disabled?: boolean
  placeholder?: string
  suggestedQuestions?: string[]
}

export function ChatInput({
  onSend,
  onFileUpload,
  disabled,
  placeholder = "Ask about Dubai real estate...",
  suggestedQuestions = [],
}: ChatInputProps) {
  const [input, setInput] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const submit = () => {
    const trimmed = input.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setInput("")
    // Keep mobile keyboard open after send
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto"
        textareaRef.current.focus()
      }
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter = send; Shift+Enter = newline; skip during IME composition
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  // Auto-resize height as content grows
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && onFileUpload) {
      onFileUpload(file)
    }
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit() }}
      className="relative w-full max-w-4xl mx-auto"
    >
      <div className="relative flex items-end rounded-2xl sm:rounded-3xl border bg-background px-2 py-2 sm:px-4 sm:py-3 shadow-lg ring-offset-background transition-shadow hover:shadow-xl focus-within:shadow-xl focus-within:border-primary/20">
        <div className="flex items-center">
          {suggestedQuestions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-11 sm:w-11 rounded-full">
                  <ChevronUp className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                {suggestedQuestions.map((q, i) => (
                  <DropdownMenuItem key={i} onSelect={() => onSend(q)}>
                    {q}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {onFileUpload && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 sm:h-11 sm:w-11 rounded-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf"
              />
            </>
          )}
        </div>
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus
          inputMode="text"
          rows={1}
          className="min-h-[44px] sm:min-h-[52px] max-h-[150px] sm:max-h-[200px] w-full resize-none border-0 bg-transparent py-2 sm:py-2.5 pl-1 sm:pl-2 pr-10 sm:pr-14 text-sm placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none"
          style={{ touchAction: "manipulation" }}
        />
        <div className="absolute right-2 bottom-2 sm:right-3 sm:bottom-3">
          {/* 44×44px touch target (WCAG 2.5.5) */}
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || disabled}
            aria-label="Send message"
            className={cn(
              "h-9 w-9 sm:h-11 sm:w-11 shrink-0 rounded-full transition-all touch-manipulation",
              input.trim()
                ? "bg-primary text-primary-foreground shadow-md active:scale-95"
                : "bg-muted text-muted-foreground",
            )}
          >
            {disabled ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
      <p className="mt-2 text-center text-[10px] text-muted-foreground/60">
        AI can make mistakes. Consider checking important information.
      </p>
    </form>
  )
}
