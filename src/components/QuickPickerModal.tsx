import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Users, 
  RotateCw, 
  X, 
  CheckCircle2, 
  HelpCircle, 
  Award 
} from 'lucide-react';
import { useLab } from '../context/LabContext';
import { Student } from '../types';
import { StudentAvatar } from './StudentAvatar';
import { matchStudentClass } from '../utils/attendanceHelpers';

interface QuickPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ANATOMICAL_QUESTIONS = [
  'Identificar o Sulco Interventricular Anterior e a Artéria Coronária Esquerda.',
  'Localizar o Forame Magno, Côndilos Occipitais e Canal do Hipoglosso.',
  'Demonstrar a emergência do Nervo Ciático/Isquiático em relação ao Músculo Piriforme.',
  'Identificar a Valva Tricúspide e as Cordas Tendíneas no Ventrículo Direito.',
  'Apontar a Artéria Braquial e a bifurcação Radial e Ulnar na Fossa Cubital.',
  'Demonstrar o Hilo Pulmonar e a relação da Artéria Pulmonar com o Brônquio Principal.',
  'Identificar os Giros Pré-Central (Córtex Motor) e Pós-Central (Córtex Sensitivo).',
  'Localizar o Músculo Esternocleidomastóideo e o Trígono Carotídeo.',
];

export const QuickPickerModal: React.FC<QuickPickerModalProps> = ({ isOpen, onClose }) => {
  const { 
    students, 
    selectedClassId, 
    activeSession, 
    playBeep, 
    benches,
    classes
  } = useLab();

  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [question, setQuestion] = useState<string>('');

  if (!isOpen) return null;

  const classStudents = students.filter(s => matchStudentClass(s.classGroupId, selectedClassId, classes));
  const presentStudents = classStudents.filter(st => {
    const status = activeSession?.attendance[st.id]?.status;
    return status === 'present' || status === 'late';
  });

  const handleSpin = () => {
    if (presentStudents.length === 0) return;
    setIsSpinning(true);
    setSelectedStudent(null);
    playBeep('success');

    let counter = 0;
    const interval = setInterval(() => {
      const randomIdx = Math.floor(Math.random() * presentStudents.length);
      setSelectedStudent(presentStudents[randomIdx]);
      counter++;
      if (counter > 15) {
        clearInterval(interval);
        setIsSpinning(false);
        const finalStudent = presentStudents[Math.floor(Math.random() * presentStudents.length)];
        setSelectedStudent(finalStudent);
        const randomQ = ANATOMICAL_QUESTIONS[Math.floor(Math.random() * ANATOMICAL_QUESTIONS.length)];
        setQuestion(randomQ);
        playBeep('success');
      }
    }, 90);
  };

  const studentBench = benches.find(b => b.id === (activeSession?.attendance[selectedStudent?.id || '']?.benchId || selectedStudent?.defaultBenchId));

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 text-center">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-left">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Sorteador para Arguição Anatômica</h3>
              <p className="text-[11px] text-slate-400">Sorteio aleatório entre alunos presentes</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Display Box */}
        <div className="p-6 bg-gradient-to-b from-slate-900 to-slate-950 rounded-2xl border border-slate-800 text-white min-h-[210px] flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-radial from-amber-500/10 via-transparent to-transparent pointer-events-none" />

          {selectedStudent ? (
            <div className={`space-y-3 transition-transform ${isSpinning ? 'scale-95 blur-[0.5px]' : 'scale-100'} flex flex-col items-center`}>
              <StudentAvatar
                name={selectedStudent.name}
                subGroup={selectedStudent.subGroup}
                size="xl"
              />
              <div>
                <h4 className="text-lg font-black text-white">{selectedStudent.name}</h4>
                <p className="text-xs text-amber-300 font-mono">
                  RA: {selectedStudent.registrationNumber} • {studentBench?.name || 'Mesa'}
                </p>
              </div>

              {!isSpinning && question && (
                <div className="mt-3 p-3 rounded-xl bg-slate-800/90 border border-amber-500/30 text-xs text-amber-200 text-left">
                  <span className="font-bold text-amber-400 block mb-0.5 flex items-center gap-1">
                    <Award className="w-3.5 h-3.5" /> Desafio Anatômico:
                  </span>
                  <p>{question}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2 text-slate-400">
              <Users className="w-10 h-10 mx-auto text-slate-600 animate-pulse" />
              <p className="text-xs font-medium">
                {presentStudents.length > 0 
                  ? `${presentStudents.length} alunos presentes aptos para o sorteio.` 
                  : 'Nenhum aluno marcado como presente na aula atual.'}
              </p>
            </div>
          )}
        </div>

        {/* Spin trigger button */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={handleSpin}
            disabled={isSpinning || presentStudents.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition-all disabled:opacity-50"
          >
            <RotateCw className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />
            {isSpinning ? 'Sorteando...' : 'Sortear Aluno Agora'}
          </button>
        </div>
      </div>
    </div>
  );
};
