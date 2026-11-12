// language: JavaScript (Node.js), file: index.js, target: Discord bot (discord.js v14)

require('dotenv').config();
require('dotenv').config({ path: require('path').join(__dirname, '..', 'gateway', '.env') });
const express = require('express');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const fileUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const pc = require('fs').existsSync(require('path').join(__dirname, 'pingocash.js')) ? require('./pingocash') : require('../gateway/pingocash');
const fs = require('fs');
const path = require('path');
const {
  Client, GatewayIntentBits, Partials, REST, Routes,
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ChannelType, PermissionFlagsBits,
} = require('discord.js');

const CONFIG_FILE = path.join(__dirname, 'config.json');
const TMP_CONFIG_FILE = path.join(require('os').tmpdir(), 'wl7-config.json');
function getReadableConfigFile() {
  if (process.env.VERCEL && fs.existsSync(TMP_CONFIG_FILE)) return TMP_CONFIG_FILE;
  if (fs.existsSync(CONFIG_FILE)) return CONFIG_FILE;
  if (fs.existsSync(TMP_CONFIG_FILE)) return TMP_CONFIG_FILE;
  return CONFIG_FILE;
}
const DEFAULT_CATALOGS = ['laras', 'infocc', 'btmob', 'consul'];
const DEFAULT_PRODUCTS = {
  btmob: [
    { name: '1  SEMANA', price: 390, description: '', stock: -1 },
    { name: '15 DIAS', price: 700, description: '', stock: -1 },
    { name: '1 MES', price: 1100, description: '', stock: -1 },
    { name: 'VITALICIO', price: 1900, description: '', stock: -1 },
  ],
  laras: [
    { name: 'ZAMPAY', price: 120, description: '', stock: 5 },
    { name: 'CORPX', price: 100, description: '', stock: 3 },
    { name: 'MYSTICPAY', price: 120, description: '', stock: 16 },
    { name: 'SUMUP', price: 120, description: '', stock: 1 },
  ],
};
const DEFAULT_CONFIG = {
  botName: 'WL7 STORE',
  botAvatar: '',
  botBanner: '',
  currency: 'BRL',
  catalogs: DEFAULT_CATALOGS.map(n => ({ name: n, description: '', intro: '', products: DEFAULT_PRODUCTS[n] || [] })),
  orders: [],
  announces: [],
  targets: [],
  pins: [],
  privateWebhook: process.env.PRIVATE_WEBHOOK || '',
};

let BUNDLED_CONFIG = null;
try { BUNDLED_CONFIG = require('./config.json'); } catch (e) {}

function loadConfig() {
  try {
    const file = getReadableConfigFile();
    let parsed = null;
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
      parsed = JSON.parse(raw);
    } else if (BUNDLED_CONFIG) {
      parsed = JSON.parse(JSON.stringify(BUNDLED_CONFIG));
    }
    if (parsed) {
      const c = { ...DEFAULT_CONFIG, ...parsed };
      if (Array.isArray(c.products) && c.products.length && !c.catalogs) {
        c.catalogs = [{ name: 'geral', description: '', intro: '', products: c.products }];
        delete c.products;
      }
      if (!Array.isArray(c.catalogs)) c.catalogs = DEFAULT_CONFIG.catalogs.map(x => ({ ...x }));
      for (const cat of c.catalogs) { if (cat.intro === undefined) cat.intro = ''; if (!Array.isArray(cat.products)) cat.products = []; for (const p of cat.products) { if (p.stock === undefined) p.stock = -1; } }
      if (c.botBanner === undefined) c.botBanner = '';
      for (const n of DEFAULT_CATALOGS) {
        if (!c.catalogs.find(x => x.name.toLowerCase() === n.toLowerCase())) {
          c.catalogs.push({ name: n, description: '', intro: '', products: [] });
        }
      }
      if (!Array.isArray(c.pins)) c.pins = [];
      if (!Array.isArray(c.targets)) c.targets = [];
      if (!Array.isArray(c.orders)) c.orders = [];
      if (!Array.isArray(c.announces)) c.announces = [];
      return c;
    }
  } catch (e) { console.error('config load error', e); }
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}
function saveConfig(cfg) {
  const json = JSON.stringify(cfg, null, 2);
  try {
    fs.writeFileSync(CONFIG_FILE, json, 'utf8');
  } catch (e) {
    try { fs.writeFileSync(TMP_CONFIG_FILE, json, 'utf8'); } catch (e2) {}
  }
}

let cfg = loadConfig();
if (!cfg.privateWebhook && process.env.PRIVATE_WEBHOOK) cfg.privateWebhook = process.env.PRIVATE_WEBHOOK;

let lastPingoSyncAt = 0;
async function syncOrdersFromPingo(force = false) {
  const now = Date.now();
  if (!force && now - lastPingoSyncAt < 3000) return cfg.orders;
  lastPingoSyncAt = now;
  try {
    if (typeof pc.getBalance === 'function') {
      const bal = await pc.getBalance().catch(() => null);
      if (bal && bal.balance !== undefined) cfg.walletBalance = Number(bal.balance);
    }
    if (typeof pc.listTransactions !== 'function') return cfg.orders;
    const txs = await pc.listTransactions(50, 0);
    if (!Array.isArray(txs) || txs.length === 0) return cfg.orders;
    let changed = false;
    // Process from oldest to newest so IDs are chronological
    const chronological = txs.slice().reverse();
    for (const tx of chronological) {
      if (!tx || (!tx.id && !tx.external_id)) continue;
      const rawStatus = String(tx.status || 'pending').toLowerCase();
      const normStatus = (rawStatus === 'paid' || rawStatus === 'completed' || rawStatus === 'approved')
        ? 'paid'
        : ((rawStatus === 'cancelled' || rawStatus === 'expired' || rawStatus === 'failed') ? rawStatus : 'pending');

      const existing = cfg.orders.find(o =>
        (tx.id && o.chargeId && String(o.chargeId) === String(tx.id)) ||
        (tx.external_id && o.externalId && String(o.externalId) === String(tx.external_id))
      );

      if (existing) {
        if (!existing.chargeId && tx.id) { existing.chargeId = tx.id; changed = true; }
        if (tx.amount !== undefined && Number(tx.amount) > 0 && existing.amount !== Number(tx.amount)) {
          existing.amount = Number(tx.amount);
          changed = true;
        }
        if (tx.payer_name && (!existing.userName || existing.userName === 'Cliente' || existing.userName === 'Cliente PIX')) {
          existing.userName = tx.payer_name;
          changed = true;
        }
        if (normStatus === 'paid' && existing.status !== 'paid' && existing.status !== 'delivered') {
          existing.status = 'paid';
          existing.paidAt = tx.paid_at || existing.paidAt || new Date().toISOString();
          changed = true;
        } else if ((normStatus === 'cancelled' || normStatus === 'expired') && existing.status === 'pending') {
          existing.status = normStatus;
          changed = true;
        }
      } else {
        const desc = String(tx.description || '').trim();
        let product = desc || 'Cobrança PIX';
        let catalog = 'pix';
        const mPedido = desc.match(/Pagamento do pedido\s+(.+?)\s*\(([^)]+)\)/i);
        const mCheckout = desc.match(/Venda checkout:\s*(.+)/i);
        if (mPedido) {
          product = mPedido[1].trim();
          catalog = mPedido[2].trim();
        } else if (mCheckout) {
          product = mCheckout[1].trim();
          catalog = 'checkout';
        } else if (desc.toLowerCase().includes('depósito') || desc.toLowerCase().includes('deposito')) {
          product = desc;
          catalog = 'deposito';
        }
        const nextId = cfg.orders.reduce((max, o) => Math.max(max, Number(o.id) || 0), 0) + 1;
        cfg.orders.push({
          id: nextId,
          externalId: tx.external_id || tx.id,
          chargeId: tx.id || null,
          copyPaste: '',
          userId: '',
          userName: tx.payer_name || (tx.external_id && String(tx.external_id).startsWith('pedido_') ? 'Cliente Discord' : 'Cliente PIX'),
          catalog,
          product,
          amount: Number(tx.amount || 0),
          fee: Number(tx.fee || 0),
          netAmount: Number(tx.net_amount || tx.amount || 0),
          status: normStatus,
          createdAt: tx.created_at || new Date().toISOString(),
          paidAt: tx.paid_at || (normStatus === 'paid' ? new Date().toISOString() : null),
          deliveredAt: null,
        });
        changed = true;
      }
    }
    if (changed) {
      cfg.orders.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
      saveConfig(cfg);
    }
  } catch (e) {
    console.error('syncOrdersFromPingo err:', e.message);
  }
  return cfg.orders;
}

const client = new Client({ intents: [GatewayIntentBits.Guilds], partials: [Partials.Channel, Partials.Message] });

function money(v) { return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: cfg.currency || 'BRL' }); }
function getCatalog(name) { return cfg.catalogs.find(c => c.name.toLowerCase() === String(name).toLowerCase()); }
function catalogEmbed(cat) {
  const e = new EmbedBuilder().setTitle('Catalogo ' + cat.name.toUpperCase()).setColor(0x57f287).setTimestamp();
  if (!cat.products || cat.products.length === 0) { e.setDescription('Nenhum produto cadastrado.'); return e; }
  const lines = cat.products.map((p, i) => '**' + (i + 1) + '. ' + p.name + '** - ' + money(p.price) + (p.description ? ' _' + p.description + '_' : '') + '  (estoque: ' + (p.stock === -1 ? '∞' : p.stock) + ')');
  e.setDescription(lines.join('\n'));
  e.setFooter({ text: cat.products.length + ' produto(s)' });
  if (cfg.botAvatar) e.setThumbnail(cfg.botAvatar);
  return e;
}
function productDetailEmbed(cat, p) {
  const e = new EmbedBuilder().setTitle(p.name).setColor(0x5865f2).setTimestamp();
  e.addFields({ name: 'Preco', value: money(p.price), inline: true }, { name: 'Estoque', value: String(p.stock === -1 ? 'Ilimitado' : p.stock), inline: true });
  if (p.description) e.setDescription(p.description);
  e.setFooter({ text: 'Catalogo: ' + cat.name });
  if (cfg.botAvatar) e.setThumbnail(cfg.botAvatar);
  return e;
}
function catalogsOverviewEmbed() {
  const e = new EmbedBuilder().setTitle('Catalogos disponiveis').setColor(0x5865f2).setTimestamp();
  if (cfg.catalogs.length === 0) { e.setDescription('Nenhum catalogo.'); return e; }
  const lines = cfg.catalogs.map(c => '**' + c.name + '** - ' + (c.products ? c.products.length : 0) + ' produto(s)' + (c.description ? ' _' + c.description + '_' : ''));
  e.setDescription(lines.join('\n'));
  e.setFooter({ text: 'Use o menu abaixo para abrir um catalogo' });
  if (cfg.botAvatar) e.setThumbnail(cfg.botAvatar);
  return e;
}
async function sendWebhook(url, payload) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('webhook ' + res.status + ': ' + await res.text());
  return res;
}
async function notifyPrivate(text, embeds) {
  if (!cfg.privateWebhook) return;
  try { await sendWebhook(cfg.privateWebhook, { content: text, embeds: embeds || [], allowed_mentions: { parse: ['everyone'] } }); }
  catch (e) { console.error('private webhook err', e.message); }
}
function buildConfigPayload() {
  return { type: 'setup-config', version: 3, botName: cfg.botName, botAvatar: cfg.botAvatar, currency: cfg.currency, catalogs: cfg.catalogs, generatedAt: new Date().toISOString() };
}

// pinned message builders
function pinnedContent(cat) {
  const intro = cat.intro ? cat.intro + '\n\n' : '';
  return intro + '**' + cat.name.toUpperCase() + '** - selecione abaixo o que deseja:';
}
function pinnedSelectMenu(cat) {
  const opts = (cat.products || []).slice(0, 25).map(p => new StringSelectMenuOptionBuilder().setLabel(p.name.slice(0, 100)).setDescription((money(p.price) + ' | estoque: ' + (p.stock === -1 ? '∞' : p.stock) + (p.description ? ' - ' + p.description.slice(0, 60) : '')).slice(0, 100)).setValue(p.name.slice(0, 100)));
  if (opts.length === 0) opts.push(new StringSelectMenuOptionBuilder().setLabel('Sem produtos').setValue('__none__').setDescription('Nenhum produto cadastrado'));
  const menu = new StringSelectMenuBuilder().setCustomId('pin:select:' + cat.name).setPlaceholder('Selecione uma opcao').addOptions(opts);
  const up = new ButtonBuilder().setCustomId('pin:up:' + cat.name).setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('⬆️');
  return [new ActionRowBuilder().addComponents(menu), new ActionRowBuilder().addComponents(up)];
}
const HELP_CATEGORIES = {
  geral: { label: 'Geral', emoji: '⚙️', color: 0x5865f2, cmds: [
    ['avatar <url>', 'Define a foto de perfil do bot'],
    ['name <nome>', 'Define o nome do bot'],
    ['currency <code>', 'Define a moeda (BRL, USD...)'],
    ['status', 'Mostra status atual do bot'],
  ]},
  catalogos: { label: 'Catalogos', emoji: '📦', color: 0x57f287, cmds: [
    ['catalogs', 'Lista todos os catalogos'],
    ['addcatalog nome [descricao]', 'Cria um novo catalogo'],
    ['removecatalog <nome>', 'Remove um catalogo'],
    ['setintro catalogo texto', 'Define texto introdutorio'],
  ]},
  produtos: { label: 'Produtos', emoji: '🛒', color: 0xfee75c, cmds: [
    ['addproduct catalogo nome preco [desc]', 'Adiciona produto a um catalogo'],
    ['removeproduct catalogo nome', 'Remove produto de um catalogo'],
    ['products [catalogo]', 'Lista produtos de um ou todos'],
    ['setstock catalogo nome quantidade', 'Define estoque (-1 = ilimitado)'],
  ]},
  pedidos: { label: 'Pedidos', emoji: '🧾', color: 0x9b59b6, cmds: [
    ['orders [status]', 'Lista pedidos (filtro opcional)'],
    ['myorders', 'Meus pedidos'],
    ['orderstatus id status', 'Altera status de um pedido'],
    ['deliver id', 'Marca pedido como entregue (DM ao comprador)'],
  ]},
  fixadas: { label: 'Mensagens Fixas', emoji: '📌', color: 0xeb459e, cmds: [
    ['browse', 'Popup com menu para navegar catalogos'],
    ['pinmessage catalogo canal', 'Fixa mensagem interativa em canal'],
    ['unpin catalogo [canal]', 'Remove mensagem fixa'],
    ['refreshpin catalogo', 'Atualiza mensagens fixas'],
    ['listpins', 'Lista todas as mensagens fixas'],
  ]},
  anuncios: { label: 'Anuncios', emoji: '📢', color: 0xed4245, cmds: [
    ['announce catalogo [canal]', 'Anuncia catalogo marcando @everyone'],
  ]},
  bots: { label: 'Bots/Config', emoji: '🤖', color: 0x99aab5, cmds: [
    ['registerbot nome webhook [nota]', 'Registra outro bot/canal'],
    ['listbots', 'Lista bots registrados'],
    ['removebot <nome>', 'Remove um bot registrado'],
    ['pushconfig <nome>', 'Envia config para um bot'],
    ['pushall', 'Envia config para todos os bots'],
    ['sendraw webhook mensagem', 'Envia mensagem livre via webhook'],
  ]},
};
function helpOverviewEmbed() {
  const e = new EmbedBuilder().setTitle('Central de Ajuda').setColor(0x5865f2).setTimestamp();
  e.setDescription('Selecione uma categoria no menu abaixo para ver os comandos.');
  const lines = Object.values(HELP_CATEGORIES).map(c => c.emoji + ' **' + c.label + '** - ' + c.cmds.length + ' comandos');
  e.addFields({ name: 'Categorias', value: lines.join('\n') });
  e.setFooter({ text: 'Setup Bot v3  •  29 comandos' });
  if (cfg.botAvatar) e.setThumbnail(cfg.botAvatar);
  return e;
}
function helpCategoryEmbed(key) {
  const c = HELP_CATEGORIES[key];
  const e = new EmbedBuilder().setTitle(c.emoji + ' ' + c.label).setColor(c.color).setTimestamp();
  const lines = c.cmds.map(([cmd, desc]) => '`/' + cmd + '`\n> ' + desc);
  e.setDescription(lines.join('\n\n'));
  e.setFooter({ text: 'Selecione outra categoria ou ⬆️ para voltar' });
  if (cfg.botAvatar) e.setThumbnail(cfg.botAvatar);
  return e;
}
function helpComponents() {
  const menu = new StringSelectMenuBuilder().setCustomId('help:cat').setPlaceholder('Escolha uma categoria').addOptions(
    Object.entries(HELP_CATEGORIES).map(([k, c]) => new StringSelectMenuOptionBuilder().setLabel(c.label).setDescription(c.cmds.length + ' comandos').setValue(k).setEmoji(c.emoji))
  );
  return [new ActionRowBuilder().addComponents(menu)];
}
function helpBackComponents() {
  const up = new ButtonBuilder().setCustomId('help:up').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('⬆️');
  const menu = new StringSelectMenuBuilder().setCustomId('help:cat').setPlaceholder('Outra categoria').addOptions(
    Object.entries(HELP_CATEGORIES).map(([k, c]) => new StringSelectMenuOptionBuilder().setLabel(c.label).setDescription(c.cmds.length + ' comandos').setValue(k).setEmoji(c.emoji))
  );
  return [new ActionRowBuilder().addComponents(menu), new ActionRowBuilder().addComponents(up)];
}
function browseCatalogComponents() {
  const menu = new StringSelectMenuBuilder().setCustomId('browse:catalog').setPlaceholder('Selecione um catalogo').addOptions(
    cfg.catalogs.map(c => new StringSelectMenuOptionBuilder().setLabel(c.name).setDescription((c.products ? c.products.length : 0) + ' produto(s)').setValue(c.name))
  );
  return [new ActionRowBuilder().addComponents(menu)];
}
function browseUpComponents(cat) {
  const rows = [];
  if (cat && Array.isArray(cat.products) && cat.products.length > 0) {
    const opts = cat.products.slice(0, 25).map(p =>
      new StringSelectMenuOptionBuilder()
        .setLabel(p.name.slice(0, 100))
        .setDescription((money(p.price) + ' | estoque: ' + (p.stock === -1 ? '∞' : p.stock) + (p.description ? ' - ' + p.description.slice(0, 60) : '')).slice(0, 100))
        .setValue(p.name.slice(0, 100))
    );
    const menu = new StringSelectMenuBuilder().setCustomId('browse:buy:' + cat.name).setPlaceholder('Selecione um produto para comprar (PIX)').addOptions(opts);
    rows.push(new ActionRowBuilder().addComponents(menu));
  }
  const up = new ButtonBuilder().setCustomId('browse:up').setLabel('Voltar aos catalogos').setStyle(ButtonStyle.Secondary).setEmoji('⬆️');
  rows.push(new ActionRowBuilder().addComponents(up));
  return rows;
}

