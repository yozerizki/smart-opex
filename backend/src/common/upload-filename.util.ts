import * as fs from 'fs'
import * as path from 'path'

export function buildUniqueFilename(originalName: string, targetDir: string): string {
  const baseName = path.basename(originalName || 'file')
  const parsed = path.parse(baseName)
  const rawName = (parsed.name || 'file').trim()
  const cleanedName = rawName.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim()
  const safeName = cleanedName || 'file'
  const ext = parsed.ext || ''

  let candidate = `${safeName}${ext}`
  let counter = 1

  while (fs.existsSync(path.join(targetDir, candidate))) {
    candidate = `${safeName}-${counter}${ext}`
    counter += 1
  }

  return candidate
}
