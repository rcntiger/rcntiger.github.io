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

const SupabaseUtil = (() => {
  let _client = null

  // ────────────────────────────────────────────
  // 초기화
  // ────────────────────────────────────────────

  function init(url, anonKey) {
    if (!url || !anonKey) throw new Error('[SupabaseUtil] url과 anonKey가 필요합니다.')
    _client = window.supabase.createClient(url, anonKey)
    console.log('[SupabaseUtil] 초기화 완료')
    return _client
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
   * @param {string} table       - ping용 테이블 (아무 테이블이나)
   * @param {number} intervalMin - 분 단위 (기본 9분)
   */
  function startKeepAlive(table, intervalMin = 9) {
    const ms = intervalMin * 60 * 1000
    const ping = () => getClient().from(table).select('id').limit(1).then(() => {
      console.log(`[SupabaseUtil] keep-alive ping (${table})`)
    })
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

  return { init, getClient, select, insert, update, remove, upsert, uploadFile, deleteFile, startKeepAlive, uuid }
})()

window.SupabaseUtil = SupabaseUtil
