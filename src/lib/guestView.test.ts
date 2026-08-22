import assert from 'node:assert/strict'
import { test } from 'node:test'
import { callGuest, guestCurrentUrl, navigateGuest } from './guestView.ts'

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
