// src/hooks/useGameInput.js
import { useEffect, useState } from 'react'

const MOUSE_BUTTONS = ['Left', 'Middle', 'Right', 'Back', 'Forward']

const INITIAL = {
  keys: [],
  mouse: { x: 0, y: 0, buttons: [], inside: false },
  wheel: '—',
  lastEvent: '—',
}

const isTyping = (el) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))

/** Bàn phím: lắng nghe toàn window. Chuột: lắng nghe trong vùng targetRef. */
export function useGameInput(targetRef) {
  const [input, setInput] = useState(INITIAL)

  useEffect(() => {
    const el = targetRef.current
    if (!el) return

    const pos = (e) => {
      const r = el.getBoundingClientRect()
      return { x: Math.round(e.clientX - r.left), y: Math.round(e.clientY - r.top) }
    }

    const onKeyDown = (e) => {
      if (isTyping(e.target)) return
      setInput((s) => ({
        ...s,
        keys: s.keys.includes(e.code) ? s.keys : [...s.keys, e.code],
        lastEvent: `keydown: ${e.code} (key="${e.key}")`,
      }))
    }
    const onKeyUp = (e) =>
      setInput((s) =>
        s.keys.includes(e.code)
          ? { ...s, keys: s.keys.filter((k) => k !== e.code), lastEvent: `keyup: ${e.code}` }
          : s,
      )
    const onBlur = () =>
      setInput((s) => ({ ...s, keys: [], mouse: { ...s.mouse, buttons: [] } }))

    const onMouseMove = (e) =>
      setInput((s) => ({ ...s, mouse: { ...s.mouse, ...pos(e) } }))
    const onMouseEnter = () =>
      setInput((s) => ({ ...s, mouse: { ...s.mouse, inside: true } }))
    const onMouseLeave = () =>
      setInput((s) => ({ ...s, mouse: { ...s.mouse, inside: false } }))
    const onMouseDown = (e) => {
      const name = MOUSE_BUTTONS[e.button]
      setInput((s) => ({
        ...s,
        mouse: {
          ...s.mouse,
          ...pos(e),
          buttons: s.mouse.buttons.includes(name) ? s.mouse.buttons : [...s.mouse.buttons, name],
        },
        lastEvent: `mousedown: ${name} tại (${pos(e).x}, ${pos(e).y})`,
      }))
    }
    // mouseup nghe trên window để không bị kẹt nút khi thả chuột ngoài vùng
    const onMouseUp = (e) => {
      const name = MOUSE_BUTTONS[e.button]
      setInput((s) =>
        s.mouse.buttons.includes(name)
          ? {
              ...s,
              mouse: { ...s.mouse, buttons: s.mouse.buttons.filter((b) => b !== name) },
              lastEvent: `mouseup: ${name}`,
            }
          : s,
      )
    }
    const onWheel = (e) =>
      setInput((s) => ({
        ...s,
        wheel: `${e.deltaY > 0 ? 'xuống' : 'lên'} (${Math.round(e.deltaY)})`,
        lastEvent: `wheel: ${e.deltaY > 0 ? 'xuống' : 'lên'}`,
      }))

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    window.addEventListener('mouseup', onMouseUp)
    el.addEventListener('mousemove', onMouseMove)
    el.addEventListener('mouseenter', onMouseEnter)
    el.addEventListener('mouseleave', onMouseLeave)
    el.addEventListener('mousedown', onMouseDown)
    el.addEventListener('wheel', onWheel, { passive: true })

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('mouseup', onMouseUp)
      el.removeEventListener('mousemove', onMouseMove)
      el.removeEventListener('mouseenter', onMouseEnter)
      el.removeEventListener('mouseleave', onMouseLeave)
      el.removeEventListener('mousedown', onMouseDown)
      el.removeEventListener('wheel', onWheel)
    }
  }, [targetRef])

  return input
}