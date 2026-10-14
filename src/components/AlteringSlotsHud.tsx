import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Clock,
  Sparkles,
  Loader2,
  Rows2,
  Columns2,
} from 'lucide-react';
import {
  MetalIngotIcon,
  WoodPlankIcon,
  LeatherRollIcon,
  FoldedClothIcon,
  MedicineVialIcon,
  CheeseIcon,
} from './FacilityIcons.js';
import type { AlteringWorksData, FacilityKey, AlteringLayout } from '../types.js';
import { completeAlteringWork } from '../services/api.js';

interface AlteringSlotsHudProps {
  docked?: boolean;
  alteringData: AlteringWorksData | null;
  onRefreshRequested?: () => void | Promise<void>;
  visibleFacilities?: Record<FacilityKey, boolean>;
  layout?: AlteringLayout;
  onToggleLayout?: () => void;
  isLocked?: boolean;
}

export const FACILITY_DEFS = [
  {
    key: 'metal' as FacilityKey,
    name: '금속 가공 시설',
    shortName: '금속',
    icon: MetalIngotIcon,
    color: '#cbd5e1', // 금속: 회색
    matches: (f: string) => f.includes('금속') || f.includes('제련'),
  },
  {
    key: 'wood' as FacilityKey,
    name: '목재 가공 시설',
    shortName: '목재',
    icon: WoodPlankIcon,
    color: '#d97706', // 목재: 브라운
    matches: (f: string) => f.includes('목재') || f.includes('목공'),
  },
  {
    key: 'leather' as FacilityKey,
    name: '가죽 가공 시설',
    shortName: '가죽',
    icon: LeatherRollIcon,
    color: '#92400e', // 가죽: 짙은 브라운
    matches: (f: string) => f.includes('가죽'),
  },
  {
    key: 'cloth' as FacilityKey,
    name: '옷감 가공 시설',
    shortName: '옷감',
    icon: FoldedClothIcon,
    color: '#ffffff', // 옷감: 백색
    matches: (f: string) => f.includes('옷감') || f.includes('직조') || f.includes('방직'),
  },
  {
    key: 'medicine' as FacilityKey,
    name: '약품 가공 시설',
    shortName: '약품',
    icon: MedicineVialIcon,
    color: '#10b981', // 약품: 에메랄드 색
    matches: (f: string) =>
      f.includes('약품') || f.includes('포자') || f.includes('진액') || f.includes('연금'),
  },
  {
    key: 'food' as FacilityKey,
    name: '식재료 가공 시설',
    shortName: '식재료',
    icon: CheeseIcon,
    color: '#fbbf24', // 식재료: 치즈 옐로우
    matches: (f: string) => f.includes('식재료') || f.includes('요리') || f.includes('음식'),
  },
];

