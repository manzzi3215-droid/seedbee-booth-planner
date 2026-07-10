# Booth Layout Planner

> **v1.1.7 - 벽면별 개별 색상 · 3D 벽면 치수 표기 · 집기 간격 자동 측정(부스 외곽 경계 레이캐스트)**

백화점 · 박람회 · 팝업스토어 등 다양한 행사장의 부스를 직접 설계하는
**2D 레이아웃 편집 웹앱**입니다. CAD 같은 전문 설계 도구가 아니라
"누구나 쉽게 쓰는 부스 레이아웃 플래너"를 목표로 합니다.

디자인팀이 Illustrator로 만들던 부스 시안을, 실무자가 직접 집기를 배치하며
여러 배치안을 만들어 볼 수 있게 합니다.

---

## 변경 이력

**집기 간격 · 벽별 색상 · 3D 벽 치수 (v1.1.7)**
- **집기 간격 자동 측정:** 단일 집기 선택/드래그 시 상·하·좌·우 방향으로 가장 가까운 집기(하늘색) 또는
  **부스 외곽 경계**(회색)까지의 간격(mm)을 치수선+숫자로 자동 표시. 다중선택·그룹 이동 중에는 숨김.
  경계 간격은 bbox 가 아니라 **실제 외곽선(polygon/곡선 포함)에 레이캐스트**해 계산.
  `src/features/canvas/spacingMeasure.ts`(런타임 의존성 없는 순수 모듈), `BoothCanvas` 전용 Konva 레이어.
  - *측정 기준: 회전/원형/반원형/customPath 집기는 회전 반영 **바운딩 박스(AABB)** 기준(곡선 외곽선 아님).*
- **벽면별 개별 색상:** 전면·후면·좌측·우측 벽 색을 각각 지정(`BoothConfig.wallColors?: Partial<Record<WallSide,string>>`).
  2D 평면도(벽 stroke)·벽면 전개도(배경)·3D 미리보기(벽 fill)·PNG/PDF 출력에 동일 반영.
  "사용할 벽면 설정" 메뉴에 벽별 컬러 입력 + [기본] 복원(ON 벽만 노출). 미지정 벽은 기존 기본색(무회귀).
  레거시 단일 `wallColor` 는 폴백으로 유지. 사각형 부스만 벽별 색 지원(polygon 2D 는 단일 외곽선).
- **3D 벽면 치수 표기:** 부스 3D 미리보기에서 각 벽 상단에 `가로×높이 mm` 라벨(화면 공간, 대비 배경,
  줌/카메라 회전에 안정). `renderIso` `showWallDims` 옵션(부스 미리보기 전용 — 제품/VMD 썸네일 제외).
  - *3D 벽은 bounding box 4벽 기준이라 벽 치수도 bbox 변 길이. polygon 실제 세그먼트 길이는 3D 미반영(제한).*

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

**커스텀 집기(이미지/3D) · 라이브러리 드래그 정렬 (v1.1.1)**
- **커스텀 집기 추가:** 집기 라이브러리에서 **[커스텀(이미지/3D)]** → 파일 불러오기(이미지 PNG·JPG·WEBP·SVG / 3D GLB·GLTF·OBJ) → 미리보기 → 실물 사이즈(가로·깊이·높이 mm) → 2D/3D 표시 방식 → 이름·폴더 → 저장. 기존 집기처럼 배치·검색·카테고리·정렬에 포함.
- **실물 사이즈 자동 스케일:** 입력한 mm가 집기 width/depth/height 에 반영되어 부스 축척에 자동 정합. 이미지 원본 픽셀과 무관.
- **이미지 집기 2D:** footprint + 이미지 / 이미지만 / footprint만. **3D:** 세운 판넬(전면 이미지)·박스 전체 텍스처·상판 이미지·빌보드. (예: TV 1200×80×700 → 얇은 판넬 전면에 TV 이미지)
- **3D 모델(GLB/GLTF/OBJ):** 1차 구현은 2D footprint + 3D placeholder 박스 + 메타데이터 저장(데이터 구조는 실제 모델 렌더 확장 대비). 방향 보정값(rotationOffset) 필드 포함.
- **파일 저장:** 이미지는 기존 `uploadDesignAsset` 재사용(자기완결 dataURL, 압축 ≤900KB) — 게스트/로그인 동일 동작, Storage/CORS 불필요. 모델은 메타데이터만 저장(대용량 임베드 회피).
- **집기 라이브러리 드래그 정렬:** 드래그 핸들로 순서 변경(드롭 위치 표시선), `order`(optional) 저장, 새로고침·재접속 후 순서 유지. 검색/카테고리 필터 상태에서도 안전하게 반영.

**실무 완성도·UX 향상 (v1.1.0)**
- **자동 저장 상태 표시:** 하단 상태바에 `●저장중… / ✓저장완료·HH:MM:SS / 변경됨 / 저장 실패` 표시. (자동 저장 로직은 기존 5초 debounce, Undo/Redo 는 이미 완비 — Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y, 200단계)
- **스타일 복사/붙여넣기:** 선택 집기의 색상·투명도·재질·높이·디자인 매핑을 복사 → 다른 집기(들)에 적용(위치 제외).
- **정렬 업그레이드:** 다중 선택 툴바에 가로/세로 **동일 간격**, **동일 크기·높이·회전**(기준=첫 선택) 추가.
- **확대 UX:** **Space+드래그 핸드툴**, **더블클릭 확대**(Alt+더블클릭 축소), **Fit / 100% / 200%** 버튼(100%=화면맞춤 기준 상대 배율), 마우스 위치 기준 휠 줌.
- **프로젝트 정보:** 브랜드·행사기간·장소·담당자·메모(모두 optional). 새 프로젝트 만들기 + 설정에서 편집, 출력물 헤더에 포함.

**레이어별 면 매핑 · 라이브러리 · 곡선 부스 (v1.0.9)**
- **디자인 매핑 레이어별 면 적용:** 각 이미지 레이어마다 **적용 면**(Front/Back/Left/Right/Top/Bottom, "모든 면")을 개별 선택.
  같은 집기에서 흰 배경은 전체 면, 로고는 정면, 장식은 상판처럼 레이어별로 다르게 표시. `FaceMapping.faces?`(optional)로 저장(기존 매핑 100% 호환).
- **VMD 사이즈 입력 수정:** 보드 W/H 를 자유롭게 입력(빈 값·수정 중 안정), **커밋(blur/Enter) 시에만** 최소 50mm 검증.
- **집기 라이브러리 검색·폴더:** 집기명·카테고리 **검색** + **폴더(카테고리) 칩** 필터. 디자인 에셋도 검색. `category?`·`order?`(optional) 추가.
- **도면 가져오기 → 새 프로젝트 만들기 단계로 이동:** 편집 화면의 도면 가져오기 버튼 제거, 새 프로젝트에서 도면 첨부+미리보기 후 생성 시 배경 도면으로 자동 반영.
- **곡선 부스 바닥:** 부스 편집에서 각 변에 **곡선(bulge) 핸들**을 드래그해 곡선 바닥 편집. 2D 평면도·3D 바닥·실무시안·출력에 반영(`edgeCurves?` optional, 3D 벽체 곡선은 다음 버전).
- **탭명 변경:** `SVG 도면` → `SVG추가`.

**편집 편의 개선 · 실무시안 강화 (v1.0.8)**
- **다중 선택 & 일괄 이동:** `Shift/Ctrl+클릭` 또는 빈 곳 **드래그 박스(마퀴)** 로 여러 집기 선택,
  한 번에 드래그 이동. 다중 선택 테두리 하이라이트.
- **그룹:** 다중 선택 → **[그룹 만들기]**, 그룹 소속 집기 클릭 시 그룹 전체 선택·이동, **[그룹 해제]**.
  `groupId`(optional)로 저장(기존 데이터 하위 호환).
