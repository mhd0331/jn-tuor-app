# 진안군 장터 앱 - 프론트엔드 기본 구조 설정

## 1. 프로젝트 초기화

```bash
# Next.js 프로젝트 생성
npx create-next-app@latest jinan-market-frontend --typescript --tailwind --app

# 프로젝트 디렉토리로 이동
cd jinan-market-frontend

# 필수 패키지 설치
npm install axios zustand @tanstack/react-query
npm install react-hook-form zod @hookform/resolvers
npm install date-fns react-toastify
npm install next-pwa workbox-webpack-plugin
npm install sharp

# 개발 의존성
npm install -D @types/node
```

## 2. 프로젝트 구조

```
jinan-market-frontend/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── manifest.json
│   ├── globals.css
│   ├── api/
│   │   └── auth/
│   │       └── [...nextauth]/route.ts
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── callback/page.tsx
│   ├── stores/
│   │   ├── page.tsx
│   │   └── [id]/
│   │       └── page.tsx
│   ├── reservations/
│   │   ├── page.tsx
│   │   └── new/page.tsx
│   ├── my/
│   │   └── page.tsx
│   └── owner/
│       ├── dashboard/page.tsx
│       └── reservations/page.tsx
├── components/
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   └── MobileNav.tsx
│   ├── store/
│   │   ├── StoreCard.tsx
│   │   ├── StoreList.tsx
│   │   └── StoreDetail.tsx
│   ├── common/
│   │   ├── LoadingSpinner.tsx
│   │   ├── ErrorBoundary.tsx
│   │   └── Toast.tsx
│   └── ui/
│       ├── Button.tsx
│       ├── Input.tsx
│       └── Card.tsx
├── lib/
│   ├── api/
│   │   ├── client.ts
│   │   ├── auth.ts
│   │   ├── stores.ts
│   │   └── reservations.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useStores.ts
│   │   └── useGeolocation.ts
│   ├── utils/
│   │   ├── format.ts
│   │   └── constants.ts
│   └── store/
│       └── authStore.ts
├── public/
│   ├── icons/
│   └── images/
├── types/
│   └── index.ts
├── .env.local
├── next.config.js
├── tailwind.config.ts
└── tsconfig.json
```

## 3. 환경변수 설정 (.env.local)

```env
# API 서버
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# 카카오 API
NEXT_PUBLIC_KAKAO_CLIENT_ID=your_kakao_client_id
NEXT_PUBLIC_KAKAO_REDIRECT_URI=http://localhost:3000/callback

# 지도 API
NEXT_PUBLIC_KAKAO_MAP_KEY=your_kakao_map_key

# 파일 업로드
NEXT_PUBLIC_MAX_FILE_SIZE=5242880
NEXT_PUBLIC_ALLOWED_IMAGE_TYPES=image/jpeg,image/png,image/webp

# 기타
NEXT_PUBLIC_APP_NAME=진안군 장터
NEXT_PUBLIC_DEFAULT_LOCATION_LAT=35.7917
NEXT_PUBLIC_DEFAULT_LOCATION_LNG=127.4250
```

## 4. Next.js 설정 (next.config.js)

```javascript
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  buildExcludes: [/middleware-manifest\.json$/],
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/api\.jinan-market\.com\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 60 * 60 // 1 hour
        }
      }
    },
    {
      urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'image-cache',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
        }
      }
    }
  ]
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['localhost', 'api.jinan-market.com', 'k.kakaocdn.net'],
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    serverActions: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};

module.exports = withPWA(nextConfig);
```

## 5. TypeScript 타입 정의 (types/index.ts)

```typescript
export interface User {
  id: string;
  kakaoId?: string;
  name: string;
  email?: string;
  phone: string;
  role: 'user' | 'owner' | 'admin';
  createdAt: string;
}

export interface Store {
  id: string;
  name: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  phone: string;
  imageUrl?: string;
  rating: number;
  reviewCount: number;
  status: 'active' | 'inactive' | 'pending';
  operatingHours: OperatingHour[];
  menus: Menu[];
  owner: User;
  createdAt: string;
}

export interface OperatingHour {
  dayOfWeek: number; // 0-6 (일-토)
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

export interface Menu {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  isAvailable: boolean;
  category: string;
}

export interface Reservation {
  id: string;
  storeId: string;
  userId: string;
  reservationDate: string;
  reservationTime: string;
  numberOfPeople: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  specialRequests?: string;
  createdAt: string;
}
```

## 6. API 클라이언트 설정 (lib/api/client.ts)

