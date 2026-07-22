/**
 * Server-side resolution of the current workspace brand from the signed
 * wl_workspace cookie. Returns null in the Freehold product (flag off) or when
 * no valid workspace session is present — callers then fall back to the static
 * BRAND. Node runtime only (uses the cookie store + HMAC verify).
 */
import { cookies } from 'next/headers'
import { WHITE_LABEL, WL_SESSION_COOKIE } from './config'
import { verifyWorkspace } from './session'
import type { BrandSnapshot } from '@/components/whitelabel/brand-provider'

export async function getWorkspaceBrand(): Promise<BrandSnapshot | null> {
  if (!WHITE_LABEL) return null
  try {
    const token = (await cookies()).get(WL_SESSION_COOKIE)?.value
    const brand = verifyWorkspace(token)
    if (!brand) return null
    return { company: brand.company, product: brand.product, accent: brand.accent, logo: brand.logo }
  } catch {
    return null
  }
}
