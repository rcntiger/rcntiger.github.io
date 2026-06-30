/**
 * config.js - 앱 설정(API 키 / DB 연결) 관리 모듈
 * rcntiger.github.io/common/config.js
 *
 * 목적: Supabase URL/Key, Kakao API Key 등을 코드에 하드코딩하지 않고
 *       사용자(다른 소방서 등)가 직접 입력해서 localStorage에 저장하도록 함.
 *       기본값(DEFAULTS)을 정해두면 1인/소규모 사용 시 설정 화면 없이도 동작.
 *
 * 의존성: logger.js (선택), utils.js (선택, toast 사용 시)
 *
 * 사용법 (가장 간단한 형태):
 *   <script src="https://rcntiger.github.io/common/config.js"></script>
 *   <script>
 *     ConfigUtil.init({
 *       appName: 'field-check',
 *       fields: [
 *         { key: 'supabase_url', label: 'Supabase URL', required: true },
 *         { key: 'supabase_key', label: 'Supabase Anon Key', required: true },
 *         { key: 'kakao_key',    label: 'Kakao JS Key', required: true },
 *       ],
 *       // 본인/소속 조직 기본값 (있으면 설정 화면 없이 바로 사용, 동료들은 이걸로 공유)
 *       defaults: {
 *         supabase_url: 'https://xxxx.supabase.co',
 *         supabase_key: 'eyJxxxx...',
 *         kakao_key:    'abcd1234...',
 *       },
 *       onReady: (cfg) => {
 *         // cfg = { supabase_url, supabase_key, kakao_key }
 *         SupabaseUtil.init(cfg.supabase_url, cfg.supabase_key)
 *       }
 *     })
 *   </script>
 *
 * 다른 소방서가 이 앱을 받아갈 때는 ⚙️ 버튼(ConfigUtil.showSetupModal())을 눌러
 * 자기 키를 입력하면, defaults를 덮어쓰고 localStorage에 저장됨.
 */

