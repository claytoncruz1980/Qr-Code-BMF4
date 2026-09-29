import ExcelJS from 'exceljs';
import { ClassGroup, Student, LabSession, Professor } from '../types';
import { 
  getStudentAttendanceRecord, 
  isRecordPresent, 
  isRecordLate, 
  isRecordExcused 
} from './attendanceHelpers';

interface ExportAttendanceOptions {
  selectedClass: ClassGroup;
  students: Student[];
  sessions: LabSession[];
  activeProfessor?: Professor | null;
  overallStats: {
    avgRate: number;
    totalPresences: number;
    totalAbsences: number;
    totalExcused: number;
    atRiskCount: number;
  };
}

interface ExportGradesOptions {
  selectedClass: ClassGroup;
  students: Student[];
  activeProfessor?: Professor | null;
  grades: Record<string, Record<string, number | null>>;
  gradeCycles: Array<{
    cycleNumber: number;
    label: string;
    name: string;
    teorica: { id: string; keyAlt: string; label: string; title: string };
    pratica: { id: string; keyAlt: string; label: string; title: string };
  }>;
  getGradeValue: (studentId: string, primaryKey: string, altKey?: string) => number | null;
  getCycleAverage: (studentId: string, cycle: any) => number | null;
  getTeoricaAverage: (studentId: string) => number | null;
  getPraticaAverage?: (studentId: string) => number | null;
  getAnatomiaAverage?: (studentId: string) => number | null;
  getHistologiaAverage?: (studentId: string) => number | null;
  getStudentAverage: (studentId: string) => number | null;
}

interface ExportRosterOptions {
  selectedClass: ClassGroup;
  students: Student[];
  activeSession?: LabSession | null;
  activeProfessor?: Professor | null;
}

interface ExportSingleSessionOptions {
  session: LabSession;
  selectedClass: ClassGroup;
  students: Student[];
}

// Global Styling Constants
const BLUE_HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF0B5394' } // Medical Blue #0B5394
};

const BLUE_CYCLE_HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF134F5C' } // Slate Teal #134F5C
};

const BLUE_FINAL_HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF073763' } // Deep Navy #073763
};

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
  left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
  bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
  right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
};

const HEADER_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF073763' } },
  left: { style: 'thin', color: { argb: 'FF073763' } },
  bottom: { style: 'medium', color: { argb: 'FF073763' } },
  right: { style: 'thin', color: { argb: 'FF073763' } }
};

