import React, { useState } from 'react';
import { 
  Building2, 
  Clock, 
  Volume2, 
  VolumeX, 
  ShieldCheck, 
  RotateCcw, 
  Download, 
  Printer, 
  Check, 
  Sliders,
  Sparkles,
  Info,
  Layers,
  Database,
  Smartphone,
  Tv,
  Lock,
  RefreshCw,
  UserCheck,
  AlertTriangle,
  UserPlus,
  Monitor,
  Tablet,
  Laptop,
  Wifi,
  Radio,
  Signal,
  CheckCircle2,
  Globe,
  UploadCloud,
  Inbox,
  CheckCircle,
  AlertCircle,
  Clock3,
  Trash2,
  Calendar,
  FileText
} from 'lucide-react';
import { useLab } from '../context/LabContext';
import { AntiFraudMode, DeviceType } from '../types';

interface SettingsViewProps {
  onOpenGoogleCalendar?: () => void;
  onOpenGoogleForms?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onOpenGoogleCalendar,
  onOpenGoogleForms
}) => {
  const { 
    appSettings, 
    updateAppSettings, 
    soundEnabled, 
    setSoundEnabled, 
    resetAllData, 
    classes, 
    selectedClassId, 
    students,
    activeSession,
    playBeep,
    deviceFingerprint,
    resetDeviceLockForTesting,
    connectedDevicesList,
    customDeviceName,
    setCustomDeviceName,
    deviceType,
    setDeviceType,
    isOnline,
    realtimeConnected,
    lastSyncDate,
    triggerSync,
    isSyncing,
    activeProfessor,
    teacherPresences,
    outboxQueue,
    outboxPendingCount,
    isOutboxSyncing,
    lastOutboxSyncDate,
    enqueueOutboxItem,
    processOutboxQueue,
    clearSyncedOutbox
  } = useLab();

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [instName, setInstName] = useState(appSettings.institutionName);
  const [tolerance, setTolerance] = useState(appSettings.toleranceMinutes);
  const [antiFraudMode, setAntiFraudMode] = useState<AntiFraudMode>(appSettings.antiFraudMode || 'ultra_secure_tv');
  const [tokenRotation, setTokenRotation] = useState<number>(appSettings.tokenRotationSeconds || 90);
  const [singleDeviceLock, setSingleDeviceLock] = useState<boolean>(appSettings.singleDeviceLock ?? true);
  const [strictDeviceBinding, setStrictDeviceBinding] = useState<boolean>(appSettings.strictDeviceBinding ?? true);
  const [allowSelfReg, setAllowSelfReg] = useState<boolean>(appSettings.allowSelfRegistration ?? true);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    playBeep('success');
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  const selectedClass = classes.find(c => c.id === selectedClassId);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateAppSettings({
      institutionName: instName,
      toleranceMinutes: Number(tolerance),
      antiFraudMode,
      tokenRotationSeconds: Number(tokenRotation),
      singleDeviceLock,
      strictDeviceBinding,
      allowSelfRegistration: allowSelfReg,
    });
    setSavedSuccess(true);
    playBeep('success');
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handlePrintDiary = () => {
    window.print();
  };

  const handleExportFullJSON = () => {
    const data = {
      classes,
      students,
      settings: appSettings,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_anatopresenca_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    playBeep('success');
  };

  return (
    <div className="w-full max-w-md md:max-w-2xl lg:max-w-4xl mx-auto space-y-6 pb-28 pt-2">
      
      {/* Title */}
      <div className="px-1">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Ajustes & Segurança do Laboratório
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Personalize parâmetros anti-fraude para projeção em TV, tolerância de atrasos e dados
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>Configurações salvas com sucesso!</span>
        </div>
      )}

      {feedbackMessage && (
        <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200 text-sky-900 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-sky-600" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Anti-Fraud TV Projection Security Section */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Tv className="w-4 h-4 text-sky-600" />
              Proteção Anti-Fraude para Telão / TV Universitária
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase">
              Blindagem Ativa
            </span>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Recursos projetados especificamente para evitar que alunos tirem fotos do telão e enviem por WhatsApp para colegas ausentes registrarem presença.
          </p>

          {/* Mode Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div 
              onClick={() => {
                setAntiFraudMode('ultra_secure_tv');
                setTokenRotation(10);
                setSingleDeviceLock(true);
              }}
              className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                antiFraudMode === 'ultra_secure_tv'
                  ? 'bg-sky-50/70 border-sky-500 shadow-xs'
                  : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/60'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-sky-600" />
                  Ultra-Seguro TV (Recomendado)
                </span>
                {antiFraudMode === 'ultra_secure_tv' && (
                  <Check className="w-4 h-4 text-sky-600" />
                )}
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                QR rotativo a cada 10s + bloqueio de 1 presença por celular físico + marca d'água no telão.
              </p>
            </div>

            <div 
              onClick={() => {
                setAntiFraudMode('standard_dynamic');
                setTokenRotation(15);
              }}
              className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                antiFraudMode === 'standard_dynamic'
                  ? 'bg-sky-50/70 border-sky-500 shadow-xs'
                  : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/60'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <RefreshCw className="w-4 h-4 text-slate-600" />
                  Dinâmico Balanceado
                </span>
                {antiFraudMode === 'standard_dynamic' && (
                  <Check className="w-4 h-4 text-sky-600" />
                )}
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                Ciclo de 15 segundos para salas maiores ou com menor densidade de rede.
              </p>
            </div>
          </div>

          {/* Token rotation slider */}
          <div className="space-y-1.5 pt-2">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-sky-600" />
                Tempo de Exibição / Rotação do QR Code Dinâmico
              </span>
              <span className="text-sky-800 font-mono font-bold bg-sky-50 px-2 py-0.5 rounded-lg border border-sky-200">
                {tokenRotation} segundos
              </span>
            </label>
            <input
              type="range"
              min={15}
              max={180}
              step={5}
              value={tokenRotation}
              onChange={(e) => setTokenRotation(Number(e.target.value))}
              className="w-full accent-sky-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-medium">
              <span>15s</span>
              <span>45s</span>
              <span className="text-sky-700 font-bold">90s (Recomendado)</span>
              <span>120s (Sala Grande)</span>
              <span>180s (Estendido)</span>
            </div>
            <p className="text-[11px] text-slate-500 pt-0.5">
              Tempo estendido para garantir foco perfeito e leitura imediata de câmeras de smartphones no telão ou projetor.
            </p>
          </div>

          {/* Single Device Lock Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Trava por Aparelho Físico (Anti-Procuração)</div>
                <div className="text-[11px] text-slate-500">Impede que 1 aluno com o próprio celular marque presença para outros ausentes</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSingleDeviceLock(!singleDeviceLock)}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                singleDeviceLock ? 'bg-sky-700' : 'bg-slate-300'
              }`}
            >
              <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                singleDeviceLock ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Strict Device Binding Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Vínculo Estrito de Aparelho ao Aluno</div>
                <div className="text-[11px] text-slate-500">Trava permanentemente o RA ao primeiro celular utilizado. Impede troca de aparelho sem liberação do professor.</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStrictDeviceBinding(!strictDeviceBinding)}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                strictDeviceBinding ? 'bg-teal-700' : 'bg-slate-300'
              }`}
            >
              <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                strictDeviceBinding ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Auto Registration Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <UserPlus className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Permitir Auto-Cadastro no Telão</div>
                <div className="text-[11px] text-slate-500">Alunos novatos ou não listados podem digitar nome e RA para inclusão imediata</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAllowSelfReg(!allowSelfReg)}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                allowSelfReg ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                allowSelfReg ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Device Fingerprint Diagnostics */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">ID do Navegador (Anti-Fraude):</span>
              <span className="font-mono text-slate-700 font-bold text-xs">{deviceFingerprint}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                resetDeviceLockForTesting();
                showFeedback('ID do dispositivo redefinido para testes!');
              }}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 text-[10px] font-bold cursor-pointer"
              title="Gera um novo ID para simular outro celular"
            >
              Redefinir ID (Para Teste)
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* Sincronização & Dispositivos Conectados em Tempo Real */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Radio className="w-4 h-4 text-teal-600 animate-pulse" />
              Sincronização & Dispositivos Conectados
            </h2>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                isOnline && realtimeConnected 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : isOnline 
                  ? 'bg-sky-100 text-sky-800' 
                  : 'bg-amber-100 text-amber-800'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  isOnline && realtimeConnected ? 'bg-emerald-500 animate-ping' : isOnline ? 'bg-sky-500' : 'bg-amber-500'
                }`} />
                {isOnline && realtimeConnected ? 'WebSocket & Nuvem Ativos' : isOnline ? 'Nuvem Conectada' : 'Modo Offline'}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Gerencie e monitore todos os dispositivos conectados à sala (Telão TV, Smartphone do Docente, Tablets de Monitores e Portais).
          </p>

          {/* Configuração deste Dispositivo */}
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-3.5">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-teal-600" />
              Identificação deste Dispositivo:
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Nome / Apelido deste Terminal</label>
                <input
                  type="text"
                  value={customDeviceName}
                  onChange={(e) => setCustomDeviceName(e.target.value)}
                  placeholder="Ex: Telão Lab 4 / Celular Clayton"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Função do Dispositivo</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { type: 'tv' as DeviceType, label: 'Telão TV', icon: Tv },
                    { type: 'mobile' as DeviceType, label: 'Celular', icon: Smartphone },
                    { type: 'tablet' as DeviceType, label: 'Tablet', icon: Tablet },
                    { type: 'desktop' as DeviceType, label: 'PC / Lab', icon: Monitor },
                  ].map(d => {
                    const Icon = d.icon;
                    const isSelected = deviceType === d.type;
                    return (
                      <button
                        key={d.type}
                        type="button"
                        onClick={() => {
                          setDeviceType(d.type);
                          showFeedback(`Tipo alterado para ${d.label}`);
                        }}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border text-[10px] font-bold transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-teal-600 text-white border-teal-700 shadow-xs' 
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 mb-1" />
                        <span>{d.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Lista de Dispositivos Conectados no Momento */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span>Dispositivos Conectados na Rede ({connectedDevicesList.length}):</span>
              <span className="text-[11px] font-normal text-slate-500">Última sinc: {lastSyncDate}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {connectedDevicesList.map((dev, idx) => {
                const isCurrent = dev.deviceId === (localStorage.getItem('bmf4_device_uuid') || 'local_device');
                const Icon = dev.deviceType === 'tv' ? Tv : dev.deviceType === 'mobile' ? Smartphone : dev.deviceType === 'tablet' ? Tablet : Monitor;
                return (
                  <div 
                    key={dev.deviceId || idx}
                    className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                      isCurrent 
                        ? 'bg-teal-50/60 border-teal-200' 
                        : 'bg-slate-50/70 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        isCurrent ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-700'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900">{dev.deviceName}</span>
                          {isCurrent && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-teal-200 text-teal-900 uppercase">
                              Este
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1">
                          <span>{dev.professorName ? `Docente: ${dev.professorName}` : dev.userRole || 'Terminal de Sala'}</span>
                          <span>•</span>
                          <span className="capitalize">{dev.deviceType}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-emerald-700">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Online</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sync Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
            <div className="text-[11px] text-slate-500">
              A sincronização ocorre automaticamente em tempo real via WebSocket e Firestore.
            </div>
            <button
              type="button"
              onClick={triggerSync}
              disabled={isSyncing}
              className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-teal-400' : ''}`} />
              <span>{isSyncing ? 'Sincronizando...' : 'Forçar Sincronização Agora'}</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* Fila de Mensagens Offline ('Outbox') no Firestore */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-amber-600" />
              Fila de Mensagens Offline ('Outbox') no Firestore
            </h2>
            <div className="flex items-center gap-2">
              {outboxPendingCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 animate-pulse">
                  <Clock3 className="w-3.5 h-3.5 text-amber-600" />
                  {outboxPendingCount} {outboxPendingCount === 1 ? 'pendente' : 'pendentes'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  Fila Sincronizada
                </span>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Garante a tolerância a falhas e sincronização sem perdas: toda marcação de presença, justificativa ou alteração realizada enquanto o dispositivo estiver desconectado é enfileirada no buffer local e gravada automaticamente na coleção <code>outbox</code> do Firestore e no servidor assim que o sinal de internet for restabelecido.
          </p>

          {/* Cards de Status do Outbox */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total na Fila</div>
              <div className="text-xl font-black text-slate-800 mt-1">{outboxQueue.length}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Buffer local</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200">
              <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Pendentes</div>
              <div className="text-xl font-black text-amber-900 mt-1">{outboxPendingCount}</div>
              <div className="text-[10px] text-amber-700/80 mt-0.5">Aguardando sync</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200">
              <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Gravados na Nuvem</div>
              <div className="text-xl font-black text-emerald-900 mt-1">
                {outboxQueue.filter(i => (i.syncStatus || (i as any).status) === 'synced').length}
              </div>
              <div className="text-[10px] text-emerald-700/80 mt-0.5">Salvos no Firestore</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-sky-50/80 border border-sky-200">
              <div className="text-[11px] font-bold text-sky-800 uppercase tracking-wider">Último Sync</div>
              <div className="text-xs font-bold text-sky-950 mt-2 truncate" title={lastOutboxSyncDate || 'Ainda não processado'}>
                {lastOutboxSyncDate ? lastOutboxSyncDate.split(' ')[1] || lastOutboxSyncDate : 'Automático'}
              </div>
              <div className="text-[10px] text-sky-700/80 mt-0.5">Gatilho por rede/foco</div>
            </div>
          </div>

          {/* Lista de Registros Recentes do Outbox */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span>Itens na Fila de Transmissão ({outboxQueue.length}):</span>
              {outboxQueue.some(i => (i.syncStatus || (i as any).status) === 'synced') && (
                <button
                  type="button"
                  onClick={() => {
                    clearSyncedOutbox();
                    showFeedback('Histórico de itens sincronizados limpo.');
                  }}
                  className="text-[11px] text-slate-500 hover:text-rose-600 flex items-center gap-1 font-medium cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  Limpar itens já sincronizados
                </button>
              )}
            </div>

            {outboxQueue.length === 0 ? (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-center text-xs text-slate-500">
                A fila Outbox está vazia no momento. Todas as frequências estão perfeitamente sincronizadas com a nuvem.
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {outboxQueue.slice(0, 15).map((item) => {
                  const itemSyncStatus = item.syncStatus || (item.status === 'synced' ? 'synced' : 'pending');
                  const isSynced = itemSyncStatus === 'synced';
                  const isSyncing = itemSyncStatus === 'syncing';
                  const isPending = itemSyncStatus === 'pending';
                  const attemptsCount = item.retryCount ?? item.attempts ?? 0;

                  return (
                    <div
                      key={item.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                        isSynced
                          ? 'bg-slate-50 border-slate-200 text-slate-700'
                          : isSyncing
                          ? 'bg-sky-50/90 border-sky-200 text-sky-900'
                          : isPending
                          ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                          : 'bg-rose-50 border-rose-200 text-rose-900'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${
                          isSynced
                            ? 'bg-emerald-500'
                            : isSyncing
                            ? 'bg-sky-500 animate-pulse'
                            : isPending
                            ? 'bg-amber-500 animate-pulse'
                            : 'bg-rose-500'
                        }`} />
                        <div>
                          <div className="font-bold flex items-center gap-1.5">
                            <span>{item.studentName || item.studentId || 'Evento em Lote'}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/80 border border-black/5 uppercase">
                              {item.eventType}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Horário: {item.timestamp || new Date(item.createdAt).toLocaleTimeString()}
                            {attemptsCount > 0 && ` • Tentativas: ${attemptsCount}`}
                            {item.lastError && (
                              <span className="text-rose-600 block sm:inline sm:ml-1 font-medium">
                                • {item.lastError}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                          isSynced
                            ? 'bg-emerald-100 text-emerald-800'
                            : isSyncing
                            ? 'bg-sky-100 text-sky-800 animate-pulse'
                            : isPending
                            ? 'bg-amber-200 text-amber-900'
                            : 'bg-rose-200 text-rose-900'
                        }`}>
                          {isSynced ? 'Nuvem' : isSyncing ? 'Enviando...' : isPending ? 'Pendente' : 'Falha'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Ações da Fila Outbox */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                const sampleStudent = students[0];
                enqueueOutboxItem({
                  eventType: 'RECORD_ATTENDANCE',
                  sessionId: activeSession?.id || 'session-test',
                  studentId: sampleStudent?.id || 'std-test',
                  studentName: sampleStudent?.name || 'Aluno Teste',
                  classGroupId: selectedClassId || 'class-test',
                  status: 'present',
                  period: 'both',
                  timestamp: new Date().toLocaleTimeString(),
                  payload: {
                    testMode: true,
                    note: 'Item de teste de fila offline'
                  }
                });
                showFeedback('Item de teste adicionado à fila Outbox!');
              }}
              className="w-full sm:w-auto px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 transition-all active:scale-95 cursor-pointer"
            >
              + Adicionar Item de Teste na Fila
            </button>

            <button
              type="button"
              onClick={() => {
                processOutboxQueue(true);
                showFeedback('Processando fila Outbox em lote...');
              }}
              disabled={isOutboxSyncing}
              className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer shadow-xs disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isOutboxSyncing ? 'animate-spin text-amber-200' : ''}`} />
              <span>{isOutboxSyncing ? 'Sincronizando em Lote...' : 'Processar Fila Outbox Agora'}</span>
            </button>
          </div>
        </div>

        {/* Institution & Classroom Settings */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-5">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#0f4c81]" />
            Instituição & Laboratório
          </h2>

          {/* Institution Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              Nome da Instituição de Ensino
            </label>
            <input
              type="text"
              value={instName}
              onChange={(e) => setInstName(e.target.value)}
              placeholder="Ex: UNINOVE MEDICINA"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          {/* Session Duration & Manual Closure Info */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-sky-50/80 border border-sky-200/80">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Duração da Chamada: Tempo Indeterminado</div>
                <div className="text-[11px] text-slate-600">A chamada permanece aberta até que o professor clique em <strong>Encerrar Chamada</strong>, permitindo que todos os alunos respondam sem pressa.</div>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
              Controle Manual
            </span>
          </div>

          {/* Tolerance */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>Tolerância para Atraso (minutos)</span>
              <span className="text-sky-800 font-bold">{tolerance} min</span>
            </label>
            <input
              type="range"
              min={0}
              max={60}
              step={5}
              value={tolerance}
              onChange={(e) => setTolerance(Number(e.target.value))}
              className="w-full accent-[#0f4c81]"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-medium">
              <span>0 min (Sem tolerância)</span>
              <span>15 min (Padrão)</span>
              <span>60 min</span>
            </div>
          </div>

          {/* Toggles */}
          <div className="pt-2 space-y-3 border-t border-slate-100">
            
            {/* Sound toggle */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center">
                    {soundEnabled ? <Volume2 className="w-4 h-4 text-teal-700" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Sinal Sonoro & Efeitos de Presença</div>
                    <div className="text-[11px] text-slate-500">Sintetizador acústico otimizado para laboratório e sala de aula</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !soundEnabled;
                    setSoundEnabled(next);
                    if (next) playBeep('success');
                  }}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                    soundEnabled ? 'bg-teal-600' : 'bg-slate-300'
                  }`}
                >
                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    soundEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Sound Effect Test Buttons */}
              {soundEnabled && (
                <div className="pt-2 border-t border-slate-200/70 space-y-1.5 animate-in fade-in">
                  <span className="text-[10.5px] font-bold text-slate-600 block">
                    Testar Sinal Sonoro neste Dispositivo:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={() => playBeep('success')}
                      className="px-2 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-[10px] font-bold transition-all active:scale-95 cursor-pointer text-center"
                    >
                      🔔 Presença OK
                    </button>
                    <button
                      type="button"
                      onClick={() => playBeep('scan')}
                      className="px-2 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 text-[10px] font-bold transition-all active:scale-95 cursor-pointer text-center"
                    >
                      ⚡ QR Code Lido
                    </button>
                    <button
                      type="button"
                      onClick={() => playBeep('checkpoint')}
                      className="px-2 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 text-[10px] font-bold transition-all active:scale-95 cursor-pointer text-center"
                    >
                      📍 Checkpoint
                    </button>
                    <button
                      type="button"
                      onClick={() => playBeep('alert')}
                      className="px-2 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 text-[10px] font-bold transition-all active:scale-95 cursor-pointer text-center"
                    >
                      ⚠️ Alerta/Erro
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Biosafety EPI Requirement */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Exigir Verificação de EPI</div>
                  <div className="text-[11px] text-slate-500">Jaleco obrigatório, calçado fechado e luvas anatômicas</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => updateAppSettings({ requireEPI: !appSettings.requireEPI })}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                  appSettings.requireEPI ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  appSettings.requireEPI ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs sm:text-sm font-bold shadow-md transition-all active:scale-98"
          >
            Salvar Todas as Configurações
          </button>
        </div>
      </form>

      {/* Relatórios & Ações Rápidas */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Database className="w-4 h-4 text-[#0f4c81]" />
          Relatórios & Backup de Dados
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={handlePrintDiary}
            className="p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-sky-50/50 hover:border-sky-300 text-left transition-all flex items-start gap-3 group"
          >
            <div className="p-2 rounded-xl bg-white text-sky-800 border border-slate-200 group-hover:bg-sky-100">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">Imprimir Diário de Classe</div>
              <div className="text-[11px] text-slate-500">Folha oficial formatada para assinatura</div>
            </div>
          </button>

          <button
            onClick={handleExportFullJSON}
            className="p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-sky-50/50 hover:border-sky-300 text-left transition-all flex items-start gap-3 group"
          >
            <div className="p-2 rounded-xl bg-white text-sky-800 border border-slate-200 group-hover:bg-sky-100">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">Backup Completo (JSON)</div>
              <div className="text-[11px] text-slate-500">Exportar todos os alunos e histórico</div>
            </div>
          </button>
        </div>

        {/* Reset / Clear Data */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-700">Atualizar Aplicativo / Limpar Cache PWA</div>
            <div className="text-[11px] text-slate-400">Forçar carregamento da versão mais recente do GitHub/servidor no celular ou computador</div>
          </div>
          <button
            type="button"
            onClick={async () => {
              try {
                if ('serviceWorker' in navigator) {
                  const regs = await navigator.serviceWorker.getRegistrations();
                  for (const reg of regs) {
                    await reg.unregister();
                  }
                }
                if ('caches' in window) {
                  const keys = await caches.keys();
                  for (const key of keys) {
                    await caches.delete(key);
                  }
                }
                showFeedback('Cache limpo! Recarregando versão mais recente...');
                setTimeout(() => {
                  window.location.reload();
                }, 800);
              } catch {
                window.location.reload();
              }
            }}
            className="px-3 py-1.5 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar App
          </button>
        </div>

        {/* Google Workspace Integrations */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="text-xs font-bold text-slate-700">Integrações Google Workspace (Calendar & Forms)</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {onOpenGoogleCalendar && (
              <button
                type="button"
                onClick={onOpenGoogleCalendar}
                className="p-3.5 rounded-2xl border border-teal-200 bg-teal-50/60 hover:bg-teal-100/70 text-teal-900 transition-all flex items-center gap-3 cursor-pointer group shadow-2xs"
              >
                <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-teal-900">Google Calendar</div>
                  <div className="text-[11px] text-teal-700">Sincronizar aulas e agenda</div>
                </div>
              </button>
            )}

            {onOpenGoogleForms && (
              <button
                type="button"
                onClick={onOpenGoogleForms}
                className="p-3.5 rounded-2xl border border-purple-200 bg-purple-50/60 hover:bg-purple-100/70 text-purple-900 transition-all flex items-center gap-3 cursor-pointer group shadow-2xs"
              >
                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-purple-900">Google Forms</div>
                  <div className="text-[11px] text-purple-700">Criar formulários de presença</div>
                </div>
              </button>
            )}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-700">Limpar Dados do Sistema (Cadastros em Branco)</div>
            <div className="text-[11px] text-slate-400">Deixar cadastros limpos em branco (Alunos, Turmas, Docentes e Chamadas)</div>
          </div>
          <button
            type="button"
            onClick={() => setIsResetModalOpen(true)}
            className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Limpar Tudo
          </button>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <RotateCcw className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-slate-900 text-base">
                Limpar Todos os Cadastros?
              </h3>
              <p className="text-xs text-slate-500">
                Esta ação deixará todos os cadastros em branco (zerando lista de docentes, turmas, alunos e histórico de chamadas).
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="w-1/2 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  resetAllData();
                  setIsResetModalOpen(false);
                  showFeedback('Todos os cadastros foram limpos com sucesso.');
                }}
                className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                Sim, Limpar Tudo
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
