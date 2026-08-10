# Freehold Intelligence — working conventions

Next.js 16 / TypeScript real-estate operating system. Public site + management
system + Meta/Google ads machine + CRM. Three languages (EN/AR/RU) everywhere.

## The gauntlet — run before every merge

```
pnpm typecheck
pnpm i18n        # 48 dicts, full EN/AR/RU parity — literal t() calls only
pnpm guards      # 50+ pure test suites in scripts/*-test.ts
rm -rf .next && pnpm build
```

`pnpm i18n` cannot see computed keys like `` t(`lm.place.verdict.${v}`) ``.
Every computed-key family must be enumerated in `scripts/dynamic-keys-test.ts`,
and the value union derived from a walkable `const` array — see
`PLACEMENT_VERDICTS` in `lib/freehold/placement-audit.ts` for the pattern.

## Commit style — subject and body do different jobs

- **Subject**: the finding, in plain words a person can retell. It is the
  narrative index of the log, not the technical index.
- **Body**: the mechanism, with exact symbols — function names, fields,
  file paths, constants. This is what makes the log searchable:
  `git log --grep` matches bodies, so `--grep=location_types` finds the
  commit whose subject says "buying tourists". A body with no greppable
  symbol in it is a defect.
- **One concern per PR.** The PR is the unit of revert (squash merge), so a
  backend rule change and a UI fix travel separately unless they are one
  incident.

## Hard rules carry their why

Every prohibition, threshold, default and hardcoded list states its reason in
the adjacent comment or the module header — including the failure it answers
to, when there was one. A rule whose why lives only in a merged PR is a rule
the next person will "fix". The guard suites restate the why as runnable
assertions; when adding a rule, add its guard.

Two rules with history, so they are never re-litigated from scratch:
- Targeting narrows by **language and behaviour, never nationality or origin**
  — language is a real Meta field and the only honest reason to narrow;
  nationality is not a field, only a proxy stack that is wrong at the edges.
  See `lib/freehold/audience-pattern.ts`.
- Numbers shown to users are **evidence-gated** — the bound facing the
  threshold or a stated Withheld, never a bare point estimate. See
  `lib/freehold/min-evidence.ts`.

## Merge workflow quirk

`main` is squash-merged, so a stacked branch reports conflicts. The fix:
`git fetch origin main && git checkout -B <branch> origin/main &&
git cherry-pick <sha> && git push --force-with-lease`, then merge the PR.
