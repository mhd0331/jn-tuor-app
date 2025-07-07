// =============================================
// 진안군 장터 앱 - 마이그레이션 설정 및 관리
// =============================================

// package.json
const packageJson = {
  "name": "jinan-market-api",
  "version": "1.0.0",
  "description": "진안군 장터 앱 백엔드 API",
  "scripts": {
    "db:create": "node scripts/createDatabase.js",
    "db:migrate": "knex migrate:latest",
    "db:migrate:make": "knex migrate:make",
    "db:rollback": "knex migrate:rollback",
    "db:seed": "knex seed:run",
    "db:reset": "npm run db:rollback && npm run db:migrate && npm run db:seed",
    "db:setup": "npm run db:create && npm run db:migrate && npm run db:seed"
  },
  "dependencies": {
    "pg": "^8.11.3",
    "knex": "^3.0.1",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/pg": "^8.10.9"
  }
};

// knexfile.js - Knex 설정 파일
const knexConfig = `
require('dotenv').config();

module.exports = {
  development: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'jinan_market_dev',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres'
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: './seeds'
    }
  },

  staging: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: { rejectUnauthorized: false }
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations'
    }
  },

  production: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: { rejectUnauthorized: false }
    },
    pool: {
      min: 2,
      max: 20
    },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations'
    }
  }
};
`;

// .env.example - 환경변수 예시
const envExample = `
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=jinan_market_dev
DB_USER=postgres
DB_PASSWORD=your_password_here

# Application
NODE_ENV=development
PORT=3000

# JWT
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# Kakao OAuth
KAKAO_CLIENT_ID=your_kakao_client_id
KAKAO_CLIENT_SECRET=your_kakao_client_secret
KAKAO_REDIRECT_URI=http://localhost:3000/auth/kakao/callback

# AWS S3 (파일 업로드)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=ap-northeast-2
AWS_S3_BUCKET=jinan-market

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# SMS (알림)
SMS_API_KEY=your_sms_api_key
SMS_SENDER=010-0000-0000
`;

// scripts/createDatabase.js - 데이터베이스 생성 스크립트
const createDatabaseScript = `
const { Client } = require('pg');
require('dotenv').config();

async function createDatabase() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: 'postgres' // 기본 데이터베이스에 연결
  });

  try {
    await client.connect();
    
    const dbName = process.env.DB_NAME || 'jinan_market_dev';
    
    // 데이터베이스 존재 확인
    const res = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );
    
    if (res.rows.length === 0) {
      // 데이터베이스 생성
      await client.query(\`CREATE DATABASE \${dbName}\`);
      console.log(\`Database '\${dbName}' created successfully\`);
      
      // 확장 모듈 설치를 위해 새 데이터베이스에 연결
      await client.end();
      
      const newClient = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: dbName
      });
      
      await newClient.connect();
      
      // 필요한 확장 모듈 설치
      await newClient.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      await newClient.query('CREATE EXTENSION IF NOT EXISTS "postgis"');
      await newClient.query('CREATE EXTENSION IF NOT EXISTS "pg_trgm"');
      
      console.log('Extensions installed successfully');
      await newClient.end();
    } else {
      console.log(\`Database '\${dbName}' already exists\`);
    }
  } catch (error) {
    console.error('Error creating database:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

createDatabase();
`;

