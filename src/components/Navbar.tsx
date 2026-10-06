import React, { useState, useEffect, useMemo } from 'react';
import { 
  Tv, 
  FileText, 
  Volume2, 
  VolumeX, 
  CheckCircle2, 
  Clock,
  UserCheck,
  Award,
  FileCheck,
  ChevronDown,
  GraduationCap,
  Users,
  Settings,
  Sliders,
  LogOut,
  KeyRound,
  LogIn,
  Wifi,
  WifiOff,
  Database,
  HelpCircle
} from 'lucide-react';
import { useLab } from '../context/LabContext';
import { AppLogo } from './AppLogo';

export type ActiveTab = 
  | 'chamada' 
  | 'telao' 
  | 'alunos' 
  | 'turmas' 
  | 'docentes'
  | 'justificativas' 
  | 'relatorios'
  | 'notas'
  | 'ajustes';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenCheckinModal?: () => void;
  onOpenNewSessionModal?: () => void;
  onOpenQuickPickerModal?: () => void;
  onOpenProfessorLogin?: () => void;
  onOpenGoogleCalendar?: () => void;
  onOpenGoogleForms?: () => void;
  onOpenTour?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenProfessorLogin,
  onOpenGoogleCalendar,
  onOpenGoogleForms,
  onOpenTour,
}) => {
  const { 
    classes,
    selectedClassId,
    setSelectedClassId,
    soundEnabled, 
    setSoundEnabled,
    justifications,
    activeProfessor,
    logoutProfessor,
    playBeep,
    isOnline,
    realtimeConnected,
    isSyncing,
    outboxPendingCount
  } = useLab();

  // Digital clock with seconds updated each second
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = String(time.getHours()).padStart(2, '0');
  const minutes = String(time.getMinutes()).padStart(2, '0');
  const seconds = String(time.getSeconds()).padStart(2, '0');
  const formattedTime = `${hours}:${minutes}:${seconds}`;
  const dateStr = time.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const formatClassName = (name: string) => {
    if (!name) return '';
    return name.trim().toUpperCase();
  };

  const pendingJustifications = justifications.filter(j => j.status === 'pending').length;

  // Supabase Realtime Connection Indicator state determination
  const connectionState = useMemo(() => {
    if (!isOnline) {
      return {
        label: outboxPendingCount > 0 ? `Offline (${outboxPendingCount})` : 'Offline',
        dotColor: 'bg-rose-500 animate-bounce',
        badgeBg: 'border-rose-400',
        title: outboxPendingCount > 0 ? `Dispositivo sem internet. ${outboxPendingCount} marcações pendentes na fila Outbox.` : 'Dispositivo offline.'
      };
    }
    if (isSyncing) {
      return {
        label: 'Sincronizando...',
        dotColor: 'bg-amber-400 animate-spin',
        badgeBg: 'border-amber-400',
        title: 'Sincronizando dados em tempo real com o Supabase.'
      };
    }
    if (realtimeConnected) {
      return {
        label: 'Supabase Online (Tempo Real)',
        dotColor: 'bg-emerald-400 animate-pulse',
        badgeBg: 'border-emerald-400',
        title: 'Conectado em tempo real com o Supabase e WebSocket.'
      };
    }
    return {
      label: outboxPendingCount > 0 ? `Supabase Conectado (${outboxPendingCount} pendentes)` : 'Supabase Conectado',
      dotColor: 'bg-teal-400 animate-pulse',
      badgeBg: 'border-teal-400',
      title: 'Conectado ao servidor e banco de dados Supabase.'
    };
  }, [isOnline, realtimeConnected, isSyncing, outboxPendingCount]);

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-md backdrop-blur-md">
      <div className="w-full max-w-[1920px] mx-auto px-2 sm:px-4 lg:px-6">
        
        {/* ========================================================================= */}
        {/* LINE 1: Logo, Live Clock, Connection Dot & Controls                       */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-between min-h-[52px] sm:min-h-[62px] py-2 gap-2 sm:gap-4 border-b border-slate-800/80">
          
          {/* Left: Modern App Brand */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button 
              onClick={() => setActiveTab('chamada')} 
              className="flex items-center gap-1.5 sm:gap-2 text-left group cursor-pointer focus:outline-none shrink-0"
              title="Voltar para a Chamada Principal"
            >
              <AppLogo size="sm" className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl shadow-xs shrink-0 transition-transform group-hover:scale-105" />
              
              <div className="flex items-center gap-1 sm:gap-1.5 leading-none">
                <span className="font-black text-xs sm:text-sm md:text-base tracking-tight text-white group-hover:text-teal-300 transition-colors">
                  MEDICINA
                </span>
                <span className="text-teal-500 font-black text-xs">•</span>
                <span className="font-extrabold text-xs sm:text-sm md:text-base tracking-wide text-teal-400">
                  BMF4
                </span>
              </div>
            </button>
          </div>

          {/* Center Group: Live Clock Badge + Supabase Realtime Connection Indicator Dot */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Live Clock & Date Badge (Datador preservado e nunca excluído) */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 rounded-xl bg-slate-800/95 border border-slate-700/80 text-[11px] sm:text-xs text-slate-200 shadow-inner shrink-0">
              <div className="flex items-center gap-1 font-mono font-bold text-teal-300">
                <Clock className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span>{formattedTime}</span>
              </div>
              <span className="text-slate-500 font-bold">•</span>
              <div className="flex items-center gap-1 font-medium text-slate-300">
                <span>{dateStr}</span>
              </div>
            </div>

            {/* Supabase Realtime Connection Indicator (Compact Dot Only with Tooltip) */}
            <div 
              className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full border-2 shadow-sm shrink-0 cursor-help ${connectionState.dotColor} ${connectionState.badgeBg}`}
              title={connectionState.label}
            />
          </div>

          {/* Right: Controls (Ajustes, Som - Desktop only in Line 1) */}
          <div className="hidden md:flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Ajustes Button */}
            <button
              id="btn-navbar-ajustes"
              onClick={() => {
                setActiveTab('ajustes');
                playBeep('confirm');
              }}
              title="Ajustes e Configurações do Sistema"
              className={`h-7 sm:h-8 px-2 sm:px-2.5 rounded-xl transition-all border cursor-pointer shrink-0 flex items-center justify-center gap-1 text-xs shadow-2xs ${
                activeTab === 'ajustes'
                  ? 'bg-teal-500 text-slate-950 border-teal-400 font-black ring-2 ring-teal-400/40 shadow-xs'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700 font-semibold'
              }`}
            >
              <Settings className={`w-3.5 h-3.5 ${activeTab === 'ajustes' ? 'rotate-45 text-slate-950' : 'text-slate-200'} transition-transform shrink-0`} />
              <span className="hidden md:inline font-bold">Ajustes</span>
            </button>

            {/* Tour / Ajuda Button */}
            {onOpenTour && (
              <button
                onClick={onOpenTour}
                className="h-7 sm:h-8 px-2.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-400/40 text-teal-200 text-xs font-bold transition-all cursor-pointer shadow-2xs shrink-0 flex items-center justify-center gap-1 active:scale-95"
                title="Tour Guiado do Sistema"
              >
                <HelpCircle className="w-3.5 h-3.5 text-teal-300" />
                <span className="hidden md:inline font-bold">Tour</span>
              </button>
            )}

            {/* Sound Toggle Button */}
            <button
              id="btn-navbar-toggle-som"
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                if (next) playBeep('success');
              }}
              title={soundEnabled ? 'Som Ligado (Clique para silenciar)' : 'Silencioso (Clique para ativar áudio)'}
              className={`h-7 sm:h-8 px-2 sm:px-2.5 rounded-xl transition-all border cursor-pointer shrink-0 shadow-2xs flex items-center justify-center gap-1.5 ${
                soundEnabled
                  ? 'bg-teal-950/70 hover:bg-teal-900/80 text-teal-300 border-teal-500/70 ring-1 ring-teal-500/40'
                  : 'bg-slate-800/90 hover:bg-slate-700/90 text-slate-400 hover:text-slate-200 border-slate-700'
              }`}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-teal-300 shrink-0" />
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse shrink-0" />
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* LINE 2 (Desktop & Tablets md+): Navigation Tabs, Professor & Sair        */}
        {/* ========================================================================= */}
        <div className="hidden md:flex items-center justify-between py-1.5 gap-2 border-t border-slate-800/40">
          
          {/* Main Navigation Tabs */}
          <nav className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar flex-1 min-w-0">
            {/* 1. Chamada */}
            <button
              id="nav-desktop-chamada"
              onClick={() => setActiveTab('chamada')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'chamada'
                  ? 'bg-teal-500 text-slate-950 font-black shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800 bg-slate-800/40 border border-slate-700/60'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Chamada</span>
            </button>

            {/* 2. Notas */}
            <button
              id="nav-desktop-notas"
              onClick={() => setActiveTab('notas')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'notas'
                  ? 'bg-teal-500 text-slate-950 font-black shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800 bg-slate-800/40 border border-slate-700/60'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Notas & Avaliação</span>
            </button>

            {/* 3. Relatórios */}
            <button
              id="nav-desktop-relatorios"
              onClick={() => setActiveTab('relatorios')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'relatorios'
                  ? 'bg-teal-500 text-slate-950 font-black shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800 bg-slate-800/40 border border-slate-700/60'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Relatórios & Frequência</span>
            </button>

            {/* 4. Telão / Projeção */}
            <button
              id="nav-desktop-telao"
              onClick={() => setActiveTab('telao')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'telao'
                  ? 'bg-teal-500 text-slate-950 font-black shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800 bg-slate-800/40 border border-slate-700/60'
              }`}
              title="Abrir Projeção / Telão na Smart TV ou Projetor"
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Modo Telão</span>
            </button>

            {/* 5. Gestão Docente */}
            <button
              id="nav-desktop-docentes"
              onClick={() => setActiveTab('docentes')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'docentes' || activeTab === 'alunos' || activeTab === 'turmas' || activeTab === 'justificativas'
                  ? 'bg-teal-500 text-slate-950 font-black shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800 bg-slate-800/40 border border-slate-700/60'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Gestão Docente & Turmas</span>
              {pendingJustifications > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-amber-500 text-slate-950 text-[10px] font-black rounded-full">
                  {pendingJustifications}
                </span>
              )}
            </button>
          </nav>

          {/* Right side of Line 2: Turmas Selector (PC) + Professor Profile + Sair Button */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Turmas Selector (Modo PC) */}
            <div className="relative flex items-center bg-slate-800/90 hover:bg-slate-800 border border-slate-700 hover:border-teal-500/60 rounded-xl px-2.5 py-1 text-xs text-slate-200 transition-all shadow-2xs">
              <GraduationCap className="w-3.5 h-3.5 text-teal-400 shrink-0 mr-1.5" />
              <select
                id="select-class-desktop-header"
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value);
                  playBeep('confirm');
                }}
                className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer appearance-none pr-5 leading-tight truncate max-w-[180px] lg:max-w-[260px]"
                title="Selecionar Turma Ativa"
              >
                {classes.map(cls => (
                  <option key={cls.id} value={cls.id} className="bg-slate-900 text-white font-bold text-xs">
                    {formatClassName(cls.name)}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-teal-400 pointer-events-none absolute right-2" />
            </div>

            {activeProfessor ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={onOpenProfessorLogin}
                  title={`Docente: ${activeProfessor.name}. Clique para alternar perfil.`}
                  className="flex items-center gap-1.5 bg-slate-800/90 hover:bg-slate-800 border border-slate-700 hover:border-teal-500/50 rounded-xl px-2.5 py-1 text-xs text-slate-200 transition-all active:scale-95 cursor-pointer shadow-2xs"
                >
                  <div className="w-5 h-5 rounded-lg bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center font-bold text-[10px] shadow-xs shrink-0">
                    {activeProfessor.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col text-left leading-tight">
                    <span className="text-[7.5px] text-teal-400 font-black uppercase tracking-wider leading-none">
                      Professor
                    </span>
                    <span className="font-bold text-white text-xs truncate max-w-[110px] lg:max-w-[160px]">
                      {activeProfessor.name}
                    </span>
                  </div>
                </button>

                <button
                  id="btn-navbar-logout-desktop"
                  onClick={() => {
                    logoutProfessor();
                  }}
                  title="Sair (Encerrar sessão do docente)"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 hover:border-rose-500 text-rose-300 hover:text-rose-100 text-xs font-bold transition-all cursor-pointer shadow-2xs shrink-0 active:scale-95"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-400" />
                  <span>Sair</span>
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenProfessorLogin}
                title="Entrar com E-mail e Senha / PIN do Professor"
                className="flex items-center gap-1.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Login Docente</span>
              </button>
            )}
          </div>

        </div>

        {/* ========================================================================= */}
        {/* LINE 2 (Mobile Phones): Compact Professor + Turma Selector + Quick Actions*/}
        {/* ========================================================================= */}
        <div className="md:hidden flex items-center justify-between py-2 px-1 gap-2 border-t border-slate-800/70 overflow-x-auto">
          
          {/* Active Professor Profile / Login (Mobile Compact) */}
          {activeProfessor ? (
            <button
              onClick={onOpenProfessorLogin}
              title={`Docente: ${activeProfessor.name}. Clique para trocar de login.`}
              className="flex items-center gap-1.5 bg-slate-800/95 hover:bg-slate-800 border border-slate-700/80 rounded-xl px-2 py-1.5 max-w-[120px] text-left transition-all active:scale-95 cursor-pointer shadow-2xs shrink-0"
            >
              <div className="w-5 h-5 rounded-lg bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center font-bold text-[10px] shadow-xs shrink-0">
                {activeProfessor.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0 leading-tight">
                <span className="text-[7px] uppercase tracking-wider font-black text-teal-400">
                  Professor
                </span>
                <span className="font-bold text-white text-[11px] truncate max-w-[75px]">
                  {activeProfessor.name.split(' ')[0]}
                </span>
              </div>
            </button>
          ) : (
            <button
              onClick={onOpenProfessorLogin}
              className="flex items-center gap-1.5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-bold text-xs px-2.5 py-1.5 rounded-xl shrink-0 shadow-xs"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Login</span>
            </button>
          )}

          {/* Turma Selector (Compact Dropdown Menu on Mobile) */}
          <div className="flex items-center gap-1.5 bg-slate-800/95 border border-slate-700/80 rounded-xl px-2.5 py-1.5 flex-1 min-w-[100px] shadow-2xs">
            <GraduationCap className="w-4 h-4 text-teal-400 shrink-0" />
            <select
              id="select-class-mobile-header"
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
                playBeep('confirm');
              }}
              className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer appearance-none w-full truncate pr-1"
              title="Selecionar Turma Ativa"
            >
              {classes.map(cls => (
                <option key={cls.id} value={cls.id} className="bg-slate-900 text-white text-xs">
                  {formatClassName(cls.name)}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none shrink-0" />
          </div>

          {/* Mobile Quick Action Buttons (Ajustes, Tour, Som, Sair) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Ajustes Button */}
            <button
              onClick={() => {
                setActiveTab('ajustes');
                playBeep('confirm');
              }}
              title="Ajustes"
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                activeTab === 'ajustes'
                  ? 'bg-teal-500 text-slate-950 border-teal-400 font-bold'
                  : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Tour Button */}
            {onOpenTour && (
              <button
                onClick={onOpenTour}
                title="Tour Guiado"
                className="p-2 rounded-xl bg-teal-500/20 border border-teal-400/40 text-teal-200 hover:bg-teal-500/30 transition-all cursor-pointer"
              >
                <HelpCircle className="w-4 h-4 text-teal-300" />
              </button>
            )}

            {/* Sound Toggle Button */}
            <button
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                if (next) playBeep('success');
              }}
              title={soundEnabled ? 'Som Ligado' : 'Silencioso'}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                soundEnabled
                  ? 'bg-teal-950/80 text-teal-300 border-teal-500/70'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-teal-300" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            </button>

            {/* Sair Button */}
            {activeProfessor && (
              <button
                id="btn-navbar-logout-mobile"
                onClick={() => {
                  logoutProfessor();
                  playBeep('confirm');
                }}
                title="Sair"
                className="p-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 text-rose-300 hover:text-white transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
              </button>
            )}
          </div>
        </div>

      </div>
    </header>
  );
};
