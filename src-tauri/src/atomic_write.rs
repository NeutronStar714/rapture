use std::{fs::{self, OpenOptions}, io::{self, Write}, path::Path, sync::atomic::{AtomicU64, Ordering}};
static NEXT_TEMP: AtomicU64 = AtomicU64::new(0);

// Stage beside the destination so replacement stays on the same filesystem.
pub fn atomic_write(path: &Path, bytes: &[u8]) -> io::Result<()> {
    let parent = path.parent().ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "Missing parent directory"))?;
    let (temporary, mut file) = loop {
        let candidate = parent.join(format!(".rapture-{}-{}.tmp", std::process::id(), NEXT_TEMP.fetch_add(1, Ordering::Relaxed)));
        match OpenOptions::new().write(true).create_new(true).open(&candidate) {
            Ok(file) => break (candidate, file),
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error),
        }
    };
    let result = (|| {
        file.write_all(bytes)?;
        file.sync_all()?;
        drop(file);
        fs::rename(&temporary, path)?;
        Ok(())
    })();
    if result.is_err() { let _ = fs::remove_file(&temporary); }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn replacement_and_failed_replacement() {
        let dir = std::env::temp_dir().join(format!("rapture-atomic-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let destination = dir.join("notes.rapture");
        atomic_write(&destination, br#"{"notes":[{"text":"old"}]}"#).unwrap();
        atomic_write(&destination, br#"{"notes":[]}"#).unwrap();
        assert_eq!(fs::read(&destination).unwrap(), br#"{"notes":[]}"#);
        let blocked = dir.join("directory");
        fs::create_dir_all(&blocked).unwrap();
        fs::write(blocked.join("keep"), "original").unwrap();
        assert!(atomic_write(&blocked, b"new").is_err());
        assert_eq!(fs::read_to_string(blocked.join("keep")).unwrap(), "original");
        assert!(!fs::read_dir(&dir).unwrap().any(|entry| entry.unwrap().file_name().to_string_lossy().ends_with(".tmp")));
        fs::remove_dir_all(dir).unwrap();
    }
}
