# Fundos por Culto — Zosma Labs

**Automatize a troca de fundos da Bíblia no SPresenter de acordo com o culto, setlist ou programação.**

Plugin gratuito da [Zosma Labs](https://zosma.com.br) para aplicar automaticamente imagens ou vídeos de fundo quando versículos da Bíblia são enviados ao vivo.

> **Versão atual: 1.8.4**

[Baixar a versão mais recente](https://github.com/zosmalabs/fundos-por-culto-spresenter/releases/latest) · [Tutorial](https://youtu.be/tORfqEOUnok) · [Site da Zosma](https://zosma.com.br)

## Principais recursos

- Perfis de fundo com imagens ou vídeos da biblioteca do SPresenter;
- associação de perfis aos setlists salvos;
- agenda automática por dia e horário;
- seleção manual para cultos e eventos especiais;
- fusos horários internacionais com relógio da região escolhida;
- pesquisa de mídia sem diferenciar acentos ou letras maiúsculas;
- ativação automática da camada de fundo.

A prioridade de seleção é: **perfil manual → setlist ativo → agenda por dia/horário**.

## Compatibilidade

- SPresenter 0.3.45 ou mais recente;
- Windows;
- macOS.

## Instalação

1. Acesse a página de [Releases](https://github.com/zosmalabs/fundos-por-culto-spresenter/releases/latest).
2. Baixe o arquivo ZIP da versão mais recente.
3. No SPresenter, abra **Configurações → Plugins → Instalar (.zip/pasta)**.
4. Selecione o ZIP sem extraí-lo.

## Permissões

O plugin solicita somente as permissões declaradas em `manifest.json`: leitura de saídas, mídias, estado ao vivo, setlists e painéis; escrita do estado ao vivo e dos painéis.

## Desenvolvimento

```bash
npm install
npm run dev
```

No SPresenter, use **Configurações → Plugins → Carregar pasta (dev)** e selecione a pasta do projeto.

### Compilação e pacote

```bash
npm run build
npm run package
```

O pacote instalável será criado na pasta `release`.

## Estrutura

```text
manifest.json      Metadados e permissões do plugin
src/code.ts        Automação e integração com o SPresenter
src/ui/            Interface do painel em React
sdk/               SDK do SPresenter usado pelo projeto
scripts/           Script de empacotamento
```

## Zosma Labs

**Ideias transformadas em software.**

[zosma.com.br](https://zosma.com.br)

Este é um projeto comunitário independente e não oficial, desenvolvido pela Zosma Labs.
