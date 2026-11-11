'use client';
import { useEffect, useState } from 'react';

export default function SettingsPage() {
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('BRL');
  const [avatar, setAvatar] = useState('');
  const [banner, setBanner] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/status').then(r => r.json()).then(s => {
      setName(s.botName); setCurrency(s.currency); setAvatar(s.botAvatar); setBanner(s.botBanner);
    });
  }, []);

  async function save() {
    await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ botName: name, currency }) });
    if (avatarFile) {
      const fd = new FormData(); fd.append('file', avatarFile);
      await fetch('/api/upload?type=avatar', { method: 'POST', body: fd });
    }
    if (bannerFile) {
      const fd = new FormData(); fd.append('file', bannerFile);
      await fetch('/api/upload?type=banner', { method: 'POST', body: fd });
    }
    setMsg('Salvo!');
    setTimeout(() => setMsg(''), 3000);
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-[#d4af37]">Configuracoes</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#14141a] border border-[#2a2a35] rounded-2xl p-6">
          <h3 className="text-[#d4af37] font-semibold mb-4 flex items-center gap-2"><i className="fa-solid fa-robot" /> Identidade</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Nome do bot</label>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-[#1e1e26] border border-[#2a2a35] text-white px-4 py-2 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Moeda</label>
              <input value={currency} onChange={e => setCurrency(e.target.value)} className="w-full bg-[#1e1e26] border border-[#2a2a35] text-white px-4 py-2 rounded-lg" />
            </div>
          </div>
        </div>
        <div className="bg-[#14141a] border border-[#2a2a35] rounded-2xl p-6">
          <h3 className="text-[#d4af37] font-semibold mb-4 flex items-center gap-2"><i className="fa-solid fa-image" /> Avatar</h3>
          <input type="file" accept="image/*" onChange={e => setAvatarFile(e.target.files?.[0] || null)} className="w-full bg-[#1e1e26] border border-[#2a2a35] text-white px-4 py-2 rounded-lg" />
          {avatar && <img src={avatar} alt="avatar" className="mt-3 max-w-[120px] rounded-lg" />}
        </div>
        <div className="bg-[#14141a] border border-[#2a2a35] rounded-2xl p-6 md:col-span-2">
          <h3 className="text-[#d4af37] font-semibold mb-4 flex items-center gap-2"><i className="fa-solid fa-panorama" /> Banner</h3>
          <input type="file" accept="image/*" onChange={e => setBannerFile(e.target.files?.[0] || null)} className="w-full bg-[#1e1e26] border border-[#2a2a35] text-white px-4 py-2 rounded-lg" />
          {banner && <img src={banner} alt="banner" className="mt-3 max-h-[80px] rounded-lg" />}
        </div>
      </div>
      <div className="mt-6 flex gap-3">
        <button onClick={save} className="px-6 py-3 rounded-lg font-semibold text-black bg-gradient-to-r from-[#b8941f] to-[#ffd700]">Salvar</button>
        {msg && <span className="text-green-400 self-center">{msg}</span>}
      </div>
    </div>
  );
}
