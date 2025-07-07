import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, X, MapPin, Clock, TrendingUp, Filter, ChevronRight, Store, Coffee, Utensils, ShoppingBag, Heart, Star, Mic, MicOff, Navigation, ArrowUpDown, Loader } from 'lucide-react';

// 더미 데이터 (무한 스크롤을 위해 더 많은 데이터 추가)
const generateMockStores = () => {
  const baseStores = [
    { id: 1, name: '진안 전통 떡집', category: '떡/한과', location: '진안읍', rating: 4.8, distance: 0.5, lat: 35.7918, lng: 127.4248, popularity: 95 },
    { id: 2, name: '마이산 토종닭', category: '음식점', location: '마령면', rating: 4.6, distance: 2.3, lat: 35.7623, lng: 127.4012, popularity: 88 },
    { id: 3, name: '진안고원 한우', category: '정육점', location: '진안읍', rating: 4.9, distance: 1.2, lat: 35.7918, lng: 127.4248, popularity: 92 },
    { id: 4, name: '할머니 손맛 반찬', category: '반찬', location: '성수면', rating: 4.7, distance: 3.1, lat: 35.8234, lng: 127.3876, popularity: 85 },
    { id: 5, name: '진안 막걸리 양조장', category: '전통주', location: '백운면', rating: 4.5, distance: 4.5, lat: 35.7123, lng: 127.4567, popularity: 78 },
    { id: 6, name: '산골 버섯농장', category: '농산물', location: '주천면', rating: 4.8, distance: 5.2, lat: 35.6789, lng: 127.3456, popularity: 82 },
    { id: 7, name: '진안 홍삼센터', category: '건강식품', location: '진안읍', rating: 4.6, distance: 0.8, lat: 35.7918, lng: 127.4248, popularity: 90 },
    { id: 8, name: '시골 빵집', category: '베이커리', location: '진안읍', rating: 4.9, distance: 0.3, lat: 35.7918, lng: 127.4248, popularity: 96 }
  ];

  // 더 많은 데이터 생성
  const allStores = [...baseStores];
  for (let i = 9; i <= 50; i++) {
    allStores.push({
      id: i,
      name: `상점 ${i}`,
      category: ['음식점', '카페', '농산물', '베이커리'][i % 4],
      location: ['진안읍', '마령면', '성수면', '백운면'][i % 4],
      rating: (4 + Math.random() * 0.9).toFixed(1),
      distance: (Math.random() * 10).toFixed(1),
      lat: 35.7918 + (Math.random() - 0.5) * 0.1,
      lng: 127.4248 + (Math.random() - 0.5) * 0.1,
      popularity: Math.floor(50 + Math.random() * 50)
    });
  }
  return allStores;
};

const mockStores = generateMockStores();

// 자동완성 제안어
const autocompleteSuggestions = {
  '진안': ['진안 전통 떡집', '진안 막걸리', '진안고원 한우', '진안 홍삼센터'],
  '마이산': ['마이산 토종닭', '마이산 산나물', '마이산 약초'],
  '떡': ['진안 전통 떡집', '떡갈비', '떡볶이'],
  '한우': ['진안고원 한우', '한우 갈비', '한우 국밥']
};

const categories = [
  { id: 'all', name: '전체', icon: Store },
  { id: 'food', name: '음식점', icon: Utensils },
  { id: 'cafe', name: '카페', icon: Coffee },
  { id: 'market', name: '전통시장', icon: ShoppingBag },
  { id: 'agri', name: '농산물', icon: Heart }
];

const locations = ['전체', '진안읍', '마령면', '성수면', '백운면', '주천면', '정천면', '용담면', '안천면', '동향면', '상전면'];

const popularSearches = ['진안 홍삼', '마이산 토종닭', '전통 떡', '막걸리', '한우', '버섯', '산나물', '빵집'];

const sortOptions = [
  { id: 'distance', name: '거리순', icon: Navigation },
  { id: 'rating', name: '평점순', icon: Star },
  { id: 'popularity', name: '인기순', icon: TrendingUp },
  { id: 'recent', name: '최신순', icon: Clock }
];

// Custom Hook: 무한 스크롤
function useInfiniteScroll(callback) {
  const observer = useRef();
  
  const lastElementRef = useCallback(node => {
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        callback();
      }
    });
    if (node) observer.current.observe(node);
  }, [callback]);

  return lastElementRef;
}

