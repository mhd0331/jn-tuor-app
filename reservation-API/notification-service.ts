// services/notification.service.ts
import axios from 'axios';
import { logger } from '../utils/logger';

export interface NotificationOptions {
  to: string;
  method: 'sms' | 'lms' | 'mms' | 'kakao';
  message: string;
  templateId?: string;
  subject?: string;
  attachments?: string[];
}

export class NotificationService {
  private smsApiKey: string;
  private smsApiSecret: string;
  private smsSenderId: string;
  private kakaoApiKey: string;

  constructor() {
    this.smsApiKey = process.env.SMS_API_KEY!;
    this.smsApiSecret = process.env.SMS_API_SECRET!;
    this.smsSenderId = process.env.SMS_SENDER_ID!;
    this.kakaoApiKey = process.env.KAKAO_API_KEY!;
  }

  async send(options: NotificationOptions): Promise<boolean> {
    try {
      switch (options.method) {
        case 'sms':
        case 'lms':
        case 'mms':
          return await this.sendSMS(options);
        case 'kakao':
          return await this.sendKakaoTalk(options);
        default:
          throw new Error(`Unsupported notification method: ${options.method}`);
      }
    } catch (error) {
      logger.error('Notification send failed:', error);
      throw error;
    }
  }

  private async sendSMS(options: NotificationOptions): Promise<boolean> {
    // NHN Toast SMS API 사용 예시
    const url = 'https://api-sms.cloud.toast.com/sms/v3.0/appKeys/{appKey}/sender/sms';
    
    const payload = {
      body: options.message,
      sendNo: this.smsSenderId,
      recipientList: [
        {
          recipientNo: options.to.replace(/-/g, ''),
          templateParameter: {}
        }
      ],
      userId: 'system'
    };

    // LMS의 경우 제목 추가
    if (options.method === 'lms' && options.subject) {
      payload.title = options.subject;
    }

    // MMS의 경우 첨부파일 추가
    if (options.method === 'mms' && options.attachments) {
      payload.attachFileIdList = options.attachments;
    }

    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-Key': this.smsApiSecret
        }
      });

      if (response.data.header.isSuccessful) {
        logger.info(`SMS sent successfully to ${options.to}`);
        return true;
      } else {
        logger.error('SMS send failed:', response.data);
        return false;
      }
    } catch (error) {
      logger.error('SMS API error:', error);
      return false;
    }
  }

  private async sendKakaoTalk(options: NotificationOptions): Promise<boolean> {
    // 카카오 알림톡 API 사용
    const url = 'https://kapi.kakao.com/v1/api/talk/channels/@{channel_id}/messages';
    
    const payload = {
      template_id: options.templateId,
      receiver_uuids: [options.to], // 사용자의 카카오 UUID가 필요
      template_args: {
        message: options.message
      }
    };

    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `KakaoAK ${this.kakaoApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.successful_receiver_uuids.length > 0) {
        logger.info(`KakaoTalk sent successfully to ${options.to}`);
        return true;
      } else {
        logger.error('KakaoTalk send failed:', response.data);
        return false;
      }
    } catch (error) {
      logger.error('KakaoTalk API error:', error);
      return false;
    }
  }

  // 대량 발송
  async sendBulk(recipients: NotificationOptions[]): Promise<{
    success: number;
    failed: number;
    results: Array<{ to: string; success: boolean; error?: string }>;
  }> {
    const results = await Promise.allSettled(
      recipients.map(recipient => this.send(recipient))
    );

    const processedResults = results.map((result, index) => ({
      to: recipients[index].to,
      success: result.status === 'fulfilled' && result.value,
      error: result.status === 'rejected' ? result.reason.message : undefined
    }));

    const success = processedResults.filter(r => r.success).length;
    const failed = processedResults.filter(r => !r.success).length;

    return {
      success,
      failed,
      results: processedResults
    };
  }
}

// services/notification.templates.ts
export const NotificationTemplates = {
  // 예약 관련 템플릿
  new_reservation: {
    id: 'new_reservation_v1',
    title: '새 예약 알림',
    content: `[새 예약]
예약자: #{name}
날짜: #{date}
시간: #{time}
인원: #{people}명
연락처: #{phone}
요청사항: #{notes}

예약을 확인해주세요.`
  },

  reservation_received: {
    id: 'reservation_received_v1',
    title: '예약 접수 완료',
    content: `[예약 접수]
#{store_name}에 예약이 접수되었습니다.

날짜: #{date}
시간: #{time}
인원: #{people}명

가게 확인 후 확정 알림을 보내드립니다.`
  },

  reservation_confirmed: {
    id: 'reservation_confirmed_v1',
    title: '예약 확정',
    content: `[예약 확정]
#{store_name} 예약이 확정되었습니다.

날짜: #{date}
시간: #{time}
인원: #{people}명
주소: #{address}

예약 시간에 맞춰 방문해주세요.`
  },

  reservation_cancelled: {
    id: 'reservation_cancelled_v1',
    title: '예약 취소',
    content: `[예약 취소]
#{store_name} 예약이 취소되었습니다.

날짜: #{date}
시간: #{time}

취소 사유: #{reason}`
  },

  reservation_reminder: {
    id: 'reservation_reminder_v1',
    title: '예약 리마인더',
    content: `[예약 알림]
내일 #{store_name}에 예약이 있습니다.

시간: #{time}
인원: #{people}명
주소: #{address}

즐거운 시간 되세요!`
  },

  // 가게 주인용 템플릿
  daily_summary: {
    id: 'daily_summary_v1',
    title: '일일 예약 현황',
    content: `[일일 예약 현황]
오늘의 예약: #{today_count}건
내일의 예약: #{tomorrow_count}건

신규 예약: #{new_count}건
취소된 예약: #{cancelled_count}건

자세한 내용은 관리자 페이지에서 확인하세요.`
  }
};

// utils/notification.formatter.ts
export class NotificationFormatter {
  static formatTemplate(templateContent: string, data: Record<string, any>): string {
    let formatted = templateContent;
    
    // #{variable} 형태의 템플릿 변수를 실제 값으로 치환
    Object.entries(data).forEach(([key, value]) => {
      const regex = new RegExp(`#{${key}}`, 'g');
      formatted = formatted.replace(regex, String(value));
    });
    
    return formatted;
  }

  static formatPhoneNumber(phone: string): string {
    // 하이픈 제거
    const cleaned = phone.replace(/-/g, '');
    
    // 한국 전화번호 형식 검증
    if (!/^01[0-9]{8,9}$/.test(cleaned)) {
      throw new Error('Invalid phone number format');
    }
    
    return cleaned;
  }

  static formatDateTime(date: Date, time: string): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}년 ${month}월 ${day}일 ${time}`;
  }
}

// cron/notification.cron.ts
import { CronJob } from 'cron';
import { ReservationService } from '../services/reservation.service';
import { NotificationService } from '../services/notification.service';
import { logger } from '../utils/logger';

export function setupNotificationCrons(
  reservationService: ReservationService,
  notificationService: NotificationService
) {
  // 매일 오전 10시 예약 리마인더 발송
  new CronJob('0 10 * * *', async () => {
    logger.info('Starting reservation reminder job');
    try {
      await reservationService.sendReservationReminders();
      logger.info('Reservation reminder job completed');
    } catch (error) {
      logger.error('Reservation reminder job failed:', error);
    }
  }).start();

  // 매일 오후 8시 일일 요약 발송
  new CronJob('0 20 * * *', async () => {
    logger.info('Starting daily summary job');
    try {
      // 가게별 일일 요약 발송 로직
      // await sendDailySummaryToStoreOwners();
      logger.info('Daily summary job completed');
    } catch (error) {
      logger.error('Daily summary job failed:', error);
    }
  }).start();

  // 1시간마다 노쇼 체크
  new CronJob('0 * * * *', async () => {
    logger.info('Starting no-show check job');
    try {
      // 예약 시간 2시간 지난 미완료 예약을 노쇼 처리
      // await checkAndMarkNoShows();
      logger.info('No-show check job completed');
    } catch (error) {
      logger.error('No-show check job failed:', error);
    }
  }).start();
}