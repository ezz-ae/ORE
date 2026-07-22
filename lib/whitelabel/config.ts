/**
 * White-label demo mode — configuration and flag.
 *
 * This whole subsystem is DORMANT unless `NEXT_PUBLIC_WHITE_LABEL=1`. In the
 * Freehold production deployment the flag is unset, so none of the onboarding,
 * key-gate, or runtime-brand behaviour activates and the product behaves exactly
 * as before. The white-label deployment (its own repo / Vercel project / Neon
 * DB) sets the flag and runs `pnpm seed:demo` to fill the shared demo dataset.
 *
 * Model (per the product decision):
 *   • one shared demo dataset — every workspace sees the same "alive" numbers;
 *   • one key = one branded workspace — the vendor mints keys, a prospect
 *     redeems a key once to set their brand name + logo and enter the system.
 *
 * The flag is read from a NEXT_PUBLIC_* variable so both server and client
 * components can branch on it (inlined at build time).
 */

/** True when this deployment runs as the white-label demo, not Freehold. */
export const WHITE_LABEL = process.env.NEXT_PUBLIC_WHITE_LABEL === '1'

/** Cookie carrying the signed white-label workspace session (brand snapshot). */
export const WL_SESSION_COOKIE = 'wl_workspace'

/** Workspace session lifetime — a demo tour, not a long-lived account. */
export const WL_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

/**
 * Vendor secret that authorises minting access keys via the admin endpoint.
 * Set `WL_ADMIN_SECRET` in the white-label deployment; the mint endpoint refuses
 * to issue keys when it is unset (fail closed).
 */
export const wlAdminSecret = (): string | null => process.env.WL_ADMIN_SECRET?.trim() || null

/** Max logo upload size once decoded (keep the workspace row small). */
export const WL_LOGO_MAX_BYTES = 256 * 1024 // 256 KB after downscale

/** Default accent if a workspace does not choose one (Freehold gold). */
export const WL_DEFAULT_ACCENT = '#D4AF37'
