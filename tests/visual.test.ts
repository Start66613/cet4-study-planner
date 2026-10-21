import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
it('key light and dark text palettes meet 4.5:1 contrast', () => {
  const css = readFileSync('src/style.css','utf8')
  const luminance = (hex: string) => {
    const a = hex.match(/\w\w/g)!.map(x => parseInt(x,16)/255).map(x => x <= .04045 ? x/12.92 : ((x+.055)/1.055)**2.4)
    return a[0]*.2126 + a[1]*.7152 + a[2]*.0722
  }
  for (const block of [css.split(':root[data-theme="dark"]')[0], css.split(':root[data-theme="dark"]')[1].split('}')[0]]) {
    const color = (name: string) => block.match(new RegExp(`--${name}: #([0-9a-f]{6})`))![1]
    for (const [fg,bg] of [['ink','bg'],['muted','bg'],['muted','surface'],['sage','bg'],['blue-ink','blue'],['mint-ink','mint'],['lilac-ink','lilac'],['peach-ink','peach']]) {
      const [a,b] = [luminance(color(fg)),luminance(color(bg))]
      expect((Math.max(a,b)+.05)/(Math.min(a,b)+.05), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5)
    }
  }
})
