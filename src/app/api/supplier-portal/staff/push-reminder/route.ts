import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

export const maxDuration = 60

// Called by cron-job.org:
//   ?type=clock_in   → sent at 5:00pm  → remind staff who haven't clocked in today
//   ?type=clock_out  → sent at 7:30pm  → remind staff who are still clocked in
export async function GET(req: NextRequest) {
  try {
    const secret = req.nextUrl.searchParams.get('secret')
    const type   = req.nextUrl.searchParams.get('type') as 'clock_in' | 'clock_out' | null

    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (type !== 'clock_in' && type !== 'clock_out') {
      return NextResponse.json({ error: 'type must be clock_in or clock_out' }, { status: 400 })
    }

    const vapidPublic  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY
    const vapidSubject = process.env.VAPID_SUBJECT ?? 'mailto:info@quotinghub.co.za'
    if (!vapidPublic || !vapidPrivate) {
      return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 })
    }
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

    // Today's date in SAST (UTC+2) — use UTC string and offset
    const now  = new Date()
    const sast = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    const todayStr = sast.toISOString().split('T')[0]
    const todayStart = `${todayStr}T00:00:00+02:00`
    const todayEnd   = `${todayStr}T23:59:59+02:00`

    // All push subscriptions for active staff
    const { data: subs } = await supabaseAdmin
      .from('elec_staff_push_subscriptions')
      .select('staff_id, endpoint, p256dh, auth')

    if (!subs || subs.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, reason: 'no subscriptions' })
    }

    // Fetch today's punches for all relevant staff
    const staffIds = [...new Set(subs.map(s => s.staff_id))]

    const { data: todayPunches } = await supabaseAdmin
      .from('elec_time_punches')
      .select('staff_id, punch_type, punched_at')
      .in('staff_id', staffIds)
      .gte('punched_at', todayStart)
      .lte('punched_at', todayEnd)
      .order('punched_at', { ascending: false })

    // Build latest punch per staff member for today
    const latestToday: Record<string, string> = {} // staff_id → punch_type
    for (const p of todayPunches ?? []) {
      if (!latestToday[p.staff_id]) latestToday[p.staff_id] = p.punch_type
    }

    // Decide who to notify
    const notify: typeof subs = []
    for (const sub of subs) {
      const latest = latestToday[sub.staff_id]
      if (type === 'clock_in') {
        // Remind only if they haven't punched at all today (never started)
        if (!latest) notify.push(sub)
      } else {
        // Remind if currently clocked in (last punch was clock_in)
        if (latest === 'clock_in') notify.push(sub)
      }
    }

    if (notify.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, reason: 'everyone already handled' })
    }

    const payload = JSON.stringify(
      type === 'clock_in'
        ? { title: '⏰ Clock In Reminder', body: "Don't forget to clock in for today!", tag: 'clock-in-reminder', url: '/supplier-portal/staff-home' }
        : { title: '🏠 Clock Out Reminder', body: "Time to clock out — don't forget!", tag: 'clock-out-reminder', url: '/supplier-portal/staff-home' }
    )

    let sent = 0
    const staleEndpoints: string[] = []

    await Promise.allSettled(
      notify.map(async sub => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            { TTL: 3600 }
          )
          sent++
        } catch (err: unknown) {
          // 410 Gone = subscription expired/unsubscribed — clean it up
          const status = (err as { statusCode?: number })?.statusCode
          if (status === 410 || status === 404) staleEndpoints.push(sub.endpoint)
        }
      })
    )

    // Remove stale subscriptions
    if (staleEndpoints.length > 0) {
      await supabaseAdmin
        .from('elec_staff_push_subscriptions')
        .delete()
        .in('endpoint', staleEndpoints)
    }

    return NextResponse.json({ ok: true, sent, staleRemoved: staleEndpoints.length })
  } catch (e) {
    return apiError(e)
  }
}
