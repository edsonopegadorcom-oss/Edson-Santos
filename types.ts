export enum ServiceType {
  HAIRCUT = 'Corte de Cabelo',
  BEARD = 'Barba',
  FOOT = 'Pé de Cabelo',
  TATTOO = 'Tatuagem'
}

export enum AppointmentStatus {
  PENDING = 'PENDENTE',
  CONFIRMED = 'CONFIRMADO',
  CANCELLED = 'CANCELADO'
}

export enum OrderStatus {
  PENDING = 'PENDENTE',
  CONFIRMED = 'CONFIRMADO',
  DELIVERED = 'ENTREGUE',
  CANCELLED = 'CANCELADO'
}

export interface Appointment {
  id: string;
  serviceId: string; // ServiceType or 'custom-tattoo'
  serviceName: string;
  price: number;
  name: string;
  phone: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  status: AppointmentStatus;
  tattooBase64?: string;
  tattooSize?: string;
  tattooLocation?: string;
  notes?: string;
  createdAt: number;
}

export interface Category {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  imageBase64: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Order {
  id: string;
  items: CartItem[];
  clientName: string;
  phone: string;
  delivery: boolean; // true = delivery, false = pickup
  deliveryFee: number;
  address?: {
    neighborhood: string;
    street: string;
    number: string;
    reference: string;
  };
  paymentMethod: 'money' | 'card' | 'pix';
  changeFor?: number;
  subtotal: number;
  discount: number;
  total: number;
  couponCode?: string;
  status: OrderStatus;
  createdAt: number;
}

export interface Coupon {
  code: string;
  percent: number; // 20, 30, 40
  active: boolean;
}

export interface AdminConfig {
  logoBase64: string;
  primaryColor: string;
  accentColor: string;
  adminEmail: string;
  adminPassHash: string; // Simple hash for demo
  closedDates: string[];
}

export interface DashboardStats {
  daily: number;
  weekly: number;
  monthly: number;
}