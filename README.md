# Booth Layout Planner

> **v0.8.6 - Smart Booth Shape Editor**

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
