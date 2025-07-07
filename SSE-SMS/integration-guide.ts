// === 프론트엔드 통합 ===

// 1. 레이아웃에 NotificationProvider 추가
// app/layout.tsx
import { NotificationProvider } from '@/providers/NotificationProvider';
import { NotificationBell } from '@/components/NotificationBell';

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <NotificationProvider>
          <Header />
          {children}
        </NotificationProvider>
      </body>
    </html>
  );
}

// 2. 헤더에 알림 벨 추가
// components/Header.tsx
export function Header() {
  return (
    <header className="bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-3">
        <Logo />
        <nav>{/* 네비게이션 */}</nav>
        <div className="flex items-center gap-4">
          <NotificationBell />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

// === 백엔드 통합 ===

// 1. 예약 서비스에 알림 연동
// backend/src/services/reservation.service.ts
import { sseService } from './sse.service';
import { smsService } from './sms.service';
import { ReservationEvents } from '../events/reservation.events';

export class ReservationService {
  async createReservation(data: CreateReservationDto): Promise<Reservation> {
    const reservation = await this.reservationRepository.create(data);
    
    // 실시간 알림 발송
    await ReservationEvents.onReservationCreated(reservation);
    
    // SMS 알림 발송
    await smsService.sendReservationCreated(reservation);
    
    return reservation;
  }

  async confirmReservation(reservationId: number): Promise<Reservation> {
    const reservation = await this.reservationRepository.confirm(reservationId);
    
    // 실시간 알림 발송
    await ReservationEvents.onReservationConfirmed(reservation);
    
    // SMS 알림 발송
    await smsService.sendReservationConfirmed(reservation);
    
    return reservation;
  }

  async cancelReservation(
    reservationId: number, 
    cancelledBy: 'store' | 'customer',
    reason?: string
  ): Promise<Reservation> {
    const reservation = await this.reservationRepository.cancel(reservationId);
    
    // 실시간 알림 발송
    await ReservationEvents.onReservationCancelled(reservation, cancelledBy, reason);
    
    // SMS 알림 발송
    await smsService.sendReservationCancelled(reservation, reason);
    
    return reservation;
  }
}

// 2. 관리자 공지사항 발송
// backend/src/controllers/admin.controller.ts
export class AdminController {
  async sendAnnouncement(req: Request, res: Response) {
    const { title, message, priority, targetUsers } = req.body;
    
    // DB에 공지사항 저장
    const announcement = await this.announcementService.create({
      title,
      message,
      priority,
      targetUsers,
      createdBy: req.user.id
    });
    
    // 실시간 알림 발송
    sseService.publishReservationEvent('system:announcement', {
      title,
      message,
      priority
    });
    
    // 중요 공지는 SMS로도 발송
    if (priority === 'urgent') {
      const users = await this.userService.getTargetUsers(targetUsers);
      const messages = users.map(user => ({
        receiver: user.phone,
        message: `[진안군장터 긴급공지]\n${title}\n\n${message}`
      }));
      
      await smsService.sendBulk(messages);
    }
    
    res.json({ success: true, announcement });
  }
}

// === 상점주 대시보드 실시간 업데이트 ===

// frontend/src/pages/store/dashboard.tsx
import { useSSE } from '@/hooks/useSSE';
import { useState, useEffect } from 'react';

export function StoreDashboard() {
  const [todayReservations, setTodayReservations] = useState([]);
  const [realtimeStats, setRealtimeStats] = useState({
    pending: 0,
    confirmed: 0,
    completed: 0
  });

  // 실시간 예약 알림 수신
  useSSE({
    onMessage: (message) => {
      if (message.event === 'reservation:new') {
        // 새 예약 추가
        fetchTodayReservations();
        
        // 사운드 알림 (옵션)
        playNotificationSound();
        
        // 통계 업데이트
        setRealtimeStats(prev => ({
          ...prev,
          pending: prev.pending + 1
        }));
      }
    }
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">상점 대시보드</h1>
      
      {/* 실시간 통계 */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard
          title="대기 중"
          value={realtimeStats.pending}
          color="yellow"
          pulse={realtimeStats.pending > 0}
        />
        <StatCard
          title="확정됨"
          value={realtimeStats.confirmed}
          color="green"
        />
        <StatCard
          title="완료됨"
          value={realtimeStats.completed}
          color="gray"
        />
      </div>

      {/* 오늘의 예약 목록 */}
      <ReservationList
        reservations={todayReservations}
        onConfirm={handleConfirmReservation}
        onCancel={handleCancelReservation}
      />
    </div>
  );
}

// === 사용자 알림 설정 페이지 ===

// frontend/src/pages/settings/notifications.tsx
export function NotificationSettings() {
  const [settings, setSettings] = useState({
    sms: {
      enabled: true,
      reservationCreated: true,
      reservationConfirmed: true,
      reservationCancelled: true,
      reservationReminder: true,
      marketing: false
    },
    push: {
      enabled: true,
      reservationCreated: true,
      reservationConfirmed: true,
      reservationCancelled: true,
      reservationReminder: true,
      marketing: false
    }
  });

  const updateSettings = async (type: string, field: string, value: boolean) => {
    const newSettings = {
      ...settings,
      [type]: {
        ...settings[type],
        [field]: value
      }
    };
    
    setSettings(newSettings);
    
    // API 호출
    await api.put('/users/notification-settings', newSettings);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-xl font-bold mb-6">알림 설정</h2>
      
      {/* SMS 알림 설정 */}
      <div className="bg-white rounded-lg shadow p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">SMS 알림</h3>
          <Switch
            checked={settings.sms.enabled}
            onChange={(v) => updateSettings('sms', 'enabled', v)}
          />
        </div>
        
        {settings.sms.enabled && (
          <div className="space-y-3">
            <NotificationOption
              label="예약 접수 알림"
              checked={settings.sms.reservationCreated}
              onChange={(v) => updateSettings('sms', 'reservationCreated', v)}
            />
            <NotificationOption
              label="예약 확정 알림"
              checked={settings.sms.reservationConfirmed}
              onChange={(v) => updateSettings('sms', 'reservationConfirmed', v)}
            />
            {/* 기타 옵션들... */}
          </div>
        )}
      </div>

      {/* 푸시 알림 설정 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">푸시 알림</h3>
          <Switch
            checked={settings.push.enabled}
            onChange={(v) => updateSettings('push', 'enabled', v)}
          />
        </div>
        {/* 푸시 알림 옵션들... */}
      </div>
    </div>
  );
}

// === 모니터링 대시보드 ===

// backend/src/controllers/monitoring.controller.ts
export class MonitoringController {
  async getRealtimeStats(req: Request, res: Response) {
    const stats = {
      sse: sseService.getConnectedClients(),
      sms: await smsService.getStats(
        new Date(Date.now() - 24 * 60 * 60 * 1000), // 24시간
        new Date()
      ),
      redis: await this.getRedisStats(),
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      }
    };
    
    res.json(stats);
  }

  async testSSE(req: Request, res: Response) {
    const { userId, message } = req.body;
    
    sseService.sendToUser(userId, {
      event: 'test',
      data: { message, timestamp: new Date() }
    });
    
    res.json({ success: true });
  }

  async testSMS(req: Request, res: Response) {
    const { phone, message } = req.body;
    
    const result = await smsService.send({
      receiver: phone,
      message,
      testMode: true
    });
    
    res.json({ success: result });
  }
}

// === 프로덕션 고려사항 ===

// 1. Nginx 설정 (SSE를 위한)
// /etc/nginx/sites-available/jinan-market
/*
location /api/sse/stream {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_set_header Cache-Control 'no-cache';
    proxy_set_header X-Accel-Buffering 'no';
    proxy_buffering off;
    proxy_read_timeout 86400s;
    keepalive_timeout 65;
}
*/

// 2. PM2 ecosystem 설정
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'jinan-market-api',
    script: './dist/index.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    log_file: 'logs/combined.log',
    time: true
  }]
};

// 3. Redis Sentinel 설정 (고가용성)
// backend/src/config/redis.config.ts
import Redis from 'ioredis';

export const createRedisClient = () => {
  if (process.env.NODE_ENV === 'production') {
    // Sentinel 사용
    return new Redis({
      sentinels: [
        { host: 'sentinel-1', port: 26379 },
        { host: 'sentinel-2', port: 26379 },
        { host: 'sentinel-3', port: 26379 }
      ],
      name: 'mymaster',
      password: process.env.REDIS_PASSWORD
    });
  } else {
    // 개발 환경
    return new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT),
      password: process.env.REDIS_PASSWORD
    });
  }
};

// 4. 헬스체크 엔드포인트
// backend/src/routes/health.routes.ts
router.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date(),
    services: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      sms: await checkSMS()
    }
  };
  
  const isHealthy = Object.values(health.services).every(s => s);
  
  res.status(isHealthy ? 200 : 503).json(health);
});