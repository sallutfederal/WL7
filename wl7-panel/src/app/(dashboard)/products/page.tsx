'use client';
import { useEffect, useState } from 'react';

export default function ProductsPage() {
  const [catalogs, setCatalogs] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ catalog: '', name: '', price: '', description: '', stock: '-1' });

  async function load() {
    const r = await fetch('/api/catalogs');
    setCatalogs(await r.json());
  }
  useEffect(() => { load(); }, []);

  async function save() {
    await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ catalog: form.catalog, name: form.name, price: parseFloat(form.price), description: form.description, stock: parseInt(form.stock) }) });
    setModal(false); setForm({ catalog: '', name: '', price: '', description: '', stock: '-1' }); load();
  }

  async function remove(cat: string, name: string) {
    if (!confirm('Excluir ' + name + '?')) return;
    await fetch('/api/products?catalog=' + encodeURIComponent(cat) + '&name=' + encodeURIComponent(name), { method: 'DELETE' });
    load();
  }

  async function updateStock(cat: string, name: string, stock: number) {
    const v = prompt('Novo estoque (-1 = ilimitado):', String(stock));
    if (v === null) return;
    await fetch('/api/products/' + encodeURIComponent(cat) + '/' + encodeURIComponent(name) + '/stock', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stock: parseInt(v) }) });
    load();
  }

  const rows: any[] = [];
  for (const c of catalogs) {
    if (filter && c.name !== filter) continue;
    for (const p of (c.products || [])) rows.push({ catalog: c.name, ...p });
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-[#d4af37]">Produtos</h1>
      <div className="flex gap-3 mb-4">
        <select value={filter} onChange={e => setFilter(e.target.value)} className="bg-[#1e1e26] border border-[#2a2a35] text-white px-4 py-2 rounded-lg">
          <option value="">Todos</option>
          {catalogs.map((c: any) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
        <button onClick={() => { setForm({ ...form, catalog: catalogs[0]?.name || '' }); setModal(true); }} className="px-6 py-2 rounded-lg font-semibold text-black bg-gradient-to-r from-[#b8941f] to-[#ffd700]">+ Novo</button>
      </div>
      <div className="bg-[#14141a] border border-[#2a2a35] rounded-2xl p-5">
        {rows.length === 0 ? <p className="text-gray-500 text-center py-8">Nenhum produto</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-[#d4af37] text-xs uppercase"><th className="py-2 text-left">Catalogo</th><th className="py-2 text-left">Nome</th><th className="py-2 text-left">Preco</th><th className="py-2 text-left">Estoque</th><th className="py-2 text-left">Descricao</th><th className="py-2 text-left">Acoes</th></tr></thead>
            <tbody>
              {rows.map((p: any, i: number) => (
                <tr key={i} className="border-t border-[#2a2a35]">
                  <td className="py-2">{p.catalog}</td>
                  <td className="font-semibold">{p.name}</td>
                  <td>{Number(p.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td>{p.stock === -1 ? 'infinito' : p.stock}</td>
                  <td className="text-xs text-gray-500">{p.description || '-'}</td>
                  <td className="flex gap-1">
                    <button onClick={() => updateStock(p.catalog, p.name, p.stock)} className="px-2 py-1 rounded bg-[#1e1e26] text-xs">Estoque</button>
                    <button onClick={() => remove(p.catalog, p.name)} className="px-2 py-1 rounded bg-red-600 text-white text-xs">X</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#14141a] border border-[#2a2a35] rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-[#d4af37] font-semibold mb-4">Novo Produto</h3>
            <div className="space-y-3">
              <select value={form.catalog} onChange={e => setForm({ ...form, catalog: e.target.value })} className="w-full bg-[#1e1e26] border border-[#2a2a35] text-white px-4 py-2 rounded-lg">
                {catalogs.map((c: any) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nome" className="w-full bg-[#1e1e26] border border-[#2a2a35] text-white px-4 py-2 rounded-lg" />
              <div className="grid grid-cols-2 gap-3">
                <input value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="Preco" type="number" step="0.01" className="w-full bg-[#1e1e26] border border-[#2a2a35] text-white px-4 py-2 rounded-lg" />
                <input value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} placeholder="Estoque" type="number" className="w-full bg-[#1e1e26] border border-[#2a2a35] text-white px-4 py-2 rounded-lg" />
              </div>
              <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descricao" className="w-full bg-[#1e1e26] border border-[#2a2a35] text-white px-4 py-2 rounded-lg" />
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setModal(false)} className="px-4 py-2 rounded-lg bg-[#1e1e26] text-sm">Cancelar</button>
              <button onClick={save} className="px-4 py-2 rounded-lg font-semibold text-black bg-gradient-to-r from-[#b8941f] to-[#ffd700] text-sm">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
