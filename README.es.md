# CAD-Viewer Plus

[English](./README.md) | [日本語](./README.ja.md) | [简体中文](./README.zh-CN.md) | [한국어](./README.ko.md) | [Español](./README.es.md) | [Português](./README.pt.md) | [Русский](./README.ru.md) | [Čeština](./README.cs.md)

> **Esto es un fork.** CAD-Viewer Plus es un fork de
> [mlightcad/cad-viewer](https://github.com/mlightcad/cad-viewer) (licencia MIT).
> Se mantiene de forma independiente y **no está afiliado ni soportado por el
> autor original**. Informe de los problemas de este fork en
> [los issues de este repositorio](https://github.com/cool0707/cad-viewer-plus/issues),
> no en el proyecto original.

Visor y editor de DXF/DWG que funciona completamente en el navegador: el
análisis de los planos, el procesamiento geométrico y el renderizado
(Three.js / WebGL) se realizan en el cliente, por lo que los planos nunca salen
del dispositivo del usuario.

## Cambios de este fork

- **Interfaz en japonés**: locale `ja` completo para todos los paquetes (visor,
  cinta de opciones, línea de comandos, diálogos, plugins, visor de diferencias,
  exportación a HTML sin conexión). El idioma se detecta desde el navegador.
- **Fuentes autoalojadas, sin CDN de CAD**: las fuentes y plantillas se sirven
  desde la propia aplicación (`resources/cad-data` → `./cad-data/`).
  - Texto de los planos: se incluyen **BIZ UD Gothic / Mincho**, usadas para
    MS Gothic / MS Mincho y como fuente de respaldo predeterminada.
  - Otros sistemas de escritura se cargan bajo demanda desde **Google Fonts**
    (Arial → Arimo, SimSun → Noto Serif SC, Malgun Gothic → Noto Sans KR, …).
  - Texto de la interfaz: **Noto Sans JP** (autoalojada con
    `@fontsource-variable/noto-sans-jp`).
- **Nombres de páginas de impresión localizados** en los planos nuevos, en lugar de
  los nombres en chino de la plantilla.
- **Términos sencillos para quien no usa CAD** — la interfaz usa palabras cotidianas: bloque → símbolo,
  atributo de bloque → propiedad del símbolo, espacio modelo → lienzo, presentación → página de impresión,
  sombreado → relleno de patrón, referencia externa → plano vinculado, selección rápida → seleccionar por criterios, etc.
  Las descripciones emergentes mantienen el término CAD entre paréntesis (todos los idiomas).
- **Barra de herramientas movible** — arrastra el asa (⠿) para moverla a cualquier lugar y cambiarla entre
  vertical y horizontal. Los submenús se abren hacia el centro de la pantalla; la posición se recuerda
  y un doble clic en el asa la devuelve al borde izquierdo.
- **Importación de JWW (Jw_cad)** — la app de ejemplo abre archivos `.jww` con
  `@mlightcad/cad-jww-converter` (MIT; analizador [ezjww](https://github.com/monozukuri-ai/ezjww),
  Rust → WebAssembly, en un Web Worker). Las coordenadas pasan de milímetros de papel a
  milímetros reales con la escala del grupo de capas y la hoja se usa como límites del dibujo.
- Previsto: importación de **SXF** (P21 / SFC).

## Demo

- En línea: <https://cool0707.github.io/cad-viewer-plus/>
- Local:

  ```bash
  pnpm install
  pnpm demo:build   # compila todos los paquetes y genera demo-dist/
  pnpm demo         # http://localhost:4300/
  ```

## Primeros pasos

Requiere [Node.js](https://nodejs.org/) >= 24 y [pnpm](https://pnpm.io/) >= 10.

```bash
git clone https://github.com/cool0707/cad-viewer-plus.git
cd cad-viewer-plus
pnpm install
pnpm dev          # visor completo
pnpm dev:simple   # visor simple
pnpm build
pnpm test
```

## Fuentes y recursos

Todo lo que el visor descarga en tiempo de ejecución está en `resources/cad-data/`
(consulte su [README](./resources/cad-data/README.md)). Al integrar los paquetes,
pase `baseUrl` a `AcApDocManager` y ajuste las fuentes de respaldo con las
opciones `defaultFonts` / `symbolFonts`. Las fuentes SHX no se incluyen; el texto
que las usa se muestra con BIZ UD Gothic.

## Soporte DWG

DXF se lee con el analizador MIT integrado. DWG es opcional mediante
`@mlightcad/libredwg-converter`, basado en
[LibreDWG](https://github.com/LibreDWG/libredwg) y con licencia **GPL-3.0**;
revise las implicaciones de la GPL antes de distribuirlo.

## Soporte JWW

`@mlightcad/cad-jww-converter` lee dibujos de Jw_cad (`.jww`): los analiza con ezjww (MIT) en un
Web Worker, los convierte a DXF y los carga con el lector DXF integrado. Regístrelo y publique
`jww-parser-worker.js` y `jww-parser.wasm` (en `dist/` del paquete) en la misma carpeta:

```ts
import { registerJwwConverter } from '@mlightcad/cad-jww-converter'

registerJwwConverter('./assets/jww-parser-worker.js')
```

JWW guarda las coordenadas en milímetros de papel. Por defecto todo se escala con la escala del
grupo de capas principal (el que tiene más entidades), de modo que el dibujo se ve como en
Jw_cad y el dibujo principal se mide en milímetros reales. `scaleMode: 'layer-group'` usa la
escala de cada grupo y `scaleMode: 'paper'` conserva los milímetros de papel. El formato antiguo
JWC aún no es compatible.

## Licencia

[MIT](./LICENSE). Se conserva el aviso de copyright original de mlightcad, tal
como exige la licencia. Las fuentes incluidas BIZ UD (© Morisawa Inc.) y
Noto Sans JP usan la SIL Open Font License 1.1.
