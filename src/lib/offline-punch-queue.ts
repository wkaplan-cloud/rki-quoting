export interface QueuedPunch {
  id: string               // client-generated UUID — used as idempotency_key
  punch_type: 'clock_in' | 'clock_out'
  punched_at: string       // ISO timestamp of when the worker tapped the button
  latitude?: number
  longitude?: number
  job_id?: string
  attempts?: number        // failed sync attempts, so a poison row can't jam the queue
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

// A punch may already carry the idempotency key the online attempt used, so a
// request that reached the server but whose reply was lost replays as the *same*
// punch instead of a duplicate clock-in.
export function enqueue(punch: Omit<QueuedPunch, 'id'> & { id?: string }): QueuedPunch {
  const item: QueuedPunch = { ...punch, id: punch.id ?? crypto.randomUUID() }
  const q = readQueue()
  if (q.some(p => p.id === item.id)) return item
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

// How many times a punch may fail to send before it is abandoned. Without a
// bound, a genuinely unacceptable punch would block the queue forever; without
// *any* retry, a flat 401/500 would throw away a worker's real hours.
const MAX_ATTEMPTS = 25

function drop(id: string) {
  writeQueue(readQueue().filter(p => p.id !== id))
}

function recordFailure(id: string): void {
  const q = readQueue()
  const item = q.find(p => p.id === id)
  if (!item) return
  item.attempts = (item.attempts ?? 0) + 1
  if (item.attempts >= MAX_ATTEMPTS) { drop(id); return }
  writeQueue(q)
}

// Sends each queued punch to the server in order.
// Stops on the first network failure or retryable error (retries next time).
// Calls onProgress(remaining) after each punch that leaves the queue.
export async function flushQueue(onProgress?: (remaining: number) => void): Promise<void> {
  const q = readQueue()
  if (q.length === 0) return

  for (const punch of q) {
    let res: Response
    try {
      res = await fetch('/api/supplier-portal/staff/punch', {
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
    } catch {
      // Network still down — stop here, leave remaining punches in queue
      break
    }

    if (res.ok) {
      drop(punch.id)
      onProgress?.(pendingCount())
      continue
    }

    // 401/403 means the session lapsed while the phone was offline and 5xx means
    // the server is having a moment — neither says the punch is wrong, so keep it
    // and stop: the rest of the queue would only hit the same wall. Dropping these
    // is how a worker's hours used to vanish between site and depot.
    if (res.status === 401 || res.status === 403 || res.status === 408 || res.status === 429 || res.status >= 500) {
      recordFailure(punch.id)
      onProgress?.(pendingCount())
      break
    }

    // Any other 4xx is a punch the server will never accept (malformed, staff
    // member deactivated). Drop it rather than jam the queue behind it.
    drop(punch.id)
    onProgress?.(pendingCount())
  }
}
