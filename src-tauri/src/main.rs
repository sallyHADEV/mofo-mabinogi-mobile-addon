#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, State};

// Physical pixels, updated by the window tracker (also available before the UI subscribes).
static TITLEBAR_GEOMETRY: Mutex<(u32, u32)> = Mutex::new((0, 0));

#[tauri::command]
fn get_titlebar_geometry() -> (u32, u32) {
    match TITLEBAR_GEOMETRY.lock() {
        Ok(guard) => *guard,
        Err(p) => *p.into_inner(),
    }
}

#[derive(Clone, serde::Deserialize, serde::Serialize, Debug)]
pub struct InteractiveRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

pub struct AppState {
    pub force_pass_all: Arc<AtomicBool>,
    pub is_currently_ignoring: Arc<AtomicBool>,
    pub is_mabi_minimized: Arc<AtomicBool>,
    pub is_mabi_running: Arc<AtomicBool>,
    pub is_running: Arc<AtomicBool>,
    pub interactive_rects: Arc<Mutex<Vec<InteractiveRect>>>,
    pub force_pass_exceptions: Arc<Mutex<Vec<InteractiveRect>>>,
}

#[repr(C)]
struct Point {
    x: i32,
    y: i32,
}

#[link(name = "user32")]
extern "system" {
    fn GetCursorPos(lpPoint: *mut Point) -> i32;
    fn GetAsyncKeyState(vKey: i32) -> i16;
    fn ScreenToClient(hwnd: isize, lpPoint: *mut Point) -> i32;
}

#[tauri::command]
fn set_click_through(
    window: tauri::WebviewWindow,
    state: State<'_, AppState>,
    ignore: bool,
) -> Result<(), String> {
    state.force_pass_all.store(ignore, Ordering::Relaxed);
    if ignore {
        state.is_currently_ignoring.store(true, Ordering::Relaxed);
        window.set_ignore_cursor_events(true).map_err(|e| e.to_string())
    } else {
        // 스마트 감시 모드로 복귀 (즉각 커서 위치 판별)
        Ok(())
    }
}

mod mabi_cli;
use mabi_cli::{run_mabinogi_cli, CliResponse};

mod media_control;
use media_control::MediaState;

mod song_search;

mod diag;

