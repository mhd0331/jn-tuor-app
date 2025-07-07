// =============================================
// 진안군 장터 앱 - 카카오 로그인 통합 백엔드
// =============================================

// src/config/kakao.config.ts
export const kakaoConfig = {
  clientId: process.env.KAKAO_CLIENT_ID!,
  clientSecret: process.env.KAKAO_CLIENT_SECRET!,
  redirectUri: process.env.KAKAO_REDIRECT_URI!,
  adminKey: process.env.KAKAO_ADMIN_KEY!,
  authUrl: 'https://kauth.kakao.com',
  apiUrl: 'https://kapi.kakao.com',
};

// src/types/auth.types.ts
export interface KakaoTokenResponse {
  token_type: string;
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_token_expires_in: number;
  scope?: string;
}

export interface KakaoUserInfo {
  id: number;
  connected_at: string;
  properties: {
    nickname?: string;
    profile_image?: string;
    thumbnail_image?: string;
  };
  kakao_account?: {
    profile_nickname_needs_agreement?: boolean;
    profile_image_needs_agreement?: boolean;
    profile?: {
      nickname?: string;
      thumbnail_image_url?: string;
      profile_image_url?: string;
      is_default_image?: boolean;
    };
    has_email?: boolean;
    email_needs_agreement?: boolean;
    is_email_valid?: boolean;
    is_email_verified?: boolean;
    email?: string;
    has_phone_number?: boolean;
    phone_number_needs_agreement?: boolean;
    phone_number?: string;
  };
}

export interface JWTPayload {
  userId: string;
  kakaoId: string;
  email?: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// src/services/kakao.service.ts
import axios from 'axios';
import { kakaoConfig } from '../config/kakao.config';
import { KakaoTokenResponse, KakaoUserInfo } from '../types/auth.types';
import { AppError } from '../utils/appError';
import { logger } from '../utils/logger';

export class KakaoService {
  // 인가 코드로 액세스 토큰 받기
  async getAccessToken(code: string): Promise<KakaoTokenResponse> {
    try {
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: kakaoConfig.clientId,
        client_secret: kakaoConfig.clientSecret,
        redirect_uri: kakaoConfig.redirectUri,
        code,
      });

      const response = await axios.post(
        `${kakaoConfig.authUrl}/oauth/token`,
        params,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      logger.error('Kakao token error:', error.response?.data || error.message);
      throw new AppError('카카오 인증에 실패했습니다.', 401);
    }
  }

