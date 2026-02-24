import {
  Controller,
  Get,
  UseGuards,
  Req,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth-guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'
import { UserService } from './user.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { UpdateUserProfileDto } from './dto/update-user-profile.dto'
import * as bcrypt from 'bcrypt'
import { FileInterceptor } from '@nestjs/platform-express'
import { UploadedFile, UseInterceptors } from '@nestjs/common'
import { diskStorage } from 'multer'
import * as fs from 'fs'
import { buildUniqueFilename } from '../common/upload-filename.util'

const KTP_DIR = './uploads/ktp'

function createKtpStorage() {
  return diskStorage({
    destination: (req, file, cb) => {
      if (!fs.existsSync(KTP_DIR)) fs.mkdirSync(KTP_DIR, { recursive: true })
      cb(null, KTP_DIR)
    },
    filename: (req, file, cb) => {
      cb(null, buildUniqueFilename(file.originalname, KTP_DIR))
    },
  })
}

@Controller('users')
export class UserController {
  constructor(private userService: UserService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: any) {
    const userId = req.user?.userId || req.user?.sub
    return this.userService.findById(userId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('verifikator')
  @Get()
  findAll() {
    return this.userService.findAll()
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('verifikator')
  @Post()
  async create(@Body() body: CreateUserDto) {
    const role = body.role?.toLowerCase()
    if (role !== 'pic' && role !== 'verifikator') {
      throw new BadRequestException('Invalid role')
    }
    if (role === 'pic' && !body.district_id) {
      throw new BadRequestException('district_id is required for PIC')
    }
    if (role === 'verifikator' && body.district_id) {
      throw new BadRequestException('district_id must be null for verifikator')
    }
    if (body.district_id) {
      const district = await this.userService.findDistrictById(body.district_id)
      if (!district) throw new BadRequestException('Invalid district_id')
    }
    const hash = await bcrypt.hash(body.password, 10)
    return this.userService.createUser({
      email: body.email,
      passwordHash: hash,
      role,
      district_id: body.district_id ?? null,
    })
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('verifikator')
  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateUserDto) {
    const existing = await this.userService.findById(id)
    if (!existing) throw new BadRequestException('User not found')
    const role = body.role ? body.role.toLowerCase() : existing.role
    if (role !== 'pic' && role !== 'verifikator') {
      throw new BadRequestException('Invalid role')
    }
    if (role === 'pic' && body.district_id === null) {
      throw new BadRequestException('district_id is required for PIC')
    }
    if (role === 'verifikator' && body.district_id) {
      throw new BadRequestException('district_id must be null for verifikator')
    }
    if (body.district_id) {
      const district = await this.userService.findDistrictById(body.district_id)
      if (!district) throw new BadRequestException('Invalid district_id')
    }
    let passwordHash: string | undefined
    if (body.password) passwordHash = await bcrypt.hash(body.password, 10)
    return this.userService.updateUser(id, {
      email: body.email,
      passwordHash,
      role,
      district_id: body.district_id ?? undefined,
    })
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('verifikator')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.userService.removeUser(id)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('verifikator')
  @Patch(':id/profile')
  @UseInterceptors(
    FileInterceptor('ktp_scan', {
      storage: createKtpStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async upsertProfile(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateUserProfileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const existing = await this.userService.findProfileByUserId(id)
    const isCreate = !existing
    const missingRequired =
      !body.full_name ||
      !body.position ||
      !body.phone_number ||
      !body.nik_ktp ||
      (isCreate && !file)

    if (isCreate && missingRequired) {
      throw new BadRequestException('Profile data is incomplete')
    }

    return this.userService.upsertProfile(id, {
      full_name: body.full_name,
      position: body.position,
      nip: body.nip,
      phone_number: body.phone_number,
      nik_ktp: body.nik_ktp,
      ktp_scan_path: file?.path,
    })
  }
}
