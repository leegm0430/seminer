# TC xlsx -> HTML 변환 스크립트
# 사용법: powershell -ExecutionPolicy Bypass -File convert_tc_to_html.ps1
# TC 폴더 안의 모든 .xlsx를 같은 이름의 .html(다크 테마 표 뷰어)로 변환한다.
# xlsx를 수정한 뒤 이 스크립트를 다시 실행하면 HTML이 갱신된다.

$ErrorActionPreference = 'Stop'
$tcDir = Split-Path -Parent $MyInvocation.MyCommand.Path

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
        # 0~1 사이 소수는 엑셀 시간 값(하루의 비율)일 가능성이 높음 -> HH:mm
        if ($v -gt 0 -and $v -lt 1) {
            $mins = [math]::Round($v * 1440)
            if ($mins -gt 0 -and [math]::Abs($v * 1440 - $mins) -lt 0.02) {
                return ('{0:00}:{1:00}' -f [math]::Floor($mins / 60), ($mins % 60))
            }
        }
        if ($v -eq [math]::Floor($v) -and [math]::Abs($v) -lt 1e12) { return ([long]$v).ToString() }
        return $v.ToString('G10')
    }
    return [string]$v
}

function StatusClass([string]$t) {
    $x = $t.Trim().ToLower()
    if ($x -in @('pass','p','성공','ok','완료')) { return 'st-pass' }
    if ($x -in @('fail','f','실패','ng')) { return 'st-fail' }
    if ($x -in @('block','blocked','보류','n/a','na','skip','hold','미실행')) { return 'st-hold' }
    return ''
}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$files = Get-ChildItem -Path $tcDir -Filter *.xlsx | Where-Object { $_.Name -notlike '~$*' }

