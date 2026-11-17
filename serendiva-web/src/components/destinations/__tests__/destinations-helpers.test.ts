import { describe, expect, it } from 'vitest'
import { paragraphs, plainText, splitDescription, splitExperienceMeta } from '../content'
import { compassPoint, distanceKm, nearestNeighbours } from '../geo'
import { destinationGridLayout } from '../gridLayout'
import { hubPosition, isInsideIsland, labelWidth, layoutLabels, projectLatLng, shortHubLabel } from '../islandMap'
import { regionTone } from '../regionTones'

/** Hubs Stitch placed by hand: [lat, lng, x, y]. */
const STITCH_HUBS: Record<string, [number, number, number, number]> = {
  Trincomalee: [8.5874, 81.2152, 295, 210],
  Sigiriya: [7.957, 80.7603, 225, 255],
  Kandy: [7.2906, 80.6337, 215, 340],
  Colombo: [6.9271, 79.8612, 140, 390],
  'Nuwara Eliya': [6.9497, 80.7891, 220, 385],
  Ella: [6.8667, 81.0466, 240, 420],
  Yala: [6.3725, 81.5169, 275, 485],
  Galle: [6.0267, 80.217, 160, 545],
}

describe('island map projection', () => {
  it('lands close to the hubs Stitch placed by hand', () => {
    for (const [name, [lat, lng, x, y]] of Object.entries(STITCH_HUBS)) {
      const p = projectLatLng(lat, lng)
      expect(Math.hypot(p.x - x, p.y - y), name).toBeLessThan(40)
    }
  })

  it('keeps every hub inside the island, even on the coast', () => {
    const coastal: [number, number][] = [
      [9.83, 80.21], // Point Pedro
      [5.92, 80.59], // Dondra Head
      [8.23, 79.76], // Kalpitiya
      [7.02, 81.88], // Sangaman Kanda
      [6.421, 79.998], // Bentota
    ]
    for (const [lat, lng] of coastal) expect(isInsideIsland(hubPosition(lat, lng))).toBe(true)
  })

  it('keeps north above south and west left of east', () => {
    const jaffna = hubPosition(9.66, 80.02)
    const galle = hubPosition(6.03, 80.22)
    const colombo = hubPosition(6.93, 79.86)
    const batticaloa = hubPosition(7.73, 81.69)
    expect(jaffna.y).toBeLessThan(galle.y)
    expect(colombo.x).toBeLessThan(batticaloa.x)
  })

  it('shortens compound names for map labels', () => {
    expect(shortHubLabel('Sigiriya & Dambulla')).toBe('Sigiriya')
    expect(shortHubLabel('Yala and Bundala')).toBe('Yala')
    expect(shortHubLabel('Ella')).toBe('Ella')
  })

  it('places labels without overlapping each other', () => {
    const hubs = [
      { ...hubPosition(6.8667, 81.0466), label: 'Ella' },
      { ...hubPosition(6.9497, 80.7891), label: 'Nuwara Eliya' },
      { ...hubPosition(7.2906, 80.6337), label: 'Kandy' },
      { ...hubPosition(7.957, 80.7603), label: 'Sigiriya' },
      { ...hubPosition(7.9403, 81.0188), label: 'Anuradhapura' },
    ]
    const placements = layoutLabels(hubs)
    const boxes = placements.map((p, i) => {
      const w = labelWidth(hubs[i].label)
      const x1 = p.anchor === 'start' ? p.x : p.anchor === 'end' ? p.x - w : p.x - w / 2
      return { x1, x2: x1 + w, y1: p.y - 8, y2: p.y + 3 }
    })
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]
        const b = boxes[j]
        const overlaps = a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2
        expect(overlaps, `${hubs[i].label} / ${hubs[j].label}`).toBe(false)
      }
  })
})

