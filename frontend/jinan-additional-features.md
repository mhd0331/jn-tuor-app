# 진안군 장터 앱 - 추가 기능 구현

## 1. Zustand 상태 관리 확장

### 1.1 통합 스토어 (lib/store/index.ts)

```typescript
import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Auth Store는 이미 구현됨, 추가 스토어들을 구현합니다.

// UI 상태 관리
interface UIState {
  isLoading: boolean;
  isSidebarOpen: boolean;
  selectedCategory: string | null;
  searchQuery: string;
  filters: {
    priceRange: [number, number];
    rating: number | null;
    distance: number;
  };
  setLoading: (loading: boolean) => void;
  toggleSidebar: () => void;
  setSelectedCategory: (category: string | null) => void;
  setSearchQuery: (query: string) => void;
  setFilters: (filters: Partial<UIState['filters']>) => void;
  resetFilters: () => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    subscribeWithSelector((set) => ({
      isLoading: false,
      isSidebarOpen: false,
      selectedCategory: null,
      searchQuery: '',
      filters: {
        priceRange: [0, 100000],
        rating: null,
        distance: 5000, // 5km
      },
      setLoading: (loading) => set({ isLoading: loading }),
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setSelectedCategory: (category) => set({ selectedCategory: category }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setFilters: (filters) =>
        set((state) => ({
          filters: { ...state.filters, ...filters },
        })),
      resetFilters: () =>
        set({
          filters: {
            priceRange: [0, 100000],
            rating: null,
            distance: 5000,
          },
          selectedCategory: null,
          searchQuery: '',
        }),
    })),
    { name: 'ui-store' }
  )
);

// 장바구니 상태 관리
interface CartItem {
  id: string;
  storeId: string;
  menuId: string;
  name: string;
  price: number;
  quantity: number;
  options?: Array<{
    name: string;
    price: number;
  }>;
}

interface CartState {
  items: CartItem[];
  totalAmount: number;
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  clearStoreItems: (storeId: string) => void;
}

export const useCartStore = create<CartState>()(
  devtools(
    persist(
      immer((set) => ({
        items: [],
        totalAmount: 0,
        addItem: (item) =>
          set((state) => {
            // 같은 상점의 상품만 담을 수 있도록 체크
            if (state.items.length > 0 && state.items[0].storeId !== item.storeId) {
              if (confirm('다른 상점의 상품이 담겨있습니다. 장바구니를 비우고 새로 담으시겠습니까?')) {
                state.items = [];
              } else {
                return;
              }
            }

            const id = `${item.menuId}-${Date.now()}`;
            const newItem = { ...item, id };
            state.items.push(newItem);
            state.totalAmount = state.items.reduce(
              (sum, item) => sum + item.price * item.quantity,
              0
            );
          }),
        removeItem: (id) =>
          set((state) => {
            state.items = state.items.filter((item) => item.id !== id);
            state.totalAmount = state.items.reduce(
              (sum, item) => sum + item.price * item.quantity,
              0
            );
          }),
        updateQuantity: (id, quantity) =>
          set((state) => {
            const item = state.items.find((item) => item.id === id);
            if (item) {
              item.quantity = quantity;
              state.totalAmount = state.items.reduce(
                (sum, item) => sum + item.price * item.quantity,
                0
              );
            }
          }),
        clearCart: () =>
          set((state) => {
            state.items = [];
            state.totalAmount = 0;
          }),
        clearStoreItems: (storeId) =>
          set((state) => {
            state.items = state.items.filter((item) => item.storeId !== storeId);
            state.totalAmount = state.items.reduce(
              (sum, item) => sum + item.price * item.quantity,
              0
            );
          }),
      })),
      {
        name: 'cart-storage',
      }
    ),
    { name: 'cart-store' }
  )
);

// 위치 정보 스토어
interface LocationState {
  currentLocation: {
    lat: number;
    lng: number;
  } | null;
  selectedLocation: {
    lat: number;
    lng: number;
    address?: string;
  } | null;
  nearbyStores: Array<{
    id: string;
    distance: number;
  }>;
  setCurrentLocation: (location: { lat: number; lng: number }) => void;
  setSelectedLocation: (location: { lat: number; lng: number; address?: string }) => void;
  setNearbyStores: (stores: Array<{ id: string; distance: number }>) => void;
}

export const useLocationStore = create<LocationState>()(
  devtools(
    (set) => ({
      currentLocation: null,
      selectedLocation: null,
      nearbyStores: [],
      setCurrentLocation: (location) => set({ currentLocation: location }),
      setSelectedLocation: (location) => set({ selectedLocation: location }),
      setNearbyStores: (stores) => set({ nearbyStores: stores }),
    }),
    { name: 'location-store' }
  )
);
```

