// app/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useInView } from "react-intersection-observer";
import Link from "next/link";
import Image from "next/image";

interface Store {
  id: string;
  name: string;
  category: string;
  address: string;
  imageUrl: string;
  rating: number;
  distance: number;
  description: string;
}

const CATEGORIES = [
  { id: "all", name: "전체", icon: "🏪" },
  { id: "restaurant", name: "음식점", icon: "🍽️" },
  { id: "market", name: "재래시장", icon: "🛒" },
  { id: "farm", name: "농산물", icon: "🌾" },
  { id: "craft", name: "수공예품", icon: "🎨" },
  { id: "specialty", name: "특산품", icon: "🎁" },
];

// 진안군 실제 상점 데이터 (임시)
const MOCK_STORES: Store[] = [
  {
    id: "1",
    name: "진안고원시장 할매국밥",
    category: "restaurant",
    address: "전북 진안군 진안읍 중앙로 67",
    imageUrl: "/api/placeholder/400/300",
    rating: 4.8,
    distance: 0.5,
    description: "40년 전통의 진한 돼지국밥"
  },
  {
    id: "2",
    name: "마이산 토종흑돼지",
    category: "restaurant",
    address: "전북 진안군 진안읍 마이산로 120",
    imageUrl: "/api/placeholder/400/300",
    rating: 4.6,
    distance: 2.3,
    description: "진안 토종 흑돼지 전문점"
  },
  {
    id: "3",
    name: "진안고원 인삼가게",
    category: "specialty",
    address: "전북 진안군 진안읍 시장2길 15",
    imageUrl: "/api/placeholder/400/300",
    rating: 4.9,
    distance: 0.8,
    description: "6년근 진안 인삼 전문"
  },
  {
    id: "4",
    name: "용담호 민물고기 횟집",
    category: "restaurant",
    address: "전북 진안군 용담면 용담로 88",
    imageUrl: "/api/placeholder/400/300",
    rating: 4.5,
    distance: 15.2,
    description: "용담호 신선한 민물고기"
  },
  {
    id: "5",
    name: "진안 표고버섯 농장",
    category: "farm",
    address: "전북 진안군 백운면 백운로 200",
    imageUrl: "/api/placeholder/400/300",
    rating: 4.7,
    distance: 8.5,
    description: "무농약 참나무 표고버섯"
  },
  {
    id: "6",
    name: "전통 죽염 공방",
    category: "craft",
    address: "전북 진안군 마령면 마령로 150",
    imageUrl: "/api/placeholder/400/300",
    rating: 4.8,
    distance: 12.0,
    description: "9번 구운 전통 죽염"
  },
];

export default function HomePage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [filteredStores, setFilteredStores] = useState<Store[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState<"distance" | "rating">("distance");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const { ref, inView } = useInView();

  // 초기 데이터 로드
  useEffect(() => {
    loadStores();
  }, []);

  // 카테고리 필터링
  useEffect(() => {
    filterAndSortStores();
  }, [selectedCategory, sortBy, stores]);

  // 무한 스크롤
  useEffect(() => {
    if (inView && hasMore) {
      loadMoreStores();
    }
  }, [inView]);

  const loadStores = () => {
    // API 호출 시뮬레이션
    setTimeout(() => {
      setStores(MOCK_STORES);
      setFilteredStores(MOCK_STORES);
    }, 500);
  };

  const filterAndSortStores = () => {
    let filtered = [...stores];
    
    // 카테고리 필터
    if (selectedCategory !== "all") {
      filtered = filtered.filter(store => store.category === selectedCategory);
    }
    
    // 정렬
    filtered.sort((a, b) => {
      if (sortBy === "distance") {
        return a.distance - b.distance;
      } else {
        return b.rating - a.rating;
      }
    });
    
    setFilteredStores(filtered);
  };

  const loadMoreStores = () => {
    // 무한 스크롤 시뮬레이션
    setTimeout(() => {
      const newStores = MOCK_STORES.map(store => ({
        ...store,
        id: `${store.id}-${page}`,
        distance: store.distance + Math.random() * 5
      }));
      setStores(prev => [...prev, ...newStores]);
      setPage(prev => prev + 1);
      
      if (page > 3) {
        setHasMore(false);
      }
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="sticky top-0 z-50 bg-white shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl font-bold text-gray-900">진안장터</h1>
            <Link
              href="/auth"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              로그인
            </Link>
          </div>
          
          {/* 검색바 */}
          <div className="relative">
            <input
              type="text"
              placeholder="상점이나 상품을 검색하세요"
              className="w-full px-4 py-3 pl-10 text-gray-700 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg
              className="absolute left-3 top-3.5 w-5 h-5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>
        
        {/* 카테고리 필터 */}
        <div className="px-4 pb-3 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {CATEGORIES.map(category => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex items-center gap-1 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === category.id
                    ? "bg-blue-500 text-white"
                    : "bg-white text-gray-700 border border-gray-300"
                }`}
              >
                <span>{category.icon}</span>
                <span>{category.name}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* 정렬 옵션 */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b">
        <span className="text-sm text-gray-600">
          총 {filteredStores.length}개 상점
        </span>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "distance" | "rating")}
          className="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="distance">거리순</option>
          <option value="rating">평점순</option>
        </select>
      </div>

      {/* 상점 목록 */}
      <main className="px-4 py-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStores.map((store) => (
            <Link
              key={store.id}
              href={`/stores/${store.id}`}
              className="block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="relative h-48 bg-gray-200 rounded-t-lg overflow-hidden">
                <Image
                  src={store.imageUrl}
                  alt={store.name}
                  fill
                  className="object-cover"
                />
                <div className="absolute top-2 right-2 px-2 py-1 bg-black bg-opacity-70 text-white text-xs rounded">
                  {store.distance}km
                </div>
              </div>
              
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-1">{store.name}</h3>
                <p className="text-sm text-gray-600 mb-2">{store.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{store.address}</span>
                  <div className="flex items-center gap-1">
                    <svg
                      className="w-4 h-4 text-yellow-400 fill-current"
                      viewBox="0 0 20 20"
                    >
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                    </svg>
                    <span className="text-sm font-medium">{store.rating}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* 무한 스크롤 트리거 */}
        {hasMore && (
          <div ref={ref} className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        
        {!hasMore && filteredStores.length > 0 && (
          <p className="text-center py-8 text-gray-500">
            모든 상점을 불러왔습니다
          </p>
        )}
      </main>

      {/* 하단 네비게이션 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t">
        <div className="grid grid-cols-4 gap-1">
          <Link
            href="/"
            className="flex flex-col items-center py-3 text-blue-500"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs mt-1">홈</span>
          </Link>
          <Link
            href="/search"
            className="flex flex-col items-center py-3 text-gray-500"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-xs mt-1">검색</span>
          </Link>
          <Link
            href="/reservations"
            className="flex flex-col items-center py-3 text-gray-500"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-xs mt-1">예약</span>
          </Link>
          <Link
            href="/my"
            className="flex flex-col items-center py-3 text-gray-500"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-xs mt-1">마이</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}