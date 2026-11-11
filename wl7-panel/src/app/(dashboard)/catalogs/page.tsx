'use client';
import { useEffect, useState } from 'react';

export default function CatalogsPage() {
  const [catalogs, setCatalogs] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  async function load() {
    const r = await fetch('/api/catalogs');
    setCatalogs(await r.json());
  }
  useEffect(() => { load(); }, []);

  async function addCatalog() {
    if (!name) return;
    await fetch('/api/catalogs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description: desc }) });
    setName(''); setDesc(''); load();
  }

  async function removeCatalog(n: string) {
    if (!confirm('Excluir ' + n + '?')) return;
    await fetch('/api/catalogs?name=' + encodeURIComponent(n), { method: 'DELETE' });
    load();
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-[#d4af37]">Catalogos</h1>
      <div className="bg-[#14141a] border border-[#2a2a35] rounded-2xl p-5 mb-6">
        <div className="flex gap-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome" className="flex-1 bg-[#1e1e26] border border-[#2a2a35] text-white px-4 py-2 rounded-lg" />
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descricao" className="flex-1 bg-[#1e1e26] border border-[#2a2a35] text-white px-4 py-2 rounded-lg" />
          <button onClick={addCatalog} className="px-6 py-2 rounded-lg font-semibold text-black bg-gradient-to-r from-[#b8941f] to-[#ffd700]">+ Novo</button>
        </div>
      </div>
      <div className="bg-[#14141a] border border-[#2a2a35] rounded-2xl p-5">
        <table className="w-full text-sm">
          <thead><tr className="text-[#d4af37] text-xs uppercase"><th className="py-2 text-left">Nome</th><th className="py-2 text-left">Produtos</th><th className="py-2 text-left">Acoes</th></tr></thead>
          <tbody>
            {catalogs.map((c: any) => (
              <tr key={c.name} className="border-t border-[#2a2a35]">
                <td className="py-2 font-semibold">{c.name}</td>
                <td>{c.products?.length || 0}</td>
                <td><button onClick={() => removeCatalog(c.name)} className="px-3 py-1 rounded bg-red-600 text-white text-xs">Excluir</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
