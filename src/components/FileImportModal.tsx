import React, { useState, useRef, useEffect } from 'react';
import { 
  FileUp, 
  X, 
  Check, 
  AlertCircle, 
  FileSpreadsheet, 
  FileText, 
  Download, 
  Trash2, 
  Users, 
  Sparkles,
  GraduationCap
} from 'lucide-react';
import { useLab, sortClassesAlphabetically } from '../context/LabContext';
import { parseStudentFile, generateSampleExcel, ParsedStudentRow, ImportResult } from '../utils/fileImporter';
import { CourseType } from '../types';

interface FileImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetClassId?: string;
}

export const FileImportModal: React.FC<FileImportModalProps> = ({
  isOpen,
  onClose,
  targetClassId,
}) => {
  const { 
    classes, 
    selectedClassId, 
    setSelectedClassId, 
    addMultipleStudents, 
    deleteAllStudentsFromClass, 
    playBeep 
  } = useLab();
  
  const [selectedClass, setSelectedClass] = useState<string>(() => {
    return targetClassId || selectedClassId || (classes.length > 0 ? classes[0].id : '');
  });

  const [replaceExisting, setReplaceExisting] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [previewStudents, setPreviewStudents] = useState<ParsedStudentRow[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [manualText, setManualText] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync selectedClass on mount or when props/context change
  useEffect(() => {
    if (isOpen) {
      const resolvedClass = targetClassId || selectedClassId || (classes.length > 0 ? classes[0].id : '');
      setSelectedClass(resolvedClass);
      setFeedbackSuccess(null);
    }
  }, [isOpen, targetClassId, selectedClassId, classes]);

  if (!isOpen) return null;

  const currentClassObj = classes.find(c => c.id === selectedClass) || classes[0];

  const handleProcessFile = async (file: File) => {
    setIsLoading(true);
    try {
      const result = await parseStudentFile(file, currentClassObj?.course || 'Medicina');
      setImportResult(result);
      setPreviewStudents(result.students);
      // Select all valid students by default
      setSelectedIndices(new Set(result.students.map((_, i) => i)));

      // Auto-match class if detected in the document
      if (result.detectedClassName) {
        const found = classes.find(c => 
          c.name.toLowerCase().includes(result.detectedClassName!.toLowerCase()) || 
          result.detectedClassName!.toLowerCase().includes(c.name.toLowerCase())
        );
        if (found) {
          setSelectedClass(found.id);
        }
      }

      playBeep('success');
    } catch (err: any) {
      setImportResult({
        fileName: file.name,
        fileType: 'unknown',
        students: [],
        totalDetected: 0,
        validCount: 0,
        invalidCount: 0,
        error: `Erro ao processar arquivo: ${err?.message || 'Arquivo inválido ou ilegível.'}`
      });
      playBeep('alert');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await generateSampleExcel();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'modelo_importacao_alunos_bmf4.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      playBeep('success');
    } catch (err) {
      console.error('Erro ao baixar modelo Excel:', err);
    }
  };

  const toggleSelectRow = (index: number) => {
    const next = new Set(selectedIndices);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelectedIndices(next);
  };

  const toggleSelectAll = () => {
    if (selectedIndices.size === previewStudents.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(previewStudents.map((_, i) => i)));
    }
  };

  const updateStudentField = (index: number, field: keyof ParsedStudentRow, value: any) => {
    setPreviewStudents(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveStudentFromPreview = (index: number) => {
    setPreviewStudents(prev => prev.filter((_, i) => i !== index));
    setSelectedIndices(prev => {
      const next = new Set<number>();
      Array.from(prev).forEach(idx => {
        const n = Number(idx);
        if (n < index) next.add(n);
        else if (n > index) next.add(n - 1);
      });
      return next;
    });
  };

  const handleConfirmImport = () => {
    if (!selectedClass) {
      alert('Por favor, selecione uma Turma de Destino antes de importar.');
      return;
    }

    const studentsToImport = previewStudents.filter((_, i) => selectedIndices.has(i));
    
    if (studentsToImport.length === 0) {
      alert('Selecione ao menos um aluno para importar.');
      return;
    }

    if (replaceExisting && selectedClass) {
      deleteAllStudentsFromClass(selectedClass);
    }

    const finalStudents = studentsToImport.map((st) => ({
      name: st.name.trim(),
      registrationNumber: st.registrationNumber.trim(),
      course: currentClassObj?.course || ('Medicina' as CourseType),
      classGroupId: selectedClass,
      email: st.email || `${st.registrationNumber.toLowerCase().replace(/[^a-z0-9]/g, '')}@uni9.edu.br`,
    }));

    addMultipleStudents(finalStudents);
    setSelectedClassId(selectedClass);

    setFeedbackSuccess(`${finalStudents.length} alunos importados com sucesso para a turma "${currentClassObj?.name || 'selecionada'}"!`);
    playBeep('success');

    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const handleParseManualText = () => {
    if (!manualText.trim()) return;
    const lines = manualText.split('\n').filter(l => l.trim().length > 0);
    const parsed: ParsedStudentRow[] = [];

    lines.forEach((line, idx) => {
      const parts = line.split(/[;\t,|]/).map(p => p.trim());
      let name = parts[0] || `Aluno ${idx + 1}`;
      let ra = parts[1] || `RA${260100 + idx + 1}`;
      let email = '';

      if (parts.length >= 3 && parts[2] && parts[2].includes('@')) {
        email = parts[2];
      }

      parsed.push({
        name,
        registrationNumber: ra,
        email: email || `${ra.toLowerCase().replace(/[^a-z0-9]/g, '')}@uni9.edu.br`,
        course: currentClassObj?.course || ('Medicina' as CourseType),
        isValid: true
      });
    });

    setImportResult({
      fileName: 'Texto digitado / Colado',
      fileType: 'csv',
      students: parsed,
      totalDetected: parsed.length,
      validCount: parsed.length,
      invalidCount: 0
    });
    setPreviewStudents(parsed);
    setSelectedIndices(new Set(parsed.map((_, i) => i)));
    setActiveTab('upload');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-800 flex items-center justify-center shadow-xs">
              <FileUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Importar Alunos para a Turma
                <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 text-[10px] font-bold tracking-wider uppercase">
                  Word • PDF • Excel
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Suporta planilhas, diários de classe em PDF, arquivos Word e tabelas acadêmicas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          
          {/* Target Class Selection and Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-sky-50/60 rounded-2xl border border-sky-100">
            <div>
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1.5">
                <GraduationCap className="w-4 h-4 text-sky-700" />
                Turma de Destino *
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-sky-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-xs cursor-pointer"
              >
                {sortClassesAlphabetically(classes).map(c => (
                  <option key={c.id} value={c.id}>
                    Turma: {c.name} {c.discipline ? `• Disciplina: ${c.discipline}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col justify-center">
              <label className="text-xs font-bold text-slate-800 block mb-1.5">
                Modo de Gravação
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-1 bg-white px-3 py-2 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                  className="w-4 h-4 rounded text-sky-700 border-slate-300 focus:ring-sky-500 cursor-pointer"
                />
                <span className="font-semibold text-slate-700">Substituir alunos existentes desta turma</span>
              </label>
            </div>
          </div>

          {/* Feedback Success Notification */}
          {feedbackSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <Check className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{feedbackSuccess}</span>
            </div>
          )}

          {/* Tabs: Upload File vs Paste Text */}
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-sky-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Carregar Arquivo (Word / PDF / Excel)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('paste')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'paste'
                  ? 'bg-sky-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Colar / Digitar Lista</span>
            </button>
          </div>

          {activeTab === 'upload' ? (
            <div className="space-y-4">
              {/* Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-sky-500 bg-sky-50/50 scale-[0.99]'
                    : 'border-slate-300 hover:border-sky-400 bg-slate-50/50 hover:bg-sky-50/20'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.docx,.doc,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="w-14 h-14 mx-auto rounded-3xl bg-white shadow-sm border border-slate-200 flex items-center justify-center text-sky-700 mb-3">
                  <FileUp className="w-7 h-7" />
                </div>

                <h3 className="font-bold text-slate-900 text-sm mb-1">
                  Arraste seu arquivo aqui ou clique para selecionar
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
                  Formatos aceitos: <strong>Excel (.xlsx, .xls, .csv)</strong>, <strong>Word (.docx)</strong> ou <strong>PDF (.pdf)</strong>
                </p>

                <div className="flex items-center justify-center gap-2 flex-wrap text-[11px] text-slate-600">
                  <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-medium">
                    📄 Word (.docx)
                  </span>
                  <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-medium">
                    📊 Excel (.xlsx)
                  </span>
                  <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-medium">
                    📕 PDF (.pdf)
                  </span>
                  <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-medium">
                    📝 CSV (.csv)
                  </span>
                </div>
              </div>

              {/* Download Template Bar */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                <div className="flex items-center gap-2 text-slate-600">
                  <Sparkles className="w-4 h-4 text-sky-700 shrink-0" />
                  <span>Deseja preencher uma planilha modelo?</span>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-sky-900 font-bold border border-slate-200 shadow-2xs transition-all active:scale-95 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-sky-700" />
                  <span>Baixar Modelo Excel (.xlsx)</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 block">
                Cole a lista de alunos (um por linha):
              </label>
              <textarea
                rows={7}
                placeholder={`Mariana Costa Lima, 426202091, mariana@uni9.edu.br\nRodrigo Alves Pereira, 426202092\nTalita Vianna, 426202093\nLucas Gabriel Ferreira, 426202094`}
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleParseManualText}
                  className="px-4 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  Processar Lista de Texto
                </button>
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center justify-center gap-2 animate-pulse">
              <div className="w-8 h-8 border-3 border-sky-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold text-slate-700">Lendo e estruturando alunos do arquivo...</span>
            </div>
          )}

          {/* Error Message if any */}
          {importResult?.error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Não foi possível importar</p>
                <p className="text-[11px] text-rose-700 mt-0.5">{importResult.error}</p>
              </div>
            </div>
          )}

          {/* Preview Table of Detected Students */}
          {previewStudents.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">
                    Alunos Identificados ({previewStudents.length})
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                    {selectedIndices.size} selecionados
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-bold text-[11px]">
                    Destino: {currentClassObj?.name || 'Turma'}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-sky-800 hover:text-sky-900 font-bold underline cursor-pointer"
                  >
                    {selectedIndices.size === previewStudents.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                  </button>
                </div>
              </div>

              {/* Table Container */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs w-full max-w-full">
                <div className="max-h-64 overflow-y-auto overflow-x-auto w-full max-w-full">
                  <table className="w-full text-left text-xs min-w-[480px]">
                    <thead className="bg-slate-100 text-slate-700 sticky top-0 font-bold z-10">
                      <tr>
                        <th className="p-2.5 text-center w-10">
                          <input
                            type="checkbox"
                            checked={selectedIndices.size === previewStudents.length && previewStudents.length > 0}
                            onChange={toggleSelectAll}
                            className="w-3.5 h-3.5 rounded text-sky-700 cursor-pointer"
                          />
                        </th>
                        <th className="p-2.5">Nome do Aluno</th>
                        <th className="p-2.5">Matrícula / RA</th>
                        <th className="p-2.5">Email</th>
                        <th className="p-2.5 text-center w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {previewStudents.map((st, idx) => {
                        const isChecked = selectedIndices.has(idx);
                        return (
                          <tr key={idx} className={isChecked ? 'hover:bg-slate-50' : 'bg-slate-50/50 opacity-60'}>
                            <td className="p-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSelectRow(idx)}
                                className="w-3.5 h-3.5 rounded text-sky-700 cursor-pointer"
                              />
                            </td>
                            <td className="p-2.5">
                              <input
                                type="text"
                                value={st.name}
                                onChange={(e) => updateStudentField(idx, 'name', e.target.value)}
                                className="w-full px-2 py-1 border border-transparent hover:border-slate-300 focus:border-sky-500 rounded font-semibold text-slate-900 bg-transparent focus:bg-white text-xs"
                              />
                            </td>
                            <td className="p-2.5">
                              <input
                                type="text"
                                value={st.registrationNumber}
                                onChange={(e) => updateStudentField(idx, 'registrationNumber', e.target.value)}
                                className="w-full px-2 py-1 border border-transparent hover:border-slate-300 focus:border-sky-500 rounded font-mono text-slate-700 bg-transparent focus:bg-white text-xs"
                              />
                            </td>
                            <td className="p-2.5">
                              <input
                                type="text"
                                value={st.email || ''}
                                onChange={(e) => updateStudentField(idx, 'email', e.target.value)}
                                className="w-full px-2 py-1 border border-transparent hover:border-slate-300 focus:border-sky-500 rounded text-slate-500 bg-transparent focus:bg-white text-[11px]"
                              />
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveStudentFromPreview(idx)}
                                className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                                title="Remover da lista"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 flex items-center justify-between bg-slate-50/70">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={previewStudents.length === 0 || selectedIndices.size === 0}
              onClick={handleConfirmImport}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 ${
                previewStudents.length > 0 && selectedIndices.size > 0
                  ? 'bg-sky-700 hover:bg-sky-800 text-white cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>Confirmar e Importar ({selectedIndices.size} Alunos)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
