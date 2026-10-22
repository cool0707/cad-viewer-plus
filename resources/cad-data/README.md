# cad-data (self-hosted resources)

Fonts and drawing templates that the viewer loads from `baseUrl`
(default: `cad-data/` next to the app). The example apps copy this folder
into their build output, so no third-party CAD CDN is needed.

## fonts/

`fonts.json` is the font catalog read by `@mlightcad/mtext-renderer`.

| File | Font | Used for (aliases) |
| --- | --- | --- |
| `bizudgothic.woff` | BIZ UDGothic | default fallback, symbols, MS Gothic, IPA Gothic … |
| `bizudpgothic.woff` | BIZ UDPGothic | MS PGothic, MS UI Gothic, Meiryo, Yu Gothic … |
| `bizudmincho.woff` | BIZ UDMincho | MS Mincho, IPA Mincho … |
| `bizudpmincho.woff` | BIZ UDPMincho | MS PMincho, Yu Mincho … |

The BIZ UD fonts are © Morisawa Inc., licensed under the SIL Open Font
License 1.1 (`OFL-BIZUD.txt`); the WOFF files are converted from the TTFs in
[google/fonts](https://github.com/google/fonts).

Entries whose `file` is an absolute URL (Arimo, Tinos, Cousine, Noto Sans /
Serif SC, TC, KR, Arabic, Hebrew, Thai) are downloaded from Google Fonts only
when a drawing references them (e.g. Arial, SimSun, Malgun Gothic). Absolute
URLs in `fonts.json` are supported through
`patches/@mlightcad__mtext-renderer@0.13.5.patch`.

## templates/

`acad.dxf` / `acadiso.dxf` are the new-drawing templates. Their paper-space
layouts are named `Layout1` / `Layout2`; `AcApDocManager.newDocument()`
renames them for the active UI language (e.g. `レイアウト1`).
