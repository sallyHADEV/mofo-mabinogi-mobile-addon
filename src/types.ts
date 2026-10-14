export interface AlteringWorkItem {
  DisplayName: string;
  FacilityName: string;
  State: 'NotStarted' | 'InProgress' | 'Completed';
  IsCompleted: boolean;
  RemainingSeconds: number;
}

export interface AlteringWorksData {
  completedCount: number;
  works: AlteringWorkItem[];
}

export interface EnvironmentData {
  ErinnNow?: string;
  Weather?: string;
  WorldPosition?: string;
  ChannelDisplayName?: string;
  GameSpaceDisplayName?: string;
}

export interface PerformanceInfo {
  IsPlaying: boolean;
  MusicTitle?: string;
  InstrumentName?: string;
  IsCopyingAllowed?: boolean;
  IsLoop?: boolean;
  StartAt?: string;
  TotalDurationSeconds?: number;
  ElapsedSeconds?: number;
  RemainingSeconds?: number;
  ChannelCount?: number;
}

export interface NearPlayer {
  RealmName?: string;
  Title?: string;
  DisplayName?: string;
  CharacterName?: string;
  Distance?: number;
  Level?: number;
  Performance?: PerformanceInfo;
}

export interface ActivityData {
  Performance?: PerformanceInfo;
  AutoPlay?: {
    IsAutoPlaying: boolean;
    AutoPlayTargetDisplayName?: string;
  };
}

export interface EnsembleMember {
  name: string;
  instrument?: string;
  elapsedSeconds?: number;
  totalDurationSeconds?: number;
}

export interface EnsembleSession {
  id: string;
  title: string;
  members: EnsembleMember[];
  startedAt: number;
  isBuffering: boolean;
}

export type FacilityKey = 'metal' | 'wood' | 'leather' | 'cloth' | 'medicine' | 'food';
export type ConcertMotionTheme = 'cinematic' | 'vineBloom' | 'arcaneRune' | 'auroraPrism' | 'ornamentUnfold' | 'branchGrow' | 'pearlBlossom';
export type ConcertBgStyle = 'translucent' | 'opaque';
export type AlteringLayout = '1row' | '2row' | 'slim';
export type UiScale = 75 | 100 | 150 | 200;

export interface WidgetPosition {
  x: number;
  y: number;
}

export interface OverlaySettings {
  titlebarDocked?: boolean;
  ensembleDelaySeconds: number; // 합주 집계 대기 딜레이 (기본 4초)
  noticeDisplaySeconds: number; // 중앙 타이포 표시 유지 시간 (기본 8초)
  showAltering: boolean;        // 가공기 슬롯 표시 여부
  showClock: boolean;           // 에린 시간 표시 여부
  clockSlim?: boolean;          // 에린 시계 슬림(도킹 버튼 높이) 모드
  showConcert: boolean;         // 음악회 타이포 표시 여부
  compactMode: boolean;         // 미니멀 모드
  opacity: number;              // 전체 투명도 (0.1 ~ 1.0)
  isPositionLocked: boolean;    // 위치 고정(잠금) 여부
  clockPosition: WidgetPosition; // 에린 시계 위치
  alteringPosition: WidgetPosition; // 가공기 슬롯 위치
  concertPosition: WidgetPosition;  // 음악회 타이포 알림 위치
  toolbarPosition: WidgetPosition;  // 기본 툴바 정보창 위치
  visibleFacilities: Record<FacilityKey, boolean>; // 가공 6개 시설 개별 표시 여부
  alteringLayout: AlteringLayout;    // 가공 현황 표시 형태 (1행 / 2행 / 슬림=도킹 디자인)
  concertMotionTheme: ConcertMotionTheme; // 음악회 모션 디자인 테마
  concertBgStyle: ConcertBgStyle;         // 음악회 배경 스타일 (반투명 vs 불투명)
  toolbarIconOnly?: boolean;              // 메인 툴바 아이콘 전용 모드 (글자 숨김)
  uiScale?: UiScale;                      // 전체 UI 배율 (75, 100, 150, 200)
  showMediaRemote?: boolean;              // 미디어 리모컨 표시 여부
  mediaPosition?: WidgetPosition;         // 미디어 리모컨 위치
  mediaPriorityApp?: MediaPriorityApp;    // 미디어 우선순위 타깃 앱 ('auto' | 'spotify' | 'ytmusic' | 'chrome' | 'edge')
  mediaBgOpacity?: number;                // 미디어 카드 배경 불투명도 (0 ~ 100%, 기본 0: 완전 투명)
  mediaScale?: number;                    // 미디어 리모컨 전용 스케일 배율 (기본 100)
  showMissions?: boolean;                 // 남은 미션 패널 표시 여부
  missionsPosition?: WidgetPosition;      // 남은 미션 패널 위치
  missionsBgOpacity?: number;             // 남은 미션 카드 배경 불투명도 (0 ~ 100%, 기본 82)
  showInTaskbar?: boolean;                // 윈도우 작업표시줄 표시 여부 (체크 시 표시, 기본 false)
  autoCloseWithGame?: boolean;            // 마비노기 종료 감지 시 6초 후 오버레이 자동 종료 여부
  showSongFinder?: boolean;               // 원곡 찾기 위젯 표시 여부 (끄면 검색/채팅 기능 완전 정지)
  songFinderPosition?: WidgetPosition;    // 원곡 찾기 위젯 위치
  songChatTemplate?: string;              // 채팅 템플릿 ({artist}, {title}, {game} 치환)
  songAutoChat?: boolean;                 // 곡이 바뀌면 1순위 후보를 자동으로 채팅
}

export interface MediaState {
  is_available: boolean;
  title: string;
  artist: string;
  album_title: string;
  is_playing: boolean;
  can_play_pause: boolean;
  can_skip_next: boolean;
  can_skip_prev: boolean;
  thumbnail_base64: string | null;
  source_app_id: string;
}

// 외부 음원 검색 결과 (FLO / iTunes US·JP / Deezer)
export interface SongCandidate {
  artist: string;
  title: string;
  source: 'flo' | 'itunes' | 'deezer';
}

export type MediaPriorityApp = 'auto' | 'spotify' | 'ytmusic' | 'chrome' | 'edge';

export interface MissionItem {
  Title: string;
  Description: string;
  CurrentCount: number;
  GoalCount: number;
  IsCompleted: boolean;
  IsRewardReceived: boolean;
  HasShortcut: boolean;
}

export interface MissionsData {
  daily: MissionItem[];
  weekly: MissionItem[];
}

export type PresetId = 1 | 2 | 3;
export type OverlayPresets = Record<PresetId, OverlaySettings>;
