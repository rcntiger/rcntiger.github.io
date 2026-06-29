/**
 * icon.js - 카카오맵 커스텀 아이콘 관리 모듈
 * rcntiger.github.io/common/icon.js
 *
 * 역할: 커스텀 마커 이미지 업로드/관리 + Kakao MarkerImage 변환
 * 의존성: supabase.js (Storage 사용 시), kakao Maps SDK
 *
 * 사용법:
 *   <script src="https://rcntiger.github.io/common/icon.js"></script>
 *   <script>
 *     IconUtil.init({ bucket: 'icons', storageKey: 'map_icons' })
 *
 *     // 업로드
 *     const icon = await IconUtil.upload(file, { name: '소화전', size: [36, 36] })
 *
 *     // 마커에 적용
 *     const markerImage = IconUtil.toMarkerImage(icon.url, icon.size)
 *     KakaoUtil.addMarker(map, { lat, lng, imageUrl: icon.url, imageSize: icon.size })
 *   </script>
 */

const IconUtil = (() => {

  // ────────────────────────────────────────────
  // 설정
  // ────────────────────────────────────────────

  let _config = {
    bucket:     'icons',           // Supabase Storage 버킷
    storageKey: 'map_icons',       // localStorage 키
    defaultSize: [36, 36],         // 기본 마커 크기 [width, height]
    maxFileSize: 500 * 1024,       // 최대 파일 크기 (500KB)
    allowedTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'],
  }

  /**
   * 초기화
   * @param {object} options - 설정 덮어쓰기
   */
  function init(options = {}) {
    Object.assign(_config, options)
    console.log('[IconUtil] 초기화 완료')
  }

  // ────────────────────────────────────────────
  // 내장 아이콘 (기본 제공)
  // ────────────────────────────────────────────

  const BUILTIN_ICONS = [
    {
      id: 'builtin_red',
      name: '기본 (빨강)',
      url: 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png',
      size: [29, 42], anchor: [14, 42], builtin: true
    },
    {
      id: 'builtin_blue',
      name: '기본 (파랑)',
      url: 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_blue.png',
      size: [29, 42], anchor: [14, 42], builtin: true
    },
    {
      id: 'builtin_yellow',
      name: '기본 (노랑)',
      url: 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_yellow.png',
      size: [29, 42], anchor: [14, 42], builtin: true
    },
    {
      id: 'builtin_green',
      name: '기본 (초록)',
      url: 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_green.png',
      size: [29, 42], anchor: [14, 42], builtin: true
    },
  ]

  // ────────────────────────────────────────────
  // localStorage (커스텀 아이콘 목록)
  // ────────────────────────────────────────────

  function _loadCustom() {
    try {
      return JSON.parse(localStorage.getItem(_config.storageKey)) || []
    } catch { return [] }
  }

  function _saveCustom(list) {
    localStorage.setItem(_config.storageKey, JSON.stringify(list))
  }

  // ────────────────────────────────────────────
  // 아이콘 목록
  // ────────────────────────────────────────────

  /**
   * 전체 아이콘 목록 (내장 + 커스텀)
   * @returns Array<IconItem>
   *   { id, name, url, size, anchor, builtin }
   */
  function getList() {
    return [...BUILTIN_ICONS, ..._loadCustom()]
  }

  /**
   * id로 아이콘 조회
   */
  function getById(id) {
    return getList().find(i => i.id === id) || null
  }

  // ────────────────────────────────────────────
  // 업로드
  // ────────────────────────────────────────────

  /**
   * 파일 선택 다이얼로그 → 업로드 → 목록 저장
   * @param {File|null} file  - null이면 파일 선택 다이얼로그 표시
   * @param {object}    options
   *   name      : 아이콘 이름 (없으면 파일명)
   *   size      : [width, height] (기본 _config.defaultSize)
   *   anchor    : [x, y] 기준점 (기본 중앙 하단)
   *   useStorage: true면 Supabase Storage, false면 base64 (기본 true)
   * @returns Promise<IconItem>
   */
  async function upload(file = null, options = {}) {
    // 파일 선택
    if (!file) {
      file = await _pickFile()
    }

    // 유효성 검사
    if (!_config.allowedTypes.includes(file.type)) {
      throw new Error(`[IconUtil] 지원하지 않는 형식입니다. (${_config.allowedTypes.join(', ')})`)
    }
    if (file.size > _config.maxFileSize) {
      throw new Error(`[IconUtil] 파일 크기가 ${_config.maxFileSize / 1024}KB를 초과합니다.`)
    }

    const {
      name       = file.name.replace(/\.[^/.]+$/, ''),
      size       = _config.defaultSize,
      useStorage = true,
    } = options

    const anchor = options.anchor || [Math.floor(size[0] / 2), size[1]]

    // URL 결정
    let url
    if (useStorage && window.SupabaseUtil) {
      const path = `custom/${Date.now()}_${file.name}`
      url = await window.SupabaseUtil.uploadFile(_config.bucket, path, file)
    } else {
      // base64 fallback (Storage 없을 때)
      url = await _toBase64(file)
    }

    // 아이콘 등록
    const icon = {
      id:      `custom_${Date.now()}`,
      name,
      url,
      size,
      anchor,
      builtin: false,
      uploadedAt: new Date().toISOString(),
    }

    const list = _loadCustom()
    list.push(icon)
    _saveCustom(list)

    return icon
  }

  /**
   * URL로 직접 아이콘 등록 (외부 이미지 URL)
   */
  function addByUrl(url, options = {}) {
    const {
      name   = '외부 아이콘',
      size   = _config.defaultSize,
    } = options
    const anchor = options.anchor || [Math.floor(size[0] / 2), size[1]]

    const icon = {
      id:      `custom_${Date.now()}`,
      name, url, size, anchor,
      builtin: false,
      uploadedAt: new Date().toISOString(),
    }
    const list = _loadCustom()
    list.push(icon)
    _saveCustom(list)
    return icon
  }

  // ────────────────────────────────────────────
  // 삭제
  // ────────────────────────────────────────────

  /**
   * 커스텀 아이콘 삭제
   * @param {string}  id
   * @param {boolean} deleteStorage - Supabase Storage에서도 삭제 (기본 false)
   */
  async function remove(id, deleteStorage = false) {
    const list = _loadCustom()
    const icon = list.find(i => i.id === id)
    if (!icon) throw new Error(`[IconUtil] 아이콘을 찾을 수 없습니다: ${id}`)
    if (icon.builtin) throw new Error('[IconUtil] 내장 아이콘은 삭제할 수 없습니다.')

    // Storage 삭제
    if (deleteStorage && window.SupabaseUtil && !icon.url.startsWith('data:')) {
      try {
        // URL에서 path 추출
        const path = icon.url.split('/').slice(-2).join('/')
        await window.SupabaseUtil.deleteFile(_config.bucket, path)
      } catch (e) { console.warn('[IconUtil] Storage 삭제 실패:', e) }
    }

    _saveCustom(list.filter(i => i.id !== id))
  }

  /**
   * 아이콘 이름 수정
   */
  function rename(id, newName) {
    const list = _loadCustom()
    const icon = list.find(i => i.id === id)
    if (!icon) throw new Error(`[IconUtil] 아이콘을 찾을 수 없습니다: ${id}`)
    icon.name = newName
    _saveCustom(list)
    return icon
  }

  // ────────────────────────────────────────────
  // Kakao MarkerImage 변환
  // ────────────────────────────────────────────

  /**
   * 아이콘 URL → Kakao MarkerImage 객체
   * @param {string}   url
   * @param {number[]} size    - [width, height]
   * @param {number[]} anchor  - [x, y] 기준점 (기본 중앙 하단)
   * @returns kakao.maps.MarkerImage
   */
  function toMarkerImage(url, size, anchor) {
    if (!window.kakao?.maps) throw new Error('[IconUtil] Kakao Maps SDK가 로드되지 않았습니다.')
    const [w, h] = size || _config.defaultSize
    const [ax, ay] = anchor || [Math.floor(w / 2), h]

    return new kakao.maps.MarkerImage(
      url,
      new kakao.maps.Size(w, h),
      { offset: new kakao.maps.Point(ax, ay) }
    )
  }

  /**
   * IconItem → Kakao MarkerImage (getById + toMarkerImage 단축)
   * @param {string} iconId
   * @returns kakao.maps.MarkerImage | null
   */
  function markerImageById(iconId) {
    const icon = getById(iconId)
    if (!icon) return null
    return toMarkerImage(icon.url, icon.size, icon.anchor)
  }

  // ────────────────────────────────────────────
  // UI 헬퍼 - 아이콘 선택 피커
  // ────────────────────────────────────────────

  /**
   * 아이콘 선택 UI (인라인 그리드) 생성
   * @param {HTMLElement} container  - 피커를 그릴 컨테이너
   * @param {object}      options
   *   selectedId  : 현재 선택된 아이콘 id
   *   onSelect    : fn(icon) 선택 콜백
   *   onUpload    : fn(icon) 업로드 후 콜백 (null이면 업로드 버튼 숨김)
   *   onDelete    : fn(id)   삭제 후 콜백 (null이면 삭제 버튼 숨김)
   */
  function renderPicker(container, options = {}) {
    const { selectedId, onSelect, onUpload, onDelete } = options

    const icons = getList()

    container.innerHTML = `
      <style>
        .icon-picker-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
          gap: 8px; padding: 8px;
        }
        .icon-picker-item {
          display: flex; flex-direction: column; align-items: center;
          gap: 4px; padding: 6px; border-radius: 8px; cursor: pointer;
          border: 2px solid transparent; transition: border-color 0.15s;
          font-size: 11px; color: #555; text-align: center; word-break: break-all;
        }
        .icon-picker-item:hover { border-color: #4299e1; background: #ebf8ff; }
        .icon-picker-item.selected { border-color: #3182ce; background: #bee3f8; }
        .icon-picker-item img { width: 32px; height: 32px; object-fit: contain; }
        .icon-picker-actions { display: flex; gap: 6px; padding: 8px; border-top: 1px solid #eee; }
        .icon-picker-btn {
          flex: 1; padding: 6px; border: none; border-radius: 6px;
          cursor: pointer; font-size: 12px;
        }
        .icon-picker-btn.upload { background: #4299e1; color: #fff; }
        .icon-picker-btn.delete { background: #fc8181; color: #fff; }
        .icon-picker-delete-btn {
          position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.4);
          color: #fff; border: none; border-radius: 50%; width: 16px; height: 16px;
          font-size: 10px; cursor: pointer; display: none; align-items: center; justify-content: center;
        }
        .icon-picker-item:hover .icon-picker-delete-btn { display: flex; }
        .icon-picker-wrap { position: relative; }
      </style>
      <div class="icon-picker-grid" id="__icon_grid__"></div>
      <div class="icon-picker-actions">
        ${onUpload ? '<button class="icon-picker-btn upload" id="__icon_upload__">+ 아이콘 추가</button>' : ''}
      </div>
    `

    const grid = container.querySelector('#__icon_grid__')

    icons.forEach(icon => {
      const wrap = document.createElement('div')
      wrap.className = 'icon-picker-wrap'

      const item = document.createElement('div')
      item.className = 'icon-picker-item' + (icon.id === selectedId ? ' selected' : '')
      item.dataset.id = icon.id
      item.innerHTML = `<img src="${icon.url}" alt="${icon.name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><text y=%2220%22 font-size=%2220%22>📍</text></svg>'"><span>${icon.name}</span>`
      item.addEventListener('click', () => {
        grid.querySelectorAll('.icon-picker-item').forEach(el => el.classList.remove('selected'))
        item.classList.add('selected')
        if (onSelect) onSelect(icon)
      })

      wrap.appendChild(item)

      // 커스텀 아이콘만 삭제 버튼
      if (!icon.builtin && onDelete) {
        const delBtn = document.createElement('button')
        delBtn.className = 'icon-picker-delete-btn'
        delBtn.textContent = '×'
        delBtn.title = '삭제'
        delBtn.addEventListener('click', async e => {
          e.stopPropagation()
          if (!confirm(`'${icon.name}' 아이콘을 삭제할까요?`)) return
          await remove(icon.id)
          onDelete(icon.id)
          renderPicker(container, options)  // 새로고침
        })
        wrap.appendChild(delBtn)
      }

      grid.appendChild(wrap)
    })

    // 업로드 버튼
    const uploadBtn = container.querySelector('#__icon_upload__')
    if (uploadBtn) {
      uploadBtn.addEventListener('click', async () => {
        try {
          const name = prompt('아이콘 이름을 입력하세요')
          if (name === null) return
          const icon = await upload(null, { name: name || '새 아이콘' })
          if (onUpload) onUpload(icon)
          renderPicker(container, { ...options, selectedId: icon.id })
        } catch (e) {
          alert(e.message)
        }
      })
    }
  }

  // ────────────────────────────────────────────
  // 내부 헬퍼
  // ────────────────────────────────────────────

  function _pickFile() {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input')
      input.type   = 'file'
      input.accept = _config.allowedTypes.join(',')
      input.onchange = () => {
        if (input.files[0]) resolve(input.files[0])
        else reject(new Error('파일 미선택'))
      }
      input.click()
    })
  }

  function _toBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = e => resolve(e.target.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  // ────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────

  return {
    init,
    BUILTIN_ICONS,
    getList, getById,
    upload, addByUrl,
    remove, rename,
    toMarkerImage, markerImageById,
    renderPicker,
  }
})()

window.IconUtil = IconUtil
