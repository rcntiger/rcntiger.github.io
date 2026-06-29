# common/ - 공통 모듈 가이드

rcntiger.github.io/common/ 에 올려두고 모든 앱에서 CDN처럼 불러쓰는 공통 모듈입니다.

---

## 파일 구조

```
rcntiger.github.io/
  common/
    supabase.js    ← Supabase CRUD, Storage, keep-alive, UUID
    utils.js       ← 날짜, D-day, localStorage, 이미지 압축, Toast
    telegram.js    ← Telegram Bot 알림 (포맷 템플릿 포함)
    kakao.js       ← Kakao Maps 초기화, 마커, 클러스터, 역지오코딩, 출발지 관리
    excel.js       ← SheetJS 읽기/쓰기, KB은행 파서, field-check/apt_check 내보내기
```

---

## 각 앱에서 불러오는 방법

```html
<!-- 1. Supabase SDK (CDN) -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>

<!-- 2. 공통 모듈 -->
<script src="https://rcntiger.github.io/common/supabase.js"></script>
<script src="https://rcntiger.github.io/common/utils.js"></script>
<script src="https://rcntiger.github.io/common/telegram.js"></script>

<!-- 3. 앱별 코드 -->
<script>
  // 초기화
  SupabaseUtil.init('https://xxx.supabase.co', 'anon-key')
  TelegramUtil.init('BOT_TOKEN', 'CHAT_ID')

  // 사용
  const rows = await SupabaseUtil.select('inspections', { eq: { status: 'active' } })
  Utils.toast('로드 완료!', { type: 'success' })
</script>
```

---

## supabase.js API

| 함수 | 설명 |
|---|---|
| `init(url, key)` | 클라이언트 초기화 |
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
// 조회
const data = await SupabaseUtil.select('inspections', {
  eq: { project_id: 'abc', done: false },
  order: { column: 'created_at', ascending: false },
  limit: 50
})

// 삽입
await SupabaseUtil.insert('inspections', { name: '홍길동', status: 'done' })

// 수정
await SupabaseUtil.update('inspections', { status: 'done' }, { id: 123 })

// 삭제
await SupabaseUtil.remove('inspections', { id: 123 })

// 이미지 업로드
const { blob } = await Utils.pickAndCompress({ maxWidth: 1280, quality: 0.75 })
const publicUrl = await SupabaseUtil.uploadFile('photos', `inspections/${Utils.uuid()}.jpg`, blob)

// keep-alive
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
| `telegramSend(token, chatId, text)` | Telegram 단발 전송 |
| `copyToClipboard(text)` | 클립보드 복사 |
| `comma(n)` | 천 단위 콤마 |
| `sleep(ms)` | 딜레이 |
| `parseQuery()` | URL 파라미터 → 객체 |
| `buildQuery(params)` | 객체 → URL 파라미터 |
| `maskName(name)` | 홍길동 → 홍*동 |

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
// → SupabaseUtil.uploadFile(...)

// 토스트
Utils.toast('저장 완료!', { type: 'success' })
Utils.toast('오류 발생', { type: 'error', duration: 4000 })
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

---

---

## kakao.js API

| 함수 | 설명 |
|---|---|
| `initMap(id, options)` | 지도 초기화 (기본 중심: 금천소방서) |
| `addMarker(map, options)` | 마커 추가 (color/imageUrl/onClick) |
| `clearMarkers(markers)` | 마커 목록 일괄 제거 |
| `createClusterer(map, markers)` | 마커 클러스터러 |
| `openInfoWindow(map, marker, html)` | 인포윈도우 열기 |
| `addMapTypeControl(map)` | 일반/위성 컨트롤 |
| `addZoomControl(map)` | 줌 컨트롤 |
| `initRoadview(map, containerId)` | 로드뷰 초기화 |
| `distanceMeasure(map, onUpdate)` | 거리 측정 (start/stop/reset) |
| `moveToCurrentLocation(map)` | 현재 위치로 이동 |
| `coordToAddress(lat, lng)` | 좌표 → 도로명/지번 |
| `addressToCoord(address)` | 주소 → 좌표 |
| `createStationManager(key)` | 출발지 localStorage 관리 |

### 예시

```javascript
const map = KakaoUtil.initMap('map', { lat: 37.456, lng: 126.895, level: 5 })

// 마커
const marker = KakaoUtil.addMarker(map, {
  lat: 37.456, lng: 126.895,
  title: '점검 현장', color: 'red',
  onClick: (m) => KakaoUtil.openInfoWindow(map, m, '<div>상세정보</div>')
})

// 클러스터러
const clusterer = KakaoUtil.createClusterer(map, markers)

// 역지오코딩
const { road, jibun } = await KakaoUtil.coordToAddress(37.456, 126.895)

// 출발지 관리
const stations = KakaoUtil.createStationManager('field_stations')
const navUrl = stations.getNavUrl('s1', 37.5, 126.9, '점검대상')
```

---

## excel.js API

| 함수 | 설명 |
|---|---|
| `readFile(file, options)` | Excel → 객체 배열 (컬럼 리매핑 지원) |
| `getSheetNames(file)` | 시트 이름 목록 |
| `download(sheets, filename)` | 다중 시트 Excel 다운로드 |
| `parseKBBank(file)` | KB국민은행 거래내역 파싱 |
| `exportFieldCheck(data, filename)` | field-check 4시트 내보내기 |
| `exportAptCheck(data, filename)` | apt_check 팀별 시트 내보내기 |

### 예시

```javascript
// 읽기 + 컬럼 리매핑
const rows = await ExcelUtil.readFile(file, {
  headerRow: 1,
  colMap: { '건물명': 'building', '점검일': 'date', '담당팀': 'team' }
})

// 다중 시트 내보내기
ExcelUtil.download([
  { name: '전체', rows: allData, headers: ['dong','team','done_date'], colNames: { dong:'동', team:'팀', done_date:'완료일' } },
  { name: '미완료', rows: undone }
], '점검현황.xlsx')

// field-check 내보내기
ExcelUtil.exportFieldCheck({ project: { name: '2024 점검' }, items, done, undone }, '결과.xlsx')

// KB국민은행 파싱
const txns = await ExcelUtil.parseKBBank(file)
// → [{ date, name, amount, memo }, ...]
```

---

## 배포 방법

```bash
# common/ 폴더를 rcntiger.github.io 루트에 추가
git add common/
git commit -m "feat: 공통 모듈 추가"
git push
```

GitHub Pages 활성화 후 바로 CDN처럼 사용 가능합니다.

---

## 앱별 적용 현황

| 앱 | supabase.js | utils.js | telegram.js | kakao.js | excel.js |
|---|---|---|---|---|---|
| field-check | ✅ | ✅ | - | ✅ | ✅ |
| apt_check | ✅ | ✅ | - | ✅ | ✅ |
| coffee_order | ✅ | ✅ | - | - | - |
| 초과근무 | ✅ | ✅ | - | - | - |
| 식대정산 | - | ✅ | - | - | ✅ |
| airforce_golf | - | ✅ | ✅ | - | - |
| QuickCatchM | - | ✅ | ✅ | - | - |
| my_stocks | - | ✅ | ✅ | - | - |