#[tauri::command]
async fn search_song(query: String) -> Result<Vec<song_search::SongCandidate>, String> {
    tauri::async_runtime::spawn_blocking(move || song_search::search_song(&query))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn get_media_state(priority_app: Option<String>) -> Result<MediaState, String> {
    tauri::async_runtime::spawn_blocking(move || {
        media_control::fetch_media_state(priority_app)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn media_toggle_play_pause(priority_app: Option<String>) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        media_control::toggle_play_pause(priority_app)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn media_skip_next(priority_app: Option<String>) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        media_control::skip_next(priority_app)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn media_skip_previous(priority_app: Option<String>) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        media_control::skip_previous(priority_app)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn get_master_volume() -> Result<u32, String> {
    tauri::async_runtime::spawn_blocking(|| {
        media_control::get_master_volume()
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn set_master_volume(level: u32) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        media_control::set_master_volume(level)
    })
    .await
    .map_err(|e| e.to_string())?
}

const ALLOWED_MABI_COMMANDS: &[&str] = &[
    "get_current_environment",
    "get_altering_works",
    "get_near_pcs",
    "get_activity",
    "get_daily_missions",
    "get_weekly_missions",
    "complete_altering_work",
    "write_chat",
];

#[tauri::command]
async fn execute_mabinogi_cli(
    command: String,
    body: Option<serde_json::Value>,
) -> Result<CliResponse, String> {
    if !ALLOWED_MABI_COMMANDS.contains(&command.as_str()) {
        return Err(format!("허용되지 않은 CLI 명령어입니다: {}", command));
    }

    tauri::async_runtime::spawn_blocking(move || {
        run_mabinogi_cli(&command, body)
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_mabi_minimized(state: State<'_, AppState>) -> bool {
    state.is_mabi_minimized.load(Ordering::Relaxed)
}

#[tauri::command]
fn get_mabi_running(state: State<'_, AppState>) -> bool {
    state.is_mabi_running.load(Ordering::Relaxed)
}

#[tauri::command]
fn set_show_in_taskbar(window: tauri::WebviewWindow, show: bool) -> Result<(), String> {
    window.set_skip_taskbar(!show).map_err(|e| e.to_string())
}

#[tauri::command]
fn exit_app(app_handle: tauri::AppHandle) {
    diag::log("exit_app called by frontend");
    app_handle.exit(0);
}

#[tauri::command]
fn set_interactive_rects(
    state: State<'_, AppState>,
    rects: Vec<InteractiveRect>,
    force_pass_exceptions: Option<Vec<InteractiveRect>>,
) -> Result<(), String> {
    let mut lock = state.interactive_rects.lock().map_err(|e| e.to_string())?;
    *lock = rects;
    if let Some(exceptions) = force_pass_exceptions {
        let mut exc_lock = state.force_pass_exceptions.lock().map_err(|e| e.to_string())?;
        *exc_lock = exceptions;
    }
    Ok(())
}

#[cfg(target_os = "windows")]
pub mod win_monitor {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;
    use std::time::Duration;
    use tauri::{Emitter, WebviewWindow};
    use super::Point;

    #[repr(C)]
    struct ProcessEntry32W {
        dw_size: u32,
        cnt_usage: u32,
        th32_process_id: u32,
        th32_default_heap_id: usize,
        th32_module_id: u32,
        cnt_threads: u32,
        th32_parent_process_id: u32,
        pc_pri_class_base: i32,
        dw_flags: u32,
        sz_exe_file: [u16; 260],
    }

    #[repr(C)]
    #[derive(Clone, Copy, Debug, PartialEq, Eq)]
    pub struct RECT {
        pub left: i32,
        pub top: i32,
        pub right: i32,
        pub bottom: i32,
    }

    #[link(name = "user32")]
    extern "system" {
        fn EnumWindows(lpEnumFunc: Option<unsafe extern "system" fn(hwnd: isize, l_param: isize) -> i32>, l_param: isize) -> i32;
        fn GetWindowThreadProcessId(hwnd: isize, lpdwProcessId: *mut u32) -> u32;
        fn IsIconic(hwnd: isize) -> i32;
        fn IsWindow(hwnd: isize) -> i32;
        fn IsWindowVisible(hwnd: isize) -> i32;
        fn GetWindowTextLengthW(hwnd: isize) -> i32;
        fn GetClientRect(hwnd: isize, lpRect: *mut RECT) -> i32;
        fn ClientToScreen(hwnd: isize, lpPoint: *mut Point) -> i32;
        fn GetWindowRect(hwnd: isize, rect: *mut RECT) -> i32;
        fn GetDpiForWindow(hwnd: isize) -> u32;
    }

    const DWMWA_CAPTION_BUTTON_BOUNDS: u32 = 5;
    const DWMWA_EXTENDED_FRAME_BOUNDS: u32 = 9;
    const DWMWA_CLOAKED: u32 = 14;

    #[link(name = "dwmapi")]
    extern "system" {
        fn DwmGetWindowAttribute(hwnd: isize, attribute: u32, value: *mut std::ffi::c_void, size: u32) -> i32;
    }

    #[link(name = "kernel32")]
    extern "system" {
        fn CreateToolhelp32Snapshot(dw_flags: u32, th32_process_id: u32) -> isize;
        fn Process32FirstW(h_snapshot: isize, lppe: *mut ProcessEntry32W) -> i32;
        fn Process32NextW(h_snapshot: isize, lppe: *mut ProcessEntry32W) -> i32;
        fn CloseHandle(h_object: isize) -> i32;
    }

    pub fn find_mabi_pid() -> Option<u32> {
        const TH32CS_SNAPPROCESS: u32 = 0x00000002;
        unsafe {
            let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
            if snapshot == -1 || snapshot == 0 {
                return None;
            }

            let mut entry = ProcessEntry32W {
                dw_size: std::mem::size_of::<ProcessEntry32W>() as u32,
                cnt_usage: 0,
                th32_process_id: 0,
                th32_default_heap_id: 0,
                th32_module_id: 0,
                cnt_threads: 0,
                th32_parent_process_id: 0,
                pc_pri_class_base: 0,
                dw_flags: 0,
                sz_exe_file: [0u16; 260],
            };

            let mut target_pid = None;
            if Process32FirstW(snapshot, &mut entry) != 0 {
                loop {
                    let len = entry.sz_exe_file.iter().position(|&c| c == 0).unwrap_or(260);
                    let exe_name = String::from_utf16_lossy(&entry.sz_exe_file[..len]);
                    if exe_name.eq_ignore_ascii_case("MabinogiMobile.exe")
                        || exe_name.eq_ignore_ascii_case("MabinogiMobile-Win64-Shipping.exe")
                    {
                        target_pid = Some(entry.th32_process_id);
                        break;
                    }
                    if Process32NextW(snapshot, &mut entry) == 0 {
                        break;
                    }
                }
            }
            CloseHandle(snapshot);
            target_pid
        }
    }

    unsafe extern "system" fn enum_win_callback(hwnd: isize, l_param: isize) -> i32 {
        let (target_pid, found_hwnd) = &mut *(l_param as *mut (u32, Option<isize>));
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if pid == *target_pid && IsWindowVisible(hwnd) != 0 && GetWindowTextLengthW(hwnd) > 0 {
            *found_hwnd = Some(hwnd);
            return 0; // 탐색 종료
        }
        1
    }

    pub fn find_mabi_window(pid: u32) -> Option<isize> {
        let mut data: (u32, Option<isize>) = (pid, None);
        unsafe {
            EnumWindows(Some(enum_win_callback), &mut data as *mut _ as isize);
        }
        data.1
    }

    /// 마비노기 클라이언트 영역(게임 화면)의 화면 좌표 및 크기 반환
    pub fn get_mabi_client_rect(hwnd: isize) -> Option<(i32, i32, u32, u32)> {
        unsafe {
            let mut client_rect = RECT { left: 0, top: 0, right: 0, bottom: 0 };
            if GetClientRect(hwnd, &mut client_rect) == 0 {
                return None;
            }
            if client_rect.right <= client_rect.left || client_rect.bottom <= client_rect.top {
                return None;
            }
            let width = (client_rect.right - client_rect.left) as u32;
            let height = (client_rect.bottom - client_rect.top) as u32;
            if width == 0 || height == 0 {
                return None;
            }

            let mut pt = Point { x: 0, y: 0 };
            if ClientToScreen(hwnd, &mut pt) == 0 {
                return None;
            }

            let mut frame = RECT { left: 0, top: 0, right: 0, bottom: 0 };
            let mut outer = frame;
            let mut buttons = frame;
            let size = std::mem::size_of::<RECT>() as u32;
            let top = if DwmGetWindowAttribute(hwnd, DWMWA_EXTENDED_FRAME_BOUNDS, &mut frame as *mut _ as *mut _, size) >= 0 {
                frame.top.min(pt.y)
            } else { pt.y };
            let caption_height = (pt.y - top) as u32;
            let dpi = GetDpiForWindow(hwnd).max(96);
            let right_inset = if caption_height == 0 { 0 } else if
                GetWindowRect(hwnd, &mut outer) != 0 &&
                DwmGetWindowAttribute(hwnd, DWMWA_CAPTION_BUTTON_BOUNDS, &mut buttons as *mut _ as *mut _, size) >= 0 &&
                buttons.right > buttons.left && buttons.left > 0
            {
                (pt.x + width as i32 - (outer.left + buttons.left)).clamp(0, width as i32) as u32
            } else {
                // Reserve all three caption buttons when DWM has no usable bounds.
                (138 * dpi / 96).min(width)
            };
            match super::TITLEBAR_GEOMETRY.lock() {
                Ok(mut guard) => *guard = (caption_height, right_inset),
                Err(p) => *p.into_inner() = (caption_height, right_inset),
            }
            Some((pt.x, top, width, height + caption_height))
        }
    }

    /// 마비노기 클라이언트 최소화 감시 및 창 위치/크기 1:1 실시간 추적 스레드
    pub fn start_mabi_tracker(
        window: WebviewWindow,
        is_mabi_minimized: Arc<AtomicBool>,
        is_mabi_running: Arc<AtomicBool>,
        is_running: Arc<AtomicBool>,
    ) {
        std::thread::spawn(move || {
            let mut cached_hwnd: Option<isize> = None;
            let mut last_minimized = false;
            let mut was_running = false;
            let mut last_rect: Option<(i32, i32, u32, u32)> = None;
            let mofo_hwnd = window.hwnd().map(|h| h.0 as isize).unwrap_or(0);
            let mut diag_tick: u32 = 0;
            let mut diag_last = String::new();

            // 시작 즉시 초기 마비노기 실행 상태를 프론트엔드로 전달
            let initial_pid = find_mabi_pid();
            let initial_running = initial_pid.is_some() && initial_pid.and_then(find_mabi_window).is_some();
            is_mabi_running.store(initial_running, Ordering::Relaxed);
            let _ = window.emit("mabi_window_state", serde_json::json!({
                "is_minimized": false,
                "is_running": initial_running
            }));

            while is_running.load(Ordering::Relaxed) {
                if cached_hwnd.is_none() {
                    for _ in 0..4 {
                        std::thread::sleep(Duration::from_millis(50));
                        if !is_running.load(Ordering::Relaxed) {
                            break;
                        }
                    }
                } else {
                    std::thread::sleep(Duration::from_millis(50));
                }
                if !is_running.load(Ordering::Relaxed) {
                    break;
                }

                // ~0.5초마다 창 상태를 찍어 보고, 바뀌었을 때만 diag.log 에 남긴다.
                diag_tick = diag_tick.wrapping_add(1);
                if mofo_hwnd != 0 && diag_tick % 10 == 0 {
                    let (key, line) = crate::diag::snapshot(
                        mofo_hwnd,
                        cached_hwnd,
                        last_rect,
                        is_mabi_minimized.load(Ordering::Relaxed),
                    );
                    if key != diag_last {
                        crate::diag::log(&line);
                        diag_last = key;
                    }
                }

                if let Some(hwnd) = cached_hwnd {
                    if unsafe { IsWindow(hwnd) } == 0 {
                        cached_hwnd = None;
                        last_rect = None;
                    }
                }

                if cached_hwnd.is_none() {
                    let pid_opt = find_mabi_pid();
                    match pid_opt {
                        Some(p) => {
                            if let Some(hwnd) = find_mabi_window(p) {
                                cached_hwnd = Some(hwnd);
                            } else {
                                cached_hwnd = None;
                                if was_running {
                                    was_running = false;
                                    last_minimized = false;
                                    is_mabi_running.store(false, Ordering::Relaxed);
                                    is_mabi_minimized.store(false, Ordering::Relaxed);
                                    let _ = window.emit("mabi_window_state", serde_json::json!({
                                        "is_minimized": false,
                                        "is_running": false
                                    }));
                                }
                                continue;
                            }
                        }
                        None => {
                            cached_hwnd = None;
                            if was_running {
                                was_running = false;
                                last_minimized = false;
                                is_mabi_running.store(false, Ordering::Relaxed);
                                is_mabi_minimized.store(false, Ordering::Relaxed);
                                let _ = window.emit("mabi_window_state", serde_json::json!({
                                    "is_minimized": false,
                                    "is_running": false
                                }));
                            }
                            continue;
                        }
                    }
                }

                if let Some(hwnd) = cached_hwnd {
                    let mut cloaked: u32 = 0;
                    unsafe {
                        DwmGetWindowAttribute(
                            hwnd,
                            DWMWA_CLOAKED,
                            &mut cloaked as *mut _ as *mut _,
                            4,
                        );
                    }
                    let is_iconic = unsafe { IsIconic(hwnd) } != 0 || cloaked != 0;

                    if !was_running {
                        was_running = true;
                        last_minimized = is_iconic;
                        is_mabi_running.store(true, Ordering::Relaxed);
                        is_mabi_minimized.store(is_iconic, Ordering::Relaxed);

                        let _ = window.emit("mabi_window_state", serde_json::json!({
                            "is_minimized": is_iconic,
                            "is_running": true
                        }));

                        if is_iconic {
                            let _ = window.set_ignore_cursor_events(true);
                        }
                    } else if is_iconic != last_minimized {
                        last_minimized = is_iconic;
                        is_mabi_minimized.store(is_iconic, Ordering::Relaxed);

                        let _ = window.emit("mabi_window_state", serde_json::json!({
                            "is_minimized": is_iconic,
                            "is_running": true
                        }));

                        if is_iconic {
                            let _ = window.set_ignore_cursor_events(true);
                        }
                    }

                    // 최소화 상태가 아닐 때: 마비노기 게임 창의 위치/크기 실시간 추적 및 1:1 일치
                    if !is_iconic {
                        if let Some((x, y, w, h)) = get_mabi_client_rect(hwnd) {
                            if last_rect != Some((x, y, w, h)) {
                                last_rect = Some((x, y, w, h));
                                let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                                    width: w,
                                    height: h,
                                }));
                                let _ = window.set_position(tauri::Position::Physical(
                                    tauri::PhysicalPosition { x, y },
                                ));
                            }
                        }
                    }
                }
            }
        });
    }
}

fn toggle_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let visible = window.is_visible();
        diag::log(&format!("tray toggle: is_visible={:?}", visible));
        match visible {
            Ok(true) => {
                let _ = window.hide();
            }
            Ok(false) => {
                let _ = window.show();
                let _ = window.set_focus();
            }
            Err(_) => {}
        }
    }
}

fn main() {
    let force_pass_all = Arc::new(AtomicBool::new(false));
    let is_currently_ignoring = Arc::new(AtomicBool::new(true)); // 시작 시 기본 통과 모드
    let is_mabi_minimized = Arc::new(AtomicBool::new(false)); // 마비노기 클라이언트 최소화 여부
    let is_mabi_running = Arc::new(AtomicBool::new(false)); // 마비노기 클라이언트 실행 여부
    let is_running = Arc::new(AtomicBool::new(true));
    let interactive_rects = Arc::new(Mutex::new(Vec::<InteractiveRect>::new()));
    let force_pass_exceptions = Arc::new(Mutex::new(Vec::<InteractiveRect>::new()));

    let app_state = AppState {
        force_pass_all: force_pass_all.clone(),
        is_currently_ignoring: is_currently_ignoring.clone(),
        is_mabi_minimized: is_mabi_minimized.clone(),
        is_mabi_running: is_mabi_running.clone(),
        is_running: is_running.clone(),
        interactive_rects: interactive_rects.clone(),
        force_pass_exceptions: force_pass_exceptions.clone(),
    };

    let is_running_tray = is_running.clone();
    let is_running_setup = is_running.clone();
    let is_running_exit = is_running.clone();
    let is_mabi_running_setup = is_mabi_running.clone();

    let builder = tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            get_titlebar_geometry,
            set_click_through,
            set_interactive_rects,
            get_mabi_minimized,
            get_mabi_running,
            set_show_in_taskbar,
            execute_mabinogi_cli,
            get_media_state,
            media_toggle_play_pause,
            media_skip_next,
            media_skip_previous,
            get_master_volume,
            set_master_volume,
            search_song,
            exit_app
        ])
        .setup(move |app| {
            // 시스템 트레이 아이콘 설정
            let show_i = MenuItem::with_id(app, "show", "오버레이 표시/숨김", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let mut tray_builder = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(false)
                .tooltip("MoFo - 마비노기 정보 오버레이")
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "show" => toggle_main_window(app),
                    "quit" => {
                        is_running_tray.store(false, Ordering::Relaxed);
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_main_window(tray.app_handle());
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            let _tray = tray_builder.build(app)?;

            #[cfg(target_os = "windows")]
            {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_decorations(false);
                    let _ = window.set_always_on_top(true);
                    let _ = window.set_resizable(true);

                    // 초기 위치/크기 설정: 마비노기가 이미 실행 중이면 해당 창에 맞춤, 아니면 현재 모니터
                    let mut initialized = false;
                    if let Some(pid) = win_monitor::find_mabi_pid() {
                        if let Some(hwnd) = win_monitor::find_mabi_window(pid) {
                            if let Some((x, y, w, h)) = win_monitor::get_mabi_client_rect(hwnd) {
                                let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                                    width: w,
                                    height: h,
                                }));
                                let _ = window.set_position(tauri::Position::Physical(
                                    tauri::PhysicalPosition { x, y },
                                ));
                                initialized = true;
                            }
                        }
                    }

                    if !initialized {
                        if let Ok(Some(monitor)) = window.current_monitor() {
                            let size = monitor.size();
                            let pos = monitor.position();
                            let _ = window.set_size(tauri::Size::Physical(*size));
                            let _ = window.set_position(tauri::Position::Physical(*pos));
                        }
                    }

                    // 기본적으로 마우스 통과 상태로 초기화하여 게임/작업표시줄 클릭을 방해하지 않음
                    let _ = window.set_ignore_cursor_events(true);

                    // 마비노기 클라이언트 추적 및 최소화 감시 스레드 시작
                    win_monitor::start_mabi_tracker(
                        window.clone(),
                        is_mabi_minimized.clone(),
                        is_mabi_running_setup.clone(),
                        is_running_setup.clone(),
                    );

                    // 상시 스마트 마우스 히트 테스팅 스레드:
                    // UI 객체(툴바, 시계, 가공 HUD, 알림, 설정창)가 있는 영역 위에 커서가 위치할 때만 마우스를 가로채고,
                    // 그 외의 투명한 빈 화면이나 작업 표시줄 영역은 마우스 클릭이 100% 통과되도록 제어합니다.
                    let force_pass = force_pass_all.clone();
                    let cur_ignoring = is_currently_ignoring.clone();
                    let mabi_minimized = is_mabi_minimized.clone();
                    let rects_arc = interactive_rects.clone();
                    let exceptions_arc = force_pass_exceptions.clone();
                    let win_clone = window.clone();
                    let is_running_hit = is_running_setup.clone();

                    let hwnd = window.hwnd().map(|h| h.0 as isize).unwrap_or(0);

                    std::thread::spawn(move || {
                        let mut dragging = false;
                        let mut prev_l_button_down = false;

                        while is_running_hit.load(Ordering::Relaxed) {
                            std::thread::sleep(Duration::from_millis(25));
                            if !is_running_hit.load(Ordering::Relaxed) {
                                break;
                            }

                            // 마비노기 클라이언트가 작업표시줄로 최소화된 경우: 마우스 100% 완전 통과 유지
                            if mabi_minimized.load(Ordering::Relaxed) {
                                if !cur_ignoring.load(Ordering::Relaxed) {
                                    let _ = win_clone.set_ignore_cursor_events(true);
                                    cur_ignoring.store(true, Ordering::Relaxed);
                                }
                                continue;
                            }

                            let mut pt = Point { x: 0, y: 0 };
                            let ok = unsafe { GetCursorPos(&mut pt) };
                            if ok != 0 && hwnd != 0 {
                                if unsafe { ScreenToClient(hwnd, &mut pt) } == 0 {
                                    if !cur_ignoring.load(Ordering::Relaxed) {
                                        let _ = win_clone.set_ignore_cursor_events(true);
                                        cur_ignoring.store(true, Ordering::Relaxed);
                                    }
                                    continue;
                                }
                                let scale = win_clone.scale_factor().unwrap_or(1.0);
                                let cx = pt.x as f64 / scale;
                                let cy = pt.y as f64 / scale;

                                // 마우스 좌클릭(0x01) 상태 확인
                                let l_button_down = unsafe { (GetAsyncKeyState(0x01) as i32 & 0x8000) != 0 };

                                // 사용자가 완전 마우스 통과(강제 통과)를 켠 경우
                                if force_pass.load(Ordering::Relaxed) {
                                    prev_l_button_down = l_button_down;

                                    // 완전 통과 중이더라도 예외 영역(미디어 재생 컨트롤 버튼 등) 위라면 클릭 허용!
                                    let exceptions = if let Ok(guard) = exceptions_arc.lock() {
                                        guard.clone()
                                    } else {
                                        Vec::new()
                                    };

                                    let mut is_inside_exception = false;
                                    for r in exceptions {
                                        if cx >= (r.x - 10.0)
                                            && cx <= (r.x + r.width + 10.0)
                                            && cy >= (r.y - 10.0)
                                            && cy <= (r.y + r.height + 10.0)
                                        {
                                            is_inside_exception = true;
                                            break;
                                        }
                                    }

                                    if is_inside_exception {
                                        if cur_ignoring.load(Ordering::Relaxed) {
                                            let _ = win_clone.set_ignore_cursor_events(false);
                                            cur_ignoring.store(false, Ordering::Relaxed);
                                        }
                                    } else {
                                        if !cur_ignoring.load(Ordering::Relaxed) {
                                            let _ = win_clone.set_ignore_cursor_events(true);
                                            cur_ignoring.store(true, Ordering::Relaxed);
                                        }
                                    }
                                    continue;
                                }

                                // 엣지 트리거(just_pressed) 감지
                                let just_pressed = l_button_down && !prev_l_button_down;

                                let rects = if let Ok(guard) = rects_arc.lock() {
                                    guard.clone()
                                } else {
                                    Vec::new()
                                };

                                let mut is_inside_any = false;
                                for r in rects {
                                    // 4px 히트 테스트 마진
                                    if cx >= (r.x - 4.0)
                                        && cx <= (r.x + r.width + 4.0)
                                        && cy >= (r.y - 4.0)
                                        && cy <= (r.y + r.height + 4.0)
                                    {
                                        is_inside_any = true;
                                        break;
                                    }
                                }

                                // 드래그 시작 판정: 오버레이 위젯 내부에서 '처음 클릭(just_pressed)'했을 때만 드래그 진입!
                                // 게임 화면에서 마우스를 누른 채로 커서가 오버레이 위로 스쳐 지나간 경우에는 dragging이 되지 않아 게임 조작이 끊기지 않음!
                                if is_inside_any && just_pressed {
                                    dragging = true;
                                } else if !l_button_down {
                                    dragging = false;
                                }

                                // 오버레이가 마우스 입력을 가로채는 조건:
                                // 1) 오버레이 내부에서 시작된 드래그 중인 경우 (dragging == true)
                                // 2) 마우스 버튼을 누르지 않은 상태에서 오버레이 UI 위를 호버/클릭 대기 중인 경우 (is_inside_any && !l_button_down)
                                // (게임 화면에서 마우스를 누른 채로 스쳐 지나갈 때는 l_button_down == true && !dragging 이므로 완벽 통과)
                                let should_capture = dragging || (is_inside_any && !l_button_down);

                                if should_capture {
                                    // 객체 영역 위이거나 내부 드래그 중 -> 마우스 클릭 허용
                                    if cur_ignoring.load(Ordering::Relaxed) {
                                        let _ = win_clone.set_ignore_cursor_events(false);
                                        cur_ignoring.store(false, Ordering::Relaxed);
                                    }
                                } else {
                                    // 외부 게임 드래그 통과, 객체가 없는 빈 영역 또는 작업 표시줄 -> 게임/바탕화면으로 100% 통과!
                                    if !cur_ignoring.load(Ordering::Relaxed) {
                                        let _ = win_clone.set_ignore_cursor_events(true);
                                        cur_ignoring.store(true, Ordering::Relaxed);
                                    }
                                }

                                prev_l_button_down = l_button_down;
                            }
                        }
                    });
                }
            }
            Ok(())
        });

    diag::log(&format!("=== MoFo {} start ===", env!("CARGO_PKG_VERSION")));
    let app = builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(move |_app_handle, event| {
        if let tauri::RunEvent::ExitRequested { .. } = event {
            diag::log("exit requested");
        }
        if let tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit = event {
            is_running_exit.store(false, Ordering::Relaxed);
        }
    });
}
