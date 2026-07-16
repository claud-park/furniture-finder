# 가구 핏 파인더 (Furniture Fit Finder)

원하는 가구의 **최대 허용 치수**(W/D/H, mm/cm)와 가구 종류를 입력하면, 여러 쇼핑
소스에서 그 공간에 들어가는 가구를 찾아 카드로 보여주는 웹앱입니다.

- Next.js (App Router) + TypeScript + Tailwind CSS
- 모든 외부 검색은 서버 사이드 Route Handler에서 실행 (API 키 비노출, CORS 회피)
- 소스별 rate limit(최소 1초 간격), 동일 쿼리 10분 메모리 캐시, exponential backoff 재시도(최대 2회)
- **3D 쇼룸** (`/showroom`): 격자에 평면도를 그리고 3D 집으로 변환해 검색한 가구를
  실제 치수로 배치해 보는 인터랙티브 페이지 — 아래 [3D 쇼룸](#3d-쇼룸) 참고

## 실행

```bash
npm install
cp .env.example .env.local   # 필요한 키 입력 (없어도 IKEA 소스는 동작)
npm run dev
```

## 3D 쇼룸

`/showroom` 에서 집을 그리고 가구를 3D로 배치할 수 있습니다.

1. **평면도 그리기** — 24×16 격자(1칸 = 0.5m)를 클릭/드래그로 칠해 바닥을 만들고,
   벽 도구로 칸 사이 경계를 클릭해 방을 나누고, 문 도구로 벽에 개구부를 냅니다.
   외곽 벽은 바닥 윤곽에서 자동 생성됩니다.
2. **DONE → 3D 보기** — react-three-fiber로 집을 렌더링합니다 (드래그 회전,
   우클릭 팬, 스크롤 줌). 문 자리는 상인방만 남는 개구부가 됩니다.
3. **가구 배치** — 두 가지 소스:
   - *가구 검색 탭*: 기존 검색 어댑터 결과를 그대로 사용 (mm 치수 + 상품 사진).
     치수가 불완전한 상품은 직접 입력 후 배치.
   - *사진 가져오기 탭*: 사진 업로드 + 실제 치수(mm) 입력.
   - 아이템은 실측 스케일의 사진 텍스처 박스로 렌더링되고, **바닥/벽 위에만**
     배치됩니다(레이캐스트 대상이 바닥·벽 메시뿐이라 빈 공간 배치는 구조적으로 불가).
   - 선택 후 이동 / R 회전 / Del 삭제, Esc 취소. 상태는 localStorage에 저장됩니다.
4. **AI 3D 모델 (선택)** — `MESHY_API_KEY` 설정 시 아이템별 "3D 모델 생성" 버튼이
   사진을 Meshy.ai image-to-3D로 보내 GLB 메시로 교체합니다 (치수에 맞게 스케일).
   실패/미설정 시 텍스처 박스로 유지됩니다.

```
src/lib/showroom/     # 순수 코어 (격자·벽·방·지오메트리·배치 수학·직렬화) — 유닛 테스트 대상
src/lib/model3d/      # Image3DProvider 어댑터 (Meshy.ai 구현, 교체 가능)
src/components/showroom/  # FloorPlanEditor(2D), ShowroomScene(3D), FurniturePanel
src/app/api/proxy/    # 이미지/GLB 동일 출처 중계 (SSRF 가드, content-type 화이트리스트, 50MB 캡)
src/app/api/model3d/  # Meshy 프록시 (12MB 바디 캡, IP당 10회/시간 + 전역 30회/시간 rate limit)
```

> ⚠️ Meshy는 **호출당 과금되는 유료 API**이고 `/api/model3d` 는 인증이 없습니다.
> 내장 rate limit은 인스턴스별 best-effort이므로, 공개 배포에 실제 키를 넣기 전에
> 인프라 레벨 rate limit을 확인하세요.

테스트: `npm test` — 쇼룸 순수 코어 + model3d 어댑터/라우트 유닛 테스트 (vitest).

## 데이터 소스와 API 키 발급

| 소스 | 방식 | 필요한 키 |
|---|---|---|
| IKEA Korea | 공개 검색 엔드포인트 (구조화된 치수 텍스트) | 없음 |
| 쿠팡 | 쿠팡 파트너스 오픈API | `COUPANG_ACCESS_KEY`, `COUPANG_SECRET_KEY` |
| 오늘의집 / 무인양품 | Google PSE 경유 `site:` 검색 | `GOOGLE_PSE_API_KEY`, `GOOGLE_PSE_CX` |

- **쿠팡 파트너스**: <https://partners.coupang.com> 가입 → 추가수익 → Open API에서
  ACCESS/SECRET 키 발급. 키가 없으면 쿠팡 탭에 "미설정" 뱃지가 표시되고 자동 skip됩니다.
- **Google PSE**: <https://programmablesearchengine.google.com/> 에서 검색엔진 생성
  (전체 웹 검색 활성화) → CX 확인. API 키는
  <https://developers.google.com/custom-search/v1/introduction> 에서 발급.
  무료 쿼터는 100쿼리/일입니다.

> ⚠️ 오늘의집·무인양품은 ToS 이슈로 직접 크롤링하지 않고 Google PSE 검색 결과만
> 사용합니다. 따라서 치수는 제목/스니펫에서 파싱하며, 실패 시 "치수 확인 필요"
> 섹션에 표시됩니다.

## 치수 파싱

`src/lib/dimensions.ts` 공통 유틸이 상품명/설명에서 치수를 추출해 mm로 정규화합니다.

- `1200x600x750`, `1200*600*750`, `1200×600`, `120x60cm`
- `W1200 D600 H750`, `가로 120cm`, `폭 80cm`, `높이 1800mm`
- 단위 미표기 시: 400 미만이면 cm, 이상이면 mm로 추정
- 치수가 2개뿐이면 width×depth로 간주하고 confidence를 `estimated`로 표시

매칭 뱃지: ✅ 맞음(모든 제한 축 확인·통과) / ⚠️ 추정(일부 축 미확인 또는 추정 치수) /
❓ 미확인(파싱 실패 — 결과에서 제외하지 않고 "치수 확인 필요" 섹션에 표시)

## 어댑터 추가 방법

1. `src/lib/adapters/<source>.ts` 에 `SourceAdapter` 구현체 작성:

   ```ts
   import type { SourceAdapter } from "../types";
   import { cachedSourceFetch, fetchJson } from "../http";
   import { parseDimensions } from "../dimensions";

   export const mySourceAdapter: SourceAdapter = {
     id: "mysource",
     name: "마이소스",
     isConfigured: () => Boolean(process.env.MYSOURCE_API_KEY),
     async search(query) {
       const data = await cachedSourceFetch("mysource", cacheKey, () => fetchJson(url));
       return rawItems.map((raw) => {
         const parsed = parseDimensions(raw.title);
         return {
           id: `mysource-${raw.id}`,
           source: "mysource",
           title: raw.title,
           url: raw.url,
           dimensions: parsed.dimensions,
           confidence: parsed.confidence,
           rawDimensionText: parsed.raw,
         };
       });
     },
   };
   ```

2. `src/lib/types.ts` 의 `SourceId` 유니온에 id 추가
3. `src/lib/adapters/index.ts` 의 `adapters` 배열에 등록 — 탭/검색은 자동 반영

규칙: 어댑터는 치수 필터링을 하지 않고(라우트 핸들러가 허용 오차까지 반영해 판정),
파싱 실패 상품도 `confidence: "unknown"`으로 반환하며, 외부 호출은 반드시
`cachedSourceFetch`를 경유합니다(rate limit + 캐시 자동 적용).

## 안전/에티켓

- 소스별 최소 1초 간격 rate limiter, 10분 TTL 메모리 캐시
- User-Agent 명시, 재시도는 exponential backoff 최대 2회 (429/5xx만)
- robots.txt 차단 경로 미접근, IP 차단·rate limit 우회 로직 없음
