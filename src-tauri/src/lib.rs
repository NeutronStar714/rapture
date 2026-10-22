mod atomic_write;
use atomic_write::atomic_write;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize)]
struct WindowState {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    maximized: bool,
}

/* ── Storage locations ── */

/// Environment variable that overrides where Rapture keeps its files (handy for development).
const DATA_DIR_OVERRIDE: &str = "RAPTURE_DATA_DIR";

/// Picks the folder Rapture stores its files in. An explicit override wins; otherwise it is
/// the platform's per-user data folder plus `Rapture`, i.e. `%APPDATA%\Rapture` on Windows
/// and `~/Library/Application Support/Rapture` on macOS. Debug and release builds share it.
fn resolve_app_root(override_dir: Option<PathBuf>, platform_data_dir: Option<PathBuf>) -> Option<PathBuf> {
    match override_dir {
        Some(dir) if !dir.as_os_str().is_empty() => Some(dir),
        _ => platform_data_dir.map(|dir| dir.join("Rapture")),
    }
}

/// Autosaved `.rapture` sidecars live here. Lowercase on purpose: it must match the folder the
/// browser dev server writes to, and macOS filesystems can be case-sensitive.
fn notes_dir(root: &Path) -> PathBuf {
    root.join("notes")
}

fn app_root(app: &AppHandle) -> Result<PathBuf, String> {
    resolve_app_root(
        std::env::var_os(DATA_DIR_OVERRIDE).map(PathBuf::from),
        app.path().data_dir().ok(),
    )
    .ok_or_else(|| "Could not determine where to store Rapture's files".to_string())
}

fn window_state_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_root(app)?.join("window_state.json"))
}

fn save_window_state(app: &AppHandle, state: &WindowState) {
    let Ok(path) = window_state_path(app) else { return };
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string(state) {
        let _ = fs::write(&path, json);
    }
}

fn load_window_state(app: &AppHandle) -> Option<WindowState> {
    let path = window_state_path(app).ok()?;
    fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
}

/* ── Sidecar file naming ──
 *
 * Mirrors src/utils/sidecarName.ts. Keeps Unicode readable and appends a short hash of the
 * original name, so documents that used to sanitise to the same file stay apart. The hash is
 * derived, never stored. */

const SIDECAR_SUFFIX: &str = ".rapture";
const MAX_SIDECAR_BYTES: usize = 200;
const HASH_LEN: usize = 8;

fn is_legacy_safe_char(c: char) -> bool {
    c.is_ascii_alphanumeric() || matches!(c, ' ' | '.' | '(' | ')' | '-' | '_')
}

/// Stem produced by the pre-fix sanitiser. Only used to find sidecars written before the fix.
fn legacy_sidecar_stem(name: &str) -> String {
    name.chars()
        .map(|c| if is_legacy_safe_char(c) { c } else { '_' })
        .take(200)
        .collect()
}

fn fnv1a32_hex(bytes: &[u8]) -> String {
    let mut hash: u32 = 0x811c_9dc5;
    for byte in bytes {
        hash ^= u32::from(*byte);
        hash = hash.wrapping_mul(0x0100_0193);
    }
    format!("{:08x}", hash)
}

fn truncate_utf8(value: &str, max_bytes: usize) -> String {
    let mut out = String::new();
    for c in value.chars() {
        if out.len() + c.len_utf8() > max_bytes { break; }
        out.push(c);
    }
    out
}

/// Sidecar file name for a document. A name the old rule reproduced losslessly keeps its exact
/// previous sidecar name, so existing ASCII sidecars keep resolving.
fn sidecar_file_name(file_name: &str) -> String {
    if !file_name.is_empty() && file_name.chars().all(is_legacy_safe_char) {
        return format!("{}{}", legacy_sidecar_stem(file_name), SIDECAR_SUFFIX);
    }

    let readable: String = file_name
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            c if (c as u32) < 0x20 || c as u32 == 0x7f => '_',
            c => c,
        })
        .collect();
    let readable = readable.trim().trim_start_matches('.').to_string();
    let readable = if readable.is_empty() { "document".to_string() } else { readable };

    let budget = MAX_SIDECAR_BYTES - (1 + HASH_LEN + SIDECAR_SUFFIX.len());
    format!(
        "{}-{}{}",
        truncate_utf8(&readable, budget),
        fnv1a32_hex(file_name.as_bytes()),
        SIDECAR_SUFFIX,
    )
}