// migrations/20240101000001_initial_schema.js - 초기 마이그레이션
const initialMigration = `
exports.up = async function(knex) {
  // Enable extensions
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "postgis"');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pg_trgm"');

  // 1. Users table
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('kakao_id', 255).unique();
    table.string('username', 100).notNullable();
    table.string('email', 255).unique().notNullable();
    table.string('phone_number', 20).unique().notNullable();
    table.string('password_hash', 255);
    table.string('profile_image_url', 500);
    table.enu('role', ['user', 'store_owner', 'admin', 'super_admin'])
      .notNullable().defaultTo('user');
    table.boolean('is_active').defaultTo(true);
    table.timestamp('last_login_at', { useTz: true });
    table.timestamps(true, true);
    
    // Indexes
    table.index(['kakao_id'], 'idx_users_kakao_id');
    table.index(['email'], 'idx_users_email');
    table.index(['phone_number'], 'idx_users_phone');
    table.index(['role', 'is_active'], 'idx_users_role_active');
  });

  // 2. Myeons table
  await knex.schema.createTable('myeons', (table) => {
    table.increments('id').primary();
    table.string('name', 50).notNullable().unique();
    table.text('description');
    table.string('image_url', 500);
    table.integer('display_order').defaultTo(0);
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
  });

  // 3. Categories table
  await knex.schema.createTable('categories', (table) => {
    table.increments('id').primary();
    table.string('name', 50).notNullable().unique();
    table.string('slug', 50).notNullable().unique();
    table.string('icon', 50);
    table.integer('display_order').defaultTo(0);
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // 4. Stores table
  await knex.schema.createTable('stores', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('owner_id').references('id').inTable('users').onDelete('SET NULL');
    table.integer('myeon_id').references('id').inTable('myeons').onDelete('RESTRICT');
    table.integer('category_id').references('id').inTable('categories').onDelete('SET NULL');
    table.string('name', 200).notNullable();
    table.string('slug', 200).unique().notNullable();
    table.text('description');
    table.string('short_description', 500);
    
    // Address
    table.string('address', 500).notNullable();
    table.string('address_detail', 200);
    table.string('postal_code', 10);
    
    // Location - PostGIS geography type added via raw SQL
    table.decimal('latitude', 10, 8);
    table.decimal('longitude', 11, 8);
    
    // Contact
    table.string('phone_number', 20).notNullable();
    table.string('mobile_number', 20);
    table.string('email', 255);
    table.string('website_url', 500);
    
    // Business info
    table.string('business_hours_text', 500);
    table.string('regular_holiday', 200);
    
    // Payment
    table.string('bank_name', 50);
    table.string('account_number', 50);
    table.string('account_holder', 100);
    
    // Images
    table.string('logo_image_url', 500);
    table.string('main_image_url', 500);
    
    // Notification
    table.enu('notification_method', ['sms', 'lms', 'mms', 'kakao'])
      .defaultTo('sms');
    table.string('notification_contact', 100);
    
    // Status
    table.enu('status', ['pending', 'approved', 'suspended', 'closed'])
      .defaultTo('pending');
    table.boolean('is_featured').defaultTo(false);
    table.integer('view_count').defaultTo(0);
    table.integer('like_count').defaultTo(0);
    table.integer('review_count').defaultTo(0);
    table.decimal('average_rating', 3, 2).defaultTo(0);
    
    // Timestamps
    table.timestamp('approved_at', { useTz: true });
    table.timestamps(true, true);
    
    // Indexes
    table.index(['owner_id'], 'idx_stores_owner_id');
    table.index(['myeon_id', 'category_id'], 'idx_stores_myeon_category');
    table.index(['status', 'is_featured'], 'idx_stores_status_featured');
    table.index(['created_at'], 'idx_stores_created_at');
  });
  
  // Add PostGIS geography column
  await knex.raw('ALTER TABLE stores ADD COLUMN location GEOGRAPHY(POINT, 4326)');
  await knex.raw('CREATE INDEX idx_stores_location ON stores USING GIST(location)');
  await knex.raw('CREATE INDEX idx_stores_name_trgm ON stores USING GIN(name gin_trgm_ops)');

  // Continue with other tables...
  // (나머지 테이블들도 동일한 방식으로 마이그레이션 작성)
};

exports.down = async function(knex) {
  // Drop tables in reverse order
  await knex.schema.dropTableIfExists('audit_logs');
  await knex.schema.dropTableIfExists('store_tags');
  await knex.schema.dropTableIfExists('tags');
  await knex.schema.dropTableIfExists('likes');
  await knex.schema.dropTableIfExists('notifications');
  await knex.schema.dropTableIfExists('reviews');
  await knex.schema.dropTableIfExists('reservations');
  await knex.schema.dropTableIfExists('menus');
  await knex.schema.dropTableIfExists('store_media');
  await knex.schema.dropTableIfExists('store_operating_hours');
  await knex.schema.dropTableIfExists('stores');
  await knex.schema.dropTableIfExists('categories');
  await knex.schema.dropTableIfExists('myeons');
  await knex.schema.dropTableIfExists('users');
};
`;

