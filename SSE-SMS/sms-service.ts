// backend/src/services/sms.service.ts
import axios from 'axios';
import FormData from 'form-data';
import { pool } from '../config/database';

interface SMSConfig {
  apiKey: string;
  userId: string;
  sender: string;
  testMode: boolean;
}

interface SMSMessage {
  receiver: string;
  message: string;
  title?: string;
  testMode?: boolean;
}

interface SMSTemplate {
  id: string;
  name: string;
  content: string;
  variables: string[];
}

export class SMSService {
  private config: SMSConfig;
  private apiUrl = 'https://apis.aligo.in/send/';
  private templates: Map<string, SMSTemplate> = new Map();

  constructor() {
    this.config = {
      apiKey: process.env.ALIGO_API_KEY || '',
      userId: process.env.ALIGO_USER_ID || '',
      sender: process.env.ALIGO_SENDER || '',
      testMode: process.env.NODE_ENV !== 'production'
    };

    this.loadTemplates();
  }

  // SMS 템플릿 로드
  private async loadTemplates() {
    // 기본 템플릿 정의
    const defaultTemplates: SMSTemplate[] = [
      {
        id: 'reservation_created',
        name: '예약 접수 알림',
        content: '[진안군장터] {{customerName}}님의 예약이 접수되었습니다.\n상점: {{storeName}}\n일시: {{reservationTime}}\n예약번호: {{reservationId}}',
        variables: ['customerName', 'storeName', 'reservationTime', 'reservationId']
      },
      {
        id: 'reservation_confirmed',
        name: '예약 확정 알림',
        content: '[진안군장터] 예약이 확정되었습니다!\n상점: {{storeName}}\n일시: {{reservationTime}}\n주소: {{storeAddress}}\n\n예약번호: {{reservationId}}',
        variables: ['storeName', 'reservationTime', 'storeAddress', 'reservationId']
      },
      {
        id: 'reservation_cancelled',
        name: '예약 취소 알림',
        content: '[진안군장터] 예약이 취소되었습니다.\n상점: {{storeName}}\n사유: {{reason}}\n\n문의: {{storePhone}}',
        variables: ['storeName', 'reason', 'storePhone']
      },
      {
        id: 'reservation_reminder',
        name: '예약 리마인더',
        content: '[진안군장터] 예약 알림\n{{customerName}}님, 오늘 {{reservationTime}}에 {{storeName}} 예약이 있습니다.\n주소: {{storeAddress}}',
        variables: ['customerName', 'reservationTime', 'storeName', 'storeAddress']
      },
      {
        id: 'payment_completed',
        name: '결제 완료 알림',
        content: '[진안군장터] 결제가 완료되었습니다.\n금액: {{amount}}원\n상점: {{storeName}}\n\n예약번호: {{reservationId}}',
        variables: ['amount', 'storeName', 'reservationId']
      },
      {
        id: 'store_approved',
        name: '상점 승인 알림',
        content: '[진안군장터] 상점 등록이 승인되었습니다!\n상점명: {{storeName}}\n\n지금 바로 메뉴를 등록하고 영업을 시작하세요.',
        variables: ['storeName']
      },
      {
        id: 'store_rejected',
        name: '상점 승인 거부 알림',
        content: '[진안군장터] 상점 등록이 거부되었습니다.\n사유: {{reason}}\n\n수정 후 다시 신청해주세요.',
        variables: ['reason']
      }
    ];

    // 템플릿을 메모리에 로드
    for (const template of defaultTemplates) {
      this.templates.set(template.id, template);
    }

    // DB에서 커스텀 템플릿 로드
    try {
      const result = await pool.query('SELECT * FROM sms_templates WHERE is_active = true');
      for (const row of result.rows) {
        this.templates.set(row.template_id, {
          id: row.template_id,
          name: row.name,
          content: row.content,
          variables: row.variables
        });
      }
    } catch (error) {
      console.error('Failed to load SMS templates from DB:', error);
    }
  }

  // 템플릿 변수 치환
  private replaceTemplateVariables(template: string, variables: Record<string, any>): string {
    let result = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value || '');
    }
    
    return result;
  }

  // SMS 전송
  public async send(message: SMSMessage): Promise<boolean> {
    try {
      // 테스트 모드에서는 실제 전송하지 않음
      if (this.config.testMode || message.testMode) {
        console.log('[SMS Test Mode]', {
          receiver: message.receiver,
          message: message.message,
          title: message.title
        });
        await this.saveSMSLog({
          ...message,
          status: 'test',
          response: 'Test mode - not sent'
        });
        return true;
      }

      // 알리고 API 호출을 위한 FormData 생성
      const form = new FormData();
      form.append('key', this.config.apiKey);
      form.append('user_id', this.config.userId);
      form.append('sender', this.config.sender);
      form.append('receiver', message.receiver);
      form.append('msg', message.message);
      
      if (message.title) {
        form.append('title', message.title);
      }

      // API 호출
      const response = await axios.post(this.apiUrl, form, {
        headers: form.getHeaders(),
        timeout: 10000
      });

      // 응답 처리
      if (response.data.result_code === '1') {
        await this.saveSMSLog({
          ...message,
          status: 'success',
          response: JSON.stringify(response.data)
        });
        return true;
      } else {
        console.error('SMS send failed:', response.data);
        await this.saveSMSLog({
          ...message,
          status: 'failed',
          response: JSON.stringify(response.data)
        });
        return false;
      }
    } catch (error) {
      console.error('SMS send error:', error);
      await this.saveSMSLog({
        ...message,
        status: 'error',
        response: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  // 템플릿 기반 SMS 전송
  public async sendWithTemplate(
    templateId: string, 
    receiver: string, 
    variables: Record<string, any>
  ): Promise<boolean> {
    const template = this.templates.get(templateId);
    
    if (!template) {
      console.error(`SMS template not found: ${templateId}`);
      return false;
    }

    const message = this.replaceTemplateVariables(template.content, variables);
    
    return this.send({
      receiver,
      message,
      title: template.name
    });
  }

  // 대량 SMS 전송
  public async sendBulk(messages: SMSMessage[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    // 알리고는 한번에 1000건까지 전송 가능
    const chunks = this.chunkArray(messages, 1000);

    for (const chunk of chunks) {
      try {
        const receivers = chunk.map(m => m.receiver).join(',');
        const form = new FormData();
        form.append('key', this.config.apiKey);
        form.append('user_id', this.config.userId);
        form.append('sender', this.config.sender);
        form.append('receiver', receivers);
        form.append('msg', chunk[0].message); // 동일한 메시지로 가정

        const response = await axios.post(this.apiUrl, form, {
          headers: form.getHeaders()
        });

        if (response.data.result_code === '1') {
          success += chunk.length;
        } else {
          failed += chunk.length;
        }
      } catch (error) {
        console.error('Bulk SMS error:', error);
        failed += chunk.length;
      }
    }

    return { success, failed };
  }

  // SMS 전송 로그 저장
  private async saveSMSLog(data: any) {
    try {
      await pool.query(
        `INSERT INTO sms_logs (
          receiver, message, title, status, response, 
          template_id, sent_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          data.receiver,
          data.message,
          data.title || null,
          data.status,
          data.response,
          data.templateId || null
        ]
      );
    } catch (error) {
      console.error('Failed to save SMS log:', error);
    }
  }

  // 예약 관련 SMS 전송 메서드들
  public async sendReservationCreated(reservation: any) {
    // 상점주에게 알림
    await this.sendWithTemplate('reservation_created', reservation.store_phone, {
      customerName: reservation.customer_name,
      storeName: reservation.store_name,
      reservationTime: this.formatDateTime(reservation.reservation_time),
      reservationId: reservation.id
    });
  }

  public async sendReservationConfirmed(reservation: any) {
    // 고객에게 알림
    await this.sendWithTemplate('reservation_confirmed', reservation.customer_phone, {
      storeName: reservation.store_name,
      reservationTime: this.formatDateTime(reservation.reservation_time),
      storeAddress: reservation.store_address,
      reservationId: reservation.id
    });
  }

  public async sendReservationCancelled(reservation: any, reason: string) {
    // 취소 대상에게 알림
    const template = 'reservation_cancelled';
    const receiver = reservation.cancelled_by === 'store' 
      ? reservation.customer_phone 
      : reservation.store_phone;

    await this.sendWithTemplate(template, receiver, {
      storeName: reservation.store_name,
      reason: reason || '고객 요청',
      storePhone: reservation.store_phone
    });
  }

  public async sendReservationReminder(reservation: any) {
    // 예약 1시간 전 리마인더
    await this.sendWithTemplate('reservation_reminder', reservation.customer_phone, {
      customerName: reservation.customer_name,
      reservationTime: this.formatTime(reservation.reservation_time),
      storeName: reservation.store_name,
      storeAddress: reservation.store_address
    });
  }

  // 유틸리티 메서드
  private formatDateTime(date: Date | string): string {
    const d = new Date(date);
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${this.formatTime(d)}`;
  }

  private formatTime(date: Date | string): string {
    const d = new Date(date);
    const hours = d.getHours();
    const minutes = d.getMinutes();
    const period = hours >= 12 ? '오후' : '오전';
    const displayHours = hours > 12 ? hours - 12 : hours || 12;
    return `${period} ${displayHours}시 ${minutes > 0 ? minutes + '분' : ''}`;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // 전송 통계 조회
  public async getStats(startDate?: Date, endDate?: Date) {
    const query = `
      SELECT 
        status,
        COUNT(*) as count,
        DATE(sent_at) as date
      FROM sms_logs
      WHERE ($1::date IS NULL OR sent_at >= $1)
        AND ($2::date IS NULL OR sent_at <= $2)
      GROUP BY status, DATE(sent_at)
      ORDER BY date DESC
    `;

    const result = await pool.query(query, [startDate, endDate]);
    return result.rows;
  }
}

// 싱글톤 인스턴스
export const smsService = new SMSService();

// backend/src/services/sms-scheduler.service.ts
import { CronJob } from 'cron';
import { pool } from '../config/database';
import { smsService } from './sms.service';

export class SMSSchedulerService {
  private jobs: Map<string, CronJob> = new Map();

  constructor() {
    this.initializeJobs();
  }

  private initializeJobs() {
    // 예약 리마인더 (매 정각마다 실행)
    const reminderJob = new CronJob('0 * * * *', async () => {
      await this.sendReservationReminders();
    });

    // 일일 통계 리포트 (매일 오전 9시)
    const dailyReportJob = new CronJob('0 9 * * *', async () => {
      await this.sendDailyReport();
    });

    this.jobs.set('reminder', reminderJob);
    this.jobs.set('dailyReport', dailyReportJob);

    // 모든 작업 시작
    this.jobs.forEach(job => job.start());
  }

  // 1시간 후 예약에 대한 리마인더 전송
  private async sendReservationReminders() {
    try {
      const query = `
        SELECT 
          r.*,
          u.name as customer_name,
          u.phone as customer_phone,
          s.name as store_name,
          s.address as store_address
        FROM reservations r
        JOIN users u ON r.user_id = u.id
        JOIN stores s ON r.store_id = s.id
        WHERE r.status = 'confirmed'
          AND r.reservation_time BETWEEN NOW() + INTERVAL '55 minutes' 
          AND NOW() + INTERVAL '65 minutes'
          AND r.reminder_sent = false
      `;

      const result = await pool.query(query);

      for (const reservation of result.rows) {
        const sent = await smsService.sendReservationReminder(reservation);
        
        if (sent) {
          // 리마인더 전송 표시
          await pool.query(
            'UPDATE reservations SET reminder_sent = true WHERE id = $1',
            [reservation.id]
          );
        }
      }

      console.log(`Sent ${result.rows.length} reservation reminders`);
    } catch (error) {
      console.error('Failed to send reservation reminders:', error);
    }
  }

  // 일일 통계 리포트 (관리자에게)
  private async sendDailyReport() {
    try {
      const stats = await this.getDailyStats();
      const admins = await this.getAdminPhones();

      const message = `[진안군장터 일일리포트]
예약: ${stats.reservations}건
매출: ${stats.revenue.toLocaleString()}원
신규가입: ${stats.newUsers}명
활성상점: ${stats.activeStores}개`;

      for (const phone of admins) {
        await smsService.send({
          receiver: phone,
          message,
          title: '일일 운영 리포트'
        });
      }
    } catch (error) {
      console.error('Failed to send daily report:', error);
    }
  }

  private async getDailyStats() {
    // 통계 쿼리 구현
    return {
      reservations: 0,
      revenue: 0,
      newUsers: 0,
      activeStores: 0
    };
  }

  private async getAdminPhones(): Promise<string[]> {
    const result = await pool.query(
      "SELECT phone FROM users WHERE role = 'admin' AND sms_notifications = true"
    );
    return result.rows.map(row => row.phone);
  }

  // 스케줄러 정리
  public stop() {
    this.jobs.forEach(job => job.stop());
  }
}

// 싱글톤 인스턴스
export const smsScheduler = new SMSSchedulerService();