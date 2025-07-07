import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Image, DollarSign, Package, Star, Sparkles, Copy, GripVertical } from 'lucide-react';

// 타입 정의
interface MenuOption {
  name: string;
  choices: MenuChoice[];
  required?: boolean;
  max_select?: number;
}

interface MenuChoice {
  name: string;
  price: number;
  is_default?: boolean;
}

interface Menu {
  id: string;
  store_id: string;
  category_name?: string;
  name: string;
  description?: string;
  price: number;
  discounted_price?: number;
  options?: MenuOption[];
  image_url?: string;
  is_available: boolean;
  is_popular: boolean;
  is_new: boolean;
  stock_quantity?: number;
  display_order: number;
}

// 메뉴 관리 컴포넌트
export default function MenuManagement({ storeId = 'demo-store-id' }: { storeId?: string }) {
  const [menus, setMenus] = useState<Menu[]>([
    {
      id: '1',
      store_id: storeId,
      category_name: '메인메뉴',
      name: '돼지국밥',
      description: '진한 육수와 푸짐한 고기가 들어간 돼지국밥',
      price: 9000,
      discounted_price: 8000,
      image_url: 'https://via.placeholder.com/300x200',
      is_available: true,
      is_popular: true,
      is_new: false,
      stock_quantity: 50,
      display_order: 1,
      options: [
        {
          name: '맵기 선택',
          required: true,
          choices: [
            { name: '안맵게', price: 0, is_default: true },
            { name: '보통', price: 0 },
            { name: '맵게', price: 0 }
          ]
        }
      ]
    },
    {
      id: '2',
      store_id: storeId,
      category_name: '메인메뉴',
      name: '순대국밥',
      description: '고소한 순대가 듬뿍 들어간 순대국밥',
      price: 8500,
      image_url: 'https://via.placeholder.com/300x200',
      is_available: true,
      is_popular: false,
      is_new: true,
      stock_quantity: 30,
      display_order: 2
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // 메뉴 삭제
  const handleDelete = async (menuId: string) => {
    if (!confirm('정말 이 메뉴를 삭제하시겠습니까?')) return;
    
    setMenus(menus.filter(menu => menu.id !== menuId));
  };

  // 메뉴 복사
  const handleDuplicate = async (menuId: string) => {
    const menuToCopy = menus.find(m => m.id === menuId);
    if (menuToCopy) {
      const newMenu = {
        ...menuToCopy,
        id: Date.now().toString(),
        name: `${menuToCopy.name} (복사본)`,
        display_order: menus.length + 1
      };
      setMenus([...menus, newMenu]);
    }
  };

  // 드래그 앤 드롭으로 순서 변경
  const handleDragEnd = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    setIsDragging(false);
    
    const draggedId = e.dataTransfer.getData('menuId');
    const draggedIndex = menus.findIndex(m => m.id === draggedId);
    
    if (draggedIndex === targetIndex) return;
    
    const newMenus = [...menus];
    const [draggedMenu] = newMenus.splice(draggedIndex, 1);
    newMenus.splice(targetIndex, 0, draggedMenu);
    
    // 순서 업데이트
    newMenus.forEach((menu, index) => {
      menu.display_order = index + 1;
    });
    
    setMenus(newMenus);
  };

  if (loading) {
    return <div className="text-center py-8">로딩중...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">메뉴 관리</h2>
        <button
          onClick={() => {
            setEditingMenu(null);
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          <Plus className="w-5 h-5" />
          메뉴 추가
        </button>
      </div>

      {/* 메뉴 목록 */}
      <div className="space-y-4">
        {menus.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-500 mb-4">등록된 메뉴가 없습니다.</p>
            <button
              onClick={() => setShowForm(true)}
              className="text-blue-500 hover:underline"
            >
              첫 메뉴 추가하기
            </button>
          </div>
        ) : (
          menus.map((menu, index) => (
            <div
              key={menu.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('menuId', menu.id);
                setIsDragging(true);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDragEnd(e, index)}
              className={`bg-white rounded-lg shadow p-6 cursor-move transition-all ${
                isDragging ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="cursor-move">
                  <GripVertical className="w-5 h-5 text-gray-400" />
                </div>
                
                {/* 메뉴 이미지 */}
                <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                  {menu.image_url ? (
                    <img
                      src={menu.image_url}
                      alt={menu.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* 메뉴 정보 */}
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold">{menu.name}</h3>
                        {menu.is_popular && (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            인기
                          </span>
                        )}
                        {menu.is_new && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            신메뉴
                          </span>
                        )}
                        {!menu.is_available && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                            품절
                          </span>
                        )}
                      </div>
                      
                      {menu.category_name && (
                        <p className="text-sm text-gray-500 mb-1">{menu.category_name}</p>
                      )}
                      
                      {menu.description && (
                        <p className="text-sm text-gray-600 mb-2">{menu.description}</p>
                      )}
                      
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4 text-gray-400" />
                          <span className="font-semibold">
                            {menu.discounted_price ? (
                              <>
                                <span className="line-through text-gray-400">
                                  {menu.price.toLocaleString()}원
                                </span>
                                <span className="text-red-500 ml-2">
                                  {menu.discounted_price.toLocaleString()}원
                                </span>
                              </>
                            ) : (
                              `${menu.price.toLocaleString()}원`
                            )}
                          </span>
                        </div>
                        
                        {menu.stock_quantity !== null && menu.stock_quantity !== undefined && (
                          <div className="flex items-center gap-1">
                            <Package className="w-4 h-4 text-gray-400" />
                            <span>재고: {menu.stock_quantity}개</span>
                          </div>
                        )}
                      </div>
                      
                      {/* 옵션 표시 */}
                      {menu.options && menu.options.length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm text-gray-500">
                            옵션: {menu.options.map(opt => opt.name).join(', ')}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* 액션 버튼 */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingMenu(menu);
                          setShowForm(true);
                        }}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                        title="수정"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDuplicate(menu.id)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                        title="복사"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(menu.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title="삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 메뉴 폼 모달 */}
      {showForm && (
        <MenuForm
          storeId={storeId}
          menu={editingMenu}
          onClose={() => {
            setShowForm(false);
            setEditingMenu(null);
          }}
          onSuccess={(newMenu) => {
            if (editingMenu) {
              setMenus(menus.map(m => m.id === editingMenu.id ? newMenu : m));
            } else {
              setMenus([...menus, newMenu]);
            }
            setShowForm(false);
            setEditingMenu(null);
          }}
        />
      )}
    </div>
  );
}

// 메뉴 폼 컴포넌트
function MenuForm({
  storeId,
  menu,
  onClose,
  onSuccess,
}: {
  storeId: string;
  menu?: Menu | null;
  onClose: () => void;
  onSuccess: (menu: Menu) => void;
}) {
  const [formData, setFormData] = useState({
    name: menu?.name || '',
    category_name: menu?.category_name || '',
    description: menu?.description || '',
    price: menu?.price || 0,
    discounted_price: menu?.discounted_price || 0,
    stock_quantity: menu?.stock_quantity ?? null,
    is_available: menu?.is_available ?? true,
    is_popular: menu?.is_popular || false,
    is_new: menu?.is_new || false,
  });
  
  const [options, setOptions] = useState<MenuOption[]>(menu?.options || []);
  const [imageUrl, setImageUrl] = useState<string>(menu?.image_url || '');
  const [loading, setLoading] = useState(false);

  // 옵션 추가
  const addOption = () => {
    setOptions([...options, { name: '', choices: [{ name: '', price: 0 }] }]);
  };

  // 옵션 삭제
  const removeOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  // 선택지 추가
  const addChoice = (optionIndex: number) => {
    const newOptions = [...options];
    newOptions[optionIndex].choices.push({ name: '', price: 0 });
    setOptions(newOptions);
  };

  // 선택지 삭제
  const removeChoice = (optionIndex: number, choiceIndex: number) => {
    const newOptions = [...options];
    newOptions[optionIndex].choices = newOptions[optionIndex].choices.filter(
      (_, i) => i !== choiceIndex
    );
    setOptions(newOptions);
  };

  // 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const newMenu: Menu = {
        id: menu?.id || Date.now().toString(),
        store_id: storeId,
        name: formData.name,
        category_name: formData.category_name,
        description: formData.description,
        price: formData.price,
        discounted_price: formData.discounted_price || undefined,
        options: options.length > 0 ? options : undefined,
        image_url: imageUrl || undefined,
        is_available: formData.is_available,
        is_popular: formData.is_popular,
        is_new: formData.is_new,
        stock_quantity: formData.stock_quantity ?? undefined,
        display_order: menu?.display_order || 1,
      };

      // 시뮬레이션 딜레이
      await new Promise(resolve => setTimeout(resolve, 500));
      
      onSuccess(newMenu);
    } catch (error) {
      alert('메뉴 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold mb-4">
          {menu ? '메뉴 수정' : '메뉴 추가'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 이미지 URL */}
          <div>
            <label className="block text-sm font-medium mb-2">메뉴 이미지 URL</label>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="https://example.com/image.jpg"
            />
            {imageUrl && (
              <img
                src={imageUrl}
                alt="미리보기"
                className="mt-2 w-32 h-32 object-cover rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150';
                }}
              />
            )}
          </div>

          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                메뉴명 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">카테고리</label>
              <input
                type="text"
                value={formData.category_name}
                onChange={(e) => setFormData({ ...formData, category_name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="예: 메인메뉴, 사이드메뉴"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">설명</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                가격 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg"
                min="0"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">할인가격</label>
              <input
                type="number"
                value={formData.discounted_price}
                onChange={(e) => setFormData({ ...formData, discounted_price: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg"
                min="0"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">재고</label>
              <input
                type="number"
                value={formData.stock_quantity || ''}
                onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value ? Number(e.target.value) : null })}
                className="w-full px-3 py-2 border rounded-lg"
                min="0"
                placeholder="재고 관리 안함"
              />
            </div>
          </div>

          {/* 상태 체크박스 */}
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_available}
                onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })}
              />
              <span className="text-sm">판매 가능</span>
            </label>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_popular}
                onChange={(e) => setFormData({ ...formData, is_popular: e.target.checked })}
              />
              <span className="text-sm">인기 메뉴</span>
            </label>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_new}
                onChange={(e) => setFormData({ ...formData, is_new: e.target.checked })}
              />
              <span className="text-sm">신메뉴</span>
            </label>
          </div>

          {/* 옵션 관리 */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium">옵션</label>
              <button
                type="button"
                onClick={addOption}
                className="text-sm text-blue-500 hover:underline"
              >
                + 옵션 추가
              </button>
            </div>
            
            {options.map((option, optionIndex) => (
              <div key={optionIndex} className="border rounded-lg p-4 mb-2">
                <div className="flex justify-between items-start mb-2">
                  <input
                    type="text"
                    value={option.name}
                    onChange={(e) => {
                      const newOptions = [...options];
                      newOptions[optionIndex].name = e.target.value;
                      setOptions(newOptions);
                    }}
                    placeholder="옵션명 (예: 사이즈)"
                    className="px-3 py-2 border rounded-lg flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(optionIndex)}
                    className="ml-2 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="space-y-2">
                  {option.choices.map((choice, choiceIndex) => (
                    <div key={choiceIndex} className="flex gap-2">
                      <input
                        type="text"
                        value={choice.name}
                        onChange={(e) => {
                          const newOptions = [...options];
                          newOptions[optionIndex].choices[choiceIndex].name = e.target.value;
                          setOptions(newOptions);
                        }}
                        placeholder="선택지명"
                        className="px-3 py-2 border rounded-lg flex-1"
                      />
                      <input
                        type="number"
                        value={choice.price}
                        onChange={(e) => {
                          const newOptions = [...options];
                          newOptions[optionIndex].choices[choiceIndex].price = Number(e.target.value);
                          setOptions(newOptions);
                        }}
                        placeholder="추가금액"
                        className="px-3 py-2 border rounded-lg w-32"
                        min="0"
                      />
                      <button
                        type="button"
                        onClick={() => removeChoice(optionIndex, choiceIndex)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  
                  <button
                    type="button"
                    onClick={() => addChoice(optionIndex)}
                    className="text-sm text-blue-500 hover:underline"
                  >
                    + 선택지 추가
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 버튼 */}
          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              disabled={loading}
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? '저장중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}