describe('destination grid rhythm', () => {
  it('follows the Stitch 7/5 · 5/7 · 6/6 · 6/6 rows', () => {
    const cells = destinationGridLayout(8)
    expect(cells.map((c) => c.className)).toEqual([
      'lg:col-span-7',
      'lg:col-span-5',
      'lg:col-span-5',
      'lg:col-span-7',
      'lg:col-span-6',
      'lg:col-span-6',
      'lg:col-span-6',
      'lg:col-span-6',
    ])
    expect(cells.map((c) => c.featured)).toEqual([true, false, false, false, false, false, false, false])
    expect(cells.map((c) => c.tallImage)).toEqual([true, true, false, false, false, false, false, false])
    expect(cells.map((c) => c.roomy)).toEqual([true, false, false, true, false, false, false, false])
  })

  it('lets a lone last card span the full row', () => {
    const cells = destinationGridLayout(3)
    expect(cells[2].className).toBe('md:col-span-2 lg:col-span-12')
    expect(destinationGridLayout(0)).toEqual([])
  })
})

describe('content helpers', () => {
  it('splits the description into a plain hero lead and the rest', () => {
    const { lead, rest } = splitDescription({
      description: 'Where the **ridge** drops [1,000 m](https://x.y).\n\nSecond paragraph.\n\nThird.',
      summary: 'Summary',
    })
    expect(lead).toBe('Where the ridge drops 1,000 m.')
    expect(rest).toEqual(['Second paragraph.', 'Third.'])
    expect(splitDescription({ description: '', summary: 'Summary' })).toEqual({ lead: 'Summary', rest: [] })
    expect(paragraphs('a\n\n\n b ')).toEqual(['a', 'b'])
    expect(plainText('# Title\n_it_')).toBe('Title it')
  })

  it('splits experience meta like Stitch', () => {
    expect(splitExperienceMeta('Moderate • 1.5 Hours • 05:40 AM Departure')).toEqual([
      'Moderate • 1.5 Hours',
      '05:40 AM Departure',
    ])
    expect(splitExperienceMeta('Easy • 2 Hours')).toEqual(['Easy • 2 Hours'])
    expect(splitExperienceMeta(null)).toEqual([])
  })
})

describe('geo helpers', () => {
  it('measures distances and directions', () => {
    // Ella → Nuwara Eliya ≈ 30 km to the north-west
    expect(distanceKm(6.8667, 81.0466, 6.9497, 80.7891)).toBeGreaterThan(25)
    expect(distanceKm(6.8667, 81.0466, 6.9497, 80.7891)).toBeLessThan(35)
    expect(compassPoint(0)).toBe('N')
    expect(compassPoint(135)).toBe('SE')
    expect(compassPoint(350)).toBe('N')
  })

  it('picks the nearest destinations in different directions', () => {
    const origin = { slug: 'ella', latitude: 6.8667, longitude: 81.0466 }
    const items = [
      origin,
      { slug: 'nuwara-eliya', latitude: 6.9497, longitude: 80.7891 },
      { slug: 'yala', latitude: 6.3725, longitude: 81.5169 },
      { slug: 'galle', latitude: 6.0267, longitude: 80.217 },
      { slug: 'kandy', latitude: 7.2906, longitude: 80.6337 },
      { slug: 'nowhere', latitude: null, longitude: null },
    ]
    const result = nearestNeighbours(origin, items, 3)
    expect(result).toHaveLength(3)
    expect(result.map((r) => r.item.slug)).not.toContain('ella')
    expect(result.map((r) => r.item.slug)).not.toContain('nowhere')
    expect(result[0].item.slug).toBe('nuwara-eliya')
    expect(nearestNeighbours({ slug: 'x', latitude: null, longitude: null }, items)).toEqual([])
  })
})

describe('region tones', () => {
  it('cycles through the six Stitch tones', () => {
    expect(regionTone(0).text).toBe('text-secondary')
    expect(regionTone(1).text).toBe('text-tertiary')
    expect(regionTone(6)).toEqual(regionTone(0))
    expect(regionTone(-1)).toEqual(regionTone(0))
  })
})
