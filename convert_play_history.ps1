# 게임플레이_이력.xlsx -> 게임플레이_이력.html 변환 (TC/convert_tc_to_html.ps1 로직 축약본)
$ErrorActionPreference = 'Stop'
$root = 'E:\leegm0430\01_포토폴리오'
$src  = Join-Path $root '게임플레이_이력.xlsx'
$out  = Join-Path $root '게임플레이_이력.html'

function Esc([string]$s) {
    if ($null -eq $s) { return '' }
    $s -replace '&','&amp;' -replace '<','&lt;' -replace '>','&gt;' -replace '"','&quot;'
}

function FormatCell($v) {
    if ($null -eq $v) { return '' }
    if ($v -is [datetime]) {
        if ($v.TimeOfDay -eq [timespan]::Zero) { return $v.ToString('yyyy-MM-dd') }
        return $v.ToString('yyyy-MM-dd HH:mm')
    }
    if ($v -is [double]) {
        if ($v -eq [math]::Floor($v) -and [math]::Abs($v) -lt 1e12) { return ([long]$v).ToString() }
        return $v.ToString('G10')
    }
    return [string]$v
}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open($src, 0, $true)

$sheetsHtml = New-Object System.Collections.Generic.List[string]
$tabsHtml   = New-Object System.Collections.Generic.List[string]
$si = 0

