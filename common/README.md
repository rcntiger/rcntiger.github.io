# common/ - 공통 모듈 가이드

rcntiger.github.io/common/ 에 올려두고 모든 앱에서 CDN처럼 불러쓰는 공통 모듈입니다.

새 채팅에서 앱을 만들 때는 이렇게 요청하면 됩니다.
```
rcntiger.github.io/common/ 에 있는 공통 모듈(logger.js, utils.js, supabase.js,
kakao.js, kakao-ui.js, icon.js, excel.js, telegram.js)을 활용해서
[원하는 앱 설명] 만들어줘.
```

---

## 파일 구조

```
rcntiger.github.io/
  common/
    logger.js      ← 콘솔 로그 (운영/개발 환경 자동 구분)
    supabase.js    ← Supabase CRUD, Storage, keep-alive, UUID
    utils.js       ← 날짜, D-day, localStorage, 이미지 압축, Toast, 에러 핸들러, 디바이스 판별
    telegram.js    ← Telegram Bot 알림 (포맷 템플릿 포함)
    kakao.js       ← Kakao Maps 초기화, 마커, 클러스터, 역지오코딩, 출발지 관리, 길찾기
    kakao-ui.js    ← 지도 툴바 UI (검색·위성·거리재기·로드뷰·출발지·아이콘)
    icon.js        ← 커스텀 마커 아이콘 관리 (업로드/내장 아이콘/Kakao MarkerImage 변환)
    excel.js       ← Excel 읽기/쓰기/UI모달/다중필터 (SheetJS 통합)
```

### 로드 순서 (중요)

```html
<!-- 1. 외부 SDK -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
<script src="//dapi.kakao.com/v2/maps/sdk.js?appkey=YOUR_KEY&libraries=services,clusterer"></script>
<!-- excel.js는 SheetJS를 자체적으로 동적 로드하므로 별도 script 불필요 -->

<!-- 2. logger 먼저 -->
<script src="https://rcntiger.github.io/common/logger.js"></script>

<!-- 3. utils는 kakao.js보다 먼저 (openNaviApp이 Utils.isMobileApp을 사용) -->
<script src="https://rcntiger.github.io/common/utils.js"></script>

<!-- 4. 나머지 모듈 (필요한 것만) -->
<script src="https://rcntiger.github.io/common/supabase.js"></script>
<script src="https://rcntiger.github.io/common/kakao.js"></script>
<script src="https://rcntiger.github.io/common/kakao-ui.js"></script>
<script src="https://rcntiger.github.io/common/icon.js"></script>
<script src="https://rcntiger.github.io/common/excel.js"></script>
<script src="https://rcntiger.github.io/common/telegram.js"></script>
```

각 모듈은 `window.Logger`가 있으면 자동으로 사용하고, 없으면 `console`로 fallback 합니다.

---

## logger.js API

| 함수 | 설명 |
|---|---|
| `debug(...)` | localhost에서만 출력 (운영 환경 자동 숨김) |
| `info(...)`  | 정보성 로그 |
| `warn(...)`  | 경고 |
| `error(...)` | 에러 (항상 출력) |
| `setLevel(level)` | 최소 출력 레벨 설정 ('DEBUG'\|'INFO'\|'WARN'\|'ERROR') |
| `isDev` | 현재 개발 환경 여부 (boolean) |

```javascript
Logger.debug('마커 생성됨')     // localhost에서만 보임
Logger.error('저장 실패', err)  // 항상 보임
```

---

## supabase.js API

| 함수 | 설명 |
|---|---|
| `init(url, key)` | 클라이언트 초기화 (SDK 미로드 시 친절한 에러 안내) |
| `select(table, options)` | 조회 (eq/neq/order/limit) |
| `insert(table, payload)` | 삽입 |
| `update(table, payload, eq)` | 수정 |
| `remove(table, eq)` | 삭제 |
| `upsert(table, payload)` | 삽입 or 수정 |
| `uploadFile(bucket, path, blob)` | Storage 업로드 → public URL 반환 |
| `deleteFile(bucket, path)` | Storage 삭제 |
| `startKeepAlive(table, min)` | 슬립 방지 ping (기본 9분) |
| `uuid()` | UUID 생성 |

### 예시

