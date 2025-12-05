import React, { useState, useEffect } from 'react';
import { Layout, Modal } from './components/Layout';
import { CartSidebar } from './components/CartSidebar';
import { 
  Appointment, Product, Category, ServiceItem, 
  AppointmentStatus, Order, OrderStatus, CartItem, AdminConfig 
} from './types';
import { StorageService, generateId, simpleHash } from './services/storageService';

// --- Sub-components for specific pages ---

// --- 1. ADMIN PANEL (Re-designed) ---
const AdminPanel: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'appointments' | 'orders' | 'products' | 'services' | 'config'>('dashboard');
    const [config, setConfig] = useState<AdminConfig | null>(null);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [services, setServices] = useState<ServiceItem[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [viewDetail, setViewDetail] = useState<any>(null);

    // Config Form States
    const [newLogo, setNewLogo] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editPass, setEditPass] = useState('');

    // Service Form State
    const [newService, setNewService] = useState<Partial<ServiceItem>>({ icon: 'cut', active: true });

    // Realtime Subscriptions & Async Load
    useEffect(() => {
        const loadStatic = async () => {
            const conf = await StorageService.getConfig();
            setConfig(conf);
            setEditEmail(conf.adminEmail); // Pre-fill email
            const cats = await StorageService.getCategories();
            setCategories(cats);
        };
        loadStatic();

        const unsubAppt = StorageService.subscribeAppointments(setAppointments);
        const unsubOrders = StorageService.subscribeOrders(setOrders);
        const unsubProds = StorageService.subscribeProducts(setProducts);
        const unsubServices = StorageService.subscribeServices(setServices);

        return () => {
            unsubAppt();
            unsubOrders();
            unsubProds();
            unsubServices();
        };
    }, []);

    const handleApptAction = async (id: string, status: AppointmentStatus) => {
        const appt = appointments.find(a => a.id === id);
        if (appt) await StorageService.updateAppointment({ ...appt, status });
    };

    const handleOrderAction = async (id: string, status: OrderStatus) => {
        const order = orders.find(o => o.id === id);
        if (order) {
            const updated = { ...order, status };
            if (status === OrderStatus.CONFIRMED && order.status !== OrderStatus.CONFIRMED) {
                await StorageService.updateStock(order.items.map(i => ({ id: i.id, qty: i.quantity })));
            }
            await StorageService.updateOrder(updated);
        }
    };
    
    // Product Form State
    const [newProd, setNewProd] = useState<Partial<Product>>({});
    const [prodImg, setProdImg] = useState('');

    const saveProduct = async () => {
        if (!newProd.name || !newProd.price) return alert("Preencha dados básicos");
        const prod: Product = {
            id: generateId(),
            // Default to 'barbearia' if not selected
            categoryId: newProd.categoryId || 'barbearia', 
            name: newProd.name,
            description: newProd.description || '',
            price: Number(newProd.price),
            stock: Number(newProd.stock || 0),
            imageBase64: prodImg
        };
        await StorageService.saveProduct(prod);
        setNewProd({});
        setProdImg('');
        alert("Produto Salvo!");
    };

    const saveService = async () => {
        if (!newService.name || !newService.price) return alert("Preencha nome e preço");
        const service: ServiceItem = {
            id: newService.id || generateId(),
            name: newService.name,
            price: Number(newService.price),
            icon: newService.icon || 'cut',
            active: true
        };
        await StorageService.saveService(service);
        setNewService({ icon: 'cut', active: true });
        alert("Serviço Salvo!");
    };

    const deleteService = async (id: string) => {
        if(confirm("Tem certeza que deseja excluir este serviço?")) {
            await StorageService.deleteService(id);
        }
    }

    // Config Save Logic
    const saveConfig = async () => {
        if (!config) return;

        // Calculate password hash if changed
        let passHash = config.adminPassHash;
        if (editPass && editPass.trim() !== '') {
            passHash = simpleHash(editPass);
        }

        const newConf = {
            ...config,
            logoBase64: newLogo || config.logoBase64,
            adminEmail: editEmail || config.adminEmail,
            adminPassHash: passHash
        };

        await StorageService.saveConfig(newConf);
        setEditPass(''); // Clear password field after save
        alert("Configurações salvas com sucesso!");
    };
    
    // Stats Logic
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
            monthly: calcTotal(startOfMonth),
            pendingAppts: appointments.filter(a => a.status === AppointmentStatus.PENDING).length,
            pendingOrders: orders.filter(o => o.status === OrderStatus.PENDING).length
        };
    };
    
    const stats = getStats();
    
    // Filter cancelled appointments for display
    const visibleAppointments = appointments.filter(a => a.status !== AppointmentStatus.CANCELLED);

    if (!config) return <div className="h-screen flex items-center justify-center bg-gray-100 text-gray-500">Carregando Painel...</div>;

    // --- Sidebar Component ---
    const SidebarItem = ({ id, icon, label }: { id: typeof activeTab, icon: string, label: string }) => (
        <button 
            onClick={() => setActiveTab(id)}
            className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${activeTab === id ? 'bg-theme-accent text-white shadow-lg' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
        >
            <i className={`fas fa-${icon} w-6 text-center`}></i>
            <span className="font-medium">{label}</span>
        </button>
    );

    return (
        <div className="flex h-screen bg-gray-100 overflow-hidden font-sans">
            {/* Sidebar */}
            <aside className="w-64 bg-gray-900 text-white flex flex-col shadow-2xl z-20 hidden md:flex">
                <div className="p-6 border-b border-gray-800 flex flex-col items-center">
                    {config.logoBase64 ? (
                        <img src={config.logoBase64} className="h-16 w-16 rounded-full object-cover border-2 border-theme-accent mb-3"/>
                    ) : (
                        <div className="h-16 w-16 bg-gray-800 rounded-full flex items-center justify-center border-2 border-gray-700 mb-3 text-2xl">
                           <i className="fas fa-user-shield"></i>
                        </div>
                    )}
                    <h2 className="text-lg font-bold tracking-wide">Painel Admin</h2>
                    <p className="text-xs text-gray-500">Lielson Tattoo Studio</p>
                </div>
                
                <nav className="flex-1 py-6 space-y-1">
                    <SidebarItem id="dashboard" icon="chart-line" label="Visão Geral" />
                    <SidebarItem id="appointments" icon="calendar-check" label="Agendamentos" />
                    <SidebarItem id="services" icon="cut" label="Serviços" />
                    <SidebarItem id="orders" icon="shopping-bag" label="Pedidos" />
                    <SidebarItem id="products" icon="box-open" label="Produtos" />
                    <SidebarItem id="config" icon="cog" label="Configurações" />
                </nav>

                <div className="p-4 border-t border-gray-800">
                    <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 text-red-400 hover:text-red-300 transition py-2 text-sm uppercase font-bold tracking-wider">
                        <i className="fas fa-sign-out-alt"></i> Sair
                    </button>
                </div>
            </aside>
            
            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
                {/* Top Header */}
                <header className="bg-white shadow-sm h-16 flex items-center justify-between px-8 z-10">
                    <h2 className="text-xl font-bold text-gray-700 capitalize">
                        {activeTab === 'dashboard' ? 'Visão Geral' : activeTab}
                    </h2>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-sm font-bold text-gray-700">Administrador</p>
                            <p className="text-xs text-green-500 flex items-center justify-end gap-1">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Online
                            </p>
                        </div>
                    </div>
                </header>

                {/* Content Scroll Area */}
                <div className="flex-1 overflow-y-auto p-8">
                    
                    {activeTab === 'dashboard' && (
                        <div className="space-y-8">
                            {/* Key Metrics */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl"><i className="fas fa-calendar-alt"></i></div>
                                    <div>
                                        <p className="text-sm text-gray-500">Agendamentos Pendentes</p>
                                        <p className="text-2xl font-bold text-gray-800">{stats.pendingAppts}</p>
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xl"><i className="fas fa-shopping-cart"></i></div>
                                    <div>
                                        <p className="text-sm text-gray-500">Pedidos Pendentes</p>
                                        <p className="text-2xl font-bold text-gray-800">{stats.pendingOrders}</p>
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xl"><i className="fas fa-dollar-sign"></i></div>
                                    <div>
                                        <p className="text-sm text-gray-500">Vendas Hoje</p>
                                        <p className="text-2xl font-bold text-gray-800">R$ {stats.daily.toFixed(2)}</p>
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xl"><i className="fas fa-chart-line"></i></div>
                                    <div>
                                        <p className="text-sm text-gray-500">Vendas Mês</p>
                                        <p className="text-2xl font-bold text-gray-800">R$ {stats.monthly.toFixed(2)}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                    <h3 className="font-bold text-gray-700 mb-4 border-b pb-2">Últimos Agendamentos</h3>
                                    {visibleAppointments.slice(0,5).map(a => (
                                        <div key={a.id} className="flex justify-between items-center py-3 border-b last:border-0 hover:bg-gray-50 px-2 transition">
                                            <div>
                                                <p className="font-bold text-sm text-gray-800">{a.name}</p>
                                                <p className="text-xs text-gray-500">{a.serviceName}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold">{a.date.split('-').reverse().join('/')} - {a.time}</p>
                                                <span className={`text-[10px] px-2 py-0.5 rounded text-white ${a.status === 'CONFIRMADO' ? 'bg-green-500' : 'bg-yellow-500'}`}>{a.status}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                    <h3 className="font-bold text-gray-700 mb-4 border-b pb-2">Últimos Pedidos</h3>
                                    {orders.slice(0,5).map(o => (
                                        <div key={o.id} className="flex justify-between items-center py-3 border-b last:border-0 hover:bg-gray-50 px-2 transition">
                                            <div>
                                                <p className="font-bold text-sm text-gray-800">{o.clientName}</p>
                                                <p className="text-xs text-gray-500">{o.delivery ? 'Entrega' : 'Retirada'} - {o.items.length} itens</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-theme-accent">R$ {o.total.toFixed(2)}</p>
                                                <span className={`text-[10px] px-2 py-0.5 rounded text-white ${o.status === 'PENDENTE' ? 'bg-yellow-500' : 'bg-green-500'}`}>{o.status}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'appointments' && (
                         <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-semibold border-b">
                                    <tr>
                                        <th className="p-4">Data/Hora</th>
                                        <th className="p-4">Cliente</th>
                                        <th className="p-4">Serviço</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                                    {visibleAppointments.map(a => (
                                        <tr key={a.id} className="hover:bg-blue-50 transition-colors">
                                            <td className="p-4">
                                                <div className="font-bold text-gray-900">{a.date.split('-').reverse().join('/')}</div>
                                                <div className="text-gray-500">{a.time}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-medium">{a.name}</div>
                                                <a href={`https://wa.me/55${a.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="text-green-600 text-xs hover:underline flex items-center gap-1 mt-1">
                                                    <i className="fab fa-whatsapp"></i> {a.phone}
                                                </a>
                                            </td>
                                            <td className="p-4">{a.serviceName}</td>
                                            <td className="p-4">
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                    a.status === 'CONFIRMADO' ? 'bg-green-100 text-green-700' : 
                                                    a.status === 'CANCELADO' ? 'bg-red-100 text-red-700' : 
                                                    'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                    {a.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right space-x-2">
                                                {a.status === 'PENDENTE' && (
                                                    <button onClick={() => handleApptAction(a.id, AppointmentStatus.CONFIRMED)} className="text-white bg-green-500 hover:bg-green-600 w-8 h-8 rounded-full shadow transition" title="Confirmar"><i className="fas fa-check"></i></button>
                                                )}
                                                <button onClick={() => handleApptAction(a.id, AppointmentStatus.CANCELLED)} className="text-white bg-red-400 hover:bg-red-500 w-8 h-8 rounded-full shadow transition" title="Cancelar"><i className="fas fa-times"></i></button>
                                                <button onClick={() => setViewDetail(a)} className="text-gray-600 bg-gray-200 hover:bg-gray-300 w-8 h-8 rounded-full shadow transition" title="Ver Detalhes"><i className="fas fa-eye"></i></button>
                                            </td>
                                        </tr>
                                    ))}
                                    {visibleAppointments.length === 0 && (
                                        <tr><td colSpan={5} className="p-8 text-center text-gray-400">Nenhum agendamento encontrado.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                    
                    {activeTab === 'services' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                             <div className="lg:col-span-1">
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 sticky top-4">
                                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><i className="fas fa-plus-circle text-theme-accent"></i> Novo Serviço</h3>
                                    <div className="space-y-4">
                                        <input className="w-full border bg-gray-50 p-2 rounded focus:ring-2 focus:ring-theme-accent outline-none" placeholder="Nome do Serviço" value={newService.name || ''} onChange={e => setNewService({...newService, name: e.target.value})} />
                                        <div className="flex gap-2">
                                            <input className="w-full border bg-gray-50 p-2 rounded focus:ring-2 focus:ring-theme-accent outline-none" type="number" placeholder="Preço (R$)" value={newService.price || ''} onChange={e => setNewService({...newService, price: parseFloat(e.target.value)})} />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 mb-1 block">Ícone</label>
                                            <div className="grid grid-cols-5 gap-2">
                                                {['cut', 'user-tie', 'shoe-prints', 'star', 'fire', 'hand-sparkles', 'spray-can', 'skull'].map(ic => (
                                                    <button key={ic} onClick={() => setNewService({...newService, icon: ic})} className={`p-2 rounded border ${newService.icon === ic ? 'bg-theme-accent text-white border-transparent' : 'bg-gray-50 text-gray-500 hover:bg-gray-200'}`}>
                                                        <i className={`fas fa-${ic}`}></i>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <button onClick={saveService} className="w-full bg-theme-accent text-white font-bold py-2 rounded hover:shadow-lg transition">Salvar Serviço</button>
                                    </div>
                                </div>
                             </div>

                             <div className="lg:col-span-2 space-y-4">
                                 {services.map(s => (
                                     <div key={s.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
                                         <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 text-xl">
                                             <i className={`fas fa-${s.icon}`}></i>
                                         </div>
                                         <div className="flex-1">
                                             <input 
                                                className="font-bold text-gray-800 border-b border-transparent hover:border-gray-300 focus:border-theme-accent outline-none bg-transparent"
                                                value={s.name}
                                                onChange={(e) => {
                                                    const updated = services.map(x => x.id === s.id ? {...x, name: e.target.value} : x);
                                                    setServices(updated);
                                                }}
                                                onBlur={() => StorageService.saveService(s)}
                                             />
                                         </div>
                                         <div className="flex items-center gap-4">
                                             <div className="relative">
                                                 <span className="absolute left-2 top-1 text-xs text-gray-400">R$</span>
                                                 <input 
                                                    type="number"
                                                    className="w-20 pl-6 pr-2 py-1 border rounded text-right font-bold text-gray-800 outline-none focus:border-theme-accent"
                                                    value={s.price}
                                                    onChange={(e) => {
                                                        const val = parseFloat(e.target.value);
                                                        const updated = services.map(x => x.id === s.id ? {...x, price: val} : x);
                                                        setServices(updated);
                                                    }}
                                                    onBlur={() => StorageService.saveService(s)}
                                                 />
                                             </div>
                                             <button onClick={() => deleteService(s.id)} className="text-red-400 hover:text-red-600 transition p-2"><i className="fas fa-trash"></i></button>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                        </div>
                    )}

                    {activeTab === 'orders' && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-semibold border-b">
                                <tr>
                                    <th className="p-4">#ID / Data</th>
                                    <th className="p-4">Cliente</th>
                                    <th className="p-4">Tipo</th>
                                    <th className="p-4">Total</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                                {orders.map(o => (
                                    <tr key={o.id} className="hover:bg-blue-50 transition-colors">
                                        <td className="p-4">
                                            <div className="font-mono text-xs text-gray-400">...{o.id.slice(-6)}</div>
                                            <div className="font-medium">{new Date(o.createdAt).toLocaleDateString()}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-bold text-gray-900">{o.clientName}</div>
                                            <div className="text-xs text-gray-500">{o.phone}</div>
                                        </td>
                                        <td className="p-4">
                                            {o.delivery ? (
                                                <span className="flex items-center gap-1 text-blue-600"><i className="fas fa-motorcycle"></i> Entrega</span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-gray-600"><i className="fas fa-store"></i> Retirada</span>
                                            )}
                                        </td>
                                        <td className="p-4 font-bold text-gray-800">R$ {o.total.toFixed(2)}</td>
                                        <td className="p-4">
                                             <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                    o.status === 'ENTREGUE' ? 'bg-gray-800 text-white' : 
                                                    o.status === 'CONFIRMADO' ? 'bg-green-100 text-green-700' : 
                                                    o.status === 'CANCELADO' ? 'bg-red-100 text-red-700' : 
                                                    'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                    {o.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right space-x-2">
                                            {o.status === 'PENDENTE' && <button onClick={() => handleOrderAction(o.id, OrderStatus.CONFIRMED)} className="text-white bg-green-500 hover:bg-green-600 w-8 h-8 rounded-full shadow transition"><i className="fas fa-check"></i></button>}
                                            {o.status === 'CONFIRMADO' && o.delivery && <button onClick={() => handleOrderAction(o.id, OrderStatus.DELIVERED)} className="text-white bg-gray-700 hover:bg-gray-800 w-8 h-8 rounded-full shadow transition"><i className="fas fa-truck"></i></button>}
                                            <button onClick={() => setViewDetail(o)} className="text-gray-600 bg-gray-200 hover:bg-gray-300 w-8 h-8 rounded-full shadow transition"><i className="fas fa-eye"></i></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    )}

                    {activeTab === 'products' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                             <div className="lg:col-span-1">
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 sticky top-4">
                                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><i className="fas fa-plus-circle text-theme-accent"></i> Adicionar Produto</h3>
                                    <div className="space-y-4">
                                        <input className="w-full border bg-gray-50 p-2 rounded focus:ring-2 focus:ring-theme-accent outline-none" placeholder="Nome do Produto" value={newProd.name || ''} onChange={e => setNewProd({...newProd, name: e.target.value})} />
                                        <div className="flex gap-2">
                                            <input className="w-full border bg-gray-50 p-2 rounded focus:ring-2 focus:ring-theme-accent outline-none" type="number" placeholder="Preço" value={newProd.price || ''} onChange={e => setNewProd({...newProd, price: parseFloat(e.target.value)})} />
                                            <input className="w-full border bg-gray-50 p-2 rounded focus:ring-2 focus:ring-theme-accent outline-none" type="number" placeholder="Qtd" value={newProd.stock || ''} onChange={e => setNewProd({...newProd, stock: parseInt(e.target.value)})} />
                                        </div>
                                        {/* Restricted Categories for Admin Input */}
                                        <select 
                                            className="w-full border bg-gray-50 p-2 rounded focus:ring-2 focus:ring-theme-accent outline-none" 
                                            value={newProd.categoryId} 
                                            onChange={e => setNewProd({...newProd, categoryId: e.target.value})}
                                        >
                                            <option value="barbearia">Produto de Barbearia</option>
                                            <option value="roupas">Produto da Loja de Roupas</option>
                                        </select>
                                        
                                        <div className="border-2 border-dashed border-gray-300 rounded p-4 text-center cursor-pointer hover:bg-gray-50 relative">
                                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={async (e) => {
                                                if(e.target.files && e.target.files[0]) {
                                                    const reader = new FileReader();
                                                    reader.onload = (ev) => setProdImg(ev.target?.result as string);
                                                    reader.readAsDataURL(e.target.files[0]);
                                                }
                                            }} />
                                            {prodImg ? (
                                                <img src={prodImg} className="h-20 mx-auto object-contain" />
                                            ) : (
                                                <span className="text-xs text-gray-500">Clique para carregar imagem</span>
                                            )}
                                        </div>
                                        <button onClick={saveProduct} className="w-full bg-theme-accent text-white font-bold py-2 rounded hover:shadow-lg transition">Salvar Produto</button>
                                    </div>
                                </div>
                             </div>

                             <div className="lg:col-span-2 space-y-4">
                                 {products.map(p => (
                                     <div key={p.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
                                         <div className="h-16 w-16 bg-gray-100 rounded flex-shrink-0">
                                             {p.imageBase64 && <img src={p.imageBase64} className="h-full w-full object-cover rounded"/>}
                                         </div>
                                         <div className="flex-1">
                                             <h4 className="font-bold text-gray-800">{p.name}</h4>
                                             <p className="text-xs text-gray-500">{categories.find(c => c.id === p.categoryId)?.name || (p.categoryId === 'barbearia' ? 'Produto de Barbearia' : p.categoryId === 'roupas' ? 'Produto da Loja de Roupas' : 'Outros')}</p>
                                         </div>
                                         <div className="text-right">
                                             <p className="font-bold text-gray-800">R$ {p.price.toFixed(2)}</p>
                                             <p className={`text-xs font-bold ${p.stock > 0 ? 'text-green-600' : 'text-red-500'}`}>{p.stock} em estoque</p>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                        </div>
                    )}

                    {activeTab === 'config' && config && (
                        <div className="max-w-2xl bg-white p-8 rounded-xl shadow-sm border border-gray-200">
                             <h3 className="text-xl font-bold text-gray-800 mb-6 border-b pb-2">Configurações Gerais</h3>
                             
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                                 <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Logo & Identidade</label>
                                    <div className="flex items-center gap-4">
                                        {config.logoBase64 ? <img src={config.logoBase64} className="h-24 w-24 object-cover rounded-full border-4 border-gray-100 shadow-sm"/> : <div className="h-24 w-24 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-300">Sem Logo</div>}
                                        <label className="bg-gray-800 text-white text-xs px-3 py-2 rounded cursor-pointer hover:bg-gray-700 transition">
                                            Alterar Logo
                                            <input type="file" className="hidden" onChange={(e) => {
                                                if(e.target.files?.[0]) {
                                                    const reader = new FileReader();
                                                    reader.onload = (ev) => setNewLogo(ev.target?.result as string);
                                                    reader.readAsDataURL(e.target.files[0]);
                                                }
                                            }} />
                                        </label>
                                    </div>
                                 </div>
                                 <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm text-gray-600 mb-1">Cor Primária</label>
                                        <div className="flex items-center gap-2">
                                            <input type="color" value={config.primaryColor} onChange={e => setConfig({...config, primaryColor: e.target.value})} className="h-8 w-12 cursor-pointer border rounded"/>
                                            <span className="text-xs font-mono">{config.primaryColor}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-600 mb-1">Cor Secundária (Destaques)</label>
                                        <div className="flex items-center gap-2">
                                            <input type="color" value={config.accentColor} onChange={e => setConfig({...config, accentColor: e.target.value})} className="h-8 w-12 cursor-pointer border rounded"/>
                                            <span className="text-xs font-mono">{config.accentColor}</span>
                                        </div>
                                    </div>
                                 </div>
                             </div>

                             {/* Security Config */}
                             <div className="mb-8">
                                <h4 className="font-bold text-gray-700 mb-2 border-b pb-1"><i className="fas fa-lock text-xs mr-1"></i> Segurança e Acesso</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                                    <div>
                                        <label className="block text-sm text-gray-600 mb-1">E-mail do Admin</label>
                                        <input 
                                            type="email" 
                                            className="w-full border p-2 rounded text-sm bg-gray-50 focus:ring-1 focus:ring-theme-accent outline-none" 
                                            value={editEmail}
                                            onChange={(e) => setEditEmail(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-600 mb-1">Nova Senha</label>
                                        <input 
                                            type="password" 
                                            className="w-full border p-2 rounded text-sm bg-gray-50 focus:ring-1 focus:ring-theme-accent outline-none" 
                                            placeholder="Deixe em branco para manter"
                                            value={editPass}
                                            onChange={(e) => setEditPass(e.target.value)}
                                        />
                                    </div>
                                </div>
                             </div>

                             <div>
                                <h4 className="font-bold text-gray-700 mb-2">Bloqueio de Agenda</h4>
                                <p className="text-sm text-gray-500 mb-3">Selecione dias em que o estúdio não abrirá.</p>
                                <div className="flex gap-4 items-end mb-4">
                                    <input 
                                            type="date" 
                                            className="border p-2 rounded text-sm"
                                            onChange={(e) => {
                                                if(e.target.value) {
                                                    const dates = config.closedDates.includes(e.target.value) 
                                                        ? config.closedDates.filter(d => d !== e.target.value)
                                                        : [...config.closedDates, e.target.value];
                                                    setConfig({...config, closedDates: dates});
                                                }
                                            }}
                                    />
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {config.closedDates.map(d => (
                                        <span key={d} className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-1 rounded-full flex items-center gap-2">
                                            {d.split('-').reverse().join('/')} 
                                            <button onClick={() => setConfig({...config, closedDates: config.closedDates.filter(x => x !== d)})} className="hover:text-red-900 font-bold">×</button>
                                        </span>
                                    ))}
                                </div>
                             </div>

                             <div className="mt-8 pt-6 border-t border-gray-100 text-right">
                                <button onClick={saveConfig} className="bg-theme-accent text-white px-6 py-2 rounded shadow hover:opacity-90 transition font-bold">Salvar Alterações</button>
                             </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Detail Modal */}
            <Modal isOpen={!!viewDetail} onClose={() => setViewDetail(null)} title="Detalhes">
                {viewDetail && 'serviceName' in viewDetail ? (
                    // Appointment Details
                    <div className="space-y-4 text-white">
                        <div className="flex justify-between border-b border-gray-700 pb-2">
                            <span className="text-gray-400">Status</span>
                            <span className="font-bold">{viewDetail.status}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                 <p className="text-gray-400 text-xs">Cliente</p>
                                 <p className="font-bold">{viewDetail.name}</p>
                             </div>
                             <div>
                                 <p className="text-gray-400 text-xs">Contato</p>
                                 <p>{viewDetail.phone}</p>
                             </div>
                             <div>
                                 <p className="text-gray-400 text-xs">Data</p>
                                 <p>{viewDetail.date}</p>
                             </div>
                             <div>
                                 <p className="text-gray-400 text-xs">Hora</p>
                                 <p>{viewDetail.time}</p>
                             </div>
                        </div>
                        
                        <div className="bg-gray-700 p-3 rounded">
                            <p className="text-theme-accent font-bold text-sm mb-1">Serviço: {viewDetail.serviceName}</p>
                            <p className="text-sm italic text-gray-300">"{viewDetail.notes || 'Sem observações'}"</p>
                        </div>

                        {viewDetail.tattooBase64 && (
                            <div className="mt-2 border border-gray-700 rounded p-2">
                                <p className="font-bold text-xs mb-2 text-gray-400">REFERÊNCIA VISUAL:</p>
                                <img src={viewDetail.tattooBase64} alt="Ref" className="w-full h-48 object-contain bg-black rounded" />
                                <div className="flex justify-between text-xs mt-2 text-gray-400">
                                    <span>Local: {viewDetail.tattooLocation}</span>
                                    <span>Tam: {viewDetail.tattooSize}</span>
                                </div>
                            </div>
                        )}
                    </div>
                ) : viewDetail ? (
                    // Order Details
                    <div className="space-y-4 text-white">
                        <div className="flex justify-between items-center border-b border-gray-700 pb-2">
                            <span className="text-gray-400">Pedido #{viewDetail.id.slice(0,6)}</span>
                            <span className="bg-theme-accent text-xs px-2 py-1 rounded">{viewDetail.status}</span>
                        </div>
                        
                        <div className="bg-gray-900 p-3 rounded border border-gray-700">
                            <h4 className="font-bold text-sm text-gray-300 mb-2">Cliente</h4>
                            <p className="text-lg">{viewDetail.clientName}</p>
                            <p className="text-sm text-gray-400">{viewDetail.phone}</p>
                        </div>

                        {viewDetail.delivery && viewDetail.address && (
                            <div className="bg-gray-900 p-3 rounded border border-gray-700">
                                <h4 className="font-bold text-sm text-gray-300 mb-2">Endereço de Entrega</h4>
                                <p className="text-sm">{viewDetail.address.street}, {viewDetail.address.number}</p>
                                <p className="text-sm">{viewDetail.address.neighborhood}</p>
                                <p className="text-xs text-yellow-500 mt-1">Obs: {viewDetail.address.reference}</p>
                            </div>
                        )}

                        <div>
                            <h4 className="font-bold text-sm text-gray-400 mb-2">Itens</h4>
                            <ul className="space-y-2">
                                {viewDetail.items.map((i: any) => (
                                    <li key={i.id} className="flex justify-between text-sm border-b border-gray-800 pb-1">
                                        <span><span className="font-bold text-theme-accent">{i.quantity}x</span> {i.name}</span>
                                        <span>R$ {(i.price * i.quantity).toFixed(2)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        
                        <div className="flex justify-between font-bold text-xl pt-2 border-t border-gray-700">
                            <span>Total</span>
                            <span>R$ {viewDetail.total.toFixed(2)}</span>
                        </div>
                        <div className="text-xs text-gray-500 text-right">
                            Pagamento: <span className="uppercase">{viewDetail.paymentMethod}</span>
                            {viewDetail.changeFor && ` (Troco para R$ ${viewDetail.changeFor})`}
                        </div>
                    </div>
                ) : null}
            </Modal>
        </div>
    );
};

// --- PUBLIC PAGE ---
const PublicPage: React.FC = () => {
    const [config, setConfig] = useState<AdminConfig | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [services, setServices] = useState<ServiceItem[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    
    // Public Navigation State
    const [publicTab, setPublicTab] = useState<'home' | 'shop'>('home');
    
    // Booking
    const [showBooking, setShowBooking] = useState(false);
    const [selectedService, setSelectedService] = useState<ServiceItem | 'tattoo' | null>(null);
    const [bookingForm, setBookingForm] = useState({
        name: '', phone: '', date: '', time: '', notes: '', tattooSize: '', tattooLocation: ''
    });
    const [tattooRefImg, setTattooRefImg] = useState('');

    // Checkout
    const [showCheckout, setShowCheckout] = useState(false);
    const [checkoutData, setCheckoutData] = useState<{subtotal:number, discount:number, total:number, coupon?:string} | null>(null);
    const [orderForm, setOrderForm] = useState({
        name: '', phone: '', method: 'pix' as 'money'|'card'|'pix', delivery: false,
        address: { neighborhood: '', street: '', number: '', reference: '' },
        changeFor: ''
    });

    useEffect(() => {
        const init = async () => {
            setConfig(await StorageService.getConfig());
            setProducts(await StorageService.getProducts());
            setServices(await StorageService.getServices());
        };
        init();
    }, []);

    const addToCart = (product: Product) => {
        setCart(prev => {
            const existing = prev.find(p => p.id === product.id);
            if(existing) {
                return prev.map(p => p.id === product.id ? {...p, quantity: p.quantity + 1} : p);
            }
            return [...prev, {...product, quantity: 1}];
        });
        setIsCartOpen(true);
    };

    const submitBooking = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!selectedService) return;
        
        const isTattoo = selectedService === 'tattoo';
        const svcPrice = isTattoo ? 0 : (selectedService as ServiceItem).price;

        const appt: Appointment = {
            id: generateId(),
            serviceId: isTattoo ? 'custom-tattoo' : (selectedService as ServiceItem).id,
            serviceName: isTattoo ? 'Tatuagem (Orçamento)' : (selectedService as ServiceItem).name,
            price: svcPrice,
            name: bookingForm.name,
            phone: bookingForm.phone,
            date: bookingForm.date,
            time: bookingForm.time,
            status: AppointmentStatus.PENDING,
            createdAt: Date.now(),
            notes: bookingForm.notes,
            tattooBase64: tattooRefImg,
            tattooSize: bookingForm.tattooSize,
            tattooLocation: bookingForm.tattooLocation
        };

        await StorageService.saveAppointment(appt);
        alert('Agendamento solicitado! Aguarde confirmação pelo WhatsApp.');
        setShowBooking(false);
        setBookingForm({ name: '', phone: '', date: '', time: '', notes: '', tattooSize: '', tattooLocation: '' });
        setTattooRefImg('');
    };

    const submitOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!checkoutData) return;

        const order: Order = {
            id: generateId(),
            items: cart,
            clientName: orderForm.name,
            phone: orderForm.phone,
            delivery: orderForm.delivery,
            deliveryFee: orderForm.delivery ? 5 : 0, // Taxa fixa exemplo
            address: orderForm.delivery ? orderForm.address : undefined,
            paymentMethod: orderForm.method,
            changeFor: orderForm.method === 'money' ? parseFloat(orderForm.changeFor) : undefined,
            subtotal: checkoutData.subtotal,
            discount: checkoutData.discount,
            total: checkoutData.total + (orderForm.delivery ? 5 : 0),
            couponCode: checkoutData.coupon,
            status: OrderStatus.PENDING,
            createdAt: Date.now()
        };

        await StorageService.saveOrder(order);
        alert('Pedido realizado com sucesso! Acompanhe pelo WhatsApp.');
        setCart([]);
        setShowCheckout(false);
        setCheckoutData(null);
    };

    const openBooking = (svc: ServiceItem | 'tattoo') => {
        setSelectedService(svc);
        setShowBooking(true);
    };

    const barberProducts = products.filter(p => p.categoryId === 'barbearia');
    const clothesProducts = products.filter(p => p.categoryId === 'roupas');

    return (
        <div className="pb-20">
             {/* Navbar */}
             <nav className="bg-white shadow-sm sticky top-0 z-40 transition-all duration-300">
                <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        {config?.logoBase64 ? <img src={config.logoBase64} className="h-10 w-10 rounded-full object-cover"/> : <div className="h-10 w-10 bg-gray-900 rounded-full"></div>}
                        <span className="font-bold text-lg hidden sm:block tracking-wide">Lielson Tattoo</span>
                    </div>
                    
                    {/* Center Nav Links */}
                    <div className="flex gap-1 bg-gray-100 p-1 rounded-full">
                        <button 
                            onClick={() => setPublicTab('home')}
                            className={`px-5 py-1.5 rounded-full text-sm font-bold transition-all duration-300 ${publicTab === 'home' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            Início
                        </button>
                        <button 
                            onClick={() => setPublicTab('shop')}
                            className={`px-5 py-1.5 rounded-full text-sm font-bold transition-all duration-300 ${publicTab === 'shop' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            Loja
                        </button>
                    </div>

                    <div className="flex items-center gap-4">
                        <a href="#admin" className="text-xs font-bold text-gray-400 hover:text-theme-primary transition">ADMIN</a>
                        <button onClick={() => setIsCartOpen(true)} className="relative p-2 text-gray-700 hover:text-theme-accent transition transform hover:scale-110">
                            <i className="fas fa-shopping-bag text-xl"></i>
                            {cart.length > 0 && <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center animate-bounce">{cart.reduce((a,b)=>a+b.quantity,0)}</span>}
                        </button>
                    </div>
                </div>
             </nav>

             {/* === HOME TAB === */}
             {publicTab === 'home' && (
                 <>
                    {/* Hero with Tattoo Image */}
                    <header className="relative h-[550px] flex items-center justify-center text-center text-white overflow-hidden">
                        {/* Background Image */}
                        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat bg-fixed transform scale-105" style={{backgroundImage: "url('https://images.unsplash.com/photo-1590246294580-8c22d6455217?q=80&w=2000&auto=format&fit=crop')"}}></div>
                        
                        {/* Gradient Overlay for Text Readability */}
                        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80"></div>
                        
                        <div className="relative z-10 max-w-3xl mx-auto px-6 animate-fadeIn">
                            <div className="mb-4 inline-block px-3 py-1 border border-white/30 rounded-full text-xs font-bold uppercase tracking-widest bg-white/10 backdrop-blur-md">
                                Studio Profissional
                            </div>
                            <h1 className="text-5xl md:text-7xl font-extrabold mb-6 tracking-tight drop-shadow-xl leading-tight">
                                Arte, Estilo & <span className="text-theme-accent">Atitude</span>
                            </h1>
                            <p className="text-gray-200 text-lg md:text-xl mb-10 max-w-xl mx-auto font-light drop-shadow-md">
                                Transformando ideias em arte na pele e estilo no visual. Barbearia clássica e tatuagem exclusiva em um só lugar.
                            </p>
                            <button 
                                onClick={() => document.getElementById('booking')?.scrollIntoView({behavior:'smooth'})} 
                                className="bg-theme-accent hover:bg-yellow-600 text-white px-10 py-4 rounded-full font-bold text-lg shadow-2xl hover:shadow-orange-500/20 transition-all transform hover:-translate-y-1 active:scale-95 flex items-center gap-2 mx-auto"
                            >
                                <i className="fas fa-calendar-alt"></i> Agendar Agora
                            </button>
                        </div>
                    </header>

                    {/* Services / Booking Section */}
                    <section id="booking" className="py-20 max-w-6xl mx-auto px-4 bg-gray-50">
                        <div className="text-center mb-16">
                            <span className="text-theme-accent font-bold uppercase tracking-wider text-sm">Nossos Serviços</span>
                            <h2 className="text-4xl font-extrabold text-gray-900 mt-2">Escolha sua Experiência</h2>
                            <div className="w-20 h-1.5 bg-theme-accent mx-auto mt-4 rounded-full"></div>
                        </div>
                        
                        {/* Mobile Optimized Grid: 2 columns on mobile, 4 on desktop */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
                            {/* Dynamic Services from DB */}
                            {services.map((service) => (
                                <div key={service.id} onClick={() => openBooking(service)} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-theme-accent/30 transition-all duration-300 cursor-pointer group text-center relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gray-100 group-hover:bg-theme-accent transition-colors duration-300"></div>
                                    <div className="w-16 h-16 mx-auto bg-gray-50 rounded-full flex items-center justify-center text-3xl mb-5 group-hover:bg-theme-accent group-hover:text-white transition-all duration-300 text-gray-700 shadow-inner group-hover:scale-110">
                                        <i className={`fas fa-${service.icon}`}></i>
                                    </div>
                                    <h3 className="font-bold text-lg text-gray-800 mb-1 group-hover:text-theme-accent transition-colors">{service.name}</h3>
                                    <div className="flex items-center justify-center gap-1 text-gray-900 font-extrabold text-xl">
                                        <span className="text-xs font-normal text-gray-500 self-start mt-1">R$</span>
                                        {service.price.toFixed(2)}
                                    </div>
                                    <button className="mt-4 text-xs font-bold text-gray-400 group-hover:text-theme-accent uppercase tracking-wide flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        Agendar <i className="fas fa-arrow-right"></i>
                                    </button>
                                </div>
                            ))}
                            
                            {/* Static Tattoo Budget Service - Featured Card */}
                            <div onClick={() => openBooking('tattoo')} className="bg-gray-900 text-white p-6 rounded-2xl shadow-xl border border-gray-800 hover:scale-[1.03] transition-all duration-300 cursor-pointer text-center relative overflow-hidden group col-span-2 md:col-span-1">
                                <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                                <div className="relative z-10 flex flex-col items-center justify-center h-full">
                                    <div className="w-16 h-16 mx-auto bg-gray-800 rounded-full flex items-center justify-center text-3xl mb-4 text-theme-accent border-2 border-theme-accent shadow-[0_0_15px_rgba(217,119,6,0.3)] animate-pulse-slow">
                                        <i className="fas fa-dragon"></i>
                                    </div>
                                    <h3 className="font-bold text-lg mb-1 text-white">Orçamento Tattoo</h3>
                                    <p className="text-gray-400 text-xs mb-3">Envie sua ideia e agende uma sessão exclusiva.</p>
                                    <span className="inline-block bg-theme-accent text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wide shadow-lg transform group-hover:-translate-y-0.5 transition-transform">
                                        Fazer Orçamento
                                    </span>
                                </div>
                            </div>
                        </div>
                    </section>
                 </>
             )}

             {/* === SHOP TAB === */}
             {publicTab === 'shop' && (
                 <div className="min-h-screen bg-gray-50">
                    <header className="bg-white border-b py-8 text-center">
                        <h1 className="text-3xl font-bold text-gray-800">Loja Oficial</h1>
                        <p className="text-gray-500">Produtos selecionados para o seu estilo.</p>
                    </header>
                    
                    <div className="max-w-6xl mx-auto px-4 py-12 space-y-16">
                        
                        {/* Section 1: Barber */}
                        <div>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="h-10 w-10 bg-gray-900 text-white rounded flex items-center justify-center text-xl"><i className="fas fa-pump-soap"></i></div>
                                <h2 className="text-2xl font-bold text-gray-800">Barbearia & Cuidados</h2>
                            </div>
                            
                            {barberProducts.length === 0 ? (
                                <p className="text-gray-400 italic">Nenhum produto cadastrado nesta categoria.</p>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                    {barberProducts.map(p => (
                                        <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-all duration-300 group">
                                            <div className="h-48 bg-gray-100 relative overflow-hidden">
                                                {p.imageBase64 ? (
                                                    <img src={p.imageBase64} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-300"><i className="fas fa-image text-3xl"></i></div>
                                                )}
                                                {p.stock <= 0 && <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white font-bold uppercase tracking-wider">Esgotado</div>}
                                            </div>
                                            <div className="p-4">
                                                <h4 className="font-bold text-gray-800 truncate mb-1" title={p.name}>{p.name}</h4>
                                                <p className="text-theme-accent font-bold text-lg mb-3">R$ {p.price.toFixed(2)}</p>
                                                <button 
                                                    disabled={p.stock <= 0}
                                                    onClick={() => addToCart(p)}
                                                    className={`w-full py-2 rounded-lg font-bold text-sm transition ${p.stock > 0 ? 'bg-gray-900 text-white hover:bg-gray-800' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                                                >
                                                    {p.stock > 0 ? 'Adicionar' : 'Indisponível'}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <hr className="border-gray-200" />

                        {/* Section 2: Clothes */}
                        <div>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="h-10 w-10 bg-theme-accent text-white rounded flex items-center justify-center text-xl"><i className="fas fa-tshirt"></i></div>
                                <h2 className="text-2xl font-bold text-gray-800">Estilo & Roupas</h2>
                            </div>

                            {clothesProducts.length === 0 ? (
                                <p className="text-gray-400 italic">Nenhum produto cadastrado nesta categoria.</p>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                    {clothesProducts.map(p => (
                                        <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-all duration-300 group">
                                            <div className="h-48 bg-gray-100 relative overflow-hidden">
                                                {p.imageBase64 ? (
                                                    <img src={p.imageBase64} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-300"><i className="fas fa-image text-3xl"></i></div>
                                                )}
                                                {p.stock <= 0 && <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white font-bold uppercase tracking-wider">Esgotado</div>}
                                            </div>
                                            <div className="p-4">
                                                <h4 className="font-bold text-gray-800 truncate mb-1" title={p.name}>{p.name}</h4>
                                                <p className="text-theme-accent font-bold text-lg mb-3">R$ {p.price.toFixed(2)}</p>
                                                <button 
                                                    disabled={p.stock <= 0}
                                                    onClick={() => addToCart(p)}
                                                    className={`w-full py-2 rounded-lg font-bold text-sm transition ${p.stock > 0 ? 'bg-gray-900 text-white hover:bg-gray-800' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                                                >
                                                    {p.stock > 0 ? 'Adicionar' : 'Indisponível'}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                    </div>
                 </div>
             )}

             {/* Footer - Always Visible */}
             <footer className="bg-gray-900 text-white py-12 px-4 border-t border-gray-800 text-center">
                 <div className="max-w-4xl mx-auto">
                    {config?.logoBase64 && <img src={config.logoBase64} className="h-16 w-16 rounded-full object-cover mx-auto mb-4 border-2 border-theme-accent" />}
                    <h3 className="text-xl font-bold mb-2">Lielson Tattoo Studio</h3>
                    <p className="text-gray-500 text-sm mb-6">Arte, estilo e atitude em um só lugar.</p>
                    <div className="flex justify-center gap-6 text-2xl text-gray-400">
                        <a href="#" className="hover:text-white transition"><i className="fab fa-instagram"></i></a>
                        <a href="#" className="hover:text-white transition"><i className="fab fa-whatsapp"></i></a>
                        <a href="#" className="hover:text-white transition"><i className="fab fa-facebook"></i></a>
                    </div>
                    <p className="text-gray-700 text-xs mt-8">© 2023 Lielson Tattoo Studio. Todos os direitos reservados.</p>
                 </div>
             </footer>

             {/* Booking Modal */}
             <Modal isOpen={showBooking} onClose={() => setShowBooking(false)} title={`Agendar ${selectedService === 'tattoo' ? 'Tatuagem' : 'Serviço'}`}>
                <form onSubmit={submitBooking} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">Seu Nome</label>
                            <input required className="w-full border p-2 rounded bg-gray-50" value={bookingForm.name} onChange={e => setBookingForm({...bookingForm, name: e.target.value})} />
                        </div>
                        <div className="col-span-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">WhatsApp</label>
                            <input required className="w-full border p-2 rounded bg-gray-50" placeholder="(00) 00000-0000" value={bookingForm.phone} onChange={e => setBookingForm({...bookingForm, phone: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Data</label>
                            <input required type="date" className="w-full border p-2 rounded bg-gray-50" value={bookingForm.date} onChange={e => setBookingForm({...bookingForm, date: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Hora</label>
                            <input required type="time" className="w-full border p-2 rounded bg-gray-50" value={bookingForm.time} onChange={e => setBookingForm({...bookingForm, time: e.target.value})} />
                        </div>
                    </div>
                    
                    {selectedService === 'tattoo' && (
                        <div className="bg-gray-50 p-3 rounded border border-gray-200 space-y-3">
                            <p className="font-bold text-sm text-gray-800">Detalhes da Tatuagem</p>
                            <div className="grid grid-cols-2 gap-3">
                                <input placeholder="Tamanho (ex: 15cm)" className="border p-2 rounded" value={bookingForm.tattooSize} onChange={e => setBookingForm({...bookingForm, tattooSize: e.target.value})} />
                                <input placeholder="Local do corpo" className="border p-2 rounded" value={bookingForm.tattooLocation} onChange={e => setBookingForm({...bookingForm, tattooLocation: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Referência (Imagem)</label>
                                <input type="file" className="text-sm" onChange={(e) => {
                                    if(e.target.files?.[0]) {
                                        const r = new FileReader();
                                        r.onload = (ev) => setTattooRefImg(ev.target?.result as string);
                                        r.readAsDataURL(e.target.files[0]);
                                    }
                                }} />
                            </div>
                            {tattooRefImg && <img src={tattooRefImg} className="h-32 object-contain bg-white border rounded" />}
                        </div>
                    )}
                    
                    <div>
                         <label className="text-xs font-bold text-gray-500 uppercase">Observações</label>
                         <textarea className="w-full border p-2 rounded bg-gray-50" rows={2} value={bookingForm.notes} onChange={e => setBookingForm({...bookingForm, notes: e.target.value})}></textarea>
                    </div>

                    <button className="w-full bg-theme-accent text-white font-bold py-3 rounded shadow-lg hover:opacity-90 transition">Confirmar Agendamento</button>
                </form>
             </Modal>

             {/* Checkout Modal */}
             <Modal isOpen={showCheckout} onClose={() => setShowCheckout(false)} title="Finalizar Pedido">
                 {checkoutData && (
                     <form onSubmit={submitOrder} className="space-y-4">
                        <div className="bg-gray-50 p-3 rounded border text-sm flex justify-between font-bold text-gray-700">
                            <span>Total a Pagar:</span>
                            <span className="text-lg">R$ {(checkoutData.total + (orderForm.delivery ? 5 : 0)).toFixed(2)}</span>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-3">
                            <input required placeholder="Seu Nome Completo" className="border p-2 rounded" value={orderForm.name} onChange={e => setOrderForm({...orderForm, name: e.target.value})} />
                            <input required placeholder="WhatsApp para contato" className="border p-2 rounded" value={orderForm.phone} onChange={e => setOrderForm({...orderForm, phone: e.target.value})} />
                        </div>

                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" checked={!orderForm.delivery} onChange={() => setOrderForm({...orderForm, delivery: false})} />
                                <span className="text-sm font-bold text-gray-700">Retirar na Loja</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" checked={orderForm.delivery} onChange={() => setOrderForm({...orderForm, delivery: true})} />
                                <span className="text-sm font-bold text-gray-700">Entrega (+ R$ 5,00)</span>
                            </label>
                        </div>

                        {orderForm.delivery && (
                            <div className="bg-blue-50 p-3 rounded border border-blue-100 space-y-2 animate-fadeIn">
                                <h4 className="text-xs font-bold text-blue-800 uppercase">Endereço de Entrega</h4>
                                <input required placeholder="Bairro" className="w-full border p-2 rounded text-sm" value={orderForm.address.neighborhood} onChange={e => setOrderForm({...orderForm, address: {...orderForm.address, neighborhood: e.target.value}})} />
                                <div className="flex gap-2">
                                    <input required placeholder="Rua" className="w-3/4 border p-2 rounded text-sm" value={orderForm.address.street} onChange={e => setOrderForm({...orderForm, address: {...orderForm.address, street: e.target.value}})} />
                                    <input required placeholder="Nº" className="w-1/4 border p-2 rounded text-sm" value={orderForm.address.number} onChange={e => setOrderForm({...orderForm, address: {...orderForm.address, number: e.target.value}})} />
                                </div>
                                <input placeholder="Ponto de Referência" className="w-full border p-2 rounded text-sm" value={orderForm.address.reference} onChange={e => setOrderForm({...orderForm, address: {...orderForm.address, reference: e.target.value}})} />
                            </div>
                        )}
                        
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Forma de Pagamento</label>
                            <select className="w-full border p-2 rounded" value={orderForm.method} onChange={e => setOrderForm({...orderForm, method: e.target.value as any})}>
                                <option value="pix">PIX (Chave Celular/Email)</option>
                                <option value="card">Cartão (Na entrega/retirada)</option>
                                <option value="money">Dinheiro</option>
                            </select>
                        </div>

                        {orderForm.method === 'money' && (
                             <input placeholder="Troco para quanto?" className="w-full border p-2 rounded" value={orderForm.changeFor} onChange={e => setOrderForm({...orderForm, changeFor: e.target.value})} />
                        )}

                        <button className="w-full bg-green-600 text-white font-bold py-3 rounded shadow hover:bg-green-700 transition">
                            <i className="fab fa-whatsapp mr-2"></i> Enviar Pedido
                        </button>
                     </form>
                 )}
             </Modal>

             <CartSidebar 
                isOpen={isCartOpen} 
                onClose={() => setIsCartOpen(false)} 
                cart={cart} 
                setCart={setCart} 
                onCheckout={(sub, disc, tot, coup) => {
                    setCheckoutData({ subtotal: sub, discount: disc, total: tot, coupon: coup });
                    setShowCheckout(true);
                    setIsCartOpen(false);
                }} 
            />
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

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        const email = (e.target as any).email.value;
        const pass = (e.target as any).pass.value;
        
        // Fetch config from DB
        const config = await StorageService.getConfig();
        if (email === config.adminEmail && simpleHash(pass) === config.adminPassHash) {
            sessionStorage.setItem('lt_session', 'true');
            setAdminUser(true);
        } else {
            alert('Credenciais inválidas ou erro de conexão');
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
                <div className="flex items-center justify-center min-h-screen bg-gray-900 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
                    <div className="w-full max-w-md bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700 transform transition-all hover:scale-[1.01]">
                        <div className="text-center mb-8">
                            <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-theme-accent text-theme-accent shadow-lg">
                                <i className="fas fa-lock text-3xl"></i>
                            </div>
                            <h2 className="text-3xl font-bold text-white tracking-tight">Acesso Restrito</h2>
                            <p className="text-gray-400 text-sm mt-1">Lielson Tattoo Studio</p>
                        </div>
                        
                        <form onSubmit={handleLogin} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">E-mail</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-3 text-gray-500"><i className="fas fa-envelope"></i></span>
                                    <input name="email" type="text" placeholder="Digite seu e-mail" className="w-full border border-gray-600 bg-gray-900 bg-opacity-50 pl-10 p-3 rounded-lg text-white focus:ring-2 focus:ring-theme-accent focus:border-transparent outline-none transition" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Senha</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-3 text-gray-500"><i className="fas fa-key"></i></span>
                                    <input name="pass" type="password" placeholder="••••••••" className="w-full border border-gray-600 bg-gray-900 bg-opacity-50 pl-10 p-3 rounded-lg text-white focus:ring-2 focus:ring-theme-accent focus:border-transparent outline-none transition" />
                                </div>
                            </div>
                            <button className="w-full bg-gradient-to-r from-orange-600 to-amber-600 text-white py-3 rounded-lg font-bold shadow-lg hover:shadow-xl hover:opacity-90 transition transform active:scale-95 uppercase tracking-wide">
                                Entrar no Painel
                            </button>
                        </form>
                        
                        <div className="mt-6 text-center">
                             <a href="#" className="text-gray-500 hover:text-white text-sm transition flex items-center justify-center gap-2">
                                <i className="fas fa-arrow-left"></i> Voltar ao site
                             </a>
                        </div>
                    </div>
                </div>
            )}

            {view === 'admin' && adminUser && (
                <AdminPanel onLogout={handleLogout} />
            )}
        </Layout>
    );
}