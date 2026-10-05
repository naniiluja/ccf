import type { Mood } from '../types'

export const PALETTE: Readonly<Record<string, number>> = {
  a: 0x7787af,
  b: 0xf9f9fc,
  c: 0x483b4e,
  d: 0xe78ed9,
  e: 0xa4d1fa,
  f: 0xb89698,
  g: 0x7c6477,
  h: 0xe9d5e1,
  i: 0xc968b9,
  j: 0x95add3,
  k: 0xbcfafd,
  l: 0x85b1e6,
  m: 0xd296cc,
  n: 0x6d698c,
  o: 0x6f88c7,
  p: 0xbec6fa,
  q: 0xe0bfba,
  r: 0xaeceec,
  s: 0xfbe7e0,
  t: 0xb29fb9,
}

export const BODY: readonly string[] = [
  '............aaa......................',
  '...........abbbj.....aaa.............',
  '...........abbbracccabbba............',
  '.....aaa.oajbbbbbgbbbbbbj............',
  '....abbbjobbjjjngggnjbbbrg...........',
  '....lbbbbnjreellllllljjbbgg.aoa......',
  '....ojbrrreeeeellllleeeejnggbbba.....',
  '....abreeeeeeeeeeeeeeeeeelbbbbbo.....',
  '...abjeeeeeeeeeeeeeeeeeeeejbbbba.....',
  '.ajngeereeeeeeeeeeeeeeeeeeelbja......',
  'abbnjekkkeeeeeeeeeeeeeeeeeeebll......',
  'obbjekkkkkeeeeeeeeeeeepeerrellpii....',
  'abaeekkkkkekkeeeeeeeeeiipmdelpiddi...',
  '.aoeeekkkkrkkeeeekeeeeiimddreidjbii..',
  '..leeeeeeeeeeeeeeeeeeedddiipeddiiddi.',
  '.aeeeeeeeeeeeeeeeeerbrmmpiieedpiibdi.',
  '.oeeeeeeeeeeeeeeeeersbppeppepidddiii.',
  '.leeeeeeeeeeeeeeeeeessreeeeeeeimjdi..',
  '.leeeeeeeeeeeeeeeeebjjbreeeelepiddi..',
  'aeeeeeeeeeeeeeeeeersssssreeeleeiiiii.',
  'oeeeeeeeeeeeeeeeeersssssreeelleii.ii.',
  'oeeeeeeeeeeeeeeeeebbaobsreeellpii.md.',
  'leeleeeeeeeeeeeeeesaooaseeeellrii..dm',
  'leeleeeeeeeeeeeeeesboooseeerjlejdm.dd',
  'aeeeleeeeeeleeeeersbllrseerbfleldd.dm',
  '.jeelleeeeellererrsbjlbserbsfleodd.m.',
  '.aeelllrrrrjbsssssssssssrqbfjel.dd...',
  '..leeoofsshssssssssssssssfoaleo.dm...',
  '..aeeoofsssssssssssssssstaolea..m....',
  '...oeooafsssssqffssssssfoolro........',
  '....aoooogtsssssssssqfgaa.oa.........',
  '.....oa.aaagggfffffggtt..............',
  '..........thhthhhhhtthbt.............',
  '..........tbbbgggggbbbbt.............',
  '......ff..tbbbggbggbbbf..............',
  '....fffsf.cthbbbbbbbhtsf.............',
  '....fssqsfcctthtthttgqsgc............',
  '.....fsssfcctbbbbbbhcgggc............',
  '......fffgcccthhhhtgcccccc...........',
  '.......ggggccccccccccbcccgc..........',
  '.......cggcbcccttccccbbccggqf........',
  '........ccbcgggggggggcbcgggssf.......',
  '..........tcgggbbggggcbcggsqf........',
  '.........cbtggbbbbggtbc..fff.........',
  '.........cbtbbbbbbbbtbgc.............',
  '........cgbbtbbbbbbtbbggc............',
  '.......tgggbbhhhhhhbbggggt...........',
  '.......tbgggbbbbbbbbggggbt...........',
  '........tbbgggggggggggbbt............',
  '.........ttbbbbbbbbbbbtt.............',
  '...........thhhttthhht...............',
  '............thht..thht...............',
  '............tbbt..tbbt...............',
  '............tbbt..tbbt...............',
  '.............thg...thg...............',
  '.............ggg...ggg...............',
]

type Stamp = { x: number; y: number; rows: readonly string[] }

const EYE = { x: 19, y: 21 }
const MOUTH = { x: 13, y: 26 }
const OPEN_EYE: Stamp = { ...EYE, y: 18, rows: ['ssss', 'ssss', 'ssss', 'nnnn', 'booo', 'booo', 'ooll', 'ooll'] }

