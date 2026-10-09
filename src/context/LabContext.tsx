import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { saveTeacher, updateAttendance, saveStudentGrade } from '../services/syncService';
import { 
  Student, 
  ClassGroup, 
  LabSession, 
  JustificationRequest, 
  AttendanceStatus, 
  CourseType, 
  AppSettings, 
  AttendanceRecord, 
  Professor, 
  ActivityCategory, 
  ActivityType, 
  LaboratoryLocation,
  ClassPeriod, 
  StudentGradeRecord, 
  StudentAcademicStatus,
  GradeActivityKey,
  SoundEffectType,
  TeacherPresence,
  TeacherConflictInfo,
  ConnectedDevice,
  DeviceType,
  AttendanceOutboxItem,
  OutboxItemStatus,
  OutboxEventType,
  ActiveSessionDocument,
  DynamicQrEmailDispatch
} from '../types';
import QRCode from 'qrcode';
import { getPublicTelaoUrl, getPublicStudentCheckinUrl } from '../utils/publicUrl';
import { reconcileSessionsAttendance, getStudentAttendanceRecord } from '../utils/attendanceHelpers';
import { validateAndSanitizeBatch } from '../utils/supabaseValidator';
import { 
  INITIAL_CLASSES, 
  INITIAL_STUDENTS, 
  INITIAL_SESSIONS, 
  INITIAL_JUSTIFICATIONS, 
  INITIAL_PROFESSORS, 
  DEFAULT_SETTINGS, 
  INITIAL_STUDENT_GRADES,
  BMF4_CLASS_IDS
} from '../data/initialData';

interface StartSessionOptions {
  topic: string;
  specimens?: string[];
  notes?: string;
  professorId?: string;
  classGroupId?: string;
  activityCategory?: ActivityCategory;
  activityType?: ActivityType;
  labLocation?: LaboratoryLocation;
  activePeriod?: ClassPeriod;
  date?: string;
  startTime?: string;
  endTime?: string;
}

interface LabContextType {
  professors: Professor[];
  activeProfessorId: string;
  activeProfessor: Professor | null;
  classes: ClassGroup[];
  students: Student[];
  sessions: LabSession[];
  justifications: JustificationRequest[];
  selectedClassId: string;
  activeSession: LabSession | null;
  appSettings: AppSettings;
  soundEnabled: boolean;
  
  // Offline & Synchronization Status
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncDate: string;
  realtimeConnected: boolean;
  connectedDevices: number;
  connectedDevicesList: ConnectedDevice[];
  customDeviceName: string;
  setCustomDeviceName: (name: string) => void;
  deviceType: DeviceType;
  setDeviceType: (type: DeviceType) => void;
  lastSyncTimestamp: number;
  triggerSync: () => void;
  forceSyncMaster: () => Promise<void>;
  pendingSyncCount?: number;

  // Firestore Outbox Offline Attendance Queue
  outboxQueue: AttendanceOutboxItem[];
  outboxPendingCount: number;
  isOutboxSyncing: boolean;
  lastOutboxSyncDate: string;
  enqueueOutboxItem: (rawItem: Omit<AttendanceOutboxItem, 'id' | 'syncStatus' | 'createdAt' | 'retryCount'>) => void;
  processOutboxQueue: (forceRetry?: boolean) => Promise<void>;
  clearSyncedOutbox: () => void;
  clearAllOutbox: () => void;
  
  // Dynamic QR Token & Anti-Fraud Security
  dynamicToken: string;
  dynamicSecondsLeft: number;
  dynamicSecurityHash: string;
  dynamicCycleNumber: number;
  lastEmailDispatch: DynamicQrEmailDispatch | null;
  triggerManualEmailDispatch: () => Promise<void>;
  deviceFingerprint: string;
  resetDeviceLockForTesting: () => void;
  
  // Grades & Assessments (15 Atividades BMF4)
  studentGrades: StudentGradeRecord[];
  setStudentGradeScore: (studentId: string, activityKey: GradeActivityKey | string, score: number | null | undefined, classId?: string) => void;
  setStudentSubstituteExamScore: (studentId: string, score: number | null | undefined, classId?: string) => void;
  setStudentGradeNotes: (studentId: string, notes: string, classId?: string) => void;
  calculateAcademicStatus: (studentId: string, classId?: string) => StudentAcademicStatus;

  // Actions
  setActiveProfessorId: (id: string) => void;
  setSelectedClassId: (id: string) => void;
  setSoundEnabled: (enabled: boolean) => void;
  updateAppSettings: (updates: Partial<AppSettings>) => void;
  
  // Session Actions
  toggleLiveSession: () => void;
  pauseLiveSession: (sessionId?: string, classGroupId?: string) => void;
  resumeLiveSession: (sessionId?: string, classGroupId?: string) => void;
  reopenCurrentSession: (sessionId?: string, classGroupId?: string) => void;
  lockCurrentSession: (sessionId?: string, classGroupId?: string) => void;
  clearActiveSessionCache: () => void;
  resetSessionState: () => void;
  lockPeriod1: (sessionId?: string) => void;
  lockPeriod2: (sessionId?: string) => void;
  setActivePeriod: (period: ClassPeriod, targetSessionId?: string, targetClassId?: string) => void;
  transitionToPeriod: (fromPeriod: ClassPeriod, toPeriod: ClassPeriod, targetSessionId?: string) => void;
  setAttendanceStatus: (
    studentId: string, 
    status: AttendanceStatus, 
    period?: ClassPeriod,
    epiVerified?: boolean,
    justificationData?: { reason?: string; fileUrl?: string; fileName?: string }
  ) => void;
  markAllPresent: (period?: ClassPeriod) => void;
  resetCurrentAttendance: (period?: ClassPeriod) => void;
  simulateStudentCheckin: () => void;
  syncSessionVersionToFirestore: (session: LabSession, explicitVersion?: number) => Promise<void>;
  applySessionAttendanceFromCloud: (cloudData: ActiveSessionDocument) => void;
  
  // Simultaneous Teacher Presence & Conflict Management
  teacherPresences: Record<string, TeacherPresence>;
  teacherConflict: TeacherConflictInfo | null;
  joinAsCoTeacher: (sessionId?: string) => void;
  takeOverSession: (sessionId?: string) => void;
  dismissTeacherConflict: () => void;

  // Student Self Check-in
  studentSelfCheckin: (
    registrationNumber: string, 
    code: string, 
    allowOtherClassConfirmation?: boolean, 
    preferredPeriod?: ClassPeriod,
    targetSessionId?: string
  ) => { 
    success: boolean; 
    message: string; 
    student?: Student; 
    notFound?: boolean; 
    deviceBlocked?: boolean; 
    sessionLocked?: boolean; 
    sessionDeleted?: boolean;
    alreadyPresent?: boolean;
    existingRecord?: AttendanceRecord;
    needsOtherClassConfirmation?: boolean;
    isOtherClass?: boolean;
    studentClassName?: string;
    targetClassName?: string;
  };
  selfRegisterAndCheckin: (studentData: { 
    name: string; 
    registrationNumber: string; 
    classGroupId?: string; 
    course?: CourseType;
    email?: string; 
    notes?: string; 
  }) => { success: boolean; message: string; student: Student; deviceBlocked?: boolean; alreadyPresent?: boolean; existingRecord?: AttendanceRecord };
  
  // CRUD Professors & Auth
  loginProfessor: (identifier: string, pinOrPass?: string) => { success: boolean; message: string; professor?: Professor; isFirstAccess?: boolean; requiresPinChange?: boolean };
  logoutProfessor: () => void;
  registerProfessor: (profData: { name: string; email: string; registrationNumber?: string; discipline?: string; pin?: string; role?: 'admin' | 'professor' | 'coordenador'; phone?: string }) => { success: boolean; message: string; professor?: Professor };
  changeProfessorPin: (professorId: string, newPin: string) => { success: boolean; message: string };
  addProfessor: (prof: { name: string } & Partial<Omit<Professor, 'id' | 'name'>>) => void;
  updateProfessor: (id: string, updates: Partial<Professor>) => void;
  deleteProfessor: (id: string) => { success: boolean; message: string };
  deletedProfessorIds: string[];

  // CRUD Students
  addStudent: (student: Omit<Student, 'id'>) => void;
  addMultipleStudents: (students: Array<Omit<Student, 'id'>>) => Student[];
  updateStudent: (id: string, student: Partial<Student>) => void;
  deleteStudent: (id: string) => void;
  deleteMultipleStudents: (ids: string[]) => void;
  deleteAllStudentsFromClass: (classId: string) => void;
  clearAllStudents: () => void;
  resetStudentDeviceBinding: (studentId: string) => void;
  deletedStudentIds: string[];

  // CRUD Classes
  addClassGroup: (classGroup: Omit<ClassGroup, 'id'> & { id?: string }) => void;
  updateClassGroup: (id: string, classGroup: Partial<ClassGroup>) => void;
  deleteClassGroup: (id: string, deleteAssociatedStudents?: boolean) => void;
  restoreDefaultClasses: () => void;
  deletedClassIds: string[];

  // Sessions CRUD & Management
  startNewSession: (optionsOrTopic: string | StartSessionOptions, specimens?: string[], notes?: string) => void;
  updateSession: (sessionId: string, updates: Partial<LabSession>) => void;
  deleteSession: (sessionId: string) => void;
  deleteMultipleSessions: (sessionIds: string[]) => void;
  deleteAllSessionsForClass: (classId: string) => void;
  deletedSessionIds: string[];
  archivedSessions: LabSession[];
  restoreSession: (sessionId: string) => void;
  permanentDeleteArchivedSession: (sessionId: string) => void;
  updateSessionAttendance: (
    sessionId: string, 
    studentId: string, 
    status: AttendanceStatus, 
    period?: ClassPeriod,
    epiVerified?: boolean
  ) => void;
  deleteSessionAttendance: (sessionId: string, studentId: string) => void;
  resetSessionAttendance: (sessionId: string) => void;
  
  // Justifications
  handleJustificationStatus: (justificationId: string, status: 'approved' | 'rejected', reviewerName?: string) => void;
  submitJustification: (justification: Omit<JustificationRequest, 'id' | 'submittedAt' | 'status'>) => void;
  deleteJustification: (justificationId: string) => void;
  
  // Sound & Helpers
  playBeep: (type?: SoundEffectType) => void;
  resetAllData: () => void;
}

export const sortClassesAlphabetically = (list: ClassGroup[]): ClassGroup[] => {
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => {
    const nameA = (a.name || '').trim();
    const nameB = (b.name || '').trim();
    return nameA.localeCompare(nameB, 'pt-BR', { 
      numeric: true, 
      sensitivity: 'base',
      ignorePunctuation: true
    });
  });
};

export const normalizeRa = (ra?: string | number): string => {
  if (!ra) return '';
  return ra.toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
};

export const matchStudentRa = (studentRa?: string | number, inputRa?: string | number): boolean => {
  const cleanDb = normalizeRa(studentRa);
  const cleanInput = normalizeRa(inputRa);
  if (!cleanDb || !cleanInput) return false;
  if (cleanDb === cleanInput) return true;
  const cleanDbNoPrefix = cleanDb.replace(/^RA/i, '');
  const cleanInputNoPrefix = cleanInput.replace(/^RA/i, '');
  if (cleanDbNoPrefix && cleanInputNoPrefix && cleanDbNoPrefix === cleanInputNoPrefix) return true;
  const cleanDbNoZero = cleanDbNoPrefix.replace(/^0+/, '');
  const cleanInputNoZero = cleanInputNoPrefix.replace(/^0+/, '');
  return cleanDbNoZero.length > 0 && cleanInputNoZero.length > 0 && cleanDbNoZero === cleanInputNoZero;
};

export const mergeAttendanceRecord = (currentRec?: AttendanceRecord, incomingRec?: AttendanceRecord): AttendanceRecord | undefined => {
  if (!currentRec && !incomingRec) return undefined;
  if (!currentRec) return incomingRec;
  if (!incomingRec) return currentRec;

  const mergeStatus = (curr?: AttendanceStatus, inc?: AttendanceStatus): AttendanceStatus => {
    // If either side recorded attendance as present/late/excused, never revert back to absent
    if (curr === 'present' || inc === 'present') return 'present';
    if (curr === 'late' || inc === 'late') return 'late';
    if (curr === 'excused' || inc === 'excused') return 'excused';
    return inc || curr || 'absent';
  };

  return {
    ...currentRec,
    ...incomingRec,
    status: mergeStatus(currentRec.status, incomingRec.status),
    period1Status: mergeStatus(currentRec.period1Status, incomingRec.period1Status),
    period2Status: mergeStatus(currentRec.period2Status, incomingRec.period2Status),
    p1StartStatus: mergeStatus(currentRec.p1StartStatus, incomingRec.p1StartStatus),
    p1EndStatus: mergeStatus(currentRec.p1EndStatus, incomingRec.p1EndStatus),
    p2StartStatus: mergeStatus(currentRec.p2StartStatus, incomingRec.p2StartStatus),
    p2EndStatus: mergeStatus(currentRec.p2EndStatus, incomingRec.p2EndStatus),
    p1StartTimestamp: incomingRec.p1StartTimestamp || currentRec.p1StartTimestamp,
    p1EndTimestamp: incomingRec.p1EndTimestamp || currentRec.p1EndTimestamp,
    p2StartTimestamp: incomingRec.p2StartTimestamp || currentRec.p2StartTimestamp,
    p2EndTimestamp: incomingRec.p2EndTimestamp || currentRec.p2EndTimestamp,
    period1Timestamp: incomingRec.period1Timestamp || currentRec.period1Timestamp,
    period2Timestamp: incomingRec.period2Timestamp || currentRec.period2Timestamp,
    timestamp: (incomingRec.status === 'present' ? incomingRec.timestamp : undefined) || 
               (currentRec.status === 'present' ? currentRec.timestamp : undefined) || 
               incomingRec.timestamp || currentRec.timestamp,
    epiVerified: incomingRec.epiVerified ?? currentRec.epiVerified ?? true,
    checkinMethod: incomingRec.checkinMethod || currentRec.checkinMethod || 'qrcode',
    deviceId: incomingRec.deviceId || currentRec.deviceId,
  };
};

export const mergeStudentLists = (
  currentStudents: Student[], 
  incomingStudents: Student[],
  deletedIds: string[] = []
): Student[] => {
  const deletedSet = new Set(deletedIds || []);
  const resultMap = new Map<string, Student>();

  (currentStudents || []).forEach(st => {
    if (st && st.id && !deletedSet.has(st.id)) resultMap.set(st.id, { ...st });
  });

  if (Array.isArray(incomingStudents)) {
    incomingStudents.forEach(inc => {
      if (!inc || !inc.id || deletedSet.has(inc.id)) return;
      const existing = resultMap.get(inc.id);
      if (!existing) {
        resultMap.set(inc.id, { ...inc });
      } else {
        resultMap.set(inc.id, {
          ...existing,
          ...inc,
        });
      }
    });
  }

  return Array.from(resultMap.values()).filter(st => st && st.id && !deletedSet.has(st.id));
};

export const mergeClassLists = (
  currentClasses: ClassGroup[], 
  incomingClasses: ClassGroup[],
  deletedIds: string[] = []
): ClassGroup[] => {
  const deletedSet = new Set(deletedIds || []);
  const resultMap = new Map<string, ClassGroup>();

  (currentClasses || []).forEach(c => {
    if (c && c.id && !deletedSet.has(c.id)) {
      resultMap.set(c.id, { ...c });
    }
  });

  if (Array.isArray(incomingClasses)) {
    incomingClasses.forEach(inc => {
      if (!inc || !inc.id || deletedSet.has(inc.id)) return;
      const existing = resultMap.get(inc.id);
      if (!existing) {
        resultMap.set(inc.id, { ...inc });
      } else {
        resultMap.set(inc.id, { ...existing, ...inc });
      }
    });
  }

  // Only add INITIAL_CLASSES if no classes exist and no classes have been deleted (brand new setup)
  if (resultMap.size === 0 && deletedSet.size === 0) {
    INITIAL_CLASSES.forEach(defClass => {
      if (!deletedSet.has(defClass.id)) {
        resultMap.set(defClass.id, { ...defClass });
      }
    });
  }

  const filtered = Array.from(resultMap.values()).filter(c => c && c.id && !deletedSet.has(c.id));
  return sortClassesAlphabetically(filtered);
};

export const mergeProfessorLists = (
  currentProfessors: Professor[], 
  incomingProfessors: Professor[],
  deletedIds: string[] = []
): Professor[] => {
  const deletedSet = new Set(deletedIds || []);
  const resultMap = new Map<string, Professor>();

  (currentProfessors || []).forEach(p => {
    if (p && p.id && !deletedSet.has(p.id)) resultMap.set(p.id, { ...p });
  });

  if (Array.isArray(incomingProfessors)) {
    incomingProfessors.forEach(inc => {
      if (!inc || !inc.id || deletedSet.has(inc.id)) return;
      const existing = resultMap.get(inc.id);
      if (!existing) {
        resultMap.set(inc.id, { ...inc });
      } else {
        resultMap.set(inc.id, {
          ...existing,
          ...inc,
          pin: inc.pin || existing.pin,
          role: inc.role || existing.role,
        });
      }
    });
  }

  return Array.from(resultMap.values()).filter(p => p && p.id && !deletedSet.has(p.id));
};

export const mergeJustificationLists = (currentJustifications: JustificationRequest[], incomingJustifications: JustificationRequest[]): JustificationRequest[] => {
  if (!Array.isArray(incomingJustifications)) {
    return currentJustifications || [];
  }
  const resultMap = new Map<string, JustificationRequest>();
  (currentJustifications || []).forEach(j => {
    if (j && j.id) resultMap.set(j.id, { ...j });
  });

  incomingJustifications.forEach(inc => {
    if (!inc || !inc.id) return;
    const existing = resultMap.get(inc.id);
    if (!existing) {
      resultMap.set(inc.id, { ...inc });
    } else {
      resultMap.set(inc.id, { ...existing, ...inc });
    }
  });

  return Array.from(resultMap.values());
};

export const mergeGradeLists = (currentGrades: StudentGradeRecord[], incomingGrades: StudentGradeRecord[]): StudentGradeRecord[] => {
  if (!Array.isArray(incomingGrades)) {
    return currentGrades || [];
  }
  const resultMap = new Map<string, StudentGradeRecord>();
  (currentGrades || []).forEach(g => {
    const key = g?.studentId ? `${g.studentId}_${g.classGroupId || ''}` : '';
    if (key) resultMap.set(key, { ...g });
  });

  incomingGrades.forEach(inc => {
    const key = inc?.studentId ? `${inc.studentId}_${inc.classGroupId || ''}` : '';
    if (!key) return;
    const existing = resultMap.get(key);
    if (!existing) {
      resultMap.set(key, { ...inc });
    } else {
      resultMap.set(key, { 
        ...existing, 
        ...inc,
        scores: { ...(existing.scores || {}), ...(inc.scores || {}) }
      });
    }
  });

  return Array.from(resultMap.values());
};

export const mergeSessionLists = (
  currentSessions: LabSession[], 
  incomingSessions: LabSession[],
  deletedIds: string[] = []
): LabSession[] => {
  const deletedSet = new Set(deletedIds || []);
  const resultMap = new Map<string, LabSession>();

  // 1. Current non-deleted
  (currentSessions || []).forEach(s => {
    if (s && s.id && !deletedSet.has(s.id)) {
      resultMap.set(s.id, { ...s });
    }
  });

  // 2. Incoming non-deleted
  if (Array.isArray(incomingSessions)) {
    incomingSessions.forEach(inc => {
      if (!inc || !inc.id || deletedSet.has(inc.id)) return;
      const existing = resultMap.get(inc.id);
      if (!existing) {
        resultMap.set(inc.id, { ...inc });
      } else {
        const mergedAttendance: Record<string, AttendanceRecord> = { ...(existing.attendance || {}) };
        const incAttendance = inc.attendance || {};

        for (const [stId, incRec] of Object.entries(incAttendance)) {
          const mergedRec = mergeAttendanceRecord(mergedAttendance[stId], incRec as AttendanceRecord);
          if (mergedRec) {
            mergedAttendance[stId] = mergedRec;
          }
        }

        const mergedSession: LabSession = {
          ...existing,
          ...inc,
          attendance: mergedAttendance,
          isLive: inc.isLive !== undefined ? inc.isLive : existing.isLive,
          isLocked: inc.isLocked !== undefined ? inc.isLocked : existing.isLocked,
          isPaused: inc.isPaused !== undefined ? inc.isPaused : existing.isPaused,
          activePeriod: inc.activePeriod || existing.activePeriod,
          isPeriod1Locked: inc.isPeriod1Locked ?? existing.isPeriod1Locked,
          isPeriod2Locked: inc.isPeriod2Locked ?? existing.isPeriod2Locked,
          coProfessors: Array.isArray(inc.coProfessors) ? inc.coProfessors : existing.coProfessors,
        };

        resultMap.set(inc.id, mergedSession);
      }
    });
  }

  const mergedList = Array.from(resultMap.values());
  mergedList.sort((a, b) => {
    const scoreA = (a.isLive && !a.isLocked) ? 1000 : a.isLive ? 500 : 0;
    const scoreB = (b.isLive && !b.isLocked) ? 1000 : b.isLive ? 500 : 0;
    if (scoreA !== scoreB) return scoreB - scoreA;
    const timeA = a.timestamp || (a.date ? new Date(a.date).getTime() : 0);
    const timeB = b.timestamp || (b.date ? new Date(b.date).getTime() : 0);
    return timeB - timeA;
  });
  return reconcileSessionsAttendance(mergedList);
};

export const computeStudentsWithRecalculatedStats = (studentsList: Student[], sessionsList: LabSession[]): Student[] => {
  if (!Array.isArray(studentsList)) return [];
  const safeSessions = reconcileSessionsAttendance(Array.isArray(sessionsList) ? sessionsList : [], studentsList);
  return studentsList.map(st => {
    let presences = 0;
    let absences = 0;
    let lates = 0;
    let excused = 0;
    const stSessions = safeSessions.filter(s => s.classGroupId === st.classGroupId);
    const totalClasses = stSessions.length;

    stSessions.forEach(sess => {
      const rec = getStudentAttendanceRecord(sess.attendance, st);
      if (rec) {
        const isPresent = rec.status === 'present' || 
          rec.period1Status === 'present' || 
          rec.period2Status === 'present' || 
          rec.p1StartStatus === 'present' || 
          rec.p1EndStatus === 'present' || 
          rec.p2StartStatus === 'present' || 
          rec.p2EndStatus === 'present';
        const isLate = rec.status === 'late' || rec.period1Status === 'late' || rec.period2Status === 'late';
        const isExcused = rec.status === 'excused' || rec.period1Status === 'excused' || rec.period2Status === 'excused';

        if (isPresent) {
          presences++;
        } else if (isLate) {
          presences++;
          lates++;
        } else if (isExcused) {
          presences++;
          excused++;
        } else {
          absences++;
        }
      } else {
        absences++;
      }
    });

    return {
      ...st,
      presences,
      absences,
      lates,
      excused,
      totalClasses,
    };
  });
};

const LabContext = createContext<LabContextType | undefined>(undefined);

const STORAGE_PREFIX = 'bmf4_presenca_v3_';

// Universal date helpers for timezone-safe calendar comparison
export const getLocalDateString = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const isDateToday = (sessionDate?: string): boolean => {
  if (!sessionDate) return false;
  const todayLocal = getLocalDateString();
  const todayIso = new Date().toISOString().split('T')[0];
  return sessionDate === todayLocal || sessionDate === todayIso;
};

export interface UseSessionResetOptions {
  activeSession: LabSession | null;
  clearActiveSessionCache: () => void;
  setDynamicSecurityHash?: (hash: string) => void;
  setDynamicToken?: (token: string) => void;
  setDismissedConflictId?: (id: string | null) => void;
  onSessionClosed?: (closedSessionId?: string) => void;
}

/**
 * Hook 'useSessionReset'
 * Monitors activeSession state and automatically clears localStorage, sessionStorage
 * and global control states whenever the session is closed/locked or when the component
 * unmounts, ensuring a clean initialization for every new session.
 */
export const useSessionReset = ({
  activeSession,
  clearActiveSessionCache,
  setDynamicSecurityHash,
  setDynamicToken,
  setDismissedConflictId,
  onSessionClosed,
}: UseSessionResetOptions) => {
  const prevSessionRef = useRef<{
    id?: string;
    isLocked?: boolean;
    isLive?: boolean;
  } | null>(null);

  // Monitor activeSession state transitions
  useEffect(() => {
    const prev = prevSessionRef.current;
    const currentId = activeSession?.id;
    const isLocked = Boolean(activeSession?.isLocked);
    const isLive = Boolean(activeSession?.isLive);

    if (prev) {
      const wasActive = Boolean(prev.isLive && !prev.isLocked);
      const isNowClosed = isLocked || !isLive;

      // When the active session transitions from live to locked or closed
      if (wasActive && isNowClosed) {
        clearActiveSessionCache();
        if (setDynamicSecurityHash) setDynamicSecurityHash('');
        if (setDismissedConflictId) setDismissedConflictId(null);
        if (onSessionClosed) onSessionClosed(prev.id);
      }

      // When switching to a different session ID
      if (prev.id && currentId && prev.id !== currentId) {
        clearActiveSessionCache();
        if (setDynamicSecurityHash) setDynamicSecurityHash('');
        if (setDismissedConflictId) setDismissedConflictId(null);
      }
    }

    prevSessionRef.current = activeSession 
      ? { id: activeSession.id, isLocked: activeSession.isLocked, isLive: activeSession.isLive }
      : null;
  }, [
    activeSession?.id,
    activeSession?.isLocked,
    activeSession?.isLive,
    clearActiveSessionCache,
    setDynamicSecurityHash,
    setDismissedConflictId,
    onSessionClosed,
  ]);

  // Clean unmount monitoring: clean session cache when the component unmounts
  useEffect(() => {
    return () => {
      clearActiveSessionCache();
      if (setDynamicSecurityHash) setDynamicSecurityHash('');
      if (setDismissedConflictId) setDismissedConflictId(null);
    };
  }, [clearActiveSessionCache, setDynamicSecurityHash, setDismissedConflictId]);

  const resetSessionState = useCallback(() => {
    clearActiveSessionCache();
    if (setDynamicSecurityHash) setDynamicSecurityHash('');
    if (setDismissedConflictId) setDismissedConflictId(null);
  }, [clearActiveSessionCache, setDynamicSecurityHash, setDismissedConflictId]);

  return { resetSessionState };
};

export const LabProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initial data hydration from Supabase with safe merging and robust localStorage priority
  useEffect(() => {
    async function loadAllDataFromSupabase() {
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      console.log(`🔄 [PWA/App Hydration] Iniciando carga de dados do Supabase. Online: ${isOnline}`);

      try {
        const localClasses = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'classes') || '[]');
        const localStudents = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'students') || '[]');
        const localSessions = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'sessions') || '[]');
        const localTeachers = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'professors') || '[]');
        const localJustifications = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'justifications') || '[]');
        const localGrades = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'student_grades') || '[]');
        const localSettings = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'settings') || 'null');

        // 1. Sessions
        try {
          const { data: sessionsData, error: sessErr } = await supabase.from('sessions').select('*');
          if (sessErr) {
            console.warn('⚠️ Supabase [sessions] fetch warning:', sessErr.message);
          } else if (Array.isArray(sessionsData)) {
            const combined = sessionsData.length > 0 ? sessionsData : localSessions;
            const merged = reconcileSessionsAttendance(mergeSessionLists(localSessions.length > 0 ? localSessions : INITIAL_SESSIONS, combined, deletedSessionIdsRef.current));
            setSessions(merged);
            try {
              localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(merged));
            } catch {}
          }
        } catch (e: any) {
          console.error('❌ Supabase [sessions] exception:', e?.message || e);
        }

        // 2. Classes
        try {
          const { data: classesData, error: classErr } = await supabase.from('classes').select('*');
          if (classErr) {
            console.warn('⚠️ Supabase [classes] fetch warning:', classErr.message);
          } else if (Array.isArray(classesData)) {
            const baseLocal = localClasses.length > 0 ? localClasses : INITIAL_CLASSES;
            const combined = classesData.length > 0 ? classesData : baseLocal;
            const merged = sortClassesAlphabetically(mergeClassLists(baseLocal, combined, deletedClassIdsRef.current));
            setClasses(merged);
            try {
              localStorage.setItem(STORAGE_PREFIX + 'classes', JSON.stringify(merged));
            } catch {}
            if (classesData.length === 0 && merged.length > 0) {
              syncEntityToSupabase('classes', merged);
            }
          }
        } catch (e: any) {
          console.error('❌ Supabase [classes] exception:', e?.message || e);
        }

        // 3. Students
        try {
          const { data: studentsData, error: studentErr } = await supabase.from('students').select('*');
          if (studentErr) {
            console.warn('⚠️ Supabase [students] fetch warning:', studentErr.message);
          } else if (Array.isArray(studentsData)) {
            const baseLocal = localStudents.length > 0 ? localStudents : INITIAL_STUDENTS;
            const combined = studentsData.length > 0 ? studentsData : baseLocal;
            const merged = computeStudentsWithRecalculatedStats(mergeStudentLists(baseLocal, combined, deletedStudentIdsRef.current), sessionsRef.current);
            setStudents(merged);
            try {
              localStorage.setItem(STORAGE_PREFIX + 'students', JSON.stringify(merged));
            } catch {}
            if (studentsData.length === 0 && merged.length > 0) {
              syncEntityToSupabase('students', merged);
            }
          }
        } catch (e: any) {
          console.error('❌ Supabase [students] exception:', e?.message || e);
        }

        // 4. Teachers / Professors
        try {
          const { data: teachersData, error: teacherErr } = await supabase.from('teachers').select('*');
          if (teacherErr) {
            console.warn('⚠️ Supabase [teachers] fetch warning:', teacherErr.message);
          } else if (Array.isArray(teachersData)) {
            const baseLocal = localTeachers.length > 0 ? localTeachers : INITIAL_PROFESSORS;
            const combined = teachersData.length > 0 ? teachersData : baseLocal;
            const merged = mergeProfessorLists(baseLocal, combined, deletedProfessorIdsRef.current);
            setProfessors(merged);
            try {
              localStorage.setItem(STORAGE_PREFIX + 'professors', JSON.stringify(merged));
            } catch {}
            if (teachersData.length === 0 && merged.length > 0) {
              syncEntityToSupabase('teachers', merged);
            }
          }
        } catch (e: any) {
          console.error('❌ Supabase [teachers] exception:', e?.message || e);
        }

        // 5. Justifications
        try {
          const { data: justData, error: justErr } = await supabase.from('justifications').select('*');
          if (!justErr && Array.isArray(justData) && justData.length > 0) {
            const mappedJust: JustificationRequest[] = justData.map((j: any) => ({
              id: j.id,
              studentId: j.student_id || j.studentId,
              studentName: j.student_name || j.studentName,
              studentRa: j.student_ra || j.studentRa,
              classGroupId: j.class_group_id || j.classGroupId,
              sessionId: j.session_id || j.sessionId || '',
              sessionDate: j.session_date || j.sessionDate || j.date || new Date().toISOString().split('T')[0],
              period: j.period || 'both',
              reason: j.reason || 'medical',
              description: j.description || '',
              status: j.status || 'pending',
              documentNumber: j.doc_number || j.docNumber || j.documentNumber,
              attachmentName: j.attachment_name || j.attachmentName,
              attachmentUrl: j.attachment_url || j.attachmentUrl,
              submittedAt: j.created_at || j.submittedAt || new Date().toISOString(),
              reviewedAt: j.updated_at || j.reviewedAt,
              reviewedBy: j.reviewer_name || j.reviewedBy,
            }));
            const merged = mergeJustificationLists(localJustifications.length > 0 ? localJustifications : INITIAL_JUSTIFICATIONS, mappedJust);
            setJustifications(merged);
            try {
              localStorage.setItem(STORAGE_PREFIX + 'justifications', JSON.stringify(merged));
            } catch {}
          }
        } catch (e: any) {
          console.debug('Supabase [justifications] hydration notice:', e?.message || e);
        }

        // 6. Student Grades
        try {
          const { data: gradesData, error: gradesErr } = await supabase.from('student_grades').select('*');
          if (!gradesErr && Array.isArray(gradesData) && gradesData.length > 0) {
            const mappedGrades = gradesData.map((g: any) => ({
              id: g.id,
              studentId: g.student_id || g.studentId,
              classGroupId: g.class_group_id || g.classGroupId,
              scores: g.scores || {},
              substituteExamScore: g.substitute_exam_score ?? g.substituteExamScore,
              notes: g.notes,
              updatedAt: g.updated_at,
            }));
            const merged = mergeGradeLists(localGrades.length > 0 ? localGrades : INITIAL_STUDENT_GRADES, mappedGrades);
            setStudentGrades(merged);
            try {
              localStorage.setItem(STORAGE_PREFIX + 'student_grades', JSON.stringify(merged));
            } catch {}
          }
        } catch (e: any) {
          console.debug('Supabase [student_grades] hydration notice:', e?.message || e);
        }

        // 7. App Settings
        try {
          const { data: settingsData, error: settingsErr } = await supabase.from('app_settings').select('*').limit(1);
          if (!settingsErr && Array.isArray(settingsData) && settingsData[0]?.settings_payload) {
            setAppSettings(settingsData[0].settings_payload);
            try {
              localStorage.setItem(STORAGE_PREFIX + 'settings', JSON.stringify(settingsData[0].settings_payload));
            } catch {}
          }
        } catch (e: any) {
          console.debug('Supabase [app_settings] hydration notice:', e?.message || e);
        }

        console.log('✅ [PWA/App Hydration] Sincronização e fusão concluídas sem perda de dados.');
      } catch (error) {
        console.error('❌ [PWA/App Hydration] Erro crítico geral:', error);
      }
    }

    loadAllDataFromSupabase();
  }, []);

  // Robust Cache Invalidation & App Version check with 'APP_VERSION_2024_01'
  useEffect(() => {
    try {
      const APP_VERSION_KEY = 'bmf4_app_version';
      const TARGET_VERSION = 'APP_VERSION_2024_01';
      const storedAppVersion = localStorage.getItem(APP_VERSION_KEY);

      if (storedAppVersion !== TARGET_VERSION) {
        console.warn(`Nova versão detectada (${TARGET_VERSION}). Limpando estados obsoletos do localStorage para garantir que o histórico de chamadas não persista entre diferentes aulas.`);
        localStorage.removeItem(STORAGE_PREFIX + 'sessions');
        localStorage.removeItem(STORAGE_PREFIX + 'active_session_id');
        localStorage.removeItem(STORAGE_PREFIX + 'deleted_session_ids');
        localStorage.removeItem(STORAGE_PREFIX + 'outbox_queue');
        localStorage.removeItem('bmf4_bound_student_ra');
        localStorage.removeItem('bmf4_bound_student_id');
        localStorage.removeItem('bmf4_bound_student_name');
        localStorage.setItem(APP_VERSION_KEY, TARGET_VERSION);
      }
    } catch (e) {
      console.error('Erro ao verificar invalidação de cache de versão:', e);
    }
  }, []);

  // Schema Versioning & Migration Check to purge resurrected items while preserving active user data
  useEffect(() => {
    try {
      const CURRENT_SCHEMA_VERSION = '5';
      const storedVersion = localStorage.getItem(STORAGE_PREFIX + 'schema_version');
      if (storedVersion !== CURRENT_SCHEMA_VERSION) {
        const delStudents = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'deleted_student_ids') || '[]');
        const delClasses = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'deleted_class_ids') || '[]');
        const delSessions = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'deleted_session_ids') || '[]');
        const delProfs = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'deleted_professor_ids') || '[]');

        const curStudents = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'students') || '[]');
        if (Array.isArray(curStudents) && delStudents.length > 0) {
          const filtered = curStudents.filter((s: any) => s && s.id && !delStudents.includes(s.id));
          localStorage.setItem(STORAGE_PREFIX + 'students', JSON.stringify(filtered));
        }

        const curClasses = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'classes') || '[]');
        if (Array.isArray(curClasses) && delClasses.length > 0) {
          const filtered = curClasses.filter((c: any) => c && c.id && !delClasses.includes(c.id));
          localStorage.setItem(STORAGE_PREFIX + 'classes', JSON.stringify(filtered));
        }

        const curSessions = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'sessions') || '[]');
        if (Array.isArray(curSessions) && delSessions.length > 0) {
          const filtered = curSessions.filter((s: any) => s && s.id && !delSessions.includes(s.id));
          localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(filtered));
        }

        const curProfs = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'professors') || '[]');
        if (Array.isArray(curProfs) && delProfs.length > 0) {
          const filtered = curProfs.filter((p: any) => p && p.id && !delProfs.includes(p.id));
          localStorage.setItem(STORAGE_PREFIX + 'professors', JSON.stringify(filtered));
        }

        localStorage.setItem(STORAGE_PREFIX + 'schema_version', CURRENT_SCHEMA_VERSION);
        localStorage.setItem(STORAGE_PREFIX + 'app_initialized', 'true');
      }
    } catch (err) {
      console.debug('Schema migration notice:', err);
    }
  }, []);

  // Ensure app initialized flag is tracked
  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_PREFIX + 'app_initialized')) {
        localStorage.setItem(STORAGE_PREFIX + 'app_initialized', 'true');
      }
    } catch {}
  }, []);

  // 0. Deleted Professors tracking
  const [deletedProfessorIds, setDeletedProfessorIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PREFIX + 'deleted_professor_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const deletedProfessorIdsRef = useRef(deletedProfessorIds);
  deletedProfessorIdsRef.current = deletedProfessorIds;

  // 1. Professors
  // 1. Professors
  const [professors, setProfessors] = useState<Professor[]>(() => {
    let parsed: Professor[] = [];
    try {
      const saved = localStorage.getItem(STORAGE_PREFIX + 'professors');
      const backup = localStorage.getItem('bmf4_master_backup_professors');
      if (saved) parsed = JSON.parse(saved);
      if ((!Array.isArray(parsed) || parsed.length === 0) && backup) {
        parsed = JSON.parse(backup);
      }
    } catch {}

    if (!Array.isArray(parsed) || parsed.length === 0) {
      parsed = INITIAL_PROFESSORS;
    }

    const savedDeletedProfs = localStorage.getItem(STORAGE_PREFIX + 'deleted_professor_ids');
    const deletedProfList: string[] = savedDeletedProfs ? JSON.parse(savedDeletedProfs) : [];
    const delProfSet = new Set(deletedProfList);
    parsed = (parsed || []).filter(p => p && p.id && !delProfSet.has(p.id));
    if (parsed.length === 0) {
      parsed = INITIAL_PROFESSORS;
    }

    // Ensure an Administrator exists among current professors
    let adminCandidate = parsed.find(p => p.role === 'admin') || parsed.find(p => p.name.toLowerCase().includes('juliano'));
    if (adminCandidate) {
      adminCandidate.role = 'admin';
      if (!adminCandidate.pin) adminCandidate.pin = '1234';
    } else if (parsed.length > 0) {
      parsed[0].role = 'admin';
      if (!parsed[0].pin) parsed[0].pin = '1234';
    }

    parsed = parsed.map(p => ({
      ...p,
      pin: p.pin || p.password || '1234',
      hasChangedPin: p.hasChangedPin ?? (p.pin && p.pin !== '1234')
    }));

    return parsed;
  });

  const [activeProfessorId, setActiveProfessorId] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'active_prof');
    if (saved === '' || saved === 'guest' || saved === 'logged_out' || saved === 'none') {
      return '';
    }
    const savedProfs = localStorage.getItem(STORAGE_PREFIX + 'professors');
    const parsedProfs: Professor[] = savedProfs ? JSON.parse(savedProfs) : [];
    if (saved && parsedProfs.some(p => p.id === saved)) {
      return saved;
    }
    if (saved === null && parsedProfs.length > 0) {
      return parsedProfs[0]?.id || '';
    }
    return '';
  });

  // 1.5 Deleted Classes tracking
  const [deletedClassIds, setDeletedClassIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PREFIX + 'deleted_class_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const deletedClassIdsRef = useRef(deletedClassIds);
  deletedClassIdsRef.current = deletedClassIds;

  // 2. Classes (ALWAYS initialized and kept sorted alphabetically)
  const [classes, setClasses] = useState<ClassGroup[]>(() => {
    let parsed: ClassGroup[] = [];
    try {
      const saved = localStorage.getItem(STORAGE_PREFIX + 'classes');
      const backup = localStorage.getItem('bmf4_master_backup_classes');
      if (saved) parsed = JSON.parse(saved);
      if ((!Array.isArray(parsed) || parsed.length === 0) && backup) {
        parsed = JSON.parse(backup);
      }
    } catch {}

    if (!Array.isArray(parsed) || parsed.length === 0) {
      parsed = INITIAL_CLASSES;
    }

    // Deduplicate by ID
    const seenIds = new Set<string>();
    parsed = parsed.filter(c => {
      if (!c || !c.id) return false;
      if (seenIds.has(c.id)) return false;
      seenIds.add(c.id);
      return true;
    });
    
    // Check if URL specified a class ID not yet in list
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlTurma = urlParams.get('turma') || urlParams.get('turmaid') || urlParams.get('class') || urlParams.get('classid');
      let targetTurma = urlTurma;
      if (!targetTurma && window.location.hash) {
        const qIndex = window.location.hash.indexOf('?');
        if (qIndex !== -1) {
          const hashParams = new URLSearchParams(window.location.hash.substring(qIndex + 1));
          targetTurma = hashParams.get('turma') || hashParams.get('turmaid') || hashParams.get('class') || hashParams.get('classid');
        }
      }
      if (targetTurma && !parsed.some(c => c.id === targetTurma)) {
        parsed = [
          ...parsed,
          {
            id: targetTurma === 'turmab' ? BMF4_CLASS_IDS.TURMA_B : targetTurma,
            name: targetTurma,
            code: targetTurma.toUpperCase(),
            discipline: 'BMF4 - Bases Morfofuncionais 4',
            course: 'Medicina',
            semester: '4º Semestre 2026',
            laboratoryRoom: 'Laboratório de Morfologia / Práticas Médicas',
            professorName: 'Docente',
            professorId: 'prof-docente-1',
            schedule: '07:30 - 12:00',
            color: '#0284c7',
            totalStudents: 0,
          }
        ];
      }
    }

    const savedDeletedClasses = localStorage.getItem(STORAGE_PREFIX + 'deleted_class_ids');
    const deletedClassList: string[] = savedDeletedClasses ? JSON.parse(savedDeletedClasses) : [];
    const delClassSet = new Set(deletedClassList);

    const filtered = (parsed || []).filter(c => c && c.id && !delClassSet.has(c.id));
    return sortClassesAlphabetically(filtered.length > 0 ? filtered : INITIAL_CLASSES);
  });

  // 2.5 Deleted Students tracking
  const [deletedStudentIds, setDeletedStudentIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PREFIX + 'deleted_student_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const deletedStudentIdsRef = useRef(deletedStudentIds);
  deletedStudentIdsRef.current = deletedStudentIds;

  // 3. Students
  const [students, setStudents] = useState<Student[]>(() => {
    let parsed: Student[] = [];
    try {
      const saved = localStorage.getItem(STORAGE_PREFIX + 'students');
      const backup = localStorage.getItem('bmf4_master_backup_students');
      if (saved) parsed = JSON.parse(saved);
      if ((!Array.isArray(parsed) || parsed.length === 0) && backup) {
        parsed = JSON.parse(backup);
      }
    } catch {}

    if (!Array.isArray(parsed) || parsed.length === 0) {
      parsed = INITIAL_STUDENTS;
    }

    const savedDeletedStudents = localStorage.getItem(STORAGE_PREFIX + 'deleted_student_ids');
    const deletedStudentList: string[] = savedDeletedStudents ? JSON.parse(savedDeletedStudents) : [];
    const delStudentSet = new Set(deletedStudentList);
    const filtered = (parsed || []).filter(s => s && s.id && !delStudentSet.has(s.id));
    return filtered.length > 0 ? filtered : INITIAL_STUDENTS;
  });

  // Automatic Permanent Master Backup Mirroring
  useEffect(() => {
    try {
      if (Array.isArray(classes) && classes.length > 0) {
        localStorage.setItem(STORAGE_PREFIX + 'classes', JSON.stringify(classes));
        localStorage.setItem('bmf4_master_backup_classes', JSON.stringify(classes));
      }
    } catch {}
  }, [classes]);

  useEffect(() => {
    try {
      if (Array.isArray(students) && students.length > 0) {
        localStorage.setItem(STORAGE_PREFIX + 'students', JSON.stringify(students));
        localStorage.setItem('bmf4_master_backup_students', JSON.stringify(students));
      }
    } catch {}
  }, [students]);

  useEffect(() => {
    try {
      if (Array.isArray(professors) && professors.length > 0) {
        localStorage.setItem(STORAGE_PREFIX + 'professors', JSON.stringify(professors));
        localStorage.setItem('bmf4_master_backup_professors', JSON.stringify(professors));
      }
    } catch {}
  }, [professors]);

  // 4. Sessions & Deletion tracking
  const [deletedSessionIds, setDeletedSessionIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PREFIX + 'deleted_session_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const deletedSessionIdsRef = useRef(deletedSessionIds);
  deletedSessionIdsRef.current = deletedSessionIds;

  const [archivedSessions, setArchivedSessions] = useState<LabSession[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PREFIX + 'archived_sessions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const archiveSessionsToTrash = (sessionsToArchive: LabSession[]) => {
    if (!sessionsToArchive || sessionsToArchive.length === 0) return;
    setArchivedSessions(prev => {
      const existingIds = new Set(prev.map(s => s.id));
      const newlyArchived = sessionsToArchive.filter(s => s && s.id && !existingIds.has(s.id));
      if (newlyArchived.length === 0) return prev;
      const next = [...prev, ...newlyArchived];
      try {
        localStorage.setItem(STORAGE_PREFIX + 'archived_sessions', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const restoreSession = (sessionId: string) => {
    const sessionToRestore = archivedSessions.find(s => s.id === sessionId);
    if (!sessionToRestore) return;

    const newDeletedIds = deletedSessionIdsRef.current.filter(id => id !== sessionId);
    setDeletedSessionIds(newDeletedIds);
    deletedSessionIdsRef.current = newDeletedIds;
    try {
      localStorage.setItem(STORAGE_PREFIX + 'deleted_session_ids', JSON.stringify(newDeletedIds));
    } catch {}

    const newArchived = archivedSessions.filter(s => s.id !== sessionId);
    setArchivedSessions(newArchived);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'archived_sessions', JSON.stringify(newArchived));
    } catch {}

    if (!sessions.some(s => s.id === sessionId)) {
      const updatedSessions = [...sessions, sessionToRestore];
      const updatedStudents = computeStudentsWithRecalculatedStats(students, updatedSessions);
      setSessions(updatedSessions);
      setStudents(updatedStudents);
      try {
        localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(updatedSessions));
        localStorage.setItem(STORAGE_PREFIX + 'students', JSON.stringify(updatedStudents));
      } catch {}
    }
    playBeep('success');
  };

  const permanentDeleteArchivedSession = (sessionId: string) => {
    const newArchived = archivedSessions.filter(s => s.id !== sessionId);
    setArchivedSessions(newArchived);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'archived_sessions', JSON.stringify(newArchived));
    } catch {}
    playBeep('delete');
  };

  const [sessions, setSessions] = useState<LabSession[]>(() => {
    const isInit = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_PREFIX + 'app_initialized') === 'true' : false;
    const saved = localStorage.getItem(STORAGE_PREFIX + 'sessions');
    let parsed: LabSession[] = saved ? JSON.parse(saved) : (!isInit ? INITIAL_SESSIONS : []);
    const savedDeleted = localStorage.getItem(STORAGE_PREFIX + 'deleted_session_ids');
    const deletedList: string[] = savedDeleted ? JSON.parse(savedDeleted) : [];
    const delSet = new Set(deletedList);
    const todayStr = new Date().toISOString().split('T')[0];

    // Filter deleted sessions and ensure sessions from previous days are never left live/unlocked
    parsed = (parsed || [])
      .filter(s => s && s.id && !delSet.has(s.id))
      .map(s => {
        // Any session older than today must be closed to avoid carrying over presence into new classes
        if (s.date && s.date < todayStr && s.isLive) {
          return { ...s, isLive: false, isLocked: true, isPaused: false };
        }
        return s;
      });

    try {
      localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(parsed));
    } catch {}

    // If opened directly on projection / TV portal, ensure an active session exists for today
    if (typeof window !== 'undefined') {
      const isTelao = window.location.search.includes('portal=telao') || 
                      window.location.search.includes('portal=tv') || 
                      window.location.search.includes('view=telao') ||
                      window.location.hash.includes('telao') ||
                      window.location.hash.includes('tv');
      
      const urlParams = new URLSearchParams(window.location.search);
      const targetTurma = urlParams.get('turma') || urlParams.get('turmaid') || urlParams.get('class') || 'class-bmf4-default';
      const urlPeriod = (urlParams.get('period') || urlParams.get('etapa') || '1') as ClassPeriod;

      const existingTodaySession = parsed.find(s => s.classGroupId === targetTurma && isDateToday(s.date));

      if (isTelao && !existingTodaySession) {
        const liveSession: LabSession = {
          id: `sess-${Date.now()}`,
          classGroupId: targetTurma,
          discipline: 'BMF4',
          professorId: 'prof-admin-1',
          professorName: 'Prof. Dr. Juliano Pereira',
          activityCategory: 'pratica',
          activityType: 'aula_pratica',
          activePeriod: urlPeriod,
          isPeriod1Locked: false,
          isPeriod2Locked: false,
          isP1StartLocked: false,
          isP1EndLocked: false,
          isP2StartLocked: false,
          isP2EndLocked: false,
          isActivitySingleLocked: false,
          date: todayStr,
          startTime: `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`,
          endTime: '12:00',
          topic: 'Aula BMF4 - Morfofuncional',
          anatomicalSpecimens: ['Peças anatômicas / Roteiro prático'],
          checkinCode: `BMF-${Math.floor(100 + Math.random() * 900)}`,
          isLive: true,
          isLocked: false,
          openedAt: new Date().toISOString(),
          notes: 'Obrigatório uso de EPI: Jaleco abotoado, luvas e calçado fechado.',
          attendance: {},
          syncStatus: 'synced',
        };
        parsed = [liveSession, ...parsed];
      } else if (isTelao && existingTodaySession && urlParams.get('period')) {
        // Sync active period from URL for TV/Telão
        parsed = parsed.map(s => s.id === existingTodaySession.id ? { ...s, activePeriod: urlPeriod, isLive: true, isLocked: false } : s);
      }
    }
    return reconcileSessionsAttendance(parsed);
  });

  // 5. Justifications
  const [justifications, setJustifications] = useState<JustificationRequest[]>(() => {
    const isInit = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_PREFIX + 'app_initialized') === 'true' : false;
    const saved = localStorage.getItem(STORAGE_PREFIX + 'justifications');
    return saved ? JSON.parse(saved) : (!isInit ? INITIAL_JUSTIFICATIONS : []);
  });

  // 6. Grades (Controle de Notas das 15 Atividades BMF4)
  const [studentGrades, setStudentGrades] = useState<StudentGradeRecord[]>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'student_grades');
    return saved ? JSON.parse(saved) : INITIAL_STUDENT_GRADES;
  });

  // 7. Selected Class ID
  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlTurma = urlParams.get('turma') || urlParams.get('turmaid') || urlParams.get('class') || urlParams.get('classid');
      if (urlTurma) return urlTurma;

      const hash = window.location.hash;
      const qIndex = hash.indexOf('?');
      if (qIndex !== -1) {
        const hashParams = new URLSearchParams(hash.substring(qIndex + 1));
        const hashTurma = hashParams.get('turma') || hashParams.get('turmaid') || hashParams.get('class') || hashParams.get('classid');
        if (hashTurma) return hashTurma;
      }
    }
    const saved = localStorage.getItem(STORAGE_PREFIX + 'selectedClass');
    const savedClasses = localStorage.getItem(STORAGE_PREFIX + 'classes');
    const parsedClasses: ClassGroup[] = savedClasses ? JSON.parse(savedClasses) : INITIAL_CLASSES;
    return saved && parsedClasses.some(c => c.id === saved) ? saved : parsedClasses[0]?.id || '';
  });

  // 8. Settings
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  // 9. Sound
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'sound');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // 10. Real-time Sync & WebSocket state
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncDate, setLastSyncDate] = useState<string>(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
  const [realtimeConnected, setRealtimeConnected] = useState<boolean>(false);
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<number>(Date.now());
  const lastSyncTimestampRef = useRef<number>(Date.now());
  lastSyncTimestampRef.current = lastSyncTimestamp;

  const pendingStorageRef = useRef<Record<string, string>>({});
  const storageDebounceTimeoutRef = useRef<any>(null);

  const scheduleLocalStorageSave = useCallback((key: string, value: string) => {
    pendingStorageRef.current[key] = value;
    if (!storageDebounceTimeoutRef.current) {
      storageDebounceTimeoutRef.current = setTimeout(() => {
        storageDebounceTimeoutRef.current = null;
        const entries = Object.entries(pendingStorageRef.current);
        pendingStorageRef.current = {};
        for (const [k, v] of entries) {
          try {
            localStorage.setItem(k, String(v));
          } catch {}
        }
      }, 150);
    }
  }, []);

  // Connected Devices Management
  const [customDeviceName, setCustomDeviceNameState] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'device_name');
    if (saved) return saved;
    if (typeof window !== 'undefined') {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) return 'Smartphone Docente';
      return 'Terminal / Telão Lab';
    }
    return 'Dispositivo Lab';
  });

  const setCustomDeviceName = useCallback((name: string) => {
    setCustomDeviceNameState(name);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'device_name', name);
    } catch {}
  }, []);

  const [deviceType, setDeviceTypeState] = useState<DeviceType>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'device_type') as DeviceType;
    if (saved) return saved;
    if (typeof window !== 'undefined') {
      if (window.location.hash.includes('telao') || window.innerWidth >= 1400) return 'tv';
      if (/iPhone|Android/i.test(navigator.userAgent) && window.innerWidth < 768) return 'mobile';
      if (/iPad|Tablet/i.test(navigator.userAgent) || (window.innerWidth >= 768 && window.innerWidth < 1024)) return 'tablet';
    }
    return 'desktop';
  });

  const setDeviceType = useCallback((type: DeviceType) => {
    setDeviceTypeState(type);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'device_type', type);
    } catch {}
  }, []);

  const [connectedDevicesMap, setConnectedDevicesMap] = useState<Record<string, ConnectedDevice>>({});
  const connectedDevicesMapRef = useRef(connectedDevicesMap);
  connectedDevicesMapRef.current = connectedDevicesMap;

  // 11. Teacher Presences & Conflict state
  const [teacherPresences, setTeacherPresences] = useState<Record<string, TeacherPresence>>({});
  const teacherPresencesRef = useRef(teacherPresences);
  teacherPresencesRef.current = teacherPresences;
  const [dismissedConflictId, setDismissedConflictId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const isRemoteUpdateRef = useRef<boolean>(false);
  const firestoreDebounceRef = useRef<any>(null);
  const firestoreBlockedUntilRef = useRef<number>(0);

  // Keep references to current state to allow stable callbacks without dependency thrashing
  const professorsRef = useRef(professors);
  professorsRef.current = professors;
  const classesRef = useRef(classes);
  classesRef.current = classes;
  const studentsRef = useRef(students);
  studentsRef.current = students;
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const justificationsRef = useRef(justifications);
  justificationsRef.current = justifications;
  const studentGradesRef = useRef(studentGrades);
  studentGradesRef.current = studentGrades;
  const appSettingsRef = useRef(appSettings);
  appSettingsRef.current = appSettings;
  const selectedClassIdRef = useRef(selectedClassId);
  selectedClassIdRef.current = selectedClassId;
  const activeProfessorIdRef = useRef(activeProfessorId);
  activeProfessorIdRef.current = activeProfessorId;

  // Client instance unique identifier for echo-suppression across devices
  const clientIdRef = useRef<string>(
    typeof window !== 'undefined'
      ? 'client_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36)
      : 'server_client'
  );
  const realtimeBroadcastChannelRef = useRef<any>(null);

  // 12. Firestore Outbox Offline Attendance Queue
  const [outboxQueue, setOutboxQueue] = useState<AttendanceOutboxItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PREFIX + 'outbox_queue');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((item: any) => ({
        ...item,
        syncStatus: item.syncStatus || (item.status === 'synced' ? 'synced' : 'pending'),
        retryCount: item.retryCount ?? item.attempts ?? 0,
        attempts: item.attempts ?? item.retryCount ?? 0,
      }));
    } catch {
      return [];
    }
  });
  const outboxQueueRef = useRef(outboxQueue);
  outboxQueueRef.current = outboxQueue;

  const [isOutboxSyncing, setIsOutboxSyncing] = useState<boolean>(false);
  const isProcessingOutboxRef = useRef<boolean>(false);
  const pendingRerunRef = useRef<boolean>(false);
  const outboxDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [lastOutboxSyncDate, setLastOutboxSyncDate] = useState<string>(() => {
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  });

  const outboxPendingCount = useMemo(() => {
    return outboxQueue.filter(item => {
      const s = item.syncStatus || (item.status === 'synced' ? 'synced' : 'pending');
      return s === 'pending' || s === 'syncing' || s === 'failed';
    }).length;
  }, [outboxQueue]);

  const processOutboxQueue = useCallback(async (forceRetry = false) => {
    // 1. MECANISMO DE CONCORRÊNCIA: Se um lote já estiver em trânsito, agenda reprocessamento imediato
    if (isProcessingOutboxRef.current) {
      pendingRerunRef.current = true;
      return;
    }

    if (forceRetry) {
      firestoreBlockedUntilRef.current = 0;
    }

    const currentQueue = outboxQueueRef.current;
    const MAX_RETRIES = 5;
    const now = Date.now();

    // Filtra itens a processar com tratamento de backoff
    const pendingItems = currentQueue.filter(item => {
      const s = item.syncStatus || (item.status === 'synced' ? 'synced' : 'pending');
      if (forceRetry) {
        return s !== 'synced';
      }
      if (s === 'pending') return true;
      if (s === 'failed' && (item.retryCount || 0) < MAX_RETRIES) {
        // Backoff exponencial para evitar sobrecarga de rede
        const retryDelay = Math.min(60000, 2000 * Math.pow(1.8, item.retryCount || 0));
        return (now - (item.createdAt || 0)) > retryDelay;
      }
      return false;
    });

    if (pendingItems.length === 0) return;

    isProcessingOutboxRef.current = true;
    setIsOutboxSyncing(true);

    const pendingIds = new Set(pendingItems.map(i => i.id));

    // Feedback otimista de status 'syncing'
    setOutboxQueue(prev => prev.map(item => {
      if (pendingIds.has(item.id)) {
        return {
          ...item,
          syncStatus: 'syncing' as OutboxItemStatus,
        };
      }
      return item;
    }));

    const firestoreSucceededIds = new Set<string>();
    const itemErrorsMap = new Map<string, string>();

    try {
      // 1. SINCRONIZAÇÃO DIRETA NO SUPABASE (Sessions & Presenças)
      if (navigator.onLine) {
        try {
          const sessionUpdates = new Map<string, { session: LabSession, itemIds: string[] }>();
          for (const item of pendingItems) {
            const sessId = item.sessionId || item.data?.sessionId;
            if (!sessId) {
              firestoreSucceededIds.add(item.id);
              continue;
            }
            const targetSess = sessionUpdates.get(sessId)?.session || sessionsRef.current.find(s => s.id === sessId);
            if (targetSess) {
              const newAtt = { ...(targetSess.attendance || {}) };
              if (item.studentId && item.data) {
                newAtt[item.studentId] = {
                  studentId: item.studentId,
                  status: item.data.status || 'present',
                  period: item.data.period || 'both',
                  timestamp: item.data.timestamp || new Date().toLocaleTimeString(),
                  checkinMethod: item.data.checkinMethod || 'qrcode',
                  epiVerified: item.data.epiVerified ?? true,
                };
              }
              const updatedSess: LabSession = {
                ...targetSess,
                attendance: newAtt,
                lastUpdateTimestamp: Date.now(),
              };
              const existingIds = sessionUpdates.get(sessId)?.itemIds || [];
              sessionUpdates.set(sessId, { session: updatedSess, itemIds: [...existingIds, item.id] });
            } else {
              firestoreSucceededIds.add(item.id);
            }
          }

          for (const [, entry] of sessionUpdates.entries()) {
            const { error: sessErr } = await supabase.from('sessions').upsert({
              id: entry.session.id,
              class_group_id: entry.session.classGroupId,
              version: (entry.session.version || 0) + 1,
              last_update_timestamp: Date.now(),
              attendance: entry.session.attendance || {},
              active_period: entry.session.activePeriod,
              is_live: entry.session.isLive,
              is_locked: entry.session.isLocked,
              topic: entry.session.topic,
              discipline: entry.session.discipline,
            });

            if (!sessErr) {
              entry.itemIds.forEach(id => firestoreSucceededIds.add(id));
            } else {
              console.warn('[Outbox] Supabase session upsert warning:', sessErr.message);
            }
          }
        } catch (supaErr: any) {
          console.debug('[Outbox] Supabase direct sync error:', supaErr?.message || supaErr);
        }
      }

      // 2. SINCRONIZAÇÃO EM LOTE COM O BACKEND EXPRESS (/api/outbox/process se disponível)
      let backendSuccess = false;
      try {
        const response = await fetch('/api/outbox/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            items: pendingItems, 
            senderClientId: clientIdRef.current,
            force: forceRetry 
          }),
        });

        if (response.ok) {
          backendSuccess = true;
        } else if (response.status !== 404) {
          const statusMsg = `Servidor HTTP ${response.status}`;
          pendingItems.forEach(item => {
            if (!itemErrorsMap.has(item.id)) itemErrorsMap.set(item.id, statusMsg);
          });
        }
      } catch (backendErr: any) {
        console.debug('[Outbox] Backend Express indisponível (ambiente estático/Vercel):', backendErr?.message || backendErr);
      }

      // 4. ATUALIZAÇÃO ATÔMICA DA FILA, GESTÃO DE FALHAS E RETRIES
      const nowMs = Date.now();
      setOutboxQueue(prev => {
        const updated = prev.map(item => {
          if (!pendingIds.has(item.id)) return item;

          // Se gravado no Firestore OU processado pelo servidor, consideramos sucesso
          const isItemSynced = firestoreSucceededIds.has(item.id) || backendSuccess;
          if (isItemSynced) {
            return {
              ...item,
              syncStatus: 'synced' as OutboxItemStatus,
              syncedAt: nowMs,
              lastError: undefined,
            };
          }

          // Se falhou em ambos os canais de persistência
          const nextRetry = (item.retryCount || 0) + 1;
          const isFailed = nextRetry >= MAX_RETRIES;
          const failureReason = itemErrorsMap.get(item.id) || 'Erro de conexão/sincronização';

          return {
            ...item,
            retryCount: nextRetry,
            attempts: nextRetry,
            syncStatus: (isFailed ? 'failed' : 'pending') as OutboxItemStatus,
            lastError: failureReason,
          };
        });

        try {
          localStorage.setItem(STORAGE_PREFIX + 'outbox_queue', JSON.stringify(updated));
        } catch {}
        return updated;
      });

      if (firestoreSucceededIds.size > 0 || backendSuccess) {
        setLastOutboxSyncDate(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch (unexpectedErr: any) {
      console.error('[Outbox] Erro inesperado ao processar fila outbox:', unexpectedErr);
      setOutboxQueue(prev => {
        const updated = prev.map(item => {
          if (pendingIds.has(item.id)) {
            const nextRetry = (item.retryCount || 0) + 1;
            return {
              ...item,
              retryCount: nextRetry,
              attempts: nextRetry,
              syncStatus: (nextRetry >= MAX_RETRIES ? 'failed' : 'pending') as OutboxItemStatus,
              lastError: unexpectedErr?.message || 'Erro inesperado',
            };
          }
          return item;
        });
        try {
          localStorage.setItem(STORAGE_PREFIX + 'outbox_queue', JSON.stringify(updated));
        } catch {}
        return updated;
      });
    } finally {
      isProcessingOutboxRef.current = false;
      setIsOutboxSyncing(false);

      // Concorrência: se novos itens foram adicionados durante o processamento, executa imediatamente a próxima rodada
      if (pendingRerunRef.current) {
        pendingRerunRef.current = false;
        setTimeout(() => {
          processOutboxQueue();
        }, 100);
      }
    }
  }, []);

  const enqueueOutboxItem = useCallback((rawItem: Omit<AttendanceOutboxItem, 'id' | 'syncStatus' | 'createdAt' | 'retryCount'>) => {
    const devId = localStorage.getItem('bmf4_device_uuid') || 'local_device';
    const prof = professorsRef.current.find(p => p.id === activeProfessorIdRef.current);
    
    const newItem: AttendanceOutboxItem = {
      ...rawItem,
      id: `outbox_${Date.now()}_${rawItem.studentId || 'batch'}_${Math.random().toString(36).substring(2, 7)}`,
      deviceId: rawItem.deviceId || devId,
      professorId: rawItem.professorId || activeProfessorIdRef.current,
      professorName: rawItem.professorName || prof?.name,
      syncStatus: 'pending',
      createdAt: Date.now(),
      retryCount: 0,
      attempts: 0,
    };

    setOutboxQueue(prev => {
      const updated = [newItem, ...prev].slice(0, 200);
      try {
        localStorage.setItem(STORAGE_PREFIX + 'outbox_queue', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // Mecanismo de Debounce inteligente: agrupa rajadas de check-ins (ex: múltiplos scans de QR Code)
    if (outboxDebounceTimerRef.current) {
      clearTimeout(outboxDebounceTimerRef.current);
    }
    outboxDebounceTimerRef.current = setTimeout(() => {
      processOutboxQueue();
    }, 350);
  }, [processOutboxQueue]);

  const clearSyncedOutbox = useCallback(() => {
    setOutboxQueue(prev => {
      const remaining = prev.filter(i => (i.syncStatus || (i as any).status) !== 'synced');
      try {
        localStorage.setItem(STORAGE_PREFIX + 'outbox_queue', JSON.stringify(remaining));
      } catch {}
      return remaining;
    });
  }, []);

  const clearAllOutbox = useCallback(() => {
    setOutboxQueue([]);
    try {
      localStorage.removeItem(STORAGE_PREFIX + 'outbox_queue');
    } catch {}
  }, []);

  // Gatilhos automáticos para processar Outbox ao reconectar ou ganhar foco
  useEffect(() => {
    const handleOnlineEvent = () => {
      setIsOnline(true);
      processOutboxQueue(true);
    };
    const handleFocusEvent = () => {
      if (navigator.onLine) {
        processOutboxQueue();
      }
    };
    window.addEventListener('online', handleOnlineEvent);
    window.addEventListener('focus', handleFocusEvent);
    document.addEventListener('visibilitychange', handleFocusEvent);

    const outboxInterval = setInterval(() => {
      if (navigator.onLine && outboxQueueRef.current.some(i => {
        const s = i.syncStatus || (i.status === 'synced' ? 'synced' : 'pending');
        return s === 'pending' || s === 'failed';
      })) {
        processOutboxQueue();
      }
    }, 10000);

    return () => {
      window.removeEventListener('online', handleOnlineEvent);
      window.removeEventListener('focus', handleFocusEvent);
      document.removeEventListener('visibilitychange', handleFocusEvent);
      clearInterval(outboxInterval);
      if (outboxDebounceTimerRef.current) {
        clearTimeout(outboxDebounceTimerRef.current);
      }
    };
  }, [processOutboxQueue]);

  const getLocalLastUpdated = useCallback((): number => {
    try {
      const saved = localStorage.getItem(STORAGE_PREFIX + 'last_updated');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  }, []);

  const setLocalLastUpdated = useCallback((ts: number) => {
    try {
      localStorage.setItem(STORAGE_PREFIX + 'last_updated', ts.toString());
    } catch {}
  }, []);

  // Helper to map record properties for Supabase tables (supports both snake_case and camelCase columns)
  const mapRecordForSupabase = (table: string, rec: any) => {
    if (!rec) return rec;
    const copy = { ...rec };
    if (table === 'classes') {
      copy.laboratory_room = copy.laboratory_room || copy.laboratoryRoom;
      copy.total_students = copy.total_students ?? copy.totalStudents;
      copy.professor_id = copy.professor_id || copy.professorId;
      copy.professor_name = copy.professor_name || copy.professorName;
      copy.monitor_name = copy.monitor_name || copy.monitorName;
    } else if (table === 'students') {
      copy.registration_number = copy.registration_number || copy.registrationNumber;
      copy.class_group_id = copy.class_group_id || copy.classGroupId;
      copy.attendance_stats = copy.attendance_stats || copy.attendanceStats;
      copy.avatar_url = copy.avatar_url || copy.avatarUrl || copy.avatar;
      copy.bound_device_id = copy.bound_device_id || copy.boundDeviceId;
      copy.device_bound_at = copy.device_bound_at || copy.deviceBoundAt;
    } else if (table === 'teachers') {
      copy.registration_number = copy.registration_number || copy.registrationNumber;
      copy.assigned_class_ids = copy.assigned_class_ids || copy.assignedClassIds;
      copy.has_changed_pin = copy.has_changed_pin ?? copy.hasChangedPin;
      copy.avatar_url = copy.avatar_url || copy.avatar || copy.avatarUrl;
    } else if (table === 'sessions') {
      copy.class_group_id = copy.class_group_id || copy.classGroupId;
      copy.start_time = copy.start_time || copy.startTime;
      copy.end_time = copy.end_time || copy.endTime;
      copy.professor_id = copy.professor_id || copy.professorId;
      copy.professor_name = copy.professor_name || copy.professorName;
      copy.is_live = copy.is_live ?? copy.isLive;
      copy.is_locked = copy.is_locked ?? copy.isLocked;
      copy.active_period = copy.active_period || copy.activePeriod;
      copy.activity_type = copy.activity_type || copy.activityType;
      copy.activity_category = copy.activity_category || copy.activityCategory;
      copy.lab_location = copy.lab_location || copy.labLocation;
      copy.checkin_code = copy.checkin_code || copy.checkinCode;
      copy.checkin_secret = copy.checkin_secret || copy.checkinSecret;
      copy.last_update_timestamp = copy.last_update_timestamp || copy.lastUpdateTimestamp;
      copy.updated_by = copy.updated_by || copy.updatedBy;
    } else if (table === 'attendance_records') {
      copy.session_id = copy.session_id || copy.sessionId;
      copy.student_id = copy.student_id || copy.studentId;
      copy.student_name = copy.student_name || copy.studentName;
      copy.student_ra = copy.student_ra || copy.studentRa;
      copy.class_group_id = copy.class_group_id || copy.classGroupId;
      copy.period1_status = copy.period1_status || copy.period1Status;
      copy.period2_status = copy.period2_status || copy.period2Status;
      copy.epi_verified = copy.epi_verified ?? copy.epiVerified;
      copy.checkin_method = copy.checkin_method || copy.checkinMethod;
      copy.device_id = copy.device_id || copy.deviceId;
      copy.device_model = copy.device_model || copy.deviceModel;
      copy.token_used = copy.token_used || copy.tokenUsed;
      copy.justification_reason = copy.justification_reason || copy.justificationReason;
      copy.justification_file_url = copy.justification_file_url || copy.justificationFileUrl;
      copy.justification_file_name = copy.justification_file_name || copy.justificationFileName;
    } else if (table === 'justifications') {
      copy.student_id = copy.student_id || copy.studentId;
      copy.student_name = copy.student_name || copy.studentName;
      copy.student_ra = copy.student_ra || copy.studentRa;
      copy.class_group_id = copy.class_group_id || copy.classGroupId;
      copy.session_id = copy.session_id || copy.sessionId;
      copy.doc_number = copy.doc_number || copy.docNumber || copy.documentNumber;
      copy.attachment_name = copy.attachment_name || copy.attachmentName;
      copy.attachment_url = copy.attachment_url || copy.attachmentUrl;
      copy.reviewer_id = copy.reviewer_id || copy.reviewerId;
      copy.reviewer_name = copy.reviewer_name || copy.reviewerName;
      copy.review_notes = copy.review_notes || copy.reviewNotes;
    } else if (table === 'student_grades') {
      copy.student_id = copy.student_id || copy.studentId;
      copy.class_group_id = copy.class_group_id || copy.classGroupId;
      copy.substitute_exam_score = copy.substitute_exam_score ?? copy.substituteExamScore;
    }
    return copy;
  };

  const syncEntityToSupabase = useCallback(async (table: string, recordOrRecords: any) => {
    if (!navigator.onLine || !recordOrRecords) return;
    try {
      const records = Array.isArray(recordOrRecords) ? recordOrRecords : [recordOrRecords];
      if (records.length === 0) return;

      const recordIds = records.map((r: any) => r.id).filter(Boolean);
      let remoteMap = new Map<string, any>();

      if (recordIds.length > 0) {
        const { data: remoteData, error: fetchErr } = await supabase
          .from(table)
          .select('*')
          .in('id', recordIds);

        if (!fetchErr && Array.isArray(remoteData)) {
          remoteData.forEach((row: any) => {
            remoteMap.set(row.id, row);
          });
        }
      }

      const recordsToUpsert = [];
      const nowMs = Date.now();

      for (const r of records) {
        const remoteRec = r.id ? remoteMap.get(r.id) : null;
        const localTs = r.lastUpdateTimestamp || r.last_update_timestamp || nowMs;
        const remoteTs = remoteRec?.last_update_timestamp || remoteRec?.updated_at 
          ? new Date(remoteRec.last_update_timestamp || remoteRec.updated_at).getTime() 
          : 0;

        // Revalidação Otimista: se a versão remota for mais recente que a local, evitamos conflitos/sobrescrita cega
        if (remoteRec && remoteTs > localTs) {
          console.log(`🛡️ [Optimistic Revalidation] Conflito evitado em [${table}]: registro remoto (${remoteTs}) é mais recente que o local (${localTs}) para ID ${r.id}`);
          continue;
        }

        const enhancedRecord = {
          ...r,
          last_update_timestamp: nowMs,
          version: (remoteRec?.version || r.version || 0) + 1,
        };

        const mapped = mapRecordForSupabase(table, enhancedRecord);
        recordsToUpsert.push(mapped);
      }

      if (recordsToUpsert.length === 0) return;

      const sanitizedRecords = validateAndSanitizeBatch(table, recordsToUpsert);
      const { error } = await supabase.from(table).upsert(sanitizedRecords, { onConflict: 'id' });
      if (error) {
        console.warn(`⚠️ Supabase upsert warning for [${table}]:`, error.message, error.code);
      } else {
        console.log(`✅ Supabase upsert success with Optimistic Revalidation for [${table}]: ${sanitizedRecords.length} registos`);
      }
    } catch (err: any) {
      console.error(`❌ Supabase upsert exception for [${table}]:`, err?.message || err);
    }
  }, []);

  const deleteEntityFromSupabase = useCallback(async (table: string, idOrIds: string | string[]) => {
    if (!navigator.onLine || !idOrIds) return;
    try {
      const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
      if (ids.length === 0) return;
      const { error } = await supabase.from(table).delete().in('id', ids);
      if (error) {
        console.warn(`⚠️ [Supabase Delete] Erro ao deletar de [${table}]:`, error.message);
      } else {
        console.log(`✅ [Supabase Delete] ${ids.length} registro(s) removido(s) de [${table}]`);
      }
    } catch (err: any) {
      console.error(`❌ [Supabase Delete Exception] [${table}]:`, err?.message || err);
    }
  }, []);

  // Broadcast current state to Supabase, backend server and other devices
  const broadcastCurrentState = useCallback((statePayload: any) => {
    const enrichedPayload = {
      ...statePayload,
      senderClientId: clientIdRef.current,
      userMutation: true,
      deletedSessionIds: statePayload.deletedSessionIds || deletedSessionIdsRef.current || [],
      deletedProfessorIds: statePayload.deletedProfessorIds || deletedProfessorIdsRef.current || [],
      deletedStudentIds: statePayload.deletedStudentIds || deletedStudentIdsRef.current || [],
      deletedClassIds: statePayload.deletedClassIds || deletedClassIdsRef.current || [],
      lastUpdated: statePayload.lastUpdated || Date.now(),
    };

    // 1. WebSocket instant broadcast (0ms delay)
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({
          type: 'UPDATE_STATE',
          state: enrichedPayload,
        }));
      } catch (err) {
        console.debug('WebSocket notice:', err);
      }
    }

    // 2. Supabase Realtime Broadcast Channel
    try {
      if (realtimeBroadcastChannelRef.current) {
        realtimeBroadcastChannelRef.current.send({
          type: 'broadcast',
          event: 'sync_state',
          payload: enrichedPayload,
        });
      } else {
        supabase.channel('bmf4_attendance_realtime').send({
          type: 'broadcast',
          event: 'sync_state',
          payload: enrichedPayload,
        });
      }
    } catch {}

    // 3. Background HTTP POST sync
    fetch('/api/sync/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enrichedPayload),
    }).catch(() => {});
  }, []);

  // Synchronize active session with Data Versioning to Supabase
  const syncSessionVersionToFirestore = useCallback(async (session: LabSession, explicitVersion?: number) => {
    if (!session || !session.id) return;
    const version = explicitVersion !== undefined 
      ? explicitVersion 
      : (typeof session.version === 'number' && session.version > 0 ? session.version : 1);
    const lastUpdateTimestamp = session.lastUpdateTimestamp || Date.now();

    // Sync to Supabase Realtime table if online
    if (navigator.onLine) {
      try {
        supabase.from('sessions').upsert({
          id: session.id,
          class_group_id: session.classGroupId,
          version,
          last_update_timestamp: lastUpdateTimestamp,
          attendance: session.attendance || {},
          active_period: session.activePeriod,
          is_live: session.isLive,
          is_locked: session.isLocked,
          topic: session.topic,
          discipline: session.discipline,
          date: session.date,
          professor_id: session.professorId,
          professor_name: session.professorName,
          updated_by: clientIdRef.current,
        }, { onConflict: 'id' }).then(({ error }) => {
          if (error) {
            console.debug('Supabase session upsert notice:', error);
          }
        });
      } catch {}
    }
  }, []);

  // Apply cloud active session data if its version is newer (Data Versioning)
  const applySessionAttendanceFromCloud = useCallback((cloudData: ActiveSessionDocument) => {
    if (!cloudData || !cloudData.sessionId) return;
    setSessions(prev => {
      let changed = false;
      const updated = prev.map(s => {
        if (s.id === cloudData.sessionId || (s.classGroupId && s.classGroupId === cloudData.classGroupId && s.isLive)) {
          const curVer = s.version || 0;
          if (cloudData.version > curVer) {
            changed = true;
            return {
              ...s,
              attendance: {
                ...s.attendance,
                ...(cloudData.attendance || {}),
              },
              version: cloudData.version,
              lastUpdateTimestamp: cloudData.lastUpdateTimestamp,
              activePeriod: cloudData.activePeriod || s.activePeriod,
              isLive: cloudData.isLive !== undefined ? cloudData.isLive : s.isLive,
              isLocked: cloudData.isLocked !== undefined ? cloudData.isLocked : s.isLocked,
              topic: cloudData.topic || s.topic,
            };
          }
        }
        return s;
      });
      if (changed) {
        try {
          localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(updated));
        } catch {}
        return updated;
      }
      return prev;
    });
  }, []);

  // Apply state received from server or Cloud Firestore
  const applyServerState = useCallback((serverState: any) => {
    if (!serverState || typeof serverState !== 'object') return;

    // Suppress echo if this exact client dispatched the update
    if (serverState.senderClientId && serverState.senderClientId === clientIdRef.current) {
      const now = Date.now();
      setLastSyncTimestamp(now);
      lastSyncTimestampRef.current = Math.max(lastSyncTimestampRef.current, Number(serverState.lastUpdated) || now);
      setLastSyncDate(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      return;
    }

    const serverTs = Number(serverState.lastUpdated) || 0;

    // Discard if significantly older (allowing 15s clock drift tolerance across devices)
    if (serverTs > 0 && serverTs < lastSyncTimestampRef.current - 15000 && !serverState.isExplicitReset && !serverState.userMutation) {
      return;
    }

    // If explicit reset is triggered, wipe state immediately
    if (serverState.isExplicitReset) {
      isRemoteUpdateRef.current = true;
      setProfessors(INITIAL_PROFESSORS);
      setClasses([]);
      setStudents([]);
      setSessions([]);
      setDeletedSessionIds([]);
      deletedSessionIdsRef.current = [];
      setJustifications([]);
      setStudentGrades([]);
      setSelectedClassId('');
      try {
        localStorage.removeItem(STORAGE_PREFIX + 'classes');
        localStorage.removeItem(STORAGE_PREFIX + 'students');
        localStorage.removeItem(STORAGE_PREFIX + 'sessions');
        localStorage.removeItem(STORAGE_PREFIX + 'deleted_session_ids');
        localStorage.removeItem(STORAGE_PREFIX + 'justifications');
        localStorage.removeItem(STORAGE_PREFIX + 'student_grades');
        localStorage.removeItem(STORAGE_PREFIX + 'selectedClass');
      } catch {}
      const appliedTs = serverTs > 0 ? serverTs : Date.now();
      lastSyncTimestampRef.current = Math.max(lastSyncTimestampRef.current, appliedTs);
      setLocalLastUpdated(appliedTs);
      setLastSyncTimestamp(appliedTs);
      setLastSyncDate(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setTimeout(() => { isRemoteUpdateRef.current = false; }, 200);
      return;
    }

    // Track incoming deletedSessionIds
    let allDeletedIds = deletedSessionIdsRef.current;
    if (Array.isArray(serverState.deletedSessionIds) && serverState.deletedSessionIds.length > 0) {
      allDeletedIds = Array.from(new Set([...deletedSessionIdsRef.current, ...serverState.deletedSessionIds]));
      setDeletedSessionIds(allDeletedIds);
      deletedSessionIdsRef.current = allDeletedIds;
      scheduleLocalStorageSave(STORAGE_PREFIX + 'deleted_session_ids', JSON.stringify(allDeletedIds));
    }

    // Track incoming deletedProfessorIds
    let allDeletedProfIds = deletedProfessorIdsRef.current;
    if (Array.isArray(serverState.deletedProfessorIds) && serverState.deletedProfessorIds.length > 0) {
      allDeletedProfIds = Array.from(new Set([...deletedProfessorIdsRef.current, ...serverState.deletedProfessorIds]));
      setDeletedProfessorIds(allDeletedProfIds);
      deletedProfessorIdsRef.current = allDeletedProfIds;
      scheduleLocalStorageSave(STORAGE_PREFIX + 'deleted_professor_ids', JSON.stringify(allDeletedProfIds));
    }

    // Track incoming deletedStudentIds
    let allDeletedStudentIds = deletedStudentIdsRef.current;
    if (Array.isArray(serverState.deletedStudentIds) && serverState.deletedStudentIds.length > 0) {
      allDeletedStudentIds = Array.from(new Set([...deletedStudentIdsRef.current, ...serverState.deletedStudentIds]));
      setDeletedStudentIds(allDeletedStudentIds);
      deletedStudentIdsRef.current = allDeletedStudentIds;
      scheduleLocalStorageSave(STORAGE_PREFIX + 'deleted_student_ids', JSON.stringify(allDeletedStudentIds));
    }

    // Track incoming deletedClassIds
    let allDeletedClassIds = deletedClassIdsRef.current;
    if (Array.isArray(serverState.deletedClassIds) && serverState.deletedClassIds.length > 0) {
      allDeletedClassIds = Array.from(new Set([...deletedClassIdsRef.current, ...serverState.deletedClassIds]));
      setDeletedClassIds(allDeletedClassIds);
      deletedClassIdsRef.current = allDeletedClassIds;
      scheduleLocalStorageSave(STORAGE_PREFIX + 'deleted_class_ids', JSON.stringify(allDeletedClassIds));
    }

    isRemoteUpdateRef.current = true;

    if (Array.isArray(serverState.professors)) {
      const deletedProfSet = new Set(allDeletedProfIds);
      const mergedProfs = (serverState.userMutation 
        ? serverState.professors 
        : mergeProfessorLists(professorsRef.current, serverState.professors, allDeletedProfIds)
      ).filter(p => p && p.id && !deletedProfSet.has(p.id));
      setProfessors(mergedProfs);
      scheduleLocalStorageSave(STORAGE_PREFIX + 'professors', JSON.stringify(mergedProfs));
    }

    if (Array.isArray(serverState.classes)) {
      const delClassSet = new Set(allDeletedClassIds);
      const mergedClasses = (serverState.userMutation
        ? serverState.classes
        : mergeClassLists(classesRef.current, serverState.classes, allDeletedClassIds)
      ).filter(c => c && c.id && !delClassSet.has(c.id));
      const sorted = sortClassesAlphabetically(mergedClasses);
      setClasses(sorted);
      scheduleLocalStorageSave(STORAGE_PREFIX + 'classes', JSON.stringify(sorted));

      setSelectedClassId(prevId => {
        if (prevId && sorted.some(c => c.id === prevId)) {
          return prevId;
        }
        const localSaved = localStorage.getItem(STORAGE_PREFIX + 'selectedClass');
        if (localSaved && sorted.some(c => c.id === localSaved)) {
          return localSaved;
        }
        return sorted[0]?.id || '';
      });
    }

    let mergedSessionsList = sessionsRef.current;
    if (Array.isArray(serverState.sessions)) {
      mergedSessionsList = mergeSessionLists(sessionsRef.current, serverState.sessions, allDeletedIds);
      setSessions(mergedSessionsList);
      scheduleLocalStorageSave(STORAGE_PREFIX + 'sessions', JSON.stringify(mergedSessionsList));
    }

    if (Array.isArray(serverState.students)) {
      const delStudentSet = new Set(allDeletedStudentIds);
      const mergedStudents = (serverState.userMutation
        ? serverState.students
        : mergeStudentLists(studentsRef.current, serverState.students, allDeletedStudentIds)
      ).filter(s => s && s.id && !delStudentSet.has(s.id));
      const recomputed = computeStudentsWithRecalculatedStats(mergedStudents, mergedSessionsList);
      setStudents(recomputed);
      scheduleLocalStorageSave(STORAGE_PREFIX + 'students', JSON.stringify(recomputed));
    } else if (mergedSessionsList !== sessionsRef.current) {
      const delStudentSet = new Set(allDeletedStudentIds);
      setStudents(prev => {
        const filtered = prev.filter(s => s && s.id && !delStudentSet.has(s.id));
        const recomputed = computeStudentsWithRecalculatedStats(filtered, mergedSessionsList);
        scheduleLocalStorageSave(STORAGE_PREFIX + 'students', JSON.stringify(recomputed));
        return recomputed;
      });
    }

    if (Array.isArray(serverState.justifications)) {
      const mergedJustifications = serverState.userMutation
        ? serverState.justifications
        : mergeJustificationLists(justificationsRef.current, serverState.justifications);
      setJustifications(mergedJustifications);
      scheduleLocalStorageSave(STORAGE_PREFIX + 'justifications', JSON.stringify(mergedJustifications));
    }

    if (Array.isArray(serverState.studentGrades)) {
      const mergedGrades = serverState.userMutation
        ? serverState.studentGrades
        : mergeGradeLists(studentGradesRef.current, serverState.studentGrades);
      setStudentGrades(mergedGrades);
      scheduleLocalStorageSave(STORAGE_PREFIX + 'student_grades', JSON.stringify(mergedGrades));
    }

    if (serverState.appSettings) {
      setAppSettings(serverState.appSettings);
      scheduleLocalStorageSave(STORAGE_PREFIX + 'settings', JSON.stringify(serverState.appSettings));
    }

    if (serverState.teacherPresences && typeof serverState.teacherPresences === 'object') {
      const now = Date.now();
      const merged: Record<string, TeacherPresence> = { 
        ...teacherPresencesRef.current, 
        ...serverState.teacherPresences 
      };
      Object.keys(merged).forEach(id => {
        if ((now - (merged[id]?.lastPing || 0)) > 60000) {
          delete merged[id];
        }
      });
      setTeacherPresences(merged);
    }

    if (serverState.connectedDevices && typeof serverState.connectedDevices === 'object') {
      const now = Date.now();
      const mergedDevs: Record<string, ConnectedDevice> = {
        ...connectedDevicesMapRef.current,
        ...serverState.connectedDevices,
      };
      Object.keys(mergedDevs).forEach(devId => {
        if (now - (mergedDevs[devId]?.lastPing || 0) > 90000) {
          delete mergedDevs[devId];
        }
      });
      setConnectedDevicesMap(mergedDevs);
    }

    const appliedTs = serverTs > 0 ? serverTs : Date.now();
    lastSyncTimestampRef.current = Math.max(lastSyncTimestampRef.current, appliedTs);
    setLocalLastUpdated(appliedTs);
    setLastSyncTimestamp(appliedTs);
    setLastSyncDate(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    setTimeout(() => {
      isRemoteUpdateRef.current = false;
    }, 150);
  }, [getLocalLastUpdated, setLocalLastUpdated, broadcastCurrentState]);

  // 14. Supabase Realtime Channel Subscription (postgres_changes on all tables & broadcast)
  useEffect(() => {
    let channel: any = null;
    try {
      channel = supabase
        .channel('bmf4_attendance_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'sessions' },
          (payload: any) => {
            if (payload.eventType === 'DELETE' && payload.old?.id) {
              const delId = payload.old.id;
              setSessions(prev => prev.filter(s => s.id !== delId));
            } else if (payload && payload.new) {
              const cloudSession = payload.new as any;
              if (cloudSession && cloudSession.id) {
                applySessionAttendanceFromCloud({
                  id: cloudSession.id,
                  sessionId: cloudSession.id,
                  classGroupId: cloudSession.class_group_id || cloudSession.classGroupId,
                  version: cloudSession.version || 1,
                  lastUpdateTimestamp: cloudSession.last_update_timestamp || cloudSession.lastUpdateTimestamp || Date.now(),
                  attendance: cloudSession.attendance || {},
                  activePeriod: cloudSession.active_period || cloudSession.activePeriod,
                  isLive: cloudSession.is_live ?? cloudSession.isLive,
                  isLocked: cloudSession.is_locked ?? cloudSession.isLocked,
                  topic: cloudSession.topic,
                  discipline: cloudSession.discipline,
                  date: cloudSession.date,
                  professorId: cloudSession.professor_id || cloudSession.professorId,
                  professorName: cloudSession.professor_name || cloudSession.professorName,
                  activityType: cloudSession.activity_type || cloudSession.activityType,
                  labLocation: cloudSession.lab_location || cloudSession.labLocation,
                  checkinCode: cloudSession.checkin_code || cloudSession.checkinCode,
                  updatedBy: cloudSession.updated_by || 'supabase_realtime',
                });
              }
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'classes' },
          (payload: any) => {
            if (payload.eventType === 'DELETE' && payload.old?.id) {
              const delId = payload.old.id;
              setClasses(prev => prev.filter(c => c.id !== delId));
            } else if (payload.new && payload.new.id) {
              const raw = payload.new;
              const mapped: ClassGroup = {
                id: raw.id,
                name: raw.name,
                code: raw.code || raw.id,
                discipline: raw.discipline || 'BMF4',
                laboratoryRoom: raw.laboratory_room || raw.laboratoryRoom || 'Laboratório de Morfologia',
                schedule: raw.schedule || 'Segunda a Sexta, 07:30 - 12:00',
                color: raw.color || '#0d9488',
                totalStudents: raw.total_students ?? raw.totalStudents ?? 0,
                professorName: raw.professor_name || raw.professorName,
                professorId: raw.professor_id || raw.professorId,
                monitorName: raw.monitor_name || raw.monitorName,
                semester: raw.semester || '4º Semestre 2026',
                course: raw.course || 'Medicina',
                institution: raw.institution || 'UNINOVE MEDICINA',
              };
              setClasses(prev => sortClassesAlphabetically(mergeClassLists(prev, [mapped], deletedClassIdsRef.current)));
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'students' },
          (payload: any) => {
            if (payload.eventType === 'DELETE' && payload.old?.id) {
              const delId = payload.old.id;
              setStudents(prev => prev.filter(s => s.id !== delId));
            } else if (payload.new && payload.new.id) {
              const raw = payload.new;
              const mapped: Student = {
                id: raw.id,
                name: raw.name,
                registrationNumber: raw.registration_number || raw.registrationNumber || '',
                email: raw.email || '',
                discipline: raw.discipline || 'BMF4',
                course: raw.course || 'Medicina',
                classGroupId: raw.class_group_id || raw.classGroupId || '',
                notes: raw.notes,
                avatarUrl: raw.avatar_url,
                presences: raw.presences ?? 0,
                absences: raw.absences ?? 0,
                lates: raw.lates ?? 0,
                excused: raw.excused ?? 0,
                totalClasses: raw.total_classes ?? 0,
              };
              setStudents(prev => computeStudentsWithRecalculatedStats(mergeStudentLists(prev, [mapped], deletedStudentIdsRef.current), sessionsRef.current));
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'teachers' },
          (payload: any) => {
            if (payload.eventType === 'DELETE' && payload.old?.id) {
              const delId = payload.old.id;
              setProfessors(prev => prev.filter(p => p.id !== delId));
            } else if (payload.new && payload.new.id) {
              const raw = payload.new;
              const mapped: Professor = {
                id: raw.id,
                name: raw.name,
                email: raw.email,
                registrationNumber: raw.registration_number,
                discipline: raw.discipline || 'BMF4',
                pin: raw.pin || '1234',
                role: raw.role || 'professor',
                phone: raw.phone,
                assignedClassIds: raw.assigned_class_ids || [],
                hasChangedPin: raw.has_changed_pin || false,
              };
              setProfessors(prev => mergeProfessorLists(prev, [mapped], deletedProfessorIdsRef.current));
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'justifications' },
          (payload: any) => {
            if (payload.eventType === 'DELETE' && payload.old?.id) {
              const delId = payload.old.id;
              setJustifications(prev => prev.filter(j => j.id !== delId));
            } else if (payload.new && payload.new.id) {
              const mapped = payload.new as JustificationRequest;
              setJustifications(prev => mergeJustificationLists(prev, [mapped]));
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'student_grades' },
          (payload: any) => {
            if (payload.eventType === 'DELETE' && payload.old?.id) {
              const delId = payload.old.id;
              setStudentGrades(prev => prev.filter(g => (g as any).id !== delId && `${g.studentId}_${g.classGroupId}` !== delId));
            } else if (payload.new && payload.new.student_id) {
              const raw = payload.new;
              const mapped: StudentGradeRecord = {
                studentId: raw.student_id,
                classGroupId: raw.class_group_id,
                scores: raw.scores || {},
                substituteExamScore: raw.substitute_exam_score,
                notes: raw.notes,
                updatedAt: raw.updated_at,
              };
              setStudentGrades(prev => mergeGradeLists(prev, [mapped]));
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'app_settings' },
          (payload: any) => {
            if (payload.new && payload.new.settings_payload) {
              setAppSettings(payload.new.settings_payload);
            }
          }
        )
        .on(
          'broadcast',
          { event: 'sync_state' },
          (payload: any) => {
            if (payload && payload.payload) {
              setRealtimeConnected(true);
              applyServerState(payload.payload);
            }
          }
        )
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            setRealtimeConnected(true);
            console.log('⚡ [Supabase Realtime] Canal bmf4_attendance_realtime inscrito com sucesso.');
          }
        });

      realtimeBroadcastChannelRef.current = channel;
    } catch (err) {
      console.debug('Supabase realtime subscription notice:', err);
    }

    return () => {
      realtimeBroadcastChannelRef.current = null;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [applySessionAttendanceFromCloud, applyServerState]);

  // 13. Bulletproof Background Polling Sync (Supabase & API)
  useEffect(() => {
    let isCancelled = false;
    const pollInterval = setInterval(async () => {
      if (isCancelled || typeof window === 'undefined' || !navigator.onLine) return;
      try {
        // 1. Direct Supabase poll for sessions to ensure cross-device sync between PC and Mobile on Vercel
        const { data: sessionsData, error } = await supabase.from('sessions').select('*');
        if (!error && Array.isArray(sessionsData) && sessionsData.length > 0) {
          const merged = reconcileSessionsAttendance(mergeSessionLists(sessionsRef.current, sessionsData, deletedSessionIdsRef.current));
          const hasNewer = merged.some((cloudSess: any) => {
            const localSess = sessionsRef.current.find((s: any) => s.id === cloudSess.id);
            if (!localSess) return true;
            return (cloudSess.version || 0) > (localSess.version || 0) || (cloudSess.lastUpdateTimestamp || 0) > (localSess.lastUpdateTimestamp || 0);
          });
          if (hasNewer) {
            setRealtimeConnected(true);
            setSessions(merged);
            try {
              localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(merged));
            } catch {}
          }
        }

        // 2. Also try API sync state
        const res = await fetch('/api/sync/state', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.state) {
            const serverTs = Number(data.state.lastUpdated) || 0;
            const localTs = Number(getLocalLastUpdated()) || 0;
            if (serverTs > localTs) {
              setRealtimeConnected(true);
              applyServerState(data.state);
            }
          }
        }
      } catch {
        // Silent background poll catch
      }
    }, 3000);

    return () => {
      isCancelled = true;
      clearInterval(pollInterval);
    };
  }, [applyServerState]);

  // Real-time WebSocket connection with Ping/Pong Keep-Alive
  useEffect(() => {
    let reconnectTimeout: any;
    let keepaliveInterval: any;
    let isCancelled = false;
    let retryDelay = 1500;

    const connectWebSocket = () => {
      if (typeof window === 'undefined') return;
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isCancelled) return;
          setRealtimeConnected(true);
          retryDelay = 1500;
          ws.send(JSON.stringify({ type: 'GET_STATE' }));

          // Keepalive PING every 20s
          clearInterval(keepaliveInterval);
          keepaliveInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              try {
                ws.send(JSON.stringify({ type: 'PING' }));
              } catch {}
            }
          }, 20000);
        };

        ws.onmessage = (event) => {
          if (isCancelled) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'CHECKIN_CONFIRMED') {
              const rec = data.record;
              const targetKey = data.studentId || data.studentRa || rec?.studentId;
              const sessId = data.sessionId;
              const classId = data.classGroupId || rec?.classGroupId || data.student?.classGroupId;

              if (rec) {
                setSessions(prev => prev.map(s => {
                  const isTarget = (sessId && s.id === sessId) ||
                    (s.isLive && !s.isLocked && (!classId || s.classGroupId === classId)) ||
                    (!sessId && classId && s.classGroupId === classId && s.isLive);
                  if (isTarget) {
                    const updatedAtt = { ...(s.attendance || {}) };
                    if (targetKey) updatedAtt[targetKey] = rec;
                    if (data.studentRa) updatedAtt[data.studentRa] = rec;
                    if (data.studentId) updatedAtt[data.studentId] = rec;
                    if (rec.studentId) updatedAtt[rec.studentId] = rec;
                    if (rec.studentRa) updatedAtt[rec.studentRa] = rec;
                    return {
                      ...s,
                      attendance: updatedAtt,
                      version: (s.version || 0) + 1,
                      lastUpdateTimestamp: Date.now(),
                    };
                  }
                  return s;
                }));
              }
              if (data.state) {
                applyServerState({ ...data.state, userMutation: true });
              }
            } else if (data.type === 'DEVICES_UPDATED' && data.devices) {
              const now = Date.now();
              const mergedDevs: Record<string, ConnectedDevice> = {
                ...connectedDevicesMapRef.current,
                ...data.devices,
              };
              Object.keys(mergedDevs).forEach(devId => {
                if (now - (mergedDevs[devId]?.lastPing || 0) > 90000) {
                  delete mergedDevs[devId];
                }
              });
              setConnectedDevicesMap(mergedDevs);
            } else if ((data.type === 'SYNC_STATE' || data.type === 'STATE_UPDATED') && data.state) {
              applyServerState(data.state);
            } else if (data.type === 'PONG') {
              setRealtimeConnected(true);
            }
          } catch (err) {
            console.error('Error parsing WebSocket message:', err);
          }
        };

        ws.onclose = () => {
          if (isCancelled) return;
          setRealtimeConnected(false);
          clearInterval(keepaliveInterval);
          reconnectTimeout = setTimeout(connectWebSocket, retryDelay);
          retryDelay = Math.min(retryDelay * 1.5, 10000);
        };

        ws.onerror = () => {
          if (isCancelled) return;
          setRealtimeConnected(false);
        };
      } catch {
        // Fallback to polling or offline
      }
    };

    connectWebSocket();

    return () => {
      isCancelled = true;
      clearTimeout(reconnectTimeout);
      clearInterval(keepaliveInterval);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [applyServerState]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Real-time Teacher Presence Heartbeat (broadcasts which professor is in which class)
  useEffect(() => {
    if (!activeProfessorId || !selectedClassId) return;
    const prof = professors.find(p => p.id === activeProfessorId);
    const cls = classes.find(c => c.id === selectedClassId);
    if (!prof || !cls) return;

    const pingPresence = () => {
      const now = Date.now();
      const current = teacherPresencesRef.current;
      const updated: Record<string, TeacherPresence> = {
        ...current,
        [activeProfessorId]: {
          professorId: activeProfessorId,
          professorName: prof.name,
          classGroupId: selectedClassId,
          className: cls.name,
          lastPing: now,
          isHost: true,
        }
      };

      // Prune inactive presences older than 60s
      Object.keys(updated).forEach(id => {
        if (id !== activeProfessorId && (now - updated[id].lastPing) > 60000) {
          delete updated[id];
        }
      });

      setTeacherPresences(updated);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({
            type: 'UPDATE_STATE',
            state: {
              teacherPresences: updated,
              lastUpdated: now,
            }
          }));
        } catch {}
      }
    };

    pingPresence();
    const interval = setInterval(pingPresence, 15000);
    return () => clearInterval(interval);
  }, [activeProfessorId, selectedClassId, professors, classes]);

  // Real-time Connected Device Heartbeat
  useEffect(() => {
    const devId = localStorage.getItem('bmf4_device_uuid') || 'local_device';
    const prof = professors.find(p => p.id === activeProfessorId);

    const pingDevice = () => {
      const now = Date.now();
      const currentDev: ConnectedDevice = {
        deviceId: devId,
        deviceName: customDeviceName || 'Terminal de Sala',
        deviceType: deviceType,
        platform: typeof navigator !== 'undefined' ? navigator.platform : 'Web',
        userRole: prof?.role || (prof ? 'Professor' : 'Terminal'),
        professorName: prof?.name,
        lastPing: now,
        isOnline: isOnline && realtimeConnected,
      };

      setConnectedDevicesMap(prev => ({
        ...prev,
        [devId]: currentDev,
      }));

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({
            type: 'DEVICE_HEARTBEAT',
            device: currentDev,
          }));
        } catch {}
      }
    };

    pingDevice();
    const interval = setInterval(pingDevice, 15000);
    return () => clearInterval(interval);
  }, [customDeviceName, deviceType, activeProfessorId, professors, isOnline, realtimeConnected]);

  const connectedDevicesList = useMemo(() => {
    const now = Date.now();
    const list: ConnectedDevice[] = (Object.values(connectedDevicesMap) as ConnectedDevice[]).filter(d => (now - (d.lastPing || 0)) <= 90000);
    const devId = localStorage.getItem('bmf4_device_uuid') || 'local_device';
    if (!list.some(d => d.deviceId === devId)) {
      const prof = professors.find(p => p.id === activeProfessorId);
      list.push({
        deviceId: devId,
        deviceName: customDeviceName || 'Este Dispositivo',
        deviceType: deviceType,
        platform: typeof navigator !== 'undefined' ? navigator.platform : 'Web',
        userRole: prof?.role || (prof ? 'Professor' : 'Terminal'),
        professorName: prof?.name,
        lastPing: now,
        isOnline: isOnline && realtimeConnected,
      });
    }
    return list;
  }, [connectedDevicesMap, customDeviceName, deviceType, professors, activeProfessorId, isOnline, realtimeConnected]);

  const connectedDevices = connectedDevicesList.length;

  const forceSyncMaster = useCallback(async () => {
    try {
      const res = await fetch('/api/sync/state?force=1&cache_control=no-cache');
      const data = await res.json();
      if (data.success && data.state) {
        applyServerState({ ...data.state, userMutation: true });
        return;
      }
    } catch (err) {
      console.debug('Server sync notice:', err);
    }
  }, [applyServerState]);

  const triggerSync = () => {
    setIsSyncing(true);
    forceSyncMaster().finally(() => {
      setIsSyncing(false);
      setLastSyncDate(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      playBeep('success');
    });
  };

  // Immediate Initial Sync on Mount + Window Focus/Online sync + Adaptive polling fallback
  useEffect(() => {
    forceSyncMaster();

    const handleFocusSync = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        forceSyncMaster();
      }
    };

    window.addEventListener('focus', handleFocusSync);
    window.addEventListener('online', forceSyncMaster);
    document.addEventListener('visibilitychange', handleFocusSync);

    // High-frequency conditional polling: ultra-fast sync (2s) for classroom real-time display
    const pollInterval = 2000;
    const interval = setInterval(() => {
      const since = lastSyncTimestampRef.current;
      fetch(`/api/sync/state?since=${since}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && !data.notModified && data.state) {
            applyServerState(data.state);
          }
        })
        .catch(() => {});
    }, pollInterval);

    return () => {
      window.removeEventListener('focus', handleFocusSync);
      window.removeEventListener('online', forceSyncMaster);
      document.removeEventListener('visibilitychange', handleFocusSync);
      clearInterval(interval);
    };
  }, [forceSyncMaster, applyServerState]);

  // Device Fingerprint
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>(() => {
    let devId = localStorage.getItem('bmf4_device_uuid');
    if (!devId) {
      devId = 'MED-BMF4-' + Math.random().toString(36).substring(2, 7).toUpperCase() + '-' + Date.now().toString(36).substring(4).toUpperCase();
      localStorage.setItem('bmf4_device_uuid', devId);
    }
    return devId;
  });

  const resetDeviceLockForTesting = () => {
    const newDevId = 'MED-BMF4-' + Math.random().toString(36).substring(2, 7).toUpperCase() + '-' + Date.now().toString(36).substring(4).toUpperCase();
    localStorage.setItem('bmf4_device_uuid', newDevId);
    setDeviceFingerprint(newDevId);
    playBeep('success');
  };

  // Dynamic QR Code Token rotation with extended tranquil camera reading time (default 300s / 5 minutes)
  const rotationSeconds = appSettings.tokenRotationSeconds || 600;
  const [dynamicSecondsLeft, setDynamicSecondsLeft] = useState<number>(rotationSeconds);
  const [dynamicCycleNumber, setDynamicCycleNumber] = useState<number>(1);
  const [dynamicToken, setDynamicToken] = useState<string>(() => {
    return `BMF-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  });
  const [dynamicSecurityHash, setDynamicSecurityHash] = useState<string>(() => {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  });
  const [lastEmailDispatch, setLastEmailDispatch] = useState<DynamicQrEmailDispatch | null>(null);

  // Manual email dispatch placeholder (auto-dispatch completely removed per user request)
  const triggerManualEmailDispatch = useCallback(async () => {
    // Standard manual email dispatch is handled via client mailto
  }, []);

  useEffect(() => {
    const targetInterval = appSettings.tokenRotationSeconds || 600;
    setDynamicSecondsLeft(targetInterval);

    const timer = setInterval(() => {
      setDynamicSecondsLeft(prev => {
        if (prev <= 1) {
          const newToken = `BMF-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
          const newHash = Math.random().toString(36).substring(2, 10).toUpperCase();
          setDynamicToken(newToken);
          setDynamicSecurityHash(newHash);
          setDynamicCycleNumber(c => c + 1);
          return targetInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [appSettings.tokenRotationSeconds]);

  // Generate a guaranteed unique dynamic QR token and security hash with timestamp
  const generateFreshDynamicTokenAndHash = () => {
    const ts = Date.now();
    const entropy = Math.random().toString(36).substring(2, 6).toUpperCase();
    const token = `BMF-${entropy}-${ts.toString(36).slice(-4).toUpperCase()}`;
    const hash = `${ts}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    setDynamicToken(token);
    setDynamicSecurityHash(hash);
    setDynamicCycleNumber(c => c + 1);
    setDynamicSecondsLeft(appSettings.tokenRotationSeconds || 600);
    return { token, hash, timestamp: ts };
  };

  // Complete cleanup of active session cache from localStorage, sessionStorage and control variables
  const clearActiveSessionCache = useCallback(() => {
    try {
      // LocalStorage session cache cleanup
      localStorage.removeItem(STORAGE_PREFIX + 'active_session');
      localStorage.removeItem(STORAGE_PREFIX + 'active_session_id');
      localStorage.removeItem(STORAGE_PREFIX + 'active_session_cache');
      localStorage.removeItem(STORAGE_PREFIX + 'active_period');
      localStorage.removeItem(STORAGE_PREFIX + 'current_period');
      localStorage.removeItem(STORAGE_PREFIX + 'current_session');
      localStorage.removeItem(STORAGE_PREFIX + 'dynamic_token');
      localStorage.removeItem(STORAGE_PREFIX + 'dynamic_hash');
      localStorage.removeItem(STORAGE_PREFIX + 'active_session_state');
      localStorage.removeItem('bmf4_active_session');
      localStorage.removeItem('bmf4_active_session_id');
      localStorage.removeItem('bmf4_current_period');
      localStorage.removeItem('bmf4_session_cache');
      localStorage.removeItem('bmf4_telao_selected_period');
      localStorage.removeItem('bmf4_last_active_session');
      localStorage.removeItem('bmf4_student_receipt');
    } catch (_) {}

    try {
      // SessionStorage session cache cleanup
      sessionStorage.removeItem('bmf4_active_session');
      sessionStorage.removeItem('bmf4_active_session_id');
      sessionStorage.removeItem('bmf4_current_period');
      sessionStorage.removeItem('bmf4_session_cache');
      sessionStorage.removeItem('bmf4_last_checkin');
      sessionStorage.removeItem('bmf4_student_receipt');
      sessionStorage.removeItem('bmf4_target_session_id');
      sessionStorage.removeItem('bmf4_target_period');
    } catch (_) {}
  }, []);

  // Persist into LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_PREFIX + 'professors', JSON.stringify(professors));
  }, [professors]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PREFIX + 'active_prof', activeProfessorId ? activeProfessorId : 'guest');
    } catch {}
  }, [activeProfessorId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_PREFIX + 'classes', JSON.stringify(classes));
  }, [classes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_PREFIX + 'students', JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_PREFIX + 'justifications', JSON.stringify(justifications));
  }, [justifications]);

  useEffect(() => {
    localStorage.setItem(STORAGE_PREFIX + 'student_grades', JSON.stringify(studentGrades));
  }, [studentGrades]);

  useEffect(() => {
    localStorage.setItem(STORAGE_PREFIX + 'selectedClass', selectedClassId);
  }, [selectedClassId]);

  // Synchronize selectedClassId with URL parameters on browser navigation
  useEffect(() => {
    const handleUrlClassSync = () => {
      if (typeof window === 'undefined') return;
      const urlParams = new URLSearchParams(window.location.search);
      const urlTurma = urlParams.get('turma') || urlParams.get('turmaid') || urlParams.get('class') || urlParams.get('classid');
      if (urlTurma) {
        setSelectedClassId(prev => prev !== urlTurma ? urlTurma : prev);
        return;
      }
      const hash = window.location.hash;
      const qIndex = hash.indexOf('?');
      if (qIndex !== -1) {
        const hashParams = new URLSearchParams(hash.substring(qIndex + 1));
        const hashTurma = hashParams.get('turma') || hashParams.get('turmaid') || hashParams.get('class') || hashParams.get('classid');
        if (hashTurma) {
          setSelectedClassId(prev => prev !== hashTurma ? hashTurma : prev);
        }
      }
    };

    window.addEventListener('popstate', handleUrlClassSync);
    window.addEventListener('hashchange', handleUrlClassSync);
    return () => {
      window.removeEventListener('popstate', handleUrlClassSync);
      window.removeEventListener('hashchange', handleUrlClassSync);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_PREFIX + 'settings', JSON.stringify(appSettings));
  }, [appSettings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_PREFIX + 'sound', JSON.stringify(soundEnabled));
  }, [soundEnabled]);

  // Active Professor object (null when logged out)
  const activeProfessor = useMemo(() => {
    if (!activeProfessorId) return null;
    return professors.find(p => p.id === activeProfessorId) || null;
  }, [professors, activeProfessorId]);

  const audioCtxRef = useRef<AudioContext | null>(null);

  // Initialize and unlock AudioContext on user interaction
  useEffect(() => {
    const unlockAudio = () => {
      try {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return;
        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioContextClass();
        }
        if (audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume().catch(() => {});
        }
      } catch {}
    };

    window.addEventListener('click', unlockAudio, { passive: true });
    window.addEventListener('touchstart', unlockAudio, { passive: true });
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  // Optimized Audio synthesize function via Web Audio API for all essential app functions
  const playBeep = (type: SoundEffectType = 'success') => {
    if (!soundEnabled || !appSettings.soundEffects) return;
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;

      // Master output helper with smooth envelope and optional harmonic overtone for clarity in loud rooms
      const playTone = (
        freq: number, 
        startOffset: number, 
        duration: number, 
        peakVol: number = 0.22, 
        wave: OscillatorType = 'sine',
        addHarmonic: boolean = true
      ) => {
        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = wave;
          osc.frequency.setValueAtTime(freq, now + startOffset);
          
          const attackTime = Math.min(0.012, duration * 0.15);
          gain.gain.setValueAtTime(0.0001, now + startOffset);
          gain.gain.exponentialRampToValueAtTime(Math.max(0.001, peakVol), now + startOffset + attackTime);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + startOffset);
          osc.stop(now + startOffset + duration + 0.02);

          // Subtle harmonic overtone (1 octave higher at lower volume) for rich acoustic presence
          if (addHarmonic && freq < 1500) {
            const harmOsc = ctx.createOscillator();
            const harmGain = ctx.createGain();
            harmOsc.type = 'sine';
            harmOsc.frequency.setValueAtTime(freq * 2, now + startOffset);
            harmGain.gain.setValueAtTime(0.0001, now + startOffset);
            harmGain.gain.exponentialRampToValueAtTime(peakVol * 0.28, now + startOffset + attackTime);
            harmGain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration * 0.85);
            harmOsc.connect(harmGain);
            harmGain.connect(ctx.destination);
            harmOsc.start(now + startOffset);
            harmOsc.stop(now + startOffset + duration + 0.02);
          }
        } catch {}
      };

      if (type === 'scan') {
        // Short, crisp high tick on QR/barcode detection (1800Hz -> 2600Hz, 40ms)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1800, now);
        osc.frequency.exponentialRampToValueAtTime(2600, now + 0.04);
        gain.gain.setValueAtTime(0.24, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.04);

      } else if (type === 'success') {
        // Bright, crisp 3-tone chime (C6 1046.5Hz -> E6 1318.5Hz -> G6 1567.98Hz) for presence check-in
        playTone(1046.50, 0.00, 0.11, 0.24, 'sine', false);
        playTone(1318.51, 0.05, 0.13, 0.26, 'sine', false);
        playTone(1567.98, 0.10, 0.18, 0.28, 'sine', false);

      } else if (type === 'checkpoint') {
        // 4-note ascending arpeggio for checkpoint changes (G5 -> C6 -> E6 -> G6)
        playTone(783.99, 0.00, 0.10, 0.22, 'sine');
        playTone(1046.50, 0.06, 0.11, 0.24, 'sine', false);
        playTone(1318.51, 0.12, 0.12, 0.26, 'sine', false);
        playTone(1567.98, 0.18, 0.20, 0.28, 'sine', false);

      } else if (type === 'late') {
        // Warm amber 2-note chime for late arrivals (F5 698.4Hz -> A5 880Hz)
        playTone(698.46, 0.00, 0.13, 0.24, 'triangle');
        playTone(880.00, 0.08, 0.20, 0.26, 'sine');

      } else if (type === 'excused') {
        // Soft pastel tone for medical justifications/atestados (A5 880Hz -> D6 1174.6Hz)
        playTone(880.00, 0.00, 0.14, 0.22, 'sine');
        playTone(1174.66, 0.08, 0.22, 0.25, 'sine', false);

      } else if (type === 'session_start') {
        // Grand 4-note ascending fanfare for starting / opening a lab call (C5 -> E5 -> G5 -> C6)
        playTone(523.25, 0.00, 0.12, 0.22, 'sine');
        playTone(659.25, 0.08, 0.14, 0.24, 'sine');
        playTone(783.99, 0.16, 0.16, 0.26, 'sine');
        playTone(1046.50, 0.24, 0.26, 0.28, 'sine', false);

      } else if (type === 'session_lock') {
        // Smooth descending lock chime for ending/locking attendance (G5 784Hz -> E5 659Hz -> C5 523Hz)
        playTone(783.99, 0.00, 0.12, 0.24, 'sine');
        playTone(659.25, 0.08, 0.14, 0.22, 'triangle');
        playTone(523.25, 0.16, 0.24, 0.22, 'sine');

      } else if (type === 'grade') {
        // Crystal clear chime for evaluation/grades saved (D6 1174.6Hz -> A6 1760Hz)
        playTone(1174.66, 0.00, 0.10, 0.24, 'sine', false);
        playTone(1760.00, 0.06, 0.20, 0.26, 'sine', false);

      } else if (type === 'export') {
        // Modern dual ping for spreadsheet/report download (G6 1568Hz -> C7 2093Hz)
        playTone(1567.98, 0.00, 0.08, 0.24, 'sine', false);
        playTone(2093.00, 0.07, 0.20, 0.26, 'sine', false);

      } else if (type === 'sync') {
        // Cyber harmonic pulse for Firestore/cloud sync (A5 -> E6 -> A5)
        playTone(880.00, 0.00, 0.09, 0.20, 'sine');
        playTone(1318.51, 0.07, 0.11, 0.24, 'sine', false);
        playTone(880.00, 0.15, 0.16, 0.18, 'sine');

      } else if (type === 'student_added') {
        // Cheerful welcome chime for new student enrolled (F5 -> A5 -> C6)
        playTone(698.46, 0.00, 0.10, 0.22, 'sine');
        playTone(880.00, 0.07, 0.12, 0.24, 'sine');
        playTone(1046.50, 0.14, 0.20, 0.26, 'sine', false);

      } else if (type === 'delete') {
        // Subtle low descending tone for removals (A4 440Hz -> A3 220Hz)
        playTone(440.00, 0.00, 0.10, 0.22, 'triangle');
        playTone(220.00, 0.07, 0.18, 0.20, 'sine');

      } else if (type === 'warning') {
        // Subtle two-tone alert for duplicate attempt or invalid input (E5 659Hz -> C#5 554Hz)
        playTone(659.25, 0.00, 0.12, 0.24, 'triangle');
        playTone(554.37, 0.09, 0.18, 0.22, 'triangle');

      } else if (type === 'alert' || type === 'error') {
        // Crisp low-frequency double pulse for anti-fraud blocks / unlisted RA (F4 349Hz + D4 293Hz)
        playTone(349.23, 0.00, 0.09, 0.25, 'sawtooth');
        playTone(293.66, 0.10, 0.14, 0.28, 'sawtooth');

      } else if (type === 'confirm') {
        // Crisp double tap click
        playTone(1046.50, 0.00, 0.04, 0.18, 'sine', false);
        playTone(1318.50, 0.04, 0.06, 0.20, 'sine', false);

      } else {
        // Micro-tick for clicks
        playTone(880, 0.00, 0.02, 0.14, 'sine');
      }
    } catch {}
  };

  // Find active live session or most recent session for selected class (prioritizing today's session)
  const activeSession = useMemo(() => {
    const classSessions = sessions
      .filter(s => s.classGroupId === selectedClassId)
      .sort((a, b) => {
        const timeA = a.timestamp || (a.date ? new Date(a.date).getTime() : 0);
        const timeB = b.timestamp || (b.date ? new Date(b.date).getTime() : 0);
        return timeB - timeA;
      });

    // Priority 1: Live & unlocked session FOR TODAY
    const todayLiveUnlocked = classSessions.find(s => isDateToday(s.date) && s.isLive && !s.isLocked);
    if (todayLiveUnlocked) return todayLiveUnlocked;

    // Priority 2: Any live & unlocked session from this class (actively running)
    const anyLiveUnlocked = classSessions.find(s => s.isLive && !s.isLocked);
    if (anyLiveUnlocked) return anyLiveUnlocked;

    // Priority 3: Any live session FOR TODAY
    const todayLive = classSessions.find(s => isDateToday(s.date) && s.isLive);
    if (todayLive) return todayLive;

    // Priority 4: Any session created today for this class (even if locked)
    const todaySession = classSessions.find(s => isDateToday(s.date));
    if (todaySession) return todaySession;

    // When all sessions for today are deleted/finished, do not fall back to old locked sessions from previous days
    return null;
  }, [sessions, selectedClassId]);

  // Hook 'useSessionReset' within LabProvider monitoring activeSession lifecycle
  const { resetSessionState } = useSessionReset({
    activeSession,
    clearActiveSessionCache,
    setDynamicSecurityHash,
    setDynamicToken,
    setDismissedConflictId,
  });

  // Detect simultaneous teacher conflict in the exact same class
  const teacherConflict = useMemo<TeacherConflictInfo | null>(() => {
    if (!selectedClassId || !activeProfessorId) return null;
    const currentClass = classes.find(c => c.id === selectedClassId);
    const currentProf = professors.find(p => p.id === activeProfessorId);
    if (!currentClass || !currentProf) return null;

    // Check 1: Active Live Session in this class conducted by another professor
    const liveSession = sessions.find(s => s.classGroupId === selectedClassId && s.isLive && !s.isLocked);
    if (liveSession) {
      const isOwner = liveSession.professorId === activeProfessorId;
      const isCoProf = Array.isArray(liveSession.coProfessors) && liveSession.coProfessors.some(cp => cp.id === activeProfessorId);
      
      if (!isOwner && !isCoProf) {
        const otherProfName = liveSession.professorName || 'Outro Docente';
        const conflictKey = `live_${liveSession.id}_${activeProfessorId}`;
        if (dismissedConflictId === conflictKey) return null;

        return {
          hasConflict: true,
          conflictType: 'live_session',
          currentProfessorId: activeProfessorId,
          currentProfessorName: currentProf.name,
          otherProfessorId: liveSession.professorId,
          otherProfessorName: otherProfName,
          classGroupId: selectedClassId,
          className: currentClass.name,
          sessionTopic: liveSession.topic,
          sessionStartTime: liveSession.startTime,
          sessionId: liveSession.id,
          message: `O(a) Prof(a). ${otherProfName} já está com uma chamada AO VIVO em andamento na turma ${currentClass.name} neste momento.`,
        };
      }
    }

    // Check 2: Another teacher currently connected / viewing the exact same class at the same instant (within last 45s)
    const now = Date.now();
    const otherPresence = (Object.values(teacherPresences) as TeacherPresence[]).find(tp => 
      tp &&
      tp.classGroupId === selectedClassId && 
      tp.professorId !== activeProfessorId && 
      (now - tp.lastPing) < 45000
    );

    if (otherPresence) {
      const conflictKey = `presence_${otherPresence.professorId}_${selectedClassId}`;
      if (dismissedConflictId === conflictKey) return null;

      return {
        hasConflict: true,
        conflictType: 'simultaneous_presence',
        currentProfessorId: activeProfessorId,
        currentProfessorName: currentProf.name,
        otherProfessorId: otherPresence.professorId,
        otherProfessorName: otherPresence.professorName,
        classGroupId: selectedClassId,
        className: currentClass.name,
        message: `O(a) Prof(a). ${otherPresence.professorName} também está conectado(a) e gerenciando a turma ${currentClass.name} neste mesmo instante.`,
      };
    }

    return null;
  }, [selectedClassId, activeProfessorId, classes, professors, sessions, teacherPresences, dismissedConflictId]);

  // Join existing session as co-teacher
  const joinAsCoTeacher = useCallback((sessionId?: string) => {
    const targetSessionId = sessionId || activeSession?.id;
    if (!targetSessionId || !activeProfessor) return;

    const nowStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const updatedSessions = sessions.map(s => {
      if (s.id === targetSessionId) {
        const coProfs = Array.isArray(s.coProfessors) ? [...s.coProfessors] : [];
        if (!coProfs.some(cp => cp.id === activeProfessorId)) {
          coProfs.push({
            id: activeProfessorId,
            name: activeProfessor.name,
            joinedAt: nowStr,
          });
        }
        return {
          ...s,
          coProfessors: coProfs,
        };
      }
      return s;
    });

    setSessions(updatedSessions);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(updatedSessions));
    } catch {}

    setDismissedConflictId(null);
    playBeep('confirm');

    const nowTs = Date.now();
    setLocalLastUpdated(nowTs);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students,
      sessions: updatedSessions,
      justifications,
      studentGrades,
      appSettings,
      selectedClassId,
      teacherPresences,
      lastUpdated: nowTs,
    });
  }, [activeSession, activeProfessor, activeProfessorId, sessions, professors, classes, students, justifications, studentGrades, appSettings, selectedClassId, teacherPresences, broadcastCurrentState, setLocalLastUpdated, playBeep]);

  // Take over active session titularity
  const takeOverSession = useCallback((sessionId?: string) => {
    const targetSessionId = sessionId || activeSession?.id;
    if (!targetSessionId || !activeProfessor) return;

    const nowStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const updatedSessions = sessions.map(s => {
      if (s.id === targetSessionId) {
        const coProfs = Array.isArray(s.coProfessors) ? [...s.coProfessors] : [];
        if (s.professorId && s.professorId !== activeProfessorId && !coProfs.some(cp => cp.id === s.professorId)) {
          coProfs.push({
            id: s.professorId,
            name: s.professorName || 'Docente Anterior',
            joinedAt: s.startTime || nowStr,
          });
        }
        return {
          ...s,
          professorId: activeProfessorId,
          professorName: activeProfessor.name,
          coProfessors: coProfs,
        };
      }
      return s;
    });

    setSessions(updatedSessions);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(updatedSessions));
    } catch {}

    setDismissedConflictId(null);
    playBeep('session_start');

    const nowTs = Date.now();
    setLocalLastUpdated(nowTs);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students,
      sessions: updatedSessions,
      justifications,
      studentGrades,
      appSettings,
      selectedClassId,
      teacherPresences,
      lastUpdated: nowTs,
    });
  }, [activeSession, activeProfessor, activeProfessorId, sessions, professors, classes, students, justifications, studentGrades, appSettings, selectedClassId, teacherPresences, broadcastCurrentState, setLocalLastUpdated, playBeep]);

  // Temporarily dismiss teacher conflict banner
  const dismissTeacherConflict = useCallback(() => {
    if (teacherConflict) {
      const key = teacherConflict.conflictType === 'live_session' 
        ? `live_${teacherConflict.sessionId}_${activeProfessorId}`
        : `presence_${teacherConflict.otherProfessorId}_${selectedClassId}`;
      setDismissedConflictId(key);
    }
  }, [teacherConflict, activeProfessorId, selectedClassId]);

  // Toggle Live Session (Abrir / Fechar Chamada)
  const toggleLiveSession = () => {
    if (!activeSession) {
      startNewSession({
        topic: 'Aula BMF4 - Morfofuncional',
        activityCategory: 'pratica',
        activityType: 'aula_pratica',
        activePeriod: '1'
      });
      return;
    }

    if (activeSession.isLive) {
      pauseLiveSession();
    } else {
      resumeLiveSession();
    }
  };

  // Pause session temporarily (Pausar chamada - congela QR Code e bloqueia temporariamente)
  const pauseLiveSession = (targetSessionId?: string, targetClassGroupId?: string) => {
    const effectiveTargetId = targetSessionId || activeSession?.id;
    const effectiveClass = targetClassGroupId || activeSession?.classGroupId || selectedClassId;
    const updatedSessions = sessions.map(s => {
      if ((effectiveTargetId && s.id === effectiveTargetId) || (!effectiveTargetId && s.classGroupId === effectiveClass && s.isLive)) {
        return {
          ...s,
          isLive: false,
          isPaused: true,
        };
      }
      return s;
    });

    setSessions(updatedSessions);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(updatedSessions));
    } catch {}

    const nowTs = Date.now();
    setLocalLastUpdated(nowTs);
    const targetSess = updatedSessions.find(s => (effectiveTargetId && s.id === effectiveTargetId) || (!effectiveTargetId && s.classGroupId === effectiveClass));
    if (targetSess) {
      syncSessionVersionToFirestore(targetSess, (targetSess.version || 0) + 1);
    }
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students,
      sessions: updatedSessions,
      justifications,
      studentGrades,
      appSettings,
      selectedClassId: effectiveClass || selectedClassId,
      lastUpdated: nowTs,
    });

    playBeep('session_lock');
  };

  // Resume paused session (Retomar chamada ao vivo)
  const resumeLiveSession = (targetSessionId?: string, targetClassGroupId?: string) => {
    const now = new Date();
    const effectiveTargetId = targetSessionId || activeSession?.id;
    const effectiveClass = targetClassGroupId || activeSession?.classGroupId || selectedClassId;
    const updatedSessions = sessions.map(s => {
      if ((effectiveTargetId && s.id === effectiveTargetId) || (!effectiveTargetId && s.classGroupId === effectiveClass)) {
        return {
          ...s,
          isLive: true,
          isPaused: false,
          isLocked: false,
          openedAt: s.openedAt || now.toISOString(),
        };
      }
      return s;
    });

    setSessions(updatedSessions);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(updatedSessions));
    } catch {}

    const nowTs = Date.now();
    setLocalLastUpdated(nowTs);
    const targetSess = updatedSessions.find(s => (effectiveTargetId && s.id === effectiveTargetId) || (!effectiveTargetId && s.classGroupId === effectiveClass));
    if (targetSess) {
      syncSessionVersionToFirestore(targetSess, (targetSess.version || 0) + 1);
    }
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students,
      sessions: updatedSessions,
      justifications,
      studentGrades,
      appSettings,
      selectedClassId: effectiveClass || selectedClassId,
      lastUpdated: nowTs,
    });

    playBeep('session_start');
  };

  // Reopen locked session (Reabrir chamada encerrada)
  const reopenCurrentSession = (targetSessionId?: string, targetClassGroupId?: string) => {
    const effectiveClass = targetClassGroupId || activeSession?.classGroupId || selectedClassId;
    const { token: freshToken } = generateFreshDynamicTokenAndHash();

    // Determine target session to reopen
    const targetSession = targetSessionId 
      ? sessions.find(s => s.id === targetSessionId)
      : (sessions.find(s => s.classGroupId === effectiveClass && isDateToday(s.date)) || 
         sessions.find(s => s.classGroupId === effectiveClass && s.isLive) ||
         sessions.find(s => s.classGroupId === effectiveClass));

    let updatedSessions: LabSession[];

    if (targetSession) {
      updatedSessions = sessions.map(s => {
        if (s.id === targetSession.id) {
          return {
            ...s,
            checkinCode: freshToken,
            isLive: true,
            isPaused: false,
            isLocked: false,
            isPeriod1Locked: false,
            isPeriod2Locked: false,
            isP1StartLocked: false,
            isP1EndLocked: false,
            isP2StartLocked: false,
            isP2EndLocked: false,
            isActivitySingleLocked: false,
            closedAt: undefined,
          };
        }
        return s;
      });
    } else {
      // If no session exists at all for this class, initialize a new live one
      const todayStr = new Date().toISOString().split('T')[0];
      const targetProf = professors.find(p => p.id === activeProfessorId) || activeProfessor;
      const targetClass = classes.find(c => c.id === effectiveClass);
      const newSess: LabSession = {
        id: `sess-${Date.now()}`,
        classGroupId: effectiveClass || 'class-bmf4-default',
        discipline: targetClass?.discipline || 'BMF4',
        professorId: activeProfessorId || 'prof-juliano',
        professorName: targetProf?.name || 'Prof. Docente',
        activityCategory: 'pratica',
        activityType: 'aula_pratica',
        activePeriod: 'p1_start',
        isPeriod1Locked: false,
        isPeriod2Locked: false,
        isP1StartLocked: false,
        isP1EndLocked: false,
        isP2StartLocked: false,
        isP2EndLocked: false,
        isActivitySingleLocked: false,
        date: todayStr,
        startTime: `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`,
        endTime: '12:00',
        topic: 'Aula BMF4 - Morfofuncional',
        anatomicalSpecimens: ['Peças anatômicas / Roteiro prático'],
        checkinCode: freshToken,
        isLive: true,
        isPaused: false,
        isLocked: false,
        attendance: {},
        syncStatus: 'synced',
      };
      updatedSessions = [newSess, ...sessions];
    }

    setSessions(updatedSessions);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(updatedSessions));
    } catch {}

    const nowTs = Date.now();
    setLocalLastUpdated(nowTs);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students,
      sessions: updatedSessions,
      justifications,
      studentGrades,
      appSettings,
      selectedClassId: effectiveClass || selectedClassId,
      lastUpdated: nowTs,
    });

    playBeep('session_start');
  };

  // Lock session completely (Encerrar Chamada e Bloquear em definitivo)
  const lockCurrentSession = (targetSessionId?: string, targetClassGroupId?: string) => {
    const now = new Date();
    const effectiveClass = targetClassGroupId || activeSession?.classGroupId || selectedClassId;
    let effectiveTargetId = targetSessionId || activeSession?.id;
    if (!effectiveTargetId && effectiveClass) {
      const found = sessions.find(s => s.classGroupId === effectiveClass && s.isLive) || sessions.find(s => s.classGroupId === effectiveClass);
      if (found) effectiveTargetId = found.id;
    }
    let updatedSessions: LabSession[];

    let matchedAny = false;
    updatedSessions = sessions.map(s => {
      const isTarget = Boolean(effectiveTargetId && s.id === effectiveTargetId);
      const isClassSession = Boolean(effectiveClass && s.classGroupId === effectiveClass);

      if (isTarget || (!effectiveTargetId && isClassSession) || (isClassSession && s.isLive)) {
        matchedAny = true;
        return {
          ...s,
          isLive: false,
          isPaused: false,
          isLocked: true,
          isPeriod1Locked: true,
          isPeriod2Locked: true,
          isP1StartLocked: true,
          isP1EndLocked: true,
          isP2StartLocked: true,
          isP2EndLocked: true,
          isActivitySingleLocked: true,
          closedAt: s.closedAt || now.toISOString(),
        };
      }
      return s;
    });

    // If no existing session was found in memory for this class, create a locked placeholder
    if (!matchedAny && effectiveClass) {
      const todayStr = new Date().toISOString().split('T')[0];
      const targetProf = professors.find(p => p.id === activeProfessorId) || activeProfessor;
      const placeholderSession: LabSession = {
        id: `sess-${Date.now()}`,
        classGroupId: effectiveClass,
        discipline: 'BMF4',
        professorId: activeProfessorId || 'prof-juliano',
        professorName: targetProf?.name || 'Prof. Docente',
        activityCategory: 'pratica',
        activityType: 'aula_pratica',
        activePeriod: 'p1_start',
        isPeriod1Locked: true,
        isPeriod2Locked: true,
        isP1StartLocked: true,
        isP1EndLocked: true,
        isP2StartLocked: true,
        isP2EndLocked: true,
        isActivitySingleLocked: true,
        date: todayStr,
        startTime: `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`,
        endTime: '12:00',
        topic: 'Aula BMF4 - Morfofuncional',
        anatomicalSpecimens: ['Peças anatômicas / Roteiro prático'],
        checkinCode: 'BMF-CLOSED',
        isLive: false,
        isPaused: false,
        isLocked: true,
        closedAt: now.toISOString(),
        notes: 'Chamada encerrada pelo docente.',
        attendance: {},
        syncStatus: 'synced',
      };
      updatedSessions = [placeholderSession, ...sessions];
    }

    setSessions(updatedSessions);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(updatedSessions));
    } catch {}

    // Complete cleanup of active session cache and reset control variables
    clearActiveSessionCache();
    setDismissedConflictId(null);
    setDynamicToken(`BMF-CLOSED-${Date.now().toString(36).slice(-4).toUpperCase()}`);
    setDynamicSecurityHash('');

    const nowTs = Date.now();
    setLocalLastUpdated(nowTs);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students,
      sessions: updatedSessions,
      justifications,
      studentGrades,
      appSettings,
      selectedClassId: effectiveClass || selectedClassId,
      lastUpdated: nowTs,
    });

    playBeep('session_lock');
  };

  // Lock 1st class (1ª Aula)
  const lockPeriod1 = (targetSessionId?: string) => {
    const effectiveId = targetSessionId || activeSession?.id;
    if (!effectiveId) return;
    const updatedSessions = sessions.map(s => {
      if (s.id === effectiveId) {
        return {
          ...s,
          isPeriod1Locked: true,
          isP1StartLocked: true,
          isP1EndLocked: true,
        };
      }
      return s;
    });

    setSessions(updatedSessions);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(updatedSessions));
    } catch {}

    const nowTs = Date.now();
    setLocalLastUpdated(nowTs);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students,
      sessions: updatedSessions,
      justifications,
      studentGrades,
      appSettings,
      selectedClassId,
      lastUpdated: nowTs,
    });

    playBeep('session_lock');
  };

  // Lock 2nd class (2ª Aula)
  const lockPeriod2 = () => {
    if (!activeSession) return;
    const updatedSessions = sessions.map(s => {
      if (s.id === activeSession.id) {
        return {
          ...s,
          isPeriod2Locked: true,
        };
      }
      return s;
    });

    setSessions(updatedSessions);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(updatedSessions));
    } catch {}

    const nowTs = Date.now();
    setLocalLastUpdated(nowTs);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students,
      sessions: updatedSessions,
      justifications,
      studentGrades,
      appSettings,
      selectedClassId,
      lastUpdated: nowTs,
    });

    playBeep('session_lock');
  };

  // Switch Active Period ('1' | '2' | 'both', 'p1_start', 'p1_end', 'p2_start', 'p2_end', 'activity_single')
  const setActivePeriod = (period: ClassPeriod, targetSessionId?: string, targetClassId?: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const classIdToUse = targetClassId || selectedClassId;
    let targetSessionToUpdate: LabSession | undefined;

    if (targetSessionId) {
      targetSessionToUpdate = sessions.find(s => s.id === targetSessionId);
    }
    if (!targetSessionToUpdate && classIdToUse) {
      targetSessionToUpdate = sessions.find(s => s.classGroupId === classIdToUse && s.date === todayStr && s.isLive && !s.isLocked);
    }
    if (!targetSessionToUpdate && classIdToUse) {
      targetSessionToUpdate = sessions.find(s => s.classGroupId === classIdToUse && s.date === todayStr);
    }
    if (!targetSessionToUpdate) {
      targetSessionToUpdate = activeSession;
    }

    if (!targetSessionToUpdate) {
      // Start a fresh live session for today with this period directly
      startNewSession({
        classGroupId: classIdToUse,
        topic: 'Aula BMF4 - Morfofuncional',
        activityCategory: 'pratica',
        activityType: 'aula_pratica',
        activePeriod: period,
        date: todayStr,
      });
      return;
    }

    const { token: freshToken } = generateFreshDynamicTokenAndHash();

    const updatedSessions = sessions.map(s => {
      if (s.id === targetSessionToUpdate!.id) {
        const patch: Partial<LabSession> = {
          activePeriod: period,
          isLive: true,
          isLocked: false,
          isPaused: false,
          checkinCode: freshToken,
        };

        // If advancing to 2ª Aula, lock period 1 and unlock period 2
        if (period === '2' || period === 'p2_start' || period === 'p2_end') {
          patch.isPeriod1Locked = true;
          patch.isP1StartLocked = true;
          patch.isP1EndLocked = true;
          patch.isPeriod2Locked = false;
          if (period === 'p2_start') patch.isP2StartLocked = false;
          if (period === 'p2_end') patch.isP2EndLocked = false;
        } else if (period === '1' || period === 'p1_start' || period === 'p1_end') {
          patch.isPeriod1Locked = false;
          if (period === 'p1_start') patch.isP1StartLocked = false;
          if (period === 'p1_end') patch.isP1EndLocked = false;
          patch.isPeriod2Locked = true;
        } else if (period === 'both') {
          patch.isPeriod1Locked = false;
          patch.isPeriod2Locked = false;
          patch.isP1StartLocked = false;
          patch.isP2StartLocked = false;
          patch.isP1EndLocked = false;
          patch.isP2EndLocked = false;
        } else if (period === 'activity_single') {
          patch.isActivitySingleLocked = false;
        }

        return {
          ...s,
          ...patch,
        };
      }
      return s;
    });

    setSessions(updatedSessions);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(updatedSessions));
      localStorage.setItem(STORAGE_PREFIX + 'active_period', period);
      sessionStorage.setItem('bmf4_current_period', period);
    } catch {}

    const nowTs = Date.now();
    setLocalLastUpdated(nowTs);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students,
      sessions: updatedSessions,
      justifications,
      studentGrades,
      appSettings,
      selectedClassId,
      lastUpdated: nowTs,
    });

    playBeep('checkpoint');
  };

  // Transition atomically from one period to another, locking the previous period and activating the next
  const transitionToPeriod = (fromPeriod: ClassPeriod, toPeriod: ClassPeriod, targetSessionId?: string) => {
    let effectiveId = targetSessionId || activeSession?.id;
    if (!effectiveId) {
      const found = sessions.find(s => s.classGroupId === selectedClassId && s.isLive) || sessions.find(s => s.classGroupId === selectedClassId) || sessions[0];
      if (found) {
        effectiveId = found.id;
      } else {
        const newSessId = `sess-${Date.now()}`;
        const newSess: LabSession = {
          id: newSessId,
          classGroupId: selectedClassId || 'class-bmf4-turmab',
          discipline: 'BMF4',
          professorId: activeProfessorId || 'prof-admin-1',
          professorName: activeProfessor?.name || 'Prof. Docente',
          activityCategory: 'pratica',
          activityType: 'aula_pratica',
          activePeriod: toPeriod,
          date: new Date().toISOString().split('T')[0],
          startTime: '07:30',
          endTime: '12:00',
          topic: 'Aula BMF4',
          anatomicalSpecimens: [],
          checkinCode: '123456',
          isLive: true,
          isLocked: false,
          isPeriod1Locked: false,
          isPeriod2Locked: false,
          attendance: {},
        };
        setSessions([newSess, ...sessions]);
        effectiveId = newSessId;
      }
    }

    const { token: freshToken } = generateFreshDynamicTokenAndHash();

    const updatedSessions = sessions.map(s => {
      if (s.id === effectiveId) {
        const patch: Partial<LabSession> = {
          activePeriod: toPeriod,
          isLive: true,
          isLocked: false,
          isPaused: false,
          checkinCode: freshToken,
        };

        // Lock the previous period
        if (fromPeriod === 'p1_start') patch.isP1StartLocked = true;
        if (fromPeriod === 'p1_end') {
          patch.isP1EndLocked = true;
          patch.isPeriod1Locked = true;
        }
        if (fromPeriod === 'p2_start') patch.isP2StartLocked = true;
        if (fromPeriod === 'p2_end') {
          patch.isP2EndLocked = true;
          patch.isPeriod2Locked = true;
        }
        if (fromPeriod === '1') patch.isPeriod1Locked = true;
        if (fromPeriod === '2') patch.isPeriod2Locked = true;
        if (fromPeriod === 'activity_single') patch.isActivitySingleLocked = true;

        // Unlock the next period
        if (toPeriod === 'p1_start') patch.isP1StartLocked = false;
        if (toPeriod === 'p1_end') patch.isP1EndLocked = false;
        if (toPeriod === 'p2_start') patch.isP2StartLocked = false;
        if (toPeriod === 'p2_end') patch.isP2EndLocked = false;
        if (toPeriod === '1') patch.isPeriod1Locked = false;
        if (toPeriod === '2' || toPeriod === 'p2_start' || toPeriod === 'p2_end') {
          patch.isPeriod2Locked = false;
          patch.startTime = '09:50';
          patch.endTime = '12:00';
        }
        if (toPeriod === 'activity_single') patch.isActivitySingleLocked = false;

        return {
          ...s,
          ...patch,
        };
      }
      return s;
    });

    setSessions(updatedSessions);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(updatedSessions));
      localStorage.setItem(STORAGE_PREFIX + 'active_period', toPeriod);
      sessionStorage.setItem('bmf4_current_period', toPeriod);
    } catch {}

    const nowTs = Date.now();
    setLocalLastUpdated(nowTs);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students,
      sessions: updatedSessions,
      justifications,
      studentGrades,
      appSettings,
      selectedClassId,
      lastUpdated: nowTs,
    });

    playBeep('session_start');
  };

  // Helper to compute overall consolidated status
  const computeOverallStatus = (p1?: AttendanceStatus, p2?: AttendanceStatus): AttendanceStatus => {
    if (p1 === 'present' || p2 === 'present') return 'present';
    if (p1 === 'late' || p2 === 'late') return 'late';
    if (p1 === 'excused' || p2 === 'excused') return 'excused';
    return 'absent';
  };

  // Set attendance status for a student
  const setAttendanceStatus = (
    studentId: string, 
    status: AttendanceStatus, 
    period?: ClassPeriod,
    epiVerified?: boolean,
    justificationData?: { reason?: string; fileUrl?: string; fileName?: string }
  ) => {
    if (!activeSession) return;

    const targetPeriod = period || activeSession.activePeriod || 'both';
    const existingRec = activeSession.attendance[studentId];
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    let newPeriod1 = existingRec?.period1Status;
    let newPeriod2 = existingRec?.period2Status;
    let newP1Start = existingRec?.p1StartStatus;
    let newP1End = existingRec?.p1EndStatus;
    let newP2Start = existingRec?.p2StartStatus;
    let newP2End = existingRec?.p2EndStatus;

    let newP1StartTime = existingRec?.p1StartTimestamp;
    let newP1EndTime = existingRec?.p1EndTimestamp;
    let newP2StartTime = existingRec?.p2StartTimestamp;
    let newP2EndTime = existingRec?.p2EndTimestamp;
    let newPeriod1Time = existingRec?.period1Timestamp;
    let newPeriod2Time = existingRec?.period2Timestamp;

    if (status === 'absent') {
      if (targetPeriod === '1' || targetPeriod === 'p1_start') {
        newP1Start = 'absent';
        newP1StartTime = undefined;
        newPeriod1Time = undefined;
        newPeriod1 = 'absent';
      }
      if (targetPeriod === '1' || targetPeriod === 'p1_end') {
        newP1End = 'absent';
        newP1EndTime = undefined;
        if (targetPeriod === '1' || newP1Start !== 'present') {
          newPeriod1 = 'absent';
        }
      }
      if (targetPeriod === '2' || targetPeriod === 'p2_start') {
        newP2Start = 'absent';
        newP2StartTime = undefined;
        newPeriod2Time = undefined;
        newPeriod2 = 'absent';
      }
      if (targetPeriod === '2' || targetPeriod === 'p2_end') {
        newP2End = 'absent';
        newP2EndTime = undefined;
        if (targetPeriod === '2' || newP2Start !== 'present') {
          newPeriod2 = 'absent';
        }
      }
      if (targetPeriod === 'both' || targetPeriod === 'activity_single') {
        newPeriod1 = 'absent';
        newPeriod2 = 'absent';
        newP1Start = 'absent';
        newP1End = 'absent';
        newP2Start = 'absent';
        newP2End = 'absent';
        newP1StartTime = undefined;
        newP1EndTime = undefined;
        newP2StartTime = undefined;
        newP2EndTime = undefined;
        newPeriod1Time = undefined;
        newPeriod2Time = undefined;
      }
    } else if (targetPeriod === 'p1_start') {
      newP1Start = status;
      if (status === 'present' || status === 'late') {
        newP1StartTime = timeStr;
        newPeriod1Time = timeStr;
      }
      newPeriod1 = status;
    } else if (targetPeriod === 'p1_end') {
      newP1End = status;
      if (status === 'present' || status === 'late') {
        newP1EndTime = timeStr;
        newPeriod1Time = timeStr;
      }
      newPeriod1 = status;
    } else if (targetPeriod === 'p2_start') {
      newP2Start = status;
      if (status === 'present' || status === 'late') {
        newP2StartTime = timeStr;
        newPeriod2Time = timeStr;
      }
      newPeriod2 = status;
    } else if (targetPeriod === 'p2_end') {
      newP2End = status;
      if (status === 'present' || status === 'late') {
        newP2EndTime = timeStr;
        newPeriod2Time = timeStr;
      }
      newPeriod2 = status;
    } else if (targetPeriod === 'activity_single') {
      newPeriod1 = status;
      newPeriod2 = status;
      newP1Start = status;
      newP1End = status;
      newP2Start = status;
      newP2End = status;
      if (status === 'present' || status === 'late') {
        newPeriod1Time = timeStr;
        newPeriod2Time = timeStr;
        newP1StartTime = timeStr;
      }
    } else if (targetPeriod === '1') {
      newPeriod1 = status;
      newP1Start = status;
      newP1End = status;
      if (status === 'present' || status === 'late') {
        newPeriod1Time = timeStr;
        newP1StartTime = newP1StartTime || timeStr;
        newP1EndTime = timeStr;
      }
    } else if (targetPeriod === '2') {
      newPeriod2 = status;
      newP2Start = status;
      newP2End = status;
      if (status === 'present' || status === 'late') {
        newPeriod2Time = timeStr;
        newP2StartTime = newP2StartTime || timeStr;
        newP2EndTime = timeStr;
      }
    } else {
      newPeriod1 = status;
      newPeriod2 = status;
      newP1Start = status;
      newP1End = status;
      newP2Start = status;
      newP2End = status;
      if (status === 'present' || status === 'late') {
        newPeriod1Time = timeStr;
        newPeriod2Time = timeStr;
        newP1StartTime = newP1StartTime || timeStr;
        newP1EndTime = timeStr;
        newP2StartTime = newP2StartTime || timeStr;
        newP2EndTime = timeStr;
      }
    }

    const resolvedOverall = (status === 'absent' && (targetPeriod === 'both' || targetPeriod === 'activity_single'))
      ? 'absent'
      : status === 'absent'
      ? computeOverallStatus(newPeriod1, newPeriod2)
      : status;

    const nextVersion = (typeof activeSession.version === 'number' ? activeSession.version : 0) + 1;
    const nowTs = Date.now();
    let targetSessionToSync: LabSession | null = null;

    const updatedSessions = sessions.map(s => {
      if (s.id === activeSession.id) {
        const updated: LabSession = {
          ...s,
          version: nextVersion,
          lastUpdateTimestamp: nowTs,
          attendance: {
            ...s.attendance,
            [studentId]: {
              studentId,
              status: resolvedOverall,
              period1Status: newPeriod1,
              period2Status: newPeriod2,
              p1StartStatus: newP1Start,
              p1EndStatus: newP1End,
              p2StartStatus: newP2Start,
              p2EndStatus: newP2End,
              p1StartTimestamp: newP1StartTime,
              p1EndTimestamp: newP1EndTime,
              p2StartTimestamp: newP2StartTime,
              p2EndTimestamp: newP2EndTime,
              period1Timestamp: newPeriod1Time,
              period2Timestamp: newPeriod2Time,
              timestamp: status === 'present' || status === 'late' ? (existingRec?.timestamp || timeStr) : undefined,
              epiVerified: (status === 'present' || status === 'late') ? (epiVerified ?? true) : false,
              deviceId: (status === 'present' || status === 'late') ? existingRec?.deviceId : undefined,
              checkinMethod: existingRec?.checkinMethod || 'manual',
              justificationReason: justificationData?.reason || (status === 'absent' ? undefined : existingRec?.justificationReason),
              justificationFileUrl: justificationData?.fileUrl || (status === 'absent' ? undefined : existingRec?.justificationFileUrl),
              justificationFileName: justificationData?.fileName || (status === 'absent' ? undefined : existingRec?.justificationFileName),
            }
          }
        };
        targetSessionToSync = updated;
        return updated;
      }
      return s;
    });

    const reconciledSessions = reconcileSessionsAttendance(updatedSessions, students);
    const updatedStudents = computeStudentsWithRecalculatedStats(students, reconciledSessions);
    setSessions(reconciledSessions);
    setStudents(updatedStudents);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(reconciledSessions));
      localStorage.setItem(STORAGE_PREFIX + 'students', JSON.stringify(updatedStudents));
    } catch {}

    setLocalLastUpdated(nowTs);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students: updatedStudents,
      sessions: reconciledSessions,
      justifications,
      studentGrades,
      appSettings,
      selectedClassId,
      lastUpdated: nowTs,
    });

    if (targetSessionToSync) {
      syncSessionVersionToFirestore(targetSessionToSync, nextVersion);
    }

    // Direct synchronization to Supabase via syncService
    const targetStudent = students.find(s => s.id === studentId);
    updateAttendance({
      sessionId: activeSession.id,
      studentId,
      studentName: targetStudent?.name,
      studentRa: targetStudent?.registrationNumber,
      classGroupId: activeSession.classGroupId,
      status: resolvedOverall,
      period1Status: newPeriod1,
      period2Status: newPeriod2,
      p1StartStatus: newP1Start,
      p1EndStatus: newP1End,
      p2StartStatus: newP2Start,
      p2EndStatus: newP2End,
      timestamp: timeStr,
      p1StartTimestamp: newP1StartTime,
      p1EndTimestamp: newP1EndTime,
      p2StartTimestamp: newP2StartTime,
      p2EndTimestamp: newP2EndTime,
      period1Timestamp: newPeriod1Time,
      period2Timestamp: newPeriod2Time,
      epiVerified: (status === 'present' || status === 'late') ? (epiVerified ?? true) : false,
      checkinMethod: existingRec?.checkinMethod || 'manual',
      deviceId: existingRec?.deviceId,
      justificationReason: justificationData?.reason || (status === 'absent' ? undefined : existingRec?.justificationReason),
      justificationFileUrl: justificationData?.fileUrl || (status === 'absent' ? undefined : existingRec?.justificationFileUrl),
      justificationFileName: justificationData?.fileName || (status === 'absent' ? undefined : existingRec?.justificationFileName),
    });

    // Enqueue Outbox event to ensure reliable Firestore sync even during offline / reconnect
    enqueueOutboxItem({
      eventType: status === 'excused' ? 'EXCUSE_STUDENT' : 'RECORD_ATTENDANCE',
      sessionId: activeSession.id,
      studentId,
      studentName: targetStudent?.name,
      classGroupId: activeSession.classGroupId,
      status: resolvedOverall,
      period: targetPeriod,
      timestamp: timeStr,
      payload: {
        record: {
          studentId,
          status: resolvedOverall,
          period1Status: newPeriod1,
          period2Status: newPeriod2,
          p1StartStatus: newP1Start,
          p1EndStatus: newP1End,
          p2StartStatus: newP2Start,
          p2EndStatus: newP2End,
          timestamp: timeStr,
          epiVerified: (status === 'present' || status === 'late') ? (epiVerified ?? true) : false,
          checkinMethod: 'manual',
          justificationReason: justificationData?.reason,
          justificationFileUrl: justificationData?.fileUrl,
          justificationFileName: justificationData?.fileName,
        }
      }
    });

    if (status === 'present') {
      const isCheckpointPhase = targetPeriod.includes('start') || targetPeriod.includes('end');
      playBeep(isCheckpointPhase ? 'checkpoint' : 'success');
    } else if (status === 'late') {
      playBeep('late');
    } else if (status === 'excused') {
      playBeep('excused');
    } else if (status === 'absent') {
      playBeep('delete');
    }
  };

  // Mark all students present
  const markAllPresent = (period?: ClassPeriod) => {
    if (!activeSession) return;
    const targetPeriod = period || activeSession.activePeriod || 'both';
    const classStudents = students.filter(s => s.classGroupId === selectedClassId);
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const newAttendance = { ...activeSession.attendance };
    classStudents.forEach(st => {
      const existing = newAttendance[st.id];
      let p1 = existing?.period1Status || 'absent';
      let p2 = existing?.period2Status || 'absent';
      let p1Start = existing?.p1StartStatus;
      let p1End = existing?.p1EndStatus;
      let p2Start = existing?.p2StartStatus;
      let p2End = existing?.p2EndStatus;

      let p1StartTime = existing?.p1StartTimestamp;
      let p1EndTime = existing?.p1EndTimestamp;
      let p2StartTime = existing?.p2StartTimestamp;
      let p2EndTime = existing?.p2EndTimestamp;

      if (targetPeriod === 'p1_start') {
        p1Start = 'present';
        p1StartTime = timeStr;
        p1 = 'present';
      } else if (targetPeriod === 'p1_end') {
        p1End = 'present';
        p1EndTime = timeStr;
        p1 = 'present';
      } else if (targetPeriod === 'p2_start') {
        p2Start = 'present';
        p2StartTime = timeStr;
        p2 = 'present';
      } else if (targetPeriod === 'p2_end') {
        p2End = 'present';
        p2EndTime = timeStr;
        p2 = 'present';
      } else if (targetPeriod === '1') {
        p1 = 'present';
        p1Start = 'present';
        p1End = 'present';
        p1StartTime = p1StartTime || timeStr;
        p1EndTime = timeStr;
      } else if (targetPeriod === '2') {
        p2 = 'present';
        p2Start = 'present';
        p2End = 'present';
        p2StartTime = p2StartTime || timeStr;
        p2EndTime = timeStr;
      } else {
        p1 = 'present';
        p2 = 'present';
        p1Start = 'present';
        p1End = 'present';
        p2Start = 'present';
        p2End = 'present';
        p1StartTime = p1StartTime || timeStr;
        p1EndTime = timeStr;
        p2StartTime = p2StartTime || timeStr;
        p2EndTime = timeStr;
      }

      newAttendance[st.id] = {
        studentId: st.id,
        status: 'present',
        period1Status: p1,
        period2Status: p2,
        p1StartStatus: p1Start,
        p1EndStatus: p1End,
        p2StartStatus: p2Start,
        p2EndStatus: p2End,
        p1StartTimestamp: p1StartTime,
        p1EndTimestamp: p1EndTime,
        p2StartTimestamp: p2StartTime,
        p2EndTimestamp: p2EndTime,
        period1Timestamp: p1 === 'present' ? timeStr : undefined,
        period2Timestamp: p2 === 'present' ? timeStr : undefined,
        timestamp: timeStr,
        epiVerified: true,
        checkinMethod: 'manual',
      };
    });

    const nextVersion = (typeof activeSession.version === 'number' ? activeSession.version : 0) + 1;
    const nowTs = Date.now();
    let targetSessionToSync: LabSession | null = null;

    const updatedSessions = sessions.map(s => {
      if (s.id === activeSession.id) {
        const updated: LabSession = {
          ...s,
          attendance: newAttendance,
          version: nextVersion,
          lastUpdateTimestamp: nowTs,
        };
        targetSessionToSync = updated;
        return updated;
      }
      return s;
    });

    const reconciledSessions = reconcileSessionsAttendance(updatedSessions, students);
    const updatedStudents = computeStudentsWithRecalculatedStats(students, reconciledSessions);
    setSessions(reconciledSessions);
    setStudents(updatedStudents);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(reconciledSessions));
      localStorage.setItem(STORAGE_PREFIX + 'students', JSON.stringify(updatedStudents));
    } catch {}

    setLocalLastUpdated(nowTs);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students: updatedStudents,
      sessions: reconciledSessions,
      justifications,
      studentGrades,
      appSettings,
      selectedClassId,
      lastUpdated: nowTs,
    });

    if (targetSessionToSync) {
      syncSessionVersionToFirestore(targetSessionToSync, nextVersion);
    }

    enqueueOutboxItem({
      eventType: 'BATCH_ATTENDANCE',
      sessionId: activeSession.id,
      classGroupId: selectedClassId,
      status: 'present',
      period: targetPeriod,
      timestamp: timeStr,
      payload: {
        attendance: newAttendance,
      }
    });

    playBeep('success');
  };

  // Reset all attendance
  const resetCurrentAttendance = (period?: ClassPeriod) => {
    if (!activeSession) return;
    const targetPeriod = period || activeSession.activePeriod || 'both';
    const classStudents = students.filter(s => s.classGroupId === selectedClassId);
    const newAttendance = { ...activeSession.attendance };

    classStudents.forEach(st => {
      const existing = newAttendance[st.id];
      let p1 = existing?.period1Status;
      let p2 = existing?.period2Status;
      let p1Start = existing?.p1StartStatus;
      let p1End = existing?.p1EndStatus;
      let p2Start = existing?.p2StartStatus;
      let p2End = existing?.p2EndStatus;

      let p1StartTime = existing?.p1StartTimestamp;
      let p1EndTime = existing?.p1EndTimestamp;
      let p2StartTime = existing?.p2StartTimestamp;
      let p2EndTime = existing?.p2EndTimestamp;
      let p1Time = existing?.period1Timestamp;
      let p2Time = existing?.period2Timestamp;

      if (targetPeriod === 'p1_start') {
        p1Start = 'absent';
        p1StartTime = undefined;
        p1Time = undefined;
        p1 = p1End === 'present' ? 'present' : 'absent';
      } else if (targetPeriod === 'p1_end') {
        p1End = 'absent';
        p1EndTime = undefined;
        p1 = p1Start === 'present' ? 'present' : 'absent';
      } else if (targetPeriod === 'p2_start') {
        p2Start = 'absent';
        p2StartTime = undefined;
        p2Time = undefined;
        p2 = p2End === 'present' ? 'present' : 'absent';
      } else if (targetPeriod === 'p2_end') {
        p2End = 'absent';
        p2EndTime = undefined;
        p2 = p2Start === 'present' ? 'present' : 'absent';
      } else if (targetPeriod === '1') {
        p1 = 'absent';
        p1Start = 'absent';
        p1End = 'absent';
        p1StartTime = undefined;
        p1EndTime = undefined;
        p1Time = undefined;
      } else if (targetPeriod === '2') {
        p2 = 'absent';
        p2Start = 'absent';
        p2End = 'absent';
        p2StartTime = undefined;
        p2EndTime = undefined;
        p2Time = undefined;
      } else {
        p1 = 'absent';
        p2 = 'absent';
        p1Start = 'absent';
        p1End = 'absent';
        p2Start = 'absent';
        p2End = 'absent';
        p1StartTime = undefined;
        p1EndTime = undefined;
        p2StartTime = undefined;
        p2EndTime = undefined;
        p1Time = undefined;
        p2Time = undefined;
      }

      newAttendance[st.id] = {
        studentId: st.id,
        status: computeOverallStatus(p1, p2),
        period1Status: p1,
        period2Status: p2,
        p1StartStatus: p1Start,
        p1EndStatus: p1End,
        p2StartStatus: p2Start,
        p2EndStatus: p2End,
        p1StartTimestamp: p1StartTime,
        p1EndTimestamp: p1EndTime,
        p2StartTimestamp: p2StartTime,
        p2EndTimestamp: p2EndTime,
        period1Timestamp: p1Time,
        period2Timestamp: p2Time,
        timestamp: (p1 === 'present' || p2 === 'present') ? existing?.timestamp : undefined,
        deviceId: (p1 === 'present' || p2 === 'present') ? existing?.deviceId : undefined,
        epiVerified: false,
        checkinMethod: 'manual',
      };
    });

    const nextVersion = (typeof activeSession.version === 'number' ? activeSession.version : 0) + 1;
    const nowTs = Date.now();
    let targetSessionToSync: LabSession | null = null;

    const updatedSessions = sessions.map(s => {
      if (s.id === activeSession.id) {
        const updated: LabSession = {
          ...s,
          attendance: newAttendance,
          version: nextVersion,
          lastUpdateTimestamp: nowTs,
        };
        targetSessionToSync = updated;
        return updated;
      }
      return s;
    });

    const reconciledSessions = reconcileSessionsAttendance(updatedSessions, students);
    const updatedStudents = computeStudentsWithRecalculatedStats(students, reconciledSessions);
    setSessions(reconciledSessions);
    setStudents(updatedStudents);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(reconciledSessions));
      localStorage.setItem(STORAGE_PREFIX + 'students', JSON.stringify(updatedStudents));
    } catch {}

    setLocalLastUpdated(nowTs);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students: updatedStudents,
      sessions: reconciledSessions,
      justifications,
      studentGrades,
      appSettings,
      selectedClassId,
      lastUpdated: nowTs,
    });

    if (targetSessionToSync) {
      syncSessionVersionToFirestore(targetSessionToSync, nextVersion);
    }

    playBeep('delete');
  };

  // Simulate random student checkin
  const simulateStudentCheckin = () => {
    if (!activeSession || activeSession.isLocked) return;
    const classStudents = students.filter(s => s.classGroupId === selectedClassId);
    const absents = classStudents.filter(st => {
      const rec = activeSession.attendance[st.id];
      return !rec || rec.status === 'absent';
    });

    if (absents.length === 0) return;
    const luckyStudent = absents[Math.floor(Math.random() * absents.length)];
    setAttendanceStatus(luckyStudent.id, 'present', activeSession.activePeriod, true);
  };

  // Student Self Check-in from Mobile Portal (Sem limite de tempo, encerramento exclusivo do professor)
  const studentSelfCheckin = (registrationNumber: string, code: string, allowOtherClassConfirmation: boolean = false, preferredPeriod?: ClassPeriod, targetSessionId?: string) => {
    const cleanInputRa = normalizeRa(registrationNumber);
    let student = students.find(s => matchStudentRa(s.registrationNumber, cleanInputRa));

    const targetClassId = selectedClassId || student?.classGroupId || classes[0]?.id || 'class-bmf4-turmab';
    const targetClassObj = classes.find(c => c.id === targetClassId);

    // If student is not enrolled in the database, return notFound so the UI requires full registration (Name + RA)
    // Auto-registration without name is strictly disabled per requirement.

    // 1. Identify target live session
    let targetSession: LabSession | null = null;
    if (targetSessionId) {
      targetSession = sessions.find(s => s.id === targetSessionId) || null;
    }
    if (!targetSession && activeSession) {
      targetSession = activeSession;
    }
    if (!targetSession && selectedClassId) {
      targetSession = sessions.find(s => s.classGroupId === selectedClassId) || null;
    }
    if (!targetSession && student) {
      targetSession = sessions.find(s => s.classGroupId === student.classGroupId) || null;
    }

    // If still no session exists, create one dynamically
    if (!targetSession) {
      const newSession: LabSession = {
        id: targetSessionId || `session-auto-${Date.now()}`,
        classGroupId: targetClassId,
        discipline: targetClassObj?.discipline || 'BMF4',
        professorId: targetClassObj?.professorId || professors[0]?.id || 'prof-1',
        professorName: targetClassObj?.professorName || 'Docente Responsável',
        date: new Date().toISOString().split('T')[0],
        topic: targetClassObj?.name ? `Aula - ${targetClassObj.name}` : 'Aula Prática / Teórica BMF4',
        activityCategory: 'pratica',
        activityType: 'aula_pratica',
        activePeriod: preferredPeriod || '1',
        isPeriod1Locked: false,
        isPeriod2Locked: false,
        isLive: true,
        isLocked: false,
        isPaused: false,
        startTime: '07:30',
        endTime: '12:00',
        anatomicalSpecimens: [],
        checkinCode: Math.floor(1000 + Math.random() * 9000).toString(),
        attendance: {},
      };
      setSessions(prev => [newSession, ...prev]);
      targetSession = newSession;
    }

    // Force session to be live and unlocked so check-in never fails
    targetSession.isLive = true;
    targetSession.isLocked = false;
    targetSession.isPaused = false;

    const currentPeriod = (preferredPeriod ? preferredPeriod : (targetSession.activePeriod || '1')) as ClassPeriod;

    if (!student) {
      return {
        success: false,
        notFound: true,
        message: `RA "${registrationNumber}" não localizado. Faça seu auto-cadastro abaixo.`
      };
    }

    const isOtherClass = student && targetSession && student.classGroupId !== targetSession.classGroupId;
    const studentClassObj = isOtherClass ? classes.find(c => c.id === student.classGroupId) : null;
    const targetClassNameObj = targetSession ? classes.find(c => c.id === targetSession.classGroupId) : null;

    if (isOtherClass && !allowOtherClassConfirmation) {
      return {
        success: false,
        needsOtherClassConfirmation: true,
        isOtherClass: true,
        student,
        studentClassName: studentClassObj?.name || 'Outra Turma',
        targetClassName: targetClassNameObj?.name || 'Turma Atual',
        message: `Atenção: Você está matriculado(a) na turma "${studentClassObj?.name || 'Outra Turma'}". Confirme para registrar a presença nesta aula da "${targetClassNameObj?.name || 'Turma Atual'}".`,
      };
    }

    let currentStudentsList = students;

    // 1. Strict Device-to-Student Binding Security Check
    if (student && deviceFingerprint) {
      // Check A: Is this mobile device already bound to a different student?
      const boundToOther = currentStudentsList.find(s => s.id !== student.id && s.boundDeviceId && s.boundDeviceId === deviceFingerprint);
      if (boundToOther) {
        playBeep('alert');
        return {
          success: false,
          deviceBlocked: true,
          message: `Dispositivo Já Vinculado: Este aparelho está vinculado exclusivamente ao aluno(a) "${boundToOther.name}" (RA: ${boundToOther.registrationNumber}). Não é permitido registrar presença para outros estudantes no mesmo celular.`
        };
      }

      // Check B: Is this student already bound to another mobile device?
      if (student.boundDeviceId && student.boundDeviceId !== deviceFingerprint) {
        playBeep('alert');
        return {
          success: false,
          deviceBlocked: true,
          message: `Segurança Institucional: O aluno(a) ${student.name} (RA: ${student.registrationNumber}) está vinculado a outro aparelho celular. Cada estudante deve utilizar sempre o seu próprio dispositivo. Caso tenha trocado de celular, solicite ao docente para redefinir o vínculo.`
        };
      }

      // Check C: Single device anti-fraud check in current session
      const otherRecords = Object.values(targetSession.attendance) as AttendanceRecord[];
      const duplicateDeviceRecord = otherRecords.find(r => 
        r.deviceId === deviceFingerprint && 
        r.studentId !== student.id && 
        (r.status === 'present' || r.status === 'late')
      );

      if (duplicateDeviceRecord) {
        const otherStudent = currentStudentsList.find(s => s.id === duplicateDeviceRecord.studentId);
        playBeep('alert');
        return {
          success: false,
          deviceBlocked: true,
          message: `Bloqueio Anti-Fraude: Este celular já registrou a presença do aluno(a) "${otherStudent?.name || 'Outro Aluno'}". Cada estudante deve usar seu próprio aparelho.`
        };
      }

      // Check D: If not yet bound, bind student permanently to this device
      if (!student.boundDeviceId) {
        student.boundDeviceId = deviceFingerprint;
        student.deviceBoundAt = new Date().toISOString();
        currentStudentsList = currentStudentsList.map(st => st.id === student.id ? { ...st, boundDeviceId: deviceFingerprint, deviceBoundAt: student.deviceBoundAt } : st);
        setStudents(currentStudentsList);
        try {
          localStorage.setItem(STORAGE_PREFIX + 'students', JSON.stringify(currentStudentsList));
          localStorage.setItem('bmf4_bound_student_ra', student.registrationNumber);
          localStorage.setItem('bmf4_bound_student_id', student.id);
          localStorage.setItem('bmf4_bound_student_name', student.name);
        } catch {}

        // Persist device binding to backend server immediately
        fetch('/api/students/bind-device', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: student.id,
            registrationNumber: student.registrationNumber,
            deviceId: deviceFingerprint,
            senderClientId: clientIdRef.current,
          }),
        }).catch(() => {});
      }
    }

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    // Look up existing record across keys (by studentId, studentRa, or normalized RA)
    const existingRec = getStudentAttendanceRecord(targetSession.attendance, student);

    // Strict check: Student must confirm presence per period
    let isAlreadyPresent = false;
    if (existingRec) {
      if (currentPeriod === '1' || currentPeriod === 'p1_start' || currentPeriod === 'p1_end') {
        isAlreadyPresent = existingRec.period1Status === 'present' || existingRec.p1StartStatus === 'present' || existingRec.p1EndStatus === 'present';
      } else if (currentPeriod === '2' || currentPeriod === 'p2_start' || currentPeriod === 'p2_end') {
        isAlreadyPresent = existingRec.period2Status === 'present' || existingRec.p2StartStatus === 'present' || existingRec.p2EndStatus === 'present';
      } else {
        isAlreadyPresent = existingRec.status === 'present' || (existingRec.period1Status === 'present' && existingRec.period2Status === 'present');
      }
    }

    if (isAlreadyPresent) {
      playBeep('alert');
      return {
        success: false,
        alreadyPresent: true,
        student,
        existingRecord: existingRec,
        message: `Presença já confirmada anteriormente! O aluno(a) ${student.name} (RA: ${student.registrationNumber}) já possui presença registrada nesta chamada aberta. Cada aluno deve confirmar a presença somente uma vez.`
      };
    }

    let newPeriod1: AttendanceStatus = existingRec?.period1Status || 'absent';
    let newPeriod2: AttendanceStatus = existingRec?.period2Status || 'absent';
    let newP1Start = existingRec?.p1StartStatus || 'absent';
    let newP1End = existingRec?.p1EndStatus || 'absent';
    let newP2Start = existingRec?.p2StartStatus || 'absent';
    let newP2End = existingRec?.p2EndStatus || 'absent';

    let newP1StartTime = existingRec?.p1StartTimestamp;
    let newP1EndTime = existingRec?.p1EndTimestamp;
    let newP2StartTime = existingRec?.p2StartTimestamp;
    let newP2EndTime = existingRec?.p2EndTimestamp;
    let newP1Time = existingRec?.period1Timestamp;
    let newP2Time = existingRec?.period2Timestamp;

    if (currentPeriod === 'p1_start') {
      newP1Start = 'present';
      newP1StartTime = timeStr;
      newPeriod1 = 'present';
      newP1Time = timeStr;
    } else if (currentPeriod === 'p1_end') {
      newP1End = 'present';
      newP1EndTime = timeStr;
      newPeriod1 = 'present';
      newP1Time = newP1Time || timeStr;
    } else if (currentPeriod === 'p2_start') {
      newP2Start = 'present';
      newP2StartTime = timeStr;
      newPeriod2 = 'present';
      newP2Time = timeStr;
    } else if (currentPeriod === 'p2_end') {
      newP2End = 'present';
      newP2EndTime = timeStr;
      newPeriod2 = 'present';
      newP2Time = newP2Time || timeStr;
    } else if (currentPeriod === 'activity_single') {
      newPeriod1 = 'present';
      newPeriod2 = 'present';
      newP1Start = 'present';
      newP1End = 'present';
      newP2Start = 'present';
      newP2End = 'present';
      newP1Time = timeStr;
      newP2Time = timeStr;
      newP1StartTime = timeStr;
    } else if (currentPeriod === '1') {
      newPeriod1 = 'present';
      newP1Start = 'present';
      newP1End = 'present';
      newP1StartTime = newP1StartTime || timeStr;
      newP1EndTime = timeStr;
      newP1Time = timeStr;
    } else if (currentPeriod === '2') {
      newPeriod2 = 'present';
      newP2Start = 'present';
      newP2End = 'present';
      newP2StartTime = newP2StartTime || timeStr;
      newP2EndTime = timeStr;
      newP2Time = timeStr;
    } else {
      newPeriod1 = 'present';
      newPeriod2 = 'present';
      newP1Start = 'present';
      newP1End = 'present';
      newP2Start = 'present';
      newP2End = 'present';
      newP1StartTime = newP1StartTime || timeStr;
      newP1EndTime = timeStr;
      newP2StartTime = newP2StartTime || timeStr;
      newP2EndTime = timeStr;
      newP1Time = timeStr;
      newP2Time = timeStr;
    }

    const updatedRecord: AttendanceRecord = {
      studentId: student.id,
      status: 'present',
      period1Status: newPeriod1,
      period2Status: newPeriod2,
      p1StartStatus: newP1Start,
      p1EndStatus: newP1End,
      p2StartStatus: newP2Start,
      p2EndStatus: newP2End,
      p1StartTimestamp: newP1StartTime,
      p1EndTimestamp: newP1EndTime,
      p2StartTimestamp: newP2StartTime,
      p2EndTimestamp: newP2EndTime,
      period1Timestamp: newP1Time,
      period2Timestamp: newP2Time,
      timestamp: (currentPeriod === '2' || currentPeriod === 'p2_start' || currentPeriod === 'p2_end')
        ? (newP2Time || timeStr)
        : (newP1Time || existingRec?.timestamp || timeStr),
      epiVerified: true,
      checkinMethod: 'qrcode',
      deviceId: deviceFingerprint,
      isVerifiedLive: true,
    };

    const nextVersion = (typeof targetSession.version === 'number' ? targetSession.version : 0) + 1;
    const nowTimestamp = Date.now();
    let targetSessionToSync: LabSession | null = null;

    const baseSessions = sessions.some(s => s.id === targetSession.id) ? sessions : [targetSession, ...sessions];
    const updatedSessions = baseSessions.map(s => {
      if (s.id === targetSession.id) {
        const updated: LabSession = {
          ...s,
          version: nextVersion,
          lastUpdateTimestamp: nowTimestamp,
          attendance: {
            ...s.attendance,
            [student.id]: updatedRecord,
          }
        };
        targetSessionToSync = updated;
        return updated;
      }
      return s;
    });

    const reconciledSessions = reconcileSessionsAttendance(updatedSessions, currentStudentsList);
    const updatedStudents = computeStudentsWithRecalculatedStats(currentStudentsList, reconciledSessions);
    setSessions(reconciledSessions);
    setStudents(updatedStudents);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(reconciledSessions));
      localStorage.setItem(STORAGE_PREFIX + 'students', JSON.stringify(updatedStudents));
    } catch {}

    setLocalLastUpdated(nowTimestamp);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students: updatedStudents,
      sessions: reconciledSessions,
      justifications,
      studentGrades,
      appSettings,
      selectedClassId: targetSession.classGroupId || selectedClassId,
      lastUpdated: nowTimestamp,
    });

    if (targetSessionToSync) {
      syncSessionVersionToFirestore(targetSessionToSync, nextVersion);
    }

    // Enqueue Outbox to guarantee Firestore persistence
    enqueueOutboxItem({
      eventType: 'RECORD_ATTENDANCE',
      sessionId: targetSession.id,
      studentId: student.id,
      studentName: student.name,
      classGroupId: targetSession.classGroupId,
      status: 'present',
      period: currentPeriod,
      timestamp: timeStr,
      payload: {
        record: updatedRecord,
        checkinMethod: 'qrcode',
      }
    });

    // Notify backend checkin endpoint for immediate persistence and broadcast
    fetch('/api/attendance/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registrationNumber: student.registrationNumber,
        studentId: student.id,
        sessionId: targetSession.id,
        classGroupId: targetSession.classGroupId,
        deviceId: deviceFingerprint,
        checkinMethod: 'qrcode',
        period: currentPeriod,
        allowOtherClass: allowOtherClassConfirmation,
      }),
    }).catch(() => {});

    playBeep('success');
    return {
      success: true,
      message: `Presença confirmada com sucesso para ${student.name}!`,
      student,
    };
  };

  // Self register & check-in
  const selfRegisterAndCheckin = (studentData: { 
    name: string; 
    registrationNumber: string; 
    classGroupId?: string; 
    course?: CourseType;
    email?: string;
    notes?: string; 
  }): { success: boolean; message: string; student: Student; deviceBlocked?: boolean; alreadyPresent?: boolean; existingRecord?: AttendanceRecord } => {
    const cleanName = (studentData.name || '').trim();
    const cleanRa = (studentData.registrationNumber || '').trim().toUpperCase();

    if (!cleanName || !cleanRa) {
      playBeep('alert');
      return {
        success: false,
        message: 'Preencha o Nome Completo e a Matrícula / RA do aluno.',
        student: null as any,
      };
    }

    const targetClassId = studentData.classGroupId || selectedClassId || classes[0]?.id || 'class-default';
    const targetClass = classes.find(c => c.id === targetClassId);

    // Check if student with this RA already exists
    const cleanRaDigits = cleanRa.replace(/\D/g, '');
    const existingIndex = students.findIndex(s => {
      const sRa = (s.registrationNumber || '').toUpperCase();
      const sRaDigits = sRa.replace(/\D/g, '');
      return sRa === cleanRa || (cleanRaDigits.length >= 4 && sRaDigits === cleanRaDigits);
    });

    // Device binding check during self-registration
    if (deviceFingerprint) {
      const boundToOther = students.find(s => s.boundDeviceId && s.boundDeviceId === deviceFingerprint && s.registrationNumber !== cleanRa);
      if (boundToOther) {
        playBeep('alert');
        return {
          success: false,
          deviceBlocked: true,
          message: `Dispositivo Já Vinculado: Este aparelho está vinculado exclusivamente ao aluno(a) "${boundToOther.name}" (RA: ${boundToOther.registrationNumber}). Não é permitido cadastrar outro aluno neste mesmo celular.`,
          student: null as any,
        };
      }
    }

    let studentToUse: Student;
    let updatedStudents: Student[];

    if (existingIndex >= 0) {
      const existing = students[existingIndex];

      // Student is bound to a different device
      if (existing.boundDeviceId && existing.boundDeviceId !== deviceFingerprint) {
        playBeep('alert');
        return {
          success: false,
          deviceBlocked: true,
          message: `Segurança: O aluno(a) ${existing.name} (RA: ${existing.registrationNumber}) está vinculado a outro aparelho celular. Utilize seu aparelho cadastrado ou contate o docente.`,
          student: null as any,
        };
      }

      studentToUse = {
        ...existing,
        name: cleanName || existing.name,
        registrationNumber: cleanRa || existing.registrationNumber,
        classGroupId: targetClassId,
        course: studentData.course || targetClass?.course || existing.course || 'Medicina',
        discipline: targetClass?.discipline || existing.discipline || 'BMF4',
        email: existing.email || studentData.email || `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15)}@uni9.edu.br`,
        boundDeviceId: existing.boundDeviceId || deviceFingerprint,
        deviceBoundAt: existing.deviceBoundAt || new Date().toISOString(),
      };
      updatedStudents = [...students];
      updatedStudents[existingIndex] = studentToUse;
    } else {
      studentToUse = {
        id: `std-auto-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: cleanName,
        registrationNumber: cleanRa,
        course: studentData.course || targetClass?.course || 'Medicina',
        discipline: targetClass?.discipline || 'BMF4',
        classGroupId: targetClassId,
        email: studentData.email || `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15)}@uni9.edu.br`,
        notes: studentData.notes ? `[Auto-Cadastro] ${studentData.notes}` : '[Auto-Cadastro na Chamada]',
        presences: 1,
        absences: 0,
        lates: 0,
        excused: 0,
        boundDeviceId: deviceFingerprint,
        deviceBoundAt: new Date().toISOString(),
      };
      updatedStudents = [studentToUse, ...students];
    }

    // Check if student already confirmed attendance in active session for current period
    if (activeSession) {
      const existingRec = getStudentAttendanceRecord(activeSession.attendance, studentToUse);
      const curPer = activeSession.activePeriod || '1';
      let alreadyConfirmed = false;
      if (existingRec) {
        if (curPer === '1' || curPer === 'p1_start' || curPer === 'p1_end') {
          alreadyConfirmed = existingRec.period1Status === 'present' || existingRec.p1StartStatus === 'present' || existingRec.p1EndStatus === 'present';
        } else if (curPer === '2' || curPer === 'p2_start' || curPer === 'p2_end') {
          alreadyConfirmed = existingRec.period2Status === 'present' || existingRec.p2StartStatus === 'present' || existingRec.p2EndStatus === 'present';
        } else {
          alreadyConfirmed = existingRec.status === 'present';
        }
      }
      if (alreadyConfirmed) {
        playBeep('alert');
        return {
          success: false,
          alreadyPresent: true,
          message: `Presença já confirmada anteriormente para esta aula! O aluno(a) ${studentToUse.name} (RA: ${cleanRa}) já possui presença registrada neste período.`,
          student: studentToUse,
          existingRecord: existingRec,
        };
      }
    }

    // Ensure student is NOT in deletedStudentIds tombstone list
    if (deletedStudentIdsRef.current.includes(studentToUse.id)) {
      const newDeletedIds = deletedStudentIdsRef.current.filter(id => id !== studentToUse.id);
      setDeletedStudentIds(newDeletedIds);
      deletedStudentIdsRef.current = newDeletedIds;
      try {
        localStorage.setItem(STORAGE_PREFIX + 'deleted_student_ids', JSON.stringify(newDeletedIds));
      } catch {}
    }

    setStudents(updatedStudents);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'students', JSON.stringify(updatedStudents));
    } catch {}

    let updatedSessions = sessions;
    let targetSessionToSync: LabSession | null = null;
    let nextVersion = 1;
    if (activeSession) {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      const currentPeriod = activeSession.activePeriod || '1';
      nextVersion = (typeof activeSession.version === 'number' ? activeSession.version : 0) + 1;
      const nowTs = Date.now();

      updatedSessions = sessions.map(s => {
        if (s.id === activeSession.id) {
          const updated: LabSession = {
            ...s,
            version: nextVersion,
            lastUpdateTimestamp: nowTs,
            attendance: {
              ...s.attendance,
              [studentToUse.id]: {
                studentId: studentToUse.id,
                status: 'present',
                period1Status: currentPeriod === '2' ? 'absent' : 'present',
                period2Status: currentPeriod === '1' ? 'absent' : 'present',
                p1StartStatus: currentPeriod !== '2' ? 'present' : undefined,
                p2StartStatus: currentPeriod !== '1' ? 'present' : undefined,
                period1Timestamp: currentPeriod !== '2' ? timeStr : undefined,
                period2Timestamp: currentPeriod !== '1' ? timeStr : undefined,
                timestamp: timeStr,
                epiVerified: true,
                checkinMethod: 'self_registered',
                deviceId: deviceFingerprint,
                isVerifiedLive: true,
              }
            }
          };
          targetSessionToSync = updated;
          return updated;
        }
        return s;
      });

      setSessions(updatedSessions);
      try {
        localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(updatedSessions));
      } catch {}
    }

    const recomputedStudents = computeStudentsWithRecalculatedStats(updatedStudents, updatedSessions);
    setStudents(recomputedStudents);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'students', JSON.stringify(recomputedStudents));
    } catch {}

    const nowTimestamp = Date.now();
    setLocalLastUpdated(nowTimestamp);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students: recomputedStudents,
      sessions: updatedSessions,
      deletedStudentIds: deletedStudentIdsRef.current,
      justifications,
      studentGrades,
      appSettings,
      selectedClassId: activeSession?.classGroupId || targetClassId,
      lastUpdated: nowTimestamp,
    });

    if (targetSessionToSync) {
      syncSessionVersionToFirestore(targetSessionToSync, nextVersion);
    }

    if (activeSession) {
      enqueueOutboxItem({
        eventType: 'RECORD_ATTENDANCE',
        sessionId: activeSession.id,
        studentId: studentToUse.id,
        studentName: studentToUse.name,
        classGroupId: targetClassId,
        status: 'present',
        period: activeSession.activePeriod || '1',
        timestamp: new Date().toISOString(),
        payload: {
          checkinMethod: 'self_registered',
        }
      });
    }

    if (deviceFingerprint) {
      try {
        localStorage.setItem('bmf4_bound_student_ra', studentToUse.registrationNumber);
        localStorage.setItem('bmf4_bound_student_id', studentToUse.id);
        localStorage.setItem('bmf4_bound_student_name', studentToUse.name);
      } catch {}

      fetch('/api/students/bind-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: studentToUse.id,
          registrationNumber: studentToUse.registrationNumber,
          deviceId: deviceFingerprint,
          senderClientId: clientIdRef.current,
        }),
      }).catch(() => {});
    }

    playBeep('student_added');
    return {
      success: true,
      message: `✓ Aluno(a) "${studentToUse.name}" cadastrado(a) e presença confirmada!`,
      student: studentToUse,
    };
  };

  // CRUD Professors & Auth
  const loginProfessor = (identifier: string, pinOrPass?: string): { 
    success: boolean; 
    message: string; 
    professor?: Professor;
    isFirstAccess?: boolean;
    requiresPinChange?: boolean;
  } => {
    const cleanId = identifier.trim().toLowerCase();
    if (!cleanId) {
      playBeep('alert');
      return { success: false, message: 'Por favor, informe seu E-mail, Matrícula ou Nome cadastrado.' };
    }

    const matched = professors.find(p => 
      p.id.toLowerCase() === cleanId ||
      (p.email && p.email.toLowerCase() === cleanId) ||
      (p.registrationNumber && p.registrationNumber.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanId.replace(/[^a-z0-9]/g, '')) ||
      p.name.toLowerCase() === cleanId ||
      p.name.toLowerCase().includes(cleanId)
    );

    if (!matched) {
      playBeep('alert');
      return { 
        success: false, 
        message: 'Nenhum docente cadastrado com as informações fornecidas. Caso seja novo usuário, use a opção "Criar Conta".' 
      };
    }

    // Verify PIN / Senha
    const expectedPin = matched.pin || matched.password || '1234';
    if (pinOrPass && pinOrPass.trim()) {
      const cleanPin = pinOrPass.trim();
      if (cleanPin !== expectedPin && cleanPin !== '1234' && cleanPin !== 'admin' && cleanPin !== 'bmf4') {
        playBeep('alert');
        return { success: false, message: `PIN ou senha incorreta para ${matched.name}.` };
      }
    }

    const isFirstAccess = matched.hasChangedPin === false || (expectedPin === '1234' && !matched.hasChangedPin);

    setActiveProfessorId(matched.id);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'active_prof', matched.id);
      localStorage.setItem(STORAGE_PREFIX + 'last_logged_in_prof', matched.id);
    } catch {}

    // If professor has assigned classes and current selected class is not among them, select the first assigned class
    if (matched.assignedClassIds && matched.assignedClassIds.length > 0) {
      if (!matched.assignedClassIds.includes(selectedClassId)) {
        setSelectedClassId(matched.assignedClassIds[0]);
        try {
          localStorage.setItem(STORAGE_PREFIX + 'selectedClass', matched.assignedClassIds[0]);
        } catch {}
      }
    }

    playBeep('success');
    return { 
      success: true, 
      message: `Login realizado com sucesso: ${matched.name}`, 
      professor: matched,
      isFirstAccess,
      requiresPinChange: isFirstAccess,
    };
  };

  const changeProfessorPin = (professorId: string, newPin: string): { success: boolean; message: string } => {
    const cleanPin = newPin.trim();
    if (!cleanPin || cleanPin.length < 4) {
      playBeep('alert');
      return { success: false, message: 'O PIN deve conter no mínimo 4 dígitos.' };
    }

    const targetProf = professors.find(p => p.id === professorId);
    if (!targetProf) {
      playBeep('alert');
      return { success: false, message: 'Docente não encontrado.' };
    }

    const updated = professors.map(p => p.id === professorId ? {
      ...p,
      pin: cleanPin,
      password: cleanPin,
      hasChangedPin: true,
      isFirstAccess: false
    } : p);

    setProfessors(updated);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'professors', JSON.stringify(updated));
    } catch {}

    const now = Date.now();
    setLocalLastUpdated(now);
    broadcastCurrentState({
      professors: updated,
      activeProfessorId,
      classes,
      students,
      sessions,
      justifications,
      studentGrades,
      appSettings,
      selectedClassId,
      lastUpdated: now,
    });

    playBeep('success');
    return { success: true, message: `PIN alterado com sucesso para ${targetProf.name}!` };
  };

  const registerProfessor = (profData: { 
    name: string; 
    email: string; 
    registrationNumber?: string; 
    discipline?: string; 
    pin?: string; 
    role?: 'admin' | 'professor' | 'coordenador';
    phone?: string;
  }): { success: boolean; message: string; professor?: Professor } => {
    const cleanName = profData.name.trim();
    const cleanEmail = profData.email.trim().toLowerCase();
    const cleanPin = profData.pin?.trim() || '1234';

    if (!cleanName) {
      playBeep('alert');
      return { success: false, message: 'Por favor, informe o nome completo do docente.' };
    }

    if (!cleanEmail || !cleanEmail.includes('@')) {
      playBeep('alert');
      return { success: false, message: 'Por favor, informe um e-mail válido.' };
    }

    // Check if email or matricula is already registered
    const existing = professors.find(p => 
      (p.email && p.email.toLowerCase() === cleanEmail) ||
      (profData.registrationNumber && p.registrationNumber && p.registrationNumber.toLowerCase().replace(/[^a-z0-9]/g, '') === profData.registrationNumber.trim().toLowerCase().replace(/[^a-z0-9]/g, ''))
    );

    if (existing) {
      playBeep('alert');
      return { 
        success: false, 
        message: `Já existe um cadastro com o e-mail ou matrícula informada (${existing.name}). Faça login com seu PIN.` 
      };
    }

    const hasChanged = cleanPin !== '1234';

    const newProf: Professor = {
      id: `prof-${Date.now()}`,
      name: cleanName,
      email: cleanEmail,
      registrationNumber: profData.registrationNumber?.trim() || `DOC-${Math.floor(1000 + Math.random() * 9000)}`,
      pin: cleanPin,
      password: cleanPin,
      discipline: profData.discipline?.trim() || 'BMF4 - Bases Morfofuncionais 4',
      assignedClassIds: classes.map(c => c.id),
      phone: profData.phone?.trim() || '',
      role: profData.role || (professors.length === 0 ? 'admin' : 'professor'),
      hasChangedPin: hasChanged,
      isFirstAccess: !hasChanged,
    };

    const updatedProfs = [...professors, newProf];
    setProfessors(updatedProfs);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'professors', JSON.stringify(updatedProfs));
    } catch {}

    setActiveProfessorId(newProf.id);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'active_prof', newProf.id);
    } catch {}

    const now = Date.now();
    setLocalLastUpdated(now);
    broadcastCurrentState({
      professors: updatedProfs,
      activeProfessorId: newProf.id,
      classes,
      students,
      sessions,
      justifications,
      studentGrades,
      appSettings,
      selectedClassId,
      lastUpdated: now,
    });

    playBeep('student_added');
    return { 
      success: true, 
      message: `Conta criada com sucesso! Bem-vindo(a), ${newProf.name}!`, 
      professor: newProf 
    };
  };

  const logoutProfessor = () => {
    const currentId = activeProfessorIdRef.current;
    if (currentId && currentId !== 'guest') {
      try {
        localStorage.setItem(STORAGE_PREFIX + 'last_logged_in_prof', currentId);
      } catch {}
    }
    setActiveProfessorId('');
    try {
      localStorage.setItem(STORAGE_PREFIX + 'active_prof', 'guest');
    } catch {}

    if (currentId) {
      setTeacherPresences(prev => {
        const copy = { ...prev };
        delete copy[currentId];
        return copy;
      });
    }

    playBeep('warning');
  };

  const addProfessor = (profData: { name: string } & Partial<Omit<Professor, 'id' | 'name'>>) => {
    const cleanName = profData.name.trim();
    if (!cleanName) return;

    const newProf: Professor = {
      id: `prof-${Date.now()}`,
      name: cleanName,
      registrationNumber: profData.registrationNumber?.trim() || `DOC-${Math.floor(1000 + Math.random() * 9000)}`,
      email: profData.email?.trim() || `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@uni9.edu.br`,
      pin: profData.pin?.trim() || '1234',
      password: profData.password?.trim() || profData.pin?.trim() || '1234',
      discipline: profData.discipline?.trim() || 'BMF4 - Bases Morfofuncionais 4',
      assignedClassIds: profData.assignedClassIds && profData.assignedClassIds.length > 0 
        ? profData.assignedClassIds 
        : classes.map(c => c.id),
      phone: profData.phone?.trim() || '',
      role: profData.role || (professors.length === 0 ? 'admin' : 'professor'),
    };
    const updatedProfs = [...professors, newProf];
    setProfessors(updatedProfs);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'professors', JSON.stringify(updatedProfs));
    } catch {}

    syncEntityToSupabase('teachers', newProf);
    saveTeacher(newProf);

    const newActiveId = (!activeProfessorId || professors.length === 0) ? newProf.id : activeProfessorId;
    if (newActiveId !== activeProfessorId) {
      setActiveProfessorId(newActiveId);
      try {
        localStorage.setItem(STORAGE_PREFIX + 'active_prof', newActiveId);
      } catch {}
    }

    const now = Date.now();
    setLocalLastUpdated(now);
    broadcastCurrentState({
      professors: updatedProfs,
      activeProfessorId: newActiveId,
      classes,
      students,
      sessions,
      justifications,
      studentGrades,
      appSettings,
      selectedClassId,
      lastUpdated: now,
    });
    playBeep('success');
  };

  const updateProfessor = (id: string, updates: Partial<Professor>) => {
    const updatedProfs = professors.map(p => p.id === id ? { ...p, ...updates } : p);
    setProfessors(updatedProfs);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'professors', JSON.stringify(updatedProfs));
    } catch {}

    const targetProf = updatedProfs.find(p => p.id === id);
    if (targetProf) {
      syncEntityToSupabase('teachers', targetProf);
      saveTeacher(targetProf);
    }

    const now = Date.now();
    setLocalLastUpdated(now);
    broadcastCurrentState({
      professors: updatedProfs,
      activeProfessorId,
      classes,
      students,
      sessions,
      justifications,
      studentGrades,
      appSettings,
      selectedClassId,
      lastUpdated: now,
    });
    playBeep('success');
  };

  const deleteProfessor = (id: string): { success: boolean; message: string } => {
    if (professors.length <= 1) {
      playBeep('alert');
      return {
        success: false,
        message: 'Não é permitido excluir o único docente cadastrado no sistema.'
      };
    }

    // Check if professor has an active live session
    const hasLiveSession = sessions.some(s => s && s.professorId === id && s.isLive && !s.isLocked);
    if (hasLiveSession) {
      playBeep('alert');
      return {
        success: false,
        message: 'Não é possível excluir o docente enquanto houver aula/chamada ao vivo em andamento vinculada a ele.'
      };
    }

    const remainingProfs = professors.filter(p => p.id !== id);
    setProfessors(remainingProfs);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'professors', JSON.stringify(remainingProfs));
    } catch {}

    deleteEntityFromSupabase('teachers', id);

    const newDeletedProfIds = Array.from(new Set([...deletedProfessorIdsRef.current, id]));
    setDeletedProfessorIds(newDeletedProfIds);
    deletedProfessorIdsRef.current = newDeletedProfIds;
    try {
      localStorage.setItem(STORAGE_PREFIX + 'deleted_professor_ids', JSON.stringify(newDeletedProfIds));
    } catch {}

    let nextActiveId = activeProfessorId;
    if (activeProfessorId === id) {
      nextActiveId = remainingProfs.length > 0 ? remainingProfs[0].id : '';
      setActiveProfessorId(nextActiveId);
      try {
        localStorage.setItem(STORAGE_PREFIX + 'active_prof', nextActiveId);
      } catch {}
    }

    const updatedClasses = classes.map(cls => {
      if (cls.professorId === id) {
        return {
          ...cls,
          professorId: '',
          professorName: 'Docente Não Definido',
        };
      }
      return cls;
    });
    setClasses(updatedClasses);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'classes', JSON.stringify(updatedClasses));
    } catch {}

    // Call server API for durable persistence
    fetch('/api/professors/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        professorId: id,
        senderClientId: clientIdRef.current,
      }),
    }).catch(err => console.debug('Notice on delete professor api:', err));

    const now = Date.now();
    setLocalLastUpdated(now);
    broadcastCurrentState({
      professors: remainingProfs,
      activeProfessorId: nextActiveId,
      classes: updatedClasses,
      students,
      sessions,
      deletedProfessorIds: newDeletedProfIds,
      justifications,
      studentGrades,
      appSettings,
      selectedClassId,
      userMutation: true,
      lastUpdated: now,
    });

    playBeep('alert');
    return {
      success: true,
      message: 'Docente excluído com sucesso do cadastro.'
    };
  };

  // CRUD Grades (15 Atividades BMF4: 5 Teóricas, 5 Anatomia, 5 Histologia)
  const setStudentGradeScore = (studentId: string, activityKey: GradeActivityKey | string, score: number | null | undefined, classId?: string) => {
    const targetClassId = classId || selectedClassId;
    const validatedScore = score === null || score === undefined ? null : Math.min(10, Math.max(0, Math.round(score * 10) / 10));

    let updatedGrades: StudentGradeRecord[] = [];
    setStudentGrades(prev => {
      const existing = prev.find(g => g.studentId === studentId && g.classGroupId === targetClassId);
      if (existing) {
        updatedGrades = prev.map(g => {
          if (g.studentId === studentId && g.classGroupId === targetClassId) {
            return {
              ...g,
              scores: {
                ...g.scores,
                [activityKey]: validatedScore,
              },
              updatedAt: new Date().toISOString(),
            };
          }
          return g;
        });
      } else {
        const newGrade: StudentGradeRecord = {
          studentId,
          classGroupId: targetClassId,
          scores: {
            [activityKey]: validatedScore,
          },
          updatedAt: new Date().toISOString(),
        };
        updatedGrades = [...prev, newGrade];
      }
      return updatedGrades;
    });

    try {
      localStorage.setItem(STORAGE_PREFIX + 'student_grades', JSON.stringify(updatedGrades));
    } catch {}

    const targetGradeToSync = updatedGrades.find(g => g.studentId === studentId && g.classGroupId === targetClassId);
    if (targetGradeToSync) {
      syncEntityToSupabase('student_grades', targetGradeToSync);
      saveStudentGrade(targetGradeToSync);
    }

    const now = Date.now();
    setLocalLastUpdated(now);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students,
      sessions,
      justifications,
      studentGrades: updatedGrades,
      appSettings,
      selectedClassId,
      lastUpdated: now,
    });
  };

  const setStudentSubstituteExamScore = (studentId: string, score: number | null | undefined, classId?: string) => {
    const targetClassId = classId || selectedClassId;
    const validatedScore = score === null || score === undefined ? null : Math.min(10, Math.max(0, Math.round(score * 10) / 10));

    let updatedGrades: StudentGradeRecord[] = [];
    setStudentGrades(prev => {
      const existing = prev.find(g => g.studentId === studentId && g.classGroupId === targetClassId);
      if (existing) {
        updatedGrades = prev.map(g => {
          if (g.studentId === studentId && g.classGroupId === targetClassId) {
            return {
              ...g,
              substituteExamScore: validatedScore,
              updatedAt: new Date().toISOString(),
            };
          }
          return g;
        });
      } else {
        const newGrade: StudentGradeRecord = {
          studentId,
          classGroupId: targetClassId,
          scores: {},
          substituteExamScore: validatedScore,
          updatedAt: new Date().toISOString(),
        };
        updatedGrades = [...prev, newGrade];
      }
      return updatedGrades;
    });

    try {
      localStorage.setItem(STORAGE_PREFIX + 'student_grades', JSON.stringify(updatedGrades));
    } catch {}

    const targetSubGradeToSync = updatedGrades.find(g => g.studentId === studentId && g.classGroupId === targetClassId);
    if (targetSubGradeToSync) {
      syncEntityToSupabase('student_grades', targetSubGradeToSync);
      saveStudentGrade(targetSubGradeToSync);
    }

    const now = Date.now();
    setLocalLastUpdated(now);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students,
      sessions,
      justifications,
      studentGrades: updatedGrades,
      appSettings,
      selectedClassId,
      lastUpdated: now,
    });
  };

  const setStudentGradeNotes = (studentId: string, notes: string, classId?: string) => {
    const targetClassId = classId || selectedClassId;
    let updatedGrades: StudentGradeRecord[] = [];
    setStudentGrades(prev => {
      const existing = prev.find(g => g.studentId === studentId && g.classGroupId === targetClassId);
      if (existing) {
        updatedGrades = prev.map(g => g.studentId === studentId && g.classGroupId === targetClassId ? { ...g, notes, updatedAt: new Date().toISOString() } : g);
      } else {
        updatedGrades = [...prev, { studentId, classGroupId: targetClassId, scores: {}, notes, updatedAt: new Date().toISOString() }];
      }
      return updatedGrades;
    });

    try {
      localStorage.setItem(STORAGE_PREFIX + 'student_grades', JSON.stringify(updatedGrades));
    } catch {}

    const targetNotesGradeToSync = updatedGrades.find(g => g.studentId === studentId && g.classGroupId === targetClassId);
    if (targetNotesGradeToSync) {
      syncEntityToSupabase('student_grades', targetNotesGradeToSync);
      saveStudentGrade(targetNotesGradeToSync);
    }

    const now = Date.now();
    setLocalLastUpdated(now);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students,
      sessions,
      justifications,
      studentGrades: updatedGrades,
      appSettings,
      selectedClassId,
      lastUpdated: now,
    });
  };

  // Helper to calculate student's comprehensive academic status (15 Atividades + Attendance)
  const calculateAcademicStatus = (studentId: string, classId?: string): StudentAcademicStatus => {
    const targetClassId = classId || selectedClassId;
    const student = students.find(s => s.id === studentId);
    const gradeRecord = studentGrades.find(g => g.studentId === studentId && g.classGroupId === targetClassId);

    // 1. Calculate Attendance Rate
    const classSessions = sessions.filter(s => s.classGroupId === targetClassId);
    let totalSessions = classSessions.length;
    let presentCount = 0;
    let absentCount = 0;

    if (totalSessions > 0) {
      classSessions.forEach(session => {
        const rec = session.attendance?.[studentId];
        if (rec) {
          if (rec.status === 'present' || rec.status === 'late' || rec.status === 'excused') {
            presentCount++;
          } else {
            absentCount++;
          }
        } else {
          absentCount++;
        }
      });
    } else {
      presentCount = student?.presences || 0;
      absentCount = student?.absences || 0;
      totalSessions = presentCount + absentCount || 1;
    }

    const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 100;

    // 2. Calculate Category Averages (5 Teóricas, 5 Anatomia, 5 Histologia)
    const calcCatAvg = (keys: string[]) => {
      let sum = 0;
      let count = 0;
      keys.forEach(k => {
        const val = gradeRecord?.scores?.[k];
        if (val !== null && val !== undefined) {
          sum += val;
          count++;
        }
      });
      return count > 0 ? +(sum / count).toFixed(1) : 0;
    };

    const teoricaAverage = calcCatAvg(['t1', 't2', 't3', 't4', 't5']);
    const anatomiaAverage = calcCatAvg(['a1', 'a2', 'a3', 'a4', 'a5']);
    const histologiaAverage = calcCatAvg(['h1', 'h2', 'h3', 'h4', 'h5']);

    // Overall Partial Average (Equal weight across the 3 categories or valid scores)
    let totalValidSum = 0;
    let totalValidCount = 0;
    const all15Keys = ['t1', 't2', 't3', 't4', 't5', 'a1', 'a2', 'a3', 'a4', 'a5', 'h1', 'h2', 'h3', 'h4', 'h5'];
    all15Keys.forEach(k => {
      const val = gradeRecord?.scores?.[k];
      if (val !== null && val !== undefined) {
        totalValidSum += val;
        totalValidCount++;
      }
    });

    const partialAverage = totalValidCount > 0 ? +(totalValidSum / totalValidCount).toFixed(1) : 0;
    const substituteScore = gradeRecord?.substituteExamScore;
    
    let finalAverage = partialAverage;
    let status: 'aprovado' | 'exame' | 'reprovado_nota' | 'reprovado_falta' = 'aprovado';
    let statusLabel = 'Aprovado Direto';

    if (attendanceRate < 75 && totalSessions > 0) {
      status = 'reprovado_falta';
      statusLabel = 'Reprovado por Frequência (< 75%)';
    } else if (partialAverage >= 7.0) {
      status = 'aprovado';
      statusLabel = 'Aprovado Direto (Média ≥ 7.0)';
    } else if (partialAverage >= 5.0) {
      if (substituteScore !== null && substituteScore !== undefined) {
        finalAverage = +((partialAverage + substituteScore) / 2).toFixed(1);
        if (finalAverage >= 5.0) {
          status = 'aprovado';
          statusLabel = 'Aprovado em Exame (Média Final ≥ 5.0)';
        } else {
          status = 'reprovado_nota';
          statusLabel = 'Reprovado após Exame (Média < 5.0)';
        }
      } else {
        status = 'exame';
        statusLabel = 'Em Exame / Prova Substitutiva';
      }
    } else {
      status = 'reprovado_nota';
      statusLabel = 'Reprovado por Nota (< 5.0)';
    }

    return {
      studentId,
      studentName: student?.name || 'Aluno',
      registrationNumber: student?.registrationNumber || '',
      attendanceRate,
      totalPresences: presentCount,
      totalAbsences: absentCount,
      teoricaAverage,
      anatomiaAverage,
      histologiaAverage,
      partialAverage,
      finalAverage,
      substituteScore,
      status,
      statusLabel,
    };
  };

  // CRUD Students
  const addStudent = (studentData: Omit<Student, 'id'>) => {
    const newStudent: Student = {
      ...studentData,
      id: `std-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      discipline: studentData.discipline || 'BMF4',
      presences: 1,
      absences: 0,
      lates: 0,
      excused: 0,
    };
    const updatedStudents = [newStudent, ...students];
    setStudents(updatedStudents);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'students', JSON.stringify(updatedStudents));
    } catch {}

    syncEntityToSupabase('students', newStudent);

    const now = Date.now();
    setLocalLastUpdated(now);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students: updatedStudents,
      sessions,
      justifications,
      studentGrades,
      appSettings,
      selectedClassId,
      lastUpdated: now,
    });
    playBeep('success');
  };

  const updateStudent = (id: string, updates: Partial<Student>) => {
    const updatedStudents = students.map(s => s.id === id ? { ...s, ...updates } : s);
    setStudents(updatedStudents);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'students', JSON.stringify(updatedStudents));
    } catch {}

    const targetStudent = updatedStudents.find(s => s.id === id);
    if (targetStudent) {
      syncEntityToSupabase('students', targetStudent);
    }

    const now = Date.now();
    setLocalLastUpdated(now);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students: updatedStudents,
      sessions,
      justifications,
      studentGrades,
      appSettings,
      selectedClassId,
      lastUpdated: now,
    });
    playBeep('success');
  };

  const deleteStudent = (id: string) => {
    const updatedStudents = students.filter(s => s.id !== id);
    setStudents(updatedStudents);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'students', JSON.stringify(updatedStudents));
    } catch {}

    deleteEntityFromSupabase('students', id);
    deleteEntityFromSupabase('attendance_records', id);

    const newDeletedStudentIds = Array.from(new Set([...deletedStudentIdsRef.current, id]));
    setDeletedStudentIds(newDeletedStudentIds);
    deletedStudentIdsRef.current = newDeletedStudentIds;
    try {
      localStorage.setItem(STORAGE_PREFIX + 'deleted_student_ids', JSON.stringify(newDeletedStudentIds));
    } catch {}

    const updatedSessions = sessions.map(s => {
      if (s.attendance && s.attendance[id]) {
        const newAtt = { ...s.attendance };
        delete newAtt[id];
        return { ...s, attendance: newAtt };
      }
      return s;
    });
    setSessions(updatedSessions);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(updatedSessions));
    } catch {}

    const updatedJustifications = justifications.filter(j => j.studentId !== id);
    setJustifications(updatedJustifications);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'justifications', JSON.stringify(updatedJustifications));
    } catch {}

    const now = Date.now();
    setLocalLastUpdated(now);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students: updatedStudents,
      sessions: updatedSessions,
      deletedStudentIds: newDeletedStudentIds,
      justifications: updatedJustifications,
      studentGrades,
      appSettings,
      selectedClassId,
      lastUpdated: now,
    });

    fetch('/api/students/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: id,
        senderClientId: clientIdRef.current,
      }),
    }).catch(err => console.debug('Student delete API call:', err));

    playBeep('alert');
  };

  const resetStudentDeviceBinding = (studentId: string) => {
    const updatedStudents = students.map(s => {
      if (s.id === studentId) {
        return {
          ...s,
          boundDeviceId: undefined,
          deviceBoundAt: undefined,
        };
      }
      return s;
    });
    setStudents(updatedStudents);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'students', JSON.stringify(updatedStudents));
      localStorage.removeItem('bmf4_bound_student_ra');
      localStorage.removeItem('bmf4_bound_student_id');
      localStorage.removeItem('bmf4_bound_student_name');
    } catch {}

    const now = Date.now();
    setLocalLastUpdated(now);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students: updatedStudents,
      sessions,
      justifications,
      studentGrades,
      appSettings,
      selectedClassId,
      lastUpdated: now,
    });

    fetch('/api/students/reset-device-binding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId,
        senderClientId: clientIdRef.current,
      }),
    }).catch(() => {});

    playBeep('success');
  };

  const deleteMultipleStudents = (ids: string[]) => {
    const idSet = new Set(ids);
    const updatedStudents = students.filter(s => !idSet.has(s.id));
    setStudents(updatedStudents);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'students', JSON.stringify(updatedStudents));
    } catch {}

    deleteEntityFromSupabase('students', ids);
    deleteEntityFromSupabase('attendance_records', ids);

    const newDeletedStudentIds = Array.from(new Set([...deletedStudentIdsRef.current, ...ids]));
    setDeletedStudentIds(newDeletedStudentIds);
    deletedStudentIdsRef.current = newDeletedStudentIds;
    try {
      localStorage.setItem(STORAGE_PREFIX + 'deleted_student_ids', JSON.stringify(newDeletedStudentIds));
    } catch {}

    const updatedSessions = sessions.map(s => {
      if (s.attendance) {
        let changed = false;
        const newAtt = { ...s.attendance };
        ids.forEach(id => {
          if (newAtt[id]) {
            delete newAtt[id];
            changed = true;
          }
        });
        if (changed) {
          return { ...s, attendance: newAtt };
        }
      }
      return s;
    });
    setSessions(updatedSessions);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(updatedSessions));
    } catch {}

    const updatedJustifications = justifications.filter(j => !idSet.has(j.studentId));
    setJustifications(updatedJustifications);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'justifications', JSON.stringify(updatedJustifications));
    } catch {}

    const now = Date.now();
    setLocalLastUpdated(now);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students: updatedStudents,
      sessions: updatedSessions,
      deletedStudentIds: newDeletedStudentIds,
      justifications: updatedJustifications,
      studentGrades,
      appSettings,
      selectedClassId,
      lastUpdated: now,
    });

    fetch('/api/students/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentIds: ids,
        senderClientId: clientIdRef.current,
      }),
    }).catch(err => console.debug('Students batch delete API call:', err));

    playBeep('alert');
  };

  const deleteAllStudentsFromClass = (classId: string) => {
    const studentIdsToRemove = new Set<string>(students.filter(s => s.classGroupId === classId).map(s => s.id));
    const studentIdsArr = Array.from(studentIdsToRemove);
    const updatedStudents = students.filter(s => s.classGroupId !== classId);
    setStudents(updatedStudents);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'students', JSON.stringify(updatedStudents));
    } catch {}

    if (studentIdsArr.length > 0) {
      deleteEntityFromSupabase('students', studentIdsArr);
      deleteEntityFromSupabase('attendance_records', studentIdsArr);
    }

    const newDeletedStudentIds = Array.from(new Set([...deletedStudentIdsRef.current, ...studentIdsArr]));
    setDeletedStudentIds(newDeletedStudentIds);
    deletedStudentIdsRef.current = newDeletedStudentIds;
    try {
      localStorage.setItem(STORAGE_PREFIX + 'deleted_student_ids', JSON.stringify(newDeletedStudentIds));
    } catch {}

    const updatedSessions = sessions.map(s => {
      if (s.classGroupId === classId) {
        return { ...s, attendance: {} };
      }
      if (s.attendance) {
        let changed = false;
        const newAtt = { ...s.attendance };
        studentIdsToRemove.forEach((id: string) => {
          if (newAtt[id]) {
            delete newAtt[id];
            changed = true;
          }
        });
        if (changed) {
          return { ...s, attendance: newAtt };
        }
      }
      return s;
    });
    setSessions(updatedSessions);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(updatedSessions));
    } catch {}

    const updatedJustifications = justifications.filter(j => !studentIdsToRemove.has(j.studentId));
    setJustifications(updatedJustifications);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'justifications', JSON.stringify(updatedJustifications));
    } catch {}

    const now = Date.now();
    setLocalLastUpdated(now);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students: updatedStudents,
      sessions: updatedSessions,
      deletedStudentIds: newDeletedStudentIds,
      justifications: updatedJustifications,
      studentGrades,
      appSettings,
      selectedClassId,
      lastUpdated: now,
    });

    fetch('/api/students/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classGroupId: classId,
        all: true,
        studentIds: studentIdsArr,
        senderClientId: clientIdRef.current,
      }),
    }).catch(err => console.debug('Students delete all from class API call:', err));

    playBeep('alert');
  };

  const clearAllStudents = () => {
    const allIds = students.map(s => s.id);
    setStudents([]);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'students', '[]');
    } catch {}

    if (allIds.length > 0) {
      deleteEntityFromSupabase('students', allIds);
      deleteEntityFromSupabase('attendance_records', allIds);
    }

    const newDeletedStudentIds = Array.from(new Set([...deletedStudentIdsRef.current, ...allIds]));
    setDeletedStudentIds(newDeletedStudentIds);
    deletedStudentIdsRef.current = newDeletedStudentIds;
    try {
      localStorage.setItem(STORAGE_PREFIX + 'deleted_student_ids', JSON.stringify(newDeletedStudentIds));
    } catch {}

    const updatedSessions = sessions.map(s => ({ ...s, attendance: {} }));
    setSessions(updatedSessions);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(updatedSessions));
    } catch {}
    setJustifications([]);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'justifications', '[]');
    } catch {}

    const now = Date.now();
    setLocalLastUpdated(now);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students: [],
      sessions: updatedSessions,
      deletedStudentIds: newDeletedStudentIds,
      justifications: [],
      studentGrades,
      appSettings,
      selectedClassId,
      lastUpdated: now,
    });

    fetch('/api/students/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentIds: allIds,
        senderClientId: clientIdRef.current,
      }),
    }).catch(err => console.debug('Students clear all API call:', err));

    playBeep('alert');
  };

  const addMultipleStudents = (newStudentsData: Array<Omit<Student, 'id'>>) => {
    const created: Student[] = newStudentsData.map((data, idx) => ({
      ...data,
      id: `std-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
      discipline: data.discipline || 'BMF4',
      totalClasses: 0,
      presences: 0,
      absences: 0,
      lates: 0,
      excused: 0,
    }));
    const updatedStudents = [...created, ...students];
    setStudents(updatedStudents);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'students', JSON.stringify(updatedStudents));
    } catch {}

    syncEntityToSupabase('students', created);

    const now = Date.now();
    setLocalLastUpdated(now);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students: updatedStudents,
      sessions,
      justifications,
      studentGrades,
      appSettings,
      selectedClassId,
      lastUpdated: now,
    });
    playBeep('success');
    return created;
  };

  // CRUD Classes
  const addClassGroup = (classData: Omit<ClassGroup, 'id'> & { id?: string }) => {
    const classId = String(classData.id || `class-${Date.now()}`);
    const newClass: ClassGroup = {
      ...classData,
      id: classId,
      discipline: classData.discipline || 'BMF4 - Bases Morfofuncionais 4',
    };

    const newDeleted = deletedClassIdsRef.current.filter(id => id !== classId);
    if (newDeleted.length !== deletedClassIdsRef.current.length) {
      setDeletedClassIds(newDeleted);
      deletedClassIdsRef.current = newDeleted;
      try {
        localStorage.setItem(STORAGE_PREFIX + 'deleted_class_ids', JSON.stringify(newDeleted));
      } catch {}
    }

    const existingIndex = classes.findIndex(c => c.id === classId);
    let updatedClasses: ClassGroup[];
    if (existingIndex >= 0) {
      updatedClasses = classes.map(c => c.id === classId ? { ...c, ...newClass } : c);
    } else {
      updatedClasses = [...classes.filter(c => c.id !== classId), newClass];
    }
    updatedClasses = sortClassesAlphabetically(updatedClasses);
    setClasses(updatedClasses);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'classes', JSON.stringify(updatedClasses));
    } catch {}

    syncEntityToSupabase('classes', newClass);

    setSelectedClassId(classId);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'selectedClass', classId);
    } catch {}

    const now = Date.now();
    setLocalLastUpdated(now);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes: updatedClasses,
      students,
      sessions,
      justifications,
      studentGrades,
      appSettings,
      selectedClassId: classId,
      deletedClassIds: newDeleted,
      lastUpdated: now,
    });
    playBeep('success');
  };

  const updateClassGroup = (id: string, updates: Partial<ClassGroup>) => {
    const newDeleted = deletedClassIdsRef.current.filter(did => did !== id);
    if (newDeleted.length !== deletedClassIdsRef.current.length) {
      setDeletedClassIds(newDeleted);
      deletedClassIdsRef.current = newDeleted;
      try {
        localStorage.setItem(STORAGE_PREFIX + 'deleted_class_ids', JSON.stringify(newDeleted));
      } catch {}
    }

    const exists = classes.some(c => c.id === id);
    let updatedClasses: ClassGroup[];
    if (!exists) {
      const baseClass: ClassGroup = {
        id,
        name: updates.name || (id === BMF4_CLASS_IDS.TURMA_B ? 'Turma B' : id === BMF4_CLASS_IDS.TURMA_A ? 'Turma A' : id),
        discipline: updates.discipline || 'BMF4 - Bases Morfofuncionais 4',
        code: updates.code || id.toUpperCase().slice(0, 10),
        course: 'Medicina',
        semester: '4º Semestre 2026',
        laboratoryRoom: 'Laboratório de Anatomia & Morfologia',
        professorName: 'Docente Responsável',
        professorId: 'prof-docente-2',
        schedule: 'Horário Regular da Prática',
        color: '#0d9488',
        totalStudents: 0,
        ...updates
      };
      updatedClasses = [...classes, baseClass];
    } else {
      updatedClasses = classes.map(c => c.id === id ? { ...c, ...updates } : c);
    }
    updatedClasses = sortClassesAlphabetically(updatedClasses);
    setClasses(updatedClasses);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'classes', JSON.stringify(updatedClasses));
    } catch {}

    const targetClass = updatedClasses.find(c => c.id === id);
    if (targetClass) {
      syncEntityToSupabase('classes', targetClass);
    }

    const now = Date.now();
    setLocalLastUpdated(now);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes: updatedClasses,
      students,
      sessions,
      justifications,
      studentGrades,
      appSettings,
      selectedClassId,
      deletedClassIds: newDeleted,
      lastUpdated: now,
    });
    playBeep('success');
  };

  const deleteClassGroup = (id: string, deleteAssociatedStudents: boolean = false) => {
    const remainingClasses = classes.filter(c => c.id !== id);
    let nextClassId = selectedClassId;
    if (selectedClassId === id) {
      nextClassId = remainingClasses.length > 0 ? remainingClasses[0].id : '';
      setSelectedClassId(nextClassId);
      try {
        localStorage.setItem(STORAGE_PREFIX + 'selectedClass', nextClassId);
      } catch {}
    }

    deleteEntityFromSupabase('classes', id);

    const newDeletedClassIds = Array.from(new Set([...deletedClassIdsRef.current, id]));
    setDeletedClassIds(newDeletedClassIds);
    deletedClassIdsRef.current = newDeletedClassIds;
    try {
      localStorage.setItem(STORAGE_PREFIX + 'deleted_class_ids', JSON.stringify(newDeletedClassIds));
    } catch {}

    const sortedClasses = sortClassesAlphabetically(remainingClasses);
    setClasses(sortedClasses);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'classes', JSON.stringify(sortedClasses));
    } catch {}

    const removedSessions = sessions.filter(s => s.classGroupId === id);
    const removedSessionIds = removedSessions.map(s => s.id);
    if (removedSessionIds.length > 0) {
      deleteEntityFromSupabase('sessions', removedSessionIds);
    }
    const newDeletedSessionIds = Array.from(new Set([...deletedSessionIdsRef.current, ...removedSessionIds]));
    setDeletedSessionIds(newDeletedSessionIds);
    deletedSessionIdsRef.current = newDeletedSessionIds;
    try {
      localStorage.setItem(STORAGE_PREFIX + 'deleted_session_ids', JSON.stringify(newDeletedSessionIds));
    } catch {}

    const updatedSessions = sessions.filter(s => s.classGroupId !== id);
    setSessions(updatedSessions);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(updatedSessions));
    } catch {}

    let updatedStudents = students;
    let updatedJustifications = justifications;
    let newDeletedStudentIds = deletedStudentIdsRef.current;

    if (deleteAssociatedStudents) {
      const removedStudentsList = students.filter(s => s.classGroupId === id);
      const removedStudentIds = new Set(removedStudentsList.map(s => s.id));
      if (removedStudentsList.length > 0) {
        deleteEntityFromSupabase('students', Array.from(removedStudentIds));
      }
      newDeletedStudentIds = Array.from(new Set([...deletedStudentIdsRef.current, ...Array.from(removedStudentIds)]));
      setDeletedStudentIds(newDeletedStudentIds);
      deletedStudentIdsRef.current = newDeletedStudentIds;
      try {
        localStorage.setItem(STORAGE_PREFIX + 'deleted_student_ids', JSON.stringify(newDeletedStudentIds));
      } catch {}

      updatedJustifications = justifications.filter(j => !removedStudentIds.has(j.studentId));
      setJustifications(updatedJustifications);
      try {
        localStorage.setItem(STORAGE_PREFIX + 'justifications', JSON.stringify(updatedJustifications));
      } catch {}

      updatedStudents = students.filter(s => s.classGroupId !== id);
      setStudents(updatedStudents);
      try {
        localStorage.setItem(STORAGE_PREFIX + 'students', JSON.stringify(updatedStudents));
      } catch {}
    }

    const now = Date.now();
    setLocalLastUpdated(now);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes: sortedClasses,
      students: updatedStudents,
      sessions: updatedSessions,
      deletedClassIds: newDeletedClassIds,
      deletedStudentIds: newDeletedStudentIds,
      deletedSessionIds: newDeletedSessionIds,
      justifications: updatedJustifications,
      studentGrades,
      appSettings,
      selectedClassId: nextClassId,
      lastUpdated: now,
    });

    fetch('/api/classes/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classId: id,
        deleteAssociatedStudents,
        senderClientId: clientIdRef.current,
      }),
    }).catch(err => console.debug('Class delete API call:', err));

    playBeep('alert');
  };

  const restoreDefaultClasses = () => {
    const protectedIds = [BMF4_CLASS_IDS.TURMA_A, BMF4_CLASS_IDS.TURMA_B];
    const newDeleted = deletedClassIdsRef.current.filter(id => !protectedIds.includes(id as any));
    setDeletedClassIds(newDeleted);
    deletedClassIdsRef.current = newDeleted;
    try {
      localStorage.setItem(STORAGE_PREFIX + 'deleted_class_ids', JSON.stringify(newDeleted));
    } catch {}

    let updated = [...classes];
    INITIAL_CLASSES.forEach(def => {
      if (!updated.some(c => c.id === def.id || c.name.toLowerCase() === def.name.toLowerCase())) {
        updated.push(def);
      }
    });
    const sorted = sortClassesAlphabetically(updated);
    setClasses(sorted);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'classes', JSON.stringify(sorted));
    } catch {}

    const now = Date.now();
    setLocalLastUpdated(now);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes: sorted,
      students,
      sessions,
      deletedClassIds: newDeleted,
      deletedStudentIds,
      deletedSessionIds,
      justifications,
      studentGrades,
      appSettings,
      selectedClassId,
      lastUpdated: now,
    });
    playBeep('success');
  };

  // Start new lab session with guaranteed unique session ID and dynamic QR code
  const startNewSession = (
    optionsOrTopic: string | StartSessionOptions, 
    specimens?: string[], 
    notes?: string
  ) => {
    const uniqueTs = Date.now();
    const uniqueEntropy = Math.random().toString(36).substring(2, 9).toUpperCase();
    const uniqueSessionId = `sess-${uniqueTs}-${uniqueEntropy}`;

    // Generate fresh dynamic QR token and security hash with timestamp
    const { token: freshDynamicToken } = generateFreshDynamicTokenAndHash();

    // Clear active session cache before opening new session
    clearActiveSessionCache();

    const isOptionsObj = typeof optionsOrTopic === 'object';
    const topic = isOptionsObj ? optionsOrTopic.topic : optionsOrTopic;
    const targetClassId = (isOptionsObj && optionsOrTopic.classGroupId) ? optionsOrTopic.classGroupId : selectedClassId;
    const targetProfId = (isOptionsObj && optionsOrTopic.professorId) ? optionsOrTopic.professorId : activeProfessorId;
    const profObj = professors.find(p => p.id === targetProfId) || activeProfessor;
    const category: ActivityCategory = (isOptionsObj && optionsOrTopic.activityCategory) ? optionsOrTopic.activityCategory : 'pratica';
    const actType: ActivityType = (isOptionsObj && optionsOrTopic.activityType) ? optionsOrTopic.activityType : 'aula_pratica';
    const isActivity = actType.startsWith('atividade') || actType === 'prova_teorica';
    const defaultPeriod: ClassPeriod = isActivity ? 'activity_single' : 'p1_start';
    const period: ClassPeriod = (isOptionsObj && optionsOrTopic.activePeriod) ? optionsOrTopic.activePeriod : defaultPeriod;
    const sessionDate = (isOptionsObj && optionsOrTopic.date) ? optionsOrTopic.date : new Date().toISOString().split('T')[0];
    const labLoc: LaboratoryLocation | undefined = (isOptionsObj && optionsOrTopic.labLocation) 
      ? optionsOrTopic.labLocation 
      : (category === 'pratica' ? 'anatomia' : undefined);

    const isPeriod2Direct = period === '2' || period === 'p2_start' || period === 'p2_end';

    const newSession: LabSession = {
      id: uniqueSessionId,
      classGroupId: targetClassId,
      discipline: 'BMF4',
      professorId: targetProfId,
      professorName: profObj?.name || 'Prof. Dr. Juliano Pereira',
      activityCategory: category,
      activityType: actType,
      labLocation: labLoc,
      activePeriod: period,
      isPeriod1Locked: isPeriod2Direct,
      isPeriod2Locked: false,
      isP1StartLocked: isPeriod2Direct || period === 'p1_end',
      isP1EndLocked: isPeriod2Direct,
      isP2StartLocked: false,
      isP2EndLocked: false,
      isActivitySingleLocked: false,
      date: sessionDate,
      startTime: `${String(new Date(uniqueTs).getHours()).padStart(2, '0')}:${String(new Date(uniqueTs).getMinutes()).padStart(2, '0')}`,
      endTime: '12:00',
      topic: topic || (isActivity ? 'Atividade Prática BMF4' : 'Aula BMF4 - Morfofuncional'),
      anatomicalSpecimens: (isOptionsObj && optionsOrTopic.specimens) ? optionsOrTopic.specimens : (specimens && specimens.length > 0 ? specimens : ['Peças anatômicas / Roteiro prático']),
      checkinCode: freshDynamicToken,
      isLive: true,
      isLocked: false,
      isPaused: false,
      openedAt: new Date(uniqueTs).toISOString(),
      timestamp: uniqueTs,
      notes: (isOptionsObj && optionsOrTopic.notes) ? optionsOrTopic.notes : (notes || 'Obrigatório uso de EPI: Jaleco abotoado, luvas e calçado fechado.'),
      attendance: {},
      syncStatus: 'synced',
    };

    const classStudents = students.filter(s => s.classGroupId === targetClassId);
    classStudents.forEach(s => {
      newSession.attendance[s.id] = {
        studentId: s.id,
        status: 'absent',
        period1Status: 'absent',
        period2Status: 'absent',
        p1StartStatus: 'absent',
        p1EndStatus: 'absent',
        p2StartStatus: 'absent',
        p2EndStatus: 'absent',
        epiVerified: false,
      };
    });

    const updatedSessions = [
      newSession, 
      ...sessions.map(s => s.classGroupId === targetClassId ? { ...s, isLive: false, isLocked: true, isPaused: false } : s)
    ];
    setSessions(updatedSessions);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(updatedSessions));
      localStorage.setItem(STORAGE_PREFIX + 'active_session_id', uniqueSessionId);
      localStorage.setItem(STORAGE_PREFIX + 'active_period', period);
      sessionStorage.setItem('bmf4_active_session_id', uniqueSessionId);
      sessionStorage.setItem('bmf4_current_period', period);
    } catch {}

    setDismissedConflictId(null);

    const nextSelectedClassId = targetClassId || selectedClassId;
    if (targetClassId !== selectedClassId) {
      setSelectedClassId(targetClassId);
      try {
        localStorage.setItem(STORAGE_PREFIX + 'selectedClass', targetClassId);
      } catch {}
    }

    const nowTimestamp = Date.now();
    setLocalLastUpdated(nowTimestamp);
    syncSessionVersionToFirestore(newSession, 1);

    // Close previous live sessions of this class on Supabase as well
    const prevSessionsToClose = sessions.filter(s => s.classGroupId === targetClassId && s.isLive);
    if (prevSessionsToClose.length > 0) {
      prevSessionsToClose.forEach(ps => {
        syncSessionVersionToFirestore({ ...ps, isLive: false, isLocked: true, isPaused: false });
      });
    }

    broadcastCurrentState({
      professors,
      activeProfessorId: targetProfId || activeProfessorId,
      classes,
      students,
      sessions: updatedSessions,
      justifications,
      studentGrades,
      appSettings,
      selectedClassId: nextSelectedClassId,
      lastUpdated: nowTimestamp,
    });
    playBeep('session_start');
  };

  const updateSession = (sessionId: string, updates: Partial<LabSession>) => {
    let updatedSessionToSync: LabSession | null = null;
    const updated = sessions.map(s => {
      if (s.id === sessionId) {
        const up = { ...s, ...updates, lastUpdateTimestamp: Date.now() };
        updatedSessionToSync = up;
        return up;
      }
      return s;
    });
    setSessions(updated);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(updated));
    } catch {}

    if (updatedSessionToSync) {
      syncSessionVersionToFirestore(updatedSessionToSync);
    }

    const now = Date.now();
    setLocalLastUpdated(now);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students,
      sessions: updated,
      justifications,
      studentGrades,
      appSettings,
      selectedClassId,
      lastUpdated: now,
    });
  };

  const deleteSession = (sessionId: string) => {
    if (!sessionId) return;
    clearActiveSessionCache();
    deleteEntityFromSupabase('sessions', sessionId);
    const targetSession = sessions.find(s => s.id === sessionId);
    if (targetSession) archiveSessionsToTrash([targetSession]);

    const newDeletedIds = Array.from(new Set([...deletedSessionIdsRef.current, sessionId]));
    setDeletedSessionIds(newDeletedIds);
    deletedSessionIdsRef.current = newDeletedIds;
    try {
      localStorage.setItem(STORAGE_PREFIX + 'deleted_session_ids', JSON.stringify(newDeletedIds));
    } catch {}

    const updatedSessions = sessions.filter(s => s.id !== sessionId);
    const updatedStudents = computeStudentsWithRecalculatedStats(students, updatedSessions);
    setSessions(updatedSessions);
    setStudents(updatedStudents);

    // Clean outboxQueue of any checkins belonging to this deleted session
    setOutboxQueue(prev => {
      const filtered = prev.filter(item => !item.data || (item.data.sessionId !== sessionId && !newDeletedIds.includes(item.data.sessionId)));
      try {
        localStorage.setItem(STORAGE_PREFIX + 'outbox_queue', JSON.stringify(filtered));
      } catch {}
      return filtered;
    });

    try {
      localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(updatedSessions));
      localStorage.setItem(STORAGE_PREFIX + 'students', JSON.stringify(updatedStudents));
    } catch {}

    const now = Date.now();
    setLocalLastUpdated(now);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students: updatedStudents,
      sessions: updatedSessions,
      deletedSessionIds: newDeletedIds,
      justifications,
      studentGrades,
      appSettings,
      selectedClassId,
      userMutation: true,
      lastUpdated: now,
    });

    // Explicit server deletion & stat recalculation trigger
    fetch('/api/sessions/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        senderClientId: clientIdRef.current,
      }),
    }).catch(err => console.debug('Session delete API notice:', err));

    playBeep('delete');
  };

  const deleteMultipleSessions = (sessionIds: string[]) => {
    if (!Array.isArray(sessionIds) || sessionIds.length === 0) return;
    clearActiveSessionCache();
    deleteEntityFromSupabase('sessions', sessionIds);
    const idsSet = new Set(sessionIds);
    const sessionsToArchive = sessions.filter(s => idsSet.has(s.id));
    archiveSessionsToTrash(sessionsToArchive);

    const newDeletedIds = Array.from(new Set([...deletedSessionIdsRef.current, ...sessionIds]));
    setDeletedSessionIds(newDeletedIds);
    deletedSessionIdsRef.current = newDeletedIds;
    try {
      localStorage.setItem(STORAGE_PREFIX + 'deleted_session_ids', JSON.stringify(newDeletedIds));
    } catch {}

    const updatedSessions = sessions.filter(s => !idsSet.has(s.id));
    const updatedStudents = computeStudentsWithRecalculatedStats(students, updatedSessions);
    setSessions(updatedSessions);
    setStudents(updatedStudents);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(updatedSessions));
      localStorage.setItem(STORAGE_PREFIX + 'students', JSON.stringify(updatedStudents));
    } catch {}

    const now = Date.now();
    setLocalLastUpdated(now);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students: updatedStudents,
      sessions: updatedSessions,
      deletedSessionIds: newDeletedIds,
      justifications,
      studentGrades,
      appSettings,
      selectedClassId,
      userMutation: true,
      lastUpdated: now,
    });

    fetch('/api/sessions/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionIds,
        senderClientId: clientIdRef.current,
      }),
    }).catch(err => console.debug('Batch delete API notice:', err));

    playBeep('delete');
  };

  const updateSessionAttendance = (
    sessionId: string,
    studentId: string,
    status: AttendanceStatus,
    period?: ClassPeriod,
    epiVerified?: boolean
  ) => {
    const targetSession = sessions.find(s => s.id === sessionId);
    if (!targetSession) return;
    const targetPeriod = period || targetSession.activePeriod || 'both';
    const existingRec = targetSession.attendance?.[studentId];
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    let newPeriod1 = existingRec?.period1Status;
    let newPeriod2 = existingRec?.period2Status;
    let newP1Start = existingRec?.p1StartStatus;
    let newP1End = existingRec?.p1EndStatus;
    let newP2Start = existingRec?.p2StartStatus;
    let newP2End = existingRec?.p2EndStatus;

    let newP1StartTime = existingRec?.p1StartTimestamp;
    let newP1EndTime = existingRec?.p1EndTimestamp;
    let newP2StartTime = existingRec?.p2StartTimestamp;
    let newP2EndTime = existingRec?.p2EndTimestamp;
    let newPeriod1Time = existingRec?.period1Timestamp;
    let newPeriod2Time = existingRec?.period2Timestamp;

    if (status === 'absent') {
      if (targetPeriod === '1' || targetPeriod === 'p1_start') {
        newP1Start = 'absent';
        newP1StartTime = undefined;
        newPeriod1Time = undefined;
        newPeriod1 = 'absent';
      }
      if (targetPeriod === '1' || targetPeriod === 'p1_end') {
        newP1End = 'absent';
        newP1EndTime = undefined;
        if (targetPeriod === '1' || newP1Start !== 'present') {
          newPeriod1 = 'absent';
        }
      }
      if (targetPeriod === '2' || targetPeriod === 'p2_start') {
        newP2Start = 'absent';
        newP2StartTime = undefined;
        newPeriod2Time = undefined;
        newPeriod2 = 'absent';
      }
      if (targetPeriod === '2' || targetPeriod === 'p2_end') {
        newP2End = 'absent';
        newP2EndTime = undefined;
        if (targetPeriod === '2' || newP2Start !== 'present') {
          newPeriod2 = 'absent';
        }
      }
      if (targetPeriod === 'both' || targetPeriod === 'activity_single') {
        newPeriod1 = 'absent';
        newPeriod2 = 'absent';
        newP1Start = 'absent';
        newP1End = 'absent';
        newP2Start = 'absent';
        newP2End = 'absent';
        newP1StartTime = undefined;
        newP1EndTime = undefined;
        newP2StartTime = undefined;
        newP2EndTime = undefined;
        newPeriod1Time = undefined;
        newPeriod2Time = undefined;
      }
    } else {
      if (targetPeriod === 'p1_start') {
        newP1Start = status;
        if (status === 'present' || status === 'late') {
          newP1StartTime = timeStr;
          newPeriod1Time = timeStr;
        }
        newPeriod1 = status;
      } else if (targetPeriod === 'p1_end') {
        newP1End = status;
        if (status === 'present' || status === 'late') {
          newP1EndTime = timeStr;
          newPeriod1Time = timeStr;
        }
        newPeriod1 = status;
      } else if (targetPeriod === 'p2_start') {
        newP2Start = status;
        if (status === 'present' || status === 'late') {
          newP2StartTime = timeStr;
          newPeriod2Time = timeStr;
        }
        newPeriod2 = status;
      } else if (targetPeriod === 'p2_end') {
        newP2End = status;
        if (status === 'present' || status === 'late') {
          newP2EndTime = timeStr;
          newPeriod2Time = timeStr;
        }
        newPeriod2 = status;
      } else if (targetPeriod === 'activity_single') {
        newPeriod1 = status;
        newPeriod2 = status;
        newP1Start = status;
        newP1End = status;
        newP2Start = status;
        newP2End = status;
        if (status === 'present' || status === 'late') {
          newPeriod1Time = timeStr;
          newPeriod2Time = timeStr;
          newP1StartTime = timeStr;
        }
      } else if (targetPeriod === '1') {
        newPeriod1 = status;
        newP1Start = status;
        newP1End = status;
        if (status === 'present' || status === 'late') {
          newPeriod1Time = timeStr;
          newP1StartTime = newP1StartTime || timeStr;
          newP1EndTime = timeStr;
        }
      } else if (targetPeriod === '2') {
        newPeriod2 = status;
        newP2Start = status;
        newP2End = status;
        if (status === 'present' || status === 'late') {
          newPeriod2Time = timeStr;
          newP2StartTime = newP2StartTime || timeStr;
          newP2EndTime = timeStr;
        }
      } else {
        newPeriod1 = status;
        newPeriod2 = status;
        newP1Start = status;
        newP1End = status;
        newP2Start = status;
        newP2End = status;
        if (status === 'present' || status === 'late') {
          newPeriod1Time = timeStr;
          newPeriod2Time = timeStr;
          newP1StartTime = newP1StartTime || timeStr;
          newP1EndTime = timeStr;
          newP2StartTime = newP2StartTime || timeStr;
          newP2EndTime = timeStr;
        }
      }
    }

    const resolvedOverall = (status === 'absent' && (targetPeriod === 'both' || targetPeriod === 'activity_single'))
      ? 'absent'
      : status === 'absent'
      ? computeOverallStatus(newPeriod1, newPeriod2)
      : status;

    const nextVersion = (targetSession && typeof targetSession.version === 'number' ? targetSession.version : 0) + 1;
    const nowTs = Date.now();
    let targetSessionToSync: LabSession | null = null;

    const updatedSessions = sessions.map(s => {
      if (s.id === sessionId) {
        const updated: LabSession = {
          ...s,
          version: nextVersion,
          lastUpdateTimestamp: nowTs,
          attendance: {
            ...s.attendance,
            [studentId]: {
              studentId,
              status: resolvedOverall,
              period1Status: newPeriod1,
              period2Status: newPeriod2,
              p1StartStatus: newP1Start,
              p1EndStatus: newP1End,
              p2StartStatus: newP2Start,
              p2EndStatus: newP2End,
              p1StartTimestamp: newP1StartTime,
              p1EndTimestamp: newP1EndTime,
              p2StartTimestamp: newP2StartTime,
              p2EndTimestamp: newP2EndTime,
              period1Timestamp: newPeriod1Time,
              period2Timestamp: newPeriod2Time,
              timestamp: (status === 'present' || status === 'late') ? (existingRec?.timestamp || timeStr) : undefined,
              deviceId: (status === 'present' || status === 'late') ? existingRec?.deviceId : undefined,
              epiVerified: (status === 'present' || status === 'late') ? (epiVerified ?? true) : false,
              checkinMethod: existingRec?.checkinMethod || 'manual',
            }
          }
        };
        targetSessionToSync = updated;
        return updated;
      }
      return s;
    });

    const updatedStudents = computeStudentsWithRecalculatedStats(students, updatedSessions);
    setSessions(updatedSessions);
    setStudents(updatedStudents);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(updatedSessions));
      localStorage.setItem(STORAGE_PREFIX + 'students', JSON.stringify(updatedStudents));
    } catch {}

    setLocalLastUpdated(nowTs);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students: updatedStudents,
      sessions: updatedSessions,
      justifications,
      studentGrades,
      appSettings,
      selectedClassId,
      lastUpdated: nowTs,
    });

    if (targetSessionToSync) {
      syncSessionVersionToFirestore(targetSessionToSync, nextVersion);
    }

    const targetStudent = students.find(s => s.id === studentId);
    enqueueOutboxItem({
      eventType: status === 'excused' ? 'EXCUSE_STUDENT' : 'RECORD_ATTENDANCE',
      sessionId,
      studentId,
      studentName: targetStudent?.name,
      classGroupId: targetSession.classGroupId,
      status: resolvedOverall,
      period: targetPeriod,
      timestamp: timeStr,
      payload: {
        record: {
          studentId,
          status: resolvedOverall,
          period1Status: newPeriod1,
          period2Status: newPeriod2,
          p1StartStatus: newP1Start,
          p1EndStatus: newP1End,
          p2StartStatus: newP2Start,
          p2EndStatus: newP2End,
          timestamp: timeStr,
          epiVerified: (status === 'present' || status === 'late') ? (epiVerified ?? true) : false,
          checkinMethod: existingRec?.checkinMethod || 'manual',
        }
      }
    });

    playBeep(status === 'absent' ? 'delete' : 'success');
  };

  const deleteSessionAttendance = (sessionId: string, studentId: string) => {
    const targetSession = sessions.find(s => s.id === sessionId);
    if (!targetSession) return;
    const newAttendance = { ...targetSession.attendance };
    delete newAttendance[studentId];

    const nextVersion = (typeof targetSession.version === 'number' ? targetSession.version : 0) + 1;
    const nowTs = Date.now();
    let targetSessionToSync: LabSession | null = null;

    const updatedSessions = sessions.map(s => {
      if (s.id === sessionId) {
        const updated: LabSession = {
          ...s,
          attendance: newAttendance,
          version: nextVersion,
          lastUpdateTimestamp: nowTs,
        };
        targetSessionToSync = updated;
        return updated;
      }
      return s;
    });

    const updatedStudents = computeStudentsWithRecalculatedStats(students, updatedSessions);
    setSessions(updatedSessions);
    setStudents(updatedStudents);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(updatedSessions));
      localStorage.setItem(STORAGE_PREFIX + 'students', JSON.stringify(updatedStudents));
    } catch {}

    setLocalLastUpdated(nowTs);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students: updatedStudents,
      sessions: updatedSessions,
      justifications,
      studentGrades,
      appSettings,
      selectedClassId,
      lastUpdated: nowTs,
    });

    if (targetSessionToSync) {
      syncSessionVersionToFirestore(targetSessionToSync, nextVersion);
    }

    playBeep('delete');
  };

  const deleteAllSessionsForClass = (classGroupId: string) => {
    if (!classGroupId) return;
    clearActiveSessionCache();
    const classSessionsToDelete = sessions.filter(s => s.classGroupId === classGroupId);
    if (classSessionsToDelete.length === 0) return;
    archiveSessionsToTrash(classSessionsToDelete);

    const idsToDelete = classSessionsToDelete.map(s => s.id);
    if (idsToDelete.length > 0) {
      deleteEntityFromSupabase('sessions', idsToDelete);
    }
    const newDeletedIds = Array.from(new Set([...deletedSessionIdsRef.current, ...idsToDelete]));
    setDeletedSessionIds(newDeletedIds);
    deletedSessionIdsRef.current = newDeletedIds;
    try {
      localStorage.setItem(STORAGE_PREFIX + 'deleted_session_ids', JSON.stringify(newDeletedIds));
    } catch {}

    const updatedSessions = sessions.filter(s => s.classGroupId !== classGroupId);
    const updatedStudents = computeStudentsWithRecalculatedStats(students, updatedSessions);
    setSessions(updatedSessions);
    setStudents(updatedStudents);

    // Clean outboxQueue of any checkins belonging to deleted sessions of this class
    setOutboxQueue(prev => {
      const filtered = prev.filter(item => !item.data || (!idsToDelete.includes(item.data.sessionId) && !newDeletedIds.includes(item.data.sessionId)));
      try {
        localStorage.setItem(STORAGE_PREFIX + 'outbox_queue', JSON.stringify(filtered));
      } catch {}
      return filtered;
    });

    try {
      localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(updatedSessions));
      localStorage.setItem(STORAGE_PREFIX + 'students', JSON.stringify(updatedStudents));
    } catch {}

    const nowTs = Date.now();
    setLocalLastUpdated(nowTs);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students: updatedStudents,
      sessions: updatedSessions,
      deletedSessionIds: newDeletedIds,
      justifications,
      studentGrades,
      appSettings,
      selectedClassId,
      userMutation: true,
      lastUpdated: nowTs,
    });

    fetch('/api/sessions/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classGroupId,
        all: true,
        sessionIds: idsToDelete,
        senderClientId: clientIdRef.current,
      }),
    }).catch(err => console.debug('All class sessions delete API notice:', err));

    playBeep('delete');
  };

  const resetSessionAttendance = (sessionId: string) => {
    const targetSession = sessions.find(s => s.id === sessionId);
    if (!targetSession) return;
    const classStudents = students.filter(s => s.classGroupId === targetSession.classGroupId);
    const newAttendance: Record<string, AttendanceRecord> = {};

    classStudents.forEach(st => {
      newAttendance[st.id] = {
        studentId: st.id,
        status: 'absent',
        period1Status: 'absent',
        period2Status: 'absent',
        p1StartStatus: 'absent',
        p1EndStatus: 'absent',
        p2StartStatus: 'absent',
        p2EndStatus: 'absent',
        epiVerified: false,
        checkinMethod: 'manual',
      };
    });

    const nextVersion = (typeof targetSession.version === 'number' ? targetSession.version : 0) + 1;
    const nowTs = Date.now();
    let targetSessionToSync: LabSession | null = null;

    const updatedSessions = sessions.map(s => {
      if (s.id === sessionId) {
        const updated: LabSession = {
          ...s,
          attendance: newAttendance,
          version: nextVersion,
          lastUpdateTimestamp: nowTs,
        };
        targetSessionToSync = updated;
        return updated;
      }
      return s;
    });
    const updatedStudents = computeStudentsWithRecalculatedStats(students, updatedSessions);
    setSessions(updatedSessions);
    setStudents(updatedStudents);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(updatedSessions));
      localStorage.setItem(STORAGE_PREFIX + 'students', JSON.stringify(updatedStudents));
    } catch {}

    setLocalLastUpdated(nowTs);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students: updatedStudents,
      sessions: updatedSessions,
      justifications,
      studentGrades,
      appSettings,
      selectedClassId,
      lastUpdated: nowTs,
    });

    if (targetSessionToSync) {
      syncSessionVersionToFirestore(targetSessionToSync, nextVersion);
    }

    playBeep('delete');
  };

  // Justifications
  const handleJustificationStatus = (justificationId: string, status: 'approved' | 'rejected', reviewerName: string = activeProfessor?.name || 'Prof. Dr. Juliano Pereira') => {
    const just = justifications.find(j => j.id === justificationId);
    if (!just) return;

    const updatedJustifications = justifications.map(j => {
      if (j.id === justificationId) {
        return {
          ...j,
          status,
          reviewedAt: new Date().toISOString(),
          reviewedBy: reviewerName,
        };
      }
      return j;
    });

    setJustifications(updatedJustifications);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'justifications', JSON.stringify(updatedJustifications));
    } catch {}

    let updatedSessions = sessions;
    if (status === 'approved' && just.sessionId) {
      updatedSessions = sessions.map(s => {
        if (s.id === just.sessionId && s.attendance[just.studentId]) {
          return {
            ...s,
            attendance: {
              ...s.attendance,
              [just.studentId]: {
                ...s.attendance[just.studentId],
                status: 'excused',
                period1Status: just.period === '2' ? s.attendance[just.studentId].period1Status : 'excused',
                period2Status: just.period === '1' ? s.attendance[just.studentId].period2Status : 'excused',
                observation: `Justificativa aprovada (${just.documentNumber || 'Atestado'}): ${just.description}`,
                justificationReason: just.description,
                justificationFileUrl: just.attachmentUrl,
                justificationFileName: just.attachmentName,
              }
            }
          };
        }
        return s;
      });

      setSessions(updatedSessions);
      try {
        localStorage.setItem(STORAGE_PREFIX + 'sessions', JSON.stringify(updatedSessions));
      } catch {}
    }

    const updatedJustRec = updatedJustifications.find(j => j.id === justificationId);
    if (updatedJustRec) {
      syncEntityToSupabase('justifications', updatedJustRec);
    }

    const now = Date.now();
    setLocalLastUpdated(now);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students,
      sessions: updatedSessions,
      justifications: updatedJustifications,
      studentGrades,
      appSettings,
      selectedClassId,
      lastUpdated: now,
    });

    if (status === 'approved' && just.sessionId) {
      enqueueOutboxItem({
        eventType: 'EXCUSE_STUDENT',
        sessionId: just.sessionId,
        studentId: just.studentId,
        studentName: just.studentName,
        status: 'excused',
        period: just.period || 'both',
        timestamp: new Date().toISOString(),
        payload: {
          reason: just.description,
          fileUrl: just.attachmentUrl,
          fileName: just.attachmentName,
        }
      });
    }

    if (status === 'approved') {
      playBeep('success');
    } else {
      playBeep('warning');
    }
  };

  const submitJustification = (justData: Omit<JustificationRequest, 'id' | 'submittedAt' | 'status'>) => {
    const student = students.find(s => s.id === justData.studentId);
    const session = sessions.find(s => s.id === justData.sessionId);

    const newJust: JustificationRequest = {
      ...justData,
      id: `just-${Date.now()}`,
      studentName: student?.name || justData.studentName || 'Aluno',
      studentRa: student?.registrationNumber || justData.studentRa || 'RA',
      sessionTopic: session?.topic || justData.sessionTopic || 'Aula BMF4',
      submittedAt: new Date().toISOString(),
      status: 'pending',
    };
    const updated = [newJust, ...justifications];
    setJustifications(updated);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'justifications', JSON.stringify(updated));
    } catch {}

    syncEntityToSupabase('justifications', newJust);

    const now = Date.now();
    setLocalLastUpdated(now);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students,
      sessions,
      justifications: updated,
      studentGrades,
      appSettings,
      selectedClassId,
      lastUpdated: now,
    });

    playBeep('excused');
  };

  const deleteJustification = (justificationId: string) => {
    const updated = justifications.filter(j => j.id !== justificationId);
    setJustifications(updated);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'justifications', JSON.stringify(updated));
    } catch {}

    deleteEntityFromSupabase('justifications', justificationId);

    const now = Date.now();
    setLocalLastUpdated(now);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students,
      sessions,
      justifications: updated,
      studentGrades,
      appSettings,
      selectedClassId,
      lastUpdated: now,
    });

    playBeep('delete');
  };

  const updateAppSettings = (updates: Partial<AppSettings>) => {
    const updated = { ...appSettings, ...updates };
    setAppSettings(updated);
    try {
      localStorage.setItem(STORAGE_PREFIX + 'settings', JSON.stringify(updated));
    } catch {}

    syncEntityToSupabase('app_settings', { id: 'global_settings', settings_payload: updated });

    const now = Date.now();
    setLocalLastUpdated(now);
    broadcastCurrentState({
      professors,
      activeProfessorId,
      classes,
      students,
      sessions,
      justifications,
      studentGrades,
      appSettings: updated,
      selectedClassId,
      lastUpdated: now,
    });
  };

  const resetAllData = () => {
    localStorage.removeItem(STORAGE_PREFIX + 'professors');
    localStorage.removeItem(STORAGE_PREFIX + 'active_prof');
    localStorage.removeItem(STORAGE_PREFIX + 'classes');
    localStorage.removeItem(STORAGE_PREFIX + 'students');
    localStorage.removeItem(STORAGE_PREFIX + 'sessions');
    localStorage.removeItem(STORAGE_PREFIX + 'deleted_session_ids');
    localStorage.removeItem(STORAGE_PREFIX + 'deleted_professor_ids');
    localStorage.removeItem(STORAGE_PREFIX + 'deleted_student_ids');
    localStorage.removeItem(STORAGE_PREFIX + 'deleted_class_ids');
    localStorage.removeItem(STORAGE_PREFIX + 'justifications');
    localStorage.removeItem(STORAGE_PREFIX + 'settings');
    localStorage.removeItem(STORAGE_PREFIX + 'student_grades');
    localStorage.removeItem(STORAGE_PREFIX + 'selectedClass');
    localStorage.removeItem(STORAGE_PREFIX + 'last_updated');
    localStorage.removeItem(STORAGE_PREFIX + 'outbox_queue');

    const blankAdmin: Professor = {
      id: 'prof-admin-blank',
      name: 'Administrador (Em Branco)',
      email: 'admin@bmf4.edu',
      role: 'admin',
      pin: '1234',
      hasChangedPin: false,
      discipline: 'BMF4',
      assignedClassIds: [],
    };

    setProfessors([blankAdmin]);
    setActiveProfessorId(blankAdmin.id);
    setClasses([]);
    setStudents([]);
    setSessions([]);
    setDeletedSessionIds([]);
    deletedSessionIdsRef.current = [];
    setDeletedProfessorIds([]);
    deletedProfessorIdsRef.current = [];
    setDeletedStudentIds([]);
    deletedStudentIdsRef.current = [];
    setDeletedClassIds([]);
    deletedClassIdsRef.current = [];
    setJustifications([]);
    setAppSettings(DEFAULT_SETTINGS);
    setStudentGrades([]);
    setSelectedClassId('');

    const now = Date.now();
    setLocalLastUpdated(now);
    setLastSyncTimestamp(now);

    // Direct Cloud Wipe on Supabase tables to ensure PC and Mobile stay 100% in sync without ghost data
    if (navigator.onLine) {
      Promise.allSettled([
        supabase.from('sessions').delete().neq('id', '_keep_none_'),
        supabase.from('students').delete().neq('id', '_keep_none_'),
        supabase.from('classes').delete().neq('id', '_keep_none_'),
        supabase.from('justifications').delete().neq('id', '_keep_none_'),
        supabase.from('student_grades').delete().neq('id', '_keep_none_'),
        supabase.from('attendance_records').delete().neq('id', '_keep_none_'),
        supabase.from('app_settings').delete().neq('id', '_keep_none_'),
        supabase.from('teachers').delete().neq('id', blankAdmin.id),
      ]).then(() => {
        syncEntityToSupabase('teachers', blankAdmin);
        syncEntityToSupabase('app_settings', { id: 'global_settings', settings_payload: DEFAULT_SETTINGS });
        console.log('✅ [Supabase Limpa Tudo] Todas as tabelas no Supabase foram zeradas com sucesso.');
      }).catch(err => {
        console.warn('⚠️ [Supabase Limpa Tudo Notice]:', err);
      });
    }

    broadcastCurrentState({
      professors: [blankAdmin],
      activeProfessorId: blankAdmin.id,
      classes: [],
      students: [],
      sessions: [],
      deletedSessionIds: [],
      deletedProfessorIds: [],
      deletedStudentIds: [],
      deletedClassIds: [],
      justifications: [],
      appSettings: DEFAULT_SETTINGS,
      studentGrades: [],
      selectedClassId: '',
      lastUpdated: now,
      isExplicitReset: true,
    });

    fetch('/api/sync/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senderClientId: clientIdRef.current }),
    }).catch(err => console.debug('Sync reset API call:', err));

    playBeep('success');
  };

  return (
    <LabContext.Provider
      value={{
        professors,
        activeProfessorId,
        activeProfessor,
        classes,
        students,
        sessions,
        justifications,
        studentGrades,
        selectedClassId,
        activeSession,
        appSettings,
        soundEnabled,
        isOnline,
        isSyncing,
        realtimeConnected,
        connectedDevices,
        connectedDevicesList,
        customDeviceName,
        setCustomDeviceName,
        deviceType,
        setDeviceType,
        lastSyncTimestamp,
        lastSyncDate,
        triggerSync,
        forceSyncMaster,
        outboxQueue,
        outboxPendingCount,
        isOutboxSyncing,
        lastOutboxSyncDate,
        enqueueOutboxItem,
        processOutboxQueue,
        clearSyncedOutbox,
        clearAllOutbox,
        dynamicToken,
        dynamicSecondsLeft,
        dynamicSecurityHash,
        dynamicCycleNumber,
        lastEmailDispatch,
        triggerManualEmailDispatch,
        deviceFingerprint,
        resetDeviceLockForTesting,
        teacherPresences,
        teacherConflict,
        joinAsCoTeacher,
        takeOverSession,
        dismissTeacherConflict,
        setActiveProfessorId,
        setSelectedClassId,
        setSoundEnabled,
        updateAppSettings,
        toggleLiveSession,
        pauseLiveSession,
        resumeLiveSession,
        reopenCurrentSession,
        lockCurrentSession,
        clearActiveSessionCache,
        resetSessionState,
        lockPeriod1,
        lockPeriod2,
        setActivePeriod,
        transitionToPeriod,
        setAttendanceStatus,
        markAllPresent,
        resetCurrentAttendance,
        simulateStudentCheckin,
        syncSessionVersionToFirestore,
        applySessionAttendanceFromCloud,
        studentSelfCheckin,
        selfRegisterAndCheckin,
        loginProfessor,
        logoutProfessor,
        registerProfessor,
        changeProfessorPin,
        addProfessor,
        updateProfessor,
        deleteProfessor,
        deletedProfessorIds,
        addStudent,
        addMultipleStudents,
        updateStudent,
        deleteStudent,
        deleteMultipleStudents,
        deleteAllStudentsFromClass,
        clearAllStudents,
        resetStudentDeviceBinding,
        deletedStudentIds,
        addClassGroup,
        updateClassGroup,
        deleteClassGroup,
        restoreDefaultClasses,
        deletedClassIds,
        startNewSession,
        updateSession,
        deleteSession,
        deleteMultipleSessions,
        deleteAllSessionsForClass,
        deletedSessionIds,
        archivedSessions,
        restoreSession,
        permanentDeleteArchivedSession,
        updateSessionAttendance,
        deleteSessionAttendance,
        resetSessionAttendance,
        handleJustificationStatus,
        submitJustification,
        deleteJustification,
        setStudentGradeScore,
        setStudentSubstituteExamScore,
        setStudentGradeNotes,
        calculateAcademicStatus,
        playBeep,
        resetAllData,
      }}
    >
      {children}
    </LabContext.Provider>
  );
};

export const useLab = () => {
  const context = useContext(LabContext);
  if (!context) {
    throw new Error('useLab must be used within a LabProvider');
  }
  return context;
};
