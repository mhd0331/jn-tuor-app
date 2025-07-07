// frontend/src/hooks/useSSE.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from 'sonner';

interface SSEMessage {
  id?: string;
  event?: string;
  data: any;
}

interface UseSSEOptions {
  onMessage?: (message: SSEMessage) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
  reconnectInterval?: number;
  maxRetries?: number;
}

export const useSSE = (options: UseSSEOptions = {}) => {
  const {
    onMessage,
    onError,
    onOpen,
    reconnectInterval = 5000,
    maxRetries = 5
  } = options;

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retriesRef = useRef(0);
  
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<SSEMessage | null>(null);
  
  const { token } = useAuthStore();

  const connect = useCallback(() => {
    if (!token || eventSourceRef.current) return;

    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL}/api/sse/stream`;
      const eventSource = new EventSource(url, {
        withCredentials: true,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      } as any);

      eventSource.onopen = () => {
        console.log('SSE connected');
        setIsConnected(true);
        retriesRef.current = 0;
        onOpen?.();
      };

      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        setIsConnected(false);
        onError?.(error);
        
        eventSource.close();
        eventSourceRef.current = null;

        // 재연결 시도
        if (retriesRef.current < maxRetries) {
          retriesRef.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`Reconnecting SSE... (attempt ${retriesRef.current})`);
            connect();
          }, reconnectInterval * retriesRef.current);
        }
      };

      // 기본 메시지 핸들러
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const message: SSEMessage = { data };
          
          setLastMessage(message);
          onMessage?.(message);
        } catch (error) {
          console.error('Failed to parse SSE message:', error);
        }
      };

      // 커스텀 이벤트 핸들러들
      eventSource.addEventListener('connected', (event: any) => {
        const data = JSON.parse(event.data);
        console.log('Connected to SSE:', data);
      });

      eventSource.addEventListener('ping', (event: any) => {
        // 핑 응답 (연결 유지용)
        console.debug('SSE ping received');
      });

      // 예약 관련 이벤트
      eventSource.addEventListener('reservation:new', (event: any) => {
        const data = JSON.parse(event.data);
        toast.success('새로운 예약이 접수되었습니다!', {
          description: `${data.customerName}님 - ${data.reservationTime}`,
          duration: 5000,
          action: {
            label: '확인',
            onClick: () => window.location.href = `/reservations/${data.reservationId}`
          }
        });
      });

      eventSource.addEventListener('reservation:confirmed', (event: any) => {
        const data = JSON.parse(event.data);
        toast.success('예약이 확정되었습니다!', {
          description: `${data.storeName} - ${data.confirmationTime}`,
          duration: 5000
        });
      });

      eventSource.addEventListener('reservation:cancelled', (event: any) => {
        const data = JSON.parse(event.data);
        toast.error('예약이 취소되었습니다', {
          description: data.reason || '상점 사정으로 취소되었습니다.',
          duration: 5000
        });
      });

      // 시스템 공지
      eventSource.addEventListener('system:announcement', (event: any) => {
        const data = JSON.parse(event.data);
        toast.info(data.title, {
          description: data.message,
          duration: 10000
        });
      });

      eventSourceRef.current = eventSource;
    } catch (error) {
      console.error('Failed to create EventSource:', error);
      setIsConnected(false);
    }
  }, [token, onMessage, onError, onOpen, reconnectInterval, maxRetries]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [token, connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    reconnect: connect,
    disconnect
  };
};

// frontend/src/components/NotificationBell.tsx
import React, { useState, useEffect } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { useSSE } from '@/hooks/useSSE';
import { motion, AnimatePresence } from 'framer-motion';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

export const NotificationBell: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);

  const { isConnected } = useSSE({
    onMessage: (message) => {
      // 새 알림 추가
      const notification: Notification = {
        id: Date.now().toString(),
        type: message.event || 'default',
        title: message.data.title || '새 알림',
        message: message.data.message || '',
        timestamp: new Date(),
        read: false
      };

      setNotifications(prev => [notification, ...prev]);
      setHasNewNotifications(true);

      // 브라우저 알림 표시 (권한이 있는 경우)
      if (Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/icon-192x192.png',
          badge: '/icon-72x72.png',
          tag: notification.id
        });
      }
    }
  });

  // 브라우저 알림 권한 요청
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    );
    setHasNewNotifications(false);
  };

  const clearAll = () => {
    setNotifications([]);
    setHasNewNotifications(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        {isConnected ? (
          <Bell className="w-6 h-6 text-gray-700" />
        ) : (
          <BellOff className="w-6 h-6 text-gray-400" />
        )}
        
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}

        {hasNewNotifications && (
          <motion.span
            className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"
            animate={{ scale: [1, 1.5, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
          />
        )}
      </button>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50"
          >
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">알림</h3>
                <div className="flex gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      모두 읽음
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={clearAll}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      전체 삭제
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  새로운 알림이 없습니다
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => markAsRead(notification.id)}
                    className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                      !notification.read ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">
                          {notification.title}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                          {formatRelativeTime(notification.timestamp)}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {!isConnected && (
              <div className="p-3 bg-yellow-50 border-t border-yellow-100">
                <p className="text-sm text-yellow-800">
                  실시간 알림 연결이 끊어졌습니다. 새로고침해주세요.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// 시간 포맷팅 헬퍼
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;
  
  return date.toLocaleDateString();
}

// frontend/src/providers/NotificationProvider.tsx
import React, { useEffect } from 'react';
import { Toaster } from 'sonner';
import { useSSE } from '@/hooks/useSSE';

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  // SSE 연결 초기화
  useSSE();

  return (
    <>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'white',
            color: '#1f2937',
            border: '1px solid #e5e7eb',
          },
          className: 'toast',
        }}
        richColors
        expand={false}
        closeButton
      />
    </>
  );
};

// frontend/src/app/layout.tsx 에 추가
import { NotificationProvider } from '@/providers/NotificationProvider';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <NotificationProvider>
          {children}
        </NotificationProvider>
      </body>
    </html>
  );
}