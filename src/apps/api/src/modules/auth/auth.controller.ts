import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { JwtLoginResponse, SessionLoginResponse } from '@unihub/types';
import { authorizationFromRequest } from './authorization-from-request';
import { AuthService } from './auth.service';

interface LoginBody {
  email?: unknown;
  password?: unknown;
  client?: unknown;
}

interface RefreshBody {
  refreshToken?: unknown;
}

const REFRESH_COOKIE = 'unihub_refresh';
const REFRESH_MS = 30 * 24 * 60 * 60 * 1_000;
const SESSION_COOKIE = 'unihub_session';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login/jwt')
  @HttpCode(HttpStatus.OK)
  async loginJwt(
    @Body() body: LoginBody,
    @Res({ passthrough: true }) res: Response,
  ): Promise<JwtLoginResponse> {
    const { email, password } = this.requireCredentials(body);
    const client = this.requireLoginClient(body);
    const { user, accessToken, refreshToken } = await this.auth.loginJwt(
      email,
      password,
      client,
    );
    this.setRefreshCookie(res, refreshToken);
    return { user, accessToken };
  }

  @Post('login/session')
  @HttpCode(HttpStatus.OK)
  async loginSession(@Body() body: LoginBody): Promise<SessionLoginResponse> {
    const { email, password } = this.requireCredentials(body);
    const client = this.requireLoginClient(body);
    return await this.auth.loginSession(email, password, client);
  }

  @Get('me/jwt')
  @HttpCode(HttpStatus.OK)
  async meJwt(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<JwtLoginResponse> {
    const refreshToken = this.readCookie(req, REFRESH_COOKIE);
    if (!refreshToken) {
      throw new UnauthorizedException({
        code: 'unauthenticated',
        message: 'Phiên đăng nhập đã hết hạn.',
      });
    }

    const result = await this.auth.refresh(refreshToken);
    if (!result) {
      throw new UnauthorizedException({
        code: 'unauthenticated',
        message: 'Phiên đăng nhập không hợp lệ.',
      });
    }
    this.setRefreshCookie(res, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken };
  }

  @Get('me/session')
  @HttpCode(HttpStatus.OK)
  async meSession(@Req() req: Request): Promise<SessionLoginResponse> {
    const sessionId =
      this.readCookie(req, SESSION_COOKIE) ??
      (typeof req.headers.authorization === 'string'
        ? req.headers.authorization
        : '');
    const user = await this.auth.session(sessionId);

    if (!user) {
      throw new UnauthorizedException({
        code: 'unauthenticated',
        message: 'Phiên đăng nhập không hợp lệ.',
      });
    }

    return {
      user,
      sessionId,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() body: RefreshBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<JwtLoginResponse> {
    const refreshToken =
      this.readCookie(req, REFRESH_COOKIE) ??
      (typeof body?.refreshToken === 'string' ? body.refreshToken : '');

    if (!refreshToken) {
      throw new BadRequestException({
        code: 'invalid_request',
        message: 'Thiếu refresh token.',
      });
    }

    const result = await this.auth.refresh(refreshToken);
    if (!result) {
      throw new UnauthorizedException({
        code: 'unauthenticated',
        message: 'Phiên đăng nhập không hợp lệ.',
      });
    }

    this.setRefreshCookie(res, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): void {
    const authorization = authorizationFromRequest(req);

    this.auth.logout(authorization);
    this.clearAuthCookies(res);
  }

  private requireCredentials(body: LoginBody): {
    email: string;
    password: string;
  } {
    const email = typeof body?.email === 'string' ? body.email : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!email || !password) {
      throw new BadRequestException({
        code: 'invalid_request',
        message: 'Vui lòng cung cấp email và mật khẩu.',
      });
    }

    return { email, password };
  }

  private requireLoginClient(
    body: LoginBody,
  ): 'student' | 'organizer' | 'staff' {
    const client = body?.client;
    if (client === 'student' || client === 'staff' || client === 'organizer') {
      return client;
    }
    throw new BadRequestException({
      code: 'invalid_request',
      message: 'Client không hợp lệ.',
    });
  }

  private readCookie(req: Request, name: string): string | null {
    return (req.cookies as Record<string, string> | undefined)?.[name] ?? null;
  }

  private cookieBase() {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax' as const,
      path: '/',
    };
  }

  private setRefreshCookie(res: Response, refreshToken: string): void {
    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...this.cookieBase(),
      maxAge: REFRESH_MS,
    });
  }

  private clearAuthCookies(res: Response): void {
    const base = this.cookieBase();
    res.clearCookie(REFRESH_COOKIE, base);
  }
}
