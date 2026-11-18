import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cached } from '../src/api.ts'

// Counts how often a key is loaded: 1 means the second call was a cache hit.
const loads = new Map()

const load = (key, value = key) =>
    cached(key, 60, () => {
        loads.set(key, (loads.get(key) ?? 0) + 1)

        return Promise.resolve(value)
    })

test('an entry that is still in use survives a flood of new keys', async () => {
    await load('leagues')

    for (let i = 0; i < 600; i++) {
        await load(`junk-${i}`)

        if (i % 100 === 0) await load('leagues')
    }

    await load('leagues')
    assert.equal(loads.get('leagues'), 1)
})

test('an entry that is not used is evicted first', async () => {
    await load('idle')

    for (let i = 0; i < 300; i++) await load(`more-junk-${i}`)

    await load('idle')
    assert.equal(loads.get('idle'), 2)
})

test('a value that keep() rejects is returned but not cached', async () => {
    let n = 0

    const unknownTeam = () =>
        cached(
            'team-999',
            60,
            () => Promise.resolve({ teams: [], n: ++n }),
            (d) => d.teams.length > 0,
        )

    assert.equal((await unknownTeam()).n, 1)
    assert.equal((await unknownTeam()).n, 2)
})
