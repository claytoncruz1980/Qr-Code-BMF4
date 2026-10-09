import React, { useState } from 'react';
import { 
  Building2, 
  Clock, 
  Volume2, 
  VolumeX, 
  ShieldCheck, 
  RotateCcw, 
  Download, 
  Printer, 
  Check, 
  Sliders,
  Sparkles,
  Info,
  Layers,
  Database,
  Smartphone,
  Tv,
  Lock,
  RefreshCw,
  UserCheck,
  AlertTriangle,
  UserPlus,
  Monitor,
  Tablet,
  Laptop,
  Wifi,
  Radio,
  Signal,
  CheckCircle2,
  Globe,
  UploadCloud,
  Inbox,
  CheckCircle,
  AlertCircle,
  Clock3,
  Trash2,
  Calendar,
  FileText,
  FileJson,
  Upload,
  Copy,
  ExternalLink,
  Terminal
} from 'lucide-react';
import { useLab } from '../context/LabContext';
import { getSupabaseUrl, getSupabaseAnonKey, saveSupabaseConfig, isSupabaseConfigured, TARGET_SUPABASE_PROJECT_URL, supabase } from '../lib/supabase';
import { runSupabaseAudit, getSupabaseMigrationSQL, SupabaseAuditReport } from '../utils/supabaseAuditor';

interface SettingsViewProps {
  onOpenGoogleCalendar?: () => void;
  onOpenGoogleForms?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = () => {
  const { 
    appSettings, 
    updateAppSettings, 
    soundEnabled, 
    setSoundEnabled, 
    resetAllData, 
    classes, 
    students,
    activeSession,
    playBeep,
    deviceFingerprint,
    resetDeviceLockForTesting,
    connectedDevicesList,
    customDeviceName,
    setCustomDeviceName,
    deviceType,
    setDeviceType,
    isOnline,
    realtimeConnected,
    lastSyncDate,
    triggerSync,
    isSyncing,
    outboxQueue,
    outboxPendingCount,
    isOutboxSyncing,
    enqueueOutboxItem,
    processOutboxQueue,
    clearSyncedOutbox,
    clearAllOutbox,
    professors,
    sessions,
    justifications,
    studentGrades,
    deletedStudentIds,
    deletedClassIds,
    deletedProfessorIds,
    deletedSessionIds
  } = useLab();

  const [instName, setInstName] = useState(appSettings.institutionName || 'UNINOVE MEDICINA');
  const [tolerance, setTolerance] = useState(String(appSettings.toleranceMinutes || 15));
  const [autoLock, setAutoLock] = useState(appSettings.autoLockMinutes || 60);
  const [antiFraudMode, setAntiFraudMode] = useState(appSettings.antiFraudMode || 'ultra_secure_tv');
  const [tokenRotation, setTokenRotation] = useState(appSettings.tokenRotationSeconds || 10);
  const [singleDeviceLock, setSingleDeviceLock] = useState(appSettings.singleDeviceLock ?? true);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const [auditReport, setAuditReport] = useState<SupabaseAuditReport | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [supabaseAnonKeyInput, setSupabaseAnonKeyInput] = useState(() => {
    const k = getSupabaseAnonKey();
    return k.includes('placeholder') ? '' : k;
  });
  const [copiedSqlSuccess, setCopiedSqlSuccess] = useState(false);
  const [syncAllSupabaseLoading, setSyncAllSupabaseLoading] = useState(false);

  const handleRunAudit = async () => {
    setIsAuditing(true);
    try {
      const rep = await runSupabaseAudit();
      setAuditReport(rep);
      showFeedback(rep.summary);
    } catch (e: any) {
      showFeedback('Erro ao auditar Supabase: ' + (e?.message || e));
    } finally {
      setIsAuditing(false);
    }
  };

  const handleSaveAnonKey = () => {
    if (!supabaseAnonKeyInput.trim()) {
      showFeedback('Digite a chave Anon Key do projeto Supabase.');
      return;
    }
    saveSupabaseConfig(TARGET_SUPABASE_PROJECT_URL, supabaseAnonKeyInput.trim());
    showFeedback('Chave Anon salva! Executando auditoria do banco...');
    handleRunAudit();
  };

  const handleCopyMigrationSql = () => {
    const sql = getSupabaseMigrationSQL();
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(sql);
      setCopiedSqlSuccess(true);
      playBeep('confirm');
      showFeedback('Script SQL completo copiado! Cole no SQL Editor do Supabase.');
      setTimeout(() => setCopiedSqlSuccess(false), 3500);
    }
  };