// 초 단위를 mm:ss 포맷으로 변환
function formatTime(seconds: number): string {
  if (seconds <= 0) return '완료';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const AlteringSlotsHud: React.FC<AlteringSlotsHudProps> = React.memo(({
  docked = false,
  alteringData,
  onRefreshRequested,
  visibleFacilities = {
    metal: true,
    wood: true,
    leather: true,
    cloth: true,
    medicine: true,
    food: true,
  },
  layout = '2row',
  onToggleLayout,
  isLocked = true,
}) => {
  const [localData, setLocalData] = useState<AlteringWorksData | null>(alteringData);
  const [collectingFacility, setCollectingFacility] = useState<string | null>(null);
  const collectingRef = useRef(false);
  const collectingFacilityRef = useRef<string | null>(null);

  // props alteringData 동기화 (수령 진행 중 1.5초 서버 데이터 폴링으로 인한 화면 깜빡임 방지 및 시간 역행 방지)
  useEffect(() => {
    setLocalData((prev) => {
      if (!alteringData) return alteringData;
      const targetFacility = collectingFacilityRef.current;
      if (collectingRef.current && prev && targetFacility) {
        // 수령 진행 중인 시설 판별
        const def = FACILITY_DEFS.find(
          (d) => d.name === targetFacility || d.matches(targetFacility)
        );
        const isTargetWork = (facilityName: string) =>
          def ? def.matches(facilityName) : facilityName.includes(targetFacility);

        // 방금 수령 중인 시설의 완료 수량 및 작업 상태 유지
        const prevTargetWorks = (prev.works || []).filter((w) => isTargetWork(w.FacilityName));
        const nonTargetWorks = (alteringData.works || []).filter((w) => !isTargetWork(w.FacilityName));

        const mergedWorks = [...nonTargetWorks, ...prevTargetWorks];
        const mergedCompletedCount = mergedWorks.filter(
          (w) => w.IsCompleted || w.State === 'Completed'
        ).length;

        return {
          ...alteringData,
          works: mergedWorks,
          completedCount: mergedCompletedCount,
        };
      }

      // 서버에서 새 데이터를 받았을 때: 진행 중인 작업의 경우 로컬 카운트다운이 더 앞서 있다면(더 작은 초) 로컬 시간 보존(시간 역행 방지)
      const adjustedWorks = (alteringData.works || []).map((newWork) => {
        if (!newWork.IsCompleted && newWork.State === 'InProgress') {
          const oldWork = prev?.works?.find(
            (w) => w.FacilityName === newWork.FacilityName && w.DisplayName === newWork.DisplayName
          );
          if (
            oldWork &&
            !oldWork.IsCompleted &&
            oldWork.State === 'InProgress' &&
            oldWork.RemainingSeconds < newWork.RemainingSeconds &&
            newWork.RemainingSeconds - oldWork.RemainingSeconds <= 3
          ) {
            return { ...newWork, RemainingSeconds: oldWork.RemainingSeconds };
          }
        }
        return newWork;
      });

      return {
        ...alteringData,
        works: adjustedWorks,
      };
    });
  }, [alteringData, collectingFacility]);

  // 로컬 1초 카운트다운 인터벌 (0초 도달 시 즉시 완료 상태 전환)
  useEffect(() => {
    const timer = window.setInterval(() => {
      setLocalData((prev) => {
        if (!prev || !prev.works) return prev;
        const hasInProgress = prev.works.some(
          (w) => !w.IsCompleted && w.State === 'InProgress' && w.RemainingSeconds > 0
        );
        if (!hasInProgress) return prev;

        let newlyCompleted = 0;
        const updatedWorks = prev.works.map((w) => {
          if (!w.IsCompleted && w.State === 'InProgress' && w.RemainingSeconds > 0) {
            const nextSec = w.RemainingSeconds - 1;
            if (nextSec <= 0) {
              newlyCompleted += 1;
              return {
                ...w,
                RemainingSeconds: 0,
                IsCompleted: true,
                State: 'Completed' as const,
              };
            }
            return {
              ...w,
              RemainingSeconds: nextSec,
            };
          }
          return w;
        });

        return {
          ...prev,
          works: updatedWorks,
          completedCount: prev.completedCount + newlyCompleted,
        };
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const works = localData?.works || [];
  const completedTotal = localData?.completedCount || 0;

  // 개별 시설 수령 (낙관적 업데이트 및 실패 시 직전 상태 복원 롤백)
  const handleCollect = async (facilityName: string, sampleWorkName: string) => {
    if (collectingRef.current || collectingFacility) return;
    collectingRef.current = true;
    collectingFacilityRef.current = facilityName;
    const previousData = localData;
    setCollectingFacility(facilityName);

    // 낙관적 업데이트: 수령한 작업을 로컬 목록에서 즉시 제거 및 카운트 감소
    setLocalData((prev) => {
      if (!prev) return prev;
      const def = FACILITY_DEFS.find((d) => d.name === facilityName || d.matches(facilityName));
      let removed = false;
      const nextWorks = prev.works.filter((w) => {
        const isTarget = def ? def.matches(w.FacilityName) : w.FacilityName.includes(facilityName);
        const isDone = w.IsCompleted || w.State === 'Completed';
        if (!removed && isTarget && isDone) {
          if (!sampleWorkName || w.DisplayName === sampleWorkName) {
            removed = true;
            return false;
          }
        }
        return true;
      });

      const finalWorks = removed
        ? nextWorks
        : prev.works.filter((w) => {
            const isTarget = def ? def.matches(w.FacilityName) : w.FacilityName.includes(facilityName);
            const isDone = w.IsCompleted || w.State === 'Completed';
            if (!removed && isTarget && isDone) {
              removed = true;
              return false;
            }
            return true;
          });

      return {
        ...prev,
        works: finalWorks,
        completedCount: Math.max(0, prev.completedCount - (removed ? 1 : 0)),
      };
    });

    try {
      const res = await completeAlteringWork(sampleWorkName || facilityName);
      // 실패 시 직전 상태로 복원 (completeAlteringWork는 throw 대신 success:false 반환)
      if (!res.success) {
        console.error('가공품 수령 실패 롤백:', res.message);
        setLocalData(previousData);
      }
      // 새 데이터 수신 후에 수령 상태를 해제해야 이전 props로 재병합되며 깜빡이지 않음
      await onRefreshRequested?.();
    } finally {
      collectingRef.current = false;
      collectingFacilityRef.current = null;
      setCollectingFacility(null);
    }
  };

  // 활성화된 시설 필터링
  const activeDefs = FACILITY_DEFS.filter((def) => visibleFacilities[def.key] !== false);

  if (activeDefs.length === 0) return null;

  const isOneRow = layout === '1row';

  // 도킹 모드와 슬림 레이아웃은 같은 디자인(타이틀바 알약형 카드)을 사용
  if (docked || layout === 'slim') return <div className="dock-facilities">
    {activeDefs.map(def => {
      const items = works.filter(work => def.matches(work.FacilityName));
      const completed = items.filter(work => work.IsCompleted || work.State === 'Completed');
      const running = items.filter(work => !work.IsCompleted && work.State === 'InProgress');
      const minutesRemaining = running.length
        ? Math.ceil(Math.min(...running.map(work => Math.max(0, work.RemainingSeconds))) / 60)
        : null;
      const Icon = def.icon;
      return <motion.button layout="position" key={def.key} className="dock-facility"
        title={`${def.shortName}: 완료 ${completed.length} · 가공 중 ${running.length} · 전체 ${items.length}${completed.length ? ' / 클릭하여 수령' : ''}`}
        disabled={!completed.length || collectingFacility !== null}
        onDoubleClick={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          void handleCollect(def.name, completed[0]?.DisplayName).catch(() => {});
        }}>
        <Icon size={15} /><span>{def.shortName}</span><span className={`dock-count${minutesRemaining === null && completed.length ? ' dock-count-completed' : ''}`}>{minutesRemaining !== null ? `${minutesRemaining}분` : completed.length ? '완료' : '대기'}</span>
        <span className="dock-slots">{items.map((work, i) => <i key={i} style={{ background: work.IsCompleted || work.State === 'Completed' ? '#fbbf24' : work.State === 'InProgress' ? '#38bdf8' : '#64748b' }} />)}</span>
      </motion.button>;
    })}
  </div>;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: isOneRow ? '4px' : '3px',
        padding: isOneRow ? '2px 4px' : '2px 4px',
        borderRadius: '14px',
        background: 'transparent',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
        border: isLocked ? 'none' : '1px dashed rgba(245, 158, 11, 0.6)',
        boxShadow: 'none',
        maxHeight: '100px',
        boxSizing: 'border-box',
        pointerEvents: 'auto',
        userSelect: 'none',
        transition: 'border 0.2s ease',
      }}
    >
      {/* 초슬림 서브 헤더 (행 전환 & 일괄 상태) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 4px',
          height: '14px',
          fontSize: '10px',
          color: '#cbd5e1',
          textShadow: '0 1px 3px rgba(0, 0, 0, 0.9)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ fontWeight: 700, color: '#e2e8f0' }}>가공기 현황</span>
          {completedTotal > 0 && (
            <span
              style={{
                color: '#f59e0b',
                fontWeight: 800,
                fontSize: '9px',
                background: 'rgba(245, 158, 11, 0.2)',
                padding: '0 4px',
                borderRadius: '4px',
              }}
            >
              수령 가능 {completedTotal}건
            </span>
          )}
        </div>

        {onToggleLayout && (
          <button
            onDoubleClick={(e) => e.stopPropagation()}
            onClick={onToggleLayout}
            title={isOneRow ? '2행 그리드로 전환' : '1행 가로 일렬로 전환'}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '0 2px',
              color: '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              fontSize: '9px',
            }}
          >
            {isOneRow ? <Rows2 size={11} /> : <Columns2 size={11} />}
            <span>{isOneRow ? '2행' : '1행'}</span>
          </button>
        )}
      </div>

      {/* 시설 카드 그리드 (1행 또는 2행, 전체 높이 100px 이내) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isOneRow ? `repeat(${activeDefs.length}, minmax(95px, 1fr))` : 'repeat(3, minmax(115px, 1fr))',
          gridTemplateRows: isOneRow ? '42px' : 'repeat(2, 34px)',
          gap: '5px',
          height: isOneRow ? '42px' : '73px',
        }}
      >
        {activeDefs.map((def) => {
          const fWorks = works.filter((w) => def.matches(w.FacilityName));
          const completedWorks = fWorks.filter((w) => w.IsCompleted || w.State === 'Completed');
          const inProgressWorks = fWorks.filter((w) => !w.IsCompleted && w.State === 'InProgress');
          const hasCompleted = completedWorks.length > 0;
          const isBusy = inProgressWorks.length > 0;

          // 최소 잔여 시간 (진행 중인 작업 중 양수인 최소 시간)
          let minRemaining = 0;
          if (isBusy) {
            const validTimes = inProgressWorks.map((w) => w.RemainingSeconds).filter((s) => s > 0);
            if (validTimes.length > 0) {
              minRemaining = Math.min(...validTimes);
            }
          }

          const isCollectingThis = collectingFacility === def.name;
          const IconComp = def.icon;

          return (
            <div
              key={def.key}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: isOneRow ? '4px 7px 4px 7px' : '3px 6px 3px 6px',
                borderRadius: '8px',
                background: 'rgba(20, 26, 38, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: 'none',
                boxSizing: 'border-box',
                height: isOneRow ? '42px' : '34px',
                transition: 'all 0.2s ease',
              }}
            >
              {/* 진행 중에 일부만 완료된 경우: 오른쪽 상단 모서리에 아주 작게 완료 수량 숫자 배지 표시 */}
              {minRemaining > 0 && hasCompleted && (
                <button
                  onDoubleClick={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCollect(def.name, completedWorks[0].DisplayName);
                  }}
                  disabled={isCollectingThis}
                  title={`${completedWorks.length}개 가공 완료! 클릭하여 즉시 수령`}
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    minWidth: '15px',
                    height: '15px',
                    borderRadius: '8px',
                    background: '#f59e0b',
                    color: '#000000',
                    fontSize: '9px',
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 3px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                    border: '1.5px solid #0f172a',
                    zIndex: 10,
                    cursor: isCollectingThis ? 'wait' : 'pointer',
                  }}
                >
                  {isCollectingThis ? <Loader2 size={8} className="animate-spin" /> : completedWorks.length}
                </button>
              )}

              {/* 상부: 아이콘/이름 및 시간/완료 표시 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  minWidth: 0,
                }}
              >
                {/* 좌측: 아이콘 + 시설 짧은 이름 (색상 구분은 오직 아이콘 색상으로만) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: isOneRow ? '20px' : '18px',
                      height: isOneRow ? '20px' : '18px',
                      borderRadius: '5px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      flexShrink: 0,
                    }}
                  >
                    <IconComp size={isOneRow ? 18 : 16} />
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#f1f5f9',
                      letterSpacing: '-0.3px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {def.shortName}
                  </span>
                </div>

                {/* 우측: 시간(진행 중인 경우 우선) 또는 완료(진행 시간이 0인 경우에만) */}
                <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  {minRemaining > 0 ? (
                    /* 1. 진행 시간이 남아있는 경우: 어두운 무채색 캡슐 + 고대비 화이트 폰트 */
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: '1.5px 6px',
                        borderRadius: '4px',
                        background: 'rgba(51, 65, 85, 0.75)',
                        color: '#ffffff',
                        fontSize: '10px',
                        fontWeight: 700,
                        letterSpacing: '-0.2px',
                        boxShadow: 'none',
                      }}
                      title={`진행 중: ${inProgressWorks.map((w) => `${w.DisplayName} (${w.RemainingSeconds}초)`).join(', ')}`}
                    >
                      <Clock size={9} color="#cbd5e1" />
                      <span>{formatTime(minRemaining)}</span>
                    </div>
                  ) : hasCompleted ? (
                    /* 2. 진행 시간이 0이고 완료된 작업이 있는 경우: 시간 대신 '완료' 표시 */
                    <button
                      onDoubleClick={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCollect(def.name, completedWorks[0].DisplayName);
                      }}
                      disabled={isCollectingThis}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'rgba(245, 158, 11, 0.95)',
                        border: 'none',
                        color: '#000',
                        fontSize: '10px',
                        fontWeight: 800,
                        cursor: isCollectingThis ? 'wait' : 'pointer',
                        boxShadow: 'none',
                      }}
                      title={`${completedWorks.length}개 완료됨 - 클릭하여 수령`}
                    >
                      {isCollectingThis ? (
                        <Loader2 size={9} className="animate-spin" />
                      ) : (
                        <Sparkles size={9} />
                      )}
                      <span>완료 {completedWorks.length}</span>
                    </button>
                  ) : (
                    /* 3. 진행 중도 아니고 완료도 없는 경우: 대기 표시 */
                    <span
                      style={{
                        fontSize: '10px',
                        color: '#64748b',
                        fontWeight: 500,
                        padding: '0 3px',
                      }}
                    >
                      대기
                    </span>
                  )}
                </div>
              </div>

              {/* 하부: 가공기 대기열 슬롯 상태 도식화 작은 칩 (최소 7개 유지, 초과 시 동적 확장) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                  width: '100%',
                  height: isOneRow ? '3.5px' : '3px',
                  marginTop: '2px',
                }}
              >
                {Array.from({ length: Math.max(7, fWorks.length) }).map((_, slotIdx) => {
                  const workItem = fWorks[slotIdx];
                  let chipColor = 'rgba(255, 255, 255, 0.08)';
                  let chipShadow = 'none';
                  let tooltip = `${slotIdx + 1}번 슬롯: 빈 슬롯`;

                  if (workItem) {
                    if (workItem.IsCompleted || workItem.State === 'Completed') {
                      chipColor = '#f59e0b';
                      chipShadow = '0 0 4px rgba(245, 158, 11, 0.7)';
                      tooltip = `${slotIdx + 1}번 슬롯: [완료] ${workItem.DisplayName}`;
                    } else if (workItem.State === 'InProgress') {
                      chipColor = '#38bdf8';
                      chipShadow = '0 0 5px rgba(56, 189, 248, 0.8)';
                      tooltip = `${slotIdx + 1}번 슬롯: [진행 중] ${workItem.DisplayName} (${workItem.RemainingSeconds}초)`;
                    } else {
                      chipColor = 'rgba(148, 163, 184, 0.45)';
                      tooltip = `${slotIdx + 1}번 슬롯: [대기열] ${workItem.DisplayName}`;
                    }
                  }

                  return (
                    <div
                      key={slotIdx}
                      title={tooltip}
                      style={{
                        flex: 1,
                        height: '100%',
                        borderRadius: '1.5px',
                        background: chipColor,
                        boxShadow: chipShadow,
                        transition: 'all 0.2s ease',
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

