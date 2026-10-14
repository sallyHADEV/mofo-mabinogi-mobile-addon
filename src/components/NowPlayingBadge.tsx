import React from 'react';
import { Disc } from 'lucide-react';
import type { EnsembleMember } from '../types.js';

interface NowPlayingBadgeProps {
  currentTitle: string | null;
  members: EnsembleMember[];
  buffering?: { count: number; delaySeconds: number } | null; // 합주 조율 중이면 제목 대신 표시
  onClick?: () => void;
  isIconOnly?: boolean;
}

export const NowPlayingBadge: React.FC<NowPlayingBadgeProps> = React.memo(({
  currentTitle,
  members,
  buffering = null,
  onClick,
  isIconOnly = false,
}) => {
  if (!currentTitle && !buffering) return null;

  const tooltipText = `${currentTitle || '합주 조율 중'} (${members.length > 1 ? `${members.length}인 합주` : members[0]?.name || '연주 중'}) - 클릭 시 설정`;

  return (
    <div
      onClick={onClick}
      title={tooltipText}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: isIconOnly ? 'center' : 'flex-start',
        gap: isIconOnly ? '0px' : '8px',
        padding: isIconOnly ? '0' : '6px 14px',
        width: isIconOnly ? '28px' : 'auto',
        height: '28px',
        borderRadius: isIconOnly ? '50%' : '20px',
        background: 'rgba(15, 23, 42, 0.78)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(245, 158, 11, 0.4)',
        boxShadow: '0 4px 18px rgba(0, 0, 0, 0.45)',
        color: '#ffffff',
        fontSize: '12px',
        fontWeight: 600,
        pointerEvents: 'auto',
        cursor: 'pointer',
        boxSizing: 'border-box',
        flexShrink: 0,
      }}
    >
      <Disc size={15} color="#f59e0b" className="animate-spin" />
      {!isIconOnly && buffering && (
        <span style={{ color: '#fef08a', fontWeight: 700, whiteSpace: 'nowrap' }}>
          합주 조율 중... ({buffering.count}명 연주 감지 • {buffering.delaySeconds}초 대기)
        </span>
      )}
      {!isIconOnly && !buffering && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#fef08a', fontWeight: 700, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentTitle}
          </span>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
            ({members.length > 1 ? `${members.length}인 합주` : members[0]?.name || '연주 중'})
          </span>
        </div>
      )}
    </div>
  );
});

