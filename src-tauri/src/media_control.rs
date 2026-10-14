use base64::Engine;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSession,
    GlobalSystemMediaTransportControlsSessionManager,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus,
};
use windows::Storage::Streams::DataReader;

type ThumbnailCacheKey = (String, String, String);
static THUMBNAIL_CACHE: Mutex<Option<(ThumbnailCacheKey, Option<String>)>> = Mutex::new(None);

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MediaState {
    pub is_available: bool,
    pub title: String,
    pub artist: String,
    pub album_title: String,
    pub is_playing: bool,
    pub can_play_pause: bool,
    pub can_skip_next: bool,
    pub can_skip_prev: bool,
    pub thumbnail_base64: Option<String>,
    pub source_app_id: String,
}

/// 특정 세션의 가중치 점수를 계산하여 가장 적합한 세션을 우선 선정합니다.
fn calculate_session_score(
    session: &GlobalSystemMediaTransportControlsSession,
    priority_app: &str,
) -> i32 {
    let mut score = 0;

    let app_id = session
        .SourceAppUserModelId()
        .map(|s| s.to_string().to_lowercase())
        .unwrap_or_default();

    let is_playing = session
        .GetPlaybackInfo()
        .map(|info| {
            info.PlaybackStatus()
                .map(|status| status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing)
                .unwrap_or(false)
        })
        .unwrap_or(false);

    // 1. 현재 실제 소리가 나고 있는(Playing) 세션에 큰 가중치
    if is_playing {
        score += 500;
    }

    let p = priority_app.trim().to_lowercase();
    let is_user_priority_set = !p.is_empty() && p != "auto";

    if is_user_priority_set {
        // 사용자가 설정창에서 직접 선택한 타깃 앱이 1순위 (+2000점)
        let matches_user_choice = match p.as_str() {
            "spotify" => app_id.contains("spotify"),
            "ytmusic" | "youtube" | "youtubemusic" => {
                app_id.contains("chrome")
                    || app_id.contains("edge")
                    || app_id.contains("brave")
                    || app_id.contains("whale")
                    || app_id.contains("youtube")
            }
            "chrome" => app_id.contains("chrome"),
            "edge" | "msedge" => app_id.contains("edge"),
            _ => app_id.contains(&p),
        };

        if matches_user_choice {
            score += 2000;
        }
    } else {
        // 기본 스마트 가중치:
        // 1) Spotify
        if app_id.contains("spotify") {
            score += 300;
        }
        // 2) 브라우저 기반 미디어(YouTube Music 등)
        else if app_id.contains("chrome")
            || app_id.contains("msedge")
            || app_id.contains("edge")
            || app_id.contains("whale")
            || app_id.contains("brave")
        {
            score += 200;
        }
        // 3) 기타 일반 미디어
        else {
            score += 100;
        }
    }

    score
}

/// 활성화된 세션 중 우선순위가 가장 높은 세션을 선택합니다.
fn get_best_session(
    manager: &GlobalSystemMediaTransportControlsSessionManager,
    priority_app: &str,
) -> Option<GlobalSystemMediaTransportControlsSession> {
    let sessions = manager.GetSessions().ok()?;
    let mut best_session: Option<GlobalSystemMediaTransportControlsSession> = None;
    let mut best_score = -1;

    for s in sessions {
        let score = calculate_session_score(&s, priority_app);
        if score > best_score {
            best_score = score;
            best_session = Some(s);
        }
    }

    // 세션 목록에서 못 찾은 경우 OS 기본 현재 세션으로 폴백
    best_session.or_else(|| manager.GetCurrentSession().ok())
}

