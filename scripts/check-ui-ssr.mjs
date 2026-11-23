import assert from 'node:assert/strict'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Static rendering only. This does not open a browser, visit a URL, or run effects.
const storage = () => {
  const values = new Map()
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }
}
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage() })
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage() })
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } })
globalThis.window = { location: { hash: '#home', pathname: '/' } }
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
let rendered = 0
try {
  const { default: App, AdminScreen } = await server.ssrLoadModule('/src/app/ChessArenaApp.jsx')
  const { default: AuthDialog } = await server.ssrLoadModule('/src/features/auth/AuthDialog.jsx')
  const routes = ['home', 'play', 'queue', 'queue-ready', 'game', 'leaderboard', 'friends', 'history', 'profile', 'settings', 'help', 'invite', 'replay', 'admin-overview', 'admin-users', 'privacy', 'terms', 'missing-page']
  for (const route of routes) {
    window.location.hash = '#' + route
    const html = renderToStaticMarkup(React.createElement(App))
    assert.ok(html.includes('main-content'), route + ' must retain the main landmark')
    assert.ok(html.includes('<h1'), route + ' must have a heading')
    assert.ok(!html.includes('undefined'), route + ' must not contain undefined output')
    if (route === 'home') assert.equal((html.match(/miniPiece/g) || []).length, 32)
    if (route === 'home') {
      assert.ok(!html.includes('<span>Bạn bè</span>'), 'guests must not see the Friends navigation item')
      assert.ok(!html.includes('Mời bạn chơi'), 'guests must not see the invite-a-friend card')
      assert.ok(!/adminSwitch/.test(html), 'the admin entry must stay hidden until the server confirms admin access')
    }
    if (route === 'friends') assert.ok(html.includes('Đăng nhập để xem bạn bè'), 'friends page must ask guests to sign in')
    if (route === 'replay') assert.equal((html.match(/role="gridcell"/g) || []).length, 64)
    rendered++
  }
  const noop = () => {}
  for (const page of ['overview', 'users', 'roles', 'notifications', 'blacklist', 'journals', 'commands', 'system']) {
    const html = renderToStaticMarkup(React.createElement(AdminScreen, { page, navigate: noop, onSignIn: noop }))
    assert.ok(html.includes('<h1'), page + ' needs an accessible heading')
    assert.ok(!html.includes('undefined'), page + ' must not expose undefined values')
    assert.ok(html.includes('Đăng nhập'), page + ' must require authentication when signed out')
    rendered++
  }
  for (const initialMode of ['login', 'register', 'otp', 'activate', 'forgot', 'reset']) {
    const html = renderToStaticMarkup(React.createElement(AuthDialog, { initialMode, onClose: noop }))
    assert.ok(html.includes('auth-title'))
    assert.ok(html.includes('<form'))
    rendered++
  }
  console.log('PASS: ' + rendered + ' static screen renders. Browser layout and interactions are not verified by this check.')
} finally { await server.close() }
