// Fixtures are real Leaguepedia rows from November 2026, trimmed to the fields we keep.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { teamRoster, toMoves, wikiRole } from '../src/transfers.ts'

let n = 0

const row = (date, direction, player, team, roles, status = '') => ({
    id: `rc${++n}`,
    date,
    player,
    direction,
    team,
    roles,
    status,
    newsId: `${date}-${team}`,
    source: `https://example.com/${n}`,
})

const only = (rows) => {
    const moves = toMoves(rows)

    assert.equal(moves.length, 1, JSON.stringify(moves))

    return moves[0]
}

test('a renewal (leave and join, same team, same day) is not a move', () => {
    const rows = [
        row('2026-11-12', 'Join', 'kyeahoo', 'Karmine Corp', 'Mid'),
        row('2026-11-12', 'Leave', 'kyeahoo', 'Karmine Corp', 'Mid'),
    ]

    assert.deepEqual(toMoves(rows), [])
})

test('leave and join on the same day at two teams is one transfer', () => {
    const m = only([
        row('2026-07-30', 'Leave', 'Aiming', 'KT Rolster', 'Bot'),
        row('2026-07-30', 'Join', 'Aiming', 'Kiwoom DRX', 'Bot'),
    ])

    assert.equal(m.kind, 'transfer')
    assert.deepEqual(m.from, { team: 'KT Rolster', label: null })
    assert.deepEqual(m.to, { team: 'Kiwoom DRX', label: null })
    assert.equal(m.role, 'bottom')
})

test('a join announced a few days before the old team confirms the exit still pairs', () => {
    const m = only([
        row('2026-11-12', 'Join', 'Exofeng', 'G2 NORD', 'Bot'),
        row('2026-11-14', 'Leave', 'Exofeng', 'Skillcamp', 'Bot'),
    ])

    assert.equal(m.kind, 'transfer')
    assert.equal(m.date, '2026-11-12')
    assert.equal(m.from.team, 'Skillcamp')
})

test('a join weeks after a leave is a departure and then a signing', () => {
    const moves = toMoves([
        row('2026-10-01', 'Leave', 'Carzzy', 'Team Vitality', 'Bot'),
        row('2026-11-13', 'Join', 'Carzzy', 'MAD Lions', 'Bot'),
    ])

    assert.deepEqual(
        moves.map((m) => [m.kind, m.from.team, m.to.team]),
        [
            ['join', null, 'MAD Lions'],
            ['leave', 'Team Vitality', null],
        ],
    )
})

test('going inactive on the same team is a benching, coming back is the reverse', () => {
    const benched = only([
        row('2026-09-23', 'Join', 'Noah (Oh Hyeon-taek)', 'GIANTX', 'Bot', 'opportunities'),
        row('2026-09-23', 'Leave', 'Noah (Oh Hyeon-taek)', 'GIANTX', 'Bot'),
    ])

    assert.equal(benched.kind, 'benched')
    assert.equal(benched.handle, 'Noah')
    assert.deepEqual(benched.to, { team: 'GIANTX', label: 'bench' })

    const back = only([
        row('2026-08-19', 'Join', 'Bin (Chen Ze-Bin)', 'Bilibili Gaming', 'Top'),
        row('2026-08-19', 'Leave', 'Bin (Chen Ze-Bin)', 'Bilibili Gaming', 'Top', 'inactive'),
    ])

    assert.equal(back.kind, 'unbenched')
})

test('leaving from the bench keeps the bench label on the old side', () => {
    const m = only([row('2026-11-13', 'Leave', 'Lot', 'GIANTX', 'Top', 'inactive')])

    assert.equal(m.kind, 'leave')
    assert.deepEqual(m.from, { team: 'GIANTX', label: 'bench' })
    assert.deepEqual(m.to, { team: null, label: null })
})

test('coaches are shown with their title, other staff are not shown', () => {
    const m = only([
        row('2026-11-11', 'Join', 'Kamikaze', 'Team Heretics', 'Strategic Coach'),
        row('2026-11-11', 'Join', 'ElOjoNinja', 'GIANTX', 'Co-Streamer'),
        row('2026-11-11', 'Leave', 'Lozark', 'GIANTX', 'Manager'),
    ])

    assert.equal(m.role, 'coach')
    assert.equal(m.roleLabel, 'Strategic Coach')
    assert.deepEqual(m.to, { team: 'Team Heretics', label: 'coach' })
})