```javascript
SupabaseUtil.init('https://xxx.supabase.co', 'anon-key')

const data = await SupabaseUtil.select('inspections', {
  eq: { project_id: 'abc', done: false },
  order: { column: 'created_at', ascending: false },
  limit: 50
})

await SupabaseUtil.insert('inspections', { name: '홍길동', status: 'done' })
await SupabaseUtil.update('inspections', { status: 'done' }, { id: 123 })
await SupabaseUtil.remove('inspections', { id: 123 })

const { blob } = await Utils.pickAndCompress({ maxWidth: 1280, quality: 0.75 })
const publicUrl = await SupabaseUtil.uploadFile('photos', `inspections/${SupabaseUtil.uuid()}.jpg`, blob)

SupabaseUtil.startKeepAlive('inspections')  // 9분마다 ping
```

---

## utils.js API

| 함수 | 설명 |
|---|---|
| `today()` | 'YYYY-MM-DD' |
| `formatDate(date)` | Date → 'YYYY-MM-DD' |
| `formatDateKo(str)` | 'YYYY-MM-DD' → 'YYYY년 MM월 DD일' |
| `dday(targetDate)` | `{ diff, label, color }` 반환 |
| `lsSet(key, value, prefix?)` | localStorage 저장 |
| `lsGet(key, default?, prefix?)` | localStorage 읽기 |
| `lsRemove(key, prefix?)` | localStorage 삭제 |
| `lsClear(prefix?)` | prefix 전체 삭제 |
| `compressImage(file, options?)` | Canvas 압축 → Blob |
| `pickAndCompress(options?)` | 카메라/갤러리 선택 + 압축 |
| `toast(msg, options?)` | 하단 토스트 메시지 |
| `handleError(err, options?)` | 에러를 콘솔+Toast+Telegram 동시 처리 |
| `telegramSend(token, chatId, text)` | Telegram 단발 전송 |
| `copyToClipboard(text)` | 클립보드 복사 |
| `comma(n)` | 천 단위 콤마 |
| `sleep(ms)` | 딜레이 |
| `parseQuery()` | URL 파라미터 → 객체 |
| `buildQuery(params)` | 객체 → URL 파라미터 |
| `maskName(name)` | 홍길동 → 홍*동 |
| `isMobileView()` | 화면 폭 ≤768px 여부 (반응형 레이아웃 분기용) [신규] |
| `isMobileApp()` | UA 기반 모바일 기기 판별 (네이티브 앱 연동용) [신규] |
| `BREAKPOINT` | 768 (isMobileView 기준값, 앱 CSS에서도 동일 기준으로 사용 권장) [신규] |

### 예시

```javascript
// D-day 뱃지
const { label, color } = Utils.dday('2025-12-31')
el.textContent = label
el.style.background = color

// localStorage (사용자별 분리)
Utils.lsSet('stations', [...], 'user_001_')
const stations = Utils.lsGet('stations', [], 'user_001_')

// 이미지 압축 업로드
const { blob } = await Utils.pickAndCompress({ capture: 'environment', quality: 0.8 })

// 토스트
Utils.toast('저장 완료!', { type: 'success' })
Utils.toast('오류 발생', { type: 'error', duration: 4000 })

// 에러를 콘솔 + Toast + Telegram 동시 처리
Utils.handleError(err, { toast: true, telegram: true, prefix: '저장 실패' })

// PC/모바일 분기 (레이아웃) [신규]
if (Utils.isMobileView()) {
  renderBottomSheet()
} else {
  renderSidebar()
}

// 모바일 기기 분기 (네이티브 앱 연동) [신규]
if (Utils.isMobileApp()) {
  location.href = 'kakaomap://route?...'
} else {
  window.open(webUrl)
}
```

---

## kakao.js API

