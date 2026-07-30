# 同步各 AI 工具 skill 入口 stub
#
# 用法：先维护 .skills/ 正文；.cursor/skills/ 的 stub 为模板。
#       修改 .cursor stub 后运行本脚本，同步到 .codex / .claude / .qoder / .agents

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

$Targets = @(
    @{ Dir = '.codex/skills'; Label = 'Codex' },
    @{ Dir = '.claude/skills'; Label = 'Claude Code' },
    @{ Dir = '.qoder/skills'; Label = 'Qoder' },
    @{ Dir = '.agents/skills'; Label = 'Agents' }
)

$Skills = @('ui-preferences', 'frontend-design', 'project-glossary', 'vue3-standards')

foreach ($target in $Targets) {
    foreach ($name in $Skills) {
        $src = Join-Path $Root ".cursor/skills/$name/SKILL.md"
        $destDir = Join-Path $Root ($target.Dir + '/' + $name)
        if (-not (Test-Path $src)) { continue }
        New-Item -ItemType Directory -Force -Path $destDir | Out-Null
        $text = [System.IO.File]::ReadAllText($src, [System.Text.UTF8Encoding]::new($false))
        $text = $text -replace 'Cursor', $target.Label
        [System.IO.File]::WriteAllText((Join-Path $destDir 'SKILL.md'), $text, [System.Text.UTF8Encoding]::new($false))
    }
    $licenseSrc = Join-Path $Root '.skills/frontend-design/LICENSE.txt'
    $licenseDest = Join-Path $Root ($target.Dir + '/frontend-design/LICENSE.txt')
    if (Test-Path $licenseSrc) {
        Copy-Item $licenseSrc $licenseDest -Force
    }
}

Write-Host 'Synced stubs from .cursor/skills to other agent folders.'
