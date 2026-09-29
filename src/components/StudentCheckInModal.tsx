import React, { useState, useEffect } from 'react';
import { 
  QrCode, 
  CheckCircle2, 
  ShieldCheck, 
  AlertCircle, 
  X, 
  KeyRound, 
  User,
  UserPlus,
  UserCheck,
  Loader2
} from 'lucide-react';
import { useLab } from '../context/LabContext';
import { matchStudentClass } from '../utils/attendanceHelpers';

interface StudentCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckinSuccess?: () => void;
}

export const StudentCheckInModal: React.FC<StudentCheckInModalProps> = ({ 
  isOpen, 
  onClose,
  onCheckinSuccess,
}) => {
  const { 
    activeSession, 
    selectedClassId, 
    students, 
    studentSelfCheckin,
    selfRegisterAndCheckin,
    dynamicToken,
    dynamicSecondsLeft,
    classes
  } = useLab();

  const [registrationNumber, setRegistrationNumber] = useState('');
  const [code, setCode] = useState(dynamicToken || activeSession?.checkinCode || '');
  const [epiConfirmed, setEpiConfirmed] = useState(true);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string; notFound?: boolean; needsOtherClassConfirmation?: boolean; studentClassName?: string; targetClassName?: string } | null>(null);
  const [showAutoReg, setShowAutoReg] = useState(false);
  const [autoRegName, setAutoRegName] = useState('');
  const [isSubmittingAutoReg, setIsSubmittingAutoReg] = useState(false);

  useEffect(() => {
    if (dynamicToken) {
      setCode(dynamicToken);
    }
  }, [dynamicToken]);

  if (!isOpen) return null;

  const classStudents = students.filter(s => matchStudentClass(s.classGroupId, selectedClassId, classes));

  const handleAutoRegSubmit = () => {
    const trimmedName = autoRegName.trim();
    const trimmedRa = registrationNumber.trim().toUpperCase();

    if (!trimmedName) {
      setFeedback({ success: false, notFound: true, message: 'Por favor, informe o Nome Completo do aluno para confirmar.' });
      return;
    }

    if (!trimmedRa) {
      setFeedback({ success: false, message: 'Por favor, informe a Matrícula / RA do aluno.' });
      return;
    }

    setIsSubmittingAutoReg(true);
    const safeguardTimer = setTimeout(() => {
      setIsSubmittingAutoReg(false);
    }, 6000);

    try {
      const reg = selfRegisterAndCheckin({
        name: trimmedName,
        registrationNumber: trimmedRa,
        classGroupId: selectedClassId || activeSession?.classGroupId || '',
      });

      clearTimeout(safeguardTimer);

      if (reg && reg.success) {
        setFeedback({
          success: true,
          message: reg.message || `✓ Aluno(a) "${trimmedName}" cadastrado(a) e presença confirmada!`,
        });
        setShowAutoReg(false);
        setAutoRegName('');
        setRegistrationNumber('');

        setTimeout(() => {
          if (onCheckinSuccess) {
            onCheckinSuccess();
          } else {
            onClose();
          }
          setFeedback(null);
        }, 1600);
      } else {
        setFeedback({
          success: false,
          notFound: true,
          message: reg?.message || 'Erro ao cadastrar aluno. Tente novamente.',
        });
      }
    } catch (err) {
      clearTimeout(safeguardTimer);
      setFeedback({
        success: false,
        notFound: true,
        message: 'Ocorreu um erro ao processar o cadastro.',
      });
    } finally {
      setIsSubmittingAutoReg(false);
    }
  };

  const handleSubmit = (e?: React.FormEvent, allowOtherClass: boolean = false) => {
    if (e) e.preventDefault();
    if (!registrationNumber.trim()) {
      setFeedback({ success: false, message: 'Preencha a matrícula / RA do aluno.' });
      return;
    }

    if (!epiConfirmed) {
      setFeedback({ success: false, message: 'É obrigatório confirmar o uso de todos os EPIs de laboratório.' });
      return;
    }

    const codeToUse = code.trim() || dynamicToken || activeSession?.checkinCode || 'AUTO';
    const result = studentSelfCheckin(registrationNumber.trim(), codeToUse, allowOtherClass);
    
    if (result.needsOtherClassConfirmation) {
      setFeedback({
        success: false,
        needsOtherClassConfirmation: true,
        studentClassName: result.studentClassName,
        targetClassName: result.targetClassName,
        message: result.message || 'Aluno cadastrado em outra turma. Deseja confirmar?',
      });
      return;
    }

    if (result.notFound) {
      setFeedback({ 
        success: false, 
        notFound: true, 
        message: `RA "${registrationNumber.trim().toUpperCase()}" não localizado na lista de chamada desta turma. Verifique o número ou contate o docente.` 
      });
      return;
    }

    setFeedback(result);

    if (result.success) {
      setTimeout(() => {
        if (onCheckinSuccess) {
          onCheckinSuccess();
        } else {
          onClose();
        }
        setFeedback(null);
        setRegistrationNumber('');
      }, 1400);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-700 border border-sky-200 flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Check-in de Aluno / Totem</h3>
              <p className="text-[11px] text-slate-400">Confirmação Manual de Presença</p>
            </div>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback alert */}
        {feedback && (
          <div className={`p-3.5 rounded-2xl text-xs font-semibold space-y-2 ${
            feedback.success 
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
              : feedback.needsOtherClassConfirmation 
              ? 'bg-amber-50 text-amber-900 border border-amber-300' 
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            <div className="flex items-start gap-2.5">
              {feedback.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${feedback.needsOtherClassConfirmation ? 'text-amber-600' : 'text-rose-600'}`} />
              )}
              <span className="leading-relaxed">{feedback.message}</span>
            </div>

            {feedback.needsOtherClassConfirmation && (
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setFeedback(null)}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit(undefined, true)}
                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all"
                >
                  Confirmar Presença
                </button>
              </div>
            )}

            {feedback.notFound && (
              <div className="pt-2 border-t border-rose-200/80 mt-2 space-y-2">
                {!showAutoReg ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAutoRegName('');
                      setShowAutoReg(true);
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Cadastrar e Confirmar Presença Agora</span>
                  </button>
                ) : (
                  <div className="p-3 bg-white rounded-xl border border-emerald-300 space-y-2.5">
                    <div className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Nome do Aluno para Cadastro Imediato:
                    </div>
                    <input
                      type="text"
                      autoFocus
                      placeholder="Nome Completo do Aluno"
                      value={autoRegName}
                      onChange={(e) => setAutoRegName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAutoReg(false)}
                        className="py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={isSubmittingAutoReg}
                        onClick={handleAutoRegSubmit}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-75 disabled:cursor-wait active:scale-98 transition-all"
                      >
                        {isSubmittingAutoReg ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                            <span>Cadastrando...</span>
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Confirmar Cadastro & Presença</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {/* Matrícula input */}
          <div>
            <label className="font-bold text-slate-700 flex items-center justify-between mb-1">
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-sky-700" />
                Matrícula / RA do Aluno
              </span>
            </label>
            <input
              type="text"
              required
              placeholder="Ex: 426202091 ou MED-202601"
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-sm font-bold text-slate-800 uppercase"
              autoFocus
            />

            {/* Quick student selection chips */}
            <div className="mt-2 flex flex-wrap gap-1 max-h-20 overflow-y-auto">
              <span className="text-[10px] text-slate-400 block w-full">Alunos matriculados:</span>
              {classStudents.slice(0, 6).map(st => (
                <button
                  type="button"
                  key={st.id}
                  onClick={() => {
                    setRegistrationNumber(st.registrationNumber);
                  }}
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-sky-50 hover:text-sky-900 text-slate-600 text-[10px] border border-slate-200 cursor-pointer"
                >
                  {st.name.split(' ')[0]} ({st.registrationNumber})
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic / Session code */}
          <div>
            <label className="font-bold text-slate-700 flex items-center justify-between mb-1">
              <span className="flex items-center gap-1">
                <KeyRound className="w-3.5 h-3.5 text-sky-700" />
                Código da Aula / Token Dinâmico
              </span>
              {dynamicSecondsLeft !== undefined && (
                <span className="text-[10px] text-slate-500">
                  Expira em {dynamicSecondsLeft}s
                </span>
              )}
            </label>
            <input
              type="text"
              required
              placeholder="Ex: DYN-A81B ou BMF-401"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-xs font-bold text-sky-900 tracking-widest uppercase"
            />
          </div>

          {/* Biosafety EPI Confirmation */}
          <div className="p-3 bg-teal-50/80 border border-teal-200 rounded-xl space-y-1.5">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={epiConfirmed}
                onChange={(e) => setEpiConfirmed(e.target.checked)}
                className="mt-0.5 rounded border-teal-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
              />
              <span className="text-xs text-teal-900 font-medium leading-tight">
                <ShieldCheck className="w-3.5 h-3.5 inline mr-1 text-teal-600" />
                <strong>Declaração de EPI:</strong> Paramentação completa com jaleco, luvas e sapatos fechados.
              </span>
            </label>
          </div>

          {/* Buttons */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-bold shadow-md active:scale-95 transition-all cursor-pointer"
            >
              Confirmar Presença
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
