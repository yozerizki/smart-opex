import { IsOptional, IsString, IsNumber } from 'class-validator'

export class UpdateDistrictDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsNumber()
  area_id?: number
}