// =========================================================================
// 1. DIÁRIO DE FREQUÊNCIA & CHAMADAS (Frequência, Detalhes e Estatísticas)
// =========================================================================
export async function exportModernAttendanceExcel({
  selectedClass,
  students,
  sessions,
  activeProfessor,
  overallStats
}: ExportAttendanceOptions): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'UNINOVE Medicina - BMF4';
  workbook.lastModifiedBy = activeProfessor?.name || selectedClass.professorName || 'Docente BMF4';
  workbook.created = new Date();
  workbook.modified = new Date();

  const sortedSessions = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const firstSessionDate = sortedSessions.length > 0
    ? sortedSessions[0].date.split('-').reverse().join('/')
    : new Date().toLocaleDateString('pt-BR');

  // TAB 1: Frequência
  const wsFreq = workbook.addWorksheet('Frequência', {
    views: [{ showGridLines: true }]
  });

  wsFreq.columns = [
    { key: 'aluno', width: 42 },
    { key: 'ra', width: 16 },
    { key: 'turma', width: 16 },
    { key: 'presenca', width: 14 },
    { key: 'atrasos', width: 14 },
    { key: 'faltas', width: 14 },
    { key: 'justificadas', width: 16 },
    { key: 'frequencia', width: 16 }
  ];

  // Title Banner
  wsFreq.mergeCells('A1:H1');
  const titleCell = wsFreq.getCell('A1');
  const classNameDisplay = selectedClass.name.replace(/^BMF4\s*/i, '').trim() || selectedClass.name;
  titleCell.value = `Frequência BMF4 • ${classNameDisplay}`;
  titleCell.fill = BLUE_HEADER_FILL;
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  wsFreq.getRow(1).height = 36;

  // Subtitle
  wsFreq.mergeCells('A2:H2');
  const subtitleCell = wsFreq.getCell('A2');
  subtitleCell.value = `Período diário — desde ${firstSessionDate} · UNINOVE Medicina`;
  subtitleCell.font = { name: 'Calibri', size: 10.5, color: { argb: 'FF333333' } };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  wsFreq.getRow(2).height = 22;

  // Blank spacing row
  wsFreq.getRow(3).height = 10;

  // Header Row 4
  const headerRow = wsFreq.getRow(4);
  headerRow.height = 26;
  const headers = ['Aluno', 'RA', 'Turma', 'Presença', 'Atrasos', 'Faltas', 'Justificadas', 'Frequência'];

  headers.forEach((headerText, colIndex) => {
    const cell = headerRow.getCell(colIndex + 1);
    cell.value = headerText;
    cell.fill = BLUE_HEADER_FILL;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = HEADER_BORDER;
  });

  const totalSessions = sessions.length;

  students.forEach((st, idx) => {
    let presencesCount = 0;
    let absencesCount = 0;
    let latesCount = 0;
    let excusedCount = 0;

    sessions.forEach(sess => {
      const rec = getStudentAttendanceRecord(sess.attendance, st);
      if (rec) {
        const isPresent = isRecordPresent(rec);
        const isLate = isRecordLate(rec);
        const isExcused = isRecordExcused(rec);

        if (isPresent) {
          presencesCount++;
        } else if (isLate) {
          presencesCount++;
          latesCount++;
        } else if (isExcused) {
          presencesCount++;
          excusedCount++;
        } else {
          absencesCount++;
        }
      } else {
        absencesCount++;
      }
    });

    const frequencyRate = totalSessions > 0 ? (presencesCount / totalSessions) * 100 : 100;
    const rowIndex = idx + 5;
    const row = wsFreq.getRow(rowIndex);
    row.height = 21;

    // Col A: Aluno
    const cellA = row.getCell(1);
    cellA.value = st.name.toUpperCase();
    cellA.font = { name: 'Calibri', size: 10.5, color: { argb: 'FF000000' } };
    cellA.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    cellA.border = THIN_BORDER;

    // Col B: RA
    const cellB = row.getCell(2);
    cellB.value = st.registrationNumber;
    cellB.font = { name: 'Calibri', size: 10.5, color: { argb: 'FF000000' } };
    cellB.alignment = { vertical: 'middle', horizontal: 'center' };
    cellB.border = THIN_BORDER;

    // Col C: Turma
    const cellC = row.getCell(3);
    cellC.value = classNameDisplay;
    cellC.font = { name: 'Calibri', size: 10.5, color: { argb: 'FF333333' } };
    cellC.alignment = { vertical: 'middle', horizontal: 'center' };
    cellC.border = THIN_BORDER;

    // Col D: Presença (Green)
    const cellD = row.getCell(4);
    cellD.value = presencesCount;
    cellD.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF009944' } };
    cellD.alignment = { vertical: 'middle', horizontal: 'center' };
    cellD.border = THIN_BORDER;

    // Col E: Atrasos (Orange)
    const cellE = row.getCell(5);
    cellE.value = latesCount;
    cellE.font = { name: 'Calibri', size: 11, bold: latesCount > 0, color: { argb: 'FFE65100' } };
    cellE.alignment = { vertical: 'middle', horizontal: 'center' };
    cellE.border = THIN_BORDER;

    // Col F: Faltas (Red)
    const cellF = row.getCell(6);
    cellF.value = absencesCount;
    cellF.font = { name: 'Calibri', size: 11, bold: absencesCount > 0, color: { argb: 'FFC00000' } };
    cellF.alignment = { vertical: 'middle', horizontal: 'center' };
    cellF.border = THIN_BORDER;

    // Col G: Justificadas
    const cellG = row.getCell(7);
    cellG.value = excusedCount;
    cellG.font = { name: 'Calibri', size: 11, color: { argb: 'FF333333' } };
    cellG.alignment = { vertical: 'middle', horizontal: 'center' };
    cellG.border = THIN_BORDER;

    // Col H: Frequência
    const cellH = row.getCell(8);
    cellH.value = `${frequencyRate.toFixed(1).replace('.', ',')}%`;
    const isAtRisk = frequencyRate < 75;
    cellH.font = { name: 'Calibri', size: 11, bold: true, color: { argb: isAtRisk ? 'FFC00000' : 'FF009944' } };
    cellH.alignment = { vertical: 'middle', horizontal: 'center' };
    cellH.border = THIN_BORDER;
  });

  const lastDataRow = students.length + 4;
  wsFreq.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: lastDataRow, column: 8 }
  };

  // TAB 2: Detalhamento de Aulas
  const wsDetail = workbook.addWorksheet('Detalhamento de Aulas', {
    views: [{ showGridLines: true }]
  });

  wsDetail.columns = [
    { key: 'data', width: 14 },
    { key: 'horario', width: 18 },
    { key: 'tema', width: 34 },
    { key: 'tipo', width: 22 },
    { key: 'num', width: 8 },
    { key: 'aluno', width: 38 },
    { key: 'ra', width: 16 },
    { key: 'p1_status', width: 15 },
    { key: 'p1_hora', width: 16 },
    { key: 'p2_status', width: 15 },
    { key: 'p2_hora', width: 16 },
    { key: 'status', width: 18 },
    { key: 'metodo', width: 20 }
  ];

  wsDetail.mergeCells('A1:M1');
  const dTitle = wsDetail.getCell('A1');
  dTitle.value = `Detalhamento de Chamadas & Horários de Presença • ${selectedClass.name}`;
  dTitle.fill = BLUE_HEADER_FILL;
  dTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  dTitle.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  wsDetail.getRow(1).height = 32;

  const dHeaderRow = wsDetail.getRow(3);
  dHeaderRow.height = 24;
  const dHeaders = [
    'Data', 'Horário da Chamada', 'Tema / Título da Aula', 'Tipo de Atividade', 'Nº', 'Nome do Aluno', 'RA',
    '1ª Aula', 'Hora 1ª Aula', '2ª Aula', 'Hora 2ª Aula',
    'Status Consolidado', 'Método de Check-in'
  ];

  dHeaders.forEach((text, colIdx) => {
    const c = dHeaderRow.getCell(colIdx + 1);
    c.value = text;
    c.fill = BLUE_HEADER_FILL;
    c.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
    c.border = HEADER_BORDER;
  });

  let dCurrentRow = 4;
  sessions.forEach(sess => {
    const sessionTimeDisplay = sess.startTime 
      ? (sess.endTime && sess.endTime !== sess.startTime ? `${sess.startTime} às ${sess.endTime}` : sess.startTime)
      : '07:30 às 12:00';

    students.forEach((st, idx) => {
      const rec = getStudentAttendanceRecord(sess.attendance, st);
      const isPresent = isRecordPresent(rec);
      const isLate = isRecordLate(rec);
      const isExcused = isRecordExcused(rec);

      const isP1 = rec?.period1Status === 'present' || rec?.p1StartStatus === 'present' || rec?.p1EndStatus === 'present';
      const isP2 = rec?.period2Status === 'present' || rec?.p2StartStatus === 'present' || rec?.p2EndStatus === 'present';
      const p1Status = isP1 ? 'Presente' : (rec?.period1Status === 'late' || rec?.p1StartStatus === 'late' ? 'Atraso' : (rec?.period1Status === 'excused' ? 'Atestado' : 'Falta'));
      const p2Status = isP2 ? 'Presente' : (rec?.period2Status === 'late' || rec?.p2StartStatus === 'late' ? 'Atraso' : (rec?.period2Status === 'excused' ? 'Atestado' : 'Falta'));
      const p1Time = rec?.period1Timestamp || rec?.p1StartTimestamp || rec?.p1EndTimestamp || '-';
      const p2Time = rec?.period2Timestamp || rec?.p2StartTimestamp || rec?.p2EndTimestamp || '-';
      const overall = isPresent ? 'Presente' : isLate ? 'Atraso' : isExcused ? 'Atestado' : 'Falta';

      const row = wsDetail.getRow(dCurrentRow);
      row.height = 20;

      const dateFormatted = sess.date ? sess.date.split('-').reverse().join('/') : '-';
      const labSuffix = sess.labLocation === 'anatomia' ? ' [Lab. Anatomia]' : sess.labLocation === 'histologia' ? ' [Lab. Histologia]' : '';
      row.getCell(1).value = dateFormatted;
      row.getCell(2).value = sessionTimeDisplay;
      row.getCell(3).value = sess.topic || 'Aula Regular BMF4';
      row.getCell(4).value = (sess.activityType || sess.activityCategory || 'Teórica/Prática') + labSuffix;
      row.getCell(5).value = idx + 1;
      row.getCell(6).value = st.name.toUpperCase();
      row.getCell(7).value = st.registrationNumber;
      row.getCell(8).value = p1Status;
      row.getCell(9).value = p1Time;
      row.getCell(10).value = p2Status;
      row.getCell(11).value = p2Time;
      row.getCell(12).value = overall;
      row.getCell(13).value = rec?.checkinMethod === 'qrcode' ? 'QR Code Dinâmico' : 'Manual / Docente';

      for (let c = 1; c <= 13; c++) {
        const cell = row.getCell(c);
        cell.font = { name: 'Calibri', size: 10 };
        cell.border = THIN_BORDER;
        cell.alignment = { vertical: 'middle', horizontal: (c === 3 || c === 6) ? 'left' : 'center' };
      }
      dCurrentRow++;
    });
  });

  if (dCurrentRow > 4) {
    wsDetail.autoFilter = {
      from: { row: 3, column: 1 },
      to: { row: dCurrentRow - 1, column: 13 }
    };
  }

  // TAB 3: Resumo Estatístico
  const wsSummary = workbook.addWorksheet('Resumo Estatístico', {
    views: [{ showGridLines: true }]
  });

  wsSummary.columns = [{ key: 'k', width: 38 }, { key: 'v', width: 28 }];
  wsSummary.mergeCells('A1:B1');
  const sTitle = wsSummary.getCell('A1');
  sTitle.value = `Indicadores Gerais da Turma • ${selectedClass.name}`;
  sTitle.fill = BLUE_HEADER_FILL;
  sTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  sTitle.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  wsSummary.getRow(1).height = 32;

  const summaryData = [
    ['Instituição:', 'UNIVERSIDADE NOVE DE JULHO - UNINOVE MEDICINA'],
    ['Disciplina:', 'BMF4 - Bases Morfofuncionais 4'],
    ['Turma:', selectedClass.name],
    ['Docente Responsável:', activeProfessor?.name || selectedClass.professorName || 'Docente BMF4'],
    ['Total de Alunos Matriculados:', students.length],
    ['Total de Aulas / Chamadas Registradas:', sessions.length],
    ['Frequência Média Geral da Turma:', `${overallStats.avgRate}%`],
    ['Alunos com Frequência Regular (≥ 75%):', students.length - overallStats.atRiskCount],
    ['Alunos em Risco de Frequência (< 75%):', overallStats.atRiskCount],
    ['Total de Atestados Médicos Aceitos:', overallStats.totalExcused],
    ['Data de Emissão:', `${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`]
  ];

  summaryData.forEach((pair, idx) => {
    const row = wsSummary.getRow(idx + 3);
    row.height = 22;
    const cellK = row.getCell(1);
    const cellV = row.getCell(2);

    cellK.value = pair[0];
    cellK.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0B5394' } };
    cellK.border = THIN_BORDER;

    cellV.value = pair[1];
    cellV.font = { name: 'Calibri', size: 11, bold: false, color: { argb: 'FF000000' } };
    cellV.border = THIN_BORDER;
  });

  await triggerExcelDownload(workbook, `frequencia-bmf4-${selectedClass.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`);
}