const commands = [
  new SlashCommandBuilder().setName('help').setDescription('Mostra todos os comandos'),
  new SlashCommandBuilder().setName('status').setDescription('Status atual'),
  new SlashCommandBuilder().setName('avatar').setDescription('Foto de perfil do bot')
    .addStringOption(o => o.setName('url').setDescription('URL da imagem').setRequired(true)),
  new SlashCommandBuilder().setName('name').setDescription('Nome do bot')
    .addStringOption(o => o.setName('nome').setDescription('Novo nome').setRequired(true)),
  new SlashCommandBuilder().setName('currency').setDescription('Moeda')
    .addStringOption(o => o.setName('code').setDescription('Codigo da moeda').setRequired(true)),
  new SlashCommandBuilder().setName('catalogs').setDescription('Lista catalogos'),
  new SlashCommandBuilder().setName('addcatalog').setDescription('Cria um catalogo')
    .addStringOption(o => o.setName('nome').setDescription('Nome do catalogo').setRequired(true))
    .addStringOption(o => o.setName('descricao').setDescription('Descricao').setRequired(false)),
  new SlashCommandBuilder().setName('removecatalog').setDescription('Remove um catalogo')
    .addStringOption(o => o.setName('nome').setDescription('Nome do catalogo').setRequired(true)),
  new SlashCommandBuilder().setName('setintro').setDescription('Define texto introdutorio de um catalogo')
    .addStringOption(o => o.setName('catalogo').setDescription('Catalogo').setRequired(true))
    .addStringOption(o => o.setName('texto').setDescription('Texto introdutorio').setRequired(true)),
  new SlashCommandBuilder().setName('addproduct').setDescription('Adiciona produto a um catalogo')
    .addStringOption(o => o.setName('catalogo').setDescription('Catalogo').setRequired(true))
    .addStringOption(o => o.setName('nome').setDescription('Nome do produto').setRequired(true))
    .addNumberOption(o => o.setName('preco').setDescription('Preco').setRequired(true))
    .addStringOption(o => o.setName('descricao').setDescription('Descricao').setRequired(false)),
  new SlashCommandBuilder().setName('removeproduct').setDescription('Remove produto de um catalogo')
    .addStringOption(o => o.setName('catalogo').setDescription('Catalogo').setRequired(true))
    .addStringOption(o => o.setName('nome').setDescription('Nome do produto').setRequired(true)),
  new SlashCommandBuilder().setName('products').setDescription('Lista produtos')
    .addStringOption(o => o.setName('catalogo').setDescription('Catalogo (opcional)').setRequired(false)),
  new SlashCommandBuilder().setName('setstock').setDescription('Define estoque de um produto')
    .addStringOption(o => o.setName('catalogo').setDescription('Catalogo').setRequired(true))
    .addStringOption(o => o.setName('nome').setDescription('Nome do produto').setRequired(true))
    .addIntegerOption(o => o.setName('quantidade').setDescription('Quantidade (-1 = ilimitado)').setRequired(true)),
  new SlashCommandBuilder().setName('orders').setDescription('Lista pedidos')
    .addStringOption(o => o.setName('status').setDescription('pending/paid/delivered/cancelled (opcional)').setRequired(false)),
  new SlashCommandBuilder().setName('myorders').setDescription('Meus pedidos'),
  new SlashCommandBuilder().setName('orderstatus').setDescription('Altera status de um pedido')
    .addIntegerOption(o => o.setName('id').setDescription('ID do pedido').setRequired(true))
    .addStringOption(o => o.setName('status').setDescription('pending/paid/delivered/cancelled').setRequired(true)),
  new SlashCommandBuilder().setName('deliver').setDescription('Marca pedido como entregue')
    .addIntegerOption(o => o.setName('id').setDescription('ID do pedido').setRequired(true)),
  new SlashCommandBuilder().setName('browse').setDescription('Popup para navegar catalogos e produtos'),
  new SlashCommandBuilder().setName('pinmessage').setDescription('Fixa mensagem interativa em um canal')
    .addStringOption(o => o.setName('catalogo').setDescription('Catalogo').setRequired(true))
    .addChannelOption(o => o.setName('canal').setDescription('Canal de destino').setRequired(true)),
  new SlashCommandBuilder().setName('unpin').setDescription('Remove mensagem fixa de um catalogo/canal')
    .addStringOption(o => o.setName('catalogo').setDescription('Catalogo').setRequired(true))
    .addChannelOption(o => o.setName('canal').setDescription('Canal').setRequired(false)),
  new SlashCommandBuilder().setName('refreshpin').setDescription('Atualiza mensagens fixas de um catalogo')
    .addStringOption(o => o.setName('catalogo').setDescription('Catalogo').setRequired(true)),
  new SlashCommandBuilder().setName('listpins').setDescription('Lista mensagens fixas'),
  new SlashCommandBuilder().setName('announce').setDescription('Anuncia um catalogo marcando @everyone')
    .addStringOption(o => o.setName('catalogo').setDescription('Catalogo').setRequired(true))
    .addChannelOption(o => o.setName('canal').setDescription('Canal de destino').setRequired(false)),
  new SlashCommandBuilder().setName('registerbot').setDescription('Registra outro bot/canal')
    .addStringOption(o => o.setName('nome').setDescription('Nome do bot').setRequired(true))
    .addStringOption(o => o.setName('webhook').setDescription('Webhook do canal').setRequired(true))
    .addStringOption(o => o.setName('nota').setDescription('Observacao').setRequired(false)),
  new SlashCommandBuilder().setName('listbots').setDescription('Lista bots registrados'),
  new SlashCommandBuilder().setName('removebot').setDescription('Remove bot registrado')
    .addStringOption(o => o.setName('nome').setDescription('Nome do bot').setRequired(true)),
  new SlashCommandBuilder().setName('pushconfig').setDescription('Envia config para um bot')
    .addStringOption(o => o.setName('nome').setDescription('Nome do bot').setRequired(true)),
  new SlashCommandBuilder().setName('pushall').setDescription('Envia config para todos os bots'),
  new SlashCommandBuilder().setName('sendraw').setDescription('Mensagem livre via webhook')
    .addStringOption(o => o.setName('webhook').setDescription('Webhook de destino').setRequired(true))
    .addStringOption(o => o.setName('mensagem').setDescription('Mensagem').setRequired(true)),
].map(c => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
  const clientId = client.user.id;
  let guilds = [...client.guilds.cache.values()];
  console.log('cache guilds:', guilds.length);
  if (guilds.length === 0) {
    try {
      const list = await rest.get(Routes.userGuilds());
      console.log('fetched guilds:', list.length, list.map(g => g.name));
      guilds = list.map(g => ({ id: g.id, name: g.name }));
    } catch (e) { console.error('fetch guilds err', e.message); }
  }
  for (const g of guilds) {
    try { await rest.put(Routes.applicationGuildCommands(clientId, g.id), { body: commands }); console.log('guild commands registered for', g.name, g.id); }
    catch (e) { console.error('guild cmd err', g.id, e.message); }
  }
  try { await rest.put(Routes.applicationCommands(clientId), { body: commands }); console.log('global commands registered:', commands.length); }
  catch (e) { console.error('global cmd err', e.message); }
  console.log('commands registered');
}

const PUBLIC_COMMANDS = new Set(['help', 'browse', 'catalogs', 'products', 'myorders']);

