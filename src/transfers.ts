// Roster logic on Leaguepedia rows: turning join/leave rows into moves, and a team's players
// into a roster. Pure: no I/O and no runtime imports, so `node --test` loads this file as is.

export const PLAY_ROLES = ['top', 'jungle', 'mid', 'bottom', 'support'] as const
export type Role = (typeof PLAY_ROLES)[number] | 'coach'

const WIKI_ROLES = new Map<string, Role>([
    ['top', 'top'],
    ['jungle', 'jungle'],
    ['mid', 'mid'],
    ['bot', 'bottom'],
    ['support', 'support'],
])

// Leaguepedia role lists ("Bot", "Head Coach", "Top;Mid") to ours. Roles we don't show
// (streamer, manager, analyst, owner) give null.
export function wikiRole(roles: string): { role: Role; label: string } | null {
    for (const part of roles.split(/[;,/]/)) {
        const label = part.trim()
        const role = WIKI_ROLES.get(label.toLowerCase())

        if (role) return { role, label }

        if (/coach/i.test(label)) return { role: 'coach', label }
    }

    return null
}

// "Noah (Oh Hyeon-taek)" -> "Noah": page names carry a suffix when handles collide.
export function handleOf(page: string): string {
    return page.replace(/\s*\([^)]*\)$/, '')
}

// One RosterChanges row: a player joining or leaving one team.
export interface ChangeRow {
    id: string
    date: string // YYYY-MM-DD
    player: string // wiki page name
    direction: 'Join' | 'Leave'
    team: string // wiki team name
    roles: string
    status: string // '' | inactive | opportunities | ...
    newsId: string
    source: string | null // URL of the announcement
}

export type MoveKind = 'transfer' | 'join' | 'leave' | 'benched' | 'unbenched'

export interface Side {
    team: string | null // null: no team
    label: 'bench' | 'coach' | null
}

export interface Move {
    date: string
    page: string
    handle: string
    role: Role
    roleLabel: string // "Bot", "Head Coach"
    kind: MoveKind
    from: Side
    to: Side
    newsId: string
    source: string | null
}

// Not playing, but still under contract.
const isBench = (status: string) => status === 'inactive' || status === 'opportunities'
const days = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86400e3

// A leave and a join this close together are one move, announced by two teams.
const PAIR_DAYS = 7

// Leaguepedia has one row per join and per leave. A move is a pair of them:
// - leave + join on the same team and day: a contract renewal (dropped), or a change of
//   status (benched, back from the bench) or of job (player to coach);
// - leave + join on different teams within a week: a transfer;
// - a row on its own: a signing from nowhere, or a departure to nowhere (so far).
export function toMoves(rows: ChangeRow[]): Move[] {
    const byPlayer = new Map<string, ChangeRow[]>()
    const seen = new Set<string>()

    for (const r of rows) {
        if (seen.has(r.id) || !wikiRole(r.roles)) continue
        seen.add(r.id)
        byPlayer.set(r.player, [...(byPlayer.get(r.player) ?? []), r])
    }

    const moves: Move[] = []

    for (const [page, own] of byPlayer) {
        const used = new Set<ChangeRow>()
        const leaves = own.filter((r) => r.direction === 'Leave')
        const joins = own.filter((r) => r.direction === 'Join').sort((a, b) => a.date.localeCompare(b.date))

        const side = (r: ChangeRow): Side => ({
            team: r.team,
            label: wikiRole(r.roles)!.role === 'coach' ? 'coach' : isBench(r.status) ? 'bench' : null,
        })

        const add = (kind: MoveKind, at: ChangeRow, from: Side, to: Side, other?: ChangeRow) => {
            const { role, label } = wikiRole(at.roles)!

            moves.push({
                date: at.date,
                page,
                handle: handleOf(page),
                role,
                roleLabel: label,
                kind,
                from,
                to,
                newsId: at.newsId,
                source: at.source ?? other?.source ?? null,
            })
        }

        for (const l of leaves) {
            const j = joins.find((x) => !used.has(x) && x.team === l.team && x.date === l.date)

            if (!j) continue
            used.add(l).add(j)
            const [a, b] = [side(l), side(j)]

            if (a.label === b.label) continue // renewal
            const kind = b.label === 'bench' ? 'benched' : a.label === 'bench' ? 'unbenched' : 'transfer'

            add(kind, j, a, b, l)
        }

        for (const j of joins) {
            if (used.has(j)) continue

            const l = leaves
                .filter((x) => !used.has(x) && x.team !== j.team && days(x.date, j.date) <= PAIR_DAYS)
                .sort((x, y) => days(x.date, j.date) - days(y.date, j.date))[0]

            used.add(j)

            if (l) {
                used.add(l)
                add('transfer', j, side(l), side(j), l)
            } else {
                add('join', j, { team: null, label: null }, side(j))
            }
        }

        for (const l of leaves) {
            if (!used.has(l)) add('leave', l, side(l), { team: null, label: null })
        }
    }

    return moves.sort(
        (a, b) =>
            b.date.localeCompare(a.date) ||
            a.newsId.localeCompare(b.newsId) ||
            a.handle.localeCompare(b.handle),
    )
}

