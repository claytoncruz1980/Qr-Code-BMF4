import React, { useState, useMemo } from 'react';
import { 
  Search, 
  CheckCheck, 
  RotateCcw, 
  Sparkles, 
  Tv, 
  ShieldCheck, 
  Clock, 
  Filter, 
  SlidersHorizontal,
  Table as TableIcon,
  LayoutGrid,
  Info,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle
} from 'lucide-react';
import { useLab } from '../context/LabContext';
import { AttendanceStatus } from '../types';
import { StudentAvatar } from './StudentAvatar';
import { matchStudentClass } from '../utils/attendanceHelpers';

interface LiveAttendanceProps {
  onOpenProjectionScreen: () => void;
  onOpenQuickPicker: () => void;
}

export const LiveAttendance: React.FC<LiveAttendanceProps> = ({
  onOpenProjectionScreen,
  onOpenQuickPicker,
}) => {
  const { 
    students, 
    selectedClassId, 
    classes, 
    activeSession, 
    setAttendanceStatus, 
    markAllPresent, 
    resetCurrentAttendance,
    updateBenchAssignment,
    benches
  } = useLab();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBenchFilter, setSelectedBenchFilter] = useState<number | 'all'>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<AttendanceStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list');

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const classStudents = useMemo(() => {
    return students
      .filter(s => matchStudentClass(s.classGroupId, selectedClassId, classes))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [students, selectedClassId, classes]);

  // Attendance metrics calculation
  const metrics = useMemo(() => {
    if (!activeSession) return { total: 0, present: 0, absent: 0, late: 0, excused: 0, rate: 0 };
    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;

    classStudents.forEach(st => {
      const record = activeSession.attendance[st.id];
      const status = record?.status || 'absent';
      if (status === 'present') present++;
      else if (status === 'absent') absent++;
      else if (status === 'late') late++;
      else if (status === 'excused') excused++;
    });

    const total = classStudents.length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
    return { total, present, absent, late, excused, rate };
  }, [activeSession, classStudents]);

  // Filter students
  const filteredStudents = useMemo(() => {
    return classStudents
      .filter(st => {
        const record = activeSession?.attendance[st.id];
        const status = record?.status || 'absent';
        const benchId = record?.benchId || st.defaultBenchId || 1;

        const matchesSearch = 
          st.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          st.registrationNumber.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesBench = selectedBenchFilter === 'all' || benchId === selectedBenchFilter;
        const matchesStatus = selectedStatusFilter === 'all' || status === selectedStatusFilter;

        return matchesSearch && matchesBench && matchesStatus;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [classStudents, activeSession, searchTerm, selectedBenchFilter, selectedStatusFilter]);

  if (!selectedClass) {
    return (
      <div className="p-8 text-center text-slate-500">
        Nenhuma turma selecionada.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Practical Session Overview Banner */}
      {activeSession ? (
        <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 rounded-2xl p-6 border border-slate-800 text-white shadow-lg relative overflow-hidden">
          <div className="absolute right-0 top-0 w-96 h-full bg-teal-500/5 blur-3xl rounded-full pointer-events-none" />
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-teal-950 border border-teal-800 text-teal-300">
                  {selectedClass.name}
                </span>
                <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {selectedClass.laboratoryRoom}
                </span>
                <span className="px-2.5 py-0.5 text-xs font-mono font-bold rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                  Cód: {activeSession.checkinCode}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <span>🫀</span> {activeSession.topic}
              </h2>

              <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span><strong>Data:</strong> {activeSession.date} ({activeSession.startTime} - {activeSession.endTime})</span>
                <span><strong>Professor(a):</strong> {selectedClass.professorName}</span>
                {selectedClass.monitorName && <span><strong>Monitor:</strong> {selectedClass.monitorName}</span>}
              </div>

              {/* Specimens list */}
              {activeSession.anatomicalSpecimens && activeSession.anatomicalSpecimens.length > 0 && (
                <div className="pt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-400">Peças em estudo:</span>
                  {activeSession.anatomicalSpecimens.map((specimen, idx) => (
                    <span key={idx} className="px-2 py-0.5 text-[11px] rounded bg-slate-800/80 text-teal-200 border border-slate-700">
                      {specimen}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Metrics & Projection Screen Button */}
            <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-3 shrink-0">
              <div className="flex items-center gap-3 bg-slate-800/90 border border-slate-700/80 rounded-xl px-4 py-2.5">
                <div className="text-right">
                  <div className="text-2xl font-black text-teal-400 leading-none">
                    {metrics.present + metrics.late}/{metrics.total}
                  </div>
                  <div className="text-[11px] text-slate-400 font-medium">Presença ({metrics.rate}%)</div>
                </div>
                
                <div className="w-12 h-12 rounded-full border-4 border-slate-700 flex items-center justify-center relative">
                  <span className="text-xs font-bold text-slate-200">{metrics.rate}%</span>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  id="btn-abrir-telao-lab"
                  onClick={onOpenProjectionScreen}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/20 transition-all active:scale-95"
                >
                  <Tv className="w-4 h-4" />
                  Abrir Telão do Lab
                </button>

                <button
                  id="btn-sortear-aluno-pratica"
                  onClick={onOpenQuickPicker}
                  title="Sortear Aluno Presente para Arguição Prática"
                  className="p-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Info className="w-5 h-5 text-amber-600 shrink-0" />
            <p className="text-sm font-medium">Nenhuma aula prática ativa para esta turma no momento.</p>
          </div>
        </div>
      )}

      {/* Control Bar: Search, Filters & Fast Batch Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="input-busca-aluno-chamada"
              type="text"
              placeholder="Buscar aluno por nome ou matrícula/RA..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Bench Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              id="filter-bancada"
              value={selectedBenchFilter}
              onChange={(e) => setSelectedBenchFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">Todas as Bancadas (1 a 6)</option>
              {benches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              id="filter-status"
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value as AttendanceStatus | 'all')}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">Todos os Status</option>
              <option value="present">Presentes ({metrics.present})</option>
              <option value="absent">Ausentes ({metrics.absent})</option>
              <option value="late">Atrasados ({metrics.late})</option>
              <option value="excused">Justificados ({metrics.excused})</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                id="btn-view-list"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded text-xs ${viewMode === 'list' ? 'bg-white shadow-xs text-teal-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                title="Modo Lista"
              >
                <TableIcon className="w-4 h-4" />
              </button>
              <button
                id="btn-view-cards"
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded text-xs ${viewMode === 'cards' ? 'bg-white shadow-xs text-teal-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                title="Modo Cartões"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Batch Actions & Metrics summary pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-500">Resumo:</span>
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> {metrics.present} Presentes
            </span>
            <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold border border-amber-200 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-600" /> {metrics.late} Atrasados
            </span>
            <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 font-semibold border border-rose-200 flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5 text-rose-600" /> {metrics.absent} Ausentes
            </span>
            <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200 flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-blue-600" /> {metrics.excused} Justificados
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-marcar-todos-presentes"
              onClick={markAllPresent}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs transition-all active:scale-95"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Marcar Todos Presentes
            </button>

            <button
              id="btn-zerar-chamada"
              onClick={() => {
                if (window.confirm('Tem certeza que deseja zerar a chamada da aula atual?')) {
                  resetCurrentAttendance();
                }
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              Zerar
            </button>
          </div>
        </div>
      </div>

      {/* Main Student Attendance List / Cards */}
      {filteredStudents.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
          <p className="font-medium text-slate-700">Nenhum aluno encontrado com os filtros selecionados.</p>
          <p className="text-xs text-slate-400 mt-1">Tente ajustar o termo de busca ou filtros de bancada e status.</p>
        </div>
      ) : viewMode === 'list' ? (
        /* TABLE LIST VIEW */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Aluno(a) & Matrícula</th>
                  <th className="py-3 px-3">Bancada / Mesa</th>
                  <th className="py-3 px-3">EPI Lab</th>
                  <th className="py-3 px-3">Horário / Método</th>
                  <th className="py-3 px-4 text-center">Status de Chamada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredStudents.map((student) => {
                  const record = activeSession?.attendance[student.id];
                  const status = record?.status || 'absent';
                  const benchId = record?.benchId || student.defaultBenchId || 1;
                  const benchInfo = benches.find(b => b.id === benchId);

                  return (
                    <tr 
                      key={student.id} 
                      className={`hover:bg-slate-50/80 transition-colors ${
                        status === 'present' ? 'bg-emerald-50/20' : 
                        status === 'late' ? 'bg-amber-50/20' : 
                        status === 'excused' ? 'bg-blue-50/20' : ''
                      }`}
                    >
                      {/* Student info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <StudentAvatar
                            name={student.name}
                            subGroup={student.subGroup}
                            size="md"
                            showSubBadge
                          />
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              {student.name}
                              {record?.status === 'present' && (
                                <span className="w-2 h-2 rounded-full bg-emerald-500" title="Presente" />
                              )}
                            </div>
                            <div className="text-xs text-slate-500 font-mono flex items-center gap-2">
                              <span>RA: {student.registrationNumber}</span>
                              <span className="text-slate-300">•</span>
                              <span className="text-slate-600">{student.course}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Bench selector */}
                      <td className="py-3.5 px-3">
                        <select
                          value={benchId}
                          onChange={(e) => updateBenchAssignment(student.id, Number(e.target.value))}
                          className="text-xs font-semibold bg-slate-100 hover:bg-slate-200 border border-slate-300/80 rounded-md px-2 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
                          title={`Peça: ${benchInfo?.specimenTheme}`}
                        >
                          {benches.map(b => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                        <div className="text-[10px] text-slate-400 truncate max-w-[140px] mt-0.5">
                          {benchInfo?.specimenTheme}
                        </div>
                      </td>

                      {/* EPI Lab check */}
                      <td className="py-3.5 px-3">
                        <button
                          onClick={() => {
                            const newEpi = !(record?.epiVerified);
                            setAttendanceStatus(student.id, status, benchId, newEpi);
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                            record?.epiVerified
                              ? 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100'
                              : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
                          }`}
                          title="Clique para alternar verificação de Jaleco e EPI"
                        >
                          <ShieldCheck className={`w-3.5 h-3.5 ${record?.epiVerified ? 'text-teal-600' : 'text-slate-400'}`} />
                          <span>{record?.epiVerified ? 'EPI OK' : 'Sem EPI'}</span>
                        </button>
                      </td>

                      {/* Timestamp & Method */}
                      <td className="py-3.5 px-3 text-xs text-slate-600">
                        {record?.timestamp ? (
                          <div className="flex flex-col">
                            <span className="font-mono font-medium text-slate-800">{record.timestamp}</span>
                            <span className="text-[10px] text-slate-500 font-semibold">
                              {record.checkinMethod === 'dynamic_qr' ? '⚡ QR Dinâmico (15s)' :
                               record.checkinMethod === 'self_registered' ? '✨ Auto-Cadastrado' :
                               record.checkinMethod === 'qrcode' ? '📱 QR Code' : 
                               record.checkinMethod === 'code' ? '🔢 Cód. Telão' : '✋ Manual'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      {/* 1-Click Fast Attendance Status Buttons */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
                          {/* Presente */}
                          <button
                            onClick={() => setAttendanceStatus(student.id, 'present', benchId, true)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              status === 'present'
                                ? 'bg-emerald-600 text-white shadow-sm scale-105'
                                : 'text-emerald-700 hover:bg-emerald-100/70'
                            }`}
                          >
                            P
                          </button>

                          {/* Atrasado */}
                          <button
                            onClick={() => setAttendanceStatus(student.id, 'late', benchId, true)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              status === 'late'
                                ? 'bg-amber-500 text-white shadow-sm scale-105'
                                : 'text-amber-700 hover:bg-amber-100/70'
                            }`}
                          >
                            ATR
                          </button>

                          {/* Ausente */}
                          <button
                            onClick={() => setAttendanceStatus(student.id, 'absent', benchId, false)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              status === 'absent'
                                ? 'bg-rose-600 text-white shadow-sm scale-105'
                                : 'text-rose-700 hover:bg-rose-100/70'
                            }`}
                          >
                            A
                          </button>

                          {/* Justificado */}
                          <button
                            onClick={() => setAttendanceStatus(student.id, 'excused', benchId, false)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              status === 'excused'
                                ? 'bg-blue-600 text-white shadow-sm scale-105'
                                : 'text-blue-700 hover:bg-blue-100/70'
                            }`}
                          >
                            J
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CARDS GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredStudents.map((student) => {
            const record = activeSession?.attendance[student.id];
            const status = record?.status || 'absent';
            const benchId = record?.benchId || student.defaultBenchId || 1;
            const benchInfo = benches.find(b => b.id === benchId);

            return (
              <div
                key={student.id}
                className={`bg-white rounded-xl border p-4 shadow-sm transition-all flex flex-col justify-between ${
                  status === 'present' ? 'border-emerald-300 ring-1 ring-emerald-200' :
                  status === 'late' ? 'border-amber-300 ring-1 ring-amber-200' :
                  status === 'excused' ? 'border-blue-300 ring-1 ring-blue-200' :
                  'border-slate-200'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <StudentAvatar
                        name={student.name}
                        subGroup={student.subGroup}
                        size="md"
                        showSubBadge
                      />
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm leading-tight">{student.name}</h4>
                        <p className="text-xs text-slate-500 font-mono">{student.registrationNumber}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                      {benchInfo?.name}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      status === 'present' ? 'bg-emerald-100 text-emerald-800' :
                      status === 'late' ? 'bg-amber-100 text-amber-800' :
                      status === 'excused' ? 'bg-blue-100 text-blue-800' :
                      'bg-rose-100 text-rose-800'
                    }`}>
                      {status === 'present' ? 'Presente' :
                       status === 'late' ? 'Atrasado' :
                       status === 'excused' ? 'Justificado' : 'Ausente'}
                    </span>
                  </div>

                  {record?.timestamp && (
                    <div className="text-[11px] text-slate-500 flex items-center justify-between">
                      <span>Entrada: <strong>{record.timestamp}</strong></span>
                      <span className="text-[10px] text-slate-500 font-semibold">
                        {record.checkinMethod === 'dynamic_qr' ? '⚡ QR Dinâmico' :
                         record.checkinMethod === 'self_registered' ? '✨ Auto-Cad.' :
                         record.checkinMethod === 'qrcode' ? '📱 QR Code' :
                         record.checkinMethod === 'code' ? '🔢 Código' : '✋ Manual'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Status action buttons */}
                <div className="grid grid-cols-4 gap-1 mt-4 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setAttendanceStatus(student.id, 'present', benchId, true)}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                      status === 'present' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    P
                  </button>
                  <button
                    onClick={() => setAttendanceStatus(student.id, 'late', benchId, true)}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                      status === 'late' ? 'bg-amber-500 text-white shadow-xs' : 'bg-slate-100 text-amber-700 hover:bg-amber-50'
                    }`}
                  >
                    ATR
                  </button>
                  <button
                    onClick={() => setAttendanceStatus(student.id, 'absent', benchId, false)}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                      status === 'absent' ? 'bg-rose-600 text-white shadow-xs' : 'bg-slate-100 text-rose-700 hover:bg-rose-50'
                    }`}
                  >
                    A
                  </button>
                  <button
                    onClick={() => setAttendanceStatus(student.id, 'excused', benchId, false)}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                      status === 'excused' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-blue-700 hover:bg-blue-50'
                    }`}
                  >
                    J
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
