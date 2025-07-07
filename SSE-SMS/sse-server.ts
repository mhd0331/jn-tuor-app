// backend/src/services/sse.service.ts
import { Response } from 'express';
import Redis from 'ioredis';
import { EventEmitter } from 'events';

interface SSEClient {
  id: string;
  userId: string;
  response: Response;
  userType: 'customer' | 'store' | 'admin';
  storeId?: string;
}

interface SSEMessage {
  id?: string;
  event?: string;
  data: any;
  retry?: number;
}

export class SSEService {
  private clients: Map<string, SSEClient> = new Map();
  private redis: Redis;
  private pubClient: Redis;
  private subClient: Redis;
  private eventEmitter: EventEmitter;

  constructor() {
    // Redis 연결 설정
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => Math.min(times * 50, 2000)
    });

    // Pub/Sub용 클라이언트
    this.pubClient = this.redis.duplicate();
    this.subClient = this.redis.duplicate();
    
    this.eventEmitter = new EventEmitter();
    this.eventEmitter.setMaxListeners(0);

    this.setupRedisSubscriptions();
  }

  // Redis 구독 설정
  private setupRedisSubscriptions() {
    // 예약 관련 채널 구독
    this.subClient.subscribe(
      'reservation:created',
      'reservation:confirmed',
      'reservation:cancelled',
      'reservation:completed',
      'store:updated',
      'system:announcement'
    );

    this.subClient.on('message', (channel, message) => {
      try {
        const data = JSON.parse(message);
        this.handleRedisMessage(channel, data);
      } catch (error) {
        console.error('Redis message parse error:', error);
      }
    });
  }

  // Redis 메시지 처리
  private handleRedisMessage(channel: string, data: any) {
    switch (channel) {
      case 'reservation:created':
        this.sendToStore(data.storeId, {
          event: 'reservation:new',
          data: {
            reservationId: data.reservationId,
            customerName: data.customerName,
            reservationTime: data.reservationTime,
            menuItems: data.menuItems,
            totalAmount: data.totalAmount,
            message: '새로운 예약이 접수되었습니다.'
          }
        });
        break;

      case 'reservation:confirmed':
        this.sendToUser(data.userId, {
          event: 'reservation:confirmed',
          data: {
            reservationId: data.reservationId,
            storeName: data.storeName,
            confirmationTime: data.confirmationTime,
            message: '예약이 확정되었습니다.'
          }
        });
        break;

      case 'reservation:cancelled':
        const targetId = data.cancelledBy === 'store' ? data.userId : data.storeId;
        const targetType = data.cancelledBy === 'store' ? 'user' : 'store';
        
        if (targetType === 'user') {
          this.sendToUser(targetId, {
            event: 'reservation:cancelled',
            data: {
              reservationId: data.reservationId,
              reason: data.reason,
              message: '예약이 취소되었습니다.'
            }
          });
        } else {
          this.sendToStore(targetId, {
            event: 'reservation:cancelled',
            data: {
              reservationId: data.reservationId,
              customerName: data.customerName,
              message: '고객이 예약을 취소했습니다.'
            }
          });
        }
        break;

      case 'system:announcement':
        this.broadcast({
          event: 'system:announcement',
          data: {
            title: data.title,
            message: data.message,
            priority: data.priority
          }
        });
        break;
    }
  }

  // SSE 클라이언트 연결
  public connect(clientId: string, userId: string, userType: 'customer' | 'store' | 'admin', response: Response, storeId?: string) {
    // SSE 헤더 설정
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Nginx 버퍼링 비활성화
    });

    // 클라이언트 저장
    const client: SSEClient = {
      id: clientId,
      userId,
      response,
      userType,
      storeId
    };

    this.clients.set(clientId, client);

    // 초기 연결 메시지
    this.sendToClient(client, {
      event: 'connected',
      data: {
        clientId,
        message: '실시간 알림 서비스에 연결되었습니다.',
        serverTime: new Date().toISOString()
      }
    });

    // 미수신 메시지 확인 및 전송
    this.sendPendingMessages(userId);

    // 연결 종료 처리
    response.on('close', () => {
      this.disconnect(clientId);
    });

    // 주기적 핑 전송 (30초마다)
    const pingInterval = setInterval(() => {
      if (this.clients.has(clientId)) {
        this.sendToClient(client, {
          event: 'ping',
          data: { timestamp: Date.now() }
        });
      } else {
        clearInterval(pingInterval);
      }
    }, 30000);
  }

  // 클라이언트 연결 해제
  private disconnect(clientId: string) {
    const client = this.clients.get(clientId);
    if (client) {
      client.response.end();
      this.clients.delete(clientId);
      console.log(`Client disconnected: ${clientId}`);
    }
  }

  // 특정 클라이언트에게 메시지 전송
  private sendToClient(client: SSEClient, message: SSEMessage) {
    try {
      const formattedMessage = this.formatSSEMessage(message);
      client.response.write(formattedMessage);
    } catch (error) {
      console.error(`Error sending to client ${client.id}:`, error);
      this.disconnect(client.id);
    }
  }

  // 특정 사용자에게 메시지 전송
  public sendToUser(userId: string, message: SSEMessage) {
    let sent = false;
    
    for (const [_, client] of this.clients) {
      if (client.userId === userId) {
        this.sendToClient(client, message);
        sent = true;
      }
    }

    // 사용자가 오프라인인 경우 Redis에 저장
    if (!sent) {
      this.savePendingMessage(userId, message);
    }
  }

  // 특정 상점에게 메시지 전송
  public sendToStore(storeId: string, message: SSEMessage) {
    let sent = false;

    for (const [_, client] of this.clients) {
      if (client.storeId === storeId || 
          (client.userType === 'admin')) {
        this.sendToClient(client, message);
        sent = true;
      }
    }

    // 상점이 오프라인인 경우 Redis에 저장
    if (!sent) {
      this.savePendingMessage(`store:${storeId}`, message);
    }
  }

  // 모든 클라이언트에게 브로드캐스트
  public broadcast(message: SSEMessage) {
    for (const [_, client] of this.clients) {
      this.sendToClient(client, message);
    }
  }

  // 관리자에게만 전송
  public sendToAdmins(message: SSEMessage) {
    for (const [_, client] of this.clients) {
      if (client.userType === 'admin') {
        this.sendToClient(client, message);
      }
    }
  }

  // SSE 메시지 포맷팅
  private formatSSEMessage(message: SSEMessage): string {
    let formatted = '';

    if (message.id) {
      formatted += `id: ${message.id}\n`;
    }

    if (message.event) {
      formatted += `event: ${message.event}\n`;
    }

    if (message.retry) {
      formatted += `retry: ${message.retry}\n`;
    }

    const data = typeof message.data === 'string' 
      ? message.data 
      : JSON.stringify(message.data);

    formatted += `data: ${data}\n\n`;

    return formatted;
  }

  // 미전송 메시지 저장
  private async savePendingMessage(userId: string, message: SSEMessage) {
    const key = `pending:${userId}`;
    const messageData = JSON.stringify({
      ...message,
      timestamp: Date.now()
    });

    await this.redis.rpush(key, messageData);
    await this.redis.expire(key, 86400); // 24시간 후 만료
  }

  // 미전송 메시지 전송
  private async sendPendingMessages(userId: string) {
    const key = `pending:${userId}`;
    const messages = await this.redis.lrange(key, 0, -1);

    if (messages.length > 0) {
      for (const messageStr of messages) {
        try {
          const message = JSON.parse(messageStr);
          this.sendToUser(userId, message);
        } catch (error) {
          console.error('Error sending pending message:', error);
        }
      }

      // 전송 완료 후 삭제
      await this.redis.del(key);
    }
  }

  // 예약 알림 발행
  public publishReservationEvent(event: string, data: any) {
    this.pubClient.publish(event, JSON.stringify(data));
  }

  // 연결된 클라이언트 수 조회
  public getConnectedClients(): { total: number; byType: Record<string, number> } {
    const byType: Record<string, number> = {
      customer: 0,
      store: 0,
      admin: 0
    };

    for (const [_, client] of this.clients) {
      byType[client.userType]++;
    }

    return {
      total: this.clients.size,
      byType
    };
  }

  // 정리
  public async cleanup() {
    // 모든 클라이언트 연결 종료
    for (const [clientId, _] of this.clients) {
      this.disconnect(clientId);
    }

    // Redis 연결 종료
    await this.redis.quit();
    await this.pubClient.quit();
    await this.subClient.quit();
  }
}