- **마우스 자유 회전:** 선택 집기 위 **회전 핸들**을 드래그해 자유 회전(`Shift` = 15° 스냅). 숫자 입력 방식도 유지.
- **집기명 가독성:** 평면도 집기명에 **검정 라운드 배경 + 흰 글자**(텍스트 길이에 맞춰 자동 크기). 어떤 배경/색상 위에서도 선명.
- **실무시안 사이즈 표기:** 3D 미리보기의 **실무 시안** 모드에 **[사이즈 표기]** 토글(기본 OFF) —
  부스 전체 치수 + 주요 집기 치수를 함께 표기(내보내기에도 반영).
- **실무시안 사람 실루엣:** 사각형 카드 대신 **머리+몸통 실루엣**으로 표시, **부스 바깥쪽**에 세워 크기 비교.
- **좌우 선택정보 패널 접기/펼치기:** 디자인 매핑·색상 · 기타(VMD) 섹션을 접이식으로(기본 접힘, 상태 유지).
- **정렬 UI 정리:** 좌우/상하 미러 · 미러 복사 · 균등 분배 버튼을 UI에서 숨김(정렬은 유지, 함수 코드는 보존).

**SVG 집기 상단 매핑 수정 · 출력물 제작 UI 숨김 (v1.0.7)**
- **SVG(customPath) 집기 상단 면 디자인 매핑 수정:** 곡면/커스텀 경로 집기의 윗면에 디자인이 3D에서 정상 출력(기존엔 흰색).
  윗면 이미지를 집기의 방향성 바운딩 사각형에 매핑하고 윗면 폴리곤으로 클립. 사각형 집기에는 영향 없음.
- **출력물 제작 UI 숨김:** 상단 툴바 버튼·커맨드 팔레트 항목 제거(기능·데이터·PrintWorkspace 코드는 유지)

**레이어 매핑 · 접이식 패널 · 재질 UI 제거 (v1.0.6)**
- **한 면에 이미지 레이어 겹치기:** 같은 면(전면/측면/상단 등)에 여러 디자인 에셋을 레이어처럼 쌓음(나중 추가가 위).
  각 레이어 독립적으로 이미지·위치·크기·회전·투명도·반전·순서·삭제. 기존 단일 매핑 데이터는 base 레이어로 그대로 동작(무변환 호환)
- **왼쪽 패널 접기/펼치기:** [집기 라이브러리]·[디자인 에셋] 그룹으로 정리(각 접기/펼치기, 개수 표시). 에셋이 많아도 집기 라이브러리가 가려지지 않음
- **3D 재질 편집 UI 제거:** 집기·제품 재질 편집 UI 제거(내부 material 값·3D 렌더링은 그대로 유지)

**UI 단순화 & 다중 디자인 매핑 (v1.0.5)**
- **색상 선택 UI 단순화:** 집기 색상 선택기에서 브랜드 컬러·기본 팔레트 제거, **최근 사용 + HEX 입력**만 유지(기능·기록·저장 호환 그대로)
- **조명 편집 UI 제거:** 3D 미리보기의 조명 편집 패널 제거. 3D 렌더링·그림자·기본 조명 계산은 그대로 유지(내부 렌더 정상 동작)
- **집기 디자인 다중 매핑:** 한 집기에 여러 개의 디자인 매핑을 리스트로 관리(매핑 추가/삭제, 각 매핑 대상 면·위치·크기·옵션 독립).
  데이터 구조(면별 매핑) 변경 없음 → 기존 프로젝트 100% 호환

