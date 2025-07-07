import React, { useState } from 'react';
import { 
  Store, Camera, Upload, MapPin, Phone, Clock, 
  AlertCircle, Check, ChevronRight, FileText,
  User, Building, Mail, CreditCard
} from 'lucide-react';

const StoreRegisterPage = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    // 기본 정보
    storeName: '',
    category: '',
    description: '',
    
    // 사업자 정보
    businessNumber: '',
    ownerName: '',
    ownerPhone: '',
    ownerEmail: '',
    
    // 주소 정보
    address: '',
    detailAddress: '',
    latitude: null,
    longitude: null,
    
    // 영업 정보
    businessHours: {
      mon: { open: '09:00', close: '21:00', isOpen: true },
      tue: { open: '09:00', close: '21:00', isOpen: true },
      wed: { open: '09:00', close: '21:00', isOpen: true },
      thu: { open: '09:00', close: '21:00', isOpen: true },
      fri: { open: '09:00', close: '21:00', isOpen: true },
      sat: { open: '10:00', close: '22:00', isOpen: true },
      sun: { open: '10:00', close: '20:00', isOpen: false }
    },
    
    // 계좌 정보
    bankName: '',
    accountNumber: '',
    accountHolder: '',
    
    // 파일
    businessLicense: null,
    storeImages: []
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const categories = [
    '한식', '중식', '일식', '양식', '분식', '카페/베이커리',
    '고기/구이', '해산물', '치킨/피자', '술집', '기타'
  ];

  const banks = [
    '국민은행', '신한은행', '우리은행', '하나은행', '농협은행',
    'IBK기업은행', '카카오뱅크', '토스뱅크', '케이뱅크'
  ];

  const updateFormData = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // 에러 제거
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const updateBusinessHours = (day, field, value) => {
    setFormData(prev => ({
      ...prev,
      businessHours: {
        ...prev.businessHours,
        [day]: {
          ...prev.businessHours[day],
          [field]: value
        }
      }
    }));
  };

  const validateStep = (stepNumber) => {
    const newErrors = {};

    if (stepNumber === 1) {
      if (!formData.storeName) newErrors.storeName = '상점명을 입력해주세요';
      if (!formData.category) newErrors.category = '카테고리를 선택해주세요';
      if (!formData.description) newErrors.description = '상점 소개를 입력해주세요';
      if (!formData.businessNumber) newErrors.businessNumber = '사업자등록번호를 입력해주세요';
      if (!formData.ownerName) newErrors.ownerName = '대표자명을 입력해주세요';
      if (!formData.ownerPhone) newErrors.ownerPhone = '연락처를 입력해주세요';
      if (!formData.ownerEmail) newErrors.ownerEmail = '이메일을 입력해주세요';
    }

    if (stepNumber === 2) {
      if (!formData.address) newErrors.address = '주소를 입력해주세요';
    }

    if (stepNumber === 4) {
      if (!formData.bankName) newErrors.bankName = '은행을 선택해주세요';
      if (!formData.accountNumber) newErrors.accountNumber = '계좌번호를 입력해주세요';
      if (!formData.accountHolder) newErrors.accountHolder = '예금주명을 입력해주세요';
      if (!formData.businessLicense) newErrors.businessLicense = '사업자등록증을 업로드해주세요';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  };

  const handlePrev = () => {
    setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep(4)) return;

    setIsSubmitting(true);
    
    // API 호출 시뮬레이션
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
    }, 2000);
  };

  const formatBusinessNumber = (value) => {
    const numbers = value.replace(/[^\d]/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 5) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 5)}-${numbers.slice(5, 10)}`;
  };

  const formatPhoneNumber = (value) => {
    const numbers = value.replace(/[^\d]/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  };

  const getDayName = (day) => {
    const days = {
      mon: '월', tue: '화', wed: '수', thu: '목',
      fri: '금', sat: '토', sun: '일'
    };
    return days[day];
  };

  // 제출 완료 화면
  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">등록 신청 완료!</h2>
          <p className="text-gray-600 mb-6">
            상점 등록 신청이 완료되었습니다.<br />
            심사 후 1-2일 이내에 승인 결과를 알려드립니다.
          </p>
          <button className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="p-4">
          <h1 className="text-xl font-bold text-center">상점 등록</h1>
          
          {/* 진행 단계 */}
          <div className="flex items-center justify-between mt-4">
            {[1, 2, 3, 4].map((num) => (
              <React.Fragment key={num}>
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  step >= num ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {num}
                </div>
                {num < 4 && (
                  <div className={`flex-1 h-1 mx-2 ${
                    step > num ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
          
          <div className="flex justify-between text-xs text-gray-600 mt-2">
            <span>기본정보</span>
            <span>위치정보</span>
            <span>영업정보</span>
            <span>서류등록</span>
          </div>
        </div>
      </div>

      {/* 폼 내용 */}
      <div className="p-4 pb-24">
        {/* Step 1: 기본 정보 */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-4">기본 정보</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    상점명 *
                  </label>
                  <input
                    type="text"
                    value={formData.storeName}
                    onChange={(e) => updateFormData('storeName', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg ${
                      errors.storeName ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="예: 진안명품한우"
                  />
                  {errors.storeName && (
                    <p className="text-red-500 text-xs mt-1">{errors.storeName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    카테고리 *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => updateFormData('category', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg ${
                      errors.category ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">카테고리 선택</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  {errors.category && (
                    <p className="text-red-500 text-xs mt-1">{errors.category}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    상점 소개 *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => updateFormData('description', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg ${
                      errors.description ? 'border-red-500' : 'border-gray-300'
                    }`}
                    rows={4}
                    placeholder="상점을 소개해주세요"
                  />
                  {errors.description && (
                    <p className="text-red-500 text-xs mt-1">{errors.description}</p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-3">사업자 정보</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    사업자등록번호 *
                  </label>
                  <input
                    type="text"
                    value={formData.businessNumber}
                    onChange={(e) => updateFormData('businessNumber', formatBusinessNumber(e.target.value))}
                    className={`w-full px-3 py-2 border rounded-lg ${
                      errors.businessNumber ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="123-45-67890"
                    maxLength={12}
                  />
                  {errors.businessNumber && (
                    <p className="text-red-500 text-xs mt-1">{errors.businessNumber}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    대표자명 *
                  </label>
                  <input
                    type="text"
                    value={formData.ownerName}
                    onChange={(e) => updateFormData('ownerName', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg ${
                      errors.ownerName ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="홍길동"
                  />
                  {errors.ownerName && (
                    <p className="text-red-500 text-xs mt-1">{errors.ownerName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    연락처 *
                  </label>
                  <input
                    type="tel"
                    value={formData.ownerPhone}
                    onChange={(e) => updateFormData('ownerPhone', formatPhoneNumber(e.target.value))}
                    className={`w-full px-3 py-2 border rounded-lg ${
                      errors.ownerPhone ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="010-1234-5678"
                    maxLength={13}
                  />
                  {errors.ownerPhone && (
                    <p className="text-red-500 text-xs mt-1">{errors.ownerPhone}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    이메일 *
                  </label>
                  <input
                    type="email"
                    value={formData.ownerEmail}
                    onChange={(e) => updateFormData('ownerEmail', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg ${
                      errors.ownerEmail ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="example@email.com"
                  />
                  {errors.ownerEmail && (
                    <p className="text-red-500 text-xs mt-1">{errors.ownerEmail}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: 위치 정보 */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">위치 정보</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  주소 *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => updateFormData('address', e.target.value)}
                    className={`flex-1 px-3 py-2 border rounded-lg ${
                      errors.address ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="주소를 검색하세요"
                    readOnly
                  />
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    주소 검색
                  </button>
                </div>
                {errors.address && (
                  <p className="text-red-500 text-xs mt-1">{errors.address}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  상세 주소
                </label>
                <input
                  type="text"
                  value={formData.detailAddress}
                  onChange={(e) => updateFormData('detailAddress', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="상세 주소를 입력하세요"
                />
              </div>

              {/* 지도 영역 */}
              <div className="h-64 bg-gray-200 rounded-lg flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <MapPin className="w-12 h-12 mx-auto mb-2" />
                  <p>주소 검색 후 지도에 표시됩니다</p>
                </div>
              </div>

              {/* 상점 이미지 업로드 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  상점 이미지 (최대 5장)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[...Array(5)].map((_, index) => (
                    <div
                      key={index}
                      className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-gray-400"
                    >
                      {formData.storeImages[index] ? (
                        <img
                          src={formData.storeImages[index]}
                          alt={`상점 이미지 ${index + 1}`}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <Camera className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  상점 외관, 내부 사진을 등록해주세요
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: 영업 정보 */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">영업 정보</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                영업 시간
              </label>
              
              <div className="space-y-2">
                {Object.entries(formData.businessHours).map(([day, hours]) => (
                  <div key={day} className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => updateBusinessHours(day, 'isOpen', !hours.isOpen)}
                      className={`w-12 text-sm font-medium ${
                        hours.isOpen ? 'text-gray-900' : 'text-gray-400'
                      }`}
                    >
                      {getDayName(day)}
                    </button>
                    
                    {hours.isOpen ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="time"
                          value={hours.open}
                          onChange={(e) => updateBusinessHours(day, 'open', e.target.value)}
                          className="px-2 py-1 border rounded text-sm"
                        />
                        <span className="text-gray-500">~</span>
                        <input
                          type="time"
                          value={hours.close}
                          onChange={(e) => updateBusinessHours(day, 'close', e.target.value)}
                          className="px-2 py-1 border rounded text-sm"
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">휴무</span>
                    )}
                    
                    <button
                      type="button"
                      onClick={() => updateBusinessHours(day, 'isOpen', !hours.isOpen)}
                      className="text-sm text-blue-600"
                    >
                      {hours.isOpen ? '휴무' : '영업'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">영업시간 안내</p>
                  <p>정확한 영업시간을 입력해주세요. 임시 휴무나 영업시간 변경은 승인 후 대시보드에서 수정할 수 있습니다.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: 서류 등록 */}
        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">서류 등록</h2>
            
            <div>
              <h3 className="font-medium mb-3">정산 계좌 정보</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    은행 *
                  </label>
                  <select
                    value={formData.bankName}
                    onChange={(e) => updateFormData('bankName', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg ${
                      errors.bankName ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">은행 선택</option>
                    {banks.map(bank => (
                      <option key={bank} value={bank}>{bank}</option>
                    ))}
                  </select>
                  {errors.bankName && (
                    <p className="text-red-500 text-xs mt-1">{errors.bankName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    계좌번호 *
                  </label>
                  <input
                    type="text"
                    value={formData.accountNumber}
                    onChange={(e) => updateFormData('accountNumber', e.target.value.replace(/[^0-9]/g, ''))}
                    className={`w-full px-3 py-2 border rounded-lg ${
                      errors.accountNumber ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="계좌번호 입력"
                  />
                  {errors.accountNumber && (
                    <p className="text-red-500 text-xs mt-1">{errors.accountNumber}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    예금주명 *
                  </label>
                  <input
                    type="text"
                    value={formData.accountHolder}
                    onChange={(e) => updateFormData('accountHolder', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg ${
                      errors.accountHolder ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="예금주명 입력"
                  />
                  {errors.accountHolder && (
                    <p className="text-red-500 text-xs mt-1">{errors.accountHolder}</p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-3">사업자등록증 *</h3>
              
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 ${
                  errors.businessLicense ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                {formData.businessLicense ? (
                  <div>
                    <FileText className="w-12 h-12 mx-auto text-green-600 mb-2" />
                    <p className="text-sm text-gray-700">사업자등록증이 업로드되었습니다</p>
                    <button
                      type="button"
                      className="text-sm text-blue-600 mt-1"
                    >
                      다시 업로드
                    </button>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">
                      클릭하여 사업자등록증 업로드
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      JPG, PNG, PDF (최대 10MB)
                    </p>
                  </div>
                )}
              </div>
              {errors.businessLicense && (
                <p className="text-red-500 text-xs mt-1">{errors.businessLicense}</p>
              )}
            </div>

            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-1">심사 안내</p>
                  <ul className="space-y-1">
                    <li>• 제출하신 서류는 1-2일 이내 심사됩니다</li>
                    <li>• 심사 결과는 SMS와 이메일로 안내됩니다</li>
                    <li>• 추가 서류가 필요한 경우 별도 연락드립니다</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 하단 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
        <div className="flex gap-3">
          {step > 1 && (
            <button
              onClick={handlePrev}
              className="flex-1 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              이전
            </button>
          )}
          
          {step < 4 ? (
            <button
              onClick={handleNext}
              className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              다음
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  제출중...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  등록 신청
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StoreRegisterPage;