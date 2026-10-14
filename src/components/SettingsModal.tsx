import React, { useEffect, useRef } from 'react';
import {
  X,
  Sliders,
  Clock,
  Layers,
  Sparkles,
  RotateCcw,
  Palette,
  Rows2,
  Columns2,
  LayoutGrid,
  Scaling,
  Headphones,
  Target,
  Bookmark,
  AppWindow,
  Power,
  Minus,
  Music2,
} from 'lucide-react';
import {
  MetalIngotIcon,
  WoodPlankIcon,
  LeatherRollIcon,
  FoldedClothIcon,
  MedicineVialIcon,
  CheeseIcon,
} from './FacilityIcons.js';
import { DEFAULT_SONG_CHAT_TEMPLATE, CHAT_MAX_LENGTH } from '../utils/songMatch.js';
import type { OverlaySettings, AlteringLayout, FacilityKey, ConcertMotionTheme, ConcertBgStyle, UiScale, MediaPriorityApp, PresetId } from '../types.js';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: OverlaySettings;
  onUpdateSettings: (newSettings: Partial<OverlaySettings>) => void;
  onTriggerTestConcert: () => void;
  onResetPositions?: () => void;
  activePreset: PresetId;
  onSelectPreset: (id: PresetId) => void;
}

const MOTION_THEMES: { id: ConcertMotionTheme; label: string; desc: string; color: string }[] = [
  { id: 'cinematic', label: '시네마틱 골드', desc: '세리프 명조 & 황금빛 오라', color: '#f59e0b' },
  { id: 'vineBloom', label: '가시덩굴 개화', desc: '자연의 줄기 & 꽃잎 흩날림', color: '#10b981' },
  { id: 'arcaneRune', label: '아케인 룬 마법', desc: '신비로운 룬 문자 & 보랏빛 마법진', color: '#8b5cf6' },
  { id: 'auroraPrism', label: '오로라 프리즘', desc: '밤하늘 오로라 & 스파클', color: '#06b6d4' },
  { id: 'ornamentUnfold', label: '빈티지 오너먼트', desc: '배경 없이 장식선이 좌우로 펼쳐짐', color: '#e8d7a8' },
  { id: 'branchGrow', label: '자라나는 가지', desc: '배경 없이 줄기와 잎이 자라남', color: '#a3d9a5' },
  { id: 'pearlBlossom', label: '진주꽃 개화', desc: '진주빛 꽃 장식이 피어나고 별빛이 반짝임', color: '#c9d8fb' },
];

const FACILITY_LIST: { key: FacilityKey; label: string; icon: React.FC<{ size?: number }>; color: string }[] = [
  { key: 'metal', label: '금속', icon: MetalIngotIcon, color: '#94a3b8' },
  { key: 'wood', label: '목재', icon: WoodPlankIcon, color: '#d97706' },
  { key: 'leather', label: '가죽', icon: LeatherRollIcon, color: '#ea580c' },
  { key: 'cloth', label: '옷감', icon: FoldedClothIcon, color: '#f8fafc' },
  { key: 'medicine', label: '약품', icon: MedicineVialIcon, color: '#38bdf8' },
  { key: 'food', label: '식재료', icon: CheeseIcon, color: '#facc15' },
];

