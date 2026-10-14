import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle, Sparkles, Calendar, Clock, Loader2 } from 'lucide-react';
import type { MissionsData, MissionItem } from '../types.js';
import { simplifyMissionText } from '../utils/missionParser.js';

interface RemainingMissionsHudProps {
  missionsData: MissionsData | null;
  compact?: boolean;
  bgOpacity?: number;
  isLocked?: boolean;
  onDoubleClick?: () => void;
}

interface DisplayMission {
  key: string;
  item: MissionItem;
  type: 'daily' | 'weekly';
  isCompleting?: boolean;
}

export const RemainingMissionsHud: React.FC<RemainingMissionsHudProps> = React.memo(({
  missionsData,
  compact = false,
  bgOpacity = 82,
  isLocked = true,
  onDoubleClick,
}) => {
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly'>('daily');
  // 새로 완료되어 취소선 연출 중인 미션 키 집합
  const [completingKeys, setCompletingKeys] = useState<Set<string>>(new Set());

  // 이전 폴링 상태 기억 (완료 감지용)
  const prevMissionsMapRef = useRef<Map<string, MissionItem>>(new Map());
  // 완료 연출 중인 아이템 임시 보관
  const completingItemsRef = useRef<Map<string, { item: MissionItem; type: 'daily' | 'weekly' }>>(new Map());
  // 1.2초 취소선 애니메이션 타이머 ID 추적 (메모리 누수 방지)
  const animationTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  // 언마운트 시 동작 중인 애니메이션 타이머 일괄 정리
  useEffect(() => {
    return () => {
      animationTimersRef.current.forEach((timerId) => clearTimeout(timerId));
      animationTimersRef.current.clear();
    };
  }, []);

  // 고유 키 생성
  const getMissionKey = (item: MissionItem, type: 'daily' | 'weekly') => {
    return `${type}_${item.Title}_${item.Description}_${item.GoalCount}`;
  };

  // 완료 전이(Transition) 감지
  useEffect(() => {
    if (!missionsData) return;

    const currentMap = new Map<string, MissionItem>();
    const currentCompletedKeys = new Set<string>();

    const allCurrent: { item: MissionItem; type: 'daily' | 'weekly' }[] = [
      ...(missionsData.daily || []).map((m) => ({ item: m, type: 'daily' as const })),
      ...(missionsData.weekly || []).map((m) => ({ item: m, type: 'weekly' as const })),
    ];

    for (const { item, type } of allCurrent) {
      const key = getMissionKey(item, type);
      currentMap.set(key, item);
      const isDone = item.IsCompleted || item.CurrentCount >= item.GoalCount;
      if (isDone) {
        currentCompletedKeys.add(key);
      }
    }

    const prevMap = prevMissionsMapRef.current;
    if (prevMap.size > 0) {
      const newlyCompleted: string[] = [];

      for (const { item, type } of allCurrent) {
        const key = getMissionKey(item, type);
        const prev = prevMap.get(key);
        const isNowDone = item.IsCompleted || item.CurrentCount >= item.GoalCount;
        const wasPending = prev && !prev.IsCompleted && prev.CurrentCount < prev.GoalCount;

        if (wasPending && isNowDone) {
          newlyCompleted.push(key);
          completingItemsRef.current.set(key, { item, type });
        }
      }

      if (newlyCompleted.length > 0) {
        setCompletingKeys((prev) => {
          const next = new Set(prev);
          newlyCompleted.forEach((k) => next.add(k));
          return next;
        });

        // 1.2초 후 취소선 연출 완료 및 완전히 목록에서 제거
        const timerId = setTimeout(() => {
          animationTimersRef.current.delete(timerId);
          newlyCompleted.forEach((k) => {
            completingItemsRef.current.delete(k);
          });
          setCompletingKeys((prev) => {
            const next = new Set(prev);
            newlyCompleted.forEach((k) => {
              next.delete(k);
            });
            return next;
          });
        }, 1200);
        animationTimersRef.current.add(timerId);
      }
    }

    if (allCurrent.length > 0) {
      prevMissionsMapRef.current = currentMap;
    }
  }, [missionsData]);

  // 진행 중인 미션 필터링
  const { dailyList, weeklyList, totalPendingCount, rawTotalMissionCount } = useMemo(() => {
    if (!missionsData) {
      return { dailyList: [], weeklyList: [], totalPendingCount: 0, rawTotalMissionCount: 0 };
    }

    const filterPending = (list: MissionItem[] = [], type: 'daily' | 'weekly'): DisplayMission[] => {
      const active: DisplayMission[] = [];
      const keysSeen = new Set<string>();

      // 1. 현재 진행 중인 미션
      for (const item of list) {
        const key = getMissionKey(item, type);
        const isDone = item.IsCompleted || item.CurrentCount >= item.GoalCount;
        const isCompleting = completingKeys.has(key);

        if (!isDone || isCompleting) {
          active.push({ key, item, type, isCompleting });
          keysSeen.add(key);
        }
      }

      // 2. 현재 데이터에서는 이미 완료/제거되었으나 완료 애니메이션 중인 미션 추가
      completingItemsRef.current.forEach((val, k) => {
        if (val.type === type && !keysSeen.has(k) && completingKeys.has(k)) {
          active.push({ key: k, item: val.item, type, isCompleting: true });
        }
      });

      return active;
    };

    const dList = filterPending(missionsData.daily, 'daily');
    const wList = filterPending(missionsData.weekly, 'weekly');

    // 실제 진행 중(취소선 연출 중인 것 제외) 카운트
    const countPending = (list: DisplayMission[]) =>
      list.filter((m) => !m.isCompleting).length;

    const totalCount = (missionsData.daily?.length || 0) + (missionsData.weekly?.length || 0);

    return {
      dailyList: dList,
      weeklyList: wList,
      totalPendingCount: countPending(dList) + countPending(wList),
      rawTotalMissionCount: totalCount,
    };
  }, [missionsData, completingKeys]);

  // 10개 초과 시 탭 분리 모드
  const isSplitTabMode = totalPendingCount > 10;

  // 탭 분리 모드에서 만약 현재 탭에 미션이 0개이고 다른 탭에 미션이 있으면 자동 전환
  useEffect(() => {
    if (isSplitTabMode) {
      if (activeTab === 'daily' && dailyList.length === 0 && weeklyList.length > 0) {
        setActiveTab('weekly');
      } else if (activeTab === 'weekly' && weeklyList.length === 0 && dailyList.length > 0) {
        setActiveTab('daily');
      }
    }
  }, [isSplitTabMode, dailyList.length, weeklyList.length, activeTab]);

  const opacityVal = Math.max(0, Math.min(100, bgOpacity ?? 82)) / 100;
  const isFullyTransparent = opacityVal === 0;

  return (
    <div
      style={{
        background: isFullyTransparent ? 'transparent' : `rgba(12, 13, 18, ${opacityVal})`,
        backdropFilter: isFullyTransparent ? 'none' : 'blur(12px)',
        border: !isLocked
          ? '1px dashed rgba(234, 179, 8, 0.7)'
          : isFullyTransparent
            ? '1px solid rgba(212, 163, 89, 0.2)'
            : '1px solid rgba(212, 163, 89, 0.28)',
        borderRadius: '10px',
        padding: compact ? '8px 10px' : '10px 12px',
        boxShadow: isFullyTransparent ? 'none' : `0 8px 32px rgba(0, 0, 0, ${0.55 * (opacityVal / 0.82)}), inset 0 1px 0 rgba(255, 255, 255, 0.08)`,
        minWidth: compact ? '180px' : '210px',
        maxWidth: '260px',
        color: '#e2e8f0',
        fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif",
        userSelect: 'none',
        pointerEvents: 'none',
      }}
    >
      {/* 1. 상단 타이틀 & 뱃지 바 (더블클릭 시 5초 임시 숨김 지원) */}
      <div
        id="missions-header"
        onDoubleClick={(e) => {
          e.stopPropagation();
          onDoubleClick?.();
        }}
        title="더블클릭 시 5초간 임시 숨김"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
          paddingBottom: '6px',
          borderBottom: '1px solid rgba(212, 163, 89, 0.15)',
          cursor: 'pointer',
          pointerEvents: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#eab308',
              boxShadow: '0 0 8px #eab308',
              display: 'inline-block',
            }}
          />
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.02em',
              color: '#f8fafc',
            }}
          >
            남은 미션
          </span>
        </div>

        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: '10px',
            backgroundColor:
              rawTotalMissionCount === 0
                ? 'rgba(148, 163, 184, 0.15)'
                : totalPendingCount > 0
                  ? 'rgba(212, 163, 89, 0.15)'
                  : 'rgba(34, 197, 94, 0.15)',
            color:
              rawTotalMissionCount === 0
                ? '#94a3b8'
                : totalPendingCount > 0
                  ? '#facc15'
                  : '#4ade80',
            border: `1px solid ${
              rawTotalMissionCount === 0
                ? 'rgba(148, 163, 184, 0.3)'
                : totalPendingCount > 0
                  ? 'rgba(234, 179, 8, 0.3)'
                  : 'rgba(34, 197, 94, 0.3)'
            }`,
          }}
        >
          {rawTotalMissionCount === 0
            ? '동기화 중'
            : totalPendingCount > 0
              ? `${totalPendingCount}개 남음`
              : '완료'}
        </span>
      </div>

      {/* 2. 10개 초과 시: 일일 / 주간 탭 세그먼트 (이 탭 버튼 영역만 인터랙티브 클릭 허용) */}
      {isSplitTabMode && (
        <div
          id="missions-tab-bar"
          onMouseDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onDoubleClick?.();
          }}
          title="더블클릭 시 5초간 임시 숨김"
          style={{
            display: 'flex',
            gap: '4px',
            marginBottom: '8px',
            padding: '2px',
            backgroundColor: 'rgba(0, 0, 0, 0.35)',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            pointerEvents: 'auto',
          }}
        >
          <button
            onClick={() => setActiveTab('daily')}
            style={{
              flex: 1,
              padding: '4px 6px',
              fontSize: '11px',
              fontWeight: activeTab === 'daily' ? 700 : 500,
              color: activeTab === 'daily' ? '#f8fafc' : '#94a3b8',
              backgroundColor: activeTab === 'daily' ? 'rgba(212, 163, 89, 0.25)' : 'transparent',
              border: activeTab === 'daily' ? '1px solid rgba(212, 163, 89, 0.4)' : '1px solid transparent',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
          >
            <Clock size={11} />
            일일 ({dailyList.length})
          </button>
          <button
            onClick={() => setActiveTab('weekly')}
            style={{
              flex: 1,
              padding: '4px 6px',
              fontSize: '11px',
              fontWeight: activeTab === 'weekly' ? 700 : 500,
              color: activeTab === 'weekly' ? '#f8fafc' : '#94a3b8',
              backgroundColor: activeTab === 'weekly' ? 'rgba(212, 163, 89, 0.25)' : 'transparent',
              border: activeTab === 'weekly' ? '1px solid rgba(212, 163, 89, 0.4)' : '1px solid transparent',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
          >
            <Calendar size={11} />
            주간 ({weeklyList.length})
          </button>
        </div>
      )}

      {/* 3. 미션 리스트 영역 */}
      <div
        className="no-scrollbar"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
          maxHeight: '420px',
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          paddingRight: '0px',
          pointerEvents: 'auto',
        }}
      >
        {rawTotalMissionCount > 0 && totalPendingCount === 0 && (
          <div
            style={{
              padding: '16px 8px',
              textAlign: 'center',
              color: '#94a3b8',
              fontSize: '11px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <Sparkles size={18} color="#4ade80" />
            <span style={{ color: '#86efac', fontWeight: 600 }}>모든 미션 완료!</span>
            <span style={{ color: '#64748b', fontSize: '9.5px' }}>10초 후 자동으로 숨겨집니다</span>
          </div>
        )}

        {rawTotalMissionCount === 0 && (
          <div
            style={{
              padding: '16px 8px',
              textAlign: 'center',
              color: '#94a3b8',
              fontSize: '11px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Loader2 size={16} color="#eab308" className="animate-spin" />
            <span style={{ color: '#facc15', fontWeight: 600 }}>미션 정보 동기화 중...</span>
          </div>
        )}

        {/* 미션 데이터가 1개 이상 존재할 때만 목록 렌더링 */}
        {rawTotalMissionCount > 0 && (
          isSplitTabMode ? (
            <AnimatePresence initial={false}>
              {(activeTab === 'daily' ? dailyList : weeklyList).map((item) => (
                <MissionRow key={item.key} mission={item} />
              ))}
            </AnimatePresence>
          ) : (
            /* 10개 이하일 때: 일일/주간 통합 표시 */
            <AnimatePresence initial={false}>
              {dailyList.length > 0 && (
                <div key="daily-section" style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {weeklyList.length > 0 && (
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: '#cbd5e1',
                        padding: '2px 4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        opacity: 0.8,
                      }}
                    >
                      <Clock size={10} color="#facc15" />
                      일일
                    </div>
                  )}
                  {dailyList.map((item) => (
                    <MissionRow key={item.key} mission={item} />
                  ))}
                </div>
              )}

              {weeklyList.length > 0 && (
                <div
                  key="weekly-section"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '3px',
                    marginTop: dailyList.length > 0 ? '4px' : '0',
                  }}
                >
                  {dailyList.length > 0 && (
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: '#cbd5e1',
                        padding: '2px 4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        opacity: 0.8,
                        borderTop: '1px dashed rgba(255, 255, 255, 0.08)',
                        paddingTop: '6px',
                      }}
                    >
                      <Calendar size={10} color="#38bdf8" />
                      주간
                    </div>
                  )}
                  {weeklyList.map((item) => (
                    <MissionRow key={item.key} mission={item} />
                  ))}
                </div>
              )}
            </AnimatePresence>
          )
        )}
      </div>
    </div>
  );
});


