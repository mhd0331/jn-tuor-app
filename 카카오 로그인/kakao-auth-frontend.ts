// =============================================
// 진안군 장터 앱 - 카카오 로그인 프론트엔드 (Next.js)
// =============================================

// src/lib/auth.ts - 인증 관련 유틸리티
export class AuthManager {
  private static ACCESS_TOKEN_KEY = 'jinan_access_token';
  private static REFRESH_TOKEN_KEY = 'jinan_refresh_token';
  private static USER_KEY = 'jinan_user';

  // 토큰 저장
  static saveTokens(accessToken: string, refreshToken: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
      localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
    }
  }

  // 액세스 토큰 가져오기
  static getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  // 리프레시 토큰 가져오기
  static getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  // 토큰 삭제
  static clearTokens() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.ACCESS_TOKEN_KEY);
      localStorage.removeItem(this.REFRESH_TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
    }
  }

  // 사용자 정보 저장
  static saveUser(user: any) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    }
  }

  // 사용자 정보 가져오기
  static getUser(): any | null {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem(this.USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  }

  // 로그인 여부 확인
  static isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }
}

// src/services/auth.service.ts - API 통신
import axios, { AxiosInstance } from 'axios';
import { AuthManager } from '@/lib/auth';

interface LoginResponse {
  user: {
    id: string;
    username: string;
    email?: string;
    profileImageUrl?: string;
    role: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  isNewUser: boolean;
}

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

class AuthService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1',
    });

    // 요청 인터셉터 - 토큰 자동 추가
    this.api.interceptors.request.use(
      (config) => {
        const token = AuthManager.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // 응답 인터셉터 - 토큰 만료 시 자동 갱신
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            await this.refreshToken();
            const token = AuthManager.getAccessToken();
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return this.api(originalRequest);
          } catch (refreshError) {
            // 리프레시도 실패하면 로그아웃
            this.logout();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // 카카오 로그인 URL 가져오기
  getKakaoLoginUrl(redirect?: string): string {
    const params = new URLSearchParams();
    if (redirect) params.set('redirect', redirect);
    return `${this.api.defaults.baseURL}/auth/kakao?${params}`;
  }

  // 토큰 갱신
  async refreshToken(): Promise<void> {
    const refreshToken = AuthManager.getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token');

    const response = await this.api.post<RefreshResponse>('/auth/refresh', {
      refreshToken,
    });

    const { accessToken, refreshToken: newRefreshToken } = response.data;
    AuthManager.saveTokens(accessToken, newRefreshToken);
  }

  // 로그아웃
  async logout(): Promise<void> {
    try {
      await this.api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      AuthManager.clearTokens();
    }
  }

  // 회원 탈퇴
  async deleteAccount(): Promise<void> {
    await this.api.delete('/auth/account');
    AuthManager.clearTokens();
  }

  // 현재 사용자 정보 가져오기
  async getCurrentUser(): Promise<any> {
    const response = await this.api.get('/users/me');
    return response.data;
  }
}

export const authService = new AuthService();

// src/hooks/useAuth.ts - React Hook
import { useState, useEffect, useContext, createContext, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/auth.service';
import { AuthManager } from '@/lib/auth';

interface AuthContextType {
  user: any | null;
  loading: boolean;
  login: (redirect?: string) => void;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // 초기 사용자 로드
  useEffect(() => {
    const loadUser = async () => {
      try {
        if (AuthManager.isAuthenticated()) {
          const savedUser = AuthManager.getUser();
          if (savedUser) {
            setUser(savedUser);
          } else {
            // 서버에서 사용자 정보 가져오기
            const userData = await authService.getCurrentUser();
            setUser(userData);
            AuthManager.saveUser(userData);
          }
        }
      } catch (error) {
        console.error('Failed to load user:', error);
        AuthManager.clearTokens();
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  // URL에서 토큰 처리 (카카오 로그인 콜백)
  useEffect(() => {
    const handleCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const accessToken = urlParams.get('access_token');
      const refreshToken = urlParams.get('refresh_token');
      const isNewUser = urlParams.get('is_new_user') === 'true';

      if (accessToken && refreshToken) {
        // 토큰 저장
        AuthManager.saveTokens(accessToken, refreshToken);

        // 사용자 정보 가져오기
        try {
          const userData = await authService.getCurrentUser();
          setUser(userData);
          AuthManager.saveUser(userData);

          // URL 파라미터 제거
          window.history.replaceState({}, '', window.location.pathname);

          // 신규 사용자면 프로필 설정 페이지로
          if (isNewUser) {
            router.push('/profile/setup');
          }
        } catch (error) {
          console.error('Failed to get user info:', error);
        }
      }
    };

    handleCallback();
  }, [router]);

  const login = (redirect?: string) => {
    window.location.href = authService.getKakaoLoginUrl(redirect);
  };

  const logout = async () => {
    setLoading(true);
    try {
      await authService.logout();
      setUser(null);
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const deleteAccount = async () => {
    if (!confirm('정말로 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    setLoading(true);
    try {
      await authService.deleteAccount();
      setUser(null);
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const userData = await authService.getCurrentUser();
      setUser(userData);
      AuthManager.saveUser(userData);
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        deleteAccount,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// src/components/LoginButton.tsx - 로그인 버튼 컴포넌트
import React from 'react';
import { useAuth } from '@/hooks/useAuth';

export function LoginButton() {
  const { user, loading, login, logout } = useAuth();

  if (loading) {
    return (
      <button className="px-4 py-2 bg-gray-200 rounded-lg" disabled>
        로딩중...
      </button>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-4">
        <img
          src={user.profileImageUrl || '/default-avatar.png'}
          alt={user.username}
          className="w-8 h-8 rounded-full"
        />
        <span className="text-sm font-medium">{user.username}님</span>
        <button
          onClick={logout}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
        >
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => login()}
      className="flex items-center gap-2 px-6 py-3 bg-[#FEE500] text-black rounded-lg hover:bg-[#FDD835] transition-colors"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M10 0C4.478 0 0 3.584 0 8c0 3.068 2.16 5.732 5.327 7.089-.093.813-.591 2.593-.623 2.744-.039.188.067.191.14.14.058-.04 2.302-1.522 3.232-2.137A11.47 11.47 0 0010 16c5.522 0 10-3.584 10-8s-4.478-8-10-8z"
          fill="#000"
        />
      </svg>
      카카오 로그인
    </button>
  );
}

// src/components/ProtectedRoute.tsx - 인증이 필요한 라우트 보호
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireRole?: string[];
}

export function ProtectedRoute({
  children,
  requireAuth = true,
  requireRole,
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (requireAuth && !user) {
        // 로그인 필요
        router.push('/login');
      } else if (requireRole && user && !requireRole.includes(user.role)) {
        // 권한 부족
        router.push('/403');
      }
    }
  }, [user, loading, requireAuth, requireRole, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (requireAuth && !user) {
    return null;
  }

  if (requireRole && user && !requireRole.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}

// src/app/layout.tsx - Next.js 레이아웃 (App Router)
import { AuthProvider } from '@/hooks/useAuth';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

// src/app/login/page.tsx - 로그인 페이지
'use client';

import { useAuth } from '@/hooks/useAuth';
import { LoginButton } from '@/components/LoginButton';

export default function LoginPage() {
  const { user } = useAuth();

  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">이미 로그인되어 있습니다</h1>
          <a href="/" className="text-blue-500 hover:underline">
            홈으로 돌아가기
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            진안군 장터
          </h1>
          <p className="text-gray-600">
            카카오 계정으로 간편하게 로그인하세요
          </p>
        </div>
        
        <div className="bg-white p-8 rounded-lg shadow-md">
          <div className="space-y-4">
            <LoginButton />
            
            <div className="text-center text-sm text-gray-500">
              로그인 시{' '}
              <a href="/terms" className="text-blue-500 hover:underline">
                이용약관
              </a>
              과{' '}
              <a href="/privacy" className="text-blue-500 hover:underline">
                개인정보처리방침
              </a>
              에 동의하게 됩니다.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// src/app/profile/page.tsx - 프로필 페이지
'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/hooks/useAuth';

export default function ProfilePage() {
  const { user, deleteAccount } = useAuth();

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">내 프로필</h1>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center space-x-4 mb-6">
            <img
              src={user?.profileImageUrl || '/default-avatar.png'}
              alt={user?.username}
              className="w-20 h-20 rounded-full"
            />
            <div>
              <h2 className="text-xl font-semibold">{user?.username}</h2>
              <p className="text-gray-600">{user?.email || '이메일 없음'}</p>
            </div>
          </div>
          
          <div className="border-t pt-6">
            <h3 className="font-semibold mb-4">계정 설정</h3>
            <button
              onClick={deleteAccount}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              회원 탈퇴
            </button>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}