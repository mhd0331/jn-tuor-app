// services/sse.service.ts
import { Response } from 'express';
import { EventEmitter } from 'events';
import { Redis } from 'ioredis';
import { logger } from '../utils/logger';

interface SSEClient {
  id: string;
  response: Response;
  userId?: string;
  storeId?: string;
  lastEventId?: string;
}

export class SSEService {
  private clients: Map<string, SSEClient> = new Map();
  private eventEmitter: EventEmitter;
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
    this.eventEmitter = new EventEmitter();
    this.setupRedisSubscriber();
  }

  // Redis 구독 설정
  private setupRedisSubscriber() {
    const subscriber = this.redis.duplicate();
    
    subscriber.psubscribe('store:*:events');
    subscriber.psubscribe('user:*:events');
    
    subscriber.on('pmessage', (pattern, channel, message) => {
      try {
        const event = JSON.parse(message);
        this.handleRedisEvent(channel, event);
      } catch (error) {
        logger.error('Failed to parse Redis event:', error);
      }
    });
  }

  // Redis 이벤트 처리
  private handleRedisEvent(channel: string, event: any) {
    const parts = channel.split(':');
    
    if (parts[0] === 'store' && parts[2] === 'events') {
      const storeId = parts[1];
      this.sendToStoreClients(storeId, event);
    } else if (parts[0] === 'user' && parts[2] === 'events') {
      const userId = parts[1];
      this.sendToUserClients(userId, event);
    }
  }

  // SSE 연결 추가
  addClient(clientId: string, response: Response, userId?: string, storeId?: string): void {
    // SSE 헤더 설정
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Nginx 버퍼링 비활성화
    });

    // 초기 연결 메시지
    response.write(`:connected\n\n`);

    const client: SSEClient = {
      id: clientId,
      response,
      userId,
      storeId
    };

    this.clients.set(clientId, client);

    // 연결 종료 처리
    response.on('close', () => {
      this.removeClient(clientId);
    });

    // 하트비트 설정 (30초마다)
    const heartbeat = setInterval(() => {
      try {
        response.write(':heartbeat\n\n');
      } catch (error) {
        clearInterval(heartbeat);
        this.removeClient(clientId);
      }
    }, 30000);

    logger.info(`SSE client connected: ${clientId}`);
  }

  // 클라이언트 제거
  removeClient(clientId: string): void {
    this.clients.delete(clientId);
    logger.info(`SSE client disconnected: ${clientId}`);
  }

  // 특정 가게의 클라이언트에게 이벤트 전송
  sendToStoreClients(storeId: string, event: any): void {
    const storeClients = Array.from(this.clients.values())
      .filter(client => client.storeId === storeId);

    storeClients.forEach(client => {
      this.sendEvent(client, event);
    });
  }

  // 특정 사용자의 클라이언트에게 이벤트 전송
  sendToUserClients(userId: string, event: any): void {
    const userClients = Array.from(this.clients.values())
      .filter(client => client.userId === userId);

    userClients.forEach(client => {
      this.sendEvent(client, event);
    });
  }

  // 이벤트 전송
  private sendEvent(client: SSEClient, event: any): void {
    try {
      const eventString = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\nid: ${event.id || Date.now()}\n\n`;
      client.response.write(eventString);
    } catch (error) {
      logger.error(`Failed to send event to client ${client.id}:`, error);
      this.removeClient(client.id);
    }
  }

  // 모든 클라이언트에게 브로드캐스트
  broadcast(event: any): void {
    this.clients.forEach(client => {
      this.sendEvent(client, event);
    });
  }
}

// services/cache.service.ts
import { Redis } from 'ioredis';
import { logger } from '../utils/logger';

export class CacheService {
  private redis: Redis;
  private defaultTTL: number = 300; // 5분

  constructor(redis: Redis) {
    this.redis = redis;
  }

  // 캐시 가져오기
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key);
      if (!data) return null;
      
      return JSON.parse(data) as T;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  // 캐시 설정
  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const stringValue = JSON.stringify(value);
      
      if (ttl) {
        await this.redis.setex(key, ttl, stringValue);
      } else {
        await this.redis.setex(key, this.defaultTTL, stringValue);
      }
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  // 캐시 삭제
  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
    }
  }

  // 패턴으로 캐시 무효화
  async invalidate(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.info(`Invalidated ${keys.length} cache keys with pattern: ${pattern}`);
      }
    } catch (error) {
      logger.error(`Cache invalidate error for pattern ${pattern}:`, error);
    }
  }

  // 여러 키를 한번에 가져오기
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const values = await this.redis.mget(...keys);
      return values.map(value => value ? JSON.parse(value) as T : null);
    } catch (error) {
      logger.error('Cache mget error:', error);
      return keys.map(() => null);
    }
  }

  // 캐시 워밍
  async warm(key: string, fetchFunction: () => Promise<any>, ttl?: number): Promise<any> {
    const cached = await this.get(key);
    if (cached) return cached;

    const data = await fetchFunction();
    await this.set(key, data, ttl);
    return data;
  }
}

// controllers/sse.controller.ts
import { Request, Response } from 'express';
import { SSEService } from '../services/sse.service';
import { v4 as uuidv4 } from 'uuid';

export class SSEController {
  constructor(private sseService: SSEService) {}

  // SSE 연결 엔드포인트
  connect(req: Request, res: Response) {
    const clientId = uuidv4();
    const userId = req.user?.id;
    const storeId = req.query.storeId as string;

    // 연결 추가
    this.sseService.addClient(clientId, res, userId, storeId);

    // 연결 종료 처리
    req.on('close', () => {
      this.sseService.removeClient(clientId);
    });
  }
}

// middleware/cache.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { CacheService } from '../services/cache.service';

export function cacheMiddleware(
  cacheService: CacheService,
  keyGenerator: (req: Request) => string,
  ttl: number = 300
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // POST, PUT, DELETE 등은 캐시하지 않음
    if (req.method !== 'GET') {
      return next();
    }

    const key = keyGenerator(req);
    const cached = await cacheService.get(key);

    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    // 원본 응답 함수를 저장
    const originalJson = res.json;

    // 응답을 가로채서 캐시에 저장
    res.json = function(data: any) {
      res.setHeader('X-Cache', 'MISS');
      
      // 성공 응답만 캐시
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheService.set(key, data, ttl).catch(err => {
          console.error('Failed to cache response:', err);
        });
      }

      return originalJson.call(this, data);
    };

    next();
  };
}

// utils/redis.ts
import { Redis } from 'ioredis';
import { logger } from './logger';

export function createRedisClient(): Redis {
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    reconnectOnError: (err) => {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        return true;
      }
      return false;
    }
  });

  redis.on('connect', () => {
    logger.info('Redis connected');
  });

  redis.on('error', (err) => {
    logger.error('Redis error:', err);
  });

  return redis;
}

// utils/logger.ts
import winston from 'winston';
import 'winston-daily-rotate-file';

const logDir = process.env.LOG_DIR || 'logs';

// 일별 로그 파일 로테이션 설정
const dailyRotateFileTransport = new winston.transports.DailyRotateFile({
  filename: `${logDir}/%DATE%-app.log`,
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  )
});

// 에러 로그 전용 트랜스포트
const errorFileTransport = new winston.transports.DailyRotateFile({
  filename: `${logDir}/%DATE%-error.log`,
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d',
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  )
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'reservation-api' },
  transports: [
    dailyRotateFileTransport,
    errorFileTransport
  ]
});

// 개발 환경에서는 콘솔에도 출력
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// app.ts - 메인 애플리케이션 설정
import express from 'express';
import { Pool } from 'pg';
import { createRedisClient } from './utils/redis';
import { ReservationService } from './services/reservation.service';
import { NotificationService } from './services/notification.service';
import { CacheService } from './services/cache.service';
import { SSEService } from './services/sse.service';
import { ReservationController } from './controllers/reservation.controller';
import { SSEController } from './controllers/sse.controller';
import { createReservationRouter } from './routes/reservation.routes';
import { authMiddleware } from './middleware/auth.middleware';
import { rateLimiter } from './middleware/rateLimiter.middleware';
import { cacheMiddleware } from './middleware/cache.middleware';
import { setupNotificationCrons } from './cron/notification.cron';

const app = express();

// 미들웨어
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 데이터베이스 연결
const db = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis 연결
const redis = createRedisClient();

// 서비스 초기화
const cacheService = new CacheService(redis);
const notificationService = new NotificationService();
const sseService = new SSEService(redis);
const reservationService = new ReservationService(db, redis, notificationService, cacheService);

// 컨트롤러 초기화
const reservationController = new ReservationController(reservationService);
const sseController = new SSEController(sseService);

// 라우트 설정
const reservationRouter = createReservationRouter(reservationController);

// SSE 엔드포인트 (캐시 미들웨어 제외)
app.get('/api/v1/sse', authMiddleware, sseController.connect.bind(sseController));

// API 라우트
app.use('/api/v1', rateLimiter, reservationRouter);

// 캐시 적용 예시
app.get(
  '/api/v1/stores/:storeId/reservations',
  authMiddleware,
  cacheMiddleware(
    cacheService,
    (req) => `reservations:store:${req.params.storeId}:${req.query.date || 'all'}`,
    300 // 5분
  ),
  (req, res, next) => reservationController.getReservations(req, res, next)
);

// 크론잡 설정
setupNotificationCrons(reservationService, notificationService);

// 에러 핸들러
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// 서버 시작
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});

// 프로세스 종료 처리
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // 연결 정리
  await db.end();
  await redis.quit();
  
  process.exit(0);
});

export default app;