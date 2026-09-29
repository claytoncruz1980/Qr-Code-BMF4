import React, { useState, useMemo } from 'react';
import { 
  UserCheck, 
  Plus, 
  Trash2, 
  Edit3, 
  Mail, 
  Phone, 
  BookOpen, 
  Check, 
  X, 
  Search, 
  ShieldCheck, 
  GraduationCap, 
  AlertTriangle,
  Lock,
  KeyRound,
  ShieldAlert,
  Award,
  LogOut
} from 'lucide-react';
import { useLab } from '../context/LabContext';
import { Professor } from '../types';

export const ProfessorsManagement: React.FC = () => {
  const { 
    professors, 
    activeProfessorId, 
    setActiveProfessorId, 
    activeProfessor,
    loginProfessor,
    logoutProfessor,
    addProfessor, 
    updateProfessor, 
    deleteProfessor,
    classes,
    playBeep
  } = useLab();

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProf, setEditingProf] = useState<Professor | null>(null);
  const [deletingProf, setDeletingProf] = useState<Professor | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    pin: '1234',
    discipline: 'BMF4 - Bases Morfofuncionais 4',
    registrationNumber: '',
    role: 'professor' as 'admin' | 'professor' | 'coordenador' | 'monitor',
    assignedClassIds: [] as string[],
  });

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Check if current active user is Admin
  const isCurrentAdmin = activeProfessor?.role === 'admin' || professors.length <= 1;

  const sortedProfessors = useMemo(() => {
    return [...professors]
      .filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.email && p.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.discipline && p.discipline.toLowerCase().includes(searchTerm.toLowerCase()))
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' }));
  }, [professors, searchTerm]);

  const handleOpenAdd = () => {
    setEditingProf(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      pin: '1234',
      discipline: 'BMF4 - Bases Morfofuncionais 4',
      registrationNumber: `DOC-${Math.floor(1000 + Math.random() * 9000)}`,
      role: professors.length === 0 ? 'admin' : 'professor',
      assignedClassIds: classes.map(c => c.id),
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (prof: Professor) => {
    setEditingProf(prof);
    setFormData({
      name: prof.name,
      email: prof.email,
      phone: prof.phone || '',
      pin: prof.pin || '1234',
      discipline: prof.discipline || 'BMF4 - Bases Morfofuncionais 4',
      registrationNumber: prof.registrationNumber || '',
      role: prof.role || 'professor',
      assignedClassIds: prof.assignedClassIds || [],
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formData.name.trim();
    if (!cleanName) return;

    if (editingProf) {
      updateProfessor(editingProf.id, {
        name: cleanName,
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        pin: formData.pin.trim() || '1234',
        password: formData.pin.trim() || '1234',
        discipline: formData.discipline.trim(),
        registrationNumber: formData.registrationNumber.trim(),
        role: formData.role,
        assignedClassIds: formData.assignedClassIds,
      });
      showToast(`Docente "${cleanName}" atualizado com sucesso.`, 'success');
    } else {
      addProfessor({
        name: cleanName,
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        pin: formData.pin.trim() || '1234',
        password: formData.pin.trim() || '1234',
        discipline: formData.discipline.trim(),
        registrationNumber: formData.registrationNumber.trim(),
        role: formData.role,
        assignedClassIds: formData.assignedClassIds,
      });
      showToast(`Novo docente "${cleanName}" cadastrado com sucesso.`, 'success');
    }

    setIsModalOpen(false);
  };

  const handleAttemptDelete = (prof: Professor) => {
    if (professors.length <= 1) {
      playBeep('alert');
      showToast('Não é permitido excluir o único docente cadastrado no sistema.', 'error');
      return;
    }
    setDeletingProf(prof);
  };

  const handleConfirmDelete = () => {
    if (!deletingProf) return;
    const res = deleteProfessor(deletingProf.id);
    setDeletingProf(null);
    if (res.success) {
      showToast(res.message, 'success');
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleToggleClass = (classId: string) => {
    setFormData(prev => {
      const exists = prev.assignedClassIds.includes(classId);
      if (exists) {
        return { ...prev, assignedClassIds: prev.assignedClassIds.filter(id => id !== classId) };
      } else {
        return { ...prev, assignedClassIds: [...prev.assignedClassIds, classId] };
      }
    });
  };

  return (
    <div className="space-y-4 max-w-full pb-16 sm:pb-8">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-md animate-in fade-in slide-in-from-top-2 ${
          toastType === 'success' 
            ? 'bg-emerald-500 text-white' 
            : 'bg-rose-600 text-white'
        }`}>
          <div className="flex items-center gap-2">
            {toastType === 'success' ? <Check className="w-4 h-4 text-white shrink-0" /> : <AlertTriangle className="w-4 h-4 text-white shrink-0" />}
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-white/80 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Info & Role Status */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-sky-600" />
              Gestão de Docentes & Login BMF4
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Gerencie a equipe docente, defina o Professor Admin e selecione o perfil ativo para lançamento de notas e presenças.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className={`px-3 py-1.5 rounded-2xl border text-xs font-bold flex items-center gap-1.5 ${
              isCurrentAdmin 
                ? 'bg-amber-50 text-amber-900 border-amber-300' 
                : 'bg-slate-50 text-slate-700 border-slate-200'
            }`}>
              <ShieldCheck className={`w-4 h-4 ${isCurrentAdmin ? 'text-amber-600' : 'text-slate-400'}`} />
              <span>Sessão Atual: {isCurrentAdmin ? 'Professor Admin (Controle Total)' : 'Docente'}</span>
            </div>
          </div>
        </div>

        {/* Action Header: Search & New Docente */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="input-search-professors"
              type="text"
              placeholder="Buscar docente por nome ou e-mail (A-Z)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
            />
          </div>

          <button
            id="btn-add-professor"
            onClick={handleOpenAdd}
            className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 text-white text-xs font-bold rounded-2xl shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            Cadastrar Novo Docente
          </button>
        </div>
      </div>

      {/* Grid of Professors */}
      {sortedProfessors.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-dashed border-slate-300 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto">
            <UserCheck className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800">
              {searchTerm ? 'Nenhum docente encontrado com este filtro' : 'Nenhum docente cadastrado'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Cadastre os professores responsáveis pelas disciplinas e chamadas de BMF4.
            </p>
          </div>
          {!searchTerm && (
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 text-white text-xs font-bold rounded-2xl shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Cadastrar Primeiro Docente
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedProfessors.map((prof) => {
            const isActive = prof.id === activeProfessorId;
            const isProfAdmin = prof.role === 'admin';

            return (
              <div
                key={prof.id}
                className={`bg-white rounded-3xl p-5 border transition-all relative overflow-hidden ${
                  isActive 
                    ? 'border-sky-500 ring-2 ring-sky-100 shadow-sm' 
                    : 'border-slate-200/90 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  
                  {/* Left Avatar & Name */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm text-white shadow-xs shrink-0 ${
                      isProfAdmin
                        ? 'bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-600'
                        : 'bg-gradient-to-tr from-sky-600 to-teal-600'
                    }`}>
                      {prof.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-sm text-slate-900 leading-tight truncate max-w-full" title={prof.name}>
                          {prof.name}
                        </h3>
                        {prof.role === 'admin' && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 text-[10px] font-extrabold uppercase">
                            Admin
                          </span>
                        )}
                        {prof.role === 'coordenador' && (
                          <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-300 text-[10px] font-extrabold uppercase">
                            Coordenador
                          </span>
                        )}
                        {prof.role === 'monitor' && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-300 text-[10px] font-extrabold uppercase">
                            Monitor
                          </span>
                        )}
                        {isActive && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                            Conectado
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-semibold text-sky-700 flex items-center gap-1 mt-0.5 truncate">
                        <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{prof.discipline || 'BMF4 Medicina'}</span>
                      </p>
                    </div>
                  </div>

                  {/* Actions: Edit & Delete (Delete only accessible/actionable by Admin) */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenEdit(prof)}
                      title="Editar Docente"
                      className="p-2 rounded-xl text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleAttemptDelete(prof)}
                      title={isCurrentAdmin ? "Excluir Docente (Permissão de Admin)" : "Apenas o Professor Admin pode excluir docentes"}
                      className={`p-2 rounded-xl transition-colors cursor-pointer ${
                        isCurrentAdmin 
                          ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50' 
                          : 'text-slate-300 opacity-60 hover:text-slate-400'
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Details & Contacts */}
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{prof.email || 'E-mail não cadastrado'}</span>
                  </div>

                  {prof.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{prof.phone}</span>
                    </div>
                  )}

                  {prof.registrationNumber && (
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-mono text-[11px] text-slate-500">Matrícula: {prof.registrationNumber}</span>
                    </div>
                  )}
                </div>

                {/* Select Active Professor Button (Seamless Login / Profile Switch) */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    {prof.role === 'admin' ? 'Responsável Admin' : 'Docente BMF4'}
                  </span>

                  {!isActive ? (
                    <button
                      onClick={() => {
                        setActiveProfessorId(prof.id);
                        playBeep('success');
                        showToast(`Sessão alterada para: ${prof.name}`, 'success');
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
                    >
                      <Check className="w-3.5 h-3.5 text-teal-600" />
                      <span>Entrar com este Perfil</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200 shadow-2xs">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Conectado como Docente</span>
                      </span>
                      <button
                        onClick={() => {
                          logoutProfessor();
                          showToast(`Sessão de ${prof.name} encerrada.`, 'success');
                        }}
                        className="px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                        title="Sair desta conta"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sair</span>
                      </button>
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Add/Edit Professor */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl max-w-lg w-full space-y-4 animate-in zoom-in-95">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-sky-600" />
                <span>{editingProf ? 'Editar Docente' : 'Cadastrar Novo Docente'}</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Nome Completo do Docente *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Prof. Dr. Juliano Pereira"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">E-mail Institucional</label>
                  <input
                    type="email"
                    placeholder="docente@uni9.edu.br"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Telefone / WhatsApp</label>
                  <input
                    type="tel"
                    placeholder="(11) 98765-4321"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Matrícula / Registro Docente</label>
                  <input
                    type="text"
                    placeholder="Ex: DOC-1234"
                    value={formData.registrationNumber}
                    onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">PIN / Senha de Acesso (Individual)</label>
                  <input
                    type="text"
                    placeholder="Ex: 1234"
                    value={formData.pin}
                    onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Disciplina Principal</label>
                  <input
                    type="text"
                    placeholder="BMF4 - Bases Morfofuncionais 4"
                    value={formData.discipline}
                    onChange={(e) => setFormData({ ...formData, discipline: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Nível de Acesso (Função)</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-bold"
                  >
                    <option value="admin">Professor Admin (Exclusividade de Exclusão)</option>
                    <option value="professor">Professor Docente (Acesso Operacional Total)</option>
                    <option value="coordenador">Coordenador de Curso</option>
                    <option value="monitor">Monitor de Laboratório</option>
                  </select>
                </div>
              </div>

              {/* Turmas sob responsabilidade */}
              {classes.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-bold text-slate-700 block">Turmas Vinculadas:</label>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                    {classes.map(c => {
                      const isAssigned = formData.assignedClassIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleToggleClass(c.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            isAssigned 
                              ? 'bg-sky-600 text-white shadow-2xs' 
                              : 'bg-white text-slate-600 border border-slate-200'
                          }`}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 text-white text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
                >
                  {editingProf ? 'Salvar Alterações' : 'Cadastrar Docente'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Professor */}
      {deletingProf && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl max-w-md w-full space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Confirmar Exclusão de Docente
              </h3>
              <p className="text-xs text-slate-500">
                Tem certeza que deseja excluir o(a) docente <strong>"{deletingProf.name}"</strong>? Esta ação é irreversível e permitida apenas pelo Administrador.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeletingProf(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
