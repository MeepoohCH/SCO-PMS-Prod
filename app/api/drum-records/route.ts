import { NextResponse } from 'next/server'

// drum_records table removed — endpoint no longer available
export async function POST() {
  return NextResponse.json({ error: 'drum_records has been removed' }, { status: 410 })
}
