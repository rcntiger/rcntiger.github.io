/* ═══════════════════════════════════════════════════════════════════════
   rcntiger 공통 설정 — common/config.js
   ───────────────────────────────────────────────────────────────────────
   여러 앱이 함께 쓰는 키·주소를 이 파일 한 곳에서 관리한다.
   키가 바뀌면 이 파일만 고치고, 각 앱의 <script src=".../config.js?v=N">에서 N을 올린다.

   ⚠ 여기에는 "브라우저에 공개돼도 되는 값"만 넣는다.
     - 카카오 JS 키: 카카오 콘솔에 등록한 도메인에서만 동작 (공개 전제)
     - Supabase anon 키: 공개 전제, 실제 권한은 RLS가 막음
     - Cloudinary: 클라우드 이름·unsigned 프리셋 (공개 전제)
     ✗ 카카오 REST 키, Supabase service_role 키, 각종 비밀번호는 절대 넣지 않는다.

   다른 common 모듈을 참조하지 않는다 (common 모듈끼리 서로 의존하지 않는 원칙).
   ═══════════════════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';
  var CONFIG = {
    VERSION: '2026-10-06',

    // 카카오 지도 (JS 키) — 웹 플랫폼 도메인: rcntiger.github.io
    KAKAO_JS_KEY: 'a5e543d870953c97c0775ff90846c81b',

    // Supabase 프로젝트 (앱마다 다른 프로젝트를 쓸 수 있어 이름으로 구분)
    SUPABASE: {
      // 소화전 점검 (119hyd-inspec, 119hyd-Map 공용)
      hydrant: {
        url: 'https://uxbbzvvkpebdvdjobnyz.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4YmJ6dnZrcGViZHZkam9ibnl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTIzNTQsImV4cCI6MjA4OTU4ODM1NH0.PvCMpxSv-B3woWKfjxEkoyv1gDdjEHZy3_lvWVrSz2E'
      }
,
      // 현장 확인 점검 지도 (inspecMap)
      inspec: {
        url: 'https://dsootbcqnifiqyajivrx.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzb290YmNxbmlmaXF5YWppdnJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMjYwMzcsImV4cCI6MjA5MTYwMjAzN30.f3b4dkWnYz02yQzsuljD3PuEq9LO7tvzzt1k_Ko9uHs'
      }
      // 다른 앱을 옮길 때 여기에 추가: 예) coffee: { url: '...', anonKey: '...' }
    },

    // Cloudinary (사진 업로드)
    CLOUDINARY: {
      cloud: 'dg4bnj8ad',
      presets: {
        hydrant: '119hyd_photos'
      }
    }
  };

  // 실수로 값이 바뀌지 않게 잠금
  (function deepFreeze(o) {
    Object.freeze(o);
    Object.keys(o).forEach(function (k) { if (o[k] && typeof o[k] === 'object') deepFreeze(o[k]); });
  })(CONFIG);

  g.CONFIG = CONFIG;
})(window);
