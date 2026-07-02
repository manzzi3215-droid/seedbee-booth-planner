# Booth Layout Planner

> **v0.7.2 - Save Converted SVG Fixtures to Library**

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

### Changelog

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
