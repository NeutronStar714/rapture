# Rapture maintenance

- For every turn that changes Rapture, update the app version, README.md, and CHANGELOG.md together. Use a minor version for a new feature and a patch version for fixes and refinements unless the user specifies a release number.
- Keep the version in package.json, package-lock.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml, and the Rapture entry in src-tauri/Cargo.lock synchronized. The `.rapture` note format version is independent.
- Add a dated changelog entry that describes the user-visible changes and update the README sections they affect.
- Keep new behavior platform-neutral and verify the desktop preview when possible. Prefer rounded rectangles for controls; use circular controls only if requested.
- Build MSI installers only when the user says the release is ready or explicitly requests an installer. Use the desktop development preview for routine updates.
