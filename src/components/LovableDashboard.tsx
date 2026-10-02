import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Tv, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Sparkles, 
  RotateCcw, 
  Search, 
  Lock, 
  ShieldCheck, 
  Check, 
  UserPlus, 
  QrCode, 
  Layers, 
  Eye, 
  ChevronRight,
  ChevronDown,
  Stethoscope,
  RefreshCw,
  ExternalLink,
  BookOpen,
  Calendar,
  Award,
  Zap,
  Filter,
  CheckCheck,
  Mail,
  Cast,
  Send,
  Camera,
  Monitor,
  Smartphone,
  MessageSquare,
  MessageCircle,
  Globe,
  Info,
  FileCheck,
  Paperclip,
  UploadCloud,
  File,
  X,
  KeyRound,
  ArrowRight,
  GraduationCap,
  Plus
} from 'lucide-react';
import { useLab, sortClassesAlphabetically } from '../context/LabContext';
import { Student, AttendanceStatus, ClassPeriod, getActivityTypeLabel } from '../types';
import { StudentAvatar } from './StudentAvatar';
import { QRCodeDisplay } from './QRCodeDisplay';
import { AppLogo } from './AppLogo';
import { TeacherConflictAlert } from './TeacherConflictAlert';
import { getPublicTelaoUrl, getPublicStudentCheckinUrl } from '../utils/publicUrl';

interface LovableDashboardProps {
  onOpenProjectionScreen: (period?: ClassPeriod) => void;
  onOpenQuickPicker: () => void;
  onOpenNewSession?: () => void;
  onOpenStudentCheckInModal?: () => void;
  onOpenFullRosterModal?: () => void;
  onOpenFullRoster?: () => void;
  onOpenScanner?: () => void;
  onOpenProfessorLogin?: () => void;
  onNavigateToTab?: (tab: 'chamada' | 'telao' | 'alunos' | 'turmas' | 'docentes' | 'justificativas' | 'relatorios' | 'notas') => void;
}

