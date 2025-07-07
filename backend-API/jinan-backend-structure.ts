// =============================================
// 진안군 장터 앱 - 백엔드 기본 구조
// =============================================

// package.json
const packageJson = {
  "name": "jinan-market-api",
  "version": "1.0.0",
  "description": "진안군 장터 앱 백엔드 API",
  "main": "dist/server.js",
  "scripts": {
    "dev": "nodemon",
    "build": "tsc",
    "start": "node dist/server.js",
    "start:prod": "NODE_ENV=production node dist/server.js",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "db:migrate": "knex migrate:latest",
    "db:rollback": "knex migrate:rollback",
    "db:seed": "knex seed:run"
  },
  "dependencies": {
    "express": "^4.18.2",
    "express-async-handler": "^1.2.0",
    "express-rate-limit": "^7.1.5",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "joi": "^17.11.0",
    "knex": "^3.0.1",
    "pg": "^8.11.3",
    "redis": "^4.6.11",
    "winston": "^3.11.0",
    "winston-daily-rotate-file": "^4.7.1",
    "multer": "^1.4.5-lts.1",
    "multer-s3": "^3.0.1",
    "aws-sdk": "^2.1508.0",
    "axios": "^1.6.2",
    "dayjs": "^1.11.10",
    "uuid": "^9.0.1",
    "compression": "^1.7.4",
    "express-validator": "^7.0.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.4",
    "@types/cors": "^2.8.17",
    "@types/bcrypt": "^5.0.2",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/multer": "^1.4.11",
    "@types/compression": "^1.7.5",
    "@typescript-eslint/eslint-plugin": "^6.13.2",
    "@typescript-eslint/parser": "^6.13.2",
    "typescript": "^5.3.3",
    "nodemon": "^3.0.2",
    "ts-node": "^10.9.2",
    "eslint": "^8.55.0",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.11",
    "ts-jest": "^29.1.1",
    "supertest": "^6.3.3",
    "@types/supertest": "^2.0.16"
  }
};

// tsconfig.json
const tsConfig = {
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "sourceMap": true,
    "incremental": true,
    "removeComments": true,
    "types": ["node", "jest"],
    "typeRoots": ["./node_modules/@types", "./src/types"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
};

// nodemon.json
const nodemonConfig = {
  "watch": ["src"],
  "ext": "ts,json",
  "ignore": ["src/**/*.spec.ts", "src/**/*.test.ts"],
  "exec": "ts-node -r tsconfig-paths/register ./src/server.ts"
};

// .eslintrc.json
const eslintConfig = {
  "parser": "@typescript-eslint/parser",
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module"
  },
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": ["error", { 
      "argsIgnorePattern": "^_" 
    }],
    "no-console": ["warn", { 
      "allow": ["warn", "error"] 
    }]
  }
};

// src/server.ts - 메인 서버 파일
const serverTs = `
import express from 'express';
import { createServer } from 'http';
import { config } from './config';
import { initializeMiddlewares } from './middlewares';
import { initializeRoutes } from './routes';
import { Database } from './database';
import { Redis } from './services/redis';
import { logger } from './utils/logger';
import { errorHandler } from './middlewares/errorHandler';
import { gracefulShutdown } from './utils/gracefulShutdown';

class Server {
  private app: express.Application;
  private server: any;

  constructor() {
    this.app = express();
  }

  async initialize(): Promise<void> {
    try {
      // 데이터베이스 연결
      await Database.initialize();
      logger.info('Database connected successfully');

      // Redis 연결
      await Redis.initialize();
      logger.info('Redis connected successfully');

      // 미들웨어 초기화
      initializeMiddlewares(this.app);

      // 라우트 초기화
      initializeRoutes(this.app);

      // 에러 핸들러 (마지막에 추가)
      this.app.use(errorHandler);

      // 서버 시작
      const PORT = config.port;
      this.server = createServer(this.app);
      
      this.server.listen(PORT, () => {
        logger.info(\`Server is running on port \${PORT} in \${config.env} mode\`);
      });

      // Graceful shutdown 설정
      gracefulShutdown(this.server);

    } catch (error) {
      logger.error('Failed to initialize server:', error);
      process.exit(1);
    }
  }
}

// 서버 인스턴스 생성 및 시작
const server = new Server();
server.initialize();
`;

