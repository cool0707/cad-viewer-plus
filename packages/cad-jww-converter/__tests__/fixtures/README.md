# JWC fixtures

`q070.jwc` (line, circle, text, point) and `r001.jwc` (Japanese text) are copied
unchanged from the ezjww repository, `jwc_samples/generated/`
(<https://github.com/monozukuri-ai/ezjww>, commit
`ca16aafd84aab36e3a3f32970d044652c22bcaeb`). They are original test drawings
distributed under ezjww's MIT license (`jwc_samples/manifest.json`:
"MIT; repository LICENSE").

Both are A1 sheets with every layer group at 1/1. Tests that need another scale
overwrite the f32 group-0 scale at byte offset 1797 (header profile
`fixed2421_csv32_v1`).
