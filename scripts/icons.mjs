import sharp from 'sharp'
import { mkdir, readFile } from 'node:fs/promises'
await mkdir('public/icons', { recursive: true })
const svg = await readFile('public/icon.svg')
for (const [file, size] of [['icon-192',192], ['icon-512',512], ['apple-touch-icon',180], ['maskable-512',512]]) {
  await sharp(svg).resize(size, size).png().toFile(`public/icons/${file}.png`)
}
console.log('Generated four original application icons.')
