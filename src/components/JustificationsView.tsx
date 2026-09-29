import React, { useState, useMemo } from 'react';
import { 
  FileCheck, 
  Plus, 
  Search, 
  Calendar, 
  Check, 
  X, 
  FileText, 
  AlertCircle, 
  Clock, 
  Filter, 
  Trash2,
  Paperclip,
  CheckCircle2,
  XCircle,
  Stethoscope,
  Download,
  Eye,
  File,
  UploadCloud
} from 'lucide-react';
import { useLab } from '../context/LabContext';
import { JustificationRequest, Student } from '../types';
import { StudentAvatar } from './StudentAvatar';
import { matchStudentClass } from '../utils/attendanceHelpers';

export const JustificationsView: React.FC = () => {
  const { 
    justifications, 
    submitJustification, 
    handleJustificationStatus, 
    deleteJustification,
    students, 
    classes, 
    sessions,
    selectedClassId,
    activeProfessor,
    playBeep 
  } = useLab();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingJustificationId, setDeletingJustificationId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [viewingAttachment, setViewingAttachment] = useState<{ url: string; name: string; studentName?: string } | null>(null);

  // Form State
  const [studentId, setStudentId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [reasonCategory, setReasonCategory] = useState<'medical' | 'academic' | 'transport' | 'work' | 'other'>('medical');
  const [documentNumber, setDocumentNumber] = useState('');
  const [description, setDescription] = useState('');
  const [attachmentName, setAttachmentName] = useState<string>('');
  const [attachmentUrl, setAttachmentUrl] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const classStudents = useMemo(() => {
    return students
      .filter(s => matchStudentClass(s.classGroupId, selectedClassId, classes))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' }));
  }, [students, selectedClassId, classes]);

  const classSessions = useMemo(() => {
    return sessions
      .filter(s => matchStudentClass(s.classGroupId, selectedClassId, classes))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sessions, selectedClassId, classes]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleOpenAdd = () => {
    setStudentId(classStudents[0]?.id || '');
    setSessionId(classSessions[0]?.id || '');
    setDate(new Date().toISOString().split('T')[0]);
    setReasonCategory('medical');
    setDocumentNumber('');
    setDescription('');
    setAttachmentName('');
    setAttachmentUrl('');
    setUploadError(null);
    setIsModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setUploadError(null);
    if (!file) return;

    // Limit to 10MB
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('O arquivo selecionado excede o limite máximo de 10 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setAttachmentUrl(dataUrl);
      setAttachmentName(file.name);
      playBeep('success');
    };
    reader.onerror = () => {
      setUploadError('Erro ao carregar o arquivo. Tente novamente.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAttachment = () => {
    setAttachmentName('');
    setAttachmentUrl('');
    setUploadError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !description.trim()) return;

    const student = students.find(s => s.id === studentId);
    const session = sessions.find(s => s.id === sessionId);

    submitJustification({
      studentId,
      studentName: student?.name,
      studentRa: student?.registrationNumber,
      sessionId: sessionId || session?.id || '',
      sessionTopic: session?.topic || 'Aula BMF4',
      sessionDate: date,
      reason: reasonCategory,
      documentNumber: documentNumber.trim() || undefined,
      description: description.trim(),
      attachmentName: attachmentName || undefined,
      attachmentUrl: attachmentUrl || undefined,
    });

    playBeep('success');
    showToast('Justificativa/Atestado registrado com sucesso!');
    setIsModalOpen(false);
  };

  const handleConfirmDelete = () => {
    if (!deletingJustificationId) return;
    deleteJustification(deletingJustificationId);
    setDeletingJustificationId(null);
    playBeep('alert');
    showToast('Justificativa excluída permanentemente.');
  };

  const filteredJustifications = useMemo(() => {
    return justifications
      .filter(j => {
        const student = students.find(s => s.id === j.studentId);
        if (!student) return false;

        // If class filter applies
        if (selectedClassId && student.classGroupId !== selectedClassId) return false;

        if (statusFilter !== 'all' && j.status !== statusFilter) return false;

        const matchesSearch = 
          student.name.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
          student.registrationNumber.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
          j.description.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
          (j.documentNumber && j.documentNumber.toLowerCase().includes(searchTerm.toLowerCase().trim())) ||
          (j.attachmentName && j.attachmentName.toLowerCase().includes(searchTerm.toLowerCase().trim()));

        return matchesSearch;
      })
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }, [justifications, students, selectedClassId, statusFilter, searchTerm]);

  return (
    <div className="space-y-4 max-w-full pb-16 sm:pb-8">
      
      {/* Toast */}
      {toastMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-600 text-white text-xs font-bold flex items-center justify-between shadow-md animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-white shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-white hover:text-emerald-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-sky-700" />
              <span>Justificativas & Atestados Médicos BMF4</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Envio, homologação, acompanhamento, anexos de documentos e controle de atestados médicos.
            </p>
          </div>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold rounded-2xl shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Inserir Novo Atestado</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por aluno, RA, motivo ou anexo (A-Z)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar w-full sm:w-auto p-1 bg-slate-100 rounded-2xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Todos ({justifications.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                statusFilter === 'pending' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-500 hover:text-amber-700'
              }`}
            >
              Pendentes
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                statusFilter === 'approved' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500 hover:text-emerald-700'
              }`}
            >
              Aprovados
            </button>
            <button
              onClick={() => setStatusFilter('rejected')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                statusFilter === 'rejected' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-500 hover:text-rose-700'
              }`}
            >
              Recusados
            </button>
          </div>
        </div>
      </div>

      {/* List of Justifications with Exclude / Delete Option & Attachment Badge */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/90 shadow-xs space-y-3">
        {filteredJustifications.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs space-y-2">
            <FileCheck className="w-10 h-10 mx-auto text-slate-300" />
            <p>Nenhuma justificativa ou atestado registrado.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredJustifications.map((item) => {
              const student = students.find(s => s.id === item.studentId);
              if (!student) return null;

              return (
                <div key={item.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors rounded-2xl px-2">
                  
                  {/* Left Info */}
                  <div className="flex items-start gap-3 min-w-0">
                    <StudentAvatar name={student.name} size="md" />
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900">{student.name}</span>
                        <span className="font-mono text-xs text-slate-500">RA: {student.registrationNumber}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          item.status === 'approved' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : item.status === 'rejected'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {item.status === 'approved' ? 'Aprovado' : item.status === 'rejected' ? 'Recusado' : 'Pendente'}
                        </span>

                        {/* Attachment indicator pill */}
                        {item.attachmentUrl && (
                          <button
                            type="button"
                            onClick={() => setViewingAttachment({
                              url: item.attachmentUrl!,
                              name: item.attachmentName || 'Atestado_Documento.pdf',
                              studentName: student.name
                            })}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-[10px] font-bold transition-all cursor-pointer"
                          >
                            <Paperclip className="w-3 h-3 text-sky-600" />
                            <span>Anexo: {item.attachmentName || 'Ver Documento'}</span>
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-slate-700 font-medium">
                        <strong>Motivo:</strong> {item.description}
                        {item.documentNumber && <span className="ml-2 font-mono text-sky-800">[{item.documentNumber}]</span>}
                      </p>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          Data: {item.sessionDate}
                        </span>
                        {item.reviewedBy && (
                          <span>Avaliador: {item.reviewedBy}</span>
                        )}
                        {item.attachmentName && (
                          <span className="text-slate-500 font-mono text-[10px]">
                            Doc: {item.attachmentName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions (View Doc / Approve / Reject / DELETE) */}
                  <div className="flex items-center gap-1.5 self-end md:self-center shrink-0 flex-wrap">
                    {item.attachmentUrl && (
                      <button
                        onClick={() => setViewingAttachment({
                          url: item.attachmentUrl!,
                          name: item.attachmentName || 'Atestado_Documento.pdf',
                          studentName: student.name
                        })}
                        title="Visualizar documento em anexo"
                        className="px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver Anexo</span>
                      </button>
                    )}

                    {item.status === 'pending' && (
                      <>
                        <button
                          onClick={() => {
                            handleJustificationStatus(item.id, 'approved', activeProfessor?.name || 'Docente');
                            playBeep('success');
                            showToast('Atestado aprovado com sucesso!');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Aprovar</span>
                        </button>

                        <button
                          onClick={() => {
                            handleJustificationStatus(item.id, 'rejected', activeProfessor?.name || 'Docente');
                            playBeep('alert');
                            showToast('Atestado recusado.');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Recusar</span>
                        </button>
                      </>
                    )}

                    {/* Exclude / Delete Button */}
                    <button
                      onClick={() => setDeletingJustificationId(item.id)}
                      title="Excluir este atestado/justificativa"
                      className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: New Justification with Document Attachment */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl max-w-lg w-full space-y-4 animate-in zoom-in-95 my-auto max-h-[92vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-sky-700" />
                <span>Inserir Justificativa / Atestado Médico</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Selecionar Aluno *</label>
                <select
                  required
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-bold cursor-pointer"
                >
                  <option value="">Selecione um aluno da turma...</option>
                  {classStudents.map(st => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.registrationNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Data da Ausência *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">CRM / Nº Documento</label>
                  <input
                    type="text"
                    placeholder="Ex: CRM/SP 123456"
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Categoria do Motivo</label>
                <select
                  value={reasonCategory}
                  onChange={(e) => setReasonCategory(e.target.value as any)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-bold cursor-pointer"
                >
                  <option value="medical">Médico / Atestado de Saúde (CID)</option>
                  <option value="academic">Acadêmico / Congresso / Prova</option>
                  <option value="transport">Transporte / Trânsito</option>
                  <option value="work">Trabalho / Estágio</option>
                  <option value="other">Outro Motivo</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Descrição / Motivo Clínico ou Justificativa *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Ex: Consulta médica comprovada com CID / Atestado de repouso por 2 dias..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium resize-none"
                />
              </div>

              {/* Document Attachment Field */}
              <div className="space-y-1.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-sky-700" />
                    <span>Anexo de Documento / Atestado (Opcional)</span>
                  </label>
                  {attachmentUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveAttachment}
                      className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                    >
                      Remover anexo
                    </button>
                  )}
                </div>

                {attachmentUrl ? (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200 text-xs">
                    <File className="w-4 h-4 text-sky-600 shrink-0" />
                    <div className="min-w-0 flex-1 truncate font-medium text-slate-800">
                      {attachmentName || 'Documento_Anexado'}
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                      Pronto
                    </span>
                  </div>
                ) : (
                  <div>
                    <label className="flex flex-col items-center justify-center gap-1.5 p-3 border-2 border-dashed border-slate-300 hover:border-sky-500 rounded-xl bg-white hover:bg-sky-50/30 cursor-pointer transition-colors text-center">
                      <UploadCloud className="w-5 h-5 text-slate-400" />
                      <span className="text-xs font-bold text-slate-700">Clique ou arraste para anexar atestado</span>
                      <span className="text-[10px] text-slate-400">PDF, JPG, PNG, WEBP ou DOC (Máx: 10 MB)</span>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,image/*,application/pdf"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                {uploadError && (
                  <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{uploadError}</span>
                  </p>
                )}
              </div>

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
                  className="px-5 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
                >
                  Salvar Atestado
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Attachment Document Viewer Modal */}
      {viewingAttachment && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Paperclip className="w-4 h-4 text-sky-400 shrink-0" />
                <div className="min-w-0 truncate">
                  <h3 className="text-xs sm:text-sm font-bold truncate">
                    {viewingAttachment.name}
                  </h3>
                  {viewingAttachment.studentName && (
                    <p className="text-[11px] text-slate-300 truncate">
                      Aluno: {viewingAttachment.studentName}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={viewingAttachment.url}
                  download={viewingAttachment.name}
                  className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Baixar</span>
                </a>
                <button
                  onClick={() => setViewingAttachment(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Preview Content */}
            <div className="p-4 overflow-y-auto bg-slate-100 flex-1 flex items-center justify-center min-h-[300px]">
              {viewingAttachment.url.startsWith('data:image/') || viewingAttachment.name.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
                <img 
                  src={viewingAttachment.url} 
                  alt={viewingAttachment.name}
                  className="max-w-full max-h-[65vh] object-contain rounded-xl shadow-sm border border-slate-200 bg-white"
                />
              ) : viewingAttachment.url.startsWith('data:application/pdf') || viewingAttachment.name.endsWith('.pdf') ? (
                <iframe
                  src={viewingAttachment.url}
                  title={viewingAttachment.name}
                  className="w-full h-[65vh] rounded-xl border border-slate-200 bg-white"
                />
              ) : (
                <div className="text-center p-8 bg-white rounded-2xl border border-slate-200 space-y-3">
                  <FileText className="w-12 h-12 text-sky-600 mx-auto" />
                  <div>
                    <h4 className="font-bold text-sm text-slate-800">{viewingAttachment.name}</h4>
                    <p className="text-xs text-slate-500 mt-1">Este arquivo pode ser visualizado após o download.</p>
                  </div>
                  <a
                    href={viewingAttachment.url}
                    download={viewingAttachment.name}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Fazer Download do Arquivo</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Deleting Justification */}
      {deletingJustificationId && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl max-w-md w-full space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Excluir Atestado / Justificativa?
              </h3>
              <p className="text-xs text-slate-500">
                Tem certeza que deseja remover esta justificativa do histórico? O registro de presença voltará ao status anterior.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeletingJustificationId(null)}
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
