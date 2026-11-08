'use client';

import { useCallback, useEffect, useRef } from 'react';

interface NavSection {
  id: string;
  label: string;
}

export function PortfolioSideProgressNav({
  sections,
  themeColor = '#bd0026',
}: {
  sections: NavSection[];
  themeColor?: string;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const cpRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  /**
   * Find the scrolling element — PersistentLayout puts content in a
   * div#main-scroll-container with `lg:overflow-y-auto`, so on ≥1024px
   * scroll events fire on THAT element, not on window.
   */
  const getScroller = useCallback((): HTMLElement | Window => {
    const container = document.getElementById('main-scroll-container');
    if (container && container.scrollHeight > container.clientHeight + 10) {
      return container;
    }
    return window;
  }, []);

  const getScrollMetrics = useCallback((scroller: HTMLElement | Window) => {
    if (scroller instanceof Window) {
      return {
        scrollTop: window.pageYOffset ?? 0,
        totalH: document.documentElement.scrollHeight,
        viewH: window.innerHeight,
      };
    }
    return {
      scrollTop: scroller.scrollTop,
      totalH: scroller.scrollHeight,
      viewH: scroller.clientHeight,
    };
  }, []);

  /** Get section's offset relative to the scroll container */
  const getSectionOffset = useCallback((sectionId: string, scroller: HTMLElement | Window) => {
    const el = document.getElementById(sectionId);
    if (!el) return 0;

    if (scroller instanceof Window) {
      // For window scrolling, getBoundingClientRect + scrollY is most reliable
      return el.getBoundingClientRect().top + window.pageYOffset;
    }

    // For container scrolling: walk up until we reach the container
    const container = scroller as HTMLElement;
    let offset = 0;
    let current: HTMLElement | null = el;
    while (current && current !== container) {
      offset += current.offsetTop;
      current = current.offsetParent as HTMLElement | null;
    }
    return offset;
  }, []);

  const update = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;

    const scroller = getScroller();
    const { scrollTop, totalH, viewH } = getScrollMetrics(scroller);
    const maxScroll = Math.max(1, totalH - viewH);
    const pct = Math.min(100, Math.max(0, (scrollTop / maxScroll) * 100));

    // Update fill line + dot position (direct DOM, no re-render)
    if (fillRef.current) fillRef.current.style.height = `${pct}%`;
    if (dotRef.current) dotRef.current.style.top = `${pct}%`;
    if (pctRef.current) pctRef.current.textContent = `${Math.round(pct)}%`;

    // Active section detection
    const midPoint = scrollTop + viewH * 0.35;
    let activeId = sections[0]?.id || '';
    for (let i = sections.length - 1; i >= 0; i--) {
      const offset = getSectionOffset(sections[i].id, scroller);
      if (midPoint >= offset) { activeId = sections[i].id; break; }
    }

    // Position checkpoints + highlight active
    sections.forEach((sec) => {
      const cpEl = cpRefs.current.get(sec.id);
      if (!cpEl) return;

      const sectionOffset = getSectionOffset(sec.id, scroller);
      const cpPct = Math.min(100, Math.max(0, (sectionOffset / maxScroll) * 100));
      cpEl.style.top = `${cpPct}%`;

      const isActive = sec.id === activeId;
      cpEl.setAttribute('data-active', isActive ? '1' : '0');
    });
  }, [sections, getScroller, getScrollMetrics, getSectionOffset]);

  useEffect(() => {
    if (!sections || sections.length === 0) return;

    const scroller = getScroller();

    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => { update(); ticking = false; });
        ticking = true;
      }
    };
    const onResize = () => update();

    // Initial + delayed (after images load and layout settles)
    const t1 = requestAnimationFrame(update);
    const t2 = setTimeout(update, 500);
    const t3 = setTimeout(update, 2000);

    scroller.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      scroller.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, [sections, update, getScroller]);

  if (!sections || sections.length === 0) return null;

  return (
    <aside
      ref={rootRef}
      data-sp-root
      aria-label="Thanh tiến trình cuộn trang"
    >
      <style>{`
        [data-sp-root] {
          position: fixed; left: 16px; top: 110px; bottom: 50px;
          z-index: 40; width: 40px; pointer-events: none;
          display: none;
        }
        @media (min-width: 1280px) {
          [data-sp-root] { display: block; }
        }

        /* Track */
        .sp-track {
          position: absolute; left: 50%; top: 0; bottom: 0;
          width: 2px; transform: translateX(-50%);
          background: repeating-linear-gradient(to bottom, #cfc6bb 0 3px, transparent 3px 8px); border-radius: 999px;
          box-shadow: 0 0 6px 2px rgba(255,255,255,0.7);
        }

        /* Fill */
        .sp-fill {
          position: absolute; left: 50%; top: 0;
          width: 3px; transform: translateX(-50%);
          border-radius: 999px;
          transition: height 60ms linear;
          box-shadow: 0 0 8px 2px rgba(255,255,255,0.6);
        }

        /* Dot rider */
        .sp-dot-wrap {
          position: absolute; left: 50%;
          transform: translate(-50%, -50%);
          z-index: 30; pointer-events: auto;
          transition: top 60ms linear;
        }
        .sp-dot-glow {
          position: absolute; inset: -5px;
          border-radius: 50%; filter: blur(4px);
          animation: sp-pulse 2s ease-in-out infinite;
        }
        @keyframes sp-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.15); }
        }
        .sp-dot-core {
          position: relative; width: 18px; height: 18px;
          border-radius: 50%; border: 2.5px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.18);
        }
        .sp-pct {
          position: absolute; left: 28px; top: 50%;
          transform: translateY(-50%);
          white-space: nowrap; background: #171512;
          color: #fff; font-size: 10px; font-weight: 700;
          padding: 2px 8px; border-radius: 5px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
          pointer-events: none; opacity: 0;
          transition: opacity 200ms;
        }
        .sp-dot-wrap:hover .sp-pct { opacity: 1; }

        /* Checkpoint wrapper */
        .sp-checkpoint {
          position: absolute; left: 50%;
          transform: translate(-50%, -50%);
          z-index: 20; pointer-events: auto;
          cursor: pointer;
          appearance: none; border: 0; padding: 0; background: transparent;
        }
        .sp-cp-dot {
          width: 10px; height: 10px; border-radius: 50%;
          border: 2px solid #9b9288; background: white;
          transition: all 200ms ease;
        }
        .sp-checkpoint[data-active="1"] .sp-cp-dot {
          border-color: white;
          transform: scale(1.4);
        }
        .sp-cp-label {
          position: absolute; left: 20px; top: 50%;
          transform: translateY(-50%) translateX(-4px);
          white-space: nowrap; background: #171512;
          color: #fff; font-size: 11px; font-weight: 700;
          padding: 4px 10px; border-radius: 6px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
          pointer-events: none; opacity: 0;
          transition: all 200ms;
        }
        .sp-checkpoint:hover .sp-cp-label,
        .sp-checkpoint[data-active="1"] .sp-cp-label {
          opacity: 1;
          transform: translateY(-50%) translateX(0);
        }
      `}</style>

      <div style={{ position: 'relative', height: '100%' }}>
        {/* Background track */}
        <div className="sp-track" />

        {/* Filled progress line */}
        <div
          ref={fillRef}
          className="sp-fill"
          style={{ height: '0%', background: themeColor }}
        />

        {/* Red dot slider */}
        <div ref={dotRef} className="sp-dot-wrap" style={{ top: '0%' }}>
          <div className="sp-dot-glow" style={{ background: `${themeColor}30` }} />
          <div className="sp-dot-core" style={{ background: themeColor }} />
          <span ref={pctRef} className="sp-pct">0%</span>
        </div>

        {/* Checkpoint nodes — each is self-contained with its own label */}
        {sections.map((sec) => (
          <button
            type="button"
            key={sec.id}
            ref={(el) => { if (el) cpRefs.current.set(sec.id, el); }}
            className="sp-checkpoint"
            data-active="0"
            style={{ top: '0%' }}
            aria-label={`Đi đến mục ${sec.label}`}
            onClick={() => {
              const el = document.getElementById(sec.id);
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            <div className="sp-cp-dot" style={{
              background: 'var(--cp-bg, white)',
              boxShadow: 'var(--cp-shadow, none)',
            }} />
            <span className="sp-cp-label">{sec.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
