export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export type SoundEffectType = 
  | 'success'          // Presença confirmada / Operação com sucesso (Do-Mi-Sol ascendente)
  | 'scan'             // Detecção ótica rápida de QR Code / Barcode (Chirp cristalino)
  | 'checkpoint'       // Registro de Checkpoint 1ª/2ª aula (Arpejo harmônico)
  | 'late'             // Presença com atraso (Tom suave âmbar)
  | 'excused'          // Atestado médico / justificativa (Tom suave pastel)
  | 'warning'          // Alerta / Atenção / Código incorreto (Bitom descendente suave)
  | 'alert'            // Bloqueio anti-fraude / RA inexistente (Duplo pulso grave)
  | 'error'            // Erro crítico / Operação negada (Tom de erro)
  | 'session_start'    // Abertura de chamada / Início de aula (Fanfarra ascendente triunfal)
  | 'session_lock'     // Fechamento / Trancamento de chamada (Chime descendente de bloqueio)
  | 'grade'            // Nota lançada / Atualização no diário (Chime de pontuação)
  | 'export'           // Exportação de planilha Excel / Backup (Chime de download)
  | 'sync'             // Sincronização em nuvem / Firestore (Pulso harmônico)
  | 'delete'           // Exclusão / Remoção de registro (Tom descendente)
  | 'student_added'    // Novo aluno cadastrado (Chime alegre)
  | 'confirm'          // Confirmação de ação / clique seguro
  | 'click';           // Toque tátil / clique de interface


export type CourseType = 'Medicina' | 'Enfermagem' | 'Odontologia' | 'Fisioterapia' | 'Biomedicina' | 'Farmácia' | 'Educação Física';

export type ActivityCategory = 'teorica' | 'pratica';

export type LaboratoryLocation = 'anatomia' | 'histologia' | 'ambos';

export type ActivityType = 
  | 'aula_teorica'           // Aula Teórica (Chamada Início/Fim na 1ª e 2ª aula)
  | 'prova_teorica'          // Prova Teórica (Chamada única)
  | 'aula_pratica'           // Aula Prática (Chamada Início/Fim na 1ª e 2ª aula)
  | 'atividade_pratica_1'    // Anato/Histo 1 (Chamada única)
  | 'atividade_pratica_2'    // Anato/Histo 2 (Chamada única)
  | 'atividade_pratica_3'    // Anato/Histo 3 (Chamada única)
  | 'atividade_pratica_4'    // Anato/Histo 4 (Chamada única)
  | 'atividade_pratica_5';   // Anato/Histo 5 (Chamada única)

export type CheckpointPhase = 
  | 'p1_start'          // 1ª Aula - Início (Começo)
  | 'p1_end'            // 1ª Aula - Final (Saída/Garantia)
  | 'p2_start'          // 2ª Aula - Início (Começo)
  | 'p2_end'            // 2ª Aula - Final (Saída/Garantia)
  | 'activity_single'   // Atividade (Chamada Única)
  | '1'                 // 1ª Aula (Geral)
  | '2'                 // 2ª Aula (Geral)
  | 'both';             // Integral (1ª e 2ª)

export type ClassPeriod = '1' | '2' | 'both' | 'p1_start' | 'p1_end' | 'p2_start' | 'p2_end' | 'activity_single';

export interface Professor {
  id: string;
  name: string;
  registrationNumber?: string; // Matrícula / Registro
  email: string;
  pin?: string; // Senha / PIN de acesso rápido (ex: "1234")
  password?: string;
  discipline: string; // Ex: "BMF4 - Bases Morfofuncionais 4"
  assignedClassIds: string[]; // IDs das turmas sob responsabilidade
  avatarUrl?: string;
  phone?: string;
  role?: 'admin' | 'professor' | 'coordenador' | 'monitor'; // Perfil de acesso: 'admin' tem permissão exclusiva de exclusão
  hasChangedPin?: boolean; // Se o docente já alterou o PIN padrão inicial (1234)
  isFirstAccess?: boolean;
}

