//! 오버레이가 게임 뒤로 숨는 현상 진단용 로그.
//! 실행 파일 옆 mofo-diag.log 에 창 상태가 "바뀔 때만" 한 줄씩 남긴다.

use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

#[repr(C)]
#[derive(Clone, Copy, PartialEq, Eq)]
struct Rect {
    l: i32,
    t: i32,
    r: i32,
    b: i32,
}

#[repr(C)]
struct SystemTime {
    year: u16,
    month: u16,
    dow: u16,
    day: u16,
    hour: u16,
    min: u16,
    sec: u16,
    ms: u16,
}

#[link(name = "user32")]
extern "system" {
    fn GetWindowLongPtrW(hwnd: isize, index: i32) -> isize;
    fn GetWindowRect(hwnd: isize, rect: *mut Rect) -> i32;
    fn IsWindowVisible(hwnd: isize) -> i32;
    fn IsIconic(hwnd: isize) -> i32;
    fn IsWindow(hwnd: isize) -> i32;
    fn GetForegroundWindow() -> isize;
    fn GetTopWindow(hwnd: isize) -> isize;
    fn GetWindow(hwnd: isize, cmd: u32) -> isize;
    fn GetWindowThreadProcessId(hwnd: isize, pid: *mut u32) -> u32;
    fn GetClassNameW(hwnd: isize, buf: *mut u16, len: i32) -> i32;
}

#[link(name = "kernel32")]
extern "system" {
    fn GetLocalTime(st: *mut SystemTime);
    fn OpenProcess(access: u32, inherit: i32, pid: u32) -> isize;
    fn QueryFullProcessImageNameW(h: isize, flags: u32, buf: *mut u16, len: *mut u32) -> i32;
    fn CloseHandle(h: isize) -> i32;
}

#[link(name = "dwmapi")]
extern "system" {
    fn DwmGetWindowAttribute(hwnd: isize, attr: u32, value: *mut std::ffi::c_void, size: u32) -> i32;
}

const GWL_EXSTYLE: i32 = -20;
const WS_EX_TOPMOST: isize = 0x8;
const WS_EX_TRANSPARENT: isize = 0x20;
const GW_HWNDNEXT: u32 = 2;
const GW_HWNDPREV: u32 = 3;
const DWMWA_CLOAKED: u32 = 14;
const MAX_LOG_BYTES: u64 = 1024 * 1024;

static LOCK: Mutex<()> = Mutex::new(());

/// 유저가 바로 찾을 수 있게 실행 파일 옆에 둔다. 쓰기 불가 폴더면 %LOCALAPPDATA%\MoFo 로.
fn log_path() -> Option<PathBuf> {
    let exe_dir = std::env::current_exe().ok()?.parent()?.to_path_buf();
    let path = exe_dir.join("mofo-diag.log");
    if std::fs::OpenOptions::new().create(true).append(true).open(&path).is_ok() {
        return Some(path);
    }
    let dir = PathBuf::from(std::env::var_os("LOCALAPPDATA")?).join("MoFo");
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir.join("mofo-diag.log"))
}

pub fn log(msg: &str) {
    let _guard = LOCK.lock().unwrap_or_else(|p| p.into_inner());
    let Some(path) = log_path() else { return };
    // 1MB 넘으면 mofo-diag.old.log 로 한 번 밀어낸다(최대 2MB 유지).
    if std::fs::metadata(&path).map(|m| m.len() > MAX_LOG_BYTES).unwrap_or(false) {
        let _ = std::fs::rename(&path, path.with_file_name("mofo-diag.old.log"));
    }
    let mut st = SystemTime { year: 0, month: 0, dow: 0, day: 0, hour: 0, min: 0, sec: 0, ms: 0 };
    unsafe { GetLocalTime(&mut st) };
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&path) {
        let _ = writeln!(
            f,
            "{:04}-{:02}-{:02} {:02}:{:02}:{:02}.{:03} {}",
            st.year, st.month, st.day, st.hour, st.min, st.sec, st.ms, msg
        );
    }
}

fn exstyle(h: isize) -> isize {
    unsafe { GetWindowLongPtrW(h, GWL_EXSTYLE) }
}

fn rect(h: isize) -> Rect {
    let mut r = Rect { l: 0, t: 0, r: 0, b: 0 };
    unsafe { GetWindowRect(h, &mut r) };
    r
}

fn cloaked(h: isize) -> bool {
    let mut v: u32 = 0;
    unsafe { DwmGetWindowAttribute(h, DWMWA_CLOAKED, &mut v as *mut _ as *mut _, 4) };
    v != 0
}

fn pid_of(h: isize) -> u32 {
    let mut pid = 0;
    unsafe { GetWindowThreadProcessId(h, &mut pid) };
    pid
}