// 개별 미션 아이템 컴포넌트 (취소선 & 퇴장 애니메이션)
const MissionRow: React.FC<{ mission: DisplayMission }> = React.memo(({ mission }) => {
  const { item, isCompleting } = mission;
  const displayText = simplifyMissionText(item.Description, item.CurrentCount, item.GoalCount);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{
        opacity: isCompleting ? 0.4 : 1,
        y: 0,
        scale: isCompleting ? 0.96 : 1,
      }}
      exit={{
        opacity: 0,
        y: -10,
        scale: 0.9,
        transition: { duration: 0.45, ease: 'easeOut' },
      }}
      transition={{ duration: 0.2 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 6px',
        borderRadius: '5px',
        backgroundColor: isCompleting ? 'rgba(34, 197, 94, 0.12)' : 'rgba(255, 255, 255, 0.03)',
        border: `1px solid ${isCompleting ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.04)'}`,
        fontSize: '11px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 상태 아이콘 */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        {isCompleting ? (
          <CheckCircle2 size={12} color="#4ade80" />
        ) : (
          <Circle size={10} color="#94a3b8" />
        )}
      </div>

      {/* 축약 텍스트 본문 */}
      <div
        style={{
          flex: 1,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          position: 'relative',
          fontWeight: 500,
          color: isCompleting ? '#86efac' : '#f1f5f9',
        }}
      >
        <span
          style={{
            position: 'relative',
            display: 'inline-block',
          }}
        >
          {displayText || item.Title}

          {/* 취소선 가로 드로잉 애니메이션 */}
          {isCompleting && (
            <motion.span
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
              style={{
                position: 'absolute',
                left: 0,
                top: '50%',
                height: '1.5px',
                backgroundColor: '#4ade80',
                display: 'block',
              }}
            />
          )}
        </span>
      </div>
    </motion.div>
  );
});
