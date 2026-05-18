import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SummarizeTextDto {
  @IsString()
  @IsNotEmpty({ message: 'Thiếu hoặc rỗng trường text.' })
  @MaxLength(100_000, { message: 'text quá dài (tối đa 100.000 ký tự).' })
  text!: string;
}
