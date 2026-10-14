use base64::Engine;
use std::path::{Path, PathBuf};
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const DEFAULT_NEXON_PATH: &str = "C:\\Nexon\\MabinogiMobile\\MabinogiMobile_CLI.exe";

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CliResponse {
    pub success: bool,
    pub exit_code: i32,
    pub data: Option<serde_json::Value>,
    pub error: Option<serde_json::Value>,
    pub raw_stdout: String,
}

#[cfg(target_os = "windows")]
mod win_proc {
    use std::path::PathBuf;

    const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;
    const INVALID_HANDLE_VALUE: isize = -1;

    extern "system" {
        fn OpenProcess(dw_desired_access: u32, b_inherit_handle: i32, dw_process_id: u32) -> isize;
        fn QueryFullProcessImageNameW(h_process: isize, dw_flags: u32, lp_exe_name: *mut u16, lpdw_size: *mut u32) -> i32;
        fn CloseHandle(h_object: isize) -> i32;
    }

    /// 현재 실행 중인 MabinogiMobile.exe 프로세스의 디렉터리에서 MabinogiMobile_CLI.exe 탐색
    pub fn find_from_running_process() -> Option<PathBuf> {
        let pid = crate::win_monitor::find_mabi_pid()?;
        unsafe {
            let h_proc = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if h_proc == 0 || h_proc == INVALID_HANDLE_VALUE {
                return None;
            }

            let mut buf = [0u16; 1024];
            let mut size = buf.len() as u32;
            let success = QueryFullProcessImageNameW(h_proc, 0, buf.as_mut_ptr(), &mut size);
            CloseHandle(h_proc);

            if success != 0 && size > 0 {
                let path_str = String::from_utf16_lossy(&buf[..size as usize]);
                let game_path = PathBuf::from(path_str);
                let mut current = game_path.parent();
                for _ in 0..4 {
                    if let Some(dir) = current {
                        let cli_path = dir.join("MabinogiMobile_CLI.exe");
                        if cli_path.exists() {
                            return Some(cli_path);
                        }
                        current = dir.parent();
                    } else {
                        break;
                    }
                }
            }

            None
        }
    }
}

use std::sync::RwLock;

static CLI_PATH: RwLock<Option<PathBuf>> = RwLock::new(None);

fn resolve_cli_path() -> Option<PathBuf> {
    // 1. 환경 변수 확인 (사용자 수동 지정 최우선)
    if let Ok(custom_path) = std::env::var("MABINOGI_CLI_PATH") {
        let p = PathBuf::from(&custom_path);
        if p.exists() {
            return Some(p);
        }
    }

    // 2. 실행 중인 MabinogiMobile.exe 프로세스 역추적 (D드라이브 등 임의 경로 설치 완벽 대응)
    #[cfg(target_os = "windows")]
    if let Some(proc_cli_path) = win_proc::find_from_running_process() {
        if proc_cli_path.exists() {
            return Some(proc_cli_path);
        }
    }

    // 3. 기본 설치 경로 및 후보 드라이브 확인
    let candidates = [
        DEFAULT_NEXON_PATH,
        "D:\\Nexon\\MabinogiMobile\\MabinogiMobile_CLI.exe",
        "E:\\Nexon\\MabinogiMobile\\MabinogiMobile_CLI.exe",
    ];
    for &cand in &candidates {
        let p = Path::new(cand);
        if p.exists() {
            return Some(p.to_path_buf());
        }
    }

    None
}

/// MabinogiMobile_CLI 실행 파일 경로 탐색
pub fn find_cli_executable() -> PathBuf {
    // 1. 읽기 락: 캐시가 유효한지(!path.exists() 체크) 확인
    if let Ok(read_guard) = CLI_PATH.read() {
        if let Some(ref path) = *read_guard {
            if path.exists() {
                return path.clone();
            }
        }
    }

    // 2. 쓰기 락 밖에서 경로 탐색 수행 (락 경합 및 블로킹 최소화)
    let resolved = resolve_cli_path();

    // 3. 쓰기 락 획득 후 캐시 업데이트만 수행 (Double-checked locking)
    if let Ok(mut write_guard) = CLI_PATH.write() {
        if let Some(ref path) = *write_guard {
            if path.exists() {
                return path.clone();
            }
        }

        *write_guard = resolved.clone();
    }

    if let Some(path) = resolved {
        return path;
    }

    // 4. 시스템 PATH 폴백
    PathBuf::from("MabinogiMobile_CLI.exe")
}

/// 인자 인코딩 (한글/특수문자 포함 시 base64: 접두어 부착)
pub fn encode_arg(val: &serde_json::Value) -> String {
    let raw = match val {
        serde_json::Value::String(s) => s.clone(),
        _ => val.to_string(),
    };

    if !raw.is_ascii() {
        let b64 = base64::engine::general_purpose::STANDARD.encode(raw.as_bytes());
        format!("base64:{}", b64)
    } else {
        raw
    }
}

