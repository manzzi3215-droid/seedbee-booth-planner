# Booth Layout Planner

> **v0.9.6 - Professional Floorplan Import & CAD Workspace**

백화점 · 박람회 · 팝업스토어 등 다양한 행사장의 부스를 직접 설계하는
**2D 레이아웃 편집 웹앱**입니다. CAD 같은 전문 설계 도구가 아니라
"누구나 쉽게 쓰는 부스 레이아웃 플래너"를 목표로 합니다.

디자인팀이 Illustrator로 만들던 부스 시안을, 실무자가 직접 집기를 배치하며
여러 배치안을 만들어 볼 수 있게 합니다.

---

## 주요 기능

**부스 · 집기**
- **행사장(부스) 생성** — 행사명, 가로·세로·높이(mm, **선택값** — "높이 설정 안 함" 가능),
  오픈면(1/2/3면), 바닥 종류. 높이 미설정 시 벽면 전개도·3D 미리보기는 비활성
- **비정형(polygon) 부스** — 사각형뿐 아니라 사선/다각형 부스 지원 (꼭짓점 mm 좌표 입력)
- **집기명 표시** — 평면도 집기 위에 이름 표시(토글 ON/OFF, 작은 집기는 자동 숨김), PNG/PDF 반영
- **SVG 가져오기** — Illustrator 등에서 **SVG로 저장한** 도면을 두 가지 방식으로 가져오기
  - ① **배경으로**: 참고용 이미지로 도면 위에 배치(이동/크기/투명도/잠금), PNG/PDF 반영
  - ② **SVG 객체로**: 내부 구조(path/rect/circle/ellipse/polygon/polyline/line/text)를 파싱해
    **SVG 검사기(Inspector)** 로 도형 개수 확인 + 도형 선택 시 캔버스 하이라이트
  - **SVG → 집기 변환(v0.7.1):** Inspector 에서 도형 선택 후 **[집기로 변환]** —
    rect→사각형, circle→원형, ellipse/polygon/polyline/path→customPath, line→치수선.
    위치·크기·색상 유지, 자동 이름(Rect 1…), 변환 완료 표시(중복 변환 방지).
  - **변환 집기 편집 + 라이브러리 저장(v0.7.2):** 변환된 집기를 선택하면 오른쪽 패널에서
    이름·형태·가로·세로·높이·색상·메모를 즉시 수정(캔버스 실시간 반영, 위치 유지).
    **[집기 라이브러리에 저장]** 으로 전역 집기로 등록(다른 프로젝트에서도 사용, 중복 저장 방지).
    문서의 80% 이상을 차지하는 큰 도형은 **"배경/아트보드로 추정"** 경고 + 변환 확인.
  - *Adobe Illustrator(.ai)는 웹에서 안정적으로 파싱하기 어렵습니다. **Illustrator에서는 SVG로
    저장 후 업로드하는 방식을 권장합니다.***
- **집기 라이브러리** — 등록/수정/삭제. 형태: 사각형 · 둥근 사각형 · 원형 · 반원형,
  그리고 **customPath 비정형 집기**(SVG path, 하트·물이음·콩모양 등 곡선형 테이블)
- **배치** — 드래그 이동, 선택/하이라이트, 그리드 스냅, 부스(polygon) 밖 이탈 경고
- **스마트 스냅** — `Shift` 드래그 시 다른 집기 가장자리·중심선·부스 외곽에 자동 정렬 +
  가이드라인 표시(threshold 50mm)
- **편집 편의** — 90도 회전 · 복사 · 삭제 · 위치/회전 직접 입력,
  단축키(Delete 삭제 · R 회전 · Ctrl/Cmd+D 복사 · 방향키 이동)

**주석 요소 (평면도 + 벽면 공통)**
- **텍스트** — 자유 텍스트(입구·카운터·이벤트존 등), 색상·배경·굵게·정렬·크기
- **치수선** — 시작/끝점 기반, 자동 길이 계산·양끝 화살표·라벨 커스터마이즈
- **이미지/포스터 삽입** — png/jpg/webp 업로드, Transformer로 크기 조절·회전·투명도

**벽면 전개도**
- **보기 모드** — 평면도 / 정면 · 좌측 · 우측 · 후면 벽 탭 전환
- **벽면 캔버스** — 벽 길이 × 높이(mm) 전개도에 텍스트·치수선·이미지 배치

**미리보기 · 저장 · 출력**
- **아이소메트릭 3D 미리보기** — 평면 배치 · 벽면 요소 · 집기 heightMm를 기반으로
  30° 사선 시점 시안 생성(집기는 박스, 벽면 이미지/텍스트는 벽에 부착). PNG 저장.
  편집 없는 preview 전용(편집은 2D/벽면에서)
- **배치안 버전 관리** — 한 프로젝트에 여러 배치안(v1, v2, "체험존 강조안" 등)
  저장/불러오기, 최근 배치안 자동 로드
- **출력** — 평면도/벽면 각각 PNG 저장 + A4 가로 PDF(도면 + 정보 + 요소 요약),
  사용 집기 리스트 자동 집계. 화면 확대/이동 상태와 무관하게 전체를 일정 해상도로 렌더

---

## 기술 스택

- **React 19 + Vite + TypeScript**
- **Material UI (MUI)** — UI 컴포넌트
- **React Konva / Konva** — 2D 캔버스
- **react-router-dom** — 라우팅
- **jsPDF** — PDF 출력
- **localStorage** — 저장 (Storage Layer로 추상화, 추후 Firebase 전환 가능)
- 배포: **Firebase Hosting** (Netlify 설정도 포함)

---

## 실행 / 빌드 방법

```bash
npm install     # 최초 1회 (의존성 설치)
npm run dev     # 개발 서버 (http://localhost:5173)
npm run build   # 타입체크 + 프로덕션 빌드 → dist/
npm run preview # 빌드 결과 로컬 미리보기
npm run lint    # oxlint 정적 검사
```

---

## 사용 방법

1. **홈** → `새 프로젝트 만들기`로 행사장 정보(부스 치수·오픈면·바닥) 입력 후 생성
2. **편집기**
   - 왼쪽 **집기 라이브러리**에서 `배치`를 눌러 캔버스에 집기 추가
   - 집기를 드래그로 이동, 클릭으로 선택 (그리드 500mm 자동 스냅)
   - 오른쪽 **선택 정보** 패널에서 위치·회전 직접 입력, 90도 회전 · 복사 · 삭제
   - 단축키: `Delete` 삭제 · `R` 회전 · `Ctrl/Cmd+D` 복사 · 방향키 이동(100mm, `Shift`+방향키 500mm)
3. **저장** — 상단 툴바에서 `저장`(현재 배치안) / `다른 이름으로 저장`(새 버전) /
   `배치안 선택`(불러오기). 저장 후 새로고침해도 배치가 유지됩니다.
4. **출력** — `PNG 저장` / `PDF 저장` / `집기 리스트`.
   출력은 화면 확대/이동 상태와 무관하게 **부스 전체**를 일정 여백·해상도로 렌더합니다.

> 최초 실행 시 기본 집기(진열장, TV, 포스기, 냉장고, 배너, 원형 테이블 등)가
> 자동으로 등록됩니다.

---

