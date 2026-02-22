
import { IsString, IsOptional, IsNumber } from 'class-validator'

export class CreateOpexDto {
  @IsOptional()
  @IsNumber()
  project_id?: number

  @IsOptional()
  @IsNumber()
  district_id?: number

  @IsOptional()
  @IsNumber()
  group_view_id?: number

  @IsString()
  item_name: string

  @IsOptional()
  @IsString()
  recipient_name?: string

  // manual total amount entered by PIC (mapped to DB `amount`)
  @IsNumber()
  manual_total: number

  @IsOptional()
  @IsString()
  transaction_date?: string
}

