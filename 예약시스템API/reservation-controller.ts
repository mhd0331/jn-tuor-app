// controllers/reservation.controller.ts
import { Request, Response, NextFunction } from 'express';
import { ReservationService } from '../services/reservation.service';
import { CreateReservationDTO, UpdateReservationDTO, ReservationFilter } from '../types/reservation.types';
import { validateReservationInput } from '../validators/reservation.validator';
import { logger } from '../utils/logger';

export class ReservationController {
  constructor(private reservationService: ReservationService) {}

  // 예약 생성
  async createReservation(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const data: CreateReservationDTO = req.body;
      
      // 입력 검증
      const validation = validateReservationInput(data);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.errors
        });
      }
      
      const reservation = await this.reservationService.createReservation(data, userId);
      
      res.status(201).json({
        success: true,
        data: reservation,
        message: '예약이 성공적으로 접수되었습니다.'
      });
    } catch (error) {
      logger.error('Create reservation error:', error);
      
      if (error.message.includes('conflict')) {
        return res.status(409).json({
          success: false,
          error: '선택하신 시간에 이미 예약이 있습니다.'
        });
      }
      
      if (error.message.includes('closed')) {
        return res.status(400).json({
          success: false,
          error: '해당 날짜에는 영업하지 않습니다.'
        });
      }
      
      next(error);
    }
  }

  // 예약 조회
  async getReservation(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      const reservation = await this.reservationService.getReservation(id);
      
      if (!reservation) {
        return res.status(404).json({
          success: false,
          error: '예약을 찾을 수 없습니다.'
        });
      }
      
      // 권한 확인 (본인 예약 또는 가게 주인)
      if (userId && reservation.user_id !== userId) {
        // 가게 주인 확인 로직 필요
        const isStoreOwner = await this.checkStoreOwnership(reservation.store_id, userId);
        if (!isStoreOwner) {
          return res.status(403).json({
            success: false,
            error: '예약 조회 권한이 없습니다.'
          });
        }
      }
      
      res.json({
        success: true,
        data: reservation
      });
    } catch (error) {
      next(error);
    }
  }

  // 예약 목록 조회
  async getReservations(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const filter: ReservationFilter = {
        store_id: req.query.store_id as string,
        user_id: req.query.user_id as string || userId,
        status: req.query.status as any,
        date_from: req.query.date_from as string,
        date_to: req.query.date_to as string,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20
      };
      
      // 권한에 따른 필터 조정
      if (!req.user?.isAdmin && !filter.store_id) {
        filter.user_id = userId; // 일반 사용자는 본인 예약만 조회
      }
      
      const result = await this.reservationService.getReservations(filter);
      
      res.json({
        success: true,
        data: result.reservations,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // 예약 수정
  async updateReservation(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const data: UpdateReservationDTO = req.body;
      
      const reservation = await this.reservationService.updateReservation(id, data, userId);
      
      res.json({
        success: true,
        data: reservation,
        message: '예약이 수정되었습니다.'
      });
    } catch (error) {
      if (error.message.includes('Unauthorized')) {
        return res.status(403).json({
          success: false,
          error: '예약 수정 권한이 없습니다.'
        });
      }
      
      next(error);
    }
  }

  // 예약 취소
  async cancelReservation(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const { reason } = req.body;
      
      const reservation = await this.reservationService.cancelReservation(id, reason, userId);
      
      res.json({
        success: true,
        data: reservation,
        message: '예약이 취소되었습니다.'
      });
    } catch (error) {
      next(error);
    }
  }

  // 예약 확정 (가게 주인용)
  async confirmReservation(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      const reservation = await this.reservationService.confirmReservation(id, userId);
      
      res.json({
        success: true,
        data: reservation,
        message: '예약이 확정되었습니다.'
      });
    } catch (error) {
      next(error);
    }
  }

  // 예약 완료 처리
  async completeReservation(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      const reservation = await this.reservationService.completeReservation(id);
      
      res.json({
        success: true,
        data: reservation,
        message: '예약이 완료 처리되었습니다.'
      });
    } catch (error) {
      next(error);
    }
  }

  // 노쇼 처리
  async markAsNoShow(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      const reservation = await this.reservationService.markAsNoShow(id);
      
      res.json({
        success: true,
        data: reservation,
        message: '노쇼 처리되었습니다.'
      });
    } catch (error) {
      next(error);
    }
  }

  // 예약 가능 시간 조회
  async getAvailableTimeSlots(req: Request, res: Response, next: NextFunction) {
    try {
      const { storeId } = req.params;
      const { date } = req.query;
      
      if (!date) {
        return res.status(400).json({
          success: false,
          error: '날짜를 지정해주세요.'
        });
      }
      
      const slots = await this.reservationService.getAvailableTimeSlots(
        storeId, 
        date as string
      );
      
      res.json({
        success: true,
        data: slots
      });
    } catch (error) {
      next(error);
    }
  }

  // 가게 소유권 확인 헬퍼
  private async checkStoreOwnership(storeId: string, userId: string): Promise<boolean> {
    // 실제 구현에서는 DB 조회
    // const store = await db.query('SELECT user_id FROM stores WHERE id = $1', [storeId]);
    // return store.rows[0]?.user_id === userId;
    return false;
  }
}

// routes/reservation.routes.ts
import { Router } from 'express';
import { ReservationController } from '../controllers/reservation.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { storeOwnerMiddleware } from '../middleware/storeOwner.middleware';
import { adminMiddleware } from '../middleware/admin.middleware';

export function createReservationRouter(reservationController: ReservationController): Router {
  const router = Router();

  // 공개 엔드포인트
  router.post('/reservations', reservationController.createReservation.bind(reservationController));
  router.get('/stores/:storeId/available-slots', reservationController.getAvailableTimeSlots.bind(reservationController));

  // 인증 필요 엔드포인트
  router.get('/reservations', authMiddleware, reservationController.getReservations.bind(reservationController));
  router.get('/reservations/:id', authMiddleware, reservationController.getReservation.bind(reservationController));
  router.patch('/reservations/:id', authMiddleware, reservationController.updateReservation.bind(reservationController));
  router.post('/reservations/:id/cancel', authMiddleware, reservationController.cancelReservation.bind(reservationController));

  // 가게 주인 전용
  router.post('/reservations/:id/confirm', authMiddleware, storeOwnerMiddleware, reservationController.confirmReservation.bind(reservationController));
  router.post('/reservations/:id/complete', authMiddleware, storeOwnerMiddleware, reservationController.completeReservation.bind(reservationController));
  router.post('/reservations/:id/no-show', authMiddleware, storeOwnerMiddleware, reservationController.markAsNoShow.bind(reservationController));

  return router;
}

// validators/reservation.validator.ts
import { CreateReservationDTO } from '../types/reservation.types';
import { isValid, isFuture, parse } from 'date-fns';

export function validateReservationInput(data: CreateReservationDTO): {
  valid: boolean;
  errors?: string[];
} {
  const errors: string[] = [];

  // 필수 필드 검증
  if (!data.store_id) errors.push('가게 ID가 필요합니다.');
  if (!data.reserver_name) errors.push('예약자명이 필요합니다.');
  if (!data.reserver_phone_number) errors.push('연락처가 필요합니다.');
  if (!data.reservation_date) errors.push('예약 날짜가 필요합니다.');
  if (!data.reservation_time) errors.push('예약 시간이 필요합니다.');
  if (!data.number_of_people || data.number_of_people < 1) {
    errors.push('예약 인원은 1명 이상이어야 합니다.');
  }

  // 전화번호 형식 검증
  const phoneRegex = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/;
  if (data.reserver_phone_number && !phoneRegex.test(data.reserver_phone_number)) {
    errors.push('올바른 전화번호 형식이 아닙니다.');
  }

  // 날짜 검증
  if (data.reservation_date) {
    const date = parse(data.reservation_date, 'yyyy-MM-dd', new Date());
    if (!isValid(date)) {
      errors.push('올바른 날짜 형식이 아닙니다. (yyyy-MM-dd)');
    } else if (!isFuture(date)) {
      errors.push('예약 날짜는 미래여야 합니다.');
    }
  }

  // 시간 형식 검증
  const timeRegex = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
  if (data.reservation_time && !timeRegex.test(data.reservation_time)) {
    errors.push('올바른 시간 형식이 아닙니다. (HH:mm)');
  }

  // 메뉴 아이템 검증
  if (data.menu_items && data.menu_items.length > 0) {
    data.menu_items.forEach((item, index) => {
      if (!item.menu_id) errors.push(`메뉴 ${index + 1}의 ID가 필요합니다.`);
      if (!item.quantity || item.quantity < 1) {
        errors.push(`메뉴 ${index + 1}의 수량은 1개 이상이어야 합니다.`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}