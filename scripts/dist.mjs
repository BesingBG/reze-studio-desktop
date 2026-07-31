import { spawn } from "node:child_process"
import { createRequire } from "node:module"
import { existsSync, rmSync, mkdirSync, cpSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const sub = join(root, "reze-studio")
const stagingServer = join(root, "dist-resources", "reze-studio")
const require = createRequire(import.meta.url)

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", shell: process.platform === "win32", ...opts })
    child.on("error", reject)
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} 退出码 ${code}`))))
  })
}

function copy(src, dest) {
  if (!existsSync(src)) return
  cpSync(src, dest, { recursive: true })
}

function copyEntries(srcDir, destDir, exclude = []) {
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    if (exclude.includes(entry.name)) continue
    cpSync(join(srcDir, entry.name), join(destDir, entry.name), { recursive: true })
  }
}

// 发行剥离:内置版权资源(models/animations)不在发行包内,引用集中在
// components/engine-bridge.tsx(MODEL_PATH / VMD_PATH / 错误横幅)。
// 必须用注入后的源码构建,否则 JS bundle 仍固化原版引用。
const strippedDirs = ["public/models", "public/animations"]

// 空场景兼容:模型/VMD 加载失败是软失败(engine-bridge 内 try/catch)。
// 注入把内置路径置空并关闭误导性错误横幅,打包版打开即为空编辑器,
// 用户从文件菜单导入自己的 PMX 模型。
function patchEngineBridge() {
  const filePath = join(stagingServer, "components", "engine-bridge.tsx")
  const src = readFileSync(filePath, "utf8")
  // Windows 下 clone 的文件是 CRLF 行尾,多行锚点统一归一化后匹配,写回时还原。
  const hasCrlf = src.includes("\r\n")
  const normalized = hasCrlf ? src.replace(/\r\n/g, "\n") : src
  const patches = [
    ['export const MODEL_PATH = "/models/塞尔凯特/塞尔凯特.pmx"', 'export const MODEL_PATH = ""'],
    ['export const VMD_PATH = "/animations/miku.vmd"', 'export const VMD_PATH = ""'],
    // 地面在模型加载 try 块内,模型加载失败(空场景)时会跳过导致地面/网格消失。
    // 移到 try/catch 之后无条件执行,同时抑制误导性错误横幅。
    [
      [
        '          engine.addGround({ diffuseColor: new Vec3(0.05, 0.04, 0.06) })',
        '        } catch {',
        '          setEngineError(`Add model at public${MODEL_PATH}`)',
        '        }',
      ].join("\n"),
      [
        '        } catch {',
        '          setEngineError(null)',
        '        }',
        '        engine.addGround({ diffuseColor: new Vec3(0.05, 0.04, 0.06) })',
      ].join("\n"),
    ],
  ]
  let out = normalized
  for (const [from, to] of patches) {
    if (!out.includes(from)) {
      throw new Error(`engine-bridge.tsx 未命中剥离锚点,需同步更新: ${from}`)
    }
    out = out.split(from).join(to)
  }
  if (hasCrlf) out = out.replace(/\n/g, "\r\n")
  writeFileSync(filePath, out)
  console.log("[dist] 注入空场景兼容补丁(engine-bridge.tsx)...")
}

function applyReleaseStrip() {
  console.log("[dist] 移除内置版权资源...")
  for (const dir of strippedDirs) {
    rmSync(join(stagingServer, dir), { recursive: true, force: true })
  }
  patchEngineBridge()
}

async function main() {
  const skipBuild = process.argv.includes("--skip-build")

  console.log("[dist] 准备 staging...")
  rmSync(stagingServer, { recursive: true, force: true })
  mkdirSync(stagingServer, { recursive: true })
  copyEntries(sub, stagingServer, ["node_modules", ".next", ".git", "screenshots"])
  applyReleaseStrip()

  if (skipBuild) {
    if (!existsSync(join(sub, ".next"))) {
      throw new Error("缺少 .next 构建产物,请先执行 npm run build")
    }
    console.warn(
      "[dist] 警告:--skip-build 直接复用既有 .next。若其由原版 engine-bridge 构建,发行包会缺少内置资源而无法加载模型,请改用完整构建。",
    )
    copy(join(sub, ".next"), join(stagingServer, ".next"))
  } else {
    console.log("[dist] 安装依赖(全量,含构建工具)...")
    await run("npm", ["ci"], { cwd: stagingServer })
    console.log("[dist] next build(使用剥离内置资源后的源码)...")
    await run("npm", ["run", "build"], { cwd: stagingServer })
  }

  console.log("[dist] 安装生产依赖(仅 dependencies)...")
  await run("npm", ["ci", "--omit=dev", "--no-audit", "--no-fund"], { cwd: stagingServer })

  console.log("[dist] electron-builder 打包...")
  const builderCli = require.resolve("electron-builder/out/cli/cli.js")
  const target = {
    win32: ["--win", "nsis"],
    darwin: ["--mac", "dmg"],
    linux: ["--linux", "AppImage"],
  }[process.platform] ?? []
  await run(process.execPath, [builderCli, ...target, "--publish", "never"], { cwd: root })

  console.log("[dist] 完成,安装包位于 dist/")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
