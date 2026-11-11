import fs from 'fs';
import path from 'path';

const LOCAL_CONFIG_FILE = path.join(process.cwd(), 'config.json');
const SETUP_CONFIG_FILE = path.join(process.cwd(), '..', 'setup', 'config.json');

function getConfigFile() {
  if (fs.existsSync(LOCAL_CONFIG_FILE)) return LOCAL_CONFIG_FILE;
  if (fs.existsSync(SETUP_CONFIG_FILE)) return SETUP_CONFIG_FILE;
  return LOCAL_CONFIG_FILE;
}

export interface Product { name: string; price: number; description: string; stock: number; }
export interface Catalog { name: string; description: string; intro: string; products: Product[]; }
export interface Target { name: string; webhook: string; note: string; }
export interface Order { id: number; externalId: string; chargeId: string | null; userId: string; userName: string; catalog: string; product: string; amount: number; status: string; createdAt: string; paidAt: string | null; deliveredAt: string | null; }
export interface Pin { catalog: string; channelId: string; messageId: string; }
export interface Config {
  botName: string; botAvatar: string; botBanner: string; currency: string;
  catalogs: Catalog[]; orders: Order[]; targets: Target[]; pins: Pin[];
  announces: any[]; privateWebhook: string;
}

const DEFAULT_CATALOGS = ['laras', 'infocc', 'btmob', 'consul'];
const DEFAULT_CONFIG: Config = {
  botName: 'SetupBot', botAvatar: '', botBanner: '', currency: 'BRL',
  catalogs: DEFAULT_CATALOGS.map(n => ({ name: n, description: '', intro: '', products: [] })),
  orders: [], targets: [], pins: [], announces: [], privateWebhook: '',
};

export function loadConfig(): Config {
  try {
    const file = getConfigFile();
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
      const c = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
      if (!Array.isArray(c.catalogs)) c.catalogs = DEFAULT_CONFIG.catalogs.map(x => ({ ...x }));
      for (const cat of c.catalogs) {
        if (cat.intro === undefined) cat.intro = '';
        if (!Array.isArray(cat.products)) cat.products = [];
        for (const p of cat.products) { if (p.stock === undefined) p.stock = -1; }
      }
      if (!Array.isArray(c.orders)) c.orders = [];
      if (!Array.isArray(c.pins)) c.pins = [];
      if (!Array.isArray(c.targets)) c.targets = [];
      if (!Array.isArray(c.announces)) c.announces = [];
      for (const n of DEFAULT_CATALOGS) {
        if (!c.catalogs.find((x: Catalog) => x.name.toLowerCase() === n.toLowerCase())) {
          c.catalogs.push({ name: n, description: '', intro: '', products: [] });
        }
      }
      return c as Config;
    }
  } catch (e) { console.error('config load error', e); }
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

export function saveConfig(cfg: Config) {
  const json = JSON.stringify(cfg, null, 2);
  fs.writeFileSync(LOCAL_CONFIG_FILE, json, 'utf8');
  if (fs.existsSync(path.dirname(SETUP_CONFIG_FILE))) {
    try { fs.writeFileSync(SETUP_CONFIG_FILE, json, 'utf8'); } catch {}
  }
}

export function getCatalog(cfg: Config, name: string) {
  return cfg.catalogs.find(c => c.name.toLowerCase() === String(name).toLowerCase());
}

export function money(value: number, currency: string = 'BRL') {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency });
}
