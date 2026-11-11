'use client';
import { useEffect, useState } from 'react';

export default function PinsPage() {
  const [pins, setPins] = useState<any[]>([]);
  const [catalogs, setCatalogs] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [form, setForm] = useState({ catalog: '', channelId: '' });

  async function load() {
    const [p, c, ch] = await Promise.all([
      fetch('/api/pins').then(r => r.json()),
      fetch('/api/catalogs').then(r => r.json()),
      fetch('/api/channels').then(r => r.json()),
    ]);
    setPins(p); setCatalogs(c); setChannels(ch);
    if (!form.catalog && c.length) setForm(f => ({ ...f, catalog: c[0].name }));
    if (!form.channelId && ch.length) setForm(f => ({ ...f, channelId: ch[0].id }));
  }
  useEffect(() => { load(); }, []);

  async function save() {
    await fetch('/api/pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ catalog: form.catalog, channelId: form.channelId }) });
    load();
  }

  async function remove(cat: string, ch: string) {
    if (!confirm('Remover fixada?')) return;
    await fetch('/api/pin', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ catalog: cat, channelId: ch }) });
    load();
  }

  async function refresh(cat: string) {
    await fetch('/api/refreshpin/' + encodeURIComponent(cat), { method: 'POST' });
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-[#d4af37]">Mensagens Fixas</h1>
      <div className="bg-[#14141a] border border-[#2a2a35] rounded-2xl p-5 mb-6">
        <div className="flex gap-3 mb-3">
          <select value={form.catalog} onChange={e => setForm({ ...form, catalog: e.target.value })} className="bg-[#1e1e26] border border-[#2a2a35] text-white px-4 py-2 rounded-lg">
            {catalogs.map((c: any) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
          <select value={form.channelId} onChange={e => setForm({ ...form, channelId: e.target.value })} className="bg-[#1e1e26] border border-[#2a2a35] text-white px-4 py-2 rounded-lg">
            {channels.map((c: any) => <option key={c.id} value={c.id}>#{c.name}</option>)}
          </select>
          <button onClick={save} className="px-6 py-2 rounded-lg font-semibold text-black bg-gradient-to-r from-[#b8941f] to-[#ffd700]">+ Fixar</button>
        </div>
      </div>
      <div className="bg-[#14141a] border border-[#2a2a35] rounded-2xl p-5">
        {pins.length === 0 ? <p className="text-gray-500 text-center py-8">Nenhuma fixada</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-[#d4af37] text-xs uppercase"><th className="py-2 text-left">Catalogo</th><th className="py-2 text-left">Canal</th><th className="py-2 text-left">Acoes</th></tr></thead>
            <tbody>
              {pins.map((p: any, i: number) => (
                <tr key={i} className="border-t border-[#2a2a35]">
                  <td className="py-2">{p.catalog}</td>
                  <td className="text-xs text-gray-500">{p.channelId}</td>
                  <td className="flex gap-1">
                    <button onClick={() => refresh(p.catalog)} className="px-2 py-1 rounded bg-[#1e1e26] text-xs">Atualizar</button>
                    <button onClick={() => remove(p.catalog, p.channelId)} className="px-2 py-1 rounded bg-red-600 text-white text-xs">X</button>
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
