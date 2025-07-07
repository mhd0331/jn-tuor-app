import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, X, MapPin, Clock, TrendingUp, Filter, ChevronRight, Store, Coffee, Utensils, ShoppingBag, Heart, Star } from 'lucide-react';

// 더미 데이터
const mockStores = [
  { id: 1, name: '진안 전통 떡집', category: '떡/한과', location: '진안읍', rating: 4.8, distance: 0.5, image: '/api/placeholder/80/80' },
  { id: 2, name: '마이산 토종닭', category: '음식점', location: '마령면', rating: 4.6, distance: 2.3, image: '/api/placeholder/80/80' },
  { id: 3, name: '진안고원 한우', category: '정육점', location: '진안읍', rating: 4.9, distance: 1.2, image: '/api/placeholder/80/80' },
  { id: 4, name: '할머니 손맛 반찬', category: '반찬', location: '성수면', rating: 4.7, distance: 3.1, image: '/api/placeholder/80/80' },
  { id: 5, name: '진안 막걸리 양조장', category: '전통주', location: '백운면', rating: 4.5, distance: 4.5, image: '/api/placeholder/80/80' },
  { id: 6, name: '산골 버섯농장', category: '농산물', location: '주천면', rating: 4.8, distance: 5.2, image: '/api/placeholder/80/80' },
  { id: 7, name: '진안 홍삼센터', category: '건강식품', location: '진안읍', rating: 4.6, distance: 0.8, image: '/api/placeholder/80/80' },
  { id: 8, name: '시골 빵집', category: '베이커리', location: '진안읍', rating: 4.9, distance: 0.3, image: '/api/placeholder/80/80' }
];

const categories = [
  { id: 'all', name: '전체', icon: Store },
  { id: 'food', name: '음식점', icon: Utensils },
  { id: 'cafe', name: '카페', icon: Coffee },
  { id: 'market', name: '전통시장', icon: ShoppingBag },
  { id: 'agri', name: '농산물', icon: Heart }
];

const locations = ['전체', '진안읍', '마령면', '성수면', '백운면', '주천면', '정천면', '용담면', '안천면', '동향면', '상전면'];

const popularSearches = ['진안 홍삼', '마이산 토종닭', '전통 떡', '막걸리', '한우', '버섯', '산나물', '빵집'];

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('전체');
  const [showFilters, setShowFilters] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  // 로컬 스토리지에서 검색 히스토리 불러오기
  useEffect(() => {
    const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
    setRecentSearches(history.slice(0, 5));
  }, []);

  // 검색 결과 필터링
  const filteredResults = useMemo(() => {
    if (!searchQuery && selectedCategory === 'all' && selectedLocation === '전체') {
      return [];
    }

    return mockStores.filter(store => {
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
  }, [searchQuery, selectedCategory, selectedLocation]);

  // 검색 실행
  const handleSearch = useCallback((query) => {
    if (!query.trim()) return;

    setIsSearching(true);
    setSearchQuery(query);

    // 검색 히스토리에 추가
    const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
    const newHistory = [query, ...history.filter(h => h !== query)].slice(0, 10);
    localStorage.setItem('searchHistory', JSON.stringify(newHistory));
    setRecentSearches(newHistory.slice(0, 5));

    // 검색 시뮬레이션
    setTimeout(() => {
      setIsSearching(false);
      setSearchResults(filteredResults);
    }, 300);
  }, [filteredResults]);

  // 검색어 삭제
  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  // 검색 히스토리 삭제
  const clearHistory = () => {
    localStorage.removeItem('searchHistory');
    setRecentSearches([]);
  };

  // 인기 검색어 클릭
  const handlePopularSearch = (keyword) => {
    setSearchQuery(keyword);
    handleSearch(keyword);
  };

  // 최근 검색어 클릭
  const handleRecentSearch = (keyword) => {
    setSearchQuery(keyword);
    handleSearch(keyword);
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
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
              placeholder="상점, 메뉴, 지역을 검색하세요"
              className="w-full pl-10 pr-10 py-3 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* 필터 버튼 */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="mt-3 flex items-center gap-2 text-sm text-gray-600"
          >
            <Filter className="w-4 h-4" />
            필터
            {(selectedCategory !== 'all' || selectedLocation !== '전체') && (
              <span className="px-2 py-0.5 bg-green-100 text-green-600 rounded-full text-xs">
                {[selectedCategory !== 'all' && '카테고리', selectedLocation !== '전체' && '지역'].filter(Boolean).join(', ')}
              </span>
            )}
          </button>
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
        {!searchQuery && searchResults.length === 0 && (
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
                      onClick={() => handleRecentSearch(search)}
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
                    onClick={() => handlePopularSearch(keyword)}
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
        {!isSearching && searchQuery && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">
                검색 결과 <span className="text-green-600">{filteredResults.length}</span>개
              </h3>
            </div>

            {filteredResults.length === 0 ? (
              <div className="text-center py-20">
                <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">검색 결과가 없습니다</p>
                <p className="text-sm text-gray-500">다른 키워드로 검색해보세요</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredResults.map(store => (
                  <div
                    key={store.id}
                    className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex gap-4">
                      <img
                        src={store.image}
                        alt={store.name}
                        className="w-20 h-20 rounded-lg object-cover"
                      />
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
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}