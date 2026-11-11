'use client';
import { useEffect, useState } from 'react';

export default function AnnouncePage() {
  const [catalogs, setCatalogs] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [catalog, setCatalog] = useState('');
  const [channelId, setChannelId] = useState('');
  const [message, setMessage] = useState('');
  const [products, setProducts] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [bannerPos, setBannerPos] = useState('bottom');
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    Promise.all([fetch('/api/catalogs').then(r => r.json()), fetch('/api/channels').then(r => r.json())]).then(([c, ch]) => {
      setCatalogs(c); setChannels(ch);
      if (c.length) { setCatalog(c[0].name); setProducts(c[0].products?.map((p: any) => p.name) || []); setSelectedProducts(c[0].products?.map((p: any) => p.name) || []); }
      if (ch.length) setChannelId(ch[0].id);
    });
  }, []);

  function onCatalogChange(name: string) {
    setCatalog(name);
    const cat = catalogs.find(c => c.name === name);
    const prods = cat?.products?.map((p: any) => p.name) || [];
    setProducts(prods); setSelectedProducts(prods);
  }

  async function send() {
    const fd = new FormData();
    fd.append('catalog', catalog);
    fd.append('channelId', channelId);
    fd.append('message', message);
    fd.append('products', JSON.stringify(selectedProducts));
    fd.append('bannerPosition', bannerPos);
    if (bannerFile) fd.append('banner', bannerFile);
    const r = await fetch('/api/announce', { method: 'POST', body: fd });
    const d = await r.json();
    setMsg(r.ok ? 'Anuncio enviado!' : 'Erro: ' + (d.error || ''));
    setTimeout(() => setMsg(''), 3000);
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-[#d4af37]">Anunciar</h1>
      <div className="bg-[#14141a] border border-[#2a2a35] rounded-2xl p-5 max-w-2xl">
        <div className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Catalogo</label>
            <select value={catalog} onChange={e => onCatalogChange(e.target.value)} className="w-full bg-[#1e1e26] border border-[#2a2a35] text-white px-4 py-2 rounded-lg">
              {catalogs.map((c: any) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Canal</label>
            <select value={channelId} onChange={e => setChannelId(e.target.value)} className="w-full bg-[#1e1e26] border border-[#2a2a35] text-white px-4 py-2 rounded-lg">
              {channels.map((c: any) => <option key={c.id} value={c.id}>#{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Mensagem (opcional)</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={2} className="w-full bg-[#1e1e26] border border-[#2a2a35] text-white px-4 py-2 rounded-lg" placeholder="Mensagem personalizada" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Banner (imagem)</label>
            <input type="file" accept="image/*" onChange={e => setBannerFile(e.target.files?.[0] || null)} className="w-full bg-[#1e1e26] border border-[#2a2a35] text-white px-4 py-2 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Posicao do banner</label>
            <select value={bannerPos} onChange={e => setBannerPos(e.target.value)} className="w-full bg-[#1e1e26] border border-[#2a2a35] text-white px-4 py-2 rounded-lg">
              <option value="bottom">Embaixo da mensagem</option>
              <option value="top">Em cima da mensagem</option>
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Produtos a incluir</label>
            <div className="space-y-1 max-h-40 overflow-y-auto bg-[#1e1e26] p-3 rounded-lg">
              {products.map(p => (
                <label key={p} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={selectedProducts.includes(p)} onChange={e => {
                    if (e.target.checked) setSelectedProducts([...selectedProducts, p]);
                    else setSelectedProducts(selectedProducts.filter(x => x !== p));
                  }} /> {p}
                </label>
              ))}
            </div>
          </div>
          <button onClick={send} className="px-6 py-2 rounded-lg font-semibold text-black bg-gradient-to-r from-[#b8941f] to-[#ffd700]">Anunciar</button>
          {msg && <p className="text-green-400 text-sm">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