### 1.2 스토어 미들웨어 및 셀렉터 (lib/store/selectors.ts)

```typescript
import { useAuthStore } from './authStore';
import { useUIStore, useCartStore, useLocationStore } from './index';

// Auth 셀렉터
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useCurrentUser = () => useAuthStore((state) => state.user);
export const useIsOwner = () => useAuthStore((state) => state.user?.role === 'owner');
export const useIsAdmin = () => useAuthStore((state) => state.user?.role === 'admin');

// UI 셀렉터
export const useIsLoading = () => useUIStore((state) => state.isLoading);
export const useSearchQuery = () => useUIStore((state) => state.searchQuery);
export const useFilters = () => useUIStore((state) => state.filters);

// Cart 셀렉터
export const useCartItems = () => useCartStore((state) => state.items);
export const useCartTotal = () => useCartStore((state) => state.totalAmount);
export const useCartItemCount = () => useCartStore((state) => state.items.reduce((sum, item) => sum + item.quantity, 0));

// Location 셀렉터
export const useCurrentLocation = () => useLocationStore((state) => state.currentLocation);
export const useNearbyStores = () => useLocationStore((state) => state.nearbyStores);

// 스토어 구독 예제
export const subscribeToAuthChanges = (callback: (isAuthenticated: boolean) => void) => {
  return useAuthStore.subscribe(
    (state) => state.isAuthenticated,
    callback
  );
};
```

## 2. React Query 확장 구현

### 2.1 API 훅 - 상점 관련 (lib/hooks/useStores.ts)

```typescript
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { Store } from '@/types';
import { toast } from 'react-toastify';

// 쿼리 키 상수
export const storeKeys = {
  all: ['stores'] as const,
  lists: () => [...storeKeys.all, 'list'] as const,
  list: (filters: string) => [...storeKeys.lists(), { filters }] as const,
  details: () => [...storeKeys.all, 'detail'] as const,
  detail: (id: string) => [...storeKeys.details(), id] as const,
  nearby: (lat: number, lng: number, radius: number) => 
    [...storeKeys.all, 'nearby', { lat, lng, radius }] as const,
};

// 상점 목록 조회 (무한 스크롤)
export function useStoresInfinite(filters?: {
  category?: string;
  search?: string;
  myeonId?: number;
}) {
  return useInfiniteQuery({
    queryKey: storeKeys.list(JSON.stringify(filters || {})),
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams({
        page: pageParam.toString(),
        limit: '20',
        ...filters,
      });
      
      return apiClient.get<{
        stores: Store[];
        totalPages: number;
        currentPage: number;
        hasMore: boolean;
      }>(`/stores?${params}`);
    },
    getNextPageParam: (lastPage) => 
      lastPage.hasMore ? lastPage.currentPage + 1 : undefined,
    initialPageParam: 1,
  });
}

// 상점 상세 조회
export function useStore(id: string) {
  return useQuery({
    queryKey: storeKeys.detail(id),
    queryFn: () => apiClient.get<Store>(`/stores/${id}`),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5분
  });
}

// 주변 상점 조회
export function useNearbyStores(
  location: { lat: number; lng: number } | null,
  radius: number = 5000
) {
  return useQuery({
    queryKey: location 
      ? storeKeys.nearby(location.lat, location.lng, radius)
      : ['stores-nearby-disabled'],
    queryFn: () => 
      apiClient.get<Store[]>('/stores/nearby', {
        params: {
          lat: location!.lat,
          lng: location!.lng,
          radius,
        },
      }),
    enabled: !!location,
    staleTime: 2 * 60 * 1000, // 2분
  });
}

// 상점 생성
export function useCreateStore() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Partial<Store>) => 
      apiClient.post<Store>('/stores', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storeKeys.lists() });
      toast.success('상점이 등록되었습니다.');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || '상점 등록에 실패했습니다.');
    },
  });
}

// 상점 업데이트
export function useUpdateStore(id: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Partial<Store>) => 
      apiClient.put<Store>(`/stores/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: storeKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: storeKeys.lists() });
      toast.success('상점 정보가 수정되었습니다.');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || '상점 수정에 실패했습니다.');
    },
  });
}