| 함수 | 설명 |
|---|---|
| `initMap(id, options)` | 지도 초기화 (SDK 미로드 시 에러 안내, 기본 중심: 금천소방서) |
| `addMarker(map, options)` | 마커 추가 (color/imageUrl/onClick) |
| `clearMarkers(markers)` | 마커 목록 일괄 제거 |
| `createClusterer(map, markers)` | 마커 클러스터러 |
| `openInfoWindow(map, marker, html)` | 인포윈도우 열기 |
| `closeInfoWindow()` | 인포윈도우 닫기 |
| `addMapTypeControl(map)` | 일반/위성 컨트롤 |
| `addZoomControl(map)` | 줌 컨트롤 |
| `initRoadview(map, containerId)` | 로드뷰 초기화 |
| `distanceMeasure(map, onUpdate)` | 거리 측정 (start/stop/reset) |
| `moveToCurrentLocation(map)` | 현재 위치로 이동 |
| `coordToAddress(lat, lng)` | 좌표 → 도로명/지번 |
| `addressToCoord(address)` | 주소 → 좌표 |
| `createStationManager(key)` | 출발지 localStorage 관리 |
| `openNaviApp(from, to)` | 길찾기 실행. 모바일은 카카오맵 앱 딥링크 → 1.5초 후 웹 fallback, PC는 바로 웹 [신규] |

### 예시

```javascript
const map = KakaoUtil.initMap('map', { lat: 37.456, lng: 126.895, level: 5 })

const marker = KakaoUtil.addMarker(map, {
  lat: 37.456, lng: 126.895,
  title: '점검 현장', color: 'red',
  onClick: (m) => KakaoUtil.openInfoWindow(map, m, '<div>상세정보</div>')
})

const clusterer = KakaoUtil.createClusterer(map, markers)
const { road, jibun } = await KakaoUtil.coordToAddress(37.456, 126.895)

const stations = KakaoUtil.createStationManager('field_stations')
const navUrl = stations.getNavUrl('s1', 37.5, 126.9, '점검대상')

// 길찾기 실행 (모바일 앱 딥링크 + 웹 fallback 자동 처리) [신규]
KakaoUtil.openNaviApp(
  { lat: 37.4563, lng: 126.8955, name: '금천소방서' },
  { lat: 37.50,   lng: 127.03,   name: '점검대상' }
)
```

---

## kakao-ui.js API

| 함수 | 설명 |
|---|---|
| `createToolbar(map, target, options)` | 지도 툴바 한 번에 생성 |

`options`에 각 기능을 `true`/`false`/옵션객체로 지정합니다: `search`, `mapType`, `distance`, `roadview`, `station`, `icon`, `location`.

```javascript
const map = KakaoUtil.initMap('map')

KakaoUI.createToolbar(map, '#toolbar', {
  search:   true,
  mapType:  true,
  distance: true,
  roadview: true,
  station:  true,
  icon: {
    onSelect: (icon) => {
      KakaoUtil.addMarker(map, { lat, lng, imageUrl: icon.url, imageSize: icon.size })
    }
  }
})
```

---

## icon.js API

| 함수 | 설명 |
|---|---|
| `init(options)` | 설정 (bucket, storageKey, defaultSize 등) |
| `getList()` | 전체 아이콘 목록 (내장 + 커스텀) |
| `getById(id)` | id로 아이콘 조회 |
| `upload(file?, options?)` | 업로드 (파일 선택 다이얼로그 자동 표시) |
| `addByUrl(url, options)` | 외부 URL로 아이콘 등록 |
| `remove(id, deleteStorage?)` | 커스텀 아이콘 삭제 |
| `rename(id, newName)` | 아이콘 이름 수정 |
| `toMarkerImage(url, size, anchor)` | URL → Kakao MarkerImage 변환 |
| `markerImageById(id)` | id → Kakao MarkerImage (단축) |
| `renderPicker(container, options)` | 아이콘 선택 그리드 UI |

```javascript
IconUtil.init({ bucket: 'icons', storageKey: 'map_icons' })

const icon = await IconUtil.upload(null, { name: '소화전', size: [36, 36] })
const markerImage = IconUtil.toMarkerImage(icon.url, icon.size)
```

---

## telegram.js API

| 함수 | 설명 |
|---|---|
| `init(token, chatId)` | 초기화 |
| `send(text)` | 텍스트 전송 (Markdown) |
| `sendPhoto(photo, caption?)` | 사진 전송 |
| `sendTable(title, rows)` | 테이블 포맷 전송 |
| `sendGolfAlert(date, slots)` | 공군 골프 잔여티 알림 |
| `sendReserveAlert(rooms)` | 연수원 취소룸 알림 |
| `sendKospiAlert(data)` | KOSPI 경보 알림 |

