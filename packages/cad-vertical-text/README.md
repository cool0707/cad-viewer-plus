# @mlightcad/cad-vertical-text

Vertical text (縦書き) layout for CAD TEXT / MTEXT, shared by the screen
(`three-renderer`), SVG (`cad-svg-plugin`) and PDF (`pdf-renderer`,
`cad-pdf-plugin`) renderers. It has no dependencies.

Renderers only draw horizontal text. `VerticalTextLayout` splits a vertical
text into pieces (one upright character, or a run of characters that stay
sideways); the renderer draws each piece horizontally at the origin and reports
its advance width; `place()` then returns the matrix (`[a, b, c, d, e, f]`, as
in SVG `matrix()` / PDF `cm`) that moves each piece into the vertical line.

A text is vertical when (`verticalTextMode()`):

- its font name starts with `@` (Windows vertical font, e.g. `@ＭＳ ゴシック`,
  Jw_cad 縦字) — laid out like Windows / AutoCAD: full-width characters stand
  upright along the text rotation (270° reads top to bottom), half-width runs
  stay sideways; or
- its text style has the AutoCAD "vertical" flag (group 70 bit 4) and it is a
  TEXT / ATTRIB — every character is stacked upright, centred on the line
  through the insertion point. Like AutoCAD, MTEXT ignores the flag.

「ー」, brackets and dashes are turned sideways; 「、」「。」 move to the upper
right of the cell and small kana slightly up and right. MTEXT formatting codes
are dropped (`verticalTextLines()`).
