/**
 * 下载智能抠图模型到 public/diy/matting-models/（国内可避免 staticimgly.com 极慢）
 * 用法: pnpm setup:matting-models
 */
import { createWriteStream, existsSync, mkdirSync, rmSync, cpSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { execSync } from 'node:child_process'

const VERSION = '1.7.0'
const DOWNLOAD_URL = `https://staticimgly.com/@imgly/background-removal-data/${VERSION}/package.tgz`

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const outDir = path.join(rootDir, 'public', 'diy', 'matting-models')
const cacheDir = path.join(rootDir, '.cache')
const tmpTgz = path.join(cacheDir, 'matting-models-package.tgz')
const extractRoot = path.join(cacheDir, 'matting-models-extract')

const download = async (url, dest) => {
  await mkdir(path.dirname(dest), { recursive: true })
  const res = await fetch(url)
  if (!res.ok || !res.body) {
    throw new Error(`下载失败: ${res.status} ${res.statusText}`)
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest))
}

const main = async () => {
  if (existsSync(path.join(outDir, 'resources.json'))) {
    console.log(`已存在 ${outDir}，跳过。`)
    return
  }

  console.log(`下载抠图模型 ${VERSION} …`)
  console.log(DOWNLOAD_URL)
  await download(DOWNLOAD_URL, tmpTgz)

  rmSync(extractRoot, { recursive: true, force: true })
  mkdirSync(extractRoot, { recursive: true })
  execSync(`tar -xzf "${tmpTgz}" -C "${extractRoot}"`, { stdio: 'inherit' })

  const distDir = path.join(extractRoot, 'package', 'dist')
  if (!existsSync(path.join(distDir, 'resources.json'))) {
    throw new Error('解压后未找到 package/dist/resources.json')
  }

  rmSync(outDir, { recursive: true, force: true })
  cpSync(distDir, outDir, { recursive: true })
  console.log('完成: public/diy/matting-models/')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