// =========================================================================
// 2. QUADRO DE NOTAS & AVALIAÇÕES COLORIDO (5 Ciclos, Práticas e Médias)
// =========================================================================
export async function exportModernGradesExcel({
  selectedClass,
  students,
  activeProfessor,
  grades,
  gradeCycles,
  getGradeValue,
  getCycleAverage,
  getTeoricaAverage,
  getPraticaAverage,
  getAnatomiaAverage,
  getHistologiaAverage,
  getStudentAverage
}: ExportGradesOptions): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'UNINOVE Medicina - BMF4';
  workbook.lastModifiedBy = activeProfessor?.name || selectedClass.professorName || 'Docente BMF4';
  workbook.created = new Date();
  workbook.modified = new Date();

  // TAB 1: Notas e Avaliações
  const ws = workbook.addWorksheet('Quadro de Notas', {
    views: [{ showGridLines: true }]
  });

  const totalCols = 3 + (gradeCycles.length * 3) + 4; // Nº, Nome, RA + 5 ciclos * 3 (AT, AH, Média C) + Média Teo + Média Prát + Média Final + Situação = 22 cols

  // Column definitions
  const columnsConfig: Array<{ key: string; width: number }> = [
    { key: 'num', width: 7 },
    { key: 'aluno', width: 40 },
    { key: 'ra', width: 16 }
  ];

  gradeCycles.forEach(c => {
    columnsConfig.push({ key: `at_${c.cycleNumber}`, width: 12 });
    columnsConfig.push({ key: `ah_${c.cycleNumber}`, width: 12 });
    columnsConfig.push({ key: `med_${c.cycleNumber}`, width: 14 });
  });

  columnsConfig.push({ key: 'med_teo', width: 15 });
  columnsConfig.push({ key: 'med_prat', width: 18 });
  columnsConfig.push({ key: 'med_final', width: 16 });
  columnsConfig.push({ key: 'situacao', width: 22 });

  ws.columns = columnsConfig;

  // ROW 1: Master Banner
  const lastColLetter = getExcelColLetter(totalCols);
  ws.mergeCells(`A1:${lastColLetter}1`);
  const titleCell = ws.getCell('A1');
  const classNameDisplay = selectedClass.name.replace(/^BMF4\s*/i, '').trim() || selectedClass.name;
  titleCell.value = `Quadro Oficial de Notas & Avaliações BMF4 • ${classNameDisplay}`;
  titleCell.fill = BLUE_HEADER_FILL;
  titleCell.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 36;

  // ROW 2: Subtitle
  ws.mergeCells(`A2:${lastColLetter}2`);
  const subCell = ws.getCell('A2');
  subCell.value = `Atividades Teóricas (1 a 5), Atividades Práticas Anato/Histo (1 a 5) e Médias dos 5 Ciclos · UNINOVE Medicina`;
  subCell.font = { name: 'Calibri', size: 10.5, color: { argb: 'FF333333' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(2).height = 22;

  // ROW 3: Spacing
  ws.getRow(3).height = 8;

  // ROW 4: Table Headers
  const headerRow = ws.getRow(4);
  headerRow.height = 28;

  const headerLabels: string[] = ['Nº', 'Aluno', 'RA'];
  gradeCycles.forEach(c => {
    headerLabels.push(`AT${c.cycleNumber}`);
    headerLabels.push(`AH${c.cycleNumber}`);
    headerLabels.push(`Média C${c.cycleNumber}`);
  });
  headerLabels.push('Média Teórica');
  headerLabels.push('Média Anato/Histo');
  headerLabels.push('MÉDIA FINAL');
  headerLabels.push('Situação');

  headerLabels.forEach((label, idx) => {
    const colIdx = idx + 1;
    const cell = headerRow.getCell(colIdx);
    cell.value = label;

    // Header Color by Section
    if (colIdx <= 3) {
      cell.fill = BLUE_HEADER_FILL;
    } else if (colIdx > totalCols - 4) {
      cell.fill = BLUE_FINAL_HEADER_FILL; // Deep Navy for Finals
    } else {
      cell.fill = BLUE_CYCLE_HEADER_FILL; // Slate Teal for Cycles
    }

    cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = HEADER_BORDER;
  });

  // Populate Data Rows
  let approvedCount = 0;
  let recuperationCount = 0;
  let pendingCount = 0;
  let totalFinalAvgSum = 0;
  let finalAvgCount = 0;

  students.forEach((st, idx) => {
    const rowIndex = idx + 5;
    const row = ws.getRow(rowIndex);
    row.height = 21;

    let col = 1;

    // Nº
    const cNum = row.getCell(col++);
    cNum.value = idx + 1;
    cNum.font = { name: 'Calibri', size: 10, color: { argb: 'FF666666' } };
    cNum.alignment = { vertical: 'middle', horizontal: 'center' };
    cNum.border = THIN_BORDER;

    // Aluno (Uppercase)
    const cName = row.getCell(col++);
    cName.value = st.name.toUpperCase();
    cName.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF000000' } };
    cName.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    cName.border = THIN_BORDER;

    // RA
    const cRA = row.getCell(col++);
    cRA.value = st.registrationNumber;
    cRA.font = { name: 'Calibri', size: 10.5, color: { argb: 'FF333333' } };
    cRA.alignment = { vertical: 'middle', horizontal: 'center' };
    cRA.border = THIN_BORDER;

    // Cycles Notes & Averages
    gradeCycles.forEach(c => {
      const vTeo = getGradeValue(st.id, c.teorica.id, c.teorica.keyAlt);
      const vPrat = getGradeValue(st.id, c.pratica.id, c.pratica.keyAlt);
      const avgC = getCycleAverage(st.id, c);

      // AT
      const cellTeo = row.getCell(col++);
      formatGradeCell(cellTeo, vTeo);

      // AH
      const cellPrat = row.getCell(col++);
      formatGradeCell(cellPrat, vPrat);

      // Média Ciclo
      const cellAvg = row.getCell(col++);
      formatAverageCell(cellAvg, avgC);
    });

    // General Averages
    const avgTeo = getTeoricaAverage(st.id);
    const avgPrat = getPraticaAverage ? getPraticaAverage(st.id) : (getAnatomiaAverage && getHistologiaAverage ? getAnatomiaAverage(st.id) : null);
    const finalAvg = getStudentAverage(st.id);

    const cellTeoAvg = row.getCell(col++);
    formatAverageCell(cellTeoAvg, avgTeo);

    const cellPratAvg = row.getCell(col++);
    formatAverageCell(cellPratAvg, avgPrat);

    // Média Final
    const cellFinal = row.getCell(col++);
    if (finalAvg !== null) {
      totalFinalAvgSum += finalAvg;
      finalAvgCount++;
      cellFinal.value = Number(finalAvg.toFixed(1));
      cellFinal.numFmt = '0.0';
      cellFinal.font = {
        name: 'Calibri',
        size: 11,
        bold: true,
        color: { argb: finalAvg >= 6.0 ? 'FF009944' : 'FFC00000' }
      };
    } else {
      cellFinal.value = '-';
      cellFinal.font = { name: 'Calibri', size: 10, color: { argb: 'FF999999' } };
    }
    cellFinal.alignment = { vertical: 'middle', horizontal: 'center' };
    cellFinal.border = THIN_BORDER;

    // Situação
    const cellSit = row.getCell(col++);
    if (finalAvg === null) {
      cellSit.value = 'Pendente';
      cellSit.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFD97706' } };
      pendingCount++;
    } else if (finalAvg >= 6.0) {
      cellSit.value = 'Aprovado (≥ 6.0)';
      cellSit.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF009944' } };
      approvedCount++;
    } else {
      cellSit.value = 'Em Recuperação (< 6.0)';
      cellSit.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFC00000' } };
      recuperationCount++;
    }
    cellSit.alignment = { vertical: 'middle', horizontal: 'center' };
    cellSit.border = THIN_BORDER;
  });

  // Enable Auto-filter on grades
  const lastGradeRow = students.length + 4;
  ws.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: lastGradeRow, column: totalCols }
  };

  // TAB 2: Resumo Estatístico de Notas
  const wsStat = workbook.addWorksheet('Resumo Estatístico', {
    views: [{ showGridLines: true }]
  });
  wsStat.columns = [{ key: 'k', width: 38 }, { key: 'v', width: 28 }];
  wsStat.mergeCells('A1:B1');
  const stTitle = wsStat.getCell('A1');
  stTitle.value = `Resumo de Rendimento & Médias • ${selectedClass.name}`;
  stTitle.fill = BLUE_HEADER_FILL;
  stTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  stTitle.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  wsStat.getRow(1).height = 32;

  const classAvgFinal = finalAvgCount > 0 ? (totalFinalAvgSum / finalAvgCount).toFixed(2) : '-';

  const statRows = [
    ['Instituição:', 'UNIVERSIDADE NOVE DE JULHO - UNINOVE MEDICINA'],
    ['Disciplina:', 'BMF4 - Bases Morfofuncionais 4'],
    ['Turma:', selectedClass.name],
    ['Docente Responsável:', activeProfessor?.name || selectedClass.professorName || 'Docente BMF4'],
    ['Total de Alunos Matriculados:', students.length],
    ['Alunos com Avaliação Lançada:', finalAvgCount],
    ['Média Geral da Turma (BMF4):', classAvgFinal],
    ['Alunos Aprovados (≥ 6.0):', approvedCount],
    ['Alunos em Recuperação (< 6.0):', recuperationCount],
    ['Alunos com Avaliações Pendentes:', pendingCount],
    ['Data de Emissão:', `${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`]
  ];

  statRows.forEach((pair, idx) => {
    const r = wsStat.getRow(idx + 3);
    r.height = 22;
    const cK = r.getCell(1);
    const cV = r.getCell(2);

    cK.value = pair[0];
    cK.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0B5394' } };
    cK.border = THIN_BORDER;

    cV.value = pair[1];
    cV.font = { name: 'Calibri', size: 11, bold: false, color: { argb: 'FF000000' } };
    cV.border = THIN_BORDER;
  });

  await triggerExcelDownload(workbook, `quadro-notas-bmf4-${selectedClass.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`);
}

