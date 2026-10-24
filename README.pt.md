# CAD-Viewer Plus

[English](./README.md) | [日本語](./README.ja.md) | [简体中文](./README.zh-CN.md) | [한국어](./README.ko.md) | [Español](./README.es.md) | [Português](./README.pt.md) | [Русский](./README.ru.md) | [Čeština](./README.cs.md)

> **Este é um fork.** O CAD-Viewer Plus é um fork de
> [mlightcad/cad-viewer](https://github.com/mlightcad/cad-viewer) (licença MIT).
> É mantido de forma independente e **não é afiliado nem suportado pelo autor
> original**. Relate problemas deste fork nas
> [issues deste repositório](https://github.com/cool0707/cad-viewer-plus/issues),
> e não no projeto original.

Visualizador e editor de DXF/DWG que roda inteiramente no navegador: a leitura
dos desenhos, o processamento geométrico e a renderização (Three.js / WebGL)
acontecem no cliente, então os desenhos nunca saem do dispositivo do usuário.

## O que este fork acrescenta

- **Interface em japonês**: locale `ja` completo para todos os pacotes
  (visualizador, faixa de opções, linha de comando, diálogos, plugins,
  comparador, exportação HTML offline). O idioma é detectado pelo navegador.
- **Fontes auto-hospedadas, sem CDN de CAD**: fontes e modelos de desenho são
  servidos pelo próprio aplicativo (`resources/cad-data` → `./cad-data/`).
  - Texto dos desenhos: **BIZ UD Gothic / Mincho** incluídas, usadas para
    MS Gothic / MS Mincho e como fonte de reserva padrão.
  - Outros sistemas de escrita são carregados sob demanda do **Google Fonts**
    (Arial → Arimo, SimSun → Noto Serif SC, Malgun Gothic → Noto Sans KR, …).
  - Texto da interface: **Noto Sans JP** (auto-hospedada via
    `@fontsource-variable/noto-sans-jp`).
- **Nomes de páginas de impressão localizados** em novos desenhos, em vez dos nomes em chinês
  do modelo.
- **Termos simples para quem não usa CAD** — a interface usa palavras do dia a dia: bloco → símbolo,
  atributo de bloco → propriedade do símbolo, espaço do modelo → tela, layout → página de impressão,
  hachura → preenchimento com padrão, referência externa → desenho vinculado, seleção rápida → selecionar por critérios etc.
  As dicas de ferramenta mantêm o termo CAD entre parênteses (todos os idiomas).
- **Barra de ferramentas móvel** — arraste a alça (⠿) para movê-la para qualquer lugar; o menu ⋯ ao lado
  alterna entre vertical e horizontal ou a devolve à posição inicial: a borda esquerda da área de desenho, ou a
  direita quando o painel flutuante (camadas etc.) cobre a esquerda. Se o painel a cobrir, ela volta para lá sozinha. Os submenus
  abrem em direção ao centro da tela e a posição é lembrada.
- **Troca do modo de seleção** — um botão da barra de status alterna entre o estilo CAD
  (cada clique adiciona) e substituir ao clicar (Shift + clique adiciona ou remove, clicar no vazio
  limpa a seleção). Por enquanto o estilo CAD continua sendo o padrão.
- **Importação de JWW / JWC (Jw_cad)** — o app de exemplo abre arquivos `.jww` e `.jwc` (formato antigo) com
  `@mlightcad/cad-jww-converter` (MIT; analisador [ezjww](https://github.com/monozukuri-ai/ezjww),
  Rust → WebAssembly, em um Web Worker). As coordenadas passam de milímetros de papel para
  milímetros reais com a escala do grupo de camadas, e a folha vira os limites do desenho.
- **Importação de SXF** (padrão japonês de intercâmbio CAD para obras públicas) — o app de exemplo abre
  `.sfc`, `.p21` e as versões ZIP `.sfz` / `.p2z` com `@mlightcad/cad-sxf-converter` (MIT, TypeScript,
  portado do [ezsxf](https://github.com/monozukuri-ai/ezsxf)). Desenhos parciais aparecem no tamanho real
  da vista principal, e a folha vira os limites do desenho.

## Demonstração

- Online: <https://cool0707.github.io/cad-viewer-plus/>
- Local:

  ```bash
  pnpm install
  pnpm demo:build   # compila todos os pacotes e gera demo-dist/
  pnpm demo         # http://localhost:4300/
  ```

## Primeiros passos

Requer [Node.js](https://nodejs.org/) >= 24 e [pnpm](https://pnpm.io/) >= 10.

```bash
git clone https://github.com/cool0707/cad-viewer-plus.git
cd cad-viewer-plus
pnpm install
pnpm dev          # visualizador completo
pnpm dev:simple   # visualizador simples
pnpm build
pnpm test
```

## Fontes e recursos

Tudo o que o visualizador baixa em tempo de execução fica em `resources/cad-data/`
(veja o [README](./resources/cad-data/README.md)). Ao incorporar os pacotes,
passe `baseUrl` para `AcApDocManager` e ajuste as fontes de reserva com as opções
`defaultFonts` / `symbolFonts`. Fontes SHX não são incluídas; textos que as usam
são exibidos com BIZ UD Gothic.

## Suporte a DWG

DXF é lido pelo analisador MIT embutido. DWG é opcional por meio do
`@mlightcad/libredwg-converter`, baseado no
[LibreDWG](https://github.com/LibreDWG/libredwg) e licenciado sob **GPL-3.0**;
verifique as implicações da GPL antes de distribuí-lo.

## Suporte a JWW / JWC

`@mlightcad/cad-jww-converter` lê desenhos do Jw_cad (`.jww` / `.jwc`): analisa o arquivo com ezjww (MIT)
em um Web Worker, converte para DXF e carrega com o leitor DXF embutido. Registre-o e publique
`jww-parser-worker.js` e `jww-parser.wasm` (em `dist/` do pacote) na mesma pasta:

```ts
import { registerJwwConverter } from '@mlightcad/cad-jww-converter'

registerJwwConverter('./assets/jww-parser-worker.js')
```

O JWW guarda as coordenadas em milímetros de papel. Por padrão tudo é escalado pela escala do
grupo de camadas principal (o que tem mais entidades), então o desenho fica igual ao Jw_cad e o
desenho principal é medido em milímetros reais. `scaleMode: 'layer-group'` usa a escala de cada
grupo e `scaleMode: 'paper'` mantém milímetros de papel. O formato antigo JWC é convertido da mesma forma (não guarda fontes, então o texto usa ＭＳ ゴシック).

## Suporte a SXF

`@mlightcad/cad-sxf-converter` lê desenhos SXF Ver.3.1: SFC (`.sfc`), P21 (`.p21`, AP202) e as versões ZIP
(`.sfz`, `.p2z`). O analisador é escrito em TypeScript (sem WebAssembly) e o tratamento das entidades foi
portado do ezsxf (MIT). O desenho é convertido em linhas, curvas, textos, preenchimentos e hachuras e
carregado pelo leitor DXF embutido.

```ts
import { registerSxfConverter } from '@mlightcad/cad-sxf-converter'

registerSxfConverter()
```

As coordenadas SXF estão em milímetros de papel e os desenhos parciais são posicionados com uma escala. Por
padrão tudo é escalado pela escala do desenho parcial principal: a folha fica como impressa e a vista
principal é medida em milímetros reais; `scaleMode: 'paper'` mantém milímetros de papel. Círculos, arcos e
elipses continuam curvas e o texto segue a caixa SXF. Atributos (SAF) e imagens raster não são carregados.

## Licença

[MIT](./LICENSE). O aviso de copyright original da mlightcad é mantido, conforme
exigido pela licença. As fontes incluídas BIZ UD (© Morisawa Inc.) e
Noto Sans JP usam a SIL Open Font License 1.1.
