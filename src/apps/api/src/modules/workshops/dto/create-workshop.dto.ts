import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateWorkshopDto {
  @IsString()
  @MinLength(1, { message: 'Tiêu đề không được để trống.' })
  title!: string;

  @IsString()
  @MinLength(1, { message: 'Diễn giả không được để trống.' })
  speaker!: string;

  @IsString()
  @MinLength(1, { message: 'Phòng không được để trống.' })
  room!: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'URL sơ đồ phòng không hợp lệ.' })
  roomMapUrl?: string;

  @IsISO8601({}, { message: 'Thời gian bắt đầu không hợp lệ.' })
  startsAt!: string;

  @IsISO8601({}, { message: 'Thời gian kết thúc không hợp lệ.' })
  endsAt!: string;

  @IsInt()
  @Min(1, { message: 'Sức chứa phải ít nhất 1.' })
  @Type(() => Number)
  capacity!: number;

  @Transform(
    ({ value }: { value: unknown }) => value === true || value === 'true',
  )
  @IsBoolean()
  isPaid!: boolean;

  @ValidateIf((o: CreateWorkshopDto) => o.isPaid === true)
  @IsInt()
  @Min(0, { message: 'Giá không được âm.' })
  @Type(() => Number)
  price?: number;
}