// =========================================================================
// 3. LISTA NOMINAL DE ALUNOS / ROSTER EXPORT
// =========================================================================
export async function exportModernRosterExcel({
  selectedClass,
  students,
  activeSession,
  activeProfessor
}: ExportRosterOptions): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'UNINOVE Medicina - BMF4';
  workbook.lastModifiedBy = activeProfessor?.name || selectedClass.professorName || 'Docente BMF4';
  workbook.created = new Date();
  workbook.modified = new Date();

  const ws = workbook.addWorksheet('Lista de Alunos', {
    views: [{ showGridLines: true }]
  });

  ws.columns = [
    { key: 'num', width: 7 },
    { key: 'aluno', width: 42 },
    { key: 'ra', width: 16 },
    { key: 'turma', width: 16 },
    { key: 'email', width: 34 },
    { key: 'status', width: 18 },
    { key: 'horario', width: 18 }
  ];

  // Banner
  ws.mergeCells('A1:G1');
  const tCell = ws.getCell('A1');
  const classNameDisplay = selectedClass.name.replace(/^BMF4\s*/i, '').trim() || selectedClass.name;
  tCell.value = `Lista Nominal de Alunos • ${classNameDisplay}`;
  tCell.fill = BLUE_HEADER_FILL;
  tCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  tCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 36;

  // Subtitle
  ws.mergeCells('A2:G2');
  const sub = ws.getCell('A2');
  sub.value = `Total de ${students.length} alunos matriculados · UNINOVE Medicina`;
  sub.font = { name: 'Calibri', size: 10.5, color: { argb: 'FF333333' } };
  sub.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(2).height = 22;

  // Headers
  ws.getRow(3).height = 8;
  const hRow = ws.getRow(4);
  hRow.height = 26;
  const rHeaders = ['Nº', 'Aluno', 'RA / Matrícula', 'Turma', 'E-mail Institucional', 'Status Chamada Atual', 'Horário Check-in'];

  rHeaders.forEach((text, colIdx) => {
    const c = hRow.getCell(colIdx + 1);
    c.value = text;
    c.fill = BLUE_HEADER_FILL;
    c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
    c.border = HEADER_BORDER;
  });

  students.forEach((st, idx) => {
    const rec = activeSession?.attendance?.[st.id];
    const statusLabel = rec?.status === 'present' ? 'Presente' : rec?.status === 'late' ? 'Atraso' : rec?.status === 'excused' ? 'Atestado' : 'Falta';
    const isPresent = rec?.status === 'present' || rec?.status === 'late';
    const checkinTime = rec?.timestamp || rec?.p1StartTimestamp || '-';

    const r = ws.getRow(idx + 5);
    r.height = 21;

    r.getCell(1).value = idx + 1;
    r.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: 'FF666666' } };
    r.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    r.getCell(1).border = THIN_BORDER;

    r.getCell(2).value = st.name.toUpperCase();
    r.getCell(2).font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF000000' } };
    r.getCell(2).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    r.getCell(2).border = THIN_BORDER;

    r.getCell(3).value = st.registrationNumber;
    r.getCell(3).font = { name: 'Calibri', size: 10.5, color: { argb: 'FF000000' } };
    r.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
    r.getCell(3).border = THIN_BORDER;

    r.getCell(4).value = classNameDisplay;
    r.getCell(4).font = { name: 'Calibri', size: 10.5, color: { argb: 'FF333333' } };
    r.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
    r.getCell(4).border = THIN_BORDER;

    r.getCell(5).value = st.email || `${st.registrationNumber}@uni9.edu.br`;
    r.getCell(5).font = { name: 'Calibri', size: 10.5, color: { argb: 'FF333333' } };
    r.getCell(5).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    r.getCell(5).border = THIN_BORDER;

    const cellSt = r.getCell(6);
    cellSt.value = statusLabel;
    cellSt.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: isPresent ? 'FF009944' : 'FFC00000' }
    };
    cellSt.alignment = { vertical: 'middle', horizontal: 'center' };
    cellSt.border = THIN_BORDER;

    const cellTime = r.getCell(7);
    cellTime.value = checkinTime;
    cellTime.font = { name: 'Calibri', size: 10.5, color: { argb: 'FF333333' } };
    cellTime.alignment = { vertical: 'middle', horizontal: 'center' };
    cellTime.border = THIN_BORDER;
  });

  const lastRosterRow = students.length + 4;
  ws.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: lastRosterRow, column: 7 }
  };

  await triggerExcelDownload(workbook, `alunos-bmf4-${selectedClass.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`);
}

