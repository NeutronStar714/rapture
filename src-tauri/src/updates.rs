use crate::atomic_write::atomic_write;
use semver::Version;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    ffi::OsString,
    fs,
    io::Read,
    os::windows::{ffi::OsStringExt, process::CommandExt},
    path::PathBuf,
    process::{Command, Stdio},
    ptr,
    sync::Mutex,
};
use tauri::{AppHandle, Manager};
use windows_sys::Win32::{
    System::SystemInformation::GetSystemDirectoryW,
    UI::{Shell::ShellExecuteW, WindowsAndMessaging::SW_SHOWNORMAL},
};

const API_URL: &str = "https://api.github.com/repos/NeutronStar714/rapture/releases/latest";
const RELEASES_URL: &str = "https://github.com/NeutronStar714/rapture/releases";
const MAX_MSI: usize = 128 * 1024 * 1024;
const CREATE_NO_WINDOW: u32 = 0x08000000;
static INSTALL_STARTED: Mutex<bool> = Mutex::new(false);

#[derive(Deserialize)]
struct GitHubRelease {
    tag_name: String,
    draft: bool,
    prerelease: bool,
    assets: Vec<GitHubAsset>,
}

#[derive(Deserialize)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
    size: usize,
    digest: Option<String>,
}

#[derive(Serialize)]
pub(crate) struct UpdateInfo {
    version: String,
    tag: String,
}

struct Update {
    version: Version,
    tag: String,
    asset: GitHubAsset,
}

fn stable_version(value: &str) -> Option<Version> {
    Version::parse(value)
        .ok()
        .filter(|v| v.pre.is_empty() && v.build.is_empty())
}

fn stable_tag(tag: &str) -> bool {
    stable_version(tag.strip_prefix('v').unwrap_or(tag)).is_some()
}

fn select_update(release: GitHubRelease, installed: &Version) -> Option<Update> {
    if release.draft || release.prerelease || !stable_tag(&release.tag_name) {
        return None;
    }
    release
        .assets
        .into_iter()
        .filter_map(|asset| {
            // The installer version is authoritative. The existing 1.2.0 MSI was attached to v1.1.720.
            let version = stable_version(
                asset
                    .name
                    .strip_prefix("Rapture_")?
                    .strip_suffix("_x64_en-US.msi")?,
            )?;
            let digest = asset.digest.as_deref()?.strip_prefix("sha256:")?;
            let expected_url = format!(
                "{RELEASES_URL}/download/{}/{}",
                release.tag_name, asset.name
            );
            if version <= *installed
                || asset.size == 0
                || asset.size > MAX_MSI
                || digest.len() != 64
                || !digest.bytes().all(|byte| byte.is_ascii_hexdigit())
                || asset.browser_download_url != expected_url
            {
                return None;
            }
            Some(Update {
                version,
                tag: release.tag_name.clone(),
                asset,
            })
        })
        .max_by(|a, b| a.version.cmp(&b.version))
}

fn system_tool(name: &str) -> Result<PathBuf, String> {
    let mut directory = [0u16; 260];
    // The buffer is writable for exactly the length passed to GetSystemDirectoryW.
    let len =
        unsafe { GetSystemDirectoryW(directory.as_mut_ptr(), directory.len() as u32) } as usize;
    if len == 0 || len >= directory.len() {
        return Err("Could not locate the Windows system directory.".into());
    }
    Ok(PathBuf::from(OsString::from_wide(&directory[..len])).join(name))
}

fn download(url: &str, limit: usize, redirects: bool, timeout: &str) -> Result<Vec<u8>, String> {
    // Use Windows' curl with the user's HTTPS trust store. Ignore any curl config file.
    let mut command = Command::new(system_tool("curl.exe")?);
    command.args([
        "--disable",
        "--silent",
        "--fail",
        "--proto",
        "=https",
        "--proto-redir",
        "=https",
        "--connect-timeout",
        "8",
        "--max-time",
        timeout,
        "--user-agent",
        "Rapture-Desktop",
    ]);
    if redirects {
        command.args(["--location", "--max-redirs", "5"]);
    } else {
        command.args(["--header", "Accept: application/vnd.github+json"]);
    }
    let mut child = command
        .arg(url)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|error| format!("Could not start Windows curl: {error}"))?;
    let mut bytes = Vec::new();
    let read = child
        .stdout
        .take()
        .expect("piped curl stdout")
        .take(limit as u64 + 1)
        .read_to_end(&mut bytes);
    if read.is_err() || bytes.len() > limit {
        let _ = child.kill();
        let _ = child.wait();
        return Err("The GitHub download could not be read or exceeded its expected size.".into());
    }
    let status = child.wait().map_err(|error| error.to_string())?;
    if !status.success() {
        return Err(format!(
            "Could not download from GitHub ({status}). Check your connection and try again."
        ));
    }
    Ok(bytes)
}

