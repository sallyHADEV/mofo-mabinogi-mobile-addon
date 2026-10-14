import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { DockMarquee } from './components/DockMarquee.js';
import {
  Settings,
  Lock,
  Unlock,
  MousePointer,
  Eye,
  GripHorizontal,
  Wifi,
  WifiOff,
  RotateCcw,
} from 'lucide-react';
import { ErinnClockBadge } from './components/ErinnClockBadge.js';
import { AlteringSlotsHud } from './components/AlteringSlotsHud.js';
import { ConcertNotification } from './components/ConcertNotification.js';
import { NowPlayingBadge } from './components/NowPlayingBadge.js';
import { SettingsModal } from './components/SettingsModal.js';
import { MediaRemoteHud } from './components/MediaRemoteHud.js';
import { RemainingMissionsHud } from './components/RemainingMissionsHud.js';
import { SongFinderHud } from './components/SongFinderHud.js';
import { DEFAULT_SONG_CHAT_TEMPLATE, stripSongAnnotation } from './utils/songMatch.js';
import { useEnsemble } from './hooks/useEnsemble.js';
import { useDraggable } from './hooks/useDraggable.js';
import {
  fetchEnvironment,
  fetchAlteringWorks,
  fetchNearPlayers,
  fetchActivity,
  fetchMissions,
} from './services/api.js';
import type {
  EnvironmentData,
  AlteringWorksData,
  NearPlayer,
  ActivityData,
  OverlaySettings,
  EnsembleSession,
  WidgetPosition,
  MissionsData,
  PresetId,
  OverlayPresets,
} from './types.js';

// Tauri invoke 동적 로드 (웹 브라우저 환경에서도 에러 없이 안전하게 실행)
async function invokeTauri<T = any>(cmd: string, args?: Record<string, any>): Promise<T | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch {
    return null;
  }
}

// Tauri 앱 안에서 실행 중인지 여부 (브라우저 모드에서는 게임 실행 감지 신호가 없음)
const IS_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// Tauri listen 동적 로드
async function listenTauri<T>(event: string, handler: (event: { payload: T }) => void) {
  try {
    const { listen } = await import('@tauri-apps/api/event');
    return await listen<T>(event, handler);
  } catch {
    return () => {};
  }
}

const getDefaultConcertPos = (): WidgetPosition => {
  if (typeof window !== 'undefined' && window.innerWidth) {
    return { x: Math.max(20, Math.floor((window.innerWidth - 720) / 2)), y: 140 };
  }
  return { x: 350, y: 140 };
};

const DEFAULT_SETTINGS: OverlaySettings = {
  titlebarDocked: false,
  ensembleDelaySeconds: 4,
  noticeDisplaySeconds: 8,
  showAltering: true,
  showClock: true,
  showConcert: true,
  compactMode: false,
  opacity: 1.0,
  isPositionLocked: false,
  clockPosition: { x: 20, y: 50 },
  alteringPosition: { x: 20, y: 240 },
  concertPosition: { x: 400, y: 140 },
  toolbarPosition: { x: 20, y: 12 },
  visibleFacilities: {
    metal: true,
    wood: true,
    leather: true,
    cloth: true,
    medicine: true,
    food: true,
  },
  alteringLayout: '2row',
  concertMotionTheme: 'cinematic',
  concertBgStyle: 'translucent',
  toolbarIconOnly: false,
  showMediaRemote: true,
  mediaPosition: { x: 20, y: 350 },
  mediaPriorityApp: 'auto',
  mediaBgOpacity: 0,
  mediaScale: 100,
  showMissions: true,
  missionsPosition: { x: 20, y: 470 },
  missionsBgOpacity: 82,
  showInTaskbar: false,
  autoCloseWithGame: true,
  showSongFinder: false,
  songFinderPosition: { x: 280, y: 470 },
  songChatTemplate: DEFAULT_SONG_CHAT_TEMPLATE,
  songAutoChat: false,
};

const PRESETS_STORAGE_KEY = 'mofo_overlay_presets_v1';
const ACTIVE_PRESET_STORAGE_KEY = 'mofo_active_preset_id';

function loadInitialPresets(): { activeId: PresetId; presets: OverlayPresets; initialSettings: OverlaySettings } {
  let activeId: PresetId = 1;
  try {
    const savedActive = localStorage.getItem(ACTIVE_PRESET_STORAGE_KEY);
    if (savedActive === '1' || savedActive === '2' || savedActive === '3') {
      activeId = parseInt(savedActive, 10) as PresetId;
    }
  } catch {}

  let legacySettings: Partial<OverlaySettings> = {};
  try {
    const savedLegacy = localStorage.getItem('mofo_overlay_settings');
    if (savedLegacy) {
      legacySettings = JSON.parse(savedLegacy);
    }
  } catch {}

  const baseSettings: OverlaySettings = {
    ...DEFAULT_SETTINGS,
    ...legacySettings,
    autoCloseWithGame: legacySettings.autoCloseWithGame ?? true,
  };

  let presets: OverlayPresets = {
    1: { ...baseSettings },
    2: { ...baseSettings },
    3: { ...baseSettings },
  };

  try {
    const savedPresets = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (savedPresets) {
      const parsed = JSON.parse(savedPresets);
      if (parsed[1]) presets[1] = { ...DEFAULT_SETTINGS, ...parsed[1], autoCloseWithGame: parsed[1].autoCloseWithGame ?? true };
      if (parsed[2]) presets[2] = { ...DEFAULT_SETTINGS, ...parsed[2], autoCloseWithGame: parsed[2].autoCloseWithGame ?? true };
      if (parsed[3]) presets[3] = { ...DEFAULT_SETTINGS, ...parsed[3], autoCloseWithGame: parsed[3].autoCloseWithGame ?? true };
    }
  } catch {}

  const initialSettings = presets[activeId] || baseSettings;
  return { activeId, presets, initialSettings };
}