  const handlePushAllToSupabase = async () => {
    setSyncAllSupabaseLoading(true);
    try {
      if (classes.length > 0) {
        await supabase.from('classes').upsert(classes.map(c => ({
          id: c.id,
          name: c.name,
          code: c.code,
          discipline: c.discipline || 'BMF4',
          laboratory_room: c.laboratoryRoom,
          schedule: c.schedule,
          total_students: c.totalStudents,
          professor_name: c.professorName,
          professor_id: c.professorId,
        })), { onConflict: 'id' });
      }
      if (students.length > 0) {
        await supabase.from('students').upsert(students.map(s => ({
          id: s.id,
          name: s.name,
          registration_number: s.registrationNumber,
          email: s.email,
          class_group_id: s.classGroupId,
          discipline: s.discipline,
          course: s.course,
        })), { onConflict: 'id' });
      }
      if (professors.length > 0) {
        await supabase.from('teachers').upsert(professors.map(p => ({
          id: p.id,
          name: p.name,
          email: p.email,
          pin: p.pin,
          role: p.role,
        })), { onConflict: 'id' });
      }
      if (sessions.length > 0) {
        await supabase.from('sessions').upsert(sessions.map(s => ({
          id: s.id,
          class_group_id: s.classGroupId,
          topic: s.topic,
          date: s.date,
          start_time: s.startTime,
          attendance: s.attendance,
          is_live: s.isLive,
          is_locked: s.isLocked,
          active_period: s.activePeriod,
          version: s.version || 1,
          last_update_timestamp: s.lastUpdateTimestamp || Date.now(),
        })), { onConflict: 'id' });
      }
      if (justifications && justifications.length > 0) {
        await supabase.from('justifications').upsert(justifications.map(j => ({
          id: j.id,
          student_id: j.studentId,
          student_name: j.studentName,
          student_ra: j.studentRa,
          class_group_id: j.classGroupId,
          session_id: j.sessionId,
          date: j.date,
          period: j.period,
          description: j.description,
          status: j.status,
          doc_number: j.documentNumber,
          attachment_name: j.attachmentName,
          attachment_url: j.attachmentUrl,
        })), { onConflict: 'id' });
      }
      if (studentGrades && studentGrades.length > 0) {
        await supabase.from('student_grades').upsert(studentGrades.map(g => ({
          id: (g as any).id || `${g.studentId}_${g.classGroupId}`,
          student_id: g.studentId,
          class_group_id: g.classGroupId,
          scores: g.scores || {},
          substitute_exam_score: g.substituteExamScore,
          notes: g.notes,
          updated_at: g.updatedAt || new Date().toISOString(),
        })), { onConflict: 'id' });
      }
      if (appSettings) {
        await supabase.from('app_settings').upsert({
          id: 'global_settings',
          settings_payload: appSettings,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
      }
      showFeedback('Todos os dados (turmas, alunos, sessões, notas) foram salvos no Supabase!');
      await handleRunAudit();
    } catch (err: any) {
      showFeedback('Erro ao enviar dados para o Supabase: ' + (err?.message || err));
    } finally {
      setSyncAllSupabaseLoading(false);
    }
  };

  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    playBeep('success');
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateAppSettings({
      institutionName: instName,
      toleranceMinutes: Number(tolerance),
      autoLockMinutes: Number(autoLock),
      antiFraudMode,
      tokenRotationSeconds: Number(tokenRotation),
      singleDeviceLock,
    });
    showFeedback('Configurações salvas com sucesso!');
    playBeep('confirm');
  };

  const handleExportBackup = () => {
    try {
      const backupData = {
        version: '2.0',
        exportDate: new Date().toISOString(),
        application: 'Medicina BMF4 Presenca',
        students,
        classes,
        professors,
        sessions,
        justifications,
        studentGrades,
        appSettings,
        deletedStudentIds,
        deletedClassIds,
        deletedProfessorIds,
        deletedSessionIds
      };
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_bmf4_medicina_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showFeedback('Backup exportado com sucesso!');
      playBeep('success');
    } catch (e: any) {
      showFeedback('Erro ao exportar backup: ' + (e?.message || e));
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json && (json.students || json.classes)) {
          if (confirm('Deseja restaurar este backup? Os dados atuais serão mesclados com o arquivo.')) {
            if (Array.isArray(json.students)) localStorage.setItem('bmf4_students', JSON.stringify(json.students));
            if (Array.isArray(json.classes)) localStorage.setItem('bmf4_classes', JSON.stringify(json.classes));
            if (Array.isArray(json.sessions)) localStorage.setItem('bmf4_sessions', JSON.stringify(json.sessions));
            if (Array.isArray(json.professors)) localStorage.setItem('bmf4_professors', JSON.stringify(json.professors));
            if (Array.isArray(json.justifications)) localStorage.setItem('bmf4_justifications', JSON.stringify(json.justifications));
            if (Array.isArray(json.studentGrades)) localStorage.setItem('bmf4_student_grades', JSON.stringify(json.studentGrades));
            if (json.appSettings) localStorage.setItem('bmf4_settings', JSON.stringify(json.appSettings));
            showFeedback('Backup restaurado! Recarregando aplicação...');
            playBeep('success');
            setTimeout(() => window.location.reload(), 1200);
          }
        } else {
          showFeedback('Arquivo de backup inválido.');
        }
      } catch (err: any) {
        showFeedback('Erro ao ler arquivo JSON: ' + (err?.message || err));
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in">
      
      {/* Toast Feedback */}
      {feedbackMessage && (
        <div className="p-4 rounded-2xl bg-teal-600 text-white text-xs font-bold shadow-lg flex items-center justify-between animate-in fade-in slide-in-from-top-2 z-50">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Sliders className="w-6 h-6 text-teal-600" />
            Ajustes e Configurações do Sistema
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Gerencie parâmetros da instituição, preferências de áudio, segurança do telão e auditoria de dados.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Form Settings */}
        <div className="md:col-span-2 space-y-6">
          
          {/* General Parameters */}
          <form onSubmit={handleSave} className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-5">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-teal-600" />
              Parâmetros Institucionais
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nome da Instituição</label>
                <input
                  type="text"
                  value={instName}
                  onChange={(e) => setInstName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tolerância de Atraso (Minutos)</label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={tolerance}
                    onChange={(e) => setTolerance(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Bloqueio Automático (Minutos)</label>
                  <input
                    type="number"
                    min={10}
                    max={240}
                    value={autoLock}
                    onChange={(e) => setAutoLock(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer shadow-xs"
              >
                Salvar Alterações
              </button>
            </div>
          </form>

          {/* Anti-Fraud Shield */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Proteção Anti-Fraude para Telão / TV Universitária
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase">
                Blindagem Ativa
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Recursos projetados especificamente para evitar que alunos tirem fotos do telão e enviem por WhatsApp para colegas ausentes registrarem presença.
            </p>

            {/* Mode Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div 
                onClick={() => {
                  setAntiFraudMode('ultra_secure_tv');
                  setTokenRotation(10);
                  setSingleDeviceLock(true);
                }}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  antiFraudMode === 'ultra_secure_tv'
                    ? 'bg-sky-50/70 border-sky-500 shadow-xs'
                    : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/60'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-sky-600" />
                    Ultra-Seguro TV (Recomendado)
                  </span>
                  {antiFraudMode === 'ultra_secure_tv' && (
                    <Check className="w-4 h-4 text-sky-600" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  QR rotativo a cada 10s + bloqueio de 1 presença por celular físico + marca d'água no telão.
                </p>
              </div>

              <div 
                onClick={() => {
                  setAntiFraudMode('standard_dynamic');
                  setTokenRotation(15);
                }}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  antiFraudMode === 'standard_dynamic'
                    ? 'bg-sky-50/70 border-sky-500 shadow-xs'
                    : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/60'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <RefreshCw className="w-4 h-4 text-slate-600" />
                    Dinâmico Balanceado
                  </span>
                  {antiFraudMode === 'standard_dynamic' && (
                    <Check className="w-4 h-4 text-sky-600" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Ciclo de 15 segundos para salas maiores ou com menor densidade de rede.
                </p>
              </div>
            </div>
          </div>

          {/* Supabase Auditor & Migration Center */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Database className="w-5 h-5 text-emerald-600" />
                  Auditoria do Banco Supabase & Central de Migrações
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Projeto Oficial: <span className="font-mono font-bold text-slate-800">{TARGET_SUPABASE_PROJECT_URL}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  realtimeConnected || isOnline 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${realtimeConnected || isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  {realtimeConnected || isOnline ? 'Supabase Realtime Ativo' : 'Realtime Reconectando'}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-amber-950">
                <Info className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Status da Conexão e Sincronização em Tempo Real</span>
              </div>
              <p className="text-[11.5px] leading-relaxed text-amber-800">
                Todas as tabelas do aplicativo (turmas, alunos, sessões, presenças e notas) estão configuradas para sincronização instantânea em tempo real via Supabase.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleRunAudit}
                disabled={isAuditing}
                className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isAuditing ? 'animate-spin text-emerald-400' : ''}`} />
                <span>{isAuditing ? 'Verificando Banco...' : 'Auditar Tabelas Agora'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyMigrationSql}
                className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer shadow-xs"
              >
                {copiedSqlSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>Script SQL Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-white" />
                    <span>Copiar Script SQL Completo</span>
                  </>
                )}
              </button>

              <a
                href="https://supabase.com/dashboard/project/yigwabbmjvzjajtwjkho/sql/new"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xs"
              >
                <ExternalLink className="w-3.5 h-3.5 text-white" />
                <span>Abrir SQL Editor Supabase</span>
              </a>

              <button
                type="button"
                onClick={handlePushAllToSupabase}
                disabled={syncAllSupabaseLoading}
                className="px-3.5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                <UploadCloud className={`w-3.5 h-3.5 ${syncAllSupabaseLoading ? 'animate-spin' : ''}`} />
                <span>{syncAllSupabaseLoading ? 'Salvando na Nuvem...' : 'Gravar Dados no Supabase'}</span>
              </button>
            </div>

            {auditReport && (
              <div className="space-y-3 pt-2">
                <div className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between ${
                  auditReport.overallStatus === 'healthy'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : auditReport.overallStatus === 'missing_tables'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}>
                  <div className="flex items-center gap-2">
                    {auditReport.overallStatus === 'healthy' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <span className="font-semibold">{auditReport.summary}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { key: 'classes', label: 'Turmas (classes)' },
                    { key: 'sessions', label: 'Chamadas (sessions)' },
                    { key: 'students', label: 'Alunos (students)' },
                    { key: 'teachers', label: 'Docentes (teachers)' },
                    { key: 'attendance_records', label: 'Presenças (records)' },
                    { key: 'justifications', label: 'Atestados (justif.)' },
                    { key: 'student_grades', label: 'Notas BMF4 (grades)' },
                    { key: 'app_settings', label: 'Configurações (settings)' },
                  ].map(({ key, label }) => {
                    const tStatus = auditReport.tables[key];
                    const exists = tStatus?.exists ?? false;
                    return (
                      <div 
                        key={key} 
                        className={`p-3 rounded-2xl border transition-all ${
                          exists 
                            ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950' 
                            : 'bg-rose-50/60 border-rose-200 text-rose-950'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[11px] font-black truncate">{label}</span>
                          <span className={`w-2 h-2 rounded-full ${exists ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        </div>
                        <div className="text-[10px] text-slate-600">
                          {exists ? (
                            <span className="text-emerald-700 font-bold">Ativa • {tStatus?.rowCount ?? 0}</span>
                          ) : (
                            <span className="text-rose-600 font-bold">Ausente</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Audio & Backup */}
        <div className="space-y-6">
          
          {/* Sound Toggle */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              {soundEnabled ? <Volume2 className="w-4 h-4 text-teal-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
              Efeitos Sonoros do Sistema
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Ativa os alertas sonoros ao registrar presenças, leituras de QR Code, atrasos e avisos.
            </p>
            <button
              type="button"
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                if (next) playBeep('confirm');
              }}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs ${
                soundEnabled 
                  ? 'bg-teal-500 hover:bg-teal-600 text-slate-950' 
                  : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span>{soundEnabled ? 'Áudio Habilitado (Com Som)' : 'Áudio Desabilitado (Silencioso)'}</span>
            </button>
          </div>

          {/* Backup & Restore */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileJson className="w-4 h-4 text-indigo-600" />
              Backup e Restauração em JSON
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Exporte ou importe todos os dados cadastrados (alunos, turmas, chamadas, notas) em um arquivo JSON.
            </p>

            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={handleExportBackup}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Exportar Backup em JSON</span>
              </button>

              <label className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer shadow-2xs">
                <Upload className="w-4 h-4" />
                <span>Restaurar de Arquivo JSON</span>
                <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
              </label>
            </div>
          </div>

          {/* Reset System Data */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-rose-200 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-rose-900 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-rose-600" />
              Zerar e Limpar Dados do Sistema
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Remove todos os dados locais e limpa as tabelas no Supabase.
            </p>

            {!confirmResetOpen ? (
              <button
                type="button"
                onClick={() => setConfirmResetOpen(true)}
                className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer shadow-2xs"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Limpar Tudo (Zerar Sistema)</span>
              </button>
            ) : (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 space-y-3">
                <p className="text-xs font-bold text-rose-900">
                  Tem certeza absoluta? Todos os registros e notas serão apagados permanentemente.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      resetAllData();
                      setConfirmResetOpen(false);
                      showFeedback('Sistema limpo com sucesso.');
                    }}
                    className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer shadow-xs"
                  >
                    Sim, Limpar Tudo
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmResetOpen(false)}
                    className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