/// Moves a sidecar written by the pre-fix sanitiser to its new name, once, when the document has
/// no sidecar under the new name yet. The caller's write replaces the content immediately after.
fn adopt_legacy_sidecar(notes_dir: &Path, file_name: &str, file_path: &Path) {
    if file_path.exists() {
        return;
    }
    let legacy = notes_dir.join(format!("{}.rapture", legacy_sidecar_stem(file_name)));
    if legacy != file_path && legacy.exists() {
        let _ = fs::rename(&legacy, file_path);
    }
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
fn save_notes(app: AppHandle, file_name: String, notes: Vec<EyelinerNote>) -> Result<String, String> {
    let notes_dir = notes_dir(&app_root(&app)?);
    fs::create_dir_all(&notes_dir).map_err(|e| e.to_string())?;

    let file_path = notes_dir.join(sidecar_file_name(&file_name));
    adopt_legacy_sidecar(&notes_dir, &file_name, &file_path);

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

    let default_name = sidecar_file_name(&file_name);

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

/* ── macOS menu ── */

/// Identifier of the custom Quit item in the macOS menu bar.
#[cfg(target_os = "macos")]
const QUIT_MENU_ID: &str = "rapture-quit";

/// Tauri's default macOS menu, except that Quit (Cmd+Q) closes the main window instead of
/// terminating the process outright. The stock Quit item bypasses the window's close-requested
/// hooks, which would skip the pending-notes flush and the window-state save.
#[cfg(target_os = "macos")]
fn macos_menu(app: &AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    use tauri::menu::{
        AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu, HELP_SUBMENU_ID, WINDOW_SUBMENU_ID,
    };

    let pkg = app.package_info();
    let config = app.config();
    let about = AboutMetadata {
        name: Some(pkg.name.clone()),
        version: Some(pkg.version.to_string()),
        copyright: config.bundle.copyright.clone(),
        authors: config.bundle.publisher.clone().map(|p| vec![p]),
        ..Default::default()
    };

    let app_menu = Submenu::with_items(
        app,
        pkg.name.clone(),
        true,
        &[
            &PredefinedMenuItem::about(app, None, Some(about))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::services(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, None)?,
            &PredefinedMenuItem::hide_others(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, QUIT_MENU_ID, format!("Quit {}", pkg.name), true, Some("CmdOrCtrl+Q"))?,
        ],
    )?;
    let file_menu = Submenu::with_items(app, "File", true, &[&PredefinedMenuItem::close_window(app, None)?])?;
    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;
    let view_menu = Submenu::with_items(app, "View", true, &[&PredefinedMenuItem::fullscreen(app, None)?])?;
    let window_menu = Submenu::with_id_and_items(
        app,
        WINDOW_SUBMENU_ID,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, None)?,
        ],
    )?;
    let help_menu = Submenu::with_id_and_items(app, HELP_SUBMENU_ID, "Help", true, &[])?;

    Menu::with_items(app, &[&app_menu, &file_menu, &edit_menu, &view_menu, &window_menu, &help_menu])
}

