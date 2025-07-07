# .env.example

# Redis 설정
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# 알리고 SMS API 설정
ALIGO_API_KEY=your_aligo_api_key
ALIGO_USER_ID=your_aligo_user_id
ALIGO_SENDER=your_sender_number  # 발신번호 (예: 0631234567)

# 솔라피 SMS API 설정 (대안)
SOLAPI_API_KEY=your_solapi_api_key
SOLAPI_API_SECRET=your_solapi_api_secret
SOLAPI_SENDER=your_sender_number

# SMS 서비스 선택 (aligo 또는 solapi)
SMS_SERVICE=aligo

# 실시간 알림 설정
SSE_HEARTBEAT_INTERVAL=30000  # 30초
SSE_RECONNECT_INTERVAL=5000   # 5초
SSE_MAX_RETRIES=5

# 알림 설정
NOTIFICATION_REMINDER_MINUTES=60  # 예약 몇 분 전에 리마인더 발송
NOTIFICATION_BATCH_SIZE=1000      # 대량 발송 시 배치 크기

# Node.js 환경
NODE_ENV=development  # development, staging, production