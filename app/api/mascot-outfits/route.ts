import { normalizePublicImageUrl } from '@/lib/public-image-url'
import { requireBearerAdminOrSuper, requireBearerAdminOrSuperMutation } from '@/lib/auth-server'
import pool from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type OutfitPayload = {
  id?: string
  name?: string
  countryCode?: string
  flagCode?: string
  slug?: string
  colors?: string[]
  frames?: number
  status?: 'draft' | 'ready'
  available?: boolean
  tag?: 'default' | 'new' | 'special' | 'coming-soon'
  color?: string
  bgColor?: string
  staticMode?: boolean
  previewStatic?: string | null
  spriteBase?: string | null
  sortOrder?: number
}

const OUTFIT_ASSET_VERSION = 'db-outfits-20260621'
const asset = (path: string | null | undefined) => path ? `${normalizePublicImageUrl(path)}?v=${OUTFIT_ASSET_VERSION}` : null
const frameSet = (slug: string, frames: number) =>
  Array.from({ length: Math.max(1, frames) }, (_, i) => asset(`/mascot/${slug}/frame-${i + 1}.webp`)!)

function normalizeRow(row: any) {
  const colors = Array.isArray(row.colors) ? row.colors : []
  const frames = Number(row.frames) || 25
  const previewFrames = Array.isArray(row.preview_frames) && row.preview_frames.length > 0
    ? row.preview_frames.map((src: string) => asset(src))
    : frameSet(row.slug, frames)

  return {
    id: row.id,
    name: row.name,
    countryCode: row.country_code,
    flagCode: row.flag_code,
    slug: row.slug,
    colors,
    frames,
    status: row.status,
    previewFrames,
    jumpFrames: Array.isArray(row.jump_frames) ? row.jump_frames.map((src: string) => asset(src)) : null,
    waveFrames: Array.isArray(row.wave_frames) ? row.wave_frames.map((src: string) => asset(src)) : null,
    staticMode: row.static_mode,
    previewStatic: asset(row.preview_static ?? `/mascot/${row.slug}.webp`),
    spriteBase: asset(row.sprite_base ?? `/mascot/${row.slug}-sheet.webp`),
    available: row.available && row.status === 'ready',
    tag: row.tag ?? 'new',
    color: row.color ?? colors[0] ?? '#a1001f',
    bgColor: row.bg_color ?? '#fff5f5',
    updatedAt: row.updated_at,
    sortOrder: row.sort_order,
  }
}

function text(value: unknown, fallback = '') {
  const next = String(value ?? '').trim()
  return next || fallback
}

function clampFrames(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 25
  return Math.min(60, Math.max(1, Math.round(parsed)))
}

function sanitizeColors(value: unknown): string[] {
  if (!Array.isArray(value)) return ['#a1001f', '#ffffff', '#f97316']
  return value
    .map((item) => String(item ?? '').trim())
    .filter((item) => /^#[0-9a-f]{6}$/i.test(item))
    .slice(0, 3)
}

async function upsertOutfit(payload: OutfitPayload) {
  const slug = text(payload.slug, payload.id)
  const id = text(payload.id, slug)
  const name = text(payload.name, id)
  const countryCode = text(payload.countryCode, 'XX').toUpperCase()
  const flagCode = text(payload.flagCode, countryCode.toLowerCase())
  const colors = sanitizeColors(payload.colors)
  const frames = clampFrames(payload.frames)
  const status = payload.status === 'draft' ? 'draft' : 'ready'
  const color = text(payload.color, colors[0] ?? '#a1001f')
  const bgColor = text(payload.bgColor, '#fff5f5')
  const previewStatic = payload.previewStatic ?? `/mascot/${slug}.webp`
  const spriteBase = payload.spriteBase ?? `/mascot/${slug}-sheet.webp`

  const result = await pool.query(
    `
      INSERT INTO trang_phuc_mascot
        (id, name, country_code, flag_code, slug, colors, frames, status, available, tag, color, bg_color, static_mode, preview_static, sprite_base, sort_order)
      VALUES
        ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        country_code = EXCLUDED.country_code,
        flag_code = EXCLUDED.flag_code,
        slug = EXCLUDED.slug,
        colors = EXCLUDED.colors,
        frames = EXCLUDED.frames,
        status = EXCLUDED.status,
        available = EXCLUDED.available,
        tag = EXCLUDED.tag,
        color = EXCLUDED.color,
        bg_color = EXCLUDED.bg_color,
        static_mode = EXCLUDED.static_mode,
        preview_static = EXCLUDED.preview_static,
        sprite_base = EXCLUDED.sprite_base,
        sort_order = EXCLUDED.sort_order
      RETURNING *
    `,
    [
      id,
      name,
      countryCode,
      flagCode,
      slug,
      JSON.stringify(colors),
      frames,
      status,
      payload.available ?? true,
      payload.tag ?? 'new',
      color,
      bgColor,
      payload.staticMode ?? true,
      previewStatic,
      spriteBase,
      Number(payload.sortOrder ?? 100),
    ],
  )

  return normalizeRow(result.rows[0])
}

export async function GET(request: NextRequest) {
  try {
    const includeAll = request.nextUrl.searchParams.get('all') === '1'
    if (includeAll) {
      const auth = await requireBearerAdminOrSuper(request)
      if (!auth.ok) return auth.response
    }

    const result = await pool.query(
      includeAll
        ? 'SELECT * FROM trang_phuc_mascot ORDER BY sort_order ASC, updated_at DESC'
        : "SELECT * FROM trang_phuc_mascot WHERE status = 'ready' AND available = true ORDER BY sort_order ASC, updated_at DESC",
    )

    return NextResponse.json({
      success: true,
      data: result.rows.map(normalizeRow),
      count: result.rows.length,
    })
  } catch (error: any) {
    console.error('Error fetching mascot outfits:', error)
    return NextResponse.json({ success: false, error: error?.message || 'Không thể lấy trang phục mascot' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireBearerAdminOrSuperMutation(request)
  if (!auth.ok) return auth.response

  try {
    const outfit = await upsertOutfit(await request.json())
    return NextResponse.json({ success: true, data: outfit })
  } catch (error: any) {
    console.error('Error saving mascot outfit:', error)
    return NextResponse.json({ success: false, error: error?.message || 'Không thể lưu trang phục mascot' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  return POST(request)
}

export async function DELETE(request: NextRequest) {
  const auth = await requireBearerAdminOrSuperMutation(request)
  if (!auth.ok) return auth.response

  try {
    const id = request.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ success: false, error: 'Thiếu id trang phục' }, { status: 400 })
    }
    await pool.query('DELETE FROM trang_phuc_mascot WHERE id = $1', [id])
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting mascot outfit:', error)
    return NextResponse.json({ success: false, error: error?.message || 'Không thể xóa trang phục mascot' }, { status: 500 })
  }
}