const FACES: Readonly<Record<Mood, readonly Stamp[]>> = {
  idle: [OPEN_EYE],
  thinking: [
    { ...EYE, rows: ['ssss', 'ssss', 'ssss', 'oooo', 'oooo'] },
    { ...MOUTH, rows: ['ssssss', 'ssssss', 'ssssss', 'ssssff'] },
  ],
  happy: [
    { ...EYE, rows: ['ssss', 'snns', 'snns', 'nssn', 'nssn'] },
    { x: 21, y: 26, rows: ['qq', 'qq'] },
    { ...MOUTH, rows: ['ssssss', 'ssssss', 'sgssgs', 'sggggs'] },
  ],
  worried: [
    OPEN_EYE,
    { x: 22, y: 26, rows: ['l', 'l'] },
    { ...MOUTH, rows: ['ssssss', 'ssssss', 'ssggss', 'ssggss'] },
  ],
  sleepy: [
    { ...EYE, rows: ['ssss', 'ssss', 'ssss', 'ssss', 'nnnn'] },
    { ...MOUTH, rows: ['ssssss', 'ssssss', 'ssssss', 'ssffss'] },
  ],
  surprised: [
    { ...EYE, rows: ['ssss', 'snns', 'snns', 'ssss', 'ssss'] },
    { ...MOUTH, rows: ['ssssss', 'ssggss', 'ssggss', 'ssggss'] },
  ],
}

const CELL_WIDTH = 2
const CELL_HEIGHT = 4
const PADDING_TO_ALIGN_FACE_WITH_CELLS = { left: 1, top: 2 }
const PIXEL_COLUMNS = BODY[0]?.length ?? 0

export const SPRITE_COLUMNS = Math.ceil((PIXEL_COLUMNS + PADDING_TO_ALIGN_FACE_WITH_CELLS.left) / CELL_WIDTH)
export const SPRITE_ROWS = Math.ceil((BODY.length + PADDING_TO_ALIGN_FACE_WITH_CELLS.top) / CELL_HEIGHT)

const TRANSPARENT = '.'

export type Stride = 'stand' | 'left' | 'right'
export type Pose = { stride: Stride; isFlipped: boolean }

export const STANDING: Pose = { stride: 'stand', isFlipped: false }

const LEG_TOP = BODY.findIndex(row => row.includes('thht..thht'))
const LEG_BLOCKS = { left: { from: 11, to: 17, dx: -1 }, right: { from: 18, to: 24, dx: 1 } } as const

const SKIN = 'fsq'
const HANDS = {
  left: { top: 34, bottom: 38, from: 4, to: 9 },
  right: { top: 40, bottom: 43, from: 26, to: 30 },
} as const

function swingHand(rows: string[][], hand: 'left' | 'right', dy: number) {
  const { top, bottom, from, to } = HANDS[hand]
  const moved: { y: number; x: number; pixel: string }[] = []
  for (let y = top; y <= bottom; y++) {
    for (let x = from; x < to; x++) {
      const pixel = rows[y]?.[x]
      if (pixel === undefined || !SKIN.includes(pixel)) continue
      moved.push({ y: y + dy, x, pixel })
      rows[y][x] = TRANSPARENT
    }
  }
  for (const { y, x, pixel } of moved) if (rows[y] !== undefined) rows[y][x] = pixel
}

function swingArms(rows: string[][], stride: 'left' | 'right') {
  swingHand(rows, 'left', stride === 'left' ? 2 : -2)
  swingHand(rows, 'right', stride === 'left' ? -2 : 2)
}

function liftLeg(rows: string[][], stride: 'left' | 'right') {
  const { from, to, dx } = LEG_BLOCKS[stride]
  const block = rows.slice(LEG_TOP).map(row => row.slice(from, to))
  for (const row of rows.slice(LEG_TOP)) row.fill(TRANSPARENT, from, to)
  block.forEach((line, dy) => {
    const target = rows[LEG_TOP + dy - 1]
    if (target === undefined || LEG_TOP + dy - 1 < LEG_TOP) return
    line.forEach((pixel, i) => {
      if (pixel !== TRANSPARENT) target[from + i + dx] = pixel
    })
  })
}

export function pixelsOf(mood: Mood, pose: Pose = STANDING): readonly string[] {
  const rows = BODY.map(row => [...row])
  for (const { x, y, rows: stamp } of FACES[mood]) {
    stamp.forEach((line, dy) => {
      const row = rows[y + dy]
      if (row === undefined || x + line.length > row.length) {
        throw new Error(`rem-mascot: mặt '${mood}' tại (${x},${y + dy}) nằm ngoài hình`)
      }
      row.splice(x, line.length, ...line)
    })
  }
  if (pose.stride !== 'stand') {
    liftLeg(rows, pose.stride)
    swingArms(rows, pose.stride)
  }
  return rows.map(row => (pose.isFlipped ? row.reverse() : row).join(''))
}

