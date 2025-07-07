// tests/reservation.service.test.ts
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ReservationService } from '../services/reservation.service';
import { CreateReservationDTO, ReservationStatus } from '../types/reservation.types';

describe('ReservationService', () => {
  let reservationService: ReservationService;
  let mockDb: any;
  let mockRedis: any;
  let mockNotificationService: any;
  let mockCacheService: any;

  beforeEach(() => {
    // Mock 설정
    mockDb = {
      connect: jest.fn().mockResolvedValue({
        query: jest.fn(),
        release: jest.fn()
      }),
      query: jest.fn()
    };

    mockRedis = {
      publish: jest.fn(),
      setex: jest.fn()
    };

    mockNotificationService = {
      send: jest.fn().mockResolvedValue(true)
    };

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      invalidate: jest.fn()
    };

    reservationService = new ReservationService(
      mockDb,
      mockRedis,
      mockNotificationService,
      mockCacheService
    );
  });

  describe('createReservation', () => {
    it('should create a reservation successfully', async () => {
      const mockReservationData: CreateReservationDTO = {
        store_id: 'store123',
        reserver_name: '김진안',
        reserver_phone_number: '010-1234-5678',
        reservation_date: '2025-01-20',
        reservation_time: '18:00',
        number_of_people: 4,
        request_notes: '창가 자리 부탁드립니다'
      };

      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };

      mockDb.connect.mockResolvedValue(mockClient);
      
      // Mock store query
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          id: 'store123',
          name: '진안맛집',
          owner_notification_contact: '010-9876-5432',
          owner_notification_method: 'sms'
        }]
      });

      // Mock reservation insert
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          id: 'reservation123',
          ...mockReservationData,
          status: 'pending',
          created_at: new Date()
        }]
      });

      const result = await reservationService.createReservation(mockReservationData);

      expect(result).toBeDefined();
      expect(result.status).toBe('pending');
      expect(mockNotificationService.send).toHaveBeenCalledTimes(2); // 가게주인 + 고객
    });

    it('should throw error for invalid time slot', async () => {
      const mockReservationData: CreateReservationDTO = {
        store_id: 'store123',
        reserver_name: '김진안',
        reserver_phone_number: '010-1234-5678',
        reservation_date: '2025-01-20',
        reservation_time: '22:00', // 영업시간 외
        number_of_people: 4
      };

      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };

      mockDb.connect.mockResolvedValue(mockClient);
      
      // Mock store query with operating hours
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          id: 'store123',
          name: '진안맛집',
          day_of_week: '월',
          open_time: '10:00',
          close_time: '21:00',
          is_closed: false
        }]
      });

      await expect(
        reservationService.createReservation(mockReservationData)
      ).rejects.toThrow('Reservation time is outside operating hours');
    });
  });

  describe('updateReservation', () => {
    it('should update reservation status', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };

      mockDb.connect.mockResolvedValue(mockClient);
      
      // Mock existing reservation
      mockCacheService.get.mockResolvedValue(null);
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'reservation123',
          status: 'pending',
          store_id: 'store123',
          user_id: 'user123'
        }]
      });

      // Mock update query
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          id: 'reservation123',
          status: 'confirmed',
          confirmed_at: new Date()
        }]
      });

      // Mock store query for notification
      mockClient.query.mockResolvedValueOnce({
        rows: [{ name: '진안맛집' }]
      });

      const result = await reservationService.updateReservation(
        'reservation123',
        { status: ReservationStatus.CONFIRMED },
        'user123'
      );

      expect(result.status).toBe('confirmed');
      expect(result.confirmed_at).toBeDefined();
    });
  });

  describe('getAvailableTimeSlots', () => {
    it('should return available time slots', async () => {
      mockCacheService.get.mockResolvedValue(null);
      
      // Mock operating hours
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          open_time: '10:00',
          close_time: '20:00',
          is_closed: false
        }]
      });

      // Mock existing reservations
      mockDb.query.mockResolvedValueOnce({
        rows: [
          { reservation_time: '12:00' },
          { reservation_time: '18:00' }
        ]
      });

      const slots = await reservationService.getAvailableTimeSlots(
        'store123',
        '2025-01-20'
      );

      expect(slots).toContain('10:00');
      expect(slots).toContain('10:30');
      expect(slots).not.toContain('12:00'); // 이미 예약됨
      expect(slots).not.toContain('11:30'); // 12:00 예약과 2시간 이내
    });
  });
});

