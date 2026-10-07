/* ═══════════════════════════════════════════════════════════════════════
   rcntiger 카카오 주소·검색 모듈 — common/kakao-geo.js   (전역: KakaoGeo)
   (기존 common/kakao.js와는 별개 파일 — 이름이 겹쳐 덮어쓰지 않도록 분리)
   ───────────────────────────────────────────────────────────────────────
   · 지도 SDK 불러오기 (한 번만, 미리 받기 가능)
   · 좌표 → 주소 (도로명·지번), 주소 → 좌표, 장소(키워드) 검색
   모두 지도 SDK의 services(JS 키, 도메인 제한)로 처리 → REST 키가 필요 없다.

   사용법:
     <script src="https://rcntiger.github.io/common/keys.js?v=1"></script>
     <script src="https://rcntiger.github.io/common/kakao-geo.js?v=1"></script>
     KakaoGeo.init({ jsKey: APP_KEYS.KAKAO_JS_KEY, libraries: ['services','clusterer'] });
     KakaoGeo.preload();                         // 홈 화면 등에서 미리 받기 (선택)
     await KakaoGeo.load();                      // 지도 만들기 전에
     const a = await KakaoGeo.reverseGeocode(37.46, 126.90);   // {road, jibun}
     const p = await KakaoGeo.geocode('서울 금천구 시흥대로 73길 70'); // {lat,lng} | null
     const list = await KakaoGeo.keywordSearch('금천구청', 10);  // [{name,addr,lat,lng}]
     const docs = await KakaoGeo.keywordSearchRaw('금천구청', 10); // 카카오 원본 결과(REST documents와 같은 필드)

   다른 common 모듈을 참조하지 않는다. 키는 init에서 넘겨받는다(keys.js를 직접 읽지 않음).
   ═══════════════════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';
  var opts = { jsKey: null, libraries: ['services'], timeoutMs: 10000 };
  var sdkPromise = null, geocoder = null, places = null;

  function init(o) {
    o = o || {};
    if (o.jsKey) opts.jsKey = o.jsKey;
    if (o.libraries) opts.libraries = o.libraries;
    if (o.timeoutMs) opts.timeoutMs = o.timeoutMs;
    return KakaoGeo;
  }

  // 지도 SDK 불러오기 (여러 번 불러도 한 번만 받음, 실패하면 다음 호출에서 다시 시도)
  function load() {
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise(function (resolve, reject) {
      if (g.kakao && g.kakao.maps && g.kakao.maps.Map) { resolve(g.kakao); return; }
      if (!opts.jsKey) { reject(new Error('NO_KEY')); return; }
      var timer = setTimeout(function () { reject(new Error('TIMEOUT')); }, opts.timeoutMs);
      var s = document.createElement('script');
      s.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=' + encodeURIComponent(opts.jsKey) +
              '&autoload=false&libraries=' + opts.libraries.join(',');
      s.onerror = function () { clearTimeout(timer); reject(new Error('SCRIPT_LOAD')); };
      s.onload = function () { g.kakao.maps.load(function () { clearTimeout(timer); resolve(g.kakao); }); };
      document.head.appendChild(s);
    })['catch'](function (e) { sdkPromise = null; throw e; });
    return sdkPromise;
  }
  function preload() {
    var run = function () { load()['catch'](function () {}); };
    (g.requestIdleCallback || function (f) { setTimeout(f, 800); })(run);
  }

  // services 호출을 Promise로 (실패·결과 없음 → 빈 배열)
  function call(fn) {
    return load().then(function () {
      return new Promise(function (res) {
        try {
          fn(function (result, status) { res(status === g.kakao.maps.services.Status.OK ? (result || []) : []); });
        } catch (e) { if (g.console) console.warn('KakaoGeo:', e); res([]); }
      });
    })['catch'](function () { return []; });
  }
  function geo() { return geocoder || (geocoder = new g.kakao.maps.services.Geocoder()); }
  function plc() { return places || (places = new g.kakao.maps.services.Places()); }

  // 좌표 → {road: 도로명주소|null, jibun: 지번주소|null}
  function reverseGeocode(lat, lng) {
    return call(function (cb) { geo().coord2Address(lng, lat, cb); }).then(function (r) {
      var d = r[0];
      return d ? { road: (d.road_address && d.road_address.address_name) || null,
                   jibun: (d.address && d.address.address_name) || null }
               : { road: null, jibun: null };
    });
  }
  // 주소 검색 → [{name, addr, lat, lng}]
  function addressSearch(q, size) {
    return call(function (cb) { geo().addressSearch(q, cb, { size: size || 10 }); }).then(function (r) {
      return r.map(function (d) {
        return { name: d.address_name, addr: (d.road_address && d.road_address.address_name) || '', lat: +d.y, lng: +d.x };
      });
    });
  }
  // 장소(키워드) 검색 → [{name, addr, lat, lng}]
  function keywordSearch(q, size) {
    return call(function (cb) { plc().keywordSearch(q, cb, { size: Math.min(size || 10, 15) }); }).then(function (r) {
      return r.map(function (d) {
        return { name: d.place_name, addr: d.road_address_name || d.address_name, lat: +d.y, lng: +d.x };
      });
    });
  }
  // 카카오 원본 결과 그대로 (REST API의 documents와 같은 필드: x, y, address_name, place_name, road_address ...)
  // 기존 REST 호출 코드를 최소 수정으로 옮길 때 사용
  function addressSearchRaw(q, size) {
    return call(function (cb) { geo().addressSearch(q, cb, { size: size || 10 }); });
  }
  function keywordSearchRaw(q, size) {
    return call(function (cb) { plc().keywordSearch(q, cb, { size: Math.min(size || 10, 15) }); });
  }
  // 주소 → 좌표 (주소 검색 → 실패 시 키워드 검색). 없으면 null
  function geocode(q) {
    return addressSearch(q, 1).then(function (a) {
      if (a[0]) return { lat: a[0].lat, lng: a[0].lng };
      return keywordSearch(q, 1).then(function (k) { return k[0] ? { lat: k[0].lat, lng: k[0].lng } : null; });
    });
  }

  var KakaoGeo = {
    init: init, load: load, preload: preload,
    reverseGeocode: reverseGeocode, addressSearch: addressSearch,
    keywordSearch: keywordSearch, geocode: geocode,
    addressSearchRaw: addressSearchRaw, keywordSearchRaw: keywordSearchRaw
  };
  g.KakaoGeo = KakaoGeo;
})(window);