// Custom Hook: Debounce
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('전체');
  const [selectedSort, setSelectedSort] = useState('distance');
  const [showFilters, setShowFilters] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [displayedResults, setDisplayedResults] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  
  const searchInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const ITEMS_PER_PAGE = 10;

  // 로컬 스토리지에서 검색 히스토리 불러오기
  useEffect(() => {
    const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
    setRecentSearches(history.slice(0, 5));
  }, []);

  // 음성 인식 초기화
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'ko-KR';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setSearchQuery(transcript);
        handleSearch(transcript);
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // 자동완성 기능
  useEffect(() => {
    if (debouncedSearchQuery.length > 0) {
      const matchingSuggestions = [];
      
      Object.entries(autocompleteSuggestions).forEach(([key, values]) => {
        if (key.includes(debouncedSearchQuery)) {
          matchingSuggestions.push(...values);
        }
      });

      // 상점명에서도 검색
      mockStores.forEach(store => {
        if (store.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase())) {
          matchingSuggestions.push(store.name);
        }
      });

      // 중복 제거 및 최대 5개만 표시
      const uniqueSuggestions = [...new Set(matchingSuggestions)].slice(0, 5);
      setSuggestions(uniqueSuggestions);
      setShowSuggestions(uniqueSuggestions.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [debouncedSearchQuery]);

  // 검색 결과 필터링 및 정렬
  const filteredAndSortedResults = useMemo(() => {
    let results = mockStores.filter(store => {
      const matchesQuery = !searchQuery || 
        store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        store.category.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategory === 'all' || 
        (selectedCategory === 'food' && store.category === '음식점') ||
        (selectedCategory === 'cafe' && store.category === '카페') ||
        (selectedCategory === 'market' && ['떡/한과', '반찬', '정육점'].includes(store.category)) ||
        (selectedCategory === 'agri' && ['농산물', '건강식품'].includes(store.category));
      
      const matchesLocation = selectedLocation === '전체' || store.location === selectedLocation;

      return matchesQuery && matchesCategory && matchesLocation;
    });

    // 정렬
    switch (selectedSort) {
      case 'distance':
        results.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
        break;
      case 'rating':
        results.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
        break;
      case 'popularity':
        results.sort((a, b) => b.popularity - a.popularity);
        break;
      case 'recent':
        results.sort((a, b) => b.id - a.id);
        break;
    }

    return results;
  }, [searchQuery, selectedCategory, selectedLocation, selectedSort]);

  // 무한 스크롤 로드
  const loadMore = useCallback(() => {
    if (isSearching || !hasMore) return;

    const nextItems = filteredAndSortedResults.slice(0, page * ITEMS_PER_PAGE);
    setDisplayedResults(nextItems);
    setPage(prev => prev + 1);

    if (nextItems.length >= filteredAndSortedResults.length) {
      setHasMore(false);
    }
  }, [filteredAndSortedResults, page, isSearching, hasMore]);

  const lastStoreRef = useInfiniteScroll(loadMore);

  // 검색 실행
  const handleSearch = useCallback((query) => {
    if (!query.trim()) return;

    setIsSearching(true);
    setSearchQuery(query);
    setShowSuggestions(false);
    setPage(1);
    setHasMore(true);

    // 검색 히스토리에 추가
    const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
    const newHistory = [query, ...history.filter(h => h !== query)].slice(0, 10);
    localStorage.setItem('searchHistory', JSON.stringify(newHistory));
    setRecentSearches(newHistory.slice(0, 5));

    // 검색 시뮬레이션
    setTimeout(() => {
      setIsSearching(false);
      const results = filteredAndSortedResults;
      setSearchResults(results);
      setDisplayedResults(results.slice(0, ITEMS_PER_PAGE));
    }, 300);
  }, [filteredAndSortedResults]);

  // 음성 검색 시작
  const startVoiceSearch = () => {
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.start();
    }
  };

  // 위치 기반 검색
  const getCurrentLocation = () => {
    setIsLoadingLocation(true);
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          
          // 거리 재계산
          const storesWithDistance = mockStores.map(store => ({
            ...store,
            distance: calculateDistance(latitude, longitude, store.lat, store.lng)
          }));
          
          // 정렬 및 표시
          storesWithDistance.sort((a, b) => a.distance - b.distance);
          setSearchResults(storesWithDistance);
          setDisplayedResults(storesWithDistance.slice(0, ITEMS_PER_PAGE));
          setIsLoadingLocation(false);
        },
        (error) => {
          console.error('위치 정보를 가져올 수 없습니다:', error);
          setIsLoadingLocation(false);
        }
      );
    }
  };

  // 거리 계산 함수 (Haversine formula)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // 지구 반경 (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c).toFixed(1);
  };

  // 검색어 삭제
  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setDisplayedResults([]);
    setShowSuggestions(false);
  };

  // 검색 히스토리 삭제
  const clearHistory = () => {
    localStorage.removeItem('searchHistory');
    setRecentSearches([]);
  };

  // 자동완성 선택
  const selectSuggestion = (suggestion) => {
    setSearchQuery(suggestion);
    setShowSuggestions(false);
    handleSearch(suggestion);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="sticky top-0 z-40 bg-white shadow-sm">
        <div className="p-4">
          {/* 검색바 */}
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
              onFocus={() => setShowSuggestions(suggestions.length > 0)}
              placeholder="상점, 메뉴, 지역을 검색하세요"
              className="w-full pl-10 pr-20 py-3 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <div className="absolute right-3 top-2 flex items-center gap-2">
              {/* 음성 검색 버튼 */}
              <button
                onClick={startVoiceSearch}
                className={`p-1.5 rounded-full transition-colors ${
                  isListening ? 'bg-red-500 text-white animate-pulse' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              
              {/* 검색 초기화 버튼 */}
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* 자동완성 드롭다운 */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => selectSuggestion(suggestion)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Search className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-800">{suggestion}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 필터 및 정렬 버튼 */}
          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-sm text-gray-600"
            >
              <Filter className="w-4 h-4" />
              필터
              {(selectedCategory !== 'all' || selectedLocation !== '전체') && (
                <span className="px-2 py-0.5 bg-green-100 text-green-600 rounded-full text-xs">
                  {[selectedCategory !== 'all' && '카테고리', selectedLocation !== '전체' && '지역'].filter(Boolean).join(', ')}
                </span>
              )}
            </button>

            <div className="flex items-center gap-2">
              {/* 위치 기반 검색 버튼 */}
              <button
                onClick={getCurrentLocation}
                disabled={isLoadingLocation}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-green-600"
              >
                {isLoadingLocation ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Navigation className="w-4 h-4" />
                )}
                내 주변
              </button>

              {/* 정렬 옵션 */}
              <select
                value={selectedSort}
                onChange={(e) => setSelectedSort(e.target.value)}
                className="text-sm text-gray-600 bg-transparent border border-gray-300 rounded px-2 py-1"
              >
                {sortOptions.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 필터 옵션 */}
        {showFilters && (
          <div className="border-t">
            {/* 카테고리 필터 */}
            <div className="p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">카테고리</h3>
              <div className="flex gap-2 flex-wrap">
                {categories.map(category => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`px-4 py-2 rounded-full text-sm flex items-center gap-1 transition-colors ${
                      selectedCategory === category.id
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <category.icon className="w-4 h-4" />
                    {category.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 지역 필터 */}
            <div className="p-4 border-t">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">지역</h3>
              <div className="flex gap-2 flex-wrap">
                {locations.map(location => (
                  <button
                    key={location}
                    onClick={() => setSelectedLocation(location)}
                    className={`px-4 py-2 rounded-full text-sm transition-colors ${
                      selectedLocation === location
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {location}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 검색 결과 */}
      <div className="p-4">
        {/* 검색 전 화면 */}
        {!searchQuery && displayedResults.length === 0 && !userLocation && (
          <>
            {/* 최근 검색어 */}
            {recentSearches.length > 0 && (
              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-gray-600" />
                    최근 검색어
                  </h3>
                  <button
                    onClick={clearHistory}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    전체 삭제
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((search, index) => (
                    <button
                      key={index}
                      onClick={() => handleSearch(search)}
                      className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {search}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 인기 검색어 */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-red-500" />
                인기 검색어
              </h3>
              <div className="grid gap-2">
                {popularSearches.map((keyword, index) => (
                  <button
                    key={index}
                    onClick={() => handleSearch(keyword)}
                    className="flex items-center justify-between p-3 bg-white rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 flex items-center justify-center text-sm font-semibold text-gray-500">
                        {index + 1}
                      </span>
                      <span className="text-gray-800">{keyword}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* 검색 중 */}
        {isSearching && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600">검색 중...</p>
          </div>
        )}

        {/* 검색 결과 표시 */}
        {!isSearching && (searchQuery || userLocation) && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">
                {userLocation ? '내 주변 상점' : '검색 결과'} <span className="text-green-600">{filteredAndSortedResults.length}</span>개
              </h3>
            </div>

            {filteredAndSortedResults.length === 0 ? (
              <div className="text-center py-20">
                <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">검색 결과가 없습니다</p>
                <p className="text-sm text-gray-500">다른 키워드로 검색해보세요</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {displayedResults.map((store, index) => (
                  <div
                    key={store.id}
                    ref={index === displayedResults.length - 1 ? lastStoreRef : null}
                    className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex gap-4">
                      <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center">
                        <Store className="w-8 h-8 text-gray-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-800">{store.name}</h4>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                          <span className="bg-gray-100 px-2 py-0.5 rounded">{store.category}</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {store.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-500" />
                            {store.rating}
                          </span>
                        </div>
                        <p className="text-sm text-green-600 mt-2">{store.distance}km</p>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* 로딩 인디케이터 */}
                {hasMore && displayedResults.length < filteredAndSortedResults.length && (
                  <div className="text-center py-4">
                    <div className="inline-flex items-center gap-2 text-gray-500">
                      <Loader className="w-4 h-4 animate-spin" />
                      <span className="text-sm">더 불러오는 중...</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* 음성 인식 중 오버레이 */}
      {isListening && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 text-center">
            <Mic className="w-16 h-16 text-red-500 mx-auto mb-4 animate-pulse" />
            <p className="text-lg font-semibold mb-2">듣고 있습니다...</p>
            <p className="text-sm text-gray-600">검색어를 말씀해주세요</p>
          </div>
        </div>
      )}
    </div>
  );
}