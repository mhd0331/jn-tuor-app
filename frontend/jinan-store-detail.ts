// app/stores/[id]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

interface Menu {
  id: string;
  name: string;
  price: number;
  description: string;
  imageUrl: string;
  isAvailable: boolean;
}

interface OperatingHour {
  day: string;
  open: string;
  close: string;
  isClosed: boolean;
}

interface Store {
  id: string;
  name: string;
  category: string;
  address: string;
  phone: string;
  description: string;
  imageUrls: string[];
  rating: number;
  reviewCount: number;
  operatingHours: OperatingHour[];
  menus: Menu[];
  specialties: string[];
}

// 진안 특산품 메뉴 데이터
const MOCK_STORE: Store = {
  id: "1",
  name: "진안고원시장 할매국밥",
  category: "restaurant",
  address: "전북 진안군 진안읍 중앙로 67",
  phone: "063-432-1234",
  description: "40년 전통의 진한 돼지국밥 전문점입니다. 진안 토종 흑돼지와 직접 담근 김치로 만든 정성 가득한 한 그릇을 제공합니다.",
  imageUrls: [
    "/api/placeholder/800/600",
    "/api/placeholder/800/600",
    "/api/placeholder/800/600"
  ],
  rating: 4.8,
  reviewCount: 127,
  operatingHours: [
    { day: "월", open: "06:00", close: "20:00", isClosed: false },
    { day: "화", open: "06:00", close: "20:00", isClosed: false },
    { day: "수", open: "06:00", close: "20:00", isClosed: false },
    { day: "목", open: "06:00", close: "20:00", isClosed: false },
    { day: "금", open: "06:00", close: "20:00", isClosed: false },
    { day: "토", open: "06:00", close: "18:00", isClosed: false },
    { day: "일", open: "00:00", close: "00:00", isClosed: true },
  ],
  specialties: ["진안 흑돼지", "직접 담근 김치", "24시간 우려낸 사골육수"],
  menus: [
    {
      id: "m1",
      name: "진안 흑돼지 국밥",
      price: 9000,
      description: "진안 토종 흑돼지로 만든 특제 국밥",
      imageUrl: "/api/placeholder/400/300",
      isAvailable: true
    },
    {
      id: "m2",
      name: "순대국밥",
      price: 9000,
      description: "직접 만든 순대가 들어간 국밥",
      imageUrl: "/api/placeholder/400/300",
      isAvailable: true
    },
    {
      id: "m3",
      name: "섞어국밥",
      price: 10000,
      description: "돼지고기와 순대가 함께 들어간 국밥",
      imageUrl: "/api/placeholder/400/300",
      isAvailable: true
    },
    {
      id: "m4",
      name: "수육 (소)",
      price: 25000,
      description: "삶은 돼지고기 수육",
      imageUrl: "/api/placeholder/400/300",
      isAvailable: true
    },
    {
      id: "m5",
      name: "모듬순대",
      price: 15000,
      description: "직접 만든 순대 모듬",
      imageUrl: "/api/placeholder/400/300",
      isAvailable: false
    }
  ]
};

