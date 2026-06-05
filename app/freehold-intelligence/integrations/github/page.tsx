'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, GitBranch, GitCommit, CheckCircle2, Circle, AlertCircle, ExternalLink, Clock, RefreshCw, Code2 } from 'lucide-react'
import { mockGithubData } from '@/lib/freehold/mcp/mock-integrations'
import { AiPrompt } from '@/components/freehold/ai-prompt'

function ciTone(s: string) {
  if (s === 'success') return { icon: CheckCircle2, text: 'text-[#D4AF37]', bg: 'bg-[#D4AF37]/10 border-[#D4AF37]/20' }
  if (s === 'failure') return { icon: AlertCircle, text: 'text-red-300', bg: 'bg-red-400/10 border-red-400/20' }
  return { icon: Circle, text: 'text-[#F8E7AE]', bg: 'bg-[#D4AF37]/10 border-[#D4AF37]/20' }
}

function deployTone(s: string) {
  if (s === 'ready') return { dot: 'bg-[#D4AF37]', text: 'text-[#D4AF37]' }
  if (s === 'building') return { dot: 'bg-[#D4AF37] animate-pulse', text: 'text-[#F8E7AE]' }
  return { dot: 'bg-red-400', text: 'text-red-300' }
}

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (d < 1) return 'just now'
  if (d < 60) return `${d}m ago`
  return `${Math.floor(d / 60)}h ago`
}

