import { IsString, IsOptional, IsNumber } from 'class-validator'

export class CreateDistrictDto {
  @IsString()
  name: string

  @IsOptional()
  @IsNumber()
  area_id?: number
}