```typescript
import axios, { AxiosError, AxiosInstance } from 'axios';
import { toast } from 'react-toastify';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        const token = this.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          this.clearAuthToken();
          window.location.href = '/login';
        } else if (error.response?.status === 500) {
          toast.error('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        }
        return Promise.reject(error);
      }
    );
  }

  private getAuthToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('authToken');
    }
    return null;
  }

  private clearAuthToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken');
    }
  }

  public setAuthToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('authToken', token);
    }
  }

  // API methods
  public async get<T>(url: string, config = {}) {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  public async post<T>(url: string, data = {}, config = {}) {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  public async put<T>(url: string, data = {}, config = {}) {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  public async delete<T>(url: string, config = {}) {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();
```

## 7. 전역 스타일 (app/globals.css)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --primary: 59 130 246; /* blue-500 */
    --primary-dark: 29 78 216; /* blue-700 */
    --secondary: 99 102 241; /* indigo-500 */
    --success: 34 197 94; /* green-500 */
    --warning: 251 146 60; /* orange-400 */
    --danger: 239 68 68; /* red-500 */
    --background: 255 255 255;
    --foreground: 0 0 0;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --background: 0 0 0;
      --foreground: 255 255 255;
    }
  }

  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
  }

  /* 모바일 터치 영역 최적화 */
  button, a, input, textarea, select {
    @apply min-h-[44px];
  }

  /* 스크롤바 스타일 */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    @apply bg-gray-100;
  }

  ::-webkit-scrollbar-thumb {
    @apply bg-gray-400 rounded-full;
  }

  ::-webkit-scrollbar-thumb:hover {
    @apply bg-gray-500;
  }
}

@layer components {
  .container {
    @apply mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl;
  }

  .btn-primary {
    @apply bg-blue-500 text-white px-6 py-3 rounded-lg font-medium 
           hover:bg-blue-600 transition-colors duration-200
           active:scale-95 transform
           disabled:opacity-50 disabled:cursor-not-allowed;
  }

  .card {
    @apply bg-white rounded-lg shadow-md p-6 
           border border-gray-100 
           hover:shadow-lg transition-shadow duration-200;
  }

  .input-field {
    @apply w-full px-4 py-3 border border-gray-300 rounded-lg
           focus:ring-2 focus:ring-blue-500 focus:border-transparent
           placeholder-gray-400 transition-all duration-200;
  }

  .skeleton {
    @apply animate-pulse bg-gray-200 rounded;
  }
}

@layer utilities {
  /* 모바일에서 스크롤 성능 최적화 */
  .scroll-smooth-mobile {
    -webkit-overflow-scrolling: touch;
    scroll-behavior: smooth;
  }

  /* 안전 영역 패딩 (노치 대응) */
  .safe-top {
    padding-top: env(safe-area-inset-top);
  }

  .safe-bottom {
    padding-bottom: env(safe-area-inset-bottom);
  }

  .safe-left {
    padding-left: env(safe-area-inset-left);
  }

  .safe-right {
    padding-right: env(safe-area-inset-right);
  }
}
```

## 8. 루트 레이아웃 (app/layout.tsx)

```typescript
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers/Providers';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '진안군 장터',
  description: '진안군 전통시장과 상점을 한눈에! 예약부터 결제까지 간편하게',
  keywords: '진안군, 전통시장, 장터, 로컬푸드, 예약, 진안읍',
  authors: [{ name: '진안군청' }],
  openGraph: {
    title: '진안군 장터',
    description: '진안군 전통시장과 상점을 한눈에!',
    url: 'https://jinan-market.com',
    siteName: '진안군 장터',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
      },
    ],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '진안군 장터',
    description: '진안군 전통시장과 상점을 한눈에!',
    images: ['/og-image.png'],
  },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon.png' },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#3B82F6',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className="h-full">
      <body className={`${inter.className} h-full flex flex-col`}>
        <Providers>
          <Header />
          <main className="flex-1 safe-top safe-bottom">
            {children}
          </main>
          <Footer />
          <ToastContainer
            position="bottom-center"
            autoClose={3000}
            hideProgressBar
            newestOnTop
            closeOnClick
            rtl={false}
            pauseOnFocusLoss={false}
            draggable
            pauseOnHover={false}
            theme="colored"
            toastClassName="mb-safe"
          />
        </Providers>
      </body>
    </html>
  );
}
```

## 9. PWA Manifest (public/manifest.json)

```json
{
  "name": "진안군 장터",
  "short_name": "진안장터",
  "description": "진안군 전통시장과 상점을 한눈에! 예약부터 결제까지 간편하게",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#ffffff",
  "theme_color": "#3B82F6",
  "dir": "ltr",
  "lang": "ko-KR",
  "categories": ["shopping", "food", "lifestyle"],
  "icons": [
    {
      "src": "/icon-72.png",
      "sizes": "72x72",
      "type": "image/png"
    },
    {
      "src": "/icon-96.png",
      "sizes": "96x96",
      "type": "image/png"
    },
    {
      "src": "/icon-128.png",
      "sizes": "128x128",
      "type": "image/png"
    },
    {
      "src": "/icon-144.png",
      "sizes": "144x144",
      "type": "image/png"
    },
    {
      "src": "/icon-152.png",
      "sizes": "152x152",
      "type": "image/png"
    },
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-384.png",
      "sizes": "384x384",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshot-1.png",
      "sizes": "540x720",
      "type": "image/png",
      "label": "홈 화면"
    },
    {
      "src": "/screenshot-2.png",
      "sizes": "540x720",
      "type": "image/png",
      "label": "상점 상세"
    }
  ],
  "related_applications": [],
  "prefer_related_applications": false
}
```

## 10. 상태 관리 (lib/store/authStore.ts)

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      
      login: (user, token) => {
        set({ user, token, isAuthenticated: true });
        if (typeof window !== 'undefined') {
          localStorage.setItem('authToken', token);
        }
      },
      
      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
        if (typeof window !== 'undefined') {
          localStorage.removeItem('authToken');
        }
      },
      
      updateUser: (updates) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        }));
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        token: state.token,
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
);
```

