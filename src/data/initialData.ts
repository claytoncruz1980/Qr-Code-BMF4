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

export const INITIAL_PROFESSORS: Professor[] = [];


export const BMF4_CLASS_IDS = {
  TURMA_A: 'class-bmf4-turmaa',
  TURMA_B: 'class-bmf4-turmab',
} as const;

export const INITIAL_CLASSES: ClassGroup[] = [];

export const INITIAL_STUDENTS: Student[] = [];

export const INITIAL_SESSIONS: LabSession[] = [];

export const INITIAL_JUSTIFICATIONS: JustificationRequest[] = [];

export const INITIAL_STUDENT_GRADES: StudentGradeRecord[] = [];