export default function StoreDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [store, setStore] = useState<Store | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [activeTab, setActiveTab] = useState<"menu" | "info" | "review">("menu");

  useEffect(() => {
    // API 호출 시뮬레이션
    setTimeout(() => {
      setStore(MOCK_STORE);
    }, 500);
  }, [params.id]);

  const getCurrentOperatingStatus = () => {
    if (!store) return { isOpen: false, todayHours: "" };
    
    const today = new Date().getDay();
    const dayMap = ["일", "월", "화", "수", "목", "금", "토"];
    const todayHours = store.operatingHours.find(h => h.day === dayMap[today]);
    
    if (!todayHours || todayHours.isClosed) {
      return { isOpen: false, todayHours: "휴무" };
    }
    
    const now = new Date();
    const [openHour, openMin] = todayHours.open.split(":").map(Number);
    const [closeHour, closeMin] = todayHours.close.split(":").map(Number);
    
    const openTime = new Date();
    openTime.setHours(openHour, openMin, 0);
    const closeTime = new Date();
    closeTime.setHours(closeHour, closeMin, 0);
    
    const isOpen = now >= openTime && now <= closeTime;
    
    return { isOpen, todayHours: `${todayHours.open} - ${todayHours.close}` };
  };

  const handleReservation = () => {
    router.push(`/reservation/new?storeId=${store?.id}&storeName=${encodeURIComponent(store?.name || "")}`);
  };

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const { isOpen, todayHours } = getCurrentOperatingStatus();

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 헤더 */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => router.back()} className="p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <button className="p-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>
            <button
              onClick={() => setIsLiked(!isLiked)}
              className="p-2"
            >
              <svg
                className={`w-6 h-6 ${isLiked ? "fill-red-500 text-red-500" : "text-gray-600"}`}
                fill={isLiked ? "currentColor" : "none"}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* 이미지 갤러리 */}
      <div className="relative mt-14">
        <div className="relative h-64 bg-gray-200">
          <Image
            src={store.imageUrls[selectedImageIndex]}
            alt={store.name}
            fill
            className="object-cover"
          />
        </div>
        <div className="absolute bottom-4 right-4 bg-black bg-opacity-60 text-white px-2 py-1 rounded text-sm">
          {selectedImageIndex + 1} / {store.imageUrls.length}
        </div>
        {/* 이미지 인디케이터 */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-1">
          {store.imageUrls.map((_, index) => (
            <button
              key={index}
              onClick={() => setSelectedImageIndex(index)}
              className={`w-2 h-2 rounded-full ${
                index === selectedImageIndex ? "bg-white" : "bg-white bg-opacity-50"
              }`}
            />
          ))}
        </div>
      </div>

      {/* 상점 기본 정보 */}
      <div className="bg-white px-4 py-4 border-b">
        <div className="flex items-start justify-between mb-2">
          <h1 className="text-2xl font-bold text-gray-900">{store.name}</h1>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            isOpen ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}>
            {isOpen ? "영업중" : "영업종료"}
          </span>
        </div>
        <p className="text-gray-600 mb-3">{store.description}</p>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <svg className="w-5 h-5 text-yellow-400 fill-current" viewBox="0 0 20 20">
              <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
            </svg>
            <span className="font-semibold">{store.rating}</span>
            <span className="text-gray-500">({store.reviewCount})</span>
          </div>
          <span className="text-gray-500">오늘 {todayHours}</span>
        </div>
        
        {/* 특산품 태그 */}
        <div className="flex flex-wrap gap-2 mt-3">
          {store.specialties.map((specialty, index) => (
            <span
              key={index}
              className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
            >
              {specialty}
            </span>
          ))}
        </div>
      </div>

      {/* 탭 메뉴 */}
      <div className="bg-white border-b sticky top-14 z-40">
        <div className="flex">
          <button
            onClick={() => setActiveTab("menu")}
            className={`flex-1 py-3 text-center font-medium ${
              activeTab === "menu"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600"
            }`}
          >
            메뉴
          </button>
          <button
            onClick={() => setActiveTab("info")}
            className={`flex-1 py-3 text-center font-medium ${
              activeTab === "info"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600"
            }`}
          >
            정보
          </button>
          <button
            onClick={() => setActiveTab("review")}
            className={`flex-1 py-3 text-center font-medium ${
              activeTab === "review"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600"
            }`}
          >
            리뷰
          </button>
        </div>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="bg-white">
        {activeTab === "menu" && (
          <div className="px-4 py-4">
            <h2 className="text-lg font-semibold mb-4">메뉴</h2>
            <div className="space-y-4">
              {store.menus.map((menu) => (
                <div
                  key={menu.id}
                  className={`flex gap-4 ${!menu.isAvailable ? "opacity-60" : ""}`}
                >
                  <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-gray-200">
                    <Image
                      src={menu.imageUrl}
                      alt={menu.name}
                      fill
                      className="object-cover"
                    />
                    {!menu.isAvailable && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                        <span className="text-white text-sm">품절</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{menu.name}</h3>
                    <p className="text-sm text-gray-600 mb-1">{menu.description}</p>
                    <p className="font-semibold text-lg">{menu.price.toLocaleString()}원</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "info" && (
          <div className="px-4 py-4 space-y-6">
            <div>
              <h3 className="font-semibold mb-2">영업시간</h3>
              <div className="space-y-1">
                {store.operatingHours.map((hour) => (
                  <div key={hour.day} className="flex justify-between text-sm">
                    <span className="text-gray-600">{hour.day}요일</span>
                    <span className={hour.isClosed ? "text-red-600" : "text-gray-900"}>
                      {hour.isClosed ? "휴무" : `${hour.open} - ${hour.close}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">위치</h3>
              <p className="text-sm text-gray-600 mb-2">{store.address}</p>
              <div className="h-48 bg-gray-200 rounded-lg"></div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">전화번호</h3>
              <a
                href={`tel:${store.phone}`}
                className="inline-flex items-center gap-2 text-blue-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span>{store.phone}</span>
              </a>
            </div>
          </div>
        )}

        {activeTab === "review" && (
          <div className="px-4 py-4">
            <div className="text-center py-8 text-gray-500">
              <p>아직 리뷰가 없습니다.</p>
              <p className="text-sm mt-1">첫 번째 리뷰를 작성해주세요!</p>
            </div>
          </div>
        )}
      </div>

      {/* 하단 예약 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
        <button
          onClick={handleReservation}
          className="w-full py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
        >
          예약하기
        </button>
      </div>
    </div>
  );
}