export const SettingsModal: React.FC<SettingsModalProps> = React.memo(({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onTriggerTestConcert,
  onResetPositions,
  activePreset,
  onSelectPreset,
}) => {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // ESC 키로 모달 닫기 (최신 onCloseRef를 참조하여 1.5초 주기 리렌더링마다 리스너 재등록 방지)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const currentFacilities = settings.visibleFacilities || {
    metal: true,
    wood: true,
    leather: true,
    cloth: true,
    medicine: true,
    food: true,
  };

  const handleToggleFacility = (key: FacilityKey) => {
    const next = { ...currentFacilities, [key]: !currentFacilities[key] };
    onUpdateSettings({ visibleFacilities: next });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(6px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '95%',
          maxWidth: '860px',
          maxHeight: '92vh',
          background: 'rgba(15, 23, 42, 0.97)',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          borderRadius: '20px',
          padding: '20px 24px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.85), 0 0 30px rgba(245, 158, 11, 0.2)',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          overflowY: 'auto',
        }}
        className="no-scrollbar"
      >
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={20} color="#f59e0b" />
            <span style={{ fontSize: '17px', fontWeight: 800, letterSpacing: '-0.01em' }}>MoFo 오버레이 설정</span>
            <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '6px' }}>게임 화면 위젯 및 레이아웃 옵션</span>
          </div>
          <button
            onClick={onClose}
            title="설정창 닫기 (ESC)"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#cbd5e1',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <X size={17} />
          </button>
        </div>

        {/* 2열 메인 그리드 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '14px',
            alignItems: 'start',
          }}
        >
          {/* ===================== 좌측 컬럼 (Col 1) ===================== */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* 1-0. 오버레이 프리셋 (위치 & 설정 3단 실시간 자동 동기화) */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                background: 'rgba(30, 41, 59, 0.4)',
                padding: '12px',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 700, color: '#38bdf8' }}>
                  <Bookmark size={15} />
                  <span>레이아웃 & 설정 프리셋</span>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#7dd3fc', background: 'rgba(56, 189, 248, 0.15)', padding: '2px 8px', borderRadius: '6px' }}>
                  프리셋 {activePreset} 사용 중
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                {([1, 2, 3] as PresetId[]).map((pid) => {
                  const isSelected = activePreset === pid;
                  return (
                    <button
                      key={pid}
                      onClick={() => onSelectPreset(pid)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '8px 4px',
                        borderRadius: '8px',
                        background: isSelected ? 'rgba(56, 189, 248, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                        border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                        color: isSelected ? '#38bdf8' : '#cbd5e1',
                        fontSize: '11.5px',
                        fontWeight: isSelected ? 800 : 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span>프리셋 {pid}</span>
                      <span style={{ fontSize: '8.5px', color: isSelected ? '#7dd3fc' : '#64748b', marginTop: '2px' }}>
                        {isSelected ? '실시간 자동저장' : '클릭하여 전환'}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8', lineHeight: 1.3 }}>
                ※ 위젯 배치 및 설정을 변경하면 현재 선택된 프리셋에 실시간으로 자동 저장됩니다.
              </div>
            </div>

            {/* 1-1. 전체 UI 크기 배율 */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                background: 'rgba(30, 41, 59, 0.4)',
                padding: '12px',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 700, color: '#38bdf8' }}>
                  <Scaling size={15} />
                  <span>전체 UI 크기 배율</span>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#38bdf8' }}>
                  {settings.uiScale || 100}%
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {([75, 100, 150, 200] as UiScale[]).map((scale) => {
                  const isSelected = (settings.uiScale || 100) === scale;
                  return (
                    <button
                      key={scale}
                      onClick={() => onUpdateSettings({ uiScale: scale })}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '6px 4px',
                        borderRadius: '8px',
                        background: isSelected ? 'rgba(56, 189, 248, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                        border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                        color: isSelected ? '#38bdf8' : '#cbd5e1',
                        fontSize: '11px',
                        fontWeight: isSelected ? 800 : 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span>{scale}%</span>
                      <span style={{ fontSize: '8.5px', color: isSelected ? '#7dd3fc' : '#64748b', marginTop: '1px' }}>
                        {scale === 75 ? '작게' : scale === 100 ? '기본' : scale === 150 ? '크게' : '매우 크게'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 1-2. 음악 제목 모션 디자인 & 배경 스타일 */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                background: 'rgba(30, 41, 59, 0.4)',
                padding: '12px',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 700, color: '#fde047' }}>
                <Palette size={15} />
                <span>음악회 방송 모션 및 배경 스타일</span>
              </div>

              {/* 모션 테마 선택 (4종) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                {MOTION_THEMES.map((theme) => {
                  const isSelected = (settings.concertMotionTheme || 'cinematic') === theme.id;
                  return (
                    <button
                      key={theme.id}
                      onClick={() => onUpdateSettings({ concertMotionTheme: theme.id })}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        padding: '6px 8px',
                        borderRadius: '8px',
                        background: isSelected ? `${theme.color}26` : 'rgba(15, 23, 42, 0.6)',
                        border: isSelected ? `1px solid ${theme.color}` : '1px solid rgba(255, 255, 255, 0.08)',
                        color: isSelected ? '#ffffff' : '#cbd5e1',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span style={{ fontSize: '11px', fontWeight: 700, color: isSelected ? theme.color : '#e2e8f0' }}>
                        {theme.label}
                      </span>
                      <span style={{ fontSize: '9px', color: '#94a3b8', marginTop: '1px', lineHeight: 1.2 }}>
                        {theme.desc}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* 배경 스타일 선택 (반투명 vs 불투명) */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px', paddingTop: '6px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <span style={{ fontSize: '11px', color: '#e2e8f0', fontWeight: 600 }}>방송 배경 스타일</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {(['translucent', 'opaque'] as ConcertBgStyle[]).map((style) => {
                    const isSelected = (settings.concertBgStyle || 'translucent') === style;
                    return (
                      <button
                        key={style}
                        onClick={() => onUpdateSettings({ concertBgStyle: style })}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: isSelected ? 'rgba(56, 189, 248, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                          border: isSelected ? '1px solid rgba(56, 189, 248, 0.7)' : '1px solid rgba(255, 255, 255, 0.08)',
                          color: isSelected ? '#38bdf8' : '#94a3b8',
                          fontSize: '10.5px',
                          fontWeight: isSelected ? 700 : 500,
                          cursor: 'pointer',
                        }}
                      >
                        {style === 'translucent' ? '반투명 글래스' : '불투명 솔리드'}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 1-3. 합주 대기 딜레이 & 방송 시간 */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                background: 'rgba(30, 41, 59, 0.4)',
                padding: '12px',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' }}>
                  <span style={{ color: '#e2e8f0', fontWeight: 600 }}>합주 집계 대기 딜레이</span>
                  <span style={{ color: '#f59e0b', fontWeight: 700 }}>{settings.ensembleDelaySeconds}초</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={15}
                  step={1}
                  value={settings.ensembleDelaySeconds}
                  onChange={(e) => onUpdateSettings({ ensembleDelaySeconds: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: '#f59e0b', cursor: 'pointer' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' }}>
                  <span style={{ color: '#e2e8f0', fontWeight: 600 }}>방송 자막 유지 시간</span>
                  <span style={{ color: '#38bdf8', fontWeight: 700 }}>{settings.noticeDisplaySeconds}초</span>
                </div>
                <input
                  type="range"
                  min={3}
                  max={20}
                  step={1}
                  value={settings.noticeDisplaySeconds}
                  onChange={(e) => onUpdateSettings({ noticeDisplaySeconds: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                />
              </div>
            </div>

            {/* 1-4. 하단 버튼 영역 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: 'auto' }}>
              {onResetPositions && (
                <button
                  onClick={onResetPositions}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px',
                    borderRadius: '10px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#fca5a5',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <RotateCcw size={13} color="#f87171" />
                  <span>모든 창 위치 기본값으로 초기화</span>
                </button>
              )}

              <button
                onClick={onTriggerTestConcert}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px',
                  borderRadius: '10px',
                  background: 'rgba(245, 158, 11, 0.2)',
                  border: '1px solid rgba(245, 158, 11, 0.5)',
                  color: '#fef08a',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Sparkles size={13} color="#f59e0b" />
                <span>선택한 모션 디자인 테스트 실행</span>
              </button>

              <button
                onClick={onClose}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '10px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  border: 'none',
                  color: '#000000',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)',
                  marginTop: '2px',
                }}
              >
                <span>설정 완료 및 닫기 (ESC)</span>
              </button>
            </div>
          </div>

          {/* ===================== 우측 컬럼 (Col 2) ===================== */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* 2-1. 위젯 표시 토글 모음 */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '7px',
                background: 'rgba(30, 41, 59, 0.4)',
                padding: '12px',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#e2e8f0', marginBottom: '2px' }}>
                위젯 표시 / 숨김
              </div>

              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', cursor: 'pointer' }}>
                <span>제목표시줄 도킹 모드</span>
                <input type="checkbox" checked={settings.titlebarDocked ?? false}
                  onChange={e => onUpdateSettings({ titlebarDocked: e.target.checked })}
                  style={{ accentColor: '#38bdf8', width: 14, height: 14 }} />
              </label>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>가공기 · 미디어 · 아이콘 툴바를 제목표시줄에 배치합니다.</div>

              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <Clock size={13} color="#f59e0b" />
                  <span>에린 시간 배지</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.showClock}
                  onChange={(e) => onUpdateSettings({ showClock: e.target.checked })}
                  style={{ accentColor: '#f59e0b', width: '14px', height: '14px', cursor: 'pointer' }}
                />
              </label>
              {settings.showClock && (
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px', cursor: 'pointer', paddingLeft: '20px', color: '#cbd5e1' }}>
                  <span>└ 슬림 모드 (도킹 버튼 높이)</span>
                  <input
                    type="checkbox"
                    checked={settings.clockSlim ?? false}
                    onChange={(e) => onUpdateSettings({ clockSlim: e.target.checked })}
                    style={{ accentColor: '#f59e0b', width: '12px', height: '12px', cursor: 'pointer' }}
                  />
                </label>
              )}

              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <Layers size={13} color="#38bdf8" />
                  <span>가공기 슬롯 현황</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.showAltering}
                  onChange={(e) => onUpdateSettings({ showAltering: e.target.checked })}
                  style={{ accentColor: '#38bdf8', width: '14px', height: '14px', cursor: 'pointer' }}
                />
              </label>

              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <Sparkles size={13} color="#fde047" />
                  <span>음악회 방송 타이포 모션</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.showConcert}
                  onChange={(e) => onUpdateSettings({ showConcert: e.target.checked })}
                  style={{ accentColor: '#fde047', width: '14px', height: '14px', cursor: 'pointer' }}
                />
              </label>

              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <Target size={13} color="#facc15" />
                  <span>남은 미션 패널 (일일/주간)</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.showMissions ?? true}
                  onChange={(e) => onUpdateSettings({ showMissions: e.target.checked })}
                  style={{ accentColor: '#facc15', width: '14px', height: '14px', cursor: 'pointer' }}
                />
              </label>

              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <Music2 size={13} color="#a78bfa" />
                  <span>원곡 찾기 (내 연주 → 채팅)</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.showSongFinder ?? false}
                  onChange={(e) => onUpdateSettings({ showSongFinder: e.target.checked })}
                  style={{ accentColor: '#a78bfa', width: '14px', height: '14px', cursor: 'pointer' }}
                />
              </label>
              {settings.showSongFinder && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#cbd5e1' }}>
                    <span>채팅 템플릿</span>
                    <span style={{ color: '#94a3b8', fontSize: '9.5px' }}>{'{artist} {title} {game}'} · 최대 {CHAT_MAX_LENGTH}자</span>
                  </div>
                  <input
                    type="text"
                    value={settings.songChatTemplate ?? DEFAULT_SONG_CHAT_TEMPLATE}
                    onChange={(e) => onUpdateSettings({ songChatTemplate: e.target.value })}
                    placeholder={DEFAULT_SONG_CHAT_TEMPLATE}
                    style={{
                      width: '100%',
                      padding: '4px 7px',
                      borderRadius: '6px',
                      border: '1px solid rgba(167, 139, 250, 0.4)',
                      background: 'rgba(15, 23, 42, 0.7)',
                      color: '#f1f5f9',
                      fontSize: '11px',
                      outline: 'none',
                      userSelect: 'text',
                    }}
                  />
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px', cursor: 'pointer', color: '#cbd5e1' }}>
                    <span>곡이 바뀌면 자동 채팅 (확실한 원곡, 아니면 악보 제목)</span>
                    <input
                      type="checkbox"
                      checked={settings.songAutoChat ?? false}
                      onChange={(e) => onUpdateSettings({ songAutoChat: e.target.checked })}
                      style={{ accentColor: '#a78bfa', width: '12px', height: '12px', cursor: 'pointer' }}
                    />
                  </label>
                </div>
              )}

              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <LayoutGrid size={13} color="#34d399" />
                  <span>메인 툴바 아이콘 전용 모드</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.toolbarIconOnly ?? false}
                  onChange={(e) => onUpdateSettings({ toolbarIconOnly: e.target.checked })}
                  style={{ accentColor: '#34d399', width: '14px', height: '14px', cursor: 'pointer' }}
                />
              </label>

              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <AppWindow size={13} color="#38bdf8" />
                  <span>작업표시줄에 표시</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.showInTaskbar ?? false}
                  onChange={(e) => onUpdateSettings({ showInTaskbar: e.target.checked })}
                  style={{ accentColor: '#38bdf8', width: '14px', height: '14px', cursor: 'pointer' }}
                />
              </label>
            </div>

            {/* 2-2. 남은 미션 카드 투명도 설정 */}
            {(settings.showMissions ?? true) && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  background: 'rgba(30, 41, 59, 0.4)',
                  padding: '12px',
                  borderRadius: '14px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 700, color: '#facc15' }}>
                    <Target size={14} />
                    <span>남은 미션 배경 투명도</span>
                  </div>
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#facc15' }}>
                    {(settings.missionsBgOpacity ?? 82) === 0 ? '0% (완전 투명)' : `${settings.missionsBgOpacity ?? 82}%`}
                  </span>
                </div>

                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={settings.missionsBgOpacity ?? 82}
                  onChange={(e) => onUpdateSettings({ missionsBgOpacity: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: '#facc15', cursor: 'pointer' }}
                />

                {/* 퀵 프리셋 버튼 (완전 투명 / 기본 반투명) */}
                <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                  <button
                    onClick={() => onUpdateSettings({ missionsBgOpacity: 0 })}
                    style={{
                      flex: 1,
                      padding: '4px',
                      borderRadius: '6px',
                      background: (settings.missionsBgOpacity ?? 82) === 0 ? 'rgba(234, 179, 8, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                      border: (settings.missionsBgOpacity ?? 82) === 0 ? '1px solid #facc15' : '1px solid rgba(255, 255, 255, 0.08)',
                      color: (settings.missionsBgOpacity ?? 82) === 0 ? '#facc15' : '#94a3b8',
                      fontSize: '10.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    완전 투명 (0%)
                  </button>
                  <button
                    onClick={() => onUpdateSettings({ missionsBgOpacity: 50 })}
                    style={{
                      flex: 1,
                      padding: '4px',
                      borderRadius: '6px',
                      background: settings.missionsBgOpacity === 50 ? 'rgba(234, 179, 8, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                      border: settings.missionsBgOpacity === 50 ? '1px solid #facc15' : '1px solid rgba(255, 255, 255, 0.08)',
                      color: settings.missionsBgOpacity === 50 ? '#facc15' : '#94a3b8',
                      fontSize: '10.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    은은한 반투명 (50%)
                  </button>
                  <button
                    onClick={() => onUpdateSettings({ missionsBgOpacity: 82 })}
                    style={{
                      flex: 1,
                      padding: '4px',
                      borderRadius: '6px',
                      background: (settings.missionsBgOpacity ?? 82) === 82 ? 'rgba(234, 179, 8, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                      border: (settings.missionsBgOpacity ?? 82) === 82 ? '1px solid #facc15' : '1px solid rgba(255, 255, 255, 0.08)',
                      color: (settings.missionsBgOpacity ?? 82) === 82 ? '#facc15' : '#94a3b8',
                      fontSize: '10.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    기본 골드 (82%)
                  </button>
                </div>
              </div>
            )}

            {/* 2-3. 가공 시설 현황 설정 */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                background: 'rgba(30, 41, 59, 0.4)',
                padding: '12px',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 700, color: '#38bdf8' }}>
                  <Layers size={14} />
                  <span>가공 시설 설정</span>
                </div>

                <div style={{ display: 'flex', gap: '3px' }}>
                  {([
                    { value: '1row', label: '1행', Icon: Columns2 },
                    { value: '2row', label: '2행', Icon: Rows2 },
                    { value: 'slim', label: '슬림', Icon: Minus },
                  ] as { value: AlteringLayout; label: string; Icon: typeof Rows2 }[]).map(({ value, label, Icon }) => {
                    const isSelected = (settings.alteringLayout ?? '2row') === value;
                    return (
                      <button
                        key={value}
                        onClick={() => onUpdateSettings({ alteringLayout: value })}
                        title={value === 'slim' ? '제목표시줄 도킹 모드와 같은 알약형 디자인' : undefined}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          padding: '2px 7px',
                          borderRadius: '5px',
                          background: isSelected ? 'rgba(56, 189, 248, 0.3)' : 'rgba(15, 23, 42, 0.6)',
                          border: isSelected ? '1px solid rgba(56, 189, 248, 0.7)' : '1px solid rgba(255, 255, 255, 0.08)',
                          color: isSelected ? '#38bdf8' : '#94a3b8',
                          fontSize: '10px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        <Icon size={10} />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 6대 시설 토글 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' }}>
                {FACILITY_LIST.map((fac) => {
                  const isChecked = currentFacilities[fac.key] !== false;
                  const IconComp = fac.icon;
                  return (
                    <label
                      key={fac.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '5px 7px',
                        borderRadius: '7px',
                        background: isChecked ? 'rgba(15, 23, 42, 0.75)' : 'rgba(15, 23, 42, 0.3)',
                        border: isChecked ? `1px solid ${fac.color}66` : '1px solid rgba(255, 255, 255, 0.06)',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <IconComp size={14} />
                        <span style={{ fontSize: '10.5px', fontWeight: 600, color: isChecked ? '#f1f5f9' : '#64748b' }}>
                          {fac.label}
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleFacility(fac.key)}
                        style={{ accentColor: fac.color, cursor: 'pointer', width: '12px', height: '12px' }}
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 2-4. 미디어 플레이어 리모컨 설정 */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                background: 'rgba(30, 41, 59, 0.4)',
                padding: '12px',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 700, color: '#38bdf8' }}>
                  <Headphones size={14} />
                  <span>미디어 리모컨</span>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', cursor: 'pointer', color: '#e2e8f0', fontWeight: 600 }}>
                  <span>리모컨 표시</span>
                  <input
                    type="checkbox"
                    checked={settings.showMediaRemote ?? true}
                    onChange={(e) => onUpdateSettings({ showMediaRemote: e.target.checked })}
                    style={{ accentColor: '#38bdf8', width: '13px', height: '13px', cursor: 'pointer' }}
                  />
                </label>
              </div>

              {(settings.showMediaRemote ?? true) && (
                <>
                  {/* 우선순위 플레이어 선택 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#cbd5e1' }}>
                      <span style={{ fontWeight: 600 }}>우선순위 플레이어</span>
                      <span style={{ color: '#94a3b8', fontSize: '9px' }}>자동 또는 지정 앱 최우선</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '3px' }}>
                      {[
                        { id: 'auto' as MediaPriorityApp, label: '자동' },
                        { id: 'spotify' as MediaPriorityApp, label: '스포티파이' },
                        { id: 'ytmusic' as MediaPriorityApp, label: 'YT뮤직' },
                        { id: 'chrome' as MediaPriorityApp, label: '크롬' },
                        { id: 'edge' as MediaPriorityApp, label: '엣지' },
                      ].map((app) => {
                        const isSelected = (settings.mediaPriorityApp || 'auto') === app.id;
                        return (
                          <button
                            key={app.id}
                            onClick={() => onUpdateSettings({ mediaPriorityApp: app.id })}
                            style={{
                              padding: '4px 2px',
                              borderRadius: '5px',
                              background: isSelected ? 'rgba(56, 189, 248, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                              border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                              color: isSelected ? '#38bdf8' : '#cbd5e1',
                              fontSize: '9.5px',
                              fontWeight: isSelected ? 700 : 500,
                              cursor: 'pointer',
                              textAlign: 'center',
                            }}
                          >
                            {app.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 카드 배경 불투명도 슬라이더 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px' }}>
                      <span style={{ color: '#cbd5e1', fontWeight: 600 }}>배경 불투명도</span>
                      <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                        {(settings.mediaBgOpacity ?? 0) === 0 ? '0% (완전 투명)' : `${settings.mediaBgOpacity ?? 0}%`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={settings.mediaBgOpacity ?? 0}
                      onChange={(e) => onUpdateSettings({ mediaBgOpacity: Number(e.target.value) })}
                      style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                    />
                  </div>

                  {/* 리모컨 크기 스케일 슬라이더 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px' }}>
                      <span style={{ color: '#cbd5e1', fontWeight: 600 }}>리모컨 크기 배율</span>
                      <span style={{ color: '#38bdf8', fontWeight: 700 }}>{settings.mediaScale || 100}%</span>
                    </div>
                    <input
                      type="range"
                      min="60"
                      max="180"
                      step="5"
                      value={settings.mediaScale || 100}
                      onChange={(e) => onUpdateSettings({ mediaScale: Number(e.target.value) })}
                      style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                    />
                  </div>
                </>
              )}
            </div>

            {/* 2-5. 시스템 / 동작 설정 */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                background: 'rgba(30, 41, 59, 0.4)',
                padding: '12px',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 700, color: '#38bdf8' }}>
                <Power size={14} />
                <span>시스템 / 동작 설정</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', cursor: 'pointer' }}>
                  <span style={{ fontWeight: 600, color: '#f1f5f9' }}>게임 종료 시 오버레이 자동 종료</span>
                  <input
                    type="checkbox"
                    checked={settings.autoCloseWithGame ?? true}
                    onChange={(e) => onUpdateSettings({ autoCloseWithGame: e.target.checked })}
                    style={{ accentColor: '#38bdf8', width: '14px', height: '14px', cursor: 'pointer' }}
                  />
                </label>
                <div style={{ fontSize: '10px', color: '#94a3b8', lineHeight: 1.3 }}>
                  마비노기 모바일이 실행되지 않거나 종료되었을 때, 6초 후 오버레이를 자동으로 닫습니다.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