// =========================================================================
// 4. MODELO OFICIAL DE IMPORTAÇÃO DE ALUNOS (XLSX Blob para Download)
// =========================================================================
export async function generateModernSampleExcelBlob(): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'UNINOVE Medicina - BMF4';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Alunos BMF4', {
    views: [{ showGridLines: true }]
  });

  ws.columns = [
    { key: 'nome', width: 38 },
    { key: 'ra', width: 18 },
    { key: 'email', width: 34 },
    { key: 'curso', width: 16 }
  ];

  // Banner
  ws.mergeCells('A1:D1');
  const tCell = ws.getCell('A1');
  tCell.value = 'Modelo Oficial de Importação de Alunos • BMF4';
  tCell.fill = BLUE_HEADER_FILL;
  tCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  tCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 32;

  // Subtitle
  ws.mergeCells('A2:D2');
  const sub = ws.getCell('A2');
  sub.value = 'Preencha as linhas abaixo e faça o upload no sistema · UNINOVE Medicina';
  sub.font = { name: 'Calibri', size: 10, color: { argb: 'FF333333' } };
  sub.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(2).height = 20;

  // Headers
  const hRow = ws.getRow(4);
  hRow.height = 26;
  const headers = ['Nome Completo', 'Matrícula / RA', 'Email Institucional', 'Curso'];
  headers.forEach((h, idx) => {
    const c = hRow.getCell(idx + 1);
    c.value = h;
    c.fill = BLUE_HEADER_FILL;
    c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
    c.border = HEADER_BORDER;
  });

  const samples = [
    ['Ana Carolina Mendes', '426202091', 'ana.mendes@uni9.edu.br', 'Medicina'],
    ['Bernardo Castro Filho', '426202092', 'bernardo.castro@uni9.edu.br', 'Medicina'],
    ['Camila Albuquerque Silva', '426202093', 'camila.albuquerque@uni9.edu.br', 'Medicina'],
    ['Diego Ferreira Ramos', '426202094', 'diego.ramos@uni9.edu.br', 'Medicina'],
    ['Eduarda Vasconcelos', '426202095', 'eduarda.vasconcelos@uni9.edu.br', 'Medicina'],
    ['Felipe Santana Prado', '426202096', 'felipe.santana@uni9.edu.br', 'Medicina'],
    ['Gabriela Pinheiro Lima', '426202097', 'gabriela.lima@uni9.edu.br', 'Medicina'],
    ['Henrique Guimarães Costa', '426202098', 'henrique.costa@uni9.edu.br', 'Medicina'],
    ['Isabela Rezende Costa', '426202099', 'isabela.rezende@uni9.edu.br', 'Medicina'],
    ['João Pedro Nogueira', '426202100', 'joao.nogueira@uni9.edu.br', 'Medicina']
  ];

  samples.forEach((row, idx) => {
    const r = ws.getRow(idx + 5);
    r.height = 20;
    row.forEach((val, cIdx) => {
      const cell = r.getCell(cIdx + 1);
      cell.value = val;
      cell.font = { name: 'Calibri', size: 10.5 };
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: 'middle', horizontal: cIdx === 0 ? 'left' : 'center' };
    });
  });

  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 14, column: 4 } };

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