## 11. React Query 설정 (components/providers/Providers.tsx)

```typescript
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1분
            gcTime: 10 * 60 * 1000, // 10분 (구 cacheTime)
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

## 12. 커스텀 훅 - useGeolocation (lib/hooks/useGeolocation.ts)

```typescript
import { useState, useEffect } from 'react';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
  loading: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        error: '브라우저가 위치 정보를 지원하지 않습니다.',
        loading: false,
      }));
      return;
    }

    const handleSuccess = (position: GeolocationPosition) => {
      setState({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        error: null,
        loading: false,
      });
    };

    const handleError = (error: GeolocationPositionError) => {
      let errorMessage = '위치 정보를 가져올 수 없습니다.';
      
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = '위치 정보 사용 권한이 거부되었습니다.';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = '위치 정보를 사용할 수 없습니다.';
          break;
        case error.TIMEOUT:
          errorMessage = '위치 정보 요청 시간이 초과되었습니다.';
          break;
      }
      
      setState({
        latitude: null,
        longitude: null,
        error: errorMessage,
        loading: false,
      });
    };

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  }, []);

  return state;
}
```

## 13. 헤더 컴포넌트 (components/layout/Header.tsx)

```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuthStore } from '@/lib/store/authStore';

export default function Header() {
  const pathname = usePathname();
  const { isAuthenticated, user, logout } = useAuthStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigation = [
    { name: '홈', href: '/' },
    { name: '상점', href: '/stores' },
    { name: '예약내역', href: '/reservations', auth: true },
    { name: '마이페이지', href: '/my', auth: true },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm safe-top">
      <nav className="container">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold text-blue-600">진안장터</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navigation.map((item) => {
              if (item.auth && !isAuthenticated) return null;
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`text-sm font-medium transition-colors duration-200 ${
                    isActive(item.href)
                      ? 'text-blue-600'
                      : 'text-gray-700 hover:text-blue-600'
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
            
            {isAuthenticated ? (
              <button
                onClick={logout}
                className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors duration-200"
              >
                로그아웃
              </button>
            ) : (
              <Link
                href="/login"
                className="btn-primary text-sm px-4 py-2"
              >
                로그인
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-md text-gray-700"
            aria-label="메뉴 열기"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isMobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 pb-4">
            <div className="space-y-1 pt-4">
              {navigation.map((item) => {
                if (item.auth && !isAuthenticated) return null;
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`block px-3 py-2 text-base font-medium rounded-md ${
                      isActive(item.href)
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
              
              {isAuthenticated ? (
                <button
                  onClick={() => {
                    logout();
                    setIsMobileMenuOpen(false);
                  }}
                  className="block w-full text-left px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-md"
                >
                  로그아웃
                </button>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-3 py-2 text-base font-medium text-blue-600 hover:bg-blue-50 rounded-md"
                >
                  로그인
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
```

## 14. Tailwind 설정 (tailwind.config.ts)

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      animation: {
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      spacing: {
        'safe': 'env(safe-area-inset-bottom)',
      },
    },
  },
  plugins: [],
};

export default config;
```

## 실행 방법

1. 프로젝트 생성 및 의존성 설치:
```bash
npx create-next-app@latest jinan-market-frontend --typescript --tailwind --app
cd jinan-market-frontend
npm install axios zustand @tanstack/react-query react-hook-form zod @hookform/resolvers date-fns react-toastify next-pwa workbox-webpack-plugin sharp
```

2. 위의 파일들을 각각의 경로에 생성

3. 환경변수 설정 (.env.local 파일에 실제 값 입력)

4. 개발 서버 실행:
```bash
npm run dev
```

5. 빌드 및 프로덕션 실행:
```bash
npm run build
npm start
```

이제 프론트엔드 기본 구조가 완성되었습니다. 다음 단계는 실제 페이지 구현입니다.