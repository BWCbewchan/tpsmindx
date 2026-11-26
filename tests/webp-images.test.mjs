import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import sharp from 'sharp'
function load(file, deps = {}) {
  const exports = {}
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2020}}).outputText
  vm.runInNewContext(js, {exports,Buffer,URL,URLSearchParams,require:n=>{assert.ok(n in deps, n);return deps[n]}})
  return exports
}
const {encodeWebpImage} = load('lib/webp-image.ts', {sharp})
const publicImages = load('lib/public-image-url.ts', {'./public-webp-images.json':JSON.parse(fs.readFileSync('lib/public-webp-images.json','utf8'))})
const {normalizeStorageUrl} = load('lib/storage-url.ts', {'./public-image-url':publicImages})
test('storage raster URLs request WebP while preserving bucket and object key',()=>{
  const url = new URL(normalizeStorageUrl('s3://mindx-avatars/honors-monthly/a b.png'),'http://localhost')
  assert.equal(url.searchParams.get('format'),'webp')
  assert.equal(url.searchParams.get('key'),'honors-monthly/a b.png')
  assert.equal(url.searchParams.get('bucket'),'mindx-avatars')
})
test('legacy raster proxy uses WebP without changing the protected object',()=>{
  const url = new URL(normalizeStorageUrl('/api/storage-image?bucket=mindx-teacher-portfolios&key=private.jpg&proxy=1'),'http://localhost')
  assert.equal(url.searchParams.get('format'),'webp')
  assert.equal(url.searchParams.get('key'),'private.jpg')
  assert.equal(url.searchParams.has('proxy'),false)
})
test('certificates, SVG, videos and external images keep original formats',()=>{
  for(const source of ['s3://mindx-teacher-certificates/cert.png','s3://mindx-videos/a.mp4','s3://mindx-avatars/logo.svg']) assert.equal(new URL(normalizeStorageUrl(source),'http://localhost').searchParams.has('format'),false)
  assert.equal(normalizeStorageUrl('https://example.com/a.jpg'),'https://example.com/a.jpg')
})
test('encoding returns genuine WebP with matching dimensions and transparency',async()=>{
  const png=await sharp({create:{width:9,height:7,channels:4,background:{r:255,g:0,b:0,alpha:.25}}}).png().toBuffer()
  const converted=await encodeWebpImage(png), meta=await sharp(converted).metadata()
  assert.equal(meta.format,'webp');assert.equal(meta.width,9);assert.equal(meta.height,7);assert.equal(meta.hasAlpha,true)
})
test('invalid image bytes reject so caller can fall back to original bytes',async()=>{await assert.rejects(()=>encodeWebpImage(Buffer.from('not an image')))})

test('known local assets switch to generated WebP; unknown assets and URL suffixes stay safe',()=>{
  assert.equal(normalizeStorageUrl('/images/default-post.png?v=2#img'),'/images/default-post.webp?v=2#img')
  assert.equal(normalizeStorageUrl('/mascot/custom-upload.png'),'/mascot/custom-upload.png')
})
