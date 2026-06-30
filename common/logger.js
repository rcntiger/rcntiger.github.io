/**
 * logger.js - 공통 Logger 모듈
 * rcntiger.github.io/common/logger.js
 *
 * ※ 가장 먼저 로드해야 합니다 (다른 모듈이 Logger를 사용하므로)
 *
 * 사용법:
 *   <script src="https://rcntiger.github.io/common/logger.js"></script>
 *   <script>
 *     Logger.info('앱 시작')
 *     Logger.warn('주의 사항')
 *     Logger.error('오류 발생', err)
 *     Logger.debug('디버그 정보')   // 로컬호스트에서만 출력
 *   </script>
 */

const Logger = (() => {
  // localhost / 127.0.0.1 / file:// 이면 개발 환경
  const isDev = ['localhost', '127.0.0.1', ''].includes(location.hostname)

  const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 }

  // 운영 환경에서는 INFO 이상만 출력
  let _minLevel = isDev ? LEVELS.DEBUG : LEVELS.INFO

  const _prefix = tag => `[${tag}] ${new Date().toTimeString().slice(0, 8)}`

  function debug(...args) {
    if (_minLevel > LEVELS.DEBUG) return
    console.debug(_prefix('DBG'), ...args)
  }

  function info(...args) {
    if (_minLevel > LEVELS.INFO) return
    console.info(_prefix('INF'), ...args)
  }

  function warn(...args) {
    if (_minLevel > LEVELS.WARN) return
    console.warn(_prefix('WRN'), ...args)
  }

  function error(...args) {
    console.error(_prefix('ERR'), ...args)
  }

  /**
   * 최소 로그 레벨 설정
   * @param {'DEBUG'|'INFO'|'WARN'|'ERROR'} level
   */
  function setLevel(level) {
    _minLevel = LEVELS[level] ?? LEVELS.INFO
  }

  return { debug, info, warn, error, setLevel, isDev }
})()

window.Logger = Logger
