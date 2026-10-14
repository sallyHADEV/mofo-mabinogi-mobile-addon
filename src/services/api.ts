import type {
  AlteringWorksData,
  EnvironmentData,
  NearPlayer,
  ActivityData,
  MediaState,
  MissionItem,
  MissionsData,
  SongCandidate,
} from '../types.js';

interface CliResult<T = any> {
  success: boolean;
  exitCode?: number;
  data?: T;
  error?: any;
  rawStdout?: string;
}

type TauriCore = typeof import('@tauri-apps/api/core');
let tauriCoreCache: Promise<TauriCore> | null = null;

async function getTauriCore(): Promise<TauriCore | null> {
  if (!tauriCoreCache) {
    tauriCoreCache = import('@tauri-apps/api/core');
  }
  try {
    return await tauriCoreCache;
  } catch {
    return null;
  }
}

// Tauri invoke 동적 로더 (Tauri 내장 CLI 직접 호출)
async function callTauriCli<T>(command: string, body?: any): Promise<CliResult<T> | null> {
  try {
    const core = await getTauriCore();
    if (!core) return null;
    return await core.invoke<CliResult<T>>('execute_mabinogi_cli', { command, body: body ?? null });
  } catch {
    return null;
  }
}

const API_BASE = 'http://localhost:3001/api';

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 2500): Promise<Response> {
  const signal = init?.signal ?? AbortSignal.timeout(timeoutMs);
  return fetch(input, { ...init, signal });
}

export async function fetchAlteringWorks(): Promise<{ success: boolean; data?: AlteringWorksData }> {
  // 1. Tauri 내장 네이티브 CLI 직접 통신 (브릿지 서버 불필요)
  const tauriRes = await callTauriCli<AlteringWorksData>('get_altering_works');
  if (tauriRes) {
    return { success: tauriRes.success, data: tauriRes.data };
  }

  // 2. 웹 브라우저 등 비-Tauri 환경용 HTTP 폴백
  try {
    const res = await fetchWithTimeout(`${API_BASE}/alter/works`);
    if (!res.ok) return { success: false };
    const json = await res.json();
    return { success: json.success, data: json.data };
  } catch {
    return { success: false };
  }
}

export async function fetchEnvironment(): Promise<{ success: boolean; data?: EnvironmentData }> {
  // 1. Tauri 내장 네이티브 CLI 직접 통신
  const tauriRes = await callTauriCli<EnvironmentData>('get_current_environment');
  if (tauriRes) {
    return { success: tauriRes.success, data: tauriRes.data };
  }

  // 2. HTTP 폴백
  try {
    const res = await fetchWithTimeout(`${API_BASE}/environment`);
    if (!res.ok) return { success: false };
    const json = await res.json();
    return { success: json.success, data: json.data };
  } catch {
    return { success: false };
  }
}

export async function fetchNearPlayers(): Promise<{ success: boolean; data?: NearPlayer[] }> {
  // 1. Tauri 내장 네이티브 CLI 직접 통신
  const tauriRes = await callTauriCli<any>('get_near_pcs');
  if (tauriRes) {
    let rawList: NearPlayer[] = [];
    if (Array.isArray(tauriRes.data)) {
      rawList = tauriRes.data;
    } else if (Array.isArray(tauriRes.data?.body)) {
      rawList = tauriRes.data.body;
    }
    const list = [...rawList];
    list.sort((a, b) => (a.Distance ?? 0) - (b.Distance ?? 0));
    return { success: tauriRes.success, data: list };
  }

  // 2. HTTP 폴백
  try {
    const res = await fetchWithTimeout(`${API_BASE}/near/pcs`);
    if (!res.ok) return { success: false };
    const json = await res.json();
    return { success: json.success, data: json.data };
  } catch {
    return { success: false };
  }
}