## 데이터 저장 방식

현재 모든 데이터(프로젝트 · 집기 · 배치안)는 브라우저 **localStorage**에 저장됩니다.
서버나 로그인 없이 동작하며, 같은 브라우저에서 데이터가 유지됩니다.

> ⚠️ **이미지 저장 방식(초기 버전):** 삽입한 이미지는 dataURL(base64)로 배치안에
> 인라인 저장됩니다. 이미지가 많아지면 localStorage 용량 한도(브라우저당 약 5MB)에
>도달할 수 있습니다. **추후 Firebase Storage(외부 URL 참조) 전환을 권장**합니다 —
> `PlacedImage.srcDataUrl`을 업로드 URL로 바꾸면 됩니다.

저장 키:

- `blp:projects` — 프로젝트 목록 (각 프로젝트 안에 `layouts` 배치안 배열 임베드)
- `blp:fixtures` — 집기 라이브러리

### 추후 Firebase 전환 구조

앱의 모든 저장/조회/삭제는 **`StorageProvider` 인터페이스**를 통해서만 이뤄지며,
UI/기능 코드는 localStorage를 직접 호출하지 않습니다.

```
src/storage/
├─ StorageProvider.ts       # 인터페이스 (모든 메서드 async)
├─ LocalStorageProvider.ts  # 현재 구현 (localStorage)
└─ index.ts                 # 전역 storage 인스턴스
```

모든 메서드가 `async`(Promise 반환)로 설계되어 있어, Firebase Firestore(비동기)로
옮길 때 **호출부 코드를 전혀 바꾸지 않아도** 됩니다. 전환 절차:

1. `FirestoreStorageProvider`를 만들어 `StorageProvider`를 구현
   (프로젝트별 배치안은 `projects/{id}/layouts` 서브컬렉션으로 매핑)
2. `src/storage/index.ts`의 한 줄만 교체:
   ```ts
   export const storage: StorageProvider = new FirestoreStorageProvider();
   ```

---

## 폴더 구조

```
src/
├─ main.tsx                  # 진입점 (Theme / CssBaseline)
├─ App.tsx                   # 라우팅 (편집기는 코드 분할 lazy 로드)
├─ theme/                    # MUI 테마
├─ constants/                # 부스 옵션(오픈면·바닥) 상수/라벨
├─ components/
│  ├─ layout/                # 공통 레이아웃 (헤더, 슬롯형 셸, 네비게이션)
│  └─ common/                # 재사용 컴포넌트
├─ pages/                    # 화면 (홈, 목록, 생성, 편집기 라우트)
├─ features/
│  ├─ canvas/                # React Konva 캔버스, 노드(집기/텍스트/치수선/이미지), 좌표·기하·스냅
│  ├─ booth/                 # polygon 부스 꼭짓점 편집
│  ├─ fixtures/              # 집기 라이브러리 (폼, 시드, customPath 프리셋)
│  ├─ texts/ · dimensions/   # 텍스트 · 치수선 상수/헬퍼
│  ├─ wall/                  # 벽면 전개도 캔버스 · 보기 모드
│  ├─ iso/                    # 아이소메트릭 미리보기 (3D 씬 데이터 + 2D 렌더러, 분리)
│  ├─ editor/                # 편집기 상태(Context), 툴바, 패널(집기/텍스트/치수선/이미지), 단축키
│  └─ export/                # 평면도/벽면 PNG/PDF 출력, 집기 리스트
├─ types/                    # 도메인 타입 (Project, Layout, FixtureDef 등)
├─ utils/                    # id 생성, 프로젝트 유틸
└─ storage/                  # 저장 계층 (구현 교체 가능)
```

---

## 개발 이력

**MVP (1~9단계, 완료)** — 프로젝트 생성 · 기본 UI · 행사장 생성 · 2D Canvas ·
집기 라이브러리 · 드래그 배치 · 회전/복사 · 저장(배치안 버전) · 출력(PNG/PDF)

**개선 (완료)**

| 개선 | 상태 |
|------|------|
| customPath 비정형 집기 | ✅ |
| polygon(다각형) 부스 | ✅ |
| 스마트 스냅 | ✅ |
| 텍스트 추가 | ✅ |
| 치수선 추가 | ✅ |
| 벽면 전개도 보기 | ✅ |
| 벽면 텍스트/치수선 | ✅ |
| 이미지/포스터 삽입 | ✅ |
| 아이소메트릭 3D 미리보기 | ✅ |
| 디자인 매핑(집기 텍스처) | ✅ |
| Print Production Workspace(출력물 제작) | ✅ |
| Undo/Redo · 다중선택 · 정렬/분배/미러/배열 | ✅ |
| 3D Lighting System(조명·그림자·재질) | ✅ |
| Digital Merchandising(제품 진열·Display Guide) | ✅ |
| Display Surface·진열 프리셋(집기 위 진열) | ✅ |
| Command Palette(Ctrl+K)·상태바·설정 | ✅ |
| 도면 가져오기(PDF/이미지)·스케일 보정 | ✅ |

### Changelog

**v0.9.6 — Professional Floorplan Import & CAD Workspace (실제 행사장 도면 가져오기)**
- **도면 가져오기 마법사(Floorplan Import Wizard):** 실제 행사장 도면을 그대로 가져와 설계 시작.
  **PDF**(pdfjs 지연 로드로 1페이지 렌더) · **PNG · JPG · SVG** 지원. 단계형 UI(파일 선택 → 미리보기·보정 → 스케일).
- **스케일 캘리브레이션(핵심):** 미리보기에서 **기준선 2점 클릭 + 실제 길이(mm)** 입력 → 도면을 실측 스케일로 자동 변환.
  또는 **전체 가로 실제 크기(mm)** 로 빠른 스케일. mm/px · 도면 실제 크기(m) · 정확도 표시.
- **이미지 보정:** 밝기 · 대비 · 반전 · 흑백(임계값) — 흐린 도면 개선.
- **Background Layer(Drawing Manager):** 가져온 도면은 배경 레이어. 좌측 **도면** 탭에서 썸네일 · 투명도 · 잠금 · 삭제,
  캔버스에서 이동/스냅. 배치안에 저장되어 **Cloud/Auto Save · Undo/Redo · Share** 자동 지원.
- **툴바/커맨드팔레트 연동:** 툴바 **도면** 버튼 + Command Palette "도면 가져오기". 그 위에 부스 외곽(Shape Editor)을
  트레이싱하듯 그려 5분 안에 설계 시작.
- **확장 구조(Future Ready):** 도면→트레이스→지오메트리→집기→제품→조명→진열→출력 Reference 기반 레이어 구조.
  향후 AI Wall/Space Recognition · AI Booth/Furniture/Product Placement · DXF/DWG 벡터 파싱으로 확장 가능한 기반.
- **비파괴:** 기존 기능/데이터 100% 유지(Undo · Cloud/Auto Save · CAD · Lighting · 3D · Merchandising · Preset ·
  Design Mapping · Print · Display Guide). 배경 레이어 인프라를 재사용해 리스크 최소화.
- 로드맵(이번 버전 미포함): DXF/DWG 벡터 · 자동 벽/기둥/출입구 인식 · 벡터 PDF 추출 · Drawing Compare · 도면 메모/핀 ·
  현장 사진 비교 · 회사 공용 도면 라이브러리 · 도면 버전 관리 · AI 자동 인식/생성.

**v0.9.5 — Professional Workspace & UI/UX Refinement (정돈된 전문 UI)**
- **Command Palette (Ctrl+K):** Figma/VSCode 스타일 명령 검색 실행기. Undo/Redo · 정렬/분배/미러 · 회전/복제/삭제 ·
  텍스트/치수 추가 · 3D/출력/진열 관리/설정 열기 · PNG/PDF 내보내기 등 **모든 주요 기능을 검색해 즉시 실행**.
  기능이 많아도 찾기 쉬운 UI 의 핵심.
- **하단 상태바(Status Bar):** 그리드 · 스냅 · 확대율 · 선택 개수 · 부스 면적(㎡) · 집기/제품 개수를 항상 표시.
- **설정(Settings) 다이얼로그:** 그리드 크기(100/250/500/1000mm) · 그리드 스냅 ON/OFF · 집기명 표시 — 실시간 반영.
- **툴바 정리:** 명령 검색(Ctrl+K)·설정 버튼 추가, 3D 미리보기 다이얼로그를 중앙(EditorCanvasArea)으로 통합해
  Command Palette·툴바 어디서나 열 수 있게 정돈.
- **단축키 힌트:** 주요 버튼 툴팁에 단축키 표기. 좌측 사이드바 탭(집기/제품/프리셋) + Property Panel 자동 전환은
  기존 구조를 그대로 활용해 "정보 계층"을 정돈.
- **비파괴:** 기존 데이터/기능(Undo/Redo · Cloud/Auto Save · Geometry · Lighting · 3D · Design Mapping ·
  Print · Display Guide · Preset · Merchandising) 100% 유지. 그리드/스냅은 옵션으로 추가(기본 동작 불변).
- 로드맵(이번 버전 미포함): 상단 Workspace 탭 · 우클릭 Context Menu · Notification Center · 프로젝트 Dashboard ·
  최근 사용/즐겨찾기 — 현재 파이프라인 위 단계적 확장.

**v0.9.4 — Display Surface & Merchandising Preset System (실전 VMD)**
- **Display Surface(구조 변경):** 제품은 더 이상 바닥이 아니라 **집기 상판(Display Surface) 위**에 진열됩니다.
  모든 집기는 Geometry Engine 의 footprint(사각형/원형/곡선/커스텀) 그대로 상판을 자동 생성.
  제품에 `fixtureId` 부여 → 배치 시 선택/최근접 집기 상판 위에 올라가고, **상판 밖으로 나가면 자동 복귀(clamp)**.
- **3D 반영:** 제품이 집기 상판 높이(`baseZmm`)에서 시작해 실제처럼 위에 올라감. Lighting/Shadow/Material 그대로 적용.
- **Merchandising Preset System(핵심):** 집기의 진열 상태를 **프리셋으로 저장**(집기 로컬 상대 좌표)하고,
  빈 집기를 선택해 **적용하면 제품이 자동 생성·배치**되어 몇 초 만에 진열 완성. 좌측 **프리셋** 탭에서
  저장/이름변경/복제/삭제/내보내기(JSON)/가져오기. 프로젝트(행사) 단위 Cloud Save + JSON 공유.
- **추천 기능:** ① 제품 자동 번호(P-01…) — Display Guide 표시, ③ 집기별 수량 자동 계산(Display Guide),
  ⑥ Display Lock(진열 잠금·이동 금지), ⑦ 한 번에 제품 전체 교체.
- **Display Guide/PNG/PDF:** 제품 번호 + 집기별 수량 포함 출력. 제품이 2D·3D·PNG·PDF·Display Guide 동일 반영.
- **유지:** Undo/Redo · Cloud/Auto Save · CAD · Lighting · 3D Geometry · Design Mapping · Print Workspace · Display Guide 정상.
- 로드맵(구조만 선반영): Auto Layout(Snake/Random/균등)·부족 수량 감지·실사 사진 비교·행사별 Template·ERP/AI 자동 진열.

**v0.9.3 — Digital Merchandising System (제품 진열 · 현장 설치)**
- **Product Component 모델(확장형 핵심):** `Product`(정의) / `PlacedProduct`(배치) / `ProductPackage`(세트) /
  `ProductTemplate`(행사별) 분리. Product 에 SKU·브랜드·카테고리·치수·이미지·진열방향·간격·`meta`(ERP/재고/판매/AI 확장 지점).
  제품 라이브러리는 **프로젝트(행사) 단위**로 Cloud/Auto Save, 배치 제품은 배치안(Layout)에 임베드 →
  Undo/Redo · Auto/Cloud Save · Share 가 기존 파이프라인으로 자동 동작.
- **Merchandising Mode:** 왼쪽 사이드바 **집기(Furniture) / 제품(Products)** 레이어 분리. 제품은 집기 위 Product Layer 로 렌더.
- **제품 등록/배치:** 이미지(PNG/SVG/WEBP, 경량 dataURL) 업로드, [배치] 배치, [그리드] 자동 균등 배열(2×4/3×4 자동 계산).
- **편집:** Facing(Front/Back/Left/Right) · 회전(0/90/180/270/자유) · 스케일(100/90/80/직접) · 제품 교체(위치 유지) · 복제 · 삭제.
- **Collision Detection:** 제품이 겹치면 빨간 테두리. **Display Statistics:** 총 진열/종류/카테고리/브랜드 자동 집계.
- **Display Guide(가장 중요):** 진열도(제품 포함) + 제품 목록표(수량·Facing·크기)를 한 장에 구성 → **PNG/PDF** 출력.
  현장 작업자가 가이드만 보고 동일하게 진열 가능.
- **Installation Mode:** 제품별 설치 체크리스트(완료 체크).
- **모든 곳 동일 데이터:** 제품이 2D 평면도 · 3D 아이소메트릭(실제 위치/크기/방향) · PNG/PDF · Display Guide 에 동일 반영.
- **확장 구조:** 레이어(Furniture/Products/…)와 `Product.meta` 로 향후 ERP · 재고 · 판매 · AI 자동진열 · 추천 진열 확장 대비.
- 로드맵(이번 버전 미포함 / 구조만 선반영): 라이브러리 드래그&드롭(현재 [배치] 버튼), Shelf 자동 인식/Capacity UI,
  Product Package/Template 저장·적용, ERP·AI 자동 진열.

**v0.9.2 — Professional Lighting System (3D 렌더 품질)**
- **Lighting Engine(확장형 조명 엔진):** `src/features/iso/lighting/LightingEngine.ts` — Ambient · Directional ·
  Spot · Area 조명을 Light 유니온 + accumulate 로 계산. 새 조명(LED/간접/쇼케이스/월워시)은 타입 + case 추가로 확장.
  기본값 Ambient + Directional. 아이소메트릭 각 면(바닥/벽/집기)에 Lambert diffuse + ambient + spot 물리 근사 셰이딩.
- **Sun Direction:** 좌/우/정면/후면/상단 프리셋 + 방위각/고도 각도.
- **Spot Light:** 위치·높이·세기·콘 각도 조절.
- **Shadow System 개선:** Real floor shadow(실제 집기 형태 footprint 를 광원 방향으로 투영) + Contact(접지) + Soft(부드러움).
  단순 원형이 아니라 형태 그대로 투영.
- **Material(재질):** Matte / Semi Gloss / Gloss / Transparent / Acrylic — 집기 속성에서 선택. Blinn-Phong 스페큘러 하이라이트 +
  투명/아크릴 반투명. 로컬/전역 집기 자동 판별 저장(Cloud/Auto Save 반영).
- **Color Temperature:** 2700 / 3000 / 4000 / 5000 / 6500K (Tanner Helland 근사 틴트).
- **Ground Reflection:** 반사 강도에 따른 바닥 광택 하이라이트.
- **품질:** imageSmoothing high(직전) 유지 + Edge 스트로크 강화.
- **Lighting Panel:** 3D 미리보기에 조명 패널(Ambient/Directional/태양/Spot/그림자/색온도/바닥반사).
- **유지:** Design Mapping · 3D Geometry · Auto Orbit · 자유 카메라 · Undo/Redo · CAD · Print · Cloud/Auto Save 정상.
- 로드맵: Three.js 기반 실사 렌더(GI/실시간 반사), Area Light 소프트섀도 고도화.

**v0.9.1 — Design Mapping & 3D Geometry Engine (기존 기능 완성)**
- **Geometry Generator(2D Shape → 3D Extrude 파이프라인):** Shape 별 Renderer 를 레지스트리에 등록하는
  확장형 구조(`src/features/iso/geometry/GeometryGenerator.ts`). Shape 마다 바닥 외곽선(footprint)만 정의하면
  3D 렌더러가 높이만큼 Extrude 하여 자동 생성 → **새 Shape 는 Renderer 한 줄 등록**으로 3D 지원.
  - Rectangle→Box, RoundedRectangle→라운드(곡면 코너), Circle→원기둥, Semicircle→반원, Custom Path/SVG→Path Extrude(외곽선 샘플링).
  - **곡선 집기는 절대 박스로 표현되지 않음** — 라운드/원기둥/커스텀은 곡면 실루엣 유지.
- **곡면 Texture Wrap(둘레 UV):** 원기둥/라운드/커스텀은 디자인 이미지를 둘레 비율로 잘라 각 면에 감아
  진짜 UV wrap 처럼 표시. 사각형은 Front/Back/Left/Right 면별 매핑 유지, 모든 Shape 의 Top 매핑 유지.
- **Design Mapping 정상화(최우선 버그 수정):** 업로드가 Firebase Storage 설정/보안규칙/CORS 에 의존해
  실패하던 문제를 해결. 이미지를 **경량 dataURL**(긴 변 1000px + 압축, Firestore 용량 고려)로 인코딩해
  배치안과 함께 저장 → 외부 설정 없이 **업로드 → 2D → Cloud/Auto Save → 새로고침 → 3D → PNG/PDF** 전 구간 동작.
  crossOrigin/CORS 무관(캔버스 taint 없음). Front/Back/Left/Right/Top 면별 매핑 반영.
- **3D 벽 Z-Order 수정:** 벽은 항상 배경, 집기는 항상 벽 앞(렌더 페이즈 분리: 바닥→벽→집기). 모든 카메라 동일.
- **Design Mapping → 3D:** 평면도에서 지정한 면 디자인이 3D 아이소메트릭 각 면에 어파인 매핑으로 표시.
- **집기 Shape 반영:** `circle` 은 다각형(원기둥) 실루엣으로 3D 렌더(그 외는 박스). 원기둥 텍스처는 왜곡 방지 위해
  면별 매핑 생략(Cylinder Wrap 은 로드맵).
- **3D Auto Orbit:** ▶/⏸ 360° 자동 회전 + 속도(Slow/Normal/Fast).
- **3D 자유 카메라:** 마우스 드래그로 궤도 회전(방위각·고도), Shift+드래그 이동(Pan), 휠 확대/축소. 기존 5개 시점 프리셋 유지.
- **품질 향상:** `imageSmoothingQuality: high`(텍스처 필터링/AA), Edge 스트로크 유지.
- **유지:** Undo/Redo · CAD 생산성 · Print Production · Cloud/Auto Save · Advanced Color · Shape Editor · Wall View ·
  PNG/PDF · Share Links 정상.
- 로드맵(이번 버전 미포함): 완전한 Material(Matte/Gloss/Acrylic) · Ambient/Contact Shadow 고도화 ·
  Three.js 기반 실사 렌더. 현재 Geometry Generator/아이소메트릭 파이프라인 위에 단계적 확장 예정.

**v0.9.0 — Professional CAD Productivity (설계 속도 극대화)**
- **Presentation Mode 제거:** 툴바 버튼·오버레이·PDF·`?present=1` 라우팅·관련 코드 삭제(기존 기능 영향 없음).
- **Undo / Redo:** `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y`, 최대 200 History. **액션 단위**(배열 복사·미러·정렬 각각 1회 Undo).
  편집 상태 스냅샷을 debounce 기록, 자동/클라우드 저장과 독립(충돌 없음). 부스 외곽(Shape) 편집도 포함.
- **다중 선택:** Ctrl/Cmd/Shift + 클릭으로 집기 다중 선택 토글. 선택 시 캔버스 상단 **Floating Multi‑Action Toolbar** 표시.
- **정렬(Align):** Left · Right · Top · Bottom · 가로중앙 · 세로중앙 (회전 반영 AABB 기준).
- **분배(Distribute):** 가로 · 세로 균등 간격.
- **배열 복사(Array):** Linear(수량·가로/세로 간격) · Circular(수량·전체 각도, 그룹 중심 회전).
- **미러(Mirror):** 좌우 · 상하 반사 + 미러 복사(그룹 중심 기준 배치 반사).
- **빠른 복제/삭제:** 다중 선택 Duplicate(`Ctrl+D`) · Delete.
- **Rotate 프리셋:** 집기 속성에서 0/45/90/135/180° 즉시 회전 + 직접 입력.
- **성능:** History 200개 상한, 스냅샷 참조 동일성 비교로 경량화.
- **유지:** Design Mapping · Print Production · Cloud/Auto Save · Shape Editor · View Rotation · 3D Preview ·
  Wall View · Share Links · SVG Import · Image Background · Advanced Color 모두 정상.
- 다음 단계(이번 버전 미포함, 로드맵): Smart Measure · Figma급 Smart Guide · Offset Tool · SketchUp Component/Instance ·
  Layer Panel · Outliner · Marquee 영역 선택 · Snap(교차점/가이드) 확장 · Rotate Gizmo 핸들. 위 도구들이
  안정적으로 얹히도록 다중선택·히스토리·액션 파이프라인을 기반으로 구축했습니다.

**v0.8.9 — Print Production Workspace (출력물 제작)**
- **툴바 [출력물 제작]:** 편집 화면이 아니라 실제 출력업체 전달용 PDF 를 만드는 작업 공간.
  선택 집기 기준 진입(선택 없으면 첫 집기), 상단 드롭다운으로 다른 배치 집기로 전환.
- **면별 탭:** Front · Back · Left · Right · Top · Bottom 각 면의 실제 출력면 확인.
- **자동/수동 사이즈:** 집기 치수 기준 자동 계산(Front=W×H, Left=D×H, Top=W×D, 단위 mm) +
  면별 수동 수정. 화면 매핑과 별도로 Print 설정에 저장.
- **Bleed:** 0/3/5/10mm 프리셋 + 직접 입력. 블리드 포함 최종 출력 사이즈 표시.
- **Safe Area:** ON/OFF + mm 입력(안전영역 파선 표시). **Crop Mark:** ON/OFF(재단선).
- **DPI 체크:** 원본 이미지 해상도 대비 실효 DPI 계산 — 300+ 좋음 / 150–299 주의 / 150미만 낮음 /
  해상도 정보 없으면 "해상도 확인 불가".
- **Print Preview:** 디자인 이미지 · 블리드 · 안전영역 · 재단선 · 실제 mm · DPI 상태를 실제 출력물처럼 표시.
- **출력용 변형(별도 저장):** Scale · X/Y Offset · Rotation · Flip H/V — 화면 시안용 Mapping 과 분리.
- **Export:** 면별 PDF(`집기명_front.pdf`) · 모든 면 PDF(순차 다운로드) · `manifest.json`
  (projectName/fixtureName/faces[사이즈·bleed·safe·dpi]). PDF 는 실제 사이즈 + Bleed + Crop Mark + Safe Area 포함.
- **데이터:** `FixtureDef.printSettings.faces[face] = { widthMm, heightMm, bleedMm, safeAreaMm, cropMark, transform, dpiInfo }`.
  기존 프로젝트 자동 호환(없으면 집기 치수 기준 기본값 생성). 로컬 집기는 배치안 자동/클라우드 저장에 포함,
  전역 집기는 라이브러리에 즉시 저장.
- **연동:** Design Mapping(v0.8.7) 에셋을 재업로드 없이 그대로 사용. Presentation Mode 와 독립적으로 동작.
- 브라우저 한계상 PDF 는 래스터 합성(대형 면은 해상도 캡)이며, 인쇄 적합성은 DPI 체크로 안내.

**v0.8.8 — Presentation Mode (고객 시안 검토)**
- **Presentation 버튼(툴바):** 편집이 아닌 "고객에게 보여주기" 전용 전체화면 모드로 진입.
- **풀스크린 UI:** 좌/우 패널·툴바·그리드·치수·선택 핸들 등 CAD UI 를 모두 숨기고, 깨끗한
  렌더 이미지(오프스크린 렌더러 재사용)만 표시 — 편집기와 결과가 100% 일치.
- **네비게이션:** 2D · 3D · Wall 전환. 3D 는 정면/좌측/우측/후면/Top 5개 카메라.
- **Walkthrough:** 3D 카메라 자동 순회(재생/정지). ← → 로 수동 카메라 이동(3D 시점·벽면 전환).
- **디자인 비교:** 디자인 ON/OFF 즉시 토글(같은 화면에서 시안 유/무 빠른 비교).
- **Light / Dark:** 배경 테마 전환(3D 는 배경·바닥 톤까지 반영).
- **브랜드 모드 · 워터마크:** 로고 표시/숨김, 워터마크 ON/OFF.
- **스크린샷:** HD / Full HD / 4K 해상도로 현재 화면 PNG 저장.
- **Presentation PDF:** 평면도 + 3D + 벽면을 담은 시안 검토용 PDF 생성.
- **Presentation 공유:** 읽기 전용 공유 링크(`/share/…?present=1`) 생성 — 열면 자동으로
  Presentation 모드로 진입.
- **키보드:** ← → 카메라 이동 · **ESC** 종료 · **F** 전체화면.
- **비파괴:** 렌더러에 `showGrid`/`showDimensions`(2D), `background`/`backDiagonal`(3D) 옵션만
  추가(모두 기본값 유지) — 기존 편집·출력·3D 미리보기 동작 불변.

**v0.8.7 — Design Mapping System (기반)**
- **디자인 패널(집기 속성 → 색상 아래):** 실제 출력 디자인 이미지를 집기에 입힙니다.
  - **업로드:** PNG · JPG · JPEG · WEBP · SVG (드래그&드롭 + `Ctrl+V` 붙여넣기). 썸네일/파일명/삭제·교체 미리보기.
  - **면별 매핑:** Front · Back · Left · Right · Top · Bottom 개별 지정, **[모든 면 동일 적용]** 스위치.
  - **매핑 방식:** Stretch · Contain · Cover · Center · Tile. **변형**(스케일 · 회전 · 좌우/상하 반전 · X/Y 오프셋) 실시간 미리보기.
  - **투명도**는 기존 opacity 시스템과 통합. **매핑 복사/붙여넣기**(집기 디자인을 다른 집기로 복제).
- **에셋 매니저(집기 라이브러리 하단):** 디자인 목록(썸네일 · 파일명 · 사용 집기 수 · 교체 · 삭제).
  - **교체 시 같은 assetId 유지** → 사용 중인 모든 집기가 자동 반영. 삭제 시 해당 매핑 정리 + Storage 파일 정리.
- **반영 범위:** **평면도 2D**(집기 위 텍스처 클립) · **아이소메트릭 3D**(면별 텍스처) · **PNG/PDF 출력**에 동일 적용.
- **저장:** 이미지는 **Firebase Storage** 에 업로드하고 Firestore/공유/자동저장에는 **URL 참조만** 저장(Base64 없음).
  Storage 미구성(env) 시 업로드는 비활성화되며 오류 없이 동작. 텍스처 로더/캐시 재사용.
- **데이터 구조:** `DesignAsset`(이미지 참조) / `DesignMapping`(면별) / `TextureTransform`(변형) 분리 —
  추후 AI 생성 · UV · Curve · Cylinder 매핑 확장 대비.
- 다음 단계(미구현): Three.js 기반 실사 3D · UV/Curve/Cylinder 매핑 · AI 디자인 생성 연동.

**v0.8.6 — Smart Booth Shape Editor (CAD 스타일)**
- **부스 외곽 편집 모드:** 툴바 **[부스 편집]** 토글 → 편집 모드에서만 꼭짓점/Edge 핸들 표시(평소 숨김).
  - **꼭짓점 드래그**(그리드 스냅) · **Edge 중앙 [+]** 로 꼭짓점 추가 · 꼭짓점 선택 후 **Delete**(최소 3개 유지).
  - **Edge 드래그**로 벽 자체를 이동(양쪽 꼭짓점 함께 이동, CAD Offset 느낌) · **Edge hover 시 길이(mm)** 표시 · 선택 꼭짓점 **각도(°)** 표시.
  - **넓이(㎡) 실시간** 칩, **부스 밖 집기 경고**(자동 삭제 없음, 좌표 불변).
  - **보기 회전(0/45/90/…)** 상태에서도 편집 가능(Konva `getRelativePointerPosition` 역변환).
- **데이터:** 기존 `polygonPoints` 구조 재사용 — rectangle 부스는 편집 시 자동으로 polygon 으로 승격(마이그레이션 없음, 기존 프로젝트 호환).
- **자동 반영:** 외곽 변경이 **3D · 벽면 · PNG · PDF** 에 그대로 반영(모두 `getBoothPolygon` 기준). 편집은 프로젝트에 디바운스 저장(자동/클라우드 저장 유지).
- 2차 후보(미구현): Wall Offset 전용 UI · Shape Templates(사다리꼴/L/U…) · Shape Lock · Shape 전용 Undo/Redo · 45/90° 각도 스냅.

