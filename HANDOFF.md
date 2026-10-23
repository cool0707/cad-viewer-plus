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
| `7bb415d` (PR #1) | **JWW 読み込み** (`packages/cad-jww-converter`)、拡張子判定の一般化 (`AcApDrawingFileTypes`) |
| (このブランチ) | JWW 文字サイズ補正、**JWC**、**SXF (SFC / P21 / SFZ / P2Z)** (`packages/cad-sxf-converter`) |

デモ: <https://cool0707.github.io/cad-viewer-plus/> (`?url=` `?new=1` `?lang=` `?view=extents|saved|limits` が使える)

### 既存パッチ (`patches/`)

| パッケージ | 目的 |
| --- | --- |
| `@mlightcad/data-model@1.15.14` | ① `lib/base/AcDbDxfPairReader.js`: 文字コード自動判定 (`acdbGuessLegacyEncoding`)、② `lib/dxf/AcDbDxfHeaderReader.js`: `$LIMMIN/$LIMMAX/$PLIMMIN/$PLIMMAX` を `db.limmin` 等に格納 (+ `.d.ts`)、③ `lib/dxf/AcDbNativeDxfConverter.js`: 読み込み直後に画層 0 と参照画層を作成 (`acdbEnsureReferencedLayers`) |
| `@mlightcad/libredwg-converter@3.15.14` | DWG ヘッダーの LIMMIN 等を `db` に格納 |
| `@mlightcad/geometry-engine@3.15.14` | NURBS 評価の高速パス |
| `@mlightcad/mtext-renderer@0.13.5` | `fonts.json` の絶対 URL (Google Fonts) を許可 |
| `ezjww@0.7.3` | npm 版は Node 専用 (読み込み時に `fs` で wasm を読む)。`initSync` / `initAsync` を追加し、wasm を後から渡せるようにした (`exports` に wasm パスも追加) |

---

## 2. JWW / JWC / SXF (済)

### 2.0 JWW でやったこと (2026-10-23)

- `packages/cad-jww-converter` (MIT): `AcDbJwwConverter` (Worker で ezjww → `convertJwwToDxf()` で DXF 文字列 → 登録済み DXF コンバーターで読み込み = パターン A)。
  example の `main.ts` で `registerJwwConverter('./assets/jww-parser-worker.js')`。
  配布物は `dist/jww-parser-worker.js` + `dist/jww-parser.wasm` (約 1MB)。example の `vite.config.ts` と `tools/copy-workers.mjs` でコピー。
- ezjww の DXF 出力をそのまま使わず、`readDxfDocument` (構造化) + `readDocument` (フォント名・レイヤグループ) から **自前で DXF を書いている** (`src/jwwToDxf.ts`)。理由:
  - JWW の座標は **図寸 (用紙 mm、用紙中心が原点)**。ezjww は縮尺を掛けないので計測値が図寸になる → 主レイヤグループ (要素数最多) の縮尺で一律に実寸化 (`scaleMode: 'drawing'`、既定)。グループ別 (`'layer-group'`、Jw_cad の DXF 出力相当) と図寸 (`'paper'`) も選べる。グループ別を既定にしないのは、1/1 の図枠グループと 1/100 の平面図グループが混在するとき図枠が極小になるため。
  - 用紙サイズ (`paper_size`: 0–4 = A0–A4、8–11 = 2A–5A、12–14 = 10m/50m/100m) → `$LIMMIN/$LIMMAX` (原点中心、主縮尺倍)。
  - 画層名を `<グループ>-<レイヤ> <グループ名> - <レイヤ名>` (16 進、Jw_cad と同じ) にし、使われている画層だけ作る。ezjww の画層名 → (グループ, レイヤ) は ezjww の `layer_name_map` を移植した `ezjwwLayerNames()` で逆引き。
  - 文字のフォント (ＭＳ ゴシック等) ごとに文字スタイルを作る (ezjww の DXF は全部 STANDARD)。
  - **文字高さの補正**: mtext-renderer は TrueType を「DXF の文字高さ = 英大文字 A の高さ」(`unitsPerEm / A.yMax` 倍) で描く。Jw_cad の文字サイズは全角の文字枠 (em) の高さなので、そのままだと BIZ UD で 1.27 倍 (明朝 1.29 倍) になり枠からはみ出す。高さに `A.yMax / em` (ゴシック 1617/2048、明朝 1587/2048) を掛け、基点も descender (246/2048) 分上げて文字枠の下端に合わせている (`jwwTextFontMetrics()`)。同梱フォントを差し替えたらこの値も更新すること。DXF/DWG は AutoCAD 互換の挙動なので触っていない。
  - 線種パターンは図寸 mm なので、要素の線種尺度 (48) に縮尺を入れる。
- 拡張子判定: `cad-simple-viewer/src/app/AcApDrawingFileTypes.ts` (`acapDrawingFileTypes()` など。DWG/DXF + `AcDbDatabaseConverterManager` に登録済みの形式)。`AcApDocument.openDocument`、ファイル選択パネル (タグ表示も)、ローカル/URL データソース、マークアップ/計測サイドカー名、example の `FileUpload.vue` が使う。`AcDbDatabase.openUri()` は元から未知の拡張子を converter type として渡すので変更不要。
- サンプル: `resources/cad-data/samples/jww-sample.jww` (`node tools/make-jww-sample.mjs` で ezjww の writer から生成、自作なのでライセンス問題なし)。テスト: `packages/cad-jww-converter/__tests__`、`cad-simple-viewer/__tests__/AcApDrawingFileTypes.spec.ts`、e2e `cad-viewer-example/e2e/tests/jww.spec.ts`。
- ezjww リポジトリの `jww_samples/` (実際の Jw_cad 図面: マンション平面例、木造平面例など) でもブラウザ表示を確認済み (リポジトリには入れていない)。
- 注意: Jest は data-model の CJS ビルドを読むので、data-model パッチ (`$LIMMIN` 読み込みなど) は Jest では効かない。`db.limmin` はブラウザでしか確認できない。
- **JWC (旧形式)** も同じコンバーターで読む (`jwc` にも登録)。`readJwcDocument` のヘッダー (レイヤグループ・縮尺・用紙 A0–A4) を JWW と同じ形 (`JwSource`) に正規化し、`readDxfDocument(…, { jwcCoordinates: 'paper_millimeters' })` (用紙中心原点の図寸 mm) を同じ writer に通す。JWC にはフォントが無いので ＭＳ ゴシック 扱い。ezjww が受け付ける JWC は 2 種類の固定ヘッダー形式だけで、それ以外はエラー。テスト用 JWC は ezjww の MIT サンプル (`packages/cad-jww-converter/__tests__/fixtures/`)。縮尺のテストはオフセット 1797 の f32 を書き換えて作っている。
- 未対応: JWS、画像 (`^@BM`)、Worker 無しの main thread モードはテストのみで使用 (`wasmUrl` 指定で動く)。外部参照 (XATTACH) は DWG/DXF のまま。

以下は着手前の調査メモ (JWW 部分は上記で対応済み)。

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

**実装済み (2026-10-23)** — `packages/cad-sxf-converter` (MIT、TypeScript のみ、wasm・Worker なし、ZIP は fflate)。

- ezsxf (MIT) のうち、仕様の実装部分を TS に移植した: `features.rs` (各 feature の引数位置)、`document.rs` (コード表の採番と、
  「部品は定義 (sfig_org / composite_curve_org / drawing_sheet) より前に並ぶ」階層規則)、`_drawing_*.py` (スタイル解決・複合図形の展開・
  寸法・ハッチ)、`_p21_drawing.py` (AP202 の表現グラフ)。ezsxf の DXF 出力は全部ポリライン化するので、出力側 (`sxfToDxf.ts`) は自前:
  - 円・円弧・楕円は共役半径 (u, v) で持ち、DXF では主軸に直して CIRCLE / ARC / ELLIPSE にする (非等倍の配置でも正確)。
  - 縮尺: 図寸 (用紙 mm) で展開し、各プリミティブに配置倍率を持たせ、最も多いものを主縮尺として全体を拡大 (`scaleMode: 'drawing'`、JWW と同じ考え方)。
  - 文字: SXF の高さ・幅は文字枠 (幅は文字列全体)。JWW と同じ BIZ UD の補正 (高さ × A の高さ/em、基点を descender 分上げる) と、枠幅に合う幅係数。基点 1–9 は自前で左下ベースラインに換算 (DXF の 72/73 配置には頼らない)。
  - 黒・白は ACI 7 (背景に応じて反転)。それ以外は 420 の True Color。
  - DXF 読み込み側 (data-model) は `100 AcDbCircle` などのサブクラスマーカーが無いと `100 AcDbEntity` 以降の値を読まない。エンティティには必ず正しいマーカーを書く。
- ezsxf と意図的に変えた点: 部分図 (sfig 種別 1・2、P21 の `$$SXF_FM_` / `$$SXF_FG_`) の配置では子要素の画層を上書きしない (ezsxf は配置画層が 0 以外なら上書き。ezsxf の writer は配置に画層 1 を付けるので、そのままだと平面図の画層がすべて図枠画層になる)。
- サンプル: `tools/make-sxf-sample.py` (ezsxf の作成 API、`pip install ezsxf==0.3.4`) で `sxf-sample.sfc/.p21/.sfz/.p2z` を生成。SFC 版と P21 版が同じ図形になることをテストで確認している。
- ezsxf リポジトリの `data/D0LS004Z*` (ABC-CAD 出力の実データ、配布条件不明なのでコミットしない) で SFC / P21 とも同じ結果になり、ezsxf のプロットとも一致することを確認済み。P21 1.4MB の変換は約 0.3 秒 (初回は JIT で約 1 秒)。
- 未対応: 縦書き (90° 回転で代用)、矢印種別 (すべて開き矢印)、外部定義ハッチ・タイルハッチ (境界のみ)、外部定義シンボル (点)、SAF 属性・ラスター画像、背景色属性。

以下は着手前の調査メモ。

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

1. ~~拡張子判定の一般化~~ (済)
2. ~~JWW~~ (済。2.0 参照)
3. ~~SFC~~ (済。2.3 参照)
4. ~~P21 / P2Z / SFZ~~ (済)
5. ~~サンプル・デモ・README~~ (済)

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
