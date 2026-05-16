import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { SUMMARY_STATUSES, WORKSHOP_STATUSES } from '../../../constant';

export class UpdateWorkshopDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  version!: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  speaker?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  room?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  roomMapUrl?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'Thời gian bắt đầu không hợp lệ.' })
  startsAt?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'Thời gian kết thúc không hợp lệ.' })
  endsAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  capacity?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? undefined : value === true || value === 'true',
  )
  @IsBoolean()
  isPaid?: boolean;

  @ValidateIf((o: UpdateWorkshopDto) => o.isPaid === true)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  price?: number;

  @IsOptional()
  @IsIn([...WORKSHOP_STATUSES])
  status?: (typeof WORKSHOP_STATUSES)[number];

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsIn([...SUMMARY_STATUSES])
  summaryStatus?: (typeof SUMMARY_STATUSES)[number];
}
