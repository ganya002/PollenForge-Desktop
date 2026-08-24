import assert from 'node:assert/strict'
import { test } from 'node:test'
import { callGuest, guestCurrentUrl, isBenignGuestViewError, navigateGuest } from './guestView.ts'

test('guestCurrentUrl never throws when getURL is not ready', () => {
  assert.equal(guestCurrentUrl(null), '')
  assert.equal(
    guestCurrentUrl({
      src: 'about:blank',
      getURL() {
        throw new Error('The WebView must be attached to the DOM and the dom-ready event emitted before this method can be called.')
      },
    }),
    'about:blank',
  )
})

test('navigateGuest falls back to src when loadURL throws', () => {
  const guest = {
    src: 'about:blank',
    loadURL() {
      throw new Error('The WebView must be attached to the DOM')
    },
  }
  assert.equal(navigateGuest(guest, 'file:///C:/pong/index.html'), true)
  assert.equal(guest.src, 'file:///C:/pong/index.html')
})

test('callGuest swallows guest method errors', () => {
  assert.doesNotThrow(() =>
    callGuest(
      {
        goBack() {
          throw new Error('not ready')
        },
      },
      'goBack',
    ),
  )
})

test('isBenignGuestViewError hides webview abort noise', () => {
  assert.equal(
    isBenignGuestViewError("Error invoking remote method 'GUEST_VIEW_MANAGER_CALL': Error: ERR_ABORTED (-3) loading 'https://www.google.com/'"),
    true,
  )
  assert.equal(isBenignGuestViewError('TypeError: Cannot read properties of undefined'), false)
})

test('navigateGuest ignores a second load of the same URL', () => {
  let loads = 0
  const guest = {
    src: 'https://www.google.com/',
    getURL: () => 'https://www.google.com',
    loadURL() {
      loads += 1
    },
  }
  assert.equal(navigateGuest(guest, 'https://www.google.com/'), true)
  assert.equal(loads, 0)
  assert.equal(navigateGuest(guest, 'https://www.google.com/', true), true)
  assert.equal(loads, 1)
})

test('navigateGuest swallows rejected loadURL promises', async () => {
  const guest = {
    src: 'about:blank',
    loadURL() {
      return Promise.reject(new Error("ERR_ABORTED (-3) loading 'https://www.google.com/'"))
    },
  }
  assert.equal(navigateGuest(guest, 'https://www.google.com/'), true)
  await new Promise((r) => setTimeout(r, 10))
})
