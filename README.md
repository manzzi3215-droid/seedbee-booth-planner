# Booth Layout Planner

백화점 · 박람회 · 팝업스토어 등 다양한 행사장의 부스를 직접 설계하는
**2D 레이아웃 편집 웹앱**입니다. CAD 같은 전문 설계 도구가 아니라
"누구나 쉽게 쓰는 부스 레이아웃 플래너"를 목표로 합니다.

디자인팀이 Illustrator로 만들던 부스 시안을, 실무자가 직접 집기를 배치하며
여러 배치안을 만들어 볼 수 있게 합니다.

---

## 주요 기능

- **행사장(부스) 생성** — 행사명, 가로·세로·높이(mm), 오픈면(1/2/3면), 바닥 종류
- **2D 캔버스** — 실제 mm 비율 평면도, 그리드(500mm), 확대/축소(휠), 화면 맞춤,
  오픈면에 따른 벽체 표시
- **집기 라이브러리** — 집기 등록/수정/삭제, 형태 지원(사각형 · 둥근 사각형 · 원형,
  그리고 반원형 · 커스텀 경로는 확장 예정 구조)
- **배치** — 라이브러리에서 캔버스로 배치, 드래그 이동, 선택/하이라이트,
  그리드 스냅, 부스 밖 이탈 경고
- **편집 편의** — 90도 회전 · 복사 · 삭제, 위치/회전 직접 입력,
  키보드 단축키(Delete 삭제 · R 회전 · Ctrl/Cmd+D 복사 · 방향키 이동)
- **배치안 버전 관리** — 하나의 프로젝트에 여러 배치안(v1, v2, "체험존 강조안" 등)
  저장/불러오기, 최근 배치안 자동 로드
- **출력** — PNG 저장, A4 가로 PDF 저장(도면 + 정보 + 집기 리스트),
  사용 집기 리스트 자동 집계

---

## 기술 스택

- **React 19 + Vite + TypeScript**
- **Material UI (MUI)** — UI 컴포넌트
- **React Konva / Konva** — 2D 캔버스
- **react-router-dom** — 라우팅
- **jsPDF** — PDF 출력
- **localStorage** — 저장 (Storage Layer로 추상화, 추후 Firebase 전환 가능)
- 배포: **Netlify**

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
│  ├─ canvas/                # React Konva 캔버스, 좌표/기하 유틸
│  ├─ fixtures/              # 집기 라이브러리 (폼, 시드, 훅)
│  ├─ editor/                # 편집기 상태(Context), 툴바, 패널, 단축키
│  └─ export/                # PNG/PDF 출력, 집기 리스트
├─ types/                    # 도메인 타입 (Project, Layout, FixtureDef 등)
├─ utils/                    # id 생성, 프로젝트 유틸
└─ storage/                  # 저장 계층 (구현 교체 가능)
```

---

## 개발 로드맵 (완료)

| 단계 | 내용 | 상태 |
|----|------|------|
| 1 | 프로젝트 생성 | ✅ |
| 2 | 기본 UI | ✅ |
| 3 | 행사장 생성 | ✅ |
| 4 | 2D Canvas | ✅ |
| 5 | 집기 라이브러리 | ✅ |
| 6 | 드래그 배치 | ✅ |
| 7 | 회전 / 복사 | ✅ |
| 8 | 저장 (배치안 버전) | ✅ |
| 9 | 출력 (PNG / PDF) | ✅ |

---

## 배포 (Netlify)

이 저장소는 Netlify 배포를 위한 [`netlify.toml`](netlify.toml)과
SPA 라우팅용 [`public/_redirects`](public/_redirects)를 포함합니다.

- 빌드 명령: `npm run build`
- 배포 디렉토리: `dist`

GitHub 저장소를 Netlify에 연결하면 위 설정이 자동으로 적용됩니다.