// src/config/index.ts - 설정 관리
const configIndexTs = `
import dotenv from 'dotenv';
import joi from 'joi';

// 환경변수 로드
dotenv.config();

// 환경변수 스키마 정의
const envSchema = joi.object({
  NODE_ENV: joi.string()
    .valid('development', 'production', 'test', 'staging')
    .default('development'),
  PORT: joi.number().default(3000),
  
  // Database
  DB_HOST: joi.string().required(),
  DB_PORT: joi.number().default(5432),
  DB_NAME: joi.string().required(),
  DB_USER: joi.string().required(),
  DB_PASSWORD: joi.string().required(),
  
  // Redis
  REDIS_HOST: joi.string().default('localhost'),
  REDIS_PORT: joi.number().default(6379),
  REDIS_PASSWORD: joi.string().allow(''),
  
  // JWT
  JWT_SECRET: joi.string().required(),
  JWT_EXPIRES_IN: joi.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: joi.string().default('30d'),
  
  // Kakao OAuth
  KAKAO_CLIENT_ID: joi.string().required(),
  KAKAO_CLIENT_SECRET: joi.string().required(),
  KAKAO_REDIRECT_URI: joi.string().required(),
  
  // AWS S3
  AWS_ACCESS_KEY_ID: joi.string().required(),
  AWS_SECRET_ACCESS_KEY: joi.string().required(),
  AWS_REGION: joi.string().default('ap-northeast-2'),
  AWS_S3_BUCKET: joi.string().required(),
  
  // API Keys
  SMS_API_KEY: joi.string().required(),
  SMS_SENDER: joi.string().required(),
  
  // CORS
  CORS_ORIGIN: joi.string().default('http://localhost:3001'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: joi.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX_REQUESTS: joi.number().default(100),
}).unknown();

// 환경변수 검증
const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(\`Config validation error: \${error.message}\`);
}

export const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  
  database: {
    host: envVars.DB_HOST,
    port: envVars.DB_PORT,
    name: envVars.DB_NAME,
    user: envVars.DB_USER,
    password: envVars.DB_PASSWORD,
  },
  
  redis: {
    host: envVars.REDIS_HOST,
    port: envVars.REDIS_PORT,
    password: envVars.REDIS_PASSWORD,
  },
  
  jwt: {
    secret: envVars.JWT_SECRET,
    expiresIn: envVars.JWT_EXPIRES_IN,
    refreshExpiresIn: envVars.JWT_REFRESH_EXPIRES_IN,
  },
  
  kakao: {
    clientId: envVars.KAKAO_CLIENT_ID,
    clientSecret: envVars.KAKAO_CLIENT_SECRET,
    redirectUri: envVars.KAKAO_REDIRECT_URI,
  },
  
  aws: {
    accessKeyId: envVars.AWS_ACCESS_KEY_ID,
    secretAccessKey: envVars.AWS_SECRET_ACCESS_KEY,
    region: envVars.AWS_REGION,
    s3Bucket: envVars.AWS_S3_BUCKET,
  },
  
  sms: {
    apiKey: envVars.SMS_API_KEY,
    sender: envVars.SMS_SENDER,
  },
  
  cors: {
    origin: envVars.CORS_ORIGIN.split(','),
  },
  
  rateLimit: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS,
    maxRequests: envVars.RATE_LIMIT_MAX_REQUESTS,
  },
};
`;