async function handle(interaction) {
  const name = interaction.commandName;
  try {
    if (!PUBLIC_COMMANDS.has(name) && interaction.guild) {
      const perms = interaction.memberPermissions;
      const isAllowed = !perms ||
        interaction.user.id === interaction.guild.ownerId ||
        perms.has(PermissionFlagsBits.Administrator) ||
        perms.has(PermissionFlagsBits.ManageGuild) ||
        perms.has(PermissionFlagsBits.ManageChannels) ||
        perms.has(PermissionFlagsBits.SendMessages);
      if (!isAllowed) {
        return interaction.reply({ content: '⛔ Acesso negado: você não tem permissão para usar este comando.', ephemeral: true });
      }
    }
    switch (name) {
      case 'help': {
        return interaction.reply({ embeds: [helpOverviewEmbed()], components: helpComponents(), ephemeral: true });
      }
      case 'status': {
        const e = new EmbedBuilder().setTitle('Status').addFields(
          { name: 'Nome', value: cfg.botName, inline: true },
          { name: 'Moeda', value: cfg.currency, inline: true },
          { name: 'Catalogos', value: String(cfg.catalogs.length), inline: true },
          { name: 'Bots registrados', value: String(cfg.targets.length), inline: true },
          { name: 'Pins', value: String(cfg.pins.length), inline: true },
          { name: 'Avatar', value: cfg.botAvatar || '-', inline: false },
          { name: 'Webhook privado', value: cfg.privateWebhook ? 'configurado' : 'nao configurado', inline: true },
        ).setColor(0xfee75c);
        return interaction.reply({ embeds: [e], ephemeral: true });
      }
      case 'avatar': {
        const url = interaction.options.getString('url');
        await client.user.setAvatar(url);
        cfg.botAvatar = url; saveConfig(cfg);
        await notifyPrivate('Avatar atualizado: ' + url);
        return interaction.reply({ content: 'Avatar atualizado.', ephemeral: true });
      }
      case 'name': {
        const nome = interaction.options.getString('nome');
        await client.user.setUsername(nome);
        cfg.botName = nome; saveConfig(cfg);
        await notifyPrivate('Nome atualizado: ' + nome);
        return interaction.reply({ content: 'Nome atualizado para ' + nome + '.', ephemeral: true });
      }
      case 'currency': {
        cfg.currency = interaction.options.getString('code').toUpperCase(); saveConfig(cfg);
        return interaction.reply({ content: 'Moeda: ' + cfg.currency, ephemeral: true });
      }
      case 'catalogs': {
        return interaction.reply({ embeds: [catalogsOverviewEmbed()], ephemeral: true });
      }
      case 'addcatalog': {
        const nome = interaction.options.getString('nome');
        const desc = interaction.options.getString('descricao') || '';
        if (getCatalog(nome)) return interaction.reply({ content: 'Catalogo ja existe.', ephemeral: true });
        cfg.catalogs.push({ name: nome, description: desc, intro: '', products: [] }); saveConfig(cfg);
        await notifyPrivate('Catalogo criado: **' + nome + '**');
        return interaction.reply({ content: 'Catalogo ' + nome + ' criado.', ephemeral: true });
      }
      case 'removecatalog': {
        const nome = interaction.options.getString('nome');
        const before = cfg.catalogs.length;
        cfg.catalogs = cfg.catalogs.filter(c => c.name.toLowerCase() !== nome.toLowerCase());
        cfg.pins = cfg.pins.filter(p => p.catalog.toLowerCase() !== nome.toLowerCase());
        saveConfig(cfg);
        return interaction.reply({ content: before !== cfg.catalogs.length ? nome + ' removido.' : nome + ' nao encontrado.', ephemeral: true });
      }
      case 'setintro': {
        const cat = getCatalog(interaction.options.getString('catalogo'));
        if (!cat) return interaction.reply({ content: 'Catalogo nao encontrado.', ephemeral: true });
        cat.intro = interaction.options.getString('texto'); saveConfig(cfg);
        await notifyPrivate('Intro atualizada: ' + cat.name);
        return interaction.reply({ content: 'Intro de ' + cat.name + ' atualizada.', ephemeral: true });
      }
      case 'addproduct': {
        const cat = getCatalog(interaction.options.getString('catalogo'));
        if (!cat) return interaction.reply({ content: 'Catalogo nao encontrado.', ephemeral: true });
        const nome = interaction.options.getString('nome');
        const preco = interaction.options.getNumber('preco');
        const desc = interaction.options.getString('descricao') || '';
        const existing = cat.products.find(p => p.name.toLowerCase() === nome.toLowerCase());
        if (existing) { existing.price = preco; existing.description = desc; }
        else cat.products.push({ name: nome, price: preco, description: desc });
        saveConfig(cfg);
        await refreshPinsForCatalog(cat.name);
        await notifyPrivate('Produto em **' + cat.name + '**: ' + nome + ' - ' + money(preco));
        return interaction.reply({ content: 'Produto ' + nome + ' salvo em ' + cat.name + ' (' + money(preco) + ').', ephemeral: true });
      }
      case 'removeproduct': {
        const cat = getCatalog(interaction.options.getString('catalogo'));
        if (!cat) return interaction.reply({ content: 'Catalogo nao encontrado.', ephemeral: true });
        const nome = interaction.options.getString('nome');
        const before = cat.products.length;
        cat.products = cat.products.filter(p => p.name.toLowerCase() !== nome.toLowerCase());
        saveConfig(cfg);
        await refreshPinsForCatalog(cat.name);
        return interaction.reply({ content: before !== cat.products.length ? nome + ' removido de ' + cat.name + '.' : nome + ' nao encontrado.', ephemeral: true });
      }
      case 'products': {
        const catName = interaction.options.getString('catalogo');
        if (catName) {
          const cat = getCatalog(catName);
          if (!cat) return interaction.reply({ content: 'Catalogo nao encontrado.', ephemeral: true });
          return interaction.reply({ embeds: [catalogEmbed(cat)], ephemeral: true });
        }
        const embeds = cfg.catalogs.map(catalogEmbed);
        return interaction.reply({ embeds: embeds.slice(0, 10), ephemeral: true });
      }
      case 'setstock': {
        const cat = getCatalog(interaction.options.getString('catalogo'));
        if (!cat) return interaction.reply({ content: 'Catalogo nao encontrado.', ephemeral: true });
        const nome = interaction.options.getString('nome');
        const p = cat.products.find(x => x.name.toLowerCase() === nome.toLowerCase());
        if (!p) return interaction.reply({ content: 'Produto nao encontrado.', ephemeral: true });
        p.stock = interaction.options.getInteger('quantidade');
        saveConfig(cfg);
        await refreshPinsForCatalog(cat.name);
        return interaction.reply({ content: 'Estoque de ' + p.name + ': ' + (p.stock === -1 ? 'ilimitado' : p.stock) + '.', ephemeral: true });
      }
      case 'orders': {
        const statusFilter = interaction.options.getString('status');
        let list = cfg.orders.slice().reverse();
        if (statusFilter) list = list.filter(o => o.status === statusFilter);
        list = list.slice(0, 25);
        if (list.length === 0) return interaction.reply({ content: 'Nenhum pedido.', ephemeral: true });
        const lines = list.map(o => '#' + o.id + ' | ' + o.userName + ' | ' + o.product + ' (' + o.catalog + ') | ' + money(o.amount) + ' | ' + o.status + ' | ' + new Date(o.createdAt).toLocaleString('pt-BR'));
        const e = new EmbedBuilder().setTitle('Pedidos').setDescription(lines.join('\n')).setColor(0x5865f2);
        return interaction.reply({ embeds: [e], ephemeral: true });
      }
      case 'myorders': {
        const list = cfg.orders.filter(o => o.userId === interaction.user.id).slice().reverse().slice(0, 25);
        if (list.length === 0) return interaction.reply({ content: 'Voce nao tem pedidos.', ephemeral: true });
        const lines = list.map(o => '#' + o.id + ' | ' + o.product + ' (' + o.catalog + ') | ' + money(o.amount) + ' | ' + o.status + ' | ' + new Date(o.createdAt).toLocaleString('pt-BR'));
        const e = new EmbedBuilder().setTitle('Meus pedidos').setDescription(lines.join('\n')).setColor(0x57f287);
        return interaction.reply({ embeds: [e], ephemeral: true });
      }
      case 'orderstatus': {
        const id = interaction.options.getInteger('id');
        const status = interaction.options.getString('status');
        const order = cfg.orders.find(o => o.id === id);
        if (!order) return interaction.reply({ content: 'Pedido nao encontrado.', ephemeral: true });
        order.status = status;
        if (status === 'paid' && !order.paidAt) order.paidAt = new Date().toISOString();
        if (status === 'delivered' && !order.deliveredAt) order.deliveredAt = new Date().toISOString();
        saveConfig(cfg);
        return interaction.reply({ content: 'Pedido #' + id + ' -> ' + status + '.', ephemeral: true });
      }
      case 'deliver': {
        const id = interaction.options.getInteger('id');
        const order = cfg.orders.find(o => o.id === id);
        if (!order) return interaction.reply({ content: 'Pedido nao encontrado.', ephemeral: true });
        order.status = 'delivered';
        if (!order.deliveredAt) order.deliveredAt = new Date().toISOString();
        saveConfig(cfg);
        // DM the buyer
        try {
          const user = await client.users.fetch(order.userId);
          await user.send('Seu pedido #' + order.id + ' (' + order.product + ') foi entregue!').catch(() => {});
        } catch (e) {}
        return interaction.reply({ content: 'Pedido #' + id + ' marcado como entregue.', ephemeral: true });
      }
      case 'browse': {
        return interaction.reply({ embeds: [catalogsOverviewEmbed()], components: browseCatalogComponents(), ephemeral: true });
      }
      case 'pinmessage': {
        const cat = getCatalog(interaction.options.getString('catalogo'));
        if (!cat) return interaction.reply({ content: 'Catalogo nao encontrado.', ephemeral: true });
        const channel = interaction.options.getChannel('canal');
        await interaction.deferReply({ ephemeral: true });
        const msg = await channel.send({ content: pinnedContent(cat), embeds: [], components: pinnedSelectMenu(cat), allowedMentions: { parse: [] } });
        try { await msg.pin(); } catch (e) { console.error('pin err', e.message); }
        cfg.pins.push({ catalog: cat.name, channelId: channel.id, messageId: msg.id });
        saveConfig(cfg);
        await notifyPrivate('Mensagem fixa criada: ' + cat.name + ' em #' + (channel.name || channel.id));
        return interaction.editReply({ content: 'Mensagem fixa criada em ' + channel + '.' });
      }
      case 'unpin': {
        const cat = getCatalog(interaction.options.getString('catalogo'));
        if (!cat) return interaction.reply({ content: 'Catalogo nao encontrado.', ephemeral: true });
        const channel = interaction.options.getChannel('canal');
        let removed = 0;
        const toRemove = cfg.pins.filter(p => p.catalog.toLowerCase() === cat.name.toLowerCase() && (!channel || p.channelId === channel.id));
        for (const p of toRemove) {
          try {
            const ch = await client.channels.fetch(p.channelId);
            const m = await ch.messages.fetch(p.messageId);
            await m.unpin().catch(() => {});
            await m.delete().catch(() => {});
            removed++;
          } catch (e) { console.error('unpin err', e.message); }
        }
        cfg.pins = cfg.pins.filter(p => !toRemove.includes(p));
        saveConfig(cfg);
        return interaction.reply({ content: removed + ' mensagem(ns) removida(s).', ephemeral: true });
      }
      case 'refreshpin': {
        const cat = getCatalog(interaction.options.getString('catalogo'));
        if (!cat) return interaction.reply({ content: 'Catalogo nao encontrado.', ephemeral: true });
        await interaction.deferReply({ ephemeral: true });
        const pins = cfg.pins.filter(p => p.catalog.toLowerCase() === cat.name.toLowerCase());
        let updated = 0;
        for (const p of pins) {
          try {
            const ch = await client.channels.fetch(p.channelId);
            const m = await ch.messages.fetch(p.messageId);
            await m.edit({ content: pinnedContent(cat), components: pinnedSelectMenu(cat) });
            updated++;
          } catch (e) { console.error('refresh err', e.message); }
        }
        return interaction.editReply({ content: updated + ' mensagem(ns) atualizada(s).', ephemeral: true });
      }
      case 'listpins': {
        if (cfg.pins.length === 0) return interaction.reply({ content: 'Nenhuma mensagem fixa.', ephemeral: true });
        const lines = cfg.pins.map((p, i) => (i + 1) + '. **' + p.catalog + '** - canal ' + p.channelId);
        return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Mensagens fixas').setDescription(lines.join('\n')).setColor(0x5865f2)], ephemeral: true });
      }
      case 'announce': {
        const cat = getCatalog(interaction.options.getString('catalogo'));
        if (!cat) return interaction.reply({ content: 'Catalogo nao encontrado.', ephemeral: true });
        const channel = interaction.options.getChannel('canal') || interaction.channel;
        const announceId = cfg.announces.length + 1;
        const selected = (cat.products || []).map(p => p.name);
        const customMsg = '';
        const opts = (selected || []).map(name => { const p = (cat.products || []).find(x => x.name === name); if (!p) return null; return new (require('discord.js').StringSelectMenuOptionBuilder)().setLabel(p.name.slice(0,100)).setDescription((money(p.price) + (p.description ? ' - ' + p.description.slice(0,60) : '')).slice(0,100)).setValue(p.name.slice(0,100)); }).filter(Boolean);
        if (opts.length === 0) opts.push(new (require('discord.js').StringSelectMenuOptionBuilder)().setLabel('Sem produtos').setValue('__none__'));
        const menu = new (require('discord.js').StringSelectMenuBuilder)().setCustomId('announce:select:' + announceId).setPlaceholder('Escolha um produto').addOptions(opts);
        const up = new (require('discord.js').ButtonBuilder)().setCustomId('announce:up:' + announceId).setLabel('Voltar').setStyle(2).setEmoji('⬆️');
        const comps = [new (require('discord.js').ActionRowBuilder)().addComponents(menu), new (require('discord.js').ActionRowBuilder)().addComponents(up)];
        const content = '@everyone ' + (customMsg || ('Catalogo ' + cat.name.toUpperCase() + ' disponivel!'));
        const announceMsg = { content: content, embeds: [catalogEmbed(cat)], components: comps, allowedMentions: { parse: ['everyone'] } };
        const msg = await channel.send(announceMsg);
        cfg.announces.push({ id: announceId, catalog: cat.name, channelId: channel.id, messageId: msg.id, message: customMsg, products: selected, createdAt: new Date().toISOString() });
        saveConfig(cfg);
        await notifyPrivate('Anuncio enviado: ' + cat.name + ' em #' + (channel.name || channel.id));
        return interaction.reply({ content: 'Anunciado em ' + channel + '.', ephemeral: true });
      }
      case 'registerbot': {
        const nome = interaction.options.getString('nome');
        const webhook = interaction.options.getString('webhook');
        const nota = interaction.options.getString('nota') || '';
        if (!/^https:\/\/discord\.com\/api\/webhooks\//.test(webhook)) return interaction.reply({ content: 'Webhook invalido.', ephemeral: true });
        const existing = cfg.targets.find(t => t.name.toLowerCase() === nome.toLowerCase());
        if (existing) { existing.webhook = webhook; existing.note = nota; }
        else cfg.targets.push({ name: nome, webhook: webhook, note: nota });
        saveConfig(cfg);
        await notifyPrivate('Bot registrado: **' + nome + '**');
        return interaction.reply({ content: 'Bot ' + nome + ' registrado.', ephemeral: true });
      }
      case 'listbots': {
        if (cfg.targets.length === 0) return interaction.reply({ content: 'Nenhum bot registrado.', ephemeral: true });
        const lines = cfg.targets.map((t, i) => '**' + (i + 1) + '. ' + t.name + '** - ' + t.webhook.slice(0, 40) + '...' + (t.note ? ' _' + t.note + '_' : ''));
        return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Bots registrados').setDescription(lines.join('\n')).setColor(0x5865f2)], ephemeral: true });
      }
      case 'removebot': {
        const nome = interaction.options.getString('nome');
        const before = cfg.targets.length;
        cfg.targets = cfg.targets.filter(t => t.name.toLowerCase() !== nome.toLowerCase());
        saveConfig(cfg);
        return interaction.reply({ content: before !== cfg.targets.length ? nome + ' removido.' : nome + ' nao encontrado.', ephemeral: true });
      }
      case 'pushconfig': {
        const nome = interaction.options.getString('nome');
        const target = cfg.targets.find(t => t.name.toLowerCase() === nome.toLowerCase());
        if (!target) return interaction.reply({ content: nome + ' nao encontrado.', ephemeral: true });
        await interaction.deferReply({ ephemeral: true });
        await sendWebhook(target.webhook, { content: 'Configuracao recebida de ' + cfg.botName, embeds: cfg.catalogs.map(catalogEmbed).map(e => e.toJSON()), allowed_mentions: { parse: [] } });
        await notifyPrivate('Config enviada para **' + target.name + '**');
        return interaction.editReply({ content: 'Config enviada para ' + target.name + '.' });
      }
      case 'pushall': {
        await interaction.deferReply({ ephemeral: true });
        const results = [];
        for (const t of cfg.targets) {
          try {
            await sendWebhook(t.webhook, { content: 'Configuracao recebida de ' + cfg.botName, embeds: cfg.catalogs.map(catalogEmbed).map(e => e.toJSON()), allowed_mentions: { parse: [] } });
            results.push('OK ' + t.name);
          } catch (e) { results.push('FAIL ' + t.name + ': ' + e.message); }
        }
        await notifyPrivate('Push all: ' + results.join(', '));
        return interaction.editReply({ content: results.join('\n') || 'Nenhum bot registrado.' });
      }
      case 'sendraw': {
        const webhook = interaction.options.getString('webhook');
        const msg = interaction.options.getString('mensagem');
        await sendWebhook(webhook, { content: msg, allowed_mentions: { parse: ['everyone'] } });
        return interaction.reply({ content: 'Mensagem enviada.', ephemeral: true });
      }
      default:
        return interaction.reply({ content: 'Comando desconhecido.', ephemeral: true });
    }
  } catch (e) {
    console.error(e);
    const msg = 'Erro: ' + e.message;
    if (interaction.deferred || interaction.replied) interaction.editReply({ content: msg }).catch(() => {});
    else interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
  }
}

async function refreshPinsForCatalog(catName) {
  const cat = getCatalog(catName);
  if (!cat) return;
  const pins = cfg.pins.filter(p => p.catalog.toLowerCase() === catName.toLowerCase());
  for (const p of pins) {
    try {
      const ch = await client.channels.fetch(p.channelId);
      const m = await ch.messages.fetch(p.messageId);
      await m.edit({ content: pinnedContent(cat), components: pinnedSelectMenu(cat) });
    } catch (e) { console.error('refresh err', e.message); }
  }
}

async function generateCharge(interaction, cat, p) {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true });
  }
  if (p.stock === 0) {
    await interaction.editReply({ content: '❌ Sem estoque para **' + p.name + '**.' }).catch(() => {});
    return;
  }
  try {
    const externalId = 'pedido_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const payerName = interaction.user.globalName || interaction.user.username || 'Cliente';
    const r = await pc.createCharge({
      amount: Number(p.price),
      external_id: externalId,
      description: 'Pagamento do pedido ' + p.name + ' (' + cat.name + ')',
      payer: { name: payerName, document: '12345678909' },
    });
    const d = (r && r.data) ? r.data : r;
    const copyPaste = d.copy_paste || d.qr_code || '';
    const qrB64 = d.qr_code_base64 || '';
    const files = [];
    const { AttachmentBuilder } = require('discord.js');
    if (qrB64) {
      const base64 = qrB64.replace(/^data:image\/\w+;base64,/, '');
      const buf = Buffer.from(base64, 'base64');
      files.push(new AttachmentBuilder(buf, { name: 'qrcode.png' }));
    }
    const nextId = cfg.orders.reduce((max, o) => Math.max(max, Number(o.id) || 0), 0) + 1;
    const order = {
      id: nextId,
      externalId: d.external_id || externalId,
      chargeId: d.id || null,
      copyPaste: copyPaste,
      userId: interaction.user.id,
      userName: interaction.user.username,
      catalog: cat.name,
      product: p.name,
      amount: Number(p.price),
      status: d.status || 'pending',
      createdAt: new Date().toISOString(),
      paidAt: null,
      deliveredAt: null,
    };
    cfg.orders.push(order);
    if (p.stock > 0) p.stock -= 1;
    saveConfig(cfg);
    await refreshPinsForCatalog(cat.name);

    const embed = new EmbedBuilder()
      .setTitle('💠 Pagamento PIX — ' + p.name)
      .setColor(0x00d26a)
      .setDescription(
        'Escaneie o **QR Code** abaixo no app do seu banco ou utilize o código **PIX Copia e Cola** para concluir o pagamento.\n\n' +
        '**PIX Copia e Cola:**\n```\n' + copyPaste + '\n```'
      )
      .addFields(
        { name: '🛒 Produto', value: p.name + ' (' + cat.name + ')', inline: true },
        { name: '💰 Valor', value: money(p.price), inline: true },
        { name: '🧾 Pedido', value: '#' + order.id, inline: true },
        { name: '📌 Status', value: '⏳ Aguardando pagamento (' + (d.status || 'pending') + ')', inline: false }
      )
      .setFooter({ text: 'ID da transação: ' + (d.id || externalId) })
      .setTimestamp();

    if (files.length > 0) {
      embed.setImage('attachment://qrcode.png');
    }
    if (cfg.botAvatar) embed.setThumbnail(cfg.botAvatar);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('pix:copy:' + order.id).setLabel('Copiar Código PIX').setStyle(ButtonStyle.Primary).setEmoji('📋'),
      new ButtonBuilder().setCustomId('pix:check:' + order.id).setLabel('Verificar Pagamento').setStyle(ButtonStyle.Success).setEmoji('🔄'),
      new ButtonBuilder().setCustomId('pix:cancel:' + order.id).setLabel('Cancelar').setStyle(ButtonStyle.Danger).setEmoji('✖️')
    );

    await interaction.editReply({
      content: '**Pedido #' + order.id + '** gerado! Copie o código PIX abaixo ou escaneie o QR Code:',
      embeds: [embed],
      files: files,
      components: [row],
    });
    await notifyPrivate('🧾 Nova cobrança PIX gerada: Pedido **#' + order.id + '** | Cliente: **' + interaction.user.username + '** | Produto: **' + p.name + '** (' + money(p.price) + ')');
  } catch (e) {
    console.error('charge err', e.message);
    await interaction.editReply({ content: '❌ Erro ao gerar cobrança PIX: ' + e.message }).catch(() => {});
  }
}

async function processPaymentUpdate(order, newStatus) {
  if (!order) return false;
  if (order.status === 'paid' || order.status === 'delivered') return true;
  if (newStatus === 'completed' || newStatus === 'paid' || newStatus === 'approved') {
    order.status = 'paid';
    order.paidAt = new Date().toISOString();
    saveConfig(cfg);
    try {
      const user = await client.users.fetch(order.userId);
      await user.send('✅ **Pagamento confirmado!**\nPedido **#' + order.id + '** — **' + order.product + '** (' + money(order.amount) + ')').catch(() => {});
    } catch (err) {}
    await notifyPrivate('✅ Pagamento confirmado: Pedido **#' + order.id + '** - ' + order.userName + ' - ' + order.product + ' (' + money(order.amount) + ')');
    return true;
  } else if (newStatus === 'cancelled' || newStatus === 'expired' || newStatus === 'failed') {
    if (order.status !== newStatus) {
      order.status = newStatus;
      for (const cat of cfg.catalogs) {
        const prod = (cat.products || []).find(p => p.name === order.product);
        if (prod && prod.stock !== -1) prod.stock += 1;
      }
      saveConfig(cfg);
    }
  }
  return false;
}

async function handleComponent(interaction) {
  try {
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'browse:catalog') {
        const cat = getCatalog(interaction.values[0]);
        if (!cat) return interaction.update({ content: 'Catalogo nao encontrado.', components: [] });
        return interaction.update({ embeds: [catalogEmbed(cat)], components: browseUpComponents(cat) });
      }
      if (interaction.customId.startsWith('browse:buy:')) {
        const catName = interaction.customId.slice('browse:buy:'.length);
        const cat = getCatalog(catName);
        if (!cat) return interaction.reply({ content: 'Catalogo nao encontrado.', ephemeral: true });
        const val = interaction.values[0];
        const p = cat.products.find(x => x.name === val);
        if (!p) return interaction.reply({ content: 'Produto nao encontrado.', ephemeral: true });
        return await generateCharge(interaction, cat, p);
      }
      if (interaction.customId === 'help:cat') {
        const key = interaction.values[0];
        return interaction.update({ embeds: [helpCategoryEmbed(key)], components: helpBackComponents() });
      }
      if (interaction.customId.startsWith('pin:select:')) {
        const catName = interaction.customId.slice('pin:select:'.length);
        const cat = getCatalog(catName);
        if (!cat) return interaction.reply({ content: 'Catalogo nao encontrado.', ephemeral: true });
        const val = interaction.values[0];
        if (val === '__none__') return interaction.update({ content: pinnedContent(cat), components: pinnedSelectMenu(cat) });
        const p = cat.products.find(x => x.name === val);
        if (!p) return interaction.update({ content: pinnedContent(cat), components: pinnedSelectMenu(cat) });
        await interaction.deferReply({ ephemeral: true });
        if (interaction.message) {
          interaction.message.edit({ content: pinnedContent(cat), components: pinnedSelectMenu(cat) }).catch(() => {});
        }
        return await generateCharge(interaction, cat, p);
      }
      if (interaction.customId.startsWith('announce:select:')) {
        const announceId = parseInt(interaction.customId.slice('announce:select:'.length));
        const ann = (cfg.announces || []).find(a => a.id === announceId);
        const cat = ann ? getCatalog(ann.catalog) : null;
        if (!cat) return interaction.reply({ content: 'Catalogo nao encontrado.', ephemeral: true });
        const val = interaction.values[0];
        if (val === '__none__') return interaction.deferUpdate();
        const p = cat.products.find(x => x.name === val);
        if (!p) return interaction.reply({ content: 'Produto nao encontrado.', ephemeral: true });
        await interaction.deferReply({ ephemeral: true });
        if (interaction.message) {
          interaction.message.edit({ components: interaction.message.components }).catch(() => {});
        }
        return await generateCharge(interaction, cat, p);
      }
    }
    if (interaction.isButton()) {
      if (interaction.customId.startsWith('pix:copy:')) {
        const orderId = Number(interaction.customId.slice('pix:copy:'.length));
        const order = cfg.orders.find(o => o.id === orderId);
        if (!order || !order.copyPaste) {
          return interaction.reply({ content: 'Código PIX não encontrado para este pedido.', ephemeral: true });
        }
        return interaction.reply({ content: order.copyPaste, ephemeral: true });
      }
      if (interaction.customId.startsWith('pix:check:')) {
        const orderId = Number(interaction.customId.slice('pix:check:'.length));
        const order = cfg.orders.find(o => o.id === orderId);
        if (!order) return interaction.reply({ content: 'Pedido não encontrado.', ephemeral: true });
        if (order.status === 'paid' || order.status === 'delivered') {
          return interaction.reply({ content: '✅ O pagamento do **Pedido #' + order.id + '** já foi confirmado!', ephemeral: true });
        }
        await interaction.deferReply({ ephemeral: true });
        try {
          const r = await pc.getCharge(order.chargeId || order.externalId);
          const d = (r && r.data) ? r.data : r;
          const st = (d && d.status) ? String(d.status).toLowerCase() : 'pending';
          const paid = await processPaymentUpdate(order, st);
          if (paid) {
            return interaction.editReply({ content: '✅ **Pagamento confirmado com sucesso!** Seu pedido **#' + order.id + '** (' + order.product + ') foi aprovado.' });
          }
          return interaction.editReply({ content: '⏳ Pagamento ainda consta como **' + st + '**. Assim que concluir o PIX, aguarde alguns segundos e tente novamente.' });
        } catch (err) {
          return interaction.editReply({ content: '⚠️ Não foi possível consultar o status agora: ' + err.message });
        }
      }
      if (interaction.customId.startsWith('pix:cancel:')) {
        const orderId = Number(interaction.customId.slice('pix:cancel:'.length));
        const order = cfg.orders.find(o => o.id === orderId);
        if (!order) return interaction.reply({ content: 'Pedido não encontrado.', ephemeral: true });
        if (order.status === 'paid' || order.status === 'delivered') {
          return interaction.reply({ content: 'Este pedido já foi pago e não pode ser cancelado.', ephemeral: true });
        }
        await processPaymentUpdate(order, 'cancelled');
        await refreshPinsForCatalog(order.catalog);
        return interaction.update({ content: '❌ **Pedido #' + order.id + '** cancelado.', embeds: [], components: [] });
      }
    }
    if (interaction.isButton() && interaction.customId.startsWith('pin:up:')) {
      const catName = interaction.customId.slice('pin:up:'.length);
      const cat = getCatalog(catName);
      if (!cat) return interaction.update({ content: 'Catalogo nao encontrado.', components: [] });
      return interaction.update({ content: pinnedContent(cat), embeds: [], components: pinnedSelectMenu(cat) });
    }
    if (interaction.isButton() && interaction.customId.startsWith('announce:up:')) {
      const announceId = parseInt(interaction.customId.slice('announce:up:'.length));
      const ann = (cfg.announces || []).find(a => a.id === announceId);
      const cat = ann ? getCatalog(ann.catalog) : null;
      if (!cat) return interaction.update({ content: 'Catalogo nao encontrado.', components: [] });
      const opts = (ann.products || []).map(name => { const p = (cat.products||[]).find(x=>x.name===name); if (!p) return null; return new (require('discord.js').StringSelectMenuOptionBuilder)().setLabel(p.name.slice(0,100)).setDescription((money(p.price)+(p.description?' - '+p.description.slice(0,60):'')).slice(0,100)).setValue(p.name.slice(0,100)); }).filter(Boolean);
      if (opts.length === 0) opts.push(new (require('discord.js').StringSelectMenuOptionBuilder)().setLabel('Sem produtos').setValue('__none__'));
      const menu = new (require('discord.js').StringSelectMenuBuilder)().setCustomId('announce:select:'+announceId).setPlaceholder('Escolha um produto').addOptions(opts);
      const up = new (require('discord.js').ButtonBuilder)().setCustomId('announce:up:'+announceId).setLabel('Voltar').setStyle(2).setEmoji('⬆️');
      const comps = [new (require('discord.js').ActionRowBuilder)().addComponents(menu), new (require('discord.js').ActionRowBuilder)().addComponents(up)];
      return interaction.update({ content: '@everyone ' + (ann.message || ('Catalogo ' + cat.name.toUpperCase() + ' disponivel!')), embeds: [catalogEmbed(cat)], components: comps, allowedMentions: { parse: [] } });
    }
    if (interaction.isButton() && interaction.customId === 'browse:up') {
      return interaction.update({ embeds: [catalogsOverviewEmbed()], components: browseCatalogComponents() });
    }
    if (interaction.isButton() && interaction.customId === 'help:up') {
      return interaction.update({ embeds: [helpOverviewEmbed()], components: helpComponents() });
    }
  } catch (e) {
    console.error(e);
    if (!interaction.replied && !interaction.deferred) interaction.reply({ content: 'Erro: ' + e.message, ephemeral: true }).catch(() => {});
  }
}

client.on('error', (e) => console.error('client error', e && e.message));
client.on('interactionCreate', async (i) => {
  try {
    if (i.isChatInputCommand()) await handle(i);
  else if (i.isStringSelectMenu() || i.isButton()) await handleComponent(i);
  } catch (e) { console.error('interaction err', e && e.message); }
});

const app = express();

client.once('clientReady', async () => {
  console.log('Logged in as ' + client.user.tag);
  try { await client.user.setUsername(cfg.botName); } catch (e) {}
  if (cfg.botAvatar) { try { await client.user.setAvatar(cfg.botAvatar); } catch (e) {} }
  if (cfg.botBanner) { try { await client.user.setBanner(cfg.botBanner); } catch (e) {} }
  await registerCommands();
  await notifyPrivate('**' + cfg.botName + '** online. ' + cfg.catalogs.length + ' catalogo(s), ' + cfg.pins.length + ' pin(s), ' + cfg.targets.length + ' bot(s), ' + cfg.orders.length + ' pedido(s).');
});

  // web panel security headers & body limit
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use(express.json({
    limit: '1mb',
    verify: (req, res, buf) => { req.rawBody = buf; },
  }));

  // Direct webhook endpoint from PingoCash/IcePay (no session auth required)
  const handlePingoWebhook = async (req, res) => {
    const sig = req.headers['x-icepay-signature'] || req.headers['x-pingocash-signature'] || req.headers['x-signature'];
    const secret = process.env.PINGO_WEBHOOK_SECRET;
    if (!pc.verifyWebhookSignature(req.rawBody, sig, secret)) {
      return res.status(401).json({ ok: false, error: 'invalid signature' });
    }
    const body = req.body || {};
    if (body.event === 'payment.updated' || body.data) {
      const d = body.data || body;
      const order = cfg.orders.find(o => o.externalId === d.external_id || (o.chargeId && o.chargeId === d.id));
      if (order && d.status) {
        await processPaymentUpdate(order, String(d.status).toLowerCase());
      }
    }
    res.json({ ok: true });
  };
  app.post('/webhook/pingocash', handlePingoWebhook);
  app.post('/api/webhook/pingocash', handlePingoWebhook);
  app.get('/health', (req, res) => res.json({ ok: true, bot: client.user ? client.user.tag : null }));

  const crypto = require('crypto');
  const ADMIN_USER = process.env.ADMIN_USER || 'WL7_ADMIN';
  const ADMIN_PASS = process.env.ADMIN_PASS || 'WL7#x9K$mP2@vQ8!zR4';
  const SESSION_SECRET = process.env.SESSION_SECRET || 'wl7-sec-9f4e2a8d1c7b6e3f5a0d9c8b7e6f5a4d3c2b1a0f';
  const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
  const revokedTokens = new Set();

  function safeCompare(a, b) {
    const ha = crypto.createHash('sha256').update(String(a || '')).digest();
    const hb = crypto.createHash('sha256').update(String(b || '')).digest();
    return crypto.timingSafeEqual(ha, hb);
  }

  function createSessionToken(user) {
    const exp = Date.now() + SESSION_TTL_MS;
    const payload = Buffer.from(JSON.stringify({ u: user, exp })).toString('base64url');
    const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
    return payload + '.' + sig;
  }

  function verifySessionToken(token) {
    if (!token || typeof token !== 'string' || revokedTokens.has(token)) return false;
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const [payload, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
    if (!safeCompare(sig, expectedSig)) return false;
    try {
      const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      if (!data.exp || Date.now() > data.exp) return false;
      return safeCompare(data.u, ADMIN_USER);
    } catch (e) {
      return false;
    }
  }

  // Brute-force protection (max 5 failed attempts per 15 min per IP)
  const loginAttempts = new Map();
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCKOUT_MS = 15 * 60 * 1000;

  function getClientIp(req) {
    return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  }

  function getToken(req) {
    const m = (req.headers.cookie || '').match(/(?:^|;\s*)session=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function isAuth(req) {
    const t = getToken(req);
    if (verifySessionToken(t)) return true;
    const internalSecret = process.env.INTERNAL_API_SECRET;
    if (internalSecret && req.headers['x-internal-secret'] && safeCompare(req.headers['x-internal-secret'], internalSecret)) {
      return true;
    }
    return false;
  }

  // auth middleware for /api and / (except /login and /api/login)
  app.use((req, res, next) => {
    if (req.path === '/health' || req.path === '/login' || req.path === '/login.html' || req.path === '/favicon.svg' || req.path === '/api/login' || req.path === '/webhook/pingocash' || req.path === '/api/webhook/pingocash') {
      return next();
    }
    if (req.path.startsWith('/api/')) {
      if (!isAuth(req)) return res.status(401).json({ error: 'Não autorizado' });
      return next();
    }
    if (!isAuth(req)) return res.redirect('/login');
    next();
  });

  app.post('/api/login', async (req, res) => {
    const ip = getClientIp(req);
    const now = Date.now();
    const record = loginAttempts.get(ip) || { count: 0, lockUntil: 0 };
    if (record.lockUntil > now) {
      const mins = Math.ceil((record.lockUntil - now) / 60000);
      return res.status(429).json({ error: 'Muitas tentativas falhas. Tente novamente em ' + mins + ' min.' });
    }
    const { username, password } = req.body || {};
    if (safeCompare(username, ADMIN_USER) && safeCompare(password, ADMIN_PASS)) {
      loginAttempts.delete(ip);
      const token = createSessionToken(ADMIN_USER);
      const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https' || Boolean(process.env.VERCEL);
      res.setHeader(
        'Set-Cookie',
        'session=' + encodeURIComponent(token) + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200' + (isSecure ? '; Secure' : '')
      );
      return res.json({ ok: true });
    }
    record.count += 1;
    if (record.count >= MAX_LOGIN_ATTEMPTS) {
      record.lockUntil = now + LOCKOUT_MS;
      record.count = 0;
      notifyPrivate('🚨 **Alerta de Segurança**: IP `' + ip + '` bloqueado por 15 minutos após 5 tentativas de login inválidas no painel.').catch(() => {});
    }
    loginAttempts.set(ip, record);
    res.status(401).json({ error: 'Credenciais inválidas' });
  });

  app.post('/api/logout', (req, res) => {
    const t = getToken(req);
    if (t) revokedTokens.add(t);
    res.setHeader('Set-Cookie', 'session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
    res.json({ ok: true });
  });
  app.get('/login', (req, res) => res.sendFile(require('path').join(__dirname, 'public', 'login.html')));
  app.use(express.static(path.join(__dirname, 'public')));
  // API endpoints
function getDateKeyBRT(dateInput) {
  try {
    const d = dateInput ? new Date(dateInput) : new Date();
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  } catch (e) {
    const d = dateInput ? new Date(dateInput) : new Date();
    return d.toISOString().slice(0, 10);
  }
}

  app.get('/api/status', async (req, res) => {
    await syncOrdersFromPingo();
    const targetDate = req.query.date || getDateKeyBRT();
    const dayOrders = cfg.orders.filter(o => getDateKeyBRT(o.createdAt) === targetDate);
    const paidList = dayOrders.filter(o => o.status === 'paid' || o.status === 'delivered');
    const pendingList = dayOrders.filter(o => o.status === 'pending');
    const revenue = paidList.reduce((a, o) => a + Number(o.amount || 0), 0);
    const pendingRevenue = pendingList.reduce((a, o) => a + Number(o.amount || 0), 0);
    res.json({
      date: targetDate,
      botName: cfg.botName,
      currency: cfg.currency,
      botAvatar: cfg.botAvatar,
      botBanner: cfg.botBanner,
      catalogs: cfg.catalogs.length,
      products: cfg.catalogs.reduce((a, c) => a + (c.products ? c.products.length : 0), 0),
      orders: dayOrders.length,
      targets: cfg.targets.length,
      pins: cfg.pins.length,
      pendingOrders: pendingList.length,
      paidOrders: paidList.length,
      revenue,
      pendingRevenue,
      walletBalance: cfg.walletBalance !== undefined ? cfg.walletBalance : 0,
    });
  });
  app.get('/api/catalogs', (req, res) => res.json(cfg.catalogs));
  app.post('/api/catalogs', (req, res) => {
    const { name, description } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    if (getCatalog(name)) return res.status(400).json({ error: 'exists' });
    cfg.catalogs.push({ name, description: description || '', intro: '', products: [] });
    saveConfig(cfg);
    res.json({ ok: true });
  });
  app.delete('/api/catalogs/:name', (req, res) => {
    cfg.catalogs = cfg.catalogs.filter(c => c.name.toLowerCase() !== req.params.name.toLowerCase());
    cfg.pins = cfg.pins.filter(p => p.catalog.toLowerCase() !== req.params.name.toLowerCase());
    saveConfig(cfg);
    res.json({ ok: true });
  });
  app.put('/api/catalogs/:name/intro', (req, res) => {
    const cat = getCatalog(req.params.name);
    if (!cat) return res.status(404).json({ error: 'not found' });
    cat.intro = (req.body && req.body.intro) || '';
    saveConfig(cfg);
    res.json({ ok: true });
  });
  app.get('/api/products', (req, res) => {
    const cat = req.query.catalog ? getCatalog(req.query.catalog) : null;
    if (cat) return res.json(cat.products);
    res.json(cfg.catalogs.map(c => ({ catalog: c.name, products: c.products })));
  });
  app.post('/api/products', (req, res) => {
    const { catalog, name, price, description, stock } = req.body || {};
    const cat = getCatalog(catalog);
    if (!cat) return res.status(404).json({ error: 'catalog not found' });
    const existing = cat.products.find(p => p.name.toLowerCase() === String(name).toLowerCase());
    if (existing) { existing.price = Number(price); existing.description = description || ''; if (stock !== undefined) existing.stock = Number(stock); }
    else cat.products.push({ name, price: Number(price), description: description || '', stock: stock !== undefined ? Number(stock) : -1 });
    saveConfig(cfg);
    refreshPinsForCatalog(cat.name).catch(()=>{});
    res.json({ ok: true });
  });
  app.delete('/api/products/:catalog/:name', (req, res) => {
    const cat = getCatalog(req.params.catalog);
    if (!cat) return res.status(404).json({ error: 'catalog not found' });
    cat.products = cat.products.filter(p => p.name.toLowerCase() !== req.params.name.toLowerCase());
    saveConfig(cfg);
    refreshPinsForCatalog(cat.name).catch(()=>{});
    res.json({ ok: true });
  });
  app.put('/api/products/:catalog/:name/stock', (req, res) => {
    const cat = getCatalog(req.params.catalog);
    if (!cat) return res.status(404).json({ error: 'catalog not found' });
    const p = cat.products.find(x => x.name.toLowerCase() === req.params.name.toLowerCase());
    if (!p) return res.status(404).json({ error: 'product not found' });
    p.stock = Number(req.body.stock);
    saveConfig(cfg);
    refreshPinsForCatalog(cat.name).catch(()=>{});
    res.json({ ok: true });
  });
  app.get('/api/orders', async (req, res) => {
    await syncOrdersFromPingo();
    const targetDate = req.query.date || getDateKeyBRT();
    const dayOrders = cfg.orders.filter(o => getDateKeyBRT(o.createdAt) === targetDate);
    res.json(dayOrders.slice().reverse());
  });
  app.put('/api/orders/:id/status', (req, res) => {
    const order = cfg.orders.find(o => o.id === Number(req.params.id));
    if (!order) return res.status(404).json({ error: 'not found' });
    order.status = req.body.status;
    if (req.body.status === 'paid' && !order.paidAt) order.paidAt = new Date().toISOString();
    if (req.body.status === 'delivered' && !order.deliveredAt) order.deliveredAt = new Date().toISOString();
    saveConfig(cfg);
    res.json({ ok: true });
  });
  app.post('/api/orders/:id/deliver', async (req, res) => {
    const order = cfg.orders.find(o => o.id === Number(req.params.id));
    if (!order) return res.status(404).json({ error: 'not found' });
    order.status = 'delivered';
    if (!order.deliveredAt) order.deliveredAt = new Date().toISOString();
    saveConfig(cfg);
    try { const user = await client.users.fetch(order.userId); await user.send('Seu pedido #' + order.id + ' (' + order.product + ') foi entregue!').catch(()=>{}); } catch(e){}
    res.json({ ok: true });
  });
  app.get('/api/targets', (req, res) => res.json(cfg.targets));
  app.post('/api/targets', (req, res) => {
    const { name, webhook, note } = req.body || {};
    if (!name || !webhook) return res.status(400).json({ error: 'name and webhook required' });
    const existing = cfg.targets.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (existing) { existing.webhook = webhook; existing.note = note || ''; }
    else cfg.targets.push({ name, webhook, note: note || '' });
    saveConfig(cfg);
    res.json({ ok: true });
  });
  app.delete('/api/targets/:name', (req, res) => {
    cfg.targets = cfg.targets.filter(t => t.name.toLowerCase() !== req.params.name.toLowerCase());
    saveConfig(cfg);
    res.json({ ok: true });
  });
  app.post('/api/pushconfig/:name', async (req, res) => {
    const target = cfg.targets.find(t => t.name.toLowerCase() === req.params.name.toLowerCase());
    if (!target) return res.status(404).json({ error: 'not found' });
    try {
      await sendWebhook(target.webhook, { content: 'Configuracao recebida de ' + cfg.botName, embeds: cfg.catalogs.map(catalogEmbed).map(e => e.toJSON()), allowed_mentions: { parse: [] } });
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/pushall', async (req, res) => {
    const results = [];
    for (const t of cfg.targets) {
      try { await sendWebhook(t.webhook, { content: 'Configuracao recebida de ' + cfg.botName, embeds: cfg.catalogs.map(catalogEmbed).map(e => e.toJSON()), allowed_mentions: { parse: [] } }); results.push({ name: t.name, ok: true }); }
      catch (e) { results.push({ name: t.name, ok: false, error: e.message }); }
    }
    res.json({ results });
  });
  app.post('/api/announce', upload.single('banner'), async (req, res) => {
    const cat = getCatalog(req.body.catalog);
    if (!cat) return res.status(404).json({ error: 'catalog not found' });
    const channelId = req.body.channelId;
    let customMsg = (req.body.message || '').trim();
    let selected = req.body.products;
    if (typeof selected === 'string') { try { selected = JSON.parse(selected); } catch (e) { selected = selected.split(',').map(s=>s.trim()).filter(Boolean); } }
    if (!Array.isArray(selected) || selected.length === 0) selected = (cat.products || []).map(p => p.name);
    const bannerPosition = req.body.bannerPosition || 'bottom';
    const announceId = cfg.announces.length + 1;
    // prepare banner attachment
    let bannerFile = null;
    if (req.file) {
      bannerFile = new (require('discord.js').AttachmentBuilder)(req.file.buffer, { name: req.file.originalname || 'banner.png' });
    } else if (req.body.bannerUrl) {
      try {
        const r = await fetch(req.body.bannerUrl);
        const buf = Buffer.from(await r.arrayBuffer());
        bannerFile = new (require('discord.js').AttachmentBuilder)(buf, { name: 'banner.png' });
      } catch (e) {}
    }
    if (!channelId) return res.status(400).json({ error: 'channelId required' });
    const channel = await client.channels.fetch(channelId);
    try {
      const opts = (selected || []).map(name => { const p = (cat.products || []).find(x => x.name === name); if (!p) return null; return new (require('discord.js').StringSelectMenuOptionBuilder)().setLabel(p.name.slice(0,100)).setDescription((money(p.price) + (p.description ? ' - ' + p.description.slice(0,60) : '')).slice(0,100)).setValue(p.name.slice(0,100)); }).filter(Boolean);
      if (opts.length === 0) opts.push(new (require('discord.js').StringSelectMenuOptionBuilder)().setLabel('Sem produtos').setValue('__none__'));
      const menu = new (require('discord.js').StringSelectMenuBuilder)().setCustomId('announce:select:' + announceId).setPlaceholder('Escolha um produto').addOptions(opts);
      const up = new (require('discord.js').ButtonBuilder)().setCustomId('announce:up:' + announceId).setLabel('Voltar').setStyle(2).setEmoji('⬆️');
      const comps = [new (require('discord.js').ActionRowBuilder)().addComponents(menu), new (require('discord.js').ActionRowBuilder)().addComponents(up)];
      const content = '@everyone ' + (customMsg || ('Catalogo ' + cat.name.toUpperCase() + ' disponivel!'));
      const announceMsg = { content: content, embeds: [catalogEmbed(cat)], components: comps, allowedMentions: { parse: ['everyone'] } };
      let msg;
      if (bannerPosition === 'top' && bannerFile) {
        await channel.send({ files: [bannerFile], allowedMentions: { parse: [] } });
        msg = await channel.send(announceMsg);
      } else if (bannerFile) {
        msg = await channel.send(announceMsg);
        await channel.send({ files: [bannerFile], allowedMentions: { parse: [] } });
      } else {
        msg = await channel.send(announceMsg);
      }
      cfg.announces.push({ id: announceId, catalog: cat.name, channelId: channel.id, messageId: msg.id, message: customMsg, products: selected, createdAt: new Date().toISOString() });
      saveConfig(cfg);
      res.json({ ok: true, id: announceId });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.get('/api/channels', (req, res) => {
    const guild = client.guilds.cache.first();
    if (!guild) return res.json([]);
    const chans = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).map(c => ({ id: c.id, name: c.name }));
    res.json(chans);
  });
  app.get('/api/pins', (req, res) => res.json(cfg.pins));
  app.post('/api/pin', async (req, res) => {
    const cat = getCatalog(req.body.catalog);
    if (!cat) return res.status(404).json({ error: 'catalog not found' });
    try {
      const channel = await client.channels.fetch(req.body.channelId);
      const msg = await channel.send({ content: pinnedContent(cat), embeds: [], components: pinnedSelectMenu(cat), allowedMentions: { parse: [] } });
      try { await msg.pin(); } catch (e) {}
      cfg.pins.push({ catalog: cat.name, channelId: channel.id, messageId: msg.id });
      saveConfig(cfg);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.delete('/api/pin', async (req, res) => {
    const catName = req.body.catalog;
    const channelId = req.body.channelId;
    const toRemove = cfg.pins.filter(p => p.catalog.toLowerCase() === String(catName).toLowerCase() && (!channelId || p.channelId === channelId));
    for (const p of toRemove) {
      try {
        const ch = await client.channels.fetch(p.channelId);
        const m = await ch.messages.fetch(p.messageId);
        await m.unpin().catch(()=>{});
        await m.delete().catch(()=>{});
      } catch (e) {}
    }
    cfg.pins = cfg.pins.filter(p => !toRemove.includes(p));
    saveConfig(cfg);
    res.json({ ok: true, removed: toRemove.length });
  });
  app.post('/api/refreshpin/:catalog', async (req, res) => {
    const cat = getCatalog(req.params.catalog);
    if (!cat) return res.status(404).json({ error: 'not found' });
    const pins = cfg.pins.filter(p => p.catalog.toLowerCase() === cat.name.toLowerCase());
    let updated = 0;
    for (const p of pins) {
      try {
        const ch = await client.channels.fetch(p.channelId);
        const m = await ch.messages.fetch(p.messageId);
        await m.edit({ content: pinnedContent(cat), components: pinnedSelectMenu(cat) });
        updated++;
      } catch (e) {}
    }
    res.json({ ok: true, updated });
  });
  app.put('/api/settings', async (req, res) => {
    const { botName, currency, botAvatar, botBanner } = req.body || {};
    if (botName) { cfg.botName = botName; try { await client.user.setUsername(botName); } catch(e){} }
    if (currency) cfg.currency = currency.toUpperCase();
    if (botAvatar) { cfg.botAvatar = botAvatar; try { await client.user.setAvatar(botAvatar); } catch(e){} }
    if (botBanner) { cfg.botBanner = botBanner; try { await client.user.setBanner(botBanner); } catch(e){} }
    saveConfig(cfg);
    res.json({ ok: true });
  });
  app.post('/api/avatar', async (req, res) => {
    try { await client.user.setAvatar(req.body.url); cfg.botAvatar = req.body.url; saveConfig(cfg); res.json({ ok: true }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/avatar/upload', fileUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'no file' });
      const filePath = req.file.path;
      await client.user.setAvatar(filePath);
      cfg.botAvatar = filePath;
      saveConfig(cfg);
      res.json({ ok: true, path: filePath });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/banner/upload', fileUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'no file' });
      const filePath = req.file.path;
      await client.user.setBanner(filePath);
      cfg.botBanner = filePath;
      saveConfig(cfg);
      res.json({ ok: true, path: filePath });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/banner', async (req, res) => {
    try { await client.user.setBanner(req.body.url); cfg.botBanner = req.body.url; saveConfig(cfg); res.json({ ok: true }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
  // fallback to index.html
  app.use((req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
  const panelPort = process.env.PANEL_PORT || 8080;
  if (!process.env.VERCEL) {
    app.listen(panelPort, () => console.log('web panel listening on port ' + panelPort));
    // polling for payment confirmations (via Gateway events AND direct PingoCash API status check)
    setInterval(async () => {
      // 1. Poll gateway /events via GATEWAY_URL binding (or local fallback)
      try {
        const gatewayBase = process.env.GATEWAY_URL || ('http://localhost:' + (process.env.GATEWAY_PORT || 3001));
        const res = await fetch(new URL('/events', gatewayBase));
        if (res.ok) {
          const json = await res.json();
          const events = (json && json.events) || [];
          for (const ev of events) {
            const e = ev.event || {};
            if (e.event !== 'payment.updated') continue;
            const d = e.data || {};
            const order = cfg.orders.find(o => o.externalId === d.external_id || (o.chargeId && o.chargeId === d.id));
            if (order && d.status) {
              await processPaymentUpdate(order, String(d.status).toLowerCase());
            }
          }
        }
      } catch (err) {}

      // 2. Sync transactions and status from PingoCash API
      try {
        await syncOrdersFromPingo(true);
      } catch (err) {}
    }, 5000);

    if (process.env.BOT_TOKEN) {
      client.login(process.env.BOT_TOKEN).catch(e => console.error('Discord login err:', e.message));
    } else {
      console.warn('BOT_TOKEN nao definido em .env');
    }
  }

process.on('unhandledRejection', (e) => console.error('unhandledRejection', e && e.message));
process.on('uncaughtException', (e) => console.error('uncaughtException', e && e.message));

client.on('guildCreate', async (g) => {
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
    await rest.put(Routes.applicationGuildCommands(client.user.id, g.id), { body: commands });
    console.log('guild commands registered for new guild', g.name, g.id);
  } catch (e) { console.error('guildCreate cmd err', e.message); }
});

module.exports = app;