fn find_update(app: &AppHandle) -> Result<Option<Update>, String> {
    if !cfg!(target_arch = "x86_64") {
        return Ok(None);
    }
    let release: GitHubRelease =
        serde_json::from_slice(&download(API_URL, 1024 * 1024, false, "12")?)
            .map_err(|error| format!("Could not read the GitHub release: {error}"))?;
    Ok(select_update(release, &app.package_info().version))
}

#[tauri::command]
pub(crate) async fn check_windows_update(app: AppHandle) -> Result<Option<UpdateInfo>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        find_update(&app).map(|update| {
            update.map(|update| UpdateInfo {
                version: update.version.to_string(),
                tag: update.tag,
            })
        })
    })
    .await
    .map_err(|error| error.to_string())?
}

fn verify_msi(asset: &GitHubAsset, bytes: &[u8]) -> Result<(), String> {
    let digest = format!("sha256:{:x}", Sha256::digest(bytes));
    if bytes.len() != asset.size
        || !asset
            .digest
            .as_ref()
            .is_some_and(|expected| expected.eq_ignore_ascii_case(&digest))
    {
        return Err(
            "The installer did not match GitHub's checksum. No installer was started.".into(),
        );
    }
    Ok(())
}

#[tauri::command]
pub(crate) async fn install_windows_update(app: AppHandle, version: String) -> Result<(), String> {
    if cfg!(debug_assertions) {
        return Err("Installing updates is only available in release builds.".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let mut started = INSTALL_STARTED
            .try_lock()
            .map_err(|_| "An update is already being prepared.")?;
        if *started {
            return Err("Windows Installer has already been opened.".into());
        }
        let update = find_update(&app)?
            .filter(|update| update.version.to_string() == version)
            .ok_or("This update is no longer available. Reopen Rapture to check again.")?;
        let bytes = download(
            &update.asset.browser_download_url,
            update.asset.size,
            true,
            "180",
        )?;
        verify_msi(&update.asset, &bytes)?;

        let directory = app
            .path()
            .app_cache_dir()
            .map_err(|error| error.to_string())?
            .join("updates");
        fs::create_dir_all(&directory)
            .map_err(|error| format!("Could not create the update cache: {error}"))?;
        let installer = directory.join(&update.asset.name);
        atomic_write(&installer, &bytes)
            .map_err(|error| format!("Could not save the installer: {error}"))?;

        Command::new(system_tool("msiexec.exe")?)
            .arg("/i")
            .arg(&installer)
            .arg("/norestart")
            .spawn()
            .map_err(|error| format!("Could not start Windows Installer: {error}"))?;
        *started = true;
        Ok(())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub(crate) fn open_rapture_releases(tag: Option<String>) -> Result<(), String> {
    let url = match tag {
        Some(tag) if stable_tag(&tag) => format!("{RELEASES_URL}/tag/{tag}"),
        _ => RELEASES_URL.to_string(),
    };
    let target: Vec<u16> = url.encode_utf16().chain(std::iter::once(0)).collect();
    // The target is a NUL-terminated HTTPS URL under the fixed GitHub release page.
    let result = unsafe {
        ShellExecuteW(
            ptr::null_mut(),
            ptr::null(),
            target.as_ptr(),
            ptr::null(),
            ptr::null(),
            SW_SHOWNORMAL,
        )
    };
    if result as isize <= 32 {
        return Err("Could not open GitHub in the default browser.".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn release() -> GitHubRelease {
        let name = "Rapture_1.2.0_x64_en-US.msi".to_string();
        GitHubRelease {
            tag_name: "v1.1.720".into(),
            draft: false,
            prerelease: false,
            assets: vec![GitHubAsset {
                browser_download_url: format!("{RELEASES_URL}/download/v1.1.720/{name}"),
                name,
                size: 3,
                digest: Some(format!("sha256:{:x}", Sha256::digest(b"msi"))),
            }],
        }
    }

    #[test]
    fn compares_installer_version_even_when_release_tag_differs() {
        let found = select_update(release(), &Version::new(1, 1, 720)).unwrap();
        assert_eq!(found.version, Version::new(1, 2, 0));
        assert!(select_update(release(), &Version::new(1, 2, 0)).is_none());
        assert!(select_update(release(), &Version::new(1, 5, 0)).is_none());
    }

    #[test]
    fn rejects_preview_release_untrusted_url_and_missing_digest() {
        let installed = Version::new(1, 1, 0);
        let mut preview = release();
        preview.prerelease = true;
        assert!(select_update(preview, &installed).is_none());
        let mut other = release();
        other.assets[0].browser_download_url = "https://example.org/update.msi".into();
        assert!(select_update(other, &installed).is_none());
        let mut unverified = release();
        unverified.assets[0].digest = None;
        assert!(select_update(unverified, &installed).is_none());
    }

    #[test]
    fn verifies_installer_size_and_contents() {
        let asset = &release().assets[0];
        assert!(verify_msi(asset, b"msi").is_ok());
        assert!(verify_msi(asset, b"bad").is_err());
        assert!(verify_msi(asset, b"ms").is_err());
    }
}