foreach ($file in $files) {
    Write-Host "=== $($file.Name)"
    # 이 파일들은 기대 결과 칸의 화면 구성이 왼쪽 정렬 기준으로 작성됨
    $wantLeftExpected = ($file.BaseName -match 'Weird Space|Return of the Dark Lord')
    $wb = $excel.Workbooks.Open($file.FullName, 0, $true)
    $sheetsHtml = New-Object System.Collections.Generic.List[string]
    $tabsHtml   = New-Object System.Collections.Generic.List[string]
    $si = 0

    foreach ($ws in $wb.Worksheets) {
        if ($ws.Visible -ne -1) { continue }  # 숨김 시트 제외
        $ur = $ws.UsedRange
        if ($null -eq $ur) { continue }
        try { $vals = $ur.Value(10) } catch { $vals = $ur.Value2 }
        if ($null -eq $vals) { continue }

        # 단일 셀이면 2차원 배열이 아님
        if ($vals -isnot [object[,]]) {
            $tmp = New-Object 'object[,]' 2,2
            $tmp[1,1] = $vals
            $vals = $tmp
        }
        $rMax = $vals.GetUpperBound(0); $cMax = $vals.GetUpperBound(1)

        # 실제 내용이 있는 마지막 행/열 계산
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

        # 헤더 행 추정 1: TC 헤더 키워드가 3개 이상 매칭되는 첫 행
        $hdrPatterns = @(
            '^no\.?$','^tc[ _]?no','^tc[ _]?id','priority','우선\s*순위',
            '^category','^분류','사전\s*조건','test\s*details','테스트\s*내용',
            '^절차$','expected','기대\s*결과','^comment','^비고','^결과$',
            '기능\s*/\s*ui','^기능$','^화면$','진입\s*방법','^사운드$','^애니메이션$'
        )
        $headerRow = 0
        for ($r = 1; $r -le [math]::Min($lastR, 20); $r++) {
            $score = 0
            for ($c = 1; $c -le $lastC; $c++) {
                $txt = (FormatCell $vals[$r,$c]).Trim()
                if ($txt -eq '' -or $txt.Length -gt 34) { continue }
                foreach ($pat in $hdrPatterns) {
                    if ($txt -imatch $pat) { $score++; break }
                }
            }
            if ($score -ge 3) { $headerRow = $r; break }
        }
        # 헤더 행 추정 2(폴백): 3개 이상 채워진 첫 행
        if ($headerRow -eq 0) {
            for ($r = 1; $r -le [math]::Min($lastR, 10); $r++) {
                $filled = 0
                for ($c = 1; $c -le $lastC; $c++) {
                    if ((FormatCell $vals[$r,$c]).Trim() -ne '') { $filled++ }
                }
                if ($filled -ge 3) { $headerRow = $r; break }
            }
        }

        # 헤더가 없는 시트(선정 이유, 개요 등)는 표 대신 텍스트 문서로 렌더링
        if ($headerRow -eq 0) {
            $sb = New-Object System.Text.StringBuilder
            [void]$sb.Append("<div class='sheet' id='sheet$si'><div class='doc'>")
            for ($r = 1; $r -le $lastR; $r++) {
                $cells = @()
                for ($c = 1; $c -le $lastC; $c++) {
                    $txt = (FormatCell $vals[$r,$c]).Trim()
                    if ($txt -ne '') { $cells += $txt }
                }
                if ($cells.Count -gt 0) { [void]$sb.Append("<p>$(Esc ($cells -join ' : '))</p>") }
            }
            [void]$sb.Append('</div></div>')
            $sheetsHtml.Add($sb.ToString())
            $tabsHtml.Add("<button class='tab' data-sheet='sheet$si'>$(Esc $ws.Name)</button>")
            Write-Host "    sheet '$($ws.Name)': ${lastR}행 (문서형)"
            $si++
            continue
        }

        # 2단 헤더 감지: 헤더 다음 행의 채워진 셀이 모두 헤더의 빈 칸 아래이거나
        # 병합 헤더 칸(오른쪽 칸이 빈 헤더) 아래에만 있으면 하위 헤더로 병합
        $headerRow2 = 0
        if ($headerRow -lt $lastR) {
            $r2 = $headerRow + 1; $ok = $true; $filled2 = 0
            for ($c = 1; $c -le $lastC; $c++) {
                $t2 = (FormatCell $vals[$r2,$c]).Trim()
                if ($t2 -eq '') { continue }
                $filled2++
                if ($t2.Length -gt 12) { $ok = $false; break }
                $hAbove = (FormatCell $vals[$headerRow,$c]).Trim()
                if ($hAbove -ne '') {
                    # 위 헤더 칸이 채워져 있으면, 병합 셀 시작(오른쪽 헤더 칸이 빈 경우)일 때만 허용
                    $hRight = if ($c -lt $lastC) { (FormatCell $vals[$headerRow,($c+1)]).Trim() } else { 'x' }
                    if ($hRight -ne '') { $ok = $false; break }
                }
            }
            if ($ok -and $filled2 -ge 1 -and $filled2 -le 6) { $headerRow2 = $r2 }
        }

        $sb = New-Object System.Text.StringBuilder
        [void]$sb.Append("<div class='sheet' id='sheet$si'>")

        # 헤더 이전 행(문서 제목·프로젝트 정보 등)은 표 위의 정보 블록으로 분리
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
            if ($metaLines.Count -gt 0) {
                [void]$sb.Append("<div class='meta'>$($metaLines -join '')</div>")
            }
        }

        # 셀 병합 정보 수집: 값이 있는 셀(병합 원점)의 MergeArea를 읽어 rowspan/colspan으로 변환
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

        # 기대 결과 열 찾기 (지정 파일만 엑셀의 셀별 정렬을 그대로 반영)
        $leftCols = @{}
        if ($wantLeftExpected) {
            foreach ($hr in @($headerRow, $headerRow2)) {
                if ($hr -le 0) { continue }
                for ($c = 1; $c -le $lastC; $c++) {
                    $h = (FormatCell $vals[$hr,$c]).Trim()
                    if ($h -imatch '기대\s*결과|expected') {
                        $w = if ($spanC[$hr,$c] -gt 1) { $spanC[$hr,$c] } else { 1 }
                        for ($cc = $c; $cc -lt ($c + $w); $cc++) { $leftCols[$cc] = $true }
                    }
                }
            }
        }

        # 기대 결과 열의 셀별 가로 정렬을 엑셀에서 읽음 (-4108 가운데 / -4152 오른쪽 / 그 외 왼쪽)
        $alignMap = @{}
        if ($leftCols.Count -gt 0) {
            $alCnt = 0; $acCnt = 0
            foreach ($c in @($leftCols.Keys)) {
                for ($r = $headerRow + 1; $r -le $lastR; $r++) {
                    if ($covered[$r,$c]) { continue }
                    if ((FormatCell $vals[$r,$c]).Trim() -eq '') { continue }
                    $ha = ($ws.Cells.Item(($rOff + $r - 1), ($cOff + $c - 1))).HorizontalAlignment
                    if ($ha -eq -4108) { $alignMap["$r,$c"] = 'ac'; $acCnt++ }
                    elseif ($ha -eq -4152) { $alignMap["$r,$c"] = 'ar' }
                    else { $alignMap["$r,$c"] = 'al'; $alCnt++ }
                }
            }
            Write-Host "      기대결과 정렬: 왼쪽 $alCnt / 가운데 $acCnt"
        }

        $lastHeadRow = if ($headerRow2 -gt 0) { $headerRow2 } else { $headerRow }
        $tblClass = if ($headerRow2 -gt 0) { " class='two-head'" } else { '' }
        [void]$sb.Append("<div class='tbl-scroll'><table$tblClass>")
        for ($r = $headerRow; $r -le $lastR; $r++) {
            $isHead = ($r -le $lastHeadRow)
            $rowCells = New-Object System.Text.StringBuilder
            $rowEmpty = $true
            for ($c = 1; $c -le $lastC; $c++) {
                # 병합 영역에 덮인 셀은 출력하지 않음 (원점 셀의 rowspan/colspan이 차지)
                if ($covered[$r,$c]) { $rowEmpty = $false; continue }
                $txt = (FormatCell $vals[$r,$c]).Trim()
                if ($txt -ne '') { $rowEmpty = $false }
                $tag = if ($isHead) { 'th' } else { 'td' }
                $cls = if (-not $isHead) { StatusClass $txt } else { '' }
                if (-not $isHead -and $leftCols[$c]) {
                    $a = $alignMap["$r,$c"]
                    if (-not $a) { $a = 'al' }
                    $cls = "$cls $a".Trim()
                }
                $attr = if ($cls) { " class='$cls'" } else { '' }
                if ($spanR[$r,$c] -gt 1) { $attr += " rowspan='$($spanR[$r,$c])'" }
                if ($spanC[$r,$c] -gt 1) { $attr += " colspan='$($spanC[$r,$c])'" }
                [void]$rowCells.Append("<$tag$attr>$(Esc $txt)</$tag>")
            }
            if ($rowEmpty) { continue }
            if ($isHead) {
                if ($r -eq $headerRow) { [void]$sb.Append('<thead>') }
                [void]$sb.Append("<tr>$($rowCells.ToString())</tr>")
                if ($r -eq $lastHeadRow) { [void]$sb.Append('</thead><tbody>') }
            }
            else { [void]$sb.Append("<tr>$($rowCells.ToString())</tr>") }
        }
        [void]$sb.Append('</tbody></table></div></div>')
        $sheetsHtml.Add($sb.ToString())
        $tabsHtml.Add("<button class='tab' data-sheet='sheet$si'>$(Esc $ws.Name)</button>")
        Write-Host "    sheet '$($ws.Name)': ${lastR}행 x ${lastC}열"
        $si++
    }

    $wb.Close($false)
    if ($sheetsHtml.Count -eq 0) { Write-Host '    (내용 없음, 건너뜀)'; continue }

    $title = Esc ([System.IO.Path]::GetFileNameWithoutExtension($file.Name))
    $xlsxName = Esc $file.Name
    $tabsBlock = if ($tabsHtml.Count -gt 1) { "<div class='tabs'>$($tabsHtml -join '')</div>" } else { '' }

    $html = @"
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>$title — TC</title>
<style>
:root { --bg:#0f172a; --card:#1e293b; --border:#2d3f55; --blue-lt:#60a5fa; --green-lt:#4ade80; --text:#f1f5f9; --text-2:#94a3b8; --text-3:#64748b; }
*,*::before,*::after { margin:0; padding:0; box-sizing:border-box; }
body { background:var(--bg); color:var(--text); font-family:'Apple SD Gothic Neo','Malgun Gothic','Segoe UI',sans-serif; font-size:14px; }
.top { position:sticky; top:0; background:rgba(15,23,42,0.97); border-bottom:1px solid var(--border); padding:0.9rem 1.5rem; display:flex; align-items:center; gap:1.25rem; flex-wrap:wrap; z-index:10; }
.top h1 { font-size:1rem; font-weight:700; margin-right:auto; }
.top a { color:var(--blue-lt); text-decoration:none; font-size:0.82rem; font-weight:600; }
.top a:hover { color:var(--green-lt); }
.wrap { padding:1.25rem 1.5rem 3rem; }
.tabs { display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:1rem; }
.tab { background:var(--card); color:var(--text-2); border:1px solid var(--border); border-radius:6px; padding:0.4rem 0.9rem; font-size:0.82rem; cursor:pointer; font-family:inherit; }
.tab.active { color:var(--text); border-color:var(--green-lt); }
.meta { background:var(--card); border:1px solid var(--border); border-left:3px solid var(--green-lt); border-radius:0 8px 8px 0; padding:0.8rem 1.1rem; margin-bottom:1rem; }
.meta p { font-size:0.8rem; color:var(--text-2); line-height:1.7; }
.meta p:first-child { color:var(--text); font-weight:700; }
.doc { background:var(--card); border:1px solid var(--border); border-radius:8px; padding:1.3rem 1.5rem; max-width:900px; }
.doc p { font-size:0.85rem; color:var(--text-2); line-height:1.8; margin-bottom:0.55rem; }
.doc p:first-child { color:var(--text); font-weight:700; font-size:0.95rem; }
table.two-head thead th { position:static; }
.sheet { display:none; }
.sheet.active { display:block; }
.tbl-scroll { overflow-x:auto; border:1px solid var(--border); border-radius:8px; }
table { border-collapse:collapse; width:100%; min-width:700px; }
th, td { border:1px solid var(--border); padding:0.45rem 0.7rem; text-align:center; vertical-align:middle; font-size:0.8rem; line-height:1.55; color:var(--text-2); white-space:pre-wrap; }
thead th { background:#162032; color:var(--text); font-weight:600; position:sticky; top:0; }
tbody tr:nth-child(even) { background:#131f33; }
tbody tr:hover { background:#1a2a44; }
td.al { text-align:left; white-space:pre; }
td.ac { text-align:center; white-space:pre; }
td.ar { text-align:right; white-space:pre; }
.st-pass { color:var(--green-lt); font-weight:700; }
.st-fail { color:#f87171; font-weight:700; }
.st-hold { color:#facc15; font-weight:600; }
</style>
</head>
<body>
<div class="top">
  <h1>$title</h1>
  <a href="../TC모음.html">← TC 모음으로</a>
  <a href="../index.html#tc">포트폴리오 홈</a>
  <a href="$xlsxName" download>⬇ 원본 엑셀 다운로드</a>
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
</script>
</body>
</html>
"@

    $outPath = Join-Path $tcDir ([System.IO.Path]::GetFileNameWithoutExtension($file.Name) + '.html')
    [System.IO.File]::WriteAllText($outPath, $html, [System.Text.Encoding]::UTF8)
    Write-Host "    -> $([System.IO.Path]::GetFileName($outPath))"
}

$excel.Quit()
[void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
Write-Host '완료.'
