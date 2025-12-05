import { 
  Appointment, Product, Category, Order, Coupon, AdminConfig, ServiceItem 
} from '../types';
import { db } from './firebase';
import { 
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, where, writeBatch 
} from 'firebase/firestore';

// Collection Names
const C = {
  CONFIG: 'config', // doc id: 'main'
  APPOINTMENTS: 'appointments',
  PRODUCTS: 'products',
  CATEGORIES: 'categories',
  ORDERS: 'orders',
  COUPONS: 'coupons',
  SERVICES: 'services'
};

// --- Helpers ---
export const generateId = () => doc(collection(db, 'dummy')).id; // Use Firestore auto-id logic
export const simpleHash = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString();
};

// --- Service ---

export const StorageService = {
  
  // --- CONFIG (Single Document) ---
  getConfig: async (): Promise<AdminConfig> => {
    try {
      const ref = doc(db, C.CONFIG, 'main');
      const snap = await getDoc(ref);
      if (snap.exists()) return snap.data() as AdminConfig;
      
      // Default Config if not exists
      const defaultConf: AdminConfig = {
        logoBase64: '',
        primaryColor: '#111827',
        accentColor: '#D97706',
        adminEmail: 'admin@admin',
        adminPassHash: simpleHash('admin'),
        closedDates: []
      };
      // Create it
      await setDoc(ref, defaultConf);
      return defaultConf;
    } catch (e) {
      console.error("Erro ao obter config:", e);
      // Fallback local em caso de erro de rede/api key faltando
      return { logoBase64: '', primaryColor: '#111827', accentColor: '#D97706', adminEmail: 'admin@admin', adminPassHash: '0', closedDates: [] };
    }
  },

  saveConfig: async (config: AdminConfig) => {
    await setDoc(doc(db, C.CONFIG, 'main'), config);
  },

  // --- SERVICES (New) ---
  getServices: async (): Promise<ServiceItem[]> => {
    const snap = await getDocs(collection(db, C.SERVICES));
    let list = snap.docs.map(d => ({ ...d.data(), id: d.id } as ServiceItem));
    
    if (list.length === 0) {
        // Seed default services
        const defaults: ServiceItem[] = [
            { id: generateId(), name: 'Corte de Cabelo', price: 25, icon: 'cut', active: true },
            { id: generateId(), name: 'Barba', price: 15, icon: 'user-tie', active: true },
            { id: generateId(), name: 'Pé de Cabelo', price: 10, icon: 'shoe-prints', active: true },
        ];
        const batch = writeBatch(db);
        defaults.forEach(s => {
            const ref = doc(collection(db, C.SERVICES));
            batch.set(ref, {...s, id: ref.id});
        });
        await batch.commit();
        // Return defaults with new IDs (approximation, usually requires re-fetch)
        list = defaults; 
        // Force re-fetch to get correct IDs
        const newSnap = await getDocs(collection(db, C.SERVICES));
        list = newSnap.docs.map(d => ({ ...d.data(), id: d.id } as ServiceItem));
    }
    return list;
  },

  subscribeServices: (callback: (data: ServiceItem[]) => void) => {
      return onSnapshot(collection(db, C.SERVICES), (snap) => {
          callback(snap.docs.map(d => ({...d.data(), id: d.id} as ServiceItem)));
      });
  },

  saveService: async (service: ServiceItem) => {
      const { id, ...data } = service;
      if (id) {
          await setDoc(doc(db, C.SERVICES, id), data);
      } else {
          await addDoc(collection(db, C.SERVICES), data);
      }
  },

  deleteService: async (id: string) => {
      await deleteDoc(doc(db, C.SERVICES, id));
  },

  // --- APPOINTMENTS ---
  // Realtime Listener
  subscribeAppointments: (callback: (data: Appointment[]) => void) => {
    const q = query(collection(db, C.APPOINTMENTS), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as Appointment));
      callback(list);
    });
  },

  getAppointmentsOnce: async (): Promise<Appointment[]> => {
    const q = query(collection(db, C.APPOINTMENTS), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Appointment));
  },

  // NEW: Get appointments by date to check availability
  getAppointmentsByDate: async (date: string): Promise<Appointment[]> => {
    const q = query(collection(db, C.APPOINTMENTS), where('date', '==', date));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Appointment));
  },

  saveAppointment: async (appt: Appointment) => {
    // Firestore creates ID automatically if using addDoc, but we want to handle the ID object
    const { id, ...data } = appt; 
    // If ID is provided manually in object
    await setDoc(doc(db, C.APPOINTMENTS, id), data);
  },

  updateAppointment: async (appt: Appointment) => {
    const { id, ...data } = appt;
    await updateDoc(doc(db, C.APPOINTMENTS, id), data as any);
  },

  // --- PRODUCTS ---
  getProducts: async (): Promise<Product[]> => {
    const snap = await getDocs(collection(db, C.PRODUCTS));
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Product));
  },

  subscribeProducts: (callback: (data: Product[]) => void) => {
      return onSnapshot(collection(db, C.PRODUCTS), (snap) => {
          callback(snap.docs.map(d => ({...d.data(), id: d.id} as Product)));
      });
  },

  saveProduct: async (prod: Product) => {
    const { id, ...data } = prod;
    await setDoc(doc(db, C.PRODUCTS, id), data);
  },

  updateStock: async (items: {id: string, qty: number}[]) => {
    const batch = writeBatch(db);
    for (const item of items) {
        const ref = doc(db, C.PRODUCTS, item.id);
        const snap = await getDoc(ref);
        if(snap.exists()) {
            const current = snap.data().stock || 0;
            batch.update(ref, { stock: Math.max(0, current - item.qty) });
        }
    }
    await batch.commit();
  },

  // --- CATEGORIES ---
  getCategories: async (): Promise<Category[]> => {
    const snap = await getDocs(collection(db, C.CATEGORIES));
    let list = snap.docs.map(d => ({ ...d.data(), id: d.id } as Category));
    if (list.length === 0) {
        // Seed default requested categories
        const defaults = [
            { id: 'barbearia', name: 'Produto de Barbearia' },
            { id: 'roupas', name: 'Produto da Loja de Roupas' }
        ];
        for(const c of defaults) await setDoc(doc(db, C.CATEGORIES, c.id), c);
        list = defaults;
    }
    return list;
  },

  // --- ORDERS ---
  subscribeOrders: (callback: (data: Order[]) => void) => {
    const q = query(collection(db, C.ORDERS), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as Order)));
    });
  },

  saveOrder: async (order: Order) => {
    const { id, ...data } = order;
    await setDoc(doc(db, C.ORDERS, id), data);
  },

  updateOrder: async (order: Order) => {
    const { id, ...data } = order;
    await updateDoc(doc(db, C.ORDERS, id), data as any);
  },

  // --- COUPONS ---
  getCoupons: async (): Promise<Coupon[]> => {
      const snap = await getDocs(collection(db, C.COUPONS));
      if (snap.empty) {
          const def = { code: 'BEMVINDO', percent: 20, active: true };
          await addDoc(collection(db, C.COUPONS), def);
          return [def];
      }
      return snap.docs.map(d => d.data() as Coupon);
  }
};