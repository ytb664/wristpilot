#!/usr/bin/env node
// Dev tool: prints a drive recording (one Raw Guidance Snapshot per line, from the Android
// forwarder's "Record drive") as a readable timeline, with the Maneuver arrow as ASCII.
//
//   npm run timeline -- path/to/drive-20261011-081500.jsonl
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const INK = ' .:-=+*#%@'

// Snapshots that reached the forwarder this much later than Google Maps posted them are flagged.
const LATE_MS = 2000

export function formatTimeline(lines) {
  const out = []
  let start = null
  let lastIcon
  lines.forEach((line, i) => {
    if (!line.trim()) return
    let s
    try {
      s = JSON.parse(line)
    } catch (e) {
      out.push(`line ${i + 1}: unreadable`)
      return
    }
    // v3+: time by when Google Maps posted it; v1/v2 only know when the forwarder got it.
    const t = s.postedAt ?? s.at
    if (start === null) start = t
    const lag = s.at - t
    out.push(
      `${elapsed(t - start)}  ${s.event}  v${s.v} ${s.ongoing ? 'ongoing' : 'not-ongoing'}` +
        ` category=${s.category} key=${s.key}` +
        (lag > LATE_MS ? `  delivered ${(lag / 1000).toFixed(1)} s late` : ''),
    )
    field(out, 'title', s.title)
    field(out, 'text', s.text)
    if (s.bigText !== s.text) field(out, 'bigText', s.bigText)
    field(out, 'subText', s.subText)
    ;(s.textLines || []).forEach((l) => field(out, 'line', l))
    if (!('icon' in s)) return
    const icon = JSON.stringify(s.icon)
    if (!s.icon) out.push('  icon:     (none)')
    else if (icon === lastIcon) out.push('  icon:     (same)')
    else out.push('  icon:', ...ascii(s.icon).map((row) => `    ${row}`))
    lastIcon = icon
  })
  return out.join('\n')
}

function field(out, name, value) {
  if (value) out.push(`  ${`${name}:`.padEnd(9)} ${value}`)
}

function elapsed(ms) {
  const tenths = Math.round(ms / 100)
  const min = Math.floor(tenths / 600)
  const sec = ((tenths % 600) / 10).toFixed(1).padStart(4, '0')
  return `+${min}:${sec}`
}

// "ga44": one byte per pixel, high nibble gray, low nibble alpha. Terminal characters are about
// twice as tall as wide, so each text row averages two pixel rows. Ink is the alpha if the icon
// has any transparency (an arrow on a clear background), otherwise the brightness.
function ascii({ w, h, format, data }) {
  if (format !== 'ga44') return [`(unknown icon format ${format})`]
  const bytes = Buffer.from(data, 'base64')
  const hasAlpha = bytes.some((b) => (b & 0x0f) < 0x0f)
  const ink = (x, y) => (hasAlpha ? bytes[y * w + x] & 0x0f : bytes[y * w + x] >> 4)
  const rows = []
  for (let y = 0; y < h; y += 2) {
    let row = ''
    for (let x = 0; x < w; x++) {
      const v = y + 1 < h ? (ink(x, y) + ink(x, y + 1)) / 2 : ink(x, y)
      row += INK[Math.round((v / 15) * (INK.length - 1))]
    }
    rows.push(row)
  }
  return rows
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2]
  if (!file) {
    console.error('usage: npm run timeline -- <recording.jsonl>')
    process.exit(1)
  }
  console.log(formatTimeline(readFileSync(file, 'utf8').split('\n')))
}
