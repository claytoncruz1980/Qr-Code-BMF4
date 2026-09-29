import React, { useState, useMemo } from 'react';
import { 
  GraduationCap, 
  Plus, 
  BookOpen, 
  Users, 
  Edit, 
  Trash2, 
  Check, 
  X, 
  AlertTriangle,
  Layers,
  FileUp,
  FolderOpen,
  Search,
  ArrowUpDown
} from 'lucide-react';
import { useLab, sortClassesAlphabetically } from '../context/LabContext';
import { ClassGroup, CourseType } from '../types';
import { FileImportModal } from './FileImportModal';
import { BMF4_CLASS_IDS } from '../data/initialData';

export const ClassesManagement: React.FC = () => {
  const { 
    classes, 
    selectedClassId, 
    setSelectedClassId, 
    addClassGroup, 
    updateClassGroup, 
    deleteClassGroup,
    restoreDefaultClasses,
    deleteAllStudentsFromClass,
    students,
    sessions,
    appSettings,
    playBeep
  } = useLab();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'az' | 'za' | 'students' | 'sessions'>('az');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassGroup | null>(null);
  const [deletingClass, setDeletingClass] = useState<ClassGroup | null>(null);
  const [deleteStudentsToo, setDeleteStudentsToo] = useState(true);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [importModalClassId, setImportModalClassId] = useState<string | null>(null);
  const [clearingClassStudents, setClearingClassStudents] = useState<ClassGroup | null>(null);

  // Simplified Form fields (ONLY Turma and Disciplina)
  const [turmaName, setTurmaName] = useState('');
  const [disciplineName, setDisciplineName] = useState('');

  const colorPalette = [
    '#0f4c81', // Classic Navy
    '#0284c7', // Sky Blue
    '#0d9488', // Teal
    '#059669', // Emerald
    '#7c3aed', // Purple
    '#db2777', // Rose
    '#d97706', // Amber
    '#475569', // Slate
  ];

  // Guaranteed sorted and filtered classes
  const sortedClasses = useMemo(() => {
    const filtered = classes.filter(cls => {
      const matchesSearch = 
        cls.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (cls.discipline && cls.discipline.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (cls.course && cls.course.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesSearch;
    });

    if (sortOrder === 'az') {
      return sortClassesAlphabetically(filtered);
    }
    if (sortOrder === 'za') {
      return [...filtered].sort((a, b) => {
        const nameA = (a.name || '').trim();
        const nameB = (b.name || '').trim();
        return nameB.localeCompare(nameA, 'pt-BR', { numeric: true, sensitivity: 'base' });
      });
    }
    if (sortOrder === 'students') {
      return [...filtered].sort((a, b) => {
        const countA = students.filter(s => s.classGroupId === a.id).length;
        const countB = students.filter(s => s.classGroupId === b.id).length;
        return countB - countA;
      });
    }
    if (sortOrder === 'sessions') {
      return [...filtered].sort((a, b) => {
        const countA = sessions.filter(s => s.classGroupId === a.id).length;
        const countB = sessions.filter(s => s.classGroupId === b.id).length;
        return countB - countA;
      });
    }
    return sortClassesAlphabetically(filtered);
  }, [classes, searchTerm, sortOrder, students, sessions]);

  const handleOpenEdit = (cls: ClassGroup) => {
    setEditingClass(cls);
    setTurmaName(cls.name);
    setDisciplineName(cls.discipline || cls.course || '');
    setIsAddModalOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingClass(null);
    setTurmaName('');
    setDisciplineName('');
    setIsAddModalOpen(true);
  };

  const handleSaveClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!turmaName.trim() || !disciplineName.trim()) return;

    const cleanTurma = turmaName.trim();
    const cleanDiscipline = disciplineName.trim();
    const lowerName = cleanTurma.toLowerCase();

    // Do not force immutable constants for general new class creation unless editing or explicitly Turma B
    let targetId = editingClass?.id;
    if (!targetId && cleanTurma.toLowerCase() === 'turma b') {
      targetId = BMF4_CLASS_IDS.TURMA_B;
    } else if (!targetId && cleanTurma.toLowerCase() === 'turma a') {
      targetId = BMF4_CLASS_IDS.TURMA_A;
    }

    const existingById = targetId ? classes.find(c => c.id === targetId) : null;
    const existingByName = classes.find(c => c.name.toLowerCase() === lowerName && c.id !== editingClass?.id);

    if (existingById || existingByName) {
      const activeId = existingById ? existingById.id : existingByName!.id;
      updateClassGroup(activeId, {
        name: cleanTurma,
        discipline: cleanDiscipline,
        code: cleanTurma.toUpperCase().slice(0, 10),
      });
      showFeedback(`Turma "${cleanTurma}" atualizada com sucesso!`);
    } else if (editingClass) {
      updateClassGroup(editingClass.id, {
        name: cleanTurma,
        discipline: cleanDiscipline,
        code: cleanTurma.toUpperCase().slice(0, 10),
      });
      showFeedback(`Turma "${cleanTurma}" atualizada com sucesso!`);
    } else {
      const assignedColor = colorPalette[classes.length % colorPalette.length];
      addClassGroup({
        id: targetId,
        name: cleanTurma,
        discipline: cleanDiscipline,
        code: cleanTurma.toUpperCase().slice(0, 10),
        institution: appSettings.institutionName || 'UNINOVE MEDICINA',
        course: 'Medicina' as CourseType,
        semester: 'Semestre Letivo 2026',
        laboratoryRoom: 'Laboratório de Anatomia & Morfologia',
        professorName: 'Docente Responsável',
        schedule: 'Horário Regular da Prática',
        color: assignedColor,
      });
      showFeedback(`Nova turma "${cleanTurma}" cadastrada com sucesso!`);
    }

    setIsAddModalOpen(false);
    setEditingClass(null);
  };

  const handleConfirmDelete = () => {
    if (!deletingClass) return;
    const className = deletingClass.name;
    deleteClassGroup(deletingClass.id, deleteStudentsToo);
    setDeletingClass(null);
    playBeep('alert');
    showFeedback(`Turma "${className}" foi excluída com sucesso.`);
  };

  const handleConfirmClearClassStudents = () => {
    if (!clearingClassStudents) return;
    const className = clearingClassStudents.name;
    const count = students.filter(s => s.classGroupId === clearingClassStudents.id).length;
    deleteAllStudentsFromClass(clearingClassStudents.id);
    setClearingClassStudents(null);
    playBeep('alert');
    showFeedback(`Todos os ${count} alunos da turma "${className}" foram removidos com sucesso.`);
  };

  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 3000);
  };

  return (
    <div className="space-y-5">
      
      {/* Toast Feedback Notification */}
      {feedbackMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
          <button onClick={() => setFeedbackMessage(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-[#0f4c81]" />
              Gestão de Turmas e Disciplinas
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-900 border border-sky-200">
              {classes.length} {classes.length === 1 ? 'turma cadastrada' : 'turmas cadastradas'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Cadastre a Turma e a Disciplina em ordem alfabética automática e importe listas de alunos via Word, PDF ou Excel.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => {
              restoreDefaultClasses();
              showFeedback("Turmas padrão (Turma A e Turma B) restauradas com sucesso!");
            }}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
            title="Restaurar Turma A e Turma B padrão"
          >
            <FolderOpen className="w-4 h-4 text-[#0f4c81]" />
            <span>Restaurar Turmas Padrão</span>
          </button>
          <button
            id="btn-nova-turma"
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0f4c81] hover:bg-[#0c3c66] text-white text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Cadastrar Turma</span>
          </button>
        </div>
      </div>

      {/* Filter and Sort Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nome da turma ou disciplina..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-2 shrink-0">
          <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1 uppercase tracking-wider">
            <ArrowUpDown className="w-3.5 h-3.5 text-sky-700" />
            <span>Ordem:</span>
          </label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
          >
            <option value="az">Ordem Alfabética (A → Z)</option>
            <option value="za">Ordem Alfabética (Z → A)</option>
            <option value="students">Mais Alunos Vinculados</option>
            <option value="sessions">Mais Aulas Realizadas</option>
          </select>
        </div>
      </div>

      {/* Grid of Classes */}
      {sortedClasses.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center mx-auto">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Nenhuma turma encontrada</h3>
            <p className="text-xs text-slate-500 mt-1">
              {searchTerm ? 'Nenhum resultado para a busca. Limpe o campo para ver todas as turmas.' : 'Clique em "+ Cadastrar Turma" para cadastrar a primeira turma.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 max-w-full">
          {sortedClasses.map((cls) => {
            const classStudents = students.filter(s => s.classGroupId === cls.id);
            const classStudentsCount = classStudents.length;
            const classSessions = sessions.filter(s => s.classGroupId === cls.id);
            const isSelected = cls.id === selectedClassId;

            return (
            <div
              key={cls.id}
              className={`bg-white rounded-3xl border transition-all p-5 sm:p-6 shadow-xs flex flex-col justify-between relative overflow-hidden ${
                isSelected 
                  ? 'border-[#0f4c81] ring-2 ring-sky-500/20' 
                  : 'border-slate-200/90 hover:border-slate-300'
              }`}
            >
              {/* Colored top bar accent */}
              <div 
                className="absolute top-0 left-0 right-0 h-1.5"
                style={{ backgroundColor: cls.color || '#0f4c81' }}
              />

              <div className="space-y-4">
                
                {/* Top header of card */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-sky-50 text-sky-900 border border-sky-100">
                        Turma
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-lg leading-snug">
                      {cls.name}
                    </h3>
                    
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-700 font-semibold">
                      <BookOpen className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                      <span>Disciplina: <strong>{cls.discipline || cls.course || 'Anatomia Humana'}</strong></span>
                    </div>
                  </div>

                  {isSelected && (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200 flex items-center gap-1 shrink-0">
                      <Check className="w-3.5 h-3.5 text-emerald-600" /> Turma Ativa
                    </span>
                  )}
                </div>

                {/* Counter badges */}
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 text-xs">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center font-bold">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{classStudentsCount}</div>
                      <div className="text-[10px] text-slate-500 font-semibold uppercase">Alunos Vinculados</div>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{classSessions.length}</div>
                      <div className="text-[10px] text-slate-500 font-semibold uppercase">Aulas Realizadas</div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Card Footer Actions */}
              <div className="pt-4 mt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                
                {/* Select as active button */}
                <button
                  type="button"
                  id={`btn-select-class-${cls.id}`}
                  onClick={() => {
                    setSelectedClassId(cls.id);
                    playBeep('click');
                    showFeedback(`Turma "${cls.name}" agora é a turma ativa.`);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {isSelected ? 'Turma em Uso' : 'Definir como Ativa'}
                </button>

                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Importar Arquivo de Alunos nesta Turma */}
                  <button
                    type="button"
                    id={`btn-import-class-${cls.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setImportModalClassId(cls.id);
                    }}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-bold transition-all border border-sky-200 cursor-pointer"
                    title="Importar alunos via Word, PDF ou Excel para esta turma"
                  >
                    <FileUp className="w-3.5 h-3.5 text-sky-700" />
                    <span>Importar Alunos</span>
                  </button>

                  {/* Limpar Alunos desta Turma */}
                  {classStudentsCount > 0 && (
                    <button
                      type="button"
                      id={`btn-clear-students-${cls.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setClearingClassStudents(cls);
                      }}
                      className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold transition-all border border-amber-200 cursor-pointer"
                      title="Excluir todos os alunos cadastrados nesta turma"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-amber-700" />
                      <span>Limpar ({classStudentsCount})</span>
                    </button>
                  )}

                  {/* Editar Turma */}
                  <button
                    type="button"
                    id={`btn-edit-class-${cls.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEdit(cls);
                    }}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                    title="Editar Turma"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>

                  {/* Excluir Turma */}
                  <button
                    type="button"
                    id={`btn-delete-class-${cls.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingClass(cls);
                    }}
                    className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                    title="Excluir Turma"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>

            </div>
          );
        })}
      </div>
      )}

      {/* Simplified Modal: Cadastrar / Editar Turma (ONLY Turma e Disciplina) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-sky-100 text-[#0f4c81] flex items-center justify-center">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {editingClass ? 'Editar Turma' : 'Cadastrar Nova Turma'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Preencha a identificação da turma e a disciplina
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingClass(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveClass} className="space-y-4 text-xs">
              
              {/* Campo 1: Turma */}
              <div>
                <label className="font-bold text-slate-800 block mb-1.5 text-xs">
                  Nome / Identificação da Turma *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Turma A, BMF-4, 4º Semestre Turma 1, Turma Manhã"
                  value={turmaName}
                  onChange={(e) => setTurmaName(e.target.value)}
                  className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                  autoFocus
                />
              </div>

              {/* Campo 2: Disciplina */}
              <div>
                <label className="font-bold text-slate-800 block mb-1.5 text-xs">
                  Disciplina / Matéria *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Anatomia Humana, Morfofuncional I, Fisiologia, Patologia"
                  value={disciplineName}
                  onChange={(e) => setDisciplineName(e.target.value)}
                  className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                />
              </div>

              <div className="p-3 bg-sky-50 rounded-2xl border border-sky-100 text-sky-900 text-[11px] flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-sky-700 shrink-0" />
                <span>Após cadastrar, você poderá importar sua lista de alunos (Word, PDF ou Excel) para esta turma com 1 clique.</span>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingClass(null);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#0f4c81] hover:bg-[#0c3c66] text-white font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  {editingClass ? 'Salvar Alterações' : 'Cadastrar Turma'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingClass && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-rose-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-slate-900 text-base">
                Excluir Turma?
              </h3>
              <p className="text-xs text-slate-500">
                Tem certeza que deseja excluir a turma <strong className="text-slate-800">{deletingClass.name}</strong>?
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={deleteStudentsToo}
                  onChange={(e) => setDeleteStudentsToo(e.target.checked)}
                  className="w-4 h-4 rounded text-rose-600 border-slate-300 focus:ring-rose-500"
                />
                <span>Excluir também todos os alunos vinculados a esta turma</span>
              </label>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeletingClass(null)}
                className="w-1/2 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all"
              >
                Excluir Turma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Class Students Modal */}
      {clearingClassStudents && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-amber-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-slate-900 text-base">
                Limpar Todos os Alunos Desta Turma?
              </h3>
              <p className="text-xs text-slate-500">
                Você está prestes a remover todos os alunos cadastrados na turma{' '}
                <strong className="text-slate-800">{clearingClassStudents.name}</strong>.
              </p>
            </div>

            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>A turma permanecerá criada para que você possa importar sua lista definitiva.</span>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setClearingClassStudents(null)}
                className="w-1/2 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmClearClassStudents}
                className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all"
              >
                Sim, Limpar Alunos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-format File Import Modal */}
      <FileImportModal
        isOpen={Boolean(importModalClassId)}
        onClose={() => setImportModalClassId(null)}
        targetClassId={importModalClassId || undefined}
      />

    </div>
  );
};
