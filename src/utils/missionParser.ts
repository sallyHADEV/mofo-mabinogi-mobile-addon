/**
 * 미션 설명 문구 간소화 유틸리티
 * 불필요한 동사를 제거하고 목표치 대비 잔여 수량(GoalCount - CurrentCount)을 명사구에 반영합니다.
 */

export function simplifyMissionText(
  description: string,
  currentCount?: number,
  goalCount?: number
): string {
  const safeGoal = typeof goalCount === 'number' && !Number.isNaN(goalCount) ? goalCount : 0;
  const safeCurrent = typeof currentCount === 'number' && !Number.isNaN(currentCount) ? currentCount : 0;
  const remaining = Math.max(0, safeGoal - safeCurrent);

  if (!description) return '';

  const trimmed = description.trim();

  // 특수 규칙 1: 아르바이트 또는 사이드 퀘스트 N회 수행
  if (/아르바이트\s*(?:또는|\/|&)\s*사이드\s*퀘스트/i.test(trimmed)) {
    return `아르바이트&퀘 ${remaining}회`;
  }

  // 특수 규칙 2: 재료 아이템 N회 채집
  if (/재료\s*아이템\s*\d+회/i.test(trimmed)) {
    return `재료 채집 ${remaining}회`;
  }

  // 특수 규칙 3: 접속하기
  if (/접속하기/i.test(trimmed)) {
    return `접속 ${remaining}회`;
  }

  // 조사 및 불필요한 선두/후미 토큰 정리 헬퍼
  const cleanTarget = (str: string) => {
    const t = str.trim();
    const last = t.slice(-1);
    const prev = t.charCodeAt(t.length - 2);
    if (t.length < 2 || prev < 0xac00 || prev > 0xd7a3 || (last !== '을' && last !== '를')) return t;
    // 받침 있는 글자 뒤 '을', 받침 없는 글자 뒤 '를'만 조사로 판단 (예: '마을'의 '을'은 유지)
    const hasBatchim = (prev - 0xac00) % 28 !== 0;
    return (last === '을') === hasBatchim ? t.slice(0, -1).trim() : t;
  };
  const cleanTrailing = (str: string) =>
    str
      .trim()
      .replace(/^[을를이가은는]\s*/, '')
      .replace(/\s*(?:하기|완료|수행|달성)$/, '')
      .trim();

  // 단위 목록: 개, 회, 마리, 곳, 번, 명, 종류, 종, 단계, 줄, 점
  const units = '개|회|마리|곳|번|명|종류|종|단계|줄|점';

  // 1. 선두 숫자 형태 (예: "10회 던전 클리어", "5회 사냥하기")
  const leadingNumRegex = new RegExp(`^(\\d+)\\s*(${units})(?:\\s*(.*))?$`);
  const leadingMatch = trimmed.match(leadingNumRegex);
  if (leadingMatch) {
    const unit = leadingMatch[2];
    const trailing = cleanTrailing(leadingMatch[3] || '');
    return trailing ? `${trailing} ${remaining}${unit}` : `${remaining}${unit}`;
  }

  // 2. 타겟 명사 + 숫자 형태 (예: "음식 2개 먹기", "양털10개 채집하기", "몬스터를 70마리 처치")
  const targetNumRegex = new RegExp(`^(.+?)\\s*(\\d+)\\s*(${units})(?:\\s*(.*))?$`);
  const targetMatch = trimmed.match(targetNumRegex);
  if (targetMatch) {
    const rawTarget = targetMatch[1];
    const unit = targetMatch[3];
    const rawTrailing = targetMatch[4] || '';

    const target = cleanTarget(rawTarget);
    const trailing = cleanTrailing(rawTrailing);

    if (target) {
      return `${target} ${remaining}${unit}`;
    } else if (trailing) {
      return `${trailing} ${remaining}${unit}`;
    } else {
      return `${remaining}${unit}`;
    }
  }

  // 수량 단위가 없는 경우 끝의 동사형(~하기, ~완료, ~수행, ~달성) 제거
  return trimmed.replace(/\s*(?:하기|완료|수행|달성)$/, '');
}
