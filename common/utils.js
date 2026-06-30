/**
 * utils.js - 공통 유틸리티 모듈
 * rcntiger.github.io/common/utils.js
 *
 * 의존성: logger.js (선택)
 *
 * 사용법:
 *   <script src="https://rcntiger.github.io/common/utils.js"></script>
 *   <script>
 *     const { label, color } = Utils.dday('2025-12-31')
 *     Utils.toast('저장 완료!', { type: 'success' })
 *   </script>
 */

const Utils = (() => {
  const log = window.Logger || { debug: console.log, warn: console.warn, error: console.error }

  // ────────────────────────────────────────────
  // 날짜 / D-day
  // ────────────────────────────────────────────

  /**
   * 오늘 날짜를 'YYYY-MM-DD' 형식으로 반환
   * @returns {string}
   * @example Utils.today() // '2025-06-01'
   */
  function today() {
    return new Date().toISOString().slice(0, 10)
  }

  /**
   * Date → 'YYYY-MM-DD'
   * @param {Date|string} date
   * @returns {string}
   * @example Utils.formatDate(new Date()) // '2025-06-01'
   */
  function formatDate(date) {
    if (!date) return ''
    const d = date instanceof Date ? date : new Date(date)
    return d.toISOString().slice(0, 10)
  }

  /**
   * 'YYYY-MM-DD' → 'YYYY년 MM월 DD일'
   * @param {string} dateStr
   * @returns {string}
   * @example Utils.formatDateKo('2025-06-01') // '2025년 06월 01일'
   */
  function formatDateKo(dateStr) {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-')
    return `${y}년 ${m}월 ${d}일`
  }

  /**
   * D-day 계산
   * @param {string} targetDate - 'YYYY-MM-DD'
   * @returns {{ diff: number, label: string, color: string }}
   * @example
   *   const { label, color } = Utils.dday('2025-12-31')
   *   el.textContent = label   // 'D-30'
   *   el.style.color = color   // '#dd6b20'
   */
  function dday(targetDate) {
    if (!targetDate) return { diff: null, label: '', color: '#aaa' }
    const now = new Date(); now.setHours(0, 0, 0, 0)
    const tgt = new Date(targetDate); tgt.setHours(0, 0, 0, 0)
    const diff = Math.round((tgt - now) / 86400000)

    let label, color
    if      (diff > 0)  { label = `D-${diff}`;  color = diff <= 7 ? '#e53e3e' : diff <= 30 ? '#dd6b20' : '#2b6cb0' }
    else if (diff < 0)  { label = `D+${-diff}`; color = '#718096' }
    else                { label = 'D-Day';       color = '#c53030' }

    return { diff, label, color }
  }

  // ────────────────────────────────────────────
  // localStorage 래퍼
  // ────────────────────────────────────────────

  /**
   * localStorage에 JSON 저장
   * @param {string} key
   * @param {*}      value
   * @param {string} prefix - 사용자/앱별 prefix (기본 '')
   * @example Utils.lsSet('stations', [...], 'fieldcheck_')
   */
  function lsSet(key, value, prefix = '') {
    try { localStorage.setItem(prefix + key, JSON.stringify(value)) }
    catch (e) { log.warn('[Utils] lsSet 실패:', e) }
  }

  /**
   * localStorage에서 JSON 읽기
   * @param {string} key
   * @param {*}      defaultValue
   * @param {string} prefix
   * @returns {*}
   * @example const list = Utils.lsGet('stations', [], 'fieldcheck_')
   */
  function lsGet(key, defaultValue = null, prefix = '') {
    try {
      const v = localStorage.getItem(prefix + key)
      return v !== null ? JSON.parse(v) : defaultValue
    } catch { return defaultValue }
  }

  /**
   * localStorage 항목 삭제
   * @param {string} key
   * @param {string} prefix
   */
  function lsRemove(key, prefix = '') {
    localStorage.removeItem(prefix + key)
  }

  /**
   * prefix로 시작하는 localStorage 항목 전체 삭제
   * @param {string} prefix
   * @example Utils.lsClear('fieldcheck_')
   */
  function lsClear(prefix = '') {
    Object.keys(localStorage)
      .filter(k => k.startsWith(prefix))
      .forEach(k => localStorage.removeItem(k))
  }

  // ────────────────────────────────────────────
  // 이미지 압축 (Canvas)
  // ────────────────────────────────────────────

  /**
   * File → 압축된 Blob
   * @param {File}   file
   * @param {object} options
   *   maxWidth  : 최대 가로 px (기본 1280)
   *   maxHeight : 최대 세로 px (기본 1280)
   *   quality   : JPEG 품질 0~1 (기본 0.75)
   * @returns {Promise<Blob>}
   * @example
   *   const blob = await Utils.compressImage(file, { quality: 0.8 })
   */
  function compressImage(file, options = {}) {
    const { maxWidth = 1280, maxHeight = 1280, quality = 0.75 } = options
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        let { width, height } = img
        const ratio = Math.min(maxWidth / width, maxHeight / height, 1)
        width  = Math.round(width  * ratio)
        height = Math.round(height * ratio)

        const canvas = document.createElement('canvas')
        canvas.width  = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          blob => blob ? resolve(blob) : reject(new Error('[Utils] 이미지 압축 실패')),
          'image/jpeg',
          quality
        )
      }
      img.onerror = () => reject(new Error('[Utils] 이미지 로드 실패'))
      img.src = url
    })
  }

  /**
   * 카메라/갤러리 선택 + 압축
   * @param {object} options - compressImage 옵션 + { capture: 'environment'|'user'|false }
   * @returns {Promise<{ blob: Blob, file: File }>}
   * @example
   *   const { blob } = await Utils.pickAndCompress({ capture: 'environment', quality: 0.8 })
   */
  function pickAndCompress(options = {}) {
    const { capture = 'environment', ...compressOpts } = options
    return new Promise((resolve, reject) => {
      const input = document.createElement('input')
      input.type   = 'file'
      input.accept = 'image/*'
      if (capture) input.setAttribute('capture', capture)
      input.onchange = async () => {
        const file = input.files[0]
        if (!file) return reject(new Error('[Utils] 파일이 선택되지 않았습니다.'))
        try {
          const blob = await compressImage(file, compressOpts)
          log.debug(`[Utils] 압축 완료: ${(blob.size / 1024).toFixed(1)}KB`)
          resolve({ blob, file })
        } catch (e) { reject(e) }
      }
      input.click()
    })
  }

  // ────────────────────────────────────────────
  // Toast 메시지
  // ────────────────────────────────────────────

  let _toastTimer = null

  /**
   * 화면 하단 토스트 메시지 표시
   * @param {string} msg
   * @param {object} options
   *   type     : 'info' | 'success' | 'error' | 'warning' (기본 'info')
   *   duration : 표시 시간 ms (기본 2500)
   * @example
   *   Utils.toast('저장 완료!', { type: 'success' })
   *   Utils.toast('오류 발생', { type: 'error', duration: 4000 })
   */
  function toast(msg, options = {}) {
    const { duration = 2500, type = 'info' } = options
    const colors = {
      info:    '#2d3748',
      success: '#276749',
      error:   '#c53030',
      warning: '#c05621',
    }

    let el = document.getElementById('__utils_toast__')
    if (!el) {
      el = document.createElement('div')
      el.id = '__utils_toast__'
      Object.assign(el.style, {
        position: 'fixed', bottom: '24px', left: '50%',
        transform: 'translateX(-50%)',
        padding: '10px 20px', borderRadius: '8px', color: '#fff',
        fontSize: '14px', zIndex: '99999', transition: 'opacity 0.3s',
        pointerEvents: 'none', maxWidth: '90vw', textAlign: 'center',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      })
      document.body.appendChild(el)
    }

    el.textContent = msg
    el.style.background = colors[type] || colors.info
    el.style.opacity = '1'

    clearTimeout(_toastTimer)
    _toastTimer = setTimeout(() => { el.style.opacity = '0' }, duration)
  }

  // ────────────────────────────────────────────
  // 공통 Error Handler
  // ────────────────────────────────────────────

  /**
   * 에러를 콘솔/Toast/Telegram으로 동시 처리
   * @param {Error|string} err
   * @param {object}       options
   *   toast    : true면 Toast 표시 (기본 true)
   *   telegram : true면 Telegram 전송 (기본 false, TelegramUtil 필요)
   *   prefix   : 메시지 앞에 붙을 텍스트
   * @example
   *   Utils.handleError(err, { toast: true, telegram: true })
   */
  function handleError(err, options = {}) {
    const { toast: showToast = true, telegram = false, prefix = '' } = options
    const msg = err instanceof Error ? err.message : String(err)
    const full = prefix ? `${prefix}: ${msg}` : msg

    log.error(full, err)
    if (showToast) toast(full, { type: 'error', duration: 4000 })
    if (telegram && window.TelegramUtil) {
      window.TelegramUtil.send(`🚨 *오류 발생*\n\`${full}\``).catch(() => {})
    }
  }

  // ────────────────────────────────────────────
  // Telegram (단발 전송, TelegramUtil 없을 때 fallback)
  // ────────────────────────────────────────────

  /**
   * Telegram Bot 메시지 단발 전송
   * @param {string} botToken
   * @param {string} chatId
   * @param {string} text
   * @example
   *   await Utils.telegramSend(TOKEN, CHAT_ID, '점검 완료!')
   */
  async function telegramSend(botToken, chatId, text) {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    })
    if (!res.ok) throw new Error(`[Utils] Telegram 전송 실패: ${res.status}`)
    return res.json()
  }

  // ────────────────────────────────────────────
  // 기타 유틸
  // ────────────────────────────────────────────

  /**
   * 클립보드 복사
   * @param {string} text
   * @example await Utils.copyToClipboard('복사할 텍스트')
   */
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    toast('복사되었습니다', { type: 'success' })
  }

  /**
   * 숫자에 천 단위 콤마
   * @param {number} n
   * @returns {string}
   * @example Utils.comma(1234567) // '1,234,567'
   */
  function comma(n) {
    return Number(n).toLocaleString('ko-KR')
  }

  /**
   * 딜레이
   * @param {number} ms
   * @returns {Promise<void>}
   * @example await Utils.sleep(500)
   */
  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms))
  }

  /**
   * URL 쿼리 파라미터 → 객체
   * @param {string} search - 기본 location.search
   * @returns {object}
   * @example Utils.parseQuery('?id=1&team=A') // { id: '1', team: 'A' }
   */
  function parseQuery(search = location.search) {
    return Object.fromEntries(new URLSearchParams(search))
  }

  /**
   * 객체 → URL 쿼리 문자열
   * @param {object} params
   * @returns {string}
   * @example Utils.buildQuery({ id: 1, team: 'A' }) // '?id=1&team=A'
   */
  function buildQuery(params) {
    return '?' + new URLSearchParams(params).toString()
  }

  /**
   * 이름 마스킹
   * @param {string} name
   * @returns {string}
   * @example Utils.maskName('홍길동') // '홍*동'
   */
  function maskName(name) {
    if (!name || name.length < 2) return name
    if (name.length === 2) return name[0] + '*'
    return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1]
  }

  // ────────────────────────────────────────────
  // 디바이스 판별 (PC/모바일 분기 통일)
  // ────────────────────────────────────────────

  /** 레이아웃 분기 기준 (px). 모든 앱이 이 값을 기준으로 통일 */
  const BREAKPOINT = 768

  /**
   * 화면 폭 기준 모바일 레이아웃 여부 (반응형 UI 분기용)
   * 리사이즈/회전 시 값이 바뀌므로 매번 호출해서 사용
   * @returns {boolean}
   * @example
   *   if (Utils.isMobileView()) renderBottomSheet()
   *   else renderSidebar()
   */
  function isMobileView() {
    return window.innerWidth <= BREAKPOINT
  }

  /**
   * 디바이스(브라우저 UA) 기준 모바일 여부 (네이티브 앱 연동용 - 카카오맵/길찾기 등)
   * 화면 크기가 아니라 실제 모바일 기기인지 판별
   * @returns {boolean}
   * @example
   *   if (Utils.isMobileApp()) location.href = 'kakaomap://route?...'
   *   else window.open(webUrl)
   */
  function isMobileApp() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  }

  // ────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────

  return {
    // 날짜
    today, formatDate, formatDateKo, dday,
    // localStorage
    lsSet, lsGet, lsRemove, lsClear,
    // 이미지
    compressImage, pickAndCompress,
    // UI
    toast,
    // 에러 핸들러
    handleError,
    // Telegram
    telegramSend,
    // 기타
    copyToClipboard, comma, sleep, parseQuery, buildQuery, maskName,
    // 디바이스 판별
    isMobileView, isMobileApp, BREAKPOINT,
  }
})()

window.Utils = Utils
