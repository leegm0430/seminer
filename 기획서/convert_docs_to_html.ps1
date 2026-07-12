# 기획서 md/pdf -> HTML 뷰어 변환 스크립트
# 사용법: powershell -ExecutionPolicy Bypass -File convert_docs_to_html.ps1
# 아래 목록의 md는 내장 마크다운 렌더러 HTML로, pdf는 임베드 뷰어 HTML로 변환한다.
# 원본을 수정한 뒤 다시 실행하면 HTML이 갱신된다.

$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path

$mdFiles = @(
    'challengers_s4_analysis.md',
    'challengers_tier_system_reverse_design.md',
    'item_burning_plus_reverse_design.md',
    '아이작-역기획서.md'
)
$pdfFiles = @(
    'Steam 플랫폼 분석.pdf',
    '운빨존많겜 재미분석작성자_이경민.pdf',
    '캡스톤 디자인 (Return of the Dark Lord) 최종 기획서.pdf'
)

# ── MD 뷰어 템플릿 ─────────────────────────────────────────────
$mdTemplate = @'
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>%%TITLE%%</title>
<style>
:root { --bg:#0f172a; --card:#1e293b; --border:#2d3f55; --blue-lt:#60a5fa; --green:#16a34a; --green-lt:#4ade80; --text:#f1f5f9; --text-2:#94a3b8; --text-3:#64748b; }
*,*::before,*::after { margin:0; padding:0; box-sizing:border-box; }
body { background:var(--bg); color:var(--text); font-family:'Apple SD Gothic Neo','Malgun Gothic','Segoe UI',sans-serif; font-size:15px; line-height:1.75; }
.top { position:sticky; top:0; background:rgba(15,23,42,0.97); border-bottom:1px solid var(--border); padding:0.9rem 1.5rem; display:flex; align-items:center; gap:1.25rem; flex-wrap:wrap; z-index:10; }
.top h1 { font-size:1rem; font-weight:700; margin-right:auto; }
.top a { color:var(--blue-lt); text-decoration:none; font-size:0.82rem; font-weight:600; }
.top a:hover { color:var(--green-lt); }
.wrap { max-width:920px; margin:0 auto; padding:2rem 1.5rem 4rem; }
#content h1 { font-size:1.55rem; font-weight:700; line-height:1.35; margin:1.8rem 0 1rem; padding-bottom:0.6rem; border-bottom:1px solid var(--border); }
#content h1:first-child { margin-top:0; }
#content h2 { font-size:1.25rem; font-weight:700; margin:2rem 0 0.8rem; padding-left:0.75rem; border-left:3px solid var(--green); }
#content h3 { font-size:1.05rem; font-weight:700; margin:1.5rem 0 0.6rem; color:var(--green-lt); }
#content h4, #content h5, #content h6 { font-size:0.95rem; font-weight:700; margin:1.2rem 0 0.5rem; }
#content p { color:var(--text-2); font-size:0.9rem; margin:0.6rem 0; }
#content strong { color:var(--text); }
#content ul, #content ol { margin:0.6rem 0 0.6rem 1.5rem; color:var(--text-2); font-size:0.9rem; }
#content li { margin:0.25rem 0; }
#content blockquote { background:var(--card); border-left:3px solid var(--green-lt); border-radius:0 6px 6px 0; padding:0.8rem 1.1rem; margin:0.9rem 0; color:var(--text-2); font-size:0.88rem; }
#content code { background:#0a121e; border:1px solid var(--border); border-radius:4px; padding:0.08rem 0.4rem; font-size:0.82rem; color:#93c5fd; font-family:Consolas,'Courier New',monospace; }
#content pre { background:#0a121e; border:1px solid var(--border); border-radius:8px; padding:0.9rem 1.1rem; margin:0.9rem 0; overflow-x:auto; font-size:0.8rem; line-height:1.6; color:var(--text-2); font-family:Consolas,'Courier New',monospace; }
#content pre code { background:none; border:none; padding:0; color:inherit; }
#content .tbl-scroll { overflow-x:auto; margin:0.9rem 0; border:1px solid var(--border); border-radius:8px; }
#content table { border-collapse:collapse; width:100%; }
#content th, #content td { border:1px solid var(--border); padding:0.45rem 0.75rem; font-size:0.83rem; color:var(--text-2); text-align:left; vertical-align:top; }
#content thead th { background:#162032; color:var(--text); font-weight:600; }
#content tbody tr:nth-child(even) { background:#131f33; }
#content hr { border:none; height:1px; background:var(--border); margin:1.6rem 0; }
#content del { color:var(--text-3); }
</style>
</head>
<body>
<div class="top">
  <h1>%%TITLE%%</h1>
  <a href="../기획서모음.html">← 기획서 모음으로</a>
  <a href="../index.html">포트폴리오 홈</a>
  <a href="%%SRC%%" download>⬇ 원본 다운로드</a>
</div>
<div class="wrap"><div id="content"></div></div>
<pre id="md-src" style="display:none">%%MD%%</pre>
<script>
(function () {
  var esc = function (s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  var inline = function (s) {
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, function (m, a) { return '<code>' + a + '</code>'; });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*(?!\*)/g, '$1<em>$2</em>');
    s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    return s;
  };
  var md = document.getElementById('md-src').textContent;
  var lines = md.replace(/\r\n/g, '\n').split('\n');
  var out = [];
  var para = [];
  var flushPara = function () {
    if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; }
  };
  var i = 0;
  while (i < lines.length) {
    var line = lines[i];

    // 코드 펜스
    if (/^\s*```/.test(line)) {
      flushPara();
      var code = []; i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) { code.push(lines[i]); i++; }
      i++;
      out.push('<pre><code>' + esc(code.join('\n')) + '</code></pre>');
      continue;
    }
    // 수평선
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { flushPara(); out.push('<hr>'); i++; continue; }
    // 제목
    var h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { flushPara(); var lv = h[1].length; out.push('<h' + lv + '>' + inline(h[2]) + '</h' + lv + '>'); i++; continue; }
    // 인용
    if (/^\s*>/.test(line)) {
      flushPara();
      var q = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) { q.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
      out.push('<blockquote>' + q.map(inline).join('<br>') + '</blockquote>');
      continue;
    }
    // 표
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].indexOf('-') >= 0) {
      flushPara();
      var rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(lines[i]); i++; }
      var cells = function (r) {
        return r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) { return c.trim(); });
      };
      var html = '<div class="tbl-scroll"><table><thead><tr>';
      cells(rows[0]).forEach(function (c) { html += '<th>' + inline(c) + '</th>'; });
      html += '</tr></thead><tbody>';
      for (var r = 2; r < rows.length; r++) {
        html += '<tr>';
        cells(rows[r]).forEach(function (c) { html += '<td>' + inline(c) + '</td>'; });
        html += '</tr>';
      }
      html += '</tbody></table></div>';
      out.push(html);
      continue;
    }
    // 목록 (들여쓰기 중첩 지원)
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      flushPara();
      var stack = [];
      var openList = function (ordered, indent) {
        out.push(ordered ? '<ol>' : '<ul>');
        stack.push({ ordered: ordered, indent: indent });
      };
      var closeList = function () { out.push(stack.pop().ordered ? '</ol>' : '</ul>'); };
      while (i < lines.length) {
        var m = lines[i].match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
        if (!m) { break; }
        var indent = m[1].replace(/\t/g, '  ').length;
        var ordered = /\d/.test(m[2]);
        if (!stack.length || indent > stack[stack.length - 1].indent + 1) { openList(ordered, indent); }
        else {
          while (stack.length > 1 && indent < stack[stack.length - 1].indent) { closeList(); }
        }
        out.push('<li>' + inline(m[3]) + '</li>');
        i++;
      }
      while (stack.length) { closeList(); }
      continue;
    }
    // 빈 줄
    if (/^\s*$/.test(line)) { flushPara(); i++; continue; }
    // 일반 문단
    para.push(line);
    i++;
  }
  flushPara();
  document.getElementById('content').innerHTML = out.join('\n');
})();
</script>
</body>
</html>
'@

# ── PDF 뷰어 템플릿 ────────────────────────────────────────────
$pdfTemplate = @'
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>%%TITLE%%</title>
<style>
:root { --bg:#0f172a; --border:#2d3f55; --blue-lt:#60a5fa; --green-lt:#4ade80; --text:#f1f5f9; --text-2:#94a3b8; }
*,*::before,*::after { margin:0; padding:0; box-sizing:border-box; }
body { background:var(--bg); color:var(--text); font-family:'Apple SD Gothic Neo','Malgun Gothic','Segoe UI',sans-serif; }
.top { background:rgba(15,23,42,0.97); border-bottom:1px solid var(--border); padding:0.9rem 1.5rem; display:flex; align-items:center; gap:1.25rem; flex-wrap:wrap; }
.top h1 { font-size:1rem; font-weight:700; margin-right:auto; }
.top a { color:var(--blue-lt); text-decoration:none; font-size:0.82rem; font-weight:600; }
.top a:hover { color:var(--green-lt); }
embed { width:100%; height:calc(100vh - 57px); display:block; }
.fallback { padding:3rem 1.5rem; text-align:center; color:var(--text-2); font-size:0.9rem; }
.fallback a { color:var(--blue-lt); font-weight:600; }
</style>
</head>
<body>
<div class="top">
  <h1>%%TITLE%%</h1>
  <a href="../기획서모음.html">← 기획서 모음으로</a>
  <a href="../index.html">포트폴리오 홈</a>
  <a href="%%SRC%%" download>⬇ PDF 다운로드</a>
</div>
<embed src="%%SRC%%" type="application/pdf">
<p class="fallback">PDF가 표시되지 않으면 <a href="%%SRC%%" download>여기서 다운로드</a>하세요.</p>
</body>
</html>
'@

foreach ($name in $mdFiles) {
    $path = Join-Path $dir $name
    if (-not (Test-Path $path)) { Write-Host "없음: $name"; continue }
    $raw = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
    $escaped = $raw.Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;')
    $base = [System.IO.Path]::GetFileNameWithoutExtension($name)
    # 문서 첫 h1을 제목으로 사용, 없으면 파일명
    $title = $base
    $m = [regex]::Match($raw, '(?m)^#\s+(.+)$')
    if ($m.Success) { $title = $m.Groups[1].Value.Trim() }
    $html = $mdTemplate.Replace('%%TITLE%%', $title).Replace('%%SRC%%', $name).Replace('%%MD%%', $escaped)
    $outPath = Join-Path $dir ($base + '.html')
    [System.IO.File]::WriteAllText($outPath, $html, [System.Text.Encoding]::UTF8)
    Write-Host "MD  -> $base.html ('$title')"
}

foreach ($name in $pdfFiles) {
    $path = Join-Path $dir $name
    if (-not (Test-Path $path)) { Write-Host "없음: $name"; continue }
    $base = [System.IO.Path]::GetFileNameWithoutExtension($name)
    $html = $pdfTemplate.Replace('%%TITLE%%', $base).Replace('%%SRC%%', $name)
    $outPath = Join-Path $dir ($base + '.html')
    [System.IO.File]::WriteAllText($outPath, $html, [System.Text.Encoding]::UTF8)
    Write-Host "PDF -> $base.html"
}

Write-Host '완료.'
