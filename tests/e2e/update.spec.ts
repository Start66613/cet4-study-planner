import { test, expect } from '@playwright/test'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
test('real waiting Service Worker update prompts and preserves IndexedDB records', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Playwright Service Worker lifecycle automation is supported on Chromium. This Windows WebKit did not request a second worker script; confirm Safari updating on a real iPhone.')
  let revision = 1
  const requests: string[] = []
  const root = path.resolve('dist'), prefix = '/cet4-study-planner/'
  const types: Record<string,string> = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json', '.txt':'text/plain' }
  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, 'http://localhost')
    if (!url.pathname.startsWith(prefix)) { res.writeHead(404).end(); return }
    const relative = url.pathname.slice(prefix.length) || 'index.html', target = path.resolve(root,relative)
    requests.push(`${relative}@${revision}`)
    if (!target.startsWith(root + path.sep)) { res.writeHead(403).end(); return }
    try {
      const bytes = await readFile(target)
      let body = bytes
      if (revision === 2) {
        const html = (await readFile(path.join(root,'index.html'),'utf8')).replace('<title>','<meta name="studyflow-regression" content="2"><title>')
        if (relative === 'index.html') body = Buffer.from(html)
        if (relative === 'sw.js') body = Buffer.from(bytes.toString().replace(/(url:"index.html",revision:")[^"]+("\})/, `$1${createHash('md5').update(html).digest('hex')}$2`))
      }
      res.writeHead(200, { 'Content-Type': types[path.extname(target)] ?? 'application/octet-stream', 'Cache-Control':'no-store', 'Content-Length':body.length })
      res.end(body)
    } catch { res.writeHead(404).end() }
  })
  await new Promise<void>(resolve => server.listen(4175,'127.0.0.1',resolve))
  try {
    await page.clock.setFixedTime(new Date('2026-10-21T04:00:00Z'))
    await page.goto('http://127.0.0.1:4175' + prefix)
    await page.getByRole('checkbox', { name:'完成高频词汇', exact:true }).click()
    await page.getByLabel('今日备注').fill('更新前的真实测试记录')
    await page.getByLabel('今日备注').blur()
    await page.evaluate(async () => { await navigator.serviceWorker.ready })
    await page.reload()
    await expect(page.getByRole('checkbox', { name:'取消完成高频词汇', exact:true })).toBeVisible()
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
    await page.getByRole('navigation', { name:'主导航' }).getByRole('button', { name:'我的', exact:true }).click()
    await expect(page.getByRole('button', { name:/离线已就绪/ })).toBeVisible()
    await page.getByRole('navigation', { name:'主导航' }).getByRole('button', { name:'今日', exact:true }).click()
    revision = 2
    await page.evaluate(async () => { const reg = await navigator.serviceWorker.getRegistration(); if (!reg) throw new Error('Active registration unavailable'); void reg.update() })
    try { await expect(page.getByText('有新版本，记录会保留', { exact:true })).toBeVisible({timeout:15000}) }
    catch (error) {
      console.log('SW update requests', requests)
      console.log('SW state', await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return { active:r?.active?.state, waiting:r?.waiting?.state, installing:r?.installing?.state, controller:navigator.serviceWorker.controller?.state } }))
      throw error
    }
    await page.getByRole('button', { name:'更新', exact:true }).click()
    await expect(page.getByRole('checkbox', { name:'取消完成高频词汇', exact:true })).toBeVisible()
    await expect(page.getByLabel('今日备注')).toHaveValue('更新前的真实测试记录')
    await expect.poll(() => page.evaluate(async () => { const reg = await navigator.serviceWorker.getRegistration(); return reg?.waiting === null })).toBe(true)
    await expect(page.locator('meta[name="studyflow-regression"]')).toHaveAttribute('content','2')
  } finally { await new Promise<void>(resolve => server.close(() => resolve())) }
})
