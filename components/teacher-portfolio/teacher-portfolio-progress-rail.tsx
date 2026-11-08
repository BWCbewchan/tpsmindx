'use client'

import { useCallback, useEffect, useRef, type CSSProperties } from 'react'

type ProgressSection = {
  id: string
  label: string
}

const RAIL_PATH = 'M32 8 C16 78 48 118 32 188 C18 248 46 288 30 358 C16 428 48 468 32 538 C24 578 30 606 32 632'

export function TeacherPortfolioProgressRail({
  sections,
  themeColor = '#bd0026',
}: {
  sections: ProgressSection[]
  themeColor?: string
}) {
  const rootRef = useRef<HTMLElement>(null)
  const trackRef = useRef<SVGPathElement>(null)
  const inkRef = useRef<SVGPathElement>(null)
  const dotRefs = useRef<Map<string, SVGCircleElement>>(new Map())

  const getScroller = useCallback((): HTMLElement | Window => {
    const container = document.getElementById('main-scroll-container')
    if (container && container.scrollHeight > container.clientHeight + 10) return container
    return window
  }, [])

  const getMetrics = useCallback((scroller: HTMLElement | Window) => {
    if (scroller instanceof Window) {
      return {
        scrollTop: window.scrollY || window.pageYOffset || 0,
        totalHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
      }
    }
    return {
      scrollTop: scroller.scrollTop,
      totalHeight: scroller.scrollHeight,
      viewportHeight: scroller.clientHeight,
    }
  }, [])

  const getSectionOffset = useCallback((sectionId: string, scroller: HTMLElement | Window) => {
    const section = document.getElementById(sectionId)
    if (!section) return 0
    if (scroller instanceof Window) {
      return section.getBoundingClientRect().top + (window.scrollY || window.pageYOffset || 0)
    }
    const containerRect = scroller.getBoundingClientRect()
    return section.getBoundingClientRect().top - containerRect.top + scroller.scrollTop
  }, [])

  const update = useCallback(() => {
    const path = trackRef.current
    if (!path || sections.length === 0) return

    const scroller = getScroller()
    const { scrollTop, totalHeight, viewportHeight } = getMetrics(scroller)
    const maxScroll = Math.max(1, totalHeight - viewportHeight)
    const progress = Math.min(1, Math.max(0, scrollTop / maxScroll))
    const pathLength = path.getTotalLength()
    const traveled = pathLength * progress

    if (inkRef.current) {
      inkRef.current.style.strokeDasharray = `${pathLength} ${pathLength}`
      inkRef.current.style.strokeDashoffset = String(pathLength - traveled)
    }

    const focusPoint = scrollTop + viewportHeight * 0.35
    let activeId = sections[0]?.id ?? ''
    for (let index = sections.length - 1; index >= 0; index -= 1) {
      if (focusPoint >= getSectionOffset(sections[index].id, scroller)) {
        activeId = sections[index].id
        break
      }
    }

    for (const section of sections) {
      const dot = dotRefs.current.get(section.id)
      if (!dot) continue
      const sectionProgress = Math.min(0.985, Math.max(0.015, getSectionOffset(section.id, scroller) / maxScroll))
      const sectionPoint = path.getPointAtLength(pathLength * sectionProgress)
      dot.setAttribute('cx', String(sectionPoint.x))
      dot.setAttribute('cy', String(sectionPoint.y))
      dot.dataset.state = section.id === activeId ? 'active' : sectionProgress <= progress ? 'done' : 'upcoming'
      dot.setAttribute('aria-current', section.id === activeId ? 'location' : 'false')
    }

    rootRef.current?.setAttribute('data-ready', 'true')
  }, [getMetrics, getScroller, getSectionOffset, sections])

  useEffect(() => {
    if (sections.length === 0) return
    const scroller = getScroller()
    let frame = 0
    const scheduleUpdate = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        update()
      })
    }
    const firstFrame = requestAnimationFrame(update)
    const settleTimer = window.setTimeout(update, 700)
    const imageTimer = window.setTimeout(update, 1800)

    scroller.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)

    return () => {
      cancelAnimationFrame(firstFrame)
      if (frame) cancelAnimationFrame(frame)
      window.clearTimeout(settleTimer)
      window.clearTimeout(imageTimer)
      scroller.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [getScroller, sections, update])

  if (sections.length === 0) return null

  const goToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <aside
      ref={rootRef}
      className="botrail print:hidden"
      aria-label="Tiến trình nội dung portfolio"
      style={{ '--botrail-accent': themeColor } as CSSProperties}
    >
      <style>{`
        .botrail {
          --botrail-line: #cfc6ba;
          position: fixed;
          left: clamp(8px, 1.3vw, 22px);
          top: 104px;
          bottom: 34px;
          z-index: 45;
          display: none;
          width: 64px;
          pointer-events: none;
          opacity: 0;
          transition: opacity 360ms ease;
        }
        .botrail[data-ready='true'] { opacity: 1; }
        @media (min-width: 1280px) { .botrail { display: block; } }
        .botrail__svg { width: 64px; height: 100%; overflow: visible; }
        .botrail__track {
          fill: none;
          stroke: var(--botrail-line);
          stroke-width: 1.5;
          stroke-linecap: round;
          stroke-dasharray: 2 7;
        }
        .botrail__ink {
          fill: none;
          stroke: var(--botrail-accent);
          stroke-width: 2.6;
          stroke-linecap: round;
          transition: stroke-dashoffset 80ms linear;
          filter: drop-shadow(0 1px 1px rgba(189, 0, 38, .18));
        }
        .botrail__dot {
          pointer-events: auto;
          cursor: pointer;
          fill: var(--botrail-accent);
          stroke: #fff;
          stroke-width: 2;
          transition: r 180ms ease, fill 180ms ease, stroke 180ms ease;
          filter: drop-shadow(0 2px 2px rgba(189, 0, 38, .18));
        }
        .botrail__dot[data-state='done'] {
          fill: var(--botrail-accent);
          stroke: #fff;
          stroke-width: 2;
        }
        .botrail__dot[data-state='active'] {
          r: 6.4px;
          fill: var(--botrail-accent);
          stroke: #171512;
          stroke-width: 2;
          filter: drop-shadow(0 2px 4px rgba(189, 0, 38, .35));
        }
        .botrail__dot:hover, .botrail__dot:focus-visible { r: 7px; outline: none; }
        @media (prefers-reduced-motion: reduce) {
          .botrail__ink { transition: none; }
        }
      `}</style>

      <svg className="botrail__svg" viewBox="0 0 64 640" fill="none" focusable="false">
        <path ref={trackRef} className="botrail__track" d={RAIL_PATH} />
        <path ref={inkRef} className="botrail__ink" d={RAIL_PATH} />
        <g>
          {sections.map((section, index) => {
            const fallbackY = 42 + (index / Math.max(1, sections.length - 1)) * 556
            return (
              <circle
                key={section.id}
                ref={(node) => {
                  if (node) dotRefs.current.set(section.id, node)
                  else dotRefs.current.delete(section.id)
                }}
                className="botrail__dot"
                cx="32"
                cy={fallbackY}
                r="5"
                role="button"
                tabIndex={0}
                aria-label={`Đi đến mục ${section.label}`}
                onClick={() => goToSection(section.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    goToSection(section.id)
                  }
                }}
              />
            )
          })}
        </g>
      </svg>
    </aside>
  )
}
