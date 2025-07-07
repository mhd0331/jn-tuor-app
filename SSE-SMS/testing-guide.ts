// === 단위 테스트 ===

// backend/src/__tests__/services/sms.service.test.ts
import { smsService } from '../../services/sms.service';

describe('SMSService', () => {
  beforeEach(() => {
    // 테스트 모드 설정
    process.env.NODE_ENV = 'test';
  });

  describe('send', () => {
    it('should send SMS in test mode', async () => {
      const result = await smsService.send({
        receiver: '01012345678',
        message: 'Test message',
        testMode: true
      });

      expect(result).toBe(true);
    });

    it('should replace template variables correctly', async () => {
      const spy = jest.spyOn(smsService, 'send');
      
      await smsService.sendWithTemplate('reservation_confirmed', '01012345678', {
        storeName: '맛있는 식당',
        reservationTime: '오후 6시',
        storeAddress: '진안군 진안읍 123',
        reservationId: 'R123456'
      });

      expect(spy).toHaveBeenCalledWith({
        receiver: '01012345678',
        message: expect.stringContaining('맛있는 식당'),
        title: '예약 확정 알림'
      });
    });
  });

  describe('bulk send', () => {
    it('should handle bulk SMS correctly', async () => {
      const messages = Array(50).fill(null).map((_, i) => ({
        receiver: `0101234${String(i).padStart(4, '0')}`,
        message: 'Bulk test message'
      }));

      const result = await smsService.sendBulk(messages);
      
      expect(result.success).toBe(50);
      expect(result.failed).toBe(0);
    });
  });
});

// backend/src/__tests__/services/sse.service.test.ts
import { sseService } from '../../services/sse.service';
import { Response } from 'express';

describe('SSEService', () => {
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockResponse = {
      writeHead: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      on: jest.fn()
    };
  });

  describe('connect', () => {
    it('should establish SSE connection', () => {
      sseService.connect(
        'test-client-id',
        'test-user-id',
        'customer',
        mockResponse as Response
      );

      expect(mockResponse.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      });

      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining('event: connected')
      );
    });
  });

  describe('message broadcasting', () => {
    it('should send message to specific user', () => {
      // 사용자 연결
      sseService.connect(
        'client-1',
        'user-123',
        'customer',
        mockResponse as Response
      );

      // 메시지 전송
      sseService.sendToUser('user-123', {
        event: 'test',
        data: { message: 'Hello' }
      });

      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining('event: test')
      );
    });

    it('should broadcast to all clients', () => {
      const clients = [];
      
      // 여러 클라이언트 연결
      for (let i = 0; i < 3; i++) {
        const response = {
          ...mockResponse,
          write: jest.fn()
        };
        clients.push(response);
        
        sseService.connect(
          `client-${i}`,
          `user-${i}`,
          'customer',
          response as Response
        );
      }

      // 브로드캐스트
      sseService.broadcast({
        event: 'announcement',
        data: { message: 'System update' }
      });

      // 모든 클라이언트가 메시지를 받았는지 확인
      clients.forEach(client => {
        expect(client.write).toHaveBeenCalledWith(
          expect.stringContaining('event: announcement')
        );
      });
    });
  });
});

// === 통합 테스트 ===

// backend/src/__tests__/integration/notification.test.ts
import request from 'supertest';
import { app } from '../../app';
import { pool } from '../../config/database';

describe('Notification Integration', () => {
  let authToken: string;
  let storeToken: string;

  beforeAll(async () => {
    // 테스트 사용자 생성 및 로그인
    const userRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        name: '테스트 사용자',
        phone: '01012345678'
      });
    
    authToken = userRes.body.token;

    // 상점주 토큰도 생성
    const storeRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'store@example.com',
        password: 'password123'
      });
    
    storeToken = storeRes.body.token;
  });

  describe('Reservation notifications', () => {
    it('should trigger notifications on reservation creation', async () => {
      // SSE 연결 모의
      const sseClient = request(app)
        .get('/api/sse/stream')
        .set('Authorization', `Bearer ${storeToken}`)
        .expect(200);

      // 예약 생성
      const reservation = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          storeId: 1,
          reservationTime: '2025-07-08T18:00:00Z',
          menuItems: [{ id: 1, quantity: 2 }],
          specialRequests: '알레르기 있습니다'
        })
        .expect(201);

      // SSE 메시지 확인
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // SMS 로그 확인
      const smsLogs = await pool.query(
        'SELECT * FROM sms_logs WHERE receiver = $1',
        ['01098765432'] // 상점주 전화번호
      );
      
      expect(smsLogs.rows).toHaveLength(1);
      expect(smsLogs.rows[0].status).toBe('test');
    });
  });
});

// === E2E 테스트 ===

// cypress/e2e/notifications.cy.ts
describe('Notification System E2E', () => {
  beforeEach(() => {
    cy.login('customer@example.com', 'password123');
  });

  it('should show real-time notifications', () => {
    // 알림 벨 확인
    cy.get('[data-testid="notification-bell"]').should('be.visible');
    
    // 예약 생성
    cy.visit('/stores/1');
    cy.get('[data-testid="reserve-button"]').click();
    cy.fillReservationForm({
      date: '2025-07-08',
      time: '18:00',
      guests: 2
    });
    cy.get('[data-testid="submit-reservation"]').click();
    
    // 다른 브라우저 세션 시뮬레이션 (상점주)
    cy.task('loginAsStore').then((storeSession) => {
      // 상점주가 예약 확인
      cy.window().then((win) => {
        win.postMessage({
          type: 'CONFIRM_RESERVATION',
          reservationId: 123
        }, '*');
      });
    });
    
    // 고객 측에서 알림 수신 확인
    cy.get('[data-testid="notification-bell"]').click();
    cy.contains('예약이 확정되었습니다').should('be.visible');
    
    // 토스트 알림 확인
    cy.get('.toast').should('contain', '예약이 확정되었습니다');
  });

  it('should handle offline messages', () => {
    // 오프라인 시뮬레이션
    cy.window().then((win) => {
      win.dispatchEvent(new Event('offline'));
    });
    
    // 예약 생성 (오프라인 상태)
    cy.createReservation();
    
    // 온라인 복귀
    cy.window().then((win) => {
      win.dispatchEvent(new Event('online'));
    });
    
    // 대기 중이던 알림 수신 확인
    cy.wait(1000);
    cy.get('[data-testid="notification-count"]').should('contain', '1');
  });
});

// === 부하 테스트 ===

// k6/notification-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // 100명까지 증가
    { duration: '5m', target: 100 }, // 100명 유지
    { duration: '2m', target: 200 }, // 200명까지 증가
    { duration: '5m', target: 200 }, // 200명 유지
    { duration: '2m', target: 0 },   // 0명으로 감소
  ],
  thresholds: {
    http_req_failed: ['rate<0.1'], // 에러율 10% 미만
    http_req_duration: ['p(95)<500'], // 95%가 500ms 이내
  },
};

export default function () {
  // SSE 연결 시뮬레이션
  const params = {
    headers: {
      'Authorization': `Bearer ${__ENV.AUTH_TOKEN}`,
    },
    timeout: '60s',
  };

  const res = http.get(
    'http://localhost:3000/api/sse/stream',
    params
  );

  check(res, {
    'SSE connected': (r) => r.status === 200,
    'Content-Type is event-stream': (r) => 
      r.headers['Content-Type'] === 'text/event-stream',
  });

  errorRate.add(res.status !== 200);

  // 연결 유지
  sleep(30);
}

// === 디버깅 도구 ===

// backend/src/utils/debug-panel.ts
import { Router } from 'express';
import { sseService } from '../services/sse.service';
import { smsService } from '../services/sms.service';

const debugRouter = Router();

// 개발 환경에서만 활성화
if (process.env.NODE_ENV === 'development') {
  // SSE 디버그 패널
  debugRouter.get('/sse/dashboard', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>SSE Debug Dashboard</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .stats { background: #f0f0f0; padding: 10px; margin: 10px 0; }
          .log { background: #fff; border: 1px solid #ddd; padding: 10px; height: 300px; overflow-y: scroll; }
          button { padding: 10px 20px; margin: 5px; cursor: pointer; }
        </style>
      </head>
      <body>
        <h1>SSE Debug Dashboard</h1>
        
        <div class="stats">
          <h3>Connection Stats</h3>
          <div id="stats"></div>
        </div>
        
        <div>
          <h3>Test Messages</h3>
          <input type="text" id="userId" placeholder="User ID" />
          <input type="text" id="message" placeholder="Message" />
          <button onclick="sendTestMessage()">Send to User</button>
          <button onclick="broadcast()">Broadcast</button>
        </div>
        
        <div class="log">
          <h3>Event Log</h3>
          <div id="log"></div>
        </div>
        
        <script>
          const eventSource = new EventSource('/api/sse/stream');
          const log = document.getElementById('log');
          
          eventSource.onmessage = (e) => {
            log.innerHTML += \`<div>\${new Date().toISOString()}: \${e.data}</div>\`;
            log.scrollTop = log.scrollHeight;
          };
          
          function updateStats() {
            fetch('/api/sse/status')
              .then(r => r.json())
              .then(data => {
                document.getElementById('stats').innerHTML = \`
                  Total: \${data.total}<br>
                  Customers: \${data.byType.customer}<br>
                  Stores: \${data.byType.store}<br>
                  Admins: \${data.byType.admin}
                \`;
              });
          }
          
          function sendTestMessage() {
            const userId = document.getElementById('userId').value;
            const message = document.getElementById('message').value;
            
            fetch('/api/debug/test-sse', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, message })
            });
          }
          
          function broadcast() {
            const message = document.getElementById('message').value;
            
            fetch('/api/debug/broadcast', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message })
            });
          }
          
          setInterval(updateStats, 1000);
          updateStats();
        </script>
      </body>
      </html>
    `);
  });

  // 테스트 엔드포인트
  debugRouter.post('/test-sse', (req, res) => {
    const { userId, message } = req.body;
    sseService.sendToUser(userId, {
      event: 'debug',
      data: { message, timestamp: new Date() }
    });
    res.json({ success: true });
  });

  debugRouter.post('/broadcast', (req, res) => {
    const { message } = req.body;
    sseService.broadcast({
      event: 'debug:broadcast',
      data: { message, timestamp: new Date() }
    });
    res.json({ success: true });
  });

  // SMS 테스트
  debugRouter.post('/test-sms', async (req, res) => {
    const { phone, templateId, variables } = req.body;
    
    const result = await smsService.sendWithTemplate(
      templateId,
      phone,
      variables
    );
    
    res.json({ success: result });
  });
}

export default debugRouter;