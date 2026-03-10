import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  ParseIntPipe,
  Req,
  ForbiddenException,
  BadRequestException,
  Query,
} from '@nestjs/common'
import { FileFieldsInterceptor, FilesInterceptor } from '@nestjs/platform-express'
import { UploadedFiles, UseInterceptors } from '@nestjs/common'
import { diskStorage } from 'multer'
import { extname } from 'path'
import { OpexService } from './opex.service'
import { CreateOpexDto } from './dto/create-opex.dto'
import { UpdateOpexDto } from './dto/update-opex.dto'
import { JwtAuthGuard } from '../auth/jwt-auth-guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'
import { Res } from '@nestjs/common'
import type { Response } from 'express'
import { UserService } from '../user/user.service'
import * as fs from 'fs'
import { GroupViewService } from '../group-view/group-view.service'

@Controller('opex')
export class OpexController {
  constructor(
    private service: OpexService,
    private userService: UserService,
    private groupViewService: GroupViewService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(
    @Req() req: any,
    @Query('region_id') regionId?: string,
    @Query('area_id') areaId?: string,
    @Query('district_id') districtId?: string,
  ) {
    const userId = req.user?.userId || req.user?.sub
    const user = await this.userService.findById(userId)
    if (!user) throw new ForbiddenException('User not found')

    if (user.role === 'pic') {
      if (!user.district_id) throw new ForbiddenException('PIC must have district')
      return this.service.findAllByDistrict(user.district_id)
    }

    const parsedRegionId = regionId ? Number(regionId) : undefined
    const parsedAreaId = areaId ? Number(areaId) : undefined
    const parsedDistrictId = districtId ? Number(districtId) : undefined

    if (regionId && Number.isNaN(parsedRegionId)) {
      throw new BadRequestException('Invalid region_id')
    }
    if (areaId && Number.isNaN(parsedAreaId)) {
      throw new BadRequestException('Invalid area_id')
    }
    if (districtId && Number.isNaN(parsedDistrictId)) {
      throw new BadRequestException('Invalid district_id')
    }

    if (user.role === 'verifikator') {
      if (!user.area_id) {
        throw new ForbiddenException('Verifikator must have area')
      }
      return this.service.findAllWithFilters({
        area_id: user.area_id,
        district_id: parsedDistrictId,
      })
    }

    return this.service.findAllWithFilters({
      region_id: parsedRegionId,
      area_id: parsedAreaId,
      district_id: parsedDistrictId,
    })
  }

  @UseGuards(JwtAuthGuard)
  @Get('export')
  async export(
    @Req() req: any,
    @Res() res: Response,
    @Query('region_id') regionId?: string,
    @Query('area_id') areaId?: string,
    @Query('district_id') districtId?: string,
  ) {
    const userId = req.user?.userId || req.user?.sub

    const filters: any = {}
    if (regionId) filters.region_id = Number(regionId)
    if (areaId) filters.area_id = Number(areaId)
    if (districtId) filters.district_id = Number(districtId)

    const result = await this.service.exportForUser(userId, filters)
    res.setHeader('Content-Type', result.contentType || 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`)
    res.send(result.buffer)
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const userId = req.user?.userId || req.user?.sub
    const user = await this.userService.findById(userId)
    if (!user) throw new ForbiddenException('User not found')

    const activity = await this.service.findOne(id)
    if (!activity) throw new ForbiddenException('Activity not found')

    if (user.role === 'pic' && user.district_id !== activity.district_id) {
      throw new ForbiddenException('Not allowed to view this activity')
    }
    if (user.role === 'verifikator' && activity.districts?.area_id !== user.area_id) {
      throw new ForbiddenException('Not allowed to view this activity')
    }

    return activity
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/review')
  async review(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const userId = req.user?.userId || req.user?.sub
    const user = await this.userService.findById(userId)
    const activity = await this.service.findOne(id)
    if (!activity) throw new ForbiddenException('Activity not found')
    if (!user) throw new ForbiddenException('User not found')
    if (user.role === 'pic' && user.district_id !== activity.district_id) {
      throw new ForbiddenException('Not allowed to view this activity')
    }
    if (user.role === 'verifikator' && activity.districts?.area_id !== user.area_id) {
      throw new ForbiddenException('Not allowed to view this activity')
    }

    return this.service.getReview(id)
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'receipts', maxCount: 10 },
        { name: 'activity_documents', maxCount: 10 },
        { name: 'supporting_documents', maxCount: 10 },
        { name: 'documents', maxCount: 10 },
      ],
      {
        storage: diskStorage({
          destination: (req, file, cb) => {
            let dir = './uploads/receipts'
            if (file.fieldname === 'activity_documents') dir = './uploads/documents/activity'
            if (file.fieldname === 'supporting_documents') dir = './uploads/documents/supporting'
            if (file.fieldname === 'documents') dir = './uploads/documents'
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
            cb(null, dir)
          },
          filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
            const fileExtName = extname(file.originalname)
            cb(null, `${file.fieldname}-${uniqueSuffix}${fileExtName}`)
          },
        }),
        limits: { fileSize: 10 * 1024 * 1024 },
      },
    ),
  )
  async create(
    @Req() req: any,
    @Body() body: CreateOpexDto,
    @UploadedFiles()
    files: {
      receipts?: Express.Multer.File[]
      activity_documents?: Express.Multer.File[]
      supporting_documents?: Express.Multer.File[]
      documents?: Express.Multer.File[]
    },
  ) {
    const userId = req.user?.userId || req.user?.sub
    const user = await this.userService.findById(userId)
    if (!user) throw new ForbiddenException('User not found')

    const receiptFiles = files?.receipts || []
    const activityDocumentFiles = files?.activity_documents || []
    const supportingDocumentFiles = files?.supporting_documents || []
    if (receiptFiles.length === 0) throw new BadRequestException('At least 1 receipt is required')
    if (receiptFiles.length > 10) throw new BadRequestException('Maximum receipts is 10')
    if (activityDocumentFiles.length === 0) {
      throw new BadRequestException('At least 1 activity documentation file is required')
    }
    if (supportingDocumentFiles.length === 0) {
      throw new BadRequestException('At least 1 supporting documentation file is required')
    }

    const invalidActivityDoc = activityDocumentFiles.find(
      (file) => !(file.mimetype?.startsWith('image/') || file.mimetype === 'application/pdf'),
    )
    if (invalidActivityDoc) {
      throw new BadRequestException('Activity documentation must be image/pdf')
    }
    const invalidSupportingDoc = supportingDocumentFiles.find(
      (file) => !(file.mimetype?.startsWith('image/') || file.mimetype === 'application/pdf'),
    )
    if (invalidSupportingDoc) {
      throw new BadRequestException('Supporting documentation must be image/pdf')
    }

    if ((body as any).group_view_id === undefined || (body as any).group_view_id === null) {
      throw new BadRequestException('group_view_id is required')
    }
    const groupViewId = Number((body as any).group_view_id)
    if (Number.isNaN(groupViewId)) throw new BadRequestException('Invalid group_view_id')
    const groupView = await this.groupViewService.findById(groupViewId)
    if (!groupView) throw new BadRequestException('Invalid group_view_id')

    const data: any = { ...body, created_by: userId }

    if (user.role === 'pic') {
      if (!user.district_id) throw new ForbiddenException('PIC must have district')
      if ((body as any).district_id && (body as any).district_id !== user.district_id) {
        throw new ForbiddenException('Not allowed to override district')
      }
      data.district_id = user.district_id
    } else if (user.role === 'verifikator') {
      if ((body as any).district_id === undefined || (body as any).district_id === null) {
        throw new BadRequestException('district_id is required')
      }
      const districtId = Number((body as any).district_id)
      const district = await this.userService.findDistrictById(districtId)
      if (!district) throw new BadRequestException('Invalid district_id')
      if (!user.area_id || district.area_id !== user.area_id) {
        throw new ForbiddenException('District is outside your area')
      }
      data.district_id = districtId
    } else {
      if ((body as any).district_id === undefined || (body as any).district_id === null) {
        throw new BadRequestException('district_id is required')
      }
      const districtId = Number((body as any).district_id)
      const district = await this.userService.findDistrictById(districtId)
      if (!district) throw new BadRequestException('Invalid district_id')
      data.district_id = districtId
    }

    data.group_view_id = groupViewId

    const created = await this.service.create(data)
    await this.service.addReceipts(created.id, receiptFiles)
    await this.service.addDocuments(created.id, activityDocumentFiles)
    await this.service.addDocuments(created.id, supportingDocumentFiles)
    return this.service.findOne(created.id)
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() body: UpdateOpexDto) {
    const userId = req.user?.userId || req.user?.sub
    const user = await this.userService.findById(userId)
    const activity = await this.service.findOne(id)
    if (!activity) throw new ForbiddenException('Activity not found')
    if (!user) throw new ForbiddenException('User not found')

    if (user.role === 'pic') {
      if (user.district_id !== activity.district_id) {
        throw new ForbiddenException('Not allowed to update this activity')
      }
      if ((body as any).district_id !== undefined) {
        throw new ForbiddenException('Not allowed to modify district')
      }
    } else if (user.role === 'verifikator' && (body as any).district_id !== undefined) {
      const districtId = Number((body as any).district_id)
      const district = await this.userService.findDistrictById(districtId)
      if (!district) throw new BadRequestException('Invalid district_id')
      if (!user.area_id || district.area_id !== user.area_id) {
        throw new ForbiddenException('District is outside your area')
      }
    } else if (user.role === 'verifikator' && activity.districts?.area_id !== user.area_id) {
      throw new ForbiddenException('Not allowed to update this activity')
    } else if ((body as any).district_id !== undefined) {
      const districtId = Number((body as any).district_id)
      const district = await this.userService.findDistrictById(districtId)
      if (!district) throw new BadRequestException('Invalid district_id')
    }

    if ((body as any).group_view_id !== undefined) {
      const groupViewId = Number((body as any).group_view_id)
      if (Number.isNaN(groupViewId)) throw new BadRequestException('Invalid group_view_id')
      const groupView = await this.groupViewService.findById(groupViewId)
      if (!groupView) throw new BadRequestException('Invalid group_view_id')
    }

    return this.service.update(id, body)
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const userId = req.user?.userId || req.user?.sub
    const user = await this.userService.findById(userId)
    const activity = await this.service.findOne(id)
    if (!activity) throw new ForbiddenException('Activity not found')
    if (!user) throw new ForbiddenException('User not found')
    if (user.role === 'pic' && user.district_id !== activity.district_id) {
      throw new ForbiddenException('Not allowed to delete this activity')
    }
    if (user.role === 'verifikator' && activity.districts?.area_id !== user.area_id) {
      throw new ForbiddenException('Not allowed to delete this activity')
    }
    return this.service.remove(id)
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/receipts')
  @UseInterceptors(
    FilesInterceptor('receipts', 10, {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dir = './uploads/receipts'
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
          cb(null, dir)
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
          const fileExtName = extname(file.originalname)
          cb(null, `${file.fieldname}-${uniqueSuffix}${fileExtName}`)
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async addReceipts(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const userId = req.user?.userId || req.user?.sub
    const user = await this.userService.findById(userId)
    const activity = await this.service.findOne(id)
    if (!activity) throw new ForbiddenException('Activity not found')
    if (!user) throw new ForbiddenException('User not found')
    if (user.role === 'pic' && user.district_id !== activity.district_id) {
      throw new ForbiddenException('Not allowed to add receipts to this activity')
    }
    if (user.role === 'verifikator' && activity.districts?.area_id !== user.area_id) {
      throw new ForbiddenException('Not allowed to add receipts to this activity')
    }

    if (!files || files.length === 0) throw new BadRequestException('At least 1 receipt is required')
    const existingCount = await this.service.countReceipts(id)
    if (existingCount + files.length > 10) throw new BadRequestException('Maximum receipts is 10')

    await this.service.addReceipts(id, files)
    return this.service.findOne(id)
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/documents')
  @UseInterceptors(
    FilesInterceptor('documents', 10, {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dir = './uploads/documents'
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
          cb(null, dir)
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
          const fileExtName = extname(file.originalname)
          cb(null, `${file.fieldname}-${uniqueSuffix}${fileExtName}`)
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async addDocuments(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const userId = req.user?.userId || req.user?.sub
    const user = await this.userService.findById(userId)
    const activity = await this.service.findOne(id)
    if (!activity) throw new ForbiddenException('Activity not found')
    if (!user) throw new ForbiddenException('User not found')
    if (user.role === 'pic' && user.district_id !== activity.district_id) {
      throw new ForbiddenException('Not allowed to add documents to this activity')
    }
    if (user.role === 'verifikator' && activity.districts?.area_id !== user.area_id) {
      throw new ForbiddenException('Not allowed to add documents to this activity')
    }

    if (!files || files.length === 0) throw new BadRequestException('At least 1 document is required')

    await this.service.addDocuments(id, files)
    return this.service.findOne(id)
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/receipts/:receiptId')
  async removeReceipt(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Param('receiptId', ParseIntPipe) receiptId: number,
  ) {
    const userId = req.user?.userId || req.user?.sub
    const user = await this.userService.findById(userId)
    const activity = await this.service.findOne(id)
    if (!activity) throw new ForbiddenException('Activity not found')
    if (!user) throw new ForbiddenException('User not found')
    if (user.role === 'pic' && user.district_id !== activity.district_id) {
      throw new ForbiddenException('Not allowed to remove receipts from this activity')
    }
    if (user.role === 'verifikator' && activity.districts?.area_id !== user.area_id) {
      throw new ForbiddenException('Not allowed to remove receipts from this activity')
    }

    const count = await this.service.countReceipts(id)
    if (count <= 1) throw new BadRequestException('At least 1 receipt is required')

    const deleted = await this.service.deleteReceipt(id, receiptId)
    if (!deleted) throw new BadRequestException('Receipt not found')
    await this.service.recomputeOcrStatus(id)
    return this.service.findOne(id)
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/documents/:documentId')
  async removeDocument(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Param('documentId', ParseIntPipe) documentId: number,
  ) {
    const userId = req.user?.userId || req.user?.sub
    const user = await this.userService.findById(userId)
    const activity = await this.service.findOne(id)
    if (!activity) throw new ForbiddenException('Activity not found')
    if (!user) throw new ForbiddenException('User not found')
    if (user.role === 'pic' && user.district_id !== activity.district_id) {
      throw new ForbiddenException('Not allowed to remove documents from this activity')
    }
    if (user.role === 'verifikator' && activity.districts?.area_id !== user.area_id) {
      throw new ForbiddenException('Not allowed to remove documents from this activity')
    }

    const deleted = await this.service.deleteDocument(id, documentId)
    if (!deleted) throw new BadRequestException('Document not found')
    return this.service.findOne(id)
  }
}
