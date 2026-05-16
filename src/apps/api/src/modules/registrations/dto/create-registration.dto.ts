import { IsUUID } from 'class-validator';

export class CreateRegistrationDto {
  @IsUUID('4', { message: 'Workshop không hợp lệ.' })
  workshopId!: string;
}
