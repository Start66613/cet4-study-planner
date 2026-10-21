import { readFile, writeFile } from 'node:fs/promises'
const packages = ['react','react-dom','scheduler','lucide-react','workbox-window','workbox-core','workbox-routing','workbox-precaching','workbox-strategies','workbox-expiration','workbox-cacheable-response','workbox-range-requests']
const notices = ['StudyFlow third-party notices\nOriginal UI, icon and application code by StudyFlow contributors.\nNo reference-app artwork or GPL/AGPL application source is included.\n']
for (const name of packages) {
  const pkg = JSON.parse(await readFile(`node_modules/${name}/package.json`,'utf8'))
  let license
  for (const file of ['LICENSE','LICENSE.txt','LICENSE.md']) { try { license = await readFile(`node_modules/${name}/${file}`, 'utf8'); break } catch {} }
  if (!license) throw new Error(`Missing license: ${name}`)
  notices.push(`\n${name} ${pkg.version} (${pkg.license})\n${license}`)
}
await writeFile('public/THIRD_PARTY_NOTICES.txt', notices.join('\n'), 'utf8')
console.log('Bundled dependency licenses written.')
