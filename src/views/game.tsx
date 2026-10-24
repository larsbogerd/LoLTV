import { championIcon, itemIcon, type GameStats, type PlayerLine, type SideStats } from '../live'
import { logoUrl } from '../format'
import { Logo } from './ui'

export interface BoardTeam {
    code: string
    image: string | null
}

const ROLE_LABEL: Record<string, string> = {
    top: 'TOP',
    jungle: 'JGL',
    mid: 'MID',
    bottom: 'BOT',
    support: 'SUP',
}

const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

// One game, mirrored: blue side left, red side right, one row per role.
export function GameBoard(props: {
    number: number
    stats: GameStats
    teams: Map<string, BoardTeam>
    version: string // Data Dragon version for champion and item icons
    runes: Map<number, string> // rune id -> icon
    winnerId?: string // the real result when known (Bo1); otherwise the stats' best guess is used
    open: boolean
}) {
    const { stats: g, teams } = props
    const winner = props.winnerId
        ? props.winnerId === g.blue.teamId
            ? 'blue'
            : props.winnerId === g.red.teamId
              ? 'red'
              : g.winner
        : g.winner
    const state =
        g.state === 'finished' ? (
            <span class="gb-final">Final {clock(g.clock)}</span>
        ) : (
            <>
                <span class="live">{g.state === 'paused' ? 'PAUSED' : 'LIVE'}</span> {clock(g.clock)}
            </>
        )

    return (
        <details class="gb" open={props.open || undefined}>
            <summary class="gb-sum">
                <b>Game {props.number}</b>
                <span class="gb-state">{state}</span>
                {winner && <span class="gb-win">{teams.get(g[winner].teamId)?.code ?? winner} win</span>}
                <span class="sub">Patch {g.patch}</span>
            </summary>
            <div class="gb-teams">
                <TeamTotals s={g.blue} team={teams.get(g.blue.teamId)} won={winner === 'blue'} side="l" />
                <span class="gb-vs">vs</span>
                <TeamTotals s={g.red} team={teams.get(g.red.teamId)} won={winner === 'red'} side="r" />
            </div>
            <div class="gb-row gb-cols">
                <ColumnLabels side="l" />
                <div />
                <ColumnLabels side="r" />
            </div>
            {g.blue.players.map((b, i) => {
                const r = g.red.players[i]
                return (
                    <div class="gb-row">
                        <Player p={b} version={props.version} runes={props.runes} side="l" />
                        <div class="gb-role">{ROLE_LABEL[b.role] ?? b.role}</div>
                        {r ? <Player p={r} version={props.version} runes={props.runes} side="r" /> : <div />}
                    </div>
                )
            })}
        </details>
    )
}

function TeamTotals(props: { s: SideStats; team?: BoardTeam; won: boolean; side: 'l' | 'r' }) {
    const { s, team } = props
    return (
        <div class={`gb-team ${props.side}`}>
            <span class="gb-name">
                <Logo src={team?.image} size={20} />
                <b>{team?.code ?? '?'}</b>
                {props.won && <span class="gb-win">WIN</span>}
            </span>
            <span class="gb-totals" title="Team gold">
                <b>{k(s.gold)}</b> gold
            </span>
        </div>
    )
}

// Column headings, laid out on the same grid as the player rows (hidden on phones).
function ColumnLabels(props: { side: 'l' | 'r' }) {
    return (
        <div class={`gb-p ${props.side}`}>
            <span class="gb-champ-ph" />
            <span class="gb-pname" />
            <span class="gb-runes" />
            <span class="gb-items" />
            <span class="gb-kda">K/D/A</span>
            <span class="gb-cs">CS</span>
        </div>
    )
}

function Player(props: { p: PlayerLine; version: string; runes: Map<number, string>; side: 'l' | 'r' }) {
    const { p } = props
    const icon = logoUrl(championIcon(props.version, p.champion), 56)
    return (
        <div class={`gb-p ${props.side}`}>
            <span class="gb-champ" title={p.champion}>
                {icon && (
                    <img src={icon} width={28} height={28} alt={p.champion} loading="lazy" decoding="async" />
                )}
                <i>{p.level}</i>
            </span>
            <span class="gb-pname">{p.name}</span>
            <Runes p={p} icons={props.runes} />
            <span class="gb-items">
                {p.items.map((id) => (
                    <img
                        src={logoUrl(itemIcon(props.version, id), 40) ?? ''}
                        width={20}
                        height={20}
                        alt=""
                        loading="lazy"
                        decoding="async"
                    />
                ))}
            </span>
            <span class="gb-kda">
                {p.kills}/{p.deaths}/{p.assists}
            </span>
            <span class="gb-cs" title="Creep score">
                {p.cs}
            </span>
        </div>
    )
}

// Keystone and secondary tree side by side, like the in-game scoreboard. (Summoner spells
// aren't in the feed.)
function Runes(props: { p: PlayerLine; icons: Map<number, string> }) {
    const r = props.p.runes
    const keystone = r ? logoUrl(props.icons.get(r.keystone), 44) : null
    const secondary = r ? logoUrl(props.icons.get(r.secondary), 32) : null
    return (
        <span class="gb-runes">
            {keystone && <img class="key" src={keystone} width={22} height={22} alt="" loading="lazy" />}
            {secondary && <img class="sec" src={secondary} width={16} height={16} alt="" loading="lazy" />}
        </span>
    )
}