export default function GithubIntegrationPage() {
  const [checks, setChecks]       = useState(mockGithubData.ciChecks)
  const [rerunning, setRerunning] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null)

  const gh          = mockGithubData
  const allCiPassed = checks.every((c) => c.status === 'success')

  const handleRerun = useCallback((name: string) => {
    setRerunning(name)
    setChecks((prev) => prev.map((c) => c.name === name ? { ...c, status: 'pending' } : c))
    setTimeout(() => {
      setChecks((prev) => prev.map((c) => c.name === name ? { ...c, status: 'success' } : c))
      setRerunning(null)
    }, 2200)
  }, [])

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    setTimeout(() => {
      setRefreshing(false)
      setRefreshedAt(new Date())
    }, 1200)
  }, [])

  return (
    <div className="mx-auto max-w-4xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">
      <Link href="/freehold-intelligence/integrations" className="inline-flex items-center gap-1.5 text-[12px] text-white/40 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> Integrations
      </Link>

      {/* Header */}
      <section className="mt-7">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-2.5 py-0.5 text-[13px] font-medium text-[#D4AF37]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37]" />
            Connected
          </span>
          <span className="text-[13px] text-white/30">
            {refreshedAt ? `Refreshed just now` : `Last synced ${timeAgo(gh.lastCommit.timestamp)}`}
          </span>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="ml-auto inline-flex items-center gap-1.5 rounded-[10px] border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-[13px] text-white/50 transition hover:border-white/20 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[52px]">
          GitHub
        </h1>
        <p className="mt-3 text-[16px] text-white/55">
          Repository, CI/CD pipeline, and deployment status for <span className="font-mono text-white/70">{gh.repo}</span>
        </p>
      </section>

      {/* Stats row */}
      <section className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-[18px] border border-white/[0.08] bg-[#1A1F2A] p-5">
          <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-white/35">CI status</p>
          <p className={`mt-2 text-[22px] font-semibold ${allCiPassed ? 'text-[#D4AF37]' : 'text-red-300'}`}>
            {allCiPassed ? 'Passing' : 'Failing'}
          </p>
        </div>
        <div className="rounded-[18px] border border-white/[0.08] bg-[#1A1F2A] p-5">
          <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-white/35">Deployments</p>
          <p className="mt-2 text-[22px] font-semibold text-white">{gh.deployments.length}</p>
        </div>
        <div className="rounded-[18px] border border-white/[0.08] bg-[#1A1F2A] p-5">
          <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-white/35">Open PRs</p>
          <p className="mt-2 text-[22px] font-semibold text-white">{gh.openPRs}</p>
        </div>
        <div className="rounded-[18px] border border-white/[0.08] bg-[#1A1F2A] p-5">
          <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-white/35">Open issues</p>
          <p className="mt-2 text-[22px] font-semibold text-white">{gh.openIssues}</p>
        </div>
      </section>

      {/* Branch + last commit */}
      <section className="mt-5 rounded-[22px] border border-white/[0.08] bg-[#1A1F2A] p-6">
        <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.18em] text-white/35">
          <GitBranch className="h-3.5 w-3.5" /> Active branch
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[15px] font-semibold text-white">{gh.branch}</p>
            <p className="mt-1 text-[12px] text-white/40">Default: {gh.defaultBranch}</p>
          </div>
          <a
            href={`https://github.com/${gh.repo}/tree/${gh.branch}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-white/[0.08] bg-white/[0.025] px-4 py-2 text-[12px] text-white/60 transition hover:border-white/20 hover:text-white"
          >
            View on GitHub <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="mt-5 flex items-start gap-3 border-t border-white/[0.05] pt-4">
          <GitCommit className="mt-0.5 h-4 w-4 shrink-0 text-white/30" />
          <div>
            <p className="font-mono text-[12px] text-white/45">{gh.lastCommit.sha}</p>
            <p className="mt-1 text-[13px] text-white/80">{gh.lastCommit.message}</p>
            <p className="mt-1 text-[13px] text-white/35">{gh.lastCommit.author} · {timeAgo(gh.lastCommit.timestamp)}</p>
          </div>
        </div>
      </section>

      {/* CI Checks */}
      <section className="mt-5 overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#1A1F2A]">
        <div className="border-b border-white/[0.05] px-6 py-3.5 text-[12px] font-medium uppercase tracking-[0.18em] text-white/30">
          CI checks
        </div>
        <div className="divide-y divide-white/[0.04]">
          {checks.map((check) => {
            const t = ciTone(check.status)
            const Icon = t.icon
            return (
              <div key={check.name} className="flex items-center justify-between gap-4 px-6 py-4">
                <div className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 ${t.text}`} />
                  <span className="text-[13px] text-white/80">{check.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[12px] text-white/35">{check.duration}</span>
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[13px] capitalize ${t.bg} ${t.text}`}>
                    {rerunning === check.name ? 'running…' : check.status}
                  </span>
                  {(check.status === 'failure' || rerunning === check.name) && (
                    <button
                      type="button"
                      onClick={() => handleRerun(check.name)}
                      disabled={rerunning !== null}
                      className="rounded-[8px] border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-[13px] text-white/45 transition hover:border-[#D4AF37]/20 hover:text-[#D4AF37] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {rerunning === check.name ? 'Running…' : 'Re-run'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Deployments */}
      <section className="mt-5 overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#1A1F2A]">
        <div className="border-b border-white/[0.05] px-6 py-3.5 text-[12px] font-medium uppercase tracking-[0.18em] text-white/30">
          Deployments
        </div>
        <div className="divide-y divide-white/[0.04]">
          {gh.deployments.map((dep) => {
            const t = deployTone(dep.status)
            return (
              <div key={dep.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
                    <span className="text-[13px] font-medium capitalize text-white">{dep.env}</span>
                  </div>
                  <a
                    href={`https://${dep.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 flex items-center gap-1 text-[12px] text-white/40 transition hover:text-[#D4AF37]"
                  >
                    {dep.url} <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-white/30">{timeAgo(dep.createdAt)}</span>
                  <span className={`text-[13px] ${t.text} capitalize`}>{dep.status}</span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Recent activity */}
      <section className="mt-5 overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#1A1F2A]">
        <div className="border-b border-white/[0.05] px-6 py-3.5 text-[12px] font-medium uppercase tracking-[0.18em] text-white/30">
          Recent activity
        </div>
        <div className="divide-y divide-white/[0.04]">
          {gh.recentActivity.map((act, i) => (
            <div key={i} className="flex items-start gap-3 px-6 py-4">
              <Code2 className="mt-0.5 h-4 w-4 shrink-0 text-white/25" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-white/80">{act.message}</p>
                <p className="mt-0.5 text-[13px] text-white/35">{act.author} · {act.ago}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* AI Prompt */}
      <section className="mt-8">
        <AiPrompt
          placeholder="Ask about repo status, CI, deployments…"
          suggestions={[
            'What changed in the last deployment?',
            'Is the production branch up to date?',
            'Are there any open PRs that need review?',
          ]}
        />
      </section>

    </div>
  )
}
