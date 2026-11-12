function renderAnnounceProducts() {
  const catName = document.getElementById('annCatalog').value;
  const cat = state.catalogs.find(c => c.name === catName);
  const el = document.getElementById('annProducts');
  if (!cat || !cat.products || cat.products.length === 0) { el.innerHTML = '<div class="text-xs" style="color:var(--muted);">Sem produtos</div>'; return; }
  el.innerHTML = cat.products.map(p => '<label class="flex items-center gap-2 text-sm"><input type="checkbox" class="ann-prod" value="' + p.name + '" checked> ' + p.name + ' (' + money(p.price) + ')</label>').join('');
}
async function openAnnounceModal() {
  if (!state.channels || state.channels.length === 0) {
    try {
      const chs = await api('/api/channels');
      if (Array.isArray(chs) && chs.length > 0) state.channels = chs;
    } catch (e) {}
  }
  document.getElementById('annCatalog').innerHTML = state.catalogs.map(c => '<option value="' + c.name + '">' + c.name + '</option>').join('');
  document.getElementById('annChannel').innerHTML = (state.channels || []).map(c => '<option value="' + c.id + '">#' + c.name + '</option>').join('');
  document.getElementById('annMessage').value = '';
  document.getElementById('annBanner').value = '';
  renderAnnounceProducts();
  document.getElementById('annCatalog').onchange = renderAnnounceProducts;
  openModal('modalAnnounce');
}
async function saveAnnounce() {
  try {
    const selected = Array.from(document.querySelectorAll('.ann-prod:checked')).map(x => x.value);
    const fd = new FormData();
    fd.append('catalog', document.getElementById('annCatalog').value);
    fd.append('channelId', document.getElementById('annChannel').value);
    fd.append('message', document.getElementById('annMessage').value);
    fd.append('products', JSON.stringify(selected));
    fd.append('bannerPosition', document.getElementById('annBannerPos').value);
    const file = document.getElementById('annBanner').files[0];
    if (file) fd.append('banner', file);
    const r = await fetch('/api/announce', { method: 'POST', body: fd });
    if (!r.ok) { const e = await r.json().catch(()=>({error:r.statusText})); throw new Error(e.error || r.statusText); }
    closeModal('modalAnnounce');
    toast('Anuncio enviado');
  } catch (e) { toast(e.message); }
}