// src/database/index.ts - 데이터베이스 연결 관리
const databaseIndexTs = `
import knex, { Knex } from 'knex';
import { config } from '../config';
import { logger } from '../utils/logger';

export class Database {
  private static instance: Knex;

  static async initialize(): Promise<void> {
    if (this.instance) {
      return;
    }

    this.instance = knex({
      client: 'postgresql',
      connection: {
        host: config.database.host,
        port: config.database.port,
        database: config.database.name,
        user: config.database.user,
        password: config.database.password,
        ssl: config.env === 'production' ? { rejectUnauthorized: false } : false,
      },
      pool: {
        min: 2,
        max: 10,
        acquireTimeoutMillis: 30000,
        createTimeoutMillis: 30000,
        destroyTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 100,
      },
      acquireConnectionTimeout: 10000,
    });

    // 연결 테스트
    try {
      await this.instance.raw('SELECT 1');
      logger.info('Database connection established');
    } catch (error) {
      logger.error('Database connection failed:', error);
      throw error;
    }

    // 쿼리 로깅 (개발 환경)
    if (config.env === 'development') {
      this.instance.on('query', (query) => {
        logger.debug('SQL Query:', query.sql);
      });
    }
  }

  static getConnection(): Knex {
    if (!this.instance) {
      throw new Error('Database not initialized');
    }
    return this.instance;
  }

  static async close(): Promise<void> {
    if (this.instance) {
      await this.instance.destroy();
      logger.info('Database connection closed');
    }
  }
}

// Helper function for transactions
export const transaction = async <T>(
  callback: (trx: Knex.Transaction) => Promise<T>
): Promise<T> => {
  const db = Database.getConnection();
  return db.transaction(callback);
};
`;

// src/middlewares/index.ts - 미들웨어 초기화
const middlewaresIndexTs = `
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { rateLimiter } from './rateLimiter';
import { requestLogger } from './requestLogger';
import { config } from '../config';

export const initializeMiddlewares = (app: express.Application): void => {
  // 보안 헤더
  app.use(helmet({
    contentSecurityPolicy: config.env === 'production' ? undefined : false,
  }));

  // CORS
  app.use(cors({
    origin: config.cors.origin,
    credentials: true,
    optionsSuccessStatus: 200,
  }));

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Compression
  app.use(compression());

  // Request logging
  app.use(requestLogger);

  // Rate limiting
  app.use('/api', rateLimiter);

  // Health check
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });
};
`;

// src/middlewares/auth.ts - 인증 미들웨어
const authMiddlewareTs = `
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { Database } from '../database';
import { AppError } from '../utils/appError';
import { asyncHandler } from '../utils/asyncHandler';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authenticate = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      throw new AppError('인증 토큰이 없습니다.', 401);
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as any;
      
      const db = Database.getConnection();
      const user = await db('users')
        .where({ id: decoded.id, is_active: true })
        .first();

      if (!user) {
        throw new AppError('사용자를 찾을 수 없습니다.', 401);
      }

      req.user = {
        id: user.id,
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

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError('인증이 필요합니다.', 401);
    }

    if (!roles.includes(req.user.role)) {
      throw new AppError('권한이 없습니다.', 403);
    }

    next();
  };
};

// 선택적 인증 (로그인하지 않아도 접근 가능)
export const optionalAuth = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return next();
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as any;
      
      const db = Database.getConnection();
      const user = await db('users')
        .where({ id: decoded.id, is_active: true })
        .first();

      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role,
        };
      }
    } catch (error) {
      // 토큰이 유효하지 않아도 계속 진행
    }

    next();
  }
);
`;

// src/middlewares/validation.ts - 유효성 검사 미들웨어
const validationMiddlewareTs = `
import { Request, Response, NextFunction } from 'express';
import { Schema } from 'joi';
import { AppError } from '../utils/appError';

export const validate = (schema: Schema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      throw new AppError('유효성 검사 실패', 400, errors);
    }

    req.body = value;
    next();
  };
};

export const validateQuery = (schema: Schema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      throw new AppError('쿼리 파라미터 유효성 검사 실패', 400, errors);
    }

    req.query = value;
    next();
  };
};

export const validateParams = (schema: Schema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      throw new AppError('파라미터 유효성 검사 실패', 400, errors);
    }

    req.params = value;
    next();
  };
};
`;

