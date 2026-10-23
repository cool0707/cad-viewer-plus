# 引き継ぎ資料 — JWW / SXF 読み込み対応

作成: 2026-10-23 (それまでの作業はクラウド上の Claude セッションで実施)。
リポジトリの基本ルール・コマンドは [`CLAUDE.md`](./CLAUDE.md)。

---

## 1. ここまでに終わっていること

`main` (= `ja-localization`) の上流 `mlightcad/cad-viewer` 1.7.7-preview.1 からの差分コミット:

| コミット | 内容 |
| --- | --- |
| `27f8e77` | 全パッケージの日本語ロケール (`ja`) 追加、フォント同梱 (BIZ UD)、mlight CDN 廃止、新規図面のレイアウト名ローカライズ |
| `457ebf5` | UI フォントを Noto Sans JP に |
| `292a44d` | README 8 言語をフォークとして書き直し、デモページ (`demo/`, GitHub Pages) |
| `f384068` | NURBS 評価の高速化 (canteen.dwg 5.4s → 3.1s) |
| `0564556` | DXF の Shift_JIS 等の自動判定 (コードページ宣言が ANSI_1252 でも化けない) |
| `641b60b` | 初期表示「図面範囲」(モデル = LIMITS、レイアウト = 用紙枠)、TABLES の無い DXF で画層を自動作成 |

デモ: <https://cool0707.github.io/cad-viewer-plus/> (`?url=` `?new=1` `?lang=` `?view=extents|saved|limits` が使える)

### 既存パッチ (`patches/`)

| パッケージ | 目的 |
| --- | --- |
| `@mlightcad/data-model@1.15.14` | ① `lib/base/AcDbDxfPairReader.js`: 文字コード自動判定 (`acdbGuessLegacyEncoding`)、② `lib/dxf/AcDbDxfHeaderReader.js`: `$LIMMIN/$LIMMAX/$PLIMMIN/$PLIMMAX` を `db.limmin` 等に格納 (+ `.d.ts`)、③ `lib/dxf/AcDbNativeDxfConverter.js`: 読み込み直後に画層 0 と参照画層を作成 (`acdbEnsureReferencedLayers`) |
| `@mlightcad/libredwg-converter@3.15.14` | DWG ヘッダーの LIMMIN 等を `db` に格納 |
| `@mlightcad/geometry-engine@3.15.14` | NURBS 評価の高速パス |
| `@mlightcad/mtext-renderer@0.13.5` | `fonts.json` の絶対 URL (Google Fonts) を許可 |

---

## 2. 次の作業: JWW / SXF 読み込み

### 2.1 ビューア側の差し込み口 (調査済み)

形式ごとの読み込みは `AcDbDatabaseConverter` (data-model) を継承したコンバーターを
`AcDbDatabaseConverterManager.instance.register(fileType, converter)` で登録する仕組み。
DWG はこの方式で example 側から opt-in 登録している (`packages/cad-viewer-example/src/registerLibreDwg.ts`)。

ただし **拡張子 → 形式の判定が dwg / dxf の 2 択でハードコードされている箇所がある**ので、そこを直す必要がある:

| 場所 | 現状 | 対応 |
| --- | --- | --- |
| `packages/cad-simple-viewer/src/app/AcApDocument.ts` `openDocument()` | `fileExtension == 'dwg' ? DWG : DXF` | 拡張子をそのまま converter type として使い、未登録なら DXF にフォールバック |
| data-model `AcDbDatabase.openUri()` (`lib/database/AcDbDatabase.js` 2350 行付近) | `dwg` / `dxf` 以外は読まない | data-model パッチで一般化する。または `AcApDocument.openUri()` 側で fetch してから `database.read(buf, opts, type)` を呼ぶ |
| `packages/cad-viewer-example/src/components/FileUpload.vue` | `validExtensions = ['.dwg', '.dxf']` | 追加 (`useFileTypes()` で登録済み形式から生成するのが理想) |
| `packages/cad-simple-viewer/src/ui/AcUiFileOpenPanel.ts` | `SUPPORTED_EXTENSIONS` | 同上 |
| `packages/cad-simple-viewer/src/app/dataSource/AcApLocalDataSource.ts` | `SUPPORTED_EXTENSIONS` | 同上 |
| `packages/cad-simple-viewer/src/app/dataSource/AcApUrlDataSource.ts` | `/\.(dwg|dxf)$/i` | 同上 |
| `packages/cad-viewer/src/composable/useFileTypes.ts` | 登録済み形式の Set を返す | 受け入れ拡張子の元データとして使える |
| `packages/cad-viewer/.../MlExternalReferences.vue` | 外部参照は `.dwg,.dxf` | 当面対象外で良い |

