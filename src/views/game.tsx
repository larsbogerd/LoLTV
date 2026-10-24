import { championIcon, itemIcon, type GameStats, type PlayerLine } from '../live'
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
            {/* Like the in-game scoreboard: kills in the centre, team gold beside them. */}
            <div class="gb-teams">
                <TeamHead team={teams.get(g.blue.teamId)} side="blue" />
                <span class="gb-gold" title="Team gold">
                    <b>{k(g.blue.gold)}</b> gold
                </span>
                <span class="gb-kills" title="Kills">
                    <b class="blue">{g.blue.kills}</b>
                    <Swords />
                    <b class="red">{g.red.kills}</b>
                </span>
                <span class="gb-gold" title="Team gold">
                    <b>{k(g.red.gold)}</b> gold
                </span>
                <TeamHead team={teams.get(g.red.teamId)} side="red" />
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
                        <Player p={b} version={props.version} side="l" />
                        <div class="gb-role">{ROLE_LABEL[b.role] ?? b.role}</div>
                        {r ? <Player p={r} version={props.version} side="r" /> : <div />}
                    </div>
                )
            })}
        </details>
    )
}

function TeamHead(props: { team?: BoardTeam; side: 'blue' | 'red' }) {
    const { team, side } = props

    return (
        <span class={`gb-team ${side}`}>
            <Logo src={team?.image} size={20} />
            <b>{team?.code ?? '?'}</b>
            <span class={`gb-side ${side}`} title={side === 'blue' ? 'Blue side' : 'Red side'}>
                {side}
            </span>
        </span>
    )
}

function Swords() {
    return (
        <svg class="gb-swords" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path
                d="M3 3l8 8M13 3L5 11M2.5 13.5l2.5-2.5M13.5 13.5L11 11"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                fill="none"
            />
        </svg>
    )
}

// Column headings, laid out on the same grid as the player rows (hidden on phones).
function ColumnLabels(props: { side: 'l' | 'r' }) {
    return (
        <div class={`gb-p ${props.side}`}>
            <span class="gb-champ-ph" />
            <span class="gb-pname" />
            <span class="gb-items" />
            <span class="gb-kda">K/D/A</span>
            <span class="gb-cs">CS</span>
        </div>
    )
}

function Player(props: { p: PlayerLine; version: string; side: 'l' | 'r' }) {
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
