import { NextResponse } from 'next/server';
import { loadConfig, saveConfig } from '@/lib/config';

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'file';
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'no file' }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = file.type || 'image/png';
  const dataUrl = 'data:' + mime + ';base64,' + buf.toString('base64');
  const cfg = loadConfig();
  if (type === 'avatar') { cfg.botAvatar = dataUrl; }
  else if (type === 'banner') { cfg.botBanner = dataUrl; }
  saveConfig(cfg);
  return NextResponse.json({ ok: true, url: dataUrl });
}
