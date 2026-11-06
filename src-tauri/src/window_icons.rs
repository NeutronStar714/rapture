use std::{cell::Cell, ptr};
use tauri::{WebviewWindow, WindowEvent};
use windows_sys::Win32::{
    Foundation::HWND,
    System::LibraryLoader::GetModuleHandleW,
    UI::{
        HiDpi::{GetDpiForWindow, GetSystemMetricsForDpi},
        WindowsAndMessaging::{
            DestroyIcon, LoadImageW, SendMessageW, ICON_BIG, ICON_SMALL, IMAGE_ICON, SM_CXICON,
            SM_CXSMICON, SM_CYICON, SM_CYSMICON, WM_SETICON,
        },
    },
};

// Tauri embeds the application's multi-size ICO under this resource ID.
const APP_ICON: u16 = 32512;

#[derive(Default)]
struct WindowIcons {
    small: isize,
    large: isize,
}

impl WindowIcons {
    fn load(hwnd: HWND) -> Option<Self> {
        // The HWND belongs to our live window. The main module owns the icon resource.
        unsafe {
            let dpi = GetDpiForWindow(hwnd);
            let module = GetModuleHandleW(ptr::null());
            if dpi == 0 || module.is_null() {
                return None;
            }
            let load = |width, height| {
                LoadImageW(
                    module,
                    APP_ICON as usize as *const u16,
                    IMAGE_ICON,
                    GetSystemMetricsForDpi(width, dpi),
                    GetSystemMetricsForDpi(height, dpi),
                    0,
                ) as isize
            };
            let icons = Self {
                small: load(SM_CXSMICON, SM_CYSMICON),
                large: load(SM_CXICON, SM_CYICON),
            };
            (icons.small != 0 && icons.large != 0).then_some(icons)
        }
    }

    fn apply(&self, hwnd: HWND) {
        // Windows borrows these handles until the icons are replaced or the window is destroyed.
        unsafe {
            SendMessageW(hwnd, WM_SETICON, ICON_SMALL as usize, self.small);
            SendMessageW(hwnd, WM_SETICON, ICON_BIG as usize, self.large);
        }
    }
}

impl Drop for WindowIcons {
    fn drop(&mut self) {
        // LoadImageW without LR_SHARED returns owned handles.
        for icon in [self.small, self.large] {
            if icon != 0 {
                unsafe { DestroyIcon(icon as _) };
            }
        }
    }
}

pub fn install(window: &WebviewWindow) {
    let Ok(hwnd) = window.hwnd() else { return };
    let Some(icons) = WindowIcons::load(hwnd.0) else {
        return;
    };
    icons.apply(hwnd.0);
    let icons = Cell::new(icons);
    let hwnd = hwnd.0 as isize;
    window.on_window_event(move |event| match event {
        WindowEvent::ScaleFactorChanged { .. } => {
            let hwnd = hwnd as HWND;
            if let Some(replacement) = WindowIcons::load(hwnd) {
                replacement.apply(hwnd);
                icons.set(replacement);
            }
        }
        WindowEvent::Destroyed => icons.set(WindowIcons::default()),
        _ => {}
    });
}
