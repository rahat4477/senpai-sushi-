export interface Category {
  id: string;
  name: string;
  icon: string;
  fixedPrice?: number;
  isIndividualPricing: boolean;
  conditions?: string;
  showPopup?: boolean;
  availableDays?: string[];
  startTime?: string;
  endTime?: string;
}

export interface MenuGroup {
  id: string;
  name: string;
  order: number;
}

export interface MenuItem {
  id: string;
  categoryId: string; // Legacy support
  categoryIds?: string[]; // Multiple categories
  groupId?: string; // Group within category
  name: string;
  price: number;
  description: string;
  imageUrl: string;
  visible?: boolean;
  allergies?: string[];
  customizationCategories?: string[]; // IDs of IngredientCategory
  hasCustomization?: boolean;
  selectedIngredientIds?: string[];
}

export interface Ingredient {
  id: string;
  name: string;
  price: number;
  available: boolean;
}

export interface IngredientCategory {
  id: string;
  name: string; // e.g., "Toppings", "Proteins"
  minSelection: number;
  maxSelection: number;
  ingredients: Ingredient[];
}

export interface CartItem extends MenuItem {
  quantity: number;
  selectedIngredients?: {
    [categoryId: string]: string[]; // categoryId -> ingredient names/ids
  };
}

export interface Allergy {
  id: string;
  name: string;
  description?: string;
  icon: string; // Emoji or image URL
}

export interface CustomizationLabel {
  id: string;
  name: string;
}

export interface Table {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export type OrderStatus = 'pending' | 'preparing' | 'done' | 'cancelled';

export interface Order {
  id: string;
  tableNumber: string | number;
  tableName?: string;
  items: {
    id: string;
    name: string;
    price: number;
    quantity: number;
  }[];
  total: number;
  status: OrderStatus;
  createdAt: string;
}

export interface Printer {
  id: string;
  name: string;
  ip: string;
  port: number;
  type: 'thermal' | 'dotmatrix' | 'usb';
  serialNumber?: string;
  macAddress?: string;
  cloudId?: string;
  isDefault: boolean;
}

export interface Staff {
  id: string;
  name: string;
  role: 'admin' | 'kitchen' | 'waiter';
  email: string;
  active: boolean;
}

export interface SystemSettings {
  version: string;
  lastUpdate: string;
}

export interface SiteSettings {
  id?: string;
  siteName: string;
  logo: string;
  favicon: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  footerText: string;
}
