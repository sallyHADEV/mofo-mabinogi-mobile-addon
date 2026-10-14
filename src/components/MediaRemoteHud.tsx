import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Volume1, VolumeX } from 'lucide-react';
import defaultAlbumImg from '../assets/default_album.png';
import { DockMarquee } from './DockMarquee.js';
import type { MediaState, MediaPriorityApp } from '../types.js';
import {
  fetchMediaState,
  toggleMediaPlayPause,
  skipMediaNext,
  skipMediaPrevious,
  fetchMasterVolume,
  updateMasterVolume,
} from '../services/api.js';

interface MediaRemoteHudProps {
  docked?: boolean;
  priorityApp?: MediaPriorityApp;
  bgOpacity?: number; // 0 ~ 100
  isLocked?: boolean;
  isForcePassAll?: boolean;
  onDoubleClick?: () => void;
}

export const MediaRemoteHud: React.FC<MediaRemoteHudProps> = React.memo(({
  docked = false,
  priorityApp = 'auto',
  bgOpacity = 0,
  isLocked = true,
  isForcePassAll = false,
  onDoubleClick,
}) => {
  const [media, setMedia] = useState<MediaState | null>(null);
  const [isLoadingAction, setIsLoadingAction] = useState(false);
  const actionPending = useRef(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [volume, setVolume] = useState<number>(50);
  const [prevVolume, setPrevVolume] = useState<number>(50);

  // 미디어 활성 여부 (곡명이 있거나 재생 중)
  const hasMedia = Boolean(media?.is_available && (media?.title?.trim() || media?.is_playing));

  // 접힘(Collapsed) 상태: 미디어가 없으면 아트워크만 노출되도록 접힘 (초기값: true)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volumeDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 미디어 상태 주기적 조회 (1초 주기)
  useEffect(() => {
    let isMounted = true;

    const poll = async () => {
      const state = await fetchMediaState(priorityApp);
      if (isMounted && state) {
        setMedia(state);
      }
    };

    poll();
    const interval = setInterval(poll, 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [priorityApp]);

  // 미디어 유무, 드래그 모드(!isLocked), 호버 상태에 따른 접힘/펼침 제어 (다음 곡 전환 로딩 시 3초 대기 딜레이)
  useEffect(() => {
    if (!isLocked) {
      // 드래그 이동 모드일 때는 항상 리모컨을 펼치고 대기 타이머 제거
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
        collapseTimerRef.current = null;
      }
      setIsCollapsed(false);
      return;
    }

    if (hasMedia) {
      // 미디어가 감지되면 즉시 펼침 & 대기 중이던 접힘 타이머 취소
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
        collapseTimerRef.current = null;
      }
      setIsCollapsed(false);
    } else if (isHovered) {
      // 마우스가 올려져 있는 동안에는 트랙이 끊겨도 3초 후 강제로 48px로 접히지 않도록 타이머 취소
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
        collapseTimerRef.current = null;
      }
    } else {
      // 미디어가 없어지더라도 즉시 접지 않고 3초간 대기 (다음곡 로딩/버퍼링 유예 시간)
      if (!isCollapsed && !collapseTimerRef.current) {
        collapseTimerRef.current = setTimeout(() => {
          setIsCollapsed(true);
          collapseTimerRef.current = null;
        }, 3000);
      }
    }
  }, [hasMedia, isCollapsed, isLocked, isHovered]);

  // 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
      }
      if (volumeDebounceTimerRef.current) {
        clearTimeout(volumeDebounceTimerRef.current);
      }
      if (actionErrorTimerRef.current) {
        clearTimeout(actionErrorTimerRef.current);
      }
    };
  }, []);

  // 에러 메시지 4초 자동 클리어
  const showActionError = (msg: string | null) => {
    if (actionErrorTimerRef.current) {
      clearTimeout(actionErrorTimerRef.current);
      actionErrorTimerRef.current = null;
    }
    setActionError(msg);
    if (msg) {
      actionErrorTimerRef.current = setTimeout(() => {
        setActionError(null);
        actionErrorTimerRef.current = null;
      }, 4000);
    }
  };

  // 마운트 시 초기 마스터 볼륨 동기화
  useEffect(() => {
    fetchMasterVolume().then((vol) => {
      if (vol !== null) {
        setVolume(vol);
        if (vol > 0) setPrevVolume(vol);
      }
    });
  }, []);

  // 마우스 호버 시 최신 시스템 볼륨 재동기화
  const handleMouseEnter = async () => {
    setIsHovered(true);
    const vol = await fetchMasterVolume();
    if (vol !== null) {
      setVolume(vol);
      if (vol > 0) setPrevVolume(vol);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const runMediaAction = async (e: React.MouseEvent, action: (app?: string) => Promise<boolean>) => {
    e.stopPropagation();
    e.preventDefault();
    if (actionPending.current) return;
    actionPending.current = true;
    setIsLoadingAction(true);
    showActionError(null);
    try {
      const accepted = await action(priorityApp);
      if (!accepted) showActionError('미디어 제어 실패 · 플레이어 상태를 확인해 주세요');
      const state = await fetchMediaState(priorityApp);
      if (state) setMedia(state);
    } catch {
      showActionError('미디어 제어 실패 · 다시 시도해 주세요');
    } finally {
      actionPending.current = false;
      setIsLoadingAction(false);
    }
  };

  const handleTogglePlay = (e: React.MouseEvent) => runMediaAction(e, toggleMediaPlayPause);
  const handleSkipNext = (e: React.MouseEvent) => runMediaAction(e, skipMediaNext);
  const handleSkipPrev = (e: React.MouseEvent) => runMediaAction(e, skipMediaPrevious);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const newVol = Number(e.target.value);
    setVolume(newVol);
    if (newVol > 0) setPrevVolume(newVol);

    // updateMasterVolume 백엔드 IPC 호출 60ms 디바운스 처리 (IPC 큐 지연 방지)
    if (volumeDebounceTimerRef.current) {
      clearTimeout(volumeDebounceTimerRef.current);
    }
    volumeDebounceTimerRef.current = setTimeout(() => {
      void updateMasterVolume(newVol);
      volumeDebounceTimerRef.current = null;
    }, 60);
  };

  const handleToggleMute = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (volumeDebounceTimerRef.current) {
      clearTimeout(volumeDebounceTimerRef.current);
      volumeDebounceTimerRef.current = null;
    }
    if (volume > 0) {
      setPrevVolume(volume);
      setVolume(0);
      await updateMasterVolume(0);
    } else {
      const restore = prevVolume > 0 ? prevVolume : 40;
      setVolume(restore);
      await updateMasterVolume(restore);
    }
  };

  // 불투명도 계산 (0 ~ 100% -> 0.0 ~ 1.0)
  const alpha = Math.max(0, Math.min(100, bgOpacity)) / 100;
  const isTransparent = alpha === 0;

  const title = media?.title || '';
  const artist = media?.artist || '';
  const isPlaying = media?.is_playing ?? false;
  const artworkSrc = media?.thumbnail_base64 || defaultAlbumImg;

  // 볼륨 아이콘 결정
  const VolumeIcon = volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;

  // 드래그 위치 이동 모드(!isLocked)일 때는 미디어 재생 유무와 무관하게 항상 펼침 상태 유지
  const effectiveCollapsed = isLocked ? isCollapsed : false;

  // 접혔을 때의 치수: 48px x 48px 정사각형 앨범아트 모드
  // 펼쳐졌을 때의 치수: 260px x (호버 시 67px, 평상시 48px)
  const cardWidth = effectiveCollapsed ? 48 : 260;
  const cardHeight = effectiveCollapsed ? 48 : isHovered ? 67 : 48;

  if (docked) return (
    <div className="dock-media" onDoubleClick={onDoubleClick}>
      <DockMarquee text={actionError || (title ? `${title}${artist ? ` - ${artist}` : ''}` : '재생 정보 없음')} />
      <div id="media-playback-controls" className="dock-media-controls" onDoubleClick={e => e.stopPropagation()} onMouseDown={e => { e.stopPropagation(); e.preventDefault(); }}>
        <button aria-label="이전곡" title="이전곡" disabled={isLoadingAction || !media?.can_skip_prev} onClick={handleSkipPrev}><SkipBack size={12} /></button>
        <button aria-label={isPlaying ? '일시정지' : '재생'} title={isPlaying ? '일시정지' : '재생'} disabled={isLoadingAction || !media?.can_play_pause} onClick={handleTogglePlay}>{isPlaying ? <Pause size={12} /> : <Play size={12} />}</button>
        <button aria-label="다음곡" title="다음곡" disabled={isLoadingAction || !media?.can_skip_next} onClick={handleSkipNext}><SkipForward size={12} /></button>
      </div>
    </div>
  );

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: effectiveCollapsed ? '4px 4px 4px 4px' : '5px 8px 5px 6px',
        borderRadius: effectiveCollapsed ? '10px' : '11px',
        background: isTransparent
          ? isHovered
            ? 'rgba(15, 23, 42, 0.45)'
            : 'transparent'
          : `rgba(15, 23, 42, ${alpha})`,
        backdropFilter: isTransparent && !isHovered ? 'none' : 'blur(8px)',
        WebkitBackdropFilter: isTransparent && !isHovered ? 'none' : 'blur(8px)',
        border: isLocked
          ? isTransparent && !isHovered
            ? 'none'
            : `1px solid rgba(255, 255, 255, ${Math.max(0.1, alpha * 0.25)})`
          : '1px dashed rgba(56, 189, 248, 0.6)',
        boxShadow: isTransparent && !isHovered
          ? 'none'
          : `0 4px 16px rgba(0, 0, 0, ${Math.max(0.3, alpha * 0.6)})`,
        width: `${cardWidth}px`,
        height: `${cardHeight}px`,
        boxSizing: 'border-box',
        pointerEvents: isForcePassAll ? 'none' : 'auto',
        userSelect: 'none',
        overflow: 'hidden',
        transition:
          'width 0.32s cubic-bezier(0.4, 0, 0.2, 1), height 0.22s cubic-bezier(0.4, 0, 0.2, 1), padding 0.25s ease, background 0.2s ease, border 0.2s ease, box-shadow 0.2s ease',
      }}
      onDoubleClick={() => onDoubleClick?.()}
      title="더블클릭 시 5초간 임시 숨김"
    >
      {/* 1단: 메인 행 (앨범아트 + 펼침 영역) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: effectiveCollapsed ? '0px' : '9px',
          width: '100%',
          height: '38px',
          transition: 'gap 0.25s ease',
        }}
      >
        {/* 앨범 아트워크 (항상 노출, 38x38px 고정) */}
        <div
          id={effectiveCollapsed ? 'media-playback-collapsed' : undefined}
          onClick={effectiveCollapsed ? handleTogglePlay : undefined}
          title={effectiveCollapsed ? (isPlaying ? '일시정지' : '미디어 재생') : undefined}
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '7px',
            overflow: 'hidden',
            flexShrink: 0,
            background: '#0a0d14',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            cursor: effectiveCollapsed ? 'pointer' : 'default',
            pointerEvents: 'auto',
            transition: 'transform 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (effectiveCollapsed) e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            if (effectiveCollapsed) e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <img
            src={artworkSrc}
            alt="Album Art"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              userSelect: 'none',
            }}
            draggable={false}
            onError={(e) => {
              (e.target as HTMLImageElement).src = defaultAlbumImg;
            }}
          />
          {isPlaying && (
            <div
              style={{
                position: 'absolute',
                bottom: '2px',
                right: '2px',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 5px #10b981',
              }}
            />
          )}
        </div>

        {/* 펼침 영역: 곡 정보 & 컨트롤 버튼 (접혔을 때는 부드럽게 페이드아웃 및 숨김) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flex: 1,
            minWidth: 0,
            opacity: effectiveCollapsed ? 0 : 1,
            transform: effectiveCollapsed ? 'translateX(-12px)' : 'translateX(0)',
            transition: 'opacity 0.2s ease, transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            pointerEvents: effectiveCollapsed ? 'none' : 'auto',
          }}
        >
          {/* 중앙: 곡명 & 아티스트 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              flex: 1,
              minWidth: 0,
              gap: '1px',
              marginRight: '6px',
            }}
          >
            <div
              title={title}
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#f8fafc',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                letterSpacing: '-0.3px',
                textShadow: isTransparent ? '0 1px 3px rgba(0, 0, 0, 0.95), 0 0 6px rgba(0, 0, 0, 0.8)' : 'none',
              }}
            >
              {title || '재생 정보 없음'}
            </div>
            <div
              title={artist}
              style={{
                fontSize: '9.5px',
                fontWeight: 500,
                color: '#94a3b8',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                letterSpacing: '-0.2px',
                textShadow: isTransparent ? '0 1px 3px rgba(0, 0, 0, 0.95)' : 'none',
              }}
            >
              {artist || '대기 중'}
            </div>
          </div>

          {/* 우측: [이전] [재생/일시정지] [다음] 컨트롤 버튼 */}
          <div
            // 접힘 상태에서는 투명한 채로 카드 밖에 걸쳐 있으므로 관통 예외 영역에 등록되지 않게 id 제거
            id={effectiveCollapsed ? undefined : 'media-playback-controls'}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              flexShrink: 0,
              pointerEvents: 'auto',
              position: 'relative',
              zIndex: 100,
            }}
          >
            {/* 이전곡 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleSkipPrev(e);
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              title="이전곡"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                borderRadius: '5px',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#cbd5e1',
                cursor: 'pointer',
                padding: 0,
                transition: 'all 0.15s ease',
                pointerEvents: 'auto',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.color = '#cbd5e1';
              }}
            >
              <SkipBack size={12} fill="currentColor" style={{ pointerEvents: 'none' }} />
            </button>

            {/* 재생 / 일시정지 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleTogglePlay(e);
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              title={isPlaying ? '일시정지' : '재생'}
              style={{
                background: isPlaying ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.12)',
                border: isPlaying ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '6px',
                width: '26px',
                height: '26px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isPlaying ? '#38bdf8' : '#ffffff',
                cursor: 'pointer',
                padding: 0,
                transition: 'all 0.15s ease',
                pointerEvents: 'auto',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {isPlaying ? (
                <Pause size={13} fill="currentColor" style={{ pointerEvents: 'none' }} />
              ) : (
                <Play size={13} fill="currentColor" style={{ marginLeft: '1px', pointerEvents: 'none' }} />
              )}
            </button>

            {/* 다음곡 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleSkipNext(e);
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              title="다음곡"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                borderRadius: '5px',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#cbd5e1',
                cursor: 'pointer',
                padding: 0,
                transition: 'all 0.15s ease',
                pointerEvents: 'auto',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.color = '#cbd5e1';
              }}
            >
              <SkipForward size={12} fill="currentColor" style={{ pointerEvents: 'none' }} />
            </button>
          </div>
        </div>
      </div>

      {/* 2단: 호버 시 나타나는 볼륨 조절 게이지 바 (펼쳐진 상태에서만 렌더링) */}
      {!effectiveCollapsed && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            width: '100%',
            height: isHovered ? '16px' : '0px',
            opacity: isHovered ? 1 : 0,
            transform: isHovered ? 'translateY(0)' : 'translateY(-4px)',
            transition: 'opacity 0.2s ease, transform 0.2s ease, height 0.2s ease',
            padding: '0 2px',
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}
        >
          {/* 음소거 / 스피커 토글 버튼 */}
          <button
            onClick={handleToggleMute}
            onMouseDown={(e) => e.stopPropagation()}
            title={volume === 0 ? '음소거 해제' : '음소거'}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: volume === 0 ? '#ef4444' : '#38bdf8',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <VolumeIcon size={12} />
          </button>

          {/* 볼륨 슬라이더 게이지 */}
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={volume}
            onChange={handleVolumeChange}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              flex: 1,
              height: '4px',
              accentColor: '#38bdf8',
              cursor: 'pointer',
              borderRadius: '2px',
              outline: 'none',
            }}
          />

          {/* 볼륨 숫자 퍼센트 */}
          <span
            style={{
              fontSize: '9.5px',
              fontWeight: 700,
              color: volume === 0 ? '#ef4444' : '#e2e8f0',
              minWidth: '24px',
              textAlign: 'right',
              letterSpacing: '-0.2px',
              fontVariantNumeric: 'tabular-nums',
              textShadow: isTransparent ? '0 1px 3px rgba(0,0,0,0.9)' : 'none',
            }}
          >
            {volume}%
          </span>
        </div>
      )}
    </div>
  );
});

