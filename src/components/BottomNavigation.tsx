import React from 'react';
import { 
  CheckCircle2, 
  Tv, 
  Award, 
  FileText, 
  UserCheck,
  Settings
} from 'lucide-react';
import { ActiveTab } from './Navbar';

interface BottomNavigationProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  setActiveTab,
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 px-1 py-1.5 shadow-2xl">
      <div className="grid grid-cols-6 gap-0.5 max-w-xl mx-auto text-[9.5px] font-bold">
        
        {/* 1. Chamada */}
        <button
          id="btn-nav-mobile-chamada"
          onClick={() => setActiveTab('chamada')}
          className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'chamada'
              ? 'text-teal-300 bg-teal-500/20 border border-teal-500/40 font-black shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Chamada Principal"
        >
          <CheckCircle2 className="w-4 h-4 mb-0.5" />
          <span className="truncate">Chamada</span>
        </button>

        {/* 2. Notas */}
        <button
          id="btn-nav-mobile-notas"
          onClick={() => setActiveTab('notas')}
          className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'notas'
              ? 'text-teal-300 bg-teal-500/20 border border-teal-500/40 font-black shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Quadro de Notas"
        >
          <Award className="w-4 h-4 mb-0.5" />
          <span className="truncate">Notas</span>
        </button>

        {/* 3. Relatórios */}
        <button
          id="btn-nav-mobile-relatorios"
          onClick={() => setActiveTab('relatorios')}
          className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'relatorios'
              ? 'text-teal-300 bg-teal-500/20 border border-teal-500/40 font-black shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Relatórios e Frequência"
        >
          <FileText className="w-4 h-4 mb-0.5" />
          <span className="truncate">Relatórios</span>
        </button>

        {/* 4. Telão / QR Dinâmico */}
        <button
          id="btn-nav-mobile-telao"
          onClick={() => setActiveTab('telao')}
          className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'telao'
              ? 'text-teal-300 bg-teal-500/20 border border-teal-500/40 font-black shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Modo Telão e Projeção"
        >
          <Tv className="w-4 h-4 mb-0.5" />
          <span className="truncate">Telão/QR</span>
        </button>

        {/* 5. Docentes (Professores, Alunos, Turmas, Atestados) */}
        <button
          id="btn-nav-mobile-docentes"
          onClick={() => setActiveTab('docentes')}
          className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'docentes' || activeTab === 'alunos' || activeTab === 'turmas' || activeTab === 'justificativas'
              ? 'text-teal-300 bg-teal-500/20 border border-teal-500/40 font-black shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Gestão de Docentes, Alunos, Turmas e Atestados"
        >
          <UserCheck className="w-4 h-4 mb-0.5" />
          <span className="truncate">Docentes</span>
        </button>

        {/* 6. Ajustes (Configurações e Parâmetros) */}
        <button
          id="btn-nav-mobile-ajustes"
          onClick={() => setActiveTab('ajustes')}
          className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'ajustes'
              ? 'text-teal-300 bg-teal-500/20 border border-teal-500/40 font-black shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Ajustes e Configurações"
        >
          <Settings className={`w-4 h-4 mb-0.5 ${activeTab === 'ajustes' ? 'rotate-45' : ''} transition-transform`} />
          <span className="truncate">Ajustes</span>
        </button>

      </div>
    </nav>
  );
};
