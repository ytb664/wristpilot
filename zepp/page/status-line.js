// The line at the top of every Wristpilot screen: the watch's own time and battery, so the
// driver doesn't lose them while Wristpilot covers the watch face. hour is already in the
// watch's hour format (Time.getFormatHour); twelveHour says which one that is.

export function statusLine({ hour, minute, twelveHour, battery }) {
  const h = twelveHour ? String(hour) : pad(hour)
  return `${h}:${pad(minute)} · ${battery}%`
}

function pad(n) {
  return String(n).padStart(2, '0')
}