**VMD 워크플로우 단순화 & 3D 제품 수정 (v1.0.4)**
- **VMD 3D 제품 이미지 반전 수정:** 2D 방향과 3D 방향 일치(정면 라벨이 뒤집히지 않음), PNG alpha 유지
- **VMD 3D 제품 입체감:** 상판 위 solid 카드(정면 이미지 + 측면 대표색 + 접지 그림자)로 두께 있는 진열 표현
- **VMD UX 단순화:** 기본 템플릿 UI 제거, 사이즈 자유 입력, "요소 추가"는 항상 보이는 패널 대신 **+ 요소 추가 메뉴**로 호출
- **Booth 수준 편집 단축키:** Delete 삭제 · R 회전 · Ctrl+D 복사 · 방향키 100mm/Shift 500mm 이동 · Ctrl+Z/Y Undo/Redo · Ctrl+]/[ Z-order
- **정렬 추가:** 보드 중앙 정렬 · 보드 맞춤(Fit)

**VMD 3D Mockup (v1.0.3)**
- **VMD 3D 미리보기:** 2D VMD 보드를 실무 DP 시안 3D Mockup으로 렌더(기존 Booth 3D 렌더러 재사용).
  정면 · 좌/우 사선 · Top 시점, 흰색/연회색 배경, 그림자, PNG · 투명 PNG · PDF 저장
- **제품 입체 표현:** 제품이 상판 위에 서 있는 카드/입체(Standing Card·Box·Bottle·Cylinder), 높이·두께·접지 그림자 반영
- **DP 요소:** POP/QR/가격표/설명카드는 상판 위 카드/사인으로 함께 표현
- **보드 clamp:** VMD 요소가 보드 밖으로 벗어나지 않도록 자동 보정

**워크스페이스 통합 & 라이브러리 UX (v1.0.2)**
- **VMD 시안 탭 통합:** 평면도 | 정면벽 | 좌측벽 | 우측벽 | 후면벽 | **VMD 시안** — 같은 워크스페이스 탭 줄에서 진입(작업 흐름 유지)
- **VMD 사용자 템플릿:** 현재 보드를 내 템플릿으로 저장(이름/삭제/복제/즐겨찾기/정렬), Cloud Save
- **VMD 프리셋 개선:** 즐겨찾기·검색(다수일 때)
- **제품 카테고리 필터 + 실시간 검색:** 제품명/태그/SKU/카테고리/진열그룹 검색, 카테고리 칩·즐겨찾기 필터, 제품 즐겨찾기·태그
- **사이드 패널 크기 조절:** 모든 사이드 패널에 드래그 핸들(최소/최대폭), 마지막 크기 자동 저장, 더블클릭 시 기본폭 복원

**VMD Board Workspace (v1.0.1)**
- **독립 2D VMD 시안 탭:** 부스 3D 편집과 분리된 Figma/Canva형 진열 보드 편집기(편집기 툴바 **VMD 시안** 버튼)
- **보드 사이즈·템플릿:** 600×300/900×450/1200×600·사용자 지정, 카운터 상판/선반 1~3단/POP 보드/아크릴 받침대/테이블/자유 보드
- **배경:** 단색·투명·이미지 + 외곽선·라운드·그림자·받침대 스타일
- **요소 배치:** 제품 PNG 누끼컷(라이브러리에서 클릭 배치)·텍스트·가격표·설명카드·POP·QR·로고·이미지·사각/원형 스티커·라인/화살표.
  이동·크기조절·회전·복제·삭제·앞뒤 순서. PNG alpha 유지(흰 배경 강제 없음)
- **정렬:** 좌/우/중앙·상/하/중간·가로/세로 균등 배치. **레이어 패널:** 이름/숨김/잠금/순서. **제품 수량 자동 집계**
- **프리셋 저장·불러오기**, **PNG/투명 PNG/PDF 내보내기**(PDF에 보드 사이즈·제품 리스트·수량·메모)
- **집기 연동:** 선택 집기의 상판 사이즈로 VMD 보드 자동 생성. **Cloud/Auto Save·Undo/Redo** 지원(project.vmdBoards)

**실무 안정화 (v1.0.0-pre)**
- **제품 배치 고정:** 제품은 항상 연결된 집기의 Top Surface 위에 배치(바닥에 떨어지지 않음).
  집기를 이동/회전/복제하면 제품도 함께 이동, 집기를 삭제하면 제품도 함께 제거
- **제품 렌더 모드:** Standing Card(기본·세움) / Flat Card(눕힘) / Simple Box / Cylinder.
  누끼 PNG alpha 유지(흰 배경 강제 생성 금지), 정면 이미지가 잘 보이도록 렌더
- **제품 정렬:** 선택 제품의 집기 위에서 가운데/앞쪽 정렬·가로/세로 균등 배치. 연결 집기 없으면 안내 표시
- **Practical Render Mode(실무 시안):** 정면/아이소메트릭 · 배경 흰색/회색 · 사람 실루엣 · 바닥 매트 ·
  라벨 · 제품 이미지 · 그림자 ON/OFF. 배경 투명 PNG 저장
- **PDF 개선:** 도면 + 집기 리스트에 제품 진열 개수·집기 개수 요약 추가
- **Asset Library UI 숨김:** feature flag(`ENABLE_ASSET_LIBRARY=false`)로 Asset 탭 비활성(코드/데이터 유지)

**제품 3D 업그레이드 (v0.9.9)**
- **입체 제품 오브젝트:** 제품을 얇은 판이 아니라 Depth 를 가진 3D 오브젝트로 표현.
  **3D 형태**(Auto/Bottle/Tube/Box/Pouch/Jar/Can/Standee/Flat Card) — Auto 는 비율을 보고 자동 선택.
  Bottle/Can/Jar/Tube 는 원기둥(둘레 이미지 wrap), Box/Pouch 는 박스, Standee/Flat Card 는 얇은 판
- **두께(mm)·실측 크기(폭/높이/깊이)·재질**(Paper/Matte/Plastic/Glossy/Glass/Metal, Glossy 반사)
- **배경 처리:** Solid Color / **Transparent(누끼)** — Transparent 는 흰 배경 없이 PNG alpha 그대로 2D·3D 표시
- **제품 그림자·조명:** 집기와 동일하게 바닥/접지 그림자 + Ambient/Directional 조명·재질 영향
- **집기 Top Face 스냅:** 제품은 항상 집기 상판 기준 배치(집기 높이 변경 시 함께 이동)
- **진열 패턴:** Single / Grid / Row / Circle
- **Hover 3D 미리보기:** 제품 라이브러리에서 카드에 마우스를 올리면 3D 미리보기 표시
- **모두 저장:** 3D 형태·두께·배경·재질·크기·회전 등 Cloud/Auto Save
- *스타일/재질/환경(Style) 패널은 이번 버전에서 UI 비활성(코드·데이터 구조는 유지, 향후 재사용)*

**스타일 · 재질 시스템 (v0.9.8, 현재 UI 비활성 — 코드 유지)**
- **Quick Style 프리셋(원클릭 스타일링):** Modern · Minimal · Luxury · Natural · Beauty · Baby · Pharmacy · Pop-up —
  바닥/벽 재질 + 3D 환경을 한 번에 변경. 좌측 **스타일** 탭에서 선택
- **바닥 재질:** 콘크리트 · 우드 · 마블 · 스톤 · PVC · 카펫 · 화이트 · 블랙 · 체커 (2D 바닥 + 3D 바닥에 반영)
- **벽 재질:** 페인트 · 우드 · 패브릭 · 커튼 · 스톤 · 콘크리트 · LED 월 · 아크릴 (3D 벽에 반영)
- **3D 환경(Environment):** Studio White/Gray/Black · Mall · Exhibition Hall · Transparent (3D 미리보기 배경)
- **Presentation Quality:** 3D 미리보기 배경 투명 PNG 저장(Transparent 환경 또는 "배경 투명" 토글) — 제안서 합성용
- **Professional Render:** Soft/Contact 그림자 · 바닥 반사 · 스페큘러 하이라이트 · 재질(무광~아크릴)로 실사 느낌(실시간 성능 유지)
- **Furniture/Decoration 에셋 확장:** Chair·Table·Sofa·Shelf·Plant·Lamp·Mirror·TV·Monitor·Laptop·Tablet·Vase·
  Curtain·Frame·Sign·Poster Stand·Roll Banner 등 30여 종 기본 에셋 추가
- **에셋 핀 고정(Pin):** 자주 쓰는 에셋을 목록 상단에 고정 (즐겨찾기·최근 사용과 함께)

**에셋 라이브러리 2.0 (v0.9.7)**
- **통합 에셋 라이브러리** — 자주 쓰는 가구·진열집기·제품·POP·포스터·배너·장식·식물·사람·
  조명·벽부착물·바닥오브젝트·사이니지·커스텀을 한 곳에서 관리하고 바로 배치
- **My / Company 라이브러리** — 개인(private)·회사 공용(company) 구분(향후 전사 공유 확장 대비 구조)
- **에셋 등록** — 이미지 업로드(PNG/JPG/SVG/WEBP) + 실측 사이즈(mm)·카테고리·태그·브랜드·
  3D 모델타입·재질 입력. **선택한 집기를 에셋으로 저장**도 지원
- **검색 · 필터 · 즐겨찾기 · 최근** — 이름/태그/브랜드 검색, 카테고리 칩 필터, ⭐즐겨찾기, 🕘최근 사용
- **원클릭 배치** — 에셋 → 부스에 즉시 배치. 기존 **집기 + 디자인 매핑 파이프라인을 재사용**하여
  실측 비율·2D/3D·조명·재질·Undo/Redo·클라우드 저장이 자동 반영
- **기본 샘플 에셋** — 기본 카운터·진열대·원형 테이블·POP 스탠드·배너·화분·사람 실루엣·스포트라이트
- **저장 구조** — 사용자 전역(`assetLibraries/{uid}`) Firestore 라이브러리 + LocalStorage 캐시.
  이미지는 경량 dataURL로 보관(정적 호스팅 CORS 이슈 회피), Storage 참조 경로 필드(`storagePath`)로
  향후 Firebase Storage 전환 대비

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

**v1.1.6 — Hotfix: Save GLB/GLTF Without Firebase Storage (Local IndexedDB)**
- **증상:** 커스텀 집기 창에서 GLB 를 불러오고 사이즈·이름을 입력해도 "집기로 저장" 이 눌리지 않거나(비활성) 저장 후 다이얼로그가 닫히지 않음.
- **근본 원인:** 프로젝트가 **Spark(무료) 플랜이라 Firebase Storage 가 미활성** 상태인데, `uploadModelFile` 이 `isFirebaseConfigured===true` 만 보고 없는 버킷에 `uploadBytes` 를 호출 → SDK 가 **최대 ~2분간 재시도**하다 실패. 그동안 `save()` 의 `await` 가 멈춰 `saving=true` 유지 → 저장 버튼이 계속 비활성(스피너)이고 다이얼로그가 안 닫힘.
- **수정 (로컬 우선):**
  - `modelStorage.ts`: `MODEL_STORAGE_ENABLED=false`(Spark) 플래그 추가. 업로드는 **IndexedDB 로컬 캐시만** 하고 즉시 `{url:null, cached:true}` 반환(클라우드 시도 없음 → 멈춤 제거). Storage 활성화 후 플래그만 true 로 바꾸면 클라우드 공유 복원. `hasLocalModel(defId)` 추가.
  - `CustomFixtureDialog`: 모델 저장 시 Storage 실패를 **치명 오류로 처리하지 않음**. 로컬 캐시(IndexedDB)만 성공해도 저장 진행, `customAsset.localModelId=defId` 기록, 다이얼로그 정상 닫힘·라이브러리 즉시 추가. 로컬 저장까지 막혔을 때만(시크릿 모드 등) 오류 표시. 안내 문구를 "무료 플랜: 이 브라우저에만 저장" 으로 갱신.
  - `scene.ts`: 3D 로더 캐시 키를 `localModelId ?? def.id` 로 사용.
  - `IsoPreviewDialog`/`renderIso`: 이 기기에 원본이 없으면(로컬·URL 모두 없음) placeholder + **"이 기기에 모델 파일 없음"** 호박색 라벨 표시(`missingModelIds`).
  - `FixtureLibraryPanel`: 모델 집기 카드에 **로컬 모델 있음 / 모델 파일 없음** 칩 표시(IndexedDB 조회).
- **동작 요약:** GLB 저장 = Firestore 에 집기 정의 + IndexedDB 에 원본. **같은 브라우저**: 새로고침 후에도 실제 GLB 렌더 유지. **다른 기기/브라우저**: 정의는 공유되되 원본이 없어 placeholder + 안내 라벨(Storage 활성화 시 클라우드 공유로 해소).
- **브라우저 검증(E2E):** `uploadModelFile` 1ms 반환(기존 최대 2분 → 멈춤 없음), GLB 선택 후 저장버튼 활성, 사이즈 1300×900×1750 저장 시 다이얼로그 닫힘 + 라이브러리에 "GLB2/로컬 모델 있음" 카드 추가, 배치 후 3D 미리보기 실제 렌더(placeholder 아님, Error 0), 새로고침 후 카드·IndexedDB·칩 유지, 원본 삭제(타 기기 모사) 시 3D 에 "모델 파일 없음" 라벨 표시 확인. `npm run build` 통과.

**v1.1.5 — Custom 3D Model (GLB/GLTF) Real Rendering**
- **목표:** 커스텀 3D 모델 집기가 3D 미리보기에서 **회색 Placeholder 박스** 로만 보이던 것을 제거하고, **실제 GLB/GLTF 메쉬**를 입력한 실물 사이즈로 렌더.
- **렌더 방식(스프라이트 합성):** 3D 미리보기는 Canvas 2D 아이소메트릭 렌더러(`renderIso.ts`)라 메쉬를 직접 그릴 수 없어, **Three.js(WebGL)** 로 GLB 를 현재 카메라 각도(방위/고도)에 맞춰 오프스크린 렌더 → **투명 PNG 스프라이트** 로 만든 뒤 `renderIso` 가 footprint 위치에 깊이순 합성(`src/features/iso/glbRender.ts`). Three.js/GLTFLoader 는 **모델이 있을 때만 동적 import**(초기 번들 영향 최소화, 별도 청크).
- **실물 사이즈 자동 스케일:** GLB 원본 BoundingBox 크기를 측정해 축별 스케일(X=가로, Y=높이, Z=깊이)로 입력한 mm 사이즈에 맞춤(예: 원본 500×300×400 → 입력 1200×600×1000 자동 스케일).
- **바닥 접지 · 회전:** BoundingBox `minY` 를 0 으로 내려 바닥에 정확히 접지(공중부양/매몰 방지), 가로/깊이 중앙 정렬. 집기 회전값(수직축 Y)을 반영.
- **저장 · 공유 · 지속:** 모델 원본은 수 MB 라 Firestore 문서(1MiB)에 못 담으므로 **Firebase Storage** 에 업로드(`models/{uid}/{id}`)하고 다운로드 URL 을 집기 정의에 저장 → 다른 회사/기기에서도 열람 가능. 업로더 브라우저는 **IndexedDB** 에 원본 blob 캐시로 즉시/오프라인 렌더. 새로고침 후에도 그대로 표시.
- **Fallback:** GLB 로드/렌더 실패 시 기존 **회색 Placeholder 박스**로 자연스럽게 대체(에러로 죽지 않음). OBJ 는 아직 박스 표시.
- **브라우저 검증:** 1200×600×1000mm 박스 glTF 로 `renderGlbSprite` 파이프라인 E2E 확인 — 실제 메쉬 렌더(불투명 픽셀 18만), 자동 스케일 정확(pxPerMm 0.354 ↔ 바운딩스피어 반경 계산 일치), 바닥 앵커/투영 footprint 폭(1273mm↔451px) 일치, 회전 반영. `npm run build` 통과(three/GLTFLoader 별도 lazy 청크), 앱 로드 Console Error 0.

**v1.1.4 — Hotfix: Custom Image Fixture 3D Standing Panel/Billboard**
- **원인:** v1.1.1 에서 `display3d='panel'/'billboard'` 커스텀 이미지 집기를 **회색 박스의 front/back 면에 텍스처**로 렌더 → 투명 PNG 영역에 회색 박스가 비치고, 옆/윗면은 회색, 이미지가 일부 면에만 작게 붙어 "세운 판넬"처럼 안 보임.
- **수정 (세운 이미지 판넬 구조):** `IsoScene.panels`(`IsoPanel`) 신설. 커스텀 이미지 + panel/billboard(및 미지정 fallback)면 **박스 대신 바닥에 세운 평면 이미지**로 렌더.
  - footprint(가로×깊이)는 유지, 이미지는 입력 높이 기준으로 **바닥부터 세워짐**(bottom-on-floor), 가로 중앙 + 비율 유지 **fit-contain**.
  - `drawImage` 로 그려 **투명 PNG(alpha) 유지**(뒤에 채움 없음). `panel` 은 집기 회전과 함께 회전, `billboard` 는 항상 카메라를 향함. 이름 라벨·접지 그림자 표시.
- **fallback:** 이미지 집기의 `display3d` 가 없거나(과거 데이터) panel/billboard 이면 판넬로 렌더. `box-texture`/`top-texture` 는 기존 박스 텍스처 방식 유지(회귀 없음). CustomFixtureDialog 이미지 기본값은 `panel`.
- **브라우저 검증:** 터치TV(900×600×1650, 투명 PNG) → 3D 에서 회색 박스 아닌 TV 이미지가 바닥에 세워짐(파란 화면 픽셀 확인), 90° 회전 시 판넬도 회전(투영 폭 변화 확인), Console Error 0.

**v1.1.3 — Hotfix: Stable Library Reorder (move buttons + atomic save)**
- **근본 원인:** `reorderFixtures` 가 순서 변경 시 **개별 `saveFixture` 를 N개 병렬 호출** → 같은 Firestore 문서(`libraries/{uid}`)에 대한 read-modify-write **경쟁(race)** 으로 일부 `order` 만 반영 → 순서가 계속 튐(HTML5 드래그의 state 타이밍 문제와 겹쳐 v1.1.2 에서도 재발).
- **수정 1 (원자적 저장):** `StorageProvider.saveFixtures(fixtures[])` 추가 — 라이브러리 전체를 **한 번의 문서 쓰기**로 저장. `reorderFixtures` 는 새 순서 배열을 만들어 order 0..N 재부여 후 1회 저장 → 경쟁 제거, 새로고침 후 순서 정확히 유지.
- **수정 2 (드래그 제거·버튼 도입):** 불안정한 HTML5 Drag&Drop 제거. 각 집기 카드에 **맨 위로 / 위로 / 아래로 / 맨 아래로** 버튼 → 클릭 즉시 정확히 이동. 검색 중 버튼 숨김, 카테고리 필터 상태에선 해당 목록 안에서만 이동(다른 카테고리 순서 불변). 저장 실패 시 에러 표시(상태 유지 = 이전 순서 복구).
- **정렬 기준(단순화 유지):** order 있는 항목 오름차순 → 없는 항목은 저장순 유지, 한 번 이동하면 전체 order 0..N 정규화(index/order 혼합 없음).
- **브라우저 검증:** 마지막→맨위/첫→맨아래/위·아래 한 칸 이동 정확, 새로고침 유지, 검색 중 버튼 숨김, 카테고리 필터 내 이동 시 타 카테고리 불변·유지 모두 확인. Console Error 0.

**v1.1.2 — Hotfix: Custom-fixture Save & Precise Drag Reorder**
- **[버그1 원인] 커스텀 집기 저장 실패:** 커스텀 이미지가 ~400KB dataURL 로 전역 라이브러리 문서(`libraries/{uid}`, 모든 집기를 한 문서에 저장)에 임베드되어 Firestore **문서 1MiB 한계**를 초과 → `setDoc` 예외. 게다가 다이얼로그에 catch 가 없어 에러가 **완전히 숨겨져** 저장 안 됨이 조용히 발생.
  - **수정:** 커스텀 이미지를 소형(≤512px·JPEG, ~110KB)으로 재인코딩(`uploadCustomFixtureImage`) → 여러 개가 한 문서에 들어가도 여유. 저장 실패 시 다이얼로그에 명확한 에러 표시(다이얼로그 유지). 검증: 원본 2MB → 132KB 저장, 정상 등록.
- **[버그2 원인] 드래그 정렬 부정확:** ① before/after 없이 대상 index 에 삽입(아래로 드래그 시 off-by-one), ② `ordered` 정렬이 `order` 값과 index 폴백을 섞어(`order ?? i+len`) 일부만 order 가 있으면 항목이 튐, ③ state 타이밍 의존.
  - **수정:** 드롭 위치(카드 상/하반부, `clientY`)로 before/after 정확 계산 · 결정적 정렬(order 있는 것 먼저→없는 것은 저장순 유지) · dragId 를 ref 로(state 타이밍 무관) · 검색 중 드래그 비활성 · 저장 실패 시 에러 · 드롭선(위/아래) 표시. 정렬 로직은 오프라인 테스트로 전 케이스 검증.
- Build 성공 · Console Error 0.

**v1.1.1 — Custom Fixtures (image/3D) & Fixture-library Drag Reorder**
- **[데이터 구조] `FixtureDef.customAsset?`(optional):** `{ kind:'image'|'model', fileUrl?, fileName, mimeType?, originalWidth?/Height?, modelFormat?, display2d?, display3d?, realWidthMm/DepthMm/HeightMm, rotationOffset?, scaleMode? }`. 실물 사이즈는 width/depth/height 에도 반영. 기존 집기 100% 호환.
- **[등록 플로우] `CustomFixtureDialog`:** 파일→미리보기→실물 사이즈→2D/3D 표시 방식→이름/폴더→저장. 이미지는 `uploadDesignAsset`(dataURL) 재사용, 모델은 메타데이터. `saveFixture` 로 라이브러리 등록.
- **[2D 렌더] BoothCanvas/renderBooth:** 인스턴스 디자인이 없고 `customAsset.kind==='image'` 이면 footprint 에 이미지 표시(display2d 반영). imageMap/export 프리로드에 커스텀 URL 추가.
- **[3D 렌더] scene.ts:** `customAsset` 이미지→display3d 별 면 텍스처 합성(panel=전/후면, box-texture=전체, top-texture=상판, billboard=전면). 모델=placeholder 박스. IsoPreviewDialog 프리로드 추가.
- **[드래그 정렬] `useFixtures.reorderFixtures`:** 드롭 순서대로 `order` 재부여+1회 재조회. FixtureLibraryPanel 은 order 정렬(없으면 기존 순서), 드래그 핸들/드롭 표시선, 필터 상태 안전 반영.
- **검증:** 이미지 커스텀 집기(TV 1200×80×700) 등록→배치→3D 판넬+이미지+실물사이즈 확인, GLB placeholder 등록, 드래그 정렬 후 새로고침 유지, Console Error 0. Build 성공.

**v1.1.0 — Auto-save Status · Style Copy/Paste · Align Upgrade · Zoom UX · Project Info**
- **조사 결과:** Undo/Redo(#1)는 v0.9.0부터 이미 완비(Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y, 200단계 스냅샷 — 이동·회전·삭제·복사·그룹·매핑·색상·부스·치수 커버)라 재작업 없음. Auto Save·Smart Snap·치수선도 기존 존재. 이번 버전은 사용자 협의로 **저위험 완성 세트(#2·#7·#8·#9·#10)**를 구현.
- **[2] Auto Save 상태 UI:** `EditorContext.lastSavedAt` 추가, `EditorStatusBar` 에 SaveIndicator(저장중/저장완료+시각/변경됨/실패). 기존 5초 자동 저장 로직과 충돌 없음.
- **[7] Style Copy/Paste:** `copyFixtureStyle`/`pasteFixtureStyle`/`hasStyleClip` + 모듈 클립보드. 디자인 매핑은 인스턴스 단위, 색상·투명도·재질·높이는 대상 def 에 적용(로컬/전역 자동, def 중복 제거). 위치 제외.
- **[8] 정렬 업그레이드:** `matchFixtures('size'|'height'|'rotation')`(기준=첫 선택) + 기존 `distributeFixtures`(동일 간격) 노출. MultiActionToolbar 버튼 5종 추가.
- **[9] 확대 UX:** BoothCanvas 에 Space 핸드툴(Stage 패닝), onDblClick 줌, Fit/100%/200%(fit 배율 기준), 상태바 확대%를 fit 상대값으로 리포트.
- **[10] 프로젝트 정보:** Project 에 brand·eventPeriod·place·manager·projectMemo(optional) + `updateProjectInfo`(디바운스 저장). NewProjectPage·SettingsDialog 편집, 출력물 헤더 포함.
- **호환성:** 추가 필드 전부 optional → 기존 프로젝트 100% 호환. 단축키 유지. Auto Save·Undo 충돌 없음. Build 성공 · 브라우저 검증(저장완료 표시·Fit/100/200%·핸드툴·정렬 툴바·스타일 복사·프로젝트 정보 저장) 완료.

**v1.0.9 — Per-layer Face Mapping · VMD Input Fix · Library Search/Folders · Floorplan-at-Creation · Curved Booth**
- **[1] 레이어별 면 매핑:** `FaceMapping.faces?: BoxFace[]`(optional) 추가. `mapping.layersForFace(design, face)` 로 렌더 시 면별 레이어 수집,
  scene(3D)·planFaceMapping(2D)·resolveFaceMapping(출력/곡면 wrap) 모두 이 헬퍼 기반으로 통일. DesignPanel 은 전역 "모든 면" 스위치 → 레이어별 [적용 면] 칩으로 교체.
  기존 데이터(faces 미지정/applyAll)는 동일하게 렌더(오프라인 로직 테스트 통과).
- **[2] VMD 입력:** 보드 W/H 를 로컬 문자열 state 로 자유 입력, `commitBoardSize`(blur/Enter)에서만 min 50 clamp. (Hooks 순서 준수 위해 sync effect 를 조건부 return 위로 배치)
- **[3] 탭명:** `SVG 도면` → `SVG추가`.
- **[4] 라이브러리:** `FixtureDef.category?`·`order?`(optional). 집기 패널에 검색 TextField + 카테고리 폴더 칩(전체/미분류/카테고리) 필터, 폼에 카테고리 입력. 디자인 에셋 패널에 검색.
- **[5] 도면 위저드 이동:** 편집기의 도면 버튼(툴바·DrawingsPanel·커맨드·FloorplanImportWizard) 제거, NewProjectPage 에 파일 업로드+미리보기 추가 → 생성 시 초기 배치안 planBackgrounds 로 첨부(브라우저 E2E 확인).
- **[6] 곡선 부스:** `BoothConfig.edgeCurves?: number[]`(optional). `boothGeometry.tessellatePolygon/getBoothOutline`(곡선 없으면 원본 참조 그대로=무회귀). ShapeEditor 곡선(bulge) 핸들 + BoothCanvas 곡선 드래그, 2D/3D 바닥·출력 반영. 3D 벽체 곡선은 범위 밖.
- **호환성:** 추가 필드 전부 optional → 기존 프로젝트/집기/매핑 100% 호환. Build 성공 · pure 로직(layersForFace·tessellatePolygon) 오프라인 검증 · VMD 입력/도면/검색 브라우저 검증 완료.

**v1.0.8 — Multi-select/Group/Mouse-rotate · Fixture-name Label · Practical Dimensions & Human Silhouette**
- **[1] 정렬 UI 정리:** MultiActionToolbar·Command Palette 에서 좌우/상하 미러·미러 복사·균등 분배 버튼 숨김.
  정렬(Align)은 유지. `distributeFixtures`/`mirrorFixtures` 등 EditorContext 함수·데이터·단축키는 그대로 보존.
- **[2] 집기명 라벨:** `FixtureNode` 의 집기명을 검정 라운드 배경(자동 크기) + 흰 글자로 변경(Konva `Text` 측정으로 배경 크기 산출).
  집기 회전 시 함께 회전(기존 방향 처리 유지). 작은 집기 자동 숨김 로직 유지.
- **[3] 실무시안 사이즈 표기:** `IsoRenderOptions.showDimensions` 추가 + IsoPreviewDialog 실무 시안에 [사이즈 표기] 토글(기본 OFF).
  `IsoBox.dims`(실측 치수)를 scene 에 실어 부스 전체 + 집기 치수 라벨 렌더. 프리뷰/PNG 내보내기 공용 옵션이라 출력에도 반영.
- **[4] 사람 실루엣:** `IsoScene.humans` + `drawHuman`(머리 원형 + 몸통 폴리곤 빌보드)으로 교체. 부스 앞면 바깥쪽(maxY 밖)에 배치해 크기 비교.
- **[5] 다중 선택·일괄 이동·드래그 박스:** Shift/Ctrl+클릭(기존) + 마퀴 드래그 선택(`onSelectMany`/`computeFixtureAABB` 교차),
  그룹/다중 선택 드래그 시 시작 위치 스냅샷 기준으로 전체를 절대좌표 이동(`moveFixtures`, 딸린 제품 동반).
- **[6] 그룹:** `PlacedFixture.groupId?`(optional, 하위 호환) 추가. `groupSelected`/`ungroupSelected`/`selectedGroupId`,
  그룹 소속 집기 단일 클릭 시 그룹 전체 선택. 배치안 저장에 자동 포함.
- **[7] 선택정보 패널 접기:** `SelectionPanel` 에 `CollapsibleSection`(localStorage 상태 유지). 디자인 매핑·색상 / 기타·VMD 는 기본 접힘, 기본정보·위치·회전은 열림.
- **[8] 마우스 자유 회전:** `FixtureNode` 회전 핸들(단일 선택 시) 드래그 → `rotateFixtureTo` 절대 각도 회전, `Shift` 15° 스냅. 숫자 입력 방식 유지.
- **호환성:** 기존 배치안/집기/단축키 100% 호환(추가 필드는 optional). Build 성공 · Console Error 0. 브라우저 검증(집기명 라벨·3D 치수/사람·마퀴 3개 선택·그룹 토글·패널 접기·회전 핸들 렌더) 완료.

**v1.0.7 — SVG Top-Face Mapping Fix & Print UI Hidden**
- **[수정1] SVG 집기 상단 매핑 오류 수정:** customPath/곡면 집기의 footprint 는 점이 많아, renderIso 가 윗면 이미지를 `top[0/1/3]`
  (곡선 위 인접 3점)에 매핑 → 축소/왜곡되어 흰색으로 보였음. **집기 방향성 바운딩 사각형(getFixtureCorners)** 을 `topFrame` 으로
  전달해 윗면 이미지를 정확히 매핑하고, 윗면 폴리곤으로 clip. 사각형 집기는 `topFrame === footprint` 이라 동작 불변.
- **[수정2] 출력물 제작 UI 숨김:** 툴바 버튼 + 커맨드 팔레트('출력물 제작 열기') 제거. PrintWorkspace/printSettings/데이터/onOpenPrint prop 타입은 유지.
- **검증:** customPath 집기 윗면에 빨강 이미지 매핑 → 3D 렌더에서 빨강 픽셀 다수 확인, 사각형 집기 윗면(파랑)도 정상 → 회귀 없음.
- **최소 수정 · 기존 데이터 100% 호환 · Console Error 0 · Build 성공.**

**v1.0.6 — Layered Design Mapping, Collapsible Panels & Material UI Removal**
- **[작업1] 레이어 매핑:** 같은 면 위에 여러 이미지 매핑을 레이어처럼 겹침(나중 추가 = 위). 각 레이어 독립 편집(이미지/방식/위치/크기/회전/투명도/반전),
  순서 변경(위/아래)·개별 삭제. 데이터는 `DesignMapping.faces`(base) + `overlays`(추가 레이어) — **기존 저장파일은 마이그레이션 없이 base 하나로 동작(100% 호환)**.
  3D 렌더러(renderIso)는 base→overlays 순서로 그리고 레이어별 위치/크기(scale/offset)를 면 내부에 배치.
- **[작업2] 좌측 패널 정리:** 집기 라이브러리 / 디자인 에셋을 **접기·펼치기 그룹**으로 분리(개수 표시 유지, 전체선택·삭제·사용횟수 등 기존 기능 유지).
  집기 라이브러리가 먼저 보이고, 에셋이 많아져도 가려지지 않도록 각 그룹 독립 스크롤.
- **[작업3] 3D 재질 편집 기능 제거:** 집기 선택 패널의 "3D 재질" 셀렉터 + 제품 다이얼로그의 "재질" 셀렉터 제거.
  material 데이터 필드·렌더링(materialProps)·기본 3D 표시·그림자는 그대로 유지.
- **최소 수정·데이터 호환:** 관련 파일만 수정, 렌더러 기존 동작 하위 호환. 기존 기능·Console Error 0·Build 성공.

**v1.0.5 — UI Simplification & Multi Design Mapping (UI 단순화 · 다중 매핑)**
- **[작업 1] 색상 선택 UI 단순화:** `ColorPicker` 에서 브랜드 컬러·기본 팔레트 스와치 제거, **최근 사용 + HEX(+컬러픽커·투명도)** 만 유지.
  색상 선택 기능·최근 사용 기록·HEX 직접 입력·기존 저장 데이터 모두 그대로.
- **[작업 2] 조명 편집 기능 제거:** 3D 미리보기의 조명 편집 패널(Ambient/Directional/태양/Spot/그림자/색온도/바닥반사) UI 제거.
  3D 렌더링·그림자·기본 조명 계산(내부 LightingEngine)은 삭제하지 않고 유지 → 3D 정상 렌더.
- **[작업 3] 집기 디자인 다중 매핑:** `DesignPanel` 을 매핑 **리스트** 형태로 개편. "매핑 추가"로 새 매핑 Row 생성, 각 매핑은
  대상 면·이미지·매핑 방식·위치·크기·회전·투명도·반전을 독립적으로 가짐, 개별 삭제 가능.
  **데이터 구조(DesignMapping.faces: 면별 매핑) 변경 없음** → 기존 저장파일이 자동으로 리스트(면 개수만큼)로 표시, 100% 호환.
- **최소 수정 원칙:** 3개 파일(ColorPicker/IsoPreviewDialog/DesignPanel)만 수정, 렌더러·저장·데이터 구조 무변경.
- **기존 기능 유지 · 기존 프로젝트 호환 · Console Error 0 · Build 성공.**

**v1.0.4 — VMD Workflow Simplification & 3D Product Fix (VMD 워크플로우 단순화)**
- **§5 3D 제품 이미지 반전 수정:** 렌더러에 면별 `flipH`(좌우 반전) 추가 — VMD 3D 정면 카드의 라벨/로고가 뒤집히지 않게 보정.
  2D 방향과 3D 방향 일치, PNG alpha 유지, 모든 시점에서 정상 방향(기존 Booth 3D 렌더러 공유, 하위 호환).
- **§6 3D 제품 입체감:** VMD 제품을 항상 solid 카드로 렌더(정면 이미지 + 측면 대표색 + thickness + Contact Shadow) → 평면 카드 → 실제 진열.
- **§1/§3/§4 UX 단순화:** 기본 템플릿/사이즈 프리셋 UI 제거, W/H 자유 입력, "요소 추가"를 항상 보이는 그리드 → **+ 요소 추가 팝업 메뉴**로 전환.
- **§7/§10 편집 단축키(Booth 수준):** Delete/Backspace 삭제 · R 90° 회전 · Ctrl+D 복제 · 방향키 100mm · Shift+방향키 500mm ·
  Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y Undo·Redo · Ctrl+] / Ctrl+[ (Shift=맨앞/맨뒤) Z-order · Esc 선택 해제.
- **§9/§14 정렬:** 다중 선택 Align/Distribute(기존) + **보드 중앙 정렬 · 보드 맞춤(Fit to Board)**.
- **staged(다음 단계):** Shift-드래그 Smart Snap 가이드라인(§8)·드래그 영역 선택·Copy/Paste·레이어 그룹/색상 태그·
  보드 자체 3D 두께/받침대(§11)·Duplicate in Grid·Apply to Another Board·배경 잠금(§14 3~7).
- **기존 기능 유지 · 기존 프로젝트 호환 · Console Error 0 · Build 성공 · Undo/Redo·Cloud/Auto Save 유지.**

**v1.0.3 — Professional VMD 3D Mockup System (VMD 3D 시안)**
- **VMD 3D 미리보기(§1, 최우선):** 2D VMD 보드 → 3D DP Mockup. **기존 Booth 3D 렌더러(renderIso)를 그대로 재사용**
  (새 렌더러 없음, 구조 공유). 시점 정면/좌·우 사선/Top, 배경 흰색/연회색, 그림자 ON/OFF, PNG·투명 PNG·PDF 저장.
- **제품 입체 표현(§2):** 제품이 상판 위에 서 있는 오브젝트(Standing Card·Box·Bottle·Tube·Jar·Cylinder)로 표현 —
  기존 productRenderGeo 재사용, 높이·두께·접지 그림자 적용(평면 카드 → 실제 진열 느낌).
- **상판 위 요소(§3/§7):** product·POP·QR·이미지·로고는 상판 위 세움 카드, 가격표·설명카드·도형은 상판 위 얇은 카드로 렌더.
- **보드 clamp(§4):** VMD 요소가 보드 밖으로 나가지 않도록 드래그 시 자동 보정.
- **VMD 전용 렌더 스타일(§10/§11):** 흰/연회색 배경 · Ambient/Directional · Contact Shadow · 약한 Reflection —
  패키지팀 Mockup 느낌(Blender급 리얼 렌더 없이 가볍게).
- **완성된 흐름:** 도면 가져오기 → 부스 설계 → 집기 배치 → 디자인 매핑 → VMD 시안 → **VMD 3D Mockup** → PNG/PDF 출력.
- **staged(다음 단계):** 원클릭 진열 패턴 확장(§5)·스마트 충돌 자동 밀림(§6)·레이어 폴더/색상 태그(§8)·최근 배치/대형 썸네일(§9)·
  전체 UX 재정비(§12)는 구조를 유지하며 단계적으로 진행. (다음: 실측 모드·설치 가이드)
- **기존 기능 유지 · 기존 프로젝트 호환 · Console Error 0 · Build 성공 · Undo/Redo·Cloud/Auto Save 유지.**

**v1.0.2 — VMD Workspace Integration & Library UX (워크스페이스 통합)**
- **VMD 워크스페이스 탭 통합(§2):** 보기 모드 탭 줄에 **VMD 시안** 추가 — 평면도/벽면과 같은 위치에서 진입.
  (데이터 충돌·Cloud Save 손상 방지를 위해 동일 프로젝트를 공유하는 전용 VMD 화면으로 전환하는 방식)
- **VMD 사용자 템플릿(§1):** 현재 보드를 내 템플릿으로 저장 · 이름 변경 · 삭제 · 복제 · 즐겨찾기 · 정렬. `project.vmdTemplates` Cloud/Auto Save.
- **VMD 프리셋 개선(§9 일부):** 즐겨찾기 · 이름 검색(다수일 때). (썸네일 자동 생성·최근 사용은 이후 단계)
- **제품 라이브러리(§4/§5):** 카테고리 자동 수집 + 칩 필터 · 즐겨찾기 · 태그, 상단 실시간 검색(제품명/태그/SKU/카테고리/진열그룹).
- **사이드 패널 리사이즈(§6):** 좌/우 패널 드래그 핸들(최소 200 / 최대 560px), 마지막 크기 localStorage 저장, 더블클릭 기본폭 복원.
- **Cloud Save(§11):** 템플릿·카테고리·즐겨찾기·태그 등 신규 필드 모두 자동 저장. 패널 폭은 localStorage 유지.
- **staged(다음 단계):** VMD 3D 미리보기(§3), VMD 스냅/가이드라인(§7), 레이어 폴더·색상 태그(§8), 전체 UX 재정비(§10)는
  안정성(기존 기능 무손상)을 우선해 이번 버전에서 구조만 유지하고 단계적으로 진행합니다.
- **기존 기능 유지 · Console Error 0 · Build 성공.**

**v1.0.1 — VMD Board Workspace (VMD 시안 보드)**
- **독립 2D VMD 워크스페이스(`/projects/:id/vmd`):** 부스 3D 편집과 완전히 분리된 Figma/Canva형 진열 시안 편집기.
  편집기 툴바 **VMD 시안** 버튼 + 선택 집기의 **[이 집기로 VMD 시안 만들기]**(상판 사이즈로 보드 자동 생성, §12).
- **보드:** 사이즈 프리셋(600×300/900×450/1200×600)·사용자 지정, 템플릿 8종(카운터 상판/선반 1~3단/POP 보드/아크릴 받침대/테이블 상판/자유 보드).
- **배경:** 단색/투명/이미지 + 외곽선·라운드 코너·그림자·받침대 스타일.
- **요소:** 제품 PNG 누끼컷·텍스트·가격표·설명카드·POP·QR·로고·이미지·사각/원형 스티커·라인/화살표.
  이동/크기/회전/복제/삭제/앞뒤 순서, PNG alpha 유지(흰 배경 미생성).
- **정렬(§7):** 좌/우/중앙·상/하/중간·가로/세로 균등. **레이어 패널(§8):** 이름·숨김·잠금·순서. **제품 수량 자동 집계(§9)**.
- **프리셋(§10) 저장/불러오기**, **Export(§11):** PNG·투명 PNG·PDF(보드 사이즈·제품 리스트·수량·메모 포함).
- **저장(§13):** `project.vmdBoards`/`vmdPresets` 에 임베드 → Cloud/Auto Save·Undo/Redo·Reload 유지.
- **구현:** 기존 React Konva/Storage/Product Library 재사용, 부스 편집기와 상태 분리 → 기존 기능 무영향.
- **기존 기능 유지 · Console Error 0 · Build 성공.**

**v1.0.0-pre — Practical Render & Product Display Fix (실무 안정화)**
- **제품 Display 위치 수정:** 제품을 항상 연결 집기의 Top Surface 위에 배치(집기 높이 기준 z 자동). 바닥 배치 방지.
  집기 이동/회전/복제 시 제품 동반 이동·회전·복제, 집기 삭제 시 제품 동반 제거(잔여 방지).
- **제품 렌더 모드(Standing Card 기본):** Flat Card/Standing Card/Simple Box/Cylinder. 누끼 PNG alpha 유지(흰 배경 미생성),
  정면 이미지가 잘 보이는 카드/패널 방식 우선.
- **제품 정렬 UI:** 선택 제품 패널에 가운데/앞쪽 정렬 · 가로/세로 균등 배치. 연결 집기 없으면 안내 메시지.
- **Practical Render Mode:** 정면/아이소 · 배경 흰색/회색 · 사람 실루엣 · 바닥 매트 · 라벨 · 제품 이미지 · 그림자 ON/OFF.
  실무 시안 이미지 저장(배경 투명 지원, 기존 Geometry Engine 기반 2.5D, GLB 미사용).
- **Export/PDF:** 3D PNG 저장에 실무 시안 모드/투명 배경 반영, PDF 리포트에 제품 진열·집기 개수 요약 추가.
- **Asset Library UI 숨김:** `ENABLE_ASSET_LIBRARY=false` feature flag 로 Asset 탭/패널 비활성(코드·데이터 구조 유지, 기존 프로젝트 무영향).
- **기존 기능 유지 · Console Error 0 · Build 성공.**

**v0.9.9 — Product 3D Upgrade & Workspace Simplification (제품 3D 업그레이드 · 워크스페이스 단순화)**
- **제품 3D 입체 표현:** GLB 없이 기존 Geometry Engine 기반으로 제품을 Depth 를 가진 오브젝트로 렌더.
  **3D 형태**(Auto/Bottle/Tube/Box/Pouch/Jar/Can/Standee/Flat Card), Auto 는 비율로 자동 선택.
  Bottle/Can/Jar/Tube → 원기둥(둘레 이미지 wrap), Box/Pouch → 박스, Standee/Flat Card → 얇은 판.
- **두께(mm)·재질(Paper/Matte/Plastic/Glossy/Glass/Metal):** Glossy/Metal 은 스페큘러 반사. 실측 크기(폭/높이/깊이) 입력.
- **배경 처리(Solid/Transparent):** Transparent(누끼)는 흰 배경을 만들지 않고 PNG alpha 를 2D·3D 모두 유지.
- **제품 그림자·조명:** 집기와 동일하게 바닥/접지 그림자 + 조명·재질 영향. 집기 Top Face 스냅(집기 높이 변경 시 함께 이동).
- **진열 패턴 추가:** Single / Grid / Row / Circle. **Hover 3D 미리보기**(제품 라이브러리 카드 hover).
- **저장:** 3D 형태·두께·배경·재질·크기·회전 모두 Cloud/Auto Save·Undo/Redo.
- **워크스페이스 단순화:** Style(스타일/재질/환경) 패널을 UI 에서 비활성(코드·데이터 구조 유지, 향후 재사용).
  3D 미리보기의 환경/벽색 선택 UI 도 숨김(저장된 스타일은 내부 로직으로 계속 반영).
- **확장 구조(Future Ready):** GLB 미사용(향후), Product Mirror/Flip·Front 따라가기 세부 옵션은 확장 지점으로 설계.
- **기존 기능 유지 · Console Error 0 · Build 성공.**

**v0.9.8 — Professional Styling & Decoration System (제안서 수준 스타일링)**
- **스타일 · 재질 시스템:** 좌측 **스타일** 탭 신설. **Quick Style 프리셋** 8종(Modern/Minimal/Luxury/Natural/Beauty/Baby/
  Pharmacy/Pop-up)으로 바닥/벽 재질 + 3D 환경을 원클릭 변경.
- **Floor Material(9종)·Wall Material(8종):** 스와치로 선택. 2D 바닥 + 3D 바닥/벽에 반영. `boothConfig.styling` 에 저장되어
  Auto/Cloud Save · Undo/Redo · Share 자동 지원.
- **Environment Style(6종):** Studio White/Gray/Black · Mall · Exhibition Hall · Transparent. 3D 미리보기 배경에 반영.
- **Presentation Quality:** 3D PNG 저장 시 **배경 투명**(Transparent 환경 또는 "배경 투명" 토글) 지원 — 제안서 합성용.
- **Professional Render:** 기존 렌더러의 Soft/Contact 그림자 · 바닥 반사 · 스페큘러 · 재질을 스타일링과 연동(실시간 성능 유지).
- **Furniture/Decoration 에셋 확장:** Chair·Round Chair·Table·Round Table·Side Table·Sofa·Bench·Shelf·Rack·Plant·Tall Plant·
  Lamp·Floor Lamp·Mirror·TV·Monitor·Laptop·Tablet·Leaflet·Vase·Trash Bin·Curtain·Frame·Sign·Poster Stand·Roll Banner·
  Counter Decoration 등 30여 종 기본 에셋 추가(에셋 라이브러리 파이프라인 재사용 → 2D/3D 자동 반영).
- **Asset Pin(핀 고정):** 즐겨찾기·최근 사용에 더해 핀 고정으로 목록 상단 고정.
- **확장 구조(Future Ready):** 실제 3D Mesh(GLB) 없이 현재 Geometry Engine + 색/패턴/그라디언트로 가볍고 빠르게 구현.
  전용 Decoration Layer(집기 Top Face 스냅/부착·자동 높이 추적), Smart Display 패턴(Row/Circle/Pyramid/Zigzag), 그룹핑,
  에셋 Drag&Drop·일괄 교체·GLB 에셋은 확장 지점으로 설계(향후 버전).
- **기존 기능 유지 · Console Error 0 · Build 성공.**

**v0.9.7 — Professional Asset Library 2.0 (전문 에셋 라이브러리)**
- **통합 에셋 라이브러리(에셋 탭):** 좌측 사이드바에 **에셋** 탭 추가. 가구·진열집기·제품·POP·포스터·배너·
  장식·식물·사람·조명·벽부착물·바닥오브젝트·사이니지·커스텀 14개 카테고리를 한 곳에서 관리·배치.
- **My / Company 라이브러리:** 개인(private)·회사 공용(company) 가시성 구분. 향후 전사(직원 공유)로 확장할 수 있는
  구조 설계(Firestore `assetLibraries/{uid}`, `storagePath` 참조 필드 예약).
- **에셋 등록:** 이미지 업로드(PNG/JPG/SVG/WEBP) + 실측 사이즈(mm)·카테고리·태그·브랜드·3D 모델타입·재질 입력.
  **[선택한 집기를 에셋으로 저장]** 으로 배치된 집기를 즉시 에셋화.
- **검색·필터·즐겨찾기·최근:** 이름/태그/브랜드 검색, 카테고리 칩 필터, ⭐즐겨찾기 토글, 🕘최근 사용 목록.
- **원클릭 배치 + 2D/3D 자동 반영:** 에셋 → 부스에 배치 시 **기존 집기 + 디자인 매핑 파이프라인을 재사용**하여
  실측 비율·2D 평면·3D 아이소메트릭·조명·재질·Undo/Redo·클라우드/자동 저장·공유가 자동 동작.
- **기본 샘플 에셋:** 기본 카운터·진열대·원형 테이블·POP 스탠드·배너·화분·성인 사람 실루엣·스포트라이트(구조 검증용).
- **저장 정책:** 라이브러리는 사용자 전역(Firestore `assetLibraries/{uid}`) + LocalStorage 캐시/오프라인 폴백.
  이미지는 정적 호스팅 CORS 이슈를 피하기 위해 경량 dataURL로 보관하고, `storagePath` 필드로 향후 Firebase Storage 참조 전환에 대비.
- **기존 기능 유지 · Console Error 0 · Build 성공.**

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