export const BLOCK_GLYPHS: readonly (readonly [glyph: string, shape: string])[] = [
  [' ', '.. .. .. ..'],
  ['▘', '#. #. .. ..'],
  ['▝', '.# .# .. ..'],
  ['▀', '## ## .. ..'],
  ['▖', '.. .. #. #.'],
  ['▌', '#. #. #. #.'],
  ['▞', '.# .# #. #.'],
  ['▛', '## ## #. #.'],
  ['▗', '.. .. .# .#'],
  ['▚', '#. #. .# .#'],
  ['▐', '.# .# .# .#'],
  ['▜', '## ## .# .#'],
  ['▂', '.. .. .. ##'],
  ['▄', '.. .. ## ##'],
  ['▙', '#. #. ## ##'],
  ['▟', '.# .# ## ##'],
  ['▆', '.. ## ## ##'],
  ['█', '## ## ## ##'],
]

type Glyph = { codePoint: number; covers: readonly boolean[] }
type Fit = { glyph: Glyph; foreground: string; background: string; cost: number }

const GLYPHS: readonly Glyph[] = BLOCK_GLYPHS.map(([glyph, shape]) => ({
  codePoint: glyph.codePointAt(0) ?? 0x20,
  covers: [...shape.replaceAll(' ', '')].map(dot => dot === '#'),
}))

const DEFAULT_COLOR = 0x01000000
const MISMATCHED_SHAPE_COST = 300 ** 2

function colorOf(pixel: string): number {
  if (pixel === TRANSPARENT) return DEFAULT_COLOR
  const color = PALETTE[pixel]
  if (color === undefined) throw new Error(`rem-mascot: không có màu cho pixel '${pixel}'`)
  return color
}

function distance(a: string, b: string): number {
  if (a === b) return 0
  if (a === TRANSPARENT || b === TRANSPARENT) return MISMATCHED_SHAPE_COST
  const [p, q] = [colorOf(a), colorOf(b)]
  return [16, 8, 0].reduce((sum, shift) => sum + (((p >> shift) & 255) - ((q >> shift) & 255)) ** 2, 0)
}

function fitCell(block: readonly string[]): Fit {
  const kinds = [...new Set(block)]
  const costs = new Map(kinds.map(kind => [kind, block.map(pixel => distance(pixel, kind))]))
  let best: Fit = { glyph: GLYPHS[0] ?? { codePoint: 0x20, covers: [] }, foreground: TRANSPARENT, background: TRANSPARENT, cost: Infinity }

  for (const background of kinds) {
    const behind = costs.get(background) ?? []
    for (const foreground of kinds) {
      if (foreground === TRANSPARENT) continue
      const ahead = costs.get(foreground) ?? []
      for (const glyph of GLYPHS) {
        const cost = glyph.covers.reduce((sum, covered, i) => sum + ((covered ? ahead[i] : behind[i]) ?? 0), 0)
        if (cost < best.cost) best = { glyph, foreground, background, cost }
      }
    }
  }
  return best
}

export function encode(pixels: readonly string[]): string {
  if (pixels.length !== BODY.length || pixels.some(row => row.length !== PIXEL_COLUMNS)) {
    throw new Error(`rem-mascot: hình phải đúng ${PIXEL_COLUMNS}x${BODY.length} pixel`)
  }

  const { left, top } = PADDING_TO_ALIGN_FACE_WITH_CELLS
  const at = (x: number, y: number) => pixels[y - top]?.[x - left] ?? TRANSPARENT
  const view = new DataView(new ArrayBuffer(SPRITE_COLUMNS * SPRITE_ROWS * 12))
  let offset = 0

  for (let row = 0; row < SPRITE_ROWS; row++) {
    for (let column = 0; column < SPRITE_COLUMNS; column++) {
      const block = Array.from({ length: CELL_WIDTH * CELL_HEIGHT }, (_, i) =>
        at(column * CELL_WIDTH + (i % CELL_WIDTH), row * CELL_HEIGHT + Math.floor(i / CELL_WIDTH)),
      )
      const { glyph, foreground, background } = fitCell(block)
      for (const word of [glyph.codePoint, colorOf(foreground), colorOf(background)]) {
        view.setUint32(offset, word, true)
        offset += 4
      }
    }
  }

  const bytes = new Uint8Array(view.buffer)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}
