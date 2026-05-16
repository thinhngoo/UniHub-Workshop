import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import type { LoginClient } from '@unihub/types';

const LOGIN_CLIENTS: readonly LoginClient[] = ['student', 'organizer', 'staff'];

export class AuthLoginDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  email!: string;

  @IsString()
  @MinLength(1, { message: 'Vui lòng cung cấp mật khẩu.' })
  password!: string;

  @IsIn(LOGIN_CLIENTS, { message: 'Client không hợp lệ.' })
  client!: LoginClient;
}