```javascript
TelegramUtil.init('BOT_TOKEN', 'CHAT_ID')
await TelegramUtil.send('점검 완료! ✅')
await TelegramUtil.sendTable('잔여티 현황', rows)
```

---

## excel.js API

기존 `ExcelReader`(UI 전용)와 `ExcelUtil`(로직 전용) 두 모듈을 하나로 통합했습니다.

### SheetJS 로드 / 읽기

| 함수 | 설명 |
|---|---|
| `loadSheetJS()` | SheetJS 동적 로드 (없으면 CDN에서 자동) |
| `ACCEPT` | 지원 파일 형식 문자열 (xlsx·xls·csv·ods·tsv·html, input accept용) |
| `forwardFill(rows)` | 2D 배열 병합 셀 처리 |
| `readFile(file, options)` | Excel → 객체 배열 (UI 없이, `file.arrayBuffer()` 방식이라 FileReader 불필요) |
| `getSheetNames(file)` | 시트 이름 목록 |

### UI 모달

| 함수 | 설명 |
|---|---|
| `createReader(opts)` | UI 모달 리더 생성 (시트선택/헤더행/미리보기/컬럼매핑/다중 필터) |

`createReader` 옵션:
- `columns` : `[{ id, label, required, keywords }]`
- `onConfirm(headers, rows2d, mapping)` : 확인 버튼 클릭 시 콜백. **필터 적용된 행만 전달됨**
- `defaultHeaderRow` : 기본 헤더 행 (0-based, 1~5행 선택 가능)
- `confirmLabel` : 확인 버튼 텍스트
- `forwardFill` : 병합 셀 자동 처리 (기본 true)

**다중 필터**: `+ 필터 추가` 버튼으로 여러 컬럼을 동시에(AND 조건) 필터링 가능. 각 필터는 `값 제외` / `값만 선택` 모드 전환 가능, 값별 건수 표시.

```javascript
const reader = ExcelUtil.createReader({
  columns: [
    { id: 'addr', label: '주소', required: true,  keywords: ['주소','소재지','도로명'] },
    { id: 'team', label: '팀',   required: false, keywords: ['팀','구역','담당'] },
  ],
  confirmLabel: '배분 시작',
  forwardFill: true,
  onConfirm: (headers, rows, mapping) => {
    // rows: 필터 적용된 2D 배열
    // mapping: { addr: 2, team: 5 } (컬럼 인덱스)
    rows.forEach(r => console.log(r[mapping.addr]))
  }
})

fileInput.onchange = e => reader.open(e.target.files[0])
```

같은 모달(`reader.show()`)을 다시 띄우면 "컬럼 재설정" 화면이 됩니다. 별도의 재설정 전용 화면은 없고, 업로드 때 쓴 모달을 그대로 재사용합니다.

#### 테마 커스터마이징

모달은 CSS 변수로 색을 결정합니다. 앱 CSS에서 덮어쓰면 그대로 반영됩니다.

```css
:root {
  --excel-bg:   #ffffff;
  --excel-sur:  #f9fafb;
  --excel-tx:   #1a2233;
  --excel-mt:   #6b7280;
  --excel-bd:   #d1d5db;
  --excel-ac:   #c0392b;  /* 강조색(버튼, 헤더 등) - 앱 메인 컬러로 변경 */
  --excel-r:    8px;
}
```

### 쓰기 / 내보내기

| 함수 | 설명 |
|---|---|
| `download(sheets, filename, options)` | 다중 시트 Excel 다운로드 |
| `parseKBBank(file)` | KB국민은행 거래내역 파싱 |
| `exportFieldCheck(data, filename)` | field-check 4시트 내보내기 |
| `exportAptCheck(data, filename)` | apt_check 팀별 시트 내보내기 |

```javascript
await ExcelUtil.download([
  { name: '전체', rows: allData, headers: ['dong','team','done_date'], colNames: { dong:'동', team:'팀', done_date:'완료일' } },
  { name: '미완료', rows: undone }
], '점검현황.xlsx')

await ExcelUtil.exportFieldCheck({ project: { name: '2024 점검' }, items, done, undone }, '결과.xlsx')

const txns = await ExcelUtil.parseKBBank(file)
// → [{ date, name, amount, memo }, ...]
```

### ⚠️ 변경된 점 (기존 코드 사용 시 주의)

