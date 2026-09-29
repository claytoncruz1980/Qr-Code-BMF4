import React, { useState, useEffect } from 'react';
import { LabProvider, useLab } from './context/LabContext';
import { Navbar, ActiveTab } from './components/Navbar';
import { LovableDashboard } from './components/LovableDashboard';
import { BottomNavigation } from './components/BottomNavigation';
import { FullRosterModal } from './components/FullRosterModal';
import { QRScannerModal } from './components/QRScannerModal';
import { LabProjectionScreen } from './components/LabProjectionScreen';
import { QuickPickerModal } from './components/QuickPickerModal';
import { NewSessionModal } from './components/NewSessionModal';
import { StudentCheckInModal } from './components/StudentCheckInModal';
import { JustificationsView } from './components/JustificationsView';
import { SettingsView } from './components/SettingsView';
import { StudentsManagement } from './components/StudentsManagement';
import { ClassesManagement } from './components/ClassesManagement';
import { ProfessorsManagement } from './components/ProfessorsManagement';
import { ReportsView } from './components/ReportsView';
import { GradesManagement } from './components/GradesManagement';
import { SecureStudentPortal } from './components/SecureStudentPortal';
import { ProfessorLoginModal } from './components/ProfessorLoginModal';
import { AuthGateScreen } from './components/AuthGateScreen';
import { FirstAccessPinModal } from './components/FirstAccessPinModal';

import { ClassPeriod, getActivityTypeLabel } from './types';
import { Tv, Sparkles, UserCheck, LayoutGrid, Users, GraduationCap, FileSpreadsheet, Settings, Award, FileCheck, X, Layers, CheckCircle2 } from 'lucide-react';

function MainApp() {
  const { activeProfessor, logoutProfessor, activeSession, selectedClassId, classes, sessions } = useLab();
  const [activeTab, setActiveTab] = useState<ActiveTab>('chamada');
  const [academicSubTab, setAcademicSubTab] = useState<'alunos' | 'docentes' | 'turmas' | 'justificativas' | 'ajustes'>('alunos');
  const [isFullRosterOpen, setIsFullRosterOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isProjectionOpen, setIsProjectionOpen] = useState(false);
  const [projectionPeriod, setProjectionPeriod] = useState<ClassPeriod | undefined>(undefined);
  const [isQuickPickerOpen, setIsQuickPickerOpen] = useState(false);
  const [isNewSessionOpen, setIsNewSessionOpen] = useState(false);
  const [isTelaoConfigModalOpen, setIsTelaoConfigModalOpen] = useState(false);
  const [isTelaoActivePromptOpen, setIsTelaoActivePromptOpen] = useState(false);
  const [isStudentCheckinOpen, setIsStudentCheckinOpen] = useState(false);
  const [isProfessorLoginOpen, setIsProfessorLoginOpen] = useState(false);
  const [isFirstAccessModalOpen, setIsFirstAccessModalOpen] = useState(false);


  const isDateToday = (dateStr?: string): boolean => {
    if (!dateStr) return false;
    const today = new Date().toISOString().split('T')[0];
    return dateStr.startsWith(today);
  };

  const hasLiveSessionToday = Boolean(
    activeSession && 
    activeSession.classGroupId === selectedClassId && 
    activeSession.isLive && 
    !activeSession.isLocked &&
    isDateToday(activeSession.date)
  );

  const handleOpenTelao = (period?: ClassPeriod) => {
    if (period) {
      setProjectionPeriod(period);
    } else {
      setProjectionPeriod(undefined);
    }

    if (hasLiveSessionToday) {
      setIsTelaoActivePromptOpen(true);
    } else {
      setIsTelaoConfigModalOpen(true);
    }
  };

  const handleTabChange = (tab: ActiveTab) => {
    if (tab === 'telao') {
      handleOpenTelao();
    } else {
      setActiveTab(tab);
    }
  };

  // Helper to extract parameters from either window.location.search or window.location.hash
  const getParam = (key: string): string => {
    if (typeof window === 'undefined') return '';
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get(key)) return searchParams.get(key) || '';
    if (window.location.hash) {
      const qIndex = window.location.hash.indexOf('?');
      if (qIndex !== -1) {
        const hashParams = new URLSearchParams(window.location.hash.substring(qIndex + 1));
        if (hashParams.get(key)) return hashParams.get(key) || '';
      }
    }
    return '';
  };

  // Detect if the user entered via student check-in QR code or link
  const checkIsStudentPortal = () => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    const portal = getParam('portal');
    const mode = getParam('mode');
    const checkin = getParam('checkin');
    const token = getParam('token');
    const aluno = getParam('aluno');
    return (
      path.includes('/aluno') ||
      path.includes('/checkin') ||
      hash.includes('aluno') ||
      hash.includes('checkin') ||
      portal === 'aluno' ||
      mode === 'student' ||
      mode === 'register' ||
      mode === 'checkin' ||
      Boolean(checkin) ||
      Boolean(token) ||
      Boolean(aluno)
    );
  };

  // Detect if opened directly as the dedicated QR Code Projection Screen (Smart TV / Projector / Chromecast / Email Link)
  const checkIsProjectionPortal = () => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    
    // If student check-in is requested, priority goes to student portal
    if (checkIsStudentPortal()) {
      return false;
    }
    const portal = getParam('portal');
    const view = getParam('view');
    const mode = getParam('mode');
    const tv = getParam('tv');
    return (
      path.includes('/telao') ||
      path.includes('/tv') ||
      path.includes('/projetor') ||
      path.includes('/projecao') ||
      path.includes('/qr') ||
      hash.includes('telao') ||
      hash.includes('tv') ||
      hash.includes('projetor') ||
      hash.includes('projecao') ||
      hash.includes('qr') ||
      portal === 'telao' ||
      portal === 'tv' ||
      portal === 'qr' ||
      portal === 'projecao' ||
      view === 'telao' ||
      view === 'qr' ||
      view === 'tv' ||
      mode === 'telao' ||
      mode === 'tv' ||
      mode === 'projection' ||
      tv === '1'
    );
  };

  const [isStudentPortal, setIsStudentPortal] = useState<boolean>(checkIsStudentPortal);
  const [isProjectionPortal, setIsProjectionPortal] = useState<boolean>(checkIsProjectionPortal);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const [showChromebookInstallBanner, setShowChromebookInstallBanner] = useState(false);

  // Capture PWA install prompt for Chromebook and Desktop Chrome
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
      // Show install recommendation if on Chromebook / Desktop
      setShowChromebookInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallApp = async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowChromebookInstallBanner(false);
    }
    setDeferredInstallPrompt(null);
  };

  // Keyboard Shortcuts for Chromebook and Desktop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing inside input, textarea or select
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      if (e.key === 'Escape') {
        setIsFullRosterOpen(false);
        setIsScannerOpen(false);
        setIsQuickPickerOpen(false);
        setIsNewSessionOpen(false);
        setIsStudentCheckinOpen(false);
        setIsProfessorLoginOpen(false);
        if (isProjectionOpen || isProjectionPortal || activeTab === 'telao') {
          setIsProjectionOpen(false);
          setIsProjectionPortal(false);
          setActiveTab('chamada');
          logoutProfessor();
        }
      } else if ((e.key === 't' || e.key === 'T') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setIsProjectionOpen(prev => !prev);
      } else if (e.altKey) {
        if (e.key === '1') setActiveTab('chamada');
        if (e.key === '2') setActiveTab('notas');
        if (e.key === '3') setActiveTab('relatorios');
        if (e.key === '4') setActiveTab('telao');
        if (e.key === '5') setActiveTab('docentes');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isProjectionOpen]);

  // Synchronize on hash / URL changes
  useEffect(() => {
    const handleUrlChange = () => {
      setIsStudentPortal(checkIsStudentPortal());
      setIsProjectionPortal(checkIsProjectionPortal());
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  // Dedicated Isolated Student Check-in Portal (Anti-Fraude, Sem Acesso ao Painel do Docente)
  if (isStudentPortal) {
    const token = getParam('checkin') || getParam('token') || '';
    const turma = getParam('turma') || getParam('turmaid') || '';
    const period = getParam('period') || getParam('etapa') || '';
    const mode = getParam('mode') === 'card' ? 'card' : 'checkin';

    return (
      <SecureStudentPortal
        initialToken={token}
        initialClassId={turma}
        initialPeriod={period}
        initialMode={mode}
        onClose={() => {
          // Stay isolated in student portal - do not redirect to admin panel
        }}
        onGoToAdmin={() => {
          window.history.replaceState({}, '', window.location.pathname);
          setIsStudentPortal(false);
        }}
      />
    );
  }

  // Dedicated Fullscreen Projection View (Telão de Laboratório / Smart TV / Chromecast)
  // When accessed via direct portal link (email, whatsapp, chromecast), opens ONLY the QR code screen and not the app
  if (isProjectionPortal || isProjectionOpen) {
    return (
      <LabProjectionScreen 
        isStandalonePortal={isProjectionPortal}
        initialPeriod={projectionPeriod}
        onExitAndClose={() => {
          if (isProjectionPortal) {
            window.history.replaceState({}, '', window.location.pathname);
            setIsProjectionPortal(false);
          }
          setIsProjectionOpen(false);
          setProjectionPeriod(undefined);
          setActiveTab('chamada');
          // Strict classroom security: always lock session so PC/TV does not stay logged in
          logoutProfessor();
        }} 
      />
    );
  }

  // Restricted Access Gate: Only authenticated professors enter the dashboard
  if (!activeProfessor) {
    return (
      <AuthGateScreen
        onOpenProjectionScreen={() => handleOpenTelao()}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans antialiased selection:bg-sky-500 selection:text-white max-w-full overflow-x-hidden">
      
      {/* Universal Top Header with "Controle de presença BMF4", Clock, Date, Online status */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onOpenCheckinModal={() => setIsStudentCheckinOpen(true)}
        onOpenNewSessionModal={() => setIsNewSessionOpen(true)}
        onOpenQuickPickerModal={() => setIsQuickPickerOpen(true)}
        onOpenProfessorLogin={() => setIsProfessorLoginOpen(true)}

      />

      {/* Main View Container with strict responsive bounds */}
      <main className="flex-1 w-full max-w-6xl mx-auto p-2 sm:p-3 pb-20 md:pb-6 space-y-3">

        {/* Optional Chromebook / Desktop PWA Install Notification */}
        {showChromebookInstallBanner && (
          <div className="bg-gradient-to-r from-teal-900 to-slate-900 text-white p-3 sm:p-4 rounded-2xl border border-teal-500/40 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center shrink-0">
                <Tv className="w-5 h-5 text-teal-300" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                  <span>Instalar BMF4 no Chromebook / Computador</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-teal-500/30 text-teal-300 font-mono font-bold uppercase">PWA</span>
                </h4>
                <p className="text-[11px] text-slate-300">
                  Abra o aplicativo em janela dedicada sem barras de navegador e com inicialização rápida no ChromeOS.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                onClick={handleInstallApp}
                className="px-3.5 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-black rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Instalar Agora</span>
              </button>
              <button
                onClick={() => setShowChromebookInstallBanner(false)}
                className="px-2.5 py-1.5 text-slate-400 hover:text-white text-xs rounded-xl cursor-pointer"
                title="Fechar recomendação"
              >
                Dispensar
              </button>
            </div>
          </div>
        )}
        
        {/* TAB 1: Chamada / Painel Principal */}
        {activeTab === 'chamada' && (
          <LovableDashboard
            onOpenFullRoster={() => setIsFullRosterOpen(true)}
            onOpenFullRosterModal={() => setIsFullRosterOpen(true)}
            onOpenProjectionScreen={handleOpenTelao}
            onOpenScanner={() => setIsScannerOpen(true)}
            onOpenQuickPicker={() => setIsQuickPickerOpen(true)}
            onOpenNewSession={() => setIsNewSessionOpen(true)}
            onOpenStudentCheckInModal={() => setIsStudentCheckinOpen(true)}
            onOpenProfessorLogin={() => setIsProfessorLoginOpen(true)}
            onNavigateToTab={handleTabChange}
          />
        )}

        {/* TAB 2: Relatórios & Diário Oficial (Excel .xlsx) */}
        {activeTab === 'relatorios' && (
          <ReportsView />
        )}

        {/* TAB 2.5: Controle de Notas Semestrais BMF4 */}
        {activeTab === 'notas' && (
          <GradesManagement />
        )}

        {/* TAB 4: Gestão Docente & Acadêmica (Professores, Alunos, Turmas, Atestados) */}
        {(activeTab === 'docentes' || activeTab === 'alunos' || activeTab === 'turmas') && (
          <div className="space-y-4 pb-24 pt-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-teal-600" />
                  Gestão de Docentes & Estrutura Acadêmica
                </h1>
                <p className="text-xs text-slate-500">
                  Gerenciamento de Professores, Alunos, Turmas e Atestados Médicos da disciplina
                </p>
              </div>

              {/* Subtabs: Professores / Alunos / Turmas / Atestados */}
              <div className="flex bg-slate-200/80 p-1 rounded-2xl gap-1 overflow-x-auto no-scrollbar">
                <button
                  id="subtab-docentes-professores"
                  onClick={() => setAcademicSubTab('docentes')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    academicSubTab === 'docentes'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Professores
                </button>

                <button
                  id="subtab-docentes-alunos"
                  onClick={() => setAcademicSubTab('alunos')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    academicSubTab === 'alunos'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  Alunos
                </button>

                <button
                  id="subtab-docentes-turmas"
                  onClick={() => setAcademicSubTab('turmas')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    academicSubTab === 'turmas'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  Turmas
                </button>

                <button
                  id="subtab-docentes-atestados"
                  onClick={() => setAcademicSubTab('justificativas')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    academicSubTab === 'justificativas'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  Atestados
                </button>
              </div>
            </div>

            {academicSubTab === 'docentes' && <ProfessorsManagement />}
            {academicSubTab === 'alunos' && <StudentsManagement />}
            {academicSubTab === 'turmas' && <ClassesManagement />}
            {academicSubTab === 'justificativas' && <JustificationsView />}
            {academicSubTab === 'ajustes' && <SettingsView />}
          </div>
        )}

        {/* TAB 5: Justificativas & Atestados Médicos */}
        {activeTab === 'justificativas' && (
          <JustificationsView />
        )}

        {/* TAB 6: Ajustes e Configurações do Sistema */}
        {activeTab === 'ajustes' && (
          <div className="space-y-4 pb-24 pt-1">
            <div className="flex items-center justify-between gap-3 px-1">
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  Ajustes & Configurações
                </h1>
                <p className="text-xs text-slate-500">
                  Parâmetros acadêmicos, critérios de presença, som e sincronização de BMF4
                </p>
              </div>
            </div>
            <SettingsView />
          </div>
        )}

      </main>

      {/* Bottom Navigation Dock */}
      <BottomNavigation
        activeTab={activeTab}
        setActiveTab={handleTabChange}
      />

      {/* Modals */}
      <FullRosterModal
        isOpen={isFullRosterOpen}
        onClose={() => setIsFullRosterOpen(false)}
      />

      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
      />

      <QuickPickerModal
        isOpen={isQuickPickerOpen}
        onClose={() => setIsQuickPickerOpen(false)}
      />

      {/* Regular New Session Modal */}
      <NewSessionModal
        isOpen={isNewSessionOpen}
        onClose={() => setIsNewSessionOpen(false)}
        onSessionStarted={(startedPeriod) => {
          if (startedPeriod) {
            setProjectionPeriod(startedPeriod);
          }
          setActiveTab('chamada');
          setIsNewSessionOpen(false);
        }}
      />

      {/* Telão Lesson Type Identification Modal */}
      <NewSessionModal
        isOpen={isTelaoConfigModalOpen}
        onClose={() => setIsTelaoConfigModalOpen(false)}
        isTelaoIntent={true}
        onSessionStarted={(startedPeriod) => {
          if (startedPeriod) {
            setProjectionPeriod(startedPeriod);
          }
          setIsTelaoConfigModalOpen(false);
          setIsProjectionOpen(true);
        }}
      />

      {/* Telão Confirmation Prompt when an active live session already exists */}
      {isTelaoActivePromptOpen && activeSession && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl max-w-md w-full p-6 text-white space-y-5 animate-in zoom-in-95">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-500/40 text-teal-300 flex items-center justify-center shrink-0 shadow-inner">
                  <Tv className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white">Modo Telão • Chamada Ativa</h3>
                  <p className="text-xs text-slate-400">Verifique os dados da aula antes de projetar</p>
                </div>
              </div>
              <button 
                onClick={() => setIsTelaoActivePromptOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Turma:</span>
                <span className="text-xs font-bold text-teal-300">
                  {classes.find(c => c.id === activeSession.classGroupId)?.name || 'Turma Selecionada'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Tipo de Aula:</span>
                <span className="text-xs font-bold text-white px-2.5 py-0.5 rounded-full bg-teal-500/20 border border-teal-500/40">
                  {getActivityTypeLabel(activeSession.activityType)}
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs text-slate-400 font-medium shrink-0">Tema da Aula:</span>
                <span className="text-xs font-bold text-slate-200 text-right">
                  {activeSession.topic || 'Aula BMF4'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Docente:</span>
                <span className="text-xs font-semibold text-slate-300">
                  {activeSession.professorName || 'Docente Responsável'}
                </span>
              </div>
              {activeSession.labLocation && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">Laboratório:</span>
                  <span className="text-xs font-semibold text-amber-300">
                    {activeSession.labLocation === 'anatomia' ? '🫀 Lab. Anatomia' : activeSession.labLocation === 'histologia' ? '🔬 Lab. Histologia' : '🫀🔬 Anato/Histo'}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2.5 pt-1">
              <button
                id="btn-telao-project-existing"
                type="button"
                onClick={() => {
                  setIsTelaoActivePromptOpen(false);
                  setIsProjectionOpen(true);
                }}
                className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all active:scale-98"
              >
                <Tv className="w-4 h-4 text-teal-200" />
                <span>Projetar Esta Aula no Telão</span>
              </button>

              <button
                id="btn-telao-start-different-type"
                type="button"
                onClick={() => {
                  setIsTelaoActivePromptOpen(false);
                  setIsTelaoConfigModalOpen(true);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Layers className="w-4 h-4 text-teal-400" />
                <span>Iniciar Outra Aula com Novo Tipo</span>
              </button>

              <button
                type="button"
                onClick={() => setIsTelaoActivePromptOpen(false)}
                className="w-full py-2 text-center text-xs text-slate-400 hover:text-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <StudentCheckInModal
        isOpen={isStudentCheckinOpen}
        onClose={() => setIsStudentCheckinOpen(false)}
        onCheckinSuccess={() => {
          setActiveTab('chamada');
          setIsStudentCheckinOpen(false);
        }}
      />

      <ProfessorLoginModal
        isOpen={isProfessorLoginOpen}
        onClose={() => setIsProfessorLoginOpen(false)}
        onNavigateToManagement={() => {
          setIsProfessorLoginOpen(false);
          setActiveTab('docentes');
          setAcademicSubTab('docentes');
        }}
      />

      <FirstAccessPinModal
        isOpen={isFirstAccessModalOpen}
        onClose={() => setIsFirstAccessModalOpen(false)}
      />



    </div>
  );
}

export default function App() {
  return (
    <LabProvider>
      <MainApp />
    </LabProvider>
  );
}
