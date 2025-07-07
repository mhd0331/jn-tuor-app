import React, { useState, useEffect } from 'react';
import { 
  Calendar, Clock, Menu, TrendingUp, Users, DollarSign, 
  Settings, ChevronRight, Check, X, AlertCircle, Plus,
  Edit, Trash2, Eye, EyeOff, BarChart3, Package
} from 'lucide-react';

const OwnerDashboard = () => {
  const [activeTab, setActiveTab] = useState('reservations');
  const [reservations, setReservations] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [businessHours, setBusinessHours] = useState({
    mon: { open: '09:00', close: '21:00', isOpen: true },
    tue: { open: '09:00', close: '21:00', isOpen: true },
    wed: { open: '09:00', close: '21:00', isOpen: true },
    thu: { open: '09:00', close: '21:00', isOpen: true },
    fri: { open: '09:00', close: '21:00', isOpen: true },
    sat: { open: '10:00', close: '22:00', isOpen: true },
    sun: { open: '10:00', close: '20:00', isOpen: true }
  });
  const [stats, setStats] = useState({
    todayRevenue: 0,
    monthRevenue: 0,
    todayReservations: 0,
    monthReservations: 0
  });
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [editingMenu, setEditingMenu] = useState(null);

  // 더미 데이터 로드
  useEffect(() => {
    // 예약 데이터
    setReservations([
      {
        id: 1,
        customerName: '김진안',
        customerPhone: '010-1234-5678',
        date: '2024-12-25',
        time: '18:00',
        people: 4,
        menu: '한우 특선 세트',
        totalPrice: 120000,
        status: 'pending',
        note: '창가 자리 요청'
      },
      {
        id: 2,
        customerName: '박전북',
        customerPhone: '010-2345-6789',
        date: '2024-12-25',
        time: '19:00',
        people: 2,
        menu: '한우 불고기',
        totalPrice: 60000,
        status: 'confirmed',
        note: ''
      },
      {
        id: 3,
        customerName: '이전주',
        customerPhone: '010-3456-7890',
        date: '2024-12-26',
        time: '12:00',
        people: 6,
        menu: '점심 특선',
        totalPrice: 90000,
        status: 'pending',
        note: '어린이 2명 포함'
      }
    ]);

    // 메뉴 데이터
    setMenuItems([
      {
        id: 1,
        name: '한우 특선 세트',
        price: 30000,
        description: '1++ 한우 150g, 된장찌개, 밑반찬',
        category: '세트메뉴',
        available: true,
        image: '/api/placeholder/100/100'
      },
      {
        id: 2,
        name: '한우 불고기',
        price: 25000,
        description: '특제 양념 한우 불고기',
        category: '단품메뉴',
        available: true,
        image: '/api/placeholder/100/100'
      },
      {
        id: 3,
        name: '점심 특선',
        price: 15000,
        description: '평일 점심 한정',
        category: '점심메뉴',
        available: false,
        image: '/api/placeholder/100/100'
      }
    ]);

    // 통계 데이터
    setStats({
      todayRevenue: 380000,
      monthRevenue: 12500000,
      todayReservations: 8,
      monthReservations: 245
    });
  }, []);

  const handleReservation = (id, action) => {
    setReservations(prev => 
      prev.map(res => 
        res.id === id 
          ? { ...res, status: action === 'confirm' ? 'confirmed' : 'rejected' }
          : res
      )
    );
  };

  const toggleMenuAvailability = (id) => {
    setMenuItems(prev => 
      prev.map(item => 
        item.id === id 
          ? { ...item, available: !item.available }
          : item
      )
    );
  };

  const updateBusinessHours = (day, field, value) => {
    setBusinessHours(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }
    }));
  };

  const formatPrice = (price) => {
    return price.toLocaleString('ko-KR') + '원';
  };

  const getDayName = (day) => {
    const days = {
      mon: '월요일',
      tue: '화요일',
      wed: '수요일',
      thu: '목요일',
      fri: '금요일',
      sat: '토요일',
      sun: '일요일'
    };
    return days[day];
  };

  // 예약 관리 탭
  const ReservationsTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">오늘의 예약</h2>
        <span className="text-sm text-gray-500">
          {new Date().toLocaleDateString('ko-KR')}
        </span>
      </div>

      {reservations.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>오늘 예약이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reservations.map((reservation) => (
            <div key={reservation.id} className="bg-white rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">{reservation.customerName}</span>
                    <span className="text-sm text-gray-500">
                      {reservation.customerPhone}
                    </span>
                    {reservation.status === 'pending' && (
                      <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                        대기중
                      </span>
                    )}
                    {reservation.status === 'confirmed' && (
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                        확정
                      </span>
                    )}
                    {reservation.status === 'rejected' && (
                      <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">
                        거절
                      </span>
                    )}
                  </div>
                  
                  <div className="text-sm text-gray-600 space-y-1">
                    <div className="flex items-center gap-4">
                      <span>📅 {reservation.date} {reservation.time}</span>
                      <span>👥 {reservation.people}명</span>
                    </div>
                    <div>📋 {reservation.menu}</div>
                    <div className="font-medium text-gray-900">
                      💰 {formatPrice(reservation.totalPrice)}
                    </div>
                    {reservation.note && (
                      <div className="text-gray-500 italic">
                        💬 {reservation.note}
                      </div>
                    )}
                  </div>
                </div>

                {reservation.status === 'pending' && (
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleReservation(reservation.id, 'confirm')}
                      className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleReservation(reservation.id, 'reject')}
                      className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // 메뉴 관리 탭
  const MenuTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">메뉴 관리</h2>
        <button
          onClick={() => {
            setEditingMenu(null);
            setShowMenuModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          메뉴 추가
        </button>
      </div>

      <div className="space-y-3">
        {menuItems.map((item) => (
          <div key={item.id} className="bg-white rounded-lg border p-4">
            <div className="flex items-start gap-4">
              <img
                src={item.image}
                alt={item.name}
                className="w-20 h-20 rounded-lg object-cover"
              />
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium">{item.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="font-medium">{formatPrice(item.price)}</span>
                      <span className="text-sm text-gray-500">{item.category}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleMenuAvailability(item.id)}
                      className={`p-2 rounded-lg ${
                        item.available 
                          ? 'bg-green-100 text-green-600' 
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {item.available ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => {
                        setEditingMenu(item);
                        setShowMenuModal(true);
                      }}
                      className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button className="p-2 bg-gray-100 text-red-600 rounded-lg hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // 영업시간 탭
  const HoursTab = () => (
    <div className="space-y-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-2">영업시간 설정</h2>
        <p className="text-sm text-gray-600">
          요일별 영업시간을 설정하세요. 휴무일은 토글을 꺼주세요.
        </p>
      </div>

      <div className="space-y-3">
        {Object.entries(businessHours).map(([day, hours]) => (
          <div key={day} className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => updateBusinessHours(day, 'isOpen', !hours.isOpen)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    hours.isOpen ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      hours.isOpen ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className={`font-medium ${!hours.isOpen && 'text-gray-400'}`}>
                  {getDayName(day)}
                </span>
              </div>

              {hours.isOpen ? (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={hours.open}
                    onChange={(e) => updateBusinessHours(day, 'open', e.target.value)}
                    className="px-3 py-1 border rounded-lg text-sm"
                  />
                  <span className="text-gray-500">~</span>
                  <input
                    type="time"
                    value={hours.close}
                    onChange={(e) => updateBusinessHours(day, 'close', e.target.value)}
                    className="px-3 py-1 border rounded-lg text-sm"
                  />
                </div>
              ) : (
                <span className="text-sm text-gray-400">휴무</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <button className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          영업시간 저장
        </button>
      </div>
    </div>
  );

  // 매출 통계 탭
  const StatsTab = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-4">매출 통계</h2>
        
        {/* 요약 카드 */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">오늘 매출</span>
              <DollarSign className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-xl font-bold text-gray-900">
              {formatPrice(stats.todayRevenue)}
            </p>
            <p className="text-xs text-green-600 mt-1">
              전일 대비 +12%
            </p>
          </div>

          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">이번 달 매출</span>
              <TrendingUp className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-xl font-bold text-gray-900">
              {formatPrice(stats.monthRevenue)}
            </p>
            <p className="text-xs text-green-600 mt-1">
              전월 대비 +8%
            </p>
          </div>

          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">오늘 예약</span>
              <Users className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-xl font-bold text-gray-900">
              {stats.todayReservations}건
            </p>
            <p className="text-xs text-gray-500 mt-1">
              평균 {Math.floor(stats.todayRevenue / stats.todayReservations / 1000)}천원
            </p>
          </div>

          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">이번 달 예약</span>
              <Calendar className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-xl font-bold text-gray-900">
              {stats.monthReservations}건
            </p>
            <p className="text-xs text-gray-500 mt-1">
              일 평균 {Math.floor(stats.monthReservations / 30)}건
            </p>
          </div>
        </div>

        {/* 차트 영역 (플레이스홀더) */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="font-medium mb-4">일별 매출 추이</h3>
          <div className="h-48 flex items-center justify-center text-gray-400">
            <BarChart3 className="w-12 h-12" />
            <span className="ml-2">차트 영역</span>
          </div>
        </div>

        {/* 인기 메뉴 */}
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-medium mb-3">인기 메뉴 TOP 5</h3>
          <div className="space-y-2">
            {[
              { name: '한우 특선 세트', count: 42, revenue: 1260000 },
              { name: '한우 불고기', count: 38, revenue: 950000 },
              { name: '점심 특선', count: 35, revenue: 525000 },
              { name: '한우 육회', count: 28, revenue: 840000 },
              { name: '갈비탕', count: 25, revenue: 375000 }
            ].map((item, index) => (
              <div key={index} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-500">
                    {index + 1}
                  </span>
                  <span className="text-sm">{item.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{formatPrice(item.revenue)}</p>
                  <p className="text-xs text-gray-500">{item.count}개</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold">진안명품한우</h1>
            <button className="p-2">
              <Settings className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* 탭 메뉴 */}
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('reservations')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'reservations'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600'
              }`}
            >
              예약관리
            </button>
            <button
              onClick={() => setActiveTab('menu')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'menu'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600'
              }`}
            >
              메뉴
            </button>
            <button
              onClick={() => setActiveTab('hours')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'hours'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600'
              }`}
            >
              영업시간
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'stats'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600'
              }`}
            >
              매출
            </button>
          </div>
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="p-4 pb-20">
        {activeTab === 'reservations' && <ReservationsTab />}
        {activeTab === 'menu' && <MenuTab />}
        {activeTab === 'hours' && <HoursTab />}
        {activeTab === 'stats' && <StatsTab />}
      </div>

      {/* 메뉴 추가/수정 모달 */}
      {showMenuModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">
              {editingMenu ? '메뉴 수정' : '메뉴 추가'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  메뉴명
                </label>
                <input
                  type="text"
                  defaultValue={editingMenu?.name}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="예: 한우 특선 세트"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  가격
                </label>
                <input
                  type="number"
                  defaultValue={editingMenu?.price}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="30000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  설명
                </label>
                <textarea
                  defaultValue={editingMenu?.description}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                  placeholder="메뉴에 대한 설명을 입력하세요"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  카테고리
                </label>
                <select
                  defaultValue={editingMenu?.category}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option>세트메뉴</option>
                  <option>단품메뉴</option>
                  <option>점심메뉴</option>
                  <option>사이드메뉴</option>
                  <option>음료</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  메뉴 이미지
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Package className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">
                    클릭하여 이미지 업로드
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowMenuModal(false)}
                className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                {editingMenu ? '수정' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerDashboard;