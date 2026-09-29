import React, { useState } from 'react';
import { 
  ShieldCheck, 
  KeyRound, 
  Lock, 
  Mail, 
  UserPlus, 
  UserCheck, 
  GraduationCap, 
  Sparkles, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  Check, 
  AlertTriangle, 
  Tv, 
  QrCode, 
  Award,
  BookOpen,
  Phone
} from 'lucide-react';
import { useLab } from '../context/LabContext';
import { AppLogo } from './AppLogo';
import { Professor } from '../types';

interface AuthGateScreenProps {
  onOpenProjectionScreen?: () => void;
  onLoginSuccess?: (isFirstAccess?: boolean) => void;
}

export const AuthGateScreen: React.FC<AuthGateScreenProps> = ({
  onOpenProjectionScreen,
  onLoginSuccess
}) => {
  const { 
    professors,
    loginProfessor, 
    registerProfessor, 
    playBeep 
  } = useLab();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  
  // Selected remembered professor for one-step PIN login
  const [selectedProfId, setSelectedProfId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('bmf4_presenca_v3_last_logged_in_prof');
      if (saved && professors.some(p => p.id === saved)) return saved;
    } catch {}
    return professors[0]?.id || '';
  });

  const [isManualInputMode, setIsManualInputMode] = useState<boolean>(false);
  const [showProfPicker, setShowProfPicker] = useState<boolean>(false);

  // Login Form State
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [showLoginPin, setShowLoginPin] = useState(false);

  // Register Form State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRegistration, setRegRegistration] = useState('');
  const [regDiscipline, setRegDiscipline] = useState('BMF4 - Bases Morfofuncionais 4');
  const [regPhone, setRegPhone] = useState('');
  const [regPin, setRegPin] = useState('');
  const [regConfirmPin, setRegConfirmPin] = useState('');
  const [showRegPin, setShowRegPin] = useState(false);

  // Alerts
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedProfessor = professors.find(p => p.id === selectedProfId) || professors[0];

  const handleQuickPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanPin = loginPin.trim();
    if (!cleanPin) {
      setErrorMessage('Por favor, informe seu PIN de acesso.');
      playBeep('alert');
      return;
    }

    const targetProf = selectedProfessor || professors[0];
    if (!targetProf) {
      setErrorMessage('Docente não encontrado.');
      playBeep('alert');
      return;
    }

    const res = loginProfessor(targetProf.email || targetProf.id, cleanPin);
    if (res.success) {
      setSuccessMessage(res.message);
      if (onLoginSuccess) {
        onLoginSuccess(res.isFirstAccess);
      }
    } else {
      setErrorMessage(res.message);
    }
  };

  const handleManualLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanInput = loginIdentifier.trim();
    if (!cleanInput) {
      setErrorMessage('Por favor, informe seu E-mail, Matrícula ou Nome cadastrado.');
      playBeep('alert');
      return;
    }

    const cleanPin = loginPin.trim();
    if (!cleanPin) {
      setErrorMessage('Por favor, informe o PIN de acesso.');
      playBeep('alert');
      return;
    }

    const res = loginProfessor(cleanInput, cleanPin);
    if (res.success) {
      setSuccessMessage(res.message);
      if (onLoginSuccess) {
        onLoginSuccess(res.isFirstAccess);
      }
    } else {
      setErrorMessage(res.message);
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanName = regName.trim();
    const cleanEmail = regEmail.trim();
    const cleanPin = regPin.trim();
    const cleanConfirm = regConfirmPin.trim();

    if (!cleanName) {
      setErrorMessage('Por favor, informe seu nome completo.');
      playBeep('alert');
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Por favor, informe um e-mail institucional válido.');
      playBeep('alert');
      return;
    }

    if (!cleanPin || cleanPin.length < 4) {
      setErrorMessage('O PIN de acesso deve conter no mínimo 4 dígitos.');
      playBeep('alert');
      return;
    }

    if (cleanPin !== cleanConfirm) {
      setErrorMessage('A confirmação de PIN não coincide com o PIN informado.');
      playBeep('alert');
      return;
    }

    const res = registerProfessor({
      name: cleanName,
      email: cleanEmail,
      registrationNumber: regRegistration.trim() || undefined,
      discipline: regDiscipline.trim() || 'BMF4 - Bases Morfofuncionais 4',
      phone: regPhone.trim() || undefined,
      pin: cleanPin,
      role: 'professor'
    });

    if (res.success) {
      setSuccessMessage(res.message);
      if (onLoginSuccess) {
        onLoginSuccess(cleanPin === '1234');
      }
    } else {
      setErrorMessage(res.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-white flex flex-col justify-between selection:bg-teal-500 selection:text-slate-950">
      
      {/* Top Banner / Navigation */}
      <header className="w-full max-w-6xl mx-auto p-4 sm:p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AppLogo size="md" className="shadow-lg shadow-teal-500/10" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-lg sm:text-xl tracking-tight text-white">
                BMF4
              </span>
              <span className="text-[10px] sm:text-xs font-black tracking-wider uppercase px-2 py-0.5 bg-teal-500/20 text-teal-300 border border-teal-500/40 rounded-md">
                Medicina UNINOVE
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium hidden sm:block">
              Bases Morfofuncionais 4 • Controle de Presença e Laboratório
            </p>
          </div>
        </div>

        {/* Quick External Actions */}
        <div className="flex items-center gap-2">
          {onOpenProjectionScreen && (
            <button
              onClick={onOpenProjectionScreen}
              className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-bold text-slate-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Abrir Telão de Projeção QR Code para a sala de aula"
            >
              <Tv className="w-3.5 h-3.5 text-teal-400" />
              <span className="hidden md:inline">Telão da Sala (TV)</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Center Auth Container */}
      <main className="w-full max-w-lg mx-auto p-4 sm:p-6 flex-1 flex flex-col justify-center">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
          
          {/* Subtle Glow Background Effect */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Title & Badge */}
          <div className="text-center space-y-2 relative">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-bold shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Acesso Restrito ao Sistema</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              {activeTab === 'login' ? 'Entrar como Docente' : 'Cadastrar Novo Docente'}
            </h1>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {activeTab === 'login'
                ? 'Apenas professores cadastrados têm acesso às chamadas, avaliações e relatórios.'
                : 'Crie sua conta docente para gerenciar turmas, presenças e notas de BMF4.'}
            </p>
          </div>

          {/* Toggle Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-800/90 rounded-2xl text-xs font-bold border border-slate-700/60">
            <button
              id="tab-auth-entrar"
              type="button"
              onClick={() => {
                setActiveTab('login');
                setErrorMessage(null);
                setSuccessMessage(null);
                playBeep('click');
              }}
              className={`py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                activeTab === 'login'
                  ? 'bg-teal-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Entrar</span>
            </button>

            <button
              id="tab-auth-criar-conta"
              type="button"
              onClick={() => {
                setActiveTab('register');
                setErrorMessage(null);
                setSuccessMessage(null);
                playBeep('click');
              }}
              className={`py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                activeTab === 'register'
                  ? 'bg-teal-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Criar Conta</span>
            </button>
          </div>

          {/* Alerts */}
          {errorMessage && (
            <div className="p-3 bg-rose-950/80 border border-rose-700/80 text-rose-200 text-xs font-medium rounded-2xl flex items-start gap-2.5 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-700/80 text-emerald-200 text-xs font-bold rounded-2xl flex items-center gap-2.5 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="flex-1">{successMessage}</div>
            </div>
          )}

          {/* TAB 1: LOGIN FORM */}
          {activeTab === 'login' ? (
            !isManualInputMode && selectedProfessor ? (
              /* MODO RÁPIDO: CONFIRMAR SOMENTE O PIN */
              <form onSubmit={handleQuickPinSubmit} className="space-y-4">
                {/* Professor Profile Card */}
                <div className="p-3.5 rounded-2xl bg-slate-800/90 border border-slate-700/80 flex items-center justify-between gap-3 shadow-inner">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-slate-950 font-black text-base flex items-center justify-center shadow-xs shrink-0 border border-teal-400/40">
                      {selectedProfessor.name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('')}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white text-xs sm:text-sm truncate block">
                          {selectedProfessor.name}
                        </span>
                        {selectedProfessor.role === 'admin' && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-extrabold border border-amber-500/30">
                            Admin
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 truncate block">
                        {selectedProfessor.email}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowProfPicker(!showProfPicker)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-700/70 hover:bg-slate-700 text-teal-300 border border-slate-600/70 text-[11px] font-bold transition-all cursor-pointer shrink-0"
                    title="Selecionar outro docente cadastrado"
                  >
                    Trocar
                  </button>
                </div>

                {/* Dropdown/List to Pick another registered professor */}
                {showProfPicker && (
                  <div className="p-2.5 rounded-2xl bg-slate-950 border border-slate-700 shadow-xl space-y-1.5 animate-in fade-in zoom-in-95">
                    <div className="text-[11px] font-bold text-slate-400 px-2 py-1 flex items-center justify-between">
                      <span>Selecione seu perfil docente:</span>
                      <button 
                        type="button" 
                        onClick={() => setShowProfPicker(false)}
                        className="text-slate-400 hover:text-white"
                      >
                        Fechar
                      </button>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1 pr-1 no-scrollbar">
                      {professors.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedProfId(p.id);
                            setShowProfPicker(false);
                            setLoginPin('');
                            setErrorMessage(null);
                          }}
                          className={`w-full text-left p-2 rounded-xl flex items-center justify-between text-xs transition-all cursor-pointer ${
                            p.id === selectedProfessor.id
                              ? 'bg-teal-500/20 border border-teal-500/40 text-teal-200 font-bold'
                              : 'hover:bg-slate-800 text-slate-300'
                          }`}
                        >
                          <div className="truncate">
                            <p className="font-semibold text-white truncate">{p.name}</p>
                            <p className="text-[10px] text-slate-400 truncate">{p.email}</p>
                          </div>
                          {p.id === selectedProfessor.id && (
                            <Check className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="pt-1 border-t border-slate-800 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfPicker(false);
                          setIsManualInputMode(true);
                          setLoginIdentifier('');
                          setLoginPin('');
                        }}
                        className="text-[11px] text-teal-400 hover:underline font-semibold cursor-pointer"
                      >
                        Digitar outro e-mail / matrícula
                      </button>
                    </div>
                  </div>
                )}

                {/* PIN Input Field */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-teal-400" />
                      <span>Confirmar PIN de Acesso</span>
                    </label>
                    <span className="text-[10px] text-slate-400">PIN padrão inicial: 1234</span>
                  </div>
                  <div className="relative">
                    <input
                      id="input-login-pin"
                      type={showLoginPin ? 'text' : 'password'}
                      autoFocus
                      required
                      placeholder="Digite seu PIN de 4 dígitos"
                      value={loginPin}
                      onChange={(e) => setLoginPin(e.target.value)}
                      className="w-full px-4 py-3 text-sm bg-slate-800/90 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono tracking-widest text-center text-lg font-bold pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPin(!showLoginPin)}
                      className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                      title={showLoginPin ? 'Ocultar PIN' : 'Exibir PIN'}
                    >
                      {showLoginPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  id="btn-submit-login-pin"
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 active:scale-98 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Confirmar PIN e Entrar</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsManualInputMode(true);
                      setLoginIdentifier('');
                      setLoginPin('');
                    }}
                    className="text-[11px] text-slate-400 hover:text-slate-300 font-medium cursor-pointer"
                  >
                    Entrar com outra conta / e-mail
                  </button>
                </div>
              </form>
            ) : (
              /* MODO MANUAL: DIGITAR E-MAIL/MATRÍCULA + PIN */
              <form onSubmit={handleManualLoginSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-teal-400" />
                    <span>E-mail Institucional, Nome ou Matrícula</span>
                  </label>
                  <input
                    id="input-login-identifier"
                    type="text"
                    required
                    placeholder="Ex: juliano.pereira@uni9.edu.br ou DOC-1001"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs bg-slate-800/80 border border-slate-700/80 rounded-xl text-white placeholder:text-slate-500 focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-teal-400" />
                      <span>PIN de Acesso</span>
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      id="input-login-pin"
                      type={showLoginPin ? 'text' : 'password'}
                      placeholder="Digite seu PIN"
                      value={loginPin}
                      onChange={(e) => setLoginPin(e.target.value)}
                      className="w-full px-4 py-2.5 text-xs bg-slate-800/80 border border-slate-700/80 rounded-xl text-white placeholder:text-slate-500 focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono tracking-widest pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPin(!showLoginPin)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                      title={showLoginPin ? 'Ocultar PIN' : 'Exibir PIN'}
                    >
                      {showLoginPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  id="btn-submit-login"
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 active:scale-98 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Entrar no Sistema</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>

                {selectedProfessor && (
                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsManualInputMode(false);
                        setLoginPin('');
                      }}
                      className="text-[11px] text-teal-400 hover:underline font-semibold cursor-pointer"
                    >
                      Voltar ao acesso rápido de {selectedProfessor.name.split(' ')[0]}
                    </button>
                  </div>
                )}
              </form>
            )
          ) : (
            /* TAB 2: REGISTER FORM ("Criar Conta") */
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-teal-400" />
                  <span>Nome Completo do Docente</span>
                </label>
                <input
                  id="input-reg-name"
                  type="text"
                  required
                  placeholder="Ex: Prof. Dr. Carlos Eduardo"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-800/80 border border-slate-700/80 rounded-xl text-white placeholder:text-slate-500 focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-teal-400" />
                    <span>E-mail Institucional</span>
                  </label>
                  <input
                    id="input-reg-email"
                    type="email"
                    required
                    placeholder="carlos@uni9.edu.br"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-800/80 border border-slate-700/80 rounded-xl text-white placeholder:text-slate-500 focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-teal-400" />
                    <span>Matrícula (Opcional)</span>
                  </label>
                  <input
                    id="input-reg-matricula"
                    type="text"
                    placeholder="Ex: DOC-1045"
                    value={regRegistration}
                    onChange={(e) => setRegRegistration(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-800/80 border border-slate-700/80 rounded-xl text-white placeholder:text-slate-500 focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-teal-400" />
                  <span>Disciplina</span>
                </label>
                <input
                  id="input-reg-discipline"
                  type="text"
                  placeholder="BMF4 - Bases Morfofuncionais 4"
                  value={regDiscipline}
                  onChange={(e) => setRegDiscipline(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-800/80 border border-slate-700/80 rounded-xl text-white placeholder:text-slate-500 focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-teal-400" />
                    <span>Definir PIN</span>
                  </label>
                  <input
                    id="input-reg-pin"
                    type={showRegPin ? 'text' : 'password'}
                    required
                    placeholder="Mínimo 4 dígitos"
                    value={regPin}
                    onChange={(e) => setRegPin(e.target.value)}
                    maxLength={10}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-800/80 border border-slate-700/80 rounded-xl text-white placeholder:text-slate-500 focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono tracking-widest"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-teal-400" />
                    <span>Confirmar PIN</span>
                  </label>
                  <input
                    id="input-reg-confirm-pin"
                    type={showRegPin ? 'text' : 'password'}
                    required
                    placeholder="Repita o PIN"
                    value={regConfirmPin}
                    onChange={(e) => setRegConfirmPin(e.target.value)}
                    maxLength={10}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-800/80 border border-slate-700/80 rounded-xl text-white placeholder:text-slate-500 focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono tracking-widest"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowRegPin(!showRegPin)}
                  className="text-[11px] text-slate-400 hover:text-teal-300 flex items-center gap-1 cursor-pointer"
                >
                  {showRegPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showRegPin ? 'Ocultar PINs' : 'Exibir PINs digitados'}</span>
                </button>
              </div>

              <button
                id="btn-submit-register"
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 active:scale-98 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Criar Conta e Entrar</span>
              </button>
            </form>
          )}

          {/* Information box about Admin */}
          <div className="p-3 rounded-2xl bg-slate-800/50 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2.5">
            <Award className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Professor Juliano Pereira</strong> é o Administrador Geral do Sistema BMF4.
            </span>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-6xl mx-auto p-4 sm:p-6 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-800/80">
        <div>UNINOVE Medicina • Laboratório de Práticas Médicas e Morfofuncionais</div>
        <div className="flex items-center gap-4">
          <span>Sistema Seguro de Presença e Avaliação</span>
        </div>
      </footer>

    </div>
  );
};
