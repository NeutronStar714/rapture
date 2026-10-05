import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Search, Image as ImageIcon, Bookmark, ChevronRight, CornerDownRight, ChevronsUpDown, AlertCircle } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { OutlineItem, SearchMatch, PageSize } from '../types';
import PdfThumbnail from './PdfThumbnail';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  currentPage: number;
  onPageClick: (pageNum: number) => void;
  pageSizes: PageSize[];
  outline: OutlineItem[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchResults: SearchMatch[];
  isSearching: boolean;
  overlay?: boolean;
}

export default function Sidebar({
  isOpen,
  onClose,
  pdfDoc,
  currentPage,
  onPageClick,
  pageSizes,
  outline,
  searchQuery,
  onSearchChange,
  searchResults,
  isSearching,
  overlay = false,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<'thumbnails' | 'outline' | 'search'>('thumbnails');
  const [expandedOutlineItems, setExpandedOutlineItems] = useState<{ [title: string]: boolean }>({});

  if (!isOpen) return null;

  const toggleOutlineExpand = (title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedOutlineItems((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  // Recursive Bookmark Outline Node Renderer
  const renderOutlineNode = (nodes: OutlineItem[], depth = 0) => {
    return (
      <ul className={`space-y-1 ${depth > 0 ? 'ml-3 border-l border-slate-100 pl-2 mt-1' : ''}`}>
        {nodes.map((node, i) => {
          const hasChildren = node.items && node.items.length > 0;
          const isExpanded = !!expandedOutlineItems[node.title];
          const isActive = currentPage === node.pageNumber;

          return (
            <li key={`${node.title}-${i}`} className="text-xs">
              <div
                onClick={() => onPageClick(node.pageNumber)}
                className={`group flex items-center justify-between rounded-lg px-2.5 py-2 font-medium transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-red-50 text-[#AA262C]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-1.5 overflow-hidden">
                  {depth > 0 && <CornerDownRight size={12} className="text-slate-300 shrink-0" />}
                  <span className="truncate" title={node.title}>{node.title}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${isActive ? 'bg-red-100/80 text-[#AA262C] font-semibold' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'}`}>
                    p. {node.pageNumber}
                  </span>

                  {hasChildren && (
                    <button
                      id={`expand-outline-${i}`}
                      onClick={(e) => toggleOutlineExpand(node.title, e)}
                      className="p-0.5 rounded hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <ChevronRight
                        size={14}
                        className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                      />
                    </button>
                  )}
                </div>
              </div>

              {hasChildren && isExpanded && renderOutlineNode(node.items!, depth + 1)}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <>
      {/* Backdrop for overlay mode */}
      {overlay && (
        <div
          className="absolute inset-0 bg-black/20 z-25"
          onClick={onClose}
        />
      )}
      <div
        id="rapture-sidebar"
        className={`w-64 border-r border-gray-200 bg-[#fcfcfc] flex flex-col h-full select-none font-sans overflow-hidden shadow-xl ${
          overlay
            ? 'absolute left-0 top-0 bottom-0 z-30'
            : 'shrink-0 z-20 shadow-2xs'
        }`}
      >
      {/* Sidebar Header / Tab switcher */}
      <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-[#fcfcfc]">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Navigation Deck</span>
        <button className="text-gray-400 hover:text-gray-600" onClick={onClose} title="Close Sidebar">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M5 4h10v2H5V4zm0 5h10v2H5V9zm0 5h10v2H5v-2z"></path></svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 px-2 py-1.5 bg-gray-50/50 gap-1">
        <button
          id="tab-thumbnails"
          onClick={() => setActiveTab('thumbnails')}
          className={`flex-1 flex items-center justify-center gap-1 py-1 text-[11px] font-bold rounded transition-all duration-150 cursor-pointer ${
            activeTab === 'thumbnails'
              ? 'bg-white text-[#AA262C] shadow-xs border border-gray-200'
              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200/50'
          }`}
        >
          <ImageIcon size={12} />
          Pages
        </button>

        <button
          id="tab-outline"
          onClick={() => setActiveTab('outline')}
          className={`flex-1 flex items-center justify-center gap-1 py-1 text-[11px] font-bold rounded transition-all duration-150 cursor-pointer ${
            activeTab === 'outline'
              ? 'bg-white text-[#AA262C] shadow-xs border border-gray-200'
              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200/50'
          }`}
        >
          <Bookmark size={12} />
          Outline
        </button>

        <button
          id="tab-search"
          onClick={() => setActiveTab('search')}
          className={`flex-1 flex items-center justify-center gap-1 py-1 text-[11px] font-bold rounded transition-all duration-150 cursor-pointer ${
            activeTab === 'search'
              ? 'bg-white text-[#AA262C] shadow-xs border border-gray-200'
              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200/50'
          }`}
        >
          <Search size={12} />
          Search
        </button>
      </div>

      {/* Sidebar Content */}
      <div className="flex-1 overflow-y-auto p-3 bg-[#fcfcfc]">
        {/* THUMBNAILS TAB */}
        {activeTab === 'thumbnails' && pdfDoc && (
          <div className="grid grid-cols-2 gap-3" id="thumbnails-grid">
            {Array.from({ length: pdfDoc.numPages }).map((_, i) => {
              const pageNum = i + 1;
              return (
                <PdfThumbnail
                  key={`thumb-${pageNum}`}
                  pdfDoc={pdfDoc}
                  pageNumber={pageNum}
                  isActive={currentPage === pageNum}
                  onClick={() => onPageClick(pageNum)}
                  pageSize={pageSizes[i]}
                />
              );
            })}
          </div>
        )}

        {/* BOOKMARKS / OUTLINE TAB */}
        {activeTab === 'outline' && (
          <div className="space-y-2">
            {outline.length > 0 ? (
              renderOutlineNode(outline)
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-12 px-4 text-slate-400 gap-2">
                <Bookmark size={32} className="text-slate-300 stroke-1" />
                <p className="text-xs font-medium text-slate-500">No outlines or bookmarks found</p>
                <p className="text-[10px] text-slate-400 max-w-[200px]">
                  This PDF does not contain an internal table of contents structure.
                </p>
              </div>
            )}
          </div>
        )}

        {/* SEARCH TAB */}
        {activeTab === 'search' && (
          <div className="space-y-4">
            {/* Search inputs */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="sidebar-search-input"
                type="text"
                placeholder="Search text in document..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:border-rapture focus:outline-hidden transition-colors"
              />
            </div>

            {/* Results listing */}
            <div className="space-y-2">
              {isSearching ? (
                <div className="flex items-center justify-center py-12 gap-2 text-slate-400 text-xs font-mono">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="w-4 h-4 border-2 border-rapture border-t-transparent rounded-full"
                  />
                  Scanning PDF text...
                </div>
              ) : searchQuery ? (
                <>
                  <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                    Matches ({searchResults.length})
                  </p>
                  
                  {searchResults.length > 0 ? (
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                      {searchResults.map((match, i) => (
                        <div
                          key={`match-${i}`}
                          onClick={() => onPageClick(match.pageNumber)}
                          className="p-3 bg-slate-50 hover:bg-rapture-light/30 border border-slate-100 hover:border-rapture/20 rounded-xl transition-all cursor-pointer group"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[9px] font-bold font-mono text-rapture uppercase bg-rapture/10 px-1.5 py-0.5 rounded">
                              Page {match.pageNumber}
                            </span>
                            <span className="text-[9px] text-slate-400 font-mono group-hover:text-rapture transition-colors">
                              Result #{i + 1}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed break-words font-sans">
                            {/* Simple text highlight inside snippet */}
                            {(() => {
                              const queryEscaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                              const regex = new RegExp(`(${queryEscaped})`, 'gi');
                              const parts = match.snippet.split(regex);
                              return parts.map((part, index) => 
                                regex.test(part) ? (
                                  <mark key={index} className="bg-amber-100 text-amber-950 px-0.5 rounded font-semibold">
                                    {part}
                                  </mark>
                                ) : (
                                  part
                                )
                              );
                            })()}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center py-12 text-slate-400 gap-1.5">
                      <AlertCircle size={24} className="text-slate-300" />
                      <p className="text-xs font-semibold text-slate-500">No matches found</p>
                      <p className="text-[10px] text-slate-400 max-w-[200px]">
                        Try searching for keywords with other casing or spellings.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 px-4 text-slate-400">
                  <p className="text-xs font-medium text-slate-500">Search Engine Online</p>
                  <p className="text-[10px] text-slate-400 max-w-[200px] mx-auto mt-1 leading-normal">
                    Enter terms like <strong className="text-slate-600">Rapture</strong>, <strong className="text-slate-600">Layout</strong>, or <strong className="text-slate-600">Theme</strong> to search across all pages instantly.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