test('the same row fetched twice counts once', () => {
    const r = row('2026-11-13', 'Leave', 'Carzzy', 'Team Vitality', 'Bot')

    assert.equal(toMoves([r, { ...r }]).length, 1)
})

test('wikiRole maps lanes and coaches and rejects the rest', () => {
    assert.deepEqual(wikiRole('Bot'), { role: 'bottom', label: 'Bot' })
    assert.deepEqual(wikiRole('Streamer;Top'), { role: 'top', label: 'Top' })
    assert.deepEqual(wikiRole('Head Coach'), { role: 'coach', label: 'Head Coach' })
    assert.equal(wikiRole('Owner'), null)
    assert.equal(wikiRole(''), null)
})

const person = (handle, role, extra = {}) => ({
    pageId: ++n,
    handle,
    page: handle,
    name: '',
    country: 'South Korea',
    role,
    team: 'T1',
    contract: null,
    sub: false,
    ...extra,
})

test('a roster is in lane order, with the head coach picked from the latest join', () => {
    const roster = teamRoster(
        'T1',
        [
            person('Keria', 'Support'),
            person('Faker', 'Mid', { contract: '2029-11-19' }),
            person('Smash', 'Bot', { sub: true }),
            person('Peyz', 'Bot'),
            person('Doran', 'Top'),
            person('Oner', 'Jungle'),
            person('kkOma', 'Coach'),
            person('Tom', 'Coach'),
            person('Mata', 'Coach'),
            person('Bang', 'Streamer'),
            person('Chovy', 'Mid', { team: 'Gen.G' }),
        ],
        [
            row('2024-11-20', 'Join', 'kkOma', 'T1', 'Head Coach'),
            row('2026-03-22', 'Join', 'kkOma', 'T1', 'Head Coach'),
            row('2025-11-20', 'Join', 'Tom', 'T1', 'Assistant Coach'),
            row('2023-01-01', 'Join', 'Tom', 'Hanwha Life Esports', 'Head Coach'),
        ],
    )

    assert.deepEqual(
        roster.players.map((p) => p.handle),
        ['Doran', 'Oner', 'Faker', 'Peyz', 'Smash', 'Keria'],
    )
    assert.equal(roster.players[2].contractEnd, '2029-11-19')
    assert.equal(roster.headCoach?.handle, 'kkOma')
    assert.deepEqual(
        roster.coaches.map((p) => [p.handle, p.title]),
        [
            ['Mata', null],
            ['Tom', 'Assistant Coach'],
        ],
    )
})

test('an inactive head coach makes way for the interim one (T1, 2026)', () => {
    const roster = teamRoster(
        'T1',
        // Page names are capitalised, the names in roster changes are not.
        [person('kkOma', 'Coach', { page: 'KkOma' }), person('Tom', 'Coach', { page: 'Tom (Im Jae-hyeon)' })],
        [
            row('2023-11-20', 'Join', 'kkOma', 'T1', 'Head Coach'),
            row('2026-03-22', 'Join', 'kkOma', 'T1', 'Head Coach', 'inactive'),
            row('2026-03-22', 'Leave', 'kkOma', 'T1', 'Head Coach'),
            row('2026-03-22', 'Join', 'Tom (Im Jae-hyeon)', 'T1', 'Interim Head Coach'),
        ],
    )

    assert.equal(roster.headCoach?.handle, 'Tom')
    assert.equal(roster.headCoach?.title, 'Interim Head Coach')
    assert.deepEqual(
        roster.coaches.map((p) => [p.handle, p.title, p.inactive]),
        [['kkOma', 'Head Coach', true]],
    )
})

test('a benched player is on the roster but sorts after the starter', () => {
    const roster = teamRoster(
        'T1',
        [person('Aaa', 'Bot'), person('Peyz', 'Bot')],
        [row('2026-09-23', 'Join', 'Aaa', 'T1', 'Bot', 'opportunities')],
    )

    assert.deepEqual(
        roster.players.map((p) => [p.handle, p.inactive]),
        [
            ['Peyz', false],
            ['Aaa', true],
        ],
    )
})

test('a team whose head coach left has an open head coach slot', () => {
    const roster = teamRoster('Team Vitality', [person('Naak Nako', 'Jungle', { team: 'Team Vitality' })], [])

    assert.equal(roster.headCoach, null)
    assert.equal(roster.players.length, 1)
})
