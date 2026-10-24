import { championIcon, type GameStats, type PlayerLine, type SideStats } from '../live'
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
    version: string // Data Dragon version for champion icons
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
            {g.blue.players.map((b, i) => {
                const r = g.red.players[i]
                const diff = r ? b.gold - r.gold : 0
                return (
                    <div class="gb-row">
                        <Player p={b} version={props.version} side="l" />
                        <div class="gb-role">
                            <span>{ROLE_LABEL[b.role] ?? b.role}</span>
                            {diff !== 0 && (
                                <small class={diff > 0 ? 'lead-l' : 'lead-r'}>
                                    {diff > 0 ? '◀' : ''} {k(Math.abs(diff))} {diff < 0 ? '▶' : ''}
                                </small>
                            )}
                        </div>
                        {r ? <Player p={r} version={props.version} side="r" /> : <div />}
                    </div>
                )
            })}
        </details>
    )
}

function TeamTotals(props: { s: SideStats; team?: BoardTeam; won: boolean; side: 'l' | 'r' }) {
    const { s, team } = props
    const dragons = s.dragons.length ? s.dragons.join(', ') : 'none'
    return (
        <div class={`gb-team ${props.side}`}>
            <span class="gb-name">
                <Logo src={team?.image} size={20} />
                <b>{team?.code ?? '?'}</b>
                {props.won && <span class="gb-win">WIN</span>}
            </span>
            <span class="gb-totals">
                <span title="Team gold">
                    <b>{k(s.gold)}</b> gold
                </span>
                <span title="Kills">
                    <b>{s.kills}</b> K
                </span>
                <span title="Towers destroyed">
                    <b>{s.towers}</b> T
                </span>
                <span title={`Dragons: ${dragons}`}>
                    <b>{s.dragons.length}</b> D
                </span>
                <span title="Barons">
                    <b>{s.barons}</b> B
                </span>
            </span>
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
            <span class="gb-kda">
                {p.kills}/<em>{p.deaths}</em>/{p.assists}
            </span>
            <span class="gb-cs" title="Creep score">
                {p.cs}
            </span>
            <span class="gb-gold" title="Gold">
                {k(p.gold)}
            </span>
        </div>
    )
}
