import React, { useState, useEffect, useRef } from 'react';
import {
  PanelLeft,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Sun,
  Moon,
  BookOpen,
  Printer,
  Download,
  Info,
  LogOut,
  Columns,
  Square,
  Maximize2,
  Minimize2,
  Search,
  FileText,
  FolderOpen,
  HelpCircle,
  Menu,
  ChevronDown
} from 'lucide-react';
import { LayoutMode, ReadingTheme, RecentPdf } from '../types';

interface ToolbarProps {
  fileName: string;
  currentPage: number;
  totalPages: number;
  zoom: number;
  layoutMode: LayoutMode;
  theme: ReadingTheme;
  sidebarOpen: boolean;
  isFullscreen: boolean;
  onToggleSidebar: () => void;
  onPageChange: (pageNum: number) => void;
  onZoomChange: (zoomValue: number) => void;
  onLayoutChange: (mode: LayoutMode) => void;
  onThemeChange: (theme: ReadingTheme) => void;
  onRotate: () => void;
  onPrint: () => void;
  onSave: () => void;
  onShowInfo: () => void;
  onCloseFile: () => void;
  onToggleFullscreen: () => void;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  onLoadSample?: () => void;
  recentPdfs?: RecentPdf[];
  onLoadRecent?: (pdf: RecentPdf) => void;
  onFileSelect?: (file: File) => void;
  onResetView?: () => void;
  notesSidebarOpen?: boolean;
  onToggleNotesSidebar?: () => void;
  revisionMode?: boolean;
  onToggleRevision?: () => void;
}

export default function Toolbar({
  fileName,
  currentPage,
  totalPages,
  zoom,
  layoutMode,
  theme,
  sidebarOpen,
  isFullscreen,
  onToggleSidebar,
  onPageChange,
  onZoomChange,
  onLayoutChange,
  onThemeChange,
  onRotate,
  onPrint,
  onSave,
  onShowInfo,
  onCloseFile,
  onToggleFullscreen,
  searchQuery = '',
  onSearchChange,
  onLoadSample,
  recentPdfs = [],
  onLoadRecent,
  onFileSelect,
  onResetView,
  notesSidebarOpen = false,
  onToggleNotesSidebar,
  revisionMode = false,
  onToggleRevision,
}: ToolbarProps) {
  const [pageInput, setPageInput] = useState(currentPage.toString());
  const [zoomInput, setZoomInput] = useState(Math.round(zoom * 100).toString());
  const [activeMenu, setActiveMenu] = useState<'file' | 'view' | 'tools' | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && onFileSelect) {
      onFileSelect(e.target.files[0]);
    }
  };

  // Keep zoom input in sync with zoom prop changes
  useEffect(() => {
    setZoomInput(Math.round(zoom * 100).toString());
  }, [zoom]);

  const handleZoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyZoom();
  };

  const applyZoom = () => {
    const cleanVal = zoomInput.replace(/%/g, '').trim();
    const parsed = parseFloat(cleanVal);
    if (!isNaN(parsed) && parsed > 0) {
      const clampedPercent = Math.max(10, Math.min(500, parsed));
      onZoomChange(clampedPercent / 100);
    } else {
      setZoomInput(Math.round(zoom * 100).toString());
    }
  };

  // Keep page input in sync with currentPage changes from scrolling or clicks
  useEffect(() => {
    setPageInput(currentPage.toString());
  }, [currentPage]);

  // Handle outside click to close menus
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(pageInput, 10);
    if (!isNaN(num) && num >= 1 && num <= totalPages) {
      onPageChange(num);
    } else {
      setPageInput(currentPage.toString());
    }
  };

  const handlePageBlur = () => {
    setPageInput(currentPage.toString());
  };

  const handleZoomSelect = (val: number) => {
    onZoomChange(val);
  };

  const toggleMenu = (menu: 'file' | 'view' | 'tools') => {
    setActiveMenu(prev => prev === menu ? null : menu);
  };

  return (
    <div className="flex flex-col shrink-0 w-full z-30 print:hidden font-sans" ref={menuRef}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleFileChange}
        className="hidden"
      />
      {/* 1. MAIN NAVIGATION BAR (Row 1 - Sleek Height 12) */}
      <header className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0 shadow-xs z-20 relative">
        {/* Left Side: Brand Logo, App Title */}
        <div className="flex items-center gap-3">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-2">
            <img src="/icon.png" alt="Rapture" className="w-7 h-7 rounded shadow-xs object-cover" />
            <h1 className="text-[15px] font-bold tracking-tight text-[#AA262C] font-sans">Rapture</h1>
          </div>
        </div>

        {/* Center Title Display (mathematically centered) */}
        <div className="hidden md:flex absolute left-1/2 transform -translate-x-1/2 items-center gap-2 max-w-[40%]">
          <FileText size={14} className="text-gray-400 shrink-0" />
          <span className="text-xs font-semibold text-gray-700 truncate text-center" title={fileName}>
            {fileName || 'document.pdf'}
          </span>
        </div>

        {/* Right Side: Quick Dropdown Menus */}
        <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5 relative">
          <button
            id="menu-file-btn"
            onClick={() => toggleMenu('file')}
            className={`px-3 py-1 text-xs font-semibold rounded transition-colors flex items-center gap-1 ${
              activeMenu === 'file'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
            }`}
          >
            File
            <ChevronDown size={10} className="opacity-60" />
          </button>
          <button
            id="menu-view-btn"
            onClick={() => toggleMenu('view')}
            className={`px-3 py-1 text-xs font-semibold rounded transition-colors flex items-center gap-1 ${
              activeMenu === 'view'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
            }`}
          >
            View
            <ChevronDown size={10} className="opacity-60" />
          </button>
          <button
            id="menu-tools-btn"
            onClick={() => toggleMenu('tools')}
            className={`px-3 py-1 text-xs font-semibold rounded transition-colors flex items-center gap-1 ${
              activeMenu === 'tools'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
            }`}
          >
            Tools
            <ChevronDown size={10} className="opacity-60" />
          </button>

          {/* Absolute Dropdowns */}
          {activeMenu === 'file' && (
            <div className="absolute right-24 top-8 bg-white border border-gray-200 shadow-lg rounded-xl py-1.5 w-52 z-40 text-left font-medium animate-in fade-in duration-100">
              <button
                onClick={() => { fileInputRef.current?.click(); setActiveMenu(null); }}
                className="w-full px-4 py-2 text-xs text-slate-500 hover:bg-gray-50 flex items-center gap-2"
              >
                <FolderOpen size={13} className="text-slate-400" />
                Load PDF from Device
              </button>
              
              <div className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-t border-gray-100 mt-1">
                RECENT
              </div>
              {recentPdfs.length > 0 ? (
                recentPdfs.slice(0, 3).map((pdf, idx) => (
                  <button
                    key={idx}
                    onClick={() => { onLoadRecent?.(pdf); setActiveMenu(null); }}
                    className="w-full px-4 py-1.5 text-[11px] text-slate-500 hover:bg-gray-50 hover:text-[#AA262C] flex items-center gap-2 truncate"
                    title={pdf.name}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0"></span>
                    <span className="truncate">{pdf.name}</span>
                  </button>
                ))
              ) : (
                <div className="px-4 py-1 text-[11px] text-slate-400 italic">No recent documents</div>
              )}
            </div>
          )}

          {activeMenu === 'view' && (
            <div className="absolute right-12 top-8 bg-white border border-gray-200 shadow-lg rounded-xl py-1.5 w-52 z-40 text-left font-medium animate-in fade-in duration-100">
              <button
                onClick={() => { onToggleSidebar(); setActiveMenu(null); }}
                className="w-full px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <PanelLeft size={13} className="text-gray-400" />
                  Toggle Sidebar Navigation
                </span>
                <span className="text-[10px] text-gray-400 font-mono">{sidebarOpen ? 'Open' : 'Closed'}</span>
              </button>
              <button
                onClick={() => { onToggleFullscreen(); setActiveMenu(null); }}
                className="w-full px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Maximize2 size={13} className="text-gray-400" />
                Presentation / Fullscreen
              </button>
              <div className="h-[1px] bg-gray-100 my-1"></div>
              <div className="px-4 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Themes</div>
              <button
                onClick={() => { onThemeChange('light'); setActiveMenu(null); }}
                className={`w-full px-4 py-1.5 text-xs flex items-center gap-2 ${theme === 'light' ? 'bg-gray-50 text-[#AA262C] font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                <Sun size={13} className="text-amber-500" />
                Day Theme (Sleek Canvas)
              </button>
              <button
                onClick={() => { onThemeChange('sepia'); setActiveMenu(null); }}
                className={`w-full px-4 py-1.5 text-xs flex items-center gap-2 ${theme === 'sepia' ? 'bg-gray-50 text-[#AA262C] font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                <BookOpen size={13} className="text-amber-700" />
                Sepia Eye-Care Theme
              </button>
              <button
                onClick={() => { onThemeChange('dark'); setActiveMenu(null); }}
                className={`w-full px-4 py-1.5 text-xs flex items-center gap-2 ${theme === 'dark' ? 'bg-gray-50 text-[#AA262C] font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                <Moon size={13} className="text-indigo-500" />
                Night Contrast Theme
              </button>
            </div>
          )}

          {activeMenu === 'tools' && (
            <div className="absolute right-0 top-8 bg-white border border-gray-200 shadow-lg rounded-xl py-1.5 w-48 z-40 text-left font-medium animate-in fade-in duration-100">
              <button
                onClick={() => { onShowInfo(); setActiveMenu(null); }}
                className="w-full px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Info size={13} className="text-gray-400" />
                Document Information
              </button>
              <button
                onClick={() => { onPrint(); setActiveMenu(null); }}
                className="w-full px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Printer size={13} className="text-gray-400" />
                Print Document
              </button>
              <button
                onClick={() => { onRotate(); setActiveMenu(null); }}
                className="w-full px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <RotateCw size={13} className="text-gray-400" />
                Rotate 90° Clockwise
              </button>
              {onResetView && (
                <>
                  <div className="h-[1px] bg-gray-100 my-1"></div>
                  <button
                    onClick={() => { onResetView(); setActiveMenu(null); }}
                    className="w-full px-4 py-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 flex items-center gap-2 font-semibold"
                  >
                    <RotateCw size={13} className="text-red-500" />
                    Reset Page & Position
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* 2. SECONDARY TOOLBAR (Row 2 - Sleek Height 10) */}
      <nav className="h-10 bg-[#f1f1f1] border-b border-gray-300 flex items-center justify-between px-4 shrink-0 shadow-2xs">
        {/* Left Section: Sidebar Toggle Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleSidebar}
            title={sidebarOpen ? "Hide Left Sidebar" : "Show Left Sidebar"}
            className={`p-1.5 rounded transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold ${
              sidebarOpen 
                ? 'bg-white shadow-xs text-[#AA262C] border border-gray-300' 
                : 'hover:bg-white hover:shadow-2xs text-gray-700'
            }`}
          >
            <PanelLeft size={14} />
            <span className="hidden sm:inline">Sidebar</span>
          </button>

          <button
            onClick={onCloseFile}
            title="Back to Library"
            className="p-1.5 rounded bg-white hover:bg-red-50 text-[#AA262C] border border-[#AA262C]/20 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold shadow-2xs"
          >
            <LogOut size={14} className="text-[#AA262C]" />
            <span>Back to Library</span>
          </button>
        </div>

        {/* Center: Controls Grid */}
        <div className="flex items-center gap-4">
          {/* Page Navigator */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="p-1 hover:bg-white disabled:opacity-30 rounded transition-all cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4 text-gray-700" />
            </button>
            <div className="flex items-center gap-1.5">
              <form onSubmit={handlePageSubmit}>
                <input
                  id="nav-page-input"
                  type="text"
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onBlur={handlePageBlur}
                  className="w-8 h-7 text-center border border-gray-300 bg-white rounded text-xs font-bold focus:outline-hidden focus:border-[#AA262C]"
                />
              </form>
              <span className="text-xs text-gray-500 font-medium">/ {totalPages}</span>
            </div>
            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="p-1 hover:bg-white disabled:opacity-30 rounded transition-all cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4 text-gray-700" />
            </button>
          </div>

          <div className="h-5 w-[1px] bg-gray-300 mx-1"></div>

          {/* Zoom controls with sleek text display */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => onZoomChange(Math.max(0.5, zoom - 0.1))}
              disabled={zoom <= 0.5}
              className="p-1 hover:bg-white disabled:opacity-30 rounded transition-all cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4 text-gray-700" />
            </button>
            
            {/* Interactive Custom Zoom Input */}
            <form onSubmit={handleZoomSubmit} className="flex items-center">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={zoomInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setZoomInput(val);
                  }}
                  onBlur={applyZoom}
                  className="w-10 h-7 text-center border border-gray-300 bg-white rounded-l text-xs font-bold focus:outline-hidden focus:border-[#AA262C] font-mono"
                />
                <span className="h-7 px-1 flex items-center bg-gray-50 border-t border-b border-r border-gray-300 rounded-r text-[10px] font-bold text-gray-500 font-mono select-none">
                  %
                </span>
              </div>
            </form>

            <button
              onClick={() => onZoomChange(Math.min(3, zoom + 0.1))}
              disabled={zoom >= 3}
              className="p-1 hover:bg-white disabled:opacity-30 rounded transition-all cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4 text-gray-700" />
            </button>
          </div>

          <div className="h-5 w-[1px] bg-gray-300 mx-1"></div>

          {/* Layout Multi-Pill Controller */}
          <div className="flex items-center gap-0.5 bg-gray-200 p-0.5 rounded border border-gray-300">
            <button
              onClick={() => onLayoutChange('single-scroll')}
              title="Continuous Scroll"
              className={`px-2.5 py-1 text-[11px] font-bold rounded flex items-center gap-1 transition-all ${
                layoutMode === 'single-scroll'
                  ? 'bg-white shadow-xs text-gray-900 border border-gray-300/10 font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className={layoutMode === 'single-scroll' ? 'text-[#AA262C]' : ''}>⇅</span>
              <span className="hidden lg:inline">Scroll</span>
            </button>
            <button
              onClick={() => onLayoutChange('double-scroll')}
              title="Book Dual Continuous Scroll"
              className={`px-2.5 py-1 text-[11px] font-bold rounded flex items-center gap-1 transition-all ${
                layoutMode === 'double-scroll'
                  ? 'bg-white shadow-xs text-gray-900 border border-gray-300/10 font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className={layoutMode === 'double-scroll' ? 'text-[#AA262C]' : ''}>📖</span>
              <span className="hidden lg:inline">Book Scroll</span>
            </button>
            <span className="w-px h-4 bg-gray-300 mx-0.5"></span>
            <button
              onClick={() => onToggleRevision?.()}
              title="Revision Mode"
              className={`px-2.5 py-1 text-[11px] font-bold rounded flex items-center gap-1 transition-all ${
                revisionMode
                  ? 'bg-[#AA262C] text-white shadow-xs font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="hidden lg:inline">Revision</span>
            </button>
          </div>
        </div>

        {/* Right Section: Extras, rotates, and Presentation Mode toggle */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleNotesSidebar}
            title={notesSidebarOpen ? "Hide Notes" : "Show Notes"}
            className={`p-1.5 rounded transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold ${
              notesSidebarOpen 
                ? 'bg-white shadow-xs text-[#AA262C] border border-gray-300' 
                : 'hover:bg-white hover:shadow-2xs text-gray-700'
            }`}
          >
            <FileText size={14} />
            <span>Notes</span>
          </button>

          <div className="h-5 w-[1px] bg-gray-300 mx-1"></div>

          <button
            onClick={onRotate}
            title="Rotate Page"
            className="p-1 hover:bg-white text-gray-700 rounded transition-all cursor-pointer"
          >
            <RotateCw size={14} />
          </button>
          <button
            onClick={onToggleFullscreen}
            title={isFullscreen ? "Exit Presentation" : "Presentation Mode"}
            className="p-1 hover:bg-white text-gray-700 rounded transition-all cursor-pointer"
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </nav>
    </div>
  );
}