/// Quit through the main window's close path so every close-requested hook runs first.
#[cfg(target_os = "macos")]
fn quit_via_window_close(app: &AppHandle) {
    match app.get_webview_window("main") {
        Some(window) => {
            let _ = window.close();
        }
        None => app.exit(0),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_dialog::init());

    #[cfg(target_os = "macos")]
    let builder = builder.menu(macos_menu).on_menu_event(|app, event| {
        if event.id() == QUIT_MENU_ID {
            quit_via_window_close(app);
        }
    });

    builder
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
                let handle = app.handle().clone();
                if let Some(state) = load_window_state(&handle) {
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
                                save_window_state(&handle, &WindowState {
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::{Path, PathBuf};

    #[test]
    fn override_dir_wins_over_platform_dir() {
        let root = resolve_app_root(
            Some(PathBuf::from("/custom/place")),
            Some(PathBuf::from("/platform/data")),
        );
        assert_eq!(root, Some(PathBuf::from("/custom/place")));
    }

    #[test]
    fn empty_override_is_ignored() {
        let root = resolve_app_root(Some(PathBuf::new()), Some(PathBuf::from("/platform/data")));
        assert_eq!(root, Some(PathBuf::from("/platform/data").join("Rapture")));
    }

    #[test]
    fn platform_dir_gets_rapture_folder_appended() {
        let root = resolve_app_root(None, Some(PathBuf::from("/platform/data")));
        assert_eq!(root, Some(PathBuf::from("/platform/data").join("Rapture")));
    }

    #[test]
    fn no_platform_dir_means_no_root() {
        assert_eq!(resolve_app_root(None, None), None);
    }

    #[test]
    fn notes_folder_is_lowercase() {
        assert_eq!(notes_dir(Path::new("/root")), PathBuf::from("/root").join("notes"));
    }

    /* Sidecar naming: shared vectors with tests/sidecarName.test.mjs. */

    #[test]
    fn fnv1a32_matches_reference_vectors() {
        assert_eq!(fnv1a32_hex(b""), "811c9dc5");
        assert_eq!(fnv1a32_hex(b"a"), "e40c292c");
        assert_eq!(fnv1a32_hex(b"foobar"), "bf9cf968");
    }

    #[test]
    fn lossless_ascii_names_keep_their_exact_old_sidecar_name() {
        for name in ["Organic_Chemistry_J_Clayden.pdf", "Notes (draft) v2.pdf", "a-b_c.1.pdf"] {
            assert_eq!(sidecar_file_name(name), format!("{}.rapture", name));
            assert_eq!(sidecar_file_name(name), format!("{}.rapture", legacy_sidecar_stem(name)));
        }
    }

    #[test]
    fn unicode_names_stay_readable_and_gain_a_hash() {
        let out = sidecar_file_name("有机化学.pdf");
        assert!(out.starts_with("有机化学.pdf-"), "got {out}");
        assert!(out.ends_with(".rapture"));
        assert_eq!(out.len(), "有机化学.pdf-".len() + HASH_LEN + SIDECAR_SUFFIX.len());
        assert_ne!(out, "______.pdf.rapture");
    }

    #[test]
    fn names_that_used_to_collide_now_differ() {
        let a = sidecar_file_name("有机化学.pdf");
        let b = sidecar_file_name("物理化学.pdf");
        assert_ne!(a, b);
        // Both collapsed to the same stem under the old rule.
        assert_eq!(legacy_sidecar_stem("有机化学.pdf"), legacy_sidecar_stem("物理化学.pdf"));

        let question = sidecar_file_name("a?b.pdf");
        let star = sidecar_file_name("a*b.pdf");
        assert!(question.starts_with("a_b.pdf-"));
        assert!(star.starts_with("a_b.pdf-"));
        assert_ne!(question, star);
    }

    #[test]
    fn unsafe_characters_become_underscores() {
        let out = sidecar_file_name("a/b\\c:d*e?f\"g<h>i|j.pdf");
        assert!(out.starts_with("a_b_c_d_e_f_g_h_i_j.pdf-"), "got {out}");
    }

    #[test]
    fn long_unicode_names_stay_within_the_byte_budget() {
        let long = format!("{}.pdf", "有".repeat(300));
        let out = sidecar_file_name(&long);
        assert!(out.len() <= MAX_SIDECAR_BYTES, "{} bytes", out.len());
        assert!(out.ends_with(".rapture"));
        // Truncation cut on a character boundary, so the name is still valid UTF-8.
        assert!(out.starts_with('有'));
    }

    #[test]
    fn naming_is_deterministic() {
        assert_eq!(sidecar_file_name("有机化学.pdf"), sidecar_file_name("有机化学.pdf"));
    }

    #[test]
    fn degenerate_names_are_still_usable() {
        assert!(sidecar_file_name("").starts_with("document-"));
        assert!(sidecar_file_name("???").starts_with("___-"));
        // New-branch names lose leading dots; legacy-safe names pass through untouched.
        assert!(!sidecar_file_name("..有机.pdf").starts_with('.'));
        assert_eq!(sidecar_file_name("..pdf"), "..pdf.rapture");
    }
}
