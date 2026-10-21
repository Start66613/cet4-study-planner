import { test, expect, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { freshState, makeDay } from '../../src/domain'
import { exportBackup } from '../../src/transfer'
const date = '2026-10-21'
test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date(date + 'T04:00:00Z')) })
async function open(page: Page) { await page.goto('./'); await expect(page.getByRole('heading', { name: /今天，也慢慢来|月.*日/ }).first()).toBeVisible() }
async function nav(page: Page, name: string) { await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name, exact: true }).click() }
async function upload(page: Page, value: unknown) {
  await page.getByLabel('选择JSON文件').setInputFiles({ name: 'test-import.json', mimeType:'application/json', buffer: Buffer.from(JSON.stringify(value)) })
  await expect(page.getByRole('dialog')).toBeVisible()
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(await page.locator('body').evaluate(el => el.scrollWidth <= innerWidth)).toBe(true)
}
async function touchTargets(page: Page) {
  const small = await page.locator('button:visible').evaluateAll(buttons => buttons.filter(b => { const r = b.getBoundingClientRect(); return r.width < 43.9 || r.height < 43.9 }).map(b => b.getAttribute('aria-label') ?? b.textContent))
  expect(small).toEqual([])
}
test('375 / 390 / 430: four pages, light and dark, safe navigation and no overflow', async ({ page }) => {
  const shots = `screenshots/${test.info().project.name}`
  await mkdir(shots, { recursive: true })
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await open(page)
  for (const width of [375,390,430]) {
    await page.setViewportSize({ width, height:844 })
    for (const name of ['今日','计划','日历','我的']) {
      await nav(page,name); await noOverflow(page); await touchTargets(page)
      await page.screenshot({ path:`${shots}/${width}-${name}-light.png`, fullPage:true })
      if (width === 390 && name === '今日') await page.screenshot({path:`${shots}/390-today-viewport.png`})
    }
    await page.getByRole('button', { name:'深色', exact:true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme','dark')
    for (const name of ['今日','计划','日历','我的']) {
      await nav(page,name); await noOverflow(page)
      await page.screenshot({ path:`${shots}/${width}-${name}-dark.png`, fullPage:true })
    }
    await page.getByRole('button', { name:'浅色', exact:true }).click()
  }
  expect(errors).toEqual([])
  await page.locator('.page-footer').scrollIntoViewIfNeeded()
  const footer = await page.locator('.page-footer').boundingBox(), navBox = await page.locator('.bottom-nav').boundingBox()
  expect(footer!.y + footer!.height).toBeLessThan(navBox!.y)
})
test('create, edit, complete, cancel and delete tasks; history survives reload and mode switching', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name:'添加', exact:true }).click()
  await page.getByLabel('任务名称').fill('浏览器测试任务')
  await page.getByRole('button', { name:'保存', exact:true }).click()
  await expect(page.getByText('浏览器测试任务', { exact:true })).toBeVisible()
  await page.getByRole('checkbox', { name:'完成浏览器测试任务', exact:true }).click()
  await expect(page.getByRole('checkbox', { name:'取消完成浏览器测试任务', exact:true })).toHaveAttribute('aria-checked','true')
  await page.reload()
  await expect(page.getByRole('checkbox', { name:'取消完成浏览器测试任务', exact:true })).toBeVisible()
  await page.getByRole('checkbox', { name:'取消完成浏览器测试任务', exact:true }).click()
  await page.locator('.task-copy').filter({ hasText:'浏览器测试任务' }).click()
  await page.getByLabel('任务名称').fill('编辑后的任务')
  await page.getByLabel('实际学习分钟', { exact:false }).fill('12')
  await page.getByRole('button', { name:'保存', exact:true }).click()
  await expect(page.getByText('编辑后的任务', { exact:true })).toBeVisible()
  const first = page.getByRole('checkbox', { name:'完成高频词汇', exact:true }); await first.click()
  await page.getByRole('button', { name:'30分', exact:true }).click()
  await expect(page.getByRole('checkbox', { name:'取消完成高频词汇', exact:true })).toBeVisible()
  await page.getByRole('button', { name:'下一周', exact:true }).click()
  await expect(page.getByRole('checkbox', { name:'完成高频词汇', exact:true })).toBeVisible()
  await page.getByRole('button', { name:'回到今天', exact:true }).click()
  await expect(page.getByRole('checkbox', { name:'取消完成高频词汇', exact:true })).toBeVisible()
  await page.locator('.task-copy').filter({ hasText:'编辑后的任务' }).click()
  await page.getByRole('button', { name:'移除本日任务', exact:true }).click()
  await page.getByRole('button', { name:'确认移除本日任务', exact:true }).click()
  await expect(page.locator('.task-title').filter({ hasText:'编辑后的任务' })).toHaveCount(0)
  await nav(page,'日历'); await expect(page.getByText('编辑后的任务（已移除）')).toBeVisible()
  await expect(page.locator('.history-summary')).toContainText('12 分钟')
})
test('imports explicit schedule, changes course, preserves warnings and handles malformed JSON', async ({ page }) => {
  await open(page)
  await upload(page, { schemaVersion:1, timezone:'Asia/Shanghai', semesterStart:'2026-01-05', examDate:'2026-12-12', courses:[{day:0,s:'3–4',name:'演示理论课',weeks:[2,4],type:'theory',note:'主表和附注存在冲突，待核实'}], uncertainNotes:['集中实验时间待通知'] })
  await page.getByRole('button', { name:'替换当前课表', exact:true }).click()
  await nav(page,'计划'); await page.getByRole('button', { name:'我的课表', exact:true }).click()
  await page.getByLabel('教学周次').selectOption('2'); await page.getByRole('button', { name:'课表周一', exact:true }).click()
  await expect(page.locator('.course-card').getByText('演示理论课', { exact:true })).toBeVisible()
  await page.getByLabel('教学周次').selectOption('3')
  await expect(page.locator('.course-card').getByText('演示理论课', { exact:true })).toHaveCount(0)
  await page.getByLabel('教学周次').selectOption('4')
  await page.locator('.course-card').getByRole('button', { name:/演示理论课/ }).click()
  await page.getByLabel('课程名称').fill('演示课程已编辑')
  await page.getByRole('button', { name:'保存', exact:true }).click()
  await expect(page.locator('.course-card').getByText('演示课程已编辑')).toBeVisible()
  await expect(page.getByText('集中实验时间待通知', { exact:true })).toBeVisible()
  await upload(page, { app:'studyflow', schemaVersion:99 })
  await expect(page.getByRole('alert')).toContainText('文件校验失败')
  await page.getByRole('button', { name:'关闭', exact:true }).click()
  await expect(page.locator('.course-card').getByText('演示课程已编辑')).toBeVisible()
})
test('score records and online course progress support edit and delete with real values only', async ({ page }) => {
  await open(page); await nav(page,'计划'); await page.getByRole('button', { name:'真题记录', exact:true }).click()
  await page.getByRole('button', { name:'记录一次真题', exact:true }).click()
  await page.getByLabel('真题年份与套次').fill('演示真题 第1套')
  await page.getByLabel('听力正确题数 / 25').fill('11'); await page.getByLabel('阅读正确题数 / 30').fill('16')
  await page.getByLabel('写作已完成').check(); await page.getByLabel('错题原因与备注').fill('同义替换定位错误')
  await page.getByRole('button', { name:'保存', exact:true }).click()
  await page.getByRole('button', { name:/演示真题 第1套/ }).click()
  await page.getByLabel('听力正确题数 / 25').fill('13'); await page.getByRole('button', { name:'保存', exact:true }).click()
  await expect(page.locator('.score-values')).toContainText('13')
  await page.reload(); await expect(page.locator('.score-values')).toContainText('13')
  await page.getByRole('button', { name:/演示真题 第1套/ }).click()
  await page.getByRole('button', { name:'删除记录', exact:true }).click(); await page.getByRole('button', { name:'确认删除这次记录', exact:true }).click()
  await expect(page.locator('.score-card')).toHaveCount(0)
  await page.getByRole('button', { name:'学习计划', exact:true }).click(); await page.getByRole('button', { name:'添加网课', exact:true }).click()
  await page.getByLabel('课程名称').fill('演示网课'); await page.getByLabel('当前章节').fill('第一章')
  await page.getByLabel('已完成集数').fill('3'); await page.getByLabel('总集数').fill('10')
  await page.getByLabel('下一步任务').fill('完成第四集'); await page.getByRole('button', { name:'保存', exact:true }).click()
  await expect(page.locator('.progress-card')).toContainText('3 / 10')
  await page.locator('.progress-card').click(); await page.getByLabel('已完成集数').fill('11'); await page.getByRole('button', { name:'保存', exact:true }).click()
  await expect(page.getByRole('alert')).toContainText('不能大于')
  await page.getByLabel('已完成集数').fill('4'); await page.getByRole('button', { name:'保存', exact:true }).click()
  await expect(page.locator('.progress-card')).toContainText('4 / 10')
})
test('exports JSON, validates restore, deduplicates and leaves records after an offline reload', async ({ page, context }) => {
  await open(page)
  const s = freshState(); s.days[date] = makeDay(s,date); s.days[date].items[0].done = true; s.days[date].items[0].actual = 18
  await upload(page,exportBackup(s)); const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name:'替换恢复全部数据', exact:true }).click(); await downloadPromise
  await expect(page.getByRole('checkbox', { name:'取消完成高频词汇', exact:true })).toBeVisible()
  await upload(page,exportBackup(s)); await page.getByRole('button', { name:'合并导入 · 保留本机冲突项', exact:true }).click()
  await expect(page.getByRole('checkbox', { name:'取消完成高频词汇', exact:true })).toHaveCount(1)
  await nav(page,'我的'); const exported = page.waitForEvent('download'); await page.getByRole('button', { name:/导出 JSON 备份/ }).click(); const file = await exported
  const filePath = await file.path(); const { readFile } = await import('node:fs/promises'); const backup = JSON.parse(await readFile(filePath!, 'utf8'))
  expect(backup.data.days[date].items[0].actual).toBe(18)
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload(); await expect(page.getByRole('heading', { name:'我的小空间' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await context.setOffline(true); await page.reload(); await expect(page.getByRole('heading', { name:'我的小空间' })).toBeVisible()
  await nav(page,'今日'); await expect(page.getByRole('checkbox', { name:'取消完成高频词汇', exact:true })).toBeVisible()
  await page.getByRole('checkbox', { name:'取消完成高频词汇', exact:true }).click()
  await expect(page.getByRole('checkbox', { name:'完成高频词汇', exact:true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('checkbox', { name:'完成高频词汇', exact:true })).toBeVisible()
  await context.setOffline(false)
})
test('manifest has correct base, icons, scope and standalone launch', async ({ request }) => {
  const manifest = await (await request.get('manifest.webmanifest')).json()
  expect(manifest.start_url).toBe('/cet4-study-planner/'); expect(manifest.scope).toBe('/cet4-study-planner/'); expect(manifest.display).toBe('standalone')
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true)
})
test('mobile editor fits small screens, has accessible dismissal and respects reduced motion', async ({ page }) => {
  await open(page); await page.emulateMedia({ reducedMotion:'reduce' })
  for (const width of [375,390,430]) {
    await page.setViewportSize({width,height:844})
    await page.getByRole('button',{name:'添加',exact:true}).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await noOverflow(page); await touchTargets(page)
    expect(await page.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
    await page.getByRole('button',{name:'关闭',exact:true}).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  }
  const duration = await page.locator('.progress-ring circle').last().evaluate(el => parseFloat(getComputedStyle(el).transitionDuration))
  expect(duration).toBeLessThanOrEqual(.00001)
})
