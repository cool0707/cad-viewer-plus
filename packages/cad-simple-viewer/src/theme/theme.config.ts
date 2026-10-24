/**
 * RemixCAD theme colours — テーマカラーの設定。
 *
 * Edit the values below and rebuild; every UI that uses the viewer
 * (cad-viewer, cad-simple-viewer, plugins, examples) picks them up through
 * the CSS variables written by `acedApplyBrandTheme()`:
 *
 * - `--ml-brand`          → `primary`
 * - `--ml-brand-from/to`  → `gradient`
 * - `--ml-brand-gradient` → `linear-gradient(90deg, from, to)`
 * - `--ml-brand-soft`     → `primary` at low opacity (hover / selected rows)
 * - `--el-color-primary*` → Element Plus palette derived from `primary`
 *
 * ここの値を書き換えてビルドし直せば UI のアクセント色がまとめて変わる。
 * Colours must be `#rgb` or `#rrggbb`.
 */
export const ML_THEME_CONFIG = {
  /** Single-colour accent: buttons, links, active items. 一色で使う色 */
  primary: '#AF61DA',
  /** Gradient start / end colours (left → right). グラデーションの両端 */
  gradient: ['#EA60D4', '#9C62DC']
}
