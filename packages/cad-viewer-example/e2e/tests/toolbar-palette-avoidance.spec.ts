import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, type Page, test } from '@playwright/test'

import { uploadFixture } from '../helpers/fileUpload'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturePath = path.resolve(currentDir, '..', 'fixtures', 'two-lines.dxf')

const verticalToolbar = (page: Page) =>
  page.locator('.ml-vertical-toolbar-host > .ml-ex-ui-toolbar')
async function openLayerPalette(page: Page) {
  await page.goto('/')
  await uploadFixture(page, fixturePath)
  await expect(page.locator('.ml-cad-container')).toBeVisible({
    timeout: 30000
  })
  await page.waitForTimeout(2000)
  const commandLine = page.locator('input[placeholder="Type command"]')
  await commandLine.click()
  await commandLine.fill('layer')
  await page.keyboard.press('Enter')
  await expect(page.locator('.ml-layer-manager')).toBeVisible()
}

async function dockTo(page: Page, label: RegExp) {
  await page.locator('.ml-tool-palette-dock-btn').click()
  await page
    .locator('.ml-tool-palette-dock-menu li')
    .filter({ hasText: label })
    .click()
}

test('the toolbar moves right while the palette is docked left', async ({
  page
}) => {
  await openLayerPalette(page)

  await dockTo(page, /left/i)
  await expect(verticalToolbar(page)).toHaveClass(/\bis-right\b/)

  await dockTo(page, /right/i)
  await expect(verticalToolbar(page)).toHaveClass(/\bis-left\b/)
})

test('the toolbar returns to the left when the palette closes', async ({
  page
}) => {
  await openLayerPalette(page)
  await dockTo(page, /left/i)
  await expect(verticalToolbar(page)).toHaveClass(/\bis-right\b/)

  await page.locator('.ml-tool-palette-action-close').click()
  await expect(verticalToolbar(page)).toHaveClass(/\bis-left\b/)
})

test('a dragged toolbar the palette covers is docked again', async ({
  page
}) => {
  await openLayerPalette(page)
  await dockTo(page, /left/i)
  await expect(verticalToolbar(page)).toHaveClass(/\bis-right\b/)

  // Drag the bar from the right edge towards the middle, then dock the
  // palette to the right on top of it.
  const grip = verticalToolbar(page).locator('.ml-ex-ui-toolbar-grip')
  const box = await grip.boundingBox()
  if (!box) throw new Error('toolbar grip not visible')
  const viewport = page.viewportSize()!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(viewport.width - 200, box.y + 40, { steps: 10 })
  await page.mouse.up()
  await expect(verticalToolbar(page)).toHaveClass(/\bis-floating\b/)

  await dockTo(page, /right/i)
  await expect(verticalToolbar(page)).not.toHaveClass(/\bis-floating\b/)
  await expect(verticalToolbar(page)).toHaveClass(/\bis-left\b/)
})
