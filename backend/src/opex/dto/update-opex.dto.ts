import { PartialType } from '@nestjs/mapped-types'
import { CreateOpexDto } from './create-opex.dto'
import { IsOptional, IsString } from 'class-validator'

export class UpdateOpexDto extends PartialType(CreateOpexDto) {
	@IsOptional()
	@IsString()
	status?: string
}