export const App: React.FC = () => {
  // 환경 / 가공 / 연주 상태
  const [envData, setEnvData] = useState<EnvironmentData | null>(null);
  const [alteringData, setAlteringData] = useState<AlteringWorksData | null>(null);
  const [nearPlayers, setNearPlayers] = useState<NearPlayer[]>([]);
  const [myActivity, setMyActivity] = useState<ActivityData | null>(null);
  const [missionsData, setMissionsData] = useState<MissionsData | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  // 3단 프리셋 관리 및 현재 활성 프리셋
  const initialPresetState = useRef(loadInitialPresets()).current;
  const [activePreset, setActivePreset] = useState<PresetId>(initialPresetState.activeId);
  const [presets, setPresets] = useState<OverlayPresets>(initialPresetState.presets);

  // 설정 및 위치 상태 (현재 활성 프리셋과 실시간 연동)
  const [settings, setSettings] = useState<OverlaySettings>(initialPresetState.initialSettings);

  // 마비노기 클라이언트 작업표시줄 최소화 상태 및 프로세스 실행 추적
  const [isMabiMinimized, setIsMabiMinimized] = useState<boolean>(false);
  const [isMabiRunning, setIsMabiRunning] = useState<boolean>(false);
  const [isMabiStateInitialized, setIsMabiStateInitialized] = useState<boolean>(false);
  const hasEverDetectedMabiRef = useRef<boolean>(false);
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [titlebar, setTitlebar] = useState({ height: 31, right: 138 });
  const docked = !!settings.titlebarDocked;
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      const geometry = await invokeTauri<[number, number]>('get_titlebar_geometry');
      if (!alive || !geometry) return;
      const dpr = window.devicePixelRatio || 1;
      const height = geometry[0] / dpr;
      const right = geometry[1] / dpr;
      setTitlebar(previous => previous.height === height && previous.right === right ? previous : { height, right });
    };
    void poll();
    const timer = setInterval(poll, 250);
    return () => { alive = false; clearInterval(timer); };
  }, []);

  // 개별 위젯 드래그 위치 상태
  const [clockPos, setClockPos] = useState<WidgetPosition>(settings.clockPosition || { x: 20, y: 50 });
  const [alteringPos, setAlteringPos] = useState<WidgetPosition>(settings.alteringPosition || { x: 20, y: 240 });
  const [concertPos, setConcertPos] = useState<WidgetPosition>(settings.concertPosition || getDefaultConcertPos());
  const [toolbarPos, setToolbarPos] = useState<WidgetPosition>(settings.toolbarPosition || { x: 20, y: 12 });
  const [mediaPos, setMediaPos] = useState<WidgetPosition>(settings.mediaPosition || { x: 20, y: 350 });
  const [missionsPos, setMissionsPos] = useState<WidgetPosition>(settings.missionsPosition || { x: 20, y: 470 });
  const [songFinderPos, setSongFinderPos] = useState<WidgetPosition>(settings.songFinderPosition || { x: 280, y: 470 });
  const [isLocked, setIsLocked] = useState<boolean>(settings.isPositionLocked ?? false);

  // 마우스 클릭 완전 관통(강제 통과) 모드 여부
  const [isForcePassAll, setIsForcePassAll] = useState<boolean>(false);
  const [clickThroughNotice, setClickThroughNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 이전 토스트 타이머를 취소해야 앞 타이머가 새 토스트를 일찍 닫지 않음
  const showNotice = useCallback((message: string, durationMs: number) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setClickThroughNotice(message);
    noticeTimerRef.current = setTimeout(() => {
      setClickThroughNotice(null);
      noticeTimerRef.current = null;
    }, durationMs);
  }, []);
  // 자동 종료 경고는 다른 토스트가 지우지 못하도록 별도 상태로 관리
  const [autoCloseNotice, setAutoCloseNotice] = useState<string | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);
  const handleCloseSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);
  const [testSession, setTestSession] = useState<EnsembleSession | null>(null);

  // 위젯 인터랙티브 영역 DOM 참조
  const toolbarRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLDivElement>(null);
  const alteringRef = useRef<HTMLDivElement>(null);
  const concertRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  // 도킹 위젯 전용 ref: 떠 있는 위젯의 퇴장 애니메이션이 끝나며 공유 ref를 null로 지우는 문제 방지
  const dockAlteringRef = useRef<HTMLDivElement>(null);
  const dockMediaRef = useRef<HTMLDivElement>(null);
  const missionsRef = useRef<HTMLDivElement>(null);
  const songFinderRef = useRef<HTMLDivElement>(null);

  // 더블클릭으로 5초간 임시 숨겨진 위젯 관리
  type WidgetKey = 'clock' | 'altering' | 'media' | 'missions' | 'toolbar' | 'songFinder';
  const [hiddenWidgets, setHiddenWidgets] = useState<Set<WidgetKey>>(new Set());
  const hideTimersRef = useRef<Map<WidgetKey, ReturnType<typeof setTimeout>>>(new Map());

  const hideTemporarily = useCallback((key: WidgetKey, durationMs = 5000) => {
    if (hideTimersRef.current.has(key)) {
      clearTimeout(hideTimersRef.current.get(key)!);
    }
    setHiddenWidgets((prev) => new Set(prev).add(key));

    const timer = setTimeout(() => {
      setHiddenWidgets((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      hideTimersRef.current.delete(key);
    }, durationMs);

    hideTimersRef.current.set(key, timer);
  }, []);

  const handleDoubleClickToolbar = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'DIV') {
      hideTemporarily('toolbar');
    }
  }, [hideTemporarily]);

  const handleDoubleClickClock = useCallback(() => {
    hideTemporarily('clock');
  }, [hideTemporarily]);

  const handleDoubleClickAltering = useCallback(() => {
    hideTemporarily('altering');
  }, [hideTemporarily]);

  const handleDoubleClickMedia = useCallback(() => {
    hideTemporarily('media');
  }, [hideTemporarily]);

  const handleDoubleClickMissions = useCallback(() => {
    hideTemporarily('missions');
  }, [hideTemporarily]);

  const handleDoubleClickSongFinder = useCallback(() => {
    hideTemporarily('songFinder');
  }, [hideTemporarily]);
  useEffect(() => {
    if (isSettingsOpen) {
      hideTimersRef.current.forEach((t) => clearTimeout(t));
      hideTimersRef.current.clear();
      setHiddenWidgets(new Set());
    }
  }, [isSettingsOpen]);

  useEffect(() => {
    return () => {
      hideTimersRef.current.forEach((t) => clearTimeout(t));
      hideTimersRef.current.clear();
    };
  }, []);

  // 모든 미션 완료 시 10초 후 자동 페이드아웃 상태
  const [isMissionsAutoHidden, setIsMissionsAutoHidden] = useState(false);
  const missionsAutoCompleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 미션 데이터 기반 모든 미션 완료 여부 감지 및 10초 후 페이드아웃 타이머
  useEffect(() => {
    // 위치 이동 모드(!isLocked)이거나 설정창이 열려 있으면 페이드아웃 방지/해제
    if (!isLocked || isSettingsOpen) {
      if (missionsAutoCompleteTimerRef.current) {
        clearTimeout(missionsAutoCompleteTimerRef.current);
        missionsAutoCompleteTimerRef.current = null;
      }
      setIsMissionsAutoHidden(false);
      return;
    }

    if (!missionsData) return;

    const daily = missionsData.daily || [];
    const weekly = missionsData.weekly || [];
    const hasData = daily.length > 0 || weekly.length > 0;
    if (!hasData) return;

    const hasPendingDaily = daily.some((m) => !m.IsCompleted && m.CurrentCount < m.GoalCount);
    const hasPendingWeekly = weekly.some((m) => !m.IsCompleted && m.CurrentCount < m.GoalCount);
    const allCompleted = !hasPendingDaily && !hasPendingWeekly;

    if (allCompleted) {
      // 모든 미션 완료 상태: 아직 타이머가 동작하지 않고 숨겨지지 않은 경우 10초 타이머 시작
      if (!isMissionsAutoHidden && !missionsAutoCompleteTimerRef.current) {
        missionsAutoCompleteTimerRef.current = setTimeout(() => {
          setIsMissionsAutoHidden(true);
          missionsAutoCompleteTimerRef.current = null;
        }, 10000); // 10초 후 부드럽게 페이드아웃
      }
    } else {
      // 미완료 미션이 생기거나 남아있으면 타이머 취소 및 표시 복원
      if (missionsAutoCompleteTimerRef.current) {
        clearTimeout(missionsAutoCompleteTimerRef.current);
        missionsAutoCompleteTimerRef.current = null;
      }
      setIsMissionsAutoHidden(false);
    }
  }, [missionsData, isLocked, isSettingsOpen, isMissionsAutoHidden]);

  useEffect(() => {
    return () => {
      if (missionsAutoCompleteTimerRef.current) {
        clearTimeout(missionsAutoCompleteTimerRef.current);
      }
    };
  }, []);

  // 마비노기 클라이언트 최소화/실행 상태 구독 (Rust 트래커가 상태 변화 시 이벤트 발송)
  useEffect(() => {
    let isMounted = true;
    let unlisten: (() => void) | undefined;

    const applyRunning = (running: boolean) => {
      setIsMabiRunning(running);
      if (running) hasEverDetectedMabiRef.current = true;
      setIsMabiStateInitialized(true);
    };

    // 구독을 먼저 등록한 뒤 현재 상태를 1회 조회 (구독 전에 발송된 초기 이벤트 누락 방지).
    // 조회 응답보다 이벤트가 먼저 오면 이벤트가 최신이므로, 늦게 도착한 조회 결과로 덮어쓰지 않는다
    // (예: 앱 시작 직후 게임 종료 → 종료 이벤트 후 '실행 중' 조회 결과가 도착해 자동 종료가 영영 안 되는 문제)
    let eventReceived = false;
    listenTauri<{ is_minimized: boolean; is_running?: boolean }>('mabi_window_state', (event) => {
      if (!isMounted) return;
      eventReceived = true;
      setIsMabiMinimized(event.payload.is_minimized);
      if (typeof event.payload.is_running === 'boolean') applyRunning(event.payload.is_running);
    }).then(async (fn) => {
      if (!isMounted) {
        fn();
        return;
      }
      unlisten = fn;
      const [minimized, running] = await Promise.all([
        invokeTauri<boolean>('get_mabi_minimized'),
        invokeTauri<boolean>('get_mabi_running'),
      ]);
      if (!isMounted || eventReceived) return;
      if (typeof minimized === 'boolean') setIsMabiMinimized(minimized);
      if (typeof running === 'boolean') applyRunning(running);
    });

    return () => {
      isMounted = false;
      if (unlisten) unlisten();
    };
  }, []);

  // 마비노기 프로세스 종료 시 6초 자동 종료 기능
  useEffect(() => {
    // 최초 백엔드 프로세스 상태 조회가 완료되기 전에는 깜빡임 방지를 위해 실행 유예
    if (!isMabiStateInitialized) return;

    const autoCloseEnabled = settings.autoCloseWithGame ?? true;

    // 자동 종료 설정이 비활성화되었거나 설정 모달이 열려 있는 경우 타이머 취소
    if (!autoCloseEnabled || isSettingsOpen) {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
        setAutoCloseNotice(null);
      }
      return;
    }

    // 마비노기가 실행 중이면 타이머 즉시 취소 및 토스트 해제
    if (isMabiRunning) {
      hasEverDetectedMabiRef.current = true;
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
        setAutoCloseNotice(null);
      }
      return;
    }

    // 마비노기가 실행 중이 아닐 때 (미실행 상태로 켜졌거나, 게임 도중 꺼졌을 때)
    if (!isMabiRunning) {
      if (!autoCloseTimerRef.current) {
        const noticeText = hasEverDetectedMabiRef.current
          ? '마비노기 종료 감지: 6초 후 오버레이를 자동으로 닫습니다.'
          : '마비노기 미실행 감지: 6초 후 오버레이를 자동으로 닫습니다.';
        setAutoCloseNotice(noticeText);
        autoCloseTimerRef.current = setTimeout(() => {
          invokeTauri('exit_app');
          autoCloseTimerRef.current = null;
        }, 6000);
      }
    }
  }, [isMabiStateInitialized, isMabiRunning, settings.autoCloseWithGame, isSettingsOpen]);

  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
    };
  }, []);

  // 마비노기 최소화 시 열려 있던 설정 모달 닫기
  useEffect(() => {
    if (isMabiMinimized && isSettingsOpen) {
      setIsSettingsOpen(false);
    }
  }, [isMabiMinimized, isSettingsOpen]);

  // 윈도우 작업표시줄 표시 여부 동기화
  useEffect(() => {
    invokeTauri('set_show_in_taskbar', { show: !!settings.showInTaskbar });
  }, [settings.showInTaskbar]);

  // 마비노기 게임 창 크기 변경 시 위젯 위치가 화면 밖으로 벗어나지 않도록 클램핑
  useEffect(() => {
    const handleResize = () => {
      const clampX = (x: number, margin = 60) => Math.max(0, Math.min(Math.max(0, window.innerWidth - margin), x));
      const clampY = (y: number, margin = 40) => Math.max(0, Math.min(Math.max(0, window.innerHeight - margin), y));

      setClockPos((p) => ({ x: clampX(p.x), y: clampY(p.y) }));
      setAlteringPos((p) => ({ x: clampX(p.x), y: clampY(p.y) }));
      setToolbarPos((p) => ({ x: clampX(p.x), y: clampY(p.y) }));
      setMediaPos((p) => ({ x: clampX(p.x), y: clampY(p.y) }));
      setMissionsPos((p) => ({ x: clampX(p.x), y: clampY(p.y) }));
      setSongFinderPos((p) => ({ x: clampX(p.x), y: clampY(p.y) }));
      setConcertPos((p) => ({ x: clampX(p.x, 300), y: clampY(p.y, 100) }));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 300ms 디바운스된 설정 스토리지 저장 관리 (144Hz 드래그 시 Jank 방지)
  const activePresetRef = useRef<PresetId>(activePreset);
  useEffect(() => {
    activePresetRef.current = activePreset;
  }, [activePreset]);

  const saveSettingsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSettingsToSaveRef = useRef<{ settings: OverlaySettings; presets: OverlayPresets } | null>(null);

  const flushPendingSave = useCallback(() => {
    if (saveSettingsTimerRef.current) {
      clearTimeout(saveSettingsTimerRef.current);
      saveSettingsTimerRef.current = null;
      if (pendingSettingsToSaveRef.current) {
        try {
          localStorage.setItem('mofo_overlay_settings', JSON.stringify(pendingSettingsToSaveRef.current.settings));
          localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(pendingSettingsToSaveRef.current.presets));
        } catch {}
        pendingSettingsToSaveRef.current = null;
      }
    }
  }, []);

  const debounceSaveSettings = useCallback((latestSettings: OverlaySettings, latestPresets: OverlayPresets) => {
    pendingSettingsToSaveRef.current = { settings: latestSettings, presets: latestPresets };
    if (saveSettingsTimerRef.current) {
      clearTimeout(saveSettingsTimerRef.current);
    }
    saveSettingsTimerRef.current = setTimeout(() => {
      if (pendingSettingsToSaveRef.current) {
        try {
          localStorage.setItem('mofo_overlay_settings', JSON.stringify(pendingSettingsToSaveRef.current.settings));
          localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(pendingSettingsToSaveRef.current.presets));
        } catch {}
        pendingSettingsToSaveRef.current = null;
      }
      saveSettingsTimerRef.current = null;
    }, 300);
  }, []);

  // 언마운트 시 미저장 설정 즉시 플러시
  useEffect(() => {
    return () => {
      flushPendingSave();
    };
  }, [flushPendingSave]);

  // 설정 및 위치 변경 시 현재 활성 프리셋에 실시간 자동 동기화 (300ms 디바운스 저장)
  const handleUpdateSettings = useCallback((newPartial: Partial<OverlaySettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...newPartial };

      setPresets((prevPresets) => {
        const nextPresets: OverlayPresets = {
          ...prevPresets,
          [activePresetRef.current]: next,
        };
        // 300ms 디바운스된 로컬 스토리지 저장 (동기 블로킹 방지)
        debounceSaveSettings(next, nextPresets);
        return nextPresets;
      });

      return next;
    });
  }, [debounceSaveSettings]);

  // 프리셋 전환 (선택 시 즉시 적용 & 이후 변경은 해당 프리셋에 자동 저장)
  const handleSelectPreset = useCallback((id: PresetId) => {
    if (id === activePresetRef.current) return;

    flushPendingSave();

    activePresetRef.current = id;
    setActivePreset(id);
    try {
      localStorage.setItem(ACTIVE_PRESET_STORAGE_KEY, String(id));
    } catch {}

    const presetTarget = presets[id] || {};
    const defaultMediaPos: WidgetPosition = DEFAULT_SETTINGS.mediaPosition || { x: 20, y: 350 };
    const defaultMissionsPos: WidgetPosition = DEFAULT_SETTINGS.missionsPosition || { x: 20, y: 470 };
    const mediaPosFinal: WidgetPosition = presetTarget.mediaPosition || defaultMediaPos;
    const missionsPosFinal: WidgetPosition = presetTarget.missionsPosition || defaultMissionsPos;

    const target: OverlaySettings = {
      ...DEFAULT_SETTINGS,
      ...presetTarget,
      clockPosition: { ...DEFAULT_SETTINGS.clockPosition, ...(presetTarget.clockPosition || {}) },
      alteringPosition: { ...DEFAULT_SETTINGS.alteringPosition, ...(presetTarget.alteringPosition || {}) },
      concertPosition: { ...DEFAULT_SETTINGS.concertPosition, ...(presetTarget.concertPosition || {}) },
      toolbarPosition: { ...DEFAULT_SETTINGS.toolbarPosition, ...(presetTarget.toolbarPosition || {}) },
      mediaPosition: mediaPosFinal,
      missionsPosition: missionsPosFinal,
      songFinderPosition: presetTarget.songFinderPosition || DEFAULT_SETTINGS.songFinderPosition,
      visibleFacilities: { ...DEFAULT_SETTINGS.visibleFacilities, ...(presetTarget.visibleFacilities || {}) },
    };
    setSettings(target);
    try {
      localStorage.setItem('mofo_overlay_settings', JSON.stringify(target));
    } catch {}

    // 각 위젯 위치 및 고정 상태 일괄 반영
    setClockPos(target.clockPosition);
    setAlteringPos(target.alteringPosition);
    setConcertPos(target.concertPosition);
    setToolbarPos(target.toolbarPosition);
    setMediaPos(mediaPosFinal);
    setMissionsPos(missionsPosFinal);
    setSongFinderPos(presetTarget.songFinderPosition || DEFAULT_SETTINGS.songFinderPosition || { x: 280, y: 470 });
    setIsLocked(target.isPositionLocked ?? false);

    showNotice(`프리셋 ${id}번이 적용되었습니다.`, 2500);
  }, [presets, flushPendingSave, showNotice]);

  // 모든 창 위치 기본값으로 초기화
  const handleResetPositions = () => {
    const defaultClock = { x: 20, y: 50 };
    const defaultAltering = { x: 20, y: 240 };
    const defaultConcert = getDefaultConcertPos();
    const defaultToolbar = { x: 20, y: 12 };
    const defaultMedia = { x: 20, y: 350 };
    const defaultMissions = { x: 20, y: 470 };
    const defaultSongFinder = { x: 280, y: 470 };

    setClockPos(defaultClock);
    setAlteringPos(defaultAltering);
    setConcertPos(defaultConcert);
    setToolbarPos(defaultToolbar);
    setMediaPos(defaultMedia);
    setMissionsPos(defaultMissions);
    setSongFinderPos(defaultSongFinder);

    handleUpdateSettings({
      clockPosition: defaultClock,
      alteringPosition: defaultAltering,
      concertPosition: defaultConcert,
      toolbarPosition: defaultToolbar,
      mediaPosition: defaultMedia,
      missionsPosition: defaultMissions,
      songFinderPosition: defaultSongFinder,
    });

    showNotice(`현재 프리셋 ${activePreset}의 창 위치가 기본값으로 초기화되었습니다.`, 2500);
  };

  // 위치 잠금 토글
  const toggleLock = () => {
    const nextLocked = !isLocked;
    setIsLocked(nextLocked);
    handleUpdateSettings({ isPositionLocked: nextLocked });
  };

  const scaleFactor = (settings.uiScale || 100) / 100;

  // 1:1 정밀 네이티브 드래그 핸들러 (Framer Motion 날아감/점프 버그 원천 해결 & UI 배율 지원)
  const { handleMouseDown: handleToolbarDrag, isDragging: isToolbarDragging } = useDraggable({
    position: toolbarPos,
    onPositionChange: (pos) => {
      setToolbarPos(pos);
      handleUpdateSettings({ toolbarPosition: pos });
    },
    disabled: isLocked,
  });

  const { handleMouseDown: handleClockDrag, isDragging: isClockDragging } = useDraggable({
    position: clockPos,
    onPositionChange: (pos) => {
      setClockPos(pos);
      handleUpdateSettings({ clockPosition: pos });
    },
    disabled: isLocked || isForcePassAll,
  });

  const { handleMouseDown: handleAlteringDrag, isDragging: isAlteringDragging } = useDraggable({
    position: alteringPos,
    onPositionChange: (pos) => {
      setAlteringPos(pos);
      handleUpdateSettings({ alteringPosition: pos });
    },
    disabled: isLocked || isForcePassAll,
  });

  const { handleMouseDown: handleMediaDrag, isDragging: isMediaDragging } = useDraggable({
    position: mediaPos,
    onPositionChange: (pos) => {
      setMediaPos(pos);
      handleUpdateSettings({ mediaPosition: pos });
    },
    disabled: isLocked || isForcePassAll,
  });

  const { handleMouseDown: handleMissionsDrag, isDragging: isMissionsDragging } = useDraggable({
    position: missionsPos,
    onPositionChange: (pos) => {
      setMissionsPos(pos);
      handleUpdateSettings({ missionsPosition: pos });
    },
    disabled: isLocked || isForcePassAll,
  });

  const { handleMouseDown: handleSongFinderDrag, isDragging: isSongFinderDragging } = useDraggable({
    position: songFinderPos,
    onPositionChange: (pos) => {
      setSongFinderPos(pos);
      handleUpdateSettings({ songFinderPosition: pos });
    },
    disabled: isLocked || isForcePassAll,
  });

  const isAnyDragging =
    isToolbarDragging || isClockDragging || isAlteringDragging || isMediaDragging || isMissionsDragging || isSongFinderDragging;
  const isAnyDraggingRef = useRef(isAnyDragging);
  useEffect(() => {
    isAnyDraggingRef.current = isAnyDragging;
  }, [isAnyDragging]);

  // 마우스 클릭 완전 관통(강제 통과) 상태 ref (단축키 리스너 의존성 분리용)
  const isForcePassAllRef = useRef<boolean>(isForcePassAll);
  useEffect(() => {
    isForcePassAllRef.current = isForcePassAll;
  }, [isForcePassAll]);

  // 강제 완전 마우스 통과 토글
  const toggleForcePassAll = useCallback(async () => {
    const nextState = !isForcePassAllRef.current;
    isForcePassAllRef.current = nextState;
    setIsForcePassAll(nextState);
    await invokeTauri('set_click_through', { ignore: nextState });

    if (nextState) {
      showNotice('완전 마우스 관통 활성화 (모든 위젯 클릭 무시 • 복귀 단축키: F8)', 3500);
    } else {
      showNotice('스마트 관통 모드 (위젯 부분만 클릭 가능 • 빈 화면/작업표시줄 자동 통과)', 2500);
    }
  }, [showNotice]);

  // 설정 모달 열림 시 강제 통과 해제
  useEffect(() => {
    if (isSettingsOpen) {
      invokeTauri('set_click_through', { ignore: false });
    }
  }, [isSettingsOpen]);

  // 합주 집계 훅
  const { activeNotice, bufferingSession } = useEnsemble(
    nearPlayers,
    myActivity,
    {
      delaySeconds: settings.ensembleDelaySeconds,
      noticeDisplaySeconds: settings.noticeDisplaySeconds,
    }
  );

  // 상시 스마트 인터랙티브 영역 동기화:
  // 화면에 렌더링된 모든 UI 위젯의 사각형 좌표를 Rust 백엔드로 전송하여
  // 위젯이 있는 부분만 마우스를 가로채고, 그 외의 투명 화면 및 작업 표시줄은 마우스가 100% 통과되도록 합니다.
  const syncInteractiveRects = useCallback(() => {
    // 1. 마비노기 클라이언트 최소화 상태: 모든 오버레이 숨김 및 마우스 100% 관통 (예외 없음)
    if (isMabiMinimized) {
      invokeTauri('set_interactive_rects', {
        rects: [],
        forcePassExceptions: [],
      });
      return;
    }

    const rects: Array<{ x: number; y: number; width: number; height: number }> = [];
    const forcePassExceptions: Array<{ x: number; y: number; width: number; height: number }> = [];

    const visibleRect = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const dock = el.closest('.titlebar-dock')?.getBoundingClientRect();
      if (!dock) return r;
      const left = Math.max(0, r.left, dock.left);
      const top = Math.max(0, r.top, dock.top);
      const right = Math.min(window.innerWidth, r.right, dock.right);
      const bottom = Math.min(window.innerHeight, r.bottom, dock.bottom);
      return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
    };

    const addRect = (el: HTMLElement | null) => {
      if (!el) return;
      const r = visibleRect(el);
      if (r.width > 0 && r.height > 0) {
        rects.push({
          x: r.left,
          y: r.top,
          width: r.width,
          height: r.height,
        });
      }
    };

    const addExceptionRect = (el: HTMLElement | null) => {
      if (!el) return;
      const r = visibleRect(el);
      if (r.width > 0 && r.height > 0) {
        forcePassExceptions.push({
          x: r.left,
          y: r.top,
          width: r.width,
          height: r.height,
        });
      }
    };

    // 2. 미디어 리모컨 컨트롤 버튼 예외 영역 등록 (완전 통과 모드에서도 항상 클릭 허용!)
    if ((settings.showMediaRemote ?? true) && !hiddenWidgets.has('media')) {
      const mediaControls = document.getElementById('media-playback-controls');
      if (mediaControls) {
        addExceptionRect(mediaControls);
        // 컨트롤 박스 전체 주변에 6px 패딩을 둔 넉넉한 히트박스 추가
        const r = mediaControls.getBoundingClientRect();
        if (!docked && r.width > 0 && r.height > 0) {
          forcePassExceptions.push({
            x: Math.max(0, r.left - 6),
            y: Math.max(0, r.top - 6),
            width: r.width + 12,
            height: r.height + 12,
          });
        }
        // 개별 버튼들도 예외 영역으로 추가
        const btns = mediaControls.querySelectorAll<HTMLElement>('button');
        btns.forEach((b) => addExceptionRect(b));
      }
      const mediaCollapsed = document.getElementById('media-playback-collapsed');
      if (mediaCollapsed) {
        addExceptionRect(mediaCollapsed);
      }
    }

    // 2-1. 원곡 찾기 후보 버튼 (완전 관통 모드에서도 클릭하여 채팅 전송 가능, 위젯이 켜져 있을 때만)
    if (settings.showSongFinder && !hiddenWidgets.has('songFinder')) {
      document
        .querySelectorAll<HTMLElement>('#song-finder-candidates button')
        .forEach((b) => addExceptionRect(b));
    }

    // 3. 툴바의 완전 관통 토글 버튼 예외 영역 등록 (완전 관통 모드에서도 항상 클릭하여 스마트 관통으로 복귀 가능!)
    if (!hiddenWidgets.has('toolbar')) {
      const toggleBtn = document.getElementById('btn-force-pass-toggle');
      if (toggleBtn) {
        addExceptionRect(toggleBtn);
        const r = toggleBtn.getBoundingClientRect();
        if (!docked && r.width > 0 && r.height > 0) {
          forcePassExceptions.push({
            x: Math.max(0, r.left - 4),
            y: Math.max(0, r.top - 4),
            width: r.width + 8,
            height: r.height + 8,
          });
        }
      }
    }

    // 4. 완전 관통(강제 통과) 모드일 때:
    // 일반 위젯들은 빈 배열(모두 마우스 통과)로 보내고, 미디어 재생 컨트롤 & 관통 토글 버튼만 예외로 전송!
    if (isForcePassAll) {
      invokeTauri('set_interactive_rects', {
        rects: [],
        forcePassExceptions,
      });
      return;
    }

    // 4. 스마트 관통 모드: 일반 위젯 인터랙티브 영역 등록
    // 1) 툴바
    if (!hiddenWidgets.has('toolbar')) {
      addRect(toolbarRef.current);
    }
    // 2) 에린 시계 배지
    if (settings.showClock && !hiddenWidgets.has('clock')) {
      addRect(clockRef.current);
    }
    // 3) 가공기 슬롯
    if (settings.showAltering && !hiddenWidgets.has('altering')) {
      addRect(docked ? dockAlteringRef.current : alteringRef.current);
    }
    // 4) 미디어 리모컨 (스마트 모드: 카드 전체 클릭, 드래그 및 볼륨 조절 허용)
    if ((settings.showMediaRemote ?? true) && !hiddenWidgets.has('media')) {
      addRect(docked ? dockMediaRef.current : mediaRef.current);
    }
    // 3-2. 남은 미션 HUD:
    // 기본적으로 상단 타이틀 헤더와 탭 버튼([일일(N)], [주간(M)])만 클릭을 가로채고,
    // 그 외 영역(텍스트 목록, 배경 등) 및 탭이 없는 상태(10개 이하)에서는 미션창 전체가 마우스 클릭 통과!
    if ((settings.showMissions ?? true) && !hiddenWidgets.has('missions') && !isMissionsAutoHidden) {
      // 상단 헤더('남은 미션' 타이틀 바) 등록 (더블클릭 시 5초 숨김 지원)
      const headerEl = document.getElementById('missions-header');
      if (headerEl) {
        addRect(headerEl);
      }
      const tabBarEl = document.getElementById('missions-tab-bar');
      if (tabBarEl) {
        addRect(tabBarEl);
      }
      // 위치 이동 모드일 때는 상단 드래그 핸들을 통해 미션창을 옮길 수 있도록 등록
      if (!isLocked) {
        const dragHandleEl = document.getElementById('missions-drag-handle');
        if (dragHandleEl) {
          addRect(dragHandleEl);
        }
      }
    }
    // 3-3. 원곡 찾기 위젯
    if (settings.showSongFinder && !hiddenWidgets.has('songFinder')) {
      addRect(songFinderRef.current);
    }
    // 4. 음악회 방송창
    if (settings.showConcert && (activeNotice || testSession || bufferingSession)) {
      addRect(concertRef.current);
    }

    // 5. 설정 모달창 (모달이 열려 있을 때는 화면 전체를 인터랙티브로 활성화하여 바깥 배경 클릭 및 X 버튼 100% 동작 보장)
    if (isSettingsOpen) {
      rects.push({
        x: 0,
        y: 0,
        width: typeof window !== 'undefined' ? window.innerWidth : 3840,
        height: typeof window !== 'undefined' ? window.innerHeight : 2160,
      });
    }

    invokeTauri('set_interactive_rects', {
      rects,
      forcePassExceptions,
    });
  }, [
    docked,
    isForcePassAll,
    isMabiMinimized,
    isMissionsAutoHidden,
    settings.showClock,
    settings.showAltering,
    settings.showMediaRemote,
    settings.showMissions,
    settings.showSongFinder,
    settings.showConcert,
    Boolean(activeNotice),
    Boolean(testSession),
    Boolean(bufferingSession),
    isSettingsOpen,
    isLocked,
    hiddenWidgets,
  ]);

  // 1. 기본 250ms 정기 폴링 (드래그 중에는 백그라운드 폴링도 억제하여 144Hz 성능 유지)
  useEffect(() => {
    syncInteractiveRects();
    const interval = setInterval(() => {
      if (!isAnyDraggingRef.current) {
        syncInteractiveRects();
      }
    }, 250);
    return () => clearInterval(interval);
  }, [syncInteractiveRects]);

  // 2. 드래그 중 매 픽셀 getBoundingClientRect() 호출로 인한 Layout Thrashing 제거:
  // 드래그 중에는 IPC 발송을 억제하고, 드래그 종료 직후에는 디바운스 대기 없이 즉시 플러시하여 클릭 씹힘 방지
  const prevDraggingRef = useRef(isAnyDragging);

  useEffect(() => {
    const wasDragging = prevDraggingRef.current;
    prevDraggingRef.current = isAnyDragging;

    // 드래그 종료 직후 (true -> false): 디바운스 대기 없이 즉시 플러시하여 클릭 씹힘 원천 차단
    if (wasDragging && !isAnyDragging) {
      syncInteractiveRects();
      return;
    }

    if (isAnyDragging) return;

    const timer = setTimeout(() => {
      syncInteractiveRects();
    }, 200);

    return () => clearTimeout(timer);
  }, [
    syncInteractiveRects,
    isAnyDragging,
    toolbarPos,
    clockPos,
    alteringPos,
    concertPos,
    mediaPos,
    missionsPos,
    songFinderPos,
    hiddenWidgets,
    isMabiMinimized,
    isMissionsAutoHidden,
  ]);

  // F8 단축키로 완전 통과 토글 (마운트 시 1회만 등록)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F8') {
        e.preventDefault();
        toggleForcePassAll();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleForcePassAll]);

  // 실시간 브릿지 데이터 폴링 (1.5초 주기)
  const refreshData = useCallback(async () => {
    try {
      const [envRes, altRes, pcsRes, actRes, misRes] = await Promise.all([
        fetchEnvironment(),
        fetchAlteringWorks(),
        fetchNearPlayers(),
        fetchActivity(),
        fetchMissions(),
      ]);

      const connected = !!(envRes.success || altRes.success || pcsRes.success || actRes.success || misRes.success);
      setIsConnected(connected);
      // 실행 여부는 Rust 트래커(mabi_window_state 이벤트)만 결정한다.
      // 여기서 true로 덮어쓰면 종료 직후 늦게 도착한 응답(미션 캐시 포함)이 종료 이벤트를 되돌려
      // 자동 종료가 영영 동작하지 않는다.

      if (envRes.success && envRes.data) setEnvData(envRes.data);
      if (altRes.success && altRes.data) setAlteringData(altRes.data);
      if (pcsRes.success && pcsRes.data) {
        setNearPlayers(Array.isArray(pcsRes.data) ? pcsRes.data : []);
      }
      if (actRes.success && actRes.data) setMyActivity(actRes.data);
      if (misRes.success && misRes.data) setMissionsData(misRes.data);
    } catch {
      setIsConnected(false);
    }
  }, []);

  // 1.5초 주기 브릿지 데이터 폴링 (마비노기 최소화 또는 미실행 시 폴링 건너뜀)
  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let isCancelled = false;

    const runPolling = async () => {
      try {
        if (!isMabiMinimized && (isMabiRunning || !IS_TAURI)) {
          await refreshData();
        }
      } finally {
        if (!isCancelled) {
          timerId = setTimeout(runPolling, 1500);
        }
      }
    };

    runPolling();

    return () => {
      isCancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [refreshData, isMabiMinimized, isMabiRunning]);

  // Altering 및 Concert 콜백 안정화
  const handleToggleAlteringLayout = useCallback(() => {
    handleUpdateSettings({
      alteringLayout: settings.alteringLayout === '1row' ? '2row' : '1row',
    });
  }, [handleUpdateSettings, settings.alteringLayout]);

  const handleConcertPositionChange = useCallback(
    (pos: WidgetPosition) => {
      setConcertPos(pos);
      handleUpdateSettings({ concertPosition: pos });
    },
    [handleUpdateSettings]
  );

  // 가상 테스트용 합주 타이포 모션 트리거
  const handleTriggerTestConcert = () => {
    setIsSettingsOpen(false);
    setTestSession({
      id: `test-${Date.now()}`,
      title: '어릴 적 할머니가 들려주신 옛 전설',
      members: [
        { name: '나 (리더)', instrument: '류트' },
        { name: '밀레시안A', instrument: '만돌린' },
        { name: '음유시인B', instrument: '플루트' },
        { name: '로나', instrument: '우쿨렐레' },
      ],
      startedAt: Date.now(),
      isBuffering: false,
    });

    setTimeout(() => {
      setTestSession(null);
    }, settings.noticeDisplaySeconds * 1000);
  };

  // 원곡 찾기 대상: 내 연주 곡만 (이미 폴링 중인 get_activity 재사용)
  const myPlayingTitle = myActivity?.Performance?.IsPlaying ? myActivity.Performance.MusicTitle?.trim() || null : null;
  const handleToggleSongAutoChat = useCallback(
    (next: boolean) => handleUpdateSettings({ songAutoChat: next }),
    [handleUpdateSettings]
  );

  // 원곡 찾기 결과를 합주 모션 제목에 반영 (세션 title은 합주 판별/재표시 방지용이라 건드리지 않고 표시용으로만 교체)
  const [songResolution, setSongResolution] = useState<{ gameTitle: string; display: string | null } | null>(null);
  const handleSongResolved = useCallback((gameTitle: string, display: string | null) => {
    setSongResolution((prev) => (prev?.gameTitle === gameTitle && prev.display === display ? prev : { gameTitle, display }));
  }, []);
  // 알림이 처음 뜨는 순간 표시 제목을 고정: 검색이 대기 딜레이보다 늦게 끝나도 애니메이션 도중 제목이 바뀌지 않음
  const concertTitleRef = useRef<{ id: string; title: string } | null>(null);
  const concertNotice = useMemo(() => {
    if (testSession || !activeNotice) return testSession || activeNotice;
    if (concertTitleRef.current?.id !== activeNotice.id) {
      // 합주 대표곡이 내 연주 곡과 같을 때만 반영 (원곡 찾기는 내 곡만 검색)
      const resolved =
        settings.showSongFinder && songResolution?.gameTitle === activeNotice.title ? songResolution.display : null;
      // 악보 제목의 주석([..], # 뒤)은 모션에서 숨김 (툴바 연주 배지에만 원문 표시)
      concertTitleRef.current = { id: activeNotice.id, title: resolved ?? stripSongAnnotation(activeNotice.title) };
    }
    return concertTitleRef.current.title === activeNotice.title
      ? activeNotice
      : { ...activeNotice, title: concertTitleRef.current.title };
  }, [testSession, activeNotice, settings.showSongFinder, songResolution]);

  // 현재 연주 중인 대표 곡명 추출 (상시 표시 배지용)
  const currentEnsembleTitle =
    activeNotice?.title ||
    bufferingSession?.title ||
    myActivity?.Performance?.MusicTitle ||
    nearPlayers.find((p) => p.Performance?.IsPlaying)?.Performance?.MusicTitle ||
    null;

  const currentMembers = useMemo(() => {
    if (activeNotice?.members) return activeNotice.members;
    if (bufferingSession?.members) return bufferingSession.members;
    if (myActivity?.Performance?.IsPlaying) {
      return [{ name: '나', instrument: myActivity.Performance.InstrumentName }];
    }
    return [];
  }, [
    activeNotice?.members,
    bufferingSession?.members,
    myActivity?.Performance?.IsPlaying,
    myActivity?.Performance?.InstrumentName,
  ]);

  const bufferingProp = useMemo(() => {
    if (bufferingSession && !activeNotice) {
      return {
        count: bufferingSession.members.length,
        delaySeconds: settings.ensembleDelaySeconds,
      };
    }
    return null;
  }, [bufferingSession, activeNotice, settings.ensembleDelaySeconds]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        pointerEvents: 'none',
        background: 'transparent',
      }}
    >
      {/* 마비노기 클라이언트 작업표시줄 최소화 시 전체 위젯 자동 숨김/복원 */}
      <AnimatePresence>
        {!isMabiMinimized && (
          <motion.div
            key="mabi-active-overlay-root"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
          >
            {/* 전역 토스트 팝업 알림 (화면 상단 중앙 고정, 타이틀바 도킹 시 잘림 원천 방지) */}
            <AnimatePresence>
              {(autoCloseNotice || clickThroughNotice) && (
                <motion.div
                  initial={{ opacity: 0, y: -12, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    position: 'fixed',
                    top: '16px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 10001,
                    padding: '8px 18px',
                    borderRadius: '14px',
                    background: isForcePassAll ? 'rgba(239, 68, 68, 0.95)' : 'rgba(15, 23, 42, 0.95)',
                    border: isForcePassAll ? '1px solid rgba(239, 68, 68, 0.6)' : '1px solid rgba(56, 189, 248, 0.5)',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.6)',
                    pointerEvents: 'none',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                  }}
                >
                  {autoCloseNotice || clickThroughNotice}
                </motion.div>
              )}
            </AnimatePresence>

            {/* 1. 상단 컨트롤 툴바 (설정이 있는 메인 카드, 1:1 네이티브 드래그 & 스마트 마우스 인터랙션, 더블클릭 시 5초 임시 숨김) */}
            <LayoutGroup id="titlebar-dock">
            <div className={docked ? 'titlebar-dock' : undefined} style={docked ? {
              right: titlebar.right + 10,
              height: titlebar.height || 31,
              '--dock-scale': Math.min(1, Math.max(0.5, ((titlebar.height || 31) - 2) / 28)),
            } as React.CSSProperties : { display: 'contents' }}>
              {docked && settings.showAltering && !hiddenWidgets.has('altering') && <motion.div layout="position" ref={dockAlteringRef} className="dock-altering-region" onDoubleClick={handleDoubleClickAltering} style={{ pointerEvents: isForcePassAll ? 'none' : 'auto' }}>
                <AlteringSlotsHud docked alteringData={alteringData} visibleFacilities={settings.visibleFacilities} onRefreshRequested={refreshData} />
              </motion.div>}
              {docked && (settings.showMediaRemote ?? true) && !hiddenWidgets.has('media') && <motion.div layout="position" ref={dockMediaRef} className="dock-media-region" style={{ pointerEvents: isForcePassAll ? 'none' : 'auto' }}>
                <MediaRemoteHud docked priorityApp={settings.mediaPriorityApp || 'auto'} isForcePassAll={isForcePassAll} onDoubleClick={handleDoubleClickMedia} />
              </motion.div>}
            <AnimatePresence>
        {!hiddenWidgets.has('toolbar') && (
          <motion.div
            className={docked ? 'dock-toolbar' : undefined}
            ref={toolbarRef}
            onMouseDown={docked ? undefined : handleToolbarDrag}
            onDoubleClick={handleDoubleClickToolbar}
            title="여백 더블클릭 시 5초간 임시 숨김"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{
              position: docked ? 'relative' : 'fixed',
              top: docked ? undefined : `${toolbarPos.y / scaleFactor}px`,
              left: docked ? undefined : `${toolbarPos.x / scaleFactor}px`,
              zoom: docked ? undefined : scaleFactor,
              display: 'flex',
              alignItems: 'center',
              gap: docked ? '4px' : '8px',
              zIndex: 100,
              pointerEvents: 'auto',
              cursor: isLocked ? 'default' : 'move',
              userSelect: 'none',
            }}
          >
        {/* 브릿지 서버 연결 인디케이터 */}
        {(() => {
          const isIconOnly = docked || !!settings.toolbarIconOnly;
          // 툴바 알약형 버튼 공통 스타일
          const pill = (padding: string): React.CSSProperties => ({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: isIconOnly ? '0px' : '5px',
            padding: isIconOnly ? '0' : padding,
            width: isIconOnly ? '28px' : 'auto',
            height: '28px',
            borderRadius: isIconOnly ? '50%' : '16px',
            fontSize: '11px',
            boxSizing: 'border-box',
            flexShrink: 0,
          });
          // 완전 관통 모드에서 비활성화되는 버튼 공통 스타일
          const forcePassDisabled: React.CSSProperties = {
            cursor: isForcePassAll ? 'default' : 'pointer',
            pointerEvents: isForcePassAll ? 'none' : 'auto',
            opacity: isForcePassAll ? 0.6 : 1,
          };
          return (
            <>
              <div
                style={{
                  ...pill('5px 10px'),
                  background: docked ? 'var(--dock-card-bg)' : 'rgba(15, 23, 42, 0.85)',
                  border: isConnected ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
                  fontWeight: 600,
                  color: isConnected ? '#34d399' : '#f87171',
                }}
                title={isConnected ? 'Mabinogi Bridge 정상 연결됨' : 'Bridge 서버(포트 3001) 연결 대기 중'}
              >
                {isConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
                {!isIconOnly && <span>{isConnected ? 'Bridge 연결됨' : 'Bridge 오프라인'}</span>}
              </div>

              {/* 위치 잠금/해제 토글 버튼 */}
              <button
                onClick={toggleLock}
                disabled={isForcePassAll}
                style={{
                  ...pill('5px 12px'),
                  background: isLocked ? (docked ? 'var(--dock-card-bg)' : 'rgba(30, 41, 59, 0.85)') : 'rgba(245, 158, 11, 0.3)',
                  border: isLocked ? (docked ? '1px solid var(--dock-card-border)' : '1px solid rgba(255, 255, 255, 0.15)') : '1px solid rgba(245, 158, 11, 0.7)',
                  color: isLocked ? '#94a3b8' : '#fde047',
                  fontWeight: 700,
                  ...forcePassDisabled,
                  boxShadow: isLocked ? 'none' : '0 0 10px rgba(245, 158, 11, 0.4)',
                }}
                title={isLocked ? '위치 잠금 해제 (드래그 가능)' : '위치 고정 (잠금)'}
              >
                {isLocked ? <Lock size={13} /> : <Unlock size={13} />}
                {!isIconOnly && <span>{isLocked ? '위치 고정됨' : '위치 이동 모드'}</span>}
              </button>

              {/* 창 위치 초기화 버튼 */}
              <button
                onClick={handleResetPositions}
                disabled={isForcePassAll}
                style={{
                  ...pill('5px 10px'),
                  background: docked ? 'var(--dock-card-bg)' : 'rgba(15, 23, 42, 0.85)',
                  border: docked ? '1px solid var(--dock-card-border)' : '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#cbd5e1',
                  fontWeight: 600,
                  ...forcePassDisabled,
                }}
                title="모든 창 위치를 기본값으로 초기화"
              >
                <RotateCcw size={12} color="#94a3b8" />
                {!isIconOnly && <span>위치 초기화</span>}
              </button>

              {/* 마우스 스마트 관통 상태 표시 및 완전 잠금 토글 버튼 (완전 관통 모드 중에도 유일하게 상시 클릭 가능) */}
              <button
                id="btn-force-pass-toggle"
                onClick={toggleForcePassAll}
                style={{
                  ...pill('5px 12px'),
                  background: isForcePassAll ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.22)',
                  border: isForcePassAll ? '1.5px solid rgba(239, 68, 68, 0.9)' : '1px solid rgba(16, 185, 129, 0.6)',
                  color: isForcePassAll ? '#fecaca' : '#6ee7b7',
                  fontWeight: 700,
                  cursor: 'pointer',
                  pointerEvents: 'auto',
                  boxShadow: isForcePassAll ? '0 0 12px rgba(239, 68, 68, 0.55)' : 'none',
                  zIndex: 101,
                }}
                title={
                  isForcePassAll
                    ? '완전 관통 모드 동작 중 (클릭 시 스마트 관통 모드로 복귀, 단축키 F8)'
                    : '기본적으로 위젯 영역만 클릭되고 바탕/작업표시줄은 자동 통과됩니다. 클릭 시 위젯조차 클릭하지 않는 완전 관통 모드로 전환 (단축키 F8)'
                }
              >
                {isForcePassAll ? <Eye size={13} /> : <MousePointer size={13} />}
                {!isIconOnly && <span>{isForcePassAll ? '완전 관통 (F8)' : '스마트 관통 중'}</span>}
              </button>

              {/* 현재 연주 상시 배지 (아이콘 모드에서도 연주 제목 텍스트 상시 표시) */}
              <motion.div initial={false} animate={docked ? { width: currentEnsembleTitle || bufferingSession ? 150 : 0 } : { width: 'auto' }} transition={{ duration: 0.3, ease: 'easeInOut' }} className={docked ? 'dock-now-playing' : undefined} style={{ pointerEvents: isForcePassAll ? 'none' : 'auto', opacity: isForcePassAll ? 0.6 : 1 }}>
                {docked ? <button className="dock-song" tabIndex={currentEnsembleTitle || bufferingSession ? 0 : -1} onClick={handleOpenSettings}><DockMarquee text={currentEnsembleTitle || (bufferingSession ? '합주 조율 중…' : '')} /></button> :
                <NowPlayingBadge
                  currentTitle={currentEnsembleTitle}
                  members={currentMembers}
                  buffering={bufferingProp}
                  onClick={handleOpenSettings}
                  isIconOnly={false}
                />}
              </motion.div>

              {/* 설정 버튼 */}
              <button
                onClick={handleOpenSettings}
                disabled={isForcePassAll}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: docked ? 'var(--dock-card-bg)' : 'rgba(15, 23, 42, 0.85)',
                  border: docked ? '1px solid var(--dock-card-border)' : '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#cbd5e1',
                  ...forcePassDisabled,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  boxSizing: 'border-box',
                  flexShrink: 0,
                }}
                title="MoFo 오버레이 설정"
              >
                <Settings size={14} />
              </button>

              {/* 툴바 이동 핸들 (잠금 해제 상태일 때 맨 뒤에 노출되어 사라져도 앞쪽 요소들의 위치가 불변함) */}
              {!isLocked && !docked && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: isIconOnly ? '0px' : '3px',
                    padding: isIconOnly ? '0' : '4px 8px',
                    width: isIconOnly ? '28px' : 'auto',
                    height: '28px',
                    borderRadius: isIconOnly ? '50%' : '12px',
                    background: 'rgba(245, 158, 11, 0.95)',
                    color: '#000',
                    fontSize: '10px',
                    fontWeight: 800,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                    cursor: 'move',
                    boxSizing: 'border-box',
                    flexShrink: 0,
                  }}
                  title="툴바 이동 (드래그)"
                >
                  <GripHorizontal size={11} />
                  {!isIconOnly && <span>툴바 이동</span>}
                </div>
              )}
            </>
          );
        })()}
          </motion.div>
        )}
      </AnimatePresence>

            </div>
            </LayoutGroup>

      {/* 2. 에린 시간 배지 (1:1 정밀 네이티브 드래그 지원, 더블클릭 시 5초 임시 숨김) */}
      <AnimatePresence>
        {settings.showClock && !hiddenWidgets.has('clock') && (
          <motion.div
            ref={clockRef}
            onMouseDown={handleClockDrag}
            onDoubleClick={handleDoubleClickClock}
            title="더블클릭 시 5초간 임시 숨김"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              left: `${clockPos.x / scaleFactor}px`,
              top: `${clockPos.y / scaleFactor}px`,
              zoom: scaleFactor,
              zIndex: 95,
              pointerEvents: isForcePassAll ? 'none' : 'auto',
              cursor: isLocked ? 'default' : 'move',
              userSelect: 'none',
            }}
          >
            <div style={{ position: 'relative' }}>
              {!isLocked && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(245, 158, 11, 0.9)',
                    borderRadius: '6px',
                    padding: '1px 6px',
                    color: '#000',
                    fontSize: '9px',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    zIndex: 10,
                  }}
                >
                  <GripHorizontal size={10} />
                  <span>드래그</span>
                </div>
              )}
              <ErinnClockBadge envData={envData} slim={!!settings.clockSlim} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. 가공 시설 현황 HUD (6대 시설, 슬림 1행/2행 레이아웃, 더블클릭 시 5초 임시 숨김) */}
      <AnimatePresence>
        {!docked && settings.showAltering && !hiddenWidgets.has('altering') && (
          <motion.div
            ref={alteringRef}
            onMouseDown={handleAlteringDrag}
            onDoubleClick={handleDoubleClickAltering}
            title="더블클릭 시 5초간 임시 숨김"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              left: `${alteringPos.x / scaleFactor}px`,
              top: `${alteringPos.y / scaleFactor}px`,
              zoom: scaleFactor,
              zIndex: 90,
              pointerEvents: isForcePassAll ? 'none' : 'auto',
              cursor: isLocked ? 'default' : 'move',
              userSelect: 'none',
            }}
          >
            <div style={{ position: 'relative' }}>
              {!isLocked && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-12px',
                    left: '16px',
                    background: 'rgba(56, 189, 248, 0.9)',
                    borderRadius: '6px',
                    padding: '1px 6px',
                    color: '#000',
                    fontSize: '9px',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    zIndex: 10,
                  }}
                >
                  <GripHorizontal size={10} />
                  <span>가공 HUD 드래그</span>
                </div>
              )}
              <AlteringSlotsHud
                alteringData={alteringData}
                onRefreshRequested={refreshData}
                visibleFacilities={settings.visibleFacilities}
                layout={settings.alteringLayout}
                isLocked={isLocked}
                onToggleLayout={handleToggleAlteringLayout}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3-1. 분리된 미디어 플레이어 리모컨 위젯 (개별 독립 스케일 적용, 더블클릭 시 5초 임시 숨김) */}
      <AnimatePresence>
        {!docked && (settings.showMediaRemote ?? true) && !hiddenWidgets.has('media') && (() => {
          const mediaScaleFactor = (settings.mediaScale || 100) / 100;
          return (
            <motion.div
              ref={mediaRef}
              onMouseDown={handleMediaDrag}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              style={{
                position: 'fixed',
                left: `${mediaPos.x / mediaScaleFactor}px`,
                top: `${mediaPos.y / mediaScaleFactor}px`,
                zoom: mediaScaleFactor,
                zIndex: 88,
                pointerEvents: isForcePassAll ? 'none' : 'auto',
                cursor: isLocked ? 'default' : 'move',
                userSelect: 'none',
              }}
            >
              <div style={{ position: 'relative' }}>
                {!isLocked && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-14px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'rgba(56, 189, 248, 0.95)',
                      borderRadius: '6px',
                      padding: '1px 8px',
                      color: '#0f172a',
                      fontSize: '9.5px',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                      zIndex: 20,
                    }}
                  >
                    <GripHorizontal size={10} />
                    <span>미디어 리모컨 드래그</span>
                  </div>
                )}
                <MediaRemoteHud
                  priorityApp={settings.mediaPriorityApp || 'auto'}
                  bgOpacity={settings.mediaBgOpacity ?? 0}
                  isLocked={isLocked}
                  isForcePassAll={isForcePassAll}
                  onDoubleClick={handleDoubleClickMedia}
                />
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* 3-2. 남은 미션 HUD (일일/주간 미션 중 미완료만 축약 표시, 모든 미션 완료 시 10초 후 자동 페이드아웃, 더블클릭 시 5초 임시 숨김) */}
      <AnimatePresence>
        {(settings.showMissions ?? true) && !hiddenWidgets.has('missions') && !isMissionsAutoHidden && (
          <motion.div
            ref={missionsRef}
            onMouseDown={handleMissionsDrag}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.8, ease: 'easeInOut' } }}
            transition={{ duration: 0.25 }}
            style={{
              position: 'fixed',
              left: `${missionsPos.x / scaleFactor}px`,
              top: `${missionsPos.y / scaleFactor}px`,
              zoom: scaleFactor,
              zIndex: 87,
              pointerEvents: 'none',
              cursor: isLocked ? 'default' : 'move',
              userSelect: 'none',
            }}
          >
            <div style={{ position: 'relative' }}>
              {!isLocked && (
                <div
                  id="missions-drag-handle"
                  style={{
                    position: 'absolute',
                    top: '-13px',
                    left: '12px',
                    background: 'rgba(234, 179, 8, 0.95)',
                    borderRadius: '6px',
                    padding: '1px 7px',
                    color: '#0f172a',
                    fontSize: '9.5px',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'auto',
                    cursor: 'move',
                    zIndex: 20,
                  }}
                >
                  <GripHorizontal size={10} />
                  <span>미션 드래그</span>
                </div>
              )}
              <RemainingMissionsHud
                missionsData={missionsData}
                compact={settings.compactMode}
                bgOpacity={settings.missionsBgOpacity}
                isLocked={isLocked}
                onDoubleClick={handleDoubleClickMissions}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3-3. 원곡 찾기 위젯 (끄면 렌더링하지 않아 검색/자동 채팅 비용 0, 더블클릭 시 5초 임시 숨김) */}
      <AnimatePresence>
        {settings.showSongFinder && !hiddenWidgets.has('songFinder') && (
          <motion.div
            ref={songFinderRef}
            onMouseDown={handleSongFinderDrag}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              left: `${songFinderPos.x / scaleFactor}px`,
              top: `${songFinderPos.y / scaleFactor}px`,
              zoom: scaleFactor,
              zIndex: 86,
              pointerEvents: isForcePassAll ? 'none' : 'auto',
              cursor: isLocked ? 'default' : 'move',
              userSelect: 'none',
            }}
          >
            <div style={{ position: 'relative' }}>
              {!isLocked && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-13px',
                    left: '12px',
                    background: 'rgba(167, 139, 250, 0.95)',
                    borderRadius: '6px',
                    padding: '1px 7px',
                    color: '#0f172a',
                    fontSize: '9.5px',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    zIndex: 20,
                  }}
                >
                  <GripHorizontal size={10} />
                  <span>원곡 찾기 드래그</span>
                </div>
              )}
              <SongFinderHud
                gameTitle={myPlayingTitle}
                template={settings.songChatTemplate ?? DEFAULT_SONG_CHAT_TEMPLATE}
                autoChat={!!settings.songAutoChat}
                onToggleAutoChat={handleToggleSongAutoChat}
                isLocked={isLocked}
                isForcePassAll={isForcePassAll}
                onDoubleClick={handleDoubleClickSongFinder}
                onResolvedTitle={handleSongResolved}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. 화면 중앙 음악회 방송 연출 타이포 모션 */}
      {settings.showConcert && (
        <ConcertNotification
          containerRef={concertRef}
          activeNotice={concertNotice}
          position={concertPos}
          onPositionChange={handleConcertPositionChange}
          isLocked={isLocked}
          isClickThrough={isForcePassAll}
          motionTheme={settings.concertMotionTheme}
          bgStyle={settings.concertBgStyle}
          scale={settings.uiScale || 100}
        />
      )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. 환경 설정 모달 */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={handleCloseSettings}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onTriggerTestConcert={handleTriggerTestConcert}
        onResetPositions={handleResetPositions}
        activePreset={activePreset}
        onSelectPreset={handleSelectPreset}
      />
    </div>
  );
};
