// app/my/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

interface Reservation {
  id: string;
  storeName: string;
  storeImage: string;
  date: string;
  time: string;
  numberOfPeople: number;
  status: "confirmed" | "pending" | "completed" | "cancelled";
  createdAt: string;
}

interface FavoriteStore {
  id: string;
  name: string;
  imageUrl: string;
  category: string;
  rating: number;
}

export default function MyPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [activeTab, setActiveTab] = useState<"reservations" | "favorites">("reservations");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [favoriteStores, setFavoriteStores] = useState<FavoriteStore[]>([]);

  // 예약 내역 더미 데이터
  const mockReservations: Reservation[] = [
    {
      id: "1",
      storeName: "진안고원시장 할매국밥",
      storeImage: "/api/placeholder/100/100",
      date: "2024-01-23",
      time: "18:00",
      numberOfPeople: 2,
      status: "confirmed",
      createdAt: "2024-01-20",
    },
    {
      id: "2",
      storeName: "마이산 토종흑돼지",
      storeImage: "/api/placeholder/100/100",
      date: "2024-01-15",
      time: "19:00",
      numberOfPeople: 4,
      status: "completed",
      createdAt: "2024-01-12",
    },
    {
      id: "3",
      storeName: "용담호 민물고기 횟집",
      storeImage: "/api/placeholder/100/100",
      date: "2024-01-10",
      time: "12:30",
      numberOfPeople: 3,
      status: "cancelled",
      createdAt: "2024-01-08",
    },
  ];

  // 찜한 상점 더미 데이터
  const mockFavorites: FavoriteStore[] = [
    {
      id: "1",
      name: "진안고원시장 할매국밥",
      imageUrl: "/api/placeholder/200/150",
      category: "음식점",
      rating: 4.8,
    },
    {
      id: "3",
      name: "진안고원 인삼가게",
      imageUrl: "/api/placeholder/200/150",
      category: "특산품",
      rating: 4.9,
    },
    {
      id: "5",
      name: "진안 표고버섯 농장",
      imageUrl: "/api/placeholder/200/150",
      category: "농산물",
      rating: 4.7,
    },
  ];

  useEffect(() => {
    // 로그인 체크
    const authToken = localStorage.getItem("authToken");
    if (!authToken) {
      router.push("/auth");
      return;
    }

    // 사용자 정보 불러오기
    const savedUserName = localStorage.getItem("userName") || "진안 주민";
    setUserName(savedUserName);
    setUserPhone("010-****-5678"); // 마스킹 처리된 전화번호

    // 데이터 로드
    setReservations(mockReservations);
    setFavoriteStores(mockFavorites);
  }, [router]);

  const handleLogout = () => {
    if (confirm("로그아웃 하시겠습니까?")) {
      localStorage.removeItem("authToken");
      localStorage.removeItem("userName");
      router.push("/");
    }
  };

  const getStatusBadge = (status: Reservation["status"]) => {
    const statusConfig = {
      confirmed: { text: "예약확정", className: "bg-green-100 text-green-800" },
      pending: { text: "대기중", className: "bg-yellow-100 text-yellow-800" },
      completed: { text: "이용완료", className: "bg-gray-100 text-gray-800" },
      cancelled: { text: "취소됨", className: "bg-red-100 text-red-800" },
    };

    const config = statusConfig[status];
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
        {config.text}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
    return `${month}월 ${day}일 (${dayOfWeek})`;
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 헤더 */}
      <header className="bg-white shadow-sm">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold text-gray-900">마이페이지</h1>
        </div>
      </header>

      {/* 프로필 섹션 */}
      <div className="bg-white px-4 py-6 mb-2">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">{userName}</h2>
            <p className="text-sm text-gray-600">{userPhone}</p>
          </div>
          <button
            onClick={() => router.push("/my/edit")}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            프로필 수정
          </button>
        </div>
      </div>

      {/* 메뉴 섹션 */}
      <div className="bg-white mb-2">
        <div className="grid grid-cols-4 gap-2 px-4 py-4">
          <button className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-gray-50">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <svg
                className="w-6 h-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <span className="text-xs text-gray-700">예약내역</span>
          </button>
          
          <button className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-gray-50">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            </div>
            <span className="text-xs text-gray-700">찜목록</span>
          </button>
          
          <button className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-gray-50">
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <svg
                className="w-6 h-6 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
            </div>
            <span className="text-xs text-gray-700">리뷰관리</span>
          </button>
          
          <button className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-gray-50">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <span className="text-xs text-gray-700">포인트</span>
          </button>
        </div>
      </div>

      {/* 탭 메뉴 */}
      <div className="bg-white sticky top-0 z-40 border-b">
        <div className="flex">
          <button
            onClick={() => setActiveTab("reservations")}
            className={`flex-1 py-3 text-center font-medium ${
              activeTab === "reservations"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600"
            }`}
          >
            예약 내역
          </button>
          <button
            onClick={() => setActiveTab("favorites")}
            className={`flex-1 py-3 text-center font-medium ${
              activeTab === "favorites"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600"
            }`}
          >
            찜한 상점
          </button>
        </div>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="bg-white">
        {activeTab === "reservations" && (
          <div className="px-4 py-4">
            {reservations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>예약 내역이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reservations.map((reservation) => (
                  <Link
                    key={reservation.id}
                    href={`/reservation/${reservation.id}`}
                    className="block bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex gap-3">
                      <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden">
                        <Image
                          src={reservation.storeImage}
                          alt={reservation.storeName}
                          width={64}
                          height={64}
                          className="object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-1">
                          <h3 className="font-medium text-gray-900">
                            {reservation.storeName}
                          </h3>
                          {getStatusBadge(reservation.status)}
                        </div>
                        <p className="text-sm text-gray-600">
                          {formatDate(reservation.date)} {reservation.time}
                        </p>
                        <p className="text-sm text-gray-600">
                          {reservation.numberOfPeople}명
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "favorites" && (
          <div className="px-4 py-4">
            {favoriteStores.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>찜한 상점이 없습니다.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {favoriteStores.map((store) => (
                  <Link
                    key={store.id}
                    href={`/stores/${store.id}`}
                    className="block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="relative h-32 bg-gray-200 rounded-t-lg overflow-hidden">
                      <Image
                        src={store.imageUrl}
                        alt={store.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="p-3">
                      <h3 className="font-medium text-gray-900 text-sm mb-1">
                        {store.name}
                      </h3>
                      <p className="text-xs text-gray-600 mb-1">{store.category}</p>
                      <div className="flex items-center gap-1">
                        <svg
                          className="w-3 h-3 text-yellow-400 fill-current"
                          viewBox="0 0 20 20"
                        >
                          <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                        </svg>
                        <span className="text-xs font-medium">{store.rating}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 기타 메뉴 */}
      <div className="bg-white mt-2">
        <button className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50">
          <span className="text-gray-700">공지사항</span>
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
        <button className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 border-t">
          <span className="text-gray-700">고객센터</span>
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
        <button className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 border-t">
          <span className="text-gray-700">설정</span>
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      {/* 로그아웃 버튼 */}
      <div className="px-4 mt-6 mb-4">
        <button
          onClick={handleLogout}
          className="w-full py-3 text-gray-600 font-medium hover:text-gray-800"
        >
          로그아웃
        </button>
      </div>

      {/* 하단 네비게이션 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t">
        <div className="grid grid-cols-4 gap-1">
          <Link
            href="/"
            className="flex flex-col items-center py-3 text-gray-500"
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
            className="flex flex-col items-center py-3 text-blue-500"
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