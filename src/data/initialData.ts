import { 
  ClassGroup, 
  Student, 
  LabSession, 
  JustificationRequest, 
  AppSettings, 
  Professor,
  StudentGradeRecord
} from '../types';

export const DEFAULT_SETTINGS: AppSettings = {
  institutionName: 'UNINOVE MEDICINA',
  disciplineName: 'BMF4 - Bases Morfofuncionais 4',
  toleranceMinutes: 15,
  autoCloseMinutes: 0,
  soundEffects: true,
  hapticFeedback: true,
  requireEPI: true,
  antiFraudMode: 'ultra_secure_tv',
  tokenRotationSeconds: 600,
  singleDeviceLock: true,
  requireGeofence: false,
  maxDistanceMeters: 150,
  allowSelfRegistration: true,
  strictDeviceBinding: true,
};

export const INITIAL_PROFESSORS: Professor[] = [
  {
    id: 'prof-admin-1',
    name: 'Prof. Dr. Juliano Pereira (Admin)',
    registrationNumber: 'DOC-1001',
    email: 'juliano.pereira@uni9.edu.br',
    pin: '1234',
    discipline: 'BMF4 - Bases Morfofuncionais 4',
    assignedClassIds: [],
    role: 'admin',
    phone: '(11) 98765-4321',
    hasChangedPin: false,
  },
  {
    id: 'prof-docente-2',
    name: 'Dra. Carolina Mendes',
    registrationNumber: 'DOC-1002',
    email: 'carolina.mendes@uni9.edu.br',
    pin: '1234',
    discipline: 'BMF4 - Bases Morfofuncionais 4',
    assignedClassIds: [],
    role: 'professor',
    phone: '(11) 98765-4322',
    hasChangedPin: false,
  }
];

export const BMF4_CLASS_IDS = {
  TURMA_A: 'class-bmf4-turmaa',
  TURMA_B: 'class-bmf4-turmab',
} as const;

export const INITIAL_CLASSES: ClassGroup[] = [
  {
    id: 'class-bmf4-turmaa',
    institution: 'UNINOVE MEDICINA',
    code: 'TURMA-A',
    name: 'Turma A',
    discipline: 'BMF4 - Bases Morfofuncionais 4',
    course: 'Medicina',
    semester: '4º Semestre 2026',
    laboratoryRoom: 'Laboratório de Morfologia / Práticas Médicas',
    professorName: 'Prof. Dr. Juliano Pereira',
    professorId: 'prof-admin-1',
    schedule: '07:30 - 12:00',
    color: '#0284c7',
    totalStudents: 0,
  },
  {
    id: 'class-bmf4-turmab',
    institution: 'UNINOVE MEDICINA',
    code: 'TURMA-B',
    name: 'Turma B',
    discipline: 'BMF4 - Bases Morfofuncionais 4',
    course: 'Medicina',
    semester: '4º Semestre 2026',
    laboratoryRoom: 'Laboratório de Morfologia / Práticas Médicas',
    professorName: 'Dra. Carolina Mendes',
    professorId: 'prof-docente-2',
    schedule: '13:30 - 18:00',
    color: '#0d9488',
    totalStudents: 0,
  }
];

export const INITIAL_STUDENTS: Student[] = [];

export const INITIAL_SESSIONS: LabSession[] = [];

export const INITIAL_JUSTIFICATIONS: JustificationRequest[] = [];

export const INITIAL_STUDENT_GRADES: StudentGradeRecord[] = [];
