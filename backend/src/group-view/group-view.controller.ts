import { Body, Controller, Get, Post, Put, Param, ParseIntPipe, UseGuards, BadRequestException, Delete } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth-guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'
import { GroupViewService } from './group-view.service'
import { CreateGroupViewDto } from './dto/create-group-view.dto'
import { UpdateGroupViewDto } from './dto/update-group-view.dto'

@Controller('group-views')
export class GroupViewController {
  constructor(private service: GroupViewService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.service.findAll()
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('verifikator')
  @Post()
  async create(@Body() body: CreateGroupViewDto) {
    if (!body.name || !body.name.trim()) throw new BadRequestException('name is required')
    return this.service.create(body.name.trim())
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('verifikator')
  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateGroupViewDto) {
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
