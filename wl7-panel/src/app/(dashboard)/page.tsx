'use client';
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, ShoppingCart, Package, Clock, Bot, Pin } from 'lucide-react';

type Status = { botName: string; currency: string; catalogs: number; products: number; orders: number; targets: number; pins: number; pendingOrders: number; paidOrders: number; revenue: number; };

export default function DashboardPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const s = await fetch('/api/status').then(r => r.json());
      setStatus(s);
      const o = await fetch('/api/orders').then(r => r.json());
      setOrders(o);
    }
    load();
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, []);

  const money = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: status?.currency || 'BRL' });

  const statusData = [
    { name: 'Pendentes', value: orders.filter(o => o.status === 'pending').length, color: '#fbbf24' },
    { name: 'Pagos', value: orders.filter(o => o.status === 'paid').length, color: '#22c55e' },
    { name: 'Entregues', value: orders.filter(o => o.status === 'delivered').length, color: '#3b82f6' },
    { name: 'Cancelados', value: orders.filter(o => o.status === 'cancelled').length, color: '#ef4444' },
  ];

  const catalogRevenue: Record<string, number> = {};
  orders.forEach(o => { if (o.status === 'paid' || o.status === 'delivered') catalogRevenue[o.catalog] = (catalogRevenue[o.catalog] || 0) + o.amount; });
  const catalogData = Object.entries(catalogRevenue).map(([name, value]) => ({ name, value }));

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2 text-[#d4af37]">Dashboard</h1>
      <p className="text-gray-500 mb-6">Bem-vindo de volta, WL7</p>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <Card label="Receita" value={money(status?.revenue || 0)} icon={<DollarSign className="w-6 h-6" />} color="#d4af37" />
        <Card label="Pagos" value={status?.paidOrders || 0} icon={<ShoppingCart className="w-6 h-6" />} color="#22c55e" />
        <Card label="Pendentes" value={status?.pendingOrders || 0} icon={<Clock className="w-6 h-6" />} color="#eab308" />
        <Card label="Produtos" value={status?.products || 0} icon={<Package className="w-6 h-6" />} color="#3b82f6" />
        <Card label="Bots" value={status?.targets || 0} icon={<Bot className="w-6 h-6" />} color="#d4af37" />
        <Card label="Fixadas" value={status?.pins || 0} icon={<Pin className="w-6 h-6" />} color="#ec4899" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-[#14141a] border border-[#2a2a35] rounded-2xl p-5">
          <h3 className="text-[#d4af37] font-semibold mb-4">Vendas por status</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50}>
                {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-[#14141a] border border-[#2a2a35] rounded-2xl p-5">
          <h3 className="text-[#d4af37] font-semibold mb-4">Receita por catalogo</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={catalogData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" />
              <XAxis dataKey="name" stroke="#8a8a95" />
              <YAxis stroke="#8a8a95" />
              <Tooltip />
              <Bar dataKey="value" fill="#d4af37" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-[#14141a] border border-[#2a2a35] rounded-2xl p-5">
        <h3 className="text-[#d4af37] font-semibold mb-4">Ultimos pedidos</h3>
        {orders.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Nenhum pedido ainda</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-[#d4af37] text-xs uppercase tracking-wider"><th className="py-2 text-left">ID</th><th className="py-2 text-left">Cliente</th><th className="py-2 text-left">Produto</th><th className="py-2 text-left">Valor</th><th className="py-2 text-left">Status</th><th className="py-2 text-left">Data</th></tr></thead>
            <tbody>
              {orders.slice(0, 8).map((o: any) => (
                <tr key={o.id} className="border-t border-[#2a2a35] hover:bg-[#1e1e26]">
                  <td className="py-2">#{o.id}</td>
                  <td>{o.userName}</td>
                  <td>{o.product}</td>
                  <td>{money(o.amount)}</td>
                  <td><span className="px-2 py-0.5 rounded text-xs font-semibold bg-yellow-500 text-black">{o.status}</span></td>
                  <td className="text-xs text-gray-500">{new Date(o.createdAt).toLocaleString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Card({ label, value, icon, color }: { label: string; value: any; icon: React.ReactNode; color: string }) {
  return (
    <div className="rounded-2xl p-5 border transition-all hover:-translate-y-1" style={{ background: `linear-gradient(135deg, ${color}20, #14141a)`, borderColor: color }}>
      <div className="flex justify-between items-start">
        <div>
          <div className="text-xs uppercase tracking-widest text-gray-500">{label}</div>
          <div className="text-2xl font-bold mt-2" style={{ color }}>{value}</div>
        </div>
        <div style={{ color }}>{icon}</div>
      </div>
    </div>
  );
}
