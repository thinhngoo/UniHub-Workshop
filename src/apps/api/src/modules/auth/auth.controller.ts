import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import type { LoginResponse, User } from '@unihub/types';
import { AuthService } from './auth.service';

interface LoginBody {
  email?: unknown;
  password?: unknown;
}

interface RefreshBody {
  refreshToken?: unknown;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginBody): Promise<LoginResponse> {
    const email = typeof body?.email === 'string' ? body.email : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!email || !password) {
      throw new BadRequestException({
        code: 'invalid_request',
        message: 'Vui lòng cung cấp email và mật khẩu.',
      });
    }

    return this.auth.login(email, password);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: RefreshBody): Promise<LoginResponse> {
    const refreshToken =
      typeof body?.refreshToken === 'string' ? body.refreshToken : '';
    if (!refreshToken) {
      throw new BadRequestException({
        code: 'invalid_request',
        message: 'Thiếu refresh token.',
      });
    }
    return this.auth.refresh(refreshToken);
  }

  @Get('me')
  async me(@Headers('authorization') authorization?: string): Promise<User> {
    return this.auth.me(authorization);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Headers('authorization') authorization?: string): void {
    this.auth.logout(authorization);
  }
}
