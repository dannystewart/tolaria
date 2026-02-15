import { test, expect } from '@playwright/test'

test('zero horizontal shift: headings and bullets', async ({ page }) => {
  await page.goto('http://localhost:5173')
  await page.waitForTimeout(800)

  // Open "Build Laputa App" which has headings and bullets
  const noteItem = page.locator('.note-list__item', { hasText: 'Build Laputa App' })
  await noteItem.click()
  await page.waitForTimeout(800)

  const cmEditor = page.locator('.cm-editor')
  await expect(cmEditor).toBeVisible()

  // Find heading and measure position BEFORE click
  const headingText = page.locator('.cm-header-2', { hasText: 'Overview' }).first()
  await expect(headingText).toBeVisible()
  const beforeBox = await headingText.boundingBox()
  console.log('Heading BEFORE:', JSON.stringify(beforeBox))

  // Click heading to activate
  if (beforeBox) {
    await page.mouse.click(beforeBox.x + beforeBox.width / 2, beforeBox.y + beforeBox.height / 2)
  }
  await page.waitForTimeout(500)

  const afterBox = await headingText.boundingBox()
  console.log('Heading AFTER:', JSON.stringify(afterBox))

  // CRITICAL: zero horizontal shift
  if (beforeBox && afterBox) {
    const xShift = Math.abs(afterBox.x - beforeBox.x)
    console.log(`Heading horizontal shift: ${xShift}px`)
    expect(xShift).toBeLessThan(2)
  }

  // Verify heading marker is position:absolute (out of flow)
  const marker = page.locator('.cm-heading-line .cm-formatting-block').first()
  if (await marker.count() > 0) {
    const pos = await marker.evaluate(el => window.getComputedStyle(el).position)
    expect(pos).toBe('absolute')
  }

  // Test bullet line shift
  const bulletLine = page.locator('.cm-line', { hasText: 'Four-panel layout working' }).first()
  const bBefore = await bulletLine.boundingBox()

  if (bBefore) {
    await page.mouse.click(bBefore.x + bBefore.width / 2, bBefore.y + bBefore.height / 2)
  }
  await page.waitForTimeout(500)

  const bAfter = await bulletLine.boundingBox()
  if (bBefore && bAfter) {
    const xShift = Math.abs(bAfter.x - bBefore.x)
    console.log(`Bullet horizontal shift: ${xShift}px`)
    expect(xShift).toBeLessThan(2)
  }

  // Verify bullet marker is always full font-size (not collapsed)
  const bulletMarker = page.locator('.cm-line:not(.cm-heading-line) .cm-formatting-block').first()
  if (await bulletMarker.count() > 0) {
    const fontSize = await bulletMarker.evaluate(el => window.getComputedStyle(el).fontSize)
    expect(parseFloat(fontSize)).toBeGreaterThan(10)
  }

  // Verify no heading underline (FIX 1)
  const headingLine = page.locator('.cm-heading-line').first()
  if (await headingLine.count() > 0) {
    const border = await headingLine.evaluate(el => window.getComputedStyle(el).borderBottom)
    expect(border).toContain('none')
  }

  // Take final screenshots
  const editorBox = await cmEditor.boundingBox()
  if (editorBox) {
    const clip = { x: editorBox.x, y: editorBox.y, width: editorBox.width, height: Math.min(editorBox.height, 500) }
    await page.screenshot({ path: 'test-results/zero-shift-final.png', clip })
  }
})
