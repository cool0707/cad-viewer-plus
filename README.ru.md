# CAD-Viewer Plus

[English](./README.md) | [日本語](./README.ja.md) | [简体中文](./README.zh-CN.md) | [한국어](./README.ko.md) | [Español](./README.es.md) | [Português](./README.pt.md) | [Русский](./README.ru.md) | [Čeština](./README.cs.md)

> **Это форк.** CAD-Viewer Plus — форк проекта
> [mlightcad/cad-viewer](https://github.com/mlightcad/cad-viewer) (лицензия MIT).
> Он развивается независимо и **не связан с автором исходного проекта и не
> поддерживается им**. Сообщайте о проблемах этого форка в
> [issues этого репозитория](https://github.com/cool0707/cad-viewer-plus/issues),
> а не в исходный проект.

Просмотрщик и редактор DXF/DWG, полностью работающий в браузере: разбор
чертежей, обработка геометрии и отрисовка (Three.js / WebGL) выполняются на
клиенте, поэтому чертежи не покидают устройство пользователя.

## Что добавлено в этом форке

- **Японский интерфейс**: полная локаль `ja` для всех пакетов (просмотрщик,
  лента, командная строка, диалоги, плагины, сравнение чертежей, офлайн-экспорт
  в HTML). Язык определяется по настройкам браузера.
- **Шрифты размещаются в приложении, без CAD CDN**: шрифты и шаблоны чертежей
  отдаются самим приложением (`resources/cad-data` → `./cad-data/`).
  - Текст чертежей: включены **BIZ UD Gothic / Mincho**, они заменяют
    MS Gothic / MS Mincho и служат резервным шрифтом по умолчанию.
  - Другие письменности загружаются по требованию из **Google Fonts**
    (Arial → Arimo, SimSun → Noto Serif SC, Malgun Gothic → Noto Sans KR и т. д.).
  - Текст интерфейса: **Noto Sans JP** (размещается локально через
    `@fontsource-variable/noto-sans-jp`).
- **Локализованные имена листов** в новых чертежах вместо китайских имён из шаблона.
- В планах: импорт **JWW** (Jw_cad) и **SXF** (P21 / SFC).

## Демо

- Онлайн: <https://cool0707.github.io/cad-viewer-plus/>
- Локально:

  ```bash
  pnpm install
  pnpm demo:build   # сборка всех пакетов и создание demo-dist/
  pnpm demo         # http://localhost:4300/
  ```

## Начало работы

Требуются [Node.js](https://nodejs.org/) >= 24 и [pnpm](https://pnpm.io/) >= 10.

```bash
git clone https://github.com/cool0707/cad-viewer-plus.git
cd cad-viewer-plus
pnpm install
pnpm dev          # полнофункциональный просмотрщик
pnpm dev:simple   # простой просмотрщик
pnpm build
pnpm test
```

## Шрифты и ресурсы

Всё, что просмотрщик загружает во время работы, находится в `resources/cad-data/`
(см. [README](./resources/cad-data/README.md)). При встраивании пакетов передайте
`baseUrl` в `AcApDocManager`; резервные шрифты настраиваются опциями
`defaultFonts` / `symbolFonts`. Шрифты SHX не включены; текст с ними отображается
шрифтом BIZ UD Gothic.

## Поддержка DWG

DXF читается встроенным парсером с лицензией MIT. DWG поддерживается
опционально через `@mlightcad/libredwg-converter` на основе
[LibreDWG](https://github.com/LibreDWG/libredwg) с лицензией **GPL-3.0**;
перед распространением учтите требования GPL.

## Лицензия

[MIT](./LICENSE). Исходное уведомление об авторских правах mlightcad сохранено,
как того требует лицензия. Включённые шрифты BIZ UD (© Morisawa Inc.) и
Noto Sans JP распространяются по лицензии SIL Open Font License 1.1.