// 상점 삭제
export function useDeleteStore() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => 
      apiClient.delete(`/stores/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storeKeys.lists() });
      toast.success('상점이 삭제되었습니다.');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || '상점 삭제에 실패했습니다.');
    },
  });
}
```

### 2.2 API 훅 - 예약 관련 (lib/hooks/useReservations.ts)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { Reservation } from '@/types';
import { toast } from 'react-toastify';

export const reservationKeys = {
  all: ['reservations'] as const,
  lists: () => [...reservationKeys.all, 'list'] as const,
  list: (filters: string) => [...reservationKeys.lists(), { filters }] as const,
  details: () => [...reservationKeys.all, 'detail'] as const,
  detail: (id: string) => [...reservationKeys.details(), id] as const,
  user: (userId: string) => [...reservationKeys.all, 'user', userId] as const,
  store: (storeId: string) => [...reservationKeys.all, 'store', storeId] as const,
};

// 예약 목록 조회
export function useReservations(filters?: {
  status?: string;
  startDate?: string;
  endDate?: string;
}) {
  return useQuery({
    queryKey: reservationKeys.list(JSON.stringify(filters || {})),
    queryFn: () => apiClient.get<Reservation[]>('/reservations', { params: filters }),
  });
}

// 예약 상세 조회
export function useReservation(id: string) {
  return useQuery({
    queryKey: reservationKeys.detail(id),
    queryFn: () => apiClient.get<Reservation>(`/reservations/${id}`),
    enabled: !!id,
  });
}

// 사용자 예약 목록
export function useMyReservations() {
  return useQuery({
    queryKey: reservationKeys.user('me'),
    queryFn: () => apiClient.get<Reservation[]>('/reservations/my'),
  });
}

// 예약 생성
export function useCreateReservation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Omit<Reservation, 'id' | 'createdAt' | 'status'>) => 
      apiClient.post<Reservation>('/reservations', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
      toast.success('예약이 완료되었습니다.');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || '예약에 실패했습니다.');
    },
  });
}

// 예약 상태 업데이트
export function useUpdateReservationStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => 
      apiClient.patch<Reservation>(`/reservations/${id}/status`, { status }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: reservationKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: reservationKeys.lists() });
      toast.success('예약 상태가 변경되었습니다.');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || '상태 변경에 실패했습니다.');
    },
  });
}

// 예약 취소
export function useCancelReservation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => 
      apiClient.patch<Reservation>(`/reservations/${id}/cancel`),
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: reservationKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: reservationKeys.lists() });
      toast.success('예약이 취소되었습니다.');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || '예약 취소에 실패했습니다.');
    },
  });
}
```

### 2.3 Optimistic Updates 예제 (lib/hooks/useOptimistic.ts)

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { storeKeys } from './useStores';

// 좋아요 기능 with Optimistic Update
export function useToggleLike(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (liked: boolean) =>
      liked
        ? apiClient.delete(`/stores/${storeId}/like`)
        : apiClient.post(`/stores/${storeId}/like`),
    
    // Optimistic update
    onMutate: async (liked) => {
      // 진행 중인 refetch 취소
      await queryClient.cancelQueries({ queryKey: storeKeys.detail(storeId) });
      
      // 이전 값 스냅샷
      const previousStore = queryClient.getQueryData(storeKeys.detail(storeId));
      
      // 낙관적 업데이트
      queryClient.setQueryData(storeKeys.detail(storeId), (old: any) => ({
        ...old,
        isLiked: !liked,
        likeCount: liked ? old.likeCount - 1 : old.likeCount + 1,
      }));
      
      // 롤백을 위한 context 반환
      return { previousStore };
    },
    
    // 에러 시 롤백
    onError: (err, liked, context) => {
      queryClient.setQueryData(
        storeKeys.detail(storeId),
        context?.previousStore
      );
    },
    
    // 성공/실패 여부와 관계없이 refetch
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: storeKeys.detail(storeId) });
    },
  });
}
```

