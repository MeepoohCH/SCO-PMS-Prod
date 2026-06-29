export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const clean = String(dateStr).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean
  const [y, m, d] = clean.split('-')
  return `${d}-${m}-${y}`
}

export function cleanDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  return String(dateStr).slice(0, 10)
}

export function toThaiTime(isoString: string | null | undefined): string {
  if (!isoString) return ''
  const date = new Date(isoString)
  return date.toLocaleString('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

// Fixed +7 hours — never reads browser/server local timezone.
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000

export function toThaiDateTimeInputValue(isoString: string | null | undefined): string {
  if (!isoString) return ''
  const utcMs = new Date(isoString).getTime()
  if (isNaN(utcMs)) return ''
  const d = new Date(utcMs + BANGKOK_OFFSET_MS)
  const yyyy = d.getUTCFullYear()
  const mm   = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd   = String(d.getUTCDate()).padStart(2, '0')
  const hh   = String(d.getUTCHours()).padStart(2, '0')
  const min  = String(d.getUTCMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

export function fromThaiInputToUTC(thaiDateTimeLocal: string): string {
  if (!thaiDateTimeLocal) return ''
  const [datePart, timePart] = thaiDateTimeLocal.split('T')
  const [y, m, d] = datePart.split('-').map(Number)
  const [hh, mm] = (timePart || '00:00').split(':').map(Number)
  const asIfUTC = Date.UTC(y, m - 1, d, hh, mm, 0, 0)
  return new Date(asIfUTC - BANGKOK_OFFSET_MS).toISOString()
}

export function formatTime(val?: string | null): string {
  if (!val) return '—'
  const s = String(val)
  if (/^\d{2}:\d{2}$/.test(s)) return s
  if (s.includes('T')) return toThaiTime(s)
  return s.slice(0, 5)
}

export function formatDuration(start?: string | null, end?: string | null): string {
  if (!start || !end) return ''
  try {
    const diffMs = new Date(end).getTime() - new Date(start).getTime()
    if (diffMs < 0 || isNaN(diffMs)) return ''
    const totalMinutes = Math.floor(diffMs / 60000)
    const days = Math.floor(totalMinutes / 1440)
    const hours = Math.floor((totalMinutes % 1440) / 60)
    const minutes = totalMinutes % 60
    const parts: string[] = []
    if (days > 0) parts.push(`${days}d`)
    if (hours > 0 || days > 0) parts.push(`${hours}h`)
    parts.push(`${minutes}m`)
    return parts.join(' ')
  } catch { return '' }
}

export function formatDowntimeDate(iso?: string | null): string {
  if (!iso) return ''
  try {
    const utcMs = new Date(iso).getTime()
    if (isNaN(utcMs)) return ''
    const d = new Date(utcMs + BANGKOK_OFFSET_MS)
    const dd = String(d.getUTCDate()).padStart(2, '0')
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
    const yyyy = d.getUTCFullYear()
    return `${dd}/${mm}/${yyyy}`
  } catch { return '' }
}
