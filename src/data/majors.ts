// What leads the homepage: the major that is on, or the last one and who won it.

import { eventStatus, featuredEvent } from './events'
import { getEventMatches } from './matches'
import { finalPlacements, getStages, type Finish } from './stages'
import type { Event, Match } from './types'

// The latest major that has ended, with who won it.
export interface LastMajor {
    event: Event
    matches: Match[]
    places: Finish[]
}

// What leads the homepage: `featured` (with its matches) while a major is on or about to start,
// otherwise `last`. A major whose final has been played counts as ended, whatever its end date.
export async function getMajors(
    events: Event[],
    now = new Date(),
): Promise<{ featured: Event | null; matches: Match[]; last: LastMajor | null }> {
    const featured = featuredEvent(events, now)
    const matches = featured ? await getEventMatches(featured) : []

    if (featured && eventStatus(featured, now, matches) !== 'finished') {
        return { featured, matches, last: null }
    }

    const event =
        featured ??
        events
            .filter((e) => e.league.tier === 1 && eventStatus(e, now) === 'finished')
            .sort((a, b) => b.endDate.localeCompare(a.endDate))[0]

    if (!event) return { featured: null, matches: [], last: null }
    const played = featured ? matches : await getEventMatches(event)
    const places = finalPlacements(await getStages(event, played))

    return { featured: null, matches: [], last: { event, matches: played, places } }
}