i18n: ファイル選択画面などの「DWG / DXF」表記 (`packages/cad-simple-viewer/src/i18n/*/main.ts` など) も全ロケールで更新する。

コンバーターの実装パターン:

- **A. DXF 経由 (最短)**: 外部ライブラリで JWW → DXF 文字列に変換し、既存の `AcDbNativeDxfConverter` に渡す。
  ```ts
  class AcDbJwwConverter extends AcDbDatabaseConverter {
    async read(data: ArrayBuffer, db: AcDbDatabase, options?: AcDbDatabaseConverterReadOptions) {
      const dxf = readDxfString(new Uint8Array(data), { targetVersion: 'AC1024' }) // AC1024 = UTF-8
      const bytes = new TextEncoder().encode(dxf)
      const dxfConverter = AcDbDatabaseConverterManager.instance.get(AcDbFileType.DXF)!
      await dxfConverter.read(bytes.buffer, db, { ...options, encoding: 'utf-8' })
    }
  }
  ```
  変換コストが 2 回かかるが、画層・ブロック・寸法などの扱いを既存 DXF パスに任せられる。まずこれで動かすのを推奨。
- **B. 直接変換**: パース結果から `AcDbLine` 等を直接 `db` に追加する (libredwg-converter の `processLayers` / `processEntities` 構成が参考)。性能・忠実度は上がるが工数大。A で足りない所だけ B に寄せる。

配置案: `packages/cad-jww-converter` / `packages/cad-sxf-converter` を新設し、example の `main.ts` で `registerLibreDwg` と同様に登録。wasm を使う場合は `tools/worker-assets.mjs` と example の `vite.config.ts` (`viteStaticCopy`) に配布ファイルを追加する (LibreDWG の wasm がそのやり方)。

### 2.2 JWW (Jw_cad)

候補ライブラリ: **ezjww** (npm `ezjww` 0.7.3, MIT, Rust → WebAssembly)。リポジトリ <https://github.com/monozukuri-ai/ezjww>

- `detectFileFormat` (`jww` / `jwc` / `jws`)、`readDocument` (ヘッダー + エンティティ)、`readDxfString` / `readDxfDocument` (DXF 変換) がある。JWC (旧形式) も一部読める。
- 型定義から分かる情報: ヘッダーに `version`, `paper_size`, `layer_groups[16]` (各 `scale`, `name`, `layers[16]`)、ペン色・線種 (SXF 線種含む)。エンティティは `LINE` / 円弧 (`center`, `radius`, `start_angle`, `arc_angle`, `flatness`, `tilt_angle` → 楕円弧) / 点 / 文字 (`font_name`, `size_x/y`, `spacing`, `angle`) / 寸法 / ソリッド / ブロック。
- **注意: npm 版は Node 専用ビルド**。`wasm/ezjww_wasm.js` が `require('fs').readFileSync` で wasm を読む (wasm-pack の nodejs ターゲット)。ブラウザで使うには
  1. リポジトリをクローンして `wasm-pack build --target web` で web 版をビルド (README に `packages/ezjww/examples/browser` がある)、または
  2. npm 版の glue を pnpm patch して `fetch` + `WebAssembly.instantiate` に差し替える、
  のどちらか。wasm は約 1MB なので Worker で読むのが望ましい。
- JWW 固有で確認すべき点:
  - 座標単位と縮尺: レイヤグループごとに縮尺がある。ezjww は JWC のみ `jwcCoordinates` (用紙 mm / 実寸 mm) を持つので、JWW は実寸 mm で入っていると思われるが要確認。
  - 用紙サイズ (`paper_size`) → 「図面範囲」表示 (`$LIMMIN/$LIMMAX` もしくはペーパーレイアウト) に反映すると、今回入れた初期表示「図面範囲」がそのまま効く。
  - レイヤ名: 16 グループ × 16 レイヤ。DXF 画層名を `グループ名-レイヤ名` などにする規則を決める (名前が空のときは `0-0` 形式など)。
  - 色: Jw_cad のペン番号 1–9 と SXF 拡張色 → ACI / TrueColor 対応表が必要。
  - 文字: 新しい版は UTF-16、古い版は CP932。フォント名 (ＭＳ ゴシック等) は既存の `fonts.json` エイリアスで BIZ UD に置き換わる。
