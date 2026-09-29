import React, { useState } from 'react';
import { 
  KeyRound, 
  ShieldCheck, 
  Lock, 
  Eye, 
  EyeOff, 
  Check, 
  AlertTriangle,
  Sparkles,
  ArrowRight,
  X
} from 'lucide-react';
import { useLab } from '../context/LabContext';

interface FirstAccessPinModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FirstAccessPinModal: React.FC<FirstAccessPinModalProps> = ({
  isOpen,
  onClose
}) => {
  const { activeProfessor, changeProfessorPin, playBeep } = useLab();
  
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen || !activeProfessor) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanPin = newPin.trim();
    const cleanConfirm = confirmPin.trim();

    if (!cleanPin || cleanPin.length < 4) {
      setErrorMessage('O novo PIN deve conter no mínimo 4 dígitos ou caracteres.');
      playBeep('alert');
      return;
    }

    if (cleanPin !== cleanConfirm) {
      setErrorMessage('Os PINs digitados não coincidem. Verifique a confirmação.');
      playBeep('alert');
      return;
    }

    if (cleanPin === '1234') {
      setErrorMessage('Escolha um PIN diferente do padrão "1234" para sua segurança.');
      playBeep('alert');
      return;
    }

    const res = changeProfessorPin(activeProfessor.id, cleanPin);
    if (res.success) {
      setSuccessMessage(res.message);
      playBeep('success');
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1200);
    } else {
      setErrorMessage(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 flex flex-col relative animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-teal-900 via-slate-900 to-teal-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300 shadow-xs">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-extrabold text-teal-300 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Primeiro Acesso • Segurança</span>
              </div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
                Personalizar seu PIN de Acesso
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alerts */}
        {errorMessage && (
          <div className="p-3 bg-rose-600 text-white text-xs font-bold flex items-center gap-2 px-5 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-600 text-white text-xs font-bold flex items-center gap-2 px-5 animate-in fade-in">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="p-3.5 rounded-2xl bg-teal-50/80 border border-teal-200/80 text-xs text-teal-950 space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-teal-900">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              <span>Olá, {activeProfessor.name}!</span>
            </p>
            <p className="text-slate-600 text-[11.5px] leading-relaxed">
              Você acessou o sistema com o <strong>PIN padrão inicial (1234)</strong>. Recomendamos cadastrar um PIN pessoal e exclusivo de 4 a 8 dígitos para proteger suas chamadas e notas.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-teal-600" />
                  <span>Novo PIN de Acesso</span>
                </div>
                <span className="text-[10px] text-slate-400 font-normal">Mínimo 4 dígitos</span>
              </label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  required
                  placeholder="Digite seu novo PIN (ex: 4589)"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  maxLength={12}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono tracking-widest pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title={showPin ? 'Ocultar PIN' : 'Exibir PIN'}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-teal-600" />
                <span>Confirmar Novo PIN</span>
              </label>
              <input
                type={showPin ? 'text' : 'password'}
                required
                placeholder="Repita o novo PIN"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                maxLength={12}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono tracking-widest"
              />
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="submit"
                className="flex-1 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 active:scale-98 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Salvar Novo PIN</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
              >
                Lembrar Mais Tarde
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-center text-[11px] text-slate-400">
          Você poderá alterar seu PIN a qualquer momento no menu de Docentes.
        </div>

      </div>
    </div>
  );
};
