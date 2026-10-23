# CLAUDE.md — cad-viewer-plus

mlightcad/cad-viewer (MIT) を日本向けにフォークしたブラウザ CAD ビューア。
JWW / JWC 読み込みは実装済み (`packages/cad-jww-converter`)。次の大きな作業は
**SXF (P21・SFC) 読み込み** — 詳細と経緯は [`HANDOFF.md`](./HANDOFF.md) を最初に読むこと。

## コマンド

```bash
pnpm install
pnpm build                 # nx run-many -t build (数分)。vue-tsc の既存エラーが出るが EXIT 0 なら問題なし
npx jest                   # ルートから実行 (パッケージ内で実行すると transform が失敗する)
npx jest packages/cad-simple-viewer/__tests__/AcApLayoutViewFraming.spec.ts   # 単体
pnpm dev                   # フル機能ビューア (cad-viewer-example)
pnpm demo:build && pnpm demo   # demo-dist/ を作って http://localhost:4300/
pnpm --filter @mlightcad/cad-viewer-example test:e2e   # Playwright e2e (fixtures: packages/cad-viewer-example/e2e/fixtures)
```

- Node 22 / pnpm 10 で動作確認済み (README は Node >= 24 と書いてあるが 22 でもビルド・テスト可)。
- `pnpm lint` には examples の vite.config.ts と `tools/*.mjs` に既存エラーがある。自分の変更分だけ見る。

## リポジトリ構成 (要点だけ)

- `packages/cad-simple-viewer` — フレームワーク非依存のコア (AcApDocManager, AcTrView2d, コマンド, i18n)。
- `packages/cad-viewer` — Vue3 + Element Plus の UI。`packages/cad-viewer-example` がデモ本体。
- `packages/cad-jww-converter` — JWW / JWC (Jw_cad) 読み込み。ezjww (MIT, wasm) を Worker で実行し DXF 経由で読む。example で opt-in 登録。
- `@mlightcad/data-model` / `libredwg-converter` / `geometry-engine` / `mtext-renderer` は **npm 依存** (このリポジトリにソースは無い)。直すときは pnpm patch (下記)。
- `resources/cad-data/` — フォント (BIZ UD woff + fonts.json)・テンプレート・サンプル図面。ビルド時に各 example の `cad-data/` へコピーされる。
- `demo/index.html` + `tools/build-demo.mjs` → `demo-dist/` → GitHub Pages (`.github/workflows/demo.yml`, gh-pages ブランチ)。

## 依存パッケージの修正 = pnpm patch

`patches/` と `pnpm-workspace.yaml` の `patchedDependencies` で管理している。

```bash
pnpm patch @mlightcad/data-model@1.15.14 --edit-dir /tmp/dm-edit   # 既存パッチ適用済みの状態で展開される
# /tmp/dm-edit/lib/... を編集 (配布物の ES5 JS と .d.ts を直接直す)
pnpm patch-commit /tmp/dm-edit
```

現在のパッチと理由は HANDOFF.md の「既存パッチ」を参照。上流バージョンを上げるとパッチが当たらなくなるので注意。

## 守ること

- UI 文字列は必ず i18n に入れ、**en / ja / zh / tr / cs / ar 全ロケール**に追加する
  (cad-simple-viewer `src/i18n/*`, cad-viewer `src/locale/*`, cad-viewer-example `src/locale/*`)。日本語を最優先で自然に。
- 図面フォントは CDN を使わない。BIZ UD を同梱、他言語は Google Fonts (`fonts.json` の絶対 URL)。UI フォントは Noto Sans JP。
- LibreDWG (GPL) を本体パッケージに取り込まない。DWG は example 側で opt-in 登録している。JWW / SXF も同じく **MIT 互換のライブラリか自前実装** にする。
- `main` と `ja-localization` は現在同一。今後は `main` から作業ブランチを切ればよい。
- README は 8 言語 (`README*.md`) あるので、機能追加を書くときは全部更新する。