  // 리프레시 토큰으로 액세스 토큰 갱신
  async refreshAccessToken(refreshToken: string): Promise<KakaoTokenResponse> {
    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: kakaoConfig.clientId,
        client_secret: kakaoConfig.clientSecret,
        refresh_token: refreshToken,
      });

      const response = await axios.post(
        `${kakaoConfig.authUrl}/oauth/token`,
        params,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      logger.error('Kakao refresh token error:', error.response?.data || error.message);
      throw new AppError('토큰 갱신에 실패했습니다.', 401);
    }
  }

  // 사용자 정보 가져오기
  async getUserInfo(accessToken: string): Promise<KakaoUserInfo> {
    try {
      const response = await axios.get(`${kakaoConfig.apiUrl}/v2/user/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error: any) {
      logger.error('Kakao user info error:', error.response?.data || error.message);
      throw new AppError('사용자 정보를 가져올 수 없습니다.', 401);
    }
  }

  // 카카오 연결 끊기 (회원 탈퇴 시)
  async unlinkUser(kakaoId: string): Promise<void> {
    try {
      await axios.post(
        `${kakaoConfig.apiUrl}/v1/user/unlink`,
        new URLSearchParams({
          target_id_type: 'user_id',
          target_id: kakaoId.toString(),
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `KakaoAK ${kakaoConfig.adminKey}`,
          },
        }
      );
    } catch (error: any) {
      logger.error('Kakao unlink error:', error.response?.data || error.message);
      // 연결 끊기 실패해도 앱 탈퇴는 진행
    }
  }

  // 토큰 유효성 검사
  async verifyToken(accessToken: string): Promise<boolean> {
    try {
      await axios.get(`${kakaoConfig.apiUrl}/v1/user/access_token_info`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}

// src/services/auth.service.ts
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { Database } from '../database';
import { KakaoService } from './kakao.service';
import { RedisService } from './redis.service';
import { KakaoUserInfo, AuthTokens, JWTPayload } from '../types/auth.types';
import { AppError } from '../utils/appError';
import { logger } from '../utils/logger';
import { config } from '../config';

export class AuthService {
  private db = Database.getConnection();
  private kakaoService = new KakaoService();
  private redisService = new RedisService();

  // 카카오 로그인/회원가입 처리
  async handleKakaoLogin(code: string): Promise<{
    user: any;
    tokens: AuthTokens;
    isNewUser: boolean;
  }> {
    // 1. 카카오 액세스 토큰 받기
    const kakaoTokens = await this.kakaoService.getAccessToken(code);

    // 2. 카카오 사용자 정보 가져오기
    const kakaoUserInfo = await this.kakaoService.getUserInfo(
      kakaoTokens.access_token
    );

    // 3. 사용자 찾기 또는 생성
    const { user, isNewUser } = await this.findOrCreateUser(
      kakaoUserInfo,
      kakaoTokens
    );

    // 4. JWT 토큰 생성
    const tokens = await this.generateTokens(user);

    // 5. 마지막 로그인 시간 업데이트
    await this.updateLastLogin(user.id);

    return { user, tokens, isNewUser };
  }

  // 사용자 찾기 또는 생성
  private async findOrCreateUser(
    kakaoUserInfo: KakaoUserInfo,
    kakaoTokens: any
  ): Promise<{ user: any; isNewUser: boolean }> {
    // 기존 사용자 찾기
    let user = await this.db('users')
      .where('kakao_id', kakaoUserInfo.id.toString())
      .first();

    if (user) {
      // 카카오 토큰 업데이트
      await this.updateKakaoTokens(user.id, kakaoTokens);
      return { user, isNewUser: false };
    }

    // 새 사용자 생성
    const newUser = {
      id: uuidv4(),
      kakao_id: kakaoUserInfo.id.toString(),
      username: kakaoUserInfo.properties.nickname || `사용자${Date.now()}`,
      email: kakaoUserInfo.kakao_account?.email || null,
      phone_number: kakaoUserInfo.kakao_account?.phone_number || null,
      profile_image_url: kakaoUserInfo.properties.profile_image || null,
      role: 'user',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await this.db('users').insert(newUser);

    // 카카오 토큰 저장
    await this.saveKakaoTokens(newUser.id, kakaoTokens);

    return { user: newUser, isNewUser: true };
  }

  // JWT 토큰 생성
  private async generateTokens(user: any): Promise<AuthTokens> {
    const payload: JWTPayload = {
      userId: user.id,
      kakaoId: user.kakao_id,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn,
    });

    // 리프레시 토큰 Redis에 저장
    await this.redisService.set(
      `refresh_token:${user.id}`,
      refreshToken,
      30 * 24 * 60 * 60 // 30일
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 7 * 24 * 60 * 60, // 7일 (초 단위)
    };
  }

  // 토큰 갱신
  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    try {
      // 리프레시 토큰 검증
      const decoded = jwt.verify(
        refreshToken,
        config.jwt.refreshSecret
      ) as JWTPayload;

      // Redis에서 토큰 확인
      const storedToken = await this.redisService.get(
        `refresh_token:${decoded.userId}`
      );

      if (!storedToken || storedToken !== refreshToken) {
        throw new AppError('유효하지 않은 리프레시 토큰입니다.', 401);
      }

      // 사용자 정보 조회
      const user = await this.db('users')
        .where('id', decoded.userId)
        .first();

      if (!user || !user.is_active) {
        throw new AppError('사용자를 찾을 수 없습니다.', 404);
      }

      // 카카오 토큰도 갱신 (필요한 경우)
      await this.refreshKakaoTokenIfNeeded(user.id);

      // 새 토큰 생성
      return await this.generateTokens(user);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError('리프레시 토큰이 만료되었습니다.', 401);
      }
      throw error;
    }
  }

  // 로그아웃
  async logout(userId: string): Promise<void> {
    // Redis에서 리프레시 토큰 삭제
    await this.redisService.del(`refresh_token:${userId}`);
    
    // 카카오 토큰 무효화
    await this.redisService.del(`kakao_tokens:${userId}`);
  }

  // 회원 탈퇴
  async deleteAccount(userId: string): Promise<void> {
    const user = await this.db('users').where('id', userId).first();
    
    if (!user) {
      throw new AppError('사용자를 찾을 수 없습니다.', 404);
    }

    // 카카오 연결 끊기
    if (user.kakao_id) {
      await this.kakaoService.unlinkUser(user.kakao_id);
    }

    // 사용자 비활성화 (soft delete)
    await this.db('users')
      .where('id', userId)
      .update({
        is_active: false,
        deleted_at: new Date(),
      });

    // 토큰 삭제
    await this.logout(userId);
  }

  // 카카오 토큰 저장
  private async saveKakaoTokens(userId: string, tokens: any): Promise<void> {
    const tokenData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000),
      refresh_expires_at: new Date(
        Date.now() + tokens.refresh_token_expires_in * 1000
      ),
    };

    await this.redisService.set(
      `kakao_tokens:${userId}`,
      JSON.stringify(tokenData),
      tokens.expires_in
    );
  }

  // 카카오 토큰 업데이트
  private async updateKakaoTokens(userId: string, tokens: any): Promise<void> {
    await this.saveKakaoTokens(userId, tokens);
  }

  // 카카오 토큰 갱신 (필요시)
  private async refreshKakaoTokenIfNeeded(userId: string): Promise<void> {
    const tokenData = await this.redisService.get(`kakao_tokens:${userId}`);
    
    if (!tokenData) return;

    const tokens = JSON.parse(tokenData);
    const expiresAt = new Date(tokens.expires_at);
    
    // 만료 1시간 전에 갱신
    if (expiresAt.getTime() - Date.now() < 60 * 60 * 1000) {
      try {
        const newTokens = await this.kakaoService.refreshAccessToken(
          tokens.refresh_token
        );
        await this.saveKakaoTokens(userId, newTokens);
      } catch (error) {
        logger.error('Failed to refresh Kakao token:', error);
      }
    }
  }

  // 마지막 로그인 시간 업데이트
  private async updateLastLogin(userId: string): Promise<void> {
    await this.db('users')
      .where('id', userId)
      .update({
        last_login_at: new Date(),
      });
  }
}

// src/routes/auth.routes.ts
import { Router, Request, Response } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validate } from '../middlewares/validation';
import { authSchemas } from '../validations/auth.validation';
import { authenticate } from '../middlewares/auth';

const router = Router();
const authController = new AuthController();

// 카카오 로그인 페이지로 리다이렉트
router.get('/kakao', authController.redirectToKakao);

// 카카오 로그인 콜백
router.get('/kakao/callback', authController.kakaoCallback);

// 토큰 갱신
router.post(
  '/refresh',
  validate(authSchemas.refreshToken),
  authController.refreshToken
);

// 로그아웃
router.post('/logout', authenticate, authController.logout);

// 회원 탈퇴
router.delete('/account', authenticate, authController.deleteAccount);

// 토큰 검증 (디버깅용)
router.get('/verify', authenticate, authController.verifyToken);

export const authRouter = router;

// src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/appError';
import { kakaoConfig } from '../config/kakao.config';
import { AuthRequest } from '../middlewares/auth';

export class AuthController {
  private authService = new AuthService();

  // 카카오 로그인 페이지로 리다이렉트
  redirectToKakao = (req: Request, res: Response) => {
    const state = req.query.redirect || '/';
    const kakaoAuthUrl = `${kakaoConfig.authUrl}/oauth/authorize`;
    const params = new URLSearchParams({
      client_id: kakaoConfig.clientId,
      redirect_uri: kakaoConfig.redirectUri,
      response_type: 'code',
      scope: 'profile_nickname,profile_image,account_email',
      state: state as string,
    });

    res.redirect(`${kakaoAuthUrl}?${params}`);
  };

  // 카카오 로그인 콜백 처리
  kakaoCallback = asyncHandler(async (req: Request, res: Response) => {
    const { code, state } = req.query;

    if (!code) {
      throw new AppError('인증 코드가 없습니다.', 400);
    }

    const { user, tokens, isNewUser } = await this.authService.handleKakaoLogin(
      code as string
    );

    // 프론트엔드로 리다이렉트 (토큰 포함)
    const redirectUrl = new URL(
      process.env.FRONTEND_URL || 'http://localhost:3000'
    );
    
    redirectUrl.pathname = state as string || '/';
    redirectUrl.searchParams.set('access_token', tokens.accessToken);
    redirectUrl.searchParams.set('refresh_token', tokens.refreshToken);
    redirectUrl.searchParams.set('is_new_user', isNewUser.toString());

    res.redirect(redirectUrl.toString());
  });

  // 토큰 갱신
  refreshToken = asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    const tokens = await this.authService.refreshTokens(refreshToken);

    res.json({
      status: 'success',
      data: tokens,
    });
  });

  // 로그아웃
  logout = asyncHandler(async (req: AuthRequest, res: Response) => {
    await this.authService.logout(req.user!.id);

    res.json({
      status: 'success',
      message: '로그아웃되었습니다.',
    });
  });

  // 회원 탈퇴
  deleteAccount = asyncHandler(async (req: AuthRequest, res: Response) => {
    await this.authService.deleteAccount(req.user!.id);

    res.json({
      status: 'success',
      message: '회원 탈퇴가 완료되었습니다.',
    });
  });

  // 토큰 검증
  verifyToken = asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({
      status: 'success',
      data: {
        user: req.user,
        valid: true,
      },
    });
  });
}

// src/middlewares/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { Database } from '../database';
import { AppError } from '../utils/appError';
import { asyncHandler } from '../utils/asyncHandler';
import { JWTPayload } from '../types/auth.types';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    kakaoId: string;
    email?: string;
    role: string;
  };
}

export const authenticate = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    // 토큰 추출
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      throw new AppError('인증 토큰이 없습니다.', 401);
    }

    try {
      // 토큰 검증
      const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;

      // 사용자 조회
      const db = Database.getConnection();
      const user = await db('users')
        .where({ id: decoded.userId, is_active: true })
        .first();

      if (!user) {
        throw new AppError('사용자를 찾을 수 없습니다.', 401);
      }

      // 요청 객체에 사용자 정보 추가
      req.user = {
        id: user.id,
        kakaoId: user.kakao_id,
        email: user.email,
        role: user.role,
      };

      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError('토큰이 만료되었습니다.', 401);
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError('유효하지 않은 토큰입니다.', 401);
      }
      throw error;
    }
  }
);

// src/validations/auth.validation.ts
import joi from 'joi';

export const authSchemas = {
  refreshToken: joi.object({
    refreshToken: joi.string().required(),
  }),
};

// .env 파일 예시
/*
# Kakao OAuth
KAKAO_CLIENT_ID=your_kakao_rest_api_key
KAKAO_CLIENT_SECRET=your_kakao_client_secret
KAKAO_REDIRECT_URI=http://localhost:3000/api/v1/auth/kakao/callback
KAKAO_ADMIN_KEY=your_kakao_admin_key

# JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# Frontend URL
FRONTEND_URL=http://localhost:3001
*/