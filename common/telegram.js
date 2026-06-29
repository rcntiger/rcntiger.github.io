/**
 * telegram.js - 공통 Telegram 알림 모듈
 * rcntiger.github.io/common/telegram.js
 *
 * 사용법:
 *   <script src="https://rcntiger.github.io/common/telegram.js"></script>
 *   <script>
 *     TelegramUtil.init('BOT_TOKEN', 'CHAT_ID')
 *     await TelegramUtil.send('점검 완료! ✅')
 *     await TelegramUtil.sendTable('잔여티 현황', rows)
 *   </script>
 */

const TelegramUtil = (() => {
  let _token  = null
  let _chatId = null

  const BASE = 'https://api.telegram.org/bot'

  // ────────────────────────────────────────────
  // 초기화
  // ────────────────────────────────────────────

  function init(botToken, chatId) {
    _token  = botToken
    _chatId = chatId
    console.log('[TelegramUtil] 초기화 완료')
  }

  function _check() {
    if (!_token || !_chatId) throw new Error('[TelegramUtil] init()을 먼저 호출하세요.')
  }

  // ────────────────────────────────────────────
  // 메시지 전송
  // ────────────────────────────────────────────

  /**
   * 텍스트 메시지 전송 (Markdown 지원)
   * @param {string} text
   * @param {object} extra - 추가 파라미터 (disable_notification 등)
   */
  async function send(text, extra = {}) {
    _check()
    const res = await fetch(`${BASE}${_token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: _chatId, text, parse_mode: 'Markdown', ...extra })
    })
    if (!res.ok) throw new Error(`[TelegramUtil] 전송 실패: ${res.status}`)
    return res.json()
  }

  /**
   * 사진 전송 (URL 또는 Blob)
   * @param {string|Blob} photo
   * @param {string}      caption
   */
  async function sendPhoto(photo, caption = '') {
    _check()
    let body, headers = {}

    if (typeof photo === 'string') {
      // URL
      body = JSON.stringify({ chat_id: _chatId, photo, caption, parse_mode: 'Markdown' })
      headers['Content-Type'] = 'application/json'
    } else {
      // Blob/File
      const fd = new FormData()
      fd.append('chat_id', _chatId)
      fd.append('photo', photo, 'photo.jpg')
      if (caption) fd.append('caption', caption)
      fd.append('parse_mode', 'Markdown')
      body = fd
    }

    const res = await fetch(`${BASE}${_token}/sendPhoto`, { method: 'POST', headers, body })
    if (!res.ok) throw new Error(`[TelegramUtil] 사진 전송 실패: ${res.status}`)
    return res.json()
  }

  // ────────────────────────────────────────────
  // 포맷 헬퍼
  // ────────────────────────────────────────────

  /**
   * 테이블 형식 메시지 전송
   * @param {string}   title
   * @param {Array}    rows  - [{ label, value }, ...]
   */
  async function sendTable(title, rows) {
    const lines = [`*${title}*`, '```']
    rows.forEach(({ label, value }) => {
      lines.push(`${label.padEnd(10)} ${value}`)
    })
    lines.push('```')
    return send(lines.join('\n'))
  }

  /**
   * 공군 골프 잔여티 알림 포맷
   * @param {string} date
   * @param {Array}  slots - [{ time, course, remain }, ...]
   */
  async function sendGolfAlert(date, slots) {
    if (!slots.length) return
    const lines = [`⛳ *잔여티 발생* (${date})`, '```']
    slots.forEach(s => lines.push(`${s.time}  ${s.course}  잔여${s.remain}팀`))
    lines.push('```')
    return send(lines.join('\n'))
  }

  /**
   * 연수원 예약 취소룸 알림 포맷
   * @param {Array} rooms - [{ date, roomType, count }, ...]
   */
  async function sendReserveAlert(rooms) {
    if (!rooms.length) return
    const lines = [`🏨 *연수원 취소룸 발생*`, '```']
    rooms.forEach(r => lines.push(`${r.date}  ${r.roomType}  ${r.count}실`))
    lines.push('```')
    return send(lines.join('\n'))
  }

  /**
   * KOSPI 경보 알림 포맷
   * @param {object} data - { index, change, changeRate, threshold }
   */
  async function sendKospiAlert(data) {
    const { index, change, changeRate, threshold } = data
    const sign  = change >= 0 ? '▲' : '▼'
    const emoji = changeRate <= -3 ? '🚨' : changeRate <= -1 ? '⚠️' : '📊'
    return send(
      `${emoji} *KOSPI 경보*\n` +
      `지수: \`${index.toFixed(2)}\`\n` +
      `등락: \`${sign}${Math.abs(change).toFixed(2)} (${changeRate.toFixed(2)}%)\`\n` +
      `기준: \`${threshold}% 이하\``
    )
  }

  // ────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────

  return { init, send, sendPhoto, sendTable, sendGolfAlert, sendReserveAlert, sendKospiAlert }
})()

window.TelegramUtil = TelegramUtil