// src/middlewares/errorHandler.ts - 에러 핸들러
const errorHandlerTs = `
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/appError';
import { logger } from '../utils/logger';
import { config } from '../config';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (res.headersSent) {
    return next(err);
  }

  // AppError 인스턴스인 경우
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
      errors: err.errors,
      ...(config.env === 'development' && { stack: err.stack }),
    });
  }

  // 데이터베이스 에러 처리
  if (err.message.includes('duplicate key')) {
    return res.status(409).json({
      status: 'error',
      message: '중복된 데이터가 존재합니다.',
    });
  }

  if (err.message.includes('foreign key')) {
    return res.status(400).json({
      status: 'error',
      message: '참조하는 데이터가 존재하지 않습니다.',
    });
  }

  // 예상치 못한 에러
  logger.error('Unhandled error:', err);

  res.status(500).json({
    status: 'error',
    message: '서버 내부 오류가 발생했습니다.',
    ...(config.env === 'development' && { 
      error: err.message,
      stack: err.stack 
    }),
  });
};

// 404 핸들러
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.status(404).json({
    status: 'error',
    message: '요청한 리소스를 찾을 수 없습니다.',
    path: req.originalUrl,
  });
};
`;

// src/utils/appError.ts - 커스텀 에러 클래스
const appErrorTs = `
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public errors?: any[];

  constructor(
    message: string,
    statusCode: number,
    errors?: any[]
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.errors = errors;

    Error.captureStackTrace(this, this.constructor);
  }
}
`;

// src/utils/logger.ts - 로거 설정
const loggerTs = `
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config } from '../config';
import path from 'path';

const logDir = 'logs';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return \`\${timestamp} [\${level}]: \${message} \${
      Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
    }\`;
  })
);

// 파일 로그 설정
const fileRotateTransport = new DailyRotateFile({
  filename: path.join(logDir, '%DATE%-combined.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: logFormat,
});

const errorFileRotateTransport = new DailyRotateFile({
  filename: path.join(logDir, '%DATE%-error.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  level: 'error',
  format: logFormat,
});

// Logger 인스턴스 생성
export const logger = winston.createLogger({
  level: config.env === 'development' ? 'debug' : 'info',
  format: logFormat,
  transports: [
    fileRotateTransport,
    errorFileRotateTransport,
  ],
});

// 개발 환경에서 콘솔 출력
if (config.env !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}
`;

// src/routes/index.ts - 라우트 초기화
const routesIndexTs = `
import express from 'express';
import { authRouter } from './auth.routes';
import { userRouter } from './user.routes';
import { storeRouter } from './store.routes';
import { menuRouter } from './menu.routes';
import { reservationRouter } from './reservation.routes';
import { reviewRouter } from './review.routes';
import { uploadRouter } from './upload.routes';
import { adminRouter } from './admin.routes';
import { notFoundHandler } from '../middlewares/errorHandler';

export const initializeRoutes = (app: express.Application): void => {
  // API 라우트
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/users', userRouter);
  app.use('/api/v1/stores', storeRouter);
  app.use('/api/v1/menus', menuRouter);
  app.use('/api/v1/reservations', reservationRouter);
  app.use('/api/v1/reviews', reviewRouter);
  app.use('/api/v1/upload', uploadRouter);
  app.use('/api/v1/admin', adminRouter);

  // API 문서 (개발 환경)
  if (process.env.NODE_ENV === 'development') {
    app.get('/api/docs', (req, res) => {
      res.json({
        message: 'API Documentation',
        version: 'v1',
        endpoints: {
          auth: '/api/v1/auth',
          users: '/api/v1/users',
          stores: '/api/v1/stores',
          menus: '/api/v1/menus',
          reservations: '/api/v1/reservations',
          reviews: '/api/v1/reviews',
          upload: '/api/v1/upload',
          admin: '/api/v1/admin',
        },
      });
    });
  }

  // 404 처리
  app.use(notFoundHandler);
};
`;

