'use client';
import { useEffect, useState } from 'react';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState('');

  async function load() {
    const r = await fetch('/api/orders');
    setOrders(await r.json());
  }
  useEffect(() => { load(); }, []);

  async function changeStatus(id: number, status: string) {
    if (!status) return;
    await fetch('/api/orders', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
    load();
  }

  async function deliver(id: number) {
    await fetch('/api/orders/' + id + '/deliver', { method: 'POST' });
    load();
  }

  const list = filter ? orders.filter(o => o.status === filter) : orders;

  const money = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-[#d4af37]">Pedidos</h1>
      <div className="mb-4">
        <select value={filter} onChange={e => setFilter(e.target.value)} className="bg-[#1e1e26] border border-[#2a2a35] text-white px-4 py-2 rounded-lg">
          <option value="">Todos</option><option value="pending">Pendentes</option><option value="paid">Pagos</option><option value="delivered">Entregues</option><option value="cancelled">Cancelados</option>
        </select>
      </div>
      <div className="bg-[#14141a] border border-[#2a2a35] rounded-2xl p-5">
        {list.length === 0 ? <p className="text-gray-500 text-center py-8">Nenhum pedido</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-[#d4af37] text-xs uppercase"><th className="py-2 text-left">ID</th><th className="py-2 text-left">Cliente</th><th className="py-2 text-left">Produto</th><th className="py-2 text-left">Valor</th><th className="py-2 text-left">Status</th><th className="py-2 text-left">Data</th><th className="py-2 text-left">Acoes</th></tr></thead>
            <tbody>
              {list.map((o: any) => (
                <tr key={o.id} className="border-t border-[#2a2a35]">
                  <td className="py-2">#{o.id}</td>
                  <td>{o.userName}</td>
                  <td>{o.product}</td>
                  <td>{money(o.amount)}</td>
                  <td><span className="px-2 py-0.5 rounded text-xs font-semibold bg-yellow-500 text-black">{o.status}</span></td>
                  <td className="text-xs text-gray-500">{new Date(o.createdAt).toLocaleString('pt-BR')}</td>
                  <td className="flex gap-1">
                    <select onChange={e => changeStatus(o.id, e.target.value)} className="bg-[#1e1e26] border border-[#2a2a35] text-white px-2 py-1 rounded text-xs">
                      <option value="">--</option><option value="paid">Pago</option><option value="delivered">Entregue</option><option value="cancelled">Cancelado</option>
                    </select>
                    <button onClick={() => deliver(o.id)} className="px-2 py-1 rounded bg-green-600 text-white text-xs">Entregar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