/// 현재 미디어 정보 및 썸네일을 조회합니다.
pub fn fetch_media_state(priority_app: Option<String>) -> Result<MediaState, String> {
    let _com_guard = ComGuard::new();
    let priority = priority_app.unwrap_or_else(|| "auto".to_string());

    let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
        .map_err(|e| format!("SMTC RequestAsync error: {}", e))?
        .get()
        .map_err(|e| format!("SMTC SessionManager get error: {}", e))?;

    let session = match get_best_session(&manager, &priority) {
        Some(s) => s,
        None => return Ok(MediaState::default()),
    };

    let app_id = session
        .SourceAppUserModelId()
        .map(|s| s.to_string())
        .unwrap_or_default();

    let playback_info = session.GetPlaybackInfo().ok();
    let is_playing = playback_info
        .as_ref()
        .and_then(|info| info.PlaybackStatus().ok())
        .map(|status| status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing)
        .unwrap_or(false);

    let controls = playback_info.and_then(|info| info.Controls().ok());
    let can_play_pause = controls
        .as_ref()
        .map(|c| c.IsPlayPauseToggleEnabled().unwrap_or(true))
        .unwrap_or(true);
    let can_skip_next = controls
        .as_ref()
        .map(|c| c.IsNextEnabled().unwrap_or(true))
        .unwrap_or(true);
    let can_skip_prev = controls
        .as_ref()
        .map(|c| c.IsPreviousEnabled().unwrap_or(true))
        .unwrap_or(true);

    let media_props = session
        .TryGetMediaPropertiesAsync()
        .map_err(|e| e.to_string())?
        .get()
        .map_err(|e| e.to_string())?;

    let title = media_props.Title().map(|s| s.to_string()).unwrap_or_default();
    let artist = media_props.Artist().map(|s| s.to_string()).unwrap_or_default();
    let album_title = media_props.AlbumTitle().map(|s| s.to_string()).unwrap_or_default();

    // 썸네일 캐시: (source_app_id, artist, title) 키 기반 캐싱 (곡 변경 시에만 재인코딩)
    let cache_key = (app_id.clone(), artist.clone(), title.clone());
    let mut thumbnail_base64: Option<String> = None;

    let cached_thumb = match THUMBNAIL_CACHE.lock() {
        Ok(guard) => guard.as_ref().and_then(|(k, v)| if k == &cache_key { Some(v.clone()) } else { None }),
        Err(p) => p.into_inner().as_ref().and_then(|(k, v)| if k == &cache_key { Some(v.clone()) } else { None }),
    };

    if let Some(cached) = cached_thumb {
        thumbnail_base64 = cached;
    } else {
        // 썸네일 스트림 추출 및 Base64 인코딩
        if let Ok(thumb_ref) = media_props.Thumbnail() {
            if let Ok(stream_op) = thumb_ref.OpenReadAsync() {
                if let Ok(stream) = stream_op.get() {
                    if let Ok(size) = stream.Size() {
                        if size > 0 && size < 10 * 1024 * 1024 {
                            if let Ok(reader) = DataReader::CreateDataReader(&stream) {
                                if reader.LoadAsync(size as u32).and_then(|op| op.get()).is_ok() {
                                    let mut buffer = vec![0u8; size as usize];
                                    if reader.ReadBytes(&mut buffer).is_ok() {
                                        let encoded = base64::engine::general_purpose::STANDARD.encode(&buffer);
                                        thumbnail_base64 = Some(format!("data:image/jpeg;base64,{}", encoded));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        match THUMBNAIL_CACHE.lock() {
            Ok(mut guard) => *guard = Some((cache_key, thumbnail_base64.clone())),
            Err(p) => *p.into_inner() = Some((cache_key, thumbnail_base64.clone())),
        }
    }

    Ok(MediaState {
        is_available: !title.is_empty() || is_playing,
        title,
        artist,
        album_title,
        is_playing,
        can_play_pause,
        can_skip_next,
        can_skip_prev,
        thumbnail_base64,
        source_app_id: app_id,
    })
}

/// 미디어 재생/일시정지 토글
pub fn toggle_play_pause(priority_app: Option<String>) -> Result<bool, String> {
    let _com_guard = ComGuard::new();
    let priority = priority_app.unwrap_or_else(|| "auto".to_string());
    let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
        .map_err(|e| e.to_string())?
        .get()
        .map_err(|e| e.to_string())?;

    let session = get_best_session(&manager, &priority)
        .ok_or_else(|| "활성 미디어 세션을 찾을 수 없습니다.".to_string())?;

    let res = session
        .TryTogglePlayPauseAsync()
        .map_err(|e| e.to_string())?
        .get()
        .map_err(|e| e.to_string())?;

    Ok(res)
}

/// 다음곡 건너뛰기
pub fn skip_next(priority_app: Option<String>) -> Result<bool, String> {
    let _com_guard = ComGuard::new();
    let priority = priority_app.unwrap_or_else(|| "auto".to_string());
    let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
        .map_err(|e| e.to_string())?
        .get()
        .map_err(|e| e.to_string())?;

    let session = get_best_session(&manager, &priority)
        .ok_or_else(|| "활성 미디어 세션을 찾을 수 없습니다.".to_string())?;

    let res = session
        .TrySkipNextAsync()
        .map_err(|e| e.to_string())?
        .get()
        .map_err(|e| e.to_string())?;

    Ok(res)
}

/// 이전곡 건너뛰기
pub fn skip_previous(priority_app: Option<String>) -> Result<bool, String> {
    let _com_guard = ComGuard::new();
    let priority = priority_app.unwrap_or_else(|| "auto".to_string());
    let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
        .map_err(|e| e.to_string())?
        .get()
        .map_err(|e| e.to_string())?;

    let session = get_best_session(&manager, &priority)
        .ok_or_else(|| "활성 미디어 세션을 찾을 수 없습니다.".to_string())?;

    let res = session
        .TrySkipPreviousAsync()
        .map_err(|e| e.to_string())?
        .get()
        .map_err(|e| e.to_string())?;

    Ok(res)
}

/// RAII 기반 COM 라이브러리 초기화 및 자동 해제 가드
struct ComGuard {
    initialized: bool,
}

impl ComGuard {
    fn new() -> Self {
        unsafe {
            use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};
            let hr = CoInitializeEx(None, COINIT_MULTITHREADED);
            Self {
                initialized: hr.is_ok(),
            }
        }
    }
}

impl Drop for ComGuard {
    fn drop(&mut self) {
        if self.initialized {
            unsafe {
                use windows::Win32::System::Com::CoUninitialize;
                CoUninitialize();
            }
        }
    }
}

/// 시스템 마스터 볼륨 조회 (0 ~ 100 정수 퍼센트)
pub fn get_master_volume() -> Result<u32, String> {
    use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
    use windows::Win32::Media::Audio::{eMultimedia, eRender, IMMDeviceEnumerator, MMDeviceEnumerator};
    use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_ALL};

    let _com_guard = ComGuard::new();

    unsafe {
        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
            .map_err(|e| format!("IMMDeviceEnumerator error: {}", e))?;
        let device = enumerator
            .GetDefaultAudioEndpoint(eRender, eMultimedia)
            .map_err(|e| format!("GetDefaultAudioEndpoint error: {}", e))?;
        let endpoint_volume: IAudioEndpointVolume = device
            .Activate(CLSCTX_ALL, None)
            .map_err(|e| format!("Activate IAudioEndpointVolume error: {}", e))?;

        let scalar = endpoint_volume
            .GetMasterVolumeLevelScalar()
            .map_err(|e| format!("GetMasterVolumeLevelScalar error: {}", e))?;

        Ok((scalar * 100.0).round() as u32)
    }
}

/// 시스템 마스터 볼륨 설정 (0 ~ 100 정수 퍼센트)
pub fn set_master_volume(level_percent: u32) -> Result<(), String> {
    use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
    use windows::Win32::Media::Audio::{eMultimedia, eRender, IMMDeviceEnumerator, MMDeviceEnumerator};
    use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_ALL};

    let scalar = (level_percent.min(100) as f32) / 100.0;
    let _com_guard = ComGuard::new();

    unsafe {
        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
            .map_err(|e| format!("IMMDeviceEnumerator error: {}", e))?;
        let device = enumerator
            .GetDefaultAudioEndpoint(eRender, eMultimedia)
            .map_err(|e| format!("GetDefaultAudioEndpoint error: {}", e))?;
        let endpoint_volume: IAudioEndpointVolume = device
            .Activate(CLSCTX_ALL, None)
            .map_err(|e| format!("Activate IAudioEndpointVolume error: {}", e))?;

        endpoint_volume
            .SetMasterVolumeLevelScalar(scalar, std::ptr::null())
            .map_err(|e| format!("SetMasterVolumeLevelScalar error: {}", e))?;

        Ok(())
    }
}
