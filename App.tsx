import React, { useState, useEffect } from 'react';
import { Layout, Modal } from './components/Layout';
import { CartSidebar } from './components/CartSidebar';
import { 
  Appointment, Product, Category, ServiceType, 
  AppointmentStatus, Order, OrderStatus, CartItem, AdminConfig 
} from './types';
import { StorageService, generateId, simpleHash } from './services/storageService';

// --- Sub-components for specific pages ---

// --- 1. ADMIN PANEL (Re-designed) ---
const AdminPanel: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'appointments' | 'orders' | 'products' | 'config'>('dashboard');
    const [config, setConfig] = useState<AdminConfig | null>(null);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [viewDetail, setViewDetail] = useState<any>(null);

    // Realtime Subscriptions & Async Load
    useEffect(() => {
        const loadStatic = async () => {
            const conf = await StorageService.getConfig();
            setConfig(conf);
            const cats = await StorageService.getCategories();
            setCategories(cats);
        };
        loadStatic();

        const unsubAppt = StorageService.subscribeAppointments(setAppointments);
        const unsubOrders = StorageService.subscribeOrders(setOrders);
        const unsubProds = StorageService.subscribeProducts(setProducts);

        return () => {
            unsubAppt();
            unsubOrders();
            unsubProds();
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
            categoryId: newProd.categoryId || categories[0]?.id || 'c1',
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

    // Config State
    const [newLogo, setNewLogo] = useState('');
    const saveConfig = async () => {
        if (!config) return;
        const newConf = {
            ...config,
            logoBase64: newLogo || config.logoBase64
        };
        await StorageService.saveConfig(newConf);
        alert("Configurações salvas. Atualize a página para ver o novo tema.");
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

            {/* Mobile Header (Only visible on small screens) */}
            {/* For simplicity in this demo, we assume desktop admin usage or stacked layout on mobile would require more responsive css work, keeping it simple */}
            
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
                                    {appointments.slice(0,5).map(a => (
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
                                    {appointments.map(a => (
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
                                                {a.status !== 'CANCELADO' && (
                                                    <button onClick={() => handleApptAction(a.id, AppointmentStatus.CANCELLED)} className="text-white bg-red-400 hover:bg-red-500 w-8 h-8 rounded-full shadow transition" title="Cancelar"><i className="fas fa-times"></i></button>
                                                )}
                                                <button onClick={() => setViewDetail(a)} className="text-gray-600 bg-gray-200 hover:bg-gray-300 w-8 h-8 rounded-full shadow transition" title="Ver Detalhes"><i className="fas fa-eye"></i></button>
                                            </td>
                                        </tr>
                                    ))}
                                    {appointments.length === 0 && (
                                        <tr><td colSpan={5} className="p-8 text-center text-gray-400">Nenhum agendamento encontrado.</td></tr>
                                    )}
                                </tbody>
                            </table>
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
                                        <select className="w-full border bg-gray-50 p-2 rounded focus:ring-2 focus:ring-theme-accent outline-none" value={newProd.categoryId} onChange={e => setNewProd({...newProd, categoryId: e.target.value})}>
                                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
                                             <p className="text-xs text-gray-500">{categories.find(c => c.id === p.categoryId)?.name}</p>
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

// --- 2. PUBLIC PAGE ---
const PublicPage: React.FC = () => {
    const [config, setConfig] = useState<AdminConfig | null>(null);
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

    // Load Data Async
    useEffect(() => {
        const load = async () => {
            const c = await StorageService.getConfig();
            setConfig(c);
            const p = await StorageService.getProducts();
            setProducts(p);
            const cats = await StorageService.getCategories();
            setCategories(cats);
        };
        load();
    }, []);

    // Time Slot Logic (Async fetch of existing appointments)
    useEffect(() => {
        if (!apptForm.date || !config) return;
        
        // Check if date is closed
        if (config.closedDates.includes(apptForm.date)) {
            setAvailableSlots([]);
            return;
        }

        const fetchSlots = async () => {
            // Optimization: In a real large app, query only for this date. 
            // For now, we fetch all (as per previous logic) but async.
            const existing = await StorageService.getAppointmentsOnce();
            
            const allSlots = ['09:00','09:30','10:00','10:30','11:00','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00'];
            
            const taken = existing
                .filter(a => a.date === apptForm.date && a.status !== AppointmentStatus.CANCELLED)
                .map(a => a.time);
            
            setAvailableSlots(allSlots.filter(s => !taken.includes(s)));
        };
        fetchSlots();

    }, [apptForm.date, config]);

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

    const submitAppointment = async () => {
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

        await StorageService.saveAppointment(appt);
        
        alert(`Agendamento enviado com sucesso! Aguarde a confirmação no WhatsApp.`);
        setApptForm({ ...apptForm, name: '', phone: '', date: '', time: '' });
        setTattooImg('');
        // Trigger re-fetch of slots
        const tempDate = apptForm.date;
        setApptForm(prev => ({...prev, date: ''}));
        setTimeout(() => setApptForm(prev => ({...prev, date: tempDate})), 100);
    };

    const submitOrder = async () => {
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

        await StorageService.saveOrder(order);
        
        alert("Pedido Enviado! Entraremos em contato.");
        setCart([]);
        setCartOpen(false);
        setCheckoutOpen(false);
    };

    const inputClasses = "w-full border border-gray-600 bg-gray-700 text-white p-2 rounded focus:ring-2 focus:ring-theme-accent outline-none placeholder-gray-400";

    if (!config) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Carregando...</div>;

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
                    <p className="text-xs mb-2">&copy; 2023 Lielson Tattoo Studio. Todos os direitos reservados.</p>
                    <a href="#admin" className="text-[10px] text-gray-700 hover:text-gray-400 uppercase tracking-widest">Área Administrativa</a>
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
                                    <input name="email" type="text" placeholder="admin@admin.com" className="w-full border border-gray-600 bg-gray-900 bg-opacity-50 pl-10 p-3 rounded-lg text-white focus:ring-2 focus:ring-theme-accent focus:border-transparent outline-none transition" />
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