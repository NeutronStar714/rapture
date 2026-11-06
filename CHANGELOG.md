# Changelog

## 1.6.3 — 2026-11-05

- Adjust EPUB font size by 1px with `Ctrl`/`Command` + `+` or `-`.

## 1.6.2 — 2026-11-05

- Use DPI-sized Windows window and taskbar icons from the executable’s embedded artwork. Refresh the icons when the window moves to a display with different scaling.

## 1.6.1 — 2026-11-04

- Align the EPUB chapter controls, use a muted gray percentage, and add a saved **Show chapter progress** option that defaults to on.

## 1.6.0 — 2026-11-04

- Show EPUB chapter progress beside the chapter picker using the reading position at the viewer’s center.
- Remove the red flash after EPUB reflow. The viewer still keeps the centered text in place.

## 1.5.3 — 2026-11-04

- Collapse repeated blank EPUB rows while preserving paragraph spacing, scene breaks, and saved text offsets.

## 1.5.2 — 2026-11-04

- Use live GitHub release detection in the Windows desktop preview so **New Version** appears only for a newer eligible MSI.

## 1.5.1 — 2026-11-04

- Show EPUB cover artwork or a first-page preview in the library, including for EPUBs already cached locally.

## 1.5.0 — 2026-11-04

- Show **New Version** beside the library heading when GitHub has a newer Windows x64 MSI. The dialog links to the release notes and opens Windows Installer after checking the download.
- Show a simulated update in the Windows development preview so the button and dialog can be reviewed before a newer release is published.

## 1.4.1 — 2026-11-03

- Flash the selected search result red in the navigation sidebar for PDF and EPUB.
- Mark the EPUB viewer center after reflow with a 50px-tall red band that fades vertically.

## 1.4.0 — 2026-11-03

- Share the toolbar, navigation sidebar, Notes Deck, and Revision mode across PDF and EPUB. EPUB adds chapter navigation and typography options in the shared viewer.
- Add Eyeliner and reversible highlights to EPUB. Both marks follow chapter text through reflow and can be moved, deleted, or located from the Notes Deck.
- Autosave EPUB notes and support `.rapture` import and export plus Markdown export with chapter positions and optional citations.

## 1.3.0 — 2026-11-03

- Open PDF and reflowable EPUB files from the same picker, dropzone, and recent library. EPUB books have chapter navigation, local illustrations, and a remembered reading position.
- Add EPUB Options for size (30px by default), system font family, justification, line spacing, margins, and reading theme.
- Keep the text at the center of the EPUB viewer anchored when the layout changes. A red line with faded ends briefly marks the center after reflow.
- Add reversible text highlights to the PDF Notes Deck, plus Markdown export, nearby-text citations, and note display settings.
- Locate PDF notes by distance from the viewer center, flash the selected row, and place note controls above text at sizes below 25px.
- Match Unicode compatibility forms and PDF run spacing in Chinese PDF search while preserving the original preview text.
