import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createForwarderLink, RECONNECT_MS, SILENT_AFTER_MS } from './forwarder-link.js'

// A fake phone: the forwarder's sockets, a clock and timers the test moves by hand.
function phone() {
  const sockets = []
  let time = 0
  let timers = []
  const fake = {
    sockets,
    snapshots: [],
    get socket() {
      return sockets[sockets.length - 1]
    },
    now: () => time,
    later: (fn, ms) => {
      const t = { fn, at: time + ms }
      timers.push(t)
      return t
    },
    cancel: (t) => (timers = timers.filter((x) => x !== t)),
    // Moves the clock, running due timers, then asks the link to check on the forwarder.
    wait(ms, link) {
      time += ms
      for (const t of timers.filter((x) => x.at <= time)) {
        timers = timers.filter((x) => x !== t)
        t.fn()
      }
      link.check(time)
    },
    openSocket: () => {
      if (fake.refuse) throw new Error('refused')
      const socket = {
        closed: false,
        close() {
          socket.closed = true
        },
        open() {
          socket.onopen && socket.onopen()
        },
        say(message) {
          socket.onmessage({ data: JSON.stringify(message) })
        },
        drop() {
          socket.onclose && socket.onclose()
        },
      }
      sockets.push(socket)
      return socket
    },
  }
  return fake
}

function linkOn(p) {
  const link = createForwarderLink({
    openSocket: p.openSocket,
    onSnapshot: (s) => p.snapshots.push(s),
    now: p.now,
    later: p.later,
    cancel: p.cancel,
  })
  link.start()
  return link
}

const snapshot = { v: 4, event: 'posted', title: '200 m' }

test('snapshots from the forwarder are passed on; heartbeats are not', () => {
  const p = phone()
  linkOn(p)
  p.socket.open()
  p.socket.say({ heartbeat: 1 })
  p.socket.say(snapshot)

  assert.deepEqual(p.snapshots, [snapshot])
})

test('the link is up once the forwarder answers, and down before', () => {
  const p = phone()
  const link = linkOn(p)
  assert.equal(link.isUp(), false)

  p.socket.open()
  assert.equal(link.isUp(), true)
})

test('after a drop the link reconnects by itself, and goes on reconnecting until the forwarder is back', () => {
  const p = phone()
  const link = linkOn(p)
  p.socket.open()
  p.socket.drop()
  assert.equal(link.isUp(), false)

  p.wait(RECONNECT_MS, link)
  assert.equal(p.sockets.length, 2)
  p.socket.drop() // the forwarder isn't back yet
  p.wait(RECONNECT_MS, link)
  assert.equal(p.sockets.length, 3)

  p.socket.open()
  p.socket.say(snapshot)
  assert.equal(link.isUp(), true)
  assert.deepEqual(p.snapshots, [snapshot])
})

test('a socket that cannot even be opened is retried', () => {
  const p = phone()
  p.refuse = true
  const link = linkOn(p)
  assert.equal(p.sockets.length, 0)

  p.refuse = false
  p.wait(RECONNECT_MS, link)
  assert.equal(p.sockets.length, 1)
})

test('a forwarder that falls silent (frozen by HyperOS) counts as down, and the link starts over', () => {
  const p = phone()
  const link = linkOn(p)
  p.socket.open()
  p.socket.say({ heartbeat: 1 })

  p.wait(SILENT_AFTER_MS - 1, link)
  assert.equal(link.isUp(), true)

  p.wait(1, link)
  assert.equal(link.isUp(), false)
  assert.equal(p.sockets[0].closed, true)
  p.wait(RECONNECT_MS, link)
  assert.equal(p.sockets.length, 2)
})

test('heartbeats keep a quiet link up', () => {
  const p = phone()
  const link = linkOn(p)
  p.socket.open()
  for (let i = 0; i < 10; i++) {
    p.wait(2000, link)
    p.socket.say({ heartbeat: i })
  }

  assert.equal(link.isUp(), true)
  assert.equal(p.sockets.length, 1)
})

test('a socket given up on stays given up on, even if it speaks later', () => {
  const p = phone()
  const link = linkOn(p)
  const old = p.socket
  old.open()
  p.wait(SILENT_AFTER_MS, link)
  p.wait(RECONNECT_MS, link)

  old.say(snapshot)
  old.drop()
  assert.deepEqual(p.snapshots, [])
  assert.equal(p.sockets.length, 2) // no extra reconnect from the old socket's close

  p.wait(RECONNECT_MS, link)
  assert.equal(p.sockets.length, 2)
})

test('a message that is not JSON is skipped but still proves the link', () => {
  const p = phone()
  const link = linkOn(p)
  p.socket.onmessage({ data: 'not json' })

  assert.equal(link.isUp(), true)
  assert.deepEqual(p.snapshots, [])
})

test('stopping closes the socket and never reconnects', () => {
  const p = phone()
  const link = linkOn(p)
  p.socket.open()
  link.stop()
  p.socket.drop()
  p.wait(RECONNECT_MS * 3, link)

  assert.equal(p.sockets[0].closed, true)
  assert.equal(p.sockets.length, 1)
})

test('a connection attempt that hangs (never opens, never closes) is given up on and retried', () => {
  const p = phone()
  const link = linkOn(p)

  p.wait(SILENT_AFTER_MS, link)
  assert.equal(p.sockets[0].closed, true)
  p.wait(RECONNECT_MS, link)
  assert.equal(p.sockets.length, 2)
})
