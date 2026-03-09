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
import { extname } from 'path'
import * as fs from 'fs'

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
  @Roles('verifikator', 'pusat')
  @Get()
  async findAll(@Req() req: any) {
    const actorId = req.user?.userId || req.user?.sub
    const actor = await this.userService.findById(actorId)
    if (!actor) throw new BadRequestException('User not found')
    return this.userService.findAll(actor)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('verifikator', 'pusat')
  @Post()
  async create(@Req() req: any, @Body() body: CreateUserDto) {
    const actorId = req.user?.userId || req.user?.sub
    const actor = await this.userService.findById(actorId)
    if (!actor) throw new BadRequestException('User not found')

    const role = body.role?.toLowerCase()
    if (role !== 'pic' && role !== 'verifikator' && role !== 'pusat') {
      throw new BadRequestException('Invalid role')
    }

    if (role === 'pusat' && actor.role !== 'pusat') {
      throw new BadRequestException('Only pusat can create pusat account')
    }

    if (role === 'pic' && !body.district_id) {
      throw new BadRequestException('district_id is required for PIC')
    }

    if (role === 'verifikator' && body.district_id) {
      throw new BadRequestException('district_id must be null for verifikator')
    }
    if (role === 'pusat' && (body.district_id || body.area_id)) {
      throw new BadRequestException('pusat must not have district_id or area_id')
    }

    if (role === 'pic' && body.district_id) {
      const canAssignDistrict = await this.userService.assertActorCanAssignDistrict(actor, body.district_id)
      if (!canAssignDistrict.ok) throw new BadRequestException(canAssignDistrict.reason)
    }

    let areaId: number | null = null
    if (role === 'verifikator') {
      if (actor.role === 'pusat') {
        if (!body.area_id) throw new BadRequestException('area_id is required for verifikator')
        const canAssignArea = await this.userService.assertActorCanAssignArea(actor, body.area_id)
        if (!canAssignArea.ok) throw new BadRequestException(canAssignArea.reason)
        areaId = body.area_id
      } else {
        if (!actor.area_id) throw new BadRequestException('Your account is not mapped to an area')
        areaId = actor.area_id
      }
    }

    const hash = await bcrypt.hash(body.password, 10)
    return this.userService.createUser({
      email: body.email,
      passwordHash: hash,
      role,
      district_id: body.district_id ?? null,
      area_id: areaId,
    })
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('verifikator', 'pusat')
  @Patch(':id')
  async update(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() body: UpdateUserDto) {
    const actorId = req.user?.userId || req.user?.sub
    const actor = await this.userService.findById(actorId)
    if (!actor) throw new BadRequestException('User not found')

    const existing = await this.userService.findById(id)
    if (!existing) throw new BadRequestException('User not found')

    if (actor.role === 'verifikator') {
      const sameAreaVerifikator = existing.role === 'verifikator' && existing.area_id === actor.area_id
      const sameAreaPic = existing.role === 'pic' && existing.districts?.area_id === actor.area_id
      if (!sameAreaVerifikator && !sameAreaPic) {
        throw new BadRequestException('User is outside your area')
      }
      if (existing.role === 'pusat') {
        throw new BadRequestException('Not allowed to update pusat account')
      }
    }

    const role = body.role ? body.role.toLowerCase() : existing.role
    if (role !== 'pic' && role !== 'verifikator' && role !== 'pusat') {
      throw new BadRequestException('Invalid role')
    }

    if (role === 'pusat' && actor.role !== 'pusat') {
      throw new BadRequestException('Only pusat can assign pusat role')
    }

    if (role === 'pic' && body.district_id === null) {
      throw new BadRequestException('district_id is required for PIC')
    }

    if (role === 'verifikator' && body.district_id) {
      throw new BadRequestException('district_id must be null for verifikator')
    }
    if (role === 'pusat' && (body.district_id || body.area_id)) {
      throw new BadRequestException('pusat must not have district_id or area_id')
    }

    if (body.district_id) {
      const canAssignDistrict = await this.userService.assertActorCanAssignDistrict(actor, body.district_id)
      if (!canAssignDistrict.ok) throw new BadRequestException(canAssignDistrict.reason)
    }

    let areaId: number | null | undefined = undefined
    if (role === 'verifikator') {
      if (actor.role === 'pusat') {
        if (body.area_id) {
          const canAssignArea = await this.userService.assertActorCanAssignArea(actor, body.area_id)
          if (!canAssignArea.ok) throw new BadRequestException(canAssignArea.reason)
          areaId = body.area_id
        }
      } else {
        areaId = actor.area_id ?? null
      }
    }

    if (role === 'pic') {
      areaId = null
    }

    if (role === 'pusat') {
      areaId = null
    }

    let passwordHash: string | undefined
    if (body.password) passwordHash = await bcrypt.hash(body.password, 10)
    return this.userService.updateUser(id, {
      email: body.email,
      passwordHash,
      role,
      district_id: body.district_id ?? undefined,
      area_id: areaId,
    })
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('verifikator', 'pusat')
  @Delete(':id')
  async remove(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const actorId = req.user?.userId || req.user?.sub
    const actor = await this.userService.findById(actorId)
    if (!actor) throw new BadRequestException('User not found')

    const existing = await this.userService.findById(id)
    if (!existing) throw new BadRequestException('User not found')

    if (actor.role === 'verifikator') {
      const sameAreaVerifikator = existing.role === 'verifikator' && existing.area_id === actor.area_id
      const sameAreaPic = existing.role === 'pic' && existing.districts?.area_id === actor.area_id
      if (!sameAreaVerifikator && !sameAreaPic) {
        throw new BadRequestException('User is outside your area')
      }
      if (existing.role === 'pusat') {
        throw new BadRequestException('Not allowed to delete pusat account')
      }
    }

    return this.userService.removeUser(id)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('verifikator', 'pusat')
  @Patch(':id/profile')
  @UseInterceptors(
    FileInterceptor('ktp_scan', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dir = './uploads/ktp'
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
          cb(null, dir)
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
          const fileExtName = extname(file.originalname)
          cb(null, `ktp-${uniqueSuffix}${fileExtName}`)
        },
      }),
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
    const owner = await this.userService.findById(id)
    const isVerifikator = owner?.role === 'verifikator' || owner?.role === 'pusat'
    const missingRequired =
      !body.full_name ||
      (!isVerifikator && (!body.position || !body.phone_number || !body.nik_ktp || (isCreate && !file)))

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

  @UseGuards(JwtAuthGuard)
  @Patch('me/password')
  async updateMyPassword(@Req() req: any, @Body() body: { password: string }) {
    const userId = req.user?.userId || req.user?.sub
    if (!body.password) {
      throw new BadRequestException('Password is required')
    }
    const hash = await bcrypt.hash(body.password, 10)
    return this.userService.updateUser(userId, { passwordHash: hash })
  }
}
