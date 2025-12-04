import { 
  Appointment, Product, Category, Order, Coupon, AdminConfig, 
  ServiceType, AppointmentStatus 
} from '../types';

// Keys
const K = {
  ADMIN: 'lt_admin',
  APPOINTMENTS: 'lt_appointments',
  PRODUCTS: 'lt_products',
  CATEGORIES: 'lt_categories',
  ORDERS: 'lt_orders',
  COUPONS: 'lt_coupons',
  CLOSED_DATES: 'lt_closed_dates' // Kept separate or inside admin, user req says separate logic, but admin config has it too. We will sync.
};

// --- Helpers ---

// Generate ID: Timestamp + Random string
export const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// Simple hash for demo (NOT SECURE FOR PROD)
export const simpleHash = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString();
};

// Seed Data
const seedData = () => {
  if (!localStorage.getItem(K.ADMIN)) {
    const defaultAdmin: AdminConfig = {
      logoBase64: '', // Empty means default text
      primaryColor: '#0f0f0f', // Deep Black
      accentColor: '#dc2626', // Red-600
      adminEmail: 'admin@admin',
      adminPassHash: simpleHash('admin'),
      closedDates: []
    };
    localStorage.setItem(K.ADMIN, JSON.stringify(defaultAdmin));
  }

  if (!localStorage.getItem(K.CATEGORIES)) {
    const cats: Category[] = [
      { id: 'c1', name: 'Piercing' },
      { id: 'c2', name: 'Aftercare' },
      { id: 'c3', name: 'Merch' }
    ];
    localStorage.setItem(K.CATEGORIES, JSON.stringify(cats));
  }

  if (!localStorage.getItem(K.PRODUCTS)) {
    const prods: Product[] = [
      { id: 'p1', categoryId: 'c2', name: 'Pomada Cicatrizante', description: 'Para melhor cicatrização da sua tattoo.', price: 15.00, stock: 20, imageBase64: '' },
      { id: 'p2', categoryId: 'c1', name: 'Piercing Básico Titânio', description: 'Joia de alta qualidade.', price: 40.00, stock: 10, imageBase64: '' }
    ];
    localStorage.setItem(K.PRODUCTS, JSON.stringify(prods));
  }
  
  if (!localStorage.getItem(K.COUPONS)) {
      const coupons: Coupon[] = [
          { code: 'BEMVINDO', percent: 20, active: true }
      ];
      localStorage.setItem(K.COUPONS, JSON.stringify(coupons));
  }
  
  if (!localStorage.getItem(K.APPOINTMENTS)) localStorage.setItem(K.APPOINTMENTS, JSON.stringify([]));
  if (!localStorage.getItem(K.ORDERS)) localStorage.setItem(K.ORDERS, JSON.stringify([]));
};

// Initialize
seedData();

// --- CRUD ---

export const StorageService = {
  // Admin & Config
  getConfig: (): AdminConfig => JSON.parse(localStorage.getItem(K.ADMIN) || '{}'),
  saveConfig: (config: AdminConfig) => localStorage.setItem(K.ADMIN, JSON.stringify(config)),
  
  // Appointments
  getAppointments: (): Appointment[] => JSON.parse(localStorage.getItem(K.APPOINTMENTS) || '[]'),
  saveAppointment: (appt: Appointment) => {
    /* BACKEND MIGRATION: Replace with POST /api/appointments */
    const list = StorageService.getAppointments();
    list.push(appt);
    localStorage.setItem(K.APPOINTMENTS, JSON.stringify(list));
  },
  updateAppointment: (updated: Appointment) => {
    /* BACKEND MIGRATION: Replace with PUT /api/appointments/:id */
    const list = StorageService.getAppointments().map(a => a.id === updated.id ? updated : a);
    localStorage.setItem(K.APPOINTMENTS, JSON.stringify(list));
  },
  
  // Products & Cats
  getProducts: (): Product[] => JSON.parse(localStorage.getItem(K.PRODUCTS) || '[]'),
  getCategories: (): Category[] => JSON.parse(localStorage.getItem(K.CATEGORIES) || '[]'),
  saveProduct: (prod: Product) => {
      const list = StorageService.getProducts();
      const idx = list.findIndex(p => p.id === prod.id);
      if (idx >= 0) list[idx] = prod;
      else list.push(prod);
      localStorage.setItem(K.PRODUCTS, JSON.stringify(list));
  },
  saveCategory: (cat: Category) => {
      const list = StorageService.getCategories();
      list.push(cat);
      localStorage.setItem(K.CATEGORIES, JSON.stringify(list));
  },
  updateStock: (items: {id: string, qty: number}[]) => {
      const products = StorageService.getProducts();
      items.forEach(item => {
          const p = products.find(x => x.id === item.id);
          if (p) p.stock = Math.max(0, p.stock - item.qty);
      });
      localStorage.setItem(K.PRODUCTS, JSON.stringify(products));
  },

  // Orders
  getOrders: (): Order[] => JSON.parse(localStorage.getItem(K.ORDERS) || '[]'),
  saveOrder: (order: Order) => {
    /* BACKEND MIGRATION: Replace with POST /api/orders */
    const list = StorageService.getOrders();
    list.push(order);
    localStorage.setItem(K.ORDERS, JSON.stringify(list));
  },
  updateOrder: (updated: Order) => {
    const list = StorageService.getOrders().map(o => o.id === updated.id ? updated : o);
    localStorage.setItem(K.ORDERS, JSON.stringify(list));
  },

  // Coupons
  getCoupons: (): Coupon[] => JSON.parse(localStorage.getItem(K.COUPONS) || '[]'),
  saveCoupon: (coupon: Coupon) => {
      const list = StorageService.getCoupons();
      // overwrite if exists
      const idx = list.findIndex(c => c.code === coupon.code);
      if (idx >= 0) list[idx] = coupon;
      else list.push(coupon);
      localStorage.setItem(K.COUPONS, JSON.stringify(list));
  }
};