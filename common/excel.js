/**
 * excel.js — 통합 Excel 모듈
 * rcntiger.github.io/common/excel.js
 *
 * 기능:
 *  [읽기]
 *   - SheetJS 동적 로드 (CDN 자동)
 *   - xlsx / xls / csv / ods / tsv / html 지원
 *   - 시트 선택, 헤더 행 선택 (1~5행)
 *   - 병합 셀 Forward fill
 *   - 컬럼 키워드 자동 매핑
 *
 *  [UI]
 *   - 모달 (시트선택, 헤더행, 미리보기, 컬럼클릭 지정)
 *   - CSS 변수 기반 테마 (앱에서 --excel-* 변수로 제어)
 *
 *  [쓰기]
 *   - 다중 시트 xlsx/csv/ods 내보내기
 *   - 컬럼 너비 자동 조정
 *
 * ─────────────────────────────────────────────
 * 테마 커스터마이징 (앱 CSS):
 *   :root {
 *     --excel-bg:  #ffffff; --excel-sur: #f9fafb;
 *     --excel-tx:  #1a2233; --excel-mt:  #6b7280;
 *     --excel-bd:  #d1d5db; --excel-ac:  #2563eb;
 *   }
 *
 * 사용법 (UI 있음):
 *   const reader = ExcelUtil.createReader({
 *     columns: [
 *       { id:'addr', label:'주소', required:true,  keywords:['주소','소재지'] },
 *       { id:'team', label:'팀',   required:false, keywords:['팀','구역'] },
 *     ],
 *     onConfirm: (headers, rows, mapping) => {
 *       // mapping = { addr: 2, team: 5 }  (컬럼 인덱스)
 *       // rows    = 2D 배열 (forward fill 적용)
 *     }
 *   })
 *   reader.open(file)   // 또는 reader.show()
 *
 * 사용법 (UI 없음):
 *   await ExcelUtil.loadSheetJS()
 *   const rows = await ExcelUtil.readFile(file, { forwardFill:true, headerRow:1 })
 *
 * 사용법 (내보내기):
 *   ExcelUtil.download([
 *     { name:'전체', rows:data, headers:['col1'], colNames:{col1:'이름'} }
 *   ], '결과.xlsx')
 */

const ExcelUtil = (() => {
  'use strict'

  const log = window.Logger || { debug:console.log, info:console.info, warn:console.warn, error:console.error }

  // ────────────────────────────────────────────
  // SheetJS 동적 로드
  // ────────────────────────────────────────────

  const SHEETJS_CDN = 'https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js'
  let _sheetjsLoading = null

  /**
   * SheetJS 동적 로드 (없으면 CDN에서 자동)
   * @returns {Promise<void>}
   * @example await ExcelUtil.loadSheetJS()
   */
  function loadSheetJS() {
    if (window.XLSX) return Promise.resolve()
    if (_sheetjsLoading) return _sheetjsLoading
    _sheetjsLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src     = SHEETJS_CDN
      s.onload  = () => { log.debug('[ExcelUtil] SheetJS 로드 완료'); resolve() }
      s.onerror = () => reject(new Error('[ExcelUtil] SheetJS 로드 실패. 네트워크를 확인하세요.'))
      document.head.appendChild(s)
    })
    return _sheetjsLoading
  }

  function _xlsx() {
    if (!window.XLSX) throw new Error('[ExcelUtil] loadSheetJS()를 먼저 호출하세요.')
    return window.XLSX
  }

  /** 지원 파일 형식 (input accept 속성용) */
  const ACCEPT = '.xlsx,.xls,.csv,.ods,.tsv,.html,.htm'

  // ────────────────────────────────────────────
  // 병합 셀 Forward fill
  // ────────────────────────────────────────────

  /**
   * 2D 배열에서 빈 셀을 왼쪽 값으로 채움 (병합 셀 처리)
   * @param {Array[]} rows
   * @returns {Array[]}
   * @example
   *   ExcelUtil.forwardFill([['A','','B'],['','C','']])
   *   // → [['A','A','B'],['A','C','C']]
   */
  function forwardFill(rows) {
    const last = []
    return rows.map(row => row.map((cell, i) => {
      const v = String(cell ?? '').trim()
      if (v) { last[i] = v; return v }
      return last[i] || ''
    }))
  }

  // ────────────────────────────────────────────
  // 읽기 (UI 없음)
  // ────────────────────────────────────────────

  /**
   * File → 객체 배열 (headerRow >= 0) 또는 2D 배열 (headerRow = -1)
   * @param {File}   file
   * @param {object} options
   *   sheetIndex  : 시트 번호 0-based (기본 0)
   *   sheetName   : 시트 이름 (sheetIndex보다 우선)
   *   headerRow   : 헤더 행 0-based (기본 0). -1이면 2D 배열 반환
   *   colMap      : 컬럼 리매핑 { '원본헤더': '새헤더' }
   *   forwardFill : 병합 셀 처리 (기본 false)
   *   raw         : true면 날짜/숫자 원본 유지 (기본 false)
   * @returns {Promise<Array>}
   * @example
   *   const rows = await ExcelUtil.readFile(file, {
   *     headerRow: 1, forwardFill: true,
   *     colMap: { '건물명': 'name', '주소': 'addr' }
   *   })
   */
  async function readFile(file, options = {}) {
    await loadSheetJS()
    const buffer = await file.arrayBuffer()
    const wb     = _xlsx().read(buffer, { type:'array', cellDates:true })

    const ws = options.sheetName
      ? wb.Sheets[options.sheetName]
      : wb.Sheets[wb.SheetNames[options.sheetIndex ?? 0]]
    if (!ws) throw new Error('[ExcelUtil] 시트를 찾을 수 없습니다.')

    const { headerRow = 0, colMap, raw = false } = options

    let raw2d = _xlsx().utils.sheet_to_json(ws, { header:1, defval:'', raw })
    if (options.forwardFill) raw2d = forwardFill(raw2d)

    // 2D 배열 반환
    if (headerRow < 0) return raw2d

    const headers  = (raw2d[headerRow] || []).map(h => String(h).trim())
    const dataRows = raw2d.slice(headerRow + 1).filter(r => r.some(c => String(c).trim()))

    let rows = dataRows.map(row => {
      const obj = {}
      headers.forEach((h, i) => { obj[h] = row[i] ?? '' })
      return obj
    })

    if (colMap) {
      rows = rows.map(row => {
        const mapped = {}
        Object.entries(row).forEach(([k, v]) => { mapped[colMap[k] ?? k] = v })
        return mapped
      })
    }

    log.debug(`[ExcelUtil] readFile 완료 → ${rows.length}행 ${headers.length}컬럼`)
    return rows
  }

  /**
   * 파일의 시트 이름 목록 반환
   * @param {File} file
   * @returns {Promise<string[]>}
   */
  async function getSheetNames(file) {
    await loadSheetJS()
    const buffer = await file.arrayBuffer()
    return _xlsx().read(buffer, { type:'array' }).SheetNames
  }

  // ────────────────────────────────────────────
  // CSS 변수 기반 테마 (앱에서 --excel-* 로 제어)
  // ────────────────────────────────────────────

  const T = {
    bg:   'var(--excel-bg,   #ffffff)',
    sur:  'var(--excel-sur,  #f9fafb)',
    sur2: 'var(--excel-sur2, #f0f4f8)',
    tx:   'var(--excel-tx,   #1a2233)',
    mt:   'var(--excel-mt,   #6b7280)',
    bd:   'var(--excel-bd,   #d1d5db)',
    bd2:  'var(--excel-bd2,  #e5e7eb)',
    ac:   'var(--excel-ac,   #2563eb)',
    r:    'var(--excel-r,    8px)',
  }

  const PALETTE = [
    'rgba(37,99,235,.15)', 'rgba(22,163,74,.15)',
    'rgba(234,88,12,.15)', 'rgba(124,58,237,.15)',
    'rgba(220,38,38,.15)',
  ]

  function _esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }
  function _el(tag, css, text) {
    const e = document.createElement(tag)
    if (css)              e.style.cssText = css
    if (text !== undefined) e.textContent = text
    return e
  }

  // ────────────────────────────────────────────
  // UI 모달 (createReader)
  // ────────────────────────────────────────────

  /**
   * UI 모달 리더 생성
   * @param {object} opts
   *   columns         : [{ id, label, required, keywords }]
   *   onConfirm       : fn(headers, rows2d, mapping)
   *                     mapping = { colId: colIndex | null }
   *   defaultHeaderRow: 0-based (기본 0 = 1행)
   *   confirmLabel    : 버튼 텍스트 (기본 '확인')
   *   forwardFill     : 병합 셀 처리 (기본 true)
   * @returns { show, hide, open, getRows, getHeaders }
   * @example
   *   const reader = ExcelUtil.createReader({
   *     columns: [
   *       { id:'addr', label:'주소', required:true,  keywords:['주소','소재지','도로명'] },
   *       { id:'name', label:'건물명',required:false, keywords:['건물','명칭','대상'] },
   *       { id:'team', label:'팀',   required:false, keywords:['팀','구역','담당'] },
   *     ],
   *     onConfirm: (headers, rows, mapping) => {
   *       rows.forEach(r => console.log(r[mapping.addr]))
   *     }
   *   })
   *   // 파일 input에 연결
   *   fileInput.onchange = e => reader.open(e.target.files[0])
   */
  function createReader(opts = {}) {
    const columns      = opts.columns || []
    const onConfirm    = opts.onConfirm || (() => {})
    const defHdrRow    = opts.defaultHeaderRow ?? 0
    const confirmLabel = opts.confirmLabel || '확인'
    const doFill       = opts.forwardFill !== false

    let _wb = null, _headers = [], _rows2d = [], _sheetIdx = 0, _headerRow = defHdrRow

    // ── DOM 생성 ──
    const overlay = _el('div', `position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9900;display:none;align-items:center;justify-content:center`)
    const modal   = _el('div', `background:${T.bg};border:1px solid ${T.bd};border-radius:14px;padding:22px;width:min(700px,96vw);max-height:92vh;overflow-y:auto;position:relative;box-shadow:0 8px 32px rgba(0,0,0,.15)`)
    overlay.appendChild(modal)
    document.body.appendChild(overlay)

    const btnClose = _el('button', `position:absolute;top:12px;right:14px;background:none;border:none;color:${T.mt};font-size:22px;cursor:pointer`, '✕')
    btnClose.onclick = () => hide()
    modal.appendChild(btnClose)
    modal.appendChild(_el('h3', `margin:0 0 16px;font-size:15px;font-weight:700;color:${T.tx}`, '📊 Excel 업로드'))

    // ── Step 1: 파일 선택 ──
    const step1    = _el('div', '')
    const dropzone = _el('div', `border:2px dashed ${T.bd};border-radius:${T.r};padding:36px;text-align:center;cursor:pointer;transition:all .2s`)
    dropzone.innerHTML = `
      <div style="font-size:36px;margin-bottom:10px">📊</div>
      <div style="font-size:14px;color:${T.mt}">클릭하거나 파일을 드래그하세요</div>
      <div style="font-size:11px;color:${T.mt};margin-top:6px">xlsx · xls · csv · ods · tsv 지원</div>
      <div style="font-size:11px;color:#f59e0b;margin-top:4px">※ 암호화된 파일은 해제 후 업로드하세요</div>`
    dropzone.onmouseenter = () => { dropzone.style.borderColor = T.ac; dropzone.style.background = T.sur }
    dropzone.onmouseleave = () => { dropzone.style.borderColor = T.bd; dropzone.style.background  = '' }
    dropzone.addEventListener('dragover',  e => { e.preventDefault(); dropzone.style.borderColor = T.ac })
    dropzone.addEventListener('dragleave', () => { dropzone.style.borderColor = T.bd })
    dropzone.addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer.files[0]) _loadFile(e.dataTransfer.files[0]) })

    const fileInput = _el('input', 'display:none')
    fileInput.type = 'file'; fileInput.accept = ACCEPT
    fileInput.onchange = e => { if (e.target.files[0]) _loadFile(e.target.files[0]) }
    dropzone.onclick = () => fileInput.click()
    step1.append(dropzone, fileInput)
    modal.appendChild(step1)

    // ── Step 2: 컬럼 매핑 ──
    const step2    = _el('div', 'display:none')
    const topBar   = _el('div', 'display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap')
    const fileInfo = _el('div', `font-size:12px;color:${T.mt};flex:1`, '')

    const selSheet = _el('select', `padding:5px 8px;font-size:12px;background:${T.sur};border:1px solid ${T.bd};color:${T.tx};border-radius:6px`)
    selSheet.onchange = () => { _sheetIdx = +selSheet.value; _parseSheet() }

    const selHdr = _el('select', `padding:5px 8px;font-size:12px;background:${T.sur};border:1px solid ${T.bd};color:${T.tx};border-radius:6px`)
    ;[['1행',0],['2행',1],['3행',2],['4행',3],['5행',4]].forEach(([t,v]) => {
      const o = document.createElement('option')
      o.value = v; o.textContent = t; if (v === defHdrRow) o.selected = true
      selHdr.appendChild(o)
    })
    selHdr.onchange = () => { _headerRow = +selHdr.value; _parseSheet() }

    topBar.append(fileInfo,
      _el('span', `font-size:11px;color:${T.mt}`, '시트:'), selSheet,
      _el('span', `font-size:11px;color:${T.mt}`, '헤더 행:'), selHdr)
    step2.appendChild(topBar)

    // 컬럼 매핑 그리드
    const colGrid    = _el('div', 'display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;margin-bottom:14px')
    const colSelects = {}
    columns.forEach((col) => {
      const wrap = _el('div', '')
      const lbl  = _el('label', `display:block;font-size:11px;color:${T.mt};margin-bottom:4px`, col.label + (col.required ? ' *' : ''))
      const sel  = _el('select', `width:100%;padding:6px 8px;background:${T.sur};border:1px solid ${T.bd};color:${T.tx};border-radius:${T.r};font-size:12px`)
      colSelects[col.id] = sel
      sel.onchange = () => _buildPreview()
      wrap.append(lbl, sel); colGrid.appendChild(wrap)
    })
    step2.appendChild(colGrid)

    // ── 필터 (여러 컬럼 동시 적용, AND 조건) ──
    const filterWrap   = _el('div', `border:1px solid ${T.bd};border-radius:${T.r};padding:10px 12px;margin-bottom:14px;box-sizing:border-box;overflow:hidden`)
    const filterTitle  = _el('div', `display:flex;align-items:center;justify-content:space-between;margin-bottom:8px`)
    filterTitle.append(
      _el('span', `font-size:11px;color:${T.mt};font-weight:600`, '🔍 필터 (모두 만족하는 행만 포함)')
    )
    const btnAddFilter = _el('button', `padding:4px 10px;font-size:11px;border-radius:14px;border:1px solid ${T.ac};background:${T.bg};color:${T.ac};cursor:pointer;font-weight:600`, '+ 필터 추가')
    filterTitle.appendChild(btnAddFilter)
    const filterListWrap = _el('div', 'display:flex;flex-direction:column;gap:8px')
    const filterEmptyMsg = _el('div', `font-size:12px;color:${T.mt};padding:4px 0`, '필터가 없습니다. 전체 데이터가 사용됩니다.')
    filterWrap.append(filterTitle, filterListWrap)
    step2.appendChild(filterWrap)

    /**
     * 필터 목록 (각 항목이 하나의 컬럼 필터)
     * { colIdx, mode: 'exclude'|'include', excluded: Set, included: Set }
     */
    let _filters = []

    btnAddFilter.onclick = () => {
      _filters.push({ colIdx: null, mode: 'exclude', excluded: new Set(), included: new Set() })
      _renderFilterList()
      _buildPreview()
    }

    function _resetFilters() {
      _filters = []
      _renderFilterList()
    }

    function _renderFilterList() {
      filterListWrap.innerHTML = ''
      if (_filters.length === 0) { filterListWrap.appendChild(filterEmptyMsg); return }

      _filters.forEach((f, fi) => {
        const row = _el('div', `border:1px solid ${T.bd2};border-radius:8px;padding:8px 10px;background:${T.sur};min-width:0;box-sizing:border-box`)

        // 상단: 컬럼 선택 + 모드 토글 + 삭제
        const rowTop = _el('div', 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px')

        const selCol = _el('select', `padding:5px 8px;font-size:12px;background:${T.bg};border:1px solid ${T.bd};color:${T.tx};border-radius:6px;max-width:180px;flex-shrink:0`)
        selCol.innerHTML = '<option value="">-- 컬럼 선택 --</option>' +
          _headers.map((h, i) => `<option value="${i}" ${f.colIdx===i?'selected':''}>${_esc(h) || '(컬럼'+(i+1)+')'}</option>`).join('')
        selCol.onchange = () => {
          f.colIdx = selCol.value === '' ? null : +selCol.value
          f.excluded = new Set(); f.included = new Set()
          _renderFilterList(); _buildPreview()
        }

        const btnExclude = _el('button', '', '값 제외')
        const btnInclude = _el('button', '', '값만 선택')
        function _styleModeBtns() {
          const on  = `background:${T.ac};color:#fff;border-color:${T.ac}`
          const off = `background:${T.bg};color:${T.mt};border-color:${T.bd}`
          btnExclude.style.cssText = `padding:4px 10px;font-size:11px;border-radius:14px;border:1px solid;cursor:pointer;${f.mode==='exclude'?on:off}`
          btnInclude.style.cssText = `padding:4px 10px;font-size:11px;border-radius:14px;border:1px solid;cursor:pointer;${f.mode==='include'?on:off}`
        }
        _styleModeBtns()
        btnExclude.onclick = () => { f.mode='exclude'; f.excluded=new Set(); f.included=new Set(); _renderFilterList(); _buildPreview() }
        btnInclude.onclick = () => { f.mode='include'; f.excluded=new Set(); f.included=new Set(); _renderFilterList(); _buildPreview() }

        const btnDel = _el('button', `margin-left:auto;background:none;border:none;color:#dc2626;cursor:pointer;font-size:13px;padding:2px 6px`, '🗑 삭제')
        btnDel.onclick = () => { _filters.splice(fi, 1); _renderFilterList(); _buildPreview() }

        rowTop.append(selCol, btnExclude, btnInclude, btnDel)
        row.appendChild(rowTop)

        // 하단: 값 칩 목록
        const valuesWrap = _el('div', 'display:flex;flex-wrap:wrap;gap:6px')
        row.appendChild(valuesWrap)

        if (f.colIdx !== null) {
          const counts = {}
          _rows2d.forEach(r => {
            const v = String(r[f.colIdx] ?? '').trim() || '(빈 값)'
            counts[v] = (counts[v] || 0) + 1
          })
          const isExcludeMode = f.mode === 'exclude'

          Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .forEach(([val, cnt]) => {
              const isOn = isExcludeMode ? !f.excluded.has(val) : f.included.has(val)
              const chip = _el('label', `display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;font-size:12px;cursor:pointer;border:1px solid ${isOn ? (isExcludeMode?T.bd:'#86efac') : '#fca5a5'};background:${isOn ? (isExcludeMode?T.bg:'#f0fdf4') : '#fef2f2'};color:${isOn ? (isExcludeMode?T.tx:'#15803d') : '#b91c1c'};text-decoration:${(!isOn && isExcludeMode) ? 'line-through' : 'none'}`)
              chip.innerHTML = `<input type="checkbox" ${isOn?'checked':''} style="accent-color:${T.ac};width:13px;height:13px"> ${_esc(val)} <span style="color:${T.mt};font-size:10px">(${cnt})</span>`
              chip.querySelector('input').onchange = e => {
                if (isExcludeMode) { e.target.checked ? f.excluded.delete(val) : f.excluded.add(val) }
                else               { e.target.checked ? f.included.add(val)    : f.included.delete(val) }
                _renderFilterList(); _buildPreview()
              }
              valuesWrap.appendChild(chip)
            })
        } else {
          valuesWrap.appendChild(_el('div', `font-size:11px;color:${T.mt}`, '컬럼을 선택하면 값 목록이 표시됩니다.'))
        }

        filterListWrap.appendChild(row)
      })
    }

    _renderFilterList()

    // 미리보기
    const prevWrap = _el('div', `background:${T.sur};border:1px solid ${T.bd};border-radius:${T.r};padding:10px;margin-bottom:14px;overflow-x:auto;max-height:240px;overflow-y:auto`)
    const prevLbl  = _el('div', `font-size:10px;color:${T.mt};margin-bottom:6px;font-weight:600`, '미리보기 (상위 3행) — 컬럼 번호 또는 헤더 클릭하여 지정')
    const prevTbl  = _el('table', 'font-size:11px;width:100%;border-collapse:collapse')
    prevWrap.append(prevLbl, prevTbl)
    step2.appendChild(prevWrap)

    // 버튼
    const btnRow  = _el('div', 'display:flex;justify-content:space-between;gap:8px')
    const btnBack = _el('button', `padding:7px 14px;border-radius:${T.r};border:1px solid ${T.bd};background:${T.sur};color:${T.mt};font-size:12px;cursor:pointer`, '← 다시 선택')
    const btnOk   = _el('button', `padding:8px 22px;border-radius:${T.r};border:none;background:${T.ac};color:#fff;font-size:13px;font-weight:700;cursor:pointer`, confirmLabel)
    btnBack.onclick = () => _goStep1()
    btnOk.onclick   = () => _confirm()
    btnRow.append(btnBack, btnOk)
    step2.appendChild(btnRow)
    modal.appendChild(step2)

    // ── 내부 함수 ──
    function _goStep1() { step1.style.display=''; step2.style.display='none'; _wb=null; fileInput.value='' }

    async function _loadFile(file) {
      await loadSheetJS()
      fileInfo.textContent = `불러오는 중... ${file.name}`
      step1.style.display = 'none'; step2.style.display = ''
      try {
        const buffer = await file.arrayBuffer()
        _wb = _xlsx().read(buffer, { type:'array', cellDates:true })
        selSheet.innerHTML = _wb.SheetNames.map((n,i) => `<option value="${i}">${_esc(n)}</option>`).join('')
        _sheetIdx = 0; _parseSheet()
        fileInfo.textContent = `📊 ${file.name}`
      } catch(e) {
        fileInfo.textContent = `❌ 읽기 실패: ${e.message}`
        log.error('[ExcelUtil] 파일 읽기 실패', e)
      }
    }

    function _parseSheet() {
      if (!_wb) return
      const ws   = _wb.Sheets[_wb.SheetNames[_sheetIdx]]
      let raw2d  = _xlsx().utils.sheet_to_json(ws, { header:1, defval:'' })
      if (doFill) raw2d = forwardFill(raw2d)

      // 빈 행 건너뛰며 헤더 자동 탐색
      let hRow = _headerRow
      if (!raw2d[hRow]?.some(c => String(c).trim())) {
        for (let i = 0; i < Math.min(5, raw2d.length); i++) {
          if (raw2d[i].some(c => String(c).trim())) { hRow = i; break }
        }
      }

      _headers = (raw2d[hRow] || []).map(h => String(h).trim())
      _rows2d  = raw2d.slice(hRow + 1).filter(r => r.some(c => String(c).trim()))
      fileInfo.textContent = `📊 ${_wb.SheetNames[_sheetIdx]} · ${_rows2d.length}행 · ${_headers.length}컬럼`
      _buildColSelects()
    }

    function _buildColSelects() {
      const noneOpt    = '<option value="">-- 미사용 --</option>'
      const headerOpts = _headers.map((h,i) => `<option value="${i}">${_esc(h) || '(컬럼'+(i+1)+')'}</option>`).join('')
      columns.forEach(col => {
        const sel = colSelects[col.id]
        sel.innerHTML = (col.required ? '' : noneOpt) + headerOpts
        if (col.keywords) {
          const found = _headers.findIndex(h => col.keywords.some(kw => h.toLowerCase().includes(kw.toLowerCase())))
          if (found >= 0) sel.value = String(found)
        }
      })
      _resetFilters()
      _buildPreview()
    }

    function _getFilteredRows() {
      if (_filters.length === 0) return _rows2d
      return _rows2d.filter(row => {
        // 모든 필터를 동시에(AND) 만족해야 통과
        return _filters.every(f => {
          if (f.colIdx === null) return true   // 컬럼 미지정 필터는 무시
          const v = String(row[f.colIdx] ?? '').trim() || '(빈 값)'
          if (f.mode === 'exclude') {
            return f.excluded.size === 0 || !f.excluded.has(v)
          } else {
            return f.included.size === 0 || f.included.has(v)
          }
        })
      })
    }

    function _buildPreview() {
      prevTbl.innerHTML = ''
      const filteredRows = _getFilteredRows()

      const selMap = {}
      columns.forEach((col, ci) => {
        const v = colSelects[col.id]?.value
        if (v !== '' && v !== undefined) selMap[+v] = { label:col.label, color:PALETTE[ci] || PALETTE[0] }
      })

      function _onColClick(colIdx, e) {
        document.querySelectorAll('.__er-menu').forEach(m => m.remove())
        const menu = _el('div', `position:fixed;z-index:9999;background:${T.bg};border:1px solid ${T.bd};border-radius:${T.r};box-shadow:0 4px 20px rgba(0,0,0,.12);padding:6px;min-width:150px;font-size:12px`)
        menu.classList.add('__er-menu')
        menu.style.left = Math.min(e.clientX, window.innerWidth-170) + 'px'
        menu.style.top  = Math.min(e.clientY+4, window.innerHeight-200) + 'px'
        ;[...columns.map(col => ({ label: col.label + ' 지정', id: col.id })), { label:'— 선택 해제', id:'none' }]
          .forEach(opt => {
            const btn = _el('button', `display:block;width:100%;text-align:left;padding:6px 10px;background:none;border:none;color:${T.tx};cursor:pointer;border-radius:5px`, opt.label)
            btn.onmouseenter = () => { btn.style.background = T.sur }
            btn.onmouseleave = () => { btn.style.background = 'none' }
            btn.onclick = () => {
              if (opt.id === 'none') { columns.forEach(col => { const s=colSelects[col.id]; if(s&&+s.value===colIdx)s.value='' }) }
              else if (colSelects[opt.id]) colSelects[opt.id].value = String(colIdx)
              menu.remove(); _buildPreview()
            }
            menu.appendChild(btn)
          })
        document.body.appendChild(menu)
        setTimeout(() => document.addEventListener('click', () => menu.remove(), { once:true }), 0)
      }

      // 컬럼 번호 행
      const numRow = document.createElement('tr')
      _headers.forEach((_, i) => {
        const td = _el('td', `padding:3px 8px;font-size:9px;font-weight:700;text-align:center;border:1px solid ${T.bd2};cursor:pointer;color:${T.ac};background:${selMap[i]?.color||T.sur2}`, `${i+1}열`)
        td.title = '클릭하여 컬럼 지정'; td.onclick = ev => _onColClick(i, ev)
        numRow.appendChild(td)
      })
      prevTbl.appendChild(numRow)

      // 헤더명 행
      const hRow = document.createElement('tr')
      _headers.forEach((h, i) => {
        const info = selMap[i]
        const th   = document.createElement('th')
        th.innerHTML = `${_esc(h)||'(없음)'}${info?`<br><span style="font-size:9px;color:${T.ac}">[${info.label}]</span>`:''}`
        th.style.cssText = `padding:5px 8px;font-size:11px;color:${T.mt};white-space:nowrap;border:1px solid ${T.bd2};cursor:pointer;background:${info?.color||T.sur};font-weight:600;text-align:left`
        th.title = '클릭하여 컬럼 지정'; th.onclick = ev => _onColClick(i, ev)
        hRow.appendChild(th)
      })
      prevTbl.appendChild(hRow)

      // 데이터 미리보기 (필터 적용된 데이터 기준 3행)
      filteredRows.slice(0, 3).forEach(row => {
        const tr = document.createElement('tr')
        row.forEach((c, i) => {
          const td = _el('td', `padding:4px 8px;font-size:11px;color:${T.tx};border:1px solid ${T.bd2};white-space:nowrap;background:${selMap[i]?.color||'transparent'}`, String(c).substring(0, 24))
          tr.appendChild(td)
        })
        prevTbl.appendChild(tr)
      })

      // 필터 적용 결과 안내
      const activeFilterCount = _filters.filter(f =>
        f.colIdx !== null && (
          (f.mode === 'exclude' && f.excluded.size > 0) ||
          (f.mode === 'include' && f.included.size > 0)
        )
      ).length

      if (activeFilterCount > 0) {
        prevLbl.textContent = `미리보기 (상위 3행) — 필터 ${activeFilterCount}개 적용: ${filteredRows.length}/${_rows2d.length}행 남음`
      } else {
        prevLbl.textContent = '미리보기 (상위 3행) — 컬럼 번호 또는 헤더 클릭하여 지정'
      }
    }

    function _confirm() {
      for (const col of columns) {
        if (col.required && (!colSelects[col.id] || colSelects[col.id].value === '')) {
          alert(`'${col.label}' 컬럼을 선택하세요.`); return
        }
      }
      const mapping = {}
      columns.forEach(col => {
        const v = colSelects[col.id]?.value
        mapping[col.id] = (v !== '' && v !== undefined) ? +v : null
      })
      const filteredRows = _getFilteredRows()
      hide()
      onConfirm(_headers, filteredRows, mapping)
      log.debug(`[ExcelUtil] createReader confirm`, mapping, `필터: ${filteredRows.length}/${_rows2d.length}행`)
    }

    function show() { overlay.style.display = 'flex' }
    function hide() { overlay.style.display = 'none' }
    async function open(file) { show(); await _loadFile(file) }

    return { show, hide, open, getRows: () => _rows2d, getHeaders: () => _headers }
  }

  // ────────────────────────────────────────────
  // 쓰기 / 내보내기
  // ────────────────────────────────────────────

  /**
   * 다중 시트 Excel 내보내기
   * @param {Array}  sheets   - [{ name, rows, headers?, colNames? }, ...]
   * @param {string} filename
   * @param {object} options  - { bookType: 'xlsx'|'csv'|'ods' }
   * @example
   *   await ExcelUtil.download([
   *     { name:'전체', rows:data, headers:['addr','team'], colNames:{addr:'주소',team:'팀'} }
   *   ], '결과.xlsx')
   */
  async function download(sheets, filename = 'download.xlsx', options = {}) {
    await loadSheetJS()
    const { bookType = 'xlsx' } = options
    const wb = _xlsx().utils.book_new()

    sheets.forEach(({ name, rows, headers, colNames }) => {
      let ws
      if (!rows || rows.length === 0) {
        ws = _xlsx().utils.aoa_to_sheet([[]])
      } else if (Array.isArray(rows[0])) {
        ws = _xlsx().utils.aoa_to_sheet(rows)
      } else {
        const cols = headers || Object.keys(rows[0])
        if (colNames) {
          const aoa = [cols.map(c => colNames[c] ?? c), ...rows.map(r => cols.map(c => r[c] ?? ''))]
          ws = _xlsx().utils.aoa_to_sheet(aoa)
        } else {
          ws = _xlsx().utils.json_to_sheet(rows, { header: cols })
        }
      }
      _autoColWidth(ws)
      _xlsx().utils.book_append_sheet(wb, ws, name || `Sheet${wb.SheetNames.length+1}`)
    })

    _xlsx().writeFile(wb, filename, { bookType })
    log.debug(`[ExcelUtil] download: ${filename}`)
  }

  function _autoColWidth(ws) {
    if (!ws['!ref']) return
    const range = _xlsx().utils.decode_range(ws['!ref'])
    const cols  = []
    for (let C = range.s.c; C <= range.e.c; C++) {
      let max = 8
      for (let R = range.s.r; R <= range.e.r; R++) {
        const cell = ws[_xlsx().utils.encode_cell({ r:R, c:C })]
        if (cell?.v != null) max = Math.max(max, String(cell.v).length)
      }
      cols.push({ wch: Math.min(max + 2, 40) })
    }
    ws['!cols'] = cols
  }

  // ────────────────────────────────────────────
  // 앱별 특화
  // ────────────────────────────────────────────

  /** KB국민은행 거래내역 파싱 */
  async function parseKBBank(file) {
    const raw2d = await readFile(file, { headerRow:-1 })
    let hIdx = raw2d.findIndex(r => r.some(c => String(c).includes('거래일') || String(c).includes('날짜')))
    if (hIdx < 0) { log.warn('[ExcelUtil] KB 헤더 탐색 실패, 4행 fallback'); hIdx = 4 }
    const headers = raw2d[hIdx].map(h => String(h).trim())
    const data    = raw2d.slice(hIdx+1).filter(r => r.some(v => v !== ''))
    const idx     = kw => headers.findIndex(h => h.includes(kw))
    const dIdx=idx('거래일'), nIdx=idx('적요')>=0?idx('적요'):idx('내용'), aIdx=idx('출금')>=0?idx('출금'):idx('금액'), mIdx=idx('메모')
    return data.map(r => ({
      date:   r[dIdx] ? String(r[dIdx]).slice(0,10) : '',
      name:   r[nIdx] ? String(r[nIdx]).trim()       : '',
      amount: r[aIdx] ? Number(String(r[aIdx]).replace(/,/g,'')) : 0,
      memo:   mIdx>=0&&r[mIdx] ? String(r[mIdx]).trim() : '',
    })).filter(r => r.amount > 0)
  }

  /** field-check 현장점검 내보내기 */
  async function exportFieldCheck(data, filename) {
    const { project={}, items=[], done=[], undone=[] } = data
    await download([
      { name:'전체',   rows:items,  headers:['address','team','inspector','done_date','memo'], colNames:{address:'주소',team:'팀',inspector:'점검자',done_date:'완료일',memo:'메모'} },
      { name:'완료',   rows:done,   headers:['address','team','inspector','done_date'],         colNames:{address:'주소',team:'팀',inspector:'점검자',done_date:'완료일'} },
      { name:'미완료', rows:undone, headers:['address','team'],                                 colNames:{address:'주소',team:'팀'} },
      { name:'요약',   rows:[['프로젝트',project.name||''],['전체',items.length],['완료',done.length],['미완료',undone.length],['완료율',items.length?`${Math.round(done.length/items.length*100)}%`:'0%']] },
    ], filename || `${project.name||'점검'}_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  /** apt_check 아파트 점검 내보내기 */
  async function exportAptCheck(data, filename) {
    const { buildings=[], teams=[] } = data
    await download([
      { name:'전체', rows:buildings, headers:['dong','team','done_date','memo'], colNames:{dong:'동',team:'팀',done_date:'완료일',memo:'메모'} },
      ...teams.map(team => ({ name:team, rows:buildings.filter(b=>b.team===team), headers:['dong','done_date','memo'], colNames:{dong:'동',done_date:'완료일',memo:'메모'} }))
    ], filename || `아파트점검_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  // ────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────

  return {
    loadSheetJS, ACCEPT,
    forwardFill,
    readFile, getSheetNames,
    createReader,
    download,
    parseKBBank, exportFieldCheck, exportAptCheck,
  }
})()

window.ExcelUtil = ExcelUtil
