          this.db.raw(
            'ST_Distance(location, ST_MakePoint(?, ?)::geography) as distance',
            [location.lng, location.lat]
          )
        )
        .whereRaw(
          'ST_DWithin(location, ST_MakePoint(?, ?)::geography, ?)',
          [location.lng, location.lat, radius]
        )
        .orderBy('distance');
    } else {
      searchQuery = searchQuery
        .select(
          's.*',
          'm.name as myeon_name',
          'c.name as category_name'
        )
        .orderBy('s.created_at', 'desc');
    }

    const [stores, countResult] = await Promise.all([
      searchQuery.limit(limit).offset(offset),
      this.db('stores as s')
        .where('s.status', 'approved')
        .where(function() {
          this.where('s.name', 'ilike', `%${query}%`)
            .orWhere('s.description', 'ilike', `%${query}%`)
            .orWhere('s.address', 'ilike', `%${query}%`);
        })
        .count('* as total')
        .first(),
    ]);

    return {
      stores,
      total: parseInt(countResult?.total || '0'),
    };
  }

  // 근처 상점 조회
  async getNearbyStores(location: { lat: number; lng: number }, radius: number) {
    const stores = await this.db('stores as s')
      .leftJoin('myeons as m', 's.myeon_id', 'm.id')
      .leftJoin('categories as c', 's.category_id', 'c.id')
      .select(
        's.*',
        'm.name as myeon_name',
        'c.name as category_name',
        'c.icon as category_icon',
        this.db.raw(
          'ST_Distance(location, ST_MakePoint(?, ?)::geography) as distance',
          [location.lng, location.lat]
        )
      )
      .where('s.status', 'approved')
      .whereRaw(
        'ST_DWithin(location, ST_MakePoint(?, ?)::geography, ?)',
        [location.lng, location.lat, radius]
      )
      .orderBy('distance')
      .limit(50);

    return stores;
  }

  // 상점 상세 조회
  async getStoreById(storeId: string, userId?: string) {
    const store = await this.db('stores as s')
      .leftJoin('myeons as m', 's.myeon_id', 'm.id')
      .leftJoin('categories as c', 's.category_id', 'c.id')
      .leftJoin('users as u', 's.owner_id', 'u.id')
      .select(
        's.*',
        'm.name as myeon_name',
        'c.name as category_name',
        'c.icon as category_icon',
        'u.username as owner_name',
        'u.phone_number as owner_phone'
      )
      .where('s.id', storeId)
      .first();

    if (!store) {
      return null;
    }

    // 운영시간 조회
    const operatingHours = await this.db('store_operating_hours')
      .where('store_id', storeId)
      .orderBy('day_of_week');

    // 미디어 조회
    const media = await this.db('store_media')
      .where('store_id', storeId)
      .where('is_active', true)
      .orderBy('display_order');

    // 태그 조회
    const tags = await this.db('store_tags as st')
      .join('tags as t', 'st.tag_id', 't.id')
      .where('st.store_id', storeId)
      .select('t.id', 't.name', 't.slug');

    // 사용자가 좋아요 했는지 확인
    let isLiked = false;
    if (userId) {
      const like = await this.db('likes')
        .where({
          user_id: userId,
          target_type: 'store',
          target_id: storeId,
        })
        .first();
      isLiked = !!like;
    }

    return {
      ...store,
      operating_hours: operatingHours,
      media,
      tags,
      is_liked: isLiked,
    };
  }

  // 상점 생성
  async createStore(storeData: any) {
    return transaction(async (trx) => {
      // 주소로 좌표 조회
      const coordinates = await this.geocodeService.getCoordinates(
        storeData.address
      );

      // 상점 생성
      const [store] = await trx('stores')
        .insert({
          owner_id: storeData.ownerId,
          myeon_id: storeData.myeonId,
          category_id: storeData.categoryId,
          name: storeData.name,
          description: storeData.description,
          short_description: storeData.shortDescription,
          address: storeData.address,
          address_detail: storeData.addressDetail,
          postal_code: storeData.postalCode,
          latitude: coordinates.lat,
          longitude: coordinates.lng,
          location: trx.raw(
            'ST_MakePoint(?, ?)::geography',
            [coordinates.lng, coordinates.lat]
          ),
          phone_number: storeData.phoneNumber,
          mobile_number: storeData.mobileNumber,
          email: storeData.email,
          website_url: storeData.websiteUrl,
          business_hours_text: storeData.businessHoursText,
          regular_holiday: storeData.regularHoliday,
          bank_name: storeData.bankName,
          account_number: storeData.accountNumber,
          account_holder: storeData.accountHolder,
          main_image_url: storeData.mainImageUrl,
          notification_method: storeData.notificationMethod,
          notification_contact: storeData.notificationContact,
          status: 'pending', // 관리자 승인 대기
        })
        .returning('*');

      // 기본 운영시간 생성 (월-일, 09:00-18:00)
      const defaultOperatingHours = Array.from({ length: 7 }, (_, i) => ({
        store_id: store.id,
        day_of_week: i,
        open_time: '09:00',
        close_time: '18:00',
        is_closed: false,
      }));

      await trx('store_operating_hours').insert(defaultOperatingHours);

      // 사용자 역할 업데이트
      await trx('users')
        .where('id', storeData.ownerId)
        .update({ role: 'store_owner' });

      return store;
    });
  }

  // 상점 수정
  async updateStore(storeId: string, updateData: any) {
    return transaction(async (trx) => {
      // 주소가 변경된 경우 좌표 업데이트
      if (updateData.address) {
        const coordinates = await this.geocodeService.getCoordinates(
          updateData.address
        );
        updateData.latitude = coordinates.lat;
        updateData.longitude = coordinates.lng;
        updateData.location = trx.raw(
          'ST_MakePoint(?, ?)::geography',
          [coordinates.lng, coordinates.lat]
        );
      }

      const [updatedStore] = await trx('stores')
        .where('id', storeId)
        .update({
          ...updateData,
          updated_at: new Date(),
        })
        .returning('*');

      return updatedStore;
    });
  }

  // 상점 삭제
  async deleteStore(storeId: string) {
    return transaction(async (trx) => {
      // 관련 데이터 삭제는 CASCADE로 자동 처리
      await trx('stores').where('id', storeId).delete();
    });
  }

  // 권한 확인
  async checkStorePermission(
    storeId: string,
    userId: string,
    userRole: string
  ): Promise<boolean> {
    if (userRole === 'admin' || userRole === 'super_admin') {
      return true;
    }

    const store = await this.db('stores')
      .where({ id: storeId, owner_id: userId })
      .first();

    return !!store;
  }

  // 조회수 증가
  async incrementViewCount(storeId: string) {
    await this.db('stores')
      .where('id', storeId)
      .increment('view_count', 1);
  }

  // 상점 메뉴 조회
  async getStoreMenus(storeId: string, filters: any) {
    let query = this.db('menus')
      .where('store_id', storeId)
      .orderBy('display_order')
      .orderBy('created_at', 'desc');

    if (filters.category) {
      query = query.where('category_name', filters.category);
    }

    if (filters.isAvailable !== undefined) {
      query = query.where('is_available', filters.isAvailable);
    }

    return query;
  }

  // 상점 리뷰 조회
  async getStoreReviews(storeId: string, options: any) {
    const { page, limit, sort, order } = options;
    const offset = getOffset(page, limit);

    const query = this.db('reviews as r')
      .join('users as u', 'r.user_id', 'u.id')
      .where('r.store_id', storeId)
      .where('r.is_visible', true)
      .select(
        'r.*',
        'u.username',
        'u.profile_image_url'
      );

    // 정렬
    const validSortFields = {
      created_at: 'r.created_at',
      rating: 'r.rating',
      likes: 'r.like_count',
    };
    const sortField = validSortFields[sort] || 'r.created_at';
    query.orderBy(sortField, order);

    const [reviews, countResult] = await Promise.all([
      query.limit(limit).offset(offset),
      this.db('reviews')
        .where('store_id', storeId)
        .where('is_visible', true)
        .count('* as total')
        .first(),
    ]);

    return {
      reviews,
      total: parseInt(countResult?.total || '0'),
    };
  }

  // 상점 미디어 업로드
  async uploadStoreMedia(storeId: string, mediaData: any[]) {
    const mediaRecords = mediaData.map((media, index) => ({
      store_id: storeId,
      media_type: media.mediaType,
      media_url: media.mediaUrl,
      title: media.title,
      description: media.description,
      display_order: index,
    }));

    return this.db('store_media').insert(mediaRecords).returning('*');
  }

  // 상점 미디어 삭제
  async deleteStoreMedia(storeId: string, mediaId: string) {
    const deleted = await this.db('store_media')
      .where({ id: mediaId, store_id: storeId })
      .delete();

    if (!deleted) {
      throw new AppError('미디어를 찾을 수 없습니다.', 404);
    }
  }

  // 운영시간 업데이트
  async updateOperatingHours(storeId: string, operatingHours: any[]) {
    return transaction(async (trx) => {
      // 기존 운영시간 삭제
      await trx('store_operating_hours')
        .where('store_id', storeId)
        .delete();

      // 새 운영시간 추가
      const records = operatingHours.map(hour => ({
        store_id: storeId,
        ...hour,
      }));

      await trx('store_operating_hours').insert(records);
    });
  }

  // 좋아요
  async likeStore(storeId: string, userId: string) {
    return transaction(async (trx) => {
      // 중복 확인
      const existing = await trx('likes')
        .where({
          user_id: userId,
          target_type: 'store',
          target_id: storeId,
        })
        .first();

      if (existing) {
        throw new AppError('이미 좋아요를 눌렀습니다.', 409);
      }

      // 좋아요 추가
      await trx('likes').insert({
        user_id: userId,
        target_type: 'store',
        target_id: storeId,
      });

      // 카운트 증가
      await trx('stores')
        .where('id', storeId)
        .increment('like_count', 1);
    });
  }

  // 좋아요 취소
  async unlikeStore(storeId: string, userId: string) {
    return transaction(async (trx) => {
      const deleted = await trx('likes')
        .where({
          user_id: userId,
          target_type: 'store',
          target_id: storeId,
        })
        .delete();

      if (!deleted) {
        throw new AppError('좋아요를 누르지 않았습니다.', 404);
      }

      // 카운트 감소
      await trx('stores')
        .where('id', storeId)
        .decrement('like_count', 1);
    });
  }
}
`;

// src/types/index.ts - TypeScript 타입 정의
const typesIndexTs = `
// 사용자 관련 타입
export interface User {
  id: string;
  kakaoId?: string;
  username: string;
  email: string;
  phoneNumber: string;
  profileImageUrl?: string;
  role: 'user' | 'store_owner' | 'admin' | 'super_admin';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface JWTPayload {
  id: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

// 상점 관련 타입
export interface Store {
  id: string;
  ownerId: string;
  myeonId: number;
  categoryId: number;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  address: string;
  addressDetail?: string;
  postalCode?: string;
  latitude: number;
  longitude: number;
  phoneNumber: string;
  mobileNumber?: string;
  email?: string;
  websiteUrl?: string;
  businessHoursText?: string;
  regularHoliday?: string;
  mainImageUrl?: string;
  logoImageUrl?: string;
  status: 'pending' | 'approved' | 'suspended' | 'closed';
  isFeatured: boolean;
  viewCount: number;
  likeCount: number;
  reviewCount: number;
  averageRating: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface OperatingHours {
  id: number;
  storeId: string;
  dayOfWeek: number; // 0-6 (일-토)
  openTime: string;
  closeTime: string;
  isClosed: boolean;
  breakStartTime?: string;
  breakEndTime?: string;
  lastOrderTime?: string;
}

// 메뉴 관련 타입
export interface Menu {
  id: string;
  storeId: string;
  categoryName?: string;
  name: string;
  description?: string;
  price: number;
  discountedPrice?: number;
  options?: MenuOption[];
  imageUrl?: string;
  isAvailable: boolean;
  isPopular: boolean;
  isNew: boolean;
  stockQuantity?: number;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MenuOption {
  name: string;
  choices: {
    name: string;
    price: number;
  }[];
}

// 예약 관련 타입
export interface Reservation {
  id: string;
  storeId: string;
  userId?: string;
  reserverName: string;
  reserverPhone: string;
  reserverEmail?: string;
  reservationDate: Date;
  reservationTime: string;
  numberOfPeople: number;
  reservationItems?: ReservationItem[];
  totalAmount: number;
  depositAmount: number;
  specialRequests?: string;
  discountInfo?: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  cancelledBy?: 'user' | 'store' | 'admin' | 'system';
  cancellationReason?: string;
  confirmedAt?: Date;
  cancelledAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReservationItem {
  menuId: string;
  quantity: number;
  price: number;
  options?: any;
}

// 리뷰 관련 타입
export interface Review {
  id: string;
  storeId: string;
  userId: string;
  reservationId?: string;
  rating: number;
  content: string;
  images?: ReviewImage[];
  replyContent?: string;
  replyAt?: Date;
  likeCount: number;
  dislikeCount: number;
  isVerifiedPurchase: boolean;
  isVisible: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewImage {
  url: string;
  caption?: string;
}

// API 응답 타입
export interface ApiResponse<T = any> {
  status: 'success' | 'error';
  message?: string;
  data?: T;
  errors?: any[];
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// 요청 타입 확장
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
      file?: Express.Multer.File;
      files?: Express.Multer.File[];
    }
  }
}
`;

// README.md - 프로젝트 설명서
const readmeMd = `
# 진안군 장터 앱 백엔드 API

## 개요
진안군 장터 앱의 백엔드 API 서버입니다. Node.js, Express.js, TypeScript를 기반으로 구축되었습니다.

## 주요 기능
- 카카오 OAuth 인증
- 상점 및 메뉴 관리
- 예약 시스템
- 리뷰 및 평점
- 위치 기반 검색
- 실시간 알림
- 관리자 대시보드 API

## 기술 스택
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL 15+ with PostGIS
- **Cache**: Redis
- **File Storage**: AWS S3
- **Authentication**: JWT + Kakao OAuth
- **Validation**: Joi
- **ORM**: Knex.js

## 시작하기

### 필수 요구사항
- Node.js 18+
- PostgreSQL 15+
- Redis
- AWS 계정 (S3)
- 카카오 개발자 계정

### 설치
\`\`\`bash
# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env
# .env 파일 수정

# 데이터베이스 마이그레이션
npm run db:migrate

# 시드 데이터 추가
npm run db:seed
\`\`\`

### 개발 서버 실행
\`\`\`bash
npm run dev
\`\`\`

### 프로덕션 빌드
\`\`\`bash
npm run build
npm start
\`\`\`

## API 문서

### 인증
- POST /api/v1/auth/login - 로그인
- POST /api/v1/auth/kakao - 카카오 로그인
- POST /api/v1/auth/refresh - 토큰 갱신
- POST /api/v1/auth/logout - 로그아웃

### 상점
- GET /api/v1/stores - 상점 목록
- GET /api/v1/stores/search - 상점 검색
- GET /api/v1/stores/nearby - 근처 상점
- GET /api/v1/stores/:id - 상점 상세
- POST /api/v1/stores - 상점 등록
- PUT /api/v1/stores/:id - 상점 수정
- DELETE /api/v1/stores/:id - 상점 삭제

### 메뉴
- GET /api/v1/stores/:storeId/menus - 메뉴 목록
- POST /api/v1/menus - 메뉴 추가
- PUT /api/v1/menus/:id - 메뉴 수정
- DELETE /api/v1/menus/:id - 메뉴 삭제

### 예약
- GET /api/v1/reservations - 예약 목록
- POST /api/v1/reservations - 예약 생성
- PUT /api/v1/reservations/:id - 예약 수정
- DELETE /api/v1/reservations/:id - 예약 취소

## 보안
- Helmet.js를 통한 보안 헤더
- Rate limiting
- Input validation
- SQL injection 방지
- XSS 방지
- CORS 설정

## 모니터링
- Winston 로깅
- 일별 로그 로테이션
- 상태 체크 엔드포인트 (/health)

## 테스트
\`\`\`bash
# 단위 테스트
npm test

# 테스트 감시 모드
npm run test:watch
\`\`\`

## 배포
- Docker 지원
- PM2 설정 포함
- 환경별 설정 분리
- Graceful shutdown

## 라이센스
MIT
`;

console.log('API 라우트 및 컨트롤러 예시가 추가되었습니다.');
// =============================================
// API 라우트 및 컨트롤러 예시
// =============================================

// src/routes/store.routes.ts - 상점 라우트
const storeRoutesTs = `
import { Router } from 'express';
import { StoreController } from '../controllers/store.controller';
import { authenticate, authorize, optionalAuth } from '../middlewares/auth';
import { validate, validateParams, validateQuery } from '../middlewares/validation';
import { storeSchemas } from '../validations/store.validation';
import { upload } from '../middlewares/upload';

const router = Router();
const storeController = new StoreController();

// Public routes
router.get(
  '/',
  validateQuery(storeSchemas.listStores),
  storeController.listStores
);

router.get(
  '/search',
  validateQuery(storeSchemas.searchStores),
  storeController.searchStores
);

router.get(
  '/nearby',
  validateQuery(storeSchemas.nearbyStores),
  storeController.getNearbyStores
);

router.get(
  '/:storeId',
  validateParams(storeSchemas.storeId),
  optionalAuth,
  storeController.getStore
);

router.get(
  '/:storeId/menus',
  validateParams(storeSchemas.storeId),
  storeController.getStoreMenus
);

router.get(
  '/:storeId/reviews',
  validateParams(storeSchemas.storeId),
  validateQuery(storeSchemas.listReviews),
  storeController.getStoreReviews
);

// Protected routes (로그인 필요)
router.post(
  '/',
  authenticate,
  upload.single('mainImage'),
  validate(storeSchemas.createStore),
  storeController.createStore
);

router.put(
  '/:storeId',
  authenticate,
  authorize('store_owner', 'admin'),
  validateParams(storeSchemas.storeId),
  validate(storeSchemas.updateStore),
  storeController.updateStore
);

router.delete(
  '/:storeId',
  authenticate,
  authorize('store_owner', 'admin'),
  validateParams(storeSchemas.storeId),
  storeController.deleteStore
);

// 상점 미디어 관리
router.post(
  '/:storeId/media',
  authenticate,
  authorize('store_owner', 'admin'),
  validateParams(storeSchemas.storeId),
  upload.array('files', 10),
  storeController.uploadStoreMedia
);

router.delete(
  '/:storeId/media/:mediaId',
  authenticate,
  authorize('store_owner', 'admin'),
  validateParams(storeSchemas.deleteMedia),
  storeController.deleteStoreMedia
);

// 상점 운영시간 관리
router.put(
  '/:storeId/operating-hours',
  authenticate,
  authorize('store_owner', 'admin'),
  validateParams(storeSchemas.storeId),
  validate(storeSchemas.updateOperatingHours),
  storeController.updateOperatingHours
);

// 좋아요 기능
router.post(
  '/:storeId/like',
  authenticate,
  validateParams(storeSchemas.storeId),
  storeController.likeStore
);

router.delete(
  '/:storeId/like',
  authenticate,
  validateParams(storeSchemas.storeId),
  storeController.unlikeStore
);

export const storeRouter = router;
`;

// src/controllers/store.controller.ts - 상점 컨트롤러
const storeControllerTs = `
import { Request, Response } from 'express';
import { StoreService } from '../services/store.service';
import { AuthRequest } from '../middlewares/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/appError';
import { getPaginationOptions, paginate } from '../utils/pagination';
import { Cache } from '../services/redis';
import { logger } from '../utils/logger';

export class StoreController {
  private storeService: StoreService;

  constructor() {
    this.storeService = new StoreService();
  }

  // 상점 목록 조회
  listStores = asyncHandler(async (req: Request, res: Response) => {
    const options = getPaginationOptions(req.query);
    const filters = {
      myeonId: req.query.myeonId,
      categoryId: req.query.categoryId,
      status: req.query.status || 'approved',
      isFeatured: req.query.featured === 'true',
    };

    // 캐시 키 생성
    const cacheKey = \`stores:list:\${JSON.stringify({ options, filters })}\`;
    
    // 캐시 확인
    const cached = await Cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // 데이터 조회
    const { stores, total } = await this.storeService.getStores(
      filters,
      options
    );

    const result = paginate(stores, total, options);

    // 캐시 저장 (5분)
    await Cache.set(cacheKey, result, 300);

    res.json(result);
  });

  // 상점 검색
  searchStores = asyncHandler(async (req: Request, res: Response) => {
    const { q, lat, lng, radius } = req.query;
    const options = getPaginationOptions(req.query);

    if (!q || typeof q !== 'string') {
      throw new AppError('검색어를 입력해주세요.', 400);
    }

    const searchOptions = {
      query: q,
      location: lat && lng ? { lat: Number(lat), lng: Number(lng) } : undefined,
      radius: radius ? Number(radius) : 5000, // 기본 5km
    };

    const { stores, total } = await this.storeService.searchStores(
      searchOptions,
      options
    );

    const result = paginate(stores, total, options);
    res.json(result);
  });

  // 근처 상점 조회
  getNearbyStores = asyncHandler(async (req: Request, res: Response) => {
    const { lat, lng, radius } = req.query;

    if (!lat || !lng) {
      throw new AppError('위치 정보가 필요합니다.', 400);
    }

    const location = {
      lat: Number(lat),
      lng: Number(lng),
    };
    const searchRadius = Number(radius) || 3000; // 기본 3km

    const stores = await this.storeService.getNearbyStores(
      location,
      searchRadius
    );

    res.json({
      data: stores,
      meta: {
        total: stores.length,
        location,
        radius: searchRadius,
      },
    });
  });

  // 상점 상세 조회
  getStore = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { storeId } = req.params;
    const userId = req.user?.id;

    const store = await this.storeService.getStoreById(storeId, userId);

    if (!store) {
      throw new AppError('상점을 찾을 수 없습니다.', 404);
    }

    // 조회수 증가 (비동기)
    this.storeService.incrementViewCount(storeId).catch(err => {
      logger.error('Failed to increment view count:', err);
    });

    res.json({ data: store });
  });

  // 상점 생성
  createStore = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const storeData = {
      ...req.body,
      ownerId: userId,
      mainImageUrl: req.file ? req.file.location : undefined,
    };

    const store = await this.storeService.createStore(storeData);

    // 캐시 무효화
    await Cache.invalidate('stores:list:*');

    res.status(201).json({
      message: '상점이 등록되었습니다. 관리자 승인 후 노출됩니다.',
      data: store,
    });
  });

  // 상점 수정
  updateStore = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { storeId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // 권한 확인
    const hasPermission = await this.storeService.checkStorePermission(
      storeId,
      userId,
      userRole
    );

    if (!hasPermission) {
      throw new AppError('상점을 수정할 권한이 없습니다.', 403);
    }

    const updatedStore = await this.storeService.updateStore(
      storeId,
      req.body
    );

    // 캐시 무효화
    await Cache.invalidate(\`stores:*\${storeId}*\`);

    res.json({
      message: '상점 정보가 수정되었습니다.',
      data: updatedStore,
    });
  });

  // 상점 삭제
  deleteStore = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { storeId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // 권한 확인
    const hasPermission = await this.storeService.checkStorePermission(
      storeId,
      userId,
      userRole
    );

    if (!hasPermission) {
      throw new AppError('상점을 삭제할 권한이 없습니다.', 403);
    }

    await this.storeService.deleteStore(storeId);

    // 캐시 무효화
    await Cache.invalidate('stores:*');

    res.json({
      message: '상점이 삭제되었습니다.',
    });
  });

  // 상점 메뉴 조회
  getStoreMenus = asyncHandler(async (req: Request, res: Response) => {
    const { storeId } = req.params;
    const { category, available } = req.query;

    const filters = {
      category: category as string,
      isAvailable: available === 'true',
    };

    const menus = await this.storeService.getStoreMenus(storeId, filters);

    res.json({
      data: menus,
      meta: {
        total: menus.length,
      },
    });
  });

  // 상점 리뷰 조회
  getStoreReviews = asyncHandler(async (req: Request, res: Response) => {
    const { storeId } = req.params;
    const options = getPaginationOptions(req.query);

    const { reviews, total } = await this.storeService.getStoreReviews(
      storeId,
      options
    );

    const result = paginate(reviews, total, options);
    res.json(result);
  });

  // 상점 미디어 업로드
  uploadStoreMedia = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { storeId } = req.params;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      throw new AppError('업로드할 파일이 없습니다.', 400);
    }

    const media = await this.storeService.uploadStoreMedia(
      storeId,
      files.map(file => ({
        mediaType: file.mimetype.startsWith('video/') ? 'video' : 'image',
        mediaUrl: file.location,
        title: req.body.title,
        description: req.body.description,
      }))
    );

    res.json({
      message: '미디어가 업로드되었습니다.',
      data: media,
    });
  });

  // 상점 미디어 삭제
  deleteStoreMedia = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { storeId, mediaId } = req.params;

    await this.storeService.deleteStoreMedia(storeId, mediaId);

    res.json({
      message: '미디어가 삭제되었습니다.',
    });
  });

  // 운영시간 수정
  updateOperatingHours = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { storeId } = req.params;
    const { operatingHours } = req.body;

    await this.storeService.updateOperatingHours(storeId, operatingHours);

    res.json({
      message: '운영시간이 수정되었습니다.',
    });
  });

  // 좋아요
  likeStore = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { storeId } = req.params;
    const userId = req.user!.id;

    await this.storeService.likeStore(storeId, userId);

    res.json({
      message: '좋아요를 눌렀습니다.',
    });
  });

  // 좋아요 취소
  unlikeStore = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { storeId } = req.params;
    const userId = req.user!.id;

    await this.storeService.unlikeStore(storeId, userId);

    res.json({
      message: '좋아요를 취소했습니다.',
    });
  });
}
`;

// src/validations/store.validation.ts - 유효성 검사 스키마
const storeValidationTs = `
import joi from 'joi';

export const storeSchemas = {
  // 상점 ID 파라미터
  storeId: joi.object({
    storeId: joi.string().uuid().required(),
  }),

  // 상점 목록 조회
  listStores: joi.object({
    page: joi.number().min(1).default(1),
    limit: joi.number().min(1).max(100).default(20),
    myeonId: joi.number().min(1),
    categoryId: joi.number().min(1),
    status: joi.string().valid('pending', 'approved', 'suspended', 'closed'),
    featured: joi.boolean(),
    sort: joi.string().valid('created_at', 'name', 'rating', 'review_count'),
    order: joi.string().valid('asc', 'desc').default('desc'),
  }),

  // 상점 검색
  searchStores: joi.object({
    q: joi.string().min(1).required(),
    page: joi.number().min(1).default(1),
    limit: joi.number().min(1).max(100).default(20),
    lat: joi.number().min(-90).max(90),
    lng: joi.number().min(-180).max(180),
    radius: joi.number().min(100).max(50000),
  }),

  // 근처 상점
  nearbyStores: joi.object({
    lat: joi.number().min(-90).max(90).required(),
    lng: joi.number().min(-180).max(180).required(),
    radius: joi.number().min(100).max(50000).default(3000),
  }),

  // 상점 생성
  createStore: joi.object({
    name: joi.string().min(2).max(200).required(),
    description: joi.string().max(2000).required(),
    shortDescription: joi.string().max(500),
    myeonId: joi.number().required(),
    categoryId: joi.number().required(),
    address: joi.string().max(500).required(),
    addressDetail: joi.string().max(200),
    postalCode: joi.string().pattern(/^[0-9]{5}$/),
    phoneNumber: joi.string()
      .pattern(/^[0-9]{2,3}-[0-9]{3,4}-[0-9]{4}$/)
      .required(),
    mobileNumber: joi.string()
      .pattern(/^[0-9]{3}-[0-9]{3,4}-[0-9]{4}$/),
    email: joi.string().email(),
    websiteUrl: joi.string().uri(),
    businessHoursText: joi.string().max(500),
    regularHoliday: joi.string().max(200),
    bankName: joi.string().max(50),
    accountNumber: joi.string().max(50),
    accountHolder: joi.string().max(100),
    notificationMethod: joi.string()
      .valid('sms', 'lms', 'mms', 'kakao')
      .default('sms'),
    notificationContact: joi.string().max(100),
  }),

  // 상점 수정
  updateStore: joi.object({
    name: joi.string().min(2).max(200),
    description: joi.string().max(2000),
    shortDescription: joi.string().max(500),
    categoryId: joi.number(),
    address: joi.string().max(500),
    addressDetail: joi.string().max(200),
    postalCode: joi.string().pattern(/^[0-9]{5}$/),
    phoneNumber: joi.string()
      .pattern(/^[0-9]{2,3}-[0-9]{3,4}-[0-9]{4}$/),
    mobileNumber: joi.string()
      .pattern(/^[0-9]{3}-[0-9]{3,4}-[0-9]{4}$/),
    email: joi.string().email(),
    websiteUrl: joi.string().uri(),
    businessHoursText: joi.string().max(500),
    regularHoliday: joi.string().max(200),
    bankName: joi.string().max(50),
    accountNumber: joi.string().max(50),
    accountHolder: joi.string().max(100),
    notificationMethod: joi.string()
      .valid('sms', 'lms', 'mms', 'kakao'),
    notificationContact: joi.string().max(100),
    mainImageUrl: joi.string().uri(),
    logoImageUrl: joi.string().uri(),
  }).min(1),

  // 운영시간 수정
  updateOperatingHours: joi.object({
    operatingHours: joi.array().items(
      joi.object({
        dayOfWeek: joi.number().min(0).max(6).required(),
        openTime: joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
        closeTime: joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
        isClosed: joi.boolean(),
        breakStartTime: joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
        breakEndTime: joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
        lastOrderTime: joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      })
    ).min(7).max(7).required(),
  }),

  // 리뷰 목록
  listReviews: joi.object({
    page: joi.number().min(1).default(1),
    limit: joi.number().min(1).max(100).default(20),
    rating: joi.number().min(1).max(5),
    verified: joi.boolean(),
    sort: joi.string().valid('created_at', 'rating', 'likes'),
    order: joi.string().valid('asc', 'desc').default('desc'),
  }),

  // 미디어 삭제
  deleteMedia: joi.object({
    storeId: joi.string().uuid().required(),
    mediaId: joi.string().uuid().required(),
  }),
};
`;

// src/services/store.service.ts - 상점 서비스 (비즈니스 로직)
const storeServiceTs = `
import { Knex } from 'knex';
import { Database, transaction } from '../database';
import { AppError } from '../utils/appError';
import { getOffset } from '../utils/pagination';
import { GeocodeService } from './geocode.service';
import { logger } from '../utils/logger';

interface StoreFilters {
  myeonId?: string;
  categoryId?: string;
  status?: string;
  isFeatured?: boolean;
}

interface SearchOptions {
  query: string;
  location?: { lat: number; lng: number };
  radius?: number;
}

export class StoreService {
  private db: Knex;
  private geocodeService: GeocodeService;

  constructor() {
    this.db = Database.getConnection();
    this.geocodeService = new GeocodeService();
  }

  // 상점 목록 조회
  async getStores(filters: StoreFilters, options: any) {
    const { page, limit, sort, order } = options;
    const offset = getOffset(page, limit);

    let query = this.db('stores as s')
      .leftJoin('myeons as m', 's.myeon_id', 'm.id')
      .leftJoin('categories as c', 's.category_id', 'c.id')
      .select(
        's.id',
        's.name',
        's.slug',
        's.short_description',
        's.address',
        's.main_image_url',
        's.average_rating',
        's.review_count',
        's.is_featured',
        'm.name as myeon_name',
        'c.name as category_name',
        'c.icon as category_icon'
      );

    // 필터 적용
    if (filters.myeonId) {
      query = query.where('s.myeon_id', filters.myeonId);
    }
    if (filters.categoryId) {
      query = query.where('s.category_id', filters.categoryId);
    }
    if (filters.status) {
      query = query.where('s.status', filters.status);
    }
    if (filters.isFeatured !== undefined) {
      query = query.where('s.is_featured', filters.isFeatured);
    }

    // 정렬
    const validSortFields = {
      created_at: 's.created_at',
      name: 's.name',
      rating: 's.average_rating',
      review_count: 's.review_count',
    };
    const sortField = validSortFields[sort] || 's.created_at';
    query = query.orderBy(sortField, order);

    // 페이지네이션
    const [stores, countResult] = await Promise.all([
      query.limit(limit).offset(offset),
      this.db('stores as s')
        .where((builder) => {
          if (filters.myeonId) builder.where('s.myeon_id', filters.myeonId);
          if (filters.categoryId) builder.where('s.category_id', filters.categoryId);
          if (filters.status) builder.where('s.status', filters.status);
          if (filters.isFeatured !== undefined) builder.where('s.is_featured', filters.isFeatured);
        })
        .count('* as total')
        .first(),
    ]);

    return {
      stores,
      total: parseInt(countResult?.total || '0'),
    };
  }

  // 상점 검색
  async searchStores(searchOptions: SearchOptions, paginationOptions: any) {
    const { query, location, radius } = searchOptions;
    const { page, limit } = paginationOptions;
    const offset = getOffset(page, limit);

    let searchQuery = this.db('stores as s')
      .leftJoin('myeons as m', 's.myeon_id', 'm.id')
      .leftJoin('categories as c', 's.category_id', 'c.id')
      .where('s.status', 'approved')
      .where(function() {
        this.where('s.name', 'ilike', \`%\${query}%\`)
          .orWhere('s.description', 'ilike', \`%\${query}%\`)
          .orWhere('s.address', 'ilike', \`%\${query}%\`);
      });

    // 위치 기반 검색
    if (location) {
      searchQuery = searchQuery
        .select(
          's.*',
          'm.name as myeon_name',
          'c.name as category_name',
          this.db.raw(
            'ST_Distance(location, ST_MakePoint(?, ?)::geography) as distance',
            [location.lng, location.lat]
          )
        )
        .whereRaw(
          'ST_DWithin(location, ST_MakePoint(?, ?)::geography, ?)',
          [location.lng, location.lat, radius]
        )
        .orderBy('distance');
          