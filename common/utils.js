/**
 * utils.js - 공통 유틸리티 모듈
 * rcntiger.github.io/common/utils.js
 *
 * 사용법:
 *   <script src="https://rcntiger.github.io/common/utils.js"></script>
 *   <script>
 *     const label = Utils.dday('2025-12-31')   // → 'D-10'
 *     Utils.toast('저장 완료!')
 *   </script>
 */

const Utils = (() => {

  // ────────────────────────────────────────────
  // 날짜 / D-day
  // ────────────────────────────────────────────

  /** 오늘 날짜를 'YYYY-MM-DD' 형식으로 반환 */
  function today() {
    return new Date().toISOString().slice(0, 10)
  }

  /** Date → 'YYYY-MM-DD' */
  function formatDate(date) {
    if (!date) return ''
    const d = date instanceof Date ? date : new Date(date)
    return d.toISOString().slice(0, 10)
  }

  /** 'YYYY-MM-DD' → 'YYYY년 MM월 DD일' */
  function formatDateKo(dateStr) {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-')
    return `${y}년 ${m}월 ${d}일`
  }

  /**
   * D-day 계산
   * @param {string} targetDate - 'YYYY-MM-DD'
   * @returns { diff: number, label: string, color: string }
   *   diff > 0: 남은 날, diff < 0: 지난 날, diff === 0: 오늘
   */
  function dday(targetDate) {
    if (!targetDate) return { diff: null, label: '', color: '#aaa' }
    const now  = new Date(); now.setHours(0,0,0,0)
    const tgt  = new Date(targetDate); tgt.setHours(0,0,0,0)
    const diff = Math.round((tgt - now) / 86400000)

    let label, color
    if (diff > 0)       { label = `D-${diff}`;  color = diff <= 7 ? '#e53e3e' : diff <= 30 ? '#dd6b20' : '#2b6cb0' }
    else if (diff < 0)  { label = `D+${-diff}`; color = '#718096' }
    else                { label = 'D-Day';       color = '#c53030' }

    return { diff, label, color }
  }

  // ────────────────────────────────────────────
  // localStorage 래퍼
  // ────────────────────────────────────────────

  /**
   * localStorage에 JSON 저장 (prefix 지원 → 사용자별 분리)
   * @param {string} key
   * @param {*}      value
   * @param {string} prefix - 앱별 또는 사용자별 prefix (기본 '')
   */
  function lsSet(key, value, prefix = '') {
    try { localStorage.setItem(prefix + key, JSON.stringify(value)) }
    catch (e) { console.warn('[Utils] lsSet 실패:', e) }
  }

  function lsGet(key, defaultValue = null, prefix = '') {
    try {
      const v = localStorage.getItem(prefix + key)
      return v !== null ? JSON.parse(v) : defaultValue
    } catch { return defaultValue }
  }

  function lsRemove(key, prefix = '') {
    localStorage.removeItem(prefix + key)
  }

  /** prefix로 시작하는 모든 키 삭제 */
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
   *   maxWidth:  최대 가로 px (기본 1280)
   *   maxHeight: 최대 세로 px (기본 1280)
   *   quality:   JPEG 품질 0~1 (기본 0.75)
   * @returns Promise<Blob>
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
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('압축 실패')), 'image/jpeg', quality)
      }
      img.onerror = reject
      img.src = url
    })
  }

  /**
   * 카메라/갤러리 input[type=file] 생성 후 선택 → 압축 Blob 반환
   * @param {object} options - compressImage 옵션 + { capture: 'environment'|'user'|false }
   * @returns Promise<{ blob, file }>
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
        if (!file) return reject(new Error('파일 미선택'))
        try {
          const blob = await compressImage(file, compressOpts)
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
   * 화면 하단에 토스트 메시지 표시
   * @param {string} msg
   * @param {object} options
   *   duration: ms (기본 2500)
   *   type: 'info' | 'success' | 'error' (기본 'info')
   */
  function toast(msg, options = {}) {
    const { duration = 2500, type = 'info' } = options
    const colors = { info: '#2d3748', success: '#276749', error: '#c53030' }

    let el = document.getElementById('__utils_toast__')
    if (!el) {
      el = document.createElement('div')
      el.id = '__utils_toast__'
      Object.assign(el.style, {
        position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
        padding: '10px 20px', borderRadius: '8px', color: '#fff',
        fontSize: '14px', zIndex: 99999, transition: 'opacity 0.3s',
        pointerEvents: 'none', maxWidth: '90vw', textAlign: 'center',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
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
  // Telegram 알림
  // ────────────────────────────────────────────

  /**
   * Telegram Bot으로 메시지 전송
   * @param {string} botToken
   * @param {string} chatId
   * @param {string} text     - 마크다운 지원
   */
  async function telegramSend(botToken, chatId, text) {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
    })
    if (!res.ok) throw new Error(`[Utils] Telegram 전송 실패: ${res.status}`)
    return res.json()
  }

  // ────────────────────────────────────────────
  // 기타 유틸
  // ────────────────────────────────────────────

  /** 클립보드 복사 */
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text)
      toast('복사되었습니다', { type: 'success' })
    } catch {
      // fallback
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      toast('복사되었습니다', { type: 'success' })
    }
  }

  /** 숫자에 천 단위 콤마 */
  function comma(n) {
    return Number(n).toLocaleString('ko-KR')
  }

  /** 딜레이 (await Utils.sleep(500)) */
  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms))
  }

  /** URL 쿼리 파라미터 파싱 → 객체 */
  function parseQuery(search = location.search) {
    return Object.fromEntries(new URLSearchParams(search))
  }

  /** 객체 → URL 쿼리 문자열 */
  function buildQuery(params) {
    return '?' + new URLSearchParams(params).toString()
  }

  /** 이름 마스킹 (홍길동 → 홍*동) */
  function maskName(name) {
    if (!name || name.length < 2) return name
    if (name.length === 2) return name[0] + '*'
    return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1]
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
    // Telegram
    telegramSend,
    // 기타
    copyToClipboard, comma, sleep, parseQuery, buildQuery, maskName,
  }
})()

window.Utils = Utils