export interface Student {
  id: string;
  name: string;
  registrationNumber: string; // Matrícula / RA
  email: string;
  discipline: string; // Ex: "BMF4"
  course: CourseType;
  classGroupId: string; // Turma ID
  avatarUrl?: string;
  notes?: string;
  boundDeviceId?: string; // ID/Fingerprint do dispositivo vinculado por segurança
  deviceBoundAt?: string; // Data/Hora em que o dispositivo foi vinculado
  totalClasses?: number;
  presences?: number;
  absences?: number;
  lates?: number;
  excused?: number;
}

export interface ClassGroup {
  id: string;
  institution?: string; // Ex: UNINOVE MEDICINA
  code: string; // Ex: BMF4
  name: string; // Ex: BMF4 Turma A
  discipline?: string; // Ex: BMF4 - Bases Morfofuncionais 4
  course: CourseType;
  semester: string; // Ex: 4º Semestre 2026
  laboratoryRoom: string; // Ex: Lab. Morfologia e Práticas Médicas (Lab 04)
  professorName: string;
  professorId?: string;
  monitorName?: string;
  schedule: string; // Ex: Segunda a Sexta, 07:30 - 12:00
  color: string;
  totalStudents?: number;
}

export interface AttendanceRecord {
  studentId: string;
  studentName?: string;
  studentRa?: string;
  status: AttendanceStatus; // Status geral consolidado
  period1Status?: AttendanceStatus; // Presença / Atraso / Falta na 1ª Aula consolidada
  period2Status?: AttendanceStatus; // Presença / Atraso / Falta na 2ª Aula consolidada
  
  // 4 Checkpoints de Verificação (Aulas Teóricas e Práticas)
  p1StartStatus?: AttendanceStatus; // 1ª Aula - Início
  p1EndStatus?: AttendanceStatus;   // 1ª Aula - Final
  p2StartStatus?: AttendanceStatus; // 2ª Aula - Início
  p2EndStatus?: AttendanceStatus;   // 2ª Aula - Final

  // Timestamps exatos com horário da presença
  timestamp?: string; // e.g. "08:14:02"
  p1StartTimestamp?: string;
  p1EndTimestamp?: string;
  p2StartTimestamp?: string;
  p2EndTimestamp?: string;
  period1Timestamp?: string;
  period2Timestamp?: string;

  epiVerified?: boolean; // Jaleco, luva, máscara, calçado
  checkinMethod?: 'manual' | 'qrcode' | 'code' | 'totem' | 'dynamic_qr' | 'self_registered';
  deviceId?: string; // Fingerprint do dispositivo para evitar duplicidade
  deviceModel?: string;
  tokenUsed?: string;
  isVerifiedLive?: boolean;
  observation?: string;
  justificationReason?: string;
  justificationFileUrl?: string; // Anexo em base64 ou blob (imagem / PDF)
  justificationFileName?: string;
}

export interface LabSession {
  id: string;
  classGroupId: string;
  discipline: string; // Ex: "BMF4"
  professorId: string;
  professorName: string;
  coProfessors?: Array<{ id: string; name: string; joinedAt: string }>; // Co-docentes / Auxiliares na mesma chamada
  activityCategory: ActivityCategory; // 'teorica' | 'pratica'
  activityType: ActivityType; // 'aula_teorica' | 'prova_teorica' | 'aula_pratica' | 'atividade_pratica_1' ...
  labLocation?: LaboratoryLocation; // 'anatomia' | 'histologia' - Local do laboratório para aulas e atividades práticas
  activePeriod: ClassPeriod; // 'p1_start' | 'p1_end' | 'p2_start' | 'p2_end' | 'activity_single' | '1' | '2' | 'both'
  activeCheckpoint?: CheckpointPhase;
  isPeriod1Locked: boolean; // 1ª aula encerrada
  isPeriod2Locked: boolean; // 2ª aula encerrada
  isP1StartLocked?: boolean;
  isP1EndLocked?: boolean;
  isP2StartLocked?: boolean;
  isP2EndLocked?: boolean;
  isActivitySingleLocked?: boolean;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  topic: string; // Tema da aula (Ex: Sistema Cardiovascular - BMF4)
  anatomicalSpecimens: string[]; // Peças anatômicas utilizadas
  attendance: Record<string, AttendanceRecord>; // studentId -> AttendanceRecord
  checkinCode: string; // Código de 6 dígitos para o telão
  isLive: boolean; // Chamada aberta / fechada
  isPaused?: boolean; // Chamada pausada temporariamente pelo professor
  isLocked: boolean; // Encerrada em definitivo pelo professor
  openedAt?: string; // Timestamp ISO de quando a chamada foi aberta
  timestamp?: number; // Timestamp numérico milissegundos para ordenação e unicidade estrita
  closedAt?: string;
  notes?: string;
  syncStatus?: 'synced' | 'pending' | 'offline';
  version?: number; // Número de versão sequencial para Data Versioning
  lastUpdateTimestamp?: number; // Timestamp numérico em ms da última alteração de presença
}