// seeds/01_initial_data.js - 초기 데이터 시딩
const initialSeed = `
const bcrypt = require('bcrypt');

exports.seed = async function(knex) {
  // 1. Insert myeons
  await knex('myeons').insert([
    { name: '진안읍', description: '진안군의 중심지', display_order: 1 },
    { name: '용담면', description: '용담호가 있는 아름다운 면', display_order: 2 },
    { name: '안천면', description: '전통이 살아있는 고장', display_order: 3 },
    { name: '동향면', description: '동쪽의 향기로운 마을', display_order: 4 },
    { name: '상전면', description: '고원의 정취가 있는 곳', display_order: 5 },
    { name: '백운면', description: '백운산 자락의 평화로운 마을', display_order: 6 },
    { name: '성수면', description: '맑은 물이 흐르는 곳', display_order: 7 },
    { name: '마령면', description: '마이산과 가까운 면', display_order: 8 },
    { name: '부귀면', description: '부귀농촌의 중심지', display_order: 9 },
    { name: '정천면', description: '정겨운 시골 마을', display_order: 10 },
    { name: '주천면', description: '주천천이 흐르는 곳', display_order: 11 }
  ]);

  // 2. Insert categories
  await knex('categories').insert([
    { name: '한식', slug: 'korean', icon: 'restaurant', display_order: 1 },
    { name: '카페/베이커리', slug: 'cafe', icon: 'coffee', display_order: 2 },
    { name: '농산물', slug: 'agriculture', icon: 'leaf', display_order: 3 },
    { name: '특산품', slug: 'specialty', icon: 'gift', display_order: 4 },
    { name: '전통시장', slug: 'market', icon: 'store', display_order: 5 },
    { name: '숙박', slug: 'accommodation', icon: 'bed', display_order: 6 },
    { name: '체험', slug: 'experience', icon: 'users', display_order: 7 },
    { name: '기타', slug: 'etc', icon: 'more-horizontal', display_order: 8 }
  ]);

  // 3. Insert admin user
  const hashedPassword = await bcrypt.hash('admin123!', 10);
  await knex('users').insert({
    username: '관리자',
    email: 'admin@jinanmarket.kr',
    phone_number: '010-0000-0000',
    role: 'super_admin',
    password_hash: hashedPassword
  });

  // 4. Insert demo store owner
  await knex('users').insert({
    username: '김사장',
    email: 'demo@jinanmarket.kr',
    phone_number: '010-1234-5678',
    role: 'store_owner',
    password_hash: hashedPassword
  });
};
`;

// 사용 설명서
const README = `
# 진안군 장터 앱 - 데이터베이스 설정 가이드

## 1. 초기 설정

### 필수 요구사항
- PostgreSQL 15+ 설치
- Node.js 18+ 설치
- PostGIS 확장 모듈

### 설치 단계

1. 프로젝트 디렉토리 생성 및 이동
\`\`\`bash
mkdir jinan-market-api
cd jinan-market-api
\`\`\`

2. package.json 파일 생성 후 의존성 설치
\`\`\`bash
npm install
\`\`\`

3. 환경변수 설정
\`\`\`bash
cp .env.example .env
# .env 파일을 열어 데이터베이스 정보 입력
\`\`\`

4. 데이터베이스 생성 및 마이그레이션
\`\`\`bash
npm run db:setup
\`\`\`

## 2. 마이그레이션 명령어

### 새 마이그레이션 생성
\`\`\`bash
npm run db:migrate:make <migration_name>
\`\`\`

### 마이그레이션 실행
\`\`\`bash
npm run db:migrate
\`\`\`

### 마이그레이션 롤백
\`\`\`bash
npm run db:rollback
\`\`\`

### 데이터베이스 리셋
\`\`\`bash
npm run db:reset
\`\`\`

## 3. 디렉토리 구조

\`\`\`
jinan-market-api/
├── migrations/          # 마이그레이션 파일
├── seeds/              # 시드 데이터
├── scripts/            # 유틸리티 스크립트
├── knexfile.js         # Knex 설정
├── .env                # 환경변수
└── package.json        # 프로젝트 설정
\`\`\`

## 4. 데이터베이스 스키마 특징

- UUID 기반 기본키 (보안 강화)
- PostGIS를 활용한 위치 기반 검색
- 전체 텍스트 검색을 위한 인덱싱
- Row Level Security (RLS) 정책
- 자동 타임스탬프 관리
- 감사 로그 시스템

## 5. 주의사항

- 프로덕션 환경에서는 반드시 강력한 비밀번호 사용
- 정기적인 백업 수행
- 인덱스 성능 모니터링
- 연결 풀 크기 조정
`;

console.log('=== 파일 구조 ===');
console.log('1. package.json - 프로젝트 설정');
console.log('2. knexfile.js - Knex 마이그레이션 설정');
console.log('3. .env.example - 환경변수 예시');
console.log('4. scripts/createDatabase.js - DB 생성 스크립트');
console.log('5. migrations/20240101000001_initial_schema.js - 초기 마이그레이션');
console.log('6. seeds/01_initial_data.js - 초기 데이터');
console.log('7. README.md - 사용 설명서');
