import React, { useState } from 'react';
import { 
  X, 
  UserCheck, 
  ShieldCheck, 
  KeyRound, 
  Lock, 
  Mail, 
  LogOut, 
  Check, 
  AlertTriangle, 
  GraduationCap, 
  Sparkles, 
  ArrowRight,
  Eye,
  EyeOff,
  UserPlus,
  Award,
  BookOpen
} from 'lucide-react';
import { useLab } from '../context/LabContext';
import { Professor } from '../types';
import { AppLogo } from './AppLogo';

interface ProfessorLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToManagement?: () => void;
}

export const ProfessorLoginModal: React.FC<ProfessorLoginModalProps> = ({
  isOpen,
  onClose,
  onNavigateToManagement
}) => {
  const { 
    activeProfessor, 
    loginProfessor,
    logoutProfessor,
    registerProfessor,
    changeProfessorPin,
    playBeep 
  } = useLab();

  const [mode, setMode] = useState<'credentials' | 'register' | 'change_pin'>('credentials');
  
  // Login Form
  const [identifier, setIdentifier] = useState(activeProfessor?.email || '');
  const [pin, setPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register Form
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRegistration, setRegRegistration] = useState('');
  const [regDiscipline, setRegDiscipline] = useState('BMF4 - Bases Morfofuncionais 4');
  const [regPin, setRegPin] = useState('');
  const [regConfirmPin, setRegConfirmPin] = useState('');
  const [showRegPin, setShowRegPin] = useState(false);

  // Change PIN Form
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [showChangePin, setShowChangePin] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanInput = identifier.trim();
    if (!cleanInput) {
      setErrorMessage('Por favor, informe seu E-mail, Matrícula ou Nome.');
      playBeep('alert');
      return;
    }

    const cleanPin = pin.trim();
    if (!cleanPin) {
      setErrorMessage('Por favor, informe o PIN de acesso.');
      playBeep('alert');
      return;
    }

    const res = loginProfessor(cleanInput, cleanPin);
    if (res.success) {
      setSuccessMessage(res.message);
      setErrorMessage(null);
      setTimeout(() => {
        setSuccessMessage(null);
        setPin('');
        onClose();
      }, 800);
    } else {
      setErrorMessage(res.message);
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanName = regName.trim();
    const cleanEmail = regEmail.trim();
    const cleanPin = regPin.trim();
    const cleanConfirm = regConfirmPin.trim();

    if (!cleanName) {
      setErrorMessage('Por favor, informe o nome completo.');
      playBeep('alert');
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Por favor, informe um e-mail válido.');
      playBeep('alert');
      return;
    }

    if (cleanPin.length < 4) {
      setErrorMessage('O PIN deve conter no mínimo 4 dígitos.');
      playBeep('alert');
      return;
    }

    if (cleanPin !== cleanConfirm) {
      setErrorMessage('A confirmação de PIN não coincide.');
      playBeep('alert');
      return;
    }

    const res = registerProfessor({
      name: cleanName,
      email: cleanEmail,
      registrationNumber: regRegistration.trim() || undefined,
      discipline: regDiscipline.trim() || 'BMF4 - Bases Morfofuncionais 4',
      pin: cleanPin,
      role: 'professor'
    });

    if (res.success) {
      setSuccessMessage(res.message);
      setErrorMessage(null);
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1000);
    } else {
      setErrorMessage(res.message);
    }
  };

  const handleChangePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!activeProfessor) {
      setErrorMessage('Nenhum professor ativo para alterar o PIN.');
      return;
    }

    const cleanNew = newPin.trim();
    const cleanConfirm = confirmNewPin.trim();

    if (cleanNew.length < 4) {
      setErrorMessage('O novo PIN deve ter no mínimo 4 dígitos.');
      playBeep('alert');
      return;
    }

    if (cleanNew !== cleanConfirm) {
      setErrorMessage('Os PINs digitados não coincidem.');
      playBeep('alert');
      return;
    }

    const res = changeProfessorPin(activeProfessor.id, cleanNew);
    if (res.success) {
      setSuccessMessage(res.message);
      setErrorMessage(null);
      setTimeout(() => {
        setSuccessMessage(null);
        setNewPin('');
        setConfirmNewPin('');
        setMode('credentials');
      }, 1200);
    } else {
      setErrorMessage(res.message);
    }
  };

  const handleLogout = () => {
    logoutProfessor();
    setSuccessMessage('Sessão encerrada com sucesso.');
    setErrorMessage(null);
    setIdentifier('');
    setPin('');
    setTimeout(() => {
      setSuccessMessage(null);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] relative">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AppLogo size="sm" />
            <div>
              <div className="text-[10px] font-extrabold text-teal-400 uppercase tracking-wider">
                Autenticação Docente BMF4
              </div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">
                {mode === 'register' ? 'Novo Cadastro Docente' : mode === 'change_pin' ? 'Alterar PIN de Acesso' : 'Login do Professor'}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Fechar janela"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success / Error Alerts */}
        {successMessage && (
          <div className="p-3 bg-emerald-600 text-white text-xs font-bold flex items-center gap-2 px-5 animate-in fade-in">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-rose-600 text-white text-xs font-bold flex items-center gap-2 px-5 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Current Active Professor Status */}
        {activeProfessor ? (
          <div className="p-3.5 mx-4 mt-4 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs text-white shadow-2xs shrink-0 ${
                activeProfessor.role === 'admin' 
                  ? 'bg-gradient-to-tr from-amber-500 to-orange-500' 
                  : 'bg-gradient-to-tr from-teal-600 to-emerald-600'
              }`}>
                {activeProfessor.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider block">
                    Conectado:
                  </span>
                  {activeProfessor.role === 'admin' && (
                    <span className="px-1.5 py-0.2 bg-amber-200 text-amber-900 text-[9px] font-black rounded uppercase">
                      Admin
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold text-slate-900 block truncate">
                  {activeProfessor.name}
                </span>
                <span className="text-[11px] text-slate-500 block truncate">
                  {activeProfessor.email}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setMode('change_pin');
                  setErrorMessage(null);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-teal-100 hover:bg-teal-200 text-teal-800 text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                title="Alterar meu PIN"
              >
                Trocar PIN
              </button>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-700 text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 active:scale-95 shadow-2xs"
                title="Sair da sessão"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sair</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 mx-4 mt-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-2.5 text-xs text-amber-900 font-medium">
            <UserCheck className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Nenhum professor autenticado. Faça login ou crie sua conta abaixo:</span>
          </div>
        )}

        {/* Mode Navigation Tabs */}
        <div className="p-4 border-b border-slate-100">
          <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-2xl text-xs font-bold">
            <button
              type="button"
              onClick={() => { setMode('credentials'); setErrorMessage(null); }}
              className={`py-1.5 px-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 text-[11px] ${
                mode === 'credentials'
                  ? 'bg-white text-slate-900 shadow-xs font-black'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5 text-teal-600" />
              <span>Login</span>
            </button>

            <button
              type="button"
              onClick={() => { setMode('register'); setErrorMessage(null); }}
              className={`py-1.5 px-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 text-[11px] ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-xs font-black'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5 text-teal-600" />
              <span>Criar Conta</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          
          {/* TAB 1: Credentials Login */}
          {mode === 'credentials' && (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-teal-600" />
                  <span>E-mail Institucional, Nome ou Matrícula</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: juliano.pereira@uni9.edu.br ou DOC-1001"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-teal-600" />
                  <span>PIN de Acesso</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Digite seu PIN"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono tracking-widest pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    title={showPassword ? 'Ocultar PIN' : 'Exibir PIN'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 active:scale-98 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Entrar com PIN</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: Register New Professor */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Nome Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Dra. Juliana Santos"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">E-mail</label>
                  <input
                    type="email"
                    required
                    placeholder="juliana@uni9.edu.br"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Matrícula (Op.)</label>
                  <input
                    type="text"
                    placeholder="DOC-1020"
                    value={regRegistration}
                    onChange={(e) => setRegRegistration(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Definir PIN</label>
                  <input
                    type={showRegPin ? 'text' : 'password'}
                    required
                    placeholder="Mínimo 4 dígitos"
                    value={regPin}
                    onChange={(e) => setRegPin(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono tracking-widest"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Confirmar PIN</label>
                  <input
                    type={showRegPin ? 'text' : 'password'}
                    required
                    placeholder="Repita o PIN"
                    value={regConfirmPin}
                    onChange={(e) => setRegConfirmPin(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono tracking-widest"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 active:scale-98 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Cadastrar e Conectar</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 4: Change PIN */}
          {mode === 'change_pin' && (
            <form onSubmit={handleChangePinSubmit} className="space-y-3">
              <div className="p-3 bg-teal-50 rounded-xl border border-teal-200 text-xs text-teal-900">
                Alterando PIN para: <strong>{activeProfessor?.name}</strong>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Novo PIN de Acesso</label>
                <div className="relative">
                  <input
                    type={showChangePin ? 'text' : 'password'}
                    required
                    placeholder="Digite seu novo PIN (mínimo 4 dígitos)"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono tracking-widest pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowChangePin(!showChangePin)}
                    className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showChangePin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Confirmar Novo PIN</label>
                <input
                  type={showChangePin ? 'text' : 'password'}
                  required
                  placeholder="Repita o novo PIN"
                  value={confirmNewPin}
                  onChange={(e) => setConfirmNewPin(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono tracking-widest"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Salvar Novo PIN</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('credentials')}
                  className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Voltar
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Footer info & Management Link */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Award className="w-3.5 h-3.5 text-amber-500" />
            <span>Admin: <strong>Prof. Dr. Juliano</strong></span>
          </span>
          {onNavigateToManagement && (
            <button
              onClick={() => {
                onClose();
                onNavigateToManagement();
              }}
              className="text-teal-700 hover:text-teal-900 font-bold hover:underline cursor-pointer"
            >
              Gerenciar Docentes →
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
