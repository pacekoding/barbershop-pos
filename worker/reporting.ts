const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const JAYAPURA_OFFSET = '+09:00'

export interface DatePeriod {
  from: string
  to: string
  startUtc: string
  endUtc: string
  timezone: 'Asia/Jayapura'
}

function validDate(value: string) {
  if (!DATE_PATTERN.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function jayapuraDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jayapura', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

export function parsePeriod(fromValue?: string, toValue?: string): DatePeriod | null {
  const today = jayapuraDate()
  const from = fromValue || today
  const to = toValue || from
  if (!validDate(from) || !validDate(to) || from > to) return null
  const start = new Date(`${from}T00:00:00${JAYAPURA_OFFSET}`)
  const end = new Date(`${to}T00:00:00${JAYAPURA_OFFSET}`)
  end.setUTCDate(end.getUTCDate() + 1)
  if ((end.getTime() - start.getTime()) / 86_400_000 > 366) return null
  return { from, to, startUtc: start.toISOString(), endUtc: end.toISOString(), timezone: 'Asia/Jayapura' }
}

export function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`)
}
