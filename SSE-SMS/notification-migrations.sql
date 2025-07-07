-- SMS 로그 테이블
CREATE TABLE IF NOT EXISTS sms_logs (
    id SERIAL PRIMARY KEY,
    receiver VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    title VARCHAR(100),
    status VARCHAR(20) NOT NULL, -- success, failed, error, test
    response TEXT,
    template_id VARCHAR(50),
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SMS 템플릿 테이블
CREATE TABLE IF NOT EXISTS sms_templates (
    id SERIAL PRIMARY KEY,
    template_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    variables JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 알림 설정 테이블
CREATE TABLE IF NOT EXISTS notification_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    sms_enabled BOOLEAN DEFAULT true,
    sms_reservation_created BOOLEAN DEFAULT true,
    sms_reservation_confirmed BOOLEAN DEFAULT true,
    sms_reservation_cancelled BOOLEAN DEFAULT true,
    sms_reservation_reminder BOOLEAN DEFAULT true,
    sms_marketing BOOLEAN DEFAULT false,
    push_enabled BOOLEAN DEFAULT true,
    push_reservation_created BOOLEAN DEFAULT true,
    push_reservation_confirmed BOOLEAN DEFAULT true,
    push_reservation_cancelled BOOLEAN DEFAULT true,
    push_reservation_reminder BOOLEAN DEFAULT true,
    push_marketing BOOLEAN DEFAULT false,
    email_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- 푸시 토큰 테이블
CREATE TABLE IF NOT EXISTS push_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    device_type VARCHAR(20), -- ios, android, web
    device_info JSONB,
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, token)
);

-- 실시간 알림 이력 테이블
CREATE TABLE IF NOT EXISTS notification_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- reservation_created, system_announcement, etc
    title VARCHAR(200),
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 시스템 공지사항 테이블
CREATE TABLE IF NOT EXISTS system_announcements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
    target_users VARCHAR(20) DEFAULT 'all', -- all, customers, stores, specific
    target_user_ids INTEGER[],
    is_active BOOLEAN DEFAULT true,
    scheduled_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 예약 테이블에 알림 관련 컬럼 추가
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP;

-- 사용자 테이블에 알림 설정 컬럼 추가
ALTER TABLE users
ADD COLUMN IF NOT EXISTS sms_notifications BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS push_notifications BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT false;

-- 인덱스 생성
CREATE INDEX idx_sms_logs_receiver ON sms_logs(receiver);
CREATE INDEX idx_sms_logs_sent_at ON sms_logs(sent_at);
CREATE INDEX idx_sms_logs_status ON sms_logs(status);
CREATE INDEX idx_sms_logs_template_id ON sms_logs(template_id);

CREATE INDEX idx_notification_history_user_id ON notification_history(user_id);
CREATE INDEX idx_notification_history_created_at ON notification_history(created_at);
CREATE INDEX idx_notification_history_is_read ON notification_history(is_read);

CREATE INDEX idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX idx_push_tokens_is_active ON push_tokens(is_active);

CREATE INDEX idx_reservations_reminder ON reservations(reminder_sent, reservation_time) 
WHERE status = 'confirmed' AND reminder_sent = false;

-- 기본 SMS 템플릿 삽입
INSERT INTO sms_templates (template_id, name, content, variables) VALUES
('reservation_created', '예약 접수 알림', 
 '[진안군장터] {{customerName}}님의 예약이 접수되었습니다.\n상점: {{storeName}}\n일시: {{reservationTime}}\n예약번호: {{reservationId}}',
 '["customerName", "storeName", "reservationTime", "reservationId"]'::jsonb),

('reservation_confirmed', '예약 확정 알림',
 '[진안군장터] 예약이 확정되었습니다!\n상점: {{storeName}}\n일시: {{reservationTime}}\n주소: {{storeAddress}}\n\n예약번호: {{reservationId}}',
 '["storeName", "reservationTime", "storeAddress", "reservationId"]'::jsonb),

('reservation_cancelled', '예약 취소 알림',
 '[진안군장터] 예약이 취소되었습니다.\n상점: {{storeName}}\n사유: {{reason}}\n\n문의: {{storePhone}}',
 '["storeName", "reason", "storePhone"]'::jsonb),

('reservation_reminder', '예약 리마인더',
 '[진안군장터] 예약 알림\n{{customerName}}님, 오늘 {{reservationTime}}에 {{storeName}} 예약이 있습니다.\n주소: {{storeAddress}}',
 '["customerName", "reservationTime", "storeName", "storeAddress"]'::jsonb),

('payment_completed', '결제 완료 알림',
 '[진안군장터] 결제가 완료되었습니다.\n금액: {{amount}}원\n상점: {{storeName}}\n\n예약번호: {{reservationId}}',
 '["amount", "storeName", "reservationId"]'::jsonb),

('store_approved', '상점 승인 알림',
 '[진안군장터] 상점 등록이 승인되었습니다!\n상점명: {{storeName}}\n\n지금 바로 메뉴를 등록하고 영업을 시작하세요.',
 '["storeName"]'::jsonb),

('store_rejected', '상점 승인 거부 알림',
 '[진안군장터] 상점 등록이 거부되었습니다.\n사유: {{reason}}\n\n수정 후 다시 신청해주세요.',
 '["reason"]'::jsonb)
ON CONFLICT (template_id) DO NOTHING;

-- 트리거 함수: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 생성
CREATE TRIGGER update_sms_templates_updated_at BEFORE UPDATE ON sms_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_settings_updated_at BEFORE UPDATE ON notification_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_announcements_updated_at BEFORE UPDATE ON system_announcements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();