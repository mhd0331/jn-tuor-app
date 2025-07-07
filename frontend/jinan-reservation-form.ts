// app/reservation/new/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface TimeSlot {
  time: string;
  available: boolean;
}

export default function ReservationFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeId = searchParams.get("storeId");
  const storeName = searchParams.get("storeName") || "상점";

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [numberOfPeople, setNumberOfPeople] = useState(2);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [requests, setRequests] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 시간대 옵션 (실제로는 상점 운영시간과 예약 현황에 따라 동적으로 생성)
  const timeSlots: TimeSlot[] = [
    { time: "11:00", available: true },
    { time: "11:30", available: true },
    { time: "12:00", available: false },
    { time: "12:30", available: false },
    { time: "13:00", available: true },
    { time: "13:30", available: true },
    { time: "14:00", available: true },
    { time: "17:00", available: true },
    { time: "17:30", available: true },
    { time: "18:00", available: true },
    { time: "18:30", available: false },
    { time: "19:00", available: true },
  ];

  // 오늘부터 30일간의 날짜 생성
  const generateDateOptions = () => {
    const dates = [];
    const today = new Date();
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const dayOfWeek = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
      
      dates.push({
        value: `${year}-${month}-${day}`,
        label: `${month}월 ${day}일 (${dayOfWeek})`,
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
      });
    }
    
    return dates;
  };

  const dateOptions = generateDateOptions();

  // 기본값 설정 (오늘 날짜)
  useEffect(() => {
    if (dateOptions.length > 0) {
      setSelectedDate(dateOptions[0].value);
    }

    // 로그인된 사용자 정보 가져오기 (있는 경우)
    const userName = localStorage.getItem("userName");
    if (userName) {
      setName(userName);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTime) {
      alert("예약 시간을 선택해주세요.");
      return;
    }

    if (!agreedToTerms) {
      alert("예약 안내사항에 동의해주세요.");
      return;
    }

    setIsSubmitting(true);

    // API 호출 시뮬레이션
    setTimeout(() => {
      // 예약 성공 후 확인 페이지로 이동
      router.push(`/reservation/complete?id=demo-reservation-id`);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="sticky top-0 z-50 bg-white shadow-sm">
        <div className="flex items-center px-4 py-3">
          <button onClick={() => router.back()} className="p-2 -ml-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="flex-1 text-lg font-semibold text-center mr-8">예약하기</h1>
        </div>
      </header>

      {/* 상점 정보 */}
      <div className="bg-white px-4 py-3 border-b">
        <h2 className="font-semibold text-gray-900">{storeName}</h2>
        <p className="text-sm text-gray-600">예약 정보를 입력해주세요</p>
      </div>

      {/* 예약 폼 */}
      <form onSubmit={handleSubmit} className="pb-20">
        {/* 날짜 선택 */}
        <div className="bg-white mb-2">
          <div className="px-4 py-3 border-b">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              예약 날짜
            </label>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {dateOptions.map((date) => (
                <option key={date.value} value={date.value}>
                  {date.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 시간 선택 */}
        <div className="bg-white mb-2">
          <div className="px-4 py-3 border-b">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              예약 시간
            </label>
            <div className="grid grid-cols-4 gap-2">
              {timeSlots.map((slot) => (
                <button
                  key={slot.time}
                  type="button"
                  disabled={!slot.available}
                  onClick={() => setSelectedTime(slot.time)}
                  className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedTime === slot.time
                      ? "bg-blue-600 text-white"
                      : slot.available
                      ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 인원수 선택 */}
        <div className="bg-white mb-2">
          <div className="px-4 py-3 border-b">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              인원수
            </label>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setNumberOfPeople(Math.max(1, numberOfPeople - 1))}
                className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <span className="text-xl font-semibold w-12 text-center">{numberOfPeople}</span>
              <button
                type="button"
                onClick={() => setNumberOfPeople(Math.min(20, numberOfPeople + 1))}
                className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* 예약자 정보 */}
        <div className="bg-white mb-2">
          <div className="px-4 py-3 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                예약자명 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="이름을 입력하세요"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                연락처 <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder="010-0000-0000"
                pattern="[0-9]{3}-[0-9]{4}-[0-9]{4}"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* 요청사항 */}
        <div className="bg-white mb-2">
          <div className="px-4 py-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              요청사항 (선택)
            </label>
            <textarea
              value={requests}
              onChange={(e) => setRequests(e.target.value)}
              placeholder="특별한 요청사항이 있으시면 입력해주세요"
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 예약 안내 */}
        <div className="bg-white mb-2">
          <div className="px-4 py-3">
            <h3 className="font-medium text-gray-900 mb-2">예약 안내사항</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• 예약 확정 후 SMS로 안내 메시지가 발송됩니다</li>
              <li>• 예약 변경/취소는 1시간 전까지 가능합니다</li>
              <li>• 노쇼(No-show) 시 다음 예약이 제한될 수 있습니다</li>
              <li>• 10분 이상 늦으실 경우 예약이 자동 취소될 수 있습니다</li>
            </ul>
            
            <label className="flex items-start gap-2 mt-4">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm text-gray-700">
                위 안내사항을 확인했으며, 예약 진행에 동의합니다
              </span>
            </label>
          </div>
        </div>

        {/* 예약 요약 */}
        <div className="bg-yellow-50 mx-4 mt-4 p-4 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">예약 정보 확인</h4>
          <div className="text-sm space-y-1">
            <p>
              <span className="text-gray-600">날짜:</span>{" "}
              <span className="font-medium">
                {dateOptions.find(d => d.value === selectedDate)?.label}
              </span>
            </p>
            <p>
              <span className="text-gray-600">시간:</span>{" "}
              <span className="font-medium">{selectedTime || "선택해주세요"}</span>
            </p>
            <p>
              <span className="text-gray-600">인원:</span>{" "}
              <span className="font-medium">{numberOfPeople}명</span>
            </p>
          </div>
        </div>
      </form>

      {/* 하단 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
        <button
          type="submit"
          onClick={handleSubmit}
          disabled={isSubmitting || !name || !phone || !selectedTime || !agreedToTerms}
          className="w-full py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              예약 처리 중...
            </span>
          ) : (
            "예약하기"
          )}
        </button>
      </div>
    </div>
  );
}

// app/reservation/complete/page.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function ReservationCompletePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reservationId = searchParams.get("id");

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        {/* 성공 아이콘 */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-10 h-10 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">예약이 완료되었습니다!</h1>
        <p className="text-gray-600 mb-6">
          예약 확정 시 SMS로 안내 메시지가 발송됩니다.
        </p>

        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
          <h3 className="font-semibold text-gray-900 mb-2">예약 정보</h3>
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-gray-600">예약번호:</span>{" "}
              <span className="font-medium">2024-0123-4567</span>
            </p>
            <p>
              <span className="text-gray-600">상점명:</span>{" "}
              <span className="font-medium">진안고원시장 할매국밥</span>
            </p>
            <p>
              <span className="text-gray-600">예약일시:</span>{" "}
              <span className="font-medium">2024년 1월 23일 (화) 18:00</span>
            </p>
            <p>
              <span className="text-gray-600">인원:</span>{" "}
              <span className="font-medium">2명</span>
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Link
            href="/my"
            className="block w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            예약 내역 보기
          </Link>
          <Link
            href="/"
            className="block w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}