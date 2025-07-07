import React, { useState, useEffect } from 'react';
import { Bell, Check, X, Calendar, Tag, Settings, ChevronRight, Circle, CheckCircle } from 'lucide-react';

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [notificationSettings, setNotificationSettings] = useState({
    reservation: true,
    promotion: true,
    push: true,
    sms: true,
    email: false
  });
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);

  // 더미 데이터 - 실제로는 API에서 가져옴
  useEffect(() => {
    const dummyNotifications = [
      {
        id: 1,
        type: 'reservation',
        title: '예약이 확정되었습니다',
        message: '진안명품한우 - 12월 25일 오후 6시 예약이 확정되었습니다.',
        timestamp: new Date(Date.now() - 1000 * 60 * 30),
        read: false,
        icon: 'check',
        actionUrl: '/reservations/123'
      },
      {
        id: 2,
        type: 'reservation',
        title: '예약이 취소되었습니다',
        message: '고갯길식당 - 12월 24일 예약이 상점 사정으로 취소되었습니다.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
        read: false,
        icon: 'x',
        actionUrl: '/reservations/122'
      },
      {
        id: 3,
        type: 'promotion',
        title: '🎄 크리스마스 특별 할인!',
        message: '진안장터 전 상점 10% 할인 이벤트가 진행중입니다.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
        read: true,
        icon: 'tag',
        actionUrl: '/promotions/christmas'
      },
      {
        id: 4,
        type: 'reservation',
        title: '예약 리마인더',
        message: '내일 진안명품한우 예약이 있습니다. 잊지 마세요!',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
        read: true,
        icon: 'calendar',
        actionUrl: '/reservations/121'
      },
      {
        id: 5,
        type: 'promotion',
        title: '새로운 상점이 입점했어요!',
        message: '진안 수제 베이커리가 새롭게 오픈했습니다.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
        read: true,
        icon: 'tag',
        actionUrl: '/stores/new-bakery'
      }
    ];

    setTimeout(() => {
      setNotifications(dummyNotifications);
      setLoading(false);
    }, 500);
  }, []);

  const filteredNotifications = notifications.filter(notif => {
    if (activeTab === 'all') return true;
    if (activeTab === 'unread') return !notif.read;
    return notif.type === activeTab;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, read: true }))
    );
  };

  const deleteNotification = (id) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  };

  const updateSettings = (key) => {
    setNotificationSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const formatTime = (date) => {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;
    return date.toLocaleDateString();
  };

  const getIcon = (type) => {
    switch (type) {
      case 'check':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'x':
        return <X className="w-5 h-5 text-red-500" />;
      case 'calendar':
        return <Calendar className="w-5 h-5 text-blue-500" />;
      case 'tag':
        return <Tag className="w-5 h-5 text-purple-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  if (showSettings) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* 설정 헤더 */}
        <div className="bg-white border-b sticky top-0 z-10">
          <div className="flex items-center justify-between p-4">
            <button
              onClick={() => setShowSettings(false)}
              className="text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-semibold">알림 설정</h1>
            <div className="w-6 h-6" />
          </div>
        </div>

        {/* 설정 내용 */}
        <div className="p-4 space-y-6">
          {/* 알림 유형 설정 */}
          <div className="bg-white rounded-lg p-4 space-y-4">
            <h2 className="font-semibold text-gray-900">알림 유형</h2>
            
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium">예약 알림</p>
                <p className="text-sm text-gray-500">예약 확정, 취소, 리마인더</p>
              </div>
              <button
                onClick={() => updateSettings('reservation')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notificationSettings.reservation ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notificationSettings.reservation ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium">프로모션 알림</p>
                <p className="text-sm text-gray-500">할인, 이벤트, 새 상점 소식</p>
              </div>
              <button
                onClick={() => updateSettings('promotion')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notificationSettings.promotion ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notificationSettings.promotion ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 알림 방법 설정 */}
          <div className="bg-white rounded-lg p-4 space-y-4">
            <h2 className="font-semibold text-gray-900">알림 방법</h2>
            
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium">푸시 알림</p>
                <p className="text-sm text-gray-500">앱 알림</p>
              </div>
              <button
                onClick={() => updateSettings('push')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notificationSettings.push ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notificationSettings.push ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium">SMS</p>
                <p className="text-sm text-gray-500">중요 알림만</p>
              </div>
              <button
                onClick={() => updateSettings('sms')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notificationSettings.sms ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notificationSettings.sms ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium">이메일</p>
                <p className="text-sm text-gray-500">프로모션 및 소식</p>
              </div>
              <button
                onClick={() => updateSettings('email')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notificationSettings.email ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notificationSettings.email ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 알림 시간 설정 */}
          <div className="bg-white rounded-lg p-4">
            <h2 className="font-semibold text-gray-900 mb-4">방해 금지 시간</h2>
            <p className="text-sm text-gray-500 mb-4">설정한 시간에는 알림을 받지 않습니다</p>
            <button className="w-full py-3 px-4 border border-gray-300 rounded-lg text-left flex items-center justify-between">
              <span>오후 10:00 - 오전 8:00</span>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-xl font-bold">알림</h1>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-blue-600"
              >
                모두 읽음
              </button>
            )}
            <button
              onClick={() => setShowSettings(true)}
              className="p-2"
            >
              <Settings className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* 탭 */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'all'
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent'
            }`}
          >
            전체
          </button>
          <button
            onClick={() => setActiveTab('unread')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors relative ${
              activeTab === 'unread'
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent'
            }`}
          >
            읽지 않음
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('reservation')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'reservation'
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent'
            }`}
          >
            예약
          </button>
          <button
            onClick={() => setActiveTab('promotion')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'promotion'
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent'
            }`}
          >
            프로모션
          </button>
        </div>
      </div>

      {/* 알림 목록 */}
      <div className="pb-20">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Bell className="w-12 h-12 mb-4" />
            <p>알림이 없습니다</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-white p-4 ${!notification.read ? 'bg-blue-50' : ''}`}
              >
                <div className="flex gap-3">
                  <div className="flex-shrink-0 mt-1">
                    {getIcon(notification.icon)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h3 className={`font-medium ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                          {notification.title}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                          {formatTime(notification.timestamp)}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        className="text-gray-400 hover:text-gray-600 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      {!notification.read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          읽음으로 표시
                        </button>
                      )}
                      {notification.actionUrl && (
                        <button className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                          자세히 보기
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;