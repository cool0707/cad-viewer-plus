import { expect, type Page, test } from '@playwright/test'

const palette = (page: Page) => page.locator('.ml-layer-manager')

const paletteBox = async (page: Page) => {
  const box = await palette(page).boundingBox()
  if (!box) throw new Error('palette not visible')
  return box
}

async function expectAtRightEdge(page: Page, width: number) {
  await expect
    .poll(async () => {
      const box = await paletteBox(page)
      return [Math.round(box.x + box.width), Math.round(box.width)]
    })
    .toEqual([page.viewportSize()!.width, width])
}

test('a right-docked palette stays at the right edge when the window shrinks', async ({
  page
}) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto('/?new=1')
  await expect(palette(page)).toBeVisible({ timeout: 30000 })
  // Docked right once the ribbon settles.
  await expectAtRightEdge(page, (await paletteBox(page)).width)
  const width = Math.round((await paletteBox(page)).width)

  // The resize event used to apply the width delta on top of the viewer's own
  // re-sync, moving the palette twice as far as the window shrank.
  for (const viewportWidth of [1400, 1200, 1500]) {
    await page.setViewportSize({ width: viewportWidth, height: 800 })
    await expectAtRightEdge(page, width)
  }
})

test('collapsing and expanding a right-docked palette keeps it at the edge', async ({
  page
}) => {
  await page.setViewportSize({ width: 1400, height: 800 })
  await page.goto('/?new=1')
  await expect(palette(page)).toBeVisible({ timeout: 30000 })
  await expectAtRightEdge(page, (await paletteBox(page)).width)
  const width = Math.round((await paletteBox(page)).width)

  const collapse = palette(page).locator('.ml-tool-palette-action-collapse')
  await collapse.click()
  await expect
    .poll(async () => Math.round((await paletteBox(page)).width))
    .toBeLessThan(width)

  await page.setViewportSize({ width: 1200, height: 800 })
  await collapse.click()
  await expectAtRightEdge(page, width)
})
