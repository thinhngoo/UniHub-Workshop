import { IsOptional, IsUrl, IsUUID, MaxLength } from 'class-validator';

export class InitiatePaymentDto {
  @IsUUID('4', { message: 'Đăng ký không hợp lệ.' })
  registrationId!: string;

  @IsOptional()
  @MaxLength(2048)
  @IsUrl({ require_tld: false })
  returnUrl?: string;
}
