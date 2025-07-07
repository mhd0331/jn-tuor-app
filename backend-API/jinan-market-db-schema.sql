-- =============================================
-- 진안군 장터 앱 데이터베이스 스키마
-- PostgreSQL 15+ 
-- =============================================

-- 확장 모듈 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- UUID 생성
CREATE EXTENSION IF NOT EXISTS "postgis";        -- 지리 정보 처리
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- 텍스트 검색 최적화

-- =============================================
-- 1. USERS (사용자) 테이블
-- =============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kakao_id VARCHAR(255) UNIQUE,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- 카카오 로그인 사용자는 NULL
    profile_image_url VARCHAR(500),
    role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'store_owner', 'admin', 'super_admin')),
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX idx_users_kakao_id ON users(kakao_id) WHERE kakao_id IS NOT NULL;
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_role_active ON users(role, is_active);

-- =============================================
-- 2. MYEONS (면) 테이블
-- =============================================
CREATE TABLE myeons (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    image_url VARCHAR(500),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 초기 데이터
INSERT INTO myeons (name, description, display_order) VALUES 
('진안읍', '진안군의 중심지', 1),
('용담면', '용담호가 있는 아름다운 면', 2),
('안천면', '전통이 살아있는 고장', 3),
('동향면', '동쪽의 향기로운 마을', 4),
('상전면', '고원의 정취가 있는 곳', 5),
('백운면', '백운산 자락의 평화로운 마을', 6),
('성수면', '맑은 물이 흐르는 곳', 7),
('마령면', '마이산과 가까운 면', 8),
('부귀면', '부귀농촌의 중심지', 9),
('정천면', '정겨운 시골 마을', 10),
('주천면', '주천천이 흐르는 곳', 11);

-- =============================================
-- 3. CATEGORIES (카테고리) 테이블
-- =============================================
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(50) NOT NULL UNIQUE,
    icon VARCHAR(50),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 초기 카테고리 데이터
INSERT INTO categories (name, slug, icon, display_order) VALUES 
('한식', 'korean', 'restaurant', 1),
('카페/베이커리', 'cafe', 'coffee', 2),
('농산물', 'agriculture', 'leaf', 3),
('특산품', 'specialty', 'gift', 4),
('전통시장', 'market', 'store', 5),
('숙박', 'accommodation', 'bed', 6),
('체험', 'experience', 'users', 7),
('기타', 'etc', 'more-horizontal', 8);

-- =============================================
-- 4. STORES (상점) 테이블
-- =============================================
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    myeon_id INTEGER REFERENCES myeons(id) ON DELETE RESTRICT,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) UNIQUE NOT NULL,
    description TEXT,
    short_description VARCHAR(500),
    
    -- 주소 정보
    address VARCHAR(500) NOT NULL,
    address_detail VARCHAR(200),
    postal_code VARCHAR(10),
    
    -- 위치 정보 (PostGIS)
    location GEOGRAPHY(POINT, 4326),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- 연락처
    phone_number VARCHAR(20) NOT NULL,
    mobile_number VARCHAR(20),
    email VARCHAR(255),
    website_url VARCHAR(500),
    
    -- 영업 정보
    business_hours_text VARCHAR(500),
    regular_holiday VARCHAR(200),
    
    -- 결제 정보
    bank_name VARCHAR(50),
    account_number VARCHAR(50),
    account_holder VARCHAR(100),
    
    -- 이미지
    logo_image_url VARCHAR(500),
    main_image_url VARCHAR(500),
    
    -- 알림 설정
    notification_method VARCHAR(20) DEFAULT 'sms' CHECK (notification_method IN ('sms', 'lms', 'mms', 'kakao')),
    notification_contact VARCHAR(100),
    
    -- 상태 및 통계
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'suspended', 'closed')),
    is_featured BOOLEAN DEFAULT false,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    average_rating DECIMAL(3, 2) DEFAULT 0,
    
    -- 타임스탬프
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX idx_stores_owner_id ON stores(owner_id);
CREATE INDEX idx_stores_myeon_category ON stores(myeon_id, category_id);
CREATE INDEX idx_stores_status_featured ON stores(status, is_featured);
CREATE INDEX idx_stores_location ON stores USING GIST(location);
CREATE INDEX idx_stores_name_trgm ON stores USING GIN(name gin_trgm_ops);
CREATE INDEX idx_stores_created_at ON stores(created_at DESC);

-- =============================================
-- 5. STORE_OPERATING_HOURS (영업시간) 테이블
-- =============================================
CREATE TABLE store_operating_hours (
    id SERIAL PRIMARY KEY,
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0: 일요일, 6: 토요일
    open_time TIME,
    close_time TIME,
    is_closed BOOLEAN DEFAULT false,
    break_start_time TIME,
    break_end_time TIME,
    last_order_time TIME,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, day_of_week)
);

-- 인덱스
CREATE INDEX idx_operating_hours_store_id ON store_operating_hours(store_id);