foreach ($ws in $wb.Worksheets) {
    if ($ws.Visible -ne -1) { continue }
    $ur = $ws.UsedRange
    if ($null -eq $ur) { continue }
    try { $vals = $ur.Value(10) } catch { $vals = $ur.Value2 }
    if ($null -eq $vals) { continue }
    if ($vals -isnot [object[,]]) { continue }

    $rMax = $vals.GetUpperBound(0); $cMax = $vals.GetUpperBound(1)
    $lastR = 0; $lastC = 0
    for ($r = 1; $r -le $rMax; $r++) {
        for ($c = 1; $c -le $cMax; $c++) {
            if ((FormatCell $vals[$r,$c]).Trim() -ne '') {
                if ($r -gt $lastR) { $lastR = $r }
                if ($c -gt $lastC) { $lastC = $c }
            }
        }
    }
    if ($lastR -eq 0) { continue }

    # 헤더 행: 'No.' / '게임 제목' 등이 3개 이상 매칭되는 첫 행
    $hdrPatterns = @('^no\.?$','게임\s*제목','^장르$','플레이\s*기간','플레이\s*내용','^플랫폼$')
    $headerRow = 0
    for ($r = 1; $r -le [math]::Min($lastR, 20); $r++) {
        $score = 0
        for ($c = 1; $c -le $lastC; $c++) {
            $txt = (FormatCell $vals[$r,$c]).Trim()
            if ($txt -eq '' -or $txt.Length -gt 34) { continue }
            foreach ($pat in $hdrPatterns) { if ($txt -imatch $pat) { $score++; break } }
        }
        if ($score -ge 3) { $headerRow = $r; break }
    }
    if ($headerRow -eq 0) {
        for ($r = 1; $r -le [math]::Min($lastR, 10); $r++) {
            $filled = 0
            for ($c = 1; $c -le $lastC; $c++) { if ((FormatCell $vals[$r,$c]).Trim() -ne '') { $filled++ } }
            if ($filled -ge 3) { $headerRow = $r; break }
        }
    }
    if ($headerRow -eq 0) { continue }

    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append("<div class='sheet' id='sheet$si'>")

    if ($headerRow -gt 1) {
        $metaLines = New-Object System.Collections.Generic.List[string]
        for ($r = 1; $r -lt $headerRow; $r++) {
            $cells = @()
            for ($c = 1; $c -le $lastC; $c++) {
                $txt = (FormatCell $vals[$r,$c]).Trim()
                if ($txt -ne '') { $cells += $txt }
            }
            if ($cells.Count -gt 0) { $metaLines.Add("<p>$(Esc ($cells -join ' : '))</p>") }
        }
        if ($metaLines.Count -gt 0) { [void]$sb.Append("<div class='meta'>$($metaLines -join '')</div>") }
    }

    # 병합 셀 -> rowspan/colspan
    $spanR = New-Object 'int[,]' ($lastR + 2), ($lastC + 2)
    $spanC = New-Object 'int[,]' ($lastR + 2), ($lastC + 2)
    $covered = New-Object 'bool[,]' ($lastR + 2), ($lastC + 2)
    $rOff = $ur.Row; $cOff = $ur.Column
    for ($r = 1; $r -le $lastR; $r++) {
        for ($c = 1; $c -le $lastC; $c++) {
            if ($covered[$r,$c]) { continue }
            if ((FormatCell $vals[$r,$c]).Trim() -eq '') { continue }
            $cell = $ws.Cells.Item(($rOff + $r - 1), ($cOff + $c - 1))
            if ($cell.MergeCells) {
                $ma = $cell.MergeArea
                $nr = [math]::Min($ma.Rows.Count, $lastR - $r + 1)
                $nc = [math]::Min($ma.Columns.Count, $lastC - $c + 1)
                if ($nr -gt 1 -or $nc -gt 1) {
                    $spanR[$r,$c] = $nr; $spanC[$r,$c] = $nc
                    for ($rr = $r; $rr -lt ($r + $nr); $rr++) {
                        for ($cc = $c; $cc -lt ($c + $nc); $cc++) {
                            if (-not ($rr -eq $r -and $cc -eq $c)) { $covered[$rr,$cc] = $true }
                        }
                    }
                }
            }
        }
    }

    [void]$sb.Append("<div class='tbl-scroll'><table>")
    for ($r = $headerRow; $r -le $lastR; $r++) {
        $isHead = ($r -eq $headerRow)
        $rowCells = New-Object System.Text.StringBuilder
        $rowEmpty = $true
        for ($c = 1; $c -le $lastC; $c++) {
            if ($covered[$r,$c]) { $rowEmpty = $false; continue }
            $txt = (FormatCell $vals[$r,$c]).Trim()
            if ($txt -ne '') { $rowEmpty = $false }
            $tag = if ($isHead) { 'th' } else { 'td' }
            $attr = ''
            if ($spanR[$r,$c] -gt 1) { $attr += " rowspan='$($spanR[$r,$c])'" }
            if ($spanC[$r,$c] -gt 1) { $attr += " colspan='$($spanC[$r,$c])'" }
            [void]$rowCells.Append("<$tag$attr>$(Esc $txt)</$tag>")
        }
        if ($rowEmpty) { continue }
        if ($isHead) { [void]$sb.Append("<thead><tr>$($rowCells.ToString())</tr></thead><tbody>") }
        else { [void]$sb.Append("<tr>$($rowCells.ToString())</tr>") }
    }
    [void]$sb.Append('</tbody></table></div></div>')
    $sheetsHtml.Add($sb.ToString())
    $tabsHtml.Add("<button class='tab' data-sheet='sheet$si'>$(Esc $ws.Name)</button>")
    Write-Host "sheet '$($ws.Name)': ${lastR}행 x ${lastC}열"
    $si++
}

$wb.Close($false)
$excel.Quit()
[void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel)

$tabsBlock = if ($tabsHtml.Count -gt 1) { "<div class='tabs'>$($tabsHtml -join '')</div>" } else { '' }

