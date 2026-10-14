import { useState, useEffect, useRef } from 'react';
import type { NearPlayer, ActivityData, EnsembleSession, EnsembleMember } from '../types.js';

interface UseEnsembleOptions {
  delaySeconds: number;         // 합주 집계 버퍼 시간 (기본 4초)
  noticeDisplaySeconds: number; // 화면 표시 지속 시간 (기본 8초)
  maxDistance?: number;         // 연주 인식 최대 거리 (기본 7m)
}

export function useEnsemble(
  players: NearPlayer[],
  myActivity: ActivityData | null,
  options: UseEnsembleOptions = { delaySeconds: 4, noticeDisplaySeconds: 8, maxDistance: 7 }
) {
  // 현재 중앙에 모션으로 표시 중인 합주 공지
  const [activeNotice, setActiveNotice] = useState<EnsembleSession | null>(null);
  // 합주 집계 버퍼링 중인 세션 (대기 중 표시용)
  const [bufferingSession, setBufferingSession] = useState<EnsembleSession | null>(null);

  const bufferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 버퍼링 중인 대표곡명 (버퍼링 도중 다른 곡으로 바뀔 때 기존 타이머 취소용)
  const bufferingTitleRef = useRef<string | null>(null);
  // 이미 화면에 띄운 곡명 (곡이 바뀌기 전까지 재표시 방지)
  const lastDisplayedTitleRef = useRef<string | null>(null);
  const pendingMembersRef = useRef<Map<string, EnsembleMember>>(new Map());

  // 컴포넌트 unmount 시점에만 타이머를 안전하게 정리
  useEffect(() => {
    return () => {
      if (bufferTimerRef.current) {
        clearTimeout(bufferTimerRef.current);
        bufferTimerRef.current = null;
      }
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // 1. 본인 포함 현재 연주 중인 전체 플레이어 추출
    const activePerformers: { name: string; title: string; instrument?: string; elapsed?: number; duration?: number }[] = [];

    // 본인 연주 확인 (거리는 항상 0m)
    if (myActivity?.Performance?.IsPlaying && myActivity.Performance.MusicTitle) {
      activePerformers.push({
        name: '나',
        title: myActivity.Performance.MusicTitle.trim(),
        instrument: myActivity.Performance.InstrumentName || '악기',
        elapsed: myActivity.Performance.ElapsedSeconds,
        duration: myActivity.Performance.TotalDurationSeconds,
      });
    }

    // 주변 플레이어 연주 확인 (거리 7m 이하로 제한)
    const maxDist = options.maxDistance ?? 7;
    const safePlayers = Array.isArray(players) ? players : [];
    for (const p of safePlayers) {
      if (p.Performance?.IsPlaying && p.Performance.MusicTitle) {
        // 7m 초과 거리의 플레이어는 연주 감지에서 제외
        if (typeof p.Distance === 'number' && p.Distance > maxDist) {
          continue;
        }

        const playerName = p.CharacterName || p.DisplayName || p.Title || '음유시인';
        activePerformers.push({
          name: playerName,
          title: p.Performance.MusicTitle.trim(),
          instrument: p.Performance.InstrumentName || '악기',
          elapsed: p.Performance.ElapsedSeconds,
          duration: p.Performance.TotalDurationSeconds,
        });
      }
    }

    // 연주자가 아무도 없는 상태 처리
    if (activePerformers.length === 0) {
      if (bufferTimerRef.current) {
        clearTimeout(bufferTimerRef.current);
        bufferTimerRef.current = null;
      }
      bufferingTitleRef.current = null;
      setBufferingSession(null);

      // 연주가 멈춘 시각부터 독립 4초 타이머를 구동하여, 리렌더링 틱과 무관하게 4초 후 이전 곡 초기화
      if (!idleTimerRef.current) {
        idleTimerRef.current = setTimeout(() => {
          lastDisplayedTitleRef.current = null;
          idleTimerRef.current = null;
        }, 4000);
      }
      return;
    }

    // 연주자가 감지되면 대기 중이던 idle 타이머 취소
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    // 2. 가장 많은 인원이 연주 중인 대표 곡 선별
    const titleGroups = new Map<string, typeof activePerformers>();
    for (const perf of activePerformers) {
      const group = titleGroups.get(perf.title) || [];
      group.push(perf);
      titleGroups.set(perf.title, group);
    }

    let dominantTitle = '';
    let dominantList: typeof activePerformers = [];
    for (const [title, group] of titleGroups.entries()) {
      if (group.length > dominantList.length) {
        dominantTitle = title;
        dominantList = group;
      }
    }

    if (!dominantTitle) return;

    // [핵심] 이미 표시된 곡과 제목이 같은 경우: 다시 띄우지 않고 조용히 멤버 목록만 실시간 동기화
    if (lastDisplayedTitleRef.current === dominantTitle) {
      if (activeNotice) {
        setActiveNotice((prev) =>
          prev
            ? {
                ...prev,
                members: dominantList.map((m) => ({
                  name: m.name,
                  instrument: m.instrument,
                  elapsedSeconds: m.elapsed,
                  totalDurationSeconds: m.duration,
                })),
              }
            : null
        );
      }
      // 버퍼링 취소 및 중복 재표시 완전 차단
      if (bufferingSession) {
        setBufferingSession(null);
      }
      if (bufferTimerRef.current) {
        clearTimeout(bufferTimerRef.current);
        bufferTimerRef.current = null;
      }
      bufferingTitleRef.current = null;
      return;
    }

    // 3. 신규 곡 감지 -> 버퍼링(지연 집계) 시작
    if (bufferingTitleRef.current !== dominantTitle) {
      if (bufferTimerRef.current) {
        clearTimeout(bufferTimerRef.current);
        bufferTimerRef.current = null;
      }
      bufferingTitleRef.current = dominantTitle;
      pendingMembersRef.current.clear();
    }

    // 현재 연주 중이지 않은 Stale 유령 멤버 정리
    const currentDominantNames = new Set(dominantList.map((m) => m.name));
    for (const key of Array.from(pendingMembersRef.current.keys())) {
      if (!currentDominantNames.has(key)) {
        pendingMembersRef.current.delete(key);
      }
    }

    for (const m of dominantList) {
      pendingMembersRef.current.set(m.name, {
        name: m.name,
        instrument: m.instrument,
        elapsedSeconds: m.elapsed,
        totalDurationSeconds: m.duration,
      });
    }

    const currentMembers = Array.from(pendingMembersRef.current.values());

    setBufferingSession({
      id: `ens-${Date.now()}`,
      title: dominantTitle,
      members: currentMembers,
      startedAt: Date.now(),
      isBuffering: true,
    });

    // 버퍼 타이머가 아직 없으면 지정된 시간(기본 4초) 후 중앙 타이포 발동
    if (!bufferTimerRef.current) {
      bufferTimerRef.current = setTimeout(() => {
        const finalMembers = Array.from(pendingMembersRef.current.values());
        const session: EnsembleSession = {
          id: `ens-${Date.now()}`,
          title: dominantTitle,
          members: finalMembers,
          startedAt: Date.now(),
          isBuffering: false,
        };

        // 방금 표시한 곡명을 기억하여 재표시 방지
        lastDisplayedTitleRef.current = dominantTitle;
        bufferingTitleRef.current = null;
        setActiveNotice(session);
        setBufferingSession(null);
        bufferTimerRef.current = null;

        // 일정 시간(noticeDisplaySeconds) 후 자동으로 퇴장
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
          setActiveNotice(null);
        }, options.noticeDisplaySeconds * 1000);
      }, options.delaySeconds * 1000);
    }
  }, [players, myActivity, options.delaySeconds, options.noticeDisplaySeconds, options.maxDistance]);

  return {
    activeNotice,
    bufferingSession,
    dismissNotice: () => setActiveNotice(null),
  };
}
