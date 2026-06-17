export interface QueuedPunch {
  id: string               // client-generated UUID — used as idempotency_key
  punch_type: 'clock_in' | 'clock_out'
  punched_at: string       // ISO timestamp of when the worker tapped the button
  latitude?: number
  longitude?: number
  job_id?: string
}

const QUEUE_KEY = 'staff_punch_queue_v1'

function readQueue(): QueuedPunch[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as QueuedPunch[]
  } catch {
    return []
  }
}

function writeQueue(q: QueuedPunch[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}

export function enqueue(punch: Omit<QueuedPunch, 'id'>): QueuedPunch {
  const item: QueuedPunch = { ...punch, id: crypto.randomUUID() }
  const q = readQueue()
  q.push(item)
  writeQueue(q)
  return item
}

export function pendingCount(): number {
  return readQueue().length
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY)
}

// Sends each queued punch to the server in order.
// Stops on the first network failure (will retry next time).
// Calls onProgress(remaining) after each successful send.
export async function flushQueue(onProgress?: (remaining: number) => void): Promise<void> {
  const q = readQueue()
  if (q.length === 0) return

  for (const punch of q) {
    try {
      const res = await fetch('/api/supplier-portal/staff/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          punch_type: punch.punch_type,
          punched_at: punch.punched_at,
          latitude: punch.latitude,
          longitude: punch.longitude,
          job_id: punch.job_id,
          idempotency_key: punch.id,
        }),
      })

      if (res.ok) {
        // Remove this punch from the queue
        const current = readQueue()
        writeQueue(current.filter(p => p.id !== punch.id))
        onProgress?.(pendingCount())
      } else {
        // Server-side error (not a network failure) — remove to avoid infinite loop
        const current = readQueue()
        writeQueue(current.filter(p => p.id !== punch.id))
        onProgress?.(pendingCount())
      }
    } catch {
      // Network still down — stop here, leave remaining punches in queue
      break
    }
  }
}
