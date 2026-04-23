import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { AppState } from '@/types'

const DEFAULT_STATE: AppState = {
  tasks: [],
  categories: ['personal', 'work', 'errands', 'ideas'],
  projects: [],
}

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    throw new Error(`Missing Upstash env vars. URL: ${url ? 'set' : 'MISSING'}, TOKEN: ${token ? 'set' : 'MISSING'}`)
  }
  return { url, token }
}

async function redisGet(key: string): Promise<AppState | null> {
  const { url, token } = getRedis()
  const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const json = await res.json()
  if (json.result === null || json.result === undefined) return null
  const val = typeof json.result === 'string' ? JSON.parse(json.result) : json.result
  return val as AppState
}

async function redisSet(key: string, value: AppState): Promise<void> {
  const { url, token } = getRedis()
  const res = await fetch(`${url}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(value),
    cache: 'no-store',
  })
  const json = await res.json()
  if (json.error) throw new Error(`Upstash error: ${json.error}`)
}

export async function GET() {
  try {
    const { userId } = auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const key = `petal:state:${userId}`
    const data = await redisGet(key)
    return NextResponse.json(data ?? DEFAULT_STATE)
  } catch (err) {
    console.error('[petal] GET error:', err)
    return NextResponse.json({ ...DEFAULT_STATE, _error: String(err) })
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const key = `petal:state:${userId}`
    const body: AppState = await req.json()
    await redisSet(key, body)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[petal] POST error:', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
