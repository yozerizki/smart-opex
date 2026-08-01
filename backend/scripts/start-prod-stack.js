const { spawn } = require('child_process')

function startProcess(name, command, args) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`[${name}] exited with signal ${signal}`)
      return
    }
    console.log(`[${name}] exited with code ${code}`)

    if (code !== 0) {
      process.exitCode = code || 1
      shutdown('child-failed')
    }
  })

  return child
}

let apiProcess = null
let workerProcess = null
let shuttingDown = false

function shutdown(reason) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`Shutting down stack (${reason})...`)

  if (apiProcess && !apiProcess.killed) {
    apiProcess.kill('SIGTERM')
  }

  if (workerProcess && !workerProcess.killed) {
    workerProcess.kill('SIGTERM')
  }

  setTimeout(() => {
    if (apiProcess && !apiProcess.killed) {
      apiProcess.kill('SIGKILL')
    }
    if (workerProcess && !workerProcess.killed) {
      workerProcess.kill('SIGKILL')
    }
  }, 5000)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

apiProcess = startProcess('api', 'node', ['dist/main.js'])
workerProcess = startProcess('ocr-worker', 'node', ['dist/ocr-worker.js'])
