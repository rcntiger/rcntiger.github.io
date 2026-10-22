/**
 * kakao.js - 공통 Kakao Maps 모듈
 * rcntiger.github.io/common/kakao.js
 *
 * 사용법:
 *   <script type="text/javascript" src="//dapi.kakao.com/v2/maps/sdk.js?appkey=YOUR_KEY&libraries=services,clusterer"></script>
 *   <script src="https://rcntiger.github.io/common/kakao.js"></script>
 *   <script>
 *     const map = KakaoUtil.initMap('map', { lat: 37.5, lng: 126.9, level: 5 })
 *     KakaoUtil.addMarker(map, { lat: 37.5, lng: 126.9, title: '현장', color: 'red' })
 *   </script>
 */

// 두 번 불러오거나 앱에 같은 이름이 있어도 페이지가 멈추지 않도록 함수로 감싸고,
// 이미 KakaoUtil가 있으면 그대로 둔다. (2026-10-23)
;(function (g) {
if (g.KakaoUtil) return

const KakaoUtil = (() => {
  const log = window.Logger || { debug: console.log, warn: console.warn, error: console.error }

  function _checkSDK() {
    if (!window.kakao?.maps) throw new Error('[KakaoUtil] Kakao Maps SDK가 로드되지 않았습니다. SDK 스크립트를 먼저 로드하세요.')
  }

  // kakao.maps를 돌려주는 도우미. 생성자로 쓸 때는 반드시 new (K()).Map(...) 처럼 괄호로 감싼다.
  // (예전엔 new kakao().Map(...)로 써서 'kakao is not a constructor' 오류로 모든 기능이 동작하지 않았음 — 2026-10-23 수정)
  const K = () => { _checkSDK(); return window.kakao.maps }

  // ────────────────────────────────────────────
  // 지도 초기화
  // ────────────────────────────────────────────

  /**
   * 지도 생성
   * @param {string} containerId - div id
   * @param {object} options
   *   lat, lng: 중심 좌표 (기본: 금천소방서 — 시흥대로 342)
   *   level: 줌 레벨 (기본 5)
   * @returns kakao.maps.Map
   */
  function initMap(containerId, options = {}) {
    const {
      lat   = 37.4647,
      lng   = 126.9015,
      level = 5
    } = options

    const container = document.getElementById(containerId)
    if (!container) throw new Error(`[KakaoUtil] #${containerId} 엘리먼트를 찾을 수 없습니다.`)

    const map = new (K()).Map(container, {
      center: new (K()).LatLng(lat, lng),
      level
    })
    return map
  }

  // ────────────────────────────────────────────
  // 마커
  // ────────────────────────────────────────────

  // 팀 색상 → Kakao 마커 이미지 URL
  const MARKER_COLORS = {
    red:    'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png',
    blue:   'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_blue.png',
    yellow: 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_yellow.png',
    green:  'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_green.png',
    gray:   'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_gray.png',
  }

  /**
   * 단일 마커 생성
   * @param {kakao.maps.Map} map
   * @param {object} options
   *   lat, lng : 좌표 (필수)
   *   title    : 마커 제목
   *   color    : 'red'|'blue'|'yellow'|'green'|'gray'
   *   imageUrl : 커스텀 이미지 URL (color 대신 사용)
   *   imageSize: [width, height] (기본 [29, 42])
   *   onClick  : 클릭 핸들러 fn(marker)
   * @returns kakao.maps.Marker
   */
  function addMarker(map, options = {}) {
    const {
      lat, lng, title = '',
      color = 'red', imageUrl, imageSize = [29, 42],
      onClick
    } = options

    const position = new (K()).LatLng(lat, lng)
    const markerOptions = { map, position, title }

    const url = imageUrl || MARKER_COLORS[color]
    if (url) {
      markerOptions.image = new (K()).MarkerImage(
        url,
        new (K()).Size(...imageSize),
        { offset: new (K()).Point(imageSize[0] / 2, imageSize[1]) }
      )
    }

    const marker = new (K()).Marker(markerOptions)

    if (onClick) {
      K().event.addListener(marker, 'click', () => onClick(marker))
    }

    return marker
  }

  /**
   * 마커 목록 한번에 제거
   * @param {kakao.maps.Marker[]} markers
   */
  function clearMarkers(markers = []) {
    markers.forEach(m => m.setMap(null))
  }

  // ────────────────────────────────────────────
  // 클러스터러
  // ────────────────────────────────────────────

  /**
   * 마커 클러스터러 생성
   * @param {kakao.maps.Map} map
   * @param {kakao.maps.Marker[]} markers
   * @param {object} options
   * @returns MarkerClusterer
   */
  function createClusterer(map, markers = [], options = {}) {
    const clusterer = new (K()).MarkerClusterer({
      map,
      markers,
      gridSize:          options.gridSize          ?? 60,
      averageCenter:     options.averageCenter      ?? true,
      minLevel:          options.minLevel           ?? 4,
      disableClickZoom:  options.disableClickZoom   ?? false,
      styles: options.styles ?? [{
        width: '44px', height: '44px',
        background: 'rgba(51,102,204,0.85)',
        borderRadius: '50%',
        color: '#fff', lineHeight: '44px',
        textAlign: 'center', fontSize: '14px', fontWeight: 'bold'
      }]
    })
    return clusterer
  }

  // ────────────────────────────────────────────
  // 인포윈도우
  // ────────────────────────────────────────────

  let _activeInfoWindow = null

  /**
   * 인포윈도우 생성 + 열기
   * @param {kakao.maps.Map}    map
   * @param {kakao.maps.Marker} marker
   * @param {string}            content  - HTML 문자열
   * @param {boolean}           closeOthers - 기존 인포윈도우 닫기 (기본 true)
   * @returns kakao.maps.InfoWindow
   */
  function openInfoWindow(map, marker, content, closeOthers = true) {
    if (closeOthers && _activeInfoWindow) _activeInfoWindow.close()

    const iw = new (K()).InfoWindow({
      content,
      removable: true,
    })
    iw.open(map, marker)
    _activeInfoWindow = iw
    return iw
  }

  function closeInfoWindow() {
    if (_activeInfoWindow) {
      _activeInfoWindow.close()
      _activeInfoWindow = null
    }
  }

  // ────────────────────────────────────────────
  // 툴바 (로드뷰 / 위성 / 거리측정)
  // ────────────────────────────────────────────

  /**
   * 지도 타입 컨트롤 추가 (일반/위성)
   * @param {kakao.maps.Map} map
   * @param {string} position - 'TOPRIGHT'|'TOPLEFT'|'BOTTOMRIGHT' 등
   */
  function addMapTypeControl(map, position = 'TOPRIGHT') {
    const ctrl = new (K()).MapTypeControl()
    map.addControl(ctrl, K().ControlPosition[position])
    return ctrl
  }

  /**
   * 줌 컨트롤 추가
   */
  function addZoomControl(map, position = 'RIGHT') {
    const ctrl = new (K()).ZoomControl()
    map.addControl(ctrl, K().ControlPosition[position])
    return ctrl
  }

  /**
   * 로드뷰 도로뷰 토글
   * @param {kakao.maps.Map} map
   * @param {string}         containerId - 로드뷰 div id
   * @returns { roadview, roadviewClient }
   */
  function initRoadview(map, containerId) {
    const container   = document.getElementById(containerId)
    const roadview    = new (K()).Roadview(container)
    const rvClient    = new (K()).RoadviewClient()

    function moveTo(lat, lng) {
      const pos = new (K()).LatLng(lat, lng)
      rvClient.getNearestPanoId(pos, 50, panoId => {
        if (panoId) roadview.setPanoId(panoId, pos)
        else log.warn('[KakaoUtil] 근처에 로드뷰가 없습니다:', lat, lng)
      })
    }

    return { roadview, roadviewClient: rvClient, moveTo }
  }

  // ────────────────────────────────────────────
  // 거리 측정 폴리라인
  // ────────────────────────────────────────────

  /**
   * 거리 측정 모드 시작/종료 토글
   * @param {kakao.maps.Map} map
   * @param {function} onUpdate - fn(totalMeters) 거리 갱신 콜백
   * @returns { start, stop, reset }
   */
  function distanceMeasure(map, onUpdate) {
    // 상태를 이 함수 안에 둔다 (예전엔 모듈 전체가 하나를 같이 써서 지도가 둘이면 섞였음)
    let _distanceLine = null, _distanceDots = [], _distanceTotal = 0, _distanceActive = false
    let clickListener, moveListener

    function start() {
      if (_distanceActive) return
      _distanceActive = true
      _distanceLine = new (K()).Polyline({
        map,
        strokeWeight: 3,
        strokeColor:  '#db4040',
        strokeOpacity: 1,
        strokeStyle: 'solid'
      })

      clickListener = K().event.addListener(map, 'click', e => {
        const path = _distanceLine.getPath()
        path.push(e.latLng)
        _distanceLine.setPath(path)
        _distanceTotal = _distanceLine.getLength()
        if (onUpdate) onUpdate(_distanceTotal)

        const dot = new (K()).Marker({
          map,
          position: e.latLng,
          image: new (K()).MarkerImage(
            'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/redballs.png',
            new (K()).Size(10, 10)
          )
        })
        _distanceDots.push(dot)
      })
    }

    function stop() {
      if (!_distanceActive) return
      _distanceActive = false
      if (clickListener) K().event.removeListener(clickListener)
      if (moveListener)  K().event.removeListener(moveListener)
    }

    function reset() {
      stop()
      if (_distanceLine) { _distanceLine.setMap(null); _distanceLine = null }
      _distanceDots.forEach(d => d.setMap(null))
      _distanceDots  = []
      _distanceTotal = 0
      if (onUpdate) onUpdate(0)
    }

    return { start, stop, reset }
  }

  // ────────────────────────────────────────────
  // 현재 위치
  // ────────────────────────────────────────────

  /**
   * 현재 위치 가져오기 → 지도 이동
   * @param {kakao.maps.Map} map
   * @param {object} options
   *   level   : 이동 후 줌 레벨 (기본 3)
   *   marker  : true면 현재위치 마커 표시
   * @returns Promise<{ lat, lng }>
   */
  function moveToCurrentLocation(map, options = {}) {
    const { level = 3, marker = true } = options
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Geolocation 미지원'))
      navigator.geolocation.getCurrentPosition(pos => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        const latlng = new (K()).LatLng(lat, lng)
        map.setCenter(latlng)
        map.setLevel(level)
        if (marker) {
          addMarker(map, { lat, lng, title: '현재 위치', color: 'blue' })
        }
        resolve({ lat, lng })
      }, reject, { enableHighAccuracy: true, timeout: 10000 })
    })
  }

  // ────────────────────────────────────────────
  // 역지오코딩 (좌표 → 주소)
  // ────────────────────────────────────────────

  /**
   * 좌표 → 도로명/지번 주소
   * @param {number} lat
   * @param {number} lng
   * @returns Promise<{ road, jibun }>
   */
  function coordToAddress(lat, lng) {
    return new Promise((resolve, reject) => {
      const geocoder = new (K()).services.Geocoder()
      geocoder.coord2Address(lng, lat, (result, status) => {
        if (status !== K().services.Status.OK) return reject(new Error('주소 변환 실패'))
        const r = result[0]
        resolve({
          road:  r.road_address ? r.road_address.address_name  : '',
          jibun: r.address      ? r.address.address_name       : ''
        })
      })
    })
  }

  /**
   * 주소 → 좌표 (지오코딩)
   * @param {string} address
   * @returns Promise<{ lat, lng }>
   */
  function addressToCoord(address) {
    return new Promise((resolve, reject) => {
      const geocoder = new (K()).services.Geocoder()
      geocoder.addressSearch(address, (result, status) => {
        if (status !== K().services.Status.OK) return reject(new Error('좌표 변환 실패'))
        resolve({ lat: parseFloat(result[0].y), lng: parseFloat(result[0].x) })
      })
    })
  }

  // ────────────────────────────────────────────
  // 출발지(STATIONS) 관리 (field-check 패턴)
  // ────────────────────────────────────────────

  /**
   * 출발지 목록 localStorage 관리
   * @param {string} storageKey - 기본 'kakao_stations'
   */
  function createStationManager(storageKey = 'kakao_stations') {
    // 좌표는 도로명 주소로 확인한 값 (이름으로 검색하면 엉뚱한 곳이 잡혀 주소로 고정 — field-check와 같은 값)
    const DEFAULT_STATIONS = [
      { id: 's1', name: '금천소방서',     addr: '서울 금천구 시흥대로 342',    lat: 37.4647, lng: 126.9015 },
      { id: 's2', name: '시흥119안전센터', addr: '서울 금천구 시흥대로45길 31', lat: 37.4447, lng: 126.9089 },
    ]

    function load() {
      try {
        return JSON.parse(localStorage.getItem(storageKey)) || DEFAULT_STATIONS
      } catch { return DEFAULT_STATIONS }
    }

    function save(stations) {
      try { localStorage.setItem(storageKey, JSON.stringify(stations)) }
      catch (e) { log.warn('[KakaoUtil] 출발지 저장 실패:', e) }
    }

    function add(station) {
      const list = load()
      station.id = station.id || `s${Date.now()}`
      list.push(station)
      save(list)
      return list
    }

    function remove(id) {
      const list = load().filter(s => s.id !== id)
      save(list)
      return list
    }

    /**
     * 출발지 → 목적지 카카오맵 길찾기 URL
     */
    function getNavUrl(stationId, destLat, destLng, destName = '') {
      const station = load().find(s => s.id === stationId)
      if (!station) return ''
      return `https://map.kakao.com/link/from/${encodeURIComponent(station.name)},${station.lat},${station.lng}/to/${encodeURIComponent(destName)},${destLat},${destLng}`
    }

    return { load, save, add, remove, getNavUrl, DEFAULT_STATIONS }
  }

  // ────────────────────────────────────────────
  // 길찾기 (모바일 앱 딥링크 + 웹 fallback)
  // ────────────────────────────────────────────

  /**
   * 카카오맵 길찾기 실행. 모바일이면 네이티브 앱(kakaomap://)으로 시도 후
   * 1.5초 뒤 웹(map.kakao.com)으로 fallback, PC면 바로 웹으로 연결
   * @param {object} from - { lat, lng, name }
   * @param {object} to   - { lat, lng, name }
   * @example
   *   KakaoUtil.openNaviApp(
   *     { lat: 37.4563, lng: 126.8955, name: '금천소방서' },
   *     { lat: 37.50, lng: 127.03, name: '점검대상' }
   *   )
   */
  function openNaviApp(from, to) {
    const isMobile = window.Utils
      ? window.Utils.isMobileApp()
      : /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

    const sp = `${encodeURIComponent(from.name || '')},${from.lat},${from.lng}`
    const ep = `${encodeURIComponent(to.name || '')},${to.lat},${to.lng}`
    const webUrl = `https://map.kakao.com/link/by/car/${sp}/${ep}`

    if (isMobile) {
      const naviUrl = `kakaomap://route?sp=${from.lat},${from.lng}&ep=${to.lat},${to.lng}&by=CAR`
      const el = document.createElement('a')
      el.href = naviUrl
      el.style.display = 'none'
      // 카카오맵 앱이 열려 화면이 숨겨지면 웹 대체 열기를 취소 (예전엔 앱과 웹이 둘 다 열렸음)
      let appOpened = false
      const onHide = () => { if (document.hidden) appOpened = true }
      document.addEventListener('visibilitychange', onHide)
      document.body.appendChild(el)
      el.click()
      document.body.removeChild(el)
      setTimeout(() => {
        document.removeEventListener('visibilitychange', onHide)
        if (!appOpened && !document.hidden) window.open(webUrl, '_blank')
      }, 1500)
    } else {
      window.open(webUrl, '_blank')
    }
  }

  // ────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────

  return {
    initMap,
    addMarker, clearMarkers, MARKER_COLORS,
    createClusterer,
    openInfoWindow, closeInfoWindow,
    addMapTypeControl, addZoomControl,
    initRoadview,
    distanceMeasure,
    moveToCurrentLocation,
    coordToAddress, addressToCoord,
    createStationManager,
    openNaviApp,
  }
})()

g.KakaoUtil = KakaoUtil
})(window)
