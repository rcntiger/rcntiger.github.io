/**
 * excel.js — 엑셀 읽기 공통 모듈
 * rcntiger.github.io/common/excel.js
 *
 * 기능:
 *  - SheetJS 동적 로드
 *  - 시트 선택
 *  - 헤더 행 선택 (1행/2행/3행)
 *  - 병합 셀 forward fill
 *  - 컬럼 자동 매핑 (키워드 기반)
 *  - 미리보기 테이블 (컬럼 번호·클릭 선택·하이라이트)
 *  - 데이터 추출 콜백
 *
 * 사용법:
 *  const reader = ExcelReader.create({
 *    // 필수: 컬럼 정의
 *    columns: [
 *      { id: 'name',  label: '이름',   required: true,  keywords: ['이름','명칭','대상','건물'] },
 *      { id: 'addr',  label: '주소',   required: true,  keywords: ['주소','도로','지번'] },
 *      { id: 'group', label: '그룹',   required: false, keywords: ['팀','구역','그룹'] },
 *      { id: 'extra', label: '추가정보',required: false, keywords: ['비고','추가','기타'] },
 *    ],
 *    // 필수: 데이터 확정 시 콜백 (headers, rows, mapping)
 *    onConfirm: (headers, rows, mapping) => {
 *      // mapping = { name: 2, addr: 7, group: null, extra: null }  (컬럼 인덱스)
 *      // rows = 2D 배열 (forward fill 적용됨)
 *    },
 *    // 선택: 헤더 기본 행 (0-based, 기본 1 = 2행)
 *    defaultHeaderRow: 1,
 *    // 선택: 확인 버튼 레이블
 *    confirmLabel: '확인',
 *    // 선택: CSS 변수 기반 테마 여부 (기본 true)
 *    useCssVars: true,
 *  });
 *
 *  // 파일 input change 이벤트에 연결
 *  document.getElementById('myFileInput').addEventListener('change', e => {
 *    reader.load(e.target.files[0]);
 *  });
 *
 *  // 모달 표시/숨김
 *  reader.show();
 *  reader.hide();
 */

(function(global){
  'use strict';

  // ━━ SheetJS 동적 로드 ━━
  const SHEETJS_CDN='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  function ensureSheetJS(){
    return new Promise(resolve=>{
      if(global.XLSX)return resolve();
      const s=document.createElement('script');
      s.src=SHEETJS_CDN;
      s.onload=resolve;
      document.head.appendChild(s);
    });
  }

  // ━━ 색상 팔레트 ━━
  const PALETTE=[
    'rgba(47,129,247,.25)',   // 파랑
    'rgba(34,197,94,.25)',    // 초록
    'rgba(251,146,60,.25)',   // 주황
    'rgba(168,85,247,.25)',   // 보라
    'rgba(239,68,68,.25)',    // 빨강
  ];

  // ━━ 유틸 ━━
  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function el(tag,css,text){
    const e=document.createElement(tag);
    if(css)e.style.cssText=css;
    if(text!==undefined)e.textContent=text;
    return e;
  }

  /**
   * ExcelReader.create(options) → reader 인스턴스
   */
  function create(opts={}){
    const columns   = opts.columns || [];
    const onConfirm = opts.onConfirm || (()=>{});
    const defHdrRow = opts.defaultHeaderRow ?? 1;
    const confirmLabel = opts.confirmLabel || '확인';
    const useCssVars= opts.useCssVars !== false;

    // 내부 상태
    let _wb=null, _headers=[], _rows=[], _sheetIdx=0, _headerRow=defHdrRow;

    // ─── 스타일 변수 ───
    const S = useCssVars ? {
      bg:'var(--bg,#0d1117)',
      sur:'var(--sur,#161b22)',
      sur2:'var(--sur2,#1c2128)',
      tx:'var(--tx,#e6edf3)',
      mt:'var(--mt,#8b949e)',
      bd:'var(--bd,#30363d)',
      bd2:'var(--bd2,#21262d)',
      ac:'var(--ac,#2f81f7)',
      r:'var(--r,8px)',
    } : {
      bg:'#0d1117',sur:'#161b22',sur2:'#1c2128',
      tx:'#e6edf3',mt:'#8b949e',bd:'#30363d',bd2:'#21262d',
      ac:'#2f81f7',r:'8px',
    };

    // ─── DOM 생성 ───
    const overlay=el('div','position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9900;display:none;align-items:center;justify-content:center');
    const modal=el('div',`background:${S.sur};border:1px solid ${S.bd};border-radius:12px;padding:20px;width:min(640px,96vw);max-height:90vh;overflow-y:auto;position:relative`);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // 닫기 버튼
    const btnClose=el('button','position:absolute;top:12px;right:14px;background:none;border:none;color:'+S.mt+';font-size:22px;cursor:pointer;line-height:1','✕');
    btnClose.onclick=()=>hide();
    modal.appendChild(btnClose);

    // 제목
    const title=el('h3','margin:0 0 14px;font-size:15px;color:'+S.tx,'📊 엑셀 업로드');
    modal.appendChild(title);

    // ─── Step 1: 파일 선택 ───
    const step1=el('div','');
    const dropzone=el('div',`border:2px dashed ${S.bd2};border-radius:${S.r};padding:28px;text-align:center;cursor:pointer;margin-bottom:12px`);
    dropzone.innerHTML=`<div style="font-size:28px;margin-bottom:6px">📊</div><div style="font-size:13px;color:${S.mt}">클릭하여 엑셀 파일을 선택하세요</div><div style="font-size:11px;color:#fb923c;margin-top:6px">※ 암호화된 파일은 해제 후 업로드하세요</div>`;
    const fileInput=el('input','display:none');
    fileInput.type='file';fileInput.accept='.xlsx,.xls';
    fileInput.onchange=e=>{if(e.target.files[0])_loadFile(e.target.files[0]);};
    dropzone.onclick=()=>fileInput.click();
    step1.appendChild(dropzone);
    step1.appendChild(fileInput);
    modal.appendChild(step1);

    // ─── Step 2: 컬럼 매핑 ───
    const step2=el('div','display:none');

    // 상단: 파일정보 + 시트선택 + 헤더행 선택
    const topBar=el('div','display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap');
    const fileInfo=el('div','font-size:12px;color:'+S.mt+';flex:1','');
    const lblSheet=el('label','font-size:11px;color:'+S.mt,'시트:');
    const selSheet=el('select',`padding:4px 7px;font-size:11px;background:${S.sur2};border:1px solid ${S.bd2};color:${S.tx};border-radius:5px`);
    selSheet.onchange=()=>{_sheetIdx=+selSheet.value;_parseSheet();};
    const lblHdr=el('label','font-size:11px;color:'+S.mt,'헤더 행:');
    const selHdr=el('select',`padding:4px 7px;font-size:11px;background:${S.sur2};border:1px solid ${S.bd2};color:${S.tx};border-radius:5px`);
    [['1행',0],['2행',1],['3행',2]].forEach(([t,v])=>{
      const o=document.createElement('option');
      o.value=v;o.textContent=t;if(v===defHdrRow)o.selected=true;
      selHdr.appendChild(o);
    });
    selHdr.onchange=()=>{_headerRow=+selHdr.value;_parseSheet();};
    topBar.append(fileInfo,lblSheet,selSheet,lblHdr,selHdr);
    step2.appendChild(topBar);

    // 컬럼 매핑 그리드
    const colGrid=el('div',`display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px`);
    const colSelects={};
    columns.forEach(col=>{
      const wrap=el('div','');
      const lbl=el('label',`display:block;font-size:11px;color:${S.mt};margin-bottom:4px`,col.label+(col.required?' *':''));
      const sel=el('select',`width:100%;padding:6px 8px;background:${S.sur2};border:1px solid ${S.bd2};color:${S.tx};border-radius:${S.r};font-size:12px`);
      colSelects[col.id]=sel;
      sel.onchange=()=>_buildPreview();
      wrap.append(lbl,sel);
      colGrid.appendChild(wrap);
    });
    step2.appendChild(colGrid);

    // 미리보기
    const previewWrap=el('div',`background:${S.sur2};border-radius:${S.r};padding:10px;margin-bottom:12px;overflow-x:auto`);
    const previewLbl=el('div','font-size:10px;color:'+S.mt+';margin-bottom:6px;font-weight:600','미리보기 (상위 3행) — 컬럼 클릭하여 지정');
    const previewTbl=el('table','font-size:11px;width:100%;border-collapse:collapse');
    previewWrap.append(previewLbl,previewTbl);
    step2.appendChild(previewWrap);

    // 버튼
    const btnRow=el('div','display:flex;justify-content:space-between;gap:8px');
    const btnBack=el('button',`padding:7px 14px;border-radius:${S.r};border:1px solid ${S.bd2};background:${S.sur2};color:${S.mt};font-size:12px;cursor:pointer`,'← 다시 선택');
    btnBack.onclick=()=>_goStep1();
    const btnOk=el('button',`padding:7px 16px;border-radius:${S.r};border:none;background:${S.ac};color:#fff;font-size:12px;font-weight:700;cursor:pointer`,confirmLabel);
    btnOk.onclick=()=>_confirm();
    btnRow.append(btnBack,btnOk);
    step2.appendChild(btnRow);
    modal.appendChild(step2);

    // ─── 내부 함수 ───
    function _goStep1(){step1.style.display='';step2.style.display='none';_wb=null;fileInput.value='';}

    async function _loadFile(file){
      await ensureSheetJS();
      const reader2=new FileReader();
      reader2.onload=e=>{
        _wb=global.XLSX.read(e.target.result,{type:'binary'});
        selSheet.innerHTML=_wb.SheetNames.map((n,i)=>`<option value="${i}">${esc(n)}</option>`).join('');
        fileInfo.textContent=`📊 ${file.name}`;
        _sheetIdx=0;_parseSheet();
        step1.style.display='none';step2.style.display='';
      };
      reader2.readAsBinaryString(file);
    }

    function _parseSheet(){
      if(!_wb)return;
      const ws=_wb.Sheets[_wb.SheetNames[_sheetIdx]];
      const raw=global.XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
      // 헤더 행 결정
      let hRow=_headerRow;
      if(!raw[hRow]?.some(c=>String(c).trim())){
        for(let i=0;i<Math.min(5,raw.length);i++){
          if(raw[i].some(c=>String(c).trim())){hRow=i;break;}
        }
      }
      _headers=raw[hRow].map(c=>String(c).trim());
      const dataRaw=raw.slice(hRow+1).filter(r=>r.some(c=>String(c).trim()));
      // 병합 셀 forward fill
      const last=new Array(_headers.length).fill('');
      _rows=dataRaw.map(r=>r.map((c,i)=>{
        const v=String(c).trim();
        if(v){last[i]=v;return v;}
        return last[i]||'';
      }));
      fileInfo.textContent=`📊 ${_wb.SheetNames[_sheetIdx]} · ${_rows.length}행`;
      _buildColSelects();
    }

    function _buildColSelects(){
      const none=`<option value="">-- 없음 --</option>`;
      const opts=_headers.map((h,i)=>`<option value="${i}">${esc(h)||'(컬럼'+i+')'}</option>`).join('');
      columns.forEach((col,ci)=>{
        const sel=colSelects[col.id];
        sel.innerHTML=(col.required?'':none)+opts;
        // 키워드 자동 매핑
        if(col.keywords){
          const found=_headers.findIndex(h=>col.keywords.some(kw=>h.toLowerCase().includes(kw)));
          if(found>=0)sel.value=String(found);
        }
      });
      _buildPreview();
    }

    function _buildPreview(){
      previewTbl.innerHTML='';
      // 선택 컬럼 맵 {colIdx: label}
      const selMap={};
      columns.forEach((col,ci)=>{
        const v=colSelects[col.id]?.value;
        if(v!==''&&v!==undefined)selMap[+v]={label:col.label,color:PALETTE[ci]||'rgba(255,255,255,.1)'};
      });

      function onColClick(colIdx,e){
        document.querySelectorAll('.__er-menu').forEach(m=>m.remove());
        const menu=el('div',`position:fixed;z-index:9999;background:${S.sur};border:1px solid ${S.bd2};border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.6);padding:6px;min-width:140px;font-size:12px`);
        menu.classList.add('__er-menu');
        menu.style.left=Math.min(e.clientX,window.innerWidth-160)+'px';
        menu.style.top=Math.min(e.clientY+4,window.innerHeight-220)+'px';
        [...columns.map(col=>({label:(col.label+' 컬럼'),id:col.id})),{label:'— 선택 해제',id:'none'}].forEach(opt=>{
          const btn=el('button',`display:block;width:100%;text-align:left;padding:6px 10px;background:none;border:none;color:${S.tx};cursor:pointer;border-radius:5px`,opt.label);
          btn.onmouseenter=()=>btn.style.background=S.sur2;
          btn.onmouseleave=()=>btn.style.background='none';
          btn.onclick=()=>{
            if(opt.id==='none'){
              columns.forEach(col=>{const s=colSelects[col.id];if(s&&+s.value===colIdx)s.value='';});
            }else{
              if(colSelects[opt.id])colSelects[opt.id].value=String(colIdx);
            }
            menu.remove();_buildPreview();
          };
          menu.appendChild(btn);
        });
        document.body.appendChild(menu);
        setTimeout(()=>document.addEventListener('click',()=>menu.remove(),{once:true}),0);
      }

      // 컬럼 번호 행
      const numRow=document.createElement('tr');
      _headers.forEach((_,i)=>{
        const td=el('td',`padding:2px 8px;font-size:9px;font-weight:700;text-align:center;border:1px solid ${S.bd2};cursor:pointer;color:${S.ac};background:${selMap[i]?.color||'rgba(47,129,247,.08)'}`,`${i+1}열`);
        td.title='클릭하여 컬럼 지정';
        td.onclick=e=>onColClick(i,e);
        numRow.appendChild(td);
      });
      previewTbl.appendChild(numRow);

      // 헤더명 행
      const hRow=document.createElement('tr');
      _headers.forEach((h,i)=>{
        const th=document.createElement('th');
        const info=selMap[i];
        th.innerHTML=`${esc(h)||'(없음)'}${info?`<br><span style="font-size:9px;color:${S.ac}">[${info.label}]</span>`:''}`;
        th.style.cssText=`padding:4px 8px;font-size:10px;color:${S.mt};white-space:nowrap;border:1px solid ${S.bd2};cursor:pointer;background:${info?.color||'rgba(255,255,255,.05)'}`;
        th.title='클릭하여 컬럼 지정';
        th.onclick=e=>onColClick(i,e);
        hRow.appendChild(th);
      });
      previewTbl.appendChild(hRow);

      // 데이터 행 (최대 3행)
      _rows.slice(0,3).forEach(r=>{
        const row=document.createElement('tr');
        r.forEach((c,i)=>{
          const td=el('td',`padding:4px 8px;font-size:11px;color:${S.tx};border:1px solid ${S.bd2};white-space:nowrap;background:${selMap[i]?.color||'transparent'}`,String(c).substring(0,20));
          row.appendChild(td);
        });
        previewTbl.appendChild(row);
      });
    }

    function _confirm(){
      // 필수 컬럼 검증
      for(const col of columns){
        if(col.required&&(!colSelects[col.id]||colSelects[col.id].value==='')){
          alert(`'${col.label}' 컬럼을 선택하세요.`);return;
        }
      }
      // 매핑 객체 생성 {colId: colIndex|null}
      const mapping={};
      columns.forEach(col=>{
        const v=colSelects[col.id]?.value;
        mapping[col.id]=(v!==''&&v!==undefined)?+v:null;
      });
      hide();
      onConfirm(_headers, _rows, mapping);
    }

    // ─── 공개 API ───
    function show(){overlay.style.display='flex';}
    function hide(){overlay.style.display='none';}

    /** 외부 file input에서 직접 파일을 넘길 때 사용 */
    async function load(file){if(file){show();await _loadFile(file);}}

    /** 현재 rows 반환 (forward fill 적용) */
    function getRows(){return _rows;}
    function getHeaders(){return _headers;}

    return {show, hide, load, getRows, getHeaders};
  }

  // ─── 네임스페이스 등록 ───
  global.ExcelReader={create};

})(typeof window!=='undefined'?window:this);
