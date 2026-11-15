// Time formatting in the viewer's timezone (from the `tz` cookie) plus slug helpers.

export function safeTimeZone(tz: string | undefined): string {
    if (!tz) return 'UTC'

    try {
        new Intl.DateTimeFormat('en-GB', { timeZone: tz })

        return tz
    } catch {
        return 'UTC'
    }
}

export function ordinal(n: number): string {
    const s = n % 100

    if (s >= 11 && s <= 13) return `${n}th`

    return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}

export interface Fmt {
    tz: string
    time(iso: string): string // 20:00
    dayKey(iso: string): string // 2026-10-23, in the viewer's timezone
    dayHeading(key: string): string // Friday 23 October, plus the year when it isn't this year
    shortDate(iso: string): string // 23 Oct
    ordinalDate(iso: string): string // 19th of Oct   (HLTV ranking box)
    longDate(iso: string): string // 24th of October 2026   (HLTV match page)
    relativeDay(key: string): string | null // Today / Tomorrow / Yesterday
}

export function makeFmt(tz: string, now = new Date()): Fmt {
    const time = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    })

    const day = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    })

    const short = new Intl.DateTimeFormat('en-GB', { timeZone: tz, day: 'numeric', month: 'short' })
    // Day keys are calendar dates, so format them back in UTC to avoid shifting.
    const weekday = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long' })
    const month = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long' })
    const monthShort = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'short' })

    const dayKey = (iso: string) => day.format(new Date(iso))
    const keyDate = (key: string) => new Date(`${key}T12:00:00Z`)
    const today = day.format(now)

    const rel = new Map([
        [today, 'Today'],
        [day.format(new Date(now.getTime() + 86400e3)), 'Tomorrow'],
        [day.format(new Date(now.getTime() - 86400e3)), 'Yesterday'],
    ])

    return {
        tz,
        time: (iso) => time.format(new Date(iso)),
        dayKey,
        dayHeading: (key) => {
            const d = keyDate(key)
            const year = key.slice(0, 4) === today.slice(0, 4) ? '' : ` ${d.getUTCFullYear()}`

            return `${weekday.format(d)} ${d.getUTCDate()} ${month.format(d)}${year}`
        },
        shortDate: (iso) => short.format(new Date(iso)),
        longDate: (iso) => {
            const d = keyDate(dayKey(iso))

            return `${ordinal(d.getUTCDate())} of ${month.format(d)} ${d.getUTCFullYear()}`
        },
        ordinalDate: (iso) => {
            const d = keyDate(dayKey(iso))

            return `${ordinal(d.getUTCDate())} of ${monthShort.format(d)}`
        },
        relativeDay: (key) => rel.get(key) ?? null,
    }
}

// "2026-10-15", "2026-11-15" -> "Oct 15th - Nov 15th 2026" (calendar dates, no timezone)
export function dateRange(startDate: string, endDate: string): string {
    const month = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short' })
    const s = new Date(`${startDate}T12:00:00Z`)
    const e = new Date(`${endDate}T12:00:00Z`)

    return `${month.format(s)} ${ordinal(s.getUTCDate())} - ${month.format(e)} ${ordinal(e.getUTCDate())} ${e.getUTCFullYear()}`
}

export function slugify(...parts: string[]): string {
    return parts
        .join('-')
        .normalize('NFKD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

export function daysUntil(dateStr: string, now = new Date()): number {
    return Math.ceil((new Date(`${dateStr}T00:00:00Z`).getTime() - now.getTime()) / 86400e3)
}

// Leaguepedia names countries in words. ISO codes for the ones pro players come from.
const COUNTRY_CODES: Record<string, string> = {
    Albania: 'AL',
    Algeria: 'DZ',
    Argentina: 'AR',
    Armenia: 'AM',
    Australia: 'AU',
    Austria: 'AT',
    Belarus: 'BY',
    Belgium: 'BE',
    Bolivia: 'BO',
    'Bosnia and Herzegovina': 'BA',
    Brazil: 'BR',
    Bulgaria: 'BG',
    Canada: 'CA',
    Chile: 'CL',
    China: 'CN',
    Colombia: 'CO',
    'Costa Rica': 'CR',
    Croatia: 'HR',
    Cyprus: 'CY',
    'Czech Republic': 'CZ',
    Denmark: 'DK',
    'Dominican Republic': 'DO',
    Ecuador: 'EC',
    Egypt: 'EG',
    Estonia: 'EE',
    Finland: 'FI',
    France: 'FR',
    Georgia: 'GE',
    Germany: 'DE',
    Greece: 'GR',
    'Hong Kong': 'HK',
    Hungary: 'HU',
    Iceland: 'IS',
    India: 'IN',
    Indonesia: 'ID',
    Iraq: 'IQ',
    Ireland: 'IE',
    Israel: 'IL',
    Italy: 'IT',
    Japan: 'JP',
    Jordan: 'JO',
    Kazakhstan: 'KZ',
    Latvia: 'LV',
    Lebanon: 'LB',
    Lithuania: 'LT',
    Luxembourg: 'LU',
    Macau: 'MO',
    Malaysia: 'MY',
    Mexico: 'MX',
    Mongolia: 'MN',
    Montenegro: 'ME',
    Morocco: 'MA',
    Netherlands: 'NL',
    'New Zealand': 'NZ',
    'North Macedonia': 'MK',
    Norway: 'NO',
    Paraguay: 'PY',
    Peru: 'PE',
    Philippines: 'PH',
    Poland: 'PL',
    Portugal: 'PT',
    'Puerto Rico': 'PR',
    Romania: 'RO',
    Russia: 'RU',
    'Saudi Arabia': 'SA',
    Serbia: 'RS',
    Singapore: 'SG',
    Slovakia: 'SK',
    Slovenia: 'SI',
    'South Korea': 'KR',
    Spain: 'ES',
    Sweden: 'SE',
    Switzerland: 'CH',
    Taiwan: 'TW',
    Thailand: 'TH',
    Tunisia: 'TN',
    Turkey: 'TR',
    Ukraine: 'UA',
    'United Arab Emirates': 'AE',
    'United Kingdom': 'GB',
    'United States': 'US',
    Uruguay: 'UY',
    Venezuela: 'VE',
    Vietnam: 'VN',
}

// "Germany" -> the German flag as an emoji. Null for a country that isn't in the list.
// Emoji need no image files. Windows browsers show the two letters instead of a flag.
export function flagEmoji(country: string | undefined): string | null {
    const code = COUNTRY_CODES[country ?? '']

    return code ? String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0))) : null
}

// Shrinks the huge source PNGs (often 70KB+) through the resizer lolesports.com itself uses.
export function logoUrl(src: string | undefined | null, px: number): string | null {
    if (!src) return null
    const http = src.replace(/^https:/, 'http:')

    return `https://am-a.akamaihd.net/image?resize=${px}:&f=${encodeURIComponent(http)}`
}
