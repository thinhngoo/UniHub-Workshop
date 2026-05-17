import { IsUUID } from 'class-validator';

export class InitiatePaymentDto {
  @IsUUID('4', { message: 'Đăng ký không hợp lệ.' })
  registrationId!: string;
}