// 싱글톤 인스턴스
export const sseService = new SSEService();

// backend/src/routes/sse.routes.ts
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth.middleware';
import { sseService } from '../services/sse.service';

const router = Router();

// SSE 연결 엔드포인트
router.get('/stream', authMiddleware, (req: Request, res: Response) => {
  const clientId = uuidv4();
  const userId = req.user!.id;
  const userType = req.user!.role === 'admin' ? 'admin' : 
                   req.user!.role === 'store_owner' ? 'store' : 'customer';
  const storeId = req.user!.storeId;

  sseService.connect(clientId, userId, userType, res, storeId);
});

// 연결 상태 확인 (관리자용)
router.get('/status', authMiddleware, (req: Request, res: Response) => {
  if (req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const status = sseService.getConnectedClients();
  res.json(status);
});

export default router;

// backend/src/events/reservation.events.ts
import { sseService } from '../services/sse.service';

export class ReservationEvents {
  // 새 예약 생성 시
  static async onReservationCreated(reservation: any) {
    // SSE로 상점에 알림
    sseService.publishReservationEvent('reservation:created', {
      reservationId: reservation.id,
      storeId: reservation.store_id,
      userId: reservation.user_id,
      customerName: reservation.user_name,
      reservationTime: reservation.reservation_time,
      menuItems: reservation.items,
      totalAmount: reservation.total_amount
    });

    // 관리자에게도 알림
    sseService.sendToAdmins({
      event: 'admin:new_reservation',
      data: {
        reservationId: reservation.id,
        storeName: reservation.store_name,
        customerName: reservation.user_name,
        amount: reservation.total_amount
      }
    });
  }

  // 예약 확정 시
  static async onReservationConfirmed(reservation: any) {
    sseService.publishReservationEvent('reservation:confirmed', {
      reservationId: reservation.id,
      userId: reservation.user_id,
      storeId: reservation.store_id,
      storeName: reservation.store_name,
      confirmationTime: new Date().toISOString()
    });
  }

  // 예약 취소 시
  static async onReservationCancelled(reservation: any, cancelledBy: 'store' | 'customer', reason?: string) {
    sseService.publishReservationEvent('reservation:cancelled', {
      reservationId: reservation.id,
      userId: reservation.user_id,
      storeId: reservation.store_id,
      customerName: reservation.user_name,
      cancelledBy,
      reason
    });
  }
}