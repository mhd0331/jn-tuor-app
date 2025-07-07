// =============================================
// 진안군 장터 앱 - 메뉴 CRUD API 백엔드
// =============================================

// src/types/menu.types.ts
export interface Menu {
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
  created_at: Date;
  updated_at: Date;
}

export interface MenuOption {
  name: string;
  choices: MenuChoice[];
  required?: boolean;
  max_select?: number; // 최대 선택 가능 수 (기본값: 1)
}

export interface MenuChoice {
  name: string;
  price: number;
  is_default?: boolean;
}

export interface CreateMenuDTO {
  store_id: string;
  category_name?: string;
  name: string;
  description?: string;
  price: number;
  discounted_price?: number;
  options?: MenuOption[];
  is_available?: boolean;
  is_popular?: boolean;
  is_new?: boolean;
  stock_quantity?: number;
  display_order?: number;
}

export interface UpdateMenuDTO {
  category_name?: string;
  name?: string;
  description?: string;
  price?: number;
  discounted_price?: number;
  options?: MenuOption[];
  is_available?: boolean;
  is_popular?: boolean;
  is_new?: boolean;
  stock_quantity?: number;
  display_order?: number;
}

// src/services/menu.service.ts
import { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import { Database, transaction } from '../database';
import { S3Service } from './s3.service';
import { Menu, CreateMenuDTO, UpdateMenuDTO, MenuOption } from '../types/menu.types';
import { AppError } from '../utils/appError';
import { logger } from '../utils/logger';
import { Cache } from './redis.service';

export class MenuService {
  private db: Knex;
  private s3Service: S3Service;

  constructor() {
    this.db = Database.getConnection();
    this.s3Service = new S3Service();
  }

  // 메뉴 목록 조회
  async getMenusByStore(
    storeId: string,
    filters?: {
      category?: string;
      isAvailable?: boolean;
      isPopular?: boolean;
      isNew?: boolean;
    }
  ): Promise<Menu[]> {
    let query = this.db('menus')
      .where('store_id', storeId)
      .orderBy('display_order', 'asc')
      .orderBy('created_at', 'desc');

    if (filters?.category) {
      query = query.where('category_name', filters.category);
    }

    if (filters?.isAvailable !== undefined) {
      query = query.where('is_available', filters.isAvailable);
    }

    if (filters?.isPopular !== undefined) {
      query = query.where('is_popular', filters.isPopular);
    }

    if (filters?.isNew !== undefined) {
      query = query.where('is_new', filters.isNew);
    }

    const menus = await query;

    // JSON 옵션 파싱
    return menus.map(menu => ({
      ...menu,
      options: menu.options ? JSON.parse(menu.options) : null,
    }));
  }

  // 메뉴 상세 조회
  async getMenuById(menuId: string): Promise<Menu | null> {
    const menu = await this.db('menus')
      .where('id', menuId)
      .first();

    if (!menu) {
      return null;
    }

    return {
      ...menu,
      options: menu.options ? JSON.parse(menu.options) : null,
    };
  }

  // 메뉴 생성
  async createMenu(data: CreateMenuDTO, imageFile?: Express.Multer.File): Promise<Menu> {
    return transaction(async (trx) => {
      // 이미지 업로드
      let imageUrl: string | undefined;
      if (imageFile) {
        imageUrl = await this.uploadMenuImage(data.store_id, imageFile);
      }

      // 표시 순서 자동 설정 (없으면 마지막)
      if (data.display_order === undefined) {
        const maxOrder = await trx('menus')
          .where('store_id', data.store_id)
          .max('display_order as max')
          .first();
        
        data.display_order = (maxOrder?.max || 0) + 1;
      }

      // 메뉴 생성
      const menuId = uuidv4();
      const [menu] = await trx('menus')
        .insert({
          id: menuId,
          store_id: data.store_id,
          category_name: data.category_name,
          name: data.name,
          description: data.description,
          price: data.price,
          discounted_price: data.discounted_price,
          options: data.options ? JSON.stringify(data.options) : null,
          image_url: imageUrl,
          is_available: data.is_available ?? true,
          is_popular: data.is_popular ?? false,
          is_new: data.is_new ?? false,
          stock_quantity: data.stock_quantity,
          display_order: data.display_order,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('*');

      // 캐시 무효화
      await this.invalidateMenuCache(data.store_id);

      return {
        ...menu,
        options: menu.options ? JSON.parse(menu.options) : null,
      };
    });
  }

  // 메뉴 수정
  async updateMenu(
    menuId: string,
    data: UpdateMenuDTO,
    imageFile?: Express.Multer.File
  ): Promise<Menu> {
    return transaction(async (trx) => {
      // 기존 메뉴 확인
      const existingMenu = await trx('menus')
        .where('id', menuId)
        .first();

      if (!existingMenu) {
        throw new AppError('메뉴를 찾을 수 없습니다.', 404);
      }

      // 이미지 업로드
      let imageUrl = existingMenu.image_url;
      if (imageFile) {
        // 기존 이미지 삭제
        if (existingMenu.image_url) {
          await this.s3Service.deleteFile(existingMenu.image_url);
        }
        imageUrl = await this.uploadMenuImage(existingMenu.store_id, imageFile);
      }

      // 메뉴 업데이트
      const updateData: any = {
        ...data,
        image_url: imageUrl,
        updated_at: new Date(),
      };

      // 옵션 JSON 변환
      if (data.options !== undefined) {
        updateData.options = data.options ? JSON.stringify(data.options) : null;
      }

      const [updatedMenu] = await trx('menus')
        .where('id', menuId)
        .update(updateData)
        .returning('*');

      // 캐시 무효화
      await this.invalidateMenuCache(existingMenu.store_id);

      return {
        ...updatedMenu,
        options: updatedMenu.options ? JSON.parse(updatedMenu.options) : null,
      };
    });
  }

  // 메뉴 삭제
  async deleteMenu(menuId: string): Promise<void> {
    return transaction(async (trx) => {
      const menu = await trx('menus')
        .where('id', menuId)
        .first();

      if (!menu) {
        throw new AppError('메뉴를 찾을 수 없습니다.', 404);
      }

      // 이미지 삭제
      if (menu.image_url) {
        await this.s3Service.deleteFile(menu.image_url);
      }

      // 메뉴 삭제
      await trx('menus')
        .where('id', menuId)
        .delete();

      // 표시 순서 재정렬
      await this.reorderMenus(trx, menu.store_id);

      // 캐시 무효화
      await this.invalidateMenuCache(menu.store_id);
    });
  }

  // 메뉴 순서 변경
  async updateMenuOrder(
    storeId: string,
    menuOrders: { menuId: string; order: number }[]
  ): Promise<void> {
    return transaction(async (trx) => {
      // 순서 업데이트
      for (const { menuId, order } of menuOrders) {
        await trx('menus')
          .where({ id: menuId, store_id: storeId })
          .update({ display_order: order });
      }

      // 캐시 무효화
      await this.invalidateMenuCache(storeId);
    });
  }

  // 메뉴 재고 업데이트
  async updateStock(menuId: string, quantity: number): Promise<void> {
    const result = await this.db('menus')
      .where('id', menuId)
      .update({
        stock_quantity: quantity,
        updated_at: new Date(),
      });

    if (!result) {
      throw new AppError('메뉴를 찾을 수 없습니다.', 404);
    }

    // 재고가 0이 되면 판매 불가로 변경
    if (quantity === 0) {
      await this.db('menus')
        .where('id', menuId)
        .update({ is_available: false });
    }
  }

  // 메뉴 일괄 상태 변경
  async bulkUpdateStatus(
    storeId: string,
    menuIds: string[],
    status: { isAvailable?: boolean; isPopular?: boolean; isNew?: boolean }
  ): Promise<void> {
    await this.db('menus')
      .whereIn('id', menuIds)
      .where('store_id', storeId)
      .update({
        ...status,
        updated_at: new Date(),
      });

    // 캐시 무효화
    await this.invalidateMenuCache(storeId);
  }

  // 메뉴 카테고리 목록 조회
  async getMenuCategories(storeId: string): Promise<string[]> {
    const categories = await this.db('menus')
      .where('store_id', storeId)
      .whereNotNull('category_name')
      .distinct('category_name')
      .orderBy('category_name');

    return categories.map(c => c.category_name);
  }

  // 메뉴 복사
  async duplicateMenu(menuId: string): Promise<Menu> {
    return transaction(async (trx) => {
      const originalMenu = await trx('menus')
        .where('id', menuId)
        .first();

      if (!originalMenu) {
        throw new AppError('메뉴를 찾을 수 없습니다.', 404);
      }

      const newMenuId = uuidv4();
      const [newMenu] = await trx('menus')
        .insert({
          ...originalMenu,
          id: newMenuId,
          name: `${originalMenu.name} (복사본)`,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('*');

      // 캐시 무효화
      await this.invalidateMenuCache(originalMenu.store_id);

      return {
        ...newMenu,
        options: newMenu.options ? JSON.parse(newMenu.options) : null,
      };
    });
  }

  // 권한 확인
  async checkMenuPermission(
    menuId: string,
    userId: string,
    userRole: string
  ): Promise<boolean> {
    if (userRole === 'admin' || userRole === 'super_admin') {
      return true;
    }

    const menu = await this.db('menus as m')
      .join('stores as s', 'm.store_id', 's.id')
      .where('m.id', menuId)
      .where('s.owner_id', userId)
      .first();

    return !!menu;
  }

  // 이미지 업로드
  private async uploadMenuImage(
    storeId: string,
    file: Express.Multer.File
  ): Promise<string> {
    const key = `stores/${storeId}/menus/${uuidv4()}-${file.originalname}`;
    const url = await this.s3Service.uploadFile(file, key);
    return url;
  }

  // 메뉴 순서 재정렬
  private async reorderMenus(trx: Knex.Transaction, storeId: string): Promise<void> {
    const menus = await trx('menus')
      .where('store_id', storeId)
      .orderBy('display_order', 'asc')
      .select('id');

    for (let i = 0; i < menus.length; i++) {
      await trx('menus')
        .where('id', menus[i].id)
        .update({ display_order: i + 1 });
    }
  }

  // 캐시 무효화
  private async invalidateMenuCache(storeId: string): Promise<void> {
    await Cache.invalidate(`menus:store:${storeId}:*`);
  }

  // 옵션 유효성 검사
  validateMenuOptions(options: MenuOption[]): boolean {
    for (const option of options) {
      if (!option.name || !option.choices || option.choices.length === 0) {
        return false;
      }

      for (const choice of option.choices) {
        if (!choice.name || choice.price === undefined) {
          return false;
        }
      }

      // 기본 선택이 여러 개인지 확인
      const defaultChoices = option.choices.filter(c => c.is_default);
      if (defaultChoices.length > (option.max_select || 1)) {
        return false;
      }
    }

    return true;
  }
}

// src/routes/menu.routes.ts
import { Router } from 'express';
import { MenuController } from '../controllers/menu.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validate, validateParams } from '../middlewares/validation';
import { menuSchemas } from '../validations/menu.validation';
import { upload } from '../middlewares/upload';

const router = Router();
const menuController = new MenuController();

// 상점별 메뉴 목록 조회 (공개)
router.get(
  '/stores/:storeId/menus',
  validateParams(menuSchemas.storeId),
  menuController.getMenusByStore
);

// 메뉴 상세 조회 (공개)
router.get(
  '/:menuId',
  validateParams(menuSchemas.menuId),
  menuController.getMenu
);

// 메뉴 카테고리 목록 조회 (공개)
router.get(
  '/stores/:storeId/categories',
  validateParams(menuSchemas.storeId),
  menuController.getMenuCategories
);

// 메뉴 생성 (인증 필요)
router.post(
  '/',
  authenticate,
  authorize('store_owner', 'admin'),
  upload.single('image'),
  validate(menuSchemas.createMenu),
  menuController.createMenu
);

// 메뉴 수정 (인증 필요)
router.put(
  '/:menuId',
  authenticate,
  authorize('store_owner', 'admin'),
  upload.single('image'),
  validateParams(menuSchemas.menuId),
  validate(menuSchemas.updateMenu),
  menuController.updateMenu
);

// 메뉴 삭제 (인증 필요)
router.delete(
  '/:menuId',
  authenticate,
  authorize('store_owner', 'admin'),
  validateParams(menuSchemas.menuId),
  menuController.deleteMenu
);

// 메뉴 순서 변경 (인증 필요)
router.put(
  '/stores/:storeId/order',
  authenticate,
  authorize('store_owner', 'admin'),
  validateParams(menuSchemas.storeId),
  validate(menuSchemas.updateMenuOrder),
  menuController.updateMenuOrder
);

// 메뉴 재고 업데이트 (인증 필요)
router.patch(
  '/:menuId/stock',
  authenticate,
  authorize('store_owner', 'admin'),
  validateParams(menuSchemas.menuId),
  validate(menuSchemas.updateStock),
  menuController.updateStock
);

// 메뉴 일괄 상태 변경 (인증 필요)
router.patch(
  '/stores/:storeId/bulk-status',
  authenticate,
  authorize('store_owner', 'admin'),
  validateParams(menuSchemas.storeId),
  validate(menuSchemas.bulkUpdateStatus),
  menuController.bulkUpdateStatus
);

// 메뉴 복사 (인증 필요)
router.post(
  '/:menuId/duplicate',
  authenticate,
  authorize('store_owner', 'admin'),
  validateParams(menuSchemas.menuId),
  menuController.duplicateMenu
);

// 메뉴 이미지 삭제 (인증 필요)
router.delete(
  '/:menuId/image',
  authenticate,
  authorize('store_owner', 'admin'),
  validateParams(menuSchemas.menuId),
  menuController.deleteMenuImage
);

export const menuRouter = router;

// src/controllers/menu.controller.ts
import { Request, Response } from 'express';
import { MenuService } from '../services/menu.service';
import { AuthRequest } from '../middlewares/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/appError';
import { Cache } from '../services/redis.service';
import { logger } from '../utils/logger';

export class MenuController {
  private menuService: MenuService;

  constructor() {
    this.menuService = new MenuService();
  }

  // 상점별 메뉴 목록 조회
  getMenusByStore = asyncHandler(async (req: Request, res: Response) => {
    const { storeId } = req.params;
    const { category, available, popular, new: isNew } = req.query;

    // 캐시 확인
    const cacheKey = `menus:store:${storeId}:${JSON.stringify(req.query)}`;
    const cached = await Cache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    const filters = {
      category: category as string,
      isAvailable: available === 'true' ? true : available === 'false' ? false : undefined,
      isPopular: popular === 'true' ? true : popular === 'false' ? false : undefined,
      isNew: isNew === 'true' ? true : isNew === 'false' ? false : undefined,
    };

    const menus = await this.menuService.getMenusByStore(storeId, filters);

    const result = {
      data: menus,
      meta: {
        total: menus.length,
        storeId,
      },
    };

    // 캐시 저장 (5분)
    await Cache.set(cacheKey, result, 300);

    res.json(result);
  });

  // 메뉴 상세 조회
  getMenu = asyncHandler(async (req: Request, res: Response) => {
    const { menuId } = req.params;

    const menu = await this.menuService.getMenuById(menuId);

    if (!menu) {
      throw new AppError('메뉴를 찾을 수 없습니다.', 404);
    }

    res.json({ data: menu });
  });

  // 메뉴 생성
  createMenu = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const menuData = req.body;
    const imageFile = req.file;

    // 상점 소유권 확인
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      const hasPermission = await this.checkStoreOwnership(
        menuData.store_id,
        userId
      );
      
      if (!hasPermission) {
        throw new AppError('이 상점의 메뉴를 생성할 권한이 없습니다.', 403);
      }
    }

    // 옵션 유효성 검사
    if (menuData.options) {
      const isValid = this.menuService.validateMenuOptions(menuData.options);
      if (!isValid) {
        throw new AppError('메뉴 옵션 형식이 올바르지 않습니다.', 400);
      }
    }

    const menu = await this.menuService.createMenu(menuData, imageFile);

    res.status(201).json({
      message: '메뉴가 생성되었습니다.',
      data: menu,
    });
  });

  // 메뉴 수정
  updateMenu = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { menuId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const updateData = req.body;
    const imageFile = req.file;

    // 권한 확인
    const hasPermission = await this.menuService.checkMenuPermission(
      menuId,
      userId,
      userRole
    );

    if (!hasPermission) {
      throw new AppError('메뉴를 수정할 권한이 없습니다.', 403);
    }

    // 옵션 유효성 검사
    if (updateData.options) {
      const isValid = this.menuService.validateMenuOptions(updateData.options);
      if (!isValid) {
        throw new AppError('메뉴 옵션 형식이 올바르지 않습니다.', 400);
      }
    }

    const menu = await this.menuService.updateMenu(menuId, updateData, imageFile);

    res.json({
      message: '메뉴가 수정되었습니다.',
      data: menu,
    });
  });

  // 메뉴 삭제
  deleteMenu = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { menuId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // 권한 확인
    const hasPermission = await this.menuService.checkMenuPermission(
      menuId,
      userId,
      userRole
    );

    if (!hasPermission) {
      throw new AppError('메뉴를 삭제할 권한이 없습니다.', 403);
    }

    await this.menuService.deleteMenu(menuId);

    res.json({
      message: '메뉴가 삭제되었습니다.',
    });
  });

  // 메뉴 순서 변경
  updateMenuOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { storeId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { menuOrders } = req.body;

    // 상점 소유권 확인
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      const hasPermission = await this.checkStoreOwnership(storeId, userId);
      
      if (!hasPermission) {
        throw new AppError('이 상점의 메뉴 순서를 변경할 권한이 없습니다.', 403);
      }
    }

    await this.menuService.updateMenuOrder(storeId, menuOrders);

    res.json({
      message: '메뉴 순서가 변경되었습니다.',
    });
  });

  // 메뉴 재고 업데이트
  updateStock = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { menuId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { quantity } = req.body;

    // 권한 확인
    const hasPermission = await this.menuService.checkMenuPermission(
      menuId,
      userId,
      userRole
    );

    if (!hasPermission) {
      throw new AppError('메뉴 재고를 수정할 권한이 없습니다.', 403);
    }

    await this.menuService.updateStock(menuId, quantity);

    res.json({
      message: '재고가 업데이트되었습니다.',
    });
  });

  // 메뉴 일괄 상태 변경
  bulkUpdateStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { storeId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { menuIds, status } = req.body;

    // 상점 소유권 확인
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      const hasPermission = await this.checkStoreOwnership(storeId, userId);
      
      if (!hasPermission) {
        throw new AppError('이 상점의 메뉴를 수정할 권한이 없습니다.', 403);
      }
    }

    await this.menuService.bulkUpdateStatus(storeId, menuIds, status);

    res.json({
      message: '메뉴 상태가 일괄 변경되었습니다.',
    });
  });

  // 메뉴 카테고리 목록 조회
  getMenuCategories = asyncHandler(async (req: Request, res: Response) => {
    const { storeId } = req.params;

    const categories = await this.menuService.getMenuCategories(storeId);

    res.json({
      data: categories,
    });
  });

  // 메뉴 복사
  duplicateMenu = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { menuId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // 권한 확인
    const hasPermission = await this.menuService.checkMenuPermission(
      menuId,
      userId,
      userRole
    );

    if (!hasPermission) {
      throw new AppError('메뉴를 복사할 권한이 없습니다.', 403);
    }

    const newMenu = await this.menuService.duplicateMenu(menuId);

    res.status(201).json({
      message: '메뉴가 복사되었습니다.',
      data: newMenu,
    });
  });

  // 메뉴 이미지 삭제
  deleteMenuImage = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { menuId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // 권한 확인
    const hasPermission = await this.menuService.checkMenuPermission(
      menuId,
      userId,
      userRole
    );

    if (!hasPermission) {
      throw new AppError('메뉴 이미지를 삭제할 권한이 없습니다.', 403);
    }

    await this.menuService.updateMenu(menuId, { image_url: null });

    res.json({
      message: '메뉴 이미지가 삭제되었습니다.',
    });
  });

  // 상점 소유권 확인
  private async checkStoreOwnership(
    storeId: string,
    userId: string
  ): Promise<boolean> {
    const db = Database.getConnection();
    const store = await db('stores')
      .where({ id: storeId, owner_id: userId })
      .first();
    
    return !!store;
  }
}

// src/validations/menu.validation.ts
import joi from 'joi';

// 메뉴 옵션 스키마
const menuOptionSchema = joi.object({
  name: joi.string().max(100).required(),
  choices: joi.array().items(
    joi.object({
      name: joi.string().max(100).required(),
      price: joi.number().min(0).required(),
      is_default: joi.boolean(),
    })
  ).min(1).required(),
  required: joi.boolean(),
  max_select: joi.number().min(1),
});

export const menuSchemas = {
  // 파라미터
  storeId: joi.object({
    storeId: joi.string().uuid().required(),
  }),

  menuId: joi.object({
    menuId: joi.string().uuid().required(),
  }),

  // 메뉴 생성
  createMenu: joi.object({
    store_id: joi.string().uuid().required(),
    category_name: joi.string().max(100),
    name: joi.string().max(200).required(),
    description: joi.string().max(1000),
    price: joi.number().min(0).required(),
    discounted_price: joi.number().min(0).less(joi.ref('price')),
    options: joi.array().items(menuOptionSchema),
    is_available: joi.boolean(),
    is_popular: joi.boolean(),
    is_new: joi.boolean(),
    stock_quantity: joi.number().min(0),
    display_order: joi.number().min(0),
  }),

  // 메뉴 수정
  updateMenu: joi.object({
    category_name: joi.string().max(100),
    name: joi.string().max(200),
    description: joi.string().max(1000),
    price: joi.number().min(0),
    discounted_price: joi.number().min(0),
    options: joi.array().items(menuOptionSchema),
    is_available: joi.boolean(),
    is_popular: joi.boolean(),
    is_new: joi.boolean(),
    stock_quantity: joi.number().min(0),
    display_order: joi.number().min(0),
  }).min(1),

  // 메뉴 순서 변경
  updateMenuOrder: joi.object({
    menuOrders: joi.array().items(
      joi.object({
        menuId: joi.string().uuid().required(),
        order: joi.number().min(0).required(),
      })
    ).min(1).required(),
  }),

  // 재고 업데이트
  updateStock: joi.object({
    quantity: joi.number().min(0).required(),
  }),

  // 일괄 상태 변경
  bulkUpdateStatus: joi.object({
    menuIds: joi.array().items(joi.string().uuid()).min(1).required(),
    status: joi.object({
      is_available: joi.boolean(),
      is_popular: joi.boolean(),
      is_new: joi.boolean(),
    }).min(1),
  }),
};

// src/services/s3.service.ts
import AWS from 'aws-sdk';
import { config } from '../config';
import { AppError } from '../utils/appError';
import { logger } from '../utils/logger';

export class S3Service {
  private s3: AWS.S3;
  private bucketName: string;

  constructor() {
    this.s3 = new AWS.S3({
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey,
      region: config.aws.region,
    });
    this.bucketName = config.aws.s3Bucket;
  }

  // 파일 업로드
  async uploadFile(file: Express.Multer.File, key: string): Promise<string> {
    try {
      const params: AWS.S3.PutObjectRequest = {
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read',
      };

      const result = await this.s3.upload(params).promise();
      return result.Location;
    } catch (error) {
      logger.error('S3 upload error:', error);
      throw new AppError('파일 업로드에 실패했습니다.', 500);
    }
  }

  // 파일 삭제
  async deleteFile(url: string): Promise<void> {
    try {
      // URL에서 키 추출
      const key = this.extractKeyFromUrl(url);
      
      if (!key) return;

      const params: AWS.S3.DeleteObjectRequest = {
        Bucket: this.bucketName,
        Key: key,
      };

      await this.s3.deleteObject(params).promise();
    } catch (error) {
      logger.error('S3 delete error:', error);
      // 삭제 실패해도 계속 진행
    }
  }

  // URL에서 S3 키 추출
  private extractKeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;
      return path.startsWith('/') ? path.substring(1) : path;
    } catch {
      return null;
    }
  }
}

// src/middlewares/upload.ts
import multer from 'multer';
import { AppError } from '../utils/appError';

// 메모리 스토리지 사용 (S3 업로드를 위해)
const storage = multer.memoryStorage();

// 파일 필터
const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // 이미지 파일만 허용
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/avif',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('이미지 파일만 업로드 가능합니다.', 400));
  }
};

// 파일 크기 제한 (5MB)
const limits = {
  fileSize: 5 * 1024 * 1024, // 5MB
};

export const upload = multer({
  storage,
  fileFilter,
  limits,
});