- 自前実装する場合: Jw_cad 本体に同梱/公開されているフォーマット資料 (JWW は MFC `CArchive` のシリアライズ形式、先頭シグネチャ `JwwData.`) を参照。LibreCAD にも JWW 読み込み (jwwlib) があるが **GPL なのでコードは流用しない**。

### 2.3 SXF (P21 / SFC / P2Z / SFZ)

SXF は国交省・JACIC (現 OCF) の CAD データ交換標準。電子納品で使われる。

- **SFC**: SXF 独自のテキスト形式 (フィーチャコメント)。Shift_JIS。TS で自前パーサーを書く現実的な対象。
- **P21**: ISO 10303-21 (STEP) 形式 (AP202 ベース)。文字列は `\X2\...\X0\` (UTF-16 16進) エスケープなどがある。
- **P2Z / SFZ**: それぞれ P21 / SFC を ZIP 圧縮したもの (属性ファイル SAF や画像が同梱されることも)。展開には fflate 等の MIT ライブラリ。
- 参考実装: **ezsxf** (PyPI, MIT, Rust + PyO3) <https://github.com/monozukuri-ai/ezsxf> — SXF Ver.3.1 の 34 フィーチャ全種をパースし DXF 変換もできると説明されている。npm/wasm 版は無いので、Rust 部分を wasm-bindgen でビルドするか、構造を参考に TS で書く。
- SXF 固有で確認すべき点:
  - 用紙 (sheet フィーチャ: A0–A4 等、縦横) → ペーパーレイアウト / 図面範囲。
  - レイヤ、既定色 16 色 + ユーザー定義色、既定線種・線幅 → DXF 画層・線種・線の太さ。
  - 複合図形 (定義と配置) → ブロック定義 / INSERT。
  - 寸法・引出線・バルーン・ハッチング・塗り・クロソイド・スプライン。
  - 仕様書本体は OCF (旧 JACIC) が公開している「SXF 仕様書」。版 (Ver.2.0 / 3.0 / 3.1) の差に注意。

### 2.4 進め方の提案

1. 拡張子判定の一般化 (2.1 の表) と、受け入れ拡張子を登録済みコンバーターから作る仕組み — 形式に依存しない下準備。テストも書く。
2. JWW: ezjww の web 版ビルドを用意 → パターン A で表示 → レイヤ・色・用紙・縮尺を詰める。
3. SFC: TS パーサー (またはezsxf の wasm 化) → パターン A/B。
4. P21 / P2Z / SFZ。
5. `resources/cad-data/samples/` にテスト用の小さい JWW / SFC を追加 (配布ライセンスに注意。自作が安全)、デモページにリンク、README 8 言語に追記。

---

## 3. 既知の問題・やり残し

- DWG を開く処理: NURBS 以外では、LibreDWG の `convertEx` (embind) が約 1 秒かかる。ここは手付かず。
- 文字コード自動判定: ヘッダーのない EUC-KR を GBK と誤判定することがある (日本語は問題なし)。
- LibreDWG のメモリ不足エラー文言が mlightcad の商用 DWG パーサー購入リンク (`{dwgParserLink}`) を案内している (`packages/cad-viewer/src/locale/*/main.ts`)。フォークとしては消すか差し替えたい。
- Google Fonts からのフォント読み込み (Arial → Arimo など) は、作業環境から外部に出られなかったため実ブラウザでは未確認。
- vue-tsc の既存エラー (MlStatusBar / MlEntityProperties など) と eslint の既存エラーは上流由来。

## 4. 検証のやり方 (これまで)

- `pnpm build && node tools/build-demo.mjs` → `node tools/serve-demo.mjs 4300` → Playwright で `http://localhost:4300/cad-viewer/?url=...&view=...` を開いてスクリーンショット比較。
- 大きな DWG のサンプルとして canteen.dwg (dwgmodels.com、レイアウトタブ有り) を使った。リポジトリには入れていない。
- 同梱サンプル: `resources/cad-data/samples/fonts-sample.dxf` (フォント置き換え), `sjis-sample.dxf` (Shift_JIS 判定), `limits-sample.dxf` (図面範囲表示、TABLES 無し R12)。
