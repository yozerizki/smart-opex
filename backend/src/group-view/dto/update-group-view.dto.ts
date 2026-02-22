import { IsOptional, IsString } from 'class-validator'

export class UpdateGroupViewDto {
  @IsOptional()
  @IsString()
  name?: string
}
