// app/auth/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleKakaoLogin = async () => {
    setIsLoading(true);
    
    // 실제 구현 시 카카오 OAuth URL로 리다이렉트
    // window.location.href = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code`;
    
    // 데모용: 로그인 시뮬레이션
    setTimeout(() => {
      localStorage.setItem("authToken", "demo-jwt-token");
      localStorage.setItem("userName", "진안 주민");
      router.push("/");
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col">
      {/* 헤더 */}
      <header className="p-4">
        <Link href="/" className="inline-flex items-center text-gray-600">
          <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>뒤로가기</span>
        </Link>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        {/* 로고 섹션 */}
        <div className="text-center mb-10">
          <div className="w-32 h-32 mx-auto mb-6 bg-blue-100 rounded-full flex items-center justify-center">
            <Image
              src="/api/placeholder/128/128"
              alt="진안장터 로고"
              width={128}
              height={128}
              className="rounded-full"
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">진안장터</h1>
          <p className="text-gray-600">진안군 통합 장터 플랫폼</p>
        </div>

        {/* 로그인 버튼 섹션 */}
        <div className="w-full max-w-sm space-y-4">
          {/* 카카오 로그인 */}
          <button
            onClick={handleKakaoLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#FEE500] text-gray-900 rounded-xl font-medium hover:bg-[#FDD835] transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
                <span>로그인 중...</span>
              </>
            ) : (
              <>
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3C6.48 3 2 6.97 2 11.92c0 3.16 1.86 5.93 4.66 7.52-.07.3-.45 1.88-.46 1.93-.02.17.12.17.16.13.03-.03 2.15-1.42 2.98-1.97.63.12 1.29.19 1.97.19 5.52 0 10-3.97 10-8.87S17.52 3 12 3z"/>
                </svg>
                <span>카카오로 시작하기</span>
              </>
            )}
          </button>

          {/* 구분선 */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">또는</span>
            </div>
          </div>

          {/* 기타 로그인 옵션 */}
          <button className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>구글로 시작하기</span>
          </button>

          <button className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#03C75A] text-white rounded-xl font-medium hover:bg-[#02B350] transition-colors">
            <span className="font-bold text-lg">N</span>
            <span>네이버로 시작하기</span>
          </button>

          {/* 전화번호 로그인 */}
          <button className="w-full px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors">
            전화번호로 로그인
          </button>
        </div>

        {/* 추가 정보 */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p className="mb-2">
            로그인 시{" "}
            <Link href="/terms" className="text-blue-600 underline">
              이용약관
            </Link>
            과{" "}
            <Link href="/privacy" className="text-blue-600 underline">
              개인정보처리방침
            </Link>
            에
          </p>
          <p>동의하는 것으로 간주됩니다.</p>
        </div>
      </main>

      {/* 하단 정보 */}
      <footer className="px-6 py-4 text-center text-xs text-gray-500">
        <p>진안군청 | 사업자등록번호: 123-45-67890</p>
        <p>대표전화: 063-430-2114</p>
      </footer>
    </div>
  );
}

// app/auth/callback/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function KakaoCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const error = searchParams.get("error");

      if (error) {
        console.error("카카오 로그인 에러:", error);
        router.push("/auth");
        return;
      }

      if (code) {
        try {
          // 실제 구현 시 백엔드로 code를 전송하여 토큰 교환
          const response = await fetch("/api/auth/kakao", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
          });

          const data = await response.json();

          if (data.success) {
            localStorage.setItem("authToken", data.token);
            localStorage.setItem("userName", data.user.name);
            router.push("/");
          } else {
            throw new Error("로그인 실패");
          }
        } catch (error) {
          console.error("토큰 교환 실패:", error);
          router.push("/auth");
        }
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-700">로그인 처리 중...</h2>
        <p className="text-gray-500 mt-2">잠시만 기다려주세요</p>
      </div>
    </div>
  );
}