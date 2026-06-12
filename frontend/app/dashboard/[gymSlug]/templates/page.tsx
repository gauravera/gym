'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  RefreshCcw,
  Trash2,
  AlertCircle,
  CheckCircle,
  X,
  FileText,
  Upload,
  Info,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Send,
  Eye,
  Settings,
  HelpCircle,
  Flame,
  LayoutGrid,
  List,
  Filter
} from 'lucide-react';

interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  url?: string;
  phone_number?: string;
  buttons?: Array<{
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
    text: string;
    url?: string;
    phone_number?: string;
  }>;
  example?: {
    header_handle?: string[];
    local_filename?: string;
    local_mimetype?: string;
    local_originalname?: string;
  };
}

interface WhatsAppTemplate {
  id: string;
  gymId: string;
  templateName: string;
  metaTemplateId: string | null;
  language: string;
  category: string;
  status: string; // draft, PENDING, APPROVED, REJECTED, etc.
  components: any; // Database stores as Json, maps to TemplateComponent[]
  createdAt: string;
  updatedAt: string;
}

interface FormButton {
  id: string;
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  text: string;
  value: string;
}

const statusOptions = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Drafts' },
  { value: 'PENDING', label: 'Pending Approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

const categoryOptions = [
  { value: 'ALL', label: 'All Categories' },
  { value: 'UTILITY', label: 'Utility' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'AUTHENTICATION', label: 'Authentication' },
];

const getStatusBadge = (status: string) => {
  const s = (status || '').toUpperCase();
  if (s === 'APPROVED') {
    return (
      <span className="font-bold text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.4)] flex items-center gap-1.5 mt-1">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> APPROVED
      </span>
    );
  }
  if (s === 'PENDING') {
    return (
      <span className="font-bold text-amber-500 drop-shadow-[0_0_6px_rgba(245,158,11,0.4)] flex items-center gap-1.5 mt-1">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> PENDING
      </span>
    );
  }
  if (s === 'REJECTED') {
    return (
      <span className="font-bold text-rose-500 drop-shadow-[0_0_6px_rgba(244,63,94,0.4)] flex items-center gap-1.5 mt-1">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> REJECTED
      </span>
    );
  }
  return (
    <span className="font-bold text-violet-400 drop-shadow-[0_0_6px_rgba(167,139,250,0.4)] flex items-center gap-1.5 mt-1">
      <span className="h-1.5 w-1.5 rounded-full bg-violet-400" /> LOCAL DRAFT
    </span>
  );
};

export default function MessageTemplatesPage() {
  const { gymSlug } = useParams() as { gymSlug: string };
  const router = useRouter();

  // Connection & settings details
  const [isConnected, setIsConnected] = useState(false);
  const [wabaDetails, setWabaDetails] = useState<any>(null);

  // Lists & loader state
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingAll, setSyncingAll] = useState(false);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);

  // Search & filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentTheme, setCurrentTheme] = useState<string>('dark');


  // Custom Dropdowns State
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (statusRef.current && !statusRef.current.contains(event.target as Node)) {
        setIsStatusOpen(false);
      }
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setIsCategoryOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const htmlEl = document.documentElement;
    const initialTheme = htmlEl.getAttribute('data-theme') || 'dark';
    setCurrentTheme(initialTheme);

    const observer = new MutationObserver(() => {
      const updatedTheme = htmlEl.getAttribute('data-theme') || 'dark';
      setCurrentTheme(updatedTheme);
    });

    observer.observe(htmlEl, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // Preview Drawer Modal state
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);

  // Create Template Drawer form state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('UTILITY');
  const [formLanguage, setFormLanguage] = useState('en_US');
  const [formHeaderType, setFormHeaderType] = useState<'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'>('NONE');
  const [formHeaderText, setFormHeaderText] = useState('');
  const [formHeaderFile, setFormHeaderFile] = useState<File | null>(null);
  const [formBody, setFormBody] = useState('');
  const [formFooter, setFormFooter] = useState('');
  const [formButtons, setFormButtons] = useState<FormButton[]>([]);

  // ----------------------------------------------------
  // FETCH INTEGRATION STATUS & TEMPLATES
  // ----------------------------------------------------
  const fetchStatus = async () => {
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/whatsapp/status`);
      if (res.ok) {
        const data = await res.json();
        setIsConnected(data.connected);
        setWabaDetails({
          phoneNumber: data.phoneNumber,
          verificationStatus: data.whatsappVerificationStatus,
          qualityRating: data.whatsappQualityRating,
          messagingTier: data.whatsappMessagingTier,
          verifiedName: data.whatsappVerifiedName,
          displayPhoneNumber: data.whatsappDisplayPhoneNumber,
        });
      }
    } catch (e) {
      console.error('Failed to load WhatsApp configuration status:', e);
    }
  };

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/whatsapp/templates`);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      } else {
        toast.error('Failed to fetch templates from backend database.');
      }
    } catch (e) {
      console.error('Error fetching templates:', e);
      toast.error('An unexpected error occurred while loading templates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchTemplates();
  }, [gymSlug]);

  // ----------------------------------------------------
  // TEMPLATE CRUD & META SUBMISSIONS
  // ----------------------------------------------------
  const handleSyncAllTemplates = async () => {
    setSyncingAll(true);
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/whatsapp/sync-templates`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Successfully synced templates from Meta!');
        fetchTemplates();
      } else {
        toast.error(data.error || 'Failed to sync templates.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not sync templates. Verify network/Meta setup.');
    } finally {
      setSyncingAll(false);
    }
  };

  const handleSubmitToMeta = async (templateId: string) => {
    setActionInProgressId(templateId);
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/whatsapp/templates/${templateId}/submit`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Template submitted to Meta successfully!');
        fetchTemplates();
      } else {
        toast.error(data.error || 'Failed to submit template to Meta.');
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred during submission.');
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleSyncTemplateStatus = async (templateId: string) => {
    setActionInProgressId(templateId);
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/whatsapp/templates/${templateId}/sync-status`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Template status updated: ${data.status}`);
        fetchTemplates();
      } else {
        toast.error(data.error || 'Failed to sync status.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not fetch template status.');
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template? If it has been submitted to Meta, this will also attempt to delete it on Meta.')) {
      return;
    }
    setActionInProgressId(templateId);
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/whatsapp/templates/${templateId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Template deleted successfully.');
        fetchTemplates();
        if (selectedTemplate?.id === templateId) {
          setSelectedTemplate(null);
        }
      } else {
        toast.error(data.error || 'Failed to delete template.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not complete deletion request.');
    } finally {
      setActionInProgressId(null);
    }
  };

  // ----------------------------------------------------
  // SUBMIT NEW DRAFT FORM
  // ----------------------------------------------------
  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formBody.trim()) {
      toast.error('Please fill in the template name and body message.');
      return;
    }

    setIsSavingDraft(true);
    try {
      const formData = new FormData();
      formData.append('name', formName.trim().toLowerCase());
      formData.append('category', formCategory);
      formData.append('language', formLanguage);
      formData.append('body', formBody);
      formData.append('footer', formFooter);
      formData.append('headerType', formHeaderType);

      if (formHeaderType === 'TEXT') {
        formData.append('headerText', formHeaderText);
      } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(formHeaderType) && formHeaderFile) {
        formData.append('headerFile', formHeaderFile);
      }

      // Convert buttons list to JSON without ID parameters
      const parsedButtons = formButtons.map(b => ({
        type: b.type,
        text: b.text,
        value: b.value
      }));
      formData.append('buttons', JSON.stringify(parsedButtons));

      const res = await fetch(`/api/dashboard/${gymSlug}/whatsapp/templates`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Draft template saved successfully!');
        resetForm();
        setIsCreateOpen(false);
        fetchTemplates();
      } else {
        toast.error(data.error || 'Failed to create template draft.');
      }
    } catch (err) {
      console.error(err);
      toast.error('An unexpected error occurred while saving.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormCategory('UTILITY');
    setFormLanguage('en_US');
    setFormHeaderType('NONE');
    setFormHeaderText('');
    setFormHeaderFile(null);
    setFormBody('');
    setFormFooter('');
    setFormButtons([]);
  };

  const handleAddButton = () => {
    if (formButtons.length >= 10) {
      toast.warn('WhatsApp restricts templates to a maximum of 10 buttons.');
      return;
    }
    const newBtn: FormButton = {
      id: Math.random().toString(36).substring(2, 9),
      type: 'QUICK_REPLY',
      text: '',
      value: ''
    };
    setFormButtons([...formButtons, newBtn]);
  };

  const handleUpdateButton = (id: string, field: keyof FormButton, val: string) => {
    setFormButtons(
      formButtons.map(b => (b.id === id ? { ...b, [field]: val } : b))
    );
  };

  const handleRemoveButton = (id: string) => {
    setFormButtons(formButtons.filter(b => b.id !== id));
  };

  // Safe template name typing logic
  const handleNameInput = (val: string) => {
    const formatted = val
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
    setFormName(formatted);
  };

  // ----------------------------------------------------
  // TEMPLATES FILTER LOGIC
  // ----------------------------------------------------
  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.templateName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || t.status.toUpperCase() === statusFilter.toUpperCase();
    const matchesCategory = categoryFilter === 'ALL' || t.category.toUpperCase() === categoryFilter.toUpperCase();
    return matchesSearch && matchesStatus && matchesCategory;
  });


  return (
    <div className="space-y-8 pb-16">
      <ToastContainer theme="dark" toastClassName="border border-zinc-850 bg-zinc-950 text-white rounded-xl text-xs font-semibold" />

      {/* Main Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl flex items-center gap-2">
            <FileText className="h-7 w-7 text-cyan-400" />
            Message Templates
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Build drafts, verify headers, register templates on Meta, and track their verification states.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleSyncAllTemplates}
            disabled={syncingAll || !isConnected}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition-all disabled:opacity-50 ${
              currentTheme === 'dark'
                ? 'neon-btn-secondary'
                : 'border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-850'
            }`}
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${syncingAll ? 'animate-spin' : ''}`} />
            Sync from Meta
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
              currentTheme === 'dark'
                ? 'neon-btn-primary'
                : 'bg-cyan-600 text-white hover:bg-cyan-500'
            }`}
          >
            <Plus className="h-4 w-4" />
            Create Template
          </button>
        </div>
      </div>

      {/* Connection Alert Banner */}
      {!isConnected && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3 backdrop-blur-md">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="block font-bold text-white text-xs">WhatsApp Integration Not Connected</span>
            <p className="text-[11px] text-zinc-400 leading-relaxed max-w-2xl">
              To submit templates to Meta for approval, you must first connect and verify your WhatsApp Business Account.
            </p>
            <button
              onClick={() => router.push(`/dashboard/${gymSlug}/settings`)}
              className="text-[10px] text-cyan-400 font-bold hover:underline flex items-center gap-1 mt-1.5"
            >
              Configure WhatsApp now <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Toolbar Filters Panel */}
      <div className={`relative z-20 rounded-2xl p-4 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs transition-all duration-300 ${
        currentTheme === 'dark' ? 'bg-zinc-950/40' : 'bg-zinc-950/70'
      }`}>
        <div className="flex flex-1 flex-col sm:flex-row items-center justify-between gap-3 w-full">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-zinc-500">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/40 py-2.5 pl-10 pr-4 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all"
            />
          </div>

          {/* Filters Selectors Dropdowns */}
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto sm:ml-auto">
            {/* Custom Status Dropdown */}
            <div ref={statusRef} className="relative w-full sm:w-[180px]">
              <button
                type="button"
                onClick={() => {
                  setIsStatusOpen(!isStatusOpen);
                  setIsCategoryOpen(false);
                }}
                className="w-full text-left flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/60 px-4 py-2.5 text-xs font-semibold text-zinc-300 hover:text-white transition-all focus:outline-none focus:border-cyan-500"
              >
                <span>
                  {statusOptions.find((o) => o.value === statusFilter)?.label || 'All Statuses'}
                </span>
                <ChevronDown className="h-4 w-4 text-zinc-500" />
              </button>
              {isStatusOpen && (
                <div className="absolute top-full mt-2 left-0 w-full min-w-[180px] bg-zinc-950/95 backdrop-blur-md border border-zinc-800 rounded-xl shadow-xl p-1 z-50 flex flex-col gap-1">
                  {statusOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setStatusFilter(opt.value);
                        setIsStatusOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        statusFilter === opt.value
                          ? 'bg-cyan-500/10 text-cyan-400 font-semibold'
                          : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Category Dropdown */}
            <div ref={categoryRef} className="relative w-full sm:w-[180px]">
              <button
                type="button"
                onClick={() => {
                  setIsCategoryOpen(!isCategoryOpen);
                  setIsStatusOpen(false);
                }}
                className="w-full text-left flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/60 px-4 py-2.5 text-xs font-semibold text-zinc-300 hover:text-white transition-all focus:outline-none focus:border-cyan-500"
              >
                <span>
                  {categoryOptions.find((o) => o.value === categoryFilter)?.label || 'All Categories'}
                </span>
                <ChevronDown className="h-4 w-4 text-zinc-500" />
              </button>
              {isCategoryOpen && (
                <div className="absolute top-full mt-2 left-0 w-full min-w-[180px] bg-zinc-950/95 backdrop-blur-md border border-zinc-800 rounded-xl shadow-xl p-1 z-50 flex flex-col gap-1">
                  {categoryOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setCategoryFilter(opt.value);
                        setIsCategoryOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        categoryFilter === opt.value
                          ? 'bg-cyan-500/10 text-cyan-400 font-semibold'
                          : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-zinc-900 pt-3 md:border-none md:pt-0 shrink-0">
          <span className="text-zinc-500 font-semibold mr-1">View:</span>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-xl border transition-all ${
              viewMode === 'grid'
                ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.1)]'
                : 'border-zinc-800 bg-zinc-900/40 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-xl border transition-all ${
              viewMode === 'list'
                ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.1)]'
                : 'border-zinc-800 bg-zinc-900/40 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Templates Display Section */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <RefreshCcw className="h-8 w-8 text-cyan-400 animate-spin" />
          <span className="text-xs font-semibold text-zinc-500 tracking-wider uppercase">Loading message templates...</span>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-850 p-12 text-center flex flex-col items-center justify-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-zinc-900 flex items-center justify-center border border-zinc-800 text-zinc-600">
            <FileText className="h-6 w-6" />
          </div>
          <div className="space-y-1 max-w-sm">
            <span className="block font-bold text-white text-sm">No Templates Found</span>
            <p className="text-xs text-zinc-500 leading-relaxed">
              {searchTerm || statusFilter !== 'ALL' || categoryFilter !== 'ALL'
                ? 'No templates match your selected filters. Try updating your criteria.'
                : 'Get started by creating a local draft template and sending it to Meta for approval.'}
            </p>
          </div>
          {(searchTerm || statusFilter !== 'ALL' || categoryFilter !== 'ALL') ? (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
                setCategoryFilter('ALL');
              }}
              className="rounded-xl border border-zinc-850 bg-zinc-900 px-4 py-2 text-xs font-bold text-zinc-300 transition-all hover:bg-zinc-850"
            >
              Clear Filters
            </button>
          ) : (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-cyan-500"
            >
              <Plus className="h-4 w-4" /> Create Draft Template
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW MODE */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((t) => (
            <div
              key={t.id}
              className="group relative rounded-2xl border border-zinc-900 bg-zinc-950/60 p-5 flex flex-col justify-between backdrop-blur-md"
            >
              <div className="space-y-4">
                {/* Template Card Top Bar */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5 overflow-hidden">
                    <span className="font-extrabold text-sm text-white block truncate tracking-tight">
                      {t.templateName}
                    </span>
                    <div className="flex flex-wrap gap-1.5 items-center mt-1">
                      <span className="rounded bg-zinc-900 border border-zinc-850 px-1.5 py-0.5 text-[9px] font-extrabold text-zinc-400 uppercase">
                        {t.category}
                      </span>
                      <span className="rounded bg-zinc-900 border border-zinc-850 px-1.5 py-0.5 text-[9px] font-extrabold text-zinc-400 uppercase">
                        {t.language}
                      </span>
                    </div>
                  </div>

                  <span className={`rounded px-2.5 py-0.5 text-[9px] font-black tracking-wider uppercase shrink-0 border ${t.status === 'draft'
                      ? 'bg-zinc-900/50 border-zinc-850 text-zinc-400'
                      : t.status.toUpperCase() === 'APPROVED' || t.status.toUpperCase() === 'ACTIVE'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : t.status.toUpperCase() === 'PENDING'
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse'
                          : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    }`}>
                    {t.status}
                  </span>
                </div>

                {/* Content Details Preview Block */}
                {renderComponentSummary(t.components)}
              </div>

              {/* Template Card Bottom Actions Bar */}
              <div className="flex items-center justify-between gap-2 border-t border-zinc-900/70 pt-4 mt-5">
                <button
                  onClick={() => setSelectedTemplate(t)}
                  className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-bold tracking-tight transition-all"
                >
                  <Eye className="h-3.5 w-3.5" /> Preview
                </button>

                <div className="flex items-center gap-2">
                  {t.status === 'draft' ? (
                    <button
                      onClick={() => handleSubmitToMeta(t.id)}
                      disabled={actionInProgressId !== null || !isConnected}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-400 hover:bg-cyan-900 text-[10px] font-extrabold uppercase tracking-wider transition-all disabled:opacity-50"
                    >
                      <Send className="h-3 w-3" />
                      Submit
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSyncTemplateStatus(t.id)}
                      disabled={actionInProgressId !== null}
                      className="flex items-center justify-center p-1.5 rounded-lg border border-zinc-850 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white transition-all disabled:opacity-50"
                      title="Sync Approval Status"
                    >
                      <RefreshCcw className={`h-3.5 w-3.5 ${actionInProgressId === t.id ? 'animate-spin' : ''}`} />
                    </button>
                  )}

                  <button
                    onClick={() => handleDeleteTemplate(t.id)}
                    disabled={actionInProgressId !== null}
                    className="flex items-center justify-center p-1.5 rounded-lg border border-rose-950/40 bg-rose-950/10 hover:bg-rose-950/20 text-rose-400 transition-all disabled:opacity-50"
                    title="Delete Template"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Action Loading Overlay */}
              {actionInProgressId === t.id && (
                <div className="absolute inset-0 bg-zinc-950/70 rounded-2xl flex items-center justify-center backdrop-blur-[1px] z-10">
                  <RefreshCcw className="h-5 w-5 text-cyan-400 animate-spin" />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* LIST VIEW MODE */
        <div className="rounded-2xl border border-zinc-900 bg-zinc-950/60 overflow-hidden backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 bg-zinc-900/30 text-zinc-500 uppercase tracking-widest text-[9px] font-black">
                  <th className="p-4">Template Name</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Language</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Components</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {filteredTemplates.map((t) => (
                  <tr key={t.id} className="hover:bg-zinc-900/20 transition-all text-zinc-300">
                    <td className="p-4 font-bold text-white">{t.templateName}</td>
                    <td className="p-4">
                      <span className="rounded bg-zinc-900 border border-zinc-850 px-2 py-0.5 font-semibold uppercase tracking-wider text-[10px]">
                        {t.category}
                      </span>
                    </td>
                    <td className="p-4 font-semibold text-zinc-400">{t.language}</td>
                    <td className="p-4">
                      <span className={`rounded px-2 py-0.5 text-[9px] font-black border ${t.status === 'draft'
                          ? 'bg-zinc-900/50 border-zinc-850 text-zinc-400'
                          : t.status.toUpperCase() === 'APPROVED' || t.status.toUpperCase() === 'ACTIVE'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : t.status.toUpperCase() === 'PENDING'
                              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse'
                              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                        }`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="p-4 max-w-xs truncate text-zinc-500 font-mono">
                      {getComponentsSnippet(t.components)}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2.5">
                        <button
                          onClick={() => setSelectedTemplate(t)}
                          className="p-1 text-cyan-400 hover:text-cyan-300 font-semibold"
                          title="Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {t.status === 'draft' ? (
                          <button
                            onClick={() => handleSubmitToMeta(t.id)}
                            disabled={actionInProgressId !== null || !isConnected}
                            className="flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-950 border border-cyan-800 text-cyan-400 hover:bg-cyan-900 text-[10px] font-black uppercase transition-all disabled:opacity-50"
                          >
                            <Send className="h-2.5 w-2.5" /> Submit
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSyncTemplateStatus(t.id)}
                            disabled={actionInProgressId !== null}
                            className="p-1 border border-zinc-800 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all disabled:opacity-50"
                            title="Sync Status"
                          >
                            <RefreshCcw className={`h-3.5 w-3.5 ${actionInProgressId === t.id ? 'animate-spin' : ''}`} />
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteTemplate(t.id)}
                          disabled={actionInProgressId !== null}
                          className="p-1 border border-rose-950/20 rounded bg-rose-950/10 hover:bg-rose-950/20 text-rose-400 transition-all disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DRAWER 1: PREVIEW / DETAILS DRAWER                       */}
      {/* ======================================================== */}
      <AnimatePresence>
        {selectedTemplate && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTemplate(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />

             {/* Sliding drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-zinc-950/80 backdrop-blur-xl border-l border-zinc-900 shadow-2xl z-50 flex flex-col justify-between overflow-hidden"
            >
              {/* Decorative glows */}
              <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
              <div className="absolute -left-20 -bottom-20 h-48 w-48 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-zinc-900/60 p-5 relative z-10 bg-zinc-950/40">
                <div>
                  <h3 className="font-extrabold text-sm text-white flex items-center gap-1.5 uppercase tracking-wide">
                    <Eye className="h-4 w-4 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
                    Template Preview
                  </h3>
                  <span className="text-[10px] text-zinc-400 font-mono mt-1.5 px-2 py-0.5 rounded bg-zinc-900/60 border border-zinc-800/80 w-fit block">{selectedTemplate.templateName}</span>
                </div>
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="rounded-lg p-1.5 hover:bg-zinc-900 text-zinc-400 hover:text-white transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 relative z-10">
                {/* Meta details cards */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="bg-zinc-900/40 border border-zinc-900 hover:border-zinc-800/80 rounded-xl p-3.5 flex flex-col justify-between transition-all duration-300">
                    <span className="text-zinc-500 text-[9px] uppercase tracking-wider font-semibold">Approval Status</span>
                    {getStatusBadge(selectedTemplate.status)}
                  </div>
                  
                  <div className="bg-zinc-900/40 border border-zinc-900 hover:border-zinc-800/80 rounded-xl p-3.5 flex flex-col justify-between transition-all duration-300">
                    <span className="text-zinc-500 text-[9px] uppercase tracking-wider font-semibold">Template Category</span>
                    <span className="font-bold text-zinc-100 mt-1 block uppercase text-xs">{selectedTemplate.category}</span>
                  </div>
                  
                  <div className="bg-zinc-900/40 border border-zinc-900 hover:border-zinc-800/80 rounded-xl p-3.5 flex flex-col justify-between transition-all duration-300">
                    <span className="text-zinc-500 text-[9px] uppercase tracking-wider font-semibold">Language Code</span>
                    <span className="font-bold text-zinc-300 mt-1 block uppercase text-xs">{selectedTemplate.language}</span>
                  </div>
                  
                  <div className="bg-zinc-900/40 border border-zinc-900 hover:border-zinc-800/80 rounded-xl p-3.5 flex flex-col justify-between transition-all duration-300">
                    <span className="text-zinc-500 text-[9px] uppercase tracking-wider font-semibold">Meta ID</span>
                    <span className="font-mono text-zinc-400 mt-1 block truncate text-[11px]" title={selectedTemplate.metaTemplateId || 'N/A'}>
                      {selectedTemplate.metaTemplateId || 'Not registered'}
                    </span>
                  </div>
                </div>

                {/* WhatsApp Chat Preview */}
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#00a884] animate-pulse" />
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">WhatsApp Message Preview</span>
                  </div>

                  <div className="rounded-2xl border border-[#2d3a42]/60 bg-[#0b141a] overflow-hidden shadow-2xl max-w-full sm:max-w-xs font-sans relative">
                    {/* WhatsApp Header Mockup */}
                    <div className="bg-[#202c33] px-3.5 py-2.5 flex items-center justify-between border-b border-[#2d3a42]">
                      <div className="flex items-center gap-2.5">
                        <span className="text-zinc-400 text-sm cursor-pointer select-none">←</span>
                        <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center text-white font-extrabold text-xs">
                          <FileText className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <span className="block text-xs font-bold text-[#e9edef] leading-tight">Gym Member</span>
                          <span className="block text-[9px] text-[#00a884] leading-tight font-semibold">online</span>
                        </div>
                      </div>
                      <div className="flex gap-3 text-zinc-400 text-[10px] select-none">
                        <span>📞</span>
                        <span>⋮</span>
                      </div>
                    </div>

                    {/* Chat Area Mockup */}
                    <div className="p-3.5 space-y-3 relative bg-[#0b141a] min-h-[220px] flex flex-col justify-end">
                      {/* Background WhatsApp Doodle grid effect */}
                      <div className="absolute inset-0 opacity-[0.06] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />

                      {/* Chat Message Bubble (Outgoing) */}
                      <div className="relative self-end bg-[#005c4b] text-[#e9edef] p-3 rounded-lg rounded-tr-none max-w-[90%] shadow-md border border-[#005c4b] z-10 flex flex-col">
                        {/* Header element */}
                        {getComponentOf(selectedTemplate.components, 'HEADER')?.format === 'TEXT' && (
                          <div className="font-bold text-white text-xs border-b border-[#00705a] pb-1 mb-1.5">
                            {getComponentOf(selectedTemplate.components, 'HEADER')?.text}
                          </div>
                        )}
                        {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(getComponentOf(selectedTemplate.components, 'HEADER')?.format || '') && (
                          <div className="rounded-lg bg-black/20 border border-[#004f40] p-4 text-center text-[10px] text-zinc-300 flex flex-col items-center justify-center gap-1.5 mb-1.5">
                            <Upload className="h-4 w-4 text-cyan-400" />
                            <span className="font-bold">{getComponentOf(selectedTemplate.components, 'HEADER')?.format}</span>
                            <span className="text-[8px] text-[#8696a0] truncate max-w-[150px]">
                              {getComponentOf(selectedTemplate.components, 'HEADER')?.example?.local_originalname || 'draft-file'}
                            </span>
                          </div>
                        )}

                        {/* Body element */}
                        <div className="whitespace-pre-wrap leading-relaxed text-xs break-words">
                          {getComponentOf(selectedTemplate.components, 'BODY')?.text}
                        </div>

                        {/* Footer element */}
                        {getComponentOf(selectedTemplate.components, 'FOOTER') && (
                          <div className="text-[9px] text-[#e9edef]/60 mt-1 block">
                            {getComponentOf(selectedTemplate.components, 'FOOTER')?.text}
                          </div>
                        )}

                        {/* Timestamp & checkmarks */}
                        <div className="self-end flex items-center gap-1 mt-1 text-[8px] text-[#e9edef]/60 leading-none">
                          <span>12:34 PM</span>
                          <span className="text-[#53bdeb]">✓✓</span>
                        </div>
                      </div>

                      {/* Interactive Buttons listing underneath outgoing bubble */}
                      {getComponentOf(selectedTemplate.components, 'BUTTONS') && (
                        <div className="self-end w-full max-w-[90%] space-y-1.5 z-10">
                          {getComponentOf(selectedTemplate.components, 'BUTTONS')?.buttons?.map((btn: any, idx: number) => (
                            <div
                              key={idx}
                              className="w-full bg-[#202c33] hover:bg-[#2a3942] border border-[#2d3a42] rounded-lg py-1.5 px-3 text-[11px] text-[#53bdeb] font-bold text-center flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-sm"
                            >
                              {btn.type === 'URL' && <ExternalLink className="h-3 w-3" />}
                              {btn.text}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="border-t border-zinc-900/60 p-5 bg-[#0b0b0f]/60 backdrop-blur-md flex items-center justify-between gap-3 relative z-10">
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition-all duration-300 neon-btn-secondary"
                >
                  Close
                </button>

                {selectedTemplate.status === 'draft' ? (
                  <button
                    onClick={() => {
                      handleSubmitToMeta(selectedTemplate.id);
                      setSelectedTemplate(null);
                    }}
                    disabled={!isConnected}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition-all duration-300 neon-btn-primary disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" /> Submit to Meta
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      handleSyncTemplateStatus(selectedTemplate.id);
                      setSelectedTemplate(null);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition-all duration-300 neon-btn-primary"
                  >
                    <RefreshCcw className="h-3.5 w-3.5" /> Sync Status
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* DRAWER 2: CREATE TEMPLATE DRAFT DRAWER                   */}
      {/* ======================================================== */}
      <AnimatePresence>
        {isCreateOpen && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />

            {/* Sliding drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed right-0 top-0 h-full w-full max-w-xl bg-zinc-950 border-l border-zinc-900 shadow-2xl z-50 flex flex-col justify-between"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-zinc-900 p-5">
                <div>
                  <h3 className="font-extrabold text-sm text-white flex items-center gap-1.5 uppercase tracking-wide">
                    <Sparkles className="h-4 w-4 text-cyan-400 animate-pulse" />
                    Create Message Template
                  </h3>
                  <span className="text-[10px] text-zinc-500 mt-0.5 block">Define header, body, footers, and interactive action triggers.</span>
                </div>
                <button
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-lg p-1.5 hover:bg-zinc-900 text-zinc-400 hover:text-white transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Drawer Scrollable Form Content */}
              <form onSubmit={handleCreateDraft} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-zinc-300">
                {/* 1. Template Name */}
                <div className="space-y-1.5">
                  <label className="block font-bold text-zinc-400 uppercase tracking-widest text-[9px]">
                    Template Unique Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. welcome_member"
                    value={formName}
                    onChange={(e) => handleNameInput(e.target.value)}
                    className="w-full rounded-xl border border-zinc-850 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-650 focus:outline-none focus:border-cyan-500 font-mono tracking-tight"
                  />
                  <p className="text-[10px] text-zinc-500">
                    Lower-case alphanumeric values and underscores only. Spaces and hyphens auto-converted.
                  </p>
                </div>

                {/* 2. Category & Language Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block font-bold text-zinc-400 uppercase tracking-widest text-[9px]">
                      Meta Category
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full rounded-xl border border-zinc-850 bg-zinc-900 px-4 py-3 text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                    >
                      <option value="UTILITY">Utility (Reminders, Alert)</option>
                      <option value="MARKETING">Marketing (Offer, News)</option>
                      <option value="AUTHENTICATION">Authentication (OTP)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-bold text-zinc-400 uppercase tracking-widest text-[9px]">
                      Language Code
                    </label>
                    <select
                      value={formLanguage}
                      onChange={(e) => setFormLanguage(e.target.value)}
                      className="w-full rounded-xl border border-zinc-850 bg-zinc-900 px-4 py-3 text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                    >
                      <option value="en_US">English (US) - en_US</option>
                      <option value="en_GB">English (UK) - en_GB</option>
                      <option value="hi">Hindi - hi</option>
                      <option value="es">Spanish - es</option>
                      <option value="fr">French - fr</option>
                      <option value="pt_BR">Portuguese (BR) - pt_BR</option>
                    </select>
                  </div>
                </div>

                <div className="h-px bg-zinc-900 my-4" />

                {/* 3. Header Setup Block */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block font-bold text-zinc-400 uppercase tracking-widest text-[9px]">
                      Template Header Type
                    </label>
                    <span className="text-[10px] text-zinc-500">Optional text/media</span>
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    {(['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setFormHeaderType(type);
                          setFormHeaderFile(null);
                        }}
                        className={`rounded-lg border py-2 font-bold text-[9px] uppercase tracking-wider text-center transition-all ${formHeaderType === type
                            ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                            : 'border-zinc-850 bg-zinc-900/30 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-300'
                          }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>

                  {/* Header Input Text conditional rendering */}
                  {formHeaderType === 'TEXT' && (
                    <div className="space-y-1.5 pt-1">
                      <input
                        type="text"
                        placeholder="Enter template header text..."
                        value={formHeaderText}
                        onChange={(e) => setFormHeaderText(e.target.value)}
                        maxLength={60}
                        className="w-full rounded-xl border border-zinc-850 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  )}

                  {/* Header File upload field conditional rendering */}
                  {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(formHeaderType) && (
                    <div className="space-y-2 pt-1">
                      <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-zinc-700 transition-all relative">
                        <input
                          type="file"
                          required
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              setFormHeaderFile(e.target.files[0]);
                            }
                          }}
                          accept={
                            formHeaderType === 'IMAGE'
                              ? 'image/*'
                              : formHeaderType === 'VIDEO'
                                ? 'video/*'
                                : 'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                          }
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        <Upload className="h-5 w-5 text-cyan-400" />
                        <span className="text-[10px] font-bold text-zinc-400">
                          {formHeaderFile ? formHeaderFile.name : `Select ${formHeaderType} file`}
                        </span>
                        <span className="text-[9px] text-zinc-500">
                          {formHeaderFile ? `(${(formHeaderFile.size / 1024 / 1024).toFixed(2)} MB)` : 'S3-free local upload cache'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Body Content */}
                <div className="space-y-2">
                  <label className="block font-bold text-zinc-400 uppercase tracking-widest text-[9px]">
                    Template Body Content <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={5}
                    placeholder="Enter main message body...&#10;e.g. Hello {{1}}, your membership at {{2}} is active!"
                    value={formBody}
                    onChange={(e) => setFormBody(e.target.value)}
                    className="w-full rounded-xl border border-zinc-850 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500 leading-relaxed font-sans"
                  />
                  <div className="flex items-start gap-1 text-[10px] text-zinc-500">
                    <Info className="h-3.5 w-3.5 text-cyan-500 shrink-0 mt-0.5" />
                    <span>
                      Add variables inside double braces like <code className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-300">{"{{1}}"}</code> or <code className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-300">{"{{2}}"}</code> to map member names, timings, or dates dynamically.
                    </span>
                  </div>
                </div>

                {/* 5. Footer Content */}
                <div className="space-y-1.5">
                  <label className="block font-bold text-zinc-400 uppercase tracking-widest text-[9px]">
                    Template Footer (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Reply STOP to opt-out"
                    value={formFooter}
                    onChange={(e) => setFormFooter(e.target.value)}
                    maxLength={60}
                    className="w-full rounded-xl border border-zinc-850 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-650 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="h-px bg-zinc-900 my-4" />

                {/* 6. Buttons Interactive editor */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block font-bold text-zinc-400 uppercase tracking-widest text-[9px]">
                      Template Buttons (Optional)
                    </label>
                    <button
                      type="button"
                      onClick={handleAddButton}
                      className="rounded bg-zinc-900 hover:bg-zinc-850 px-2.5 py-1 text-[10px] font-bold text-cyan-400 transition-all border border-zinc-850"
                    >
                      + Add Button
                    </button>
                  </div>

                  {formButtons.length > 0 ? (
                    <div className="space-y-3">
                      {formButtons.map((btn, idx) => (
                        <div
                          key={btn.id}
                          className="rounded-xl border border-zinc-900 bg-zinc-900/10 p-3.5 space-y-3 text-xs"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-extrabold text-[10px] text-zinc-500 uppercase tracking-wider">
                              Button #{idx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveButton(btn.id)}
                              className="text-[10px] font-bold text-rose-400 hover:underline flex items-center gap-0.5"
                            >
                              Remove
                            </button>
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block font-bold text-zinc-500 uppercase tracking-widest text-[8px] mb-1">
                                Action Type
                              </label>
                              <select
                                value={btn.type}
                                onChange={(e) => handleUpdateButton(btn.id, 'type', e.target.value as any)}
                                className="w-full rounded-lg border border-zinc-850 bg-zinc-900 px-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                              >
                                <option value="QUICK_REPLY">Quick Reply</option>
                                <option value="URL">Visit URL</option>
                                <option value="PHONE_NUMBER">Call Number</option>
                              </select>
                            </div>

                            <div className={btn.type === 'QUICK_REPLY' ? 'col-span-2' : 'col-span-1'}>
                              <label className="block font-bold text-zinc-500 uppercase tracking-widest text-[8px] mb-1">
                                Button Text
                              </label>
                              <input
                                type="text"
                                required
                                maxLength={25}
                                placeholder="Button Label"
                                value={btn.text}
                                onChange={(e) => handleUpdateButton(btn.id, 'text', e.target.value)}
                                className="w-full rounded-lg border border-zinc-850 bg-zinc-900 px-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-cyan-500"
                              />
                            </div>

                            {btn.type !== 'QUICK_REPLY' && (
                              <div className="col-span-1">
                                <label className="block font-bold text-zinc-500 uppercase tracking-widest text-[8px] mb-1">
                                  {btn.type === 'URL' ? 'URL Link' : 'Phone Number'}
                                </label>
                                <input
                                  type={btn.type === 'URL' ? 'url' : 'tel'}
                                  required
                                  placeholder={btn.type === 'URL' ? 'https://example.com' : '+155500000'}
                                  value={btn.value}
                                  onChange={(e) => handleUpdateButton(btn.id, 'value', e.target.value)}
                                  className="w-full rounded-lg border border-zinc-850 bg-zinc-900 px-2.5 py-1.5 text-[10px] text-white focus:outline-none focus:border-cyan-500 font-mono"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-zinc-600 italic py-2">
                      No buttons added yet. You can attach up to 10 interactive reply, website, or call links.
                    </p>
                  )}
                </div>

                {/* Invisible Form submit trigger */}
                <button type="submit" className="hidden" id="submit-draft-btn" />
              </form>

              {/* Drawer Footer Actions */}
              <div className="border-t border-zinc-900 p-5 bg-zinc-950/60 flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setIsCreateOpen(false);
                  }}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-3 text-xs font-bold text-zinc-400 hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => document.getElementById('submit-draft-btn')?.click()}
                  disabled={isSavingDraft}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-cyan-600 py-3 text-xs font-bold text-white transition-all hover:bg-cyan-500 disabled:opacity-50"
                >
                  {isSavingDraft ? 'Saving Draft...' : 'Save as Draft'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ----------------------------------------------------
// UI RENDER HELPERS
// ----------------------------------------------------
function getComponentOf(componentsJson: any, type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS'): TemplateComponent | undefined {
  const list = Array.isArray(componentsJson) ? componentsJson : [];
  return list.find((c: any) => c.type === type);
}

function getComponentsSnippet(componentsJson: any): string {
  const list = Array.isArray(componentsJson) ? componentsJson : [];
  const parts = list.map((c: any) => {
    if (c.type === 'HEADER') return `Header: [${c.format}]`;
    if (c.type === 'BODY') return `Body: "${c.text.substring(0, 30)}..."`;
    if (c.type === 'FOOTER') return `Footer`;
    if (c.type === 'BUTTONS') return `Buttons: (${c.buttons?.length || 0})`;
    return c.type;
  });
  return parts.join(' | ');
}

function renderComponentSummary(componentsJson: any): React.ReactNode {
  const list = Array.isArray(componentsJson) ? componentsJson : [];
  const header = list.find((c: any) => c.type === 'HEADER');
  const body = list.find((c: any) => c.type === 'BODY');
  const footer = list.find((c: any) => c.type === 'FOOTER');
  const buttons = list.find((c: any) => c.type === 'BUTTONS');

  return (
    <div className="bg-[#0b141a] rounded-xl p-3.5 border border-[#202c33]/50 relative overflow-hidden font-sans select-none h-[170px] max-h-[170px] flex flex-col justify-between">
      {/* Outer wrapper representing the chat view */}
      <div className="flex flex-col items-start w-full overflow-hidden">
        {/* Message bubble */}
        <div className="w-[90%] max-w-[90%] bg-[#202c33] rounded-2xl rounded-tl-none p-3 shadow-md space-y-1 relative text-[11px] leading-relaxed">
          {/* WhatsApp Chat Bubble Tail */}
          <div className="absolute top-0 -left-1.5 w-0 h-0 border-t-[8px] border-t-[#202c33] border-l-[8px] border-l-transparent" />
          
          {header && (
            <div className="font-extrabold text-[10px] text-[#00a884] uppercase tracking-wide border-b border-[#2a3942]/60 pb-1 mb-1 font-sans truncate">
              {header.format === 'TEXT' ? header.text : `📎 ${header.format} Header`}
            </div>
          )}
          
          {body && (
            <p className="text-[#e9edef] whitespace-pre-wrap font-normal font-sans line-clamp-3">
              {body.text}
            </p>
          )}
          
          {footer && (
            <div className="text-[9px] text-[#8696a0] mt-0.5 font-medium font-sans truncate">
              {footer.text}
            </div>
          )}
        </div>

        {/* Buttons list rendered underneath message bubble like real interactive templates */}
        {buttons && buttons.buttons && buttons.buttons.length > 0 && (
          <div className="space-y-1 mt-1.5 w-[90%] max-w-xs pl-2">
            {buttons.buttons.slice(0, 2).map((b: any, idx: number) => (
              <div
                key={idx}
                className="w-full bg-[#202c33]/90 border border-[#2a3942] rounded-lg py-1 px-3 text-[10px] text-[#00a884] font-bold text-center flex items-center justify-center gap-1 shadow-sm truncate"
              >
                {b.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
