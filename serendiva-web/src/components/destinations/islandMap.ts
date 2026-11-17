/*
 * Geometry of the stylised Sri Lanka map on /destinations (pure — shared by the server section and tests).
 *
 * The island silhouette, hill-country contour and reef line are ported verbatim from the Stitch SVG
 * (viewBox 0 0 440 640). Hubs are generated from each destination's latitude/longitude with an affine
 * (linear + offset) projection fitted by least squares to the 11 hub positions Stitch hand-placed
 * (Jaffna, Wilpattu, Trincomalee, Sigiriya, Kandy, Colombo, Nuwara Eliya, Ella, Yala, Mirissa, Galle).
 * The silhouette is stylised (the north is tilted east), so a pure lat/lng scale would put hubs in the sea;
 * the small lat→x / lng→y shear terms follow that tilt. Points are finally clamped inside the island.
 */

export const MAP_VIEWBOX = { width: 440, height: 640 } as const

export const ISLAND_PATH =
  'M 235 45 C 265 65, 275 110, 260 160 C 290 190, 315 240, 320 310 C 325 380, 335 440, 305 510 C 280 570, 240 600, 195 595 C 150 590, 130 540, 125 480 C 120 420, 110 360, 120 290 C 130 220, 160 150, 190 90 C 205 60, 220 35, 235 45 Z'
export const HILL_CONTOUR_PATH =
  'M 195 330 C 220 320, 250 340, 255 380 C 260 410, 235 435, 205 440 C 180 445, 170 410, 175 370 C 180 340, 185 335, 195 330 Z'
export const REEF_PATH = 'M 320 310 Q 345 350 330 420'

/** x = a·lng + b·lat + c ; y = d·lng + e·lat + f (least-squares fit to the Stitch hubs, rms ≈ 22 units). */
const PROJECTION = {
  x: { lng: 85.7739, lat: 14.9074, c: -6809.0202 },
  y: { lng: -2.8494, lat: -128.2485, c: 1528.6686 },
} as const

export interface Point {
  x: number
  y: number
}

type Cubic = [Point, Point, Point, Point]

const P = (x: number, y: number): Point => ({ x, y })

/** The island outline as cubic segments (same numbers as ISLAND_PATH). */
const ISLAND_SEGMENTS: Cubic[] = [
  [P(235, 45), P(265, 65), P(275, 110), P(260, 160)],
  [P(260, 160), P(290, 190), P(315, 240), P(320, 310)],
  [P(320, 310), P(325, 380), P(335, 440), P(305, 510)],
  [P(305, 510), P(280, 570), P(240, 600), P(195, 595)],
  [P(195, 595), P(150, 590), P(130, 540), P(125, 480)],
  [P(125, 480), P(120, 420), P(110, 360), P(120, 290)],
  [P(120, 290), P(130, 220), P(160, 150), P(190, 90)],
  [P(190, 90), P(205, 60), P(220, 35), P(235, 45)],
]

function bezier([p0, p1, p2, p3]: Cubic, t: number): Point {
  const u = 1 - t
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  }
}

/** Island outline sampled as a polygon (for point-in-island tests). */
export const ISLAND_POLYGON: Point[] = ISLAND_SEGMENTS.flatMap((seg) =>
  Array.from({ length: 24 }, (_, i) => bezier(seg, i / 24)),
)

/** Visual centre used to pull stray points back inside the island. */
const ISLAND_CENTRE = P(222, 330)

/** Ray-casting point-in-polygon. */
export function isInsideIsland(point: Point, polygon: Point[] = ISLAND_POLYGON): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]
    const b = polygon[j]
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside
    }
  }
  return inside
}

const distanceToOutline = (point: Point) =>
  Math.min(...ISLAND_POLYGON.map((p) => Math.hypot(p.x - point.x, p.y - point.y)))

/** Raw affine projection of WGS84 coordinates into the SVG viewBox. */
export function projectLatLng(lat: number, lng: number): Point {
  return {
    x: PROJECTION.x.lng * lng + PROJECTION.x.lat * lat + PROJECTION.x.c,
    y: PROJECTION.y.lng * lng + PROJECTION.y.lat * lat + PROJECTION.y.c,
  }
}

/**
 * Projected hub position, guaranteed to sit inside the island with a small margin (`inset` units from the
 * coast) — coastal places such as Point Pedro or Kalpitiya would otherwise land on the outline.
 */
export function hubPosition(lat: number, lng: number, inset = 8): Point {
  let point = projectLatLng(lat, lng)
  for (let step = 0; step < 40; step++) {
    if (isInsideIsland(point) && distanceToOutline(point) >= inset) break
    point = { x: point.x + (ISLAND_CENTRE.x - point.x) * 0.08, y: point.y + (ISLAND_CENTRE.y - point.y) * 0.08 }
  }
  return { x: Math.round(point.x * 10) / 10, y: Math.round(point.y * 10) / 10 }
}

/** Short map label: the first place of a compound name ("Sigiriya & Dambulla" → "Sigiriya"). */
export function shortHubLabel(name: string): string {
  const first = name.split(/\s+(?:&|and|und|和|·|\/)\s+|,\s*/)[0]?.trim()
  return first || name
}

// ------------------------------------------------------------------------------------------------ labels

export type LabelAnchor = 'start' | 'end' | 'middle'

export interface LabelPlacement {
  x: number
  y: number
  anchor: LabelAnchor
}

interface Box {
  x1: number
  y1: number
  x2: number
  y2: number
}

const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1)) * Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1))

/** Approximate rendered width of an 11-unit Inter semibold label (≈ 6.3 units per character). */
export const labelWidth = (text: string, fontSize = 11) => Math.ceil(text.length * fontSize * 0.57)

export interface LabelInput {
  x: number
  y: number
  label: string
  /** Hub radius (labels keep clear of the dot). */
  radius?: number
}

/**
 * Greedy label placement: each hub tries right / left (west-coast hubs prefer left, like Stitch), then above /
 * below, and takes the first spot that collides with no hub dot or already-placed label and stays inside the
 * viewBox. Hubs are processed in the given order (most important first).
 */
export function layoutLabels(hubs: LabelInput[], fontSize = 11): LabelPlacement[] {
  const ascent = fontSize * 0.75
  const descent = fontSize * 0.25
  const dots: Box[] = hubs.map((h) => {
    const r = (h.radius ?? 6) + 2
    return { x1: h.x - r, y1: h.y - r, x2: h.x + r, y2: h.y + r }
  })
  const placed: Box[] = []

  return hubs.map((hub, index) => {
    const w = labelWidth(hub.label, fontSize)
    const gap = (hub.radius ?? 6) + 6
    const baseline = hub.y + fontSize * 0.36
    const right = {
      x: hub.x + gap,
      y: baseline,
      anchor: 'start' as const,
      box: { x1: hub.x + gap, x2: hub.x + gap + w },
    }
    const left = { x: hub.x - gap, y: baseline, anchor: 'end' as const, box: { x1: hub.x - gap - w, x2: hub.x - gap } }
    const above = { x: hub.x, y: hub.y - gap, anchor: 'middle' as const, box: { x1: hub.x - w / 2, x2: hub.x + w / 2 } }
    const below = {
      x: hub.x,
      y: hub.y + gap + ascent,
      anchor: 'middle' as const,
      box: { x1: hub.x - w / 2, x2: hub.x + w / 2 },
    }
    const order = hub.x < 185 ? [left, right, above, below] : [right, left, above, below]

    let best: { placement: LabelPlacement; box: Box; cost: number } | null = null
    for (const candidate of order) {
      const box: Box = {
        x1: candidate.box.x1,
        x2: candidate.box.x2,
        y1: candidate.y - ascent,
        y2: candidate.y + descent,
      }
      const outOfBounds = box.x1 < 2 || box.x2 > MAP_VIEWBOX.width - 2 || box.y1 < 2 || box.y2 > MAP_VIEWBOX.height - 2
      const cost =
        (outOfBounds ? 10_000 : 0) +
        dots.reduce((sum, dot, i) => (i === index ? sum : sum + overlap(box, dot) * 4), 0) +
        placed.reduce((sum, other) => sum + overlap(box, other), 0)
      if (!best || cost < best.cost) {
        best = { placement: { x: candidate.x, y: candidate.y, anchor: candidate.anchor }, box, cost }
      }
      if (cost === 0) break
    }
    // `order` is never empty, so `best` is always set here.
    const chosen = best as { placement: LabelPlacement; box: Box; cost: number }
    placed.push(chosen.box)
    return chosen.placement
  })
}
