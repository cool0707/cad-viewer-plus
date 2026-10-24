# CAD-Viewer Plus

[English](./README.md) | [日本語](./README.ja.md) | [简体中文](./README.zh-CN.md) | [한국어](./README.ko.md) | [Español](./README.es.md) | [Português](./README.pt.md) | [Русский](./README.ru.md) | [Čeština](./README.cs.md)

> **이 저장소는 포크입니다.** CAD-Viewer Plus는
> [mlightcad/cad-viewer](https://github.com/mlightcad/cad-viewer)(MIT 라이선스)의
> 포크로, 독립적으로 유지 관리됩니다. **원 저작자와는 관계가 없으며 원 프로젝트의
> 지원 대상도 아닙니다.** 문제는 원 프로젝트가 아니라
> [이 저장소의 Issues](https://github.com/cool0707/cad-viewer-plus/issues)에 보고해 주세요.

브라우저에서만 동작하는 DXF/DWG 뷰어 겸 편집기입니다. 도면 해석, 형상 처리, 렌더링
(Three.js / WebGL)은 모두 클라이언트에서 수행되므로 도면이 사용자 기기를 벗어나지 않습니다.

## 이 포크의 변경 사항

- **일본어 UI**: 모든 패키지(뷰어, 리본, 명령줄, 대화상자, 플러그인, 비교 뷰어,
  오프라인 HTML 내보내기)에 `ja` 로캘을 추가했으며 브라우저 언어에 따라 자동으로 선택됩니다.
- **글꼴 자체 호스팅(CAD CDN 불필요)**: 글꼴과 도면 템플릿은 앱에서 직접 제공합니다
  (`resources/cad-data` → `./cad-data/`).
  - 도면 문자: **BIZ UD Gothic / Mincho**를 포함하여 MS Gothic / MS Mincho 대체 및 기본
    대체 글꼴로 사용합니다.
  - 그 밖의 문자는 필요할 때 **Google Fonts**에서 불러옵니다(Arial → Arimo,
    SimSun → Noto Serif SC, 맑은 고딕 → Noto Sans KR 등).
  - UI 문자: **Noto Sans JP**(`@fontsource-variable/noto-sans-jp`로 자체 호스팅).
- **새 도면의 인쇄 페이지 이름 현지화**: 템플릿의 중국어 이름 대신 현재 UI 언어의 이름을 표시합니다.
- **CAD 비경험자를 위한 쉬운 용어**: UI에서 일상적인 단어를 사용합니다. 블록 → 심볼, 블록 속성 → 심볼 속성,
  모형 공간 → 캔버스, 배치 → 인쇄 페이지, 해치 → 패턴 채우기, 외부 참조 → 연결된 도면,
  빠른 선택 → 조건으로 선택 등. 도구 설명에는 CAD 용어를 괄호로 함께 표시합니다(모든 로캘).
- **이동 가능한 도구 모음** — 손잡이(⠿)를 드래그해 원하는 위치로 옮길 수 있고, 옆의 ⋯ 메뉴에서 세로/가로 전환과
  원래 위치로 되돌리기를 할 수 있습니다. 원래 위치는 도면 영역의 왼쪽이며, 떠 있는 패널(레이어 등)이 왼쪽을 가리면 오른쪽입니다.
  패널에 가려지면 자동으로 원래 위치로 돌아갑니다. 하위 메뉴는 화면 중앙 쪽으로 열리며 위치는 기억됩니다.
- **선택 방식 전환** — 상태 표시줄 버튼으로 클릭할 때마다 추가하는 CAD 방식과
  클릭하면 바꾸는 방식(Shift + 클릭으로 추가·해제, 빈 곳 클릭으로 선택 해제)을 전환합니다.
  현재 기본값은 CAD 방식입니다.
- **JWW / JWC(Jw_cad) 가져오기** — 예제 앱에서 `.jww` 및 구 형식 `.jwc` 파일을 열 수 있습니다
  (`@mlightcad/cad-jww-converter`, MIT. 파서는 [ezjww](https://github.com/monozukuri-ai/ezjww),
  Rust → WebAssembly, Web Worker에서 실행). 좌표는 레이어 그룹 축척으로 용지 mm에서
  실제 mm로 변환하고, 용지를 도면 한계로 설정합니다.
- **SXF 가져오기**(일본 공공 공사 CAD 데이터 교환 표준) — 예제 앱에서 `.sfc`, `.p21` 및 ZIP 형식
  `.sfz` / `.p2z`를 열 수 있습니다(`@mlightcad/cad-sxf-converter`, MIT, TypeScript,
  [ezsxf](https://github.com/monozukuri-ai/ezsxf)에서 이식). 부분도는 주 뷰의 축척으로 실제 크기로
  표시하고, 용지를 도면 한계로 설정합니다.
- **세로쓰기(縦書き)** — Windows 세로쓰기 글꼴(`@ＭＳ ゴシック` 등, Jw_cad 縦字 포함)의 문자와
  문자 스타일에 AutoCAD "세로" 플래그가 있는 TEXT를 화면과 SVG / PDF 내보내기에서 위에서 아래로
  씁니다. 번들된 BIZ UD 글꼴을 그대로 사용합니다(`@mlightcad/cad-vertical-text`).

## 데모

- 온라인: <https://cool0707.github.io/cad-viewer-plus/>
- 로컬:

  ```bash
  pnpm install
  pnpm demo:build   # 모든 패키지를 빌드하고 demo-dist/ 생성
  pnpm demo         # http://localhost:4300/
  ```

## 시작하기

[Node.js](https://nodejs.org/) 24 이상과 [pnpm](https://pnpm.io/) 10 이상이 필요합니다.

```bash
git clone https://github.com/cool0707/cad-viewer-plus.git
cd cad-viewer-plus
pnpm install
pnpm dev          # 전체 기능 뷰어
pnpm dev:simple   # 간단한 뷰어
pnpm build
pnpm test
```

## 글꼴과 리소스

실행 중에 불러오는 리소스는 모두 `resources/cad-data/`에 있습니다(자세한 내용은
[README](./resources/cad-data/README.md)). 패키지를 직접 포함할 때는 `AcApDocManager`에
`baseUrl`을 전달하고 `defaultFonts` / `symbolFonts` 옵션으로 대체 글꼴을 바꿀 수 있습니다.
SHX 글꼴은 포함하지 않으며, SHX를 사용하는 문자는 BIZ UD Gothic으로 표시됩니다.

## DWG 지원

DXF는 내장된 MIT 파서로 읽습니다. DWG는 선택적으로
[LibreDWG](https://github.com/LibreDWG/libredwg) 기반의 `@mlightcad/libredwg-converter`를
사용할 수 있으며, 라이선스는 **GPL-3.0**입니다. 배포 전에 GPL 영향을 확인하세요.

## JWW / JWC 지원

`@mlightcad/cad-jww-converter`는 Jw_cad 도면(`.jww` / `.jwc`)을 읽습니다. Web Worker에서 ezjww(MIT)로
파싱하고 DXF로 변환한 뒤 내장 DXF 리더로 불러옵니다. 등록한 다음 패키지 `dist/`의
`jww-parser-worker.js`와 `jww-parser.wasm`을 같은 위치에 배포하세요.

```ts
import { registerJwwConverter } from '@mlightcad/cad-jww-converter'

registerJwwConverter('./assets/jww-parser-worker.js')
```

JWW는 좌표를 용지 mm로 저장합니다. 기본적으로 주 레이어 그룹(엔티티가 가장 많은 그룹)의
축척으로 전체를 확대하므로 Jw_cad와 같은 모양으로 보이고 주 도면은 실제 mm로 측정됩니다.
`scaleMode: 'layer-group'`은 그룹별 축척을, `scaleMode: 'paper'`는 용지 mm를 그대로 사용합니다.
구 형식 JWC도 같은 방식으로 변환합니다(JWC에는 글꼴 정보가 없으므로 문자는 ＭＳ ゴシック으로 표시).
`^@BM`으로 배치된 이미지는 래스터 이미지로 표시합니다. JWW에 포함된 이미지는 그대로 표시하고,
외부 파일을 참조하는 이미지는 누락된 이미지로 표시되며 뷰어에서 파일을 지정할 수 있습니다.
이미지 자르기는 아직 반영하지 않습니다.

## SXF 지원

`@mlightcad/cad-sxf-converter`는 SXF Ver.3.1 도면을 읽습니다: SFC(`.sfc`), P21(`.p21`, AP202) 및 ZIP
형식(`.sfz`, `.p2z`). 파서는 TypeScript로 작성되었고(WebAssembly 불필요) 피처 처리는 ezsxf(MIT)에서
이식했습니다. 도면을 선, 곡선, 문자, 채우기, 해치로 펼친 뒤 내장 DXF 리더로 불러옵니다.

```ts
import { registerSxfConverter } from '@mlightcad/cad-sxf-converter'

registerSxfConverter()
```

SXF 좌표는 용지 mm이며 부분도는 축척 비율로 배치됩니다. 기본적으로 주 부분도의 축척으로 전체를 확대하므로
인쇄와 같은 모양으로 보이고 주 뷰는 실제 mm로 측정됩니다. `scaleMode: 'paper'`는 용지 mm를 유지합니다.
원, 원호, 타원은 곡선 그대로이며 문자는 SXF 문자 상자 크기에 맞춥니다. 래스터 이미지(SXF 3.1 이미지 속성)는
이미지 파일이 `.sfz` / `.p2z`에 포함되어 있으면 표시합니다(흑백 TIFF(G4)는 브라우저용으로 변환하고
JPEG는 그대로 사용). `.sfc` / `.p21` 단독으로는 이미지 테두리를 누락된 이미지로 표시합니다.
속성 파일(SAF)은 읽지 않습니다.

## 라이선스

[MIT](./LICENSE). 라이선스 조건에 따라 mlightcad의 원 저작권 표시를 유지합니다.
포함된 BIZ UD 글꼴(© Morisawa Inc.)과 Noto Sans JP는 SIL Open Font License 1.1을 따릅니다.