## 3. 위치 정보 훅 확장

### 3.1 고급 위치 정보 훅 (lib/hooks/useAdvancedGeolocation.ts)

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocationStore } from '@/lib/store';

interface GeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  watchPosition?: boolean;
}

interface GeolocationState {
  location: GeolocationPosition | null;
  error: GeolocationPositionError | null;
  loading: boolean;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number | null;
}

export function useAdvancedGeolocation(options: GeolocationOptions = {}) {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 0,
    watchPosition = false,
  } = options;

  const [state, setState] = useState<GeolocationState>({
    location: null,
    error: null,
    loading: true,
    accuracy: null,
    heading: null,
    speed: null,
    timestamp: null,
  });

  const watchId = useRef<number | null>(null);
  const { setCurrentLocation } = useLocationStore();

  const handleSuccess = useCallback((position: GeolocationPosition) => {
    setState({
      location: position,
      error: null,
      loading: false,
      accuracy: position.coords.accuracy,
      heading: position.coords.heading,
      speed: position.coords.speed,
      timestamp: position.timestamp,
    });

    // 전역 상태에 저장
    setCurrentLocation({
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    });
  }, [setCurrentLocation]);

  const handleError = useCallback((error: GeolocationPositionError) => {
    setState((prev) => ({
      ...prev,
      error,
      loading: false,
    }));
  }, []);

  const getCurrentPosition = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true }));
    
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy,
        timeout,
        maximumAge,
      }
    );
  }, [enableHighAccuracy, timeout, maximumAge, handleSuccess, handleError]);

  const clearWatch = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        error: {
          code: 0,
          message: '브라우저가 위치 정보를 지원하지 않습니다.',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError,
        loading: false,
      }));
      return;
    }

    if (watchPosition) {
      watchId.current = navigator.geolocation.watchPosition(
        handleSuccess,
        handleError,
        {
          enableHighAccuracy,
          timeout,
          maximumAge,
        }
      );
    } else {
      getCurrentPosition();
    }

    return () => {
      clearWatch();
    };
  }, [watchPosition, getCurrentPosition, clearWatch]);

  return {
    ...state,
    refresh: getCurrentPosition,
    isHighAccuracy: state.accuracy !== null && state.accuracy <= 50, // 50m 이하면 높은 정확도
  };
}
```

### 3.2 거리 계산 유틸리티 (lib/utils/geo.ts)

```typescript
// Haversine 공식을 사용한 두 지점 간 거리 계산
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // 지구 반경 (미터)
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // 미터 단위
}

// 거리를 사람이 읽기 쉬운 형식으로 변환
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