// ---------- rosters ----------

// One Players row: someone attached to a team right now.
export interface PlayerRow {
    pageId: number
    handle: string
    page: string
    name: string
    country: string
    role: string // Top | Jungle | Mid | Bot | Support | Coach
    team: string
    contract: string | null // YYYY-MM-DD
    sub: boolean
}

export interface Person {
    pageId: number
    handle: string
    name: string
    country: string
    role: Role
    title: string | null // coaches: "Head Coach", "Assistant Coach"
    contractEnd: string | null
    sub: boolean
    inactive: boolean // under contract, but benched or told to look elsewhere
}

export interface TeamRoster {
    players: Person[] // lane order, starters first
    headCoach: Person | null
    coaches: Person[] // everyone else on the staff
}

// `joins`: the rows we have of these people joining this team. Players says who is on the
// team. Their latest join says the rest: which kind of coach ("Coach" in Players, "Interim
// Head Coach" here), and whether they are still active.
export function teamRoster(team: string, rows: PlayerRow[], joins: ChangeRow[]): TeamRoster {
    // Page names start with a capital ("KkOma"), the names in roster changes don't ("kkOma").
    const key = (name: string) => name.toLowerCase()
    const latest = new Map<string, ChangeRow>()

    for (const r of joins) {
        if (r.team !== team || r.direction !== 'Join') continue
        const known = latest.get(key(r.player))

        if (!known || r.date > known.date) latest.set(key(r.player), r)
    }

    const joined = new Map<Person, string>()

    const people = rows.flatMap((r): Person[] => {
        const role = r.team === team ? wikiRole(r.role)?.role : undefined

        if (!role) return []
        const join = latest.get(key(r.page))

        const person: Person = {
            pageId: r.pageId,
            handle: r.handle,
            name: r.name,
            country: r.country,
            role,
            title: role === 'coach' && join ? (wikiRole(join.roles)?.label ?? null) : null,
            contractEnd: r.contract,
            sub: r.sub,
            inactive: join ? isBench(join.status) : false,
        }

        joined.set(person, join?.date ?? '')

        return [person]
    })

    const order = (p: Person) => PLAY_ROLES.indexOf(p.role as (typeof PLAY_ROLES)[number])
    const starts = (p: Person) => Number(p.sub || p.inactive)
    const staff = people.filter((p) => p.role === 'coach')

    // "Head Coach" or "Interim Head Coach", whoever signed last. An inactive head coach
    // (T1's kkOma, 2026) isn't it: someone else is doing the job.
    const head = staff
        .filter((p) => !p.inactive && p.title && /head coach/i.test(p.title))
        .sort((a, b) => joined.get(b)!.localeCompare(joined.get(a)!))[0]

    return {
        players: people
            .filter((p) => p.role !== 'coach')
            .sort((a, b) => order(a) - order(b) || starts(a) - starts(b) || a.handle.localeCompare(b.handle)),
        headCoach: head ?? null,
        coaches: staff.filter((p) => p !== head).sort((a, b) => a.handle.localeCompare(b.handle)),
    }
}