-- =============================================
-- 6. STORE_MEDIA (상점 미디어) 테이블
-- =============================================
CREATE TABLE store_media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('image', 'video', 'youtube')),
    media_url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500),
    title VARCHAR(200),
    description TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX idx_store_media_store_id ON store_media(store_id, is_active);
CREATE INDEX idx_store_media_display_order ON store_media(store_id, display_order);

-- =============================================
-- 7. MENUS (메뉴) 테이블
-- =============================================
CREATE TABLE menus (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    category_name VARCHAR(100),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    price DECIMAL(10, 0) NOT NULL CHECK (price >= 0),
    discounted_price DECIMAL(10, 0) CHECK (discounted_price >= 0),
    
    -- 옵션 정보
    options JSONB, -- {name: "사이즈", choices: [{name: "S", price: 0}, {name: "L", price: 500}]}
    
    -- 이미지
    image_url VARCHAR(500),
    
    -- 상태
    is_available BOOLEAN DEFAULT true,
    is_popular BOOLEAN DEFAULT false,
    is_new BOOLEAN DEFAULT false,
    stock_quantity INTEGER,
    
    -- 통계
    order_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX idx_menus_store_id ON menus(store_id, is_available);
CREATE INDEX idx_menus_category ON menus(store_id, category_name);
CREATE INDEX idx_menus_popular ON menus(store_id, is_popular) WHERE is_popular = true;

-- =============================================
-- 8. RESERVATIONS (예약) 테이블
-- =============================================
CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- 예약자 정보 (비회원도 가능)
    reserver_name VARCHAR(100) NOT NULL,
    reserver_phone VARCHAR(20) NOT NULL,
    reserver_email VARCHAR(255),
    
    -- 예약 정보
    reservation_date DATE NOT NULL,
    reservation_time TIME NOT NULL,
    number_of_people INTEGER NOT NULL CHECK (number_of_people > 0),
    
    -- 예약 항목 (JSON 배열)
    reservation_items JSONB, -- [{menu_id, quantity, price, options}]
    
    -- 금액 정보
    total_amount DECIMAL(10, 0) DEFAULT 0,
    deposit_amount DECIMAL(10, 0) DEFAULT 0,
    
    -- 요청사항
    special_requests TEXT,
    discount_info TEXT,
    
    -- 상태 관리
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
    cancelled_by VARCHAR(20) CHECK (cancelled_by IN ('user', 'store', 'admin', 'system')),
    cancellation_reason TEXT,
    
    -- 타임스탬프
    confirmed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX idx_reservations_store_date ON reservations(store_id, reservation_date);
CREATE INDEX idx_reservations_user_id ON reservations(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_reservations_status ON reservations(status, reservation_date);
CREATE INDEX idx_reservations_phone ON reservations(reserver_phone);

-- =============================================
-- 9. REVIEWS (리뷰) 테이블
-- =============================================
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
    
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    content TEXT NOT NULL,
    
    -- 리뷰 이미지
    images JSONB, -- [{url: "...", caption: "..."}]
    
    -- 상점 답글
    reply_content TEXT,
    reply_at TIMESTAMP WITH TIME ZONE,
    
    -- 통계
    like_count INTEGER DEFAULT 0,
    dislike_count INTEGER DEFAULT 0,
    
    is_verified_purchase BOOLEAN DEFAULT false,
    is_visible BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX idx_reviews_store_id ON reviews(store_id, is_visible);
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_reviews_rating ON reviews(store_id, rating);
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);

-- =============================================
-- 10. NOTIFICATIONS (알림) 테이블
-- =============================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('user', 'store_owner', 'admin')),
    
    -- 관련 정보
    related_type VARCHAR(50), -- 'reservation', 'review', 'store', etc.
    related_id UUID,
    
    -- 알림 내용
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    
    -- 전송 정보
    delivery_method VARCHAR(20) NOT NULL CHECK (delivery_method IN ('push', 'sms', 'kakao', 'email', 'in_app')),
    delivery_status VARCHAR(20) DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed', 'read')),
    
    -- 메타 정보
    metadata JSONB,
    
    sent_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, delivery_status);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- =============================================
-- 11. LIKES (좋아요) 테이블
-- =============================================
CREATE TABLE likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('store', 'menu', 'review')),
    target_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, target_type, target_id)
);

-- 인덱스
CREATE INDEX idx_likes_user_id ON likes(user_id);
CREATE INDEX idx_likes_target ON likes(target_type, target_id);

-- =============================================
-- 12. TAGS (태그) 테이블
-- =============================================
CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(50) NOT NULL UNIQUE,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- 13. STORE_TAGS (상점-태그 연결) 테이블
-- =============================================
CREATE TABLE store_tags (
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (store_id, tag_id)
);

-- 인덱스
CREATE INDEX idx_store_tags_store_id ON store_tags(store_id);
CREATE INDEX idx_store_tags_tag_id ON store_tags(tag_id);