// 경계 상자 계산 (지도 표시용)
export function getBoundingBox(
  center: { lat: number; lng: number },
  radiusInMeters: number
): {
  north: number;
  south: number;
  east: number;
  west: number;
} {
  const latDelta = (radiusInMeters / 111320) * 2; // 1도 ≈ 111.32km
  const lngDelta = (radiusInMeters / (111320 * Math.cos((center.lat * Math.PI) / 180))) * 2;

  return {
    north: center.lat + latDelta / 2,
    south: center.lat - latDelta / 2,
    east: center.lng + lngDelta / 2,
    west: center.lng - lngDelta / 2,
  };
}
```

## 4. 보안 헤더 확장

### 4.1 미들웨어 설정 (middleware.ts)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // 보안 헤더
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  
  // CSP (Content Security Policy)
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://t1.kakaocdn.net https://developers.kakao.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https: http:",
    "font-src 'self' data:",
    "connect-src 'self' https://kapi.kakao.com https://kauth.kakao.com https://api.jinan-market.com wss://api.jinan-market.com",
    "media-src 'self'",
    "frame-src 'self' https://kauth.kakao.com",
  ].join('; ');
  
  response.headers.set('Content-Security-Policy', cspDirectives);
  
  // 인증이 필요한 라우트 보호
  const protectedPaths = ['/my', '/reservations', '/owner'];
  const isProtectedPath = protectedPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  );
  
  if (isProtectedPath) {
    const token = request.cookies.get('authToken');
    
    if (!token) {
      const url = new URL('/login', request.url);
      url.searchParams.set('from', request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
  }
  
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
```

### 4.2 API 라우트 보안 (app/api/secure-headers/route.ts)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// CSRF 토큰 생성
export async function GET(request: NextRequest) {
  const token = crypto.randomBytes(32).toString('hex');
  
  const response = NextResponse.json({ csrfToken: token });
  
  // CSRF 토큰을 HttpOnly 쿠키로 설정
  response.cookies.set('csrf-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24, // 24시간
    path: '/',
  });
  
  return response;
}

// CSRF 검증 미들웨어
export function validateCSRF(request: NextRequest): boolean {
  const cookieToken = request.cookies.get('csrf-token')?.value;
  const headerToken = request.headers.get('X-CSRF-Token');
  
  if (!cookieToken || !headerToken) {
    return false;
  }
  
  return cookieToken === headerToken;
}
```

## 5. 이미지 최적화 구현

### 5.1 이미지 컴포넌트 (components/common/OptimizedImage.tsx)

```typescript
'use client';

import Image from 'next/image';
import { useState } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  className?: string;
  sizes?: string;
  quality?: number;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  onLoad?: () => void;
  fallbackSrc?: string;
}

export default function OptimizedImage({
  src,
  alt,
  width,
  height,
  priority = false,
  className = '',
  sizes = '100vw',
  quality = 85,
  placeholder = 'empty',
  blurDataURL,
  onLoad,
  fallbackSrc = '/images/placeholder.png',
}: OptimizedImageProps) {
  const [imgSrc, setImgSrc] = useState(src);
  const [isLoading, setIsLoading] = useState(true);

  const handleError = () => {
    setImgSrc(fallbackSrc);
  };

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}
      <Image
        src={imgSrc}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        sizes={sizes}
        quality={quality}
        placeholder={placeholder}
        blurDataURL={blurDataURL}
        onLoad={handleLoad}
        onError={handleError}
        unoptimized={imgSrc === fallbackSrc}
      />
    </div>
  );
}
```

### 5.2 이미지 업로드 및 처리 (lib/utils/image.ts)

```typescript
interface ImageProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
}

// 이미지 리사이징 및 압축
export async function processImage(
  file: File,
  options: ImageProcessingOptions = {}
): Promise<Blob> {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.85,
    format = 'webp',
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        // 비율 유지하며 리사이징
        let { width, height } = img;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;

        // 이미지 그리기
        ctx.drawImage(img, 0, 0, width, height);

        // Blob으로 변환
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to process image'));
            }
          },
          `image/${format}`,
          quality
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// 이미지 포맷 지원 확인
export function getSupportedImageFormat(): 'avif' | 'webp' | 'jpeg' {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;

  // AVIF 지원 확인
  if (canvas.toDataURL('image/avif').startsWith('data:image/avif')) {
    return 'avif';
  }
  
  // WebP 지원 확인
  if (canvas.toDataURL('image/webp').startsWith('data:image/webp')) {
    return 'webp';
  }

  return 'jpeg';
}

// Base64 이미지 생성 (blur placeholder용)
export async function generateBlurDataURL(
  file: File,
  width: number = 10
): Promise<string> {
  const processedImage = await processImage(file, {
    maxWidth: width,
    maxHeight: width,
    quality: 0.1,
    format: 'jpeg',
  });

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(processedImage);
  });
}
```

### 5.3 이미지 업로드 컴포넌트 (components/common/ImageUploader.tsx)

```typescript
'use client';

import { useState, useCallback, useRef } from 'react';
import { processImage, generateBlurDataURL } from '@/lib/utils/image';
import OptimizedImage from './OptimizedImage';
import { toast } from 'react-toastify';

interface ImageUploaderProps {
  onUpload: (files: File[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  acceptedFormats?: string[];
}

export default function ImageUploader({
  onUpload,
  maxFiles = 5,
  maxSizeMB = 5,
  acceptedFormats = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
}: ImageUploaderProps) {
  const [previews, setPreviews] = useState<Array<{ url: string; blur: string }>>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList) => {
    const validFiles: File[] = [];
    const newPreviews: Array<{ url: string; blur: string }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // 파일 검증
      if (!acceptedFormats.includes(file.type)) {
        toast.error(`${file.name}: 지원하지 않는 파일 형식입니다.`);
        continue;
      }
      
      if (file.size > maxSizeMB * 1024 * 1024) {
        toast.error(`${file.name}: 파일 크기가 ${maxSizeMB}MB를 초과합니다.`);
        continue;
      }

      // 이미지 처리
      try {
        const processedBlob = await processImage(file, {
          maxWidth: 1920,
          maxHeight: 1080,
          quality: 0.9,
        });
        
        const processedFile = new File([processedBlob], file.name, {
          type: processedBlob.type,
        });
        
        validFiles.push(processedFile);

        // 미리보기 생성
        const url = URL.createObjectURL(processedBlob);
        const blur = await generateBlurDataURL(file);
        newPreviews.push({ url, blur });
      } catch (error) {
        toast.error(`${file.name}: 이미지 처리 중 오류가 발생했습니다.`);
      }
    }

    if (validFiles.length > 0) {
      setPreviews((prev) => [...prev, ...newPreviews].slice(0, maxFiles));
      onUpload(validFiles);
    }
  }, [acceptedFormats, maxSizeMB, maxFiles, onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removePreview = useCallback((index: number) => {
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <div className="space-y-4">
      {/* 드래그 앤 드롭 영역 */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors duration-200
          ${isDragging 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedFormats.join(',')}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
        />
        
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        
        <p className="mt-2 text-sm text-gray-600">
          클릭하거나 이미지를 드래그하여 업로드
        </p>
        <p className="text-xs text-gray-500 mt-1">
          최대 {maxFiles}개, 각 {maxSizeMB}MB까지
        </p>
      </div>

      {/* 미리보기 */}
      {previews.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {previews.map((preview, index) => (
            <div key={index} className="relative group">
              <OptimizedImage
                src={preview.url}
                alt={`Preview ${index + 1}`}
                width={200}
                height={200}
                className="w-full h-32 object-cover rounded-lg"
                placeholder="blur"
                blurDataURL={preview.blur}
              />
              <button
                onClick={() => removePreview(index)}
                className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                aria-label="이미지 제거"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## 패키지 설치 명령어

```bash
# 추가로 필요한 패키지들
npm install zustand immer
npm install @tanstack/react-query @tanstack/react-query-devtools
npm install sharp
npm install react-toastify
```

이제 추가 기능들이 모두 구현되었습니다. 각 기능의 주요 특징:

1. **Zustand 확장**: UI, 장바구니, 위치 정보 스토어 추가
2. **React Query 확장**: 무한 스크롤, Optimistic Updates, 캐시 관리
3. **고급 위치 정보**: 실시간 위치 추적, 거리 계산
4. **보안 강화**: CSP, CSRF 보호, 미들웨어 인증
5. **이미지 최적화**: 자동 리사이징, 포맷 변환, 지연 로딩

이제 실제 페이지 구현을 시작할 준비가 완료되었습니다!