- `readFile()`의 `headerRow`가 **1-based → 0-based**로 변경됨 (`headerRow: 1` → `headerRow: 0`로 수정 필요)
- 다운로드/파싱 함수들이 내부적으로 `loadSheetJS()`를 호출하므로 **async 함수가 됨** (`await` 필요)

---

## PC/모바일 분기 가이드

field-check 등 PC·모바일 둘 다 쓰는 앱은 3개 레이어로 나눠서 처리합니다.

```
1. 레이아웃 전환     → CSS @media(max-width:768px)
2. UI 동작 분기       → Utils.isMobileView()  (화면 폭 기준)
3. 네이티브 앱 연동   → Utils.isMobileApp()   (기기 UA 기준)
```

기존엔 각 앱/함수마다 `window.innerWidth<=600`, `<=768`, `navigator.userAgent` 체크가 따로따로 흩어져 있어서 기준값이 들쭉날쭉했습니다. 이제 `Utils.isMobileView()`(레이아웃용)와 `Utils.isMobileApp()`(딥링크용)으로 통일해서 쓰면 됩니다. 둘은 의미가 다르므로(화면 크기 vs 기기 종류) 혼용하지 않습니다.

```css
/* 앱 CSS도 동일 기준(768px)으로 맞추기 */
@media (max-width: 768px) {
  .sidebar { display: none; }
}
```

길찾기처럼 "모바일 앱 딥링크 시도 → 웹 fallback" 패턴이 필요하면 직접 분기 코드를 작성하지 말고 `KakaoUtil.openNaviApp()`을 사용합니다.

---

## 배포 방법

GitHub 웹에서 직접 편집:
```
github.com/rcntiger/rcntiger.github.io
  → common/파일명.js 클릭
  → ✏️ 편집(연필 아이콘)
  → 내용 교체 → Commit changes
```

또는 Git으로 한 번에:
```bash
cd rcntiger.github.io
git add common/
git commit -m "feat: 공통 모듈 업데이트"
git push
```

브라우저에서 확인:
```
https://rcntiger.github.io/common/excel.js
```

---

## 앱별 적용 현황

| 앱 | logger | supabase | utils | telegram | kakao | kakao-ui | icon | excel |
|---|---|---|---|---|---|---|---|---|
| field-check | - | O | O | - | O | - | - | O (자체구현, 교체예정) |
| apt_check | - | O | O | - | O | - | - | O (자체구현, 교체예정) |
| inspection-assign | O | - | O | - | - | - | - | O (createReader 적용완료) |
| coffee_order | - | O | O | - | - | - | - | - |
| 초과근무 | - | O | O | - | - | - | - | - |
| 식대정산 | - | - | O | - | - | - | - | O |
| airforce_golf | - | - | O | O | - | - | - | - |
| QuickCatchM | - | - | O | O | - | - | - | - |
| my_stocks | - | - | O | O | - | - | - | - |

logger는 새로 추가된 모듈이라 각 앱에 직접 반영 전까지 빈 칸으로 둡니다.

---

## 최근 변경 이력

- **utils.js**: `isMobileView()`, `isMobileApp()`, `BREAKPOINT` 추가 — PC/모바일 분기 기준을 앱 전체에서 통일
- **kakao.js**: `openNaviApp()` 추가 — field-check에 중복돼 있던 길찾기(모바일 딥링크+웹 fallback) 로직을 공통화
- **excel.js**: `ExcelReader`(UI)와 `ExcelUtil`(로직)을 하나로 통합. `arrayBuffer()` 방식 전환(FileReader 제거), SheetJS 동적 로드, 병합 셀 forward fill, CSS 변수 테마(다크 고정 → 앱이 결정), 다중 컬럼 동시 필터(AND, 제외/선택 모드) 추가, 필터 select 박스가 모달 폭을 넘던 버그 수정
- **logger.js**: 신규 추가. localhost 여부로 debug 로그 자동 on/off
- **supabase.js / kakao.js / excel.js**: SDK 미로드 시 친절한 에러 메시지 안내하도록 의존성 체크 추가
- **utils.js**: `handleError()` 추가 (콘솔+Toast+Telegram 동시 처리)
- **kakao-ui.js / icon.js**: 신규 추가. 지도 툴바와 커스텀 마커 아이콘 관리 분리
