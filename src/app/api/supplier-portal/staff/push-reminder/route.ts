import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { getFirebaseMessaging } from '@/lib/firebase-admin'

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
    if (vapidPublic && vapidPrivate) {
      webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)
    }

    // Today's date in SAST (UTC+2)
    const now  = new Date()
    const sast = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    const todayStr  = sast.toISOString().split('T')[0]
    const todayStart = `${todayStr}T00:00:00+02:00`
    const todayEnd   = `${todayStr}T23:59:59+02:00`

    // Fetch Web Push subscriptions + FCM token holders in parallel
    const [{ data: subs }, { data: fcmStaff }] = await Promise.all([
      supabaseAdmin
        .from('elec_staff_push_subscriptions')
        .select('staff_id, endpoint, p256dh, auth'),
      supabaseAdmin
        .from('elec_staff')
        .select('id, fcm_token')
        .not('fcm_token', 'is', null)
        .eq('is_active', true),
    ])

    const webPushSubs  = subs       ?? []
    const fcmRows      = fcmStaff   ?? []

    // Union of all staff IDs that need punch-status checking
    const allStaffIds = [
      ...new Set([
        ...webPushSubs.map(s => s.staff_id),
        ...fcmRows.map(s => s.id),
      ]),
    ]

    if (allStaffIds.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, reason: 'no subscriptions or fcm tokens' })
    }

    // Today's punches for all relevant staff
    const { data: todayPunches } = await supabaseAdmin
      .from('elec_time_punches')
      .select('staff_id, punch_type, punched_at')
      .in('staff_id', allStaffIds)
      .gte('punched_at', todayStart)
      .lte('punched_at', todayEnd)
      .order('punched_at', { ascending: false })

    // Latest punch per staff member for today
    const latestToday: Record<string, string> = {}
    for (const p of todayPunches ?? []) {
      if (!latestToday[p.staff_id]) latestToday[p.staff_id] = p.punch_type
    }

    function shouldNotify(staffId: string): boolean {
      const latest = latestToday[staffId]
      return type === 'clock_in' ? !latest : latest === 'clock_in'
    }

    const notifyWebPush = webPushSubs.filter(s => shouldNotify(s.staff_id))
    const notifyFcm     = fcmRows.filter(s => shouldNotify(s.id))

    if (notifyWebPush.length === 0 && notifyFcm.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, reason: 'everyone already handled' })
    }

    const { title, body, tag } =
      type === 'clock_in'
        ? { title: '⏰ Clock In Reminder', body: "Don't forget to clock in for today!", tag: 'clock-in-reminder' }
        : { title: '🏠 Clock Out Reminder', body: "Time to clock out — don't forget!", tag: 'clock-out-reminder' }

    let webPushSent   = 0
    let fcmSent       = 0
    const staleEndpoints: string[] = []

    // --- Web Push ---
    if (notifyWebPush.length > 0 && vapidPublic && vapidPrivate) {
      const payload = JSON.stringify({ title, body, tag, url: '/supplier-portal/staff-home' })
      await Promise.allSettled(
        notifyWebPush.map(async sub => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload,
              { TTL: 3600 },
            )
            webPushSent++
          } catch (err: unknown) {
            const status = (err as { statusCode?: number })?.statusCode
            if (status === 410 || status === 404) staleEndpoints.push(sub.endpoint)
          }
        }),
      )

      if (staleEndpoints.length > 0) {
        await supabaseAdmin
          .from('elec_staff_push_subscriptions')
          .delete()
          .in('endpoint', staleEndpoints)
      }
    }

    // --- FCM ---
    if (notifyFcm.length > 0) {
      const messaging = getFirebaseMessaging()
      if (messaging) {
        const tokens = notifyFcm.map(s => s.fcm_token as string)
        const result = await messaging.sendEachForMulticast({
          tokens,
          notification: { title, body },
          data: { url: '/supplier-portal/staff-home', tag },
          android: {
            priority: 'high',
            notification: { channelId: 'qh_staff_reminders', tag },
          },
        })
        fcmSent = result.successCount

        // Remove stale FCM tokens (invalid / unregistered)
        const staleTokens: string[] = []
        result.responses.forEach((r: { success: boolean; error?: { code: string } }, i: number) => {
          if (!r.success && (
            r.error?.code === 'messaging/registration-token-not-registered' ||
            r.error?.code === 'messaging/invalid-registration-token'
          )) {
            staleTokens.push(tokens[i])
          }
        })
        if (staleTokens.length > 0) {
          await supabaseAdmin
            .from('elec_staff')
            .update({ fcm_token: null })
            .in('fcm_token', staleTokens)
        }
      }
    }

    return NextResponse.json({ ok: true, webPushSent, fcmSent, staleRemoved: staleEndpoints.length })
  } catch (e) {
    return apiError(e)
  }
}
