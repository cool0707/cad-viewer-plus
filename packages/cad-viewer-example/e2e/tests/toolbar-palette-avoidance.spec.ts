import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, type Page, test } from '@playwright/test'

import { uploadFixture } from '../helpers/fileUpload'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturePath = path.resolve(currentDir, '..', 'fixtures', 'two-lines.dxf')

const verticalToolbar = (page: Page) =>
  page.locator('.ml-vertical-toolbar-host > .ml-ex-ui-toolbar')
const shortcutToolbar = (page: Page) =>
  page.locator('.ml-ui-shortcut-toolbar-shell')

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

test('toolbars move to the left while the palette is docked right', async ({
  page
}) => {
  await openLayerPalette(page)

  await dockTo(page, /right/i)
  await expect(verticalToolbar(page)).toHaveClass(/\bis-left\b/)
  await expect(shortcutToolbar(page)).toHaveClass(/\bis-left\b/)

  await dockTo(page, /left/i)
  await expect(verticalToolbar(page)).toHaveClass(/\bis-right\b/)
  await expect(shortcutToolbar(page)).not.toHaveClass(/\bis-left\b/)
})

test('toolbars return to the right when the palette closes', async ({
  page
}) => {
  await openLayerPalette(page)
  await dockTo(page, /right/i)
  await expect(verticalToolbar(page)).toHaveClass(/\bis-left\b/)

  await page.locator('.ml-tool-palette-action-close').click()
  await expect(verticalToolbar(page)).toHaveClass(/\bis-right\b/)
  await expect(shortcutToolbar(page)).not.toHaveClass(/\bis-left\b/)
})
