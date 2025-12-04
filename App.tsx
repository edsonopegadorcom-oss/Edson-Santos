import React, { useState, useEffect } from 'react';
import { Layout, Modal } from './components/Layout';
import { CartSidebar } from './components/CartSidebar';
import { 
  Appointment, Product, Category, ServiceType, 
  AppointmentStatus, Order, OrderStatus, CartItem, AdminConfig 
} from './types';
import { StorageService, generateId, simpleHash } from './services/storageService';

// --- Sub-components for specific pages to keep file count low as requested ---

// --- 1. ADMIN PANEL ---
const AdminPanel: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
    const [tab, setTab] = useState<'appointments' | 'orders' | 'products' | 'config' | 'reports'>('appointments');
    const [config, setConfig] = useState<AdminConfig>(StorageService.getConfig());
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [viewDetail, setViewDetail] = useState<any>(null); // For modals

    // Load data on mount and tab change
    useEffect(() => {
        setAppointments(StorageService.getAppointments().sort((a,b) => b.createdAt - a.createdAt));
        setOrders(StorageService.getOrders().sort((a,b) => b.createdAt - a.createdAt));
        setProducts(StorageService.getProducts());
        setConfig(StorageService.getConfig());
    }, [tab]);

    const handleApptAction = (id: string, status: AppointmentStatus) => {
        const appt = appointments.find(a => a.id === id);
        if (appt) {
            const updated = { ...appt, status };
            StorageService.updateAppointment(updated);
            setAppointments(prev => prev.map(a => a.id === id ? updated : a));
        }
    };

    const handleOrderAction = (id: string, status: OrderStatus) => {
        const order = orders.find(o => o.id === id);
        if (order) {
            const updated = { ...order, status };
            // If confirming, reduce stock if not already done (simplified logic)
            if (status === OrderStatus.CONFIRMED && order.status !== OrderStatus.CONFIRMED) {
                StorageService.updateStock(order.items.map(i => ({ id: i.id, qty: i.quantity })));
            }
            StorageService.updateOrder(updated);
            setOrders(prev => prev.map(o => o.id === id ? updated : o));
        }
    };
    
    // Product Form State
    const [newProd, setNewProd] = useState<Partial<Product>>({});
    const [prodImg, setProdImg] = useState('');

    const saveProduct = () => {
        if (!newProd.name || !newProd.price) return alert("Preencha dados básicos");
        const prod: Product = {
            id: generateId(),
            categoryId: newProd.categoryId || 'c1',
            name: newProd.name,
            description: newProd.description || '',
            price: Number(newProd.price),
            stock: Number(newProd.stock || 0),
            imageBase64: prodImg
        };
        StorageService.saveProduct(prod);
        setProducts([...products, prod]);
        setNewProd({});
        setProdImg('');
        alert("Produto Salvo!");
    };

    // Config State
    const [newLogo, setNewLogo] = useState('');
    const saveConfig = () => {
        StorageService.saveConfig({
            ...config,
            logoBase64: newLogo || config.logoBase64
        });
        alert("Configurações salvas. Recarregue a página para ver mudanças visuais.");
    };
    
    // Reports Logic
    const getStats = () => {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfWeek = startOfDay - (now.getDay() * 24 * 60 * 60 * 1000);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

        const calcTotal = (since: number) => {
            return orders
                .filter(o => (o.status === OrderStatus.CONFIRMED || o.status === OrderStatus.DELIVERED) && o.createdAt >= since)
                .reduce((acc, o) => acc + o.total, 0);
        };

        return {
            daily: calcTotal(startOfDay),
            weekly: calcTotal(startOfWeek),
            monthly: calcTotal(startOfMonth)
        };
    };
    
    const stats = getStats();

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto text-gray-800">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-bold">Painel Administrativo</h1>
                <button onClick={onLogout} className="text-red-600 hover:text-red-800 underline">Sair</button>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-6 border-b">
                {(['appointments', 'orders', 'products', 'config', 'reports'] as const).map(t => (
                    <button 
                        key={t}
                        onClick={() => setTab(t)}
                        className={`px-4 py-2 capitalize ${tab === t ? 'border-b-2 border-blue-600 font-bold text-blue-600' : 'text-gray-500'}`}
                    >
                        {t === 'appointments' ? 'Agendamentos' : t === 'orders' ? 'Pedidos' : t === 'products' ? 'Produtos' : t === 'config' ? 'Config' : 'Relatórios'}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="bg-white rounded shadow p-4 min-h-[400px]">
                {tab === 'appointments' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="p-3">Data/Hora</th>
                                    <th className="p-3">Cliente</th>
                                    <th className="p-3">Serviço</th>
                                    <th className="p-3">Status</th>
                                    <th className="p-3">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {appointments.map(a => (
                                    <tr key={a.id} className="border-b hover:bg-gray-50">
                                        <td className="p-3">{a.date.split('-').reverse().join('/')} às {a.time}</td>
                                        <td className="p-3">
                                            {a.name}<br/>
                                            <a href={`https://wa.me/${a.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="text-green-600 text-xs hover:underline">
                                                <i className="fab fa-whatsapp"></i> {a.phone}
                                            </a>
                                        </td>
                                        <td className="p-3">{a.serviceName}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded text-xs text-white ${a.status === 'CONFIRMADO' ? 'bg-green-500' : a.status === 'CANCELADO' ? 'bg-red-500' : 'bg-yellow-500'}`}>
                                                {a.status}
                                            </span>
                                        </td>
                                        <td className="p-3 flex gap-2">
                                            {a.status === 'PENDENTE' && (
                                                <button onClick={() => handleApptAction(a.id, AppointmentStatus.CONFIRMED)} className="text-green-600 hover:bg-green-100 p-1 rounded" title="Confirmar"><i className="fas fa-check"></i></button>
                                            )}
                                            {a.status !== 'CANCELADO' && (
                                                <button onClick={() => handleApptAction(a.id, AppointmentStatus.CANCELLED)} className="text-red-600 hover:bg-red-100 p-1 rounded" title="Cancelar"><i className="fas fa-times"></i></button>
                                            )}
                                            <button onClick={() => setViewDetail(a)} className="text-blue-600 hover:bg-blue-100 p-1 rounded" title="Ver Detalhes"><i className="fas fa-eye"></i></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {tab === 'orders' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                             <thead className="bg-gray-100">
                                <tr>
                                    <th className="p-3">Data</th>
                                    <th className="p-3">Cliente</th>
                                    <th className="p-3">Total</th>
                                    <th className="p-3">Tipo</th>
                                    <th className="p-3">Status</th>
                                    <th className="p-3">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map(o => (
                                    <tr key={o.id} className="border-b hover:bg-gray-50">
                                        <td className="p-3">{new Date(o.createdAt).toLocaleDateString()}</td>
                                        <td className="p-3">{o.clientName}</td>
                                        <td className="p-3">R$ {o.total.toFixed(2)}</td>
                                        <td className="p-3">{o.delivery ? 'Entrega' : 'Retirada'}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded text-xs text-white ${o.status === 'ENTREGUE' ? 'bg-gray-800' : o.status === 'CONFIRMADO' ? 'bg-green-500' : o.status === 'CANCELADO' ? 'bg-red-500' : 'bg-yellow-500'}`}>
                                                {o.status}
                                            </span>
                                        </td>
                                        <td className="p-3 flex gap-2">
                                            {o.status === 'PENDENTE' && <button onClick={() => handleOrderAction(o.id, OrderStatus.CONFIRMED)} className="text-green-600"><i className="fas fa-check-double"></i></button>}
                                            {o.status === 'CONFIRMADO' && o.delivery && <button onClick={() => handleOrderAction(o.id, OrderStatus.DELIVERED)} className="text-gray-800"><i className="fas fa-truck"></i></button>}
                                            <button onClick={() => setViewDetail(o)} className="text-blue-600"><i className="fas fa-eye"></i></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {tab === 'products' && (
                    <div>
                        <div className="mb-6 bg-gray-50 p-4 rounded border">
                            <h3 className="font-bold mb-2">Novo Produto</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input className="border p-2 rounded" placeholder="Nome" value={newProd.name || ''} onChange={e => setNewProd({...newProd, name: e.target.value})} />
                                <input className="border p-2 rounded" type="number" placeholder="Preço" value={newProd.price || ''} onChange={e => setNewProd({...newProd, price: parseFloat(e.target.value)})} />
                                <input className="border p-2 rounded" type="number" placeholder="Estoque" value={newProd.stock || ''} onChange={e => setNewProd({...newProd, stock: parseInt(e.target.value)})} />
                                <select className="border p-2 rounded" value={newProd.categoryId} onChange={e => setNewProd({...newProd, categoryId: e.target.value})}>
                                    {StorageService.getCategories().map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <div className="col-span-2">
                                    <label className="block text-xs mb-1">Imagem</label>
                                    <input type="file" onChange={async (e) => {
                                        if(e.target.files && e.target.files[0]) {
                                            const reader = new FileReader();
                                            reader.onload = (ev) => setProdImg(ev.target?.result as string);
                                            reader.readAsDataURL(e.target.files[0]);
                                        }
                                    }} />
                                </div>
                            </div>
                            <button onClick={saveProduct} className="mt-2 bg-green-600 text-white px-4 py-2 rounded">Salvar Produto</button>
                        </div>
                        <h3 className="font-bold mb-2">Estoque Atual</h3>
                        <ul className="divide-y">
                            {products.map(p => (
                                <li key={p.id} className="py-2 flex justify-between">
                                    <span>{p.name}</span>
                                    <span className="font-mono text-sm">Qtd: {p.stock} | R$ {p.price}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {tab === 'config' && (
                   <div className="space-y-4 max-w-md">
                       <h3 className="font-bold">Aparência & Logo</h3>
                       <div className="bg-blue-50 p-4 rounded border border-blue-200 mb-4">
                           <p className="text-sm text-blue-800">
                               <strong>Atenção:</strong> Como este é um sistema sem backend, faça o upload da logo aqui para vê-la no site.
                           </p>
                       </div>
                       <div>
                           <label className="block text-sm">Cor Primária (Fundo/Texto)</label>
                           <input type="color" value={config.primaryColor} onChange={e => setConfig({...config, primaryColor: e.target.value})} className="h-10 w-full cursor-pointer"/>
                       </div>
                       <div>
                           <label className="block text-sm">Cor Secundária (Destaques)</label>
                           <input type="color" value={config.accentColor} onChange={e => setConfig({...config, accentColor: e.target.value})} className="h-10 w-full cursor-pointer"/>
                       </div>
                       <div>
                           <label className="block text-sm">Logo do Estúdio</label>
                           <div className="flex items-center gap-4 mt-2">
                               {config.logoBase64 ? <img src={config.logoBase64} className="h-16 w-16 object-cover rounded border"/> : <div className="h-16 w-16 bg-gray-200 rounded flex items-center justify-center text-xs">Sem Logo</div>}
                               <input type="file" onChange={(e) => {
                                   if(e.target.files?.[0]) {
                                       const reader = new FileReader();
                                       reader.onload = (ev) => setNewLogo(ev.target?.result as string);
                                       reader.readAsDataURL(e.target.files[0]);
                                   }
                               }} />
                           </div>
                       </div>
                       
                       <h3 className="font-bold pt-4">Dias Fechados</h3>
                       <p className="text-xs text-gray-500">Selecione datas para bloquear agendamentos.</p>
                       <input 
                            type="date" 
                            onChange={(e) => {
                                if(e.target.value) {
                                    const dates = config.closedDates.includes(e.target.value) 
                                        ? config.closedDates.filter(d => d !== e.target.value)
                                        : [...config.closedDates, e.target.value];
                                    setConfig({...config, closedDates: dates});
                                }
                            }}
                       />
                       <div className="flex flex-wrap gap-2 mt-2">
                           {config.closedDates.map(d => (
                               <span key={d} className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">
                                   {d} <button onClick={() => setConfig({...config, closedDates: config.closedDates.filter(x => x !== d)})} className="ml-1 font-bold">x</button>
                               </span>
                           ))}
                       </div>

                       <button onClick={saveConfig} className="bg-blue-600 text-white px-4 py-2 rounded w-full">Salvar Configurações</button>
                   </div> 
                )}

                {tab === 'reports' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                        <div className="bg-blue-50 p-6 rounded border border-blue-200">
                            <h4 className="text-gray-500 font-bold uppercase text-xs">Hoje</h4>
                            <p className="text-3xl font-bold text-blue-700">R$ {stats.daily.toFixed(2)}</p>
                        </div>
                        <div className="bg-green-50 p-6 rounded border border-green-200">
                            <h4 className="text-gray-500 font-bold uppercase text-xs">Semana</h4>
                            <p className="text-3xl font-bold text-green-700">R$ {stats.weekly.toFixed(2)}</p>
                        </div>
                        <div className="bg-purple-50 p-6 rounded border border-purple-200">
                            <h4 className="text-gray-500 font-bold uppercase text-xs">Mês</h4>
                            <p className="text-3xl font-bold text-purple-700">R$ {stats.monthly.toFixed(2)}</p>
                        </div>
                        <div className="col-span-1 md:col-span-3 mt-4 text-left">
                            <p className="text-sm text-gray-500 italic">* Valores baseados em pedidos com status CONFIRMADO ou ENTREGUE.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Detail Modal - Using Portal based Modal Component (Dark Theme applied in Layout) */}
            <Modal isOpen={!!viewDetail} onClose={() => setViewDetail(null)} title="Detalhes">
                {viewDetail && 'serviceName' in viewDetail ? (
                    // Appointment Details
                    <div className="space-y-2 text-white">
                        <p><strong>Cliente:</strong> {viewDetail.name}</p>
                        <p><strong>Serviço:</strong> {viewDetail.serviceName}</p>
                        <p><strong>Data:</strong> {viewDetail.date} às {viewDetail.time}</p>
                        {viewDetail.tattooBase64 && (
                            <div className="my-2">
                                <p className="font-bold text-sm">Referência Tattoo:</p>
                                <img src={viewDetail.tattooBase64} alt="Ref" className="w-full max-h-48 object-contain bg-gray-700 rounded" />
                                <p className="text-sm">Local: {viewDetail.tattooLocation} | Tam: {viewDetail.tattooSize}</p>
                            </div>
                        )}
                        <p className="bg-gray-700 p-2 rounded text-sm italic">{viewDetail.notes || 'Sem observações'}</p>
                    </div>
                ) : viewDetail ? (
                    // Order Details
                    <div className="space-y-2 text-white">
                        <p><strong>Cliente:</strong> {viewDetail.clientName}</p>
                        <p><strong>Tipo:</strong> {viewDetail.delivery ? 'Entrega' : 'Retirada na Loja'}</p>
                        {viewDetail.delivery && viewDetail.address && (
                            <div className="bg-yellow-900 bg-opacity-30 p-2 rounded text-sm border border-yellow-700 text-yellow-100">
                                <p>{viewDetail.address.street}, {viewDetail.address.number}</p>
                                <p>{viewDetail.address.neighborhood}</p>
                                <p className="text-xs text-yellow-300">Ref: {viewDetail.address.reference}</p>
                            </div>
                        )}
                        <div className="border-t border-gray-700 pt-2 mt-2">
                            {viewDetail.items.map((i: any) => (
                                <div key={i.id} className="flex justify-between text-sm">
                                    <span>{i.quantity}x {i.name}</span>
                                    <span>R$ {(i.price * i.quantity).toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between font-bold pt-2 border-t border-gray-700 mt-2">
                            <span>Total</span>
                            <span>R$ {viewDetail.total.toFixed(2)}</span>
                        </div>
                        <p className="text-sm">Pagamento: {viewDetail.paymentMethod}</p>
                        {viewDetail.paymentMethod === 'money' && <p className="text-sm text-red-400">Troco para: R$ {viewDetail.changeFor}</p>}
                    </div>
                ) : null}
            </Modal>
        </div>
    );
};

// --- 2. PUBLIC PAGE ---
const PublicPage: React.FC = () => {
    const config = StorageService.getConfig();
    const [cartOpen, setCartOpen] = useState(false);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [activeCat, setActiveCat] = useState('all');

    // Appointment Form State
    const [apptForm, setApptForm] = useState({
        service: ServiceType.HAIRCUT as string,
        name: '',
        phone: '',
        date: '',
        time: '',
        notes: '',
        tattooSize: '',
        tattooLocation: ''
    });
    const [tattooImg, setTattooImg] = useState('');
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    
    // Order Modal State
    const [checkoutOpen, setCheckoutOpen] = useState(false);
    const [checkoutData, setCheckoutData] = useState<Partial<Order>>({ delivery: false, paymentMethod: 'money' });
    const [orderSummary, setOrderSummary] = useState({sub: 0, disc: 0, total: 0, code: ''});

    useEffect(() => {
        setProducts(StorageService.getProducts());
        setCategories(StorageService.getCategories());
    }, []);

    // Time Slot Logic
    useEffect(() => {
        if (!apptForm.date) return;
        
        // Check if date is closed
        if (config.closedDates.includes(apptForm.date)) {
            setAvailableSlots([]);
            return;
        }

        const allSlots = ['09:00','09:30','10:00','10:30','11:00','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00'];
        const existing = StorageService.getAppointments();
        const taken = existing
            .filter(a => a.date === apptForm.date && a.status !== AppointmentStatus.CANCELLED)
            .map(a => a.time);
        
        setAvailableSlots(allSlots.filter(s => !taken.includes(s)));
    }, [apptForm.date, config.closedDates]);

    const handleAddToCart = (p: Product) => {
        setCart(prev => {
            const exists = prev.find(i => i.id === p.id);
            if (exists) {
                if(exists.quantity >= p.stock) {
                    alert("Estoque insuficiente");
                    return prev;
                }
                return prev.map(i => i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { ...p, quantity: 1 }];
        });
        setCartOpen(true);
    };

    const submitAppointment = () => {
        if (!apptForm.name || !apptForm.phone || !apptForm.date || !apptForm.time) {
            alert("Preencha todos os campos obrigatórios");
            return;
        }

        const appt: Appointment = {
            id: generateId(),
            serviceId: apptForm.service,
            serviceName: apptForm.service === 'custom-tattoo' ? 'Tatuagem Personalizada' : apptForm.service,
            price: apptForm.service === ServiceType.HAIRCUT ? 25 : apptForm.service === ServiceType.BEARD ? 9 : apptForm.service === ServiceType.FOOT ? 10 : 0,
            name: apptForm.name,
            phone: apptForm.phone,
            date: apptForm.date,
            time: apptForm.time,
            status: AppointmentStatus.PENDING,
            tattooBase64: tattooImg,
            tattooSize: apptForm.tattooSize,
            tattooLocation: apptForm.tattooLocation,
            notes: apptForm.notes,
            createdAt: Date.now()
        };

        StorageService.saveAppointment(appt);
        alert(`Agendamento enviado com sucesso! Aguarde a confirmação no WhatsApp.`);
        setApptForm({ ...apptForm, name: '', phone: '', date: '', time: '' });
        setTattooImg('');
    };

    const submitOrder = () => {
        if (!checkoutData.clientName || !checkoutData.phone) return alert("Nome e Telefone são obrigatórios");
        if (checkoutData.delivery && (!checkoutData.address?.street || !checkoutData.address.neighborhood)) return alert("Endereço incompleto");

        const order: Order = {
            id: generateId(),
            items: cart,
            clientName: checkoutData.clientName!,
            phone: checkoutData.phone!,
            delivery: checkoutData.delivery || false,
            deliveryFee: checkoutData.delivery ? 7.00 : 0,
            address: checkoutData.address as any,
            paymentMethod: checkoutData.paymentMethod as any,
            changeFor: checkoutData.changeFor,
            subtotal: orderSummary.sub,
            discount: orderSummary.disc,
            total: orderSummary.total + (checkoutData.delivery ? 7.00 : 0),
            couponCode: orderSummary.code,
            status: OrderStatus.PENDING,
            createdAt: Date.now()
        };

        StorageService.saveOrder(order);
        alert("Pedido Enviado! Entraremos em contato.");
        setCart([]);
        setCartOpen(false);
        setCheckoutOpen(false);
    };

    const inputClasses = "w-full border border-gray-600 bg-gray-700 text-white p-2 rounded focus:ring-2 focus:ring-theme-accent outline-none placeholder-gray-400";

    return (
        <div className="pb-20 bg-gray-900 min-h-screen">
            {/* Header */}
            <header className="bg-theme-primary text-white p-4 shadow-md sticky top-0 z-40 transition-all duration-300 border-b border-gray-800">
                <div className="container mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        {config.logoBase64 ? (
                             <img src={config.logoBase64} className="h-12 w-12 md:h-14 md:w-14 rounded-full object-cover border-2 border-theme-accent"/>
                        ) : (
                            <div className="h-12 w-12 bg-gray-800 rounded-full flex items-center justify-center border-2 border-theme-accent text-theme-accent">
                                <i className="fas fa-dragon text-2xl"></i>
                            </div>
                        )}
                        <h1 className="text-xl md:text-2xl font-bold uppercase tracking-widest font-serif">Lielson Tattoo</h1>
                    </div>
                    <button onClick={() => setCartOpen(true)} className="relative p-2 hover:text-theme-accent transition">
                        <i className="fas fa-shopping-cart text-xl"></i>
                        {cart.length > 0 && <span className="absolute top-0 right-0 bg-theme-accent text-xs rounded-full w-5 h-5 flex items-center justify-center text-white font-bold">{cart.reduce((a,b) => a + b.quantity, 0)}</span>}
                    </button>
                </div>
            </header>

            {/* Hero */}
            <div className="bg-gray-900 text-white py-16 md:py-24 text-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-40 bg-[url('https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28?q=80&w=1920&auto=format&fit=crop')] bg-cover bg-center"></div>
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-900"></div>
                
                <div className="relative z-10 container mx-auto px-4 flex flex-col items-center">
                    {config.logoBase64 && (
                        <img src={config.logoBase64} className="h-32 w-32 md:h-40 md:w-40 rounded-full object-cover border-4 border-theme-accent shadow-2xl mb-6 animate-slideIn"/>
                    )}
                    <h2 className="text-4xl md:text-5xl font-bold mb-4 font-serif tracking-wide text-white">Arte na Pele</h2>
                    <p className="text-gray-300 text-lg md:text-xl max-w-2xl mx-auto">Transformando suas ideias em realidade com traços precisos e estilo único.</p>
                    <a href="#agendamento" className="mt-8 inline-block bg-theme-accent text-white px-8 py-3 rounded-full font-bold hover:bg-red-700 transition transform hover:scale-105 shadow-lg uppercase tracking-wider">
                        Agendar Agora
                    </a>
                </div>
            </div>

            <div className="container mx-auto p-4 space-y-12">
                
                {/* Scheduling Section */}
                <section id="agendamento" className="bg-gray-800 text-white rounded-lg shadow-lg p-6 -mt-8 relative z-10 border border-gray-700">
                    <h3 className="text-2xl font-bold text-theme-accent mb-6 border-b border-gray-700 pb-2">Agendar Horário</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-300">Serviço</label>
                                <select 
                                    className={inputClasses}
                                    value={apptForm.service}
                                    onChange={(e) => setApptForm({...apptForm, service: e.target.value})}
                                >
                                    {Object.values(ServiceType).map(s => <option key={s} value={s} className="bg-gray-800">{s}</option>)}
                                    <option value="custom-tattoo" className="bg-gray-800">Tatuagem (Orçamento/Sessão)</option>
                                </select>
                                <div className="text-sm text-theme-accent mt-1 font-bold">
                                    {apptForm.service === ServiceType.HAIRCUT ? 'R$ 25,00' : apptForm.service === ServiceType.BEARD ? 'R$ 9,00' : apptForm.service === ServiceType.FOOT ? 'R$ 10,00' : 'Preço a combinar'}
                                </div>
                            </div>

                            {apptForm.service === 'custom-tattoo' && (
                                <div className="bg-gray-700 bg-opacity-50 p-4 rounded border border-dashed border-gray-600 space-y-3 animate-slideIn">
                                    <h4 className="font-semibold text-sm text-gray-300">Detalhes da Tattoo</h4>
                                    <input type="text" placeholder="Local do corpo (ex: Braço)" className={inputClasses} value={apptForm.tattooLocation} onChange={e => setApptForm({...apptForm, tattooLocation: e.target.value})} />
                                    <input type="text" placeholder="Tamanho aprox. (ex: 15cm)" className={inputClasses} value={apptForm.tattooSize} onChange={e => setApptForm({...apptForm, tattooSize: e.target.value})} />
                                    <label className="block text-xs text-gray-400">Referência (Imagem)</label>
                                    <input type="file" accept="image/*" onChange={(e) => {
                                        if (e.target.files?.[0]) {
                                            if(e.target.files[0].size > 2000000) return alert("Imagem muito grande (Max 2MB)");
                                            const reader = new FileReader();
                                            reader.onload = (ev) => setTattooImg(ev.target?.result as string);
                                            reader.readAsDataURL(e.target.files[0]);
                                        }
                                    }} className="text-sm text-gray-400" />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <input type="text" placeholder="Seu Nome" className={inputClasses} value={apptForm.name} onChange={e => setApptForm({...apptForm, name: e.target.value})} />
                                <input type="tel" placeholder="WhatsApp (99) 9..." className={inputClasses} value={apptForm.phone} onChange={e => setApptForm({...apptForm, phone: e.target.value})} />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-300">Data</label>
                                <input type="date" min={new Date().toISOString().split('T')[0]} className={inputClasses} value={apptForm.date} onChange={e => setApptForm({...apptForm, date: e.target.value})} />
                            </div>
                            
                            {apptForm.date && (
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-gray-300">Horários Disponíveis</label>
                                    {availableSlots.length > 0 ? (
                                        <div className="grid grid-cols-4 gap-2">
                                            {availableSlots.map(time => (
                                                <button 
                                                    key={time} 
                                                    onClick={() => setApptForm({...apptForm, time})}
                                                    className={`py-1 text-sm rounded border ${apptForm.time === time ? 'bg-theme-accent text-white border-transparent shadow-lg transform scale-105' : 'border-gray-600 hover:bg-gray-700 text-gray-300'}`}
                                                >
                                                    {time}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-red-400 text-sm">Nenhum horário disponível ou data fechada.</p>
                                    )}
                                </div>
                            )}

                            <textarea placeholder="Observações..." className={`${inputClasses} h-20`} value={apptForm.notes} onChange={e => setApptForm({...apptForm, notes: e.target.value})}></textarea>
                            
                            <button onClick={submitAppointment} className="w-full bg-theme-accent text-white font-bold py-3 rounded hover:opacity-90 transition shadow-lg uppercase tracking-wide">
                                CONFIRMAR AGENDAMENTO
                            </button>
                        </div>
                    </div>
                </section>

                {/* Shop Section */}
                <section id="loja">
                     <div className="flex justify-between items-center mb-6">
                        <h3 className="text-2xl font-bold text-theme-accent">Loja & Produtos</h3>
                        <div className="text-sm space-x-2">
                            <button onClick={() => setActiveCat('all')} className={`px-3 py-1 rounded transition ${activeCat === 'all' ? 'bg-theme-accent text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>Todos</button>
                            {categories.map(c => (
                                <button key={c.id} onClick={() => setActiveCat(c.id)} className={`px-3 py-1 rounded transition ${activeCat === c.id ? 'bg-theme-accent text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>{c.name}</button>
                            ))}
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {products.filter(p => activeCat === 'all' || p.categoryId === activeCat).map(p => (
                            <div key={p.id} className="bg-gray-800 text-white rounded-lg shadow-lg hover:shadow-xl transition overflow-hidden flex flex-col border border-gray-700">
                                <div className="h-48 bg-gray-700 flex items-center justify-center">
                                    {p.imageBase64 ? <img src={p.imageBase64} className="h-full w-full object-cover" alt={p.name}/> : <i className="fas fa-image text-4xl text-gray-500"></i>}
                                </div>
                                <div className="p-4 flex-1 flex flex-col">
                                    <h4 className="font-bold text-lg mb-1">{p.name}</h4>
                                    <p className="text-sm text-gray-400 mb-2 flex-1">{p.description}</p>
                                    <div className="flex justify-between items-center mt-4">
                                        <span className="font-bold text-theme-accent text-lg">R$ {p.price.toFixed(2)}</span>
                                        <button 
                                            onClick={() => handleAddToCart(p)}
                                            disabled={p.stock <= 0}
                                            className={`px-3 py-1 rounded text-white text-sm ${p.stock > 0 ? 'bg-theme-primary hover:bg-opacity-90 border border-gray-600' : 'bg-gray-600 cursor-not-allowed'}`}
                                        >
                                            {p.stock > 0 ? 'Adicionar' : 'Esgotado'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
                
                {/* Contact Footer */}
                <footer className="border-t border-gray-800 pt-8 pb-4 text-center text-gray-500">
                    <p className="mb-2"><i className="fas fa-map-marker-alt"></i> Rua Exemplo, 123 - Centro</p>
                    <p className="mb-4"><i className="fab fa-whatsapp"></i> (00) 90000-0000</p>
                    <p className="text-xs">&copy; 2023 Lielson Tattoo Studio. Todos os direitos reservados.</p>
                </footer>
            </div>

            {/* Carts & Modals */}
            <CartSidebar 
                isOpen={cartOpen} 
                onClose={() => setCartOpen(false)} 
                cart={cart} 
                setCart={setCart} 
                onCheckout={(sub, disc, total, code) => {
                    setOrderSummary({sub, disc, total, code: code || ''});
                    setCheckoutOpen(true);
                    setCartOpen(false);
                }} 
            />

            <Modal isOpen={checkoutOpen} onClose={() => setCheckoutOpen(false)} title="Finalizar Pedido">
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <input className={inputClasses} placeholder="Nome Completo" value={checkoutData.clientName || ''} onChange={e => setCheckoutData({...checkoutData, clientName: e.target.value})} />
                        <input className={inputClasses} placeholder="Telefone" value={checkoutData.phone || ''} onChange={e => setCheckoutData({...checkoutData, phone: e.target.value})} />
                    </div>
                    
                    <div className="flex gap-4 text-white">
                        <label className="flex items-center gap-2 cursor-pointer hover:text-theme-accent">
                            <input type="radio" name="delivery" checked={!checkoutData.delivery} onChange={() => setCheckoutData({...checkoutData, delivery: false})} className="accent-theme-accent" /> 
                            Retirar na Loja
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:text-theme-accent">
                            <input type="radio" name="delivery" checked={checkoutData.delivery} onChange={() => setCheckoutData({...checkoutData, delivery: true})} className="accent-theme-accent" /> 
                            Entrega (+R$ 7,00)
                        </label>
                    </div>

                    {checkoutData.delivery && (
                        <div className="bg-gray-700 bg-opacity-50 p-3 rounded border border-gray-600 space-y-2">
                            <input className={`${inputClasses} text-sm`} placeholder="Bairro" onChange={e => setCheckoutData({...checkoutData, address: {...checkoutData.address!, neighborhood: e.target.value}})} />
                            <div className="grid grid-cols-3 gap-2">
                                <input className={`col-span-2 ${inputClasses} text-sm`} placeholder="Rua" onChange={e => setCheckoutData({...checkoutData, address: {...checkoutData.address!, street: e.target.value}})} />
                                <input className={`${inputClasses} text-sm`} placeholder="Nº" onChange={e => setCheckoutData({...checkoutData, address: {...checkoutData.address!, number: e.target.value}})} />
                            </div>
                            <input className={`${inputClasses} text-sm`} placeholder="Ponto de Referência" onChange={e => setCheckoutData({...checkoutData, address: {...checkoutData.address!, reference: e.target.value}})} />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-300">Pagamento</label>
                        <select className={inputClasses} value={checkoutData.paymentMethod} onChange={e => setCheckoutData({...checkoutData, paymentMethod: e.target.value as any})}>
                            <option value="money" className="bg-gray-800">Dinheiro</option>
                            <option value="card" className="bg-gray-800">Cartão</option>
                            <option value="pix" className="bg-gray-800">PIX</option>
                        </select>
                    </div>

                    {checkoutData.paymentMethod === 'money' && (
                        <input className={inputClasses} type="number" placeholder="Troco para quanto?" onChange={e => setCheckoutData({...checkoutData, changeFor: parseFloat(e.target.value)})} />
                    )}

                    <div className="bg-gray-700 text-white p-4 rounded text-center border border-gray-600">
                        <p className="text-sm opacity-80">Total a Pagar</p>
                        <p className="text-2xl font-bold text-theme-accent">R$ {(orderSummary.total + (checkoutData.delivery ? 7 : 0)).toFixed(2)}</p>
                    </div>

                    <button onClick={submitOrder} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded transition shadow-lg">CONFIRMAR PEDIDO</button>
                </div>
            </Modal>
        </div>
    );
};

// --- MAIN APP COMPONENT ---
export default function App() {
    // Determine view based on URL hash for simple routing
    const [view, setView] = useState('home'); 
    const [adminUser, setAdminUser] = useState<any>(null);

    useEffect(() => {
        const handleHash = () => {
            const hash = window.location.hash;
            if (hash === '#admin') setView('admin');
            else setView('home');
        };
        window.addEventListener('hashchange', handleHash);
        handleHash(); // init
        return () => window.removeEventListener('hashchange', handleHash);
    }, []);

    // Session Logic
    useEffect(() => {
        const session = sessionStorage.getItem('lt_session');
        if (session) setAdminUser(true);
    }, []);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        const email = (e.target as any).email.value;
        const pass = (e.target as any).pass.value;
        
        const config = StorageService.getConfig();
        if (email === config.adminEmail && simpleHash(pass) === config.adminPassHash) {
            sessionStorage.setItem('lt_session', 'true');
            setAdminUser(true);
        } else {
            alert('Credenciais inválidas');
        }
    };

    const handleLogout = () => {
        sessionStorage.removeItem('lt_session');
        setAdminUser(null);
        window.location.hash = '';
    };

    return (
        <Layout>
            {view === 'home' && <PublicPage />}
            
            {view === 'admin' && !adminUser && (
                <div className="flex items-center justify-center min-h-screen bg-gray-900">
                    <form onSubmit={handleLogin} className="bg-gray-800 p-8 rounded shadow-lg w-full max-w-sm text-white border border-gray-700">
                        <h2 className="text-2xl font-bold mb-6 text-center text-theme-accent">Admin Login</h2>
                        <div className="space-y-4">
                            <input name="email" type="text" placeholder="Email" className="w-full border border-gray-600 bg-gray-700 p-2 rounded text-white" />
                            <input name="pass" type="password" placeholder="Senha" className="w-full border border-gray-600 bg-gray-700 p-2 rounded text-white" />
                            <button className="w-full bg-theme-accent text-white py-2 rounded font-bold hover:opacity-90">ENTRAR</button>
                        </div>
                        <p className="text-xs text-center mt-4 text-gray-400">Padrão: admin@admin / admin</p>
                        <a href="#" className="block text-center mt-2 text-theme-accent text-sm">Voltar ao site</a>
                    </form>
                </div>
            )}

            {view === 'admin' && adminUser && (
                <AdminPanel onLogout={handleLogout} />
            )}
        </Layout>
    );
}