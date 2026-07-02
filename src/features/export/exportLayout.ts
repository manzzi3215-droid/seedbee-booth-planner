import type { FixtureDef, PlacedDimension, PlacedFixture, PlacedImage, PlacedText, Project, WallSide } from '../../types';
import { getFloorLabel, getBoothSizeLabel } from '../../constants/booth';
import { createBoothDrawingDataURL } from './renderBooth';
import { createWallDrawingDataURL } from './renderWall';
import { computeFixtureUsage } from './fixtureUsage';
import { buildBaseName, downloadDataURL, preloadImages } from './download';

/** export 대상 = 현재 화면 기준(placed + texts + dimensions + images) + 배치안 메타 */
export interface ExportInput {
  project: Project;
  layoutName: string;
  createdAt: number;
  updatedAt: number;
  placed: PlacedFixture[];
  texts: PlacedText[];
  dimensions: PlacedDimension[];
  images: PlacedImage[];
  fixturesById: Map<string, FixtureDef>;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/** 1. PNG 저장 — 부스 전체 도면 */
export async function downloadLayoutPNG(input: ExportInput): Promise<void> {
  const imageEls = await preloadImages(input.images.map((i) => i.srcDataUrl));
  const url = createBoothDrawingDataURL(
    input.project.boothConfig,
    input.placed,
    input.texts,
    input.dimensions,
    input.images,
    imageEls,
    input.fixturesById,
  );
  downloadDataURL(url, `${buildBaseName(input.project.name, input.layoutName)}_layout.png`);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * A4 가로형 리포트 이미지를 캔버스로 구성.
 * 한글 폰트 임베드 문제를 피하기 위해 텍스트/표/도면을 모두 캔버스에 그린 뒤
 * 하나의 이미지로 만들어 jsPDF 에 배치합니다.
 */
async function buildReportDataURL(input: ExportInput): Promise<string> {
  const { project, layoutName } = input;
  const booth = project.boothConfig;

  const R = 6; // px per mm (A4 가로 297×210)
  const PAGE_W = 297;
  const PAGE_H = 210;
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W * R;
  canvas.height = PAGE_H * R;
  const ctx = canvas.getContext('2d')!;
  const font = (mm: number, bold = false) =>
    `${bold ? 'bold ' : ''}${mm * R}px Pretendard, system-ui, "Malgun Gothic", sans-serif`;
  const mm = (v: number) => v * R;

  // 배경
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const PAD = 12;

  // 헤더
  ctx.fillStyle = '#0f172a';
  ctx.textBaseline = 'alphabetic';
  ctx.font = font(8, true);
  ctx.fillText(project.name, mm(PAD), mm(24));

  ctx.fillStyle = '#334155';
  ctx.font = font(5);
  ctx.fillText(`배치안: ${layoutName}`, mm(PAD), mm(33));

  ctx.fillStyle = '#475569';
  ctx.font = font(3.4);
  const info =
    `부스 ${getBoothSizeLabel(booth)}  ·  오픈 ${booth.openSide}면  ·  ` +
    `바닥 ${getFloorLabel(booth)}  ·  생성 ${formatDate(input.createdAt)}  ·  수정 ${formatDate(input.updatedAt)}`;
  ctx.fillText(info, mm(PAD), mm(41));

  // 구분선
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = mm(0.4);
  ctx.beginPath();
  ctx.moveTo(mm(PAD), mm(45));
  ctx.lineTo(mm(PAGE_W - PAD), mm(45));
  ctx.stroke();

  // 부스 도면 (왼쪽 영역)
  const drawBoxX = PAD;
  const drawBoxY = 50;
  const drawBoxW = 168;
  const drawBoxH = 150;

  ctx.fillStyle = '#334155';
  ctx.font = font(4, true);
  ctx.fillText('부스 도면', mm(drawBoxX), mm(drawBoxY - 1));

  const imageEls = await preloadImages(input.images.map((i) => i.srcDataUrl));
  const boothImg = await loadImage(
    createBoothDrawingDataURL(booth, input.placed, input.texts, input.dimensions, input.images, imageEls, input.fixturesById, { pixelRatio: 2 }),
  );
  // 박스 안에 비율 유지하여 맞춤
  const boxRatio = drawBoxW / drawBoxH;
  const imgRatio = boothImg.width / boothImg.height;
  let dw = drawBoxW;
  let dh = drawBoxH;
  if (imgRatio > boxRatio) dh = drawBoxW / imgRatio;
  else dw = drawBoxH * imgRatio;
  const dx = drawBoxX + (drawBoxW - dw) / 2;
  const dy = drawBoxY + 2 + (drawBoxH - dh) / 2;
  ctx.drawImage(boothImg, mm(dx), mm(dy), mm(dw), mm(dh));

  // 사용 집기 리스트 (오른쪽 영역)
  const rows = computeFixtureUsage(input.placed, input.fixturesById);
  const tblX = 180;
  let ty = 50;

  ctx.fillStyle = '#334155';
  ctx.font = font(4, true);
  ctx.fillText('사용 집기 리스트', mm(tblX), mm(ty - 1));

  ty += 4;
  // 컬럼 위치(mm)
  const colName = tblX;
  const colShape = tblX + 42;
  const colSize = tblX + 62;
  const colQty = PAGE_W - PAD; // 수량은 오른쪽 정렬

  ctx.font = font(3.2, true);
  ctx.fillStyle = '#64748b';
  ctx.fillText('집기명', mm(colName), mm(ty));
  ctx.fillText('형태', mm(colShape), mm(ty));
  ctx.fillText('사이즈', mm(colSize), mm(ty));
  ctx.textAlign = 'right';
  ctx.fillText('수량', mm(colQty), mm(ty));
  ctx.textAlign = 'left';

  ty += 1.5;
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = mm(0.3);
  ctx.beginPath();
  ctx.moveTo(mm(tblX), mm(ty));
  ctx.lineTo(mm(PAGE_W - PAD), mm(ty));
  ctx.stroke();

  ty += 5;
  ctx.font = font(3.2);
  const rowH = 6.5;
  if (rows.length === 0) {
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('배치된 집기가 없습니다.', mm(colName), mm(ty));
  }
  for (const row of rows) {
    ctx.fillStyle = '#0f172a';
    ctx.fillText(row.name, mm(colName), mm(ty));
    ctx.fillStyle = '#475569';
    ctx.fillText(row.shapeLabel, mm(colShape), mm(ty));
    ctx.font = font(2.8);
    ctx.fillText(row.sizeLabel, mm(colSize), mm(ty));
    ctx.font = font(3.2, true);
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'right';
    ctx.fillText(`${row.quantity}`, mm(colQty), mm(ty));
    ctx.textAlign = 'left';
    ctx.font = font(3.2);

    ctx.strokeStyle = '#eef2f7';
    ctx.beginPath();
    ctx.moveTo(mm(tblX), mm(ty + 2));
    ctx.lineTo(mm(PAGE_W - PAD), mm(ty + 2));
    ctx.stroke();
    ty += rowH;
  }

  return canvas.toDataURL('image/png');
}

/** 2. PDF 저장 — A4 가로형, 도면 + 정보 + 집기 리스트 */
export async function downloadLayoutPDF(input: ExportInput): Promise<void> {
  const reportURL = await buildReportDataURL(input);
  // jsPDF 는 사용 시점에 동적 로드(초기 번들 절감)
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  pdf.addImage(reportURL, 'PNG', 0, 0, 297, 210);
  pdf.save(`${buildBaseName(input.project.name, input.layoutName)}_layout.pdf`);
}

// ===================== 벽면 출력 =====================

export interface WallExportInput {
  project: Project;
  layoutName: string;
  createdAt: number;
  updatedAt: number;
  wall: WallSide;
  wallLabel: string; // 예: "후면 벽"
  wallLengthMm: number;
  heightMm: number;
  texts: PlacedText[];
  dimensions: PlacedDimension[];
  images: PlacedImage[];
}

/** 벽면 PNG 저장 — 파일명: 프로젝트명_배치안명_{wall}.png */
export async function downloadWallPNG(input: WallExportInput): Promise<void> {
  const imageEls = await preloadImages(input.images.map((i) => i.srcDataUrl));
  const url = createWallDrawingDataURL(input.wallLengthMm, input.heightMm, input.texts, input.dimensions, input.images, imageEls);
  downloadDataURL(url, `${buildBaseName(input.project.name, input.layoutName)}_${input.wall}.png`);
}

/** 벽면 리포트(A4 가로) — 정보 + 벽면 이미지 + 요소 요약 */
async function buildWallReportDataURL(input: WallExportInput): Promise<string> {
  const R = 6;
  const PAGE_W = 297;
  const PAGE_H = 210;
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W * R;
  canvas.height = PAGE_H * R;
  const ctx = canvas.getContext('2d')!;
  const font = (m: number, bold = false) => `${bold ? 'bold ' : ''}${m * R}px Pretendard, system-ui, "Malgun Gothic", sans-serif`;
  const mm = (v: number) => v * R;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const PAD = 12;
  ctx.fillStyle = '#0f172a';
  ctx.textBaseline = 'alphabetic';
  ctx.font = font(8, true);
  ctx.fillText(input.project.name, mm(PAD), mm(24));

  ctx.fillStyle = '#334155';
  ctx.font = font(5);
  ctx.fillText(`배치안: ${input.layoutName}  ·  ${input.wallLabel}`, mm(PAD), mm(33));

  ctx.fillStyle = '#475569';
  ctx.font = font(3.4);
  ctx.fillText(
    `벽면 ${input.wallLengthMm} × ${input.heightMm} mm  ·  생성 ${formatDate(input.createdAt)}  ·  수정 ${formatDate(input.updatedAt)}`,
    mm(PAD),
    mm(41),
  );

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = mm(0.4);
  ctx.beginPath();
  ctx.moveTo(mm(PAD), mm(45));
  ctx.lineTo(mm(PAGE_W - PAD), mm(45));
  ctx.stroke();

  // 벽면 이미지 (왼쪽)
  const drawBoxX = PAD, drawBoxY = 50, drawBoxW = 168, drawBoxH = 150;
  ctx.fillStyle = '#334155';
  ctx.font = font(4, true);
  ctx.fillText('벽면 전개도', mm(drawBoxX), mm(drawBoxY - 1));

  const imageEls = await preloadImages(input.images.map((i) => i.srcDataUrl));
  const wallImg = await loadImage(
    createWallDrawingDataURL(input.wallLengthMm, input.heightMm, input.texts, input.dimensions, input.images, imageEls, { pixelRatio: 2 }),
  );
  const boxRatio = drawBoxW / drawBoxH;
  const imgRatio = wallImg.width / wallImg.height;
  let dw = drawBoxW, dh = drawBoxH;
  if (imgRatio > boxRatio) dh = drawBoxW / imgRatio;
  else dw = drawBoxH * imgRatio;
  const dx = drawBoxX + (drawBoxW - dw) / 2;
  const dy = drawBoxY + 2 + (drawBoxH - dh) / 2;
  ctx.drawImage(wallImg, mm(dx), mm(dy), mm(dw), mm(dh));

  // 요소 요약 (오른쪽)
  const tblX = 186;
  let ty = 50;
  ctx.fillStyle = '#334155';
  ctx.font = font(4, true);
  ctx.fillText('벽면 요소', mm(tblX), mm(ty - 1));

  ty += 6;
  ctx.font = font(3.4);
  ctx.fillStyle = '#0f172a';
  ctx.fillText(`텍스트 ${input.texts.length}개`, mm(tblX), mm(ty));
  ty += 6;
  ctx.fillText(`치수선 ${input.dimensions.length}개`, mm(tblX), mm(ty));

  ty += 8;
  ctx.fillStyle = '#64748b';
  ctx.font = font(3, true);
  ctx.fillText('텍스트 목록', mm(tblX), mm(ty));
  ty += 5;
  ctx.font = font(3);
  ctx.fillStyle = '#0f172a';
  for (const t of input.texts.slice(0, 20)) {
    ctx.fillText(`· ${t.text || '(빈 텍스트)'}`, mm(tblX), mm(ty));
    ty += 5;
  }

  return canvas.toDataURL('image/png');
}

/** 벽면 PDF 저장 — 파일명: 프로젝트명_배치안명_{wall}.pdf */
export async function downloadWallPDF(input: WallExportInput): Promise<void> {
  const reportURL = await buildWallReportDataURL(input);
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  pdf.addImage(reportURL, 'PNG', 0, 0, 297, 210);
  pdf.save(`${buildBaseName(input.project.name, input.layoutName)}_${input.wall}.pdf`);
}
