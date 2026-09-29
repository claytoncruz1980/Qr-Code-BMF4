import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Search, 
  UserPlus, 
  FileUp, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Edit, 
  Trash2, 
  Eye, 
  Mail, 
  GraduationCap,
  X,
  Clock,
  Sparkles,
  Check,
  Filter,
  ArrowUpDown,
  BookOpen,
  ShieldCheck,
  UserCheck,
  FileSpreadsheet,
  FileText,
  RotateCcw,
  Smartphone
} from 'lucide-react';
import { useLab, sortClassesAlphabetically } from '../context/LabContext';
import { Student, CourseType } from '../types';
import { FileImportModal } from './FileImportModal';
import { StudentAvatar } from './StudentAvatar';

export const StudentsManagement: React.FC = () => {
  const { 
    students, 
    classes, 
    selectedClassId, 
    setSelectedClassId,
    addStudent, 
    updateStudent, 
    deleteStudent,
    deleteMultipleStudents,
    deleteAllStudentsFromClass,
    resetStudentDeviceBinding,
    sessions,
    playBeep
  } = useLab();

  // Filters and Search
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClassId, setFilterClassId] = useState<string>('all');
  const [filterCourse, setFilterCourse] = useState<string>('all');
  const [filterRisk, setFilterRisk] = useState<boolean>(false);

  // Modals & Popups
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBatchImportModalOpen, setIsBatchImportModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [selectedStudentForHistory, setSelectedStudentForHistory] = useState<Student | null>(null);
  const [batchDeleteConfirmOpen, setBatchDeleteConfirmOpen] = useState(false);
  const [clearClassConfirmOpen, setClearClassConfirmOpen] = useState(false);

  // Multi-selection state
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Form state
  const [name, setName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [course, setCourse] = useState<CourseType>('Medicina');
  const [classGroupId, setClassGroupId] = useState(selectedClassId || classes[0]?.id || '');
  const [notes, setNotes] = useState('');
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  const coursesList: CourseType[] = [
    'Medicina', 
    'Enfermagem', 
    'Odontologia', 
    'Fisioterapia', 
    'Biomedicina', 
    'Farmácia', 
    'Educação Física'
  ];

  // Calculate student overall frequency from sessions
  const getStudentStats = (student: Student) => {
    const studentSessions = sessions.filter(s => s.classGroupId === student.classGroupId);
    const total = studentSessions.length;
    if (total === 0) {
      return { total: 0, present: 0, absent: 0, rate: 100, isRisk: false };
    }

    let present = 0;
    let absent = 0;

    studentSessions.forEach(s => {
      const rec = s.attendance?.[student.id];
      if (rec?.status === 'present' || rec?.status === 'late' || rec?.status === 'excused') {
        present++;
      } else {
        absent++;
      }
    });

    const rate = Math.round((present / total) * 100);
    const isRisk = rate < 75;

    return { total, present, absent, rate, isRisk };
  };

  const handleSelectClassTab = (id: string) => {
    setFilterClassId(id);
    if (id !== 'all') {
      setSelectedClassId(id);
    }
  };

  const filteredStudents = useMemo(() => {
    return students
      .filter(st => {
        const matchesSearch = 
          searchTerm.trim() === '' ||
          st.name.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
          st.registrationNumber.toLowerCase().includes(searchTerm.toLowerCase().trim());

        const matchesClass = 
          filterClassId === 'all' || 
          st.classGroupId === filterClassId ||
          (classes.find(c => c.id === filterClassId)?.name && st.classGroupId === classes.find(c => c.id === filterClassId)?.name);

        const matchesCourse = filterCourse === 'all' || st.course === filterCourse;
        const stats = getStudentStats(st);
        const matchesRisk = !filterRisk || stats.isRisk;

        return matchesSearch && matchesClass && matchesCourse && matchesRisk;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' }));
  }, [students, searchTerm, filterClassId, filterCourse, filterRisk, classes, sessions]);

  // Open Edit Modal
  const handleOpenEdit = (st: Student) => {
    setEditingStudent(st);
    setName(st.name);
    setRegistrationNumber(st.registrationNumber);
    setCourse(st.course);
    setClassGroupId(st.classGroupId);
    setNotes(st.notes || '');
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingStudent(null);
    setName('');
    const randomRA = `MED-2026${Math.floor(1000 + Math.random() * 9000)}`;
    setRegistrationNumber(randomRA);
    setCourse('Medicina');
    setClassGroupId(filterClassId !== 'all' ? filterClassId : (selectedClassId || classes[0]?.id || ''));
    setNotes('');
    setIsAddModalOpen(true);
  };

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !registrationNumber.trim()) return;

    const cleanName = name.trim();
    const cleanRA = registrationNumber.trim();
    const generatedEmail = `${cleanRA.toLowerCase().replace(/[^a-z0-9]/g, '')}@uni9.edu.br`;

    if (editingStudent) {
      updateStudent(editingStudent.id, {
        name: cleanName,
        registrationNumber: cleanRA,
        email: editingStudent.email || generatedEmail,
        course,
        classGroupId,
        notes: notes.trim(),
      });
      setEditingStudent(null);
      showFeedback(`Aluno(a) "${cleanName}" atualizado(a) com sucesso!`);
    } else {
      addStudent({
        name: cleanName,
        registrationNumber: cleanRA,
        email: generatedEmail,
        course,
        classGroupId,
        notes: notes.trim(),
      });
      setIsAddModalOpen(false);
      showFeedback(`Novo aluno(a) "${cleanName}" cadastrado(a) com sucesso!`);
    }
  };

  const showFeedback = (msg: string) => {
    setActionSuccessMessage(msg);
    setTimeout(() => {
      setActionSuccessMessage(null);
    }, 3000);
  };

  // Confirm Single Delete
  const handleConfirmDelete = () => {
    if (!deletingStudent) return;
    const studentName = deletingStudent.name;
    deleteStudent(deletingStudent.id);
    setSelectedStudentIds(prev => prev.filter(id => id !== deletingStudent.id));
    setDeletingStudent(null);
    playBeep('alert');
    showFeedback(`Aluno(a) "${studentName}" foi excluído(a) do sistema.`);
  };

  // Confirm Batch Delete
  const handleConfirmBatchDelete = () => {
    if (selectedStudentIds.length === 0) return;
    const count = selectedStudentIds.length;
    deleteMultipleStudents(selectedStudentIds);
    setSelectedStudentIds([]);
    setBatchDeleteConfirmOpen(false);
    playBeep('alert');
    showFeedback(`${count} alunos foram excluídos com sucesso.`);
  };

  // Confirm Clear All Students from selected class
  const handleConfirmClearClass = () => {
    const targetId = filterClassId !== 'all' ? filterClassId : selectedClassId;
    if (!targetId) return;
    const targetClass = classes.find(c => c.id === targetId);
    const count = students.filter(s => s.classGroupId === targetId).length;
    deleteAllStudentsFromClass(targetId);
    setSelectedStudentIds([]);
    setClearClassConfirmOpen(false);
    showFeedback(`Todos os ${count} alunos da turma "${targetClass?.name || ''}" foram removidos com sucesso.`);
  };

  // Toggle selection
  const toggleSelectAll = () => {
    if (selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredStudents.map(s => s.id));
    }
  };

  const toggleSelectStudent = (id: string) => {
    setSelectedStudentIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-5 max-w-full pb-16 sm:pb-8">
      
      {/* Toast Feedback Notification */}
      {actionSuccessMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccessMessage}</span>
          </div>
          <button onClick={() => setActionSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-800 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header with actions */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-sky-600" />
              Gestão de Alunos & Matrículas BMF4
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-900 border border-sky-200">
              {students.length} cadastrados
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Cadastre, edite dados, consulte presenças e importe listas oficiais via Word, PDF ou Excel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          {/* Clear class students */}
          <button
            type="button"
            id="btn-limpar-turma"
            onClick={() => setClearClassConfirmOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all border border-rose-200 cursor-pointer"
            title="Excluir todos os alunos desta turma"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>Limpar Turma</span>
          </button>

          {/* Import File Button */}
          <button
            type="button"
            id="btn-importar-lote"
            onClick={() => setIsBatchImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-bold transition-all border border-sky-200 shadow-xs cursor-pointer"
          >
            <FileUp className="w-4 h-4 text-sky-700" />
            <span>Importar Arquivo</span>
          </button>

          {/* New Student */}
          <button
            type="button"
            id="btn-novo-aluno"
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 text-white text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Novo Aluno</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-4 shadow-xs space-y-3">
        
        {/* Quick Class Selection Tabs */}
        <div>
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>Selecionar Turma:</span>
            <span className="text-sky-700 font-semibold">{filteredStudents.length} alunos listados (Ordem A-Z)</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <button
              type="button"
              onClick={() => handleSelectClassTab('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterClassId === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Todas as Turmas ({students.length})
            </button>
            {sortClassesAlphabetically(classes).map(c => {
              const count = students.filter(s => s.classGroupId === c.id || s.classGroupId === c.name).length;
              const isSelected = filterClassId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectClassTab(c.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-sky-700 text-white shadow-xs ring-2 ring-sky-300'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>{c.name}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Top Search & Course selector row */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center pt-2 border-t border-slate-100">
          
          {/* Search */}
          <div className="relative sm:col-span-8">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar aluno por nome ou RA (A-Z)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Course Filter */}
          <div className="sm:col-span-4">
            <select
              value={filterCourse}
              onChange={(e) => setFilterCourse(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
            >
              <option value="all">Todos os Cursos</option>
              {coursesList.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Risk filter toggle */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <button
            onClick={() => setFilterRisk(!filterRisk)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              filterRisk 
                ? 'bg-rose-50 border-rose-300 text-rose-700 ring-2 ring-rose-200'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            <span>Alerta de Frequência (&lt;75%)</span>
          </button>
        </div>

      </div>

      {/* Floating Multi-Selection Action Bar */}
      {selectedStudentIds.length > 0 && (
        <div className="p-3 bg-slate-900 text-white rounded-2xl flex items-center justify-between shadow-lg animate-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2 pl-2">
            <span className="w-5 h-5 rounded-full bg-sky-500 text-slate-900 font-black text-xs flex items-center justify-center">
              {selectedStudentIds.length}
            </span>
            <span className="text-xs font-semibold">
              {selectedStudentIds.length === 1 ? 'aluno selecionado' : 'alunos selecionados'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedStudentIds([])}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              Desmarcar
            </button>
            <button
              onClick={() => setBatchDeleteConfirmOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xs active:scale-95 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Excluir Selecionados</span>
            </button>
          </div>
        </div>
      )}

      {/* Students Table */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        
        {/* Table Controls Top */}
        <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="select-all-students"
              checked={selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
            />
            <label htmlFor="select-all-students" className="font-semibold cursor-pointer select-none">
              Selecionar todos ({filteredStudents.length})
            </label>
          </div>
          <span className="font-medium text-slate-400">
            Mostrando {filteredStudents.length} de {students.length} alunos (A-Z)
          </span>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto w-full max-w-full">
          <table className="w-full text-left border-collapse min-w-[650px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4 w-10"></th>
                <th className="py-3 px-4">Aluno(a)</th>
                <th className="py-3 px-3">Matrícula / RA</th>
                <th className="py-3 px-3">Turma</th>
                <th className="py-3 px-3 text-center">Frequência</th>
                <th className="py-3 px-4 text-right">Ações (Editar / Excluir)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-slate-400 text-xs">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    Nenhum aluno encontrado com os critérios de busca selecionados.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  const stats = getStudentStats(student);
                  const studentClass = classes.find(c => c.id === student.classGroupId);
                  const isSelected = selectedStudentIds.includes(student.id);

                  return (
                    <tr 
                      key={student.id} 
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-sky-50/50' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectStudent(student.id)}
                          className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                        />
                      </td>

                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <StudentAvatar
                            name={student.name}
                            size="md"
                          />
                          <div>
                            <div className="font-bold text-slate-900">{student.name}</div>
                            <div className="text-[11px] text-slate-500">{student.course || 'Medicina'}</div>
                          </div>
                        </div>
                      </td>

                      {/* RA */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-700">
                          <span>{student.registrationNumber}</span>
                          {student.boundDeviceId && (
                            <span 
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-teal-700 text-[10px] font-sans font-bold"
                              title={`Dispositivo Vinculado: ${student.boundDeviceId}`}
                            >
                              <Smartphone className="w-3 h-3 text-teal-600" />
                              <span className="hidden xl:inline">Vinculado</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Class */}
                      <td className="py-3.5 px-3 text-xs font-semibold text-slate-800">
                        {studentClass?.name || 'Turma BMF4'}
                      </td>

                      {/* Frequency % */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className={`text-xs font-black ${
                            stats.rate >= 75 ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {stats.rate}%
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {stats.present}/{stats.total} aulas
                          </span>
                        </div>
                      </td>

                      {/* Actions: Edit, Delete */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          
                          {/* Desvincular Aparelho (se vinculado) */}
                          {student.boundDeviceId && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Deseja desvincular o aparelho do aluno(a) "${student.name}" (RA: ${student.registrationNumber})? O aluno poderá cadastrar um novo aparelho no próximo check-in.`)) {
                                  resetStudentDeviceBinding(student.id);
                                  showFeedback(`Dispositivo desvinculado com sucesso para ${student.name}!`);
                                }
                              }}
                              className="px-2.5 py-1.5 rounded-xl text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                              title="Desvincular Aparelho Celular (Permite cadastrar novo celular)"
                            >
                              <Smartphone className="w-3.5 h-3.5" />
                              <span>Desvincular</span>
                            </button>
                          )}

                          {/* Histórico */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStudentForHistory(student);
                            }}
                            className="p-2 rounded-xl text-slate-500 hover:text-sky-700 hover:bg-sky-50 transition-colors cursor-pointer"
                            title="Ver Histórico de Presença"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Editar Aluno */}
                          <button
                            type="button"
                            id={`btn-edit-student-${student.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEdit(student);
                            }}
                            className="p-2 rounded-xl text-slate-600 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                            title="Editar Dados do Aluno"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          {/* Excluir Aluno */}
                          <button
                            type="button"
                            id={`btn-delete-student-${student.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingStudent(student);
                            }}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Excluir Aluno"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Add / Edit Student Modal */}
      {(isAddModalOpen || editingStudent) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Users className="w-5 h-5 text-sky-600" />
                {editingStudent ? 'Editar Cadastro de Aluno' : 'Cadastrar Novo Aluno'}
              </h3>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingStudent(null);
                }}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-4 text-xs">
              {/* Name */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nome Completo do Aluno *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Mariana Costa Lima"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* RA & Course */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Matrícula / RA *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 42620999"
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Curso</label>
                  <select
                    value={course}
                    onChange={(e) => setCourse(e.target.value as CourseType)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                  >
                    {coursesList.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Turma */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Turma BMF4</label>
                <select
                  value={classGroupId}
                  onChange={(e) => setClassGroupId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                >
                  {sortClassesAlphabetically(classes).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Device Binding Status (if editing) */}
              {editingStudent?.boundDeviceId && (
                <div className="p-3 bg-teal-50 rounded-2xl border border-teal-200 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-teal-900">Dispositivo Vinculado por Segurança</div>
                      <div className="text-[10px] text-teal-700 font-mono">ID: {editingStudent.boundDeviceId.slice(0, 16)}...</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      resetStudentDeviceBinding(editingStudent.id);
                      setEditingStudent({ ...editingStudent, boundDeviceId: undefined, deviceBoundAt: undefined });
                      showFeedback(`Vínculo de dispositivo redefinido para ${editingStudent.name}!`);
                    }}
                    className="px-3 py-1.5 bg-white hover:bg-teal-100 text-teal-800 rounded-xl border border-teal-300 text-[11px] font-bold cursor-pointer shrink-0"
                    title="Permite que o aluno cadastre um novo celular"
                  >
                    Desvincular Aparelho
                  </button>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Observações Médicas / Restrições (Opcional)</label>
                <textarea
                  rows={2}
                  placeholder="Ex: Alergia a látex, dispensa de peças com formol concentrado..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingStudent(null);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 text-white font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  {editingStudent ? 'Salvar Alterações' : 'Confirmar Cadastro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Single Delete Confirmation Modal */}
      {deletingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-slate-900 text-base">
                Excluir Aluno(a)?
              </h3>
              <p className="text-xs text-slate-500">
                Esta ação removerá o aluno da base de dados e do histórico de frequências do laboratório.
              </p>
            </div>

            {/* Student Preview Card */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
              <StudentAvatar
                name={deletingStudent.name}
                size="md"
              />
              <div className="text-left text-xs">
                <div className="font-bold text-slate-900">{deletingStudent.name}</div>
                <div className="text-slate-400 font-mono">RA: {deletingStudent.registrationNumber}</div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeletingStudent(null)}
                className="w-1/2 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirm-delete-student"
                onClick={handleConfirmDelete}
                className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                Excluir Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Delete Confirmation Modal */}
      {batchDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-slate-900 text-base">
                Excluir {selectedStudentIds.length} Alunos Selecionados?
              </h3>
              <p className="text-xs text-slate-500">
                Tem certeza que deseja remover os {selectedStudentIds.length} estudantes selecionados? Esta ação não pode ser desfeita.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setBatchDeleteConfirmOpen(false)}
                className="w-1/2 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmBatchDelete}
                className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                Sim, Excluir {selectedStudentIds.length} Alunos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Clear Class Students Modal */}
      {clearClassConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-rose-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-slate-900 text-base">
                Limpar Todos os Alunos da Turma?
              </h3>
              <p className="text-xs text-slate-500">
                Esta ação removerá todos os alunos da turma{' '}
                <strong className="text-slate-800">
                  {classes.find(c => c.id === (filterClassId !== 'all' ? filterClassId : selectedClassId))?.name || 'selecionada'}
                </strong>.
              </p>
            </div>

            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Você poderá em seguida importar a sua lista real de alunos via Word, PDF ou Excel.</span>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setClearClassConfirmOpen(false)}
                className="w-1/2 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmClearClass}
                className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                Sim, Limpar Alunos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-format File Import Modal (Word, PDF, Excel) */}
      <FileImportModal
        isOpen={isBatchImportModalOpen}
        onClose={() => setIsBatchImportModalOpen(false)}
        targetClassId={filterClassId !== 'all' ? filterClassId : selectedClassId}
      />

      {/* Student History Timeline Modal */}
      {selectedStudentForHistory && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <StudentAvatar
                  name={selectedStudentForHistory.name}
                  size="lg"
                />
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{selectedStudentForHistory.name}</h3>
                  <p className="text-xs text-slate-500 font-mono">
                    RA: {selectedStudentForHistory.registrationNumber}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedStudentForHistory(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Histórico de Presenças & Aulas</h4>
              
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {sessions
                  .filter(s => s.classGroupId === selectedStudentForHistory.classGroupId)
                  .map((session) => {
                    const record = session.attendance?.[selectedStudentForHistory.id];
                    const status = record?.status || 'absent';

                    return (
                      <div key={session.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-slate-800">{session.topic}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span>Data: <strong className="text-slate-700">{session.date ? session.date.split('-').reverse().join('/') : ''}</strong></span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-sky-600" />
                              <span>Horário da Chamada: <strong className="text-slate-700 font-mono">{session.startTime || '07:30'}{session.endTime ? ` às ${session.endTime}` : ''}</strong></span>
                            </span>
                          </div>
                          {record?.timestamp && (
                            <div className="text-[10px] text-emerald-700 font-mono mt-0.5">
                              Check-in Aluno: {record.timestamp} {record.checkinMethod === 'qrcode' ? '(QR Code)' : '(Manual)'}
                            </div>
                          )}
                          {record?.observation && (
                            <div className="text-[10px] text-sky-700 mt-0.5 italic">{record.observation}</div>
                          )}
                        </div>

                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                          status === 'present' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : status === 'late' 
                            ? 'bg-amber-100 text-amber-800' 
                            : status === 'excused' 
                            ? 'bg-sky-100 text-sky-800' 
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {status === 'present' ? 'Presente' : status === 'late' ? 'Atraso' : status === 'excused' ? 'Atestado' : 'Falta'}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedStudentForHistory(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
