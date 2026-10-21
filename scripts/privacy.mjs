import { execFileSync } from 'node:child_process'
import { readdir, readFile, lstat } from 'node:fs/promises'
import path from 'node:path'
const root = process.cwd()
const problems = []
let files
try { files = execFileSync('git', ['ls-files','--cached','--others','--exclude-standard'], { encoding:'utf8' }).trim().split('\n').filter(Boolean) }
catch { console.error('Initialize the independent repository before scanning.'); process.exit(1) }
const forbidden = /(^|\/)(private|references|studyflow-reference|local-reports|screenshots|test-results|node_modules|dist)\/|legacy_planner\.html$|course_schedule\.json$|backup.*\.json$|备份.*\.json$|\.zip$|(^|\/)\.env(\.|$)/i
for (const f of files) {
  if (forbidden.test(f)) problems.push('Forbidden repository path: ' + f)
  if ((await lstat(path.join(root,f))).isSymbolicLink()) problems.push('Symlink is not publishable: ' + f)
}
async function walk(dir) {
  const result = []
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const f = path.join(dir,item.name)
    if (item.isSymbolicLink()) problems.push('Symlink in build output')
    else if (item.isDirectory()) result.push(...await walk(f)); else result.push(f)
  }
  return result
}
let built = []
try { built = await walk(path.join(root,'dist')) } catch { problems.push('Build output is missing') }
for (const f of built) if (/private|course_schedule|legacy_planner|backup|备份|\.map$/i.test(path.relative(path.join(root,'dist'),f))) problems.push('Sensitive build path: ' + path.relative(root,f))
const signatures = []
if (process.env.STUDYFLOW_COURSE_FILE) {
  const data = JSON.parse(await readFile(process.env.STUDYFLOW_COURSE_FILE, 'utf8'))
  if (data.semesterStart) signatures.push(data.semesterStart)
  signatures.push(...(data.uncertainNotes ?? []))
  for (const c of data.courses ?? []) if (c.note) signatures.push(c.note)
}
for (const f of [...files.map(f => path.join(root,f)), ...built]) {
  if (!/\.(tsx?|m?js|css|html|md|json|txt|yml|webmanifest)$/i.test(f)) continue
  const text = await readFile(f,'utf8')
  if (f.endsWith('.json')) {
    try {
      const data = JSON.parse(text)
      if (data.app === 'studyflow' || data.app === 'studyflow-legacy' || (data.schemaVersion && Array.isArray(data.courses))) problems.push('Personal data container in: ' + path.relative(root,f))
    } catch {}
  }
  if (/学号\s*[:：]\s*[0-9]{6,}|(?:student_?id|student_?number)\s*[=:]\s*["']?[0-9]{6,}/i.test(text)) problems.push('Possible student identifier: ' + path.relative(root,f))
  if (signatures.some(s => s && text.includes(s))) problems.push('Private schedule signature in: ' + path.relative(root,f))
}
if (problems.length) { console.error(problems.join('\n')); process.exit(1) }
console.log(`Privacy audit passed: ${files.length} repository files, ${built.length} build files; ${signatures.length} local private signatures checked. No personal dataset included.`)
