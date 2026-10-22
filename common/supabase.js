/**
 * supabase.js - 공통 Supabase 모듈
 * rcntiger.github.io/common/supabase.js
 *
 * 사용법:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
 *   <script src="https://rcntiger.github.io/common/supabase.js"></script>
 *   <script>
 *     SupabaseUtil.init('https://xxx.supabase.co', 'anon-key')
 *     const rows = await SupabaseUtil.select('inspections', { eq: { status: 'done' } })
 *   </script>
 */

// 두 번 불러오거나 앱에 같은 이름이 있어도 페이지가 멈추지 않도록 함수로 감싸고,
// 이미 SupabaseUtil가 있으면 그대로 둔다. (2026-10-23)
;(function (g) {
if (g.SupabaseUtil) return

const SupabaseUtil = (() => {
  let _client = null

  // ────────────────────────────────────────────
  // 초기화
  // ────────────────────────────────────────────

  const log = window.Logger || { debug: console.log, info: console.info, warn: console.warn, error: console.error }

  function init(url, anonKey) {
    if (!url || !anonKey) throw new Error('[SupabaseUtil] url과 anonKey가 필요합니다.')
    if (!window.supabase?.createClient) throw new Error('[SupabaseUtil] supabase-js SDK를 먼저 불러오세요.')
    _client = window.supabase.createClient(url, anonKey)
    log.info('[SupabaseUtil] 초기화 완료')
    return _client
  }

  // update/remove 조건 검사 — 조건이 비면 표 전체가 바뀌거나 지워지므로 막는다
  function _checkEq(fn, table, eq) {
    if (!eq || typeof eq !== 'object' || Object.keys(eq).length === 0) {
      throw new Error(`[SupabaseUtil] ${fn}(${table}): 조건(eq)이 비어 있어 중단했습니다. 표 전체를 바꾸려면 getClient()로 직접 쿼리하세요.`)
    }
    const undef = Object.keys(eq).filter(k => eq[k] === undefined)
    if (undef.length) log.warn(`[SupabaseUtil] ${fn}(${table}): 조건 값이 undefined입니다 → 바뀌는 행 없음:`, undef.join(', '))
  }

  function getClient() {
    if (!_client) throw new Error('[SupabaseUtil] init()을 먼저 호출하세요.')
    return _client
  }

  // ────────────────────────────────────────────
  // CRUD
  // ────────────────────────────────────────────

  /**
   * SELECT
   * @param {string} table - 테이블명
   * @param {object} options
   *   eq:      { column: value }  → .eq() 필터
   *   neq:     { column: value }  → .neq() 필터
   *   order:   { column, ascending }
   *   limit:   number
   *   columns: 'col1, col2'       → 기본 '*'
   */
  async function select(table, options = {}) {
    const { eq, neq, order, limit, columns = '*' } = options
    let query = getClient().from(table).select(columns)

    if (eq)    Object.entries(eq).forEach(([k, v]) => { query = query.eq(k, v) })
    if (neq)   Object.entries(neq).forEach(([k, v]) => { query = query.neq(k, v) })
    if (order) query = query.order(order.column, { ascending: order.ascending ?? true })
    if (limit) query = query.limit(limit)

    const { data, error } = await query
    if (error) throw new Error(`[SupabaseUtil] select(${table}): ${error.message}`)
    return data
  }

  /**
   * SELECT 전체 — 1000행씩 나눠서 끝까지 받는다
   * Supabase는 한 번에 최대 1000행만 돌려주므로(서버 설정) select()는 그 이상을 말없이 잘라낸다.
   * 행이 1000개를 넘을 수 있는 표(소화전 목록·완료 기록·이력 등)는 이 함수를 쓴다.
   * (119hyd-Map2 v3.10.1의 sbSelectAll을 공통으로 옮김 — 2026-10-23)
   * @param {string} table
   * @param {object} options - select()와 같은 eq/neq/order/columns, 그리고
   *   key      : 나눠 받는 동안 순서를 고정할 칸 (기본 'id'. id가 없는 표는 'item_id' 등 고유한 칸)
   *   pageSize : 한 번에 받을 행 수 (기본 1000)
   * @returns {Promise<Array>}
   * @example
   *   const items = await SupabaseUtil.selectAll('hydmap_items', { eq: { inspection_id: id } })
   *   const done  = await SupabaseUtil.selectAll('hydmap_done',  { eq: { inspection_id: id }, key: 'item_id' })
   */
  async function selectAll(table, options = {}) {
    const { eq, neq, order, columns = '*', key = 'id', pageSize = 1000 } = options
    const c = getClient()
    let out = []
    for (let from = 0; ; from += pageSize) {
      let q = c.from(table).select(columns)
      if (eq)  Object.entries(eq).forEach(([k, v]) => { q = q.eq(k, v) })
      if (neq) Object.entries(neq).forEach(([k, v]) => { q = q.neq(k, v) })
      if (order) q = q.order(order.column, { ascending: order.ascending ?? true })
      if (key && key !== order?.column) q = q.order(key, { ascending: true })
      const { data, error } = await q.range(from, from + pageSize - 1)
      if (error) throw new Error(`[SupabaseUtil] selectAll(${table}): ${error.message}`)
      out = out.concat(data || [])
      if (!data || data.length < pageSize) break
    }
    return out
  }

  /**
   * INSERT (단건 또는 배열)
   * @returns 삽입된 row(s)
   */
  async function insert(table, payload) {
    const { data, error } = await getClient().from(table).insert(payload).select()
    if (error) throw new Error(`[SupabaseUtil] insert(${table}): ${error.message}`)
    return data
  }

  /**
   * UPDATE
   * @param {string} table
   * @param {object} payload - 변경할 필드
   * @param {object} eq      - { column: value } 조건
   */
  async function update(table, payload, eq) {
    _checkEq('update', table, eq)
    let query = getClient().from(table).update(payload)
    Object.entries(eq).forEach(([k, v]) => { query = query.eq(k, v) })
    const { data, error } = await query.select()
    if (error) throw new Error(`[SupabaseUtil] update(${table}): ${error.message}`)
    return data
  }

  /**
   * DELETE
   * @param {string} table
   * @param {object} eq - { column: value } 조건
   */
  async function remove(table, eq) {
    _checkEq('remove', table, eq)
    let query = getClient().from(table).delete()
    Object.entries(eq).forEach(([k, v]) => { query = query.eq(k, v) })
    const { error } = await query
    if (error) throw new Error(`[SupabaseUtil] delete(${table}): ${error.message}`)
  }

  /**
   * UPSERT (insert or update)
   */
  async function upsert(table, payload, onConflict = 'id') {
    const { data, error } = await getClient()
      .from(table)
      .upsert(payload, { onConflict })
      .select()
    if (error) throw new Error(`[SupabaseUtil] upsert(${table}): ${error.message}`)
    return data
  }

  // ────────────────────────────────────────────
  // Storage (사진 업로드)
  // ────────────────────────────────────────────

  /**
   * 파일 업로드 (Canvas 압축 후 Blob)
   * @param {string} bucket  - Storage 버킷명
   * @param {string} path    - 저장 경로 (예: 'inspections/uuid.jpg')
   * @param {Blob}   blob    - 업로드할 Blob
   * @returns public URL
   */
  async function uploadFile(bucket, path, blob) {
    const { error } = await getClient().storage.from(bucket).upload(path, blob, {
      upsert: true,
      contentType: blob.type || 'image/jpeg',
    })
    if (error) throw new Error(`[SupabaseUtil] uploadFile(${bucket}/${path}): ${error.message}`)

    const { data } = getClient().storage.from(bucket).getPublicUrl(path)
    return data.publicUrl
  }

  /**
   * 파일 삭제
   */
  async function deleteFile(bucket, path) {
    const { error } = await getClient().storage.from(bucket).remove([path])
    if (error) throw new Error(`[SupabaseUtil] deleteFile: ${error.message}`)
  }

  // ────────────────────────────────────────────
  // Keep-alive (Supabase 프로젝트 슬립 방지)
  // ────────────────────────────────────────────

  /**
   * 주기적으로 ping을 보내 프로젝트가 슬립되지 않도록 유지
   * ※ 무료 플랜 일시정지는 '7일간 요청 없음' 기준이라 페이지가 열려 있는 동안의 짧은 ping은 큰 의미가 없다.
   *   GitHub Actions 등으로 하루 한 번 ping하는 쪽이 확실하다.
   * @param {string} table       - ping용 테이블 (아무 테이블이나)
   * @param {number} intervalMin - 분 단위 (기본 9분)
   */
  function startKeepAlive(table, intervalMin = 9) {
    const ms = intervalMin * 60 * 1000
    const ping = () => getClient().from(table).select('*', { head: true, count: 'exact' }).limit(1)
      .then(({ error }) => {
        if (error) log.warn(`[SupabaseUtil] keep-alive 실패 (${table}):`, error.message)
        else log.debug(`[SupabaseUtil] keep-alive ping (${table})`)
      })
      .catch(e => log.warn('[SupabaseUtil] keep-alive 실패:', e))
    ping()
    return setInterval(ping, ms)
  }

  // ────────────────────────────────────────────
  // UUID
  // ────────────────────────────────────────────

  function uuid() {
    return crypto.randomUUID
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
        })
  }

  // ────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────

  return { init, getClient, select, selectAll, insert, update, remove, upsert, uploadFile, deleteFile, startKeepAlive, uuid }
})()

g.SupabaseUtil = SupabaseUtil
})(window)
