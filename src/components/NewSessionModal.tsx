import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  PlusCircle, 
  Calendar, 
  BookOpen, 
  X, 
  Plus, 
  Trash2, 
  Sparkles,
  ShieldCheck,
  UserCheck,
  GraduationCap,
  Layers,
  Clock,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Microscope,
  Tv
} from 'lucide-react';
import { useLab, sortClassesAlphabetically, isDateToday } from '../context/LabContext';
import { ActivityCategory, ActivityType, ClassPeriod, LaboratoryLocation } from '../types';

interface NewSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionStarted?: (startedPeriod?: ClassPeriod) => void;
  isTelaoIntent?: boolean;
}

const DEFAULT_LESSON_TITLES = [
  'Aula Prática BMF4: Anatomia Topográfica & Dissecação',
  'Aula Prática BMF4: Sistema Cardiovascular & Mediastino',
  'Aula Prática BMF4: Sistema Respiratório & Caixa Torácica',
  'Aula Prática BMF4: Sistema Digestório & Parede Abdominal',
  'Aula Prática BMF4: Sistema Renal, Urinário & Pelve',
  'Aula Prática BMF4: Sistema Nervoso Central & Periférico',
  'Aula Prática BMF4: Histologia dos Tecidos Fundamentais & Microscopia',
  'Aula Prática BMF4: Histologia Cardiovascular & Lâminas Cardíacas',
  'Aula Prática BMF4: Histologia Respiratória & Pulmonar',
  'Aula Prática BMF4: Histologia Digestória & Glândulas Anexas',
  'Aula Prática BMF4: Histologia Renal, Néfrons & Túbulos Coletores',
  'Aula Teórica BMF4: Fisiologia & Morfologia Integrada',
  'Aula Teórica BMF4: Sistema Cardiovascular e Respiratório',
  'Avaliação Teórica Oficial BMF4 (N1/N2)',
  'Anato/Histo 1: Sistema Cardiovascular & Mediastino',
  'Anato/Histo 2: Sistema Respiratório & Caixa Torácica',
  'Anato/Histo 3: Sistema Digestório & Parede Abdominal',
  'Anato/Histo 4: Sistema Renal, Urinário & Pelve',
  'Anato/Histo 5: Sistema Nervoso Central & Periférico',
  'Revisão e Prática Livre de Peças Anatômicas em Bancadas',
  'Revisão Prática de Lâminas e Microscópios no Lab. de Histologia'
];

