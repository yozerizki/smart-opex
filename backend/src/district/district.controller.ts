import { Body, Controller, Get, Post, Put, Param, ParseIntPipe, UseGuards, BadRequestException, Delete } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth-guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'
import { DistrictService } from './district.service'
import { CreateDistrictDto } from './dto/create-district.dto'
import { UpdateDistrictDto } from './dto/update-district.dto'

@Controller('districts')
export class DistrictController {
  constructor(private service: DistrictService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('verifikator')
  @Get()
  findAll() {
    return this.service.findAll()
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('verifikator')
  @Post()
  async create(@Body() body: CreateDistrictDto) {
    if (!body.name || !body.name.trim()) throw new BadRequestException('name is required')
    return this.service.create(body.name.trim())
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('verifikator')
  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateDistrictDto) {
    if (!body.name || !body.name.trim()) throw new BadRequestException('name is required')
    return this.service.update(id, body.name.trim())
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('verifikator')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id)
  }
}
