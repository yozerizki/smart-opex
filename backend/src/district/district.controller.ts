import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Param,
  ParseIntPipe,
  UseGuards,
  BadRequestException,
  Delete,
  Req,
  Query,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth-guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'
import { DistrictService } from './district.service'
import { CreateDistrictDto } from './dto/create-district.dto'
import { UpdateDistrictDto } from './dto/update-district.dto'
import { UserService } from '../user/user.service'

@Controller('districts')
export class DistrictController {
  constructor(
    private service: DistrictService,
    private userService: UserService,
  ) {}

  private async getActor(req: any) {
    const actorId = req.user?.userId || req.user?.sub
    const actor = await this.userService.findById(actorId)
    if (!actor) throw new BadRequestException('User not found')
    return actor
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('verifikator', 'pusat')
  @Get('regions')
  async findRegions(@Req() req: any) {
    const actor = await this.getActor(req)
    return this.service.findRegions(actor)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('pusat')
  @Post('regions')
  async createRegion(@Body() body: { name?: string }) {
    if (!body.name || !body.name.trim()) throw new BadRequestException('name is required')
    return this.service.createRegion(body.name.trim())
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('pusat')
  @Put('regions/:id')
  async updateRegion(@Param('id', ParseIntPipe) id: number, @Body() body: { name?: string }) {
    if (!body.name || !body.name.trim()) throw new BadRequestException('name is required')
    return this.service.updateRegion(id, body.name.trim())
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('pusat')
  @Delete('regions/:id')
  removeRegion(@Param('id', ParseIntPipe) id: number) {
    return this.service.removeRegion(id)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('verifikator', 'pusat')
  @Get('areas')
  async findAreas(@Req() req: any, @Query('region_id') regionId?: string) {
    const actor = await this.getActor(req)
    const parsedRegionId = regionId ? Number(regionId) : undefined
    if (regionId && Number.isNaN(parsedRegionId)) {
      throw new BadRequestException('Invalid region_id')
    }
    return this.service.findAreas(actor, parsedRegionId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('pusat')
  @Post('areas')
  async createArea(@Body() body: { region_id?: number; name?: string }) {
    if (!body.region_id) throw new BadRequestException('region_id is required')
    if (!body.name || !body.name.trim()) throw new BadRequestException('name is required')
    const region = await this.service.findRegionById(body.region_id)
    if (!region) throw new BadRequestException('Invalid region_id')
    return this.service.createArea(body.region_id, body.name.trim())
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('pusat')
  @Put('areas/:id')
  async updateArea(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { region_id?: number; name?: string },
  ) {
    if (body.region_id) {
      const region = await this.service.findRegionById(body.region_id)
      if (!region) throw new BadRequestException('Invalid region_id')
    }
    if (body.name !== undefined && !body.name.trim()) {
      throw new BadRequestException('name is required')
    }
    return this.service.updateArea(id, {
      region_id: body.region_id,
      name: body.name?.trim(),
    })
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('pusat')
  @Delete('areas/:id')
  removeArea(@Param('id', ParseIntPipe) id: number) {
    return this.service.removeArea(id)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('verifikator', 'pusat', 'pic')
  @Get()
  async findAll(
    @Req() req: any,
    @Query('region_id') regionId?: string,
    @Query('area_id') areaId?: string,
  ) {
    const actor = await this.getActor(req)
    const parsedRegionId = regionId ? Number(regionId) : undefined
    const parsedAreaId = areaId ? Number(areaId) : undefined

    if (regionId && Number.isNaN(parsedRegionId)) throw new BadRequestException('Invalid region_id')
    if (areaId && Number.isNaN(parsedAreaId)) throw new BadRequestException('Invalid area_id')

    return this.service.findAll(actor, {
      region_id: parsedRegionId,
      area_id: parsedAreaId,
    })
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('pusat')
  @Post()
  async create(@Req() req: any, @Body() body: CreateDistrictDto & { area_id?: number }) {
    const actor = await this.getActor(req)
    if (!body.name || !body.name.trim()) throw new BadRequestException('name is required')

    if (!body.area_id) {
      throw new BadRequestException('area_id is required')
    }

    const targetAreaId = body.area_id
    const area = await this.service.findAreaById(Number(targetAreaId))
    if (!area) throw new BadRequestException('Invalid area_id')

    return this.service.createDistrict(actor, body.name.trim(), Number(targetAreaId))
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('pusat')
  @Put(':id')
  async update(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateDistrictDto & { area_id?: number },
  ) {
    const actor = await this.getActor(req)
    const district = await this.service.findDistrictById(id)
    if (!district) throw new BadRequestException('District not found')

    if (!body.name || !body.name.trim()) throw new BadRequestException('name is required')

    if (body.area_id) {
      const area = await this.service.findAreaById(body.area_id)
      if (!area) throw new BadRequestException('Invalid area_id')
    }

    return this.service.updateDistrict(id, {
      name: body.name.trim(),
      area_id: body.area_id,
    })
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('pusat')
  @Delete(':id')
  async remove(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const actor = await this.getActor(req)
    const district = await this.service.findDistrictById(id)
    if (!district) throw new BadRequestException('District not found')

    return this.service.removeDistrict(id)
  }
}