-- =============================================
-- 14. AUDIT_LOGS (감사 로그) 테이블
-- =============================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- =============================================
-- 트리거 함수들
-- =============================================

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 각 테이블에 updated_at 트리거 적용
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_menus_updated_at BEFORE UPDATE ON menus
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON reservations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_myeons_updated_at BEFORE UPDATE ON myeons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 상점 slug 자동 생성 함수
CREATE OR REPLACE FUNCTION generate_store_slug()
RETURNS TRIGGER AS $$
DECLARE
    base_slug VARCHAR(200);
    final_slug VARCHAR(200);
    counter INTEGER := 0;
BEGIN
    -- 한글을 제거하고 영문만 남기거나 ID 기반으로 생성
    base_slug := LOWER(REGEXP_REPLACE(NEW.name, '[^a-zA-Z0-9\s-]', '', 'g'));
    base_slug := REGEXP_REPLACE(base_slug, '\s+', '-', 'g');
    
    -- 빈 문자열이면 ID 기반으로 생성
    IF base_slug = '' THEN
        base_slug := 'store-' || LEFT(REPLACE(NEW.id::TEXT, '-', ''), 8);
    END IF;
    
    final_slug := base_slug;
    
    -- 중복 확인 및 숫자 추가
    WHILE EXISTS(SELECT 1 FROM stores WHERE slug = final_slug AND id != NEW.id) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
    END LOOP;
    
    NEW.slug := final_slug;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_store_slug_trigger
    BEFORE INSERT OR UPDATE OF name ON stores
    FOR EACH ROW
    EXECUTE FUNCTION generate_store_slug();

-- 리뷰 통계 업데이트 함수
CREATE OR REPLACE FUNCTION update_store_review_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE stores
        SET review_count = (
                SELECT COUNT(*) FROM reviews 
                WHERE store_id = NEW.store_id AND is_visible = true
            ),
            average_rating = (
                SELECT AVG(rating)::DECIMAL(3,2) FROM reviews 
                WHERE store_id = NEW.store_id AND is_visible = true
            )
        WHERE id = NEW.store_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE stores
        SET review_count = (
                SELECT COUNT(*) FROM reviews 
                WHERE store_id = OLD.store_id AND is_visible = true
            ),
            average_rating = (
                SELECT COALESCE(AVG(rating)::DECIMAL(3,2), 0) FROM reviews 
                WHERE store_id = OLD.store_id AND is_visible = true
            )
        WHERE id = OLD.store_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_store_review_stats_trigger
    AFTER INSERT OR UPDATE OR DELETE ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_store_review_stats();

-- =============================================
-- 뷰(View) 생성
-- =============================================

-- 상점 상세 정보 뷰
CREATE OR REPLACE VIEW v_store_details AS
SELECT 
    s.*,
    m.name as myeon_name,
    c.name as category_name,
    c.icon as category_icon,
    u.username as owner_name,
    u.phone_number as owner_phone,
    COUNT(DISTINCT r.id) as total_reservations,
    COUNT(DISTINCT rev.id) as total_reviews
FROM stores s
LEFT JOIN myeons m ON s.myeon_id = m.id
LEFT JOIN categories c ON s.category_id = c.id
LEFT JOIN users u ON s.owner_id = u.id
LEFT JOIN reservations r ON s.id = r.store_id
LEFT JOIN reviews rev ON s.id = rev.store_id
GROUP BY s.id, m.name, c.name, c.icon, u.username, u.phone_number;

-- =============================================
-- 보안을 위한 Row Level Security (RLS) 정책
-- =============================================

-- RLS 활성화
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 정보만 수정 가능
CREATE POLICY users_self_policy ON users
    FOR ALL USING (auth.uid() = id OR auth.role() IN ('admin', 'super_admin'));

-- 상점 주인은 자신의 상점만 수정 가능
CREATE POLICY stores_owner_policy ON stores
    FOR ALL USING (owner_id = auth.uid() OR auth.role() IN ('admin', 'super_admin'));

-- 예약은 본인 것만 조회/수정 가능
CREATE POLICY reservations_user_policy ON reservations
    FOR ALL USING (user_id = auth.uid() OR 
                   EXISTS (SELECT 1 FROM stores WHERE id = store_id AND owner_id = auth.uid()) OR
                   auth.role() IN ('admin', 'super_admin'));

-- 리뷰는 본인 것만 수정/삭제 가능
CREATE POLICY reviews_user_policy ON reviews
    FOR UPDATE USING (user_id = auth.uid() OR auth.role() IN ('admin', 'super_admin'))
    FOR DELETE USING (user_id = auth.uid() OR auth.role() IN ('admin', 'super_admin'));

-- =============================================
-- 초기 관리자 계정 생성 (예시)
-- =============================================
INSERT INTO users (username, email, phone_number, role, password_hash) 
VALUES ('관리자', 'admin@jinanmarket.kr', '010-0000-0000', 'super_admin', 
        -- 비밀번호: admin123! (실제로는 bcrypt 해시값)
        '$2b$10$YourHashedPasswordHere');

-- =============================================
-- 데이터베이스 설정 완료
-- =============================================