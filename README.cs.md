# CAD-Viewer Plus

[English](./README.md) | [日本語](./README.ja.md) | [简体中文](./README.zh-CN.md) | [한국어](./README.ko.md) | [Español](./README.es.md) | [Português](./README.pt.md) | [Русский](./README.ru.md) | [Čeština](./README.cs.md)

> **Toto je fork.** CAD-Viewer Plus je fork projektu
> [mlightcad/cad-viewer](https://github.com/mlightcad/cad-viewer) (licence MIT).
> Je udržován nezávisle a **není spojen s autorem původního projektu ani jím
> podporován**. Problémy tohoto forku hlaste v
> [issues tohoto repozitáře](https://github.com/cool0707/cad-viewer-plus/issues),
> nikoli u původního projektu.

Prohlížeč a editor DXF/DWG, který běží celý v prohlížeči: načítání výkresů,
zpracování geometrie i vykreslování (Three.js / WebGL) probíhá na klientovi,
takže výkresy nikdy neopustí zařízení uživatele.

## Co tento fork přidává

- **Japonské rozhraní**: úplné národní prostředí `ja` pro všechny balíčky
  (prohlížeč, pás karet, příkazový řádek, dialogy, pluginy, porovnání výkresů,
  offline export do HTML). Jazyk se zjišťuje z prohlížeče.
- **Vlastní hostování písem bez CAD CDN**: písma a šablony výkresů poskytuje
  samotná aplikace (`resources/cad-data` → `./cad-data/`).
  - Text výkresů: přiložena písma **BIZ UD Gothic / Mincho**, která nahrazují
    MS Gothic / MS Mincho a slouží jako výchozí záložní písmo.
  - Ostatní písma se podle potřeby načítají z **Google Fonts**
    (Arial → Arimo, SimSun → Noto Serif SC, Malgun Gothic → Noto Sans KR, …).
  - Text rozhraní: **Noto Sans JP** (hostováno pomocí
    `@fontsource-variable/noto-sans-jp`).
- **Lokalizované názvy rozvržení** v nových výkresech místo čínských názvů ze šablony.
- **Import JWW / JWC (Jw_cad)** — ukázková aplikace otevírá soubory `.jww` a `.jwc` (starý formát) pomocí
  `@mlightcad/cad-jww-converter` (MIT; parser [ezjww](https://github.com/monozukuri-ai/ezjww),
  Rust → WebAssembly, ve Web Workeru). Souřadnice se převádějí z milimetrů na papíře na skutečné
  milimetry podle měřítka skupiny hladin a list se použije jako meze výkresu.
- Plánováno: import **SXF** (P21 / SFC).

## Ukázka

- Online: <https://cool0707.github.io/cad-viewer-plus/>
- Lokálně:

  ```bash
  pnpm install
  pnpm demo:build   # sestaví všechny balíčky a vytvoří demo-dist/
  pnpm demo         # http://localhost:4300/
  ```

## Začínáme

Vyžaduje [Node.js](https://nodejs.org/) >= 24 a [pnpm](https://pnpm.io/) >= 10.

```bash
git clone https://github.com/cool0707/cad-viewer-plus.git
cd cad-viewer-plus
pnpm install
pnpm dev          # plnohodnotný prohlížeč
pnpm dev:simple   # jednoduchý prohlížeč
pnpm build
pnpm test
```

## Písma a zdroje

Vše, co prohlížeč za běhu stahuje, je v `resources/cad-data/` (viz
[README](./resources/cad-data/README.md)). Při vkládání balíčků předejte `baseUrl`
do `AcApDocManager` a záložní písma upravte volbami `defaultFonts` / `symbolFonts`.
Písma SHX nejsou přiložena; text, který je používá, se zobrazí písmem BIZ UD Gothic.

## Podpora DWG

DXF se načítá vestavěným parserem s licencí MIT. DWG je volitelně podporováno
přes `@mlightcad/libredwg-converter` založený na
[LibreDWG](https://github.com/LibreDWG/libredwg) s licencí **GPL-3.0**; před
distribucí zvažte důsledky GPL.

## Podpora JWW / JWC

`@mlightcad/cad-jww-converter` čte výkresy Jw_cad (`.jww` / `.jwc`): soubor zpracuje pomocí ezjww (MIT)
ve Web Workeru, převede jej na DXF a načte vestavěnou čtečkou DXF. Zaregistrujte jej a umístěte
`jww-parser-worker.js` a `jww-parser.wasm` (z `dist/` balíčku) do stejné složky:

```ts
import { registerJwwConverter } from '@mlightcad/cad-jww-converter'

registerJwwConverter('./assets/jww-parser-worker.js')
```

JWW ukládá souřadnice v milimetrech na papíře. Ve výchozím stavu se vše zvětší měřítkem hlavní
skupiny hladin (s nejvíce objekty), takže výkres vypadá jako v Jw_cad a hlavní výkres se měří ve
skutečných milimetrech. `scaleMode: 'layer-group'` použije měřítko každé skupiny a
`scaleMode: 'paper'` ponechá milimetry na papíře. Starý formát JWC se převádí stejně (neobsahuje písma, text se zobrazí jako ＭＳ ゴシック).

## Licence

[MIT](./LICENSE). Původní upozornění na autorská práva mlightcad je zachováno,
jak licence vyžaduje. Přiložená písma BIZ UD (© Morisawa Inc.) a Noto Sans JP
jsou licencována pod SIL Open Font License 1.1.
