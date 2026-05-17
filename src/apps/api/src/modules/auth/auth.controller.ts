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
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { JwtLoginResponse, SessionLoginResponse } from '@unihub/types';
import {
  REFRESH_COOKIE,
  REFRESH_COOKIE_MAX_AGE_SEC,
  SESSION_COOKIE,
  SESSION_TTL_SEC,
} from '../../constant';
import {
  THROTTLE_AUTH_LOGIN,
  THROTTLE_AUTH_REFRESH,
} from '../../throttle-presets';
import { AuthService } from './auth.service';
import { extractSessionId } from './extract-auth-data';
import { AuthLoginDto } from './dto/auth-login.dto';
import { AuthRefreshDto } from './dto/auth-refresh.dto';

const authBodyValidationPipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
  exceptionFactory: (errors: unknown) => {
    const messages = (
      errors as { constraints?: Record<string, string> }[]
    ).flatMap((e) => (e.constraints ? Object.values(e.constraints) : []));
    return new BadRequestException({
      code: 'invalid_request',
      message: messages[0] ?? 'Yêu cầu không hợp lệ.',
    });
  },
});

@Controller('auth')
@UsePipes(authBodyValidationPipe)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login/jwt')
  @HttpCode(HttpStatus.OK)
  async loginJwt(
    @Body() body: AuthLoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<JwtLoginResponse> {
    const { user, accessToken, refreshToken } = await this.auth.jwtLogin(
      body.email,
      body.password,
      body.client,
    );
    this.setRefreshCookie(res, refreshToken);
    return { user, accessToken };
  }

  @Post('login/session')
  @Throttle(THROTTLE_AUTH_LOGIN)
  @HttpCode(HttpStatus.OK)
  async loginSession(
    @Body() body: AuthLoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionLoginResponse> {
    const { user, sessionId } = await this.auth.sessionLogin(
      body.email,
      body.password,
      body.client,
    );
    this.setSessionCookie(res, sessionId);
    return { user, sessionId };
  }

  @Get('me/jwt')
  @Throttle(THROTTLE_AUTH_REFRESH)
  @HttpCode(HttpStatus.OK)
  async meJwt(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<JwtLoginResponse> {
    const refreshToken = this.readCookie(req, REFRESH_COOKIE);

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
    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Get('me/session')
  @HttpCode(HttpStatus.OK)
  async meSession(@Req() req: Request): Promise<SessionLoginResponse> {
    const sessionId = extractSessionId(req) ?? '';

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
  @Throttle(THROTTLE_AUTH_REFRESH)
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() body: AuthRefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<JwtLoginResponse> {
    const refreshToken =
      this.readCookie(req, REFRESH_COOKIE) ?? body.refreshToken ?? '';

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
    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const sessionId = this.readCookie(req, SESSION_COOKIE);
    await this.auth.logout(sessionId);
    this.clearAuthCookies(res);
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
      maxAge: REFRESH_COOKIE_MAX_AGE_SEC,
    });
  }

  private setSessionCookie(res: Response, sessionId: string): void {
    res.cookie(SESSION_COOKIE, sessionId, {
      ...this.cookieBase(),
      maxAge: SESSION_TTL_SEC * 1_000,
    });
  }

  private clearAuthCookies(res: Response): void {
    const base = this.cookieBase();
    res.clearCookie(REFRESH_COOKIE, base);
    res.clearCookie(SESSION_COOKIE, base);
  }
}
