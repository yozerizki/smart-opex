import { IsOptional, IsString } from 'class-validator'

export class UpdateUserProfileDto {
  @IsOptional()
  @IsString()
  full_name?: string

  @IsOptional()
  @IsString()
  position?: string

  @IsOptional()
  @IsString()
  nip?: string

  @IsOptional()
  @IsString()
  phone_number?: string

  @IsOptional()
  @IsString()
  nik_ktp?: string
}
