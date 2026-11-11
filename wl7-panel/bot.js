// Discord bot module - CommonJS for custom server
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', 'setup', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', 'gateway', '.env') });

const pc = fs.existsSync(path.join(__dirname, 'pingocash.js')) ? require('./pingocash') : require('../gateway/pingocash');
const {
  Client, GatewayIntentBits, Partials, REST, Routes,
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder, AttachmentBuilder,
} = require('discord.js');

const LOCAL_CONFIG_FILE = path.join(__dirname, 'config.json');
const SETUP_CONFIG_FILE = path.join(__dirname, '..', 'setup', 'config.json');
function getConfigPath() {
  if (fs.existsSync(LOCAL_CONFIG_FILE)) return LOCAL_CONFIG_FILE;
  if (fs.existsSync(SETUP_CONFIG_FILE)) return SETUP_CONFIG_FILE;
  return LOCAL_CONFIG_FILE;
}

const DEFAULT_CATALOGS = ['laras', 'infocc', 'btmob', 'consul'];
const DEFAULT_CONFIG = {
  botName: 'SetupBot', botAvatar: '', botBanner: '', currency: 'BRL',
  catalogs: DEFAULT_CATALOGS.map(n => ({ name: n, description: '', intro: '', products: [] })),
  orders: [], targets: [], pins: [], announces: [],
  privateWebhook: process.env.PRIVATE_WEBHOOK || '',
};

function loadConfig() {
  try {
    const file = getConfigPath();
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
      const c = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
      if (Array.isArray(c.products) && c.products.length && !c.catalogs) { c.catalogs = [{ name: 'geral', description: '', intro: '', products: c.products }]; delete c.products; }
      if (!Array.isArray(c.catalogs)) c.catalogs = DEFAULT_CONFIG.catalogs.map(x => ({ ...x }));
      for (const cat of c.catalogs) { if (cat.intro === undefined) cat.intro = ''; if (!Array.isArray(cat.products)) cat.products = []; for (const p of cat.products) if (p.stock === undefined) p.stock = -1; }
      for (const n of DEFAULT_CATALOGS) if (!c.catalogs.find(x => x.name.toLowerCase() === n.toLowerCase())) c.catalogs.push({ name: n, description: '', intro: '', products: [] });
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
  fs.writeFileSync(LOCAL_CONFIG_FILE, json, 'utf8');
  if (fs.existsSync(path.dirname(SETUP_CONFIG_FILE))) {
    try { fs.writeFileSync(SETUP_CONFIG_FILE, json, 'utf8'); } catch (e) {}
  }
}

let cfg = loadConfig();
if (!cfg.privateWebhook && process.env.PRIVATE_WEBHOOK) cfg.privateWebhook = process.env.PRIVATE_WEBHOOK;

let activeClient = null;

function money(v) { return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: cfg.currency || 'BRL' }); }
function getCatalog(name) { return cfg.catalogs.find(c => c.name.toLowerCase() === String(name).toLowerCase()); }
function catalogEmbed(cat) {
  const e = new EmbedBuilder().setTitle('Catalogo ' + cat.name.toUpperCase()).setColor(0x57f287).setTimestamp();
  if (!cat.products || cat.products.length === 0) { e.setDescription('Nenhum produto cadastrado.'); return e; }
  const lines = cat.products.map((p, i) => '**' + (i + 1) + '. ' + p.name + '** - ' + money(p.price) + (p.description ? ' _' + p.description + '_' : '') + '  (estoque: ' + (p.stock === -1 ? 'infinito' : p.stock) + ')');
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
function pinnedContent(cat) {
  const intro = cat.intro ? cat.intro + '\n\n' : '';
  return intro + '**' + cat.name.toUpperCase() + '** - selecione abaixo o que deseja:';
}
function pinnedSelectMenu(cat) {
  const opts = (cat.products || []).slice(0, 25).map(p => new StringSelectMenuOptionBuilder().setLabel(p.name.slice(0, 100)).setDescription((money(p.price) + ' | estoque: ' + (p.stock === -1 ? 'infinito' : p.stock) + (p.description ? ' - ' + p.description.slice(0, 60) : '')).slice(0, 100)).setValue(p.name.slice(0, 100)));
  if (opts.length === 0) opts.push(new StringSelectMenuOptionBuilder().setLabel('Sem produtos').setValue('__none__').setDescription('Nenhum produto cadastrado'));
  const menu = new StringSelectMenuBuilder().setCustomId('pin:select:' + cat.name).setPlaceholder('Selecione uma opcao').addOptions(opts);
  const up = new ButtonBuilder().setCustomId('pin:up:' + cat.name).setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('⬆️');
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
        .setDescription((money(p.price) + ' | estoque: ' + (p.stock === -1 ? 'infinito' : p.stock) + (p.description ? ' - ' + p.description.slice(0, 60) : '')).slice(0, 100))
        .setValue(p.name.slice(0, 100))
    );
    const menu = new StringSelectMenuBuilder().setCustomId('browse:buy:' + cat.name).setPlaceholder('Selecione um produto para comprar (PIX)').addOptions(opts);
    rows.push(new ActionRowBuilder().addComponents(menu));
  }
  const up = new ButtonBuilder().setCustomId('browse:up').setLabel('Voltar aos catalogos').setStyle(ButtonStyle.Secondary).setEmoji('⬆️');
  rows.push(new ActionRowBuilder().addComponents(up));
  return rows;
}
function refreshPinsForCatalog(catName) {
  if (!activeClient) return Promise.resolve();
  const cat = getCatalog(catName);
  if (!cat) return Promise.resolve();
  const pins = cfg.pins.filter(p => p.catalog.toLowerCase() === catName.toLowerCase());
  return Promise.all(pins.map(async (p) => {
    try {
      const ch = await activeClient.channels.fetch(p.channelId);
      const m = await ch.messages.fetch(p.messageId);
      await m.edit({ content: pinnedContent(cat), components: pinnedSelectMenu(cat) });
    } catch (e) { console.error('refresh err', e.message); }
  }));
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
    const data = await pc.createCharge({
      amount: Number(p.price),
      external_id: externalId,
      description: 'Pagamento do pedido ' + p.name + ' (' + cat.name + ')',
      payer: { name: payerName, document: '12345678909' },
    });
    const d = (data && data.data) ? data.data : data;
    const copyPaste = d.copy_paste || d.qr_code || '';
    const qrB64 = d.qr_code_base64 || '';
    const files = [];
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
    if (activeClient) {
      try {
        const user = await activeClient.users.fetch(order.userId);
        await user.send('✅ **Pagamento confirmado!**\nPedido **#' + order.id + '** — **' + order.product + '** (' + money(order.amount) + ')').catch(() => {});
      } catch (err) {}
    }
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

const commands = [
  new SlashCommandBuilder().setName('help').setDescription('Mostra todos os comandos'),
  new SlashCommandBuilder().setName('status').setDescription('Status atual'),
  new SlashCommandBuilder().setName('avatar').setDescription('Foto de perfil do bot').addStringOption(o => o.setName('url').setDescription('URL da imagem').setRequired(true)),
  new SlashCommandBuilder().setName('name').setDescription('Nome do bot').addStringOption(o => o.setName('nome').setDescription('Novo nome').setRequired(true)),
  new SlashCommandBuilder().setName('currency').setDescription('Moeda').addStringOption(o => o.setName('code').setDescription('Codigo da moeda').setRequired(true)),
  new SlashCommandBuilder().setName('catalogs').setDescription('Lista catalogos'),
  new SlashCommandBuilder().setName('addcatalog').setDescription('Cria um catalogo').addStringOption(o => o.setName('nome').setDescription('Nome do catalogo').setRequired(true)).addStringOption(o => o.setName('descricao').setDescription('Descricao').setRequired(false)),
  new SlashCommandBuilder().setName('removecatalog').setDescription('Remove um catalogo').addStringOption(o => o.setName('nome').setDescription('Nome do catalogo').setRequired(true)),
  new SlashCommandBuilder().setName('setintro').setDescription('Define texto introdutorio de um catalogo').addStringOption(o => o.setName('catalogo').setDescription('Catalogo').setRequired(true)).addStringOption(o => o.setName('texto').setDescription('Texto introdutorio').setRequired(true)),
  new SlashCommandBuilder().setName('addproduct').setDescription('Adiciona produto a um catalogo').addStringOption(o => o.setName('catalogo').setDescription('Catalogo').setRequired(true)).addStringOption(o => o.setName('nome').setDescription('Nome do produto').setRequired(true)).addNumberOption(o => o.setName('preco').setDescription('Preco').setRequired(true)).addStringOption(o => o.setName('descricao').setDescription('Descricao').setRequired(false)),
  new SlashCommandBuilder().setName('removeproduct').setDescription('Remove produto de um catalogo').addStringOption(o => o.setName('catalogo').setDescription('Catalogo').setRequired(true)).addStringOption(o => o.setName('nome').setDescription('Nome do produto').setRequired(true)),
  new SlashCommandBuilder().setName('products').setDescription('Lista produtos').addStringOption(o => o.setName('catalogo').setDescription('Catalogo (opcional)').setRequired(false)),
  new SlashCommandBuilder().setName('browse').setDescription('Popup para navegar catalogos e produtos'),
  new SlashCommandBuilder().setName('pinmessage').setDescription('Fixa mensagem interativa em um canal').addStringOption(o => o.setName('catalogo').setDescription('Catalogo').setRequired(true)).addChannelOption(o => o.setName('canal').setDescription('Canal de destino').setRequired(true)),
  new SlashCommandBuilder().setName('unpin').setDescription('Remove mensagem fixa de um catalogo/canal').addStringOption(o => o.setName('catalogo').setDescription('Catalogo').setRequired(true)).addChannelOption(o => o.setName('canal').setDescription('Canal').setRequired(false)),
  new SlashCommandBuilder().setName('refreshpin').setDescription('Atualiza mensagens fixas de um catalogo').addStringOption(o => o.setName('catalogo').setDescription('Catalogo').setRequired(true)),
  new SlashCommandBuilder().setName('listpins').setDescription('Lista mensagens fixas'),
  new SlashCommandBuilder().setName('announce').setDescription('Anuncia um catalogo marcando @everyone').addStringOption(o => o.setName('catalogo').setDescription('Catalogo').setRequired(true)).addChannelOption(o => o.setName('canal').setDescription('Canal de destino').setRequired(false)),
  new SlashCommandBuilder().setName('registerbot').setDescription('Registra outro bot/canal').addStringOption(o => o.setName('nome').setDescription('Nome do bot').setRequired(true)).addStringOption(o => o.setName('webhook').setDescription('Webhook do canal').setRequired(true)).addStringOption(o => o.setName('nota').setDescription('Observacao').setRequired(false)),
  new SlashCommandBuilder().setName('listbots').setDescription('Lista bots registrados'),
  new SlashCommandBuilder().setName('removebot').setDescription('Remove bot registrado').addStringOption(o => o.setName('nome').setDescription('Nome do bot').setRequired(true)),
  new SlashCommandBuilder().setName('pushconfig').setDescription('Envia config para um bot').addStringOption(o => o.setName('nome').setDescription('Nome do bot').setRequired(true)),
  new SlashCommandBuilder().setName('pushall').setDescription('Envia config para todos os bots'),
  new SlashCommandBuilder().setName('sendraw').setDescription('Mensagem livre via webhook').addStringOption(o => o.setName('webhook').setDescription('Webhook de destino').setRequired(true)).addStringOption(o => o.setName('mensagem').setDescription('Mensagem').setRequired(true)),
  new SlashCommandBuilder().setName('setstock').setDescription('Define estoque de um produto').addStringOption(o => o.setName('catalogo').setDescription('Catalogo').setRequired(true)).addStringOption(o => o.setName('nome').setDescription('Nome do produto').setRequired(true)).addIntegerOption(o => o.setName('quantidade').setDescription('Quantidade (-1 = ilimitado)').setRequired(true)),
  new SlashCommandBuilder().setName('orders').setDescription('Lista pedidos').addStringOption(o => o.setName('status').setDescription('pending/paid/delivered/cancelled (opcional)').setRequired(false)),
  new SlashCommandBuilder().setName('myorders').setDescription('Meus pedidos'),
  new SlashCommandBuilder().setName('orderstatus').setDescription('Altera status de um pedido').addIntegerOption(o => o.setName('id').setDescription('ID do pedido').setRequired(true)).addStringOption(o => o.setName('status').setDescription('pending/paid/delivered/cancelled').setRequired(true)),
  new SlashCommandBuilder().setName('deliver').setDescription('Marca pedido como entregue').addIntegerOption(o => o.setName('id').setDescription('ID do pedido').setRequired(true)),
].map(c => c.toJSON());

async function registerCommands(client) {
  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
  const clientId = client.user.id;
  let guilds = [...client.guilds.cache.values()];
  if (guilds.length === 0) {
    try { const list = await rest.get(Routes.userGuilds()); guilds = list.map(g => ({ id: g.id, name: g.name })); } catch (e) { console.error('fetch guilds err', e.message); }
  }
  for (const g of guilds) {
    try { await rest.put(Routes.applicationGuildCommands(clientId, g.id), { body: commands }); console.log('guild commands registered for', g.name, g.id); }
    catch (e) { console.error('guild cmd err', g.id, e.message); }
  }
  try { await rest.put(Routes.applicationCommands(clientId), { body: commands }); console.log('global commands registered:', commands.length); }
  catch (e) { console.error('global cmd err', e.message); }
}

async function handleInteraction(interaction) {
  if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu() && !interaction.isButton()) return;
  try {
    cfg = loadConfig();
    if (interaction.isChatInputCommand()) {
      const name = interaction.commandName;
      if (name === 'help') {
        const rows = ['`/help` - lista comandos', '`/status` - status', '`/products` - lista produtos', '`/browse` - popup', '`/announce catalogo [canal]` - anuncia', '`/pinmessage catalogo canal` - fixa', '`/pushconfig nome` - envia config'].join('\n');
        return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Comandos').setDescription(rows).setColor(0x5865f2)], ephemeral: true });
      }
      if (name === 'status') {
        const e = new EmbedBuilder().setTitle('Status').addFields(
          { name: 'Nome', value: cfg.botName, inline: true },
          { name: 'Moeda', value: cfg.currency, inline: true },
          { name: 'Catalogos', value: String(cfg.catalogs.length), inline: true },
          { name: 'Produtos', value: String(cfg.catalogs.reduce((a,c)=>a+(c.products?c.products.length:0),0)), inline: true },
          { name: 'Pedidos', value: String(cfg.orders.length), inline: true },
        ).setColor(0xfee75c);
        return interaction.reply({ embeds: [e], ephemeral: true });
      }
      if (name === 'browse') {
        return interaction.reply({ embeds: [catalogsOverviewEmbed()], components: browseCatalogComponents(), ephemeral: true });
      }
      return interaction.reply({ content: 'Comando: ' + name + '. Use o painel web para gerenciar.', ephemeral: true });
    }
    if (interaction.isStringSelectMenu()) {
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
      if (interaction.customId.startsWith('pin:up:')) {
        const catName = interaction.customId.slice('pin:up:'.length);
        const cat = getCatalog(catName);
        if (!cat) return interaction.update({ content: 'Catalogo nao encontrado.', components: [] });
        return interaction.update({ content: pinnedContent(cat), embeds: [], components: pinnedSelectMenu(cat) });
      }
      if (interaction.customId.startsWith('announce:up:')) {
        const announceId = parseInt(interaction.customId.slice('announce:up:'.length));
        const ann = (cfg.announces || []).find(a => a.id === announceId);
        const cat = ann ? getCatalog(ann.catalog) : null;
        if (!cat) return interaction.update({ content: 'Catalogo nao encontrado.', components: [] });
        return interaction.update({ content: ann.message || pinnedContent(cat), embeds: [catalogEmbed(cat)], components: pinnedSelectMenu(cat) });
      }
      if (interaction.customId === 'browse:up') {
        return interaction.update({ embeds: [catalogsOverviewEmbed()], components: browseCatalogComponents() });
      }
    }
  } catch (e) {
    console.error(e);
    const msg = 'Erro: ' + e.message;
    if (interaction.deferred || interaction.replied) interaction.editReply({ content: msg }).catch(() => {});
    else interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
  }
}

function startBot() {
  if (!process.env.BOT_TOKEN) { console.log('BOT_TOKEN not set, skipping Discord bot'); return null; }
  const client = new Client({ intents: [GatewayIntentBits.Guilds], partials: [Partials.Channel, Partials.Message] });
  activeClient = client;
  client.once('clientReady', async () => {
    console.log('Discord bot ready:', client.user?.tag);
    try { await client.user.setUsername(cfg.botName); } catch (e) {}
    if (cfg.botAvatar) { try { await client.user.setAvatar(cfg.botAvatar); } catch (e) {} }
    if (cfg.botBanner) { try { await client.user.setBanner(cfg.botBanner); } catch (e) {} }
    await registerCommands(client);
    global.discordClient = client;
  });
  client.on('interactionCreate', handleInteraction);
  client.login(process.env.BOT_TOKEN).catch(e => console.error('Discord login failed:', e.message));

  // payment polling (Gateway webhook events + direct PingoCash status API)
  setInterval(async () => {
    cfg = loadConfig();
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

    try {
      const pending = cfg.orders.filter(o => o.status === 'pending' && (o.chargeId || o.externalId));
      for (const order of pending.slice(-10)) {
        try {
          const r = await pc.getCharge(order.chargeId || order.externalId);
          const d = (r && r.data) ? r.data : r;
          if (d && d.status && d.status !== 'pending') {
            await processPaymentUpdate(order, String(d.status).toLowerCase());
          }
        } catch (err) {}
      }
    } catch (err) {}
  }, 5000);
  return client;
}

module.exports = { startBot, loadConfig, saveConfig, cfg: () => cfg, getCatalog, processPaymentUpdate };
