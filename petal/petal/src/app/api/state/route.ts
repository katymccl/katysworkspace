import { NextResponse } from 'next/server'
import redis from '@/lib/redis'
import { AppState } from '@/types'

const KEY = 'petal:state'

const DEFAULT_STATE: AppState = {
  tasks: [],
  categories: ['personal', 'work', 'errands', 'ideas'],
}

export async function GET() {
  try {
    const data = await redis.get<AppState>(KEY)
    return NextResponse.json(data ?? DEFAULT_STATE)
  } catch {
    return NextResponse.json(DEFAULT_STATE)
  }
}

export async function POST(req: Request) {
  try {
    const body: AppState = await req.json()
    await redis.set(KEY, body)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
