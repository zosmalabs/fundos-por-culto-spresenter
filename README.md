# Fundos por Culto

Plugin independente para o Spresenter que aplica automaticamente imagens ou vídeos de fundo quando versículos da Bíblia são enviados ao vivo.

## Recursos

- Perfis de fundo com imagens ou vídeos da biblioteca do Spresenter.
- Associação de perfis aos setlists salvos.
- Agenda automática por dia e horário.
- Seleção manual para cultos e eventos especiais.
- Fusos horários internacionais com relógio da região escolhida.
- Pesquisa de mídia sem diferenciar acentos e letras maiúsculas.
- Ativação automática da camada de fundo.

Prioridade de seleção: perfil manual, setlist ativo e agenda por dia/horário.

## Instalação

Baixe o arquivo ZIP na seção **Releases** deste repositório. No Spresenter, abra **Configurações → Plugins → Instalar (.zip/pasta)** e selecione o arquivo sem extraí-lo.

## Compatibilidade

- Spresenter 0.3.45 ou mais recente.
- Testado no Windows.
- O código é multiplataforma e deve funcionar no macOS, mas essa plataforma ainda precisa de validação prática.

## Permissões

O plugin solicita somente as permissões declaradas em `manifest.json`: leitura de saídas, mídias, estado ao vivo, setlists e painéis; escrita do estado ao vivo e dos painéis.

## Desenvolvimento

```bash
npm install
npm run dev
```

No Spresenter, use **Configurações → Plugins → Carregar pasta (dev)** e selecione a pasta do projeto.

## Compilação e pacote

```bash
npm run build
npm run package
```

O pacote instalável será criado na pasta `release`.

## Estrutura

```text
manifest.json      Metadados e permissões do plugin
src/code.ts        Automação e integração com o Spresenter
src/ui/            Interface do painel em React
sdk/               SDK do Spresenter usado pelo projeto
scripts/           Script de empacotamento
```

Este é um projeto comunitário independente e não oficial.