export interface ActiveSessionDocument {
  id: string; // Document ID no Firestore (/activeSession/{id})
  sessionId: string;
  classGroupId: string;
  version: number;
  lastUpdateTimestamp: number;
  attendance: Record<string, AttendanceRecord>;
  activePeriod?: ClassPeriod;
  isLive?: boolean;
  isLocked?: boolean;
  topic?: string;
  discipline?: string;
  date?: string;
  professorId?: string;
  professorName?: string;
  activityType?: ActivityType;
  labLocation?: LaboratoryLocation;
  checkinCode?: string;
  updatedBy?: string;
}

export interface TeacherPresence {
  professorId: string;
  professorName: string;
  classGroupId: string;
  className: string;
  lastPing: number;
  isHost?: boolean;
}

export type DeviceType = 'tv' | 'mobile' | 'desktop' | 'tablet' | 'totem';

export interface ConnectedDevice {
  deviceId: string;
  deviceName: string;
  deviceType: DeviceType;
  platform?: string;
  userRole?: string;
  professorName?: string;
  lastPing: number;
  currentTab?: string;
  isOnline: boolean;
}

export interface TeacherConflictInfo {
  hasConflict: boolean;
  conflictType: 'live_session' | 'simultaneous_presence';
  currentProfessorId: string;
  currentProfessorName: string;
  otherProfessorId: string;
  otherProfessorName: string;
  classGroupId: string;
  className: string;
  sessionTopic?: string;
  sessionStartTime?: string;
  sessionId?: string;
  message: string;
}

export interface JustificationRequest {
  id: string;
  studentId: string;
  studentName?: string;
  studentRa?: string;
  sessionId: string;
  sessionTopic?: string;
  sessionDate: string;
  period?: '1' | '2' | 'both';
  reason: 'medical' | 'academic' | 'transport' | 'work' | 'other';
  documentNumber?: string; // CRM do Médico / Número do Atestado
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  attachmentName?: string;
  attachmentUrl?: string; // Data URL ou PDF Base64
}

export type AntiFraudMode = 'ultra_secure_tv' | 'balanced' | 'lenient';

export interface DynamicQrEmailDispatch {
  id: string;
  cycleNumber: number;
  token: string;
  securityHash?: string;
  recipient: string; // chamadabmf4@gmail.com
  className?: string;
  topic?: string;
  period?: string;
  sentAt: number;
  sentAtFormatted: string;
  deliveredViaSmtp?: boolean;
  status: 'sent' | 'delivered' | 'pending' | 'failed';
  message?: string;
  telaoUrl?: string;
}

export interface AppSettings {
  institutionName: string;
  disciplineName: string; // "BMF4 - Bases Morfofuncionais 4"
  toleranceMinutes: number; // Tolerância em minutos antes de marcar como atraso
  autoCloseMinutes: number; // Fechamento automático da chamada após X minutos (0 para desativar)
  soundEffects: boolean;
  hapticFeedback: boolean;
  requireEPI: boolean;
  
  // Anti-Fraud TV Security Settings
  antiFraudMode: AntiFraudMode; // 'ultra_secure_tv' (45s + trava celular), 'balanced' (60s), 'lenient' (90s)
  tokenRotationSeconds: number; // Intervalo de rotação do QR no Telão em segundos (ex: 30, 45, 60, 90, 120s para leitura tranquila)
  singleDeviceLock: boolean; // Impede 1 celular de bater presença para múltiplos alunos na mesma chamada
  requireGeofence: boolean; // Exige proximidade por GPS
  maxDistanceMeters: number; // Raio máximo de presença em metros (ex: 150m)
  allowSelfRegistration: boolean; // Permite auto-cadastro se não encontrado
  strictDeviceBinding: boolean; // Exigir rigorosamente o vínculo do dispositivo ao aluno (bloqueia troca de aparelho sem liberação docente)
}

