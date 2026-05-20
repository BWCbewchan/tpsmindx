#!/usr/bin/env node

function getPublicBaseUrl() {
  const raw = (process.env.NEXT_PUBLIC_BASE_URL || '').trim()
  if (!raw) return 'http://localhost:3000'
  try {
    const u = new URL(raw)
    if (/\.ngro$/i.test(u.hostname)) {
      u.hostname = u.hostname.replace(/\.ngro$/i, '.ngrok-free.app')
      return u.origin
    }
    return raw.replace(/\/+$/, '')
  } catch {
    return 'http://localhost:3000'
  }
}

const BASE_URL = getPublicBaseUrl()

async function clearCache() {
  try {
    console.log('🔄 Clearing K12 docs cache...\n')
    
    const response = await fetch(`${BASE_URL}/api/revalidate-k12`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    const data = await response.json()
    
    if (data.revalidated) {
      console.log('✅ Cache cleared successfully!')
      console.log('   Timestamp:', data.timestamp)
      console.log('\n💡 Please refresh your browser to see the updated content.')
    } else {
      console.error('❌ Failed to clear cache:', data.message)
      if (data.error) {
        console.error('   Error:', data.error)
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error('\n💡 Make sure the Next.js development server is running.')
  }
}

clearCache()
