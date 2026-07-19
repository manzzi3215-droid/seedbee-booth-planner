/**
 * Supabase 시험 import (로컬 전용). 단일 프로젝트만, 사용자 승인 후 호출.
 *
 * 규칙:
 *  - 저장 전 현재 사용자가 **확정된 비익명 Google 사용자**인지 검증(verifySupabaseGoogleUser). 실패 시 import 차단.
 *  - 현재 Supabase auth.uid() 소유로 저장(Firebase uid 사용 안 함). getUser() 로 확정한 uid 사용.
 *  - project id·name·Project JSON 전체 보존.
 *  - 동일 project id 가 있으면 **skip**(덮어쓰기 없음).
 *  - project_shares·user_libraries 는 생성하지 않음.
 *  - 저장 후 **재검증**: 사용자 동일 + 현재 세션으로 프로젝트가 실제로 보이는지 확인. 실패 시 verification_failed.
 *  - Firebase 에는 어떠한 접근도 하지 않음.
 */
import type { Project } from '../../types';
import { supabase } from '../../supabase/client';
import { verifySupabaseGoogleUser, type SupabaseUserCheck } from '../../supabase/auth';

export type ImportStatus = 'success' | 'skipped' | 'error' | 'verification_failed';

export interface ImportResult {
  status: ImportStatus;
  id: string;
  name: string;
  reason?: string;
  supabaseUserIdTail?: string;
  userCheck?: SupabaseUserCheck;
}

function client() {
  if (!supabase) throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.');
  return supabase;
}

/** UI 게이트용: 현재 저장 대상 Supabase 사용자가 확정된 Google 사용자인지 재조회. */
export async function checkSupabaseTargetUser(): Promise<SupabaseUserCheck> {
  return verifySupabaseGoogleUser();
}

/** 현재 로그인 사용자 uid(확정) — getUser() 기준. */
async function currentUserId(): Promise<string> {
  const { data, error } = await client().auth.getUser();
  if (error || !data.user) throw new Error('현재 Supabase 사용자를 확인할 수 없습니다.');
  return data.user.id;
}

/** 단일 프로젝트 시험 import (검증 게이트 + id 존재 시 skip + 저장 후 재검증). */
export async function importProjectToSupabase(project: Project): Promise<ImportResult> {
  const name = project.name;
  const id = project.id;
  try {
    // (1) 저장 전 로그인 검증 — 비익명 Google + getSession/getUser/ensure 일치
    const check = await verifySupabaseGoogleUser();
    if (!check.ok) {
      return {
        status: 'error',
        id,
        name,
        reason: `로그인 확인 실패(${check.reason}) — Supabase Google 로그인이 확인되지 않아 이전을 중단했습니다. 기존 Google 계정으로 다시 로그인한 뒤 시도해 주세요.`,
        userCheck: check,
      };
    }
    const uidBefore = await currentUserId();

    // (2) 동일 id 존재 여부(RLS: 내 소유만) → 있으면 skip
    const existing = await client().from('projects').select('id').eq('id', id).maybeSingle();
    if (existing.error) return { status: 'error', id, name, reason: `조회 실패: ${existing.error.message}`, userCheck: check };
    if (existing.data) {
      return { status: 'skipped', id, name, reason: '동일 id 가 이미 존재(덮어쓰기 안 함)', supabaseUserIdTail: check.uidTail ?? undefined, userCheck: check };
    }

    // (3) 삽입: user_id=현재 Google uid, name·layout_data(전체 Project) 보존. shares/libraries 생성 안 함.
    const { error } = await client().from('projects').insert({ id, user_id: uidBefore, name, layout_data: project });
    if (error) return { status: 'error', id, name, reason: `삽입 실패: ${error.message}`, userCheck: check };

    // (4) 저장 후 재검증: 사용자 동일 + 현재 세션으로 프로젝트가 실제 보이는지
    const uidAfter = await currentUserId();
    if (uidAfter !== uidBefore) {
      return { status: 'verification_failed', id, name, reason: '저장 후 사용자(uid)가 변경됨 — 소유권 불일치', supabaseUserIdTail: `…${uidAfter.slice(-4)}`, userCheck: check };
    }
    const back = await client().from('projects').select('name, layout_data').eq('id', id).maybeSingle();
    if (back.error || !back.data) {
      return { status: 'verification_failed', id, name, reason: '저장 후 현재 사용자 세션으로 조회되지 않음', supabaseUserIdTail: check.uidTail ?? undefined, userCheck: check };
    }
    const imported = back.data.layout_data as Project;
    const fieldsOk = back.data.name === name && imported.name === name && (imported.layouts?.length ?? 0) === (project.layouts?.length ?? 0) && imported.createdAt === project.createdAt && imported.updatedAt === project.updatedAt && !!imported.boothConfig;
    if (!fieldsOk) {
      return { status: 'verification_failed', id, name, reason: '저장 후 핵심 필드 비교 불일치', supabaseUserIdTail: check.uidTail ?? undefined, userCheck: check };
    }

    return { status: 'success', id, name, supabaseUserIdTail: check.uidTail ?? undefined, userCheck: check };
  } catch (e) {
    return { status: 'error', id, name, reason: (e as Error)?.message ?? String(e) };
  }
}

export interface ImportComparison {
  found: boolean;
  nameMatch: boolean;
  layoutCountMatch: boolean;
  createdAtMatch: boolean;
  updatedAtMatch: boolean;
  boothConfigPresent: boolean;
  detail: string;
}

/** 결과 화면용 상세 비교(읽기). */
export async function compareImported(original: Project): Promise<ImportComparison> {
  const { data, error } = await client().from('projects').select('name, layout_data').eq('id', original.id).maybeSingle();
  if (error || !data) {
    return { found: false, nameMatch: false, layoutCountMatch: false, createdAtMatch: false, updatedAtMatch: false, boothConfigPresent: false, detail: error?.message ?? '없음' };
  }
  const imported = data.layout_data as Project;
  const oLayouts = original.layouts?.length ?? 0;
  const iLayouts = imported.layouts?.length ?? 0;
  return {
    found: true,
    nameMatch: data.name === original.name && imported.name === original.name,
    layoutCountMatch: oLayouts === iLayouts,
    createdAtMatch: imported.createdAt === original.createdAt,
    updatedAtMatch: imported.updatedAt === original.updatedAt,
    boothConfigPresent: !!imported.boothConfig,
    detail: `layouts ${oLayouts}→${iLayouts}`,
  };
}
