import React from 'react';
import { useLab } from '../context/LabContext';
import { 
  Users, 
  UserCheck, 
  X, 
  Radio,
  Sparkles,
  GraduationCap
} from 'lucide-react';

interface TeacherConflictAlertProps {
  onOpenClassSelector?: () => void;
}

export const TeacherConflictAlert: React.FC<TeacherConflictAlertProps> = ({ onOpenClassSelector }) => {
  const { 
    teacherConflict, 
    joinAsCoTeacher, 
    takeOverSession, 
    dismissTeacherConflict,
    classes,
    setSelectedClassId,
    selectedClassId
  } = useLab();

  if (!teacherConflict || !teacherConflict.hasConflict) {
    return null;
  }

  const isLiveSessionConflict = teacherConflict.conflictType === 'live_session';
  const otherClasses = classes.filter(c => c.id !== selectedClassId);

  return (
    <aside 
      aria-label="Co-Docência e Sincronização Multi-Usuário em Tempo Real"
      className="mb-4 rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 bg-gradient-to-r from-indigo-50/90 via-sky-50/70 to-emerald-50/80 dark:from-indigo-950/40 dark:via-slate-900/40 dark:to-emerald-950/30 shadow-xs p-4 sm:p-4.5 transition-all animate-in fade-in slide-in-from-top-2 duration-300"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left icon & text */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/10 dark:bg-indigo-500/20 border border-indigo-300/50 dark:border-indigo-700/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-2xs">
            {isLiveSessionConflict ? (
              <Radio className="w-4.5 h-4.5 animate-pulse text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Users className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100/90 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-700">
                <Sparkles className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                {isLiveSessionConflict ? 'Chamada Ativa Sincronizada' : 'Co-Docência em Tempo Real'}
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Turma: <strong className="text-slate-800 dark:text-slate-200">{teacherConflict.className}</strong>
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium mt-1">
              {isLiveSessionConflict ? (
                <>O(a) <strong className="text-indigo-700 dark:text-indigo-300">{teacherConflict.otherProfessorName}</strong> iniciou uma chamada nesta turma. As marcações sincronizam instantaneamente entre todos os dispositivos.</>
              ) : (
                <>O(a) <strong className="text-indigo-700 dark:text-indigo-300">{teacherConflict.otherProfessorName}</strong> também está gerenciando a turma em tempo real com sincronização automática.</>
              )}
            </p>
          </div>
        </div>

        {/* Action choices */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isLiveSessionConflict ? (
            <>
              <button
                type="button"
                onClick={() => joinAsCoTeacher(teacherConflict.sessionId)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5" />
                Atuar como Co-Docente
              </button>

              <button
                type="button"
                onClick={() => takeOverSession(teacherConflict.sessionId)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                Assumir
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => joinAsCoTeacher()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-colors cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5" />
              Co-Docência Ativa
            </button>
          )}

          {otherClasses.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedClassId(e.target.value);
                }
              }}
              className="text-xs py-1.5 px-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium hover:border-slate-400 transition-colors focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
            >
              <option value="" disabled>Trocar turma...</option>
              {otherClasses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}

          <button
            id="btn-dismiss-teacher-conflict"
            type="button"
            onClick={dismissTeacherConflict}
            className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1 transition-all cursor-pointer"
            title="Ocultar aviso de presença co-docente"
          >
            <X className="w-3.5 h-3.5" />
            Ocultar
          </button>
        </div>
      </div>
    </aside>
  );
};
