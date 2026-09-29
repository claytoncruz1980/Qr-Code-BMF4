import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  CheckCheck, 
  RotateCcw, 
  Download, 
  Edit, 
  Trash2, 
  UserPlus
} from 'lucide-react';
import { useLab } from '../context/LabContext';
import { AttendanceStatus, Student } from '../types';
import { StudentAvatar } from './StudentAvatar';
import { exportModernRosterExcel } from '../utils/exportExcel';
import { matchStudentClass } from '../utils/attendanceHelpers';

interface FullRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FullRosterModal: React.FC<FullRosterModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { 
    students, 
    selectedClassId, 
    classes, 
    activeSession, 
    setAttendanceStatus, 
    markAllPresent, 
    resetCurrentAttendance,
    addStudent,
    updateStudent,
    deleteStudent,
    playBeep
  } = useLab();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceStatus>('all');

  // Edit / Add / Delete state inside Roster Modal
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const classStudents = useMemo(() => {
    return students
      .filter(s => matchStudentClass(s.classGroupId, selectedClassId, classes))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [students, selectedClassId, classes]);

  const filteredStudents = useMemo(() => {
    return classStudents
      .filter(st => {
        const record = activeSession?.attendance[st.id];
        const status = record?.status || 'absent';

        const matchesSearch = 
          st.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          st.registrationNumber.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'all' || status === statusFilter;

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [classStudents, activeSession, searchTerm, statusFilter]);

  // Open Add
  const handleOpenAdd = () => {
    setName('');
    setRegistrationNumber('');
    setIsAddStudentOpen(true);
  };

  // Open Edit
  const handleOpenEdit = (st: Student) => {
    setEditingStudent(st);
    setName(st.name);
    setRegistrationNumber(st.registrationNumber);
  };

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !registrationNumber.trim()) return;

    if (editingStudent) {
      updateStudent(editingStudent.id, {
        name: name.trim(),
        registrationNumber: registrationNumber.trim(),
      });
      setEditingStudent(null);
    } else {
      addStudent({
        name: name.trim(),
        registrationNumber: registrationNumber.trim(),
        email: `${registrationNumber.toLowerCase().replace(/[^a-z0-9]/g, '')}@uni9.edu.br`,
        course: selectedClass?.course || 'Medicina',
        classGroupId: selectedClassId,
      });
      setIsAddStudentOpen(false);
    }
  };

  // Delete
  const handleConfirmDelete = () => {
    if (!deletingStudent) return;
    deleteStudent(deletingStudent.id);
    setDeletingStudent(null);
    playBeep('alert');
  };

  // Export Modern Excel (.xlsx)
  const handleExportModernExcel = async () => {
    if (!selectedClass) return;
    try {
      await exportModernRosterExcel({
        selectedClass,
        students: classStudents,
        activeSession,
      });
      playBeep('success');
    } catch (err) {
      console.error('Erro ao exportar lista de alunos:', err);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = 'Nome,Matricula,Status,Horario\n';
    const rows = classStudents.map(st => {
      const rec = activeSession?.attendance[st.id];
      const status = rec?.status === 'present' ? 'Presente' : rec?.status === 'late' ? 'Atrasado' : rec?.status === 'excused' ? 'Justificado' : 'Falta';
      const time = rec?.timestamp || '-';
      return `"${st.name}","${st.registrationNumber}","${status}","${time}"`;
    }).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `frequencia_${selectedClass?.code || 'turma'}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    playBeep('success');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] relative">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-sky-300 uppercase tracking-wider">
              {selectedClass?.institution || 'UNINOVE MEDICINA'}
            </div>
            <h2 className="text-lg font-bold tracking-tight">
              Lista Completa de Alunos • {selectedClass?.name}
            </h2>
            <p className="text-xs text-slate-300">
              Total de {classStudents.length} alunos matriculados nesta turma
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar & Filters */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
          
          {/* Search bar & Bulk actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome ou RA..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={handleOpenAdd}
                title="Cadastrar novo aluno nesta turma"
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Aluno</span>
              </button>

              <button
                onClick={markAllPresent}
                title="Marcar todos os alunos como presentes"
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Todos Presentes</span>
              </button>

              <button
                onClick={resetCurrentAttendance}
                title="Zerar status da chamada atual"
                className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Zerar</span>
              </button>

              <button
                onClick={handleExportModernExcel}
                title="Exportar Lista em Planilha Excel Moderna (.xlsx)"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Excel (.xlsx)</span>
              </button>

              <button
                onClick={handleExportCSV}
                title="Exportar para arquivo CSV"
                className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
              >
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Todos ({classStudents.length})
            </button>
            <button
              onClick={() => setStatusFilter('present')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'present'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Presentes
            </button>
            <button
              onClick={() => setStatusFilter('absent')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'absent'
                  ? 'bg-rose-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Ausentes
            </button>
            <button
              onClick={() => setStatusFilter('late')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'late'
                  ? 'bg-amber-500 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Atrasos
            </button>
            <button
              onClick={() => setStatusFilter('excused')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'excused'
                  ? 'bg-sky-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Justificados
            </button>
          </div>

        </div>

        {/* Students List */}
        <div className="overflow-y-auto p-4 divide-y divide-slate-100 flex-1">
          {filteredStudents.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Nenhum aluno encontrado para os filtros selecionados.
            </div>
          ) : (
            filteredStudents.map((st) => {
              const rec = activeSession?.attendance[st.id];
              const status: AttendanceStatus = rec?.status || 'absent';

              return (
                <div
                  key={st.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 px-2 rounded-2xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <StudentAvatar
                      name={st.name}
                      size="md"
                    />
                    <div>
                      <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span>{st.name}</span>
                        {/* Quick inline edit/delete */}
                        <button
                          onClick={() => handleOpenEdit(st)}
                          className="text-slate-400 hover:text-sky-700 p-0.5 cursor-pointer"
                          title="Editar Aluno"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingStudent(st)}
                          className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                          title="Excluir Aluno"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2">
                        <span className="font-mono font-semibold text-slate-600">{st.registrationNumber}</span>
                        {rec?.timestamp && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-emerald-700 font-bold">{rec.timestamp}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 1-Touch Status Controls: P, F, ATR, J */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center">
                    
                    {/* Presente */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAttendanceStatus(st.id, 'present');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        status === 'present'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                      }`}
                    >
                      P
                    </button>

                    {/* Falta */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAttendanceStatus(st.id, 'absent');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        status === 'absent'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700'
                      }`}
                    >
                      F
                    </button>

                    {/* Atraso */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAttendanceStatus(st.id, 'late');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        status === 'late'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700'
                      }`}
                    >
                      ATR
                    </button>

                    {/* Justificado */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAttendanceStatus(st.id, 'excused');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        status === 'excused'
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-sky-50 hover:text-sky-700'
                      }`}
                    >
                      J
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>{filteredStudents.length} alunos exibidos</span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Concluir
          </button>
        </div>

        {/* Edit / Add Modal inside Roster */}
        {(isAddStudentOpen || editingStudent) && (
          <div className="absolute inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xl max-w-sm w-full space-y-3.5 text-xs animate-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="font-bold text-slate-900 text-sm">
                  {editingStudent ? 'Editar Aluno' : 'Novo Aluno nesta Turma'}
                </h3>
                <button
                  onClick={() => {
                    setIsAddStudentOpen(false);
                    setEditingStudent(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveStudent} className="space-y-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Camila Nogueira"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">RA / Matrícula</label>
                  <input
                    type="text"
                    required
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    placeholder="Ex: 426202091"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold focus:bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddStudentOpen(false);
                      setEditingStudent(null);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-bold shadow-xs active:scale-95 cursor-pointer"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation inside Roster */}
        {deletingStudent && (
          <div className="absolute inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xl max-w-sm w-full space-y-3 text-center text-xs animate-in zoom-in-95">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">
                Excluir {deletingStudent.name}?
              </h3>
              <p className="text-slate-500 text-[11px]">
                O aluno será removido permanentemente da turma e da lista de chamada.
              </p>
              <div className="pt-2 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingStudent(null)}
                  className="w-1/2 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="w-1/2 py-2 rounded-xl bg-rose-600 text-white font-bold shadow-xs active:scale-95 cursor-pointer"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