/// MabinogiMobile_CLI 직접 실행 함수
pub fn run_mabinogi_cli(command: &str, body: Option<serde_json::Value>) -> CliResponse {
    let exe = find_cli_executable();
    let mut cmd = Command::new(&exe);

    cmd.arg(command);

    if let Some(ref b) = body {
        let encoded = encode_arg(b);
        if !encoded.is_empty() {
            cmd.arg(encoded);
        }
    }

    #[cfg(target_os = "windows")]
    {
        // CREATE_NO_WINDOW: 0x08000000 - 까만 콘솔 창 방지
        cmd.creation_flags(0x08000000);
    }

    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            return CliResponse {
                success: false,
                exit_code: -1,
                data: None,
                error: Some(serde_json::json!({
                    "code": "process_error",
                    "message": format!("MabinogiMobile_CLI 실행 실패 ({}): {}", exe.display(), e),
                })),
                raw_stdout: String::new(),
            };
        }
    };

    // 파이프 버퍼 데드락을 방지하기 위해 stdout과 stderr을 백그라운드 스레드에서 스트리밍으로 소비
    let mut stdout_pipe = child.stdout.take();
    let mut stderr_pipe = child.stderr.take();

    let stdout_handle = std::thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(ref mut pipe) = stdout_pipe {
            use std::io::Read;
            let _ = pipe.read_to_end(&mut buf);
        }
        buf
    });

    let stderr_handle = std::thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(ref mut pipe) = stderr_pipe {
            use std::io::Read;
            let _ = pipe.read_to_end(&mut buf);
        }
        buf
    });

    // 3초 타임아웃 감시 및 타임아웃 시 프로세스 강제 종료(kill) 및 좀비 회수
    let start = std::time::Instant::now();
    let timeout = std::time::Duration::from_millis(3000);
    let mut timed_out = false;
    let mut exit_status = None;

    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                exit_status = Some(status);
                break;
            }
            Ok(None) => {
                if start.elapsed() >= timeout {
                    timed_out = true;
                    let _ = child.kill();
                    let _ = child.wait();
                    break;
                }
                std::thread::sleep(std::time::Duration::from_millis(20));
            }
            Err(_) => {
                let _ = child.kill();
                let _ = child.wait();
                break;
            }
        }
    }

    let stdout_bytes = stdout_handle.join().unwrap_or_default();
    let _stderr_bytes = stderr_handle.join().unwrap_or_default();

    if timed_out {
        return CliResponse {
            success: false,
            exit_code: -1,
            data: None,
            error: Some(serde_json::json!({
                "code": "timeout",
                "message": "MabinogiMobile_CLI 실행 시간 초과 (3초)",
            })),
            raw_stdout: String::new(),
        };
    }

    let exit_code = exit_status.and_then(|s| s.code()).unwrap_or(-1);
    let stdout_raw = String::from_utf8_lossy(&stdout_bytes).to_string();

    // last-response.json 폴백은 사용하지 않음: 6개 명령이 동시에 실행되므로 다른 명령의 응답일 수 있음
    let final_data: Option<serde_json::Value> = serde_json::from_str(stdout_raw.trim()).ok();

    // Exit Code 5 또는 disconnected
    let is_disconnected = exit_code == 5 || final_data.as_ref().map(|v| v["pipe"] == "disconnected").unwrap_or(false);
    if is_disconnected {
        let reason = final_data.as_ref().and_then(|v| v["reason"].as_str()).unwrap_or("").to_string();
        let msg = if reason == "game_off" {
            "게임 클라이언트가 실행 중이지 않습니다. 마비노기 모바일을 실행해 주세요."
        } else if reason == "option_off" {
            "게임 내 설정에서 'MM AI 에이전트 활성화' 옵션을 켜주세요."
        } else {
            "마비노기 모바일 클라이언트와 연결되지 않았습니다."
        };

        return CliResponse {
            success: false,
            exit_code: if exit_code == 0 { 5 } else { exit_code },
            data: final_data,
            error: Some(serde_json::json!({
                "pipe": "disconnected",
                "reason": reason,
                "message": msg,
            })),
            raw_stdout: stdout_raw,
        };
    }

    // 내부 상태가 rejected / invalid_body / error인 경우
    let has_error = final_data.as_ref().map(|j| {
        j["status"] == "rejected" || j["status"] == "invalid_body" || !j["error"].is_null()
    }).unwrap_or(false);

    if has_error {
        let (code, msg) = if let Some(ref j) = final_data {
            let err_val = if !j["body"].is_null() { &j["body"] } else { j };
            let c = err_val["error"].as_str().unwrap_or("rejected").to_string();
            let m = err_val["message"].as_str().unwrap_or("요청이 게임 내에서 거절되었습니다.").to_string();
            (c, m)
        } else {
            ("unknown".to_string(), "요청이 거절되었습니다.".to_string())
        };

        return CliResponse {
            success: false,
            exit_code,
            data: final_data,
            error: Some(serde_json::json!({
                "code": code,
                "message": msg,
            })),
            raw_stdout: stdout_raw,
        };
    }

    CliResponse {
        success: exit_code == 0,
        exit_code,
        data: final_data,
        error: None,
        raw_stdout: stdout_raw,
    }
}