fn class_of(h: isize) -> String {
    let mut buf = [0u16; 128];
    let n = unsafe { GetClassNameW(h, buf.as_mut_ptr(), buf.len() as i32) };
    String::from_utf16_lossy(&buf[..n.max(0) as usize])
}

fn exe_of(pid: u32) -> String {
    unsafe {
        let h = OpenProcess(0x1000, 0, pid); // PROCESS_QUERY_LIMITED_INFORMATION
        if h == 0 {
            return format!("pid{pid}");
        }
        let mut buf = [0u16; 260];
        let mut len = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(h, 0, buf.as_mut_ptr(), &mut len);
        CloseHandle(h);
        if ok == 0 {
            return format!("pid{pid}");
        }
        let full = String::from_utf16_lossy(&buf[..len as usize]);
        full.rsplit('\\').next().unwrap_or(&full).to_string()
    }
}

/// 창 하나를 "exe/class top=1" 처럼 요약
fn describe(h: isize) -> String {
    if h == 0 {
        return "none".into();
    }
    let top = exstyle(h) & WS_EX_TOPMOST != 0;
    format!("{}/{} top={}", exe_of(pid_of(h)), class_of(h), top as u8)
}

fn intersects(a: Rect, b: Rect) -> bool {
    a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b
}

/// z-order 위쪽부터 훑어서 mofo 와 game 중 누가 먼저 나오는지
fn mofo_above_game(mofo: isize, game: isize) -> Option<bool> {
    let mut h = unsafe { GetTopWindow(0) };
    while h != 0 {
        if h == mofo {
            return Some(true);
        }
        if h == game {
            return Some(false);
        }
        h = unsafe { GetWindow(h, GW_HWNDNEXT) };
    }
    None
}

/// mofo 바로 위에서 mofo 영역을 덮고 있는 첫 번째 다른 프로세스 창
fn first_cover(mofo: isize, mofo_rect: Rect) -> isize {
    let my_pid = pid_of(mofo);
    let mut h = unsafe { GetWindow(mofo, GW_HWNDPREV) };
    while h != 0 {
        if unsafe { IsWindowVisible(h) } != 0
            && unsafe { IsIconic(h) } == 0
            && !cloaked(h)
            && pid_of(h) != my_pid
            && intersects(rect(h), mofo_rect)
        {
            return h;
        }
        h = unsafe { GetWindow(h, GW_HWNDPREV) };
    }
    0
}

/// 현재 상태를 (비교용 키, 로그 줄)로 반환. 키에는 좌표를 넣지 않아 창을 끌 때 로그가 폭주하지 않는다.
/// `target` 은 트래커가 마지막으로 맞춘 게임 영역(x, y, w, h).
pub fn snapshot(
    mofo: isize,
    game: Option<isize>,
    target: Option<(i32, i32, u32, u32)>,
    ui_minimized: bool,
) -> (String, String) {
    let ex = exstyle(mofo);
    let mr = rect(mofo);
    let mofo_s = format!(
        "mofo[vis={} icon={} top={} pass={}]",
        unsafe { IsWindowVisible(mofo) },
        unsafe { IsIconic(mofo) },
        (ex & WS_EX_TOPMOST != 0) as u8,
        (ex & WS_EX_TRANSPARENT != 0) as u8,
    );

    let game_s = match game {
        Some(g) if unsafe { IsWindow(g) } != 0 => {
            let order = match mofo_above_game(mofo, g) {
                Some(true) => "mofo>game",
                Some(false) => "GAME>MOFO",
                None => "?",
            };
            format!(
                "game[{:#x} {} vis={} icon={} cloak={}] {}",
                g,
                describe(g),
                unsafe { IsWindowVisible(g) },
                unsafe { IsIconic(g) },
                cloaked(g) as u8,
                order
            )
        }
        Some(g) => format!("game[{:#x} destroyed]", g),
        None => "game[none]".into(),
    };

    let rect_ok = match target {
        Some((x, y, w, h)) => mr == Rect { l: x, t: y, r: x + w as i32, b: y + h as i32 },
        None => true,
    };

    let fg = unsafe { GetForegroundWindow() };
    let fg_s = if fg == mofo {
        "mofo".to_string()
    } else if Some(fg) == game {
        "game".to_string()
    } else {
        describe(fg)
    };

    let key = format!(
        "{mofo_s} {game_s} ui_min={} rect_ok={} fg={fg_s} cover={}",
        ui_minimized as u8,
        rect_ok as u8,
        describe(first_cover(mofo, mr)),
    );
    let line = format!(
        "{key} mofo_rect=({},{},{},{}) target={:?}",
        mr.l, mr.t, mr.r, mr.b, target
    );
    (key, line)
}