const ConfigUtil = (() => {
  const log = window.Logger || { debug: console.log, info: console.info, warn: console.warn, error: console.error }

  let _appName = 'app'
  let _fields  = []
  let _defaults = {}
  let _onChange = null

  function _prefix() { return `cfg_${_appName}_` }

  // ────────────────────────────────────────────
  // 초기화
  // ────────────────────────────────────────────

  /**
   * 설정 모듈 초기화. 저장된 값이 있으면 그걸 쓰고, 없으면 defaults를 쓰고,
   * required인데 defaults도 없으면 자동으로 설정 모달을 띄움.
   * @param {object} opts
   *   appName  : localStorage 키 prefix용 앱 식별자
   *   fields   : [{ key, label, required?, type? }]  type: 'text'|'password' (기본 text)
   *   defaults : { key: value } 기본값 (조직 공용 키를 박아두고 싶을 때)
   *   onReady  : fn(config) 설정이 모두 준비됐을 때 호출
   * @returns {object} 현재 설정값 { key: value }
   */
  function init(opts = {}) {
    _appName  = opts.appName || 'app'
    _fields   = opts.fields || []
    _defaults = opts.defaults || {}
    _onChange = opts.onReady || (() => {})

    const cfg = getAll()
    const missing = _fields.filter(f => f.required && !cfg[f.key])

    if (missing.length > 0) {
      log.warn('[ConfigUtil] 필수 설정 누락:', missing.map(f => f.key))
      showSetupModal()
    } else {
      log.info('[ConfigUtil] 설정 로드 완료')
      _onChange(cfg)
    }
    return cfg
  }

  // ────────────────────────────────────────────
  // 값 읽기/쓰기
  // ────────────────────────────────────────────

  /**
   * 설정값 하나 읽기 (저장값 > defaults 순)
   * @param {string} key
   * @returns {string|undefined}
   * @example ConfigUtil.get('supabase_url')
   */
  function get(key) {
    return localStorage.getItem(_prefix() + key) || _defaults[key]
  }

  /**
   * 설정값 하나 저장
   * @param {string} key
   * @param {string} value
   */
  function set(key, value) {
    if (value) localStorage.setItem(_prefix() + key, value)
    else localStorage.removeItem(_prefix() + key)
  }

  /**
   * 등록된 모든 필드의 현재값을 객체로 반환
   * @returns {object}
   * @example const { supabase_url, supabase_key } = ConfigUtil.getAll()
   */
  function getAll() {
    const result = {}
    _fields.forEach(f => { result[f.key] = get(f.key) })
    return result
  }

  /**
   * 필수 항목이 모두 채워졌는지 확인
   * @returns {boolean}
   */
  function isReady() {
    return _fields.filter(f => f.required).every(f => !!get(f.key))
  }

  /**
   * 저장된 설정 전체 삭제 (defaults는 유지되어 기본값으로 돌아감)
   */
  function reset() {
    _fields.forEach(f => localStorage.removeItem(_prefix() + f.key))
    log.info('[ConfigUtil] 설정 초기화됨 (기본값으로 복귀)')
  }

  // ────────────────────────────────────────────
  // 설정 모달 UI
  // ────────────────────────────────────────────

  const T = {
    bg:  'var(--cfg-bg,  #ffffff)',
    sur: 'var(--cfg-sur, #f9fafb)',
    tx:  'var(--cfg-tx,  #1a2233)',
    mt:  'var(--cfg-mt,  #6b7280)',
    bd:  'var(--cfg-bd,  #d1d5db)',
    ac:  'var(--cfg-ac,  #2563eb)',
    r:   'var(--cfg-r,   8px)',
  }

  function _el(tag, css, text) {
    const e = document.createElement(tag)
    if (css) e.style.cssText = css
    if (text !== undefined) e.textContent = text
    return e
  }

  /**
   * 설정 입력 모달 표시
   * @example
   *   // 우측 상단 ⚙️ 버튼 등에 연결
   *   document.getElementById('settingsBtn').onclick = () => ConfigUtil.showSetupModal()
   */
  function showSetupModal() {
    document.getElementById('__cfg_overlay__')?.remove()

    const overlay = _el('div', `position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center`)
    overlay.id = '__cfg_overlay__'

    const modal = _el('div', `background:${T.bg};border:1px solid ${T.bd};border-radius:14px;padding:24px;width:min(440px,92vw);max-height:90vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,.2)`)
    overlay.appendChild(modal)

    modal.appendChild(_el('h3', `margin:0 0 6px;font-size:16px;font-weight:700;color:${T.tx}`, `⚙️ ${_appName} 설정`))
    modal.appendChild(_el('p', `margin:0 0 18px;font-size:12px;color:${T.mt};line-height:1.5`,
      '이 앱을 사용하려면 본인의 Supabase / Kakao API 키가 필요합니다. 입력한 값은 이 브라우저에만 저장되며 서버로 전송되지 않습니다.'))

    const inputs = {}
    _fields.forEach(f => {
      const wrap = _el('div', 'margin-bottom:14px')
      const lbl = _el('label', `display:block;font-size:12px;color:${T.mt};margin-bottom:5px;font-weight:600`,
        f.label + (f.required ? ' *' : ' (선택)'))
      const input = _el('input', `width:100%;padding:9px 11px;border:1px solid ${T.bd};border-radius:${T.r};font-size:13px;background:${T.sur};color:${T.tx};box-sizing:border-box`)
      input.type  = f.type === 'password' ? 'password' : 'text'
      input.value = get(f.key) || ''
      input.placeholder = f.placeholder || ''
      inputs[f.key] = input
      wrap.append(lbl, input)
      modal.appendChild(wrap)
    })

    const btnRow = _el('div', 'display:flex;gap:8px;margin-top:8px')
    const btnSave = _el('button', `flex:1;padding:10px;border:none;border-radius:${T.r};background:${T.ac};color:#fff;font-size:13px;font-weight:700;cursor:pointer`, '저장')
    const btnReset = _el('button', `padding:10px 14px;border:1px solid ${T.bd};border-radius:${T.r};background:${T.sur};color:${T.mt};font-size:13px;cursor:pointer`, '초기화')

    btnSave.onclick = () => {
      const missing = _fields.filter(f => f.required && !inputs[f.key].value.trim())
      if (missing.length > 0) {
        alert(`다음 항목을 입력하세요: ${missing.map(f => f.label).join(', ')}`)
        return
      }
      _fields.forEach(f => set(f.key, inputs[f.key].value.trim()))
      overlay.remove()
      log.info('[ConfigUtil] 설정 저장됨')
      if (window.Utils?.toast) window.Utils.toast('설정이 저장되었습니다. 새로고침합니다.', { type: 'success' })
      setTimeout(() => location.reload(), 600)
    }

    btnReset.onclick = () => {
      if (!confirm('저장된 설정을 모두 삭제할까요?')) return
      reset()
      overlay.remove()
      location.reload()
    }

    btnRow.append(btnReset, btnSave)
    modal.appendChild(btnRow)

    overlay.appendChild(modal)
    document.body.appendChild(overlay)
  }

  // ────────────────────────────────────────────
  // 설정 내보내기/가져오기 (다른 PC로 옮길 때)
  // ────────────────────────────────────────────

  /**
   * 현재 설정을 base64 코드로 변환 (다른 PC에 복사/붙여넣기 용도)
   * @returns {string}
   * @example
   *   const code = ConfigUtil.exportCode()
   *   Utils.copyToClipboard(code)
   */
  function exportCode() {
    const cfg = getAll()
    return btoa(unescape(encodeURIComponent(JSON.stringify(cfg))))
  }

  /**
   * base64 코드를 받아 설정값으로 저장 (다른 PC에서 가져오기)
   * @param {string} code
   * @returns {boolean} 성공 여부
   * @example
   *   const code = prompt('설정 코드를 붙여넣으세요')
   *   if (ConfigUtil.importCode(code)) location.reload()
   */
  function importCode(code) {
    try {
      const cfg = JSON.parse(decodeURIComponent(escape(atob(code.trim()))))
      Object.entries(cfg).forEach(([k, v]) => set(k, v))
      log.info('[ConfigUtil] 설정 가져오기 성공')
      return true
    } catch (e) {
      log.error('[ConfigUtil] 설정 코드가 올바르지 않습니다', e)
      return false
    }
  }

  // ────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────

  return {
    init,
    get, set, getAll, isReady, reset,
    showSetupModal,
    exportCode, importCode,
  }
})()

window.ConfigUtil = ConfigUtil