export async function fetchActivity(): Promise<{ success: boolean; data?: ActivityData }> {
  // 1. Tauri 내장 네이티브 CLI 직접 통신
  const tauriRes = await callTauriCli<ActivityData>('get_activity');
  if (tauriRes) {
    return { success: tauriRes.success, data: tauriRes.data };
  }

  // 2. HTTP 폴백
  try {
    const res = await fetchWithTimeout(`${API_BASE}/activity`);
    if (!res.ok) return { success: false };
    const json = await res.json();
    return { success: json.success, data: json.data };
  } catch {
    return { success: false };
  }
}

export async function completeAlteringWork(displayName: string): Promise<{ success: boolean; message?: string }> {
  // 1. Tauri 내장 네이티브 CLI 직접 통신
  const tauriRes = await callTauriCli<any>('complete_altering_work', { displayName });
  if (tauriRes) {
    const message = tauriRes.data?.message || tauriRes.data?.body?.message || tauriRes.error?.message;
    return { success: tauriRes.success, message };
  }

  // 2. HTTP 폴백
  try {
    const res = await fetchWithTimeout(`${API_BASE}/alter/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName }),
    });
    const json = await res.json();
    return { success: json.success, message: json.data?.message || json.message || json.error?.message };
  } catch {
    return { success: false };
  }
}

export async function fetchMediaState(priorityApp?: string): Promise<MediaState | null> {
  try {
    const core = await getTauriCore();
    if (!core) return null;
    return await core.invoke<MediaState>('get_media_state', { priorityApp: priorityApp ?? 'auto' });
  } catch {
    return null;
  }
}

export async function toggleMediaPlayPause(priorityApp?: string): Promise<boolean> {
  try {
    const core = await getTauriCore();
    if (!core) return false;
    return await core.invoke<boolean>('media_toggle_play_pause', { priorityApp: priorityApp ?? 'auto' });
  } catch {
    return false;
  }
}

export async function skipMediaNext(priorityApp?: string): Promise<boolean> {
  try {
    const core = await getTauriCore();
    if (!core) return false;
    return await core.invoke<boolean>('media_skip_next', { priorityApp: priorityApp ?? 'auto' });
  } catch {
    return false;
  }
}

export async function skipMediaPrevious(priorityApp?: string): Promise<boolean> {
  try {
    const core = await getTauriCore();
    if (!core) return false;
    return await core.invoke<boolean>('media_skip_previous', { priorityApp: priorityApp ?? 'auto' });
  } catch {
    return false;
  }
}

export async function fetchMasterVolume(): Promise<number | null> {
  try {
    const core = await getTauriCore();
    if (!core) return null;
    return await core.invoke<number>('get_master_volume');
  } catch {
    return null;
  }
}

export async function updateMasterVolume(level: number): Promise<boolean> {
  try {
    const core = await getTauriCore();
    if (!core) return false;
    await core.invoke('set_master_volume', { level: Math.round(level) });
    return true;
  } catch {
    return false;
  }
}

// 외부 음원 검색 (Rust에서 iTunes KR → Deezer 순으로 호출, 키 불필요)
export async function searchSong(query: string): Promise<SongCandidate[] | null> {
  try {
    const core = await getTauriCore();
    if (!core) return null;
    return await core.invoke<SongCandidate[]>('search_song', { query });
  } catch {
    return null;
  }
}

// 게임 채팅 전송 (write_chat, 최대 50자)
export async function sendGameChat(
  message: string
): Promise<{ success: boolean; code?: string; message?: string; retryAfterSeconds?: number }> {
  const res = await callTauriCli<any>('write_chat', message);
  if (!res) return { success: false, code: 'unavailable', message: '게임 클라이언트와 통신할 수 없습니다.' };
  if (res.success) return { success: true };
  const body = res.data?.body ?? res.data;
  return {
    success: false,
    code: res.error?.code ?? res.error?.reason,
    message: res.error?.message,
    retryAfterSeconds: typeof body?.retryAfterSeconds === 'number' ? body.retryAfterSeconds : undefined,
  };
}

// 미션 데이터 캐시 및 서버 이동/로딩 시 일시적 단절/빈 데이터 방어
let lastValidMissionsCache: MissionsData | null = null;
let consecutiveEmptyMissionCount = 0;
let consecutiveFailureCount = 0;

export async function fetchMissions(): Promise<{ success: boolean; data?: MissionsData }> {
  let fetchedData: MissionsData | null = null;

  // 1. Tauri 내장 네이티브 CLI 직접 통신
  const [dailyRes, weeklyRes] = await Promise.all([
    callTauriCli<any>('get_daily_missions'),
    callTauriCli<any>('get_weekly_missions'),
  ]);

  if ((dailyRes && dailyRes.success) || (weeklyRes && weeklyRes.success)) {
    // 부분 실패 시 기존 유효 캐시의 해당 목록을 유지하여 캐시 파괴 방지
    const extractList = (res: CliResult<any> | null, fallbackList: MissionItem[] = []): MissionItem[] => {
      if (!res?.success || !res?.data) return fallbackList;
      if (Array.isArray(res.data)) return res.data;
      if (Array.isArray(res.data.body)) return res.data.body;
      return fallbackList;
    };

    const dailyData = extractList(dailyRes, lastValidMissionsCache?.daily ?? []);
    const weeklyData = extractList(weeklyRes, lastValidMissionsCache?.weekly ?? []);

    fetchedData = {
      daily: dailyData,
      weekly: weeklyData,
    };
  } else if (!dailyRes && !weeklyRes) {
    // 2. HTTP 폴백 (비-Tauri 환경에서만)
    try {
      const res = await fetchWithTimeout(`${API_BASE}/missions`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          fetchedData = json.data;
        }
      }
    } catch {}
  }

  // 3. 서버 이동 / 채널 로딩 시 일시적 단절 및 빈 배열 방어 로직:
  if (fetchedData) {
    consecutiveFailureCount = 0;
    const hasItems = (fetchedData.daily?.length || 0) > 0 || (fetchedData.weekly?.length || 0) > 0;
    if (hasItems) {
      // 유효한 미션이 수신됨 -> 캐시 갱신 및 카운트 초기화
      consecutiveEmptyMissionCount = 0;
      lastValidMissionsCache = fetchedData;
      return { success: true, data: fetchedData };
    }

    // 데이터가 성공 응답이지만 일일/주간 모두 비어있는 경우 (daily: [], weekly: [])
    if (
      lastValidMissionsCache &&
      ((lastValidMissionsCache.daily?.length || 0) > 0 || (lastValidMissionsCache.weekly?.length || 0) > 0)
    ) {
      consecutiveEmptyMissionCount += 1;
      // 서버 이동/채널 로딩 중에는 약 6초(폴링 4회) 동안 빈 배열이 일시 반환될 수 있음 -> 직전 캐시 유지
      if (consecutiveEmptyMissionCount < 5) {
        return { success: true, data: lastValidMissionsCache };
      }
    }

    // 실제로 5회 이상 빈 상태가 지속되면 실제 빈 배열 반영
    lastValidMissionsCache = fetchedData;
    return { success: true, data: fetchedData };
  }

  // 통신 자체가 완전히 실패한 경우 (마비노기 종료 또는 IPC 단절):
  consecutiveFailureCount += 1;
  // 단절 직후 2회(약 3초) 동안만 직전 캐시를 임시 반환하여 네트워크 지터 방어
  if (consecutiveFailureCount <= 2 && lastValidMissionsCache) {
    return { success: true, data: lastValidMissionsCache };
  }

  // 3회 이상(약 4.5초) 연속 실패 시 캐시를 무효화하고 실제 실패(success: false)를 반환하여
  // 게임 종료 감지 및 자동 종료 타이머가 정상 동작하도록 보장
  lastValidMissionsCache = null;
  return { success: false };
}

