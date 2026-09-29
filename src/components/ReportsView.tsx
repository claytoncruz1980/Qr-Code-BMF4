import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  BarChart3, 
  Calendar,
  Building2,
  FileSpreadsheet,
  Layers,
  Filter,
  UserCheck,
  Search,
  Check,
  CheckSquare,
  XCircle,
  Stethoscope,
  Trash2,
  Lock,
  Clock,
  ChevronRight,
  ShieldCheck,
  CalendarRange,
  Eye,
  Table as TableIcon,
  Sparkles,
  ArrowRight,
  Info,
  SlidersHorizontal,
  RotateCcw,
  Printer,
  ExternalLink,
  QrCode,
  FolderOpen
} from 'lucide-react';
import { useLab } from '../context/LabContext';
import { ActivityType, ActivityCategory, LabSession, Student, getActivityTypeLabel } from '../types';
import { exportModernAttendanceExcel } from '../utils/exportExcel';
import { exportToGoogleSheets, createGoogleCalendarEvent, sendGmailNotification, generateGeminiAiInsights } from '../utils/googleWorkspace';
import { 
  getStudentAttendanceRecord, 
  isRecordPresent, 
  isRecordLate, 
  isRecordExcused, 
  isRecordAbsent, 
  getRecordConsolidatedStatus,
  matchStudentClass
} from '../utils/attendanceHelpers';

