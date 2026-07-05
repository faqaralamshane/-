import React, { useState, useEffect, useRef } from 'react';
import {
  Compass,
  Sliders,
  Search,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  RefreshCw,
  ArrowRight,
  Eye,
  Check,
  Smartphone,
  Monitor,
  HelpCircle,
  Clock,
  Settings,
  CornerDownLeft,
  FileText,
  AlertTriangle,
  Zap,
  Tag,
  Link,
  Unlock,
  History,
  CheckCircle,
  Play
} from 'lucide-react';
import { Customer, Contract, Payment, CustomPage } from '../types';
import { showToast } from '../components/Toast';

// Interfaces specific to Page Builder
export interface BuilderBlock {
  id: string;
  nameAr: string;
  tag: string;
  description: string;
  type: 'text' | 'button' | 'card' | 'input' | 'list' | 'stats' | 'container';
  content: string;
  isGlobal?: boolean;
  globalId?: string;
  
  // Style properties (Visual & Flexbox UI)
  styles: {
    display: 'flex' | 'block' | 'none';
    flexDirection: 'row' | 'column';
    justifyContent: 'start' | 'center' | 'between' | 'around';
    alignItems: 'start' | 'center' | 'end';
    width: 'full' | 'half' | 'custom';
    widthCustom?: number; // width in %
    padding: number; // padding slider
    margin: number; // margin slider
    zIndex: number; // z-index slider
    responsive: 'all' | 'mobile' | 'desktop'; // responsiveness
  };

  // Logic & visibility gates (Advanced Logic Gates)
  visibility: {
    conditionType: 'always' | 'and' | 'or' | 'schedule';
    rules: {
      field: 'user_role' | 'subscription_status' | 'outstanding_debts';
      operator: 'equals' | 'greater_than' | 'less_than';
      value: string;
    }[];
    schedule?: {
      days: string[]; // ['Saturday', 'Sunday', etc]
      startHour: string; // "08:00"
      endHour: string; // "17:00"
    };
  };

  // Click & Load Triggers (Action & Event Triggers)
  triggers: {
    onClick?: {
      action: 'whatsapp' | 'notify' | 'script' | 'navigate';
      whatsappTemplateId?: string;
      notifyText?: string;
      scriptCode?: string;
      navigatePageId?: string;
    };
    onLoad?: {
      action: 'notify' | 'script';
      notifyText?: string;
      scriptCode?: string;
    };
  };
}

export interface DynamicPage {
  id: string;
  title: string;
  visibilityCondition: 'always' | 'admin' | 'has_contracts' | 'custom_expr';
  customExpression?: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  layout: 'dropdown' | 'full';
  embeddedBlocks: string[]; // Keep original fallback
  builderBlocks?: BuilderBlock[]; // Advanced blocks
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PageBuilderViewProps {
  customers: Customer[];
  contracts: Contract[];
  payments: Payment[];
  onBack: () => void;
  onRefreshData: () => void;
}

// Predefined available Block Templates for the Div Explorer (Live Preview & Add)
const PREDEFINED_BLOCKS: Omit<BuilderBlock, 'id'>[] = [
  {
    nameAr: 'بطاقة الترحيب الذكية بالعميل',
    tag: 'ترحيب_زبون',
    description: 'بطاقة ترحيبية تعرض اسم الزبون ومكانه وحالته بشكل تفاعلي ديناميكي.',
    type: 'card',
    content: 'مرحباً بك مجدداً يا صديقنا العزيز {{client_name}} ✨ يسعدنا جداً تصفحك للوحة الإدارة الآمنة الخاصة بك اليوم.',
    styles: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      width: 'full',
      padding: 16,
      margin: 8,
      zIndex: 1,
      responsive: 'all'
    },
    visibility: {
      conditionType: 'always',
      rules: []
    },
    triggers: {
      onClick: {
        action: 'notify',
        notifyText: 'أهلاً بك يا بطل! تم تحميل بياناتك بنجاح.'
      }
    }
  },
  {
    nameAr: 'شريط كشف الحساب والديون المتأخرة',
    tag: 'كشف_الأقساط_المتأخرة',
    description: 'صندوق يعرض إجمالي المبالغ والدفعات المتأخرة للعميل بالدينار العراقي.',
    type: 'stats',
    content: '🚨 إجمالي الأقساط والمبالغ المتأخرة المتوجب سدادها حالياً بذمتكم هو: {{outstanding_installments}} د.ع. يرجى تسويتها في أقرب وقت.',
    styles: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'start',
      alignItems: 'start',
      width: 'full',
      padding: 14,
      margin: 10,
      zIndex: 2,
      responsive: 'all'
    },
    visibility: {
      conditionType: 'and',
      rules: [
        { field: 'outstanding_debts', operator: 'greater_than', value: '0' }
      ]
    },
    triggers: {
      onLoad: {
        action: 'notify',
        notifyText: 'انتبه! لديك دفعات معلقة بحاجة لتسديد عاجل.'
      }
    }
  },
  {
    nameAr: 'شريط حالة تفعيل اشتراك النظام',
    tag: 'حالة_الاشتراك_الرسمي',
    description: 'يوضح ما إذا كان العقد والاشتراك فعالاً أم منتهياً مع رمز لوني معبر.',
    type: 'text',
    content: '📡 حالة اشتراك العقد المعتمد للفرع حالياً: {{subscription_status}}',
    styles: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'between',
      alignItems: 'center',
      width: 'full',
      padding: 12,
      margin: 6,
      zIndex: 1,
      responsive: 'all'
    },
    visibility: {
      conditionType: 'always',
      rules: []
    },
    triggers: {}
  },
  {
    nameAr: 'زر الاتصال السريع وتفعيل المحادثة',
    tag: 'زر_تواصل_الدعم_واتساب',
    description: 'زر تفاعلي رائع لتشغيل محادثة الدعم الفني بالفرع وإرسال رسالة جاهزة.',
    type: 'button',
    content: '💬 تواصل الآن مع مدير الحسابات عبر واتساب',
    styles: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      width: 'full',
      padding: 12,
      margin: 12,
      zIndex: 3,
      responsive: 'all'
    },
    visibility: {
      conditionType: 'always',
      rules: []
    },
    triggers: {
      onClick: {
        action: 'whatsapp',
        whatsappTemplateId: 'romantic-1',
        notifyText: 'جاري فتح محادثة الواتساب مع إدارة الفرع...'
      }
    }
  },
  {
    nameAr: 'بطاقة التنبيه والإعلان الجماعي للفرع',
    tag: 'إعلان_هام_للمشتركين',
    description: 'صندوق تصميمي أنيق باللون الكهرماني لإرسال تنبيهات وتوجيهات للزبائن والمشرفين.',
    type: 'container',
    content: '📢 يرجى العلم بأن يوم غد هو عطلة رسمية لإدارة الحسابات والفرع، وستستمر عمليات الاستلام والمزامنة الآلية بالرّام دون توقف 🛡️',
    styles: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'start',
      width: 'full',
      padding: 16,
      margin: 8,
      zIndex: 1,
      responsive: 'all'
    },
    visibility: {
      conditionType: 'always',
      rules: []
    },
    triggers: {}
  }
];

// Helper to represent Dynamic Variables with metadata (Arabic labels, tooltips, placeholders)
const DYNAMIC_VARIABLES = [
  {
    category: 'بيانات العملاء',
    labelAr: 'اسم العميل الكامل',
    tooltip: 'يعرض الاسم الأول والأخير للعميل بشكل تفاعلي',
    code: '{{client_name}}'
  },
  {
    category: 'بيانات العملاء',
    labelAr: 'رقم الهاتف',
    tooltip: 'يعرض رقم هاتف العميل المسجل في قاعدة البيانات',
    code: '{{client_phone}}'
  },
  {
    category: 'الحسابات',
    labelAr: 'الدفعات المتأخرة',
    tooltip: 'يعرض إجمالي المبالغ والأقساط المستحقة غير المدفوعة حالياً بالدينار العراقي',
    code: '{{outstanding_installments}}'
  },
  {
    category: 'الاشتراكات',
    labelAr: 'حالة الاشتراك',
    tooltip: 'يوضح ما إذا كان الاشتراك والتعاقد فعالاً ونشطاً أم منتهياً',
    code: '{{subscription_status}}'
  }
];

export function PageBuilderView({
  customers,
  contracts,
  payments,
  onBack,
  onRefreshData
}: PageBuilderViewProps) {
  // Load Pages
  const [pages, setPages] = useState<DynamicPage[]>(() => {
    try {
      const saved = localStorage.getItem('faqar-custom-pages-v1');
      const loaded = saved ? JSON.parse(saved) : [];
      // Hydrate custom pages if they don't have builderBlocks yet
      return loaded.map((p: any) => ({
        ...p,
        builderBlocks: p.builderBlocks || []
      }));
    } catch {
      return [];
    }
  });

  // Global blocks repo
  const [globalBlocks, setGlobalBlocks] = useState<BuilderBlock[]>(() => {
    try {
      const saved = localStorage.getItem('faqar-global-blocks');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Versioning State
  const [versions, setVersions] = useState<Record<string, { timestamp: string; blocks: BuilderBlock[]; note: string }[]>>(() => {
    try {
      const saved = localStorage.getItem('faqar-page-versions');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // UI States
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [divSearchQuery, setDivSearchQuery] = useState('');
  const [divCategoryFilter, setDivCategoryFilter] = useState<'all' | 'text' | 'button' | 'card' | 'stats'>('all');
  
  // Variables filter state
  const [varCategoryFilter, setVarCategoryFilter] = useState<'الكل' | 'بيانات العملاء' | 'الاشتراكات' | 'الحسابات'>('الكل');
  const [showVarDropdown, setShowVarDropdown] = useState(false);

  // Form states for NEW page creation
  const [showAddPageModal, setShowAddPageModal] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [newPagePosition, setNewPagePosition] = useState<'top' | 'bottom' | 'left' | 'right'>('bottom');
  const [newPageLayout, setNewPageLayout] = useState<'full' | 'dropdown'>('full');
  const [newPageVisibility, setNewPageVisibility] = useState<'always' | 'admin' | 'has_contracts' | 'custom_expr'>('always');
  const [newPageExpr, setNewPageExpr] = useState('');

  // History version log note state
  const [versionNote, setVersionNote] = useState('');

  // active simulation device state
  const [simulationDevice, setSimulationDevice] = useState<'mobile' | 'desktop'>('mobile');

  // Load selected page
  const selectedPage = pages.find(p => p.id === selectedPageId);
  const selectedBlock = selectedPage?.builderBlocks?.find(b => b.id === selectedBlockId);

  // Sync to localStorage and broadcast change events
  const savePagesToStorage = (updatedPages: DynamicPage[]) => {
    setPages(updatedPages);
    localStorage.setItem('faqar-custom-pages-v1', JSON.stringify(updatedPages));
    window.dispatchEvent(new Event('faqar-custom-pages-updated'));
  };

  const saveGlobalBlocksToStorage = (updatedGlobals: BuilderBlock[]) => {
    setGlobalBlocks(updatedGlobals);
    localStorage.setItem('faqar-global-blocks', JSON.stringify(updatedGlobals));
  };

  const saveVersionsToStorage = (updatedVersions: Record<string, any>) => {
    setVersions(updatedVersions);
    localStorage.setItem('faqar-page-versions', JSON.stringify(updatedVersions));
  };

  // Create a new version/restore state
  const logVersion = (pageId: string, blocks: BuilderBlock[], note: string) => {
    const currentVersions = { ...versions };
    if (!currentVersions[pageId]) {
      currentVersions[pageId] = [];
    }
    currentVersions[pageId].unshift({
      timestamp: new Date().toISOString(),
      blocks: JSON.parse(JSON.stringify(blocks)),
      note: note || 'تعديل وحفظ تلقائي للمكونات'
    });
    // Keep max 15 versions
    currentVersions[pageId] = currentVersions[pageId].slice(0, 15);
    saveVersionsToStorage(currentVersions);
  };

  // Add block to canvas from Explorer
  const handleAddBlock = (template: Omit<BuilderBlock, 'id'>) => {
    if (!selectedPageId || !selectedPage) return;

    const newBlock: BuilderBlock = {
      ...JSON.parse(JSON.stringify(template)),
      id: 'block-' + Math.random().toString(36).substring(2, 9)
    };

    const updatedBlocks = [...(selectedPage.builderBlocks || []), newBlock];
    const updatedPages = pages.map(p => {
      if (p.id === selectedPageId) {
        return { ...p, builderBlocks: updatedBlocks, updatedAt: new Date().toISOString() };
      }
      return p;
    });

    logVersion(selectedPageId, selectedPage.builderBlocks || [], 'إضافة كتلة جديدة: ' + newBlock.nameAr);
    savePagesToStorage(updatedPages);
    setSelectedBlockId(newBlock.id);
    showToast(`تم إدراج كتلة "${newBlock.nameAr}" بنجاح!`, 'success');
  };

  // Update specific selected block properties
  const handleUpdateBlockField = (fieldsToUpdate: Partial<BuilderBlock>) => {
    if (!selectedPageId || !selectedBlockId || !selectedPage) return;

    const updatedBlocks = (selectedPage.builderBlocks || []).map(b => {
      if (b.id === selectedBlockId) {
        const merged = { ...b, ...fieldsToUpdate };
        // Sync style object separately
        if (fieldsToUpdate.styles) {
          merged.styles = { ...b.styles, ...fieldsToUpdate.styles };
        }
        // Sync visibility separately
        if (fieldsToUpdate.visibility) {
          merged.visibility = { ...b.visibility, ...fieldsToUpdate.visibility };
        }
        // Sync triggers separately
        if (fieldsToUpdate.triggers) {
          merged.triggers = { ...b.triggers, ...fieldsToUpdate.triggers };
        }
        
        // If it is globally synced, update other pages with this globalBlock!
        if (b.isGlobal && b.globalId) {
          setTimeout(() => syncGlobalBlockUpdate(b.globalId!, merged), 10);
        }

        return merged;
      }
      return b;
    });

    const updatedPages = pages.map(p => {
      if (p.id === selectedPageId) {
        return { ...p, builderBlocks: updatedBlocks, updatedAt: new Date().toISOString() };
      }
      return p;
    });

    savePagesToStorage(updatedPages);
  };

  // Sync a global block change to all other pages
  const syncGlobalBlockUpdate = (globalId: string, updatedBlockData: BuilderBlock) => {
    // Update global repo
    const updatedGlobals = globalBlocks.map(g => g.id === globalId ? { ...updatedBlockData, id: globalId } : g);
    saveGlobalBlocksToStorage(updatedGlobals);

    // Update other pages that use this global block
    const updatedPages = pages.map(p => {
      const pageBlocks = (p.builderBlocks || []).map(b => {
        if (b.isGlobal && b.globalId === globalId) {
          return {
            ...updatedBlockData,
            id: b.id, // keep local ID
            isGlobal: true,
            globalId: globalId
          };
        }
        return b;
      });
      return { ...p, builderBlocks: pageBlocks };
    });

    setPages(updatedPages);
    localStorage.setItem('faqar-custom-pages-v1', JSON.stringify(updatedPages));
  };

  // Make a block Global (Global Sync)
  const handleMakeBlockGlobal = () => {
    if (!selectedBlock || !selectedPageId || !selectedPage) return;

    const globalId = 'global-' + Math.random().toString(36).substring(2, 9);
    
    // Save to global repo
    const newGlobalBlock: BuilderBlock = {
      ...JSON.parse(JSON.stringify(selectedBlock)),
      id: globalId,
      isGlobal: true,
      globalId: globalId
    };

    saveGlobalBlocksToStorage([...globalBlocks, newGlobalBlock]);

    // Update block state in page to be linked
    handleUpdateBlockField({
      isGlobal: true,
      globalId: globalId
    });

    showToast('🚀 تم حفظ هذه الكتلة ككتلة عامة (Global Sync) ومزامنتها بنجاح!', 'success');
  };

  // Unlink Global block
  const handleUnlinkBlock = () => {
    if (!selectedBlock) return;
    handleUpdateBlockField({
      isGlobal: false,
      globalId: undefined
    });
    showToast('🔓 تم فك ارتباط الكتلة وتخصيصها لهذه الصفحة فقط.', 'info');
  };

  // Delete a block from the selected page
  const handleDeleteBlock = (blockId: string) => {
    if (!selectedPageId || !selectedPage) return;

    const updatedBlocks = (selectedPage.builderBlocks || []).filter(b => b.id !== blockId);
    logVersion(selectedPageId, selectedPage.builderBlocks || [], 'حذف كتلة');

    const updatedPages = pages.map(p => {
      if (p.id === selectedPageId) {
        return { ...p, builderBlocks: updatedBlocks, updatedAt: new Date().toISOString() };
      }
      return p;
    });

    savePagesToStorage(updatedPages);
    setSelectedBlockId(null);
    showToast('تم حذف الكتلة بنجاح.', 'success');
  };

  // Rollback to previous page version
  const handleRestoreVersion = (versionBlocks: BuilderBlock[]) => {
    if (!selectedPageId || !selectedPage) return;

    // Log current state to history before rolling back so user can undo the undo!
    logVersion(selectedPageId, selectedPage.builderBlocks || [], 'تراجع واسترجاع نسخة سابقة');

    const updatedPages = pages.map(p => {
      if (p.id === selectedPageId) {
        return { ...p, builderBlocks: JSON.parse(JSON.stringify(versionBlocks)), updatedAt: new Date().toISOString() };
      }
      return p;
    });

    savePagesToStorage(updatedPages);
    setSelectedBlockId(null);
    showToast('📅 تم الرجوع للتصميم السابق بنجاح!', 'success');
  };

  // Re-order blocks (Move Up / Down)
  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    if (!selectedPageId || !selectedPage) return;
    const blocks = [...(selectedPage.builderBlocks || [])];
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === blocks.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = blocks[index];
    blocks[index] = blocks[targetIndex];
    blocks[targetIndex] = temp;

    const updatedPages = pages.map(p => {
      if (p.id === selectedPageId) {
        return { ...p, builderBlocks: blocks, updatedAt: new Date().toISOString() };
      }
      return p;
    });

    savePagesToStorage(updatedPages);
  };

  // Create new Custom Page
  const handleCreateNewPage = () => {
    if (!newPageTitle.trim()) {
      showToast('الرجاء كتابة اسم الصفحة الجديدة!', 'warning');
      return;
    }

    const pageId = 'page-' + Math.random().toString(36).substring(2, 9);
    const newPage: DynamicPage = {
      id: pageId,
      title: newPageTitle,
      visibilityCondition: newPageVisibility,
      customExpression: newPageExpr,
      position: newPagePosition,
      layout: newPageLayout,
      embeddedBlocks: [],
      builderBlocks: [
        // Automatically pre-populate with a gorgeous default welcome card to look highly professional
        {
          id: 'welcome-default',
          nameAr: 'بطاقة الترحيب الذكية بالعميل',
          tag: 'ترحيب_زبون',
          description: 'بطاقة ترحيبية تعرض اسم الزبون ومكانه وحالته بشكل تفاعلي ديناميكي.',
          type: 'card',
          content: 'مرحباً بك يا زبوننا المحترم {{client_name}} في تطبيقنا! حالة اشتراكك: {{subscription_status}}',
          styles: {
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            width: 'full',
            padding: 16,
            margin: 8,
            zIndex: 1,
            responsive: 'all'
          },
          visibility: {
            conditionType: 'always',
            rules: []
          },
          triggers: {}
        }
      ],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updated = [...pages, newPage];
    savePagesToStorage(updated);
    
    // Log initial version
    logVersion(pageId, newPage.builderBlocks!, 'التصميم الأولي والمجسم المرجعي');

    // Reset Form
    setNewPageTitle('');
    setNewPagePosition('bottom');
    setNewPageLayout('full');
    setNewPageVisibility('always');
    setNewPageExpr('');
    setShowAddPageModal(false);

    // Enter directly into the page builder
    setSelectedPageId(pageId);
    showToast(`تم إنشاء صفحة "${newPage.title}" بنجاح! تم الدخول لمحرك البناء.`, 'success');
  };

  // Delete Page entirely
  const handleDeletePage = (pageId: string) => {
    if (window.confirm('🚨 تحذير: هل أنت متأكد من حذف هذه الصفحة الديناميكية بالكامل مع كافة كتلها وتصميمها؟')) {
      const updated = pages.filter(p => p.id !== pageId);
      savePagesToStorage(updated);
      showToast('تم حذف الصفحة بالكامل', 'success');
    }
  };

  // Helper to dynamically evaluate Placeholders inside custom block texts for visual simulations
  const evaluatePlaceholders = (text: string) => {
    let result = text;
    // Mock evaluations for preview
    const sampleClientName = 'علي جاسم الموسوي';
    const sampleClientPhone = '07827744096';
    const sampleInstallments = '250,000';
    const sampleStatus = 'نشط فعال 🟢';

    result = result.replace(/{{client_name}}/g, sampleClientName);
    result = result.replace(/{{client_phone}}/g, sampleClientPhone);
    result = result.replace(/{{outstanding_installments}}/g, sampleInstallments);
    result = result.replace(/{{subscription_status}}/g, sampleStatus);

    return result;
  };

  // Search filtered blocks for Explorer
  const filteredTemplates = PREDEFINED_BLOCKS.filter(block => {
    const matchesSearch = block.nameAr.includes(divSearchQuery) || 
                          block.description.includes(divSearchQuery) || 
                          block.tag.includes(divSearchQuery);
    
    const matchesCategory = divCategoryFilter === 'all' || block.type === divCategoryFilter;

    return matchesSearch && matchesCategory;
  });

  // Filtered variables for insert dropdown
  const filteredVariables = DYNAMIC_VARIABLES.filter(v => {
    return varCategoryFilter === 'الكل' || v.category === varCategoryFilter;
  });

  // Handle Quick Jump from Builder
  const handleQuickJump = () => {
    if (!selectedPage) return;
    localStorage.setItem('faqar-preview-custom-page', selectedPage.id);
    window.dispatchEvent(new CustomEvent('faqar-navigate-custom-page', { detail: selectedPage.id }));
    showToast(`جاري توجيهك لمعاينة صفحة "${selectedPage.title}" الحية!`, 'success');
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-12 text-right" dir="rtl">
      
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-zinc-300 flex items-center justify-center cursor-pointer transition-all active:scale-95"
            title="رجوع للإعدادات"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-0.5">منشئ ومحرك قوالب المحتوى (CMS)</p>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-400 animate-pulse" />
              <span>باني الصفحات الديناميكي المطور</span>
            </h1>
          </div>
        </div>

        {selectedPageId && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleQuickJump}
              className="h-10 px-4 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Eye className="w-4 h-4" />
              <span>معاينة حية بالتطبيق</span>
            </button>
            <button
              onClick={() => {
                setSelectedPageId(null);
                setSelectedBlockId(null);
              }}
              className="h-10 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <span>خروج من البناء</span>
            </button>
          </div>
        )}
      </div>

      {/* VIEW 1: PAGE SELECTION DASHBOARD */}
      {!selectedPageId && (
        <div className="flex flex-col gap-5">
          <div className="p-5 rounded-2xl bg-indigo-950/10 border border-indigo-500/20 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-right flex-1">
              <span className="text-xs font-black text-indigo-400 block mb-1">💡 فكرة باني الصفحات الذكي لغير المبرمجين</span>
              <p className="text-[11px] text-zinc-400 leading-relaxed max-w-2xl">
                يتيح لك هذا النظام المتقدم صياغة كتل وتصاميم مستقلة (Blocks) بالكامل لتوليد صفحات مخصصة للزبائن أو المشرفين. يمكنك دمج المتغيرات الرياضية والحسابية وعقد شروط ظهور تفاعلية مرنة وتصميم العناصر بصرياً بدون لمس سطر برمجيات واحد.
              </p>
            </div>
            <button
              onClick={() => setShowAddPageModal(true)}
              className="h-11 px-5 bg-indigo-500 text-white hover:bg-indigo-400 font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shrink-0 shadow-lg shadow-indigo-500/20"
            >
              <Plus className="w-4.5 h-4.5" />
              <span>إنشاء صفحة ديناميكية جديدة</span>
            </button>
          </div>

          <h2 className="text-xs font-bold text-zinc-500 border-b border-white/5 pb-2">الصفحات الديناميكية المتوفرة بالنظام ({pages.length}):</h2>

          {pages.length === 0 ? (
            <div className="text-center py-12 rounded-2xl border border-dashed border-white/10 bg-black/10 flex flex-col items-center justify-center gap-3">
              <Compass className="w-10 h-10 text-zinc-600 animate-pulse" />
              <p className="text-xs text-zinc-500 font-semibold">لم تقم ببناء أي صفحة مخصصة حتى الآن.</p>
              <button
                onClick={() => setShowAddPageModal(true)}
                className="h-9 px-4 bg-zinc-800 hover:bg-zinc-700 text-indigo-400 border border-indigo-500/20 font-bold text-[11px] rounded-lg transition-colors"
              >
                اصنع صفحتك الأولى الآن
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pages.map((p) => {
                const blockCount = p.builderBlocks?.length || 0;
                return (
                  <div key={p.id} className="bg-[#121214]/80 border border-white/5 hover:border-indigo-500/20 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all group">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                          <Compass className="w-5 h-5" />
                        </div>
                        <div className="text-right">
                          <h3 className="text-xs font-bold text-white block">{p.title}</h3>
                          <span className="text-[9px] text-zinc-500 block mt-0.5">
                            المسار: <code className="text-zinc-400 font-mono text-[8px]">{p.id}</code> • {blockCount} كتل برمجية
                          </span>
                        </div>
                      </div>

                      <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-bold ${
                        p.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                      }`}>
                        {p.isActive ? 'نشطة ومتوفرة' : 'معطلة مؤقتاً'}
                      </span>
                    </div>

                    <div className="text-[10px] text-zinc-500 leading-normal border-t border-b border-white/5 py-2.5 flex flex-col gap-1.5">
                      <div>📌 ظهور الصفحة: {
                        p.position === 'bottom' ? 'شريط التنقل السفلي' : 
                        p.position === 'top' ? 'الأعلى بالتطبيق' : 
                        p.position === 'left' ? 'الجانب الأيسر' : 'الجانب الأيمن'
                      }</div>
                      <div>⚖️ شرط العرض والظهور: {
                        p.visibilityCondition === 'always' ? 'متاح دائماً للجميع' :
                        p.visibilityCondition === 'admin' ? 'الإدارة والمسؤولين فقط' :
                        p.visibilityCondition === 'has_contracts' ? 'الزبائن النشطين فقط' : 'تعبير مخصص مركب'
                      }</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedPageId(p.id)}
                        className="flex-1 h-9 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/20 text-indigo-400 font-black rounded-xl text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>فتح محرر الكتل والـ Divs</span>
                      </button>
                      <button
                        onClick={() => handleDeletePage(p.id)}
                        className="w-9 h-9 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl flex items-center justify-center text-rose-400 cursor-pointer transition-colors"
                        title="حذف الصفحة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: THE VISUAL INTERACTIVE WORKSPACE */}
      {selectedPageId && selectedPage && (
        <div className="flex flex-col gap-5">
          
          {/* Quick Page Stats & Action controls */}
          <div className="bg-[#121214]/90 border border-white/5 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 text-right">
            <div>
              <span className="text-xs font-black text-white block mb-0.5">الصفحة الحالية: {selectedPage.title}</span>
              <span className="text-[10px] text-zinc-500 block leading-normal">
                التحكم بالترتيب التفاعلي للكتل، وضبط شروط الرؤية المنطقية العميقة، والتنسيق والتحكم البصري المرن.
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 font-bold">نمط المعاينة:</span>
              <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                <button
                  onClick={() => setSimulationDevice('mobile')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
                    simulationDevice === 'mobile' ? 'bg-indigo-500 text-white' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>هاتف ذكي</span>
                </button>
                <button
                  onClick={() => setSimulationDevice('desktop')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
                    simulationDevice === 'desktop' ? 'bg-indigo-500 text-white' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>حاسوب</span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* COLUMN 1 (4/12): THE DIV EXPLORER (محرك استكشاف وإدراج الكتل) */}
            <div className="lg:col-span-4 flex flex-col gap-4 bg-[#121214]/60 border border-white/5 p-4 rounded-3xl">
              <div className="border-b border-white/5 pb-2">
                <span className="text-xs font-black text-indigo-400 flex items-center gap-1">
                  <Search className="w-4 h-4" />
                  <span>1. مستكشف الكتل و الـ Divs (Div Explorer)</span>
                </span>
                <p className="text-[10px] text-zinc-500 leading-normal mt-1">
                  ابحث عن المكون المناسب باستخدام الكلمات والوسوم، وعاين شكله الفعلي Live Preview قبل كبسة الإضافة.
                </p>
              </div>

              {/* Explorer Search Input */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="ابحث بالاسم أو وسوم البحث (مثال: ترحيب، دعم)..."
                  value={divSearchQuery}
                  onChange={(e) => setDivSearchQuery(e.target.value)}
                  className="w-full h-10 pr-9 pl-4 text-xs bg-[#18181b] border border-white/5 focus:border-indigo-500/40 rounded-xl text-white placeholder-zinc-600 focus:outline-none"
                />
                <Search className="w-4 h-4 text-zinc-600 absolute right-3 top-3" />
              </div>

              {/* Filter Tabs */}
              <div className="flex gap-1 overflow-x-auto pb-1 border-b border-white/5">
                {[
                  { value: 'all', label: 'الكل' },
                  { value: 'card', label: 'بطاقات' },
                  { value: 'button', label: 'أزرار' },
                  { value: 'stats', label: 'إحصائيات' },
                  { value: 'container', label: 'صناديق' }
                ].map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setDivCategoryFilter(tab.value as any)}
                    className={`h-7 px-3 rounded-lg text-[10px] font-bold shrink-0 transition-colors ${
                      divCategoryFilter === tab.value ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20' : 'bg-black/20 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Templates List */}
              <div className="flex flex-col gap-3 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
                {filteredTemplates.length === 0 ? (
                  <div className="text-center py-8 text-[10px] text-zinc-600 font-semibold bg-black/10 rounded-xl">
                    لا يوجد كتل مطابقة لمعيار البحث.
                  </div>
                ) : (
                  filteredTemplates.map((block, index) => (
                    <div key={index} className="bg-black/25 border border-white/5 rounded-xl p-3 hover:border-indigo-500/20 transition-all flex flex-col gap-3 group">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="text-xs font-bold text-white block">{block.nameAr}</span>
                        </div>
                        <span className="text-[10px] text-zinc-500 block leading-normal mt-1 pr-1">
                          {block.description}
                        </span>
                      </div>

                      {/* Live Mini Preview Box */}
                      <div className="p-3.5 rounded-xl bg-[#09090b] border border-white/5 text-[11px] leading-relaxed text-zinc-400 text-center relative overflow-hidden">
                        <span className="absolute left-2 top-2 text-[7px] text-indigo-500 font-bold bg-indigo-500/10 px-1.5 py-0.5 rounded-full select-none">Live Preview</span>
                        <div className="mt-1 leading-relaxed text-right font-medium">
                          {evaluatePlaceholders(block.content)}
                        </div>
                      </div>

                      <button
                        onClick={() => handleAddBlock(block)}
                        className="w-full h-8 bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-[10px] rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>إدراج في الصفحة</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* COLUMN 2 (4/12): THE SIMULATOR CANVAS (معاينة ساحة العمل التفاعلية للترتيب والربط) */}
            <div className="lg:col-span-4 flex flex-col gap-4 bg-[#121214]/60 border border-white/5 p-4 rounded-3xl">
              <div className="border-b border-white/5 pb-2 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-indigo-400 flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    <span>2. مجسم ساحة العمل (Simulator Canvas)</span>
                  </span>
                  <p className="text-[10px] text-zinc-500 leading-normal mt-1">
                    اضغط على أي كتلة لتعديل تفاصيلها، أو اسحب ورتب العناصر.
                  </p>
                </div>
              </div>

              {/* The simulation wrapper */}
              <div className={`mx-auto bg-[#09090b] border-2 border-zinc-800 rounded-[32px] overflow-hidden shadow-2xl flex flex-col ${
                simulationDevice === 'mobile' ? 'w-full max-w-[320px] min-h-[480px]' : 'w-full min-h-[480px]'
              }`}>
                {/* Device header */}
                <div className="bg-zinc-900 px-4 py-2 border-b border-zinc-800 flex items-center justify-between select-none">
                  <div className="flex gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  </div>
                  <span className="text-[9px] font-bold text-zinc-500 font-mono tracking-wider">faqar-preview-mode</span>
                  <div className="w-4 h-4 rounded bg-zinc-800" />
                </div>

                {/* Inner Simulator Content */}
                <div className="p-4 flex-1 flex flex-col gap-3 overflow-y-auto max-h-[420px] custom-scrollbar bg-[#060608]">
                  
                  {(!selectedPage.builderBlocks || selectedPage.builderBlocks.length === 0) ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-20 text-zinc-600 gap-2 select-none">
                      <Compass className="w-8 h-8 opacity-40 animate-spin" />
                      <p className="text-[10px] font-semibold">ساحة العمل فارغة حالياً.</p>
                      <p className="text-[9px]">أضف كتل من عمود الاستكشاف للبدء بالتصميم!</p>
                    </div>
                  ) : (
                    selectedPage.builderBlocks.map((block, index) => {
                      const isSelected = block.id === selectedBlockId;
                      
                      // Calculate flexbox classes based on styles properties
                      const justifyClass = 
                        block.styles.justifyContent === 'center' ? 'justify-center' :
                        block.styles.justifyContent === 'between' ? 'justify-between' :
                        block.styles.justifyContent === 'around' ? 'justify-around' : 'justify-start';

                      const alignClass = 
                        block.styles.alignItems === 'center' ? 'items-center' :
                        block.styles.alignItems === 'end' ? 'items-end' : 'items-start';

                      const directionClass = block.styles.flexDirection === 'column' ? 'flex-col' : 'flex-row';

                      // Device responsiveness display checks
                      const isHidden = (simulationDevice === 'mobile' && block.styles.responsive === 'desktop') ||
                                     (simulationDevice === 'desktop' && block.styles.responsive === 'mobile');

                      if (isHidden) return null;

                      return (
                        <div
                          key={block.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBlockId(block.id);
                          }}
                          className={`relative group rounded-2xl cursor-pointer transition-all border p-4 ${
                            isSelected 
                              ? 'border-indigo-500 bg-indigo-950/25 ring-2 ring-indigo-500/20 shadow-lg shadow-indigo-500/10' 
                              : 'border-white/5 bg-[#121214]/80 hover:border-white/15'
                          }`}
                          style={{
                            display: block.styles.display,
                            width: block.styles.width === 'full' ? '100%' : block.styles.width === 'half' ? '50%' : `${block.styles.widthCustom || 100}%`,
                            zIndex: block.styles.zIndex,
                            marginTop: `${block.styles.margin}px`,
                            marginBottom: `${block.styles.margin}px`,
                            padding: `${block.styles.padding}px`
                          }}
                        >
                          {/* Ordering & delete overlay headers */}
                          <div className="absolute -top-3.5 right-3 bg-zinc-900 border border-white/10 rounded-lg px-2 py-0.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-md">
                            <span className="text-[8px] font-bold text-zinc-400">#{index + 1}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveBlock(index, 'up');
                              }}
                              disabled={index === 0}
                              className="text-zinc-500 hover:text-white disabled:opacity-30"
                              title="تحريك لأعلى"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveBlock(index, 'down');
                              }}
                              disabled={index === (selectedPage.builderBlocks || []).length - 1}
                              className="text-zinc-500 hover:text-white disabled:opacity-30"
                              title="تحريك لأسفل"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteBlock(block.id);
                              }}
                              className="text-rose-500 hover:text-rose-400 mr-1"
                              title="حذف الكتلة"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Render dynamic style variables */}
                          <div className={`flex w-full ${directionClass} ${justifyClass} ${alignClass} gap-2`}>
                            {block.isGlobal && (
                              <span className="text-[7px] font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 self-start select-none">
                                <Link className="w-2.5 h-2.5" />
                                <span>كتلة عامة</span>
                              </span>
                            )}

                            {block.type === 'button' ? (
                              <button className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/10 pointer-events-none text-center">
                                {evaluatePlaceholders(block.content)}
                              </button>
                            ) : block.type === 'stats' ? (
                              <div className="w-full p-3.5 bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/20 text-amber-400 text-xs font-bold rounded-xl text-right">
                                {evaluatePlaceholders(block.content)}
                              </div>
                            ) : block.type === 'container' ? (
                              <div className="w-full p-4 bg-zinc-900 border border-white/5 rounded-2xl text-xs text-zinc-300 leading-relaxed">
                                {evaluatePlaceholders(block.content)}
                              </div>
                            ) : (
                              <div className="text-xs text-zinc-200 leading-relaxed w-full text-right">
                                {evaluatePlaceholders(block.content)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* COLUMN 3 (4/12): THE PROPERTIES PANEL (محرر وتنسيق الكتلة النشطة والمنطق الذكي) */}
            <div className="lg:col-span-4 flex flex-col gap-4 bg-[#121214]/60 border border-white/5 p-4 rounded-3xl">
              <div className="border-b border-white/5 pb-2">
                <span className="text-xs font-black text-indigo-400 flex items-center gap-1">
                  <Settings className="w-4 h-4" />
                  <span>3. محرر التنسيق والمنطق المرئي (Properties Panel)</span>
                </span>
                <p className="text-[10px] text-zinc-500 leading-normal mt-1">
                  قم بتحرير المحتوى وتوسيط العناصر (Flexbox) وضبط الإجراءات وساعات الظهور للمشتركين.
                </p>
              </div>

              {!selectedBlock ? (
                <div className="text-center py-20 text-zinc-600 flex flex-col items-center justify-center gap-2 select-none">
                  <Sliders className="w-8 h-8 opacity-40" />
                  <p className="text-[10.5px] font-bold">لم تقم بتحديد كتلة للتعديل بعد.</p>
                  <p className="text-[9.5px]">اضغط على أي كتلة داخل مجسم الهاتف الذكي لعرض إعداداتها هنا وتنسيقها!</p>
                </div>
              ) : (
                <div className="flex flex-col gap-5 text-right animate-fade-in">
                  
                  {/* Global block status header */}
                  {selectedBlock.isGlobal && (
                    <div className="bg-indigo-950/20 border border-indigo-500/20 p-3 rounded-xl flex items-center justify-between">
                      <span className="text-[10.5px] text-zinc-300 font-bold flex items-center gap-1">
                        <Link className="w-3.5 h-3.5 text-indigo-400" />
                        <span>الكتلة نشطة ككتلة عامة (Global Sync)</span>
                      </span>
                      <button
                        onClick={handleUnlinkBlock}
                        className="h-7 px-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[10px] font-bold text-zinc-300 flex items-center gap-1 cursor-pointer"
                        title="فك الارتباط"
                      >
                        <Unlock className="w-3 h-3" />
                        <span>فك الارتباط</span>
                      </button>
                    </div>
                  )}

                  {/* 1. CONTENT & VARIABLE MANAGER */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] text-zinc-400 font-bold">تحرير نص المحتوى الخاص بالكتلة:</span>
                      
                      {/* Insert Variable Button */}
                      <div className="relative">
                        <button
                          onClick={() => setShowVarDropdown(!showVarDropdown)}
                          className="h-7 px-3 bg-indigo-500 text-white hover:bg-indigo-400 text-[10px] font-black rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>إدراج متغير ذكي 📊</span>
                        </button>

                        {showVarDropdown && (
                          <div className="absolute left-0 top-8 w-64 bg-[#0d0d0f]/95 border border-white/10 rounded-2xl shadow-2xl p-2.5 z-50 flex flex-col gap-2 text-right">
                            <span className="text-[9.5px] font-black text-indigo-400 border-b border-white/5 pb-1">اختر متغيراً لإدراجه تلقائياً:</span>
                            
                            {/* Variable Filters */}
                            <div className="flex gap-1 overflow-x-auto pb-1 border-b border-white/5">
                              {['الكل', 'بيانات العملاء', 'الاشتراكات', 'الحسابات'].map((cat) => (
                                <button
                                  key={cat}
                                  onClick={() => setVarCategoryFilter(cat as any)}
                                  className={`h-6 px-2 rounded-md text-[8.5px] font-bold shrink-0 ${
                                    varCategoryFilter === cat ? 'bg-indigo-500/20 text-indigo-400' : 'bg-black/30 text-zinc-500'
                                  }`}
                                >
                                  {cat}
                                </button>
                              ))}
                            </div>

                            {/* Variables list */}
                            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto custom-scrollbar">
                              {filteredVariables.map((v, i) => (
                                <button
                                  key={i}
                                  onClick={() => {
                                    // Append variable code to textarea content
                                    handleUpdateBlockField({
                                      content: selectedBlock.content + ` ${v.code}`
                                    });
                                    setShowVarDropdown(false);
                                    showToast(`تم إدراج كود المتغير ${v.code} بنجاح!`, 'success');
                                  }}
                                  className="w-full text-right p-1.5 rounded-lg hover:bg-white/[0.04] flex flex-col gap-0.5 group"
                                  title={v.tooltip}
                                >
                                  <div className="flex items-center justify-between">
                                    <code className="text-[8px] font-mono text-zinc-500 group-hover:text-indigo-400">{v.code}</code>
                                    <span className="text-[10px] font-bold text-zinc-200">{v.labelAr}</span>
                                  </div>
                                  <span className="text-[8px] text-zinc-500 text-right font-medium leading-normal block">{v.tooltip}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <textarea
                      value={selectedBlock.content}
                      onChange={(e) => handleUpdateBlockField({ content: e.target.value })}
                      placeholder="اكتب المحتوى أو الكود المدرج للكتلة..."
                      className="w-full h-20 p-3 rounded-xl bg-[#18181b] border border-white/5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/30 font-medium"
                    />
                  </div>

                  {/* 2. VISUAL FLEXBOX & STYLE UI */}
                  <div className="border-t border-white/5 pt-4 flex flex-col gap-3">
                    <span className="text-[11px] text-zinc-400 font-bold block">🎨 التنسيق والمظهر المرئي (Flexbox UI):</span>

                    {/* Flex Direction */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-zinc-500">اتجاه المحاذاة (Direction):</span>
                      <div className="flex bg-black/40 p-1 rounded-lg border border-white/5">
                        <button
                          onClick={() => handleUpdateBlockField({ styles: { ...selectedBlock.styles, flexDirection: 'column' } })}
                          className={`h-6 px-2 rounded text-[9px] font-bold ${selectedBlock.styles.flexDirection === 'column' ? 'bg-indigo-500 text-white' : 'text-zinc-500'}`}
                        >
                          عمودي
                        </button>
                        <button
                          onClick={() => handleUpdateBlockField({ styles: { ...selectedBlock.styles, flexDirection: 'row' } })}
                          className={`h-6 px-2 rounded text-[9px] font-bold ${selectedBlock.styles.flexDirection === 'row' ? 'bg-indigo-500 text-white' : 'text-zinc-500'}`}
                        >
                          أفقي
                        </button>
                      </div>
                    </div>

                    {/* Flex Justify Content */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-zinc-500">توزيع المسافات (Justify):</span>
                      <select
                        value={selectedBlock.styles.justifyContent}
                        onChange={(e) => handleUpdateBlockField({ styles: { ...selectedBlock.styles, justifyContent: e.target.value as any } })}
                        className="h-7 px-2 rounded-lg bg-[#18181b] border border-white/5 text-[9px] text-zinc-300 focus:outline-none"
                      >
                        <option value="start">لليمين / البداية</option>
                        <option value="center">المركز والتوسيط</option>
                        <option value="between">بين الأطراف (Between)</option>
                        <option value="around">توزيع متوازن (Around)</option>
                      </select>
                    </div>

                    {/* Flex Align Items */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-zinc-500">المحاذاة الرأسية (Align):</span>
                      <select
                        value={selectedBlock.styles.alignItems}
                        onChange={(e) => handleUpdateBlockField({ styles: { ...selectedBlock.styles, alignItems: e.target.value as any } })}
                        className="h-7 px-2 rounded-lg bg-[#18181b] border border-white/5 text-[9px] text-zinc-300 focus:outline-none"
                      >
                        <option value="start">أعلى الصفحة</option>
                        <option value="center">توسيط رأسي</option>
                        <option value="end">أسفل الصفحة</option>
                      </select>
                    </div>

                    {/* Width sizing */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-zinc-500">عرض العنصر الرئيسي:</span>
                      <select
                        value={selectedBlock.styles.width}
                        onChange={(e) => handleUpdateBlockField({ styles: { ...selectedBlock.styles, width: e.target.value as any } })}
                        className="h-7 px-2 rounded-lg bg-[#18181b] border border-white/5 text-[9px] text-zinc-300 focus:outline-none"
                      >
                        <option value="full">عرض كامل (Full)</option>
                        <option value="half">نصف العرض (50%)</option>
                        <option value="custom">عرض مخصص منزلق</option>
                      </select>
                    </div>

                    {selectedBlock.styles.width === 'custom' && (
                      <div className="flex flex-col gap-1 bg-black/20 p-2 rounded-lg border border-white/5 animate-fade-in">
                        <div className="flex justify-between text-[8px] text-zinc-500">
                          <span>100%</span>
                          <span>النسبة: {selectedBlock.styles.widthCustom || 100}%</span>
                          <span>10%</span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="100"
                          value={selectedBlock.styles.widthCustom || 100}
                          onChange={(e) => handleUpdateBlockField({ styles: { ...selectedBlock.styles, widthCustom: Number(e.target.value) } })}
                          className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>
                    )}

                    {/* Margins & Paddings sliders */}
                    <div className="grid grid-cols-2 gap-3 bg-black/20 p-2.5 rounded-xl border border-white/5">
                      <div className="flex flex-col gap-1 text-center">
                        <span className="text-[9px] text-zinc-500 font-bold">الهوامش الداخلية (Padding):</span>
                        <span className="text-[10px] text-white font-mono">{selectedBlock.styles.padding}px</span>
                        <input
                          type="range"
                          min="4"
                          max="40"
                          value={selectedBlock.styles.padding}
                          onChange={(e) => handleUpdateBlockField({ styles: { ...selectedBlock.styles, padding: Number(e.target.value) } })}
                          className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>

                      <div className="flex flex-col gap-1 text-center border-r border-white/5 pr-3">
                        <span className="text-[9px] text-zinc-500 font-bold">الهوامش الخارجية (Margin):</span>
                        <span className="text-[10px] text-white font-mono">{selectedBlock.styles.margin}px</span>
                        <input
                          type="range"
                          min="0"
                          max="30"
                          value={selectedBlock.styles.margin}
                          onChange={(e) => handleUpdateBlockField({ styles: { ...selectedBlock.styles, margin: Number(e.target.value) } })}
                          className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Z-Index and Responsive device toggle */}
                    <div className="flex items-center justify-between gap-3 bg-black/20 p-2 rounded-xl border border-white/5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-zinc-500">Z-Index:</span>
                        <input
                          type="number"
                          value={selectedBlock.styles.zIndex}
                          onChange={(e) => handleUpdateBlockField({ styles: { ...selectedBlock.styles, zIndex: Number(e.target.value) || 1 } })}
                          className="w-12 h-6 px-1 text-center bg-[#18181b] border border-white/5 rounded text-[10px] text-white font-mono"
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-zinc-500">التجاوب:</span>
                        <select
                          value={selectedBlock.styles.responsive}
                          onChange={(e) => handleUpdateBlockField({ styles: { ...selectedBlock.styles, responsive: e.target.value as any } })}
                          className="h-6 px-1.5 rounded bg-[#18181b] border border-white/5 text-[9px] text-zinc-300 focus:outline-none font-bold"
                        >
                          <option value="all">كل الأجهزة</option>
                          <option value="mobile">المحمول فقط 📱</option>
                          <option value="desktop">الحاسوب فقط 💻</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 3. ADVANCED LOGIC GATES */}
                  <div className="border-t border-white/5 pt-4 flex flex-col gap-3">
                    <span className="text-[11px] text-zinc-400 font-bold block flex items-center gap-1 text-amber-400">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>🧠 بوابات وشروط ظهور المنطق (Logic Gates):</span>
                    </span>

                    {/* Visibility Condition Selector */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-zinc-500">محدد شرط الرؤية:</span>
                      <select
                        value={selectedBlock.visibility.conditionType}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          // If adding rule but none exist, add default
                          const rules = selectedBlock.visibility.rules.length > 0 
                            ? selectedBlock.visibility.rules 
                            : (val !== 'always' ? [{ field: 'outstanding_debts', operator: 'greater_than', value: '0' }] : []);
                          
                          handleUpdateBlockField({
                            visibility: {
                              ...selectedBlock.visibility,
                              conditionType: val,
                              rules: rules as any
                            }
                          });
                        }}
                        className="h-7 px-2 rounded-lg bg-[#18181b] border border-white/5 text-[9px] text-zinc-300 focus:outline-none font-bold"
                      >
                        <option value="always">متاح دائماً وبدون شروط</option>
                        <option value="and">شروط مركبة (AND)</option>
                        <option value="or">شروط بديلة (OR)</option>
                        <option value="schedule">جدول زمني مخصص</option>
                      </select>
                    </div>

                    {/* Rule editors if AND / OR */}
                    {(selectedBlock.visibility.conditionType === 'and' || selectedBlock.visibility.conditionType === 'or') && (
                      <div className="bg-[#1b1212]/30 border border-amber-500/15 p-3 rounded-2xl flex flex-col gap-2.5 animate-fade-in">
                        <span className="text-[9.5px] font-bold text-amber-500 block">قواعد فحص شروط الظهور:</span>
                        
                        {selectedBlock.visibility.rules.map((rule, ri) => (
                          <div key={ri} className="flex flex-col gap-1.5 border-b border-white/5 pb-2.5 last:border-b-0 last:pb-0">
                            
                            {/* Rule field */}
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="text-[8.5px] text-zinc-500">حقل التدقيق:</span>
                              <select
                                value={rule.field}
                                onChange={(e) => {
                                  const updatedRules = [...selectedBlock.visibility.rules];
                                  updatedRules[ri].field = e.target.value as any;
                                  handleUpdateBlockField({ visibility: { ...selectedBlock.visibility, rules: updatedRules } });
                                }}
                                className="h-6 px-1 rounded bg-[#18181b] border border-white/5 text-[8.5px] text-zinc-300"
                              >
                                <option value="user_role">دور المستخدم (Role)</option>
                                <option value="subscription_status">حالة العقد والمشروع</option>
                                <option value="outstanding_debts">إجمالي الديون المتأخرة</option>
                              </select>
                            </div>

                            {/* Rule Operator & value */}
                            <div className="flex items-center gap-1">
                              <select
                                value={rule.operator}
                                onChange={(e) => {
                                  const updatedRules = [...selectedBlock.visibility.rules];
                                  updatedRules[ri].operator = e.target.value as any;
                                  handleUpdateBlockField({ visibility: { ...selectedBlock.visibility, rules: updatedRules } });
                                }}
                                className="h-6 flex-1 px-1 rounded bg-[#18181b] border border-white/5 text-[8px] text-zinc-300"
                              >
                                <option value="equals">يساوي تماماً</option>
                                <option value="greater_than">أكبر من</option>
                                <option value="less_than">أصغر من</option>
                              </select>
                              
                              <input
                                type="text"
                                value={rule.value}
                                onChange={(e) => {
                                  const updatedRules = [...selectedBlock.visibility.rules];
                                  updatedRules[ri].value = e.target.value;
                                  handleUpdateBlockField({ visibility: { ...selectedBlock.visibility, rules: updatedRules } });
                                }}
                                placeholder="مثال: admin"
                                className="h-6 w-16 px-1.5 rounded bg-[#18181b] border border-white/5 text-[8.5px] text-white text-center font-mono"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Schedule Builder */}
                    {selectedBlock.visibility.conditionType === 'schedule' && (
                      <div className="bg-black/25 p-3 rounded-2xl border border-white/5 flex flex-col gap-2 animate-scale-up">
                        <span className="text-[9px] font-bold text-zinc-500 block">ساعات العرض أيام العمل:</span>
                        
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[7.5px] text-zinc-500">من الساعة:</span>
                            <input
                              type="time"
                              value={selectedBlock.visibility.schedule?.startHour || '08:00'}
                              onChange={(e) => {
                                handleUpdateBlockField({
                                  visibility: {
                                    ...selectedBlock.visibility,
                                    schedule: {
                                      days: selectedBlock.visibility.schedule?.days || ['Saturday'],
                                      startHour: e.target.value,
                                      endHour: selectedBlock.visibility.schedule?.endHour || '17:00'
                                    }
                                  }
                                });
                              }}
                              className="h-6 px-1 rounded bg-[#18181b] border border-white/5 text-[9px] text-white font-mono"
                            />
                          </div>

                          <div className="flex flex-col gap-0.5">
                            <span className="text-[7.5px] text-zinc-500">إلى الساعة:</span>
                            <input
                              type="time"
                              value={selectedBlock.visibility.schedule?.endHour || '17:00'}
                              onChange={(e) => {
                                handleUpdateBlockField({
                                  visibility: {
                                    ...selectedBlock.visibility,
                                    schedule: {
                                      days: selectedBlock.visibility.schedule?.days || ['Saturday'],
                                      startHour: selectedBlock.visibility.schedule?.startHour || '08:00',
                                      endHour: e.target.value
                                    }
                                  }
                                });
                              }}
                              className="h-6 px-1 rounded bg-[#18181b] border border-white/5 text-[9px] text-white font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 4. ACTIONS & TRIGGERS MOTOR */}
                  <div className="border-t border-white/5 pt-4 flex flex-col gap-3">
                    <span className="text-[11px] text-zinc-400 font-bold block flex items-center gap-1 text-emerald-400">
                      <Zap className="w-3.5 h-3.5" />
                      <span>⚡ محرك الإجراءات والأحداث (On-Click / On-Load):</span>
                    </span>

                    {/* On-click interaction */}
                    <div className="bg-black/20 p-3 rounded-2xl border border-white/5 flex flex-col gap-2">
                      <span className="text-[9.5px] font-bold text-zinc-300">الإجراء عند الضغط (On-Click):</span>
                      <select
                        value={selectedBlock.triggers.onClick?.action || 'navigate'}
                        onChange={(e) => {
                          const act = e.target.value as any;
                          handleUpdateBlockField({
                            triggers: {
                              ...selectedBlock.triggers,
                              onClick: {
                                action: act,
                                notifyText: selectedBlock.triggers.onClick?.notifyText || 'تم الضغط!',
                                whatsappTemplateId: 'romantic-1'
                              }
                            }
                          });
                        }}
                        className="h-6.5 px-1.5 rounded-lg bg-[#18181b] border border-white/5 text-[8.5px] text-zinc-300"
                      >
                        <option value="navigate">الانتقال لصفحة مخصصة</option>
                        <option value="whatsapp">إرسال قالب تذكير واتساب 📲</option>
                        <option value="notify">إظهار إشعار فوري (Toast)</option>
                        <option value="script">تشغيل سكربت برمجي مخصص</option>
                      </select>

                      {/* Display conditional parameter fields depending on action */}
                      {selectedBlock.triggers.onClick?.action === 'whatsapp' && (
                        <div className="flex flex-col gap-1.5 animate-fade-in mt-1">
                          <span className="text-[8px] text-zinc-500">القالب الرقمي المعتمد للإرسال:</span>
                          <select
                            value={selectedBlock.triggers.onClick.whatsappTemplateId || 'romantic-1'}
                            onChange={(e) => {
                              handleUpdateBlockField({
                                triggers: {
                                  ...selectedBlock.triggers,
                                  onClick: {
                                    ...selectedBlock.triggers.onClick!,
                                    whatsappTemplateId: e.target.value
                                  }
                                }
                              });
                            }}
                            className="h-6 px-1.5 rounded bg-[#18181b] border border-white/5 text-[8px] text-zinc-300"
                          >
                            <option value="romantic-1">💖 قالب تذكير رومانسي</option>
                            <option value="formal-notify-2">🚨 إشعار رسمي عاجل</option>
                          </select>
                        </div>
                      )}

                      {selectedBlock.triggers.onClick?.action === 'notify' && (
                        <input
                          type="text"
                          value={selectedBlock.triggers.onClick.notifyText || ''}
                          onChange={(e) => {
                            handleUpdateBlockField({
                              triggers: {
                                ...selectedBlock.triggers,
                                onClick: {
                                  ...selectedBlock.triggers.onClick!,
                                  notifyText: e.target.value
                                }
                              }
                            });
                          }}
                          placeholder="اكتب رسالة الإشعار..."
                          className="h-7 px-2 rounded-lg bg-[#18181b] border border-white/5 text-[9px] text-white mt-1"
                        />
                      )}

                      {selectedBlock.triggers.onClick?.action === 'script' && (
                        <textarea
                          value={selectedBlock.triggers.onClick.scriptCode || ''}
                          onChange={(e) => {
                            handleUpdateBlockField({
                              triggers: {
                                ...selectedBlock.triggers,
                                onClick: {
                                  ...selectedBlock.triggers.onClick!,
                                  scriptCode: e.target.value
                                }
                              }
                            });
                          }}
                          placeholder="console.log('Faqar App Script');"
                          className="h-10 p-1.5 rounded-lg bg-[#18181b] border border-white/5 text-[8px] text-emerald-400 font-mono mt-1"
                        />
                      )}
                    </div>
                  </div>

                  {/* 5. SAVE & SYNC CONTROLS */}
                  <div className="border-t border-white/5 pt-4 flex items-center gap-2">
                    {!selectedBlock.isGlobal ? (
                      <button
                        onClick={handleMakeBlockGlobal}
                        className="flex-1 h-9 bg-indigo-500/10 hover:bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 font-bold text-[10px] rounded-xl flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Link className="w-3.5 h-3.5" />
                        <span>حفظ ككتلة عامة (Global Sync)</span>
                      </button>
                    ) : (
                      <div className="text-[9.5px] text-zinc-500 font-semibold flex-1 text-center bg-indigo-500/5 p-2 rounded-lg border border-indigo-500/10">
                        الكتلة متصلة سحابياً بنظام التحديث التلقائي ⚡
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>

          </div>

          {/* LOWER SECTION: VERSIONING HISTORY & CHANGES LOG */}
          <div className="mt-4 bg-[#121214]/60 border border-white/5 p-5 rounded-[22px] flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-400" />
                <h3 className="text-xs font-bold text-white">سجل تعديلات وإصدارات الصفحة (History & Versioning)</h3>
              </div>
              <span className="text-[10px] text-zinc-500">ميزة الحماية والرجوع للخلف بنقرة واحدة 🛡️</span>
            </div>

            <p className="text-[10.5px] text-zinc-400 leading-relaxed">
              يقوم النظام بتتبع وحفظ أي مكون أو كتلة برمجية تقوم بإضافتها أو تحريكها كأرشيف مؤرخ. في حال حدوث أي خطأ في التصميم التفاعلي، يمكنك مراجعة واستعادة الإصدار السابق بضغطة زر واحدة لتبقى صفحاتك في أمان مطلق.
            </p>

            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar">
              {(!versions[selectedPage.id] || versions[selectedPage.id].length === 0) ? (
                <div className="text-center py-6 text-[10px] text-zinc-600 font-semibold bg-black/10 rounded-xl">
                  لا توجد نسخ احتياطية مؤرشفة لهذه الصفحة حتى الآن. سيتم توليدها تلقائياً عند إجراء أي تعديل!
                </div>
              ) : (
                versions[selectedPage.id].map((ver, vi) => {
                  return (
                    <div key={vi} className="bg-black/20 hover:bg-black/40 border border-white/5 p-3 rounded-xl flex items-center justify-between gap-3 transition-colors">
                      <div className="text-right">
                        <span className="text-xs font-bold text-white block">{ver.note}</span>
                        <span className="text-[9px] text-zinc-500 block mt-1">
                          تاريخ الحفظ: {new Date(ver.timestamp).toLocaleString('ar-IQ')} • يحتوي على {ver.blocks.length} كتل تصميمية
                        </span>
                      </div>

                      <button
                        onClick={() => handleRestoreVersion(ver.blocks)}
                        className="h-8 px-3 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 font-black text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <CornerDownLeft className="w-3.5 h-3.5" />
                        <span>استرجاع هذا الإصدار</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      )}

      {/* CREATE NEW CUSTOM PAGE MODAL */}
      {showAddPageModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-55 flex items-center justify-center p-4">
          <div className="bg-[#0c0c0e] border border-white/10 rounded-[28px] w-full max-w-[420px] p-6 shadow-2xl flex flex-col gap-4 animate-scale-up" dir="rtl">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <button
                onClick={() => setShowAddPageModal(false)}
                className="w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-zinc-400 cursor-pointer"
              >
                ✕
              </button>
              <h2 className="text-sm font-black text-white flex items-center gap-2">
                <Compass className="w-5 h-5 text-indigo-400" />
                <span>إنشاء صفحة تفاعلية مخصصة</span>
              </h2>
            </div>

            <div className="flex flex-col gap-4 text-right">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-zinc-500 font-bold">اسم الصفحة (يظهر في قوائم التطبيق)</span>
                <input
                  type="text"
                  value={newPageTitle}
                  onChange={(e) => setNewPageTitle(e.target.value)}
                  placeholder="مثال: فواتير الدفع السريعة"
                  className="w-full h-11 px-4 text-xs bg-white/[0.02] border border-white/5 rounded-xl text-zinc-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] text-zinc-500 font-bold">موقع الصفحة الرئيسي</span>
                  <select
                    value={newPagePosition}
                    onChange={(e) => setNewPagePosition(e.target.value as any)}
                    className="w-full h-11 px-3 text-xs bg-white/[0.02] border border-white/5 rounded-xl text-zinc-200"
                  >
                    <option value="bottom">شريط الملاحة السفلي</option>
                    <option value="top">شريط الإجراءات العلوي</option>
                    <option value="left">الجانب الأيسر</option>
                    <option value="right">الجانب الأيمن</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] text-zinc-500 font-bold">تخطيط وتنسيق الصفحة</span>
                  <select
                    value={newPageLayout}
                    onChange={(e) => setNewPageLayout(e.target.value as any)}
                    className="w-full h-11 px-3 text-xs bg-white/[0.02] border border-white/5 rounded-xl text-zinc-200"
                  >
                    <option value="full">عرض كامل للمحمول</option>
                    <option value="dropdown">قائمة منسدلة أنيقة</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-zinc-500 font-bold">شروط وإمكانيات العرض والظهور</span>
                <select
                  value={newPageVisibility}
                  onChange={(e) => setNewPageVisibility(e.target.value as any)}
                  className="w-full h-11 px-3 text-xs bg-white/[0.02] border border-white/5 rounded-xl text-zinc-200"
                >
                  <option value="always">متاحة لجميع الزوار والأعضاء</option>
                  <option value="admin">مسؤولي لوحة الإدارة فقط</option>
                  <option value="has_contracts">فقط للعملاء الذين لديهم عقود أقساط</option>
                  <option value="custom_expr">صيغة تعبير رياضي معقدة</option>
                </select>
              </div>

              {newPageVisibility === 'custom_expr' && (
                <div className="flex flex-col gap-1.5 animate-fade-in">
                  <span className="text-[10px] text-zinc-500 font-bold">التعبير الرياضي البرمجي (Expression)</span>
                  <input
                    type="text"
                    value={newPageExpr}
                    onChange={(e) => setNewPageExpr(e.target.value)}
                    placeholder="e.g., has_late_installments === true"
                    className="w-full h-11 px-4 text-xs bg-white/[0.02] border border-white/5 rounded-xl text-zinc-200 text-left font-mono"
                    dir="ltr"
                  />
                </div>
              )}
            </div>

            <button
              onClick={handleCreateNewPage}
              className="w-full h-12 bg-indigo-500 hover:bg-indigo-400 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 mt-2 transition-all active:scale-95 shadow-lg shadow-indigo-500/20 cursor-pointer"
            >
              <CheckCircle className="w-5 h-5" />
              <span>تأكيد وإنشاء الصفحة وبدء التصميم</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