// API 문서 (OpenAPI 3.0 스펙)
/**
 * @openapi
 * openapi: 3.0.0
 * info:
 *   title: 진안군 장터 예약 시스템 API
 *   version: 1.0.0
 *   description: 진안군 장터 앱의 예약 관리를 위한 RESTful API
 * 
 * servers:
 *   - url: https://api.jinan-market.kr/v1
 *     description: Production server
 *   - url: http://localhost:3000/api/v1
 *     description: Development server
 * 
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 * 
 *   schemas:
 *     Reservation:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         store_id:
 *           type: string
 *           format: uuid
 *         reserver_name:
 *           type: string
 *         reserver_phone_number:
 *           type: string
 *         reservation_date:
 *           type: string
 *           format: date
 *         reservation_time:
 *           type: string
 *           format: time
 *         number_of_people:
 *           type: integer
 *         status:
 *           type: string
 *           enum: [pending, confirmed, cancelled, completed, no_show]
 *         menu_items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ReservationMenuItem'
 * 
 *     ReservationMenuItem:
 *       type: object
 *       properties:
 *         menu_id:
 *           type: string
 *         menu_name:
 *           type: string
 *         quantity:
 *           type: integer
 *         price:
 *           type: number
 * 
 *     CreateReservationRequest:
 *       type: object
 *       required:
 *         - store_id
 *         - reserver_name
 *         - reserver_phone_number
 *         - reservation_date
 *         - reservation_time
 *         - number_of_people
 *       properties:
 *         store_id:
 *           type: string
 *         reserver_name:
 *           type: string
 *         reserver_phone_number:
 *           type: string
 *         reservation_date:
 *           type: string
 *           format: date
 *         reservation_time:
 *           type: string
 *           pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$'
 *         number_of_people:
 *           type: integer
 *           minimum: 1
 *         menu_items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               menu_id:
 *                 type: string
 *               quantity:
 *                 type: integer
 * 
 * paths:
 *   /reservations:
 *     post:
 *       summary: 예약 생성
 *       tags:
 *         - Reservations
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateReservationRequest'
 *       responses:
 *         201:
 *           description: 예약이 성공적으로 생성됨
 *         400:
 *           description: 잘못된 요청
 *         409:
 *           description: 예약 시간 충돌
 * 
 *     get:
 *       summary: 예약 목록 조회
 *       tags:
 *         - Reservations
 *       security:
 *         - bearerAuth: []
 *       parameters:
 *         - name: store_id
 *           in: query
 *           schema:
 *             type: string
 *         - name: status
 *           in: query
 *           schema:
 *             type: string
 *             enum: [pending, confirmed, cancelled, completed, no_show]
 *         - name: date_from
 *           in: query
 *           schema:
 *             type: string
 *             format: date
 *         - name: date_to
 *           in: query
 *           schema:
 *             type: string
 *             format: date
 *       responses:
 *         200:
 *           description: 예약 목록
 * 
 *   /reservations/{id}:
 *     get:
 *       summary: 예약 상세 조회
 *       tags:
 *         - Reservations
 *       security:
 *         - bearerAuth: []
 *       parameters:
 *         - name: id
 *           in: path
 *           required: true
 *           schema:
 *             type: string
 *       responses:
 *         200:
 *           description: 예약 정보
 *         404:
 *           description: 예약을 찾을 수 없음
 * 
 *     patch:
 *       summary: 예약 수정
 *       tags:
 *         - Reservations
 *       security:
 *         - bearerAuth: []
 *       parameters:
 *         - name: id
 *           in: path
 *           required: true
 *           schema:
 *             type: string
 *       responses:
 *         200:
 *           description: 예약이 수정됨
 * 
 *   /reservations/{id}/cancel:
 *     post:
 *       summary: 예약 취소
 *       tags:
 *         - Reservations
 *       security:
 *         - bearerAuth: []
 *       parameters:
 *         - name: id
 *           in: path
 *           required: true
 *           schema:
 *             type: string
 *       requestBody:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reason:
 *                   type: string
 *       responses:
 *         200:
 *           description: 예약이 취소됨
 * 
 *   /stores/{storeId}/available-slots:
 *     get:
 *       summary: 예약 가능 시간 조회
 *       tags:
 *         - Reservations
 *       parameters:
 *         - name: storeId
 *           in: path
 *           required: true
 *           schema:
 *             type: string
 *         - name: date
 *           in: query
 *           required: true
 *           schema:
 *             type: string
 *             format: date
 *       responses:
 *         200:
 *           description: 예약 가능한 시간 목록
 *           content:
 *             application/json:
 *               schema:
 *                 type: object
 *                 properties:
 *                   success:
 *                     type: boolean
 *                   data:
 *                     type: array
 *                     items:
 *                       type: string
 *                       example: "14:30"
 */

// README.md 내용
/**
# 진안군 장터 예약 시스템 API

## 개요
진안군 장터 앱의 예약 관리를 위한 RESTful API 시스템입니다.

## 주요 기능
- 예약 생성/조회/수정/취소
- 실시간 알림 (SMS/카카오톡)
- 예약 상태 관리
- SSE를 통한 실시간 업데이트
- Redis 캐싱으로 성능 최적화

## 기술 스택
- Node.js + TypeScript
- PostgreSQL
- Redis
- Express.js
- JWT 인증

## 설치 및 실행

### 환경 변수 설정
```bash
cp .env.example .env
# .env 파일 편집
```

### 의존성 설치
```bash
npm install
```

### 데이터베이스 마이그레이션
```bash
npm run migrate
```

### 개발 서버 실행
```bash
npm run dev
```

### 프로덕션 빌드
```bash
npm run build
npm start
```

## API 문서
- Swagger UI: http://localhost:3000/api-docs
- OpenAPI Spec: http://localhost:3000/api-docs/openapi.json

## 테스트
```bash
npm test
npm run test:coverage
```

## 배포
Docker를 사용한 배포:
```bash
docker build -t jinan-reservation-api .
docker run -p 3000:3000 --env-file .env jinan-reservation-api
```
*/