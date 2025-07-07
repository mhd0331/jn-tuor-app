// services/reservation.service.ts
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { format, addHours, isBefore, isAfter } from 'date-fns';
import { ko } from 'date-fns/locale';
import { 
  Reservation, 
  CreateReservationDTO, 
  UpdateReservationDTO, 
  ReservationStatus,
  ReservationFilter 
} from '../types/reservation.types';
import { NotificationService } from './notification.service';
import { CacheService } from './cache.service';
import { logger } from '../utils/logger';

export class ReservationService {
  constructor(
    private db: Pool,
    private redis: Redis,
    private notificationService: NotificationService,
    private cacheService: CacheService
  ) {}

  async createReservation(data: CreateReservationDTO, userId?: string): Promise<Reservation> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      // 1. 가게 정보 및 운영시간 확인
      const storeQuery = `
        SELECT s.*, soh.* 
        FROM stores s
        LEFT JOIN store_operating_hours soh ON s.id = soh.store_id
        WHERE s.id = $1 AND s.status = 'active'
      `;
      const storeResult = await client.query(storeQuery, [data.store_id]);
      
      if (storeResult.rows.length === 0) {
        throw new Error('Store not found or inactive');
      }
      
      const store = storeResult.rows[0];
      
      // 2. 예약 가능 시간 확인
      const dayOfWeek = format(new Date(data.reservation_date), 'E', { locale: ko });
      const operatingHours = storeResult.rows.find(row => row.day_of_week === dayOfWeek);
      
      if (!operatingHours || operatingHours.is_closed) {
        throw new Error('Store is closed on this day');
      }
      
      const reservationTime = new Date(`${data.reservation_date}T${data.reservation_time}`);
      const openTime = new Date(`${data.reservation_date}T${operatingHours.open_time}`);
      const closeTime = new Date(`${data.reservation_date}T${operatingHours.close_time}`);
      
      if (isBefore(reservationTime, openTime) || isAfter(reservationTime, closeTime)) {
        throw new Error('Reservation time is outside operating hours');
      }
      
      // 3. 메뉴 정보 조회 및 총액 계산
      let totalAmount = 0;
      const menuItems = [];
      
      if (data.menu_items && data.menu_items.length > 0) {
        const menuIds = data.menu_items.map(item => item.menu_id);
        const menuQuery = `
          SELECT id, menu_name, price 
          FROM menus 
          WHERE id = ANY($1) AND store_id = $2 AND is_available = true
        `;
        const menuResult = await client.query(menuQuery, [menuIds, data.store_id]);
        
        for (const item of data.menu_items) {
          const menu = menuResult.rows.find(m => m.id === item.menu_id);
          if (!menu) {
            throw new Error(`Menu ${item.menu_id} not found or unavailable`);
          }
          
          const subtotal = menu.price * item.quantity;
          totalAmount += subtotal;
          
          menuItems.push({
            menu_id: menu.id,
            menu_name: menu.menu_name,
            quantity: item.quantity,
            price: menu.price,
            subtotal
          });
        }
      }
      
      // 4. 예약 생성
      const reservationId = uuidv4();
      const insertReservationQuery = `
        INSERT INTO reservations (
          id, store_id, user_id, reserver_name, reserver_phone_number,
          reservation_date, reservation_time, number_of_people,
          discount_conditions, request_notes, status, total_amount
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;
      
      const reservationResult = await client.query(insertReservationQuery, [
        reservationId,
        data.store_id,
        userId || null,
        data.reserver_name,
        data.reserver_phone_number,
        data.reservation_date,
        data.reservation_time,
        data.number_of_people,
        data.discount_conditions || null,
        data.request_notes || null,
        ReservationStatus.PENDING,
        totalAmount || null
      ]);
      
      const reservation = reservationResult.rows[0];
      
      // 5. 메뉴 아이템 저장
      if (menuItems.length > 0) {
        const insertMenuItemsQuery = `
          INSERT INTO reservation_menu_items 
          (reservation_id, menu_id, menu_name, quantity, price, subtotal)
          VALUES ($1, $2, $3, $4, $5, $6)
        `;
        
        for (const item of menuItems) {
          await client.query(insertMenuItemsQuery, [
            reservationId,
            item.menu_id,
            item.menu_name,
            item.quantity,
            item.price,
            item.subtotal
          ]);
        }
      }
      
      await client.query('COMMIT');
      
      // 6. 캐시 무효화
      await this.cacheService.invalidate(`reservations:store:${data.store_id}:*`);
      await this.cacheService.invalidate(`reservations:date:${data.reservation_date}:*`);
      
      // 7. 알림 발송
      await this.sendReservationNotification(reservation, store, 'created');
      
      // 8. 실시간 이벤트 발송
      await this.publishReservationEvent(reservation, 'created');
      
      return {
        ...reservation,
        menu_items: menuItems
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create reservation', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getReservation(id: string): Promise<Reservation | null> {
    // 캐시 확인
    const cached = await this.cacheService.get<Reservation>(`reservation:${id}`);
    if (cached) return cached;
    
    const query = `
      SELECT r.*, 
        json_agg(
          json_build_object(
            'menu_id', rmi.menu_id,
            'menu_name', rmi.menu_name,
            'quantity', rmi.quantity,
            'price', rmi.price,
            'subtotal', rmi.subtotal
          )
        ) FILTER (WHERE rmi.id IS NOT NULL) as menu_items
      FROM reservations r
      LEFT JOIN reservation_menu_items rmi ON r.id = rmi.reservation_id
      WHERE r.id = $1
      GROUP BY r.id
    `;
    
    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const reservation = result.rows[0];
    
    // 캐시 저장 (5분)
    await this.cacheService.set(`reservation:${id}`, reservation, 300);
    
    return reservation;
  }

  async getReservations(filter: ReservationFilter): Promise<{
    reservations: Reservation[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const offset = (page - 1) * limit;
    
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;
    
    if (filter.store_id) {
      whereConditions.push(`r.store_id = $${paramIndex++}`);
      params.push(filter.store_id);
    }
    
    if (filter.user_id) {
      whereConditions.push(`r.user_id = $${paramIndex++}`);
      params.push(filter.user_id);
    }
    
    if (filter.status) {
      whereConditions.push(`r.status = $${paramIndex++}`);
      params.push(filter.status);
    }
    
    if (filter.date_from) {
      whereConditions.push(`r.reservation_date >= $${paramIndex++}`);
      params.push(filter.date_from);
    }
    
    if (filter.date_to) {
      whereConditions.push(`r.reservation_date <= $${paramIndex++}`);
      params.push(filter.date_to);
    }
    
    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ') 
      : '';
    
    // 총 개수 조회
    const countQuery = `
      SELECT COUNT(*) FROM reservations r ${whereClause}
    `;
    const countResult = await this.db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);
    
    // 예약 목록 조회
    const query = `
      SELECT r.*, 
        s.name as store_name,
        s.store_image_url,
        json_agg(
          json_build_object(
            'menu_id', rmi.menu_id,
            'menu_name', rmi.menu_name,
            'quantity', rmi.quantity,
            'price', rmi.price,
            'subtotal', rmi.subtotal
          )
        ) FILTER (WHERE rmi.id IS NOT NULL) as menu_items
      FROM reservations r
      JOIN stores s ON r.store_id = s.id
      LEFT JOIN reservation_menu_items rmi ON r.id = rmi.reservation_id
      ${whereClause}
      GROUP BY r.id, s.name, s.store_image_url
      ORDER BY r.reservation_date DESC, r.reservation_time DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
    
    params.push(limit, offset);
    const result = await this.db.query(query, params);
    
    return {
      reservations: result.rows,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  async updateReservation(
    id: string, 
    data: UpdateReservationDTO, 
    userId?: string
  ): Promise<Reservation> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      // 기존 예약 조회
      const reservation = await this.getReservation(id);
      if (!reservation) {
        throw new Error('Reservation not found');
      }
      
      // 권한 확인
      if (userId && reservation.user_id !== userId) {
        // 가게 주인인지 확인
        const storeQuery = 'SELECT user_id FROM stores WHERE id = $1';
        const storeResult = await client.query(storeQuery, [reservation.store_id]);
        
        if (storeResult.rows[0].user_id !== userId) {
          throw new Error('Unauthorized to update this reservation');
        }
      }
      
      // 상태 변경 로직
      if (data.status) {
        await this.validateStatusTransition(reservation.status, data.status);
        
        // 상태별 추가 필드 업데이트
        switch (data.status) {
          case ReservationStatus.CONFIRMED:
            data.confirmed_at = new Date();
            break;
          case ReservationStatus.CANCELLED:
            data.cancelled_at = new Date();
            break;
          case ReservationStatus.COMPLETED:
            data.completed_at = new Date();
            break;
        }
      }
      
      // 업데이트 쿼리 생성
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;
      
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          updateFields.push(`${key} = $${paramIndex++}`);
          updateValues.push(value);
        }
      });
      
      if (updateFields.length === 0) {
        throw new Error('No fields to update');
      }
      
      updateValues.push(id);
      
      const updateQuery = `
        UPDATE reservations 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;
      
      const result = await client.query(updateQuery, updateValues);
      await client.query('COMMIT');
      
      const updatedReservation = result.rows[0];
      
      // 캐시 무효화
      await this.cacheService.invalidate(`reservation:${id}`);
      await this.cacheService.invalidate(`reservations:store:${reservation.store_id}:*`);
      
      // 알림 발송
      if (data.status) {
        const storeQuery = 'SELECT * FROM stores WHERE id = $1';
        const storeResult = await client.query(storeQuery, [reservation.store_id]);
        await this.sendReservationNotification(
          updatedReservation, 
          storeResult.rows[0], 
          'status_changed'
        );
      }
      
      // 실시간 이벤트 발송
      await this.publishReservationEvent(updatedReservation, 'updated');
      
      return updatedReservation;
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to update reservation', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async cancelReservation(id: string, reason?: string, userId?: string): Promise<Reservation> {
    return this.updateReservation(id, {
      status: ReservationStatus.CANCELLED,
      cancelled_reason: reason
    }, userId);
  }

  async confirmReservation(id: string, userId?: string): Promise<Reservation> {
    return this.updateReservation(id, {
      status: ReservationStatus.CONFIRMED
    }, userId);
  }

  async completeReservation(id: string): Promise<Reservation> {
    return this.updateReservation(id, {
      status: ReservationStatus.COMPLETED
    });
  }

  async markAsNoShow(id: string): Promise<Reservation> {
    return this.updateReservation(id, {
      status: ReservationStatus.NO_SHOW
    });
  }

  // 상태 전환 유효성 검사
  private async validateStatusTransition(
    currentStatus: ReservationStatus, 
    newStatus: ReservationStatus
  ): Promise<void> {
    const validTransitions = {
      [ReservationStatus.PENDING]: [
        ReservationStatus.CONFIRMED, 
        ReservationStatus.CANCELLED
      ],
      [ReservationStatus.CONFIRMED]: [
        ReservationStatus.CANCELLED, 
        ReservationStatus.COMPLETED, 
        ReservationStatus.NO_SHOW
      ],
      [ReservationStatus.CANCELLED]: [],
      [ReservationStatus.COMPLETED]: [],
      [ReservationStatus.NO_SHOW]: []
    };
    
    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }
  }

  // 예약 알림 발송
  private async sendReservationNotification(
    reservation: Reservation, 
    store: any, 
    type: 'created' | 'status_changed'
  ): Promise<void> {
    try {
      const formattedDate = format(
        new Date(reservation.reservation_date), 
        'yyyy년 M월 d일', 
        { locale: ko }
      );
      
      let message = '';
      
      switch (type) {
        case 'created':
          // 가게 주인에게 알림
          message = `[새 예약]\n${reservation.reserver_name}님이 ${formattedDate} ${reservation.reservation_time}에 ${reservation.number_of_people}명으로 예약하셨습니다.`;
          await this.notificationService.send({
            to: store.owner_notification_contact,
            method: store.owner_notification_method,
            message,
            templateId: 'new_reservation'
          });
          
          // 고객에게 알림
          message = `[예약 접수]\n${store.name}에 ${formattedDate} ${reservation.reservation_time} ${reservation.number_of_people}명 예약이 접수되었습니다. 가게 확인 후 확정 알림을 보내드립니다.`;
          await this.notificationService.send({
            to: reservation.reserver_phone_number,
            method: 'sms',
            message,
            templateId: 'reservation_received'
          });
          break;
          
        case 'status_changed':
          const statusMessages = {
            [ReservationStatus.CONFIRMED]: `[예약 확정]\n${store.name} ${formattedDate} ${reservation.reservation_time} 예약이 확정되었습니다.`,
            [ReservationStatus.CANCELLED]: `[예약 취소]\n${store.name} ${formattedDate} ${reservation.reservation_time} 예약이 취소되었습니다.`,
            [ReservationStatus.COMPLETED]: `[방문 완료]\n${store.name}을 이용해주셔서 감사합니다. 리뷰를 남겨주시면 다음 방문시 혜택을 드립니다.`
          };
          
          message = statusMessages[reservation.status];
          if (message) {
            await this.notificationService.send({
              to: reservation.reserver_phone_number,
              method: 'sms',
              message,
              templateId: `reservation_${reservation.status}`
            });
          }
          break;
      }
    } catch (error) {
      logger.error('Failed to send reservation notification', error);
      // 알림 실패가 예약 프로세스를 중단시키지 않도록 함
    }
  }

  // 실시간 이벤트 발송
  private async publishReservationEvent(
    reservation: Reservation, 
    eventType: string
  ): Promise<void> {
    const event = {
      type: `reservation.${eventType}`,
      data: reservation,
      timestamp: new Date().toISOString()
    };
    
    // Redis Pub/Sub
    await this.redis.publish(`store:${reservation.store_id}:events`, JSON.stringify(event));
    
    // SSE를 위한 이벤트 저장
    await this.redis.setex(
      `sse:reservation:${reservation.id}:${eventType}`,
      300, // 5분 TTL
      JSON.stringify(event)
    );
  }

  // 예약 가능 시간 조회
  async getAvailableTimeSlots(
    storeId: string, 
    date: string
  ): Promise<string[]> {
    const cacheKey = `available_slots:${storeId}:${date}`;
    const cached = await this.cacheService.get<string[]>(cacheKey);
    if (cached) return cached;
    
    // 가게 운영시간 조회
    const dayOfWeek = format(new Date(date), 'E', { locale: ko });
    const operatingHoursQuery = `
      SELECT * FROM store_operating_hours 
      WHERE store_id = $1 AND day_of_week = $2 AND is_closed = false
    `;
    const operatingHoursResult = await this.db.query(operatingHoursQuery, [storeId, dayOfWeek]);
    
    if (operatingHoursResult.rows.length === 0) {
      return [];
    }
    
    const operatingHours = operatingHoursResult.rows[0];
    
    // 기존 예약 조회
    const reservationsQuery = `
      SELECT reservation_time 
      FROM reservations 
      WHERE store_id = $1 
      AND reservation_date = $2 
      AND status IN ('pending', 'confirmed')
    `;
    const reservationsResult = await this.db.query(reservationsQuery, [storeId, date]);
    const bookedSlots = reservationsResult.rows.map(r => r.reservation_time);
    
    // 가능한 시간대 생성 (30분 단위)
    const availableSlots = [];
    const openTime = new Date(`${date}T${operatingHours.open_time}`);
    const closeTime = new Date(`${date}T${operatingHours.close_time}`);
    const slotDuration = 30; // 분
    
    let currentSlot = new Date(openTime);
    while (currentSlot < closeTime) {
      const timeString = format(currentSlot, 'HH:mm');
      
      // 예약 가능 여부 확인 (2시간 여유 확인)
      const isAvailable = !bookedSlots.some(booked => {
        const bookedTime = new Date(`${date}T${booked}`);
        const timeDiff = Math.abs(currentSlot.getTime() - bookedTime.getTime());
        return timeDiff < 2 * 60 * 60 * 1000; // 2시간
      });
      
      if (isAvailable) {
        availableSlots.push(timeString);
      }
      
      currentSlot = addHours(currentSlot, 0.5); // 30분 추가
    }
    
    // 캐시 저장 (10분)
    await this.cacheService.set(cacheKey, availableSlots, 600);
    
    return availableSlots;
  }

  // 예약 리마인더 (크론잡에서 호출)
  async sendReservationReminders(): Promise<void> {
    const tomorrow = format(addHours(new Date(), 24), 'yyyy-MM-dd');
    
    const query = `
      SELECT r.*, s.name as store_name 
      FROM reservations r
      JOIN stores s ON r.store_id = s.id
      WHERE r.reservation_date = $1 
      AND r.status = 'confirmed'
      AND r.reminder_sent = false
    `;
    
    const result = await this.db.query(query, [tomorrow]);
    
    for (const reservation of result.rows) {
      try {
        const message = `[예약 리마인더]\n내일 ${reservation.reservation_time} ${reservation.store_name}에 ${reservation.number_of_people}명 예약이 있습니다.`;
        
        await this.notificationService.send({
          to: reservation.reserver_phone_number,
          method: 'sms',
          message,
          templateId: 'reservation_reminder'
        });
        
        // 리마인더 발송 표시
        await this.db.query(
          'UPDATE reservations SET reminder_sent = true WHERE id = $1',
          [reservation.id]
        );
      } catch (error) {
        logger.error(`Failed to send reminder for reservation ${reservation.id}`, error);
      }
    }
  }
}