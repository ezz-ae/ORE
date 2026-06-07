'use client'

import { useState, useEffect } from 'react'
import { Github, GitBranch, GitPullRequest, GitCommit, Eye, EyeOff, CheckCircle2, AlertCircle, RefreshCw, XCircle, Circle, Star, AlertTriangle, ExternalLink } from 'lucide-react'

const TOKEN_KEY = 'fh_github_token'
const REPO_KEY  = 'fh_github_repo'
const BASE      = 'https://api.github.com'

type Phase = 'idle' | 'connecting' | 'connected' | 'error'

type GhUser   = { login: string; name: string; avatar_url: string; public_repos: number; followers: number }
type GhRepo   = { id: number; full_name: string; description: string; stargazers_count: number; open_issues_count: number; language: string; updated_at: string; default_branch: string; private: boolean }
type GhCommit = { sha: string; commit: { message: string; author: { name: string; date: string } }; html_url: string }
type GhPR     = { number: number; title: string; state: string; html_url: string; user: { login: string }; created_at: string; draft: boolean }
type GhIssue  = { number: number; title: string; state: string; html_url: string; created_at: string; labels: { name: string; color: string }[]; pull_request?: unknown }

type GhData = {
  user:    GhUser
  repo:    GhRepo
  commits: GhCommit[]
  prs:     GhPR[]
  issues:  GhIssue[]
}

async function gh<T = any>(path: string, token: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization:        `Bearer ${token}`,
      Accept:               'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  const json = await res.json()
  if (!res.ok) throw Object.assign(new Error(json.message || `HTTP ${res.status}`), { status: res.status })
  return json
}

async function fetchAll(token: string, repo: string): Promise<GhData> {
  const [user, repoData, commits, prs, issues] = await Promise.all([
    gh<GhUser>('/user', token),
    gh<GhRepo>(`/repos/${repo}`, token),
    gh<GhCommit[]>(`/repos/${repo}/commits?per_page=8`, token),
    gh<GhPR[]>(`/repos/${repo}/pulls?state=open&per_page=8`, token),
    gh<GhIssue[]>(`/repos/${repo}/issues?state=open&per_page=8`, token),
  ])
  return {
    user,
    repo:    repoData,
    commits: commits.slice(0, 8),
    prs,
    issues:  issues.filter((i) => !i.pull_request).slice(0, 8),
  }
}

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function errText(err: any) {
  if (err.status === 401) return 'Bad credentials. Check your GitHub Personal Access Token.'
  if (err.status === 404) return 'Repository not found or token lacks access.'
  if (err.status === 403) return 'Rate limit hit or token missing required permissions.'
  return err.message || 'Connection failed.'
}

export default function GitHubPage() {
  const [token,   setToken]   = useState('')
  const [repo,    setRepo]    = useState('')
  const [showTok, setShowTok] = useState(false)
  const [phase,   setPhase]   = useState<Phase>('idle')
  const [data,    setData]    = useState<GhData | null>(null)
  const [err,     setErr]     = useState('')
  const [loading, setLoading] = useState(false)
  const [tab,     setTab]     = useState<'commits' | 'prs' | 'issues'>('commits')

  useEffect(() => {
    const savedTok  = localStorage.getItem(TOKEN_KEY)
    const savedRepo = localStorage.getItem(REPO_KEY)
    if (savedTok && savedRepo) {
      setToken(savedTok)
      setRepo(savedRepo)
      connect(savedTok, savedRepo)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function connect(tok = token, rep = repo) {
    const t = tok.trim(), r = rep.trim()
    if (!t || !r) return
    setPhase('connecting')
    setLoading(true)
    setErr('')
    try {
      const d = await fetchAll(t, r)
      localStorage.setItem(TOKEN_KEY, t)
      localStorage.setItem(REPO_KEY, r)
      setData(d)
      setPhase('connected')
    } catch (e: any) {
      setErr(errText(e))
      setPhase('error')
    } finally {
      setLoading(false)
    }
  }

  function disconnect() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REPO_KEY)
    setToken('')
    setRepo('')
    setData(null)
    setPhase('idle')
    setErr('')
  }

  async function refresh() {
    const t = localStorage.getItem(TOKEN_KEY)
    const r = localStorage.getItem(REPO_KEY)
    if (t && r) await connect(t, r)
  }

  const tabs = [
    { id: 'commits' as const, label: 'Commits',      count: data?.commits.length ?? 0 },
    { id: 'prs'     as const, label: 'Pull Requests', count: data?.prs.length ?? 0     },
    { id: 'issues'  as const, label: 'Issues',        count: data?.issues.length ?? 0  },
  ]

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">

      {/* Header */}
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-surface-2">
              <Github className="h-4 w-4 text-slate-300" />
            </div>
            <h1 className="text-[20px] font-semibold text-white">GitHub</h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">Live repository activity, pull requests and issues</p>
        </div>
        {phase === 'connected' && (
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={refresh} disabled={loading}
              className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs text-slate-500 transition hover:text-slate-300 disabled:opacity-40">
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button onClick={disconnect}
              className="flex items-center gap-1.5 rounded-full border border-red-400/20 px-3 py-1.5 text-xs text-red-400/70 transition hover:border-red-400/40 hover:text-red-400">
              <XCircle className="h-3 w-3" /> Disconnect
            </button>
          </div>
        )}
      </div>

      {/* Connect form */}
      {phase !== 'connected' && (
        <div className="mb-6 rounded-[18px] border border-line bg-surface-2 p-5 space-y-3">
          <div>
            <div className="mb-1 text-sm font-medium text-slate-300">Repository</div>
            <input
              type="text"
              placeholder="owner/repository-name"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              className="w-full rounded-[10px] border border-line bg-surface-2 px-3 py-2.5 font-mono text-sm text-white placeholder-white/20 outline-none focus:border-white/25"
            />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium text-slate-300">Personal Access Token</div>
            <div className="relative">
              <input
                type={showTok ? 'text' : 'password'}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && connect()}
                className="w-full rounded-[10px] border border-line bg-surface-2 px-3 py-2.5 pr-9 font-mono text-sm text-white placeholder-white/20 outline-none focus:border-white/25"
              />
              <button onClick={() => setShowTok((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400">
                {showTok ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <button onClick={() => connect()} disabled={!token.trim() || !repo.trim() || loading}
            className="w-full rounded-[10px] bg-white/[0.10] py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.15] disabled:opacity-40">
            {phase === 'connecting' ? 'Connecting…' : 'Connect GitHub'}
          </button>
          {phase === 'error' && (
            <div className="flex items-start gap-2 rounded-[10px] border border-red-400/20 bg-red-400/[0.05] px-3 py-2.5 text-xs text-red-400/90">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {err}
            </div>
          )}
          <p className="text-xs text-slate-600">
            GitHub → Settings → Developer settings → Personal access tokens (classic). Scopes needed: <code className="text-slate-500">repo</code>.
          </p>
        </div>
      )}

      {/* Connected dashboard */}
      {phase === 'connected' && data && (
        <>
          {/* Status */}
          <div className="mb-5 flex items-center gap-2 rounded-[12px] border border-emerald-400/15 bg-emerald-400/[0.04] px-4 py-2.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-sm text-emerald-400/90">Connected as {data.user.login}</span>
            <span className="ml-auto text-xs text-slate-600">Token stored in browser only</span>
          </div>

          {/* Repo card */}
          <section className="mb-5 rounded-[18px] border border-line bg-surface p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Github className="h-4 w-4 text-slate-500 shrink-0" />
                  <span className="font-mono text-[14px] font-semibold text-white truncate">{data.repo.full_name}</span>
                  {data.repo.private && (
                    <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-500">Private</span>
                  )}
                </div>
                {data.repo.description && (
                  <p className="mt-1.5 text-xs text-slate-500 line-clamp-2">{data.repo.description}</p>
                )}
              </div>
              <a href={`https://github.com/${data.repo.full_name}`} target="_blank" rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-3 border-t border-line pt-4">
              {[
                { label: 'Branch',     value: data.repo.default_branch,              Icon: GitBranch,     color: 'text-sky-400'    },
                { label: 'Stars',      value: data.repo.stargazers_count.toString(),  Icon: Star,          color: 'text-amber-400'  },
                { label: 'Open issues',value: data.repo.open_issues_count.toString(), Icon: Circle,        color: 'text-orange-400' },
                { label: 'Language',   value: data.repo.language || '—',              Icon: CheckCircle2,  color: 'text-violet-400' },
              ].map(({ label, value, Icon, color }) => (
                <div key={label}>
                  <div className="text-[10px] text-slate-600 uppercase tracking-wider">{label}</div>
                  <div className="mt-1 flex items-center gap-1">
                    <Icon className={`h-3 w-3 ${color}`} />
                    <span className="text-xs text-slate-300">{value}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Tabs */}
          <div className="mb-3 flex gap-1 rounded-[12px] border border-line bg-surface p-1">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-[9px] px-3 py-2 text-xs font-medium transition ${
                  tab === t.id ? 'bg-surface-2 text-white' : 'text-slate-500 hover:text-slate-400'
                }`}>
                {t.label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${tab === t.id ? 'bg-white/[0.12] text-slate-100' : 'bg-surface-2 text-slate-600'}`}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {/* Commits */}
          {tab === 'commits' && (
            <div className="rounded-[16px] border border-line bg-surface divide-y divide-white/[0.04] overflow-hidden">
              {data.commits.length === 0
                ? <div className="px-5 py-8 text-center text-sm text-slate-600">No commits</div>
                : data.commits.map((c) => (
                    <a key={c.sha} href={c.html_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-start gap-3 px-5 py-3.5 transition hover:bg-surface-2">
                      <GitCommit className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-slate-100 truncate">{c.commit.message.split('\n')[0]}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-600">
                          <span className="font-mono">{c.sha.slice(0, 7)}</span>
                          <span>·</span>
                          <span>{c.commit.author.name}</span>
                          <span>·</span>
                          <span>{timeAgo(c.commit.author.date)}</span>
                        </div>
                      </div>
                      <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-slate-600" />
                    </a>
                  ))
              }
            </div>
          )}

          {/* Pull Requests */}
          {tab === 'prs' && (
            <div className="rounded-[16px] border border-line bg-surface divide-y divide-white/[0.04] overflow-hidden">
              {data.prs.length === 0
                ? <div className="px-5 py-8 text-center text-sm text-slate-600">No open pull requests</div>
                : data.prs.map((pr) => (
                    <a key={pr.number} href={pr.html_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-start gap-3 px-5 py-3.5 transition hover:bg-surface-2">
                      <GitPullRequest className={`mt-0.5 h-4 w-4 shrink-0 ${pr.draft ? 'text-slate-600' : 'text-emerald-400/70'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-slate-100 truncate">{pr.title}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-600">
                          <span>#{pr.number}</span>
                          <span>·</span>
                          <span>{pr.user.login}</span>
                          <span>·</span>
                          <span>{timeAgo(pr.created_at)}</span>
                          {pr.draft && <span className="text-slate-600">[draft]</span>}
                        </div>
                      </div>
                      <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-slate-600" />
                    </a>
                  ))
              }
            </div>
          )}

          {/* Issues */}
          {tab === 'issues' && (
            <div className="rounded-[16px] border border-line bg-surface divide-y divide-white/[0.04] overflow-hidden">
              {data.issues.length === 0
                ? <div className="px-5 py-8 text-center text-sm text-slate-600">No open issues</div>
                : data.issues.map((issue) => (
                    <a key={issue.number} href={issue.html_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-start gap-3 px-5 py-3.5 transition hover:bg-surface-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-400/60" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-slate-100 truncate">{issue.title}</div>
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs text-slate-600">#{issue.number} · {timeAgo(issue.created_at)}</span>
                          {issue.labels.slice(0, 3).map((l) => (
                            <span key={l.name}
                              className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                              style={{ background: `#${l.color}22`, color: `#${l.color}`, border: `1px solid #${l.color}44` }}>
                              {l.name}
                            </span>
                          ))}
                        </div>
                      </div>
                      <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-slate-600" />
                    </a>
                  ))
              }
            </div>
          )}
        </>
      )}

    </div>
  )
}
