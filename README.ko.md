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
- **이동 가능한 도구 모음** — 손잡이(⠿)를 드래그해 원하는 위치로 옮기고 세로/가로를 전환할 수 있습니다.
  하위 메뉴는 화면 중앙 쪽으로 열립니다. 위치는 기억되며, 손잡이를 더블클릭하면 오른쪽으로 돌아갑니다.
- **JWW(Jw_cad) 가져오기** — 예제 앱에서 `.jww` 파일을 열 수 있습니다
  (`@mlightcad/cad-jww-converter`, MIT. 파서는 [ezjww](https://github.com/monozukuri-ai/ezjww),
  Rust → WebAssembly, Web Worker에서 실행). 좌표는 레이어 그룹 축척으로 용지 mm에서
  실제 mm로 변환하고, 용지를 도면 한계로 설정합니다.
- 예정: **SXF**(P21 / SFC) 가져오기.

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

## JWW 지원

`@mlightcad/cad-jww-converter`는 Jw_cad 도면(`.jww`)을 읽습니다. Web Worker에서 ezjww(MIT)로
파싱하고 DXF로 변환한 뒤 내장 DXF 리더로 불러옵니다. 등록한 다음 패키지 `dist/`의
`jww-parser-worker.js`와 `jww-parser.wasm`을 같은 위치에 배포하세요.

```ts
import { registerJwwConverter } from '@mlightcad/cad-jww-converter'

registerJwwConverter('./assets/jww-parser-worker.js')
```

JWW는 좌표를 용지 mm로 저장합니다. 기본적으로 주 레이어 그룹(엔티티가 가장 많은 그룹)의
축척으로 전체를 확대하므로 Jw_cad와 같은 모양으로 보이고 주 도면은 실제 mm로 측정됩니다.
`scaleMode: 'layer-group'`은 그룹별 축척을, `scaleMode: 'paper'`는 용지 mm를 그대로 사용합니다.
구 형식 JWC는 아직 지원하지 않습니다.

## 라이선스

[MIT](./LICENSE). 라이선스 조건에 따라 mlightcad의 원 저작권 표시를 유지합니다.
포함된 BIZ UD 글꼴(© Morisawa Inc.)과 Noto Sans JP는 SIL Open Font License 1.1을 따릅니다.