// src/services/redis.ts - Redis 서비스
const redisServiceTs = `
import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import { logger } from '../utils/logger';

export class Redis {
  private static client: RedisClientType;

  static async initialize(): Promise<void> {
    this.client = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      password: config.redis.password || undefined,
    });

    this.client.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    this.client.on('connect', () => {
      logger.info('Redis Client Connected');
    });

    await this.client.connect();
  }

  static getClient(): RedisClientType {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }
    return this.client;
  }

  static async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  static async set(
    key: string,
    value: string,
    ttl?: number
  ): Promise<void> {
    if (ttl) {
      await this.client.setEx(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  static async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  static async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  static async expire(key: string, ttl: number): Promise<void> {
    await this.client.expire(key, ttl);
  }

  static async flushAll(): Promise<void> {
    await this.client.flushAll();
  }

  static async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      logger.info('Redis connection closed');
    }
  }
}

// Cache wrapper
export class Cache {
  static async get<T>(key: string): Promise<T | null> {
    const data = await Redis.get(key);
    if (!data) return null;
    
    try {
      return JSON.parse(data);
    } catch {
      return data as T;
    }
  }

  static async set(
    key: string,
    value: any,
    ttl?: number
  ): Promise<void> {
    const data = typeof value === 'string' ? value : JSON.stringify(value);
    await Redis.set(key, data, ttl);
  }

  static async invalidate(pattern: string): Promise<void> {
    const client = Redis.getClient();
    const keys = await client.keys(pattern);
    
    if (keys.length > 0) {
      await client.del(keys);
    }
  }
}
`;

// src/utils/asyncHandler.ts - 비동기 핸들러
const asyncHandlerTs = `
import { Request, Response, NextFunction } from 'express';

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
`;

// src/utils/pagination.ts - 페이지네이션 헬퍼
const paginationTs = `
export interface PaginationOptions {
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginationResult<T> {
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

export const paginate = <T>(
  data: T[],
  total: number,
  options: PaginationOptions
): PaginationResult<T> => {
  const { page, limit } = options;
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
};

export const getPaginationOptions = (query: any): PaginationOptions => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const sort = query.sort || 'created_at';
  const order = query.order === 'asc' ? 'asc' : 'desc';

  return { page, limit, sort, order };
};

export const getOffset = (page: number, limit: number): number => {
  return (page - 1) * limit;
};
`;

// src/utils/gracefulShutdown.ts - Graceful Shutdown
const gracefulShutdownTs = `
import { Server } from 'http';
import { Database } from '../database';
import { Redis } from '../services/redis';
import { logger } from './logger';

export const gracefulShutdown = (server: Server): void => {
  const shutdown = async (signal: string) => {
    logger.info(\`\${signal} signal received: closing HTTP server\`);
    
    server.close(async () => {
      logger.info('HTTP server closed');
      
      try {
        // 데이터베이스 연결 종료
        await Database.close();
        
        // Redis 연결 종료
        await Redis.close();
        
        logger.info('All connections closed successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    });

    // 30초 후 강제 종료
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000);
  };

  // 종료 시그널 처리
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // 예외 처리
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    shutdown('UNCAUGHT_EXCEPTION');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    shutdown('UNHANDLED_REJECTION');
  });
};
`;

// 프로젝트 구조 설명
const projectStructure = `
jinan-market-api/
├── src/
│   ├── config/              # 설정 관리
│   │   └── index.ts
│   ├── controllers/         # 컨트롤러 (비즈니스 로직)
│   │   ├── auth.controller.ts
│   │   ├── store.controller.ts
│   │   └── ...
│   ├── database/           # 데이터베이스 관련
│   │   ├── index.ts
│   │   └── models/         # 데이터 모델
│   ├── middlewares/        # Express 미들웨어
│   │   ├── index.ts
│   │   ├── auth.ts
│   │   ├── validation.ts
│   │   └── errorHandler.ts
│   ├── routes/             # API 라우트
│   │   ├── index.ts
│   │   ├── auth.routes.ts
│   │   └── ...
│   ├── services/           # 외부 서비스
│   │   ├── redis.ts
│   │   ├── s3.ts
│   │   └── sms.ts
│   ├── utils/              # 유틸리티 함수
│   │   ├── logger.ts
│   │   ├── asyncHandler.ts
│   │   └── ...
│   ├── types/              # TypeScript 타입 정의
│   └── server.ts           # 메인 서버 파일
├── tests/                  # 테스트 파일
├── logs/                   # 로그 파일 (gitignore)
├── .env                    # 환경변수 (gitignore)
├── .env.example           # 환경변수 예시
├── package.json
├── tsconfig.json
├── nodemon.json
└── README.md
`;

console.log('백엔드 기본 구조가 생성되었습니다.');
console.log(projectStructure);
