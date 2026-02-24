import { Injectable } from '@nestjs/common'
import { spawn } from 'child_process'
import * as fs from 'fs/promises'
import * as path from 'path'

interface OcrRunnerResult {
  amount: number | null
  currency?: string
  rawText?: string
  confidence?: number
}

@Injectable()
export class OcrRunnerService {
  async runReceiptOcr(filePath: string): Promise<OcrRunnerResult> {
    const provider = (process.env.OCR_PROVIDER || 'paddle').toLowerCase()
    if (provider === 'external') {
      return this.runExternalOcr(filePath)
    }
    return this.runPaddleOcr(filePath)
  }

  private async runPaddleOcr(filePath: string): Promise<OcrRunnerResult> {
    const python = process.env.OCR_PYTHON || 'python3'
    const scriptPath = await this.resolveScriptPath()

    const output = await this.runProcess(python, [
      scriptPath,
      '--input',
      filePath,
      '--json',
    ])
    const trimmed = output.trim()

    if (!trimmed) {
      return { amount: null }
    }

    let parsed: any
    try {
      parsed = JSON.parse(trimmed)
    } catch (err) {
      const lastLine = trimmed.split('\n').pop() || ''
      try {
        parsed = JSON.parse(lastLine)
      } catch (innerErr) {
        throw new Error(`OCR output not JSON: ${String(err)}`)
      }
    }

    const amount = Number.isFinite(parsed?.grand_total) ? Number(parsed.grand_total) :
                   Number.isFinite(parsed?.amount) ? Number(parsed.amount) : null
    
    return {
      amount,
      currency: parsed?.currency,
      rawText: parsed?.raw_text,
      confidence: Number.isFinite(parsed?.confidence) ? Number(parsed.confidence) : undefined,
    }
  }

  private async runExternalOcr(filePath: string): Promise<OcrRunnerResult> {
    const endpoint = process.env.OCR_ENDPOINT
    if (!endpoint) {
      throw new Error('OCR_ENDPOINT is required when OCR_PROVIDER=external')
    }

    const fileBuffer = await fs.readFile(filePath)
    const payload = {
      file_name: path.basename(filePath),
      file_base64: fileBuffer.toString('base64'),
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 120000)

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (process.env.OCR_ENDPOINT_TOKEN) {
      headers.Authorization = `Bearer ${process.env.OCR_ENDPOINT_TOKEN}`
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    clearTimeout(timer)

    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(`External OCR failed (${res.status}): ${errorText}`)
    }

    const parsed = await res.json()
    const amount = Number.isFinite(parsed?.amount) ? Number(parsed.amount) : null

    return {
      amount,
      currency: parsed?.currency,
      rawText: parsed?.raw_text,
      confidence: Number.isFinite(parsed?.confidence) ? Number(parsed.confidence) : undefined,
    }
  }

  private runProcess(command: string, args: string[], timeoutMs = 120000): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
      let stdout = ''
      let stderr = ''

      const timer = setTimeout(() => {
        child.kill('SIGKILL')
        reject(new Error(`OCR timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString()
      })

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString()
      })

      child.on('error', (err) => {
        clearTimeout(timer)
        reject(err)
      })

      child.on('close', (code) => {
        clearTimeout(timer)
        if (code !== 0) {
          reject(new Error(`OCR process exited with code ${code}: ${stderr}`))
          return
        }
        resolve(stdout)
      })
    })
  }

  private async resolveScriptPath(): Promise<string> {
    const fallback = process.env.OCR_SCRIPT_PATH || path.join(process.cwd(), 'scripts/ocr/paddle_ocr_dummy.py')
    const configPath = process.env.OCR_ENGINE_CONFIG_PATH || path.join(process.cwd(), 'uploads/ocr-engine/current.json')

    try {
      const raw = await fs.readFile(configPath, 'utf8')
      const parsed = JSON.parse(raw)
      const candidate = parsed?.scriptPath
      if (candidate) {
        await fs.access(candidate)
        return candidate
      }
    } catch {
      // ignore and fallback
    }

    return fallback
  }
}
