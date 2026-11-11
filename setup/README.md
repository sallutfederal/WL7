# Setup Bot — Configurador de Bots Discord

Bot Discord que funciona como painel de controle para configurar outros bots em outros chats: foto de perfil, produtos, precos, anuncios com @everyone e envio de configuracao via webhook.

## Instalacao

1. Instale as dependencias:
   \\\ash
   npm install
   \\\
2. Copie .env.example para .env e preencha BOT_TOKEN (token do bot no Discord Developer Portal).
   O webhook privado ja esta configurado.
3. Rode:
   \\\ash
   npm start
   \\\

## Comandos (slash)

| Comando | Descricao |
|---|---|
| /help | Lista comandos |
| /status | Status atual |
| /avatar <url> | Define foto de perfil do bot |
| /name <nome> | Define nome do bot |
| /currency <code> | Moeda (BRL, USD...) |
| /addproduct nome preco [descricao] | Adiciona produto |
| /removeproduct <nome> | Remove produto |
| /products | Lista produtos |
| /clearproducts | Apaga todos |
| /announce [canal] | Anuncia catalogo marcando @everyone |
| /registerbot nome webhook [nota] | Registra outro bot/canal |
| /listbots | Lista bots registrados |
| /removebot <nome> | Remove bot registrado |
| /pushconfig <nome> | Envia config para um bot |
| /pushall | Envia config para todos |
| /sendraw webhook mensagem | Mensagem livre via webhook |

## Fluxo

1. Configure avatar/nome com /avatar e /name.
2. Cadastre produtos com /addproduct.
3. Registre os bots de destino (canais de outros chats) com /registerbot.
4. Use /pushconfig ou /pushall para enviar a configuracao (catalogo + payload JSON) para os outros bots.
5. Use /announce para marcar @everyone com o catalogo no canal atual ou em outro canal.

Todas as alteracoes sao salvas em config.json e notificadas no canal privado via webhook.
