const { createECDH } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const ecdh = createECDH('prime256v1')
ecdh.generateKeys()

const output = [
  `VAPID_PUBLIC_KEY=${ecdh.getPublicKey().toString('base64url')}`,
  `VAPID_PRIVATE_KEY=${ecdh.getPrivateKey().toString('base64url')}`,
  'VAPID_SUBJECT=https://www.tpsmindx.com/user/quan-ly-phan-hoi',
].join('\n')

if (process.argv.includes('--write')) {
  const target = path.join(process.cwd(), '.env.local')
  if (fs.existsSync(target) && /VAPID_PUBLIC_KEY=/.test(fs.readFileSync(target, 'utf8'))) {
    console.log('VAPID keys already exist in .env.local')
  } else {
    fs.appendFileSync(target, `${output}\n`, 'utf8')
    console.log('VAPID keys written to .env.local')
  }
} else {
  console.log(output)
}
