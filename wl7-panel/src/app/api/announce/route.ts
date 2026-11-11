import { NextResponse } from 'next/server';
import { loadConfig, saveConfig, getCatalog } from '@/lib/config';

export async function POST(req: Request) {
  const formData = await req.formData();
  const catalogName = formData.get('catalog') as string;
  const channelId = formData.get('channelId') as string;
  const message = (formData.get('message') as string) || '';
  const productsJson = formData.get('products') as string;
  const bannerPosition = (formData.get('bannerPosition') as string) || 'bottom';
  const bannerFile = formData.get('banner') as File | null;

  const cfg = loadConfig();
  const cat = getCatalog(cfg, catalogName);
  if (!cat) return NextResponse.json({ error: 'catalog not found' }, { status: 404 });
  if (!channelId) return NextResponse.json({ error: 'channelId required' }, { status: 400 });

  const client = (global as any).discordClient;
  if (!client) return NextResponse.json({ error: 'Discord bot not ready' }, { status: 503 });

  const selected = productsJson ? JSON.parse(productsJson) : cat.products.map((p: any) => p.name);

  try {
    const channel = await client.channels.fetch(channelId);
    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

    const embed = new EmbedBuilder().setTitle('Catalogo ' + cat.name.toUpperCase()).setColor(0x57f287).setTimestamp();
    const lines = (cat.products || []).filter((p: any) => selected.includes(p.name)).map((p: any, i: number) => '**' + (i + 1) + '. ' + p.name + '** - ' + Number(p.price).toLocaleString('pt-BR', { style: 'currency', currency: cfg.currency }) + (p.description ? ' _' + p.description + '_' : ''));
    embed.setDescription(lines.join('\n') || 'Nenhum produto.');
    if (cfg.botAvatar) embed.setThumbnail(cfg.botAvatar);

    const opts = selected.map((name: string) => {
      const p = (cat.products || []).find((x: any) => x.name === name);
      if (!p) return null;
      return new StringSelectMenuOptionBuilder().setLabel(p.name.slice(0, 100)).setDescription((Number(p.price).toLocaleString('pt-BR', { style: 'currency', currency: cfg.currency }) + (p.description ? ' - ' + p.description.slice(0, 60) : '')).slice(0, 100)).setValue(p.name.slice(0, 100));
    }).filter(Boolean);
    if (opts.length === 0) opts.push(new StringSelectMenuOptionBuilder().setLabel('Sem produtos').setValue('__none__'));
    const menu = new StringSelectMenuBuilder().setCustomId('announce:select:' + (cfg.announces.length + 1)).setPlaceholder('Escolha um produto').addOptions(opts);
    const up = new ButtonBuilder().setCustomId('announce:up:' + (cfg.announces.length + 1)).setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('⬆️');
    const comps = [new ActionRowBuilder().addComponents(menu), new ActionRowBuilder().addComponents(up)];

    const content = '@everyone ' + (message || ('Catalogo ' + cat.name.toUpperCase() + ' disponivel!'));

    let bannerAttachment = null;
    if (bannerFile) {
      const buf = Buffer.from(await bannerFile.arrayBuffer());
      bannerAttachment = { attachment: buf, name: bannerFile.name || 'banner.png' };
    }

    const announceId = cfg.announces.length + 1;
    let msg;
    if (bannerPosition === 'top' && bannerAttachment) {
      await channel.send({ files: [bannerAttachment], allowedMentions: { parse: [] } });
      msg = await channel.send({ content, embeds: [embed], components: comps, allowedMentions: { parse: ['everyone'] } });
    } else if (bannerAttachment) {
      msg = await channel.send({ content, embeds: [embed], components: comps, allowedMentions: { parse: ['everyone'] } });
      await channel.send({ files: [bannerAttachment], allowedMentions: { parse: [] } });
    } else {
      msg = await channel.send({ content, embeds: [embed], components: comps, allowedMentions: { parse: ['everyone'] } });
    }

    cfg.announces.push({ id: announceId, catalog: cat.name, channelId: channel.id, messageId: msg.id, message, products: selected, createdAt: new Date().toISOString() });
    saveConfig(cfg);

    return NextResponse.json({ ok: true, id: announceId });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}