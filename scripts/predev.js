const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const PORT = 3000

function run(command) {
  try {
    execSync(command, { stdio: 'ignore' })
  } catch {
    // Best effort cleanup
  }
}

function clearPort() {
  if (process.platform === 'win32') {
    run(`powershell -Command \"Get-NetTCPConnection -LocalPort ${PORT} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }\"`)
    return
  }

  if (process.platform === 'darwin') {
    run(`lsof -ti tcp:${PORT} | xargs kill -9`)
    return
  }

  run(`fuser -k ${PORT}/tcp`)
}

function removeNextDevLock() {
  const lockPath = path.join(process.cwd(), '.next', 'dev', 'lock')
  try {
    fs.rmSync(lockPath, { force: true })
  } catch {
    // Ignore missing lock file
  }
}

clearPort()
removeNextDevLock()
console.log('Port 3000 and .next/dev/lock cleanup completed.')
