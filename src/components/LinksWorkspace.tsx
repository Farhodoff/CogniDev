import React, { useState, useMemo } from 'react';
import {
  Link2,
  Plus,
  Search,
  ExternalLink,
  Copy,
  Check,
  Pin,
  Trash2,
  Edit3,
  Sparkles,
  Download,
  BookOpen,
  Code2,
  Cloud,
  FileCode,
  Palette,
  Terminal,
  Globe,
  X,
  Layers,
} from 'lucide-react';
import { useSynapse } from '../lib/store';
import type { DevLinkItem, LinkCategory } from '../lib/types';
import { callAi } from '../lib/ai';
import {
  cleanDisplayUrl,
  formatUrl,
  parseTags,
  autoDetectCategoryAndTitle,
  buildAiResourceFinderPrompt,
  parseAiResourceResponse,
  formatExportMarkdown,
  filterBookmarks,
} from '../lib/links';

const CATEGORIES: Array<{ id: LinkCategory | 'all'; label: string; icon: any; color: string }> = [
  { id: 'all', label: 'Barchasi', icon: Layers, color: '#3b82f6' },
  { id: 'docs', label: 'Hujjatlar (Docs)', icon: BookOpen, color: '#10b981' },
  { id: 'tools', label: 'Asboblar (Tools)', icon: Terminal, color: '#8b5cf6' },
  { id: 'cloud', label: 'Cloud & Server', icon: Cloud, color: '#06b6d4' },
  { id: 'repo', label: 'Repozitoriyalar', icon: FileCode, color: '#f59e0b' },
  { id: 'learning', label: 'O‘rganish', icon: Code2, color: '#ec4899' },
  { id: 'design', label: 'UI / UX Dizayn', icon: Palette, color: '#f43f5e' },
  { id: 'other', label: 'Boshqa', icon: Globe, color: '#71717a' },
];

export default function LinksWorkspace() {
  const { links, addLink, updateLink, deleteLink, togglePinLink, spaces, setHud } = useSynapse();

  const [activeCategory, setActiveCategory] = useState<LinkCategory | 'all'>('all');
  const [selectedSpaceFilter, setSelectedSpaceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [editingLink, setEditingLink] = useState<DevLinkItem | null>(null);

  // Add/Edit Form State
  const [formTitle, setFormTitle] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formCategory, setFormCategory] = useState<LinkCategory>('docs');
  const [formDescription, setFormDescription] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formSpaceId, setFormSpaceId] = useState<string>('');
  const [formPinned, setFormPinned] = useState(false);

  // AI Finder State
  const [aiQuery, setAiQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Array<{ title: string; url: string; category: LinkCategory; description: string; tags: string[] }>>([]);

  // Auto-detect category and title helper when URL changes
  const handleUrlChange = (val: string) => {
    setFormUrl(val);
    const detected = autoDetectCategoryAndTitle(val, formTitle);
    if (detected.category) setFormCategory(detected.category);
    if (detected.suggestedTitle) setFormTitle(detected.suggestedTitle);
  };

  const handleCopy = (id: string, url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setHud('Havola nusxalandi ✓');
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleOpenLink = (url: string) => {
    const targetUrl = formatUrl(url);
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formUrl.trim()) return;

    const formattedUrl = formatUrl(formUrl);
    const parsedTags = parseTags(formTags);

    if (editingLink) {
      updateLink(editingLink.id, {
        title: formTitle.trim(),
        url: formattedUrl,
        category: formCategory,
        description: formDescription.trim() || undefined,
        tags: parsedTags,
        space_id: formSpaceId ? formSpaceId : null,
        pinned: formPinned,
      });
      setHud(`"${formTitle.trim()}" havolasi yangilandi ✓`);
    } else {
      addLink({
        title: formTitle.trim(),
        url: formattedUrl,
        category: formCategory,
        description: formDescription.trim() || undefined,
        tags: parsedTags,
        space_id: formSpaceId ? formSpaceId : null,
        pinned: formPinned,
      });
      setHud(`"${formTitle.trim()}" havolasi saqlandi ✓`);
    }

    setShowAddModal(false);
    setEditingLink(null);
    resetForm();
  };

  const resetForm = () => {
    setFormTitle('');
    setFormUrl('');
    setFormCategory('docs');
    setFormDescription('');
    setFormTags('');
    setFormSpaceId('');
    setFormPinned(false);
  };

  const openEditModal = (link: DevLinkItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingLink(link);
    setFormTitle(link.title);
    setFormUrl(link.url);
    setFormCategory(link.category);
    setFormDescription(link.description || '');
    setFormTags((link.tags || []).join(', '));
    setFormSpaceId(link.space_id || '');
    setFormPinned(!!link.pinned);
    setShowAddModal(true);
  };

  // AI Resource Finder
  const handleAiSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim() || aiLoading) return;

    setAiLoading(true);
    setAiSuggestions([]);

    const prompt = buildAiResourceFinderPrompt(aiQuery);

    try {
      const res = await callAi(prompt, "Faqat JSON qaytaring, ortiqcha so'z yoki markdown belgilarisiz.");
      const suggestions = parseAiResourceResponse(res.text);
      if (suggestions.length > 0) {
        setAiSuggestions(suggestions);
      }
    } catch {
      setHud("AI dan resurs qidirishda xatolik yuz berdi");
    } finally {
      setAiLoading(false);
    }
  };

  const handleAddAiSuggestion = (sug: { title: string; url: string; category: LinkCategory; description: string; tags: string[] }) => {
    addLink({
      title: sug.title,
      url: formatUrl(sug.url),
      category: sug.category,
      description: sug.description,
      tags: sug.tags || [],
      space_id: null,
      pinned: false,
    });
    setHud(`"${sug.title}" qo‘shildi ✓`);
    setAiSuggestions((prev) => prev.filter((item) => item.url !== sug.url));
  };

  // Export to Markdown
  const handleExportMarkdown = () => {
    const md = formatExportMarkdown(links);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CogniDev_Links_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setHud("Havolalar Markdown formatida yuklab olindi ✓");
  };

  // Filtered links
  const filteredLinks = useMemo(() => {
    return filterBookmarks(links, {
      category: activeCategory,
      spaceId: selectedSpaceFilter,
      search: searchQuery,
    });
  }, [links, activeCategory, selectedSpaceFilter, searchQuery]);

  const pinnedLinks = useMemo(() => filteredLinks.filter((l) => l.pinned), [filteredLinks]);
  const regularLinks = useMemo(() => filteredLinks.filter((l) => !l.pinned), [filteredLinks]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0b0f] p-6 text-zinc-100 select-none scrollbar-thin">
      <div className="mx-auto max-w-6xl space-y-6">

        {/* Header Banner */}
        <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-r from-blue-950/30 via-[#121319] to-purple-950/20 p-6 md:p-8 shadow-2xl relative overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-lg">
                <Link2 size={28} />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-bold tracking-tight text-white">Havolalar & Resurslar</h1>
                  <span className="rounded-full bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-blue-300">
                    {links.length} ta saqlangan
                  </span>
                </div>
                <p className="text-[13px] text-zinc-300 mt-1 max-w-xl">
                  Dasturlash hujjatlari, API konsollar, repozitoriyalar, cloud xizmatlari va muhim dev bookmarklar markazi
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={() => setShowAiModal(true)}
                className="flex items-center gap-1.5 rounded-xl border border-purple-500/30 bg-purple-600/20 hover:bg-purple-600/30 px-3.5 py-2 text-[12px] font-semibold text-purple-200 transition shadow-sm"
              >
                <Sparkles size={14} className="text-purple-300" />
                <span>AI bilan Resurs Qidirish</span>
              </button>

              <button
                onClick={handleExportMarkdown}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] px-3 py-2 text-[12px] font-medium text-zinc-300 transition"
                title="Markdown formatida yuklash"
              >
                <Download size={13} />
                <span>Eksport</span>
              </button>

              <button
                onClick={() => {
                  resetForm();
                  setEditingLink(null);
                  setShowAddModal(true);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-[12px] font-semibold text-white shadow-lg shadow-blue-600/20 transition"
              >
                <Plus size={14} />
                <span>Yangi Havola Qo‘shish</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/[0.08] relative z-10">
            <div className="rounded-xl bg-black/40 border border-white/[0.05] p-3">
              <p className="text-[11px] font-medium text-zinc-400">Jami Havolalar</p>
              <p className="text-xl font-bold text-white mt-0.5">{links.length} ta</p>
            </div>
            <div className="rounded-xl bg-black/40 border border-white/[0.05] p-3">
              <p className="text-[11px] font-medium text-zinc-400">Tezkor (Pinned)</p>
              <p className="text-xl font-bold text-amber-400 mt-0.5">{links.filter((l) => l.pinned).length} ta</p>
            </div>
            <div className="rounded-xl bg-black/40 border border-white/[0.05] p-3">
              <p className="text-[11px] font-medium text-zinc-400">Hujjatlar & Docs</p>
              <p className="text-xl font-bold text-emerald-400 mt-0.5">{links.filter((l) => l.category === 'docs').length} ta</p>
            </div>
            <div className="rounded-xl bg-black/40 border border-white/[0.05] p-3">
              <p className="text-[11px] font-medium text-zinc-400">Cloud & Asboblar</p>
              <p className="text-xl font-bold text-cyan-400 mt-0.5">{links.filter((l) => l.category === 'cloud' || l.category === 'tools').length} ta</p>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Categories */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11.5px] font-medium transition ${
                    isSelected
                      ? 'bg-blue-600/20 text-blue-300 font-semibold border border-blue-500/30'
                      : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                  }`}
                >
                  <Icon size={13} style={{ color: cat.color }} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search & Space Filter */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-2.5 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Havolalardan qidirish..."
                className="w-48 sm:w-60 rounded-xl border border-white/10 bg-[#121319] pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <select
              value={selectedSpaceFilter}
              onChange={(e) => setSelectedSpaceFilter(e.target.value)}
              className="rounded-xl border border-white/10 bg-[#121319] px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none"
            >
              <option value="all">Barcha Spacelar</option>
              {spaces.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
                </option>
              ))}
              <option value="unassigned">Ajratilmagan</option>
            </select>
          </div>
        </div>

        {/* Pinned Links Section */}
        {pinnedLinks.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Pin size={14} className="text-amber-400 fill-amber-400/20" />
              <h2 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Tezkor Havolalar ({pinnedLinks.length})
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {pinnedLinks.map((link) => {
                const catInfo = CATEGORIES.find((c) => c.id === link.category) || CATEGORIES[1];
                const Icon = catInfo.icon;
                const isCopied = copiedId === link.id;

                return (
                  <div
                    key={link.id}
                    onClick={() => handleOpenLink(link.url)}
                    className="group rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.04] via-[#121319] to-black/60 p-4 shadow-md hover:border-amber-500/40 hover:bg-white/[0.02] cursor-pointer transition flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-white/10"
                            style={{ backgroundColor: `${catInfo.color}15`, color: catInfo.color }}
                          >
                            <Icon size={17} />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-[13px] font-bold text-white group-hover:text-blue-300 transition truncate">
                              {link.title}
                            </h3>
                            <p className="text-[11px] font-mono text-zinc-500 truncate mt-0.5">
                              {cleanDisplayUrl(link.url)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePinLink(link.id);
                            }}
                            className="p-1 rounded text-amber-400 hover:text-zinc-400 transition"
                            title="Pinni olib tashlash"
                          >
                            <Pin size={13} className="fill-amber-400" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleCopy(link.id, link.url, e)}
                            className="p-1 rounded text-zinc-400 hover:text-white transition"
                            title="Nusxalash"
                          >
                            {isCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                          </button>
                        </div>
                      </div>

                      {link.description && (
                        <p className="text-[12px] text-zinc-400 leading-relaxed line-clamp-2">
                          {link.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-white/[0.04] text-[10.5px]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className="rounded-md px-1.5 py-0.5 font-medium"
                          style={{ backgroundColor: `${catInfo.color}15`, color: catInfo.color }}
                        >
                          {catInfo.label.split(' ')[0]}
                        </span>
                        {link.tags?.slice(0, 2).map((t) => (
                          <span key={t} className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-zinc-400 font-mono">
                            #{t}
                          </span>
                        ))}
                      </div>

                      <span className="flex items-center gap-1 text-zinc-500 group-hover:text-blue-400 font-medium transition">
                        <span>Ochish</span>
                        <ExternalLink size={11} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Regular Links Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
              Barcha Havolalar ({regularLinks.length})
            </h2>
            <span className="text-[11px] text-zinc-500 font-mono">
              Filtrlangan: {filteredLinks.length} ta
            </span>
          </div>

          {regularLinks.length === 0 && pinnedLinks.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center space-y-3">
              <Link2 size={36} className="mx-auto text-zinc-600" />
              <h3 className="text-sm font-bold text-zinc-300">Hech qanday havola topilmadi</h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Qidiruv so‘zini o‘zgartiring yoki yuqoridagi tugma orqali yangi dev resurs qo‘shing.
              </p>
              <button
                onClick={() => {
                  resetForm();
                  setShowAddModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition"
              >
                <Plus size={13} />
                <span>Havola Qo‘shish</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {regularLinks.map((link) => {
                const catInfo = CATEGORIES.find((c) => c.id === link.category) || CATEGORIES[1];
                const Icon = catInfo.icon;
                const isCopied = copiedId === link.id;

                return (
                  <div
                    key={link.id}
                    onClick={() => handleOpenLink(link.url)}
                    className="group rounded-2xl border border-white/[0.07] bg-[#121319] p-4 shadow-sm hover:border-white/15 hover:bg-white/[0.02] cursor-pointer transition flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                            style={{ backgroundColor: `${catInfo.color}15`, color: catInfo.color }}
                          >
                            <Icon size={17} />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-[13px] font-bold text-white group-hover:text-blue-300 transition truncate">
                              {link.title}
                            </h3>
                            <p className="text-[11px] font-mono text-zinc-500 truncate mt-0.5">
                              {cleanDisplayUrl(link.url)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePinLink(link.id);
                            }}
                            className="p-1 rounded text-zinc-500 hover:text-amber-400 transition"
                            title="Tezkorlarga biriktirish"
                          >
                            <Pin size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleCopy(link.id, link.url, e)}
                            className="p-1 rounded text-zinc-500 hover:text-white transition"
                            title="Nusxalash"
                          >
                            {isCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => openEditModal(link, e)}
                            className="p-1 rounded text-zinc-500 hover:text-blue-400 transition"
                            title="Tahrirlash"
                          >
                            <Edit3 size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteLink(link.id);
                              setHud(`"${link.title}" o‘chirildi`);
                            }}
                            className="p-1 rounded text-zinc-500 hover:text-rose-400 transition"
                            title="O‘chirish"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {link.description && (
                        <p className="text-[12px] text-zinc-400 leading-relaxed line-clamp-2">
                          {link.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-white/[0.04] text-[10.5px]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className="rounded-md px-1.5 py-0.5 font-medium"
                          style={{ backgroundColor: `${catInfo.color}15`, color: catInfo.color }}
                        >
                          {catInfo.label.split(' ')[0]}
                        </span>
                        {link.tags?.slice(0, 2).map((t) => (
                          <span key={t} className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-zinc-400 font-mono">
                            #{t}
                          </span>
                        ))}
                      </div>

                      <span className="flex items-center gap-1 text-zinc-500 group-hover:text-blue-400 font-medium transition">
                        <span>Ochish</span>
                        <ExternalLink size={11} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Add / Edit Link Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#121319] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Link2 size={18} className="text-blue-400" />
                <h3 className="text-base font-bold text-white">
                  {editingLink ? 'Havolani Tahrirlash' : 'Yangi Dev Havola Qo‘shish'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingLink(null);
                }}
                className="rounded-lg p-1 text-zinc-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                  Havola URL manzili *
                </label>
                <input
                  type="text"
                  required
                  value={formUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://github.com/facebook/react yoki docs.rs"
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                  Nomi / Sarlavha *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Masalan: React Rasmiy Hujjatlari"
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                    Bo‘lim (Kategoriya)
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as LinkCategory)}
                    className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="docs">Hujjatlar (Docs)</option>
                    <option value="tools">Asboblar (Tools)</option>
                    <option value="cloud">Cloud & Server</option>
                    <option value="repo">Repozitoriyalar</option>
                    <option value="learning">O‘rganish</option>
                    <option value="design">UI / UX Dizayn</option>
                    <option value="other">Boshqa</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                    Tegishli Space
                  </label>
                  <select
                    value={formSpaceId}
                    onChange={(e) => setFormSpaceId(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="">Umumiy (Belgilanmagan)</option>
                    {spaces.map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                  Tavsif (ixtiyoriy)
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Ushbu resurs nima uchun kerakligi yoki qisqa annotatsiya..."
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                  Teglar (vergul bilan)
                </label>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="react, frontend, hooks"
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="formPinned"
                  checked={formPinned}
                  onChange={(e) => setFormPinned(e.target.checked)}
                  className="rounded border-white/20 bg-black/40 text-blue-600 focus:ring-0"
                />
                <label htmlFor="formPinned" className="text-xs text-zinc-300 cursor-pointer">
                  Tezkor panelga (Pinned) biriktirish
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingLink(null);
                  }}
                  className="rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-2 text-xs font-semibold text-white transition shadow-lg shadow-blue-600/20"
                >
                  {editingLink ? 'Saqlash' : 'Qo‘shish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Resource Finder Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl rounded-3xl border border-purple-500/30 bg-[#121319] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-purple-400" />
                <h3 className="text-base font-bold text-white">AI Dasturchi Resurs Topuvchisi</h3>
              </div>
              <button onClick={() => setShowAiModal(false)} className="rounded-lg p-1 text-zinc-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAiSearch} className="flex items-center gap-2">
              <input
                type="text"
                autoFocus
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                placeholder="Qaysi texnologiya yoki muammo bo'yicha eng yaxshi resurs kerak?"
                className="flex-1 rounded-2xl border border-white/10 bg-black/50 px-4 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:border-purple-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={aiLoading || !aiQuery.trim()}
                className="rounded-2xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 px-5 py-2.5 text-xs font-semibold text-white transition shadow-md shadow-purple-600/20"
              >
                {aiLoading ? 'Qidirilmoqda…' : 'Qidirish'}
              </button>
            </form>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin">
              {aiSuggestions.map((sug) => (
                <div
                  key={sug.url}
                  className="rounded-2xl border border-white/[0.08] bg-black/40 p-4 space-y-2 hover:border-purple-500/30 transition flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-white">{sug.title}</h4>
                      <p className="text-[11px] font-mono text-purple-300 truncate mt-0.5">{sug.url}</p>
                      <p className="text-[11.5px] text-zinc-300 mt-1 leading-relaxed">{sug.description}</p>
                    </div>
                    <button
                      onClick={() => handleAddAiSuggestion(sug)}
                      className="shrink-0 flex items-center gap-1 rounded-xl bg-purple-600/20 hover:bg-purple-600 border border-purple-500/30 px-3 py-1.5 text-xs font-semibold text-purple-200 hover:text-white transition"
                    >
                      <Plus size={13} />
                      <span>Qo‘shish</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 pt-1 border-t border-white/[0.04]">
                    <span className="rounded bg-purple-500/10 px-1.5 py-0.5 text-[10px] text-purple-300 font-medium">
                      {sug.category}
                    </span>
                    {(sug.tags || []).map((t) => (
                      <span key={t} className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-400 font-mono">
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}

              {aiSuggestions.length === 0 && !aiLoading && (
                <div className="py-8 text-center text-zinc-500 text-xs">
                  Masalan: <em>"Docker multi-stage build best practices"</em> yoki <em>"Rust async Tokio qo'llanmasi"</em> deb yozing.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