// =========================================================================
// HELPER FUNCTIONS
// =========================================================================

function formatGradeCell(cell: ExcelJS.Cell, val: number | null) {
  if (val !== null) {
    cell.value = Number(val.toFixed(1));
    cell.numFmt = '0.0';
    cell.font = {
      name: 'Calibri',
      size: 10.5,
      bold: val >= 6.0,
      color: { argb: val >= 6.0 ? 'FF009944' : 'FFC00000' }
    };
  } else {
    cell.value = '-';
    cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF999999' } };
  }
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
  cell.border = THIN_BORDER;
}

function formatAverageCell(cell: ExcelJS.Cell, val: number | null) {
  if (val !== null) {
    cell.value = Number(val.toFixed(1));
    cell.numFmt = '0.0';
    cell.font = {
      name: 'Calibri',
      size: 10.5,
      bold: true,
      color: { argb: val >= 6.0 ? 'FF009944' : 'FFC00000' }
    };
  } else {
    cell.value = '-';
    cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF999999' } };
  }
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
  cell.border = THIN_BORDER;
}

function getExcelColLetter(colIndex: number): string {
  let temp = colIndex;
  let letter = '';
  while (temp > 0) {
    let mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter || 'A';
}

async function triggerExcelDownload(workbook: ExcelJS.Workbook, baseFilename: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${baseFilename}-${new Date().toISOString().split('T')[0]}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}
