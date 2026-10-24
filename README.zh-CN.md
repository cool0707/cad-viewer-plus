# CAD-Viewer Plus

[English](./README.md) | [日本語](./README.ja.md) | [简体中文](./README.zh-CN.md) | [한국어](./README.ko.md) | [Español](./README.es.md) | [Português](./README.pt.md) | [Русский](./README.ru.md) | [Čeština](./README.cs.md)

> **这是一个分支（fork）。** CAD-Viewer Plus 分支自
> [mlightcad/cad-viewer](https://github.com/mlightcad/cad-viewer)（MIT 许可证），
> 由本仓库独立维护，**与上游作者无关，也不在上游的支持范围内**。
> 如有问题，请在[本仓库的 Issues](https://github.com/cool0707/cad-viewer-plus/issues)
> 中反馈，不要提交到上游。

一个完全在浏览器中运行的 DXF/DWG 查看器和编辑器。图纸解析、几何处理和渲染
（Three.js / WebGL）都在客户端完成，图纸不会离开用户的设备。

## 本分支的改动

- **日文界面**：为所有包（查看器、功能区、命令行、对话框、插件、对比查看器、离线 HTML 导出）
  添加了完整的 `ja` 语言包，并根据浏览器语言自动选择。
- **字体自托管，不依赖 CAD CDN**：字体和图纸模板由应用自身提供
  （`resources/cad-data` → `./cad-data/`）。
  - 图纸文字：内置 **BIZ UD Gothic / Mincho**，用于替代 MS Gothic / MS Mincho，并作为默认回退字体。
  - 其他文字按需从 **Google Fonts** 加载（Arial → Arimo，SimSun → Noto Serif SC，
    Malgun Gothic → Noto Sans KR 等）。
  - 界面文字：**Noto Sans JP**（通过 `@fontsource-variable/noto-sans-jp` 自托管）。
- **新建图纸的打印页名称本地化**：显示为当前界面语言的名称，而不是模板中固定的中文名称。
- **面向非 CAD 用户的通俗术语**：界面使用日常用语，例如 块 → 符号、块属性 → 符号属性、模型空间 → 画布、
  布局 → 打印页、外部参照 → 链接图纸、快速选择 → 按条件选择 等。工具提示会在括号中保留 CAD 术语（所有语言）。
- **可移动的工具栏** — 拖动手柄（⠿）即可移动工具栏；旁边的「⋯」可切换竖排／横排或恢复到左侧。
  子菜单向屏幕中心方向展开，位置会被记住。
- **切换选择方式** — 状态栏按钮可在 CAD 方式（每次单击都添加）与单击替换
  （Shift + 单击添加或取消，单击空白处取消选择）之间切换。目前默认仍为 CAD 方式。
- **导入 JWW（Jw_cad）** — 示例应用可打开 `.jww` 文件（`@mlightcad/cad-jww-converter`，MIT；
  解析器为 [ezjww](https://github.com/monozukuri-ai/ezjww)，Rust → WebAssembly，在 Web Worker 中运行）。
  坐标按图层组比例从图纸毫米换算为实际毫米，图纸幅面作为图形界限。
- 计划中：导入 **SXF**（P21 / SFC）。

## 演示

- 在线：<https://cool0707.github.io/cad-viewer-plus/>
- 本地：

  ```bash
  pnpm install
  pnpm demo:build   # 构建所有包并生成 demo-dist/
  pnpm demo         # http://localhost:4300/
  ```

## 快速开始

需要 [Node.js](https://nodejs.org/) >= 24 和 [pnpm](https://pnpm.io/) >= 10。

```bash
git clone https://github.com/cool0707/cad-viewer-plus.git
cd cad-viewer-plus
pnpm install
pnpm dev          # 完整查看器
pnpm dev:simple   # 简易查看器
pnpm build
pnpm test
```

## 字体与资源

运行时加载的所有资源都位于 `resources/cad-data/`（详见其
[README](./resources/cad-data/README.md)）。嵌入这些包时，可以向 `AcApDocManager`
传入 `baseUrl`，并通过 `defaultFonts` / `symbolFonts` 选项修改回退字体。
未内置 SHX 字体，使用 SHX 的文字将以 BIZ UD Gothic 显示。

## DWG 支持

DXF 由内置的 MIT 解析器读取。DWG 可选使用基于
[LibreDWG](https://github.com/LibreDWG/libredwg) 的 `@mlightcad/libredwg-converter`，
其许可证为 **GPL-3.0**，分发前请确认 GPL 的影响。

## JWW 支持

`@mlightcad/cad-jww-converter` 用于读取 Jw_cad 图纸（`.jww`）：在 Web Worker 中用 ezjww（MIT）
解析，转换为 DXF 后由内置 DXF 读取器加载。注册后，请将包 `dist/` 中的
`jww-parser-worker.js` 与 `jww-parser.wasm` 部署在同一目录：

```ts
import { registerJwwConverter } from '@mlightcad/cad-jww-converter'

registerJwwConverter('./assets/jww-parser-worker.js')
```

JWW 以图纸毫米保存坐标。默认按主图层组（实体最多的组）的比例整体放大，因此外观与 Jw_cad
一致，主图可按实际毫米测量。`scaleMode: 'layer-group'` 按各组自身比例放大，
`scaleMode: 'paper'` 保持图纸毫米。暂不支持旧格式 JWC。

## 许可证

[MIT](./LICENSE)。按照许可证要求保留了 mlightcad 的原始版权声明。内置的
BIZ UD 字体（© Morisawa Inc.）和 Noto Sans JP 采用 SIL Open Font License 1.1。
