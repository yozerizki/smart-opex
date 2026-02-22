import { IsString } from 'class-validator'

export class CreateGroupViewDto {
  @IsString()
  name: string
}
