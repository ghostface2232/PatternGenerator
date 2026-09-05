# PatternGenerator 개선 로드맵

기준일: 2026-09-04
레퍼런스: SolidVents (https://solidvents.com)
브랜치: claude/pattern-generator-improvement-0su6hj

이 문서는 현재의 Perf Pattern Generator를 SolidVents 수준의 범용 파라메트릭 패턴 도구로 끌어올리기 위한 단계별 실행 계획입니다. 각 단계는 독립적으로 머지 가능한 PR 단위로 쪼개져 있으며, 단계마다 산출 파일, 데이터 모델, 완료 기준을 명시합니다.

참고: 이 계획을 세운 세션에서는 solidvents.com 도메인이 네트워크 프록시에 의해 차단되어 있었습니다. 레퍼런스 분석은 SolidVents의 랜딩, FAQ, Pricing, Guides, Patterns 페이지가 검색 엔진에 노출한 본문과 Behance 소개 글을 근거로 했습니다. 실제 에디터를 직접 조작해 확인한 내용은 아니므로, Phase 0 착수 전에 민관 님이 에디터를 30분 정도 직접 사용해 보고 아래 격차 표에서 틀린 항목을 바로잡아 주시기 바랍니다.

## 1. 현황 진단

### 1.1 현재 프로젝트가 가진 것

- 홀 형상 6종 (Circle, Rectangle, Pill, Hexagon, Diamond, Triangle)과 모서리 반경, 정밀한 면적 및 리거먼트 계산
- 패턴 5종 (Straight, Staggered 60°, Staggered 45°, Radial 3종, Custom Angle)과 심리스 타일링 3종
- DIN 24041 프리셋, 판 두께 및 테이퍼 모델링, 표면 OAR과 유효 OAR 구분
- 다층 스칼라 필드 기반 크기 변조 (variation-engine.js)와 캔버스 위 기즈모 편집, 변조 전용 undo/redo
- mm 단위 치수가 정확한 SVG와 PNG 내보내기, PWA 오프라인 동작
- 순수 수학 모듈 두 개에 대한 node --test 단위 테스트

이 도구의 강점은 제조 정확성입니다. OAR, 최소 리거먼트, 테이퍼에 따른 폐공 경고 같은 기능은 SolidVents에 없거나 약합니다. 개선 과정에서 이 강점을 훼손하지 않는 것이 첫 번째 원칙입니다.

### 1.2 SolidVents가 가진 것

- 레이아웃 모드 9종: random scatter, grid, path, spiral, concentric, Fibonacci, cross-hatch, Voronoi stone cracks, flow lines
- 모든 모드가 동일한 boundary, shapes, gradient controllers를 읽으므로 모드 전환이 한 번의 클릭으로 끝남
- 캔버스 위에 직접 놓는 컨트롤러 (point, line, curve, polyline, image)가 Size, Spacing, Angle, Shape 네 채널을 각각 독립적으로 구동함
- 컨트롤러 고급 옵션: hard edge, single-side falloff, 한 컨트롤러의 지오메트리를 다른 채널과 동기화
- 이미지 컨트롤러: 사진의 밝기가 홀 크기, 간격, 회전, 형상 모핑을 구동 (halftone)
- 커스텀 홀 형상 편집기: 외곽선을 그리고 레이어로 쌓아 union, subtract, normal 불리언 역할을 부여
- 내보내기: SVG, DXF, STEP. Pro 기능으로 STP Split (대량 홀을 여러 블록으로 분할), Draft Angle on STP solids, Shape Morphing gradient
- 템플릿 라이브러리 (Patterns 페이지), 클라우드 저장소, 마켓플레이스 프리셋, 가이드 문서, 다국어 페이지
- 사업 모델: 무료 (하루 3회 내보내기), Pro 연 49달러

### 1.3 격차 표

| 영역 | 현재 | SolidVents | 격차 등급 |
| --- | --- | --- | --- |
| 레이아웃 모드 | 격자 계열 4종 + Radial 3종 | 9종, 비정형 포함 | 큼 |
| 필드 제어 | 사전 정의된 공간 × 프로파일 레이어, 채널은 Size 하나 | 자유 배치 컨트롤러, 4채널 | 큼 |
| 이미지 기반 제어 | 없음 | 있음 | 큼 |
| 경계 형상 | 직사각형 + 모서리 반경 | 임의 외곽선 | 큼 |
| 커스텀 홀 형상 | 6종 고정 | 사용자 정의 + 불리언 | 큼 |
| 내보내기 | SVG, PNG | SVG, DXF, STEP | 큼 |
| 프로젝트 저장, 공유 | 없음 (새로고침 시 소실) | 클라우드 저장 | 중간 |
| 템플릿 갤러리 | DIN 프리셋 드롭다운 | 커뮤니티 템플릿 라이브러리 | 중간 |
| 대량 홀 성능 | 10,000개 이상은 축소 렌더 | 대량 STP 분할 옵션 존재 | 중간 |
| 제조 통계 | OAR, 리거먼트, 테이퍼 | 거의 없음 | 우위 |
| 코드 구조 | 단일 2,737줄 컴포넌트 | 알 수 없음 | 내부 부채 |

## 2. 목표와 원칙

목표: 2026년 말까지 레이아웃 9종, 4채널 컨트롤러, 이미지 제어, 임의 경계, DXF 및 STEP 내보내기, URL 공유를 갖춘 브라우저 도구를 GitHub Pages에 배포한다.

원칙:

1. 백엔드를 두지 않는다. 계정, 결제, 클라우드 저장, 마켓플레이스, 일일 내보내기 제한은 범위 밖이다. 저장은 localStorage, 파일, URL 해시로 해결한다.
2. 제조 정확성을 유지한다. 새 레이아웃 모드와 컨트롤러가 추가되어도 OAR, 리거먼트, 테이퍼 통계는 계속 정확해야 한다.
3. 순수 수학은 .js 모듈로 분리하고 node --test로 검증한다. UI가 있는 .jsx는 Playwright 스모크 테스트로 검증한다.
4. 각 Phase는 머지 가능한 PR 여러 개로 나눈다. 한 PR이 500줄 diff를 넘기지 않도록 노력한다.
5. docs/ 빌드 결과물은 CI가 검증하되, 커밋은 기존 관례대로 소스와 함께 한다.

## 3. Phase 0: 기반 정비 (선행 조건)

현재 perforation-generator.jsx 한 파일에 지오메트리, 생성, 렌더, 상태, UI가 모두 들어 있어 이후 Phase를 안전하게 진행할 수 없습니다. 기능 추가 없이 구조만 바꾸는 단계입니다.

### 3.1 모듈 분할

목표 디렉터리 구조:

```
src/
  core/
    document.js          문서 스키마, 기본값, 마이그레이션 (schemaVersion)
    units.js             mm/inch 변환, 반올림 유틸
    rng.js               시드 고정 난수 (mulberry32)
  geometry/
    shapes/              circle.js rect.js pill.js hexagon.js polygon.js index.js
    boundary.js          경계 형상 (Phase 4에서 확장)
    ligament.js          calcShapeGap, findOverlaps, calcMinLigament
    area.js              calcHoleArea, estimateVisibleHoleArea, OAR
  layouts/
    index.js             레이아웃 레지스트리 (Phase 3에서 확장)
    grid.js              Straight, Staggered, Custom Angle
    tilings.js           honeycomb, triangle, diamond lattice
    radial.js            기존 radial-engine.js 이동
  fields/
    variation-engine.js  기존 파일 이동
    controllers.js       Phase 2
  export/
    svg.js               generateSVGString 이동
    png.js
    dxf.js               Phase 5
    step.js              Phase 5
  render/
    canvas-renderer.js   순수 그리기 함수 (ctx, doc, viewport) → void
    hud.js
  ui/
    App.jsx
    controls/            SliderRow.jsx Toggle.jsx Select.jsx ColorField.jsx SegBtn.jsx
    panels/              PatternPanel.jsx DimensionsPanel.jsx VariationPanel.jsx TaperPanel.jsx ExportPanel.jsx
    canvas/              Canvas.jsx (포인터, 줌, 팬), Gizmos.jsx
    theme.js             색상 토큰 (dark boolean → 토큰 객체)
  main.jsx
```

작업 순서: 순수 함수부터 옮기고, 각 이동마다 import 경로만 바꿔 동작이 동일함을 확인합니다. 형상별 분기 함수 7개 (calcHoleArea, traceHolePath, holeSVGElement, isPointInsideHole, checkShapeOverlap, calcShapeGap, estimateVisibleHoleArea)는 shapes/index.js의 형상 객체 인터페이스로 통합합니다.

```js
// geometry/shapes/index.js
export const SHAPES = {
  Circle: { area(p), trace(ctx, p), svg(p), contains(px, py, p), gap(a, b), vertices(p) },
  ...
};
```

### 3.2 상태 모델 통합

현재 40여 개의 useState를 하나의 문서 객체와 리듀서로 통합합니다. 이것이 Phase 1의 저장, 공유, 전역 undo/redo의 전제입니다.

```js
// core/document.js
export const DOC_SCHEMA_VERSION = 1;
export function createDocument() {
  return {
    schemaVersion: 1,
    units: "mm",
    sheet: { w: 200, h: 200, thickness: 0 },
    boundary: { type: "rect", margins: { t: 0, r: 0, b: 0, l: 0 }, cornerRadius: 0 },
    hole: { shape: "Circle", w: 5, h: 5, cornerRadius: 0, options: {} },
    layout: { mode: "staggered60", params: { gapX: 3, gapY: 3, linked: true } },
    fields: { size: [], spacing: [], angle: [], shape: [] },   // Phase 2
    taper: { angle: 0, direction: "Top larger" },
    removedHoles: [],
    appearance: { holeColor: "#141418", bgColor: "#c8c8cd" },
    meta: { name: "Untitled", createdAt, updatedAt }
  };
}
```

UI 전용 상태 (dark, zoom, pan, 편집 모드, HUD 표시)는 문서에 넣지 않고 별도 useReducer로 둡니다.

### 3.3 개발 도구

- ESLint (eslint:recommended + react-hooks)와 Prettier 도입, npm run lint 추가
- Playwright 스모크 테스트 추가: 앱 로드, 기본 패턴에서 홀 수 739와 OAR 35.4 확인, 심리스 타일링 gap 0에서 OAR 100.0 확인, SVG 내보내기 문자열 검증. 저장소에 이미 Chromium이 있으므로 npm run test:e2e로 실행
- GitHub Actions 워크플로: lint, test, test:e2e, build, 그리고 빌드된 docs/가 커밋된 docs/와 일치하는지 diff 검사
- AGENTS.md와 README.md를 새 구조에 맞게 갱신

완료 기준: 기능 변화 없이 모든 기존 동작이 동일하고, 스모크 테스트가 통과하며, perforation-generator.jsx가 삭제됩니다.

예상 규모: PR 5-7개.

## 4. Phase 1: 프로젝트 저장, 공유, 전역 undo/redo

SolidVents의 클라우드 저장소를 백엔드 없이 대체하는 단계입니다.

### 4.1 기능

- 자동 저장: 문서가 바뀔 때마다 300ms 디바운스로 localStorage에 저장하고, 앱 시작 시 복원. 최근 문서 10개까지 목록 유지
- 파일 저장 및 열기: .perf.json 형식으로 다운로드 및 드래그 앤 드롭 열기. schemaVersion에 따른 마이그레이션 함수 체인
- URL 공유: 문서를 JSON → lz-string compressToEncodedURIComponent → location.hash로 인코딩. 링크를 열면 그대로 복원. 이미지 컨트롤러 (Phase 2)는 URL에 넣지 않고 경고 표시
- 전역 undo/redo: 기존 변조 전용 히스토리를 문서 전체 히스토리로 대체. Ctrl+Z, Ctrl+Shift+Z. 슬라이더 드래그 중에는 커밋하지 않고 pointerup 시 한 번만 커밋
- 문서 이름 편집과 내보내기 파일명 반영 (예: speaker_grille_v2.svg)

### 4.2 산출 파일

- src/core/persistence.js (serialize, deserialize, migrate, toShareURL, fromShareURL)
- src/core/history.js (push, undo, redo, 병합 규칙)
- src/ui/panels/ProjectMenu.jsx
- 테스트: persistence.test.js에서 라운드트립과 마이그레이션 검증

완료 기준: 새로고침 후 작업이 유지되고, 공유 링크를 시크릿 창에서 열었을 때 동일한 홀 수와 OAR이 나옵니다.

예상 규모: PR 3개.

## 5. Phase 2: 컨트롤러 기반 4채널 필드 시스템

상태 (2026-09-05): 대부분 구현. 산출물은 src/fields/controllers.js, src/fields/image-map.js, src/fields/controller-gizmo.js, src/geometry/superellipse.js, src/ui/panels/FieldsPanel.jsx, src/ui/canvas/ToolRail.jsx, src/ui/useImageMaps.js이며 문서 스키마는 2로 올렸습니다.

Size, Angle, Shape 채널이 point, line, curve, polyline, image 컨트롤러로 동작하고, 파일 저장과 URL 공유에 포함되며(이미지 데이터는 파일에만), 캔버스 핸들과 채널 히트맵으로 편집됩니다.

크게 남긴 항목은 두 가지입니다.

- Spacing 채널: 데이터 모델, 검증, 저장, 평가까지 모두 있지만 읽는 쪽이 없습니다. 이 채널만은 홀의 위치를 바꾸므로 레이아웃의 몫이고, 그것이 Phase 3의 인터페이스가 fields를 인자로 받는 이유입니다. 아무 일도 하지 않는 도구를 UI에 노출하는 편이 더 나쁘므로 EDITABLE_CHANNELS에서는 빼 두었습니다. 이 채널이 들어오는 순간 PLACEMENT_PARAMS와 removedHoles 규칙도 함께 손봐야 합니다.
- Web Worker (5.5): 컨트롤러 수를 8개로 제한하는 쪽을 먼저 택했습니다. 워커로 옮기는 작업은 생성과 통계를 함께 옮기는 Phase 6와 같은 일이고, 그때 한 번에 하는 편이 낫습니다.

작게 남긴 항목도 적어 둡니다. 5.4의 클릭 반복 polyline 작도와 line 중간 핸들을 당겨 curve로 승격하는 제스처는 넣지 않았습니다. polyline은 중앙에 놓고 핸들로 다듬으며, 정점 수는 인스펙터에서 조절합니다. 5.1의 kind: "procedural" 래핑은 하지 않았습니다. 5절 서두가 variation-engine.js를 그대로 두라고 하고 있고, size 채널이 그 결과에 곱해지는 것으로 하위 호환은 이미 충족됩니다. 5.3의 halftone 데모 템플릿은 템플릿 갤러리가 생기는 Phase 7의 몫입니다.

기존 variation-engine.js는 그대로 두고, 그 위에 컨트롤러 개념을 얹어 하위 호환을 유지합니다.

### 5.1 데이터 모델

```js
// fields/controllers.js
const controller = {
  id: "c1",
  channel: "size" | "spacing" | "angle" | "shape",
  kind: "point" | "line" | "curve" | "polyline" | "image" | "procedural",
  geometry: { ... },          // point: {x,y}, line: {a,b}, curve: 3차 베지어 제어점, polyline: 점 배열
  target: 1.6,                // 채널 값. size는 배율, spacing은 배율, angle은 도, shape는 모핑 0-1
  radius: 40,                 // 영향 반경 mm
  falloff: "smooth" | "linear" | "hard",
  oneSided: false,            // line, curve에서 한쪽 방향만 영향
  strength: 1,
  syncWith: null,             // 다른 채널 컨트롤러 id와 지오메트리 동기화
  image: { assetId, invert, gamma }   // kind === "image"일 때
};
```

채널 평가 함수:

```js
evaluateChannel(controllers, channel, x, y, ctx) → number
```

각 컨트롤러는 점에서 지오메트리까지의 거리 d를 구하고 w = falloff(d / radius) × strength로 가중치를 만든 뒤, 기본값과 target을 가중 평균합니다. 기존 procedural 레이어는 kind가 procedural인 컨트롤러로 래핑해 variation-engine.js의 evaluate를 그대로 호출합니다.

### 5.2 채널별 적용 방식

- size: 홀 크기 배율. 현재 variation과 동일한 경로
- angle: 홀별 angle 필드에 더함. 이미 downstream이 hole.angle을 읽으므로 비용이 낮음
- shape: 형상 모핑 0-1. v1은 두 형상 사이의 보간이 아니라 모서리 반경, 종횡비, 다각형 변 수를 매개변수화한 superellipse 기반 morph 형상을 추가하는 방식으로 구현. Circle ↔ Rectangle ↔ Diamond가 한 파라미터로 이어지도록 함
- spacing: 배치 자체를 바꾸므로 레이아웃 모드가 필드를 읽어야 함. 격자 계열은 행 단위 누적 간격 (각 행의 피치를 그 행의 중앙에서 샘플링), scatter 계열은 가변 반경 Poisson disk, radial은 링 간격 함수로 구현. Phase 3의 레이아웃 인터페이스가 fields를 인자로 받는 이유입니다

### 5.3 이미지 컨트롤러

- 파일 드롭 또는 파일 선택으로 이미지 로드, 캔버스에 리샘플링해 밝기 맵 (Float32Array, 최대 512×512) 생성
- 배치 사각형 (x, y, w, h, rotation)을 캔버스 위 핸들로 조정
- 채널마다 밝기를 어떻게 매핑할지 선택: invert, gamma, 범위 (min, max)
- 이미지 데이터는 문서 JSON에 dataURL로 포함 (파일 저장 시), URL 공유 시 제외
- 완료 시 photo-to-halftone 가이드에 대응하는 데모 문서를 템플릿에 포함

### 5.4 캔버스 편집 UX

- 좌측 툴 레일에 채널 버튼 4개. 채널을 선택하면 해당 채널 컨트롤러만 진하게 표시하고 나머지는 흐리게 표시
- 툴 선택 후 캔버스 클릭으로 point 추가, 드래그로 line 추가, 클릭 반복으로 polyline 추가, line의 중간 핸들을 당기면 curve로 승격
- 기존 기즈모 스냅 규칙 (SNAP_QUARTERS, SNAP_ANGLE_STEP)을 그대로 재사용
- 선택된 컨트롤러의 target, radius, falloff, oneSided는 우측 인스펙터에서 편집
- 필드 히트맵 오버레이 (HUD 토글): 현재 채널의 값 분포를 반투명 컬러맵으로 표시

### 5.5 성능

컨트롤러 수 × 홀 수 평가가 병목이 됩니다. 컨트롤러가 8개 이하이고 홀이 20,000개 이하이면 메인 스레드에서 처리하고, 초과 시 Web Worker에서 평가한 뒤 Float32Array를 transfer합니다. 이미지 컨트롤러는 밝기 맵 조회이므로 저렴합니다.

### 5.6 산출 파일과 테스트

- src/fields/controllers.js, src/fields/image-map.js, src/fields/worker.js
- controllers.test.js: falloff 함수, 거리 함수 (점-선분, 점-베지어 근사, 점-폴리라인), 가중 평균, oneSided, 채널 기본값
- 스모크: point size 컨트롤러 하나를 놓았을 때 중앙 홀이 커지고 OAR이 증가하는지

완료 기준: Size, Angle, Shape 채널이 point, line, polyline, image 컨트롤러로 동작하고 URL 공유에 포함됩니다. Spacing 채널은 Phase 3에서 완성됩니다.

예상 규모: PR 6-8개.

## 6. Phase 3: 레이아웃 모드 9종

상태 (2026-09-05): 완료. 공통 인터페이스, Spacing 채널, 공간 해시, 그리고 신규 모드 7종을 구현했습니다. 산출물은 src/layouts/index.js(레지스트리 겸 유일한 진입점), src/layouts/crosshatch.js, scatter.js, spiral.js, fibonacci.js, path.js(+path-gizmo.js), voronoi.js, flowlines.js, lattice.js, src/geometry/spatial-hash.js, stroke.js, src/core/rng.js이며 문서 스키마는 5로 올렸습니다.

Type 드롭다운은 이제 12종입니다. Straight, Staggered 60°, Staggered 45°, Radial(Concentric·Sunflower·6k Rosette), Custom Angle, Cross-hatch, Scatter, Spiral, Fibonacci, Path, Voronoi, Flow Lines. 로드맵이 열거한 9종을 모두 덮었고, 격자 계열 3종과 Radial 3종이 그 위에 얹혀 있습니다.

Spacing 채널은 EDITABLE_CHANNELS에 들어왔고, 격자 계열은 6.2절이 정한 대로 행 단위 누적 피치만 읽습니다. Cross-hatch는 두 직선 계열을 각각 이동시키므로 정렬을 깨지 않고 2차원 밀도 변조가 되며, 이것이 13절의 격자 왜곡 리스크에 대한 답입니다. Radial과 균일 리거먼트 타일링 3종은 이 채널을 읽지 않고, 그 사실을 패널과 툴 레일이 표시합니다.

남겨 두었던 셋은 다음과 같이 마무리했습니다.

- Path: 캔버스 위 곡선 편집기(layouts/path-gizmo.js)를 함께 넣었습니다. 정점 드래그, 곡선 추가·삭제, 스무딩, 접선 정렬, 닫힌 고리를 지원하며, 곡선 자체가 배치 입력이므로 compilePlacement가 서명합니다.
- Voronoi: SHAPES에 Polygon 항목을 더해 홀별 외곽선을 다룰 수 있게 했습니다. 핵심은 effectiveHoleShape(doc) 하나로 "레이아웃이 형상을 강제한다"는 사실을 생성기·통계·캔버스·내보내기·패널이 공유하는 것입니다. d3-delaunay는 쓰지 않았습니다. 각 셀을 이웃 사이트의 이등분선 반평면으로 직접 잘라 만들고, 사이트에서 reach/2보다 먼 정점이 없을 때 종료하므로 근사가 아니라 정확합니다. 인접 셀이 각각 gap/2씩 물러나므로 리거먼트는 정확히 edge gap이며, 테스트가 1.000000·3.000000·8.000000 mm로 확인합니다.
- Flow Lines: SHAPES에 Stroke 항목을 더했습니다. 중심선과 정점별 반폭을 홀이 직접 들고 있으며, 폭은 size 채널을 정점마다 읽으므로 한 슬롯이 자기 길이를 따라 좁아지고 넓어집니다. 리거먼트·오버랩 탐색은 홀이 아니라 세그먼트를 짝지어 돌고(ligament.js의 forEachSegmentPair), 면적은 경계 상자 샘플링 대신 중심선을 걸어 잽니다. 여기서도 리거먼트는 정확히 edge gap입니다.

이미지 컨트롤러는 그 모드가 배치에 쓰는 채널을 구동할 수 없게 막았습니다. 무엇이 배치 채널인지는 layoutPlacementChannels 한 곳이 정하며, Spacing은 언제나, angle은 Flow Lines에서만 해당합니다. 밝기 맵은 DOM이 비동기로 디코딩하고 공유 링크에는 실리지 않으므로, 그것이 홀의 위치를 정하면 문서에 없는 상태가 배치를 좌우하게 되고 removedHoles 인덱스가 근거 없이 어긋납니다. 크기·각도·형상 채널은 그리는 방식만 바꾸므로 그림을 기다려도 됩니다.

### 6.1 공통 인터페이스

구현된 형태는 아래와 같으며, 계획 단계에서 적어 둔 ctx 객체와는 다릅니다. 실제 인터페이스는 이미 존재하던 평면 params 레코드를 그대로 쓰고, 여기에 spacing 필드 하나를 두 번째 인자로 더한 것입니다.

```js
// layouts/index.js
export const LAYOUTS = {
  "Straight":      { family: "grid",       spacing: true,  theoretical: true },
  "Staggered 60°": { family: "grid",       spacing: true,  theoretical: true },
  "Staggered 45°": { family: "grid",       spacing: true,  theoretical: true },
  "Radial":        { family: "radial",     spacing: false, theoretical: false },
  "Custom Angle":  { family: "grid",       spacing: true,  theoretical: true },
  "Cross-hatch":   { family: "crosshatch", spacing: true,  theoretical: true },
  "Scatter":       { family: "free",       spacing: true,  theoretical: false },
  "Spiral":        { family: "free",       spacing: true,  theoretical: false },
  "Fibonacci":     { family: "free",       spacing: true,  theoretical: false },
};
// generateHoles(params, spacing) → [{ x, y, angle? }]
```

계획과 달라진 이유는 두 가지입니다. 첫째, params는 원시값만 담는 평면 레코드여야 합니다. PLACEMENT_PARAMS가 generateHoles의 구조 분해와 정확히 일치한다는 것이 removedHoles 규칙의 근거이고, 그 목록은 문자열로 서명되어야 하므로 샘플러 함수가 그 안에 들어갈 수 없습니다. 그래서 spacing은 두 번째 인자이고, patternSignature가 그 서명을 따로 붙입니다. 둘째, 키를 grid/staggered 같은 새 이름이 아니라 문서가 이미 쓰던 layout.type 문자열 그대로 둔 것은, 그 문자열이 곧 파일 포맷이기 때문입니다. 이름을 바꾸면 저장된 모든 문서가 로드 시 기본값으로 떨어집니다.

모든 모드가 같은 boundary, hole, fields를 읽으므로 모드 전환 시 컨트롤러가 유지됩니다. 이것이 SolidVents가 강조하는 한 번의 클릭으로 모드 전환하는 경험의 정확한 구현입니다.

### 6.2 모드별 알고리즘

- scatter: Bridson Poisson disk sampling. 반경 r은 spacing 필드로 가변화 (셀 크기는 최소 r 기준). 시드 고정
- path: 사용자가 그린 polyline 또는 베지어 경로를 따라 등간격 배치. 경로 여러 개 지원. 홀 angle을 경로 접선에 맞추는 옵션
- spiral: Archimedean 나선, 호 길이 등간격 배치. 나선 간격과 시작 반경 파라미터
- fibonacci: 기존 Sunflower 승격. 황금각 137.508°와 반경 c√n. spacing 필드로 c를 가변화
- concentric: 기존 Radial Concentric과 6k Rosette 유지
- crosshatch: 두 방향 (angle1, angle2) 직선 배열의 교점에 배치. Custom Angle의 일반화
- voronoi: Poisson 점 집합의 Voronoi 셀을 만들고, 각 셀을 gap/2만큼 안쪽으로 오프셋한 다각형을 홀로 사용. d3-delaunay 사용. 셀 다각형 홀은 SHAPES 인터페이스에 polygon 형상을 추가해 처리. 리거먼트는 오프셋 거리로 정확히 계산 가능
- flowlines: 홀이 아니라 가변 폭 연속 선. 벡터장 (angle 필드가 방향, spacing 필드가 밀도, size 필드가 폭)에서 스트림라인을 적분하고, 폭을 따라 오프셋한 닫힌 폴리곤으로 출력. SVG와 DXF에서는 path 하나로, STEP에서는 폴리곤 프리즘으로 내보냄

### 6.3 통계 호환

- OAR: voronoi와 flowlines는 이론 OAR 경로를 비활성화하고 카운트 경로만 사용(LAYOUTS의 theoretical: false). 폴리곤 면적은 shoelace, 슬롯 면적은 자기 외곽선의 shoelace
- 리거먼트: 격자 계열은 기존 로직 유지. scatter와 voronoi는 공간 해시 기반 이웃 탐색에 외접원 하한으로 가지치기를 더해 정확한 값을 그대로 유지하면서 비용을 낮췄고(1 m 패널 Voronoi 5.5초 → 1.3초), flowlines는 홀의 경계 상자가 패널 전체가 되므로 세그먼트를 짝지어 도는 별도 경로를 씁니다
- 오버랩: 동일 공간 해시 사용

### 6.4 테스트

layouts/*.test.js에 모드마다 결정성 (같은 시드 → 같은 결과), 경계 내 포함, 최소 간격 보장 (scatter), 홀 수 단조성 (간격 줄이면 홀 증가) 테스트를 둡니다.

완료 기준(개정): 드롭다운의 9종 모드가 모드 전환 시 컨트롤러와 경계를 유지하고, 각 모드에서 SVG 내보내기가 정상이며, Size·Angle·Shape 세 채널은 모든 모드에서, Spacing 채널은 그것을 읽는 모드에서 동작합니다.

Spacing을 "9종 모두"로 적었던 애초의 기준은 잘못이었습니다. Radial의 세 하위 레이아웃과 균일 리거먼트 타일링 3종은 배치를 피치의 곱셈으로 표현하지 않고, 특히 타일링은 모든 변에 같은 리거먼트를 주는 것이 존재 이유이므로 그것을 늘이는 필드는 밀도 변조가 아니라 타일링의 파괴입니다. 대신 그 사실을 툴 레일과 패널이 명시하고, layoutReadsSpacing 하나가 UI·통계·배치의 판단 근거를 공유합니다.

현재 상태: 12종 중 Radial을 제외한 11종이 Spacing을 읽습니다. 다만 격자 계열에서 홀 형상이 균일 리거먼트 타일링 3종(Hexagon+Staggered 60°, Diamond+Staggered 60°, Triangle+격자 전체)에 해당하면 그 조합만 읽지 않습니다. Flow Lines는 여기에 더해 angle 채널까지 배치에 읽는 유일한 모드입니다.

예상 규모: PR 8-10개 (모드당 1개, 인터페이스 1개, 공간 해시 1개). 실제로는 커밋 4개로 마쳤습니다.

## 7. Phase 4: 임의 경계와 커스텀 홀 형상

### 7.1 경계 (boundary.js)

```js
boundary = {
  type: "rect" | "ellipse" | "polygon" | "path",
  outer: ...,                // rect: {w,h,cornerRadius}, polygon: 점 배열, path: SVG path d 문자열
  cutouts: [ ... ],          // 키프아웃 영역 (나사 구멍, 로고 자리 등), 같은 형식
  margin: number | { t, r, b, l }
};
```

- 모든 형상은 내부적으로 폴리라인으로 평탄화 (곡선은 허용 오차 0.05mm)
- containsPoint, distanceToEdge (마진 및 홀 잘림 판정), area, svgPath, dxfEntities, bbox 제공
- SVG 파일 임포트: 첫 번째 닫힌 path 또는 rect, circle, ellipse, polygon 요소를 경계로. 단위는 파일의 width 속성이 mm이면 그대로, 아니면 사용자에게 스케일 입력을 요청
- DXF 임포트는 범위 밖. 사용자에게 SVG 변환을 안내
- 캔버스에서 polygon 경계의 꼭짓점을 드래그 편집. 새 꼭짓점 추가는 변 더블클릭
- 판 (sheet)과 경계를 분리: 판은 재료 크기, 경계는 천공 영역. 경계가 곧 절단 외곽선이 되는 옵션 (SolidVents처럼 외곽선 자체를 내보내는 경우) 제공

### 7.2 커스텀 홀 형상

SolidVents의 형상 편집기는 큰 기능이므로 세 단계로 나눕니다.

1. 형상 라이브러리 확장: 별, 슬롯 배열, 십자, 플러스, 초승달, 육각 너트 등 파라메트릭 프리셋 8-10종을 SHAPES에 추가
2. SVG path 임포트 홀: 사용자가 준 path를 폴리곤으로 평탄화해 polygon 형상으로 사용. 면적, 리거먼트, 히트 테스트는 Phase 3에서 추가한 polygon 형상 로직을 재사용
3. 불리언 레이어 편집기: 기본 도형 여러 개를 union, subtract로 합성. polygon-clipping 라이브러리로 결과 폴리곤을 계산하고 캐시. 편집기 UI는 별도 모달에서 기본 도형 추가, 이동, 크기 조정, 역할 지정

완료 기준: 원형 스피커 그릴 (ellipse 경계 + 중앙 cutout)과 로고 모양 SVG 경계 안에 scatter 패턴을 만들고 SVG로 내보낼 수 있습니다.

예상 규모: PR 6-8개.

## 8. Phase 5: DXF와 STEP 내보내기

### 8.1 SVG 개선 (작은 PR)

- 레이어 그룹 분리: OUTLINE, HOLES, HOLES_EXIT, KEEPOUT을 id와 inkscape:label로 표기
- 채움 없이 stroke만 있는 절단용 옵션과 지금처럼 채움이 있는 시각화 옵션
- 커프 보정 옵션: 홀 윤곽을 kerf/2만큼 바깥 또는 안쪽으로 오프셋
- 단위 선택 (mm, inch)

### 8.2 DXF (export/dxf.js)

- ASCII DXF R2000 (AC1015) 작성. HEADER에 $INSUNITS 4 (mm), $EXTMIN, $EXTMAX
- 엔티티: 원은 CIRCLE, 모서리 반경 사각형과 필은 bulge를 가진 LWPOLYLINE, 다각형은 닫힌 LWPOLYLINE, 경계는 LWPOLYLINE 또는 CIRCLE
- 레이어: OUTLINE, HOLES, HOLES_EXIT, KEEPOUT. 색상 인덱스 지정
- 테스트: 엔티티 수, 레이어 이름, 좌표 값을 문자열 파싱으로 검증. 실제 파일 검증은 LibreCAD 또는 Fusion 360에서 한 번 수동 확인 후 결과를 README에 기록

### 8.3 STEP (export/step.js)

두 가지 구현 경로가 있으며, 1차는 자체 작성 방식을 권장합니다.

- 권장 1차: 프로파일 압출 B-rep을 직접 쓰는 STEP AP214 라이터. 판은 외곽 루프와 홀 루프를 가진 위 아래 평면 두 개와 측면으로 구성. 직선 변은 PLANE, 원호 변은 CYLINDRICAL_SURFACE로 측면을 만듭니다. 홀은 외곽 루프의 inner bound로 표현되므로 불리언이 필요 없습니다. Draft Angle은 측면을 CONICAL_SURFACE로 바꾸는 것으로 구현할 수 있고, 이는 현재 테이퍼 모델과 정확히 대응합니다
- 대안: opencascade.js (WASM 약 10MB 이상)를 필요할 때 동적 로드해 판 압출 후 홀을 cut. 구현은 쉽지만 번들 크기와 로드 시간이 크고 PWA 캐시 부담이 있습니다. 1차 방식이 특정 CAD에서 열리지 않는 문제가 반복될 때만 채택합니다
- STP Split: 홀 수가 임계값 (기본 5,000)을 넘으면 판을 격자 블록으로 나눠 블록마다 별도 솔리드로 출력. 사용자가 블록 수를 지정
- 검증: FreeCAD를 CI 컨테이너에 설치해 headless로 STEP을 열고 솔리드 수와 부피를 확인하는 스크립트를 scripts/verify-step.py로 둡니다. CI에서 어렵다면 로컬 검증 절차를 문서화

### 8.4 내보내기 UI

- 내보내기 대화상자: 형식 (SVG, DXF, STEP, PNG), 단위, 레이어 옵션, 커프, STP Split, 파일명
- 내보내기 전 요약: 홀 수, OAR, 최소 리거먼트, 폐공 수, 판 크기. 최소 리거먼트가 판 두께보다 작으면 경고

완료 기준: 같은 문서를 SVG, DXF, STEP으로 내보내 Fusion 360 또는 SolidWorks에서 열었을 때 치수가 mm 단위로 일치합니다.

예상 규모: PR 5-6개.

## 9. Phase 6: 성능과 렌더링

- 렌더러 분리: render/canvas-renderer.js가 문서와 뷰포트를 받아 그리는 순수 함수가 됩니다 (Phase 0에서 착수)
- Path2D 캐싱: 홀 하나의 Path2D를 형상, 크기, 반경 키로 캐시하고 translate로 재사용. 크기 변조가 있으면 크기를 0.05mm 단위로 양자화해 캐시 적중률을 높입니다
- 뷰포트 컬링: 화면 밖 홀은 그리지 않음
- 50,000개 초과 시 WebGL2 인스턴싱 렌더러로 전환. 원은 SDF 셰이더, 다각형은 삼각분할한 메시 인스턴싱. 기존 10,000개 축소 렌더 모드는 폴백으로 유지
- 생성과 통계는 Web Worker로 이동 (Phase 2 워커 재사용). 메인 스레드는 뷰 상태와 UI만 담당
- 목표: 100,000개 홀에서 팬과 줌이 60fps, 파라미터 변경 후 재생성이 200ms 이내

예상 규모: PR 4-5개.

## 10. Phase 7: 템플릿, 온보딩, 문서

- 템플릿 갤러리: 첫 실행 시와 파일 메뉴에서 열리는 모달. 각 템플릿은 문서 JSON과 썸네일 SVG로 src/templates/*.json에 저장. 최소 12종: DIN 표준 3종, 스피커 그릴 원형, 환기 슬롯, 할프톤 초상, Fibonacci 로제트, Voronoi 스톤, flow lines 웨이브, 방사형 그라디언트, 로고 경계 예시, 이중 채널 컨트롤러 예시
- 사용자 템플릿: 현재 문서를 로컬 템플릿으로 저장
- 온보딩: 처음 3회 실행 시 표시되는 5단계 안내 (경계, 레이아웃, 컨트롤러, 통계, 내보내기)
- 가이드 문서: docs 빌드 결과물과 충돌하지 않도록 guides/ 디렉터리에 마크다운으로 두고 GitHub Pages의 별도 경로로 게시. 우선 photo-to-halftone, speaker grille, ventilation panel 3편
- i18n: UI 문자열을 src/ui/i18n/{en,ko}.json으로 분리. 기본 en, 브라우저 언어가 ko이면 ko
- README, AGENTS.md 전면 갱신, CHANGELOG.md 도입

예상 규모: PR 5-6개.

## 11. UI 재설계

Phase 2부터 캔버스 위 편집이 중심이 되므로 사이드바 중심 배치를 캔버스 중심 배치로 바꿉니다. Phase 0의 패널 분리와 함께 뼈대를 잡고, 각 Phase에서 패널을 채웁니다.

- 상단 바: 문서 이름, 저장 상태, 실행 취소 및 다시 실행, 내보내기, 공유 링크, 테마
- 좌측 툴 레일 (아이콘 세로 열): Select, Pan, Boundary edit, Size ctrl, Spacing ctrl, Angle ctrl, Shape ctrl, Image ctrl, Remove hole
- 우측 인스펙터 (탭): Layout, Hole, Boundary, Fields, Sheet & Taper, Appearance. 선택된 컨트롤러가 있으면 인스펙터 상단에 그 속성이 먼저 나옴
- 하단 상태 바: 홀 수, OAR, 최소 리거먼트, 경고 배지, 줌, 단위. 현재 캔버스 좌상단 HUD 카드를 여기로 이동
- 캔버스: 컨트롤러 핸들, 경계 꼭짓점, 필드 히트맵 오버레이, 룰러와 스냅 그리드
- 단축키: V 선택, H 팬, B 경계, 1-4 채널, R 홀 제거, Ctrl+Z, Ctrl+Shift+Z, Ctrl+S 파일 저장, Ctrl+E 내보내기, 0 뷰 리셋
- 커맨드 팔레트 (Ctrl+K)로 모든 명령 검색
- 반응형: 1024px 미만에서는 인스펙터가 하단 시트로 전환. 터치 핀치 줌 지원
- 스타일: 현재의 JetBrains Mono 기반 다크 테마 유지. 인라인 스타일을 theme.js 토큰과 CSS 변수로 옮겨 다크와 라이트를 동시에 관리

## 12. 일정과 우선순위

| 순서 | Phase | 핵심 산출 | 규모 |
| --- | --- | --- | --- |
| 1 | Phase 0 기반 정비 | 모듈 분할, 문서 모델, 린트, CI, 스모크 테스트 | PR 5-7 |
| 2 | Phase 1 저장 및 공유 | localStorage, 파일, URL 공유, 전역 undo | PR 3 |
| 3 | Phase 5a DXF | 즉시 체감되는 제조 가치 | PR 2 |
| 4 | Phase 2 컨트롤러 | 4채널 컨트롤러, 이미지 제어 | PR 6-8 |
| 5 | Phase 3 레이아웃 9종 | scatter, path, spiral, crosshatch, voronoi, flowlines | PR 8-10 |
| 6 | Phase 4 경계와 커스텀 형상 | 임의 외곽선, SVG 임포트, 불리언 형상 | PR 6-8 |
| 7 | Phase 5b STEP | STEP 라이터, Split, Draft | PR 3-4 |
| 8 | Phase 6 성능 | 워커, WebGL 렌더러 | PR 4-5 |
| 9 | Phase 7 템플릿과 문서 | 갤러리, 온보딩, 가이드, i18n | PR 5-6 |

DXF를 Phase 2보다 앞에 두는 이유는 구현 비용이 낮고 현재 사용자에게 즉시 가치가 있기 때문입니다. UI 재설계는 별도 Phase가 아니라 Phase 0에서 뼈대를 만들고 Phase 2와 4에서 채웁니다.

전체 PR 수는 45-60개입니다. 한 세션에 PR 2-3개를 진행한다고 가정하면 20-30세션이 필요합니다.

## 13. 리스크와 대응

- STEP 호환성: 직접 작성한 B-rep이 특정 CAD에서 열리지 않을 수 있습니다. FreeCAD 검증 스크립트로 조기 발견하고, 반복 실패 시 opencascade.js로 전환합니다
- Spacing 채널의 격자 왜곡: 행 단위 가변 피치는 열 정렬을 깨뜨립니다. 격자 모드에서는 spacing을 행 방향 하나로 제한하고, 2차원 가변 밀도가 필요하면 scatter 모드를 권하는 안내를 UI에 둡니다
- 리팩터링 중 회귀: Phase 0 시작 전에 스모크 테스트를 먼저 작성해 기준값 (홀 수, OAR, 리거먼트, SVG 해시)을 고정합니다
- 번들 크기: d3-delaunay, polygon-clipping, lz-string은 합쳐 100KB 미만입니다. opencascade.js는 채택하더라도 동적 import로 분리합니다
- 단일 파일 관례에 의존하는 AGENTS.md: Phase 0 마지막 PR에서 반드시 갱신합니다

## 14. 성공 지표

- 템플릿 갤러리의 12종 문서가 모두 SVG, DXF, STEP으로 내보내지고 Fusion 360에서 치수가 일치함
- 100,000개 홀 문서에서 팬과 줌 60fps, 재생성 200ms 이내
- 공유 링크 라운드트립에서 홀 수와 OAR이 소수점 첫째 자리까지 동일함
- 심리스 타일링 gap 0에서 OAR 100.0과 최소 리거먼트가 설정 gap과 일치하는 기존 보증이 모든 Phase에서 유지됨
- 단위 테스트가 모든 순수 모듈을 덮고 CI가 녹색임

## 15. 범위 밖

계정, 결제, 클라우드 저장소, 마켓플레이스, 일일 내보내기 제한, 서버 사이드 렌더링, DXF 임포트, 3D 뷰어. 3D 뷰어는 STEP 내보내기가 안정된 뒤 three.js로 검토할 수 있으나 이 로드맵에는 포함하지 않습니다.