// ========== GESTÃO E CONTROLE DE NOTAS BMF4 (15 ATIVIDADES) ==========
export type GradeActivityKey = 
  | 't1' | 't2' | 't3' | 't4' | 't5'  // 5 Atividades Teóricas
  | 'a1' | 'a2' | 'a3' | 'a4' | 'a5'  // 5 Atividades Práticas de Anatomia
  | 'h1' | 'h2' | 'h3' | 'h4' | 'h5'; // 5 Atividades Práticas de Histologia

export interface StudentBMF4Grades {
  studentId: string;
  classGroupId: string;
  // 5 Atividades Teóricas (0 a 10)
  t1?: number | null;
  t2?: number | null;
  t3?: number | null;
  t4?: number | null;
  t5?: number | null;
  // 5 Atividades Práticas de Anatomia (0 a 10)
  a1?: number | null;
  a2?: number | null;
  a3?: number | null;
  a4?: number | null;
  a5?: number | null;
  // 5 Atividades Práticas de Histologia (0 a 10)
  h1?: number | null;
  h2?: number | null;
  h3?: number | null;
  h4?: number | null;
  h5?: number | null;
  // Observações adicionais
  notes?: string;
  updatedAt?: string;
}

export interface StudentGradeRecord {
  studentId: string;
  classGroupId: string;
  scores: Record<string, number | null | undefined>; // activityKey -> nota (0.0 a 10.0)
  substituteExamScore?: number | null; // Prova Substitutiva / Exame Final
  notes?: string;
  updatedAt?: string;
}

export interface StudentAcademicStatus {
  studentId: string;
  studentName: string;
  registrationNumber: string;
  attendanceRate: number; // %
  totalPresences: number;
  totalAbsences: number;
  // Médias parciais por categoria
  teoricaAverage: number; // Média T1..T5
  anatomiaAverage: number; // Média A1..A5
  histologiaAverage: number; // Média H1..H5
  partialAverage: number; // Média Parcial Geral BMF4
  finalAverage: number; // Média Final após exame se houver
  substituteScore?: number | null;
  status: 'aprovado' | 'exame' | 'reprovado_nota' | 'reprovado_falta';
  statusLabel: string;
}

// ========== SISTEMA DE FILA DE MENSAGENS ('OUTBOX') OFFLINE/ONLINE ==========
export type OutboxEventType = 
  | 'RECORD_ATTENDANCE'
  | 'BATCH_ATTENDANCE'
  | 'EXCUSE_STUDENT'
  | 'SYNC_SESSION_STATE';

export type OutboxItemStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface AttendanceOutboxItem {
  id: string; // Unique transaction identifier
  eventType: OutboxEventType;
  sessionId: string;
  studentId?: string;
  studentName?: string;
  classGroupId?: string;
  status?: AttendanceStatus;
  period?: '1' | '2' | 'both';
  timestamp: string; // ISO String
  deviceId: string;
  professorId?: string;
  professorName?: string;
  syncStatus: OutboxItemStatus;
  createdAt: number; // Timestamp ms
  syncedAt?: number;
  retryCount: number;
  attempts?: number;
  lastError?: string;
  payload?: any;
}

export const getActivityTypeLabel = (type?: string): string => {
  switch (type) {
    case 'aula_teorica': return 'Aula Teórica';
    case 'prova_teorica': return 'Prova Teórica';
    case 'aula_pratica': return 'Aula Prática';
    case 'atividade_pratica_1': return 'Anato/Histo 1';
    case 'atividade_pratica_2': return 'Anato/Histo 2';
    case 'atividade_pratica_3': return 'Anato/Histo 3';
    case 'atividade_pratica_4': return 'Anato/Histo 4';
    case 'atividade_pratica_5': return 'Anato/Histo 5';
    default: return 'Aula Regular';
  }
};

