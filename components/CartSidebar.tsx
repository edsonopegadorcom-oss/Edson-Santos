import React, { useState } from 'react';
import { CartItem, Coupon } from '../types';
import { StorageService } from '../services/storageService';

interface CartSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  onCheckout: (subtotal: number, discount: number, total: number, couponCode?: string) => void;
}

export const CartSidebar: React.FC<CartSidebarProps> = ({ isOpen, onClose, cart, setCart, onCheckout }) => {
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState('');

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, quantity: Math.max(0, item.quantity + delta) };
      }
      return item;
    }).filter(i => i.quantity > 0));
  };

  const checkCoupon = () => {
    const coupons = StorageService.getCoupons();
    const found = coupons.find(c => c.code.toUpperCase() === couponCode.toUpperCase() && c.active);
    if (found) {
      setAppliedCoupon(found);
      setCouponError('');
    } else {
      setAppliedCoupon(null);
      setCouponError('Cupom inválido ou inativo');
    }
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const discount = appliedCoupon ? (subtotal * (appliedCoupon.percent / 100)) : 0;
  const total = subtotal - discount;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black bg-opacity-70 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-gray-900 text-white w-full max-w-md h-full shadow-2xl flex flex-col animate-slideIn border-l border-gray-800">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-theme-primary text-white">
          <h2 className="text-lg font-bold"><i className="fas fa-shopping-cart mr-2"></i> Carrinho</h2>
          <button onClick={onClose}><i className="fas fa-times hover:text-red-500 transition"></i></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <p className="text-center text-gray-500 mt-10">Seu carrinho está vazio.</p>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2">
                <div>
                  <h4 className="font-semibold text-white">{item.name}</h4>
                  <p className="text-sm text-gray-400">R$ {item.price.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 rounded-full bg-gray-700 text-white hover:bg-gray-600">-</button>
                    <span>{item.quantity}</span>
                    <button onClick={() => updateQty(item.id, 1)} className="w-6 h-6 rounded-full bg-gray-700 text-white hover:bg-gray-600">+</button>
                </div>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="p-4 border-t border-gray-800 bg-gray-900">
            <div className="mb-4">
                <label className="text-sm font-medium text-gray-300">Cupom de Desconto</label>
                <div className="flex gap-2 mt-1">
                    <input 
                        type="text" 
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        className="flex-1 border border-gray-700 bg-gray-800 text-white p-2 rounded text-sm uppercase placeholder-gray-500 focus:outline-none focus:border-theme-accent"
                        placeholder="Código"
                    />
                    <button onClick={checkCoupon} className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm transition">Aplicar</button>
                </div>
                {appliedCoupon && <p className="text-green-500 text-xs mt-1">Desconto de {appliedCoupon.percent}% aplicado!</p>}
                {couponError && <p className="text-red-500 text-xs mt-1">{couponError}</p>}
            </div>

            <div className="flex justify-between text-sm mb-1 text-gray-300">
              <span>Subtotal:</span>
              <span>R$ {subtotal.toFixed(2)}</span>
            </div>
            {appliedCoupon && (
                <div className="flex justify-between text-sm mb-1 text-green-500">
                    <span>Desconto:</span>
                    <span>- R$ {discount.toFixed(2)}</span>
                </div>
            )}
            <div className="flex justify-between text-xl font-bold mb-4 text-white">
              <span>Total (Estimado):</span>
              <span>R$ {total.toFixed(2)}</span>
            </div>
            <button 
                onClick={() => onCheckout(subtotal, discount, total, appliedCoupon?.code)}
                className="w-full bg-theme-accent text-white py-3 rounded font-bold hover:opacity-90 transition shadow-lg"
            >
              Finalizar Pedido
            </button>
          </div>
        )}
      </div>
    </div>
  );
};