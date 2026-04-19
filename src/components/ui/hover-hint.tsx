'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function HoverHint({
  content,
  children,
}: {
  content: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [coords, setCoords] = useState({ left: 0, top: 0 })
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setMounted(true)
    return () => {
      if (openTimerRef.current) clearTimeout(openTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!open) return

    const updatePosition = () => {
      const rect = wrapperRef.current?.getBoundingClientRect()
      if (!rect) return
      setCoords({
        left: rect.left + rect.width / 2,
        top: rect.top - 10,
      })
    }

    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open])

  const scheduleOpen = () => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current)
    openTimerRef.current = setTimeout(() => setOpen(true), 180)
  }

  const close = () => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current)
    setOpen(false)
  }

  return (
    <div
      ref={wrapperRef}
      style={{ position: 'relative' }}
      onMouseEnter={scheduleOpen}
      onMouseLeave={close}
      onFocus={scheduleOpen}
      onBlur={close}
    >
      {children}
      {mounted && open && createPortal(
        <div
          style={{
            position: 'fixed',
            left: coords.left,
            top: coords.top,
            transform: 'translate(-50%, -100%)',
            width: 'max-content',
            maxWidth: 300,
            padding: '10px 12px',
            borderRadius: 10,
            background: '#111827',
            color: '#fff',
            fontSize: 12.5,
            lineHeight: 1.6,
            boxShadow: '0 24px 60px rgba(15,23,42,0.16)',
            zIndex: 999999,
            pointerEvents: 'none',
            textAlign: 'left',
          }}
        >
          {content}
          <span
            style={{
              position: 'absolute',
              left: '50%',
              top: '100%',
              width: 10,
              height: 10,
              background: '#111827',
              transform: 'translate(-50%, -50%) rotate(45deg)',
            }}
          />
        </div>,
        document.body,
      )}
    </div>
  )
}
