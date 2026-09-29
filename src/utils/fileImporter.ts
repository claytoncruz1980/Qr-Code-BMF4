import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { CourseType } from '../types';

if (typeof window !== 'undefined') {
  try {
    const pdfAny = pdfjsLib as any;
    const workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfAny.version || '3.11.174'}/pdf.worker.min.js`;
    if (pdfAny.GlobalWorkerOptions) {
      pdfAny.GlobalWorkerOptions.workerSrc = workerSrc;
    }
  } catch (e) {
    console.warn('PDF worker configuration notice:', e);
  }
}

export interface ParsedStudentRow {
  id?: string;
  name: string;
  registrationNumber: string;
  email?: string;
  course?: CourseType;
  isValid: boolean;
  validationError?: string;
  targetClassName?: string;
}

export interface ImportResult {
  fileName: string;
  fileType: 'excel' | 'word' | 'pdf' | 'csv' | 'unknown';
  students: ParsedStudentRow[];
  totalDetected: number;
  validCount: number;
  invalidCount: number;
  detectedClassName?: string;
  error?: string;
}

// Brazilian lowercase prepositions and connectives
const PORTUGUESE_PREPOSITIONS = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'em', 'van', 'von', 'del', 'd']);

// Format Brazilian Student Names into clean Title Case
export function formatBrazilianName(rawName: string): string {
  if (!rawName) return '';
  let cleaned = rawName
    .replace(/^[\d.\-_()[\]#*|\s]+/, '') // Remove leading list numbers (e.g. "01 - ", "1.")
    .replace(/\s+/g, ' ')
    .trim();

  // If in "SOBRENOME, NOME" format (e.g., "SILVA, LUCAS EDUARDO"), convert to "Lucas Eduardo Silva"
  if (cleaned.includes(',') && !cleaned.includes(';')) {
    const parts = cleaned.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length === 2 && parts[0].length > 1 && parts[1].length > 1) {
      cleaned = `${parts[1]} ${parts[0]}`;
    }
  }

  // If already mixed case (e.g. "Ana Carolina Mendes"), preserve casing; if all uppercase or lowercase, title-case it
  const isAllUpper = cleaned === cleaned.toUpperCase() && /[A-ZÁÉÍÓÚÃÕÂÊÔÇ]/.test(cleaned);
  const isAllLower = cleaned === cleaned.toLowerCase() && /[a-záéíóúãõâêôç]/.test(cleaned);

  if (isAllUpper || isAllLower) {
    const words = cleaned.toLowerCase().split(' ');
    cleaned = words
      .map((word, idx) => {
        if (!word) return '';
        if (idx > 0 && PORTUGUESE_PREPOSITIONS.has(word)) {
          return word;
        }
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  }

  return cleaned.trim();
}

// Clean and format student name
export function cleanStudentName(rawName: string): string {
  if (!rawName) return '';
  
  let name = rawName
    .replace(/^[\d.\-_()[\]#*|\s]+/, '') // Remove leading numbers
    .replace(/\s*[-–—|:]\s*[\d.\-_()[\]#*]+\s*$/, '') // Remove trailing numbers/index
    .replace(/\s+/g, ' ')
    .trim();

  // Strip academic status noise frequently found in university attendance lists
  const statusNoiseRegex = /\b(MATRICULADO|CURSANDO|ATIVO|APTO|TRANSFERIDO|TRANCADO|DISPENSADO|DESISTENTE|CONCLU[IÍ]DO|REGULAR|ADIMPLENTE|INADIMPLENTE|DP|PRESENTE|AUSENTE|FALTA)\b/gi;
  name = name.replace(statusNoiseRegex, '').trim();

  return formatBrazilianName(name);
}

// Clean and format RA / Matrícula
export function cleanRegistrationNumber(rawRa: string, fallbackIndex: number = 1): string {
  if (!rawRa) return `MED-${20260000 + fallbackIndex}`;
  
  let clean = String(rawRa)
    .replace(/^RA[:\s-]*/i, '')
    .replace(/^MATR[IÍ]CULA[:\s-]*/i, '')
    .replace(/^C[OÓ]D[:\s-]*/i, '')
    .replace(/[^\w\d-_]/g, '')
    .trim();

  if (clean.length === 0) return `MED-${20260000 + fallbackIndex}`;
  return clean.toUpperCase();
}

// Validate single student row
export function validateStudentRow(student: Partial<ParsedStudentRow>): { isValid: boolean; error?: string } {
  if (!student.name || student.name.trim().length < 3) {
    return { isValid: false, error: 'Nome do aluno ausente ou muito curto.' };
  }
  if (!student.registrationNumber || student.registrationNumber.trim().length < 2) {
    return { isValid: false, error: 'Matrícula / RA inválido.' };
  }
  return { isValid: true };
}

// Check if a line is institutional header or table boilerplate (e.g. UNINOVE header)
export function isHeaderOrNoiseLine(line: string): boolean {
  const lower = line.toLowerCase().trim();
  if (lower.length < 3) return true;

  // Boilerplate keywords to filter out
  const noiseKeywords = [
    'universidade', 'uninove', 'nove de julho', 'diário de classe', 'diario de classe',
    'lista de presença', 'lista de presenca', 'relação de alunos', 'relacao de alunos',
    'curso de medicina', 'bases morfofuncionais', 'bmf', 'disciplina', 'docente',
    'professor', 'professora', 'data:', 'horário:', 'horario:', 'sala:', 'período:', 'periodo:',
    'semestre:', 'campus:', 'total de alunos', 'página', 'pagina', 'folha',
    'assinatura', 'rubrica', 'situação', 'situacao', 'status', 'percentual',
    'secretaria geral', 'coordenadoria', 'frequência', 'frequencia', 'conteúdo programático',
    'avaliação', 'avaliacao', 'termo de presença', 'ata de prova'
  ];

  for (const kw of noiseKeywords) {
    if (lower.includes(kw)) return true;
  }

  // Standalone column header row check
  if (/^(n[ºo°]?|item|#)\s*(ra|matr[íi]cula|c[oó]d)\s*(nome|aluno)/i.test(lower)) return true;
  if (/^(ra|matr[íi]cula|c[oó]d)\s*(nome|aluno)/i.test(lower)) return true;
  if (/^(nome|aluno)\s*(ra|matr[íi]cula)/i.test(lower)) return true;

  return false;
}

// Extract Class Name if mentioned in the header lines
export function detectClassNameFromLines(lines: string[]): string | undefined {
  for (const line of lines) {
    const match = line.match(/(?:turma|turma[:\s]+|classe[:\s]+|grupo[:\s]+)\s*([A-Za-z0-9-_\s]+?)(?:[-,\n\r;]|$)/i);
    if (match && match[1]) {
      const candidate = match[1].trim();
      if (candidate.length >= 2 && candidate.length <= 25 && !candidate.toLowerCase().includes('medicina')) {
        return candidate;
      }
    }
  }
  return undefined;
}

// Smart line parser capable of extracting student name and RA from various formats
export function smartParseStudentLine(
  line: string, 
  fallbackIdx: number, 
  defaultCourse: CourseType = 'Medicina'
): ParsedStudentRow | null {
  if (isHeaderOrNoiseLine(line)) return null;

  let raw = line.trim();
  if (raw.length < 3) return null;

  // Split by common delimiters (tab, semicolon, pipe, multiple spaces)
  let parts = raw.split(/[;\t|]/).map(p => p.trim()).filter(Boolean);

  let name = '';
  let ra = '';

  if (parts.length >= 2) {
    // If first item is an index number (e.g. "1" or "01"), skip it
    if (/^\d{1,3}$/.test(parts[0]) && parts.length >= 3) {
      parts = parts.slice(1);
    }

    if (/^\d/.test(parts[0]) && !/^\d/.test(parts[1])) {
      ra = parts[0];
      name = parts[1];
    } else if (!/^\d/.test(parts[0]) && /^\d/.test(parts[1])) {
      name = parts[0];
      ra = parts[1];
    } else {
      name = parts[0];
      ra = parts[1];
    }
  } else {
    // Single un-delimited line matching common patterns:
    
    // Pattern 1: [Index] [RA] [Name] [Status?]
    // e.g. "1 426202091 ANA CAROLINA MENDES MATRICULADO"
    // e.g. "01 - 426202091 ANA CAROLINA MENDES"
    let match = raw.match(/^(?:\d{1,3}[.\-)\s]+)?(\d{5,12}[A-Za-z0-9\-]*)\s*[-:]?\s*([A-Za-zÁÉÍÓÚÃÕÂÊÔÇáéíóúãõâêôç\s',.-]+)$/);
    if (match) {
      ra = match[1];
      name = match[2];
    } else {
      // Pattern 2: [Index] [Name] [RA]
      // e.g. "1. ANA CAROLINA MENDES 426202091"
      // e.g. "01 - ANA CAROLINA MENDES - RA: 426202091"
      match = raw.match(/^(?:\d{1,3}[.\-)\s]+)?([A-Za-zÁÉÍÓÚÃÕÂÊÔÇáéíóúãõâêôç\s',.-]+?)\s*[-:]?\s*(?:RA[:\s]*)?(\d{5,12}[A-Za-z0-9\-]*)$/i);
      if (match) {
        name = match[1];
        ra = match[2];
      } else {
        // Pattern 3: [RA with prefix like MED-] [Name]
        // e.g. "MED-2026001 ANA CAROLINA MENDES"
        match = raw.match(/^([A-Za-z]{2,4}[-\d]+)\s+([A-Za-zÁÉÍÓÚÃÕÂÊÔÇáéíóúãõâêôç\s',.-]+)$/);
        if (match) {
          ra = match[1];
          name = match[2];
        } else {
          // Pattern 4: Name only, with or without leading number
          const cleanSingle = raw.replace(/^\d{1,3}[.\-)\s]+/, '').trim();
          if (cleanSingle.length >= 3 && !/^\d+$/.test(cleanSingle) && /[A-Za-z]/.test(cleanSingle)) {
            name = cleanSingle;
            ra = `MED-${20260000 + fallbackIdx}`;
          }
        }
      }
    }
  }

  name = cleanStudentName(name);
  ra = cleanRegistrationNumber(ra, fallbackIdx);

  if (!name || name.length < 3) return null;

  // Filter out any accidentally matched header phrases
  if (isHeaderOrNoiseLine(name)) return null;

  const generatedEmail = `${ra.toLowerCase().replace(/[^a-z0-9]/g, '')}@uni9.edu.br`;
  const validation = validateStudentRow({ name, registrationNumber: ra });

  return {
    name,
    registrationNumber: ra,
    email: generatedEmail,
    course: defaultCourse,
    isValid: validation.isValid,
    validationError: validation.error,
  };
}

// Line-by-line text parser
export function parseLinesOfText(text: string, defaultCourse: CourseType = 'Medicina'): ParsedStudentRow[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const studentsMap = new Map<string, ParsedStudentRow>();
  let idx = 1;

  for (const line of lines) {
    const student = smartParseStudentLine(line, idx, defaultCourse);
    if (student) {
      const key = `${student.registrationNumber}-${student.name.toLowerCase()}`;
      if (!studentsMap.has(key)) {
        studentsMap.set(key, student);
        idx++;
      }
    }
  }

  const students = Array.from(studentsMap.values());
  students.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' }));
  return students;
}

// Universal parser for Excel spreadsheets (.xlsx, .xls, .csv)
export async function parseExcelFile(file: File, defaultCourse: CourseType = 'Medicina'): Promise<ImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          return resolve({
            fileName: file.name,
            fileType: 'excel',
            students: [],
            totalDetected: 0,
            validCount: 0,
            invalidCount: 0,
            error: 'O arquivo Excel está vazio ou não possui abas válidas.'
          });
        }

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        if (!rawJson || rawJson.length === 0) {
          return resolve({
            fileName: file.name,
            fileType: 'excel',
            students: [],
            totalDetected: 0,
            validCount: 0,
            invalidCount: 0,
            error: 'Nenhuma linha de dados encontrada na planilha.'
          });
        }

        let headerRowIndex = 0;
        let nameColIndex = -1;
        let raColIndex = -1;
        let emailColIndex = -1;
        let courseColIndex = -1;

        for (let r = 0; r < Math.min(15, rawJson.length); r++) {
          const row = rawJson[r];
          if (!Array.isArray(row)) continue;

          for (let c = 0; c < row.length; c++) {
            const cell = String(row[c] || '').toLowerCase().trim();
            if (cell.includes('nome') || cell.includes('aluno') || cell.includes('estudante') || cell === 'name') {
              nameColIndex = c;
              headerRowIndex = r;
            } else if (cell.includes('ra') || cell.includes('matr') || cell.includes('código') || cell.includes('registro') || cell === 'id') {
              raColIndex = c;
              headerRowIndex = r;
            } else if (cell.includes('email') || cell.includes('e-mail') || cell.includes('correio')) {
              emailColIndex = c;
            } else if (cell.includes('curso') || cell.includes('course')) {
              courseColIndex = c;
            }
          }

          if (nameColIndex !== -1 && raColIndex !== -1) {
            break;
          }
        }

        // Fallbacks if header labels were not matched
        if (nameColIndex === -1 && rawJson[0]?.length >= 1) nameColIndex = 0;
        if (raColIndex === -1 && rawJson[0]?.length >= 2) raColIndex = 1;

        const studentsMap = new Map<string, ParsedStudentRow>();
        let validIdx = 1;

        for (let r = headerRowIndex + 1; r < rawJson.length; r++) {
          const row = rawJson[r];
          if (!Array.isArray(row) || row.length === 0) continue;

          const rawName = row[nameColIndex];
          const rawRa = row[raColIndex];
          const rawEmail = emailColIndex !== -1 ? row[emailColIndex] : undefined;
          const rawCourse = courseColIndex !== -1 ? row[courseColIndex] : undefined;

          if (!rawName && !rawRa) continue;

          const cleanName = cleanStudentName(String(rawName || ''));
          const cleanRa = cleanRegistrationNumber(String(rawRa || ''), validIdx);

          if (!cleanName || cleanName.length < 3 || isHeaderOrNoiseLine(cleanName)) continue;

          const generatedEmail = rawEmail 
            ? String(rawEmail).trim() 
            : `${cleanRa.toLowerCase().replace(/[^a-z0-9]/g, '')}@uni9.edu.br`;

          const validation = validateStudentRow({ name: cleanName, registrationNumber: cleanRa });

          const studentObj: ParsedStudentRow = {
            name: cleanName,
            registrationNumber: cleanRa,
            email: generatedEmail,
            course: (rawCourse as CourseType) || defaultCourse,
            isValid: validation.isValid,
            validationError: validation.error,
          };

          const key = `${cleanRa}-${cleanName.toLowerCase()}`;
          if (!studentsMap.has(key)) {
            studentsMap.set(key, studentObj);
            validIdx++;
          }
        }

        const students = Array.from(studentsMap.values());
        students.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' }));

        resolve({
          fileName: file.name,
          fileType: 'excel',
          students,
          totalDetected: students.length,
          validCount: students.filter(s => s.isValid).length,
          invalidCount: students.filter(s => !s.isValid).length
        });
      } catch (err: any) {
        resolve({
          fileName: file.name,
          fileType: 'excel',
          students: [],
          totalDetected: 0,
          validCount: 0,
          invalidCount: 0,
          error: `Erro ao ler planilha Excel: ${err?.message || 'Arquivo corrompido'}`
        });
      }
    };

    reader.onerror = () => {
      resolve({
        fileName: file.name,
        fileType: 'excel',
        students: [],
        totalDetected: 0,
        validCount: 0,
        invalidCount: 0,
        error: 'Erro de leitura do arquivo no navegador.'
      });
    };

    reader.readAsArrayBuffer(file);
  });
}

// Word Document parser (.docx)
export async function parseWordFile(file: File, defaultCourse: CourseType = 'Medicina'): Promise<ImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const result = await mammoth.extractRawText({ arrayBuffer });
        const text = result.value || '';

        const students = parseLinesOfText(text, defaultCourse);

        resolve({
          fileName: file.name,
          fileType: 'word',
          students,
          totalDetected: students.length,
          validCount: students.filter(s => s.isValid).length,
          invalidCount: students.filter(s => !s.isValid).length,
          error: students.length === 0 ? 'Nenhum estudante identificado no documento Word.' : undefined
        });
      } catch (err: any) {
        resolve({
          fileName: file.name,
          fileType: 'word',
          students: [],
          totalDetected: 0,
          validCount: 0,
          invalidCount: 0,
          error: `Erro ao processar arquivo Word: ${err?.message || 'Arquivo inválido'}`
        });
      }
    };

    reader.onerror = () => {
      resolve({
        fileName: file.name,
        fileType: 'word',
        students: [],
        totalDetected: 0,
        validCount: 0,
        invalidCount: 0,
        error: 'Erro de leitura do arquivo Word.'
      });
    };

    reader.readAsArrayBuffer(file);
  });
}

// Advanced Intelligent PDF parser: Reconstructs coordinates, rows, columns, and tabular structures
export async function parsePDFFile(file: File, defaultCourse: CourseType = 'Medicina'): Promise<ImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const loadingTask = pdfjsLib.getDocument({ 
          data: arrayBuffer,
          useSystemFonts: true,
          disableFontFace: true,
        });
        
        const pdf = await loadingTask.promise;
        const allReconstructedLines: string[] = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.0 });
          const textContent = await page.getTextContent();
          
          const rawItems: Array<{ text: string; x: number; y: number; width: number; height: number }> = [];

          for (const item of textContent.items as any[]) {
            const str = (item.str || '').trim();
            if (!str) continue;

            const transform = item.transform || [1, 0, 0, 1, 0, 0];
            const x = transform[4];
            // In PDF, y origin is bottom-left; invert to top-down for natural reading
            const y = viewport.height - transform[5];

            rawItems.push({
              text: str,
              x: x,
              y: y,
              width: item.width || 0,
              height: item.height || 10,
            });
          }

          if (rawItems.length === 0) continue;

          // Check if page has 2 distinct columns (two lists side-by-side)
          const midX = viewport.width / 2;
          const leftItems = rawItems.filter(it => it.x < midX - 20);
          const rightItems = rawItems.filter(it => it.x >= midX - 20);

          const isTwoColumn = leftItems.length > 8 && rightItems.length > 8;

          const processItemList = (items: typeof rawItems) => {
            // Sort by vertical position (Y coordinate, top-to-bottom)
            items.sort((a, b) => a.y - b.y);

            // Group into row buckets using a 5px proximity threshold
            const rows: Array<typeof rawItems> = [];
            let currentRow: typeof rawItems = [];
            let currentY = -999;

            for (const it of items) {
              if (currentY === -999 || Math.abs(it.y - currentY) <= 5.5) {
                currentRow.push(it);
                currentY = it.y;
              } else {
                if (currentRow.length > 0) {
                  rows.push(currentRow);
                }
                currentRow = [it];
                currentY = it.y;
              }
            }
            if (currentRow.length > 0) rows.push(currentRow);

            // Reconstruct text for each row (sorting horizontally X left-to-right)
            for (const row of rows) {
              row.sort((a, b) => a.x - b.x);
              let lineStr = '';
              for (let i = 0; i < row.length; i++) {
                const cur = row[i];
                if (i > 0) {
                  const prev = row[i - 1];
                  const gap = cur.x - (prev.x + prev.width);
                  // If separated by a table column gap, insert tab delimiter
                  if (gap > 25) {
                    lineStr += '\t';
                  } else if (gap > 2) {
                    lineStr += ' ';
                  }
                }
                lineStr += cur.text;
              }
              const trimmed = lineStr.trim();
              if (trimmed) allReconstructedLines.push(trimmed);
            }
          };

          if (isTwoColumn) {
            processItemList(leftItems);
            processItemList(rightItems);
          } else {
            processItemList(rawItems);
          }
        }

        // Try to detect Class name from PDF lines
        const detectedClassName = detectClassNameFromLines(allReconstructedLines);

        // Smart parse students from reconstructed lines
        const studentsMap = new Map<string, ParsedStudentRow>();
        let studentIdx = 1;

        for (const line of allReconstructedLines) {
          const student = smartParseStudentLine(line, studentIdx, defaultCourse);
          if (student) {
            const key = `${student.registrationNumber}-${student.name.toLowerCase()}`;
            if (!studentsMap.has(key)) {
              studentsMap.set(key, student);
              studentIdx++;
            }
          }
        }

        const students = Array.from(studentsMap.values());
        students.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' }));

        resolve({
          fileName: file.name,
          fileType: 'pdf',
          students,
          totalDetected: students.length,
          validCount: students.filter(s => s.isValid).length,
          invalidCount: students.filter(s => !s.isValid).length,
          detectedClassName,
          error: students.length === 0 ? 'Nenhum aluno identificado no arquivo PDF. Verifique se o documento contém texto legível ou diário de classe.' : undefined
        });
      } catch (err: any) {
        resolve({
          fileName: file.name,
          fileType: 'pdf',
          students: [],
          totalDetected: 0,
          validCount: 0,
          invalidCount: 0,
          error: `Erro ao processar PDF: ${err?.message || 'Arquivo protegido por senha ou não legível.'}`
        });
      }
    };

    reader.onerror = () => {
      resolve({
        fileName: file.name,
        fileType: 'pdf',
        students: [],
        totalDetected: 0,
        validCount: 0,
        invalidCount: 0,
        error: 'Erro na leitura do arquivo PDF.'
      });
    };

    reader.readAsArrayBuffer(file);
  });
}

// Master parser router according to file extension
export async function parseStudentFile(file: File, defaultCourse: CourseType = 'Medicina'): Promise<ImportResult> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
    return parseExcelFile(file, defaultCourse);
  } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
    return parseWordFile(file, defaultCourse);
  } else if (fileName.endsWith('.pdf')) {
    return parsePDFFile(file, defaultCourse);
  } else {
    // Attempt plain text read as fallback
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = String(e.target?.result || '');
        const students = parseLinesOfText(text, defaultCourse);
        resolve({
          fileName: file.name,
          fileType: 'csv',
          students,
          totalDetected: students.length,
          validCount: students.filter(s => s.isValid).length,
          invalidCount: students.filter(s => !s.isValid).length
        });
      };
      reader.onerror = () => {
        resolve({
          fileName: file.name,
          fileType: 'unknown',
          students: [],
          totalDetected: 0,
          validCount: 0,
          invalidCount: 0,
          error: 'Formato de arquivo não suportado. Por favor utilize Word (.docx), PDF (.pdf) ou Excel (.xlsx, .csv).'
        });
      };
      reader.readAsText(file);
    });
  }
}

import { generateModernSampleExcelBlob } from './exportExcel';

// Generator for Excel template download with modern colorful style
export async function generateSampleExcel(): Promise<Blob> {
  return generateModernSampleExcelBlob();
}
