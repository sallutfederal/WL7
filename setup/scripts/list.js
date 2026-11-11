const cmds = [
  ['avatar <url>', 'Define a foto de perfil do bot'],
  ['name <nome>', 'Define o nome do bot'],
  ['currency <code>', 'Define a moeda (BRL, USD, EUR...)'],
  ['catalogs', 'Lista todos os catalogos'],
  ['addcatalog nome [descricao]', 'Cria um novo catalogo'],
  ['removecatalog <nome>', 'Remove um catalogo'],
  ['setintro catalogo texto', 'Define texto introdutorio de um catalogo'],
  ['addproduct catalogo nome preco [descricao]', 'Adiciona produto a um catalogo'],
  ['removeproduct catalogo nome', 'Remove produto de um catalogo'],
  ['products [catalogo]', 'Lista produtos (de um ou todos os catalogos)'],
  ['browse', 'Popup com menu para navegar catalogos e produtos (seta para cima)'],
  ['pinmessage catalogo canal', 'Fixa mensagem interativa em um canal'],
  ['unpin catalogo [canal]', 'Remove mensagem fixa'],
  ['refreshpin catalogo', 'Atualiza mensagens fixas de um catalogo'],
  ['listpins', 'Lista todas as mensagens fixas'],
  ['announce catalogo [canal]', 'Anuncia um catalogo marcando @everyone'],
  ['registerbot nome webhook [nota]', 'Registra outro bot/canal para configurar'],
  ['listbots', 'Lista bots registrados'],
  ['removebot <nome>', 'Remove um bot registrado'],
  ['pushconfig <nome>', 'Envia configuracao para um bot registrado'],
  ['pushall', 'Envia configuracao para todos os bots registrados'],
  ['sendraw webhook mensagem', 'Envia mensagem livre via webhook'],
  ['status', 'Mostra status atual do bot'],
  ['help', 'Lista todos os comandos no Discord'],
];
console.log('=== COMANDOS DO SETUP BOT ===\n');
for (const [c, d] of cmds) console.log('/' + c.padEnd(42) + ' - ' + d);
console.log('\nTotal: ' + cmds.length + ' comandos');