export const LovableDashboard: React.FC<LovableDashboardProps> = ({
  onOpenProjectionScreen,
  onOpenQuickPicker,
  onOpenNewSession,
  onOpenStudentCheckInModal,
  onOpenFullRosterModal,
  onOpenFullRoster,
  onOpenScanner,
  onOpenProfessorLogin,
  onNavigateToTab,
}) => {
  const { 
    classes, 
    selectedClassId, 
    setSelectedClassId, 
    students, 
    activeSession,
    startNewSession, 
    setAttendanceStatus, 
    markAllPresent, 
    resetCurrentAttendance,
    toggleLiveSession,
    pauseLiveSession,
    resumeLiveSession,
    reopenCurrentSession,
    lockCurrentSession,
    lockPeriod1,
    lockPeriod2,
    setActivePeriod,
    dynamicToken,
    dynamicSecondsLeft,
    dynamicCycleNumber,
    lastEmailDispatch,
    triggerManualEmailDispatch,
    activeProfessor,
    appSettings,
    justifications,
    submitJustification,
    playBeep,
    sessions
  } = useLab();

  // Search and Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | 'all'>('all');
  const [qrActiveTab, setQrActiveTab] = useState<'dynamic' | 'tv'>('dynamic');
  const [emailContentType, setEmailContentType] = useState<'telao' | 'resumo'>('telao');
  const [emailRecipient, setEmailRecipient] = useState('');
  const [isTriggeringEmail, setIsTriggeringEmail] = useState(false);
  const [actionSuccessToast, setActionSuccessToast] = useState<string | null>(null);
  const [confirmLockModalOpen, setConfirmLockModalOpen] = useState(false);

  // Quick Justification Modal State
  const [justifyModalStudent, setJustifyModalStudent] = useState<Student | null>(null);
  const [justifyReasonCategory, setJustifyReasonCategory] = useState<'medical' | 'academic' | 'transport' | 'work' | 'other'>('medical');
  const [justifyDocNumber, setJustifyDocNumber] = useState('');
  const [justifyDescription, setJustifyDescription] = useState('Atestado médico apresentado / Ausência justificada');
  const [justifyPeriod, setJustifyPeriod] = useState<ClassPeriod>('both');
  const [justifyAttachmentName, setJustifyAttachmentName] = useState<string>('');
  const [justifyAttachmentUrl, setJustifyAttachmentUrl] = useState<string>('');

  const selectedClass = classes.find(c => c.id === selectedClassId) || classes[0];

  // Students of selected class, strictly sorted alphabetically A-Z
  const classStudents = useMemo(() => {
    return students
      .filter(s => s.classGroupId === selectedClassId)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' }));
  }, [students, selectedClassId]);

  // Current session parameters
  const isLocked = Boolean(activeSession && activeSession.isLocked);
  const isPaused = Boolean(activeSession && !activeSession.isLocked && (activeSession.isPaused || !activeSession.isLive));
  const isLive = Boolean(activeSession && activeSession.isLive && !activeSession.isLocked && !activeSession.isPaused);
  const currentPeriod: ClassPeriod = activeSession?.activePeriod || '1';
  const isP1Locked = Boolean(activeSession?.isPeriod1Locked);
  const isP2Locked = Boolean(activeSession?.isPeriod2Locked);

  // Overall attendance metrics
  const stats = useMemo(() => {
    if (!activeSession) {
      return { total: classStudents.length, present: 0, absent: classStudents.length, late: 0, excused: 0, rate: 0 };
    }

    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;

    classStudents.forEach(st => {
      const rec = activeSession.attendance?.[st.id];
      const status = rec?.status || 'absent';
      if (status === 'present') present++;
      else if (status === 'late') late++;
      else if (status === 'excused') excused++;
      else absent++;
    });

    const total = classStudents.length;
    const attended = present + late + excused;
    const rate = total > 0 ? Math.round((attended / total) * 100) : 0;

    return { total, present, absent, late, excused, rate };
  }, [activeSession, classStudents]);

  // Filtered student list (Search + Status Filter), sorted A-Z
  const displayedStudents = useMemo(() => {
    return classStudents.filter(st => {
      const matchesSearch = 
        st.name.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        st.registrationNumber.toLowerCase().includes(searchTerm.toLowerCase().trim());

      if (!matchesSearch) return false;

      if (statusFilter !== 'all') {
        const status = activeSession?.attendance?.[st.id]?.status || 'absent';
        if (status !== statusFilter) return false;
      }

      return true;
    });
  }, [classStudents, searchTerm, statusFilter, activeSession]);

  const showToast = (msg: string) => {
    setActionSuccessToast(msg);
    setTimeout(() => {
      setActionSuccessToast(null);
    }, 3500);
  };

  const studentCheckinUrl = getPublicStudentCheckinUrl(
    dynamicToken || 'AUTO', 
    selectedClassId, 
    'checkin',
    currentPeriod,
    activeSession?.id
  );
  const tvScreenUrl = getPublicTelaoUrl(selectedClassId, currentPeriod, activeSession?.id);

  const handleOpenTvInNewTab = () => {
    window.open(tvScreenUrl, '_blank', 'noopener,noreferrer');
  };

  // Unified Email Content Generator for Dynamic QR Code and Attendance Summary
  const emailSubjects = {
    telao: `[BMF4 Medicina] Link do Telão da Chamada (QR Code) - Turma ${selectedClass?.name || 'BMF4'}`,
    resumo: `[BMF4 Medicina] Resumo de Presença - Turma ${selectedClass?.name || 'BMF4'} (${activeSession?.date || new Date().toLocaleDateString('pt-BR')})`
  };

  const emailBodies = {
    telao: `Prezado(a) Professor(a) / Suporte do Laboratório,\n\nSegue o link direto para abrir o Telão com QR Code Dinâmico em tela cheia (Smart TV / Projetor / Computador da Sala):\n\n📺 LINK DIRETO DO TELÃO (Abre sem pedir login):\n${tvScreenUrl}\n\n📱 LINK DE CHECK-IN DO ALUNO (Portal Seguro):\n${studentCheckinUrl}\n\n• Turma: ${selectedClass?.name || 'BMF4'}\n• Disciplina: ${activeSession?.topic || selectedClass?.discipline || 'Bases Morfofuncionais 4'}\n• Data: ${activeSession?.date || new Date().toLocaleDateString('pt-BR')}\n• Docente: ${activeSession?.professorName || activeProfessor?.name || 'Docente'}\n• Código/Token: ${dynamicToken || activeSession?.checkinCode || 'BMF-MED'}\n\n💡 Instruções Rápidas:\n1. Acesse o link do telão no navegador da TV ou PC conectado ao projetor.\n2. O QR Code dinâmico será exibido em tela cheia com rotação automática.\n3. O aluno pode ler o código com a câmera do celular para confirmar presença.\n\nUniversidade Nove de Julho - Medicina BMF4.`,
    
    resumo: `Prezado(a) Professor(a) ${activeSession?.professorName || activeProfessor?.name || 'Docente'},\n\nResumo da Sessão de Chamada - Bases Morfofuncionais 4 (Medicina):\n\n📊 DADOS DE FREQUÊNCIA:\n• Turma: ${selectedClass?.name || 'BMF4'}\n• Disciplina: ${activeSession?.topic || selectedClass?.discipline || 'Bases Morfofuncionais 4'}\n• Data: ${activeSession?.date || new Date().toLocaleDateString('pt-BR')}\n• Total de Alunos: ${classStudents.length}\n• Presentes: ${stats.present} (${stats.rate}%)\n• Ausentes: ${stats.absent}\n• Justificados / Atestados: ${stats.excused}\n• Token da Sessão: ${dynamicToken || activeSession?.checkinCode || 'BMF-MED'}\n\n🔗 LINKS DE ACESSO:\n• Link do Telão (TV/Projetor): ${tvScreenUrl}\n• Link do Aluno: ${studentCheckinUrl}\n\nRegistro emitido pelo Sistema de Presença BMF4 Medicina - UNINOVE.`
  };

  const activeEmailSubject = emailSubjects[emailContentType];
  const activeEmailBody = emailBodies[emailContentType];

  const handleTriggerDirectEmail = async () => {
    setIsTriggeringEmail(true);
    try {
      await triggerManualEmailDispatch();
      showToast('QR Code enviado automaticamente para chamadabmf4@gmail.com!');
      playBeep('success');
    } catch {
      showToast('Erro ao disparar e-mail. Tentando via cliente local...');
      handleOpenEmailApp();
    } finally {
      setIsTriggeringEmail(false);
    }
  };

  const handleOpenEmailApp = () => {
    const targetEmail = emailRecipient.trim() || activeProfessor?.email || '';
    const mailtoUrl = `mailto:${encodeURIComponent(targetEmail)}?subject=${encodeURIComponent(activeEmailSubject)}&body=${encodeURIComponent(activeEmailBody)}`;
    window.location.href = mailtoUrl;
    showToast(`Abrindo cliente de e-mail (${targetEmail || 'destinatário'})...`);
  };

  // Chromecast & Google Cast Trigger
  const handleStartCast = async () => {
    try {
      if ('presentation' in navigator && (navigator as any).presentation?.defaultRequest) {
        await (navigator as any).presentation.defaultRequest.start();
        showToast('Iniciando transmissão para Chromecast...');
      } else {
        alert('Para transmitir no Google Chrome / Edge:\n\n1. Clique no menu do navegador (3 pontinhos no canto superior direito).\n2. Selecione "Transmitir..." (Cast).\n3. Escolha o Chromecast ou Smart TV da sala de aula.');
        showToast('Use o menu Transmitir (Cast) do Chrome');
      }
    } catch {
      alert('Para transmitir no Google Chrome / Edge:\n\n1. Clique no menu do navegador (3 pontinhos no canto superior direito).\n2. Selecione "Transmitir..." (Cast).\n3. Escolha o Chromecast ou Smart TV da sala de aula.');
      showToast('Use o menu Transmitir (Cast) do Chrome');
    }
  };

  const handleConfirmLockSession = () => {
    lockCurrentSession(activeSession?.id, selectedClassId);
    setConfirmLockModalOpen(false);
    showToast('Chamada encerrada e bloqueada com sucesso.');
    playBeep('alert');
  };

  return (
    <div className="space-y-5 max-w-full pb-16 sm:pb-8">
      


      {/* Toast Notification */}
      {actionSuccessToast && (
        <div className="p-3.5 rounded-2xl bg-emerald-500 text-white text-xs font-bold flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-2 z-30">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
            <span>{actionSuccessToast}</span>
          </div>
          <button onClick={() => setActionSuccessToast(null)} className="text-white hover:text-emerald-100 cursor-pointer">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Simultaneous Teacher Conflict Alert Banner */}
      <TeacherConflictAlert />

      {/* Live Session in Another Class Banner */}
      {(() => {
        const anyOtherLiveSession = sessions.find(s => s && s.isLive && !s.isLocked && s.classGroupId !== selectedClassId);
        const otherLiveClass = anyOtherLiveSession ? classes.find(c => c.id === anyOtherLiveSession.classGroupId) : null;
        if (!anyOtherLiveSession || !otherLiveClass) return null;
        return (
          <div className="bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 text-white rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in border border-teal-400/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/25 backdrop-blur-xs flex items-center justify-center font-black text-lg shrink-0 shadow-inner">
                ⚡
              </div>
              <div>
                <h4 className="font-black text-sm sm:text-base text-white">Aula ao Vivo em Andamento na {otherLiveClass.name.toUpperCase()}!</h4>
                <p className="text-xs text-teal-100 font-medium">Tema: {anyOtherLiveSession.topic || 'Aula Prática'} • Alterne para gerenciar o check-in e a chamada instantaneamente.</p>
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedClassId(otherLiveClass.id);
                playBeep('confirm');
              }}
              className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-white hover:bg-teal-50 text-teal-950 font-black text-xs transition-all active:scale-95 cursor-pointer shadow-lg shrink-0 flex items-center justify-center gap-1.5"
            >
              <span>Alternar para {otherLiveClass.name.toUpperCase()}</span>
            </button>
          </div>
        );
      })()}

      {/* Logged Out / Guest Mode Banner */}
      {!activeProfessor && (
        <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white rounded-3xl p-3.5 sm:px-5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs border border-teal-800/50 animate-in fade-in">
          <div className="flex items-center gap-3 text-xs">
            <div className="w-8 h-8 rounded-xl bg-teal-600/30 border border-teal-500/50 flex items-center justify-center text-teal-400 shrink-0">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-white block">Modo Visitante / Aluno</span>
              <span className="text-slate-300 text-[11px]">
                Faça login como <strong>Professor</strong> com seu e-mail institucional e PIN para gerenciar chamadas e diários.
              </span>
            </div>
          </div>
          <button
            onClick={onOpenProfessorLogin}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs transition-all active:scale-95 cursor-pointer shrink-0 shadow-xs flex items-center justify-center gap-1.5"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Fazer Login Docente</span>
          </button>
        </div>
      )}

      {/* 1. Header Bar: Minimalist Session Command Bar (Clean Layout) */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/90 shadow-2xs space-y-4">
        
        {/* Middle: Title of Class */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest">
              TÍTULO DA AULA
            </span>
            {activeSession?.activityType && (
              <span className="px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 text-[10px] sm:text-xs font-bold flex items-center gap-1">
                <Layers className="w-3 h-3 text-teal-600" />
                <span>{getActivityTypeLabel(activeSession.activityType)}</span>
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {activeSession?.topic || 'Sistema Nervoso'}
          </h2>
        </div>

        {/* Docente and Location / Discipline row */}
        <div className="flex items-center justify-between gap-3 pt-0.5 border-b border-slate-100 pb-3.5">
          <div className="text-xs sm:text-sm font-medium text-slate-600">
            <span>Docente: </span>
            <strong className="text-slate-900 font-bold">
              {activeSession?.professorName || activeProfessor?.name || selectedClass?.professorName || 'Guilherme Cottomaci'}
            </strong>
          </div>

          {/* Laboratory / Location Tag */}
          <div className="px-3 py-1 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm border border-slate-200/80 shrink-0">
            {activeSession?.labLocation === 'histologia' ? 'Histologia' : activeSession?.labLocation === 'ambos' ? 'Anato/Histo' : 'Anatomia'}
          </div>
        </div>

        {/* Action Row: Status + Primary Lifecycle Button + Ler RA + Telão */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          
          {/* Status Pill */}
          <div className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-1.5 ${
            isLocked 
              ? 'bg-rose-50 text-rose-700 border border-rose-200'
              : isLive 
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : isPaused
              ? 'bg-amber-50 text-amber-800 border border-amber-200'
              : 'bg-slate-100 text-slate-600 border border-slate-200'
          }`}>
            {isLocked ? (
              <>
                <Lock className="w-3.5 h-3.5 text-rose-600" />
                <span>Encerrada</span>
              </>
            ) : isLive ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>Ao Vivo</span>
              </>
            ) : isPaused ? (
              <>
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Pausada</span>
              </>
            ) : (
              <>
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Fechada</span>
              </>
            )}
          </div>

          {/* When Locked: Reopen button & Nova Aula button */}
          {isLocked && (
            <div className="flex items-center gap-2">
              <button
                id="btn-reopen-locked-call"
                onClick={() => reopenCurrentSession(activeSession?.id, selectedClassId)}
                title="Reabrir chamada encerrada para esta turma"
                className="px-4 py-2.5 rounded-2xl bg-teal-700 hover:bg-teal-800 text-white shadow-2xs text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reabrir Chamada</span>
              </button>
              <button
                id="btn-start-new-session-after-lock"
                onClick={() => {
                  if (onOpenNewSession) {
                    onOpenNewSession();
                  } else {
                    startNewSession({
                      classGroupId: selectedClassId,
                      topic: 'Aula BMF4 - Morfofuncional',
                      activityCategory: 'pratica',
                      activityType: 'aula_pratica',
                      activePeriod: '1'
                    });
                    showToast('Nova aula iniciada com sucesso!');
                    playBeep('session_start');
                  }
                }}
                title="Configurar e iniciar uma nova aula para esta turma"
                className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white shadow-2xs text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-teal-400" />
                <span>Nova Aula</span>
              </button>
            </div>
          )}

          {/* When Live: Pause and Encerrar */}
          {isLive && (
            <div className="flex items-center gap-2">
              <button
                id="btn-pause-live-call"
                onClick={() => pauseLiveSession(activeSession?.id, selectedClassId)}
                title="Pausar temporariamente a chamada"
                className="px-4 py-2.5 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Pausar</span>
              </button>
              <button
                id="btn-encerrar-chamada-active"
                onClick={() => setConfirmLockModalOpen(true)}
                title="Encerrar a chamada e bloquear novos check-ins"
                className="px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Encerrar</span>
              </button>
            </div>
          )}

          {/* When Paused: Resume and Encerrar */}
          {isPaused && (
            <div className="flex items-center gap-2">
              <button
                id="btn-resume-live-call"
                onClick={() => resumeLiveSession(activeSession?.id, selectedClassId)}
                title="Retomar chamada"
                className="px-5 py-2.5 rounded-2xl bg-teal-700 hover:bg-teal-800 text-white shadow-2xs text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Retomar</span>
              </button>
              <button
                id="btn-encerrar-chamada-active"
                onClick={() => setConfirmLockModalOpen(true)}
                title="Encerrar a chamada"
                className="px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Encerrar</span>
              </button>
            </div>
          )}

          {/* When No Active Live/Locked Session: Open or Start New */}
          {!isLocked && !isLive && !isPaused && (
            <div className="flex items-center gap-2">
              <button
                id="btn-start-fresh-session"
                onClick={() => {
                  if (onOpenNewSession) {
                    onOpenNewSession();
                  } else {
                    startNewSession({
                      classGroupId: selectedClassId,
                      topic: 'Aula BMF4 - Morfofuncional',
                      activityCategory: 'pratica',
                      activityType: 'aula_pratica',
                      activePeriod: '1'
                    });
                    showToast('Chamada iniciada com sucesso!');
                    playBeep('session_start');
                  }
                }}
                title="Configurar detalhes e abrir nova aula / chamada"
                className="px-4 py-2.5 rounded-2xl bg-teal-700 hover:bg-teal-800 text-white shadow-2xs text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-teal-200" />
                <span>Configurar & Abrir Nova Aula</span>
              </button>
            </div>
          )}

          {/* Scanner RA Button */}
          {onOpenScanner && (
            <button
              id="btn-open-scanner-top"
              onClick={onOpenScanner}
              className="px-4 py-2.5 rounded-2xl bg-rose-50/90 hover:bg-rose-100 text-rose-800 text-xs sm:text-sm font-bold border border-rose-200/80 transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-2xs"
              title="Ler RA pelo leitor de câmera"
            >
              <Camera className="w-3.5 h-3.5 text-rose-700" />
              <span>Ler RA</span>
            </button>
          )}

          {/* Telão Projection */}
          <button
            id="btn-open-telao-projection"
            onClick={() => onOpenProjectionScreen(currentPeriod)}
            className="px-5 py-2.5 rounded-2xl bg-slate-950 hover:bg-slate-900 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-2xs"
            title="Abrir modo Telão em tela cheia"
          >
            <Tv className="w-3.5 h-3.5 text-teal-400" />
            <span>Telão</span>
          </button>
        </div>


        {/* Bottom Row: Checkpoints / Periods Switcher & Quick Batch Tools */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-0.5">
          
          {/* Period Stages Selector */}
          {activeSession?.activityCategory === 'atividade' || activeSession?.activityType?.startsWith('atividade') || activeSession?.activityType === 'prova_pratica' || activeSession?.activityType === 'prova_teorica' ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-800">
              <span className="px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 font-extrabold flex items-center gap-2 shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                <span>Chamada Integral {activeSession?.activityType?.startsWith('atividade') ? `(${getActivityTypeLabel(activeSession.activityType)})` : 'da Atividade'}</span>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar p-1 bg-slate-100 rounded-xl text-xs font-bold">
              <button
                id="btn-period-1"
                onClick={() => setActivePeriod('1')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  currentPeriod === '1' || currentPeriod === 'p1_start' || currentPeriod === 'p1_end'
                    ? 'bg-teal-600 text-white shadow-2xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
                title="1ª Aula - Chamada da primeira aula"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-300"></span>
                <span>1ª Aula</span>
              </button>

              <button
                id="btn-period-2"
                onClick={() => setActivePeriod('2')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  currentPeriod === '2' || currentPeriod === 'p2_start' || currentPeriod === 'p2_end'
                    ? 'bg-sky-600 text-white shadow-2xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
                title="2ª Aula - Chamada da segunda aula"
              >
                <span className="w-2 h-2 rounded-full bg-sky-300"></span>
                <span>2ª Aula</span>
              </button>

              <button
                id="btn-period-both"
                onClick={() => setActivePeriod('both')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer text-xs shrink-0 flex items-center gap-1.5 ${
                  currentPeriod === 'both'
                    ? 'bg-slate-900 text-white shadow-2xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
                title="Chamada Integral (Abrange 1ª e 2ª Aulas)"
              >
                <span className="w-2 h-2 rounded-full bg-amber-300"></span>
                <span>Chamada Integral</span>
              </button>
            </div>
          )}

          {/* Quick Batch Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              id="btn-mark-all-present-quick"
              onClick={() => markAllPresent(currentPeriod)}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-2xs"
              title="Marcar todos como presentes para a etapa atual"
            >
              <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Marcar Todos (P)</span>
            </button>

            <button
              id="btn-reset-attendance-quick"
              onClick={() => {
                if (confirm('Deseja resetar as presenças desta etapa?')) {
                  resetCurrentAttendance(currentPeriod);
                }
              }}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 text-xs font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-2xs"
              title="Zerar presenças da etapa atual"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Zerar</span>
            </button>
          </div>
        </div>

      </div>

      {/* 2. QR Code Banner (STRICTLY ACTIVE ONLY WHEN SESSION IS LIVE) */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/90 shadow-sm space-y-5">
        {isLive ? (
          <div>
            {/* Top Sub-navigation for QR Code Section */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl">
                <button
                  type="button"
                  id="btn-tab-dynamic-qr"
                  onClick={() => setQrActiveTab('dynamic')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    qrActiveTab === 'dynamic'
                      ? 'bg-white text-teal-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5 text-teal-600" />
                  <span>QR Code Dinâmico</span>
                </button>



                <button
                  type="button"
                  id="btn-tab-tv-screen"
                  onClick={() => setQrActiveTab('tv')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    qrActiveTab === 'tv'
                      ? 'bg-white text-sky-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Tv className="w-3.5 h-3.5 text-sky-600" />
                  <span>Modo Telão & TV</span>
                </button>

                <button
                  type="button"
                  id="btn-tab-email-qr"
                  onClick={() => setQrActiveTab('email')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    qrActiveTab === 'email'
                      ? 'bg-white text-indigo-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Enviar por E-mail</span>
                </button>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-bold text-slate-700">Chamada em Andamento</span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-teal-300 font-mono font-bold text-[11px] border border-slate-800 shadow-2xs">
                  Token: {dynamicToken || activeSession?.checkinCode || 'BMF-MED'}
                </span>
              </div>
            </div>

            {/* TAB 1: QR CODE DINÂMICO ANTI-FRAUDE */}
            {qrActiveTab === 'dynamic' && (
              <div className="pt-2 flex flex-col lg:flex-row items-center justify-between gap-6 animate-in fade-in">
                
                {/* Left: Dynamic QR Code with Animated Border and Rotation Counter */}
                <div className="flex flex-col sm:flex-row items-center gap-5">
                  <div className="p-3.5 bg-gradient-to-b from-teal-500/10 to-slate-100 border-2 border-teal-500/80 rounded-3xl shadow-md relative group">
                    <QRCodeDisplay 
                      value={studentCheckinUrl} 
                      size={160} 
                      showSecurityBadge={true}
                    />
                    
                    {/* Dynamic rotation indicator badge */}
                    <div className="absolute -top-2.5 -right-2.5 px-2.5 py-0.5 rounded-full bg-slate-950 text-teal-300 border border-teal-500 text-[10px] font-mono font-bold flex items-center gap-1 shadow-md">
                      <RefreshCw className="w-3 h-3 text-teal-400 animate-spin" />
                      <span>{dynamicSecondsLeft}s</span>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="space-y-2 text-center sm:text-left max-w-md">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 text-[10px] font-bold uppercase">
                      <Sparkles className="w-3 h-3 text-teal-600" />
                      QR Code Dinâmico Anti-Fraude Ativo
                    </div>
                    
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                      Aponte a câmera do celular para confirmar presença
                    </h3>
                    
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Projete o QR Code na sala ou laboratório. O código rotaciona automaticamente com validação de segurança.
                    </p>

                    {/* Action buttons - Apenas o link do modo telão conforme solicitado */}
                    <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                      <button
                        type="button"
                        id="btn-quick-open-telao-from-qr"
                        onClick={() => onOpenProjectionScreen(currentPeriod)}
                        className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
                        title="Abrir tela de projeção para Smart TV ou Projetor"
                      >
                        <Monitor className="w-4 h-4 text-white" />
                        <span>Abrir Modo Telão</span>
                      </button>

                      <a
                        href={tvScreenUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 flex items-center gap-1.5 transition-all shadow-2xs"
                        title="Link direto do Modo Telão para abrir em tela cheia na TV"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                        <span>Link do Modo Telão</span>
                      </a>
                    </div>
                  </div>
                </div>

                {/* Right: Real-time Attendance Statistics Summary */}
                <div className="w-full lg:w-72 grid grid-cols-2 gap-2.5 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80">
                  <div className="p-3 bg-white rounded-xl border border-emerald-100 text-center shadow-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Presentes</span>
                    <span className="text-xl font-extrabold text-emerald-600 font-mono">{stats.present}</span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-rose-100 text-center shadow-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Faltas</span>
                    <span className="text-xl font-extrabold text-rose-500 font-mono">{stats.absent}</span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-amber-100 text-center shadow-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Atestados</span>
                    <span className="text-xl font-extrabold text-amber-600 font-mono">{stats.excused}</span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-sky-100 text-center shadow-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Frequência</span>
                    <span className="text-xl font-extrabold text-sky-600 font-mono">{stats.rate}%</span>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 2: ENVIAR QR CODE / RESUMO POR E-MAIL (SIMPLIFICADO E OTIMIZADO) */}
            {qrActiveTab === 'email' && (
              <div className="pt-2 space-y-4 animate-in fade-in">
                
                {/* Header info */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-indigo-600" />
                      <span>Envio Rápido do QR Code & Chamada por E-mail</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Envie o link para abrir no computador/TV da sala ou encaminhe o resumo de presença.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-500">Turma:</span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-extrabold">
                      {selectedClass?.name}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  
                  {/* Left Column (7 cols): Single streamlined control box */}
                  <div className="lg:col-span-7 bg-slate-50/80 rounded-2xl p-4 sm:p-5 border border-slate-200/90 space-y-4 shadow-2xs">
                    
                    {/* Option 1: What to send (2 clear buttons) */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Selecione o conteúdo do e-mail:</span>
                      </label>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setEmailContentType('telao')}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                            emailContentType === 'telao'
                              ? 'bg-white border-indigo-600 shadow-sm ring-2 ring-indigo-500/20'
                              : 'bg-white/60 border-slate-200 hover:bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between pb-1">
                            <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                              <Tv className="w-3.5 h-3.5 text-sky-600" />
                              Link do Telão / TV
                            </span>
                            {emailContentType === 'telao' && (
                              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500 leading-snug">
                            Para abrir o QR Code dinâmico na Smart TV ou projetor sem pedir login.
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setEmailContentType('resumo')}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                            emailContentType === 'resumo'
                              ? 'bg-white border-indigo-600 shadow-sm ring-2 ring-indigo-500/20'
                              : 'bg-white/60 border-slate-200 hover:bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between pb-1">
                            <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                              <Award className="w-3.5 h-3.5 text-indigo-600" />
                              Resumo de Presença
                            </span>
                            {emailContentType === 'resumo' && (
                              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500 leading-snug">
                            Dados de presença ({stats.present} presentes, {stats.rate}%), faltas e token.
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Single Destination Email field */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-500" />
                          <span>E-mail do Destinatário:</span>
                        </label>
                        {activeProfessor?.email && (
                          <button
                            type="button"
                            onClick={() => setEmailRecipient(activeProfessor.email)}
                            className="text-[10px] text-indigo-600 font-bold hover:underline cursor-pointer"
                          >
                            Usar meu e-mail ({activeProfessor.email.split('@')[0]})
                          </button>
                        )}
                      </div>

                      <div className="relative">
                        <input
                          type="email"
                          value={emailRecipient}
                          onChange={(e) => setEmailRecipient(e.target.value)}
                          placeholder="Digite o e-mail do docente, da sala ou do laboratório..."
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-2xs"
                        />
                        <Mail className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
                      </div>
                    </div>

                    {/* Primary & Secondary Actions */}
                    <div className="pt-2 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          id="btn-send-email-mailto-optimized"
                          onClick={handleOpenEmailApp}
                          className="flex-1 min-w-[200px] py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
                        >
                          <Mail className="w-4 h-4" />
                          <span>Abrir no Cliente de E-mail (Envio Padrão)</span>
                        </button>

                        <a
                          href={tvScreenUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="py-2.5 px-4 bg-sky-50 hover:bg-sky-100 text-sky-800 rounded-xl font-bold text-xs border border-sky-200 flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                          title="Acessar o link do Modo Telão diretamente"
                        >
                          <ExternalLink className="w-4 h-4 text-sky-600" />
                          <span>Link do Modo Telão</span>
                        </a>
                      </div>

                      {/* Informações do Envio Padrão */}
                      <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <Mail className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Envio Padrão via E-mail</span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          O botão abre diretamente seu aplicativo de e-mail (Gmail, Outlook, etc.) com o relatório e o link da chamada formatados para o destinatário preenchido.
                        </p>
                      </div>
                    </div>

                  </div>

                  {/* Right Column (5 cols): Clean Preview Box */}
                  <div className="lg:col-span-5 bg-white rounded-2xl p-4 border border-slate-200 space-y-2.5 shadow-xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-1.5 text-indigo-700 font-bold text-xs">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Prévia do E-mail</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono text-[10px] font-bold">
                        {emailContentType === 'telao' ? 'Link do Telão' : 'Resumo de Presença'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assunto</span>
                      <div className="text-xs font-bold text-slate-900 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 truncate">
                        {activeEmailSubject}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Corpo da Mensagem</span>
                      <pre className="text-[11px] text-slate-700 font-sans whitespace-pre-wrap leading-relaxed max-h-[160px] overflow-y-auto bg-slate-50 p-2.5 rounded-lg border border-slate-200 select-all">
                        {activeEmailBody}
                      </pre>
                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* TAB 3: MODO TELÃO & PROJEÇÃO (TV / CHROMECAST) */}
            {qrActiveTab === 'tv' && (
              <div className="pt-2 space-y-4 animate-in fade-in">
                
                {/* Top Banner & Primary Actions */}
                <div className="bg-gradient-to-r from-sky-900 via-slate-900 to-teal-950 p-4 sm:p-5 rounded-2xl border border-sky-800/80 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1 max-w-xl">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30 text-[10px] font-bold uppercase">
                      <Tv className="w-3.5 h-3.5 text-sky-400" />
                      Projeção Dedicada em Alta Definição para Salas & Laboratórios
                    </div>
                    <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                      Espelhar o QR Code Dinâmico na Smart TV ou Projetor
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Transmita o Telão em tempo real. O QR Code rotaciona automaticamente e a lista de presença se atualiza na tela grande.
                    </p>
                  </div>

                  {/* Immediate Launch Buttons */}
                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0">
                    <button
                      type="button"
                      id="btn-open-projection-modal"
                      onClick={() => onOpenProjectionScreen(currentPeriod)}
                      className="flex-1 sm:flex-none px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-xl font-black text-xs shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
                    >
                      <Monitor className="w-4 h-4" />
                      <span>Abrir Modo Telão</span>
                    </button>
                    <a
                      href={tvScreenUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
                      <span>Link do Telão</span>
                    </a>
                  </div>
                </div>

                {/* Quick actions for Cast & Links */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                      <Cast className="w-4 h-4 text-sky-600" />
                      <span>1. Transmissão Sem Fio (Cast)</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Projete no Google Chrome através do menu ⋮ &gt; Transmitir (Cast) para a TV.
                    </p>
                    <button
                      type="button"
                      onClick={handleStartCast}
                      className="w-full py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                    >
                      <Cast className="w-3.5 h-3.5" />
                      <span>Iniciar Transmissão</span>
                    </button>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                      <Mail className="w-4 h-4 text-indigo-600" />
                      <span>2. Enviar por E-mail</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Envio padrão para o professor ou coordenador via aplicativo de e-mail.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setEmailContentType('telao');
                        setQrActiveTab('email');
                      }}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Envio por E-mail</span>
                    </button>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                      <Tv className="w-4 h-4 text-sky-600" />
                      <span>3. Link do Modo Telão</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Abra o Telão diretamente no navegador da Smart TV ou em uma nova aba.
                    </p>
                    <a
                      href={tvScreenUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-all text-center block"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Abrir Telão em Nova Aba</span>
                    </a>
                  </div>
                </div>

              </div>
            )}

          </div>
        ) : (
          /* When session is CLOSED or LOCKED, QR CODE IS COMPLETELY HIDDEN */
          <div className="text-center py-8 space-y-3">
            <div className="w-14 h-14 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto border border-slate-200">
              <Lock className="w-7 h-7" />
            </div>
            
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-base font-bold text-slate-800">
                {isLocked ? 'Chamada Encerrada e Bloqueada' : 'Chamada Não Iniciada'}
              </h3>
              <p className="text-xs text-slate-500">
                {isLocked 
                  ? 'A aula anterior foi encerrada. Inicie uma nova aula ou reabra a chamada para receber novos check-ins.'
                  : 'O QR Code fica oculto por segurança quando a chamada está fechada. Clique no botão abaixo para configurar e iniciar a aula da turma.'}
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-1">
              {isLocked && (
                <button
                  id="btn-reopen-session-placeholder"
                  onClick={reopenCurrentSession}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 text-teal-400" />
                  <span>Reabrir Chamada</span>
                </button>
              )}

              {onOpenNewSession && (
                <button
                  id="btn-open-session-placeholder"
                  onClick={onOpenNewSession}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <Zap className="w-4 h-4" />
                  <span>Nova Aula</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. Student Roster Table (Alphabetical A-Z, Search, Status Filter, Manual Check-in) */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
        
        {/* Table Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          
          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="input-search-students-roster"
              type="text"
              placeholder="Buscar aluno por nome ou RA (Ordem A-Z)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar w-full sm:w-auto p-1 bg-slate-100 rounded-2xl border border-slate-200 text-[11px] font-bold">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Todos ({classStudents.length})
            </button>
            <button
              onClick={() => setStatusFilter('present')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                statusFilter === 'present' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500 hover:text-emerald-700'
              }`}
            >
              Presentes ({stats.present})
            </button>
            <button
              onClick={() => setStatusFilter('absent')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                statusFilter === 'absent' ? 'bg-white text-rose-600 shadow-2xs' : 'text-slate-500 hover:text-rose-600'
              }`}
            >
              Faltas ({stats.absent})
            </button>
            <button
              onClick={() => setStatusFilter('excused')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                statusFilter === 'excused' ? 'bg-white text-sky-700 shadow-2xs' : 'text-slate-500 hover:text-sky-700'
              }`}
            >
              Atestados ({stats.excused})
            </button>
          </div>
        </div>

        {/* Legenda de Chamada */}
        <div className="flex flex-wrap items-center gap-2 px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-[11px] text-slate-600">
          <span className="font-bold text-slate-800 flex items-center gap-1.5 shrink-0">
            <Info className="w-3.5 h-3.5 text-sky-600" />
            Legenda de Chamada:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white border border-emerald-200 text-emerald-800 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              1ª Aula
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white border border-sky-200 text-sky-800 font-bold">
              <span className="w-2 h-2 rounded-full bg-sky-500"></span>
              2ª Aula
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white border border-slate-300 text-slate-800 font-bold">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              Chamada Integral
            </span>
          </div>
          <span className="text-[10.5px] text-slate-400 font-medium ml-auto hidden sm:inline">
            Clique nos botões para alternar Presente ou Falta individualmente
          </span>
        </div>

        {/* Student List Table */}
        <div className="overflow-x-auto w-full max-w-full border border-slate-100 rounded-2xl">
          <table className="w-full text-left text-xs border-collapse min-w-[660px]">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3.5 w-12 text-center">Nº</th>
                <th className="py-3 px-3.5">Nome do Aluno</th>
                <th className="py-3 px-3.5">RA / Matrícula</th>
                {activeSession?.activityCategory === 'atividade' || activeSession?.activityType?.startsWith('atividade') ? (
                  <>
                    <th className="py-3 px-3.5 text-center">Horário de Presença</th>
                    <th className="py-3 px-3.5 text-center">Status</th>
                  </>
                ) : (
                  <>
                    <th className="py-3 px-3.5 text-center">1ª Aula</th>
                    <th className="py-3 px-3.5 text-center">2ª Aula</th>
                    <th className="py-3 px-3.5 text-center">Status Geral</th>
                  </>
                )}
                <th className="py-3 px-3.5 text-right">Ação Manual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Nenhum aluno localizado nesta turma.
                  </td>
                </tr>
              ) : (
                displayedStudents.map((st, index) => {
                  const record = activeSession?.attendance?.[st.id];
                  const p1 = record?.period1Status || 'absent';
                  const p2 = record?.period2Status || 'absent';
                  const p1Start = record?.p1StartStatus || (p1 === 'present' ? 'present' : 'absent');
                  const p1End = record?.p1EndStatus || (p1 === 'present' ? 'present' : 'absent');
                  const p2Start = record?.p2StartStatus || (p2 === 'present' ? 'present' : 'absent');
                  const p2End = record?.p2EndStatus || (p2 === 'present' ? 'present' : 'absent');
                  const overall = record?.status || 'absent';
                  const timePresence = record?.timestamp || record?.p1StartTimestamp || record?.period1Timestamp || '-';

                  const isActivity = activeSession?.activityCategory === 'atividade' || activeSession?.activityType?.startsWith('atividade');

                  return (
                    <tr key={st.id} className="hover:bg-slate-50/60 transition-colors">
                      
                      {/* Index */}
                      <td className="py-3 px-3.5 text-center font-mono text-slate-400 font-bold text-[11px]">
                        {String(index + 1).padStart(2, '0')}
                      </td>

                      {/* Student Name + Avatar */}
                      <td className="py-3 px-3.5 font-bold text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <StudentAvatar name={st.name} size="sm" />
                          <span className="truncate max-w-[220px]" title={st.name}>
                            {st.name}
                          </span>
                        </div>
                      </td>

                      {/* RA */}
                      <td className="py-3 px-3.5 font-mono text-slate-600 font-medium">
                        {st.registrationNumber}
                      </td>

                      {isActivity ? (
                        <>
                          {/* Horário de Presença na Atividade */}
                          <td className="py-3 px-3.5 text-center font-mono text-xs">
                            {record?.timestamp || record?.p1StartTimestamp ? (
                              <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                                {record.timestamp || record.p1StartTimestamp}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>

                          {/* Status na Atividade */}
                          <td className="py-3 px-3.5 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                              overall === 'present'
                                ? 'bg-emerald-100 text-emerald-800'
                                : overall === 'late'
                                ? 'bg-amber-100 text-amber-800'
                                : overall === 'excused'
                                ? 'bg-sky-100 text-sky-800'
                                : 'bg-rose-100 text-rose-700'
                            }`}>
                              {overall === 'present' ? 'Presente' : overall === 'late' ? 'Atraso' : overall === 'excused' ? 'Atestado' : 'Falta'}
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          {/* 1ª Aula */}
                          <td className="py-3 px-3.5 text-center">
                            <button
                              onClick={() => {
                                const isPres = p1 === 'present' || p1Start === 'present' || p1End === 'present';
                                setAttendanceStatus(st.id, isPres ? 'absent' : 'present', '1');
                              }}
                              title={`1ª Aula: ${(p1 === 'present' || p1Start === 'present' || p1End === 'present') ? `Presente (${record?.period1Timestamp || record?.p1StartTimestamp || 'Sim'})` : 'Falta'}`}
                              className={`px-3 py-1 rounded-xl text-[11px] font-extrabold border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                                (p1 === 'present' || p1Start === 'present' || p1End === 'present')
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 shadow-2xs'
                                  : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-rose-50 hover:text-rose-600'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                (p1 === 'present' || p1Start === 'present' || p1End === 'present') ? 'bg-emerald-500' : 'bg-slate-400'
                              }`} />
                              <span>{(p1 === 'present' || p1Start === 'present' || p1End === 'present') ? 'Presente' : 'Falta'}</span>
                              {(record?.period1Timestamp || record?.p1StartTimestamp) && (p1 === 'present' || p1Start === 'present' || p1End === 'present') && (
                                <span className="text-[10px] font-mono text-emerald-600/80">({record.period1Timestamp || record.p1StartTimestamp})</span>
                              )}
                            </button>
                          </td>

                          {/* 2ª Aula */}
                          <td className="py-3 px-3.5 text-center">
                            <button
                              onClick={() => {
                                const isPres = p2 === 'present' || p2Start === 'present' || p2End === 'present';
                                setAttendanceStatus(st.id, isPres ? 'absent' : 'present', '2');
                              }}
                              title={`2ª Aula: ${(p2 === 'present' || p2Start === 'present' || p2End === 'present') ? `Presente (${record?.period2Timestamp || record?.p2StartTimestamp || 'Sim'})` : 'Falta'}`}
                              className={`px-3 py-1 rounded-xl text-[11px] font-extrabold border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                                (p2 === 'present' || p2Start === 'present' || p2End === 'present')
                                  ? 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100 shadow-2xs'
                                  : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-rose-50 hover:text-rose-600'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                (p2 === 'present' || p2Start === 'present' || p2End === 'present') ? 'bg-sky-500' : 'bg-slate-400'
                              }`} />
                              <span>{(p2 === 'present' || p2Start === 'present' || p2End === 'present') ? 'Presente' : 'Falta'}</span>
                              {(record?.period2Timestamp || record?.p2StartTimestamp) && (p2 === 'present' || p2Start === 'present' || p2End === 'present') && (
                                <span className="text-[10px] font-mono text-sky-600/80">({record.period2Timestamp || record.p2StartTimestamp})</span>
                              )}
                            </button>
                          </td>

                          {/* Overall Status Badge */}
                          <td className="py-3 px-3.5 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                              overall === 'present'
                                ? 'bg-emerald-100 text-emerald-800'
                                : overall === 'late'
                                ? 'bg-amber-100 text-amber-800'
                                : overall === 'excused'
                                ? 'bg-sky-100 text-sky-800'
                                : 'bg-rose-100 text-rose-700'
                            }`}>
                              {overall === 'present' ? 'Presente' : overall === 'late' ? 'Atraso' : overall === 'excused' ? 'Atestado' : 'Falta'}
                            </span>
                          </td>
                        </>
                      )}

                      {/* Quick Manual Toggle (P / F / Justificativa) */}
                      <td className="py-3 px-3.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            title="Presença Integral (Todas as etapas)"
                            onClick={() => setAttendanceStatus(st.id, 'present', isActivity ? 'activity_single' : 'both')}
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            title="Lançar Atestado / Justificativa de Falta"
                            onClick={() => {
                              setJustifyModalStudent(st);
                              setJustifyPeriod(isActivity ? 'activity_single' : 'both');
                              setJustifyDescription(`Atestado / Justificativa de ausência (${st.name})`);
                            }}
                            className="p-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 transition-colors cursor-pointer"
                          >
                            <FileCheck className="w-3.5 h-3.5" />
                          </button>
                          <button
                            title="Falta Integral (Todas as etapas)"
                            onClick={() => setAttendanceStatus(st.id, 'absent', isActivity ? 'activity_single' : 'both')}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Quick Justification Modal */}
      {justifyModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Lançar Justificativa / Atestado</h3>
                  <p className="text-xs text-slate-500 font-medium">Aluno: {justifyModalStudent.name} (RA: {justifyModalStudent.ra})</p>
                </div>
              </div>
              <button
                onClick={() => setJustifyModalStudent(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 py-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tipo de Justificativa</label>
                <select
                  value={justifyReasonCategory}
                  onChange={e => setJustifyReasonCategory(e.target.value as any)}
                  className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                >
                  <option value="medical">Atestado Médico / Odontológico (CID)</option>
                  <option value="academic">Compromisso Acadêmico / Conflito de Horário</option>
                  <option value="transport">Falha de Transporte / Força Maior</option>
                  <option value="work">Declaração de Trabalho / Estágio</option>
                  <option value="other">Outro Motivo Relevante</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nº do Protocolo / Documento / CRM (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: CRM-SP 123456 / Atestado #492"
                  value={justifyDocNumber}
                  onChange={e => setJustifyDocNumber(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Etapa / Período a Justificar</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setJustifyPeriod('p1')}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all ${
                      justifyPeriod === 'p1' ? 'bg-sky-50 text-sky-700 border-sky-300' : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    1º Horário
                  </button>
                  <button
                    type="button"
                    onClick={() => setJustifyPeriod('p2')}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all ${
                      justifyPeriod === 'p2' ? 'bg-sky-50 text-sky-700 border-sky-300' : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    2º Horário
                  </button>
                  <button
                    type="button"
                    onClick={() => setJustifyPeriod('both')}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all ${
                      justifyPeriod === 'both' ? 'bg-sky-50 text-sky-700 border-sky-300' : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    Ambos (Integral)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Observações / Descrição</label>
                <textarea
                  rows={2}
                  value={justifyDescription}
                  onChange={e => setJustifyDescription(e.target.value)}
                  placeholder="Detalhes sobre a dispensa ou atestado apresentado..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Anexo de Documento */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-sky-700" />
                    <span>Anexo de Atestado / Arquivo</span>
                  </label>
                  {justifyAttachmentUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setJustifyAttachmentName('');
                        setJustifyAttachmentUrl('');
                      }}
                      className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                    >
                      Remover
                    </button>
                  )}
                </div>

                {justifyAttachmentUrl ? (
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 text-xs">
                    <File className="w-4 h-4 text-sky-600 shrink-0" />
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{justifyAttachmentName}</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[10px]">Anexado</span>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 p-2.5 border border-dashed border-slate-300 hover:border-sky-500 rounded-xl bg-white hover:bg-sky-50/40 cursor-pointer transition-colors text-center">
                    <UploadCloud className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-700">Anexar Documento (PDF, Imagem)</span>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp,image/*,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            setJustifyAttachmentUrl(ev.target?.result as string);
                            setJustifyAttachmentName(file.name);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setJustifyModalStudent(null);
                  setJustifyAttachmentName('');
                  setJustifyAttachmentUrl('');
                }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!justifyModalStudent) return;
                  // 1. Mark attendance status as excused
                  setAttendanceStatus(justifyModalStudent.id, 'excused', justifyPeriod);
                  // 2. Register justification in system
                  submitJustification({
                    studentId: justifyModalStudent.id,
                    studentName: justifyModalStudent.name,
                    studentRa: justifyModalStudent.registrationNumber || justifyModalStudent.id,
                    sessionId: activeSession?.id || '',
                    sessionTopic: activeSession?.topic || 'Aula BMF4',
                    sessionDate: activeSession?.date || new Date().toISOString().split('T')[0],
                    reason: justifyReasonCategory,
                    description: justifyDescription || 'Atestado registrado pelo docente',
                    documentNumber: justifyDocNumber || undefined,
                    attachmentName: justifyAttachmentName || undefined,
                    attachmentUrl: justifyAttachmentUrl || undefined,
                  });
                  playBeep('success');
                  setActionSuccessToast(`Justificativa / Atestado de ${justifyModalStudent.name} lançado com sucesso!`);
                  setJustifyModalStudent(null);
                  setJustifyAttachmentName('');
                  setJustifyAttachmentUrl('');
                }}
                className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                Salvar & Abonar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Smart Session Transition & Confirmation Lock Modal */}
      {confirmLockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Encerramento & Transição de Chamada</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Etapa Atual: <strong className="text-slate-800">
                      {currentPeriod === 'both' ? 'Chamada Integral' :
                       currentPeriod === 'activity_single' ? `Chamada Integral (${activeSession?.activityType?.startsWith('atividade') ? getActivityTypeLabel(activeSession.activityType) : 'Atividade'})` :
                       (currentPeriod === '2' || currentPeriod === 'p2_start' || currentPeriod === 'p2_end') ? '2ª Aula' : '1ª Aula'}
                    </strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmLockModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Main Action: Encerrar Chamada Imediatamente */}
            <div className="space-y-3 py-1">
              <button
                type="button"
                id="btn-confirm-lock-modal-direct"
                onClick={() => {
                  lockCurrentSession(activeSession?.id, selectedClassId);
                  setConfirmLockModalOpen(false);
                  setActionSuccessToast('Chamada encerrada e bloqueada com sucesso!');
                  playBeep('delete');
                }}
                className="w-full p-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center justify-between transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <div className="text-left">
                  <div className="font-black text-sm flex items-center gap-1.5">
                    <Lock className="w-4 h-4" />
                    <span>Encerrar e Bloquear Chamada Agora</span>
                  </div>
                  <div className="text-[11px] text-rose-100 font-normal mt-0.5">
                    Fecha a chamada, bloqueia novos check-ins e finaliza a lista de presença.
                  </div>
                </div>
                <Check className="w-5 h-5 shrink-0" />
              </button>

              {/* Sub-actions: Transição de Período */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Ou alternar período da aula:
                </p>

                {/* Se estiver na 1ª Aula */}
                {(currentPeriod === '1' || currentPeriod === 'p1_start' || currentPeriod === 'p1_end') && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActivePeriod('2');
                        setConfirmLockModalOpen(false);
                        setActionSuccessToast('1ª Aula concluída. Chamada da 2ª Aula iniciada!');
                        playBeep('checkpoint');
                      }}
                      className="w-full p-3 rounded-2xl bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 text-xs font-bold flex items-center justify-between transition-all group cursor-pointer"
                    >
                      <div className="text-left">
                        <div className="font-black text-sky-950 flex items-center gap-1.5">
                          <span>Avançar para a 2ª Aula</span>
                        </div>
                        <div className="text-[11px] text-sky-700 font-normal">
                          Conclui a 1ª aula e abre a chamada da 2ª aula no telão e QR Code.
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-sky-700 group-hover:translate-x-1 transition-transform" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActivePeriod('both');
                        setConfirmLockModalOpen(false);
                        setActionSuccessToast('Chamada alternada para Chamada Integral!');
                        playBeep('checkpoint');
                      }}
                      className="w-full p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-900 border border-slate-200 text-xs font-bold flex items-center justify-between transition-all group cursor-pointer"
                    >
                      <div className="text-left">
                        <div className="font-black text-slate-950 flex items-center gap-1.5">
                          <span>Mudar para Chamada Integral</span>
                        </div>
                        <div className="text-[11px] text-slate-600 font-normal">
                          Permite validação de presença para todo o período (1ª e 2ª Aulas).
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-700 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                )}

                {/* Se estiver na 2ª Aula */}
                {(currentPeriod === '2' || currentPeriod === 'p2_start' || currentPeriod === 'p2_end') && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActivePeriod('both');
                        setConfirmLockModalOpen(false);
                        setActionSuccessToast('Chamada alternada para Chamada Integral!');
                        playBeep('checkpoint');
                      }}
                      className="w-full p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-900 border border-slate-200 text-xs font-bold flex items-center justify-between transition-all group cursor-pointer"
                    >
                      <div className="text-left">
                        <div className="font-black text-slate-950 flex items-center gap-1.5">
                          <span>Mudar para Chamada Integral</span>
                        </div>
                        <div className="text-[11px] text-slate-600 font-normal">
                          Valida presença para 1ª e 2ª Aulas simultaneamente.
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-700 group-hover:translate-x-1 transition-transform" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActivePeriod('1');
                        setConfirmLockModalOpen(false);
                        setActionSuccessToast('Retornado para a chamada da 1ª Aula.');
                        playBeep('checkpoint');
                      }}
                      className="w-full p-3 rounded-2xl bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 text-xs font-bold flex items-center justify-between transition-all group cursor-pointer"
                    >
                      <div className="text-left">
                        <div className="font-black text-teal-950 flex items-center gap-1.5">
                          <span>Retornar para a 1ª Aula</span>
                        </div>
                        <div className="text-[11px] text-teal-700 font-normal">
                          Reabre a validação específica da 1ª aula.
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-teal-700 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                )}

                {/* Se estiver em Chamada Integral */}
                {currentPeriod === 'both' && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActivePeriod('1');
                        setConfirmLockModalOpen(false);
                        setActionSuccessToast('Chamada alterada para 1ª Aula.');
                        playBeep('checkpoint');
                      }}
                      className="w-full p-3 rounded-2xl bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 text-xs font-bold flex items-center justify-between transition-all group cursor-pointer"
                    >
                      <div className="text-left">
                        <div className="font-black text-teal-950 flex items-center gap-1.5">
                          <span>Alternar para 1ª Aula</span>
                        </div>
                        <div className="text-[11px] text-teal-700 font-normal">
                          Registra presença somente na 1ª aula.
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-teal-700 group-hover:translate-x-1 transition-transform" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActivePeriod('2');
                        setConfirmLockModalOpen(false);
                        setActionSuccessToast('Chamada alterada para 2ª Aula.');
                        playBeep('checkpoint');
                      }}
                      className="w-full p-3 rounded-2xl bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 text-xs font-bold flex items-center justify-between transition-all group cursor-pointer"
                    >
                      <div className="text-left">
                        <div className="font-black text-sky-950 flex items-center gap-1.5">
                          <span>Alternar para 2ª Aula</span>
                        </div>
                        <div className="text-[11px] text-sky-700 font-normal">
                          Registra presença somente na 2ª aula.
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-sky-700 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setConfirmLockModalOpen(false)}
                className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-all cursor-pointer"
              >
                Cancelar (Voltar à Chamada)
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
