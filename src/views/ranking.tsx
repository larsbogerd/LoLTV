import { teamUrl, type Ranking, type RankedTeam } from '../data'
import type { Fmt } from '../format'
import { Layout, Logo } from './ui'

export function RankingPage(props: { fmt: Fmt; ranking: Ranking | null; league?: string }) {
    const { fmt, ranking } = props
    if (!ranking) {
        return (
            <Layout fmt={fmt} title="Ranking" nav="ranking">
                <h2 class="h">Global Power Ranking</h2>
                <div class="empty">
                    The power ranking can't be loaded right now. Try again in a few minutes.
                </div>
            </Layout>
        )
    }

    // League filter chips, biggest leagues first (by how many ranked teams they have).
    const counts = new Map<string, { name: string; image: string; n: number }>()
    for (const t of ranking.teams) {
        if (!t.league) continue
        const c = counts.get(t.league.slug) ?? { name: t.league.name, image: t.league.image, n: 0 }
        counts.set(t.league.slug, { ...c, n: c.n + 1 })
    }
    const leagues = [...counts].sort((a, b) => b[1].n - a[1].n)
    const teams = props.league ? ranking.teams.filter((t) => t.league?.slug === props.league) : ranking.teams

    return (
        <Layout fmt={fmt} title="Ranking" nav="ranking">
            <h2 class="h">
                Global Power Ranking
                <small>Last updated: {fmt.ordinalDate(ranking.updated)}</small>
            </h2>
            <div class="chips">
                <a class={`chip ${props.league ? '' : 'on'}`} href="/ranking">
                    All
                </a>
                {leagues.map(([slug, l]) => (
                    <a class={`chip ${props.league === slug ? 'on' : ''}`} href={`/ranking?league=${slug}`}>
                        <Logo src={l.image} size={14} />
                        {l.name}
                    </a>
                ))}
            </div>
            <div class="list">
                {teams.map((t) => (
                    <RankRow t={t} />
                ))}
            </div>
            <p class="note">
                Riot's Global Power Ranking (GPR): team strength in tier 1 play, from domestic and
                international results this year. The record covers matches played this year.
            </p>
        </Layout>
    )
}

function RankRow(props: { t: RankedTeam }) {
    const { t } = props
    return (
        <a class="li rk" href={teamUrl(t.team) ?? undefined}>
            <span class="rk-pos">#{t.rank}</span>
            <Logo src={t.team.image} size={30} />
            <span class="grow">
                <span class="name rk-name">{t.team.name}</span>
                <span class="sub">
                    {t.league?.name ?? '—'} · {t.wins}-{t.losses}
                </span>
            </span>
            <span class="rk-pts">
                {t.points} <small>points</small>
            </span>
            <Movement t={t} />
        </a>
    )
}

export function Movement(props: { t: RankedTeam }) {
    const { rank, previousRank } = props.t
    if (previousRank === null || previousRank === rank) return <span class="mv">–</span>
    const up = previousRank > rank
    return (
        <span class={`mv ${up ? 'up' : 'down'}`} title={`Previously #${previousRank}`}>
            {up ? '▲' : '▼'}
            {Math.abs(previousRank - rank)}
        </span>
    )
}
