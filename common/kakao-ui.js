/**
 * kakao-ui.js - 카카오맵 툴바 UI 모듈
 * rcntiger.github.io/common/kakao-ui.js
 *
 * 역할: 지도 위에 올라가는 UI 컨트롤 (검색, 툴바, 아이콘 선택 등)
 * 의존성: kakao.js, icon.js (아이콘 기능 사용 시)
 *
 * 사용법:
 *   <script src="https://rcntiger.github.io/common/kakao.js"></script>
 *   <script src="https://rcntiger.github.io/common/icon.js"></script>
 *   <script src="https://rcntiger.github.io/common/kakao-ui.js"></script>
 *   <script>
 *     const map = KakaoUtil.initMap('map')
 *     KakaoUI.createToolbar(map, '#toolbar', {
 *       search:   true,
 *       mapType:  true,
 *       distance: true,
 *       roadview: true,
 *       station:  true,
 *       icon:     true,
 *     })
 *   </script>
 */

const KakaoUI = (() => {

  // ────────────────────────────────────────────
  // 공통 스타일 주입 (최초 1회)
  // ────────────────────────────────────────────

  function _injectStyle() {
    if (document.getElementById('__kakao_ui_style__')) return
    const style = document.createElement('style')
    style.id = '__kakao_ui_style__'
    style.textContent = `
      .kui-toolbar {
        display: flex; gap: 6px; flex-wrap: wrap;
        padding: 6px 8px;
        background: rgba(255,255,255,0.95);
        border-radius: 10px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.18);
        align-items: center;
      }
      .kui-btn {
        display: flex; align-items: center; gap: 4px;
        padding: 6px 10px; border: none; border-radius: 7px;
        font-size: 13px; cursor: pointer; font-weight: 500;
        background: #f0f4ff; color: #2d3a5e;
        transition: background 0.15s, color 0.15s;
        white-space: nowrap;
      }
      .kui-btn:hover  { background: #dce8ff; }
      .kui-btn.active { background: #3b82f6; color: #fff; }
      .kui-btn.danger { background: #fee2e2; color: #b91c1c; }
      .kui-divider {
        width: 1px; height: 24px; background: #d1d5db; margin: 0 2px;
      }
      /* 검색창 */
      .kui-search-wrap {
        display: flex; gap: 6px; align-items: center;
      }
      .kui-search-input {
        padding: 6px 10px; border: 1px solid #d1d5db;
        border-radius: 7px; font-size: 13px; width: 180px;
        outline: none;
      }
      .kui-search-input:focus { border-color: #3b82f6; }
      /* 패널 (출발지, 아이콘) */
      .kui-panel {
        position: absolute; top: 56px; left: 8px;
        background: #fff; border-radius: 10px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        z-index: 200; min-width: 240px; max-width: 320px;
        max-height: 400px; overflow-y: auto;
      }
      .kui-panel-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 10px 12px; border-bottom: 1px solid #f0f0f0;
        font-size: 13px; font-weight: 600; color: #374151;
      }
      .kui-panel-close {
        background: none; border: none; font-size: 16px;
        cursor: pointer; color: #9ca3af; padding: 0 4px;
      }
      /* 출발지 목록 */
      .kui-station-list { padding: 8px; }
      .kui-station-item {
        display: flex; align-items: center; justify-content: space-between;
        padding: 8px 10px; border-radius: 7px; cursor: pointer;
        font-size: 13px; color: #374151;
        transition: background 0.12s;
      }
      .kui-station-item:hover  { background: #f0f4ff; }
      .kui-station-item.active { background: #dbeafe; font-weight: 600; }
      .kui-station-del {
        background: none; border: none; color: #d1d5db;
        cursor: pointer; font-size: 15px; padding: 0 4px;
      }
      .kui-station-del:hover { color: #ef4444; }
      .kui-station-add {
        display: flex; gap: 6px; padding: 8px;
        border-top: 1px solid #f0f0f0;
      }
      .kui-station-add input {
        flex: 1; padding: 6px 8px; border: 1px solid #d1d5db;
        border-radius: 6px; font-size: 12px;
      }
      .kui-station-add button {
        padding: 6px 10px; background: #3b82f6; color: #fff;
        border: none; border-radius: 6px; font-size: 12px; cursor: pointer;
      }
      /* 거리 표시 */
      .kui-distance-badge {
        position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%);
        background: rgba(0,0,0,0.7); color: #fff;
        padding: 6px 16px; border-radius: 20px; font-size: 13px;
        z-index: 150; pointer-events: none; display: none;
      }
      /* 로드뷰 컨테이너 */
      .kui-roadview-container {
        position: absolute; top: 0; right: 0;
        width: 50%; height: 100%;
        z-index: 100; display: none;
        border-left: 3px solid #3b82f6;
      }
    `
    document.head.appendChild(style)
  }

  // ────────────────────────────────────────────
  // 툴바 생성
  // ────────────────────────────────────────────

  /**
   * 지도 툴바 생성
   * @param {kakao.maps.Map} map
   * @param {string|HTMLElement} toolbarEl - 툴바를 넣을 셀렉터 또는 엘리먼트
   * @param {object} options
   *   search   : true | { placeholder, onSearch: fn(keyword, results) }
   *   mapType  : true | false
   *   distance : true | { onUpdate: fn(meters) }
   *   roadview : true | { containerId }
   *   station  : true | { storageKey, onSelect: fn(station) }
   *   icon     : true | { onSelect: fn(icon) }
   *   location : true | false  (현재위치 버튼)
   * @returns { destroy } 툴바 제거 함수
   */
  function createToolbar(map, toolbarEl, options = {}) {
    _injectStyle()

    const container = typeof toolbarEl === 'string'
      ? document.querySelector(toolbarEl)
      : toolbarEl
    if (!container) throw new Error('[KakaoUI] 툴바 컨테이너를 찾을 수 없습니다.')

    container.classList.add('kui-toolbar')

    const cleanup = []   // 이벤트 정리 함수 목록
    let _activePanel = null

    function closePanel() {
      if (_activePanel) { _activePanel.remove(); _activePanel = null }
    }

    // ── 검색 ──────────────────────────────────
    if (options.search) {
      const cfg = options.search === true ? {} : options.search
      const wrap = document.createElement('div')
      wrap.className = 'kui-search-wrap'

      const input = document.createElement('input')
      input.className   = 'kui-search-input'
      input.placeholder = cfg.placeholder || '장소 검색'
      input.type        = 'text'

      const btn = document.createElement('button')
      btn.className   = 'kui-btn'
      btn.textContent = '🔍'
      btn.title       = '검색'

      async function doSearch() {
        const keyword = input.value.trim()
        if (!keyword) return

        const ps = new kakao.maps.services.Places()
        ps.keywordSearch(keyword, (results, status) => {
          if (status !== kakao.maps.services.Status.OK) {
            alert('검색 결과가 없습니다.')
            return
          }
          // 첫 번째 결과로 지도 이동
          const first = results[0]
          const latlng = new kakao.maps.LatLng(first.y, first.x)
          map.setCenter(latlng)
          map.setLevel(3)

          if (cfg.onSearch) cfg.onSearch(keyword, results)
        })
      }

      btn.addEventListener('click', doSearch)
      input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch() })

      wrap.appendChild(input)
      wrap.appendChild(btn)
      container.appendChild(wrap)
      container.appendChild(_divider())
      cleanup.push(() => wrap.remove())
    }

    // ── 지도 타입 (일반/위성) ─────────────────
    if (options.mapType !== false) {
      let isSatellite = false
      const btn = _btn('🗺️', '일반/위성', () => {
        isSatellite = !isSatellite
        map.setMapTypeId(isSatellite
          ? kakao.maps.MapTypeId.HYBRID
          : kakao.maps.MapTypeId.ROADMAP)
        btn.classList.toggle('active', isSatellite)
      })
      container.appendChild(btn)
    }

    // ── 거리재기 ──────────────────────────────
    if (options.distance !== false) {
      const cfg = options.distance === true ? {} : options.distance

      // 거리 뱃지 (지도 컨테이너에 추가)
      const badge = document.createElement('div')
      badge.className = 'kui-distance-badge'
      map.getNode().style.position = 'relative'
      map.getNode().appendChild(badge)

      const dm = KakaoUtil.distanceMeasure(map, meters => {
        if (meters > 0) {
          badge.style.display = 'block'
          badge.textContent = meters >= 1000
            ? `${(meters / 1000).toFixed(2)} km`
            : `${Math.round(meters)} m`
        } else {
          badge.style.display = 'none'
        }
        if (cfg.onUpdate) cfg.onUpdate(meters)
      })

      let measuring = false
      const btn = _btn('📏', '거리재기', () => {
        measuring = !measuring
        if (measuring) { dm.start(); btn.classList.add('active') }
        else           { dm.reset(); btn.classList.remove('active'); badge.style.display = 'none' }
      })
      container.appendChild(btn)
      cleanup.push(() => { dm.reset(); badge.remove() })
    }

    // ── 로드뷰 ────────────────────────────────
    if (options.roadview !== false) {
      const cfg     = options.roadview === true ? {} : options.roadview
      const rvId    = cfg.containerId || '__kui_roadview__'

      // 로드뷰 div 생성
      let rvDiv = document.getElementById(rvId)
      if (!rvDiv) {
        rvDiv = document.createElement('div')
        rvDiv.id        = rvId
        rvDiv.className = 'kui-roadview-container'
        map.getNode().appendChild(rvDiv)
      }

      const { moveTo } = KakaoUtil.initRoadview(map, rvId)
      let rvActive = false
      let rvClickListener = null

      const btn = _btn('🚶', '로드뷰', () => {
        rvActive = !rvActive
        rvDiv.style.display = rvActive ? 'block' : 'none'
        btn.classList.toggle('active', rvActive)

        if (rvActive) {
          rvClickListener = kakao.maps.event.addListener(map, 'click', e => {
            moveTo(e.latLng.getLat(), e.latLng.getLng())
          })
        } else {
          if (rvClickListener) kakao.maps.event.removeListener(rvClickListener)
        }
      })
      container.appendChild(btn)
      cleanup.push(() => { rvDiv.remove(); if (rvClickListener) kakao.maps.event.removeListener(rvClickListener) })
    }

    // ── 출발지 설정 ───────────────────────────
    if (options.station !== false) {
      const cfg      = options.station === true ? {} : options.station
      const stations = KakaoUtil.createStationManager(cfg.storageKey)
      let   selected = stations.load()[0]?.id || null

      const btn = _btn('📍', '출발지', () => {
        if (_activePanel) { closePanel(); return }
        _activePanel = _stationPanel(container, stations, selected, id => {
          selected = id
          if (cfg.onSelect) cfg.onSelect(stations.load().find(s => s.id === id))
          closePanel()
        }, () => closePanel())
      })
      container.appendChild(btn)
    }

    // ── 아이콘 선택 ───────────────────────────
    if (options.icon) {
      const cfg = options.icon === true ? {} : options.icon

      const btn = _btn('🎨', '아이콘', () => {
        if (_activePanel) { closePanel(); return }
        _activePanel = _iconPanel(container, icon => {
          if (cfg.onSelect) cfg.onSelect(icon)
          closePanel()
        }, () => closePanel())
      })
      container.appendChild(btn)
    }

    // ── 현재위치 ──────────────────────────────
    if (options.location !== false) {
      container.appendChild(_divider())
      const btn = _btn('🎯', '현재위치', async () => {
        btn.disabled = true
        try { await KakaoUtil.moveToCurrentLocation(map) }
        catch { alert('위치를 가져올 수 없습니다.') }
        finally { btn.disabled = false }
      })
      container.appendChild(btn)
    }

    return {
      destroy() {
        cleanup.forEach(fn => fn())
        container.innerHTML = ''
        container.classList.remove('kui-toolbar')
      }
    }
  }

  // ────────────────────────────────────────────
  // 출발지 패널
  // ────────────────────────────────────────────

  function _stationPanel(anchor, stations, selectedId, onSelect, onClose) {
    const panel = document.createElement('div')
    panel.className = 'kui-panel'

    function render() {
      const list = stations.load()
      panel.innerHTML = `
        <div class="kui-panel-header">
          출발지 설정
          <button class="kui-panel-close">✕</button>
        </div>
        <div class="kui-station-list">
          ${list.map(s => `
            <div class="kui-station-item ${s.id === selectedId ? 'active' : ''}" data-id="${s.id}">
              <span>📍 ${s.name}</span>
              ${s.builtin ? '' : `<button class="kui-station-del" data-del="${s.id}">×</button>`}
            </div>
          `).join('')}
        </div>
        <div class="kui-station-add">
          <input id="__kui_sta_name__" placeholder="출발지 이름" />
          <button id="__kui_sta_cur__">현위치 추가</button>
        </div>
      `

      panel.querySelector('.kui-panel-close').addEventListener('click', onClose)

      panel.querySelectorAll('.kui-station-item').forEach(el => {
        el.addEventListener('click', () => onSelect(el.dataset.id))
      })
      panel.querySelectorAll('.kui-station-del').forEach(el => {
        el.addEventListener('click', e => {
          e.stopPropagation()
          stations.remove(el.dataset.del)
          render()
        })
      })

      panel.querySelector('#__kui_sta_cur__').addEventListener('click', () => {
        if (!navigator.geolocation) return alert('위치 권한이 없습니다.')
        navigator.geolocation.getCurrentPosition(pos => {
          const name = panel.querySelector('#__kui_sta_name__').value.trim() || '현재위치'
          stations.add({ name, lat: pos.coords.latitude, lng: pos.coords.longitude })
          render()
        })
      })
    }

    render()
    anchor.parentElement?.appendChild(panel) || document.body.appendChild(panel)
    return panel
  }

  // ────────────────────────────────────────────
  // 아이콘 패널
  // ────────────────────────────────────────────

  function _iconPanel(anchor, onSelect, onClose) {
    if (!window.IconUtil) {
      alert('[KakaoUI] icon.js가 로드되지 않았습니다.')
      return null
    }

    const panel = document.createElement('div')
    panel.className = 'kui-panel'
    panel.innerHTML = `
      <div class="kui-panel-header">
        아이콘 선택
        <button class="kui-panel-close">✕</button>
      </div>
      <div id="__kui_icon_picker__"></div>
    `

    panel.querySelector('.kui-panel-close').addEventListener('click', onClose)

    IconUtil.renderPicker(
      panel.querySelector('#__kui_icon_picker__'),
      {
        onSelect: icon => onSelect(icon),
        onUpload: () => {},   // 업로드 후 자동 새로고침됨
        onDelete: () => {},
      }
    )

    anchor.parentElement?.appendChild(panel) || document.body.appendChild(panel)
    return panel
  }

  // ────────────────────────────────────────────
  // 내부 헬퍼
  // ────────────────────────────────────────────

  function _btn(icon, title, onClick) {
    const btn = document.createElement('button')
    btn.className   = 'kui-btn'
    btn.title       = title
    btn.innerHTML   = `${icon} <span>${title}</span>`
    btn.addEventListener('click', onClick)
    return btn
  }

  function _divider() {
    const d = document.createElement('div')
    d.className = 'kui-divider'
    return d
  }

  // ────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────

  return { createToolbar }
})()

window.KakaoUI = KakaoUI
