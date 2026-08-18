# 문서 렌더 — 만든 파일을 실제로 "보고" 검수하기 위한 도구.
# PPTX -> 슬라이드별 PNG / DOCX·XLSX -> PDF 로 뽑아 눈으로 디자인을 확인한다.
# 사용: powershell -File render.ps1 -Path <문서경로> [-OutDir <폴더>]
param(
  [Parameter(Mandatory=$true)][string]$Path,
  [string]$OutDir,
  [int]$Width = 1600,      # pptx 슬라이드 PNG 해상도 (썸네일이 필요하면 640 등으로 낮춘다)
  [int]$Height = 900
)

$ErrorActionPreference = 'Stop'
$full = (Resolve-Path $Path).Path
$ext  = [IO.Path]::GetExtension($full).ToLower()
$name = [IO.Path]::GetFileNameWithoutExtension($full)
if (-not $OutDir) { $OutDir = Join-Path ([IO.Path]::GetDirectoryName($full)) '_preview' }
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Force $OutDir | Out-Null }
$OutDir = (Resolve-Path $OutDir).Path

function Release($o) { if ($o) { try { [Runtime.InteropServices.Marshal]::ReleaseComObject($o) | Out-Null } catch {} } }

if ($ext -eq '.pptx') {
  $app = New-Object -ComObject PowerPoint.Application
  try {
    # msoTrue=-1 : ReadOnly / Untitled / WithWindow(PowerPoint 는 창 숨김 시 Export 가 실패해 창을 띄운다)
    $pres = $app.Presentations.Open($full, -1, -1, -1)
    $i = 1
    foreach ($slide in $pres.Slides) {
      $png = Join-Path $OutDir ("{0}-{1:d2}.png" -f $name, $i)
      $slide.Export($png, 'PNG', $Width, $Height)
      Write-Output $png
      $i++
    }
    $pres.Close(); Release $pres
  } finally { $app.Quit(); Release $app }
}
elseif ($ext -eq '.docx') {
  $app = New-Object -ComObject Word.Application
  $app.Visible = $false
  $app.DisplayAlerts = 0          # wdAlertsNone — 대화상자가 뜨면 창이 숨겨진 채로 영원히 멈춘다
  $app.AutomationSecurity = 3     # msoAutomationSecurityForceDisable — 매크로 확인창 차단
  try {
    # ConfirmConversions=$false, ReadOnly=$true, AddToRecentFiles=$false, Visible=$false
    $doc = $app.Documents.Open($full, $false, $true, $false, [Type]::Missing, [Type]::Missing,
      [Type]::Missing, [Type]::Missing, [Type]::Missing, [Type]::Missing, [Type]::Missing, $false)
    $pdf = Join-Path $OutDir ("$name.pdf")
    $doc.ExportAsFixedFormat($pdf, 17)                 # wdExportFormatPDF
    Write-Output $pdf
    $doc.Close(0); Release $doc
  } finally { $app.Quit(0); Release $app }
}
elseif ($ext -eq '.xlsx') {
  $app = New-Object -ComObject Excel.Application
  $app.Visible = $false
  $app.DisplayAlerts = $false
  try {
    $wb  = $app.Workbooks.Open($full, 0, $true)        # UpdateLinks=0, ReadOnly=true
    $pdf = Join-Path $OutDir ("$name.pdf")
    $wb.ExportAsFixedFormat(0, $pdf)                   # xlTypePDF
    Write-Output $pdf
    $wb.Close($false); Release $wb
  } finally { $app.Quit(); Release $app }
}
else { throw "지원하지 않는 형식: $ext (pptx / docx / xlsx 만 가능)" }
