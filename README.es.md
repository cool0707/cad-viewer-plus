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
- **Nombres de presentaciones localizados** en los planos nuevos, en lugar de
  los nombres en chino de la plantilla.
- Previsto: importación de **JWW** (Jw_cad) y **SXF** (P21 / SFC).

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

## Licencia

[MIT](./LICENSE). Se conserva el aviso de copyright original de mlightcad, tal
como exige la licencia. Las fuentes incluidas BIZ UD (© Morisawa Inc.) y
Noto Sans JP usan la SIL Open Font License 1.1.