export const ReportsView: React.FC = () => {
  const { 
    classes, 
    selectedClassId, 
    setSelectedClassId,
    students, 
    sessions, 
    deleteSession,
    deleteMultipleSessions,
    deleteAllSessionsForClass,
    activeProfessor,
    playBeep 
  } = useLab();

  // Tab navigation
  const [activeReportTab, setActiveReportTab] = useState<'geral' | 'detalhado_sessoes' | 'historico_sessoes'>('geral');
  const [generalViewMode, setGeneralViewMode] = useState<'resumo' | 'matriz_datas'>('resumo');
  const [selectedSessionDetailId, setSelectedSessionDetailId] = useState<string>('');
  
  // Date and Activity Filters
  const [dateFilterMode, setDateFilterMode] = useState<'all' | 'today' | 'week' | 'month' | 'custom' | 'single'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedSingleDate, setSelectedSingleDate] = useState<string>('');
  const [activityCategoryFilter, setActivityCategoryFilter] = useState<'all' | 'teorica' | 'pratica' | 'atividade'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals, Deletion, Call In-App Viewer & Selection state
  const [viewingSessionModal, setViewingSessionModal] = useState<LabSession | null>(null);
  const [modalStudentSearch, setModalStudentSearch] = useState('');
  const [modalStatusFilter, setModalStatusFilter] = useState<'all' | 'present' | 'absent'>('all');
  const [detailStudentSearch, setDetailStudentSearch] = useState('');
  const [detailStatusFilter, setDetailStatusFilter] = useState<'all' | 'present' | 'absent'>('all');

  const [selectedStudentHistory, setSelectedStudentHistory] = useState<Student | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [batchDeleteModalOpen, setBatchDeleteModalOpen] = useState(false);
  const [deleteAllModalOpen, setDeleteAllModalOpen] = useState(false);
  const [sessionSearchQuery, setSessionSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [geminiModalOpen, setGeminiModalOpen] = useState(false);
  const [geminiResult, setGeminiResult] = useState<string>('');
  const [geminiLoading, setGeminiLoading] = useState(false);

  const handleGoogleSheetsExport = async () => {
    setWorkspaceLoading(true);
    const res = await exportToGoogleSheets(selectedClass, classStudents, filteredSessions);
    setWorkspaceLoading(false);
    showToast(res.message);
    if (res.success && res.url) {
      window.open(res.url, '_blank');
    }
  };

  const handleGoogleCalendarSync = async () => {
    if (filteredSessions.length === 0) {
      showToast('Nenhuma sessão disponível para agendar no calendário.');
      return;
    }
    setWorkspaceLoading(true);
    const res = await createGoogleCalendarEvent(filteredSessions[0], selectedClass);
    setWorkspaceLoading(false);
    showToast(res.message);
    if (res.success && res.url) {
      window.open(res.url, '_blank');
    }
  };

  const handleGmailNotice = async () => {
    setWorkspaceLoading(true);
    const res = await sendGmailNotification(activeProfessor?.email || 'professor@uni9.edu.br', `Relatório BMF4 - ${selectedClass.name}`, `Relatório de frequência gerado em ${new Date().toLocaleDateString('pt-BR')}`);
    setWorkspaceLoading(false);
    showToast(res.message);
  };

  const handleOpenGeminiAI = async () => {
    setGeminiModalOpen(true);
    setGeminiLoading(true);
    const insights = await generateGeminiAiInsights(classStudents, classSessions);
    setGeminiResult(insights);
    setGeminiLoading(false);
  };

  const selectedClass = classes.find(c => c.id === selectedClassId) || classes[0];

  // Students of selected class, strictly sorted A-Z
  const classStudents = useMemo(() => {
    return students
      .filter(s => matchStudentClass(s.classGroupId, selectedClassId, classes))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' }));
  }, [students, selectedClassId, classes]);

  // All Sessions for this class sorted descending by date
  const classSessions = useMemo(() => {
    return sessions
      .filter(s => matchStudentClass(s.classGroupId, selectedClassId, classes))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sessions, selectedClassId, classes]);

  // Unique session dates list for quick filtering chips
  const uniqueClassDates = useMemo(() => {
    const datesMap = new Map<string, { date: string; sessionCount: number; sampleSession: LabSession }>();
    classSessions.forEach(s => {
      const existing = datesMap.get(s.date);
      if (!existing) {
        datesMap.set(s.date, { date: s.date, sessionCount: 1, sampleSession: s });
      } else {
        existing.sessionCount += 1;
      }
    });
    return Array.from(datesMap.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [classSessions]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Filtered Sessions according to date filter mode, custom range, specific date, and activity category
  const filteredSessions = useMemo(() => {
    return classSessions.filter(s => {
      // Activity Category filter
      if (activityCategoryFilter !== 'all' && s.activityCategory !== activityCategoryFilter) {
        return false;
      }

      // Date filtering
      if (dateFilterMode === 'today') {
        if (s.date !== todayStr) return false;
      } else if (dateFilterMode === 'week') {
        const now = new Date();
        const sessDate = new Date(s.date);
        const diffDays = (now.getTime() - sessDate.getTime()) / (1000 * 3600 * 24);
        if (diffDays > 7 || diffDays < -1) return false;
      } else if (dateFilterMode === 'month') {
        const now = new Date();
        const sessDate = new Date(s.date);
        const diffDays = (now.getTime() - sessDate.getTime()) / (1000 * 3600 * 24);
        if (diffDays > 30 || diffDays < -1) return false;
      } else if (dateFilterMode === 'custom') {
        if (customStartDate && s.date < customStartDate) return false;
        if (customEndDate && s.date > customEndDate) return false;
      } else if (dateFilterMode === 'single') {
        if (selectedSingleDate && s.date !== selectedSingleDate) return false;
      }

      return true;
    });
  }, [classSessions, activityCategoryFilter, dateFilterMode, todayStr, customStartDate, customEndDate, selectedSingleDate]);

  // Selected session for detailed tab
  const activeDetailSession = useMemo(() => {
    if (selectedSessionDetailId) {
      return classSessions.find(s => s.id === selectedSessionDetailId) || classSessions[0];
    }
    return classSessions[0];
  }, [classSessions, selectedSessionDetailId]);

  // General Attendance Statistics for filtered range
  const overallStats = useMemo(() => {
    const totalSessions = filteredSessions.length;
    if (totalSessions === 0 || classStudents.length === 0) {
      return { totalSessions, avgRate: 100, atRiskCount: 0, totalPresences: 0, totalAbsences: 0, totalExcused: 0 };
    }

    let totalPresences = 0;
    let totalAbsences = 0;
    let totalExcused = 0;
    let atRiskCount = 0;

    classStudents.forEach(st => {
      let stPresences = 0;
      filteredSessions.forEach(sess => {
        const rec = getStudentAttendanceRecord(sess.attendance, st);
        const present = isRecordPresent(rec);
        const late = isRecordLate(rec);
        const excused = isRecordExcused(rec);

        if (present || late) {
          stPresences++;
        } else if (excused) {
          stPresences++;
          totalExcused++;
        } else {
          totalAbsences++;
        }
      });

      totalPresences += stPresences;
      if ((stPresences / totalSessions) < 0.75) {
        atRiskCount++;
      }
    });

    const totalOpportunities = classStudents.length * totalSessions;
    const avgRate = totalOpportunities > 0 ? Math.round((totalPresences / totalOpportunities) * 100) : 100;

    return { totalSessions, avgRate, atRiskCount, totalPresences, totalAbsences, totalExcused };
  }, [classStudents, filteredSessions]);

  // Filtered students by search query
  const displayedStudents = useMemo(() => {
    return classStudents.filter(st => {
      return (
        st.name.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        st.registrationNumber.toLowerCase().includes(searchTerm.toLowerCase().trim())
      );
    });
  }, [classStudents, searchTerm]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleConfirmDeleteSession = () => {
    if (!deletingSessionId) return;
    deleteSession(deletingSessionId);
    setSelectedSessionIds(prev => prev.filter(id => id !== deletingSessionId));
    setDeletingSessionId(null);
    showToast('Registro de chamada/sessão excluído com sucesso.');
  };

  const handleConfirmBatchDelete = () => {
    if (selectedSessionIds.length === 0) return;
    const count = selectedSessionIds.length;
    deleteMultipleSessions(selectedSessionIds);
    setSelectedSessionIds([]);
    setBatchDeleteModalOpen(false);
    showToast(`${count} chamada(s) excluída(s) com sucesso.`);
  };

  const handleConfirmDeleteAllSessions = () => {
    if (!selectedClassId) return;
    const count = classSessions.length;
    deleteAllSessionsForClass(selectedClassId);
    setSelectedSessionIds([]);
    setDeleteAllModalOpen(false);
    showToast(`Todas as ${count} chamadas da turma foram excluídas com sucesso.`);
  };

  const toggleSelectSession = (sessionId: string) => {
    setSelectedSessionIds(prev => 
      prev.includes(sessionId) ? prev.filter(id => id !== sessionId) : [...prev, sessionId]
    );
  };

  const toggleSelectAllSessions = (sessionList: LabSession[]) => {
    if (selectedSessionIds.length === sessionList.length) {
      setSelectedSessionIds([]);
    } else {
      setSelectedSessionIds(sessionList.map(s => s.id));
    }
  };

  // Helper function to calculate comprehensive stats for a single call/session
  const getSessionStats = (session: LabSession | null) => {
    if (!session || classStudents.length === 0) {
      return { total: classStudents.length, p1Count: 0, p2Count: 0, overallPresentCount: 0, absentCount: classStudents.length, rate: 0 };
    }
    let p1Count = 0;
    let p2Count = 0;
    let overallPresentCount = 0;

    classStudents.forEach(st => {
      const rec = getStudentAttendanceRecord(session.attendance, st);
      const isP1 = rec?.period1Status === 'present' || rec?.p1StartStatus === 'present' || rec?.p1EndStatus === 'present';
      const isP2 = rec?.period2Status === 'present' || rec?.p2StartStatus === 'present' || rec?.p2EndStatus === 'present';
      const isOverall = isRecordPresent(rec) || isRecordLate(rec) || isRecordExcused(rec) || isP1 || isP2;

      if (isP1) p1Count++;
      if (isP2) p2Count++;
      if (isOverall) overallPresentCount++;
    });

    const total = classStudents.length;
    const absentCount = Math.max(0, total - overallPresentCount);
    const rate = total > 0 ? Math.round((overallPresentCount / total) * 100) : 0;

    return { total, p1Count, p2Count, overallPresentCount, absentCount, rate };
  };

  // Filtered students for in-app Call History modal
  const modalDisplayedStudents = useMemo(() => {
    if (!viewingSessionModal) return [];
    return classStudents.filter(st => {
      if (modalStudentSearch.trim()) {
        const query = modalStudentSearch.toLowerCase().trim();
        const matches = st.name.toLowerCase().includes(query) || st.registrationNumber.toLowerCase().includes(query);
        if (!matches) return false;
      }
      if (modalStatusFilter !== 'all') {
        const rec = getStudentAttendanceRecord(viewingSessionModal.attendance, st);
        const isPresent = isRecordPresent(rec) || isRecordLate(rec) || isRecordExcused(rec);
        if (modalStatusFilter === 'present' && !isPresent) return false;
        if (modalStatusFilter === 'absent' && isPresent) return false;
      }
      return true;
    });
  }, [viewingSessionModal, classStudents, modalStudentSearch, modalStatusFilter]);

  // Filtered students for detailed session tab view
  const detailDisplayedStudents = useMemo(() => {
    if (!activeDetailSession) return classStudents;
    return classStudents.filter(st => {
      if (detailStudentSearch.trim()) {
        const query = detailStudentSearch.toLowerCase().trim();
        const matches = st.name.toLowerCase().includes(query) || st.registrationNumber.toLowerCase().includes(query);
        if (!matches) return false;
      }
      if (detailStatusFilter !== 'all') {
        const rec = getStudentAttendanceRecord(activeDetailSession.attendance, st);
        const isPresent = isRecordPresent(rec) || isRecordLate(rec) || isRecordExcused(rec);
        if (detailStatusFilter === 'present' && !isPresent) return false;
        if (detailStatusFilter === 'absent' && isPresent) return false;
      }
      return true;
    });
  }, [activeDetailSession, classStudents, detailStudentSearch, detailStatusFilter]);

  // Export single session to Excel
  const handleExportSingleSession = async (session: LabSession) => {
    if (!selectedClass) return;
    const stats = getSessionStats(session);
    try {
      await exportModernAttendanceExcel({
        selectedClass,
        students: classStudents,
        sessions: [session],
        activeProfessor: session.professorName ? { id: '', name: session.professorName, email: '', isCoordinator: false } : activeProfessor,
        overallStats: {
          avgRate: stats.rate,
          totalPresences: stats.overallPresentCount,
          totalAbsences: stats.absentCount,
          totalExcused: 0,
          atRiskCount: 0
        }
      });
      playBeep('success');
      showToast(`Planilha da chamada (${formatDateDisplay(session.date)}) exportada com sucesso!`);
    } catch (err) {
      console.error('Erro ao exportar chamada individual:', err);
      showToast('Erro ao exportar planilha da chamada.');
    }
  };

  // Modern, Structured, Styled Excel (.xlsx) Export with filtered sessions & dates
  const handleExportModernExcel = async () => {
    if (!selectedClass) return;

    try {
      await exportModernAttendanceExcel({
        selectedClass,
        students: classStudents,
        sessions: filteredSessions,
        activeProfessor,
        overallStats
      });
      playBeep('success');
      showToast('Planilha Excel oficial (.xlsx) exportada com sucesso com as datas filtradas!');
    } catch (err) {
      console.error('Erro ao gerar planilha Excel moderna:', err);
      showToast('Erro ao gerar arquivo Excel. Tente novamente.');
    }
  };

  // CSV Export with filtered dates
  const handleExportCSV = () => {
    if (!selectedClass) return;
    let csv = "Nº,Nome Completo,RA,Turma,Total Presencas,Total Faltas,Atrasos,Atestados,Total Aulas Filtradas,Frequencia (%),Situacao\n";

    classStudents.forEach((st, idx) => {
      let presences = 0;
      let absences = 0;
      let lates = 0;
      let excused = 0;

      filteredSessions.forEach(s => {
        const rec = s.attendance?.[st.id];
        if (rec) {
          const isPresent = rec.status === 'present' || 
            rec.period1Status === 'present' || 
            rec.period2Status === 'present' || 
            rec.p1StartStatus === 'present' || 
            rec.p1EndStatus === 'present' || 
            rec.p2StartStatus === 'present' || 
            rec.p2EndStatus === 'present';
          const isLate = rec.status === 'late' || rec.period1Status === 'late' || rec.period2Status === 'late';
          const isExcused = rec.status === 'excused' || rec.period1Status === 'excused' || rec.period2Status === 'excused';

          if (isPresent) presences++;
          else if (isLate) { presences++; lates++; }
          else if (isExcused) { presences++; excused++; }
          else absences++;
        } else {
          absences++;
        }
      });

      const totalSess = filteredSessions.length;
      const rate = totalSess > 0 ? Math.round((presences / totalSess) * 100) : 100;
      const situacao = rate >= 75 ? "Apto" : "Em Risco (< 75%)";

      csv += `"${idx + 1}","${st.name}","${st.registrationNumber}","${selectedClass.name}","${presences}","${absences}","${lates}","${excused}","${totalSess}","${rate}%","${situacao}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Frequencia_BMF4_${selectedClass.name.replace(/[^a-zA-Z0-9]/g, '_')}_${dateFilterMode}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    playBeep('success');
    showToast('Arquivo CSV exportado com sucesso!');
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        const weekday = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' });
        return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${parts[2]}/${parts[1]}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // Format the call time range (e.g., "07:30 às 12:00")
  const getSessionTimeDisplay = (session?: LabSession | null): string => {
    if (!session) return '--:--';
    if (session.startTime) {
      if (session.endTime && session.endTime !== session.startTime) {
        return `${session.startTime} às ${session.endTime}`;
      }
      return `${session.startTime}`;
    }
    if (session.openedAt) {
      try {
        const openTime = new Date(session.openedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        if (session.closedAt) {
          const closeTime = new Date(session.closedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          return `${openTime} às ${closeTime}`;
        }
        return `${openTime}`;
      } catch {
        // fallback
      }
    }
    return '07:30 às 12:00';
  };

  // Short format for badges / compact tags (e.g., "07:30 - 12:00")
  const getSessionTimeShort = (session?: LabSession | null): string => {
    if (!session) return '--:--';
    if (session.startTime) {
      if (session.endTime && session.endTime !== session.startTime) {
        return `${session.startTime} - ${session.endTime}`;
      }
      return session.startTime;
    }
    if (session.openedAt) {
      try {
        return new Date(session.openedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      } catch {
        // fallback
      }
    }
    return '07:30';
  };

  return (
    <div className="space-y-5 max-w-full pb-20 sm:pb-8">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-600 text-white text-xs font-bold flex items-center justify-between shadow-md animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-white shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-white hover:text-emerald-100 cursor-pointer">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Header with Class Selector, Export Buttons and View Tabs */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center shadow-xs">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <span>Relatórios de Frequência & Histórico de Datas BMF4</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Consolidação por datas das aulas, presenças detalhadas por horários e exportação para planilhas.
                </p>
              </div>
            </div>
          </div>

          {/* Class Selector & Export Action Buttons (Excel & CSV) */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-2xl">
              <label htmlFor="select-class-reports" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                Turma:
              </label>
              <select
                id="select-class-reports"
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value);
                  playBeep('confirm');
                }}
                className="text-xs font-bold text-slate-900 bg-transparent focus:outline-none cursor-pointer max-w-[180px] sm:max-w-[220px] truncate"
              >
                {classes.map(cls => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} {cls.discipline ? `- ${cls.discipline}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <button
              id="btn-export-excel-modern"
              onClick={handleExportModernExcel}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-2xl shadow-xs flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
              title="Exportar planilha Excel completa (.xlsx) com as datas filtradas"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exportar Excel (.xlsx)</span>
            </button>

            <button
              id="btn-export-csv"
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Exportar dados em formato CSV"
            >
              <Download className="w-4 h-4" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs (Diário Geral / Relatório de Horários / Gerenciar Chamadas) */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap">
          <button
            onClick={() => setActiveReportTab('geral')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeReportTab === 'geral'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Diário Geral por Datas</span>
          </button>

          <button
            onClick={() => setActiveReportTab('detalhado_sessoes')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeReportTab === 'detalhado_sessoes'
                ? 'bg-sky-900 text-sky-200 shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Espelho & Horários da Chamada</span>
          </button>

          <button
            onClick={() => setActiveReportTab('historico_sessoes')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeReportTab === 'historico_sessoes'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
            <span>Histórico de Chamadas</span>
            <span className="px-1.5 py-0.2 bg-slate-800 text-slate-300 text-[10px] rounded-full font-bold">
              {classSessions.length}
            </span>
          </button>
        </div>

      </div>

      {/* Google Workspace & Gemini AI Integration Toolbar */}
      <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-sky-950 rounded-3xl p-4 sm:p-5 text-white shadow-xl border border-teal-500/30 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-500/20 text-teal-300 border border-teal-400/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-teal-300 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Google Workspace & Gemini AI Integrados</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/30 text-teal-200 font-extrabold border border-teal-400/40">Ativo</span>
            </h3>
            <p className="text-xs text-slate-300">
              Sincronize com Google Sheets, Calendar, Gmail e obtenha insights pedagógicos com Inteligência Artificial.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
          <button
            onClick={handleGoogleSheetsExport}
            disabled={workspaceLoading}
            className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-md disabled:opacity-50"
            title="Sincronizar relatório com Google Sheets"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Google Sheets</span>
          </button>

          <button
            onClick={handleGoogleCalendarSync}
            disabled={workspaceLoading}
            className="px-3.5 py-2 rounded-xl bg-sky-700 hover:bg-sky-600 text-white text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-md disabled:opacity-50"
            title="Agendar aula no Google Calendar"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Google Calendar</span>
          </button>

          <button
            onClick={handleGmailNotice}
            disabled={workspaceLoading}
            className="px-3.5 py-2 rounded-xl bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-md disabled:opacity-50"
            title="Enviar notificação por Gmail"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Gmail</span>
          </button>

          <button
            onClick={handleOpenGeminiAI}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-md"
            title="Análise Inteligente de Frequência com Gemini AI"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-200" />
            <span>Gemini AI Insights</span>
          </button>
        </div>
      </div>

      {/* 2. OTIMIZADOR DE FILTRO DE DATAS DAS AULAS & ATIVIDADES */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-3.5">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-sky-600 shrink-0" />
            <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              Filtrar Datas das Aulas:
            </span>
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => {
                setDateFilterMode('all');
                setSelectedSingleDate('');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                dateFilterMode === 'all'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todas as Datas ({classSessions.length})
            </button>

            <button
              onClick={() => {
                setDateFilterMode('today');
                setSelectedSingleDate('');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                dateFilterMode === 'today'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Hoje ({formatDateDisplay(todayStr)})</span>
            </button>

            <button
              onClick={() => {
                setDateFilterMode('week');
                setSelectedSingleDate('');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                dateFilterMode === 'week'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Últimos 7 Dias
            </button>

            <button
              onClick={() => {
                setDateFilterMode('month');
                setSelectedSingleDate('');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                dateFilterMode === 'month'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Últimos 30 Dias
            </button>

            <button
              onClick={() => setDateFilterMode('custom')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                dateFilterMode === 'custom'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>Intervalo Personalizado</span>
            </button>
          </div>
        </div>

        {/* Custom Date Inputs if Custom Mode */}
        {dateFilterMode === 'custom' && (
          <div className="p-3 bg-sky-50/60 rounded-2xl border border-sky-100 flex flex-wrap items-center gap-3 animate-in fade-in">
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-bold text-slate-600">De:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1 text-xs font-bold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-bold text-slate-600">Até:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1 text-xs font-bold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            {(customStartDate || customEndDate) && (
              <button
                onClick={() => {
                  setCustomStartDate('');
                  setCustomEndDate('');
                }}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 underline cursor-pointer"
              >
                Limpar intervalo
              </button>
            )}
          </div>
        )}

        {/* Quick Date Chips Carousel (Lista de Aulas por Data) */}
        {uniqueClassDates.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Aulas Registradas ({uniqueClassDates.length} datas disponíveis):
              </span>
              {selectedSingleDate && (
                <button
                  onClick={() => {
                    setSelectedSingleDate('');
                    setDateFilterMode('all');
                  }}
                  className="text-[11px] font-bold text-sky-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Ver Todas as Datas</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full scrollbar-thin">
              {uniqueClassDates.map((item) => {
                const isSelected = dateFilterMode === 'single' && selectedSingleDate === item.date;
                const isToday = item.date === todayStr;
                return (
                  <button
                    key={item.date}
                    onClick={() => {
                      setDateFilterMode('single');
                      setSelectedSingleDate(item.date);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 border ${
                      isSelected
                        ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                        : isToday
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Calendar className="w-3 h-3" />
                    <span>{formatDateDisplay(item.date)}</span>
                    {isToday && (
                      <span className="px-1 py-0.2 rounded-full bg-emerald-600 text-white text-[9px] font-black">
                        HOJE
                      </span>
                    )}
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isSelected ? 'bg-sky-700 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {item.sessionCount} {item.sessionCount === 1 ? 'aula' : 'aulas'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* 3. Content Tabs */}
      {activeReportTab === 'geral' ? (
        <div className="space-y-4">
          
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-white rounded-3xl border border-slate-200/90 shadow-xs text-center space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Aulas Filtradas</span>
              <span className="text-xl font-black text-slate-900 font-mono">{filteredSessions.length}</span>
              <span className="text-[10px] text-slate-400 block font-medium">
                {dateFilterMode === 'all' ? 'Todo o semestre' : dateFilterMode === 'today' ? 'Hoje' : 'Período selecionado'}
              </span>
            </div>

            <div className="p-4 bg-white rounded-3xl border border-sky-100 shadow-xs text-center space-y-1 bg-gradient-to-b from-sky-50/40 to-white">
              <span className="text-[10px] font-bold text-sky-700 uppercase tracking-wider block">Frequência Média</span>
              <span className="text-xl font-black text-sky-600 font-mono">{overallStats.avgRate}%</span>
              <span className="text-[10px] text-sky-600 block font-medium">
                {overallStats.totalPresences} presenças registradas
              </span>
            </div>

            <div className="p-4 bg-white rounded-3xl border border-amber-100 shadow-xs text-center space-y-1 bg-gradient-to-b from-amber-50/40 to-white">
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Atestados Médicos</span>
              <span className="text-xl font-black text-amber-600 font-mono">{overallStats.totalExcused}</span>
              <span className="text-[10px] text-amber-600 block font-medium">Justificadas</span>
            </div>

            <div className="p-4 bg-white rounded-3xl border border-rose-100 shadow-xs text-center space-y-1 bg-gradient-to-b from-rose-50/40 to-white">
              <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">Alunos em Risco (&lt; 75%)</span>
              <span className="text-xl font-black text-rose-600 font-mono">{overallStats.atRiskCount}</span>
              <span className="text-[10px] text-rose-600 block font-medium">Frequência insuficiente</span>
            </div>
          </div>

          {/* Student Presence Table with Search and Mode Toggle */}
          <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
            
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar aluno por nome ou RA (A-Z)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
                />
              </div>

              {/* Toggle Resumo vs Matriz de Datas */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">
                  Exibindo <strong>{displayedStudents.length}</strong> de {classStudents.length} alunos
                </span>

                <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
                  <button
                    onClick={() => setGeneralViewMode('resumo')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      generalViewMode === 'resumo'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Resumo
                  </button>
                  <button
                    onClick={() => setGeneralViewMode('matriz_datas')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      generalViewMode === 'matriz_datas'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Calendar className="w-3 h-3 text-sky-600" />
                    <span>Matriz por Datas</span>
                  </button>
                </div>
              </div>
            </div>

            {/* TABELA 1: VISÃO RESUMO */}
            {generalViewMode === 'resumo' ? (
              <div className="overflow-x-auto w-full max-w-full border border-slate-200/90 rounded-2xl shadow-2xs">
                <table className="w-full text-left text-xs border-collapse min-w-[760px]">
                  <thead>
                    <tr className="bg-[#0B5394] text-white font-bold uppercase text-[10.5px] tracking-wider">
                      <th className="py-3 px-3.5 w-12 text-center">Nº</th>
                      <th className="py-3 px-3.5">Aluno</th>
                      <th className="py-3 px-3.5 text-center">RA</th>
                      <th className="py-3 px-3.5 text-center">Turma</th>
                      <th className="py-3 px-3.5 text-center">Presença</th>
                      <th className="py-3 px-3.5 text-center">Atrasos</th>
                      <th className="py-3 px-3.5 text-center">Faltas</th>
                      <th className="py-3 px-3.5 text-center">Justificadas</th>
                      <th className="py-3 px-3.5 text-center">Frequência</th>
                      <th className="py-3 px-3.5 text-center">Situação</th>
                      <th className="py-3 px-3.5 text-center">Histórico</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {displayedStudents.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-8 text-center text-slate-400">
                          Nenhum aluno encontrado para os critérios selecionados.
                        </td>
                      </tr>
                    ) : (
                      displayedStudents.map((st, idx) => {
                        let presences = 0;
                        let absences = 0;
                        let lates = 0;
                        let excused = 0;

                        filteredSessions.forEach(s => {
                          const rec = getStudentAttendanceRecord(s.attendance, st);
                          if (rec) {
                            const isPresent = isRecordPresent(rec);
                            const isLate = isRecordLate(rec);
                            const isExcused = isRecordExcused(rec);

                            if (isPresent) presences++;
                            else if (isLate) { presences++; lates++; }
                            else if (isExcused) { presences++; excused++; }
                            else absences++;
                          } else {
                            absences++;
                          }
                        });

                        const totalSess = filteredSessions.length;
                        const rate = totalSess > 0 ? (presences / totalSess) * 100 : 100;
                        const isRisk = rate < 75;

                        return (
                          <tr key={st.id} className="hover:bg-sky-50/40 transition-colors border-b border-slate-100">
                            <td className="py-3 px-3.5 text-center font-mono text-slate-400 font-bold text-[11px]">
                              {String(idx + 1).padStart(2, '0')}
                            </td>
                            <td className="py-3 px-3.5 font-bold text-slate-900 uppercase">
                              {st.name}
                            </td>
                            <td className="py-3 px-3.5 font-mono text-slate-600 text-center">
                              {st.registrationNumber}
                            </td>
                            <td className="py-3 px-3.5 text-center font-medium text-slate-600">
                              {selectedClass.name.replace(/^BMF4\s*/i, '').trim() || selectedClass.name}
                            </td>
                            <td className="py-3 px-3.5 text-center font-black text-emerald-600 font-mono">
                              {presences}
                            </td>
                            <td className="py-3 px-3.5 text-center font-bold text-amber-600 font-mono">
                              {lates}
                            </td>
                            <td className="py-3 px-3.5 text-center font-black text-rose-600 font-mono">
                              {absences}
                            </td>
                            <td className="py-3 px-3.5 text-center font-medium text-slate-600 font-mono">
                              {excused}
                            </td>
                            <td className="py-3 px-3.5 text-center font-black">
                              <span className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold ${
                                isRisk ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {rate.toFixed(1).replace('.', ',')}%
                              </span>
                            </td>
                            <td className="py-3 px-3.5 text-center font-bold">
                              {isRisk ? (
                                <span className="text-rose-600 text-[11px] bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">Em Risco (&lt;75%)</span>
                              ) : (
                                <span className="text-emerald-700 text-[11px] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">Apto</span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-center">
                              <button
                                onClick={() => setSelectedStudentHistory(st)}
                                className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-sky-100 text-slate-700 hover:text-sky-800 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 mx-auto"
                                title="Ver linha do tempo de presença nas datas"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Ver Datas</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* TABELA 2: VISÃO MATRIZ POR DATAS DE AULA */
              <div className="space-y-2">
                <div className="overflow-x-auto w-full max-w-full border border-slate-200/90 rounded-2xl shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse min-w-[850px]">
                    <thead>
                      <tr className="bg-[#0B5394] text-white font-bold uppercase text-[10.5px] tracking-wider">
                        <th className="py-3 px-3 w-10 text-center sticky left-0 bg-[#0B5394] z-10">Nº</th>
                        <th className="py-3 px-3.5 min-w-[200px] sticky left-10 bg-[#0B5394] z-10">Aluno</th>
                        <th className="py-3 px-3 text-center min-w-[100px]">RA</th>
                        
                        {/* Session Date Columns */}
                        {filteredSessions.map((sess) => (
                          <th key={sess.id} className="py-3 px-2 text-center min-w-[80px] border-l border-sky-700/50">
                            <div className="flex flex-col items-center">
                              <span className="font-mono text-xs">{sess.date.split('-').slice(1).reverse().join('/')}</span>
                              <span className="text-[9px] font-normal text-sky-200 truncate max-w-[75px]" title={sess.topic}>
                                {sess.topic}
                              </span>
                            </div>
                          </th>
                        ))}

                        <th className="py-3 px-3 text-center min-w-[80px] bg-[#073763]">Frequência</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {displayedStudents.map((st, idx) => {
                        let presences = 0;
                        filteredSessions.forEach(s => {
                          const rec = getStudentAttendanceRecord(s.attendance, st);
                          if (isRecordPresent(rec) || isRecordLate(rec) || isRecordExcused(rec)) {
                            presences++;
                          }
                        });
                        const totalSess = filteredSessions.length;
                        const rate = totalSess > 0 ? (presences / totalSess) * 100 : 100;

                        return (
                          <tr key={st.id} className="hover:bg-sky-50/30 transition-colors border-b border-slate-100">
                            <td className="py-2.5 px-3 text-center font-mono text-slate-400 font-bold sticky left-0 bg-white z-10 border-r border-slate-100">
                              {String(idx + 1).padStart(2, '0')}
                            </td>
                            <td className="py-2.5 px-3.5 font-bold text-slate-900 uppercase sticky left-10 bg-white z-10 border-r border-slate-100 truncate max-w-[220px]">
                              {st.name}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-600 text-center">
                              {st.registrationNumber}
                            </td>

                            {/* Attendance cells for each date */}
                            {filteredSessions.map((sess) => {
                              const rec = getStudentAttendanceRecord(sess.attendance, st);
                              const status = getRecordConsolidatedStatus(rec);
                              
                              return (
                                <td key={sess.id} className="py-2.5 px-2 text-center border-l border-slate-100">
                                  {status === 'present' ? (
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 font-black text-xs" title={`Presente em ${sess.date}`}>
                                      P
                                    </span>
                                  ) : status === 'late' ? (
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-amber-100 text-amber-800 font-black text-xs" title={`Atraso em ${sess.date}`}>
                                      A
                                    </span>
                                  ) : status === 'excused' ? (
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-sky-100 text-sky-800 font-black text-xs" title={`Justificada (Atestado) em ${sess.date}`}>
                                      J
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-rose-100 text-rose-700 font-black text-xs" title={`Falta em ${sess.date}`}>
                                      F
                                    </span>
                                  )}
                                </td>
                              );
                            })}

                            <td className="py-2.5 px-3 text-center font-mono font-bold bg-slate-50/50">
                              <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                rate < 75 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {rate.toFixed(0)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-1 px-1">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 font-bold text-slate-700">Legenda:</span>
                    <span className="flex items-center gap-1"><span className="w-5 h-5 rounded bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px]">P</span> Presente</span>
                    <span className="flex items-center gap-1"><span className="w-5 h-5 rounded bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-[10px]">A</span> Atraso</span>
                    <span className="flex items-center gap-1"><span className="w-5 h-5 rounded bg-sky-100 text-sky-800 font-bold flex items-center justify-center text-[10px]">J</span> Justificada</span>
                    <span className="flex items-center gap-1"><span className="w-5 h-5 rounded bg-rose-100 text-rose-700 font-bold flex items-center justify-center text-[10px]">F</span> Falta</span>
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>
      ) : activeReportTab === 'detalhado_sessoes' ? (
        /* DETALHADO POR SESSÃO / ATIVIDADE COM HORÁRIOS */
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
            
            {/* Header: Selection & Session Info & Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Selecione a Data / Aula para Ver o Espelho Detalhado:
                </label>
                <select
                  value={activeDetailSession?.id || ''}
                  onChange={(e) => setSelectedSessionDetailId(e.target.value)}
                  className="px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none cursor-pointer max-w-md w-full"
                >
                  {classSessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {formatDateDisplay(s.date)} [{getSessionTimeShort(s)}] — {s.topic} {s.labLocation ? `[${s.labLocation === 'anatomia' ? 'Lab. Anatomia' : s.labLocation === 'histologia' ? 'Lab. Histologia' : 'Anato/Histo'}]` : ''} ({s.activityCategory === 'atividade' || s.activityType?.startsWith('atividade') ? (s.activityType ? getActivityTypeLabel(s.activityType) : 'Atividade') : 'Aula Teórica/Prática'})
                    </option>
                  ))}
                </select>
              </div>

              {activeDetailSession && (
                <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
                  <span className="px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200 text-xs font-bold text-sky-800 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-sky-600" />
                    <span>Horário da Chamada: <strong className="font-mono">{getSessionTimeDisplay(activeDetailSession)}</strong></span>
                  </span>
                  <span className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700">
                    Docente: {activeDetailSession.professorName || 'Não especificado'}
                  </span>
                  {activeDetailSession.labLocation && (
                    <span className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border ${
                      activeDetailSession.labLocation === 'anatomia'
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : activeDetailSession.labLocation === 'histologia'
                        ? 'bg-indigo-100 text-indigo-900 border-indigo-300'
                        : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    }`}>
                      {activeDetailSession.labLocation === 'anatomia' ? '🫀 Lab. de Anatomia' : activeDetailSession.labLocation === 'histologia' ? '🔬 Lab. de Histologia' : '🫀🔬 Anato/Histo'}
                    </span>
                  )}
                  <span className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                    activeDetailSession.activityCategory === 'atividade' || activeDetailSession.activityType?.startsWith('atividade')
                      ? 'bg-sky-100 text-sky-800 border border-sky-300'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}>
                    {activeDetailSession.activityCategory === 'atividade' || activeDetailSession.activityType?.startsWith('atividade')
                      ? (activeDetailSession.activityType ? `${getActivityTypeLabel(activeDetailSession.activityType)} (Chamada Única)` : 'Atividade (Chamada Única)')
                      : 'Aula Teórica / Prática (1ª e 2ª Aulas)'}
                  </span>

                  {/* Actions for this session */}
                  <button
                    onClick={() => handleExportSingleSession(activeDetailSession)}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                    title="Exportar esta chamada individual para Excel (.xlsx)"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Exportar (.xlsx)</span>
                  </button>

                  <button
                    onClick={() => window.print()}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Imprimir espelho desta chamada"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Imprimir</span>
                  </button>
                </div>
              )}
            </div>

            {/* Quick Session Select Chips */}
            {classSessions.length > 1 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Aulas e Chamadas Desta Turma (Clique para alternar):
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                  {classSessions.map(s => {
                    const isCurrent = s.id === activeDetailSession?.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSelectedSessionDetailId(s.id)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                          isCurrent
                            ? 'bg-sky-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/70'
                        }`}
                      >
                        <span>{formatDateDisplay(s.date)}</span>
                        <span className="text-[10px] font-mono opacity-85 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {getSessionTimeShort(s)}
                        </span>
                        <span className="text-[10px] opacity-80 max-w-[100px] truncate">{s.topic}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeDetailSession ? (() => {
              const stats = getSessionStats(activeDetailSession);
              const isActivity = activeDetailSession.activityCategory === 'atividade' || activeDetailSession.activityType?.startsWith('atividade');

              return (
                <div className="space-y-4">
                  {/* KPI metric strip for this specific session */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    <div className="p-3 rounded-2xl bg-sky-50/70 border border-sky-200/80 shadow-2xs">
                      <span className="text-[10px] font-bold text-sky-800 uppercase tracking-wider block">Horário da Chamada</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock className="w-4 h-4 text-sky-600 shrink-0" />
                        <span className="text-xs sm:text-sm font-black text-slate-900 font-mono truncate">{getSessionTimeDisplay(activeDetailSession)}</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/90 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total de Alunos</span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-xl font-black text-slate-900">{stats.total}</span>
                        <span className="text-[11px] text-slate-400 font-semibold">matriculados</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/90 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">1ª Aula</span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-xl font-black text-emerald-700">{stats.p1Count}</span>
                        <span className="text-[11px] text-emerald-600 font-bold">
                          ({stats.total > 0 ? Math.round((stats.p1Count / stats.total) * 100) : 0}%)
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/90 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">2ª Aula</span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-xl font-black text-sky-700">{stats.p2Count}</span>
                        <span className="text-[11px] text-sky-600 font-bold">
                          ({stats.total > 0 ? Math.round((stats.p2Count / stats.total) * 100) : 0}%)
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/90 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Frequência da Aula</span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-xl font-black text-slate-900">{stats.rate}%</span>
                        <span className="text-[11px] text-rose-600 font-bold">({stats.absentCount} faltas)</span>
                      </div>
                    </div>
                  </div>

                  {/* Filter Toolbar within the session view */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Buscar aluno por nome ou RA nesta chamada..."
                        value={detailStudentSearch}
                        onChange={(e) => setDetailStudentSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                      <button
                        onClick={() => setDetailStatusFilter('all')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                          detailStatusFilter === 'all'
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Todos ({stats.total})
                      </button>
                      <button
                        onClick={() => setDetailStatusFilter('present')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                          detailStatusFilter === 'present'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                        }`}
                      >
                        Presentes ({stats.overallPresentCount})
                      </button>
                      <button
                        onClick={() => setDetailStatusFilter('absent')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                          detailStatusFilter === 'absent'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
                        }`}
                      >
                        Faltas ({stats.absentCount})
                      </button>
                    </div>
                  </div>

                  {/* Students Table */}
                  <div className="overflow-x-auto w-full max-w-full border border-slate-100 rounded-2xl">
                    <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                          <th className="py-3 px-3.5 w-12 text-center">Nº</th>
                          <th className="py-3 px-3.5">Aluno</th>
                          <th className="py-3 px-3.5">RA</th>
                          {isActivity ? (
                            <>
                              <th className="py-3 px-3.5 text-center">Horário de Presença</th>
                              <th className="py-3 px-3.5 text-center">Status</th>
                              <th className="py-3 px-3.5 text-center">Método</th>
                            </>
                          ) : (
                            <>
                              <th className="py-3 px-3.5 text-center">1ª Aula</th>
                              <th className="py-3 px-3.5 text-center">2ª Aula</th>
                              <th className="py-3 px-3.5 text-center">Status Geral</th>
                              <th className="py-3 px-3.5 text-center">Método</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detailDisplayedStudents.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                              Nenhum aluno encontrado para os filtros selecionados.
                            </td>
                          </tr>
                        ) : (
                          detailDisplayedStudents.map((st, idx) => {
                            const rec = getStudentAttendanceRecord(activeDetailSession.attendance, st);
                            const p1Start = rec?.p1StartStatus || (rec?.period1Status === 'present' ? 'present' : 'absent');
                            const p1End = rec?.p1EndStatus || (rec?.period1Status === 'present' ? 'present' : 'absent');
                            const p2Start = rec?.p2StartStatus || (rec?.period2Status === 'present' ? 'present' : 'absent');
                            const p2End = rec?.p2EndStatus || (rec?.period2Status === 'present' ? 'present' : 'absent');
                            const isP1 = rec?.period1Status === 'present' || p1Start === 'present' || p1End === 'present';
                            const isP2 = rec?.period2Status === 'present' || p2Start === 'present' || p2End === 'present';
                            const isLate = isRecordLate(rec);
                            const isExcused = isRecordExcused(rec);
                            const overall = isRecordPresent(rec) || isP1 || isP2 ? 'present' : isLate ? 'late' : isExcused ? 'excused' : 'absent';

                            return (
                              <tr key={st.id} className="hover:bg-slate-50/60 transition-colors">
                                <td className="py-3 px-3.5 text-center font-mono text-slate-400 font-bold text-[11px]">
                                  {String(idx + 1).padStart(2, '0')}
                                </td>
                                <td className="py-3 px-3.5 font-bold text-slate-900">
                                  {st.name}
                                </td>
                                <td className="py-3 px-3.5 font-mono text-slate-600">
                                  {st.registrationNumber}
                                </td>

                                {isActivity ? (
                                  <>
                                    <td className="py-3 px-3.5 text-center font-mono font-bold">
                                      {rec?.timestamp || rec?.p1StartTimestamp ? (
                                        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                                          {rec.timestamp || rec.p1StartTimestamp}
                                        </span>
                                      ) : (
                                        <span className="text-slate-400">-</span>
                                      )}
                                    </td>
                                    <td className="py-3 px-3.5 text-center">
                                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                                        overall === 'present' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                      }`}>
                                        {overall === 'present' ? 'Presente' : 'Falta'}
                                      </span>
                                    </td>
                                    <td className="py-3 px-3.5 text-center text-slate-500 font-medium">
                                      {rec?.checkinMethod === 'qrcode' ? (
                                        <span className="inline-flex items-center gap-1 text-sky-700 font-bold">
                                          <QrCode className="w-3.5 h-3.5" /> QR Code
                                        </span>
                                      ) : (
                                        'Manual'
                                      )}
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="py-3 px-3.5 text-center">
                                      <div className="flex flex-col items-center">
                                        <span className={`px-2.5 py-1 rounded-xl text-[10.5px] font-bold ${
                                          isP1 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                                        }`}>
                                          {isP1 ? 'Presente' : 'Falta'}
                                        </span>
                                        {(rec?.period1Timestamp || rec?.p1StartTimestamp || rec?.p1EndTimestamp) && isP1 && (
                                          <span className="text-[10px] font-mono text-slate-500 mt-0.5">
                                            {rec.period1Timestamp || rec.p1StartTimestamp || rec.p1EndTimestamp}
                                          </span>
                                        )}
                                      </div>
                                    </td>

                                    <td className="py-3 px-3.5 text-center">
                                      <div className="flex flex-col items-center">
                                        <span className={`px-2.5 py-1 rounded-xl text-[10.5px] font-bold ${
                                          isP2 ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                                        }`}>
                                          {isP2 ? 'Presente' : 'Falta'}
                                        </span>
                                        {(rec?.period2Timestamp || rec?.p2StartTimestamp || rec?.p2EndTimestamp) && isP2 && (
                                          <span className="text-[10px] font-mono text-slate-500 mt-0.5">
                                            {rec.period2Timestamp || rec.p2StartTimestamp || rec.p2EndTimestamp}
                                          </span>
                                        )}
                                      </div>
                                    </td>

                                    <td className="py-3 px-3.5 text-center">
                                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                                        overall === 'present' ? 'bg-emerald-100 text-emerald-800' : overall === 'late' ? 'bg-amber-100 text-amber-800' : overall === 'excused' ? 'bg-sky-100 text-sky-800' : 'bg-rose-100 text-rose-800'
                                      }`}>
                                        {overall === 'present' ? 'Presente' : overall === 'late' ? 'Atraso' : overall === 'excused' ? 'Justificada' : 'Falta'}
                                      </span>
                                    </td>

                                    <td className="py-3 px-3.5 text-center text-slate-500 font-medium">
                                      {rec?.checkinMethod === 'qrcode' ? (
                                        <span className="inline-flex items-center gap-1 text-sky-700 font-bold">
                                          <QrCode className="w-3.5 h-3.5" /> QR Code
                                        </span>
                                      ) : (
                                        'Manual'
                                      )}
                                    </td>
                                  </>
                                )}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })() : (
              <div className="p-8 text-center text-slate-400 text-xs">
                Nenhuma chamada registrada nesta turma para detalhamento.
              </div>
            )}

          </div>
        </div>
      ) : (
        /* 3. Session History & Management Tab */
        <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-sky-600" />
                Histórico & Gerenciamento de Chamadas
              </h3>
              <p className="text-xs text-slate-500">
                Consulte qualquer chamada anterior com lista completa de presenças, exporte para Excel ou exclua registros.
              </p>
            </div>

            {/* Quick stats pills */}
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
                Total: <strong className="text-slate-900">{classSessions.length}</strong> chamadas
              </span>
              {selectedSessionIds.length > 0 && (
                <span className="px-3 py-1 rounded-xl bg-rose-100 text-rose-800 text-xs font-bold border border-rose-200 animate-pulse">
                  {selectedSessionIds.length} selecionada(s)
                </span>
              )}
            </div>
          </div>

          {/* Controls Bar: Search & Batch Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* Search filter input */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar chamada por tema, data, horário (ex: 07:30) ou docente..."
                  value={sessionSearchQuery}
                  onChange={(e) => setSessionSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {classSessions.length > 0 && (
                <button
                  onClick={() => toggleSelectAllSessions(classSessions)}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>
                    {selectedSessionIds.length === classSessions.length ? 'Desmarcar Todas' : `Selecionar Todas (${classSessions.length})`}
                  </span>
                </button>
              )}

              {selectedSessionIds.length > 0 && (
                <button
                  onClick={() => setBatchDeleteModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir Selecionadas ({selectedSessionIds.length})</span>
                </button>
              )}

              {classSessions.length > 0 && (
                <button
                  onClick={() => setDeleteAllModalOpen(true)}
                  className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200/80 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Excluir todas as chamadas desta turma"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Excluir Todas</span>
                </button>
              )}
            </div>
          </div>

          {/* Sessions List */}
          <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
            {classSessions.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-xs space-y-1">
                <Calendar className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="font-bold text-slate-600">Nenhuma chamada registrada para esta turma.</p>
                <p>Inicie uma nova chamada no painel para registrar presenças.</p>
              </div>
            ) : (
              classSessions
                .filter(session => {
                  if (!sessionSearchQuery.trim()) return true;
                  const query = sessionSearchQuery.toLowerCase();
                  return (
                    (session.topic || '').toLowerCase().includes(query) ||
                    (session.date || '').toLowerCase().includes(query) ||
                    (session.professorName || '').toLowerCase().includes(query) ||
                    (session.startTime || '').toLowerCase().includes(query) ||
                    (session.endTime || '').toLowerCase().includes(query) ||
                    (session.labLocation || '').toLowerCase().includes(query)
                  );
                })
                .map((session) => {
                  const stats = getSessionStats(session);
                  const isSelected = selectedSessionIds.includes(session.id);

                  return (
                    <div 
                      key={session.id} 
                      className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        isSelected ? 'bg-rose-50/60 border-l-4 border-l-rose-500' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-3 flex-1">
                        {/* Checkbox for batch deletion */}
                        <button
                          onClick={() => toggleSelectSession(session.id)}
                          className={`mt-1 w-5 h-5 rounded-lg border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                            isSelected
                              ? 'bg-rose-600 border-rose-600 text-white shadow-xs'
                              : 'bg-white border-slate-300 hover:border-slate-400 text-transparent'
                          }`}
                        >
                          <CheckSquare className="w-3.5 h-3.5" />
                        </button>

                        <div 
                          onClick={() => {
                            setViewingSessionModal(session);
                            playBeep('confirm');
                          }}
                          className="space-y-1.5 cursor-pointer flex-1 group"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-slate-900 group-hover:text-sky-700 transition-colors flex items-center gap-1.5">
                              {session.topic}
                              <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-sky-600 transition-opacity" />
                            </span>
                            <span className="px-2.5 py-0.5 rounded-lg bg-sky-50 text-sky-800 text-[11px] font-bold border border-sky-200">
                              {formatDateDisplay(session.date)}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-bold border border-slate-200 flex items-center gap-1" title="Horário da chamada">
                              <Clock className="w-3 h-3 text-sky-600" />
                              <span>{getSessionTimeDisplay(session)}</span>
                            </span>
                            {session.labLocation && (
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                session.labLocation === 'anatomia'
                                  ? 'bg-amber-50 text-amber-900 border-amber-200'
                                  : session.labLocation === 'histologia'
                                  ? 'bg-indigo-50 text-indigo-900 border-indigo-200'
                                  : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                              }`}>
                                {session.labLocation === 'anatomia' ? '🫀 Anatomia' : session.labLocation === 'histologia' ? '🔬 Histologia' : '🫀🔬 Anato/Histo'}
                              </span>
                            )}
                            {session.activityCategory && (
                              <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 text-[10px] font-bold border border-teal-200 uppercase">
                                {session.activityCategory}
                              </span>
                            )}
                            {session.isLocked ? (
                              <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200 flex items-center gap-1">
                                <Lock className="w-2.5 h-2.5" /> Encerrada
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                                Aberta
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                            <span className="flex items-center gap-1 text-slate-700">
                              <Clock className="w-3.5 h-3.5 text-sky-600" />
                              <span>Horário da Chamada: <strong className="font-mono font-bold text-slate-800">{getSessionTimeDisplay(session)}</strong></span>
                            </span>
                            <span>•</span>
                            <span>Docente: <strong className="text-slate-700">{session.professorName || 'Não especificado'}</strong></span>
                            <span>•</span>
                            <span>Presenças: <strong className="text-emerald-700 font-bold">{stats.overallPresentCount} de {stats.total} ({stats.rate}%)</strong></span>
                            <span>•</span>
                            <span>Faltas: <strong className="text-rose-600 font-bold">{stats.absentCount}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        <button
                          id={`btn-open-call-${session.id}`}
                          onClick={() => {
                            setViewingSessionModal(session);
                            playBeep('confirm');
                          }}
                          className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                          title="Abrir o histórico completo desta chamada no próprio app"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Abrir Chamada</span>
                        </button>

                        <button
                          onClick={() => handleExportSingleSession(session)}
                          className="p-2 sm:px-3 sm:py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Exportar planilha Excel desta chamada"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="hidden sm:inline">Excel</span>
                        </button>

                        <button
                          onClick={() => setDeletingSessionId(session.id)}
                          className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Excluir registro desta chamada"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>Excluir</span>
                        </button>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}

      {/* MODAL: LINHA DO TEMPO INDIVIDUAL DE DATAS DO ALUNO */}
      {selectedStudentHistory && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl max-w-lg w-full space-y-4 animate-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider block">Histórico de Presenças por Data</span>
                <h3 className="text-base font-black text-slate-900 uppercase">
                  {selectedStudentHistory.name}
                </h3>
                <p className="text-xs font-mono text-slate-500">RA: {selectedStudentHistory.registrationNumber}</p>
              </div>
              <button
                onClick={() => setSelectedStudentHistory(null)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-2.5 flex-1 pr-1">
              {classSessions.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">Nenhuma aula registrada para esta turma.</p>
              ) : (
                classSessions.map(sess => {
                  const rec = sess.attendance?.[selectedStudentHistory.id];
                  const isPresent = rec?.status === 'present' || 
                    rec?.period1Status === 'present' || 
                    rec?.period2Status === 'present' || 
                    rec?.p1StartStatus === 'present' || 
                    rec?.p1EndStatus === 'present' || 
                    rec?.p2StartStatus === 'present' || 
                    rec?.p2EndStatus === 'present';
                  const isLate = rec?.status === 'late' || rec?.period1Status === 'late' || rec?.period2Status === 'late';
                  const isExcused = rec?.status === 'excused' || rec?.period1Status === 'excused' || rec?.period2Status === 'excused';
                  const status = isPresent ? 'present' : isLate ? 'late' : isExcused ? 'excused' : 'absent';
                  
                  return (
                    <div key={sess.id} className="p-3 rounded-2xl border border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Calendar className="w-3.5 h-3.5 text-sky-600" />
                          <span className="text-xs font-black text-slate-800">{formatDateDisplay(sess.date)}</span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold font-mono border border-slate-200 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-slate-500" />
                            {getSessionTimeDisplay(sess)}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 truncate max-w-[160px]">{sess.topic}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                          <span>Horário da Chamada: <strong className="text-slate-700 font-mono">{getSessionTimeDisplay(sess)}</strong></span>
                          {rec?.timestamp && (
                            <>
                              <span>•</span>
                              <span>Check-in Aluno: <strong className="text-emerald-700 font-mono">{rec.timestamp}</strong> ({rec.checkinMethod === 'qrcode' ? 'QR Code' : 'Manual'})</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div>
                        {status === 'present' ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                            Presente
                          </span>
                        ) : status === 'late' ? (
                          <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase">
                            Atraso
                          </span>
                        ) : status === 'excused' ? (
                          <span className="px-2.5 py-1 rounded-full bg-sky-100 text-sky-800 text-[10px] font-black uppercase">
                            Justificada
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black uppercase">
                            Falta
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedStudentHistory(null)}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Fechar Histórico
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Single Session Deletion */}
      {deletingSessionId && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl max-w-md w-full space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Excluir Registro de Chamada?
              </h3>
              <p className="text-xs text-slate-500">
                Tem certeza que deseja excluir esta chamada e todos os seus registros de presença associados? As estatísticas dos alunos serão recalculadas automaticamente.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeletingSessionId(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                onClick={handleConfirmDeleteSession}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
              >
                Sim, Excluir Registro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Batch Session Deletion */}
      {batchDeleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl max-w-md w-full space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Excluir {selectedSessionIds.length} Chamadas Selecionadas?
              </h3>
              <p className="text-xs text-slate-500">
                Você está prestes a excluir definitivamente {selectedSessionIds.length} chamadas desta turma. As presenças e faltas associadas serão removidas e recalculadas.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setBatchDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                onClick={handleConfirmBatchDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
              >
                Excluir {selectedSessionIds.length} Chamadas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Delete All Sessions of Class */}
      {deleteAllModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 border border-rose-200 shadow-2xl max-w-md w-full space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-rose-900">
                Excluir TODAS as Chamadas da Turma?
              </h3>
              <p className="text-xs text-slate-600">
                Tem certeza que deseja apagar todas as {classSessions.length} chamadas registradas para a turma <strong>{selectedClass?.name}</strong>? Esta operação limpará todo o histórico de presenças desta turma.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeleteAllModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                onClick={handleConfirmDeleteAllSessions}
                className="px-5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
              >
                Sim, Excluir Todas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VISUALIZADOR IN-APP DO HISTÓRICO DA CHAMADA */}
      {viewingSessionModal && (() => {
        const stats = getSessionStats(viewingSessionModal);
        const isActivity = viewingSessionModal.activityCategory === 'atividade' || viewingSessionModal.activityType?.startsWith('atividade');

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col animate-in zoom-in-95 overflow-hidden">
              
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-md bg-sky-100 text-sky-800 text-[10px] font-extrabold uppercase tracking-wide border border-sky-200 flex items-center gap-1">
                      <FolderOpen className="w-3 h-3" />
                      Espelho da Chamada
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-slate-200 text-slate-800 text-[10px] font-bold border border-slate-300">
                      {formatDateDisplay(viewingSessionModal.date)}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-sky-50 text-sky-800 text-[10px] font-bold border border-sky-200 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-sky-600" />
                      Horário: {getSessionTimeDisplay(viewingSessionModal)}
                    </span>
                    {viewingSessionModal.labLocation && (
                      <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${
                        viewingSessionModal.labLocation === 'anatomia'
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : viewingSessionModal.labLocation === 'histologia'
                          ? 'bg-indigo-100 text-indigo-900 border-indigo-300'
                          : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      }`}>
                        {viewingSessionModal.labLocation === 'anatomia' ? '🫀 Lab. de Anatomia' : viewingSessionModal.labLocation === 'histologia' ? '🔬 Lab. de Histologia' : '🫀🔬 Anato/Histo'}
                      </span>
                    )}
                    {viewingSessionModal.isLocked ? (
                      <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-bold border border-rose-200 flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" />
                        Encerrada
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                        Aberta
                      </span>
                    )}
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                    {viewingSessionModal.topic}
                  </h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                    <span>Turma: <strong className="text-slate-800">{selectedClass?.name}</strong></span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-sky-600" />
                      <span>Horário da Chamada: <strong className="text-slate-800 font-mono">{getSessionTimeDisplay(viewingSessionModal)}</strong></span>
                    </span>
                    <span>•</span>
                    <span>Docente: <strong className="text-slate-800">{viewingSessionModal.professorName || 'Não especificado'}</strong></span>
                  </p>
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap">
                  <button
                    onClick={() => handleExportSingleSession(viewingSessionModal)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                    title="Exportar esta chamada para Excel (.xlsx)"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Excel (.xlsx)</span>
                  </button>

                  <button
                    onClick={() => window.print()}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Imprimir espelho desta chamada"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Imprimir</span>
                  </button>

                  <button
                    onClick={() => {
                      setViewingSessionModal(null);
                      setModalStudentSearch('');
                      setModalStatusFilter('all');
                    }}
                    className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                    title="Fechar modal"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* KPI Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-4 sm:p-5 border-b border-slate-100 bg-slate-50/30">
                <div className="p-3 rounded-2xl bg-sky-50/70 border border-sky-200/80 shadow-2xs">
                  <span className="text-[10px] font-bold text-sky-800 uppercase tracking-wider block">Horário da Chamada</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Clock className="w-4 h-4 text-sky-600 shrink-0" />
                    <span className="text-xs sm:text-sm font-black text-slate-900 font-mono truncate">{getSessionTimeDisplay(viewingSessionModal)}</span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Matriculados</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-xl font-black text-slate-900">{stats.total}</span>
                    <span className="text-[11px] text-slate-400 font-semibold">alunos</span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">1ª Aula</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-xl font-black text-emerald-700">{stats.p1Count}</span>
                    <span className="text-[11px] text-emerald-600 font-bold">
                      ({stats.total > 0 ? Math.round((stats.p1Count / stats.total) * 100) : 0}%)
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">2ª Aula</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-xl font-black text-sky-700">{stats.p2Count}</span>
                    <span className="text-[11px] text-sky-600 font-bold">
                      ({stats.total > 0 ? Math.round((stats.p2Count / stats.total) * 100) : 0}%)
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Frequência Geral</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-xl font-black text-slate-900">{stats.rate}%</span>
                    <span className="text-[11px] text-rose-600 font-bold">({stats.absentCount} faltas)</span>
                  </div>
                </div>
              </div>

              {/* Toolbar: Search and Filter inside modal */}
              <div className="p-3 sm:px-5 sm:py-3 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar aluno por nome ou RA nesta chamada..."
                    value={modalStudentSearch}
                    onChange={(e) => setModalStudentSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <button
                    onClick={() => setModalStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      modalStatusFilter === 'all'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Todos ({stats.total})
                  </button>
                  <button
                    onClick={() => setModalStatusFilter('present')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      modalStatusFilter === 'present'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    }`}
                  >
                    Presentes ({stats.overallPresentCount})
                  </button>
                  <button
                    onClick={() => setModalStatusFilter('absent')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      modalStatusFilter === 'absent'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
                    }`}
                  >
                    Faltas ({stats.absentCount})
                  </button>
                </div>
              </div>

              {/* Table of Students in the session */}
              <div className="overflow-y-auto overflow-x-auto flex-1 p-0">
                <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                  <thead className="sticky top-0 bg-slate-100 z-10 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">Nº</th>
                      <th className="py-2.5 px-3.5">Aluno</th>
                      <th className="py-2.5 px-3">RA</th>
                      {isActivity ? (
                        <>
                          <th className="py-2.5 px-3 text-center">Horário</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3 text-center">Método</th>
                        </>
                      ) : (
                        <>
                          <th className="py-2.5 px-3 text-center">1ª Aula</th>
                          <th className="py-2.5 px-3 text-center">2ª Aula</th>
                          <th className="py-2.5 px-3 text-center">Status Geral</th>
                          <th className="py-2.5 px-3 text-center">Método</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {modalDisplayedStudents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                          Nenhum aluno encontrado para os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      modalDisplayedStudents.map((st, idx) => {
                        const rec = getStudentAttendanceRecord(viewingSessionModal.attendance, st);
                        const p1Start = rec?.p1StartStatus || (rec?.period1Status === 'present' ? 'present' : 'absent');
                        const p1End = rec?.p1EndStatus || (rec?.period1Status === 'present' ? 'present' : 'absent');
                        const p2Start = rec?.p2StartStatus || (rec?.period2Status === 'present' ? 'present' : 'absent');
                        const p2End = rec?.p2EndStatus || (rec?.period2Status === 'present' ? 'present' : 'absent');
                        const isP1 = rec?.period1Status === 'present' || p1Start === 'present' || p1End === 'present';
                        const isP2 = rec?.period2Status === 'present' || p2Start === 'present' || p2End === 'present';
                        const isLate = isRecordLate(rec);
                        const isExcused = isRecordExcused(rec);
                        const overall = isRecordPresent(rec) || isP1 || isP2 ? 'present' : isLate ? 'late' : isExcused ? 'excused' : 'absent';

                        return (
                          <tr key={st.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-3 text-center font-mono text-slate-400 font-bold text-[11px]">
                              {String(idx + 1).padStart(2, '0')}
                            </td>
                            <td className="py-2.5 px-3.5 font-bold text-slate-900">
                              {st.name}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-600">
                              {st.registrationNumber}
                            </td>

                            {isActivity ? (
                              <>
                                <td className="py-2.5 px-3 text-center font-mono">
                                  {rec?.timestamp || rec?.p1StartTimestamp ? (
                                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[10.5px]">
                                      {rec.timestamp || rec.p1StartTimestamp}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                    overall === 'present' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                  }`}>
                                    {overall === 'present' ? 'Presente' : 'Falta'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center text-slate-500 font-medium text-[11px]">
                                  {rec?.checkinMethod === 'qrcode' ? (
                                    <span className="inline-flex items-center gap-1 text-sky-700 font-bold">
                                      <QrCode className="w-3 h-3" /> QR Code
                                    </span>
                                  ) : (
                                    'Manual'
                                  )}
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="py-2.5 px-3 text-center">
                                  <div className="flex flex-col items-center">
                                    <span className={`px-2.5 py-0.5 rounded-lg text-[10.5px] font-bold ${
                                      isP1 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                                    }`}>
                                      {isP1 ? 'Presente' : 'Falta'}
                                    </span>
                                    {(rec?.period1Timestamp || rec?.p1StartTimestamp || rec?.p1EndTimestamp) && isP1 && (
                                      <span className="text-[9.5px] font-mono text-slate-500 mt-0.5">
                                        {rec.period1Timestamp || rec.p1StartTimestamp || rec.p1EndTimestamp}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                <td className="py-2.5 px-3 text-center">
                                  <div className="flex flex-col items-center">
                                    <span className={`px-2.5 py-0.5 rounded-lg text-[10.5px] font-bold ${
                                      isP2 ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                                    }`}>
                                      {isP2 ? 'Presente' : 'Falta'}
                                    </span>
                                    {(rec?.period2Timestamp || rec?.p2StartTimestamp || rec?.p2EndTimestamp) && isP2 && (
                                      <span className="text-[9.5px] font-mono text-slate-500 mt-0.5">
                                        {rec.period2Timestamp || rec.p2StartTimestamp || rec.p2EndTimestamp}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                <td className="py-2.5 px-3 text-center">
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                    overall === 'present' ? 'bg-emerald-100 text-emerald-800' : overall === 'late' ? 'bg-amber-100 text-amber-800' : overall === 'excused' ? 'bg-sky-100 text-sky-800' : 'bg-rose-100 text-rose-800'
                                  }`}>
                                    {overall === 'present' ? 'Presente' : overall === 'late' ? 'Atraso' : overall === 'excused' ? 'Justificada' : 'Falta'}
                                  </span>
                                </td>

                                <td className="py-2.5 px-3 text-center text-slate-500 font-medium text-[11px]">
                                  {rec?.checkinMethod === 'qrcode' ? (
                                    <span className="inline-flex items-center gap-1 text-sky-700 font-bold">
                                      <QrCode className="w-3 h-3" /> QR Code
                                    </span>
                                  ) : (
                                    'Manual'
                                  )}
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Modal Footer */}
              <div className="p-4 sm:px-5 sm:py-3 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-xs text-slate-500">
                  Exibindo <strong>{modalDisplayedStudents.length}</strong> de <strong>{classStudents.length}</strong> alunos
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedSessionDetailId(viewingSessionModal.id);
                      setActiveReportTab('detalhado_sessoes');
                      setViewingSessionModal(null);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold border border-sky-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Ver no Espelho em Tela Cheia</span>
                  </button>

                  <button
                    onClick={() => {
                      setViewingSessionModal(null);
                      setModalStudentSearch('');
                      setModalStatusFilter('all');
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Gemini AI Insights Modal */}
      {geminiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-inner">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Gemini AI • Análise de Frequência & Insights</h3>
                  <p className="text-xs text-slate-400">Turma: {selectedClass?.name}</p>
                </div>
              </div>
              <button
                onClick={() => setGeminiModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs text-slate-300 leading-relaxed min-h-[160px] max-h-[350px] overflow-y-auto">
              {geminiLoading ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-3">
                  <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin"></div>
                  <p className="text-slate-400 font-medium">Analisando dados com Google Gemini AI...</p>
                </div>
              ) : (
                <div className="whitespace-pre-line font-medium text-slate-200">
                  {geminiResult}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setGeminiModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
