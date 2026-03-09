import { IsEmail, IsString, IsOptional, IsNumber } from 'class-validator'

export class CreateUserDto {
  @IsEmail()
  email: string

  @IsString()
  password: string

  @IsString()
  role: string

  @IsOptional()
  @IsNumber()
  district_id?: number

  @IsOptional()
  @IsNumber()
  area_id?: number

  @IsOptional()
  @IsNumber()
  region_id?: number

  @IsOptional()
  @IsString()
  phone_number?: string
}