export const NewSessionModal: React.FC<NewSessionModalProps> = ({ 
  isOpen, 
  onClose,
  onSessionStarted,
  isTelaoIntent = false
}) => {
  const { 
    classes, 
    selectedClassId, 
    professors, 
    activeProfessorId, 
    sessions,
    startNewSession 
  } = useLab();

  const [savedTitles, setSavedTitles] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('bmf4_lesson_titles');
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return DEFAULT_LESSON_TITLES;
  });

  const [newTitleInput, setNewTitleInput] = useState('');
  const [showAddTitle, setShowAddTitle] = useState(false);
  const [showManageTitles, setShowManageTitles] = useState(false);

  const [profId, setProfId] = useState(activeProfessorId || professors[0]?.id || 'prof-1');
  const [classId, setClassId] = useState(selectedClassId || classes[0]?.id || 'class-bmf4-a');
  const [category, setCategory] = useState<ActivityCategory>('pratica');
  const [activityType, setActivityType] = useState<ActivityType>('aula_pratica');
  const [labLocation, setLabLocation] = useState<LaboratoryLocation>('anatomia');
  const [activePeriod, setActivePeriod] = useState<ClassPeriod>('1');
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [topic, setTopic] = useState(() => {
    try {
      const stored = localStorage.getItem('bmf4_lesson_titles');
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
      }
    } catch {}
    return DEFAULT_LESSON_TITLES[0];
  });
  const [notes, setNotes] = useState('');

  const prevIsOpenRef = useRef(false);

  const existingLiveSessionInClass = useMemo(() => {
    return sessions.find(s => s.classGroupId === classId && s.isLive && !s.isLocked);
  }, [sessions, classId]);

  const hasTeacherConflict = existingLiveSessionInClass && existingLiveSessionInClass.professorId !== profId;

  // Intelligent period suggestion based on class's sessions today
  const determineSuggestedPeriod = useCallback((targetClassId: string, currentActType: ActivityType): ClassPeriod => {
    if (currentActType.startsWith('atividade_pratica') || currentActType === 'prova_teorica') {
      return 'activity_single';
    }
    const classSessionsToday = sessions.filter(s => s.classGroupId === targetClassId && isDateToday(s.date));
    const hasClosedP1 = classSessionsToday.some(s => 
      (s.isLocked || s.isPeriod1Locked) && 
      (s.activePeriod === '1' || s.activePeriod === 'p1_start' || s.activePeriod === 'p1_end')
    );
    const hasLiveP1 = classSessionsToday.some(s => 
      s.isLive && !s.isLocked && (s.activePeriod === '1' || s.activePeriod === 'p1_start' || s.activePeriod === 'p1_end')
    );
    // If 1st period was closed today and no live 1st period is currently running, automatically default to 2nd period
    if (hasClosedP1 && !hasLiveP1) {
      return '2';
    }
    return '1';
  }, [sessions]);

  // Sync selected class only when modal transitions from closed to open
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      const targetClass = (selectedClassId && classes.some(c => c.id === selectedClassId))
        ? selectedClassId
        : (classes[0]?.id || 'class-bmf4-a');
      setClassId(targetClass);

      if (activeProfessorId && professors.some(p => p.id === activeProfessorId)) {
        setProfId(activeProfessorId);
      }

      const suggested = determineSuggestedPeriod(targetClass, activityType);
      setActivePeriod(suggested);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, selectedClassId, activeProfessorId, classes, professors, determineSuggestedPeriod, activityType]);

  const handleSaveCustomTitle = () => {
    if (!newTitleInput.trim()) return;
    const updated = [newTitleInput.trim(), ...savedTitles.filter(t => t !== newTitleInput.trim())];
    setSavedTitles(updated);
    try {
      localStorage.setItem('bmf4_lesson_titles', JSON.stringify(updated));
    } catch {
      // ignore
    }
    setTopic(newTitleInput.trim());
    setNewTitleInput('');
    setShowAddTitle(false);
  };

  const handleDeleteTitle = (titleToDelete: string) => {
    const updated = savedTitles.filter(t => t !== titleToDelete);
    setSavedTitles(updated);
    try {
      localStorage.setItem('bmf4_lesson_titles', JSON.stringify(updated));
    } catch {
      // ignore
    }
    if (topic === titleToDelete) {
      setTopic('');
    }
  };

  const handleClearAllTitles = () => {
    setSavedTitles([]);
    try {
      localStorage.setItem('bmf4_lesson_titles', JSON.stringify([]));
    } catch {
      // ignore
    }
    setTopic('');
  };

  const handleLoadSuggestions = () => {
    setSavedTitles(DEFAULT_LESSON_TITLES);
    try {
      localStorage.setItem('bmf4_lesson_titles', JSON.stringify(DEFAULT_LESSON_TITLES));
    } catch {
      // ignore
    }
  };

  if (!isOpen) return null;

  const handleCategoryChange = (newCat: ActivityCategory) => {
    setCategory(newCat);
    if (newCat === 'teorica') {
      setActivityType('aula_teorica');
      setActivePeriod(determineSuggestedPeriod(classId, 'aula_teorica'));
    } else {
      setActivityType('aula_pratica');
      setActivePeriod(determineSuggestedPeriod(classId, 'aula_pratica'));
    }
  };

  const handleActivityTypeChange = (newType: ActivityType) => {
    setActivityType(newType);
    setActivePeriod(determineSuggestedPeriod(classId, newType));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalTopic = topic.trim() || (category === 'pratica' ? 'Aula Prática BMF4: Morfofuncional' : 'Aula Teórica BMF4');

    // Auto-save custom topic if not already in savedTitles
    if (finalTopic && !savedTitles.includes(finalTopic)) {
      const updatedTitles = [finalTopic, ...savedTitles];
      setSavedTitles(updatedTitles);
      try {
        localStorage.setItem('bmf4_lesson_titles', JSON.stringify(updatedTitles));
      } catch {}
    }

    startNewSession({
      topic: finalTopic,
      professorId: profId,
      classGroupId: classId,
      activityCategory: category,
      activityType,
      labLocation: category === 'pratica' ? labLocation : undefined,
      activePeriod,
      date: sessionDate,
      notes: notes.trim(),
    });

    if (onSessionStarted) {
      onSessionStarted(activePeriod);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl ${
              isTelaoIntent 
                ? 'bg-gradient-to-tr from-teal-600 to-emerald-600' 
                : 'bg-gradient-to-tr from-sky-600 to-teal-600'
            } text-white flex items-center justify-center shadow-xs`}>
              {isTelaoIntent ? <Tv className="w-5 h-5" /> : <PlusCircle className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {isTelaoIntent ? 'Identificar Tipo de Aula para o Telão' : 'Iniciar Nova Chamada BMF4'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isTelaoIntent 
                  ? 'Defina o Tipo de Aula e Tema antes de projetar o QR Code' 
                  : 'Defina o Professor, Turma e Tipo de Atividade'}
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          
          {/* Step 1: Professor */}
          <div>
            <label className="font-bold text-slate-700 block mb-1 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-sky-600" />
              1. Professor / Docente Responsável *
            </label>
            <select
              value={profId}
              onChange={(e) => setProfId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-semibold text-slate-800"
            >
              {professors.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Step 2: Turma */}
          <div>
            <label className="font-bold text-slate-700 block mb-1 flex items-center gap-1">
              <GraduationCap className="w-3.5 h-3.5 text-sky-600" />
              2. Turma de Medicina BMF4 *
            </label>
            <select
              value={classId}
              onChange={(e) => {
                const newClass = e.target.value;
                setClassId(newClass);
                const suggested = determineSuggestedPeriod(newClass, activityType);
                setActivePeriod(suggested);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-semibold text-slate-800"
            >
              {sortClassesAlphabetically(classes).map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {hasTeacherConflict && existingLiveSessionInClass && (
              <div className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-amber-800">
                    Atenção: Turma com Chamada em Andamento
                  </p>
                  <p className="text-amber-700 leading-relaxed">
                    O(a) <strong>{existingLiveSessionInClass.professorName || 'Outro Docente'}</strong> já está com uma chamada ao vivo nesta turma às {existingLiveSessionInClass.startTime || ''}. Ao iniciar esta nova chamada, você assumirá a condução da turma.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Step 3: Tipo de Aula (Teórica vs Prática) */}
          <div className="space-y-2">
            <label className="font-bold text-slate-700 block flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-sky-600" />
              3. Categoria e Atividade da Aula *
            </label>

            {/* Category Toggle */}
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => handleCategoryChange('teorica')}
                className={`py-2 text-center rounded-lg font-bold transition-all ${
                  category === 'teorica'
                    ? 'bg-white text-sky-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Aulas Teóricas
              </button>
              <button
                type="button"
                onClick={() => handleCategoryChange('pratica')}
                className={`py-2 text-center rounded-lg font-bold transition-all ${
                  category === 'pratica'
                    ? 'bg-white text-teal-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Aulas Práticas & Lab
              </button>
            </div>

            {/* Activity Type List */}
            {category === 'teorica' ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleActivityTypeChange('aula_teorica')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    activityType === 'aula_teorica'
                      ? 'border-sky-500 bg-sky-50/70 text-sky-900 font-bold shadow-xs ring-1 ring-sky-300'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <p className="font-bold">Aula Teórica</p>
                  <p className="text-[10px] text-slate-500">Chamada na 1ª e 2ª aula</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleActivityTypeChange('prova_teorica')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    activityType === 'prova_teorica'
                      ? 'border-sky-500 bg-sky-50/70 text-sky-900 font-bold shadow-xs ring-1 ring-sky-300'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <p className="font-bold">Prova Teórica</p>
                  <p className="text-[10px] text-slate-500">Avaliação oficial N1/N2</p>
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => handleActivityTypeChange('aula_pratica')}
                  className={`w-full p-2.5 rounded-xl border text-left transition-all ${
                    activityType === 'aula_pratica'
                      ? 'border-teal-500 bg-teal-50/70 text-teal-900 font-bold shadow-xs ring-1 ring-teal-300'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">Aula Prática Regular</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 font-semibold">1ª & 2ª Aula</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">Dissecação e estudo de peças anatômicas em bancadas</p>
                </button>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {(['atividade_pratica_1', 'atividade_pratica_2', 'atividade_pratica_3', 'atividade_pratica_4', 'atividade_pratica_5'] as ActivityType[]).map((act, i) => (
                    <button
                      key={act}
                      type="button"
                      onClick={() => handleActivityTypeChange(act)}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        activityType === act
                          ? 'border-teal-500 bg-teal-50/80 text-teal-950 font-bold shadow-xs ring-1 ring-teal-400'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <p className="font-bold text-xs text-teal-950">Anato/Histo {i + 1}</p>
                      <p className="text-[9px] text-slate-500 font-medium">Atividade Prática {i + 1}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Local do Laboratório (Aulas e Atividades Práticas) */}
            {category === 'pratica' && (
              <div className="space-y-1.5 p-3 rounded-2xl bg-teal-50/50 border border-teal-200/80 mt-2">
                <label className="font-bold text-slate-800 block flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs">
                    <Building2 className="w-3.5 h-3.5 text-teal-700" />
                    Local do Laboratório da Prática *
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                    labLocation === 'anatomia'
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : labLocation === 'histologia'
                      ? 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                      : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  }`}>
                    {labLocation === 'anatomia' ? '🫀 Lab. de Anatomia' : labLocation === 'histologia' ? '🔬 Lab. de Histologia' : '🫀🔬 Anato / Histo (Ambos)'}
                  </span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    id="btn-modal-lab-anatomia"
                    onClick={() => setLabLocation('anatomia')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      labLocation === 'anatomia'
                        ? 'border-amber-500 bg-white text-slate-900 font-bold shadow-xs ring-2 ring-amber-400/50'
                        : 'border-slate-200 bg-white/70 hover:bg-white text-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-xl shrink-0">🫀</span>
                      <div>
                        <p className="font-extrabold text-xs text-slate-900">Lab. Anatomia</p>
                        <p className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">Bancadas & peças</p>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="btn-modal-lab-histologia"
                    onClick={() => setLabLocation('histologia')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      labLocation === 'histologia'
                        ? 'border-indigo-500 bg-white text-slate-900 font-bold shadow-xs ring-2 ring-indigo-400/50'
                        : 'border-slate-200 bg-white/70 hover:bg-white text-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-xl shrink-0">🔬</span>
                      <div>
                        <p className="font-extrabold text-xs text-slate-900">Lab. Histologia</p>
                        <p className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">Microscópios & lâminas</p>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="btn-modal-lab-ambos"
                    onClick={() => setLabLocation('ambos')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      labLocation === 'ambos'
                        ? 'border-emerald-500 bg-white text-slate-900 font-bold shadow-xs ring-2 ring-emerald-400/50'
                        : 'border-slate-200 bg-white/70 hover:bg-white text-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-xl shrink-0">🫀🔬</span>
                      <div>
                        <p className="font-extrabold text-xs text-slate-900">Anato / Histo</p>
                        <p className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">Integrado nos 2 labs</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Period Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="font-bold text-slate-700 block mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-sky-600" />
                Chamada Inicial da Sessão *
              </label>
              {activityType.startsWith('atividade_pratica') || activityType === 'prova_teorica' ? (
                <div className="px-3 py-2 bg-teal-50 border border-teal-200 rounded-xl text-teal-900 font-bold text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>Chamada Integral ({activityType.startsWith('atividade_pratica') ? 'Anato/Histo' : 'Prova Teórica'})</span>
                </div>
              ) : (
                <select
                  value={activePeriod}
                  onChange={(e) => setActivePeriod(e.target.value as ClassPeriod)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-semibold text-slate-800 text-xs"
                >
                  <option value="1">1ª Aula</option>
                  <option value="2">2ª Aula</option>
                  <option value="both">Chamada Integral (1ª e 2ª Aula)</option>
                </select>
              )}
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-sky-600" />
                Data da Aula
              </label>
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-semibold text-slate-800 text-xs"
              />
            </div>
          </div>

          {/* Topic / Roteiro Selection & Registration */}
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <label className="font-bold text-slate-700 block flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-sky-600" />
                Tema / Roteiro da Aula *
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddTitle(!showAddTitle)}
                  className="text-[11px] font-bold text-sky-600 hover:text-sky-800 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  {showAddTitle ? 'Fechar' : '+ Cadastrar Título'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowManageTitles(!showManageTitles)}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3 text-rose-500" />
                  {showManageTitles ? 'Ocultar Lista' : `Excluir / Limpar (${savedTitles.length})`}
                </button>
              </div>
            </div>

            {/* Quick Select Menu if titles exist */}
            {savedTitles.length > 0 && (
              <select
                value={savedTitles.includes(topic) ? topic : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    setTopic(e.target.value);
                  }
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-800 font-semibold truncate"
              >
                <option value="">-- Selecionar título cadastrado ({savedTitles.length}) ou digitar livremente --</option>
                {savedTitles.map((t, idx) => (
                  <option key={idx} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}

            {/* Input field to edit or customize selected title */}
            <input
              type="text"
              required
              placeholder="Digite o tema ou roteiro da aula..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-800 font-medium text-xs shadow-xs"
            />

            {/* New Title Registration Form */}
            {showAddTitle && (
              <div className="p-3 bg-sky-50/80 border border-sky-200 rounded-2xl space-y-2 animate-in fade-in">
                <p className="text-[11px] font-bold text-sky-900">Cadastrar Novo Título / Roteiro no Menu:</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Digite o título ou roteiro para salvar..."
                    value={newTitleInput}
                    onChange={(e) => setNewTitleInput(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-white border border-sky-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    type="button"
                    onClick={handleSaveCustomTitle}
                    className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer active:scale-95 transition-all"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            )}

            {/* Manage & Delete Registered Titles Drawer */}
            {showManageTitles && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700">
                    Títulos Cadastrados ({savedTitles.length})
                  </span>
                  {savedTitles.length > 0 ? (
                    <button
                      type="button"
                      onClick={handleClearAllTitles}
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      Limpar Todos os Exemplos
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleLoadSuggestions}
                      className="text-[11px] font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-50 border border-sky-200 hover:bg-sky-100 transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      Carregar Exemplos Sugeridos
                    </button>
                  )}
                </div>

                {savedTitles.length === 0 ? (
                  <div className="p-3 text-center text-slate-500 text-[11px] bg-white rounded-xl border border-slate-100">
                    Nenhum título cadastrado. Você pode digitar diretamente no campo acima ou cadastrar novos títulos.
                  </div>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                    {savedTitles.map((t, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-2 p-1.5 bg-white rounded-xl border border-slate-200 text-[11px]"
                      >
                        <span 
                          onClick={() => setTopic(t)}
                          className="truncate flex-1 font-medium text-slate-700 hover:text-sky-600 cursor-pointer"
                          title="Clique para selecionar"
                        >
                          {t}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteTitle(t)}
                          title="Excluir este título"
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Biosafety Notes */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Observações / Biossegurança (Opcional)
            </label>
            <input
              type="text"
              placeholder="Digite orientações de biossegurança, materiais ou avisos para a aula..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-800 font-medium"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              id="btn-submit-new-session"
              type="submit"
              className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-xs transition-all cursor-pointer flex items-center gap-2 ${
                isTelaoIntent
                  ? 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 active:scale-95'
                  : 'bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700'
              }`}
            >
              {isTelaoIntent && <Tv className="w-4 h-4 text-teal-200" />}
              <span>{isTelaoIntent ? 'Iniciar Chamada e Abrir Telão' : 'Abrir Chamada Agora'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
