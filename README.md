# ESTUDEX

Aplicativo desktop para salas, chat e transmissão entre amigos.

## Baixar para Windows

**Versão atual: v1.9.3 — Hotfix 2**

Baixe sempre a versão mais recente pela página de Releases:

https://github.com/Kodezinho22/BLAZERX-Downloads/releases/latest

Arquivo oficial para Windows:

`ESTUDEX-Setup.exe`

Também é publicado `BLAZERX-Setup.exe` com o mesmo binário para manter compatibilidade com atualizadores antigos.

Depois de baixar, execute o instalador normalmente; o ESTUDEX cria o atalho na Área de Trabalho e no Menu Iniciar.

## Destaques da v1.9.3

- interface V10.10 preservada com os motores ESTUDEX integrados;
- tema personalizado aplicado de forma consistente na interface;
- perfil, status e contador de amigos estabilizados;
- chat de sala com mídia estabilizada;
- chamadas diretas por DM e integração Radmin;
- hotbar da transmissão ajustada e botão inativo removido;
- identidade visual e ícone oficial do ESTUDEX preservados.

## Hotfix 1 — Radmin Connection

- mantém o heartbeat social ativo para evitar amigos aparecendo offline indevidamente;
- recupera endpoints/IPs Radmin antigos herdados após atualização;
- corrige descoberta e entrada em salas na mesma rede Radmin;
- corrige convites de sala que ainda usavam endereço antigo do amigo;
- repara o estado legado do firewall/Radmin quando autorizado pelo usuário.

## Hotfix 2

- perfil persistido entra direto no ESTUDEX sem recriação a cada abertura;
- remove textos antigos de “perfil de teste”;
- conecta o botão Convidar ao fluxo real de amigos e convites de sala;
- adiciona recebimento de convite com Entrar / Recusar;
- encerra salas em uma única operação e bloqueia races/cliques duplicados;
- evita salas fantasmas ou duplicadas após encerramento;
- mantém todas as correções de Radmin e presença do Hotfix 1.

## Integridade

SHA-256 do `ESTUDEX-Setup.exe` e do `BLAZERX-Setup.exe`:

`39ba06169de5edfabe1afe2c6be81fc36d4248e9a081627c23b893e9fc5560ab`

## Sobre este repositório

Este repositório é público apenas para distribuição do ESTUDEX. O código-fonte principal do aplicativo permanece privado.
