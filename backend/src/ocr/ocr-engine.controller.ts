import {
  BadRequestException,
  Controller,
  Get,
  Patch,
  Body,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import * as fs from 'fs'
import * as path from 'path'
import { JwtAuthGuard } from '../auth/jwt-auth-guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'

const ENGINE_DIR = path.join(process.cwd(), 'uploads', 'ocr-engine')
const ENGINE_CONFIG_PATH = path.join(ENGINE_DIR, 'current.json')
const ENGINE_FILE_REGEX = /^smartopex-engine-v(\d+)\.py$/i

function getNextEngineFileName() {
  if (!fs.existsSync(ENGINE_DIR)) {
    return 'smartopex-engine-v1.py'
  }

  const maxVersion = fs
    .readdirSync(ENGINE_DIR)
    .map((name) => {
      const match = name.match(ENGINE_FILE_REGEX)
      return match ? Number(match[1]) : 0
    })
    .reduce((max, current) => Math.max(max, current), 0)

  let nextVersion = maxVersion + 1
  let nextFileName = `smartopex-engine-v${nextVersion}.py`

  while (fs.existsSync(path.join(ENGINE_DIR, nextFileName))) {
    nextVersion += 1
    nextFileName = `smartopex-engine-v${nextVersion}.py`
  }

  return nextFileName
}

@Controller('ocr/engine')
export class OcrEngineController {
  private getFallbackPath() {
    return process.env.OCR_SCRIPT_PATH || path.join(process.cwd(), 'scripts/ocr/paddle_ocr_dummy.py')
  }

  private getCurrentScriptPath() {
    const fallback = this.getFallbackPath()
    if (!fs.existsSync(ENGINE_CONFIG_PATH)) return fallback

    try {
      const parsed = JSON.parse(fs.readFileSync(ENGINE_CONFIG_PATH, 'utf8'))
      return parsed?.scriptPath || fallback
    } catch {
      return fallback
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('verifikator')
  @Get()
  getCurrentEngine() {
    const scriptPath = this.getCurrentScriptPath()
    return {
      scriptPath,
      fileName: path.basename(scriptPath),
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('verifikator')
  @Get('files')
  listFiles() {
    if (!fs.existsSync(ENGINE_DIR)) {
      return { files: [] }
    }

    const currentScriptPath = this.getCurrentScriptPath()
    const files = fs
      .readdirSync(ENGINE_DIR)
      .filter((name) => name.toLowerCase().endsWith('.py'))
      .map((name) => {
        const fullPath = path.join(ENGINE_DIR, name)
        const stat = fs.statSync(fullPath)
        return {
          fileName: name,
          scriptPath: fullPath,
          updatedAt: stat.mtime.toISOString(),
          isActive: fullPath === currentScriptPath,
        }
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

    return { files }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('verifikator')
  @Patch('active')
  setActiveEngine(@Body() body: { fileName?: string }) {
    const fileName = (body?.fileName || '').trim()
    if (!fileName) {
      throw new BadRequestException('fileName is required')
    }
    if (fileName.includes('/') || fileName.includes('\\')) {
      throw new BadRequestException('Invalid fileName')
    }
    if (!fileName.toLowerCase().endsWith('.py')) {
      throw new BadRequestException('Only .py file is allowed')
    }

    const scriptPath = path.join(ENGINE_DIR, fileName)
    if (!fs.existsSync(scriptPath)) {
      throw new BadRequestException('Engine file not found')
    }

    const payload = { scriptPath, updatedAt: new Date().toISOString() }
    fs.writeFileSync(ENGINE_CONFIG_PATH, JSON.stringify(payload, null, 2), 'utf8')

    return {
      message: 'Engine updated',
      scriptPath,
      fileName,
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('verifikator')
  @Post()
  @UseInterceptors(
    FileInterceptor('engine', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          if (!fs.existsSync(ENGINE_DIR)) fs.mkdirSync(ENGINE_DIR, { recursive: true })
          cb(null, ENGINE_DIR)
        },
        filename: (req, file, cb) => {
          cb(null, getNextEngineFileName())
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.originalname.toLowerCase().endsWith('.py')) {
          return cb(new BadRequestException('Only .py file is allowed') as any, false)
        }
        cb(null, true)
      },
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  uploadEngine(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Engine file is required')
    }
    if (!file.filename.toLowerCase().endsWith('.py')) {
      throw new BadRequestException('Only .py file is allowed')
    }

    const payload = { scriptPath: file.path, updatedAt: new Date().toISOString() }
    fs.writeFileSync(ENGINE_CONFIG_PATH, JSON.stringify(payload, null, 2), 'utf8')

    return {
      message: 'Engine updated',
      scriptPath: file.path,
      fileName: path.basename(file.path),
    }
  }
}
