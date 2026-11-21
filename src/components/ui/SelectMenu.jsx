import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import styles from './SelectMenu.module.css'

export default function SelectMenu({ label, value, options, onChange }) {
  const id = useId()
  const ref = useRef(null)
  const trigger = useRef(null)
  const buttons = useRef([])
  const typeahead = useRef({ text: '', at: 0 })
  const [open, setOpen] = useState(false)
  const items = options.map((option) => typeof option === 'string' ? { value: option, label: option } : option)
  const selected = Math.max(0, items.findIndex((item) => item.value === value))

  useEffect(() => {
    if (!open) return undefined
    const outside = (event) => { if (!ref.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])

  function show(index = selected) {
    typeahead.current = { text: '', at: 0 }
    setOpen(true)
    requestAnimationFrame(() => buttons.current[index]?.focus())
  }

  function close() {
    setOpen(false)
    trigger.current?.focus()
  }

  return (
    <div className={styles.select} ref={ref}>
      <button ref={trigger} type="button" className={styles.trigger} aria-label={`${label}: ${items[selected]?.label}`} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => open ? close() : show()} onKeyDown={(event) => {
        if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); show() }
      }}>{items[selected]?.label}<ChevronDown size={15} /></button>
      {open && <div id={id} role="listbox" aria-label={label} className={styles.options} onKeyDown={(event) => {
        const index = buttons.current.indexOf(document.activeElement)
        let next
        if (event.key === 'ArrowDown') next = (index + 1) % items.length
        else if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length
        else if (event.key === 'Home') next = 0
        else if (event.key === 'End') next = items.length - 1
        else if (event.key === 'Escape') { event.preventDefault(); close(); return }
        else if (event.key === 'Tab') { setOpen(false); trigger.current?.focus(); return }
        else if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const now = event.timeStamp
          const normalize = (text) => String(text).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replaceAll('đ', 'd')
          const previous = now - typeahead.current.at < 700 ? typeahead.current.text : ''
          const letter = normalize(event.key)
          const text = previous && [...previous].every((character) => character === letter) ? letter : previous + letter
          typeahead.current = { text, at: now }
          next = items.findIndex((_, offset) => normalize(items[(Math.max(0, index) + offset + 1) % items.length].label).startsWith(text))
          if (next >= 0) next = (Math.max(0, index) + next + 1) % items.length
          else return
        }
        else return
        event.preventDefault()
        buttons.current[next]?.focus()
      }}>{items.map((item, index) => <button ref={(node) => { buttons.current[index] = node }} key={item.value} type="button" role="option" aria-selected={item.value === value} tabIndex={-1} onClick={() => { onChange(item.value); close() }}>{item.label}{item.value === value && <Check size={15} />}</button>)}</div>}
    </div>
  )
}