$html = @"
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>이경민 · 게임 플레이 이력</title>
<script>
(function(){try{var t=localStorage.getItem('portfolio-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();
</script>
<style>
:root {
  --bg:#0f172a; --card:#1e293b; --border:#2d3f55;
  --blue-lt:#60a5fa; --green-lt:#4ade80;
  --text:#f1f5f9; --text-2:#dbe3ec; --text-3:#94a3b8;
  --top-bg:#0f172a; --th-bg:#162032; --row-alt:#131f33; --row-hover:#1a2a44;
}
html[data-theme="light"] {
  --bg:#f6f8fb; --card:#ffffff; --border:#c3cedd;
  --blue-lt:#1d4ed8; --green-lt:#15803d;
  --text:#0f172a; --text-2:#1e293b; --text-3:#5b6b7f;
  --top-bg:#eef2f7; --th-bg:#dde5ef; --row-alt:#f0f4f9; --row-hover:#e2eaf5;
}
*,*::before,*::after { margin:0; padding:0; box-sizing:border-box; }
body { background:var(--bg); color:var(--text); font-family:'Apple SD Gothic Neo','Malgun Gothic','Segoe UI',sans-serif; font-size:14px; }
.top { position:sticky; top:0; background:var(--top-bg); border-bottom:1px solid var(--border); padding:0.9rem 1.5rem; display:flex; align-items:center; gap:1.25rem; flex-wrap:wrap; z-index:10; }
.top h1 { font-size:1rem; font-weight:700; margin-right:auto; }
.top a { color:var(--blue-lt); text-decoration:none; font-size:0.82rem; font-weight:600; }
.top a:hover { color:var(--green-lt); }
.theme-btn { background:var(--card); color:var(--text); border:1px solid var(--border); border-radius:6px; padding:0.35rem 0.85rem; font-size:0.8rem; font-weight:600; cursor:pointer; font-family:inherit; }
.theme-btn:hover { border-color:var(--green-lt); color:var(--green-lt); }
.wrap { padding:1.25rem 1.5rem 3rem; }
.tabs { display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:1rem; }
.tab { background:var(--card); color:var(--text-2); border:1px solid var(--border); border-radius:6px; padding:0.4rem 0.9rem; font-size:0.82rem; cursor:pointer; font-family:inherit; }
.tab.active { color:var(--text); border-color:var(--green-lt); }
.meta { background:var(--card); border:1px solid var(--border); border-left:3px solid var(--green-lt); border-radius:0 8px 8px 0; padding:0.8rem 1.1rem; margin-bottom:1rem; }
.meta p { font-size:0.8rem; color:var(--text-2); line-height:1.7; }
.meta p:first-child { color:var(--text); font-weight:700; }
.sheet { display:none; }
.sheet.active { display:block; }
.tbl-scroll { overflow-x:auto; border:1px solid var(--border); border-radius:8px; }
table { border-collapse:collapse; width:100%; min-width:700px; }
th, td { border:1px solid var(--border); padding:0.45rem 0.7rem; text-align:center; vertical-align:middle; font-size:0.8rem; line-height:1.55; color:var(--text-2); white-space:pre-wrap; }
thead th { background:var(--th-bg); color:var(--text); font-weight:600; position:sticky; top:0; }
tbody tr:nth-child(even) { background:var(--row-alt); }
tbody tr:hover { background:var(--row-hover); }
</style>
</head>
<body>
<div class="top">
  <h1>게임 플레이 이력</h1>
  <a href="index.html#games-played">← 포트폴리오 홈으로</a>
  <a href="게임플레이_이력.xlsx" download>⬇ 원본 엑셀 다운로드</a>
  <button id="theme-toggle" class="theme-btn" type="button">밝게</button>
</div>
<div class="wrap">
$tabsBlock
$($sheetsHtml -join "`n")
</div>
<script>
var tabs = document.querySelectorAll('.tab');
var sheets = document.querySelectorAll('.sheet');
function show(id) {
  sheets.forEach(function(s){ s.classList.toggle('active', s.id === id); });
  tabs.forEach(function(t){ t.classList.toggle('active', t.dataset.sheet === id); });
}
tabs.forEach(function(t){ t.addEventListener('click', function(){ show(t.dataset.sheet); }); });
if (sheets.length) { sheets[0].classList.add('active'); }
if (tabs.length) { tabs[0].classList.add('active'); }
(function () {
  var btn = document.getElementById('theme-toggle');
  if (!btn) { return; }
  var root = document.documentElement;
  function cur() { return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }
  function paint() { btn.textContent = cur() === 'light' ? '어둡게' : '밝게'; }
  paint();
  btn.addEventListener('click', function () {
    var next = cur() === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('portfolio-theme', next); } catch (e) {}
    paint();
  });
})();
</script>
</body>
</html>
"@

[System.IO.File]::WriteAllText($out, $html, [System.Text.Encoding]::UTF8)
Write-Host "-> $out"