**v0.8.5 — Advanced Color System**
- **고급 색상 선택기(집기 색상):** 브랜드 컬러 → 기본 팔레트 → 최근 사용 → HEX 입력 → Color Picker → 투명도 순으로 구성.
  - HEX 직접 입력(자동 대문자·# 자동 추가·3자리→6자리), 잘못된 값은 "올바른 HEX 형식이 아닙니다" 안내.
  - 브라우저 기본 `<input type=color>` 와 HEX 항상 동기화, **투명도(0~100%)** 슬라이더 → 채움을 `rgba` 로 적용.
  - **최근 사용 색상 10개**(LocalStorage, 칩 클릭 즉시 적용), 기본/브랜드(Seedbee Blue·Green·Islo Mint 등, 확장 가능) 팔레트.
- **데이터:** `FixtureDef.opacity` 추가(누락 시 1 로 취급 → 기존 프로젝트 자동 호환, 마이그레이션 불필요).
- **반영 범위:** 색상·투명도가 **평면도 · 3D 아이소메트릭 · PNG/PDF** 에 동일하게 적용. Firestore/공유/자동저장 영향 없음.

**v0.8.4 — Editable View Rotation**
- **회전 상태에서도 편집 가능:** 보기 회전(90/180/270/자유 각도) 중에도 드래그·선택·스마트 스냅·복사·삭제·요소 추가가
  일반 상태와 동일하게 동작. (v0.8.3에서는 회전 시 편집 잠금 → 제한 제거)
- 회전은 여전히 **View Transform**(Konva 레이어 회전)이며, Konva 가 pointer→layout 좌표를 자동 역변환하므로
  드래그 결과 mm 좌표가 정확합니다. **실제 저장되는 mm 좌표는 회전과 무관하게 불변**(회전값은 데이터에 저장 안 됨).
- 읽기 전용(공유 view 링크)에서는 여전히 편집 잠금. PNG/PDF는 현재 화면(회전) 기준 출력 유지.

**v0.8.3 — Share Links & Plan View Rotation**
- **공유 링크:** 프로젝트별 `shareId`/`shareEnabled`/`sharePermission('view'|'edit')`. 공유 Dialog에 **이메일 공유 / 링크 공유** 탭 —
  링크 생성/복사/비활성화 + 권한(보기만/수정 가능). `/share/:shareId` 라우트: Google 로그인 후 권한에 따라 편집/읽기전용 진입,
  유효하지 않은 링크 안내. (링크 해석은 인덱스 없이 `shares/{shareId}` 문서로)
- **읽기 전용 모드:** view 권한/보기 회전 시 저장·자동저장·드래그·집기 배치·요소 추가 비활성 + **"읽기 전용으로 열람 중"** 표시.
- **평면도 보기 회전:** 툴바에 좌/우 90° · 자유 각도 입력 · 초기화. **보기 전용 변환**(Stage 레이어 회전) — **실제 좌표(mm)는 불변**.
  회전 시 편집 잠금(0°에서만 편집), `보기 회전 N°` Chip 표시. 집기명/치수선/텍스트/이미지/SVG 배경 모두 함께 회전.
  PNG/PDF는 **현재 화면(회전) 기준**으로 출력. 벽면/3D는 영향 없음.

**v0.8.2 — Project Sharing for Team Access**
- **프로젝트 공유:** owner uid 유지 + `sharedWith: string[]`(이메일) + `visibility: 'private' | 'shared'`.
  - 프로젝트 목록에서 **[공유]** → 이메일 추가/삭제, 공유 사용자 목록, 상태 표시(비공개/공유됨).
  - **목록 조회:** 내가 owner 인 프로젝트 **또는** 내 Google 이메일이 `sharedWith` 에 포함된 프로젝트를 함께 표시.
  - **권한:** 공유 대상은 **읽기+편집** 가능(저장 시 원래 owner 유지). 읽기전용/에디터 구분은 TODO.
  - **하위 호환:** `sharedWith` 없으면 `[]`, `visibility` 없으면 `private`.
  - ⚠️ 실제 공유 접근을 위해 **Firestore 보안 규칙 업데이트 필요**(아래 "클라우드 저장 설정" 참고).

**v0.8.1 — Google Sign-in for Cross-device Sync**
- **Google 로그인 추가(익명 유지):** 헤더에 로그인 상태 표시 + `[Google로 로그인]`/`[로그아웃]`.
  - 익명 사용자가 Google 로그인 시 **계정 연결(link)** → uid 유지(기존 프로젝트/집기 그대로 소유).
  - 다른 기기에서 같은 Google 계정으로 로그인하면(이미 링크됨) 그 계정으로 로그인 + 이 기기의 로컬 작업을 해당 uid 로 **이전** → **어느 기기서든 동일 projects/libraries**.
  - 로그인 전(익명)에도 기존처럼 동작, Firebase 미설정 시 LocalStorage 전용(`로컬 저장` 표시).
  - 저장/불러오기는 항상 **현재 로그인 uid(owner)** 기준. 자동저장/최근 프로젝트/마이그레이션 유지.

**v0.8.0 — Firestore Cloud Project Storage**
- **클라우드 저장(Firestore):** 저장소를 LocalStorage → **Firestore 기본 + LocalStorage 캐시/백업**으로 확장.
  집에서 저장한 프로젝트를 다른 기기에서 이어 작업 가능(불러올 때 최신본 조회, 실시간 공동편집·snapshot 리스너 미사용).
- **익명 로그인:** 앱 실행 시 Firebase Anonymous Auth 자동 로그인 → `owner`(uid)로 내 프로젝트만 조회/저장.
- **자동 저장:** 기존 `저장` 버튼 유지 + **5초 debounce Auto Save**, 상태 표시(`저장 중… / 저장됨 / 저장 실패`).
- **최근 프로젝트:** 홈에서 최근 프로젝트 자동 로드 → `이어서 작업하기`로 바로 열기.
- **마이그레이션:** 최초 실행 시 LocalStorage 프로젝트/집기를 Firestore 로 **1회 업로드**(계정 플래그로 중복 방지).
- **환경 변수 기반 설정(자격 증명 비커밋):** `VITE_FIREBASE_*` 미설정 시 기존처럼 **LocalStorage 전용**으로 동작(하위 호환).
  이미지는 이번 단계에서도 dataURL 유지(Firebase Storage 미도입).

**v0.7.3 — UI & Fixture Library Management**
- **UI 가시성 개선:** 툴바 버튼을 그룹/메뉴로 정리(`요소 추가 ▾`, `내보내기 ▾`), 주요 버튼(저장·3D 미리보기)
  강조, 좌측 라이브러리 카드 가독성 개선(선택 하이라이트·개수 표시), 데스크톱 우선
- **집기 라이브러리 다중 선택/일괄 삭제:** 카드 체크박스 + 전체 선택 + `선택 삭제(N)` + 삭제 confirm
  (기본 시드 집기 포함 경고), 목록 즉시 갱신, 기존 단일 삭제 유지
- **벽면 보기 선택(사용할 벽면 ON/OFF):** 프로젝트별로 정면/좌측/우측/후면 벽 사용 여부 선택
  (`boothConfig.usedWalls`). OFF 벽면은 **탭 비활성 + 벽면 출력 제외 + 3D 미리보기에서 렌더 안 함**.
  기존 프로젝트는 모든 벽 ON(하위 호환), 높이 미설정 시 기존처럼 벽면 기능 비활성.

**v0.7.2 — Save Converted SVG Fixtures to Library**
- **변환 집기 편집:** SVG 변환 집기 선택 시 오른쪽 패널에서 이름·형태·가로·세로·높이·색상·메모 수정
  - 크기/색상은 캔버스에 즉시 반영, 값은 `localFixture` 에 저장, placedFixture 위치는 유지
- **집기 라이브러리에 저장:** `[집기 라이브러리에 저장]` 버튼 → `storage.saveFixture` 로 전역 등록
  - 저장 즉시 왼쪽 라이브러리에 표시, 다른 프로젝트에서도 재사용
  - 이미 저장된 집기는 **"이미 라이브러리에 저장됨"** 표시 + 버튼 비활성(중복 저장 방지)
- **대형 Rect 배경 추정 경고:** 요소가 문서(viewBox)의 가로·세로 80% 이상을 차지하면
  **"배경/아트보드로 추정"** 경고 표시 + 변환 시 confirm (전체 아트보드 오변환 방지)

**v0.7.1 — SVG to Fixture Converter**
- **SVG → Fixture 변환:** SVG Inspector 에서 도형을 선택하면 **[집기로 변환]** 버튼으로 실제 집기 생성
  - 변환 규칙: `rect→rectangle` · `circle→circle` · `ellipse/polygon/polyline/path→customPath` · `line→치수선`
  - **CustomPath 정규화:** path 는 브라우저 샘플링으로, polygon/polyline 은 점 목록으로 **100×100 박스** 정규화
    (기존 customPath 포맷과 동일 — `widthMm/100, depthMm/100` 스케일)
  - **위치·크기:** SVG BoundingBox 기준으로 mm 자동 계산 후 현재 위치 그대로 캔버스에 생성
  - **색상:** fill → stroke → 기본 회색 순으로 결정
  - **자동 이름:** 같은 타입 내 순번 (Rect 1, Circle 1, Polygon 3, Path 8 …)
  - **변환 완료 표시(Converted):** 중복 변환 방지, 변환 직후 새 집기 자동 선택
  - ⚠️ 이번 단계는 **"SVG → Canvas"** 까지 — 변환 집기는 배치안에만 저장(`localFixtures`),
    **Fixture Library 저장은 하지 않습니다** (v0.7.2 예정). text 변환도 아직 미지원.

**v0.7.0 — SVG Parser & Document Inspector**
- **SVG Import 2단계:** SVG를 "단순 이미지"가 아니라 내부 구조 객체로 가져오기 (읽기 전용)
  - **SvgParser:** path/rect/circle/ellipse/polygon/polyline/line/text 파싱 → `SvgElement`
    (bbox 는 브라우저 렌더 기반 정규화 좌표로 계산해 transform/viewBox 무관하게 정확)
  - **SvgDocument:** `elements[]` + metadata(viewBox/크기) + mm 배치, Layout 에 저장(Firebase 호환)
  - **가져오기 방식 선택:** 파일 선택 시 ① 배경으로 ② SVG 객체로 중 선택
  - **SVG 검사기(Inspector):** 타입별 도형 개수 + 총 개수 표시
  - **도형 선택 → 캔버스 하이라이트:** Inspector 목록에서 도형 클릭 시 평면도에 정확한 mm 위치로 표시
  - **역할 분리:** `SvgParser` / `SvgModel` / `SvgRenderer` / `SvgConverter` (변환기는 v0.7.1 예정)
  - ⚠️ 이번 단계는 **읽기까지만** — SVG→집기 자동 변환은 하지 않습니다 (v0.7.1)
  - *Illustrator(.ai)는 직접 읽지 않고 **SVG로 저장 후 업로드**하는 방식을 권장합니다.*

**v0.6.0 — Layout Management & Isometric Preview**
- **배치안 관리:** Select 오른쪽 "…" 메뉴로 이름 변경 / 복제 / 삭제
  - 복제: 현재 배치안 전체(집기·텍스트·치수·이미지·배경·벽면요소) 복사, "기존이름 복사본", 자동 선택
  - 삭제: 확인 후 삭제, 가장 최근 수정 배치안 자동 선택(없으면 빈 캔버스)
- **아이소메트릭 Preview 개선** (Canvas 기반, Three.js 미도입)
  - 시점 선택: 좌측 사선 / 우측 사선 / 정면 사선 / Top View
  - 줌: 마우스 휠 · +/- · 화면 맞춤
  - 부드러운 그림자(집기/벽), 벽면 명암 차이 + 근접 벽 반투명(투명도 슬라이더)
  - 바닥 색 선택 · 체크 패턴 ON/OFF, 집기 실제 높이 비율 반영(min/max clamp)
  - 3D 집기명 표시 토글, 벽면 이미지/텍스트/치수선 벽에 부착 렌더
  - PNG 출력 화질 선택(기본 1920 / 고화질 3840 / 인쇄용 6000px), 현재 시점 그대로 저장
  - Preview 는 Dialog 열 때만 렌더, 닫으면 상태 정리 (편집기 성능 무관)

**v0.5.1 — Optional Height & SVG Background**
- 집기명 도형 위 표시 (토글 ON/OFF, 작은 집기 자동 숨김, PNG/PDF 반영)
- 부스 높이를 선택값으로 변경 ("높이 설정 안 함" → `heightMm: null`, 벽면/3D 비활성)
- 배치안 Select 문구 겹침 수정 (label 구조 개선, 좁은 화면 대응)
- SVG 배경 도면 불러오기 1차 (업로드/이동/크기/투명도/잠금, PNG/PDF 반영)

**v0.5.0 — Isometric Preview**
- 아이소메트릭 3D 미리보기 추가 (평면 배치 + 벽면 요소 + 집기 높이 기반 30° 시안)
- 3D preview PNG 저장 (`프로젝트명_배치안명_isometric.png`)
- **버그 수정:** ImageNode 가 Konva Stage 트리 내부에서 React 훅을 호출해 발생하던
  "Invalid hook call" 오류 수정 (이미지 로드/Transformer 를 캔버스 레벨 훅으로 이동)

**v0.4.0 — Plan & Wall Annotation**
- polygon 부스 · customPath 집기 · 스마트 스냅 · 텍스트 · 치수선 ·
  벽면 전개도(보기/요소) · 이미지 삽입

### TODO / 향후 개선 후보 (설계만, 미구현)

- 도형/집기 **레이어 순서 변경** (앞으로/뒤로 보내기)
- **그리드 표시 ON/OFF** 토글
- **치수선 표시 ON/OFF** 토글
- **프로젝트 복제**
- **SVG text 변환** · 자동 그룹화 · Transformer 기반 크기 조절
- polygon 실제 edge 기반 벽면 길이 · 다중 선택
- Firebase(Firestore + Storage) 전환 · Three.js 실 3D 뷰

### 설계 (미구현) — 곡선/패스 부스 편집 (Path Booth)

포토샵 Pen Tool 같은 곡선 부스 편집 기능. **이번 단계에서는 구현하지 않고 설계만** 정리합니다.

**목표**
- BoothShape 확장: `rectangle` / `polygon` / **`path`** (SVG path 기반 곡선 부스)
- Pen Tool 처럼 점 추가/삭제, 베지어 핸들 편집, 직선/곡선 혼합
- edge hover 시 해당 변 길이 표시, 전체 둘레·면적 계산(곡선은 샘플링 기반)
- PNG/PDF/3D 미리보기까지 반영

**데이터 모델(안)**
```ts
// BoothConfig 확장 (기존 필드와 병행, 하위 호환)
boothShape?: 'rectangle' | 'polygon' | 'path';
// path 부스: 앵커 + 베지어 핸들 (모두 mm)
boothPath?: {
  nodes: {
    xMm: number; yMm: number;           // 앵커
    inHandle?:  { xMm: number; yMm: number }; // 들어오는 제어점(없으면 직선)
    outHandle?: { xMm: number; yMm: number }; // 나가는 제어점(없으면 직선)
  }[];
  closed: boolean;                       // 부스는 항상 closed 예정
};
```

**기하/계산(안)**
- 렌더/판정용으로 path 를 폴리라인으로 **샘플링**(예: 곡선 segment 당 16~32 분할) → 기존
  `getBoothPolygon`/`getBoothBounds`/`pointInPolygon`/벽/스냅/iso 로직 재사용
- 곡선 변 길이 = 샘플 점 사이 거리 합, 둘레 = 전체 합, 면적 = shoelace(샘플 폴리곤)
- 벽면 전개도: 각 edge(직선/곡선)를 한 벽으로 매핑, 곡선은 전개 길이 = 샘플 길이

**편집 UX(안)**
- 전용 "부스 편집" 모드: 캔버스에 앵커(원)·핸들(선+점) 표시
- 클릭=앵커 추가, Alt+드래그=핸들 분리(코너↔스무스), 앵커 드래그=이동, Del=삭제
- edge hover 시 길이 툴팁, 상단에 둘레/면적 실시간 표시

**단계 제안**
1. 데이터 모델 + path→폴리라인 샘플러 + 렌더(읽기 전용)
2. 앵커 추가/이동/삭제(직선만)
3. 베지어 핸들 편집(곡선)
4. edge 길이/둘레/면적 + 벽면 전개 + PNG/PDF/3D 반영

---

## 클라우드 저장 (Firestore) 설정 — v0.8.0

`VITE_FIREBASE_*` 환경 변수를 설정하면 **Firestore 가 기본 저장소**가 되고 LocalStorage 는
캐시/백업/오프라인 폴백으로 동작합니다. **미설정 시 기존처럼 LocalStorage 전용**으로 동작합니다.

### 1) 필요한 환경 변수 (`.env` 또는 `.env.local`)

`.env.example` 을 복사해 값을 채우세요. 값은 **Firebase Console → ⚙ 프로젝트 설정 →
"내 앱"의 웹 앱(</>) → SDK 설정 및 구성**의 `firebaseConfig` 에서 얻습니다.
(웹 앱이 없으면 "앱 추가 → 웹" 으로 생성)

| 환경 변수 | firebaseConfig 키 | 필수 |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | `apiKey` | ✅ |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` (예: `your-app.firebaseapp.com`) | ✅ |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` | ✅ |
| `VITE_FIREBASE_APP_ID` | `appId` | ✅ |
| `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` | 선택(이번 단계 미사용) |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` | 선택 |

> 4개 필수 값 중 하나라도 비면 LocalStorage 전용으로 동작합니다.
> `.env*` 는 `.gitignore` 로 커밋되지 않습니다(`.env.example` 만 커밋).

### 2) Firebase Console 준비

1. **Authentication → Sign-in method → 익명(Anonymous)** 사용 설정
   - 그리고 **Google** 제공업체도 사용 설정(v0.8.1 크로스 디바이스 로그인) — 지원 이메일 지정
2. **Firestore Database → 데이터베이스 만들기**
3. **Firestore 보안 규칙**: 소유자 + 공유 대상(v0.8.2) 접근 허용

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{db}/documents {
       match /projects/{id} {
         // 소유자 · sharedWith(이메일) · 활성 공유링크(shareEnabled) 는 읽기 가능
         allow read: if request.auth != null
           && (resource.data.owner == request.auth.uid
               || request.auth.token.email in resource.data.get('sharedWith', [])
               || resource.data.get('shareEnabled', false) == true);
         allow create: if request.auth != null
           && request.resource.data.owner == request.auth.uid;
         // 소유자 · sharedWith · (edit 권한 공유링크) 는 수정 가능
         allow update: if request.auth != null
           && (resource.data.owner == request.auth.uid
               || request.auth.token.email in resource.data.get('sharedWith', [])
               || (resource.data.get('shareEnabled', false) == true
                   && resource.data.get('sharePermission', 'view') == 'edit'));
         allow delete: if request.auth != null
           && resource.data.owner == request.auth.uid;
       }
       // 공유 링크 해석용(shareId → projectId). 로그인 사용자면 조회 가능
       match /shares/{shareId} {
         allow read, write: if request.auth != null;
       }
       match /libraries/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
       match /users/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```
   > `.get(field, default)` 로 구버전 문서(필드 누락)도 안전하게 처리합니다.
   > 삭제는 소유자만, 공유 대상/링크(edit)는 읽기·편집 가능. 링크(view)는 읽기만 가능합니다.
4. **Authentication → Settings → 승인된 도메인**에 배포 도메인(및 localhost) 추가

### 3) Firestore Collection 구조

```
projects/{projectId}
  owner            : string (uid)
  name             : string
  createdAt        : number
  updatedAt        : number
  currentLayoutId  : string | null
  data             : Project   // boothConfig · layouts[](placedFixtures/texts/dimensions/
                               //   images/backgrounds/wallItems/localFixtures/svgDocuments) · usedWalls

libraries/{uid}
  fixtures         : FixtureDef[]   // 전역 집기 라이브러리(사용자 단위)
  updatedAt        : number

users/{uid}
  migrationCompleted : boolean       // LocalStorage → Firestore 1회 마이그레이션 완료 표시
```

> ⚠️ 이미지는 dataURL(base64)로 `data.layouts[].images` 등에 인라인 저장됩니다. 대용량 이미지가
> 많으면 Firestore 문서 1 MiB 한도에 걸릴 수 있어, 추후 **Firebase Storage(외부 URL)** 전환을 권장합니다.

---

## 배포

### Firebase Hosting (기본)

이 저장소는 [`firebase.json`](firebase.json)(SPA rewrites, `public: dist`)과
[`.firebaserc`](.firebaserc)를 포함합니다.

```bash
npm run build          # dist/ 생성
firebase deploy        # Firebase Hosting 배포 (firebase-tools + 로그인 필요)
```

### Netlify (대안)

[`netlify.toml`](netlify.toml) + [`public/_redirects`](public/_redirects) 포함.
- 빌드 명령: `npm run build` / 배포 디렉토리: `dist`
