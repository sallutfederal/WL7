'use client';
import { useEffect, useState } from 'react';

export default function BotsPage() {
  const [targets, setTargets] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', webhook: '', note: '' });

  async function load() { const r = await fetch('/api/targets'); setTargets(await r.json()); }
  useEffect(() => { load(); }, []);

  async function save() {
    await fetch('/api/targets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setForm({ name: '', webhook: '', note: '' }); load();
  }

  async function remove(name: string) {
    if (!confirm('Excluir ' + name + '?')) return;
    await fetch('/api/targets?name=' + encodeURIComponent(name), { method: 'DELETE' });
    load();
  }

  async function pushConfig(name: string) {
    const r = await fetch('/api/pushconfig/' + encodeURIComponent(name), { method: 'POST' });
    const d = await r.json();
    alert(d.ok ? 'Config enviada para ' + name : 'Erro: ' + (d.error || ''));
  }

  async function pushAll() {
    const r = await fetch('/api/pushall', { method: 'POST' });
    const d = await r.json();
    alert('Push concluido: ' + (d.results || []).map((x: any) => x.name + (x.ok ? ' OK' : ' FAIL')).join(', '));
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-[#d4af37]">Bots Registrados</h1>
      <div className="bg-[#14141a] border border-[#2a2a35] rounded-2xl p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nome" className="bg-[#1e1e26] border border-[#2a2a35] text-white px-4 py-2 rounded-lg" />
          <input value={form.webhook} onChange={e => setForm({ ...form, webhook: e.target.value })} placeholder="Webhook" className="bg-[#1e1e26] border border-[#2a2a35] text-white px-4 py-2 rounded-lg" />
          <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Nota" className="bg-[#1e1e26] border border-[#2a2a35] text-white px-4 py-2 rounded-lg" />
        </div>
        <button onClick={save} className="px-6 py-2 rounded-lg font-semibold text-black bg-gradient-to-r from-[#b8941f] to-[#ffd700]">+ Registrar</button>
      </div>
      <div className="bg-[#14141a] border border-[#2a2a35] rounded-2xl p-5">
        {targets.length === 0 ? <p className="text-gray-500 text-center py-8">Nenhum bot registrado</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-[#d4af37] text-xs uppercase"><th className="py-2 text-left">Nome</th><th className="py-2 text-left">Webhook</th><th className="py-2 text-left">Nota</th><th className="py-2 text-left">Acoes</th></tr></thead>
            <tbody>
              {targets.map((t: any) => (
                <tr key={t.name} className="border-t border-[#2a2a35]">
                  <td className="py-2 font-semibold">{t.name}</td>
                  <td className="text-xs text-gray-500">{t.webhook.slice(0, 50)}...</td>
                  <td>{t.note || '-'}</td>
                  <td className="flex gap-1">
                    <button onClick={() => pushConfig(t.name)} className="px-2 py-1 rounded bg-green-600 text-white text-xs">Push</button>
                    <button onClick={() => remove(t.name)} className="px-2 py-1 rounded bg-red-600 text-white text-xs">X</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="mt-4"><button onClick={pushAll} className="px-4 py-2 rounded-lg font-semibold text-black bg-gradient-to-r from-[#b8941f] to-[#ffd700]">Push All</button></div>
      </div>
    </div>
  );
}
