'use client'

import { useEffect, useId, useState } from 'react'

export function AwardCounter({ value, delay = 0 }: { value: number; delay?: number }) {
  const [shown, setShown] = useState(value)
  useEffect(() => {
    if (!Number.isFinite(value) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const start = performance.now() + delay
    const tick = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - start) / 1100))
      setShown(value * (1 - Math.pow(1 - progress, 3)))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, delay])
  const label = Number.isFinite(value) ? value.toFixed(2) : '—'
  return <strong aria-label={`${label}%`}><span aria-hidden="true" style={{ fontSize: 'inherit', margin: 0 }}>{Number.isFinite(value) ? shown.toFixed(2) : '—'}</span><span aria-hidden="true">%</span></strong>
}

export function HonorsTrophy({ rank, className }: { rank: number; className?: string }) {
  const id = useId().replace(/:/g, '')
  return <svg className={className} viewBox="0 0 120 112" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-metal`} x1="20" y1="18" x2="100" y2="78" gradientUnits="userSpaceOnUse"><stop stopColor="var(--metal-dark)"/><stop offset=".24" stopColor="var(--metal-light)"/><stop offset=".47" stopColor="var(--metal-mid)"/><stop offset=".7" stopColor="var(--metal-light)"/><stop offset="1" stopColor="var(--metal-dark)"/></linearGradient>
      <linearGradient id={`${id}-side`} x1="30" x2="88"><stop stopColor="var(--metal-dark)"/><stop offset=".55" stopColor="var(--metal-mid)"/><stop offset="1" stopColor="var(--metal-dark)"/></linearGradient>
    </defs>
    <path d="M32 24H18C6 24 12 55 35 58M88 24h14c12 0 6 31-17 34" stroke={`url(#${id}-metal)`} strokeWidth="8"/>
    <path d="M28 14h64l-6 38c-2 14-13 24-26 27-13-3-24-13-26-27z" fill={`url(#${id}-metal)`} stroke="var(--metal-dark)" strokeWidth="1.5"/>
    <path d="m30 16 17 7 13 54-23-24z" fill="var(--metal-light)" opacity=".5"/>
    <path d="m90 16-17 7-13 54 23-24z" fill="var(--metal-dark)" opacity=".28"/>
    <path d="M55 77h10v16l15 7H40l15-7z" fill={`url(#${id}-metal)`}/>
    <path d="M37 99h46v7H37z" fill={`url(#${id}-side)`} stroke="var(--metal-mid)"/>
    <path d="M26 12h68v7H26z" fill={`url(#${id}-metal)`} stroke="var(--metal-light)"/>
    <path d="m60 28 15 9v20l-15 9-15-9V37z" fill="var(--metal-dark)" stroke="var(--metal-light)" strokeWidth="2"/>
    <text x="60" y="56" textAnchor="middle" fill="var(--metal-light)" fontFamily="inherit" fontSize="26" fontWeight="700">{rank}</text>
    {rank === 1 && <><path d="m29 54 14 4-6 29-7-7-9 3zM91 54l-14 4 6 29 7-7 9 3z" fill="#b0082c" stroke="#ee5267"/><path d="m31 65 2 4 5 1-4 3 1 5-4-3-4 2 1-5-3-3 5-1zM89 65l2 4 5 1-4 3 1 5-4-3-4 2 1-5-3-3 5-1z" fill="var(--metal-light)"/></>}
  </svg>
}

export function HonorsMedallion({ rank, className }: { rank: number; className?: string }) {
  const id = useId().replace(/:/g, '')
  return <svg className={className} viewBox="0 0 200 96" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-rim`} x1="72" y1="22" x2="128" y2="80" gradientUnits="userSpaceOnUse"><stop stopColor="var(--metal-light)"/><stop offset=".24" stopColor="var(--metal-mid)"/><stop offset=".48" stopColor="var(--metal-dark)"/><stop offset=".7" stopColor="var(--metal-light)"/><stop offset="1" stopColor="var(--metal-mid)"/></linearGradient>
      <linearGradient id={`${id}-face`} x1="82" y1="32" x2="119" y2="67" gradientUnits="userSpaceOnUse"><stop stopColor="var(--metal-light)"/><stop offset=".45" stopColor="var(--metal-mid)"/><stop offset="1" stopColor="var(--metal-dark)"/></linearGradient>
      <linearGradient id={`${id}-ribbon`} x1="80" y1="0" x2="115" y2="90" gradientUnits="userSpaceOnUse"><stop stopColor="#7a001a"/><stop offset=".4" stopColor="#ec183a"/><stop offset=".65" stopColor="#98051f"/><stop offset="1" stopColor="#e8203e"/></linearGradient>
      <linearGradient id={`${id}-line`} x1="0" x2="200" gradientUnits="userSpaceOnUse"><stop stopColor="var(--metal-mid)" stopOpacity="0"/><stop offset=".36" stopColor="var(--metal-mid)" stopOpacity=".85"/><stop offset=".64" stopColor="var(--metal-mid)" stopOpacity=".85"/><stop offset="1" stopColor="var(--metal-mid)" stopOpacity="0"/></linearGradient>
    </defs>
    <path d="M2 32h36q6 0 11 5l24 16M198 32h-36q-6 0-11 5l-24 16" stroke={`url(#${id}-line)`} strokeWidth="1"/>
    <path d="M85 63l17 6-14 27-5-12-13 3zM113 63l-16 6 15 27 5-12 13 3z" fill={`url(#${id}-ribbon)`}/>
    <path d="M88 72l-9 16M111 72l10 16" stroke="#ff697b" strokeOpacity=".35"/>
    <rect x="93" y="22" width="14" height="10" rx="4" stroke={`url(#${id}-rim)`} strokeWidth="3"/>
    <circle cx="100" cy="52" r="29" fill="#000" fillOpacity=".3" transform="translate(0 2)"/>
    <circle cx="100" cy="50" r="29" fill={`url(#${id}-rim)`} stroke="var(--metal-dark)"/>
    <circle cx="100" cy="50" r="25.5" stroke="var(--metal-light)" strokeWidth="1.2"/>
    <circle cx="100" cy="50" r="23" stroke="var(--metal-dark)" strokeWidth="3" strokeDasharray="1 2.5"/>
    <circle cx="100" cy="50" r="20.5" fill={`url(#${id}-face)`} stroke="var(--metal-light)"/>
    <circle cx="100" cy="50" r="18.5" stroke="var(--metal-dark)" strokeOpacity=".55"/>
    <text x="101" y="61" textAnchor="middle" fill="var(--metal-dark)" fontFamily="inherit" fontSize="29" fontWeight="700">{rank}</text>
    <text x="100" y="60" textAnchor="middle" fill="var(--metal-light)" fontFamily="inherit" fontSize="29" fontWeight="700">{rank}</text>
  </svg>
}
