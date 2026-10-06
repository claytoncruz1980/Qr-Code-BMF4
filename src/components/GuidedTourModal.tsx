import React, { useState } from 'react';
import { 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  X, 
  Tv, 
  FileSpreadsheet, 
  Users, 
  Settings, 
  BookOpen, 
  ShieldCheck,
  GraduationCap,
  Trash2
} from 'lucide-react';

interface GuidedTourModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TourStep {
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  badge: string;
  colorBg: string;
  colorText: string;
}

export const GuidedTourModal: React.FC<GuidedTourModalProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const steps: TourStep[] = [
    {
      title: 'Bem-vindo ao BMF4 Medicina',
      subtitle: 'Sistema Oficial de Frequência & Gestão Acadêmica',
      description: 'Este tour guiado apresentará rapidamente todas as ferramentas e abas de gerenciamento acadêmico disponíveis para os docentes da UNINOVE.',
      icon: <Sparkles className="w-7 h-7 text-amber-500" />,
      badge: 'Início',
      colorBg: 'bg-amber-50 border-amber-200',
      colorText: 'text-amber-800'
    },
    {
      title: 'Aba Chamada',
      subtitle: 'QR Code Dinâmico & Controle em Tempo Real',
      description: 'Abra aulas práticas ou teóricas, gere o QR Code Dinâmico com rotação criptografada anti-fraude, verifique EPIs e faça chamadas por períodos (1ª e 2ª Aula ou Integral).',
      icon: <BookOpen className="w-7 h-7 text-teal-600" />,
      badge: 'Frequência',
      colorBg: 'bg-teal-50 border-teal-200',
      colorText: 'text-teal-800'
    },
    {
      title: 'Aba Notas',
      subtitle: '15 Atividades Acadêmicas & Provas Substitutivas',
      description: 'Lump e gerencie as notas das 15 atividades práticas e teóricas do semestre, adicione notas parciais, exames substitutivos e acompanhe o status acadêmico dos alunos.',
      icon: <GraduationCap className="w-7 h-7 text-indigo-600" />,
      badge: 'Avaliações',
      colorBg: 'bg-indigo-50 border-indigo-200',
      colorText: 'text-indigo-800'
    },
    {
      title: 'Aba Relatórios & Lixeira',
      subtitle: 'Diários Oficiais, Exportação & Recuperação',
      description: 'Visualize diários consolidados, exporte planilhas oficiais em Excel (.xlsx) ou CSV por data, e utilize a nova **Lixeira** para restaurar qualquer chamada ou relatório excluído.',
      icon: <FileSpreadsheet className="w-7 h-7 text-sky-600" />,
      badge: 'Relatórios',
      colorBg: 'bg-sky-50 border-sky-200',
      colorText: 'text-sky-800'
    },
    {
      title: 'Aba Telão / QR',
      subtitle: 'Modo Projeção para Smart TVs e E-mails',
      description: 'Projete a chamada em tempo real em projetores ou telas de laboratório, acompanhe check-ins instantâneos com alerta sonoro e envie links de acompanhamento por e-mail.',
      icon: <Tv className="w-7 h-7 text-purple-600" />,
      badge: 'Projeção',
      colorBg: 'bg-purple-50 border-purple-200',
      colorText: 'text-purple-800'
    },
    {
      title: 'Aba Docentes & Ajustes',
      subtitle: 'Co-professores, Segurança & Supabase',
      description: 'Cadastre co-professores para aulas conjuntas, configure permissões, verifique a fila de sincronização offline Outbox no Supabase e mantenha o sistema atualizado.',
      icon: <Settings className="w-7 h-7 text-slate-700" />,
      badge: 'Configurações',
      colorBg: 'bg-slate-100 border-slate-300',
      colorText: 'text-slate-800'
    }
  ];

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLast) {
      onClose();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-slate-200 shadow-2xl space-y-6 animate-in zoom-in-95 relative flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shadow-xs ${step.colorBg}`}>
              {step.icon}
            </div>
            <div>
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider mb-0.5 ${step.colorBg} ${step.colorText}`}>
                Passo {currentStep + 1} de {steps.length} • {step.badge}
              </span>
              <h3 className="text-base sm:text-lg font-black text-slate-900">{step.title}</h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            title="Fechar Tour"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-3 py-2">
          <h4 className="text-sm font-bold text-slate-800">{step.subtitle}</h4>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
            {step.description}
          </p>
        </div>

        {/* Step Indicators */}
        <div className="flex items-center justify-center gap-1.5 py-1">
          {steps.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentStep(idx)}
              className={`h-2 rounded-full transition-all cursor-pointer ${
                idx === currentStep
                  ? 'w-8 bg-teal-600'
                  : 'w-2 bg-slate-200 hover:bg-slate-300'
              }`}
              title={`Ir para passo ${idx + 1}`}
            />
          ))}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              currentStep === 0
                ? 'opacity-40 cursor-not-allowed text-slate-400'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Anterior</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Pular Tour
            </button>

            <button
              onClick={handleNext}
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <span>{isLast ? 'Concluir Tour' : 'Próximo'}</span>
              {!isLast && <ArrowRight className="w-4 h-4" />}
              {isLast && <CheckCircle2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
