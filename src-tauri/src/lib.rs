mod atomic_write;
use atomic_write::atomic_write;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Serialize, Deserialize)]
struct WindowState {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    maximized: bool,
}

fn window_state_path() -> PathBuf {
    PathBuf::from(std::env::var("APPDATA").unwrap_or_default())
        .join("Rapture")
        .join("window_state.json")
}

fn save_window_state(state: &WindowState) {
    let path = window_state_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string(state) {
        let _ = fs::write(&path, json);
    }
}

fn load_window_state() -> Option<WindowState> {
    let path = window_state_path();
    fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
}

fn app_root() -> PathBuf {
    // Debug build → project root (dev convenience)
    if cfg!(debug_assertions) {
        if let Ok(exe) = std::env::current_exe() {
            let mut root = exe.parent().unwrap().to_path_buf();
            for _ in 0..3 { // src-tauri/target/debug → project root
                if let Some(p) = root.parent() { root = p.to_path_buf(); }
            }
            return root;
        }
    }
    // Release build → %APPDATA%\Rapture  (always)
    PathBuf::from(std::env::var("APPDATA").unwrap_or_default()).join("Rapture")
}

fn safe_name(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_ascii_alphanumeric() || matches!(c, ' ' | '.' | '(' | ')' | '-' | '_') { c } else { '_' })
        .take(200)
        .collect()
}

/* ── Notes ── */

#[derive(Serialize, Deserialize, Clone)]
struct EyelinerNote {
    id: String,
    #[serde(rename = "pageNumber")]
    page_number: u32,
    #[serde(rename = "yPercent")]
    y_percent: f64,
    text: String,
    timestamp: u64,
}

#[tauri::command]
fn save_notes(file_name: String, notes: Vec<EyelinerNote>) -> Result<String, String> {
    let root = app_root();
    let notes_dir = root.join("Notes");
    fs::create_dir_all(&notes_dir).map_err(|e| e.to_string())?;

    let safe = safe_name(&file_name);
    let file_path = notes_dir.join(format!("{}.rapture", safe));

    let payload = serde_json::json!({
        "version": 1,
        "type": "rapture-eyeliner-notes",
        "exportedAt": chrono_now(),
        "fileName": file_name,
        "notes": notes,
    });

    let json = serde_json::to_string_pretty(&payload).map_err(|e| e.to_string())?;
    atomic_write(&file_path, json.as_bytes()).map_err(|e| e.to_string())?;

    Ok(file_path.to_string_lossy().to_string())
}

fn chrono_now() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| {
            let secs = d.as_secs();
            let days = (secs / 86400) as i64 + 719_468;
            let era = (if days >= 0 { days } else { days - 146_096 }) / 146_097;
            let doe = (days - era * 146_097) as u32;
            let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
            let y = yoe as i64 + era * 400;
            let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
            let mp = (5 * doy + 2) / 153;
            let d = doy - (153 * mp + 2) / 5 + 1;
            let m = if mp < 10 { mp + 3 } else { mp - 9 };
            let y_final = if m <= 2 { y + 1 } else { y };
            let time = (secs % 86400) as u32;
            format!(
                "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.000Z",
                y_final, m, d,
                time / 3600, (time % 3600) / 60, time % 60,
            )
        })
        .unwrap_or_else(|_| "2024-01-01T00:00:00.000Z".into())
}

#[tauri::command]
async fn export_notes_dialog(
    app: tauri::AppHandle,
    file_name: String,
    notes: Vec<EyelinerNote>,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    use std::sync::mpsc;

    let safe = safe_name(&file_name);
    let default_name = format!("{}.rapture", safe.replace(".pdf", ""));

    let (tx, rx) = mpsc::channel();
    app.dialog()
        .file()
        .add_filter("Rapture Notes", &["rapture"])
        .set_file_name(&default_name)
        .save_file(move |path| {
            let _ = tx.send(path);
        });

    match rx.recv().map_err(|e| e.to_string())? {
        Some(p) => {
            let path = std::path::PathBuf::from(p.to_string());
            let payload = serde_json::json!({
                "version": 1,
                "type": "rapture-eyeliner-notes",
                "exportedAt": chrono_now(),
                "fileName": file_name,
                "notes": notes,
            });
            let json = serde_json::to_string_pretty(&payload).map_err(|e| e.to_string())?;
            atomic_write(&path, json.as_bytes()).map_err(|e| e.to_string())?;
            Ok(Some(path.to_string_lossy().to_string()))
        }
        None => Ok(None),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Restore previous window state
            if let Some(win) = app.get_webview_window("main") {
                if let Some(state) = load_window_state() {
                    let _ = win.set_position(tauri::LogicalPosition::new(state.x, state.y));
                    let _ = win.set_size(tauri::LogicalSize::new(state.width, state.height));
                    if state.maximized {
                        let _ = win.maximize();
                    }
                }

                // Save state on close (convert physical pixels → logical)
                let window_clone = win.clone();
                win.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { .. } = event {
                        let scale = window_clone.scale_factor().unwrap_or(1.0);
                        if let Ok(pos) = window_clone.outer_position() {
                            if let Ok(size) = window_clone.inner_size() {
                                let logical_pos = pos.to_logical(scale);
                                let logical_size = size.to_logical(scale);
                                save_window_state(&WindowState {
                                    x: logical_pos.x,
                                    y: logical_pos.y,
                                    width: logical_size.width,
                                    height: logical_size.height,
                                    maximized: window_clone.is_maximized().unwrap_or(false),
                                });
                            }
                        }
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![save_notes, export_notes_dialog])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
