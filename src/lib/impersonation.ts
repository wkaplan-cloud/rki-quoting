import { cookies } from 'next/headers'

export const IMPERSONATION_COOKIE = 'qh_impersonation'

export type ImpersonationStash = {
  adminEmail: string
  adminAccessToken: string
  adminRefreshToken: string
  orgId: string
  orgName: string
  targetEmail: string
  targetUserId: string
  startedAt: string
}

export async function getImpersonationStash(): Promise<ImpersonationStash | null> {
  const store = await cookies()
  const raw = store.get(IMPERSONATION_COOKIE)?.value
  if (!raw) return null
  try {
    return JSON.parse(raw) as ImpersonationStash
  } catch {
    return null
  }
}
