import { championIcon, itemIcon, type GameStats, type ItemInfo, type PlayerLine } from '../live'
import { logoUrl } from '../format'
import { Logo, roleLabel } from './ui'

export interface BoardTeam {
    code: string
    image: string | null
}

const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

// One game, mirrored: blue side left, red side right, one row per role.
export function GameBoard(props: {
    id: string
    number: number
    stats: GameStats
    teams: Map<string, BoardTeam>
    version: string // Data Dragon version for champion and item icons
    items: Map<number, ItemInfo> | null // for item tooltips; same version
    champions: Map<string, string> | null // for champion tooltips; same version
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
                <span class="live">{g.state === 'paused' ? 'PAUSED' : 'LIVE'}</span>{' '}
                {/* Counts up in the browser between refreshes; see CLOCK_SCRIPT in ui.tsx. */}
                <span
                    data-clock={g.clock}
                    data-game={props.id}
                    data-running={g.state === 'in_game' ? '1' : undefined}
                >
                    {clock(g.clock)}
                </span>
            </>
        )

    return (
        <details class="gb" open={props.open || undefined}>
            <summary class="gb-sum">
                <b>Game {props.number}</b>
                <span class="gb-state">{state}</span>
                {winner && <span class="gb-win">{teams.get(g[winner].teamId)?.code ?? winner} win</span>}
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
                        <Player
                            p={b}
                            version={props.version}
                            items={props.items}
                            champions={props.champions}
                            side="l"
                        />
                        <div class="gb-role">{roleLabel(b.role)}</div>
                        {r ? (
                            <Player
                                p={r}
                                version={props.version}
                                items={props.items}
                                champions={props.champions}
                                side="r"
                            />
                        ) : (
                            <div />
                        )}
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

function Player(props: {
    p: PlayerLine
    version: string
    items: Map<number, ItemInfo> | null
    champions: Map<string, string> | null
    side: 'l' | 'r'
}) {
    const { p } = props
    const icon = logoUrl(championIcon(props.version, p.champion), 56)
    const champ = props.champions?.get(p.champion) // display name

    return (
        <div class={`gb-p ${props.side}`}>
            <span class="gb-champ" tabindex={champ ? 0 : undefined} title={champ ? undefined : p.champion}>
                {icon && (
                    <img
                        src={icon}
                        width={28}
                        height={28}
                        alt={champ ?? p.champion}
                        loading="lazy"
                        decoding="async"
                    />
                )}
                <i>{p.level}</i>
                {champ && (
                    <span class="gb-tip gb-tip-ch" role="tooltip">
                        {champ}
                    </span>
                )}
            </span>
            <span class="gb-pname">{p.name}</span>
            <span class="gb-items">
                {/* Always six slots, so short builds line up with full ones. */}
                {Array.from({ length: 6 }, (_, i) => {
                    const id = p.items[i]
                    const info = id === undefined ? undefined : props.items?.get(id)

                    return id === undefined ? (
                        <span class="gb-slot" />
                    ) : (
                        // Focusable, so the tooltip also opens from the keyboard.
                        <span class="gb-it" tabindex={info ? 0 : undefined}>
                            <img
                                src={logoUrl(itemIcon(props.version, id), 40) ?? ''}
                                width={20}
                                height={20}
                                alt={info?.name ?? ''}
                                loading="lazy"
                                decoding="async"
                            />
                            {info && <ItemTip item={info} />}
                        </span>
                    )
                })}
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

// Shown on hover or focus by CSS alone (items only show on desktop). Spans, as it sits in a span.
function ItemTip(props: { item: ItemInfo }) {
    const { item } = props

    return (
        <span class="gb-tip" role="tooltip">
            <span class="gb-tip-head">
                <b>{item.name}</b>
                <span class="gb-tip-gold">{item.gold}</span>
            </span>
            {item.stats.length > 0 && (
                <span class="gb-tip-stats">
                    {item.stats.map((s) => {
                        // "45 Attack Damage": the number stands out, like in game.
                        const [, num, rest] = /^([\d.,%+-]+)\s+(.*)$/.exec(s) ?? ['', '', s]

                        return (
                            <span>
                                {num && <b>{num}</b>} {rest}
                            </span>
                        )
                    })}
                </span>
            )}
            {item.effects.map((e) => (
                <span class="gb-tip-fx">
                    {e.name && <b class={e.kind}>{e.name}</b>}
                    {e.cooldown && <span class="gb-tip-cd"> ({e.cooldown})</span>} {e.text}
                </span>
            ))}
        </span>
    )
}
