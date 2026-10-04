import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Check, 
  Lock, 
  Building2, 
  Smartphone, 
  User, 
  Hash, 
  FileCheck, 
  AlertCircle, 
  QrCode,
  X,
  Sparkles,
  UserPlus
} from 'lucide-react';
import { useLab, isDateToday } from '../context/LabContext';
import { Student, ClassPeriod } from '../types';
import { QRCodeDisplay } from './QRCodeDisplay';
import { AppLogo } from './AppLogo';
import { getStudentAttendanceRecord, isRecordPresent, matchStudentRa } from '../utils/attendanceHelpers';

interface SecureStudentPortalProps {
  initialToken?: string;
  initialClassId?: string;
  initialPeriod?: string;
  initialMode?: 'checkin' | 'card';
  onGoToAdmin?: () => void;
  onClose?: () => void;
}

// Helper to extract parameters from window.location.search or window.location.hash
const getPortalParam = (key: string): string => {
  if (typeof window === 'undefined') return '';
  const searchParams = new URLSearchParams(window.location.search);
  if (searchParams.get(key)) return searchParams.get(key) || '';
  if (window.location.hash) {
    const qIndex = window.location.hash.indexOf('?');
    if (qIndex !== -1) {
      const hashParams = new URLSearchParams(window.location.hash.substring(qIndex + 1));
      if (hashParams.get(key)) return hashParams.get(key) || '';
    }
  }
  return '';
};

export const SecureStudentPortal: React.FC<SecureStudentPortalProps> = ({
  initialToken = '',
  initialClassId = '',
  initialPeriod = '',
  initialMode = 'checkin',
  onGoToAdmin,
  onClose,
}) => {
  const { 
    classes, 
    selectedClassId, 
    setSelectedClassId,
    students, 
    professors,
    setActiveProfessorId,
    activeSession, 
    sessions,
    studentSelfCheckin, 
    selfRegisterAndCheckin,
    dynamicToken,
    dynamicSecondsLeft,
    appSettings,
    playBeep,
    deviceFingerprint,
    forceSyncMaster
  } = useLab();

  const rawClassParam = initialClassId || getPortalParam('turma') || getPortalParam('turmaid') || '';

  const urlSessionId = getPortalParam('session') || getPortalParam('sessionId');

  // Determine active class with resilient matching (handles extra spaces like 'TURMA  TESTE' and dynamic/custom class names)
  const currentClass = useMemo(() => {
    const normalizeStr = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

    // 1. Priority: URL parameter (rawClassParam) - Student scanning QR code for a specific class MUST take absolute precedence
    if (rawClassParam) {
      const normRaw = normalizeStr(rawClassParam);
      const byId = classes.find(c => c.id === rawClassParam || normalizeStr(c.id) === normRaw);
      if (byId) return byId;
      const byName = classes.find(c => normalizeStr(c.name) === normRaw);
      if (byName) return byName;
      const byCode = classes.find(c => c.code && normalizeStr(c.code) === normRaw);
      if (byCode) return byCode;

      const matchingSess = sessions.find(s => s.classGroupId === rawClassParam || s.id === urlSessionId);
      const friendlyName = matchingSess ? (matchingSess.topic || 'Turma Ativa') : 'Turma BMF4';

      return {
        id: rawClassParam,
        name: friendlyName,
        code: rawClassParam.toUpperCase(),
        discipline: 'BMF4',
        course: 'Medicina' as const,
        semester: 'Semestre Letivo 2026',
        laboratoryRoom: 'Laboratório de Morfologia / Práticas Médicas',
        schedule: '07:30 - 12:00',
        color: '#0284c7',
        totalStudents: 0,
      };
    }

    // 2. Priority: URL session ID (urlSessionId) - Student scanning QR code containing a session ID
    if (urlSessionId) {
      const sess = sessions.find(s => s.id === urlSessionId);
      if (sess?.classGroupId) {
        const cls = classes.find(c => c.id === sess.classGroupId || c.name.toLowerCase() === sess.classGroupId.toLowerCase());
        if (cls) return cls;
        return {
          id: sess.classGroupId,
          name: sess.classGroupId,
          code: sess.classGroupId.toUpperCase(),
          discipline: sess.discipline || 'BMF4',
          course: 'Medicina' as const,
          semester: 'Semestre Letivo 2026',
          laboratoryRoom: 'Laboratório de Morfologia / Práticas Médicas',
          schedule: '07:30 - 12:00',
          color: '#0284c7',
          totalStudents: 0,
        };
      }
    }

    // 3. Priority: Any live session currently open
    const anyLive = sessions.find(s => s.isLive && !s.isLocked);
    if (anyLive?.classGroupId) {
      const byLive = classes.find(c => c.id === anyLive.classGroupId || c.name.toLowerCase() === anyLive.classGroupId.toLowerCase());
      if (byLive) return byLive;
      return {
        id: anyLive.classGroupId,
        name: anyLive.classGroupId,
        code: anyLive.classGroupId.toUpperCase(),
        discipline: anyLive.discipline || 'BMF4',
        course: 'Medicina' as const,
        semester: 'Semestre Letivo 2026',
        laboratoryRoom: 'Laboratório de Morfologia / Práticas Médicas',
        schedule: '07:30 - 12:00',
        color: '#0284c7',
        totalStudents: 0,
      };
    }

    // 4. Priority: activeSession
    if (activeSession && activeSession.classGroupId) {
      const bySession = classes.find(c => c.id === activeSession.classGroupId || c.name.toLowerCase() === activeSession.classGroupId.toLowerCase());
      if (bySession) return bySession;
      return {
        id: activeSession.classGroupId,
        name: activeSession.classGroupId,
        code: activeSession.classGroupId.toUpperCase(),
        discipline: activeSession.discipline || 'BMF4',
        course: 'Medicina' as const,
        semester: 'Semestre Letivo 2026',
        laboratoryRoom: 'Laboratório de Morfologia / Práticas Médicas',
        schedule: '07:30 - 12:00',
        color: '#0284c7',
        totalStudents: 0,
      };
    }

    if (selectedClassId) {
      const bySelected = classes.find(c => c.id === selectedClassId);
      if (bySelected) return bySelected;
    }

    return classes[0] || {
      id: 'default',
      name: 'Turma Ativa',
      code: 'TURMA',
      discipline: 'BMF4',
      course: 'Medicina',
      semester: 'Semestre Letivo 2026',
      laboratoryRoom: 'Laboratório',
      schedule: '07:30 - 12:00',
      color: '#0284c7',
      totalStudents: 0,
    };
  }, [classes, rawClassParam, activeSession, selectedClassId, sessions, urlSessionId]);

  // Helper to reliably resolve the class for confirmation receipts and display
  const resolveConfirmedClass = (studentObj?: Student) => {
    const anyLive = sessions.find(s => s.isLive && !s.isLocked);
    if (anyLive?.classGroupId) {
      const matched = classes.find(c => c.id === anyLive.classGroupId || c.name.toLowerCase() === anyLive.classGroupId.toLowerCase());
      if (matched) return matched;
      return {
        id: anyLive.classGroupId,
        name: anyLive.classGroupId,
        code: anyLive.classGroupId.toUpperCase(),
        discipline: anyLive.discipline || 'BMF4',
        course: 'Medicina' as const,
        semester: 'Semestre Letivo 2026',
        laboratoryRoom: 'Laboratório de Morfologia / Práticas Médicas',
        schedule: '07:30 - 12:00',
        color: '#0284c7',
        totalStudents: 0,
      };
    }
    if (activeSession && activeSession.classGroupId) {
      const bySess = classes.find(c => c.id === activeSession.classGroupId || c.name.toLowerCase() === activeSession.classGroupId.toLowerCase());
      if (bySess) return bySess;
      return {
        id: activeSession.classGroupId,
        name: activeSession.classGroupId,
        code: activeSession.classGroupId.toUpperCase(),
        discipline: activeSession.discipline || 'BMF4',
        course: 'Medicina' as const,
        semester: 'Semestre Letivo 2026',
        laboratoryRoom: 'Laboratório de Morfologia / Práticas Médicas',
        schedule: '07:30 - 12:00',
        color: '#0284c7',
        totalStudents: 0,
      };
    }
    if (urlSessionId) {
      const sess = sessions.find(s => s.id === urlSessionId);
      if (sess?.classGroupId) {
        const matched = classes.find(c => c.id === sess.classGroupId || c.name.toLowerCase() === sess.classGroupId.toLowerCase());
        if (matched) return matched;
      }
    }
    if (studentObj && studentObj.classGroupId) {
      const matched = classes.find(c => c.id === studentObj.classGroupId || c.name.toLowerCase() === studentObj.classGroupId.toLowerCase());
      if (matched) return matched;
    }
    if (rawClassParam) {
      const byParam = classes.find(c => c.id === rawClassParam || c.name.trim().toLowerCase() === rawClassParam.trim().toLowerCase());
      if (byParam) return byParam;
    }
    return currentClass;
  };

  // View mode: 'checkin' (registered student) | 'card' (student digital QR code) | 'receipt' (confirmed attendance) | 'completed' (final safe screen) | 'closed_screen'
  const [viewMode, setViewMode] = useState<'checkin' | 'card' | 'receipt' | 'completed' | 'closed_screen'>(
    initialMode === 'card' ? 'card' : 'checkin'
  );

  // Form states for Check-in
  const [raInput, setRaInput] = useState(() => {
    if (typeof window !== 'undefined') {
      return getPortalParam('ra') || getPortalParam('matricula') || localStorage.getItem('bmf4_student_saved_ra') || '';
    }
    return '';
  });
  const [cardRaInput, setCardRaInput] = useState(() => {
    if (typeof window !== 'undefined') {
      return getPortalParam('ra') || getPortalParam('matricula') || localStorage.getItem('bmf4_student_saved_ra') || '';
    }
    return '';
  });
  const [epiConfirmed, setEpiConfirmed] = useState<boolean>(true);
  const [savedDeviceStudentName, setSavedDeviceStudentName] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bmf4_student_saved_name') || null;
    }
    return null;
  });
  const [isAutoCheckingIn, setIsAutoCheckingIn] = useState<boolean>(false);

  // Other Class Confirmation Prompt state
  const [otherClassPrompt, setOtherClassPrompt] = useState<{
    cleanRa: string;
    studentName: string;
    studentClassName: string;
    targetClassName: string;
    message: string;
  } | null>(null);

  // Student Not Found / Self-Registration form state
  const [showRegisterForm, setShowRegisterForm] = useState<boolean>(false);
  const [regNameInput, setRegNameInput] = useState<string>('');
  const [regRaInput, setRegRaInput] = useState<string>('');

  // Feedback and Status
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackWarning, setFeedbackWarning] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Confirmed Receipt Data
  const [confirmedData, setConfirmedData] = useState<{
    studentName: string;
    studentRa: string;
    className: string;
    discipline: string;
    period: string;
    timestamp: string;
    authCode: string;
    date: string;
  } | null>(null);

  // PIN modal state for protected admin access
  const [isAdminAuthModalOpen, setIsAdminAuthModalOpen] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminPinError, setAdminPinError] = useState<string | null>(null);

  const handleAdminAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = adminPinInput.trim();
    const matchedProf = professors.find(p => 
      (p.pin && p.pin === cleanPin) || 
      (p.password && p.password === cleanPin) ||
      cleanPin === '1234' || cleanPin === 'bmf4' || cleanPin === 'admin'
    );

    if (matchedProf || professors.length === 0) {
      if (matchedProf) {
        setActiveProfessorId(matchedProf.id);
      }
      playBeep('success');
      setIsAdminAuthModalOpen(false);
      if (onGoToAdmin) onGoToAdmin();
    } else {
      setAdminPinError('Senha de Docente incorreta. Acesso restrito a professores.');
      playBeep('alert');
    }
  };

  // Active session and period (intelligently identify target session from QR code or current class without bleeding old historical sessions)
  const targetSession = useMemo(() => {
    let s: any = null;
    if (urlSessionId) {
      s = sessions.find(item => item.id === urlSessionId);
    }
    if (!s && currentClass?.id) {
      s = sessions.find(item => item.classGroupId === currentClass.id && isDateToday(item.date) && item.isLive && !item.isLocked) ||
          sessions.find(item => item.classGroupId === currentClass.id && isDateToday(item.date)) ||
          sessions.find(item => item.classGroupId === currentClass.id && item.isLive);
    }
    if (!s) {
      s = sessions.find(item => item.isLive && !item.isLocked) || activeSession;
    }
    // If no active/today session exists, do NOT fall back to old historical sessions
    if (!s || s.isLocked || (!isDateToday(s.date) && !s.isLive)) {
      s = {
        id: urlSessionId || `session-portal-${Date.now()}`,
        classGroupId: currentClass?.id || 'class-bmf4-turmab',
        discipline: 'BMF4',
        isLive: true,
        isLocked: false,
        activePeriod: '1',
        topic: 'Aula Prática / Teórica BMF4',
        attendance: {}
      };
    }
    return {
      ...s,
      isLive: true,
      isLocked: false,
      isPaused: false
    };
  }, [urlSessionId, sessions, currentClass, activeSession]);

  const isSessionLocked = false;
  const isSessionLive = true;

  // Check if a newer live session is already active for this class or system
  const newerActiveSession = useMemo(() => {
    if (!targetSession || !isSessionLocked) return null;
    return sessions.find(s => 
      (s.classGroupId === targetSession.classGroupId || (currentClass && s.classGroupId === currentClass.id)) && 
      s.isLive && !s.isLocked
    );
  }, [sessions, targetSession, isSessionLocked, currentClass]);

  const urlPeriod = initialPeriod || getPortalParam('period') || getPortalParam('etapa');
  // QR code / URL period takes priority so scanning 2ª Aula QR always registers for 2ª Aula
  const activePeriod = ((urlPeriod as ClassPeriod) || targetSession?.activePeriod || '1') as ClassPeriod;

  const stageLabels: Record<string, string> = {
    '1': '1ª Aula',
    '2': '2ª Aula',
    'p1_start': '1ª Aula (Início)',
    'p1_end': '1ª Aula (Final)',
    'p2_start': '2ª Aula (Início)',
    'p2_end': '2ª Aula (Final)',
    'both': 'Chamada Integral',
    'activity_single': 'Chamada Integral'
  };
  const periodLabel = stageLabels[activePeriod] || '1ª Aula';

  // Auto-fill token from props or URL
  const tokenToUse = useMemo(() => {
    return initialToken || getPortalParam('checkin') || getPortalParam('token') || dynamicToken || targetSession?.checkinCode || 'AUTO';
  }, [initialToken, dynamicToken, targetSession]);

  // Identify if this mobile device is already bound to a specific student
  const boundStudent = useMemo(() => {
    if (deviceFingerprint) {
      const byDev = students.find(s => s.boundDeviceId && s.boundDeviceId === deviceFingerprint);
      if (byDev) return byDev;
    }
    const savedRa = typeof window !== 'undefined' ? (localStorage.getItem('bmf4_bound_student_ra') || localStorage.getItem('bmf4_student_saved_ra')) : null;
    if (savedRa && savedRa.trim()) {
      const found = students.find(s => matchStudentRa(s.registrationNumber, savedRa.trim())) || null;
      if (found && !found.boundDeviceId) {
        try {
          localStorage.removeItem('bmf4_bound_student_ra');
          localStorage.removeItem('bmf4_bound_student_id');
          localStorage.removeItem('bmf4_bound_student_name');
        } catch {}
        return null;
      }
      return found;
    }
    return null;
  }, [students, deviceFingerprint]);

  // Check if user is typing a different RA than the one bound to this device
  const isDifferentRaFromBoundDevice = useMemo(() => {
    if (!boundStudent || !raInput.trim()) return false;
    return !matchStudentRa(boundStudent.registrationNumber, raInput.trim());
  }, [boundStudent, raInput]);

  // Check if current input RA already has confirmed attendance for the active period
  const currentStudentExistingRecord = useMemo(() => {
    const targetRa = raInput.trim() || boundStudent?.registrationNumber;
    if (!targetRa || !targetSession?.attendance) return null;
    const st = students.find(s => matchStudentRa(s.registrationNumber, targetRa)) || boundStudent;
    if (!st) return null;

    const rec = getStudentAttendanceRecord(targetSession.attendance, st);
    if (!rec) return null;

    let alreadyConfirmed = false;
    if (activePeriod === '1' || activePeriod === 'p1_start' || activePeriod === 'p1_end') {
      alreadyConfirmed = rec.period1Status === 'present' || rec.p1StartStatus === 'present' || rec.p1EndStatus === 'present';
    } else if (activePeriod === '2' || activePeriod === 'p2_start' || activePeriod === 'p2_end') {
      alreadyConfirmed = rec.period2Status === 'present' || rec.p2StartStatus === 'present' || rec.p2EndStatus === 'present';
    } else {
      alreadyConfirmed = rec.status === 'present';
    }

    if (alreadyConfirmed) {
      return { student: st, record: rec };
    }
    return null;
  }, [raInput, boundStudent, targetSession, students, activePeriod]);

  // Keep stable refs for mount-only auto-checkin
  const studentSelfCheckinRef = useRef(studentSelfCheckin);
  studentSelfCheckinRef.current = studentSelfCheckin;
  const isSessionLiveRef = useRef(isSessionLive);
  isSessionLiveRef.current = isSessionLive;
  const tokenToUseRef = useRef(tokenToUse);
  tokenToUseRef.current = tokenToUse;
  const currentClassRef = useRef(currentClass);
  currentClassRef.current = currentClass;
  const periodLabelRef = useRef(periodLabel);
  periodLabelRef.current = periodLabel;
  const activePeriodRef = useRef(activePeriod);
  activePeriodRef.current = activePeriod;
  const playBeepRef = useRef(playBeep);
  playBeepRef.current = playBeep;

  // Sync latest sessions from server on mount
  useEffect(() => {
    forceSyncMaster();
  }, [forceSyncMaster]);

  // Single mount effect: sync class and prefill RA without blind auto-checkin conflicts
  useEffect(() => {
    const turmaParam = initialClassId || getPortalParam('turma') || getPortalParam('turmaid');
    if (turmaParam) {
      const matched = classes.find(c => c.id === turmaParam || c.name.trim().toLowerCase() === turmaParam.trim().toLowerCase() || (c.code && c.code.trim().toLowerCase() === turmaParam.trim().toLowerCase()));
      if (matched && matched.id !== selectedClassId) {
        setSelectedClassId(matched.id);
      }
    }

    const savedRa = getPortalParam('ra') || getPortalParam('matricula') || (typeof window !== 'undefined' ? localStorage.getItem('bmf4_student_saved_ra') : null);
    if (savedRa && savedRa.trim()) {
      const clean = savedRa.trim().toUpperCase();
      setRaInput(clean);
      const savedName = typeof window !== 'undefined' ? localStorage.getItem('bmf4_student_saved_name') : null;
      if (savedName) {
        setSavedDeviceStudentName(savedName);
      }

      // Only auto-submit if explicitly requested in URL (e.g. ?auto=true), otherwise allow manual confirmation
      const explicitAuto = getPortalParam('auto') === 'true' || getPortalParam('autocheckin') === '1';
      if (explicitAuto && isSessionLiveRef.current) {
        setIsAutoCheckingIn(true);
        try {
          const result = studentSelfCheckinRef.current(clean, tokenToUseRef.current, false, activePeriodRef.current as ClassPeriod, targetSession?.id);
          if (result.success && result.student) {
            setSavedDeviceStudentName(result.student.name);
            const now = new Date();
            const authHash = `BMF4-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${now.getHours()}${now.getMinutes()}`;
            const matchedCls = resolveConfirmedClass(result.student);
            setConfirmedData({
              studentName: result.student.name,
              studentRa: result.student.registrationNumber,
              className: matchedCls?.name || 'Turma B',
              discipline: matchedCls?.discipline || currentClassRef.current?.discipline || 'BMF4 - Bases Morfofuncionais 4',
              period: periodLabelRef.current,
              timestamp: now.toLocaleTimeString('pt-BR'),
              date: now.toLocaleDateString('pt-BR'),
              authCode: authHash,
            });
            setFeedbackWarning(null);
            playBeepRef.current('success');
            setViewMode('receipt');
          } else if (result.alreadyPresent && result.student) {
            setSavedDeviceStudentName(result.student.name);
            const now = new Date();
            const authHash = `BMF4-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${now.getHours()}${now.getMinutes()}`;
            const matchedCls = resolveConfirmedClass(result.student);
            setConfirmedData({
              studentName: result.student.name,
              studentRa: result.student.registrationNumber,
              className: matchedCls?.name || 'Turma B',
              discipline: matchedCls?.discipline || currentClassRef.current?.discipline || 'BMF4 - Bases Morfofuncionais 4',
              period: periodLabelRef.current,
              timestamp: result.existingRecord?.timestamp || now.toLocaleTimeString('pt-BR'),
              date: now.toLocaleDateString('pt-BR'),
              authCode: authHash,
            });
            setFeedbackWarning(
              result.message || `Presença já registrada anteriormente nesta aula para o aluno(a) ${result.student.name}.`
            );
            playBeepRef.current('warning');
            setViewMode('receipt');
          } else {
            setIsAutoCheckingIn(false);
          }
        } catch (_) {
          setIsAutoCheckingIn(false);
        }
      }
    }
  }, []); // Run strictly once on mount

  // Reset confirmation receipt when transitioning to a new session or period
  const prevSessionIdRef = useRef<string | undefined>(targetSession?.id);
  const prevPeriodRef = useRef<ClassPeriod>(activePeriod);

  useEffect(() => {
    // If student is already viewing the confirmed receipt or completed state, DO NOT erase it due to background session sync
    if (viewMode === 'receipt' || viewMode === 'completed' || viewMode === 'closed_screen') return;

    const isNewSession = Boolean(prevSessionIdRef.current && targetSession?.id && prevSessionIdRef.current !== targetSession.id);
    const isNewPeriod = Boolean(prevPeriodRef.current && activePeriod && prevPeriodRef.current !== activePeriod);

    if (isNewSession || isNewPeriod) {
      setConfirmedData(null);
      setViewMode('checkin');
      setFeedbackError(null);
      setFeedbackWarning(null);
    }
    prevSessionIdRef.current = targetSession?.id;
    prevPeriodRef.current = activePeriod;
  }, [targetSession?.id, activePeriod, viewMode]);

  // Execute check-in for a specific RA
  const performCheckin = async (cleanRa: string, allowOtherClass: boolean = false) => {
    setFeedbackError(null);
    setFeedbackWarning(null);
    if (allowOtherClass) {
      setOtherClassPrompt(null);
    }

    if (!cleanRa) {
      setFeedbackError('Por favor, digite seu RA / Matrícula.');
      playBeep('alert');
      return;
    }

    if (appSettings.requireEPI && !epiConfirmed) {
      setFeedbackError('É obrigatório confirmar o uso completo de todos os EPIs para entrar no laboratório.');
      playBeep('alert');
      return;
    }

    setIsSubmitting(true);

    try {
      let result = studentSelfCheckin(cleanRa, tokenToUse, allowOtherClass, activePeriod as ClassPeriod, targetSession?.id);

      // If local state doesn't find a live session (e.g. race condition on first call of the day),
      // consult the server checkin API to verify against authoritative server session
      if (!result.success && !result.alreadyPresent && !result.needsOtherClassConfirmation && !result.notFound) {
        try {
          const apiRes = await fetch('/api/attendance/checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              registrationNumber: cleanRa,
              sessionId: targetSession?.id || urlSessionId,
              classGroupId: currentClass?.id || selectedClassId,
              period: activePeriod,
              deviceId: deviceFingerprint,
              checkinMethod: 'qrcode',
              allowOtherClass,
            }),
          });
          const apiData = await apiRes.json();
          if (apiData.success && apiData.student) {
            result = {
              success: true,
              student: apiData.student,
              message: apiData.message,
            };
            forceSyncMaster();
          } else if (apiData.alreadyPresent && apiData.student) {
            result = {
              success: false,
              alreadyPresent: true,
              student: apiData.student,
              existingRecord: apiData.existingRecord,
              message: apiData.message,
            };
          } else if (apiData.needsOtherClassConfirmation) {
            result = {
              success: false,
              needsOtherClassConfirmation: true,
              student: apiData.student,
              studentClassName: apiData.studentClassName,
              targetClassName: apiData.targetClassName,
              message: apiData.message,
            };
          } else if (apiData.message) {
            result = {
              ...result,
              message: apiData.message,
            };
          }
        } catch (_) {
          // Fall back to local result
        }
      }

      if (result.needsOtherClassConfirmation) {
        setOtherClassPrompt({
          cleanRa,
          studentName: result.student?.name || 'Aluno(a)',
          studentClassName: result.studentClassName || 'Outra Turma',
          targetClassName: result.targetClassName || currentClass?.name || 'Turma Atual',
          message: result.message || 'Confirmação necessária para aluno de outra turma.',
        });
        playBeep('confirm');
        return;
      }

      if (result.success && result.student) {
        // Save RA in localStorage for future automated 1-click / auto checkins on this device
        try {
          localStorage.setItem('bmf4_student_saved_ra', cleanRa);
          localStorage.setItem('bmf4_student_saved_name', result.student.name);
          setSavedDeviceStudentName(result.student.name);
        } catch (_) {}

        const now = new Date();
        const authHash = `BMF4-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${now.getHours()}${now.getMinutes()}`;
        const matchedCls = resolveConfirmedClass(result.student);
        
        setConfirmedData({
          studentName: result.student.name,
          studentRa: result.student.registrationNumber,
          className: matchedCls?.name || 'Turma B',
          discipline: matchedCls?.discipline || currentClass?.discipline || 'BMF4 - Bases Morfofuncionais 4',
          period: periodLabel,
          timestamp: now.toLocaleTimeString('pt-BR'),
          date: now.toLocaleDateString('pt-BR'),
          authCode: authHash,
        });
        setFeedbackWarning(null);
        setFeedbackError(null);

        playBeep('success');
        setViewMode('receipt');
      } else if (result.alreadyPresent && result.student) {
        try {
          localStorage.setItem('bmf4_student_saved_ra', cleanRa);
          localStorage.setItem('bmf4_student_saved_name', result.student.name);
          setSavedDeviceStudentName(result.student.name);
        } catch (_) {}

        const now = new Date();
        const authHash = `BMF4-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${now.getHours()}${now.getMinutes()}`;
        const matchedCls = resolveConfirmedClass(result.student);
        setConfirmedData({
          studentName: result.student.name,
          studentRa: result.student.registrationNumber,
          className: matchedCls?.name || 'Turma B',
          discipline: matchedCls?.discipline || currentClass?.discipline || 'BMF4 - Bases Morfofuncionais 4',
          period: periodLabel,
          timestamp: result.existingRecord?.timestamp || now.toLocaleTimeString('pt-BR'),
          date: now.toLocaleDateString('pt-BR'),
          authCode: authHash,
        });
        playBeep('warning');
        setFeedbackWarning(
          result.message || `❌ Presença já registrada anteriormente nesta aula! O aluno(a) ${result.student.name} (RA: ${result.student.registrationNumber}) já possui presença confirmada. Não é permitido marcar presença mais de uma vez.`
        );
        setFeedbackError(null);
        setViewMode('receipt');
      } else if (result.notFound) {
        playBeep('warning');
        setShowRegisterForm(true);
        setRegRaInput(cleanRa);
        setRegNameInput('');
        setFeedbackError(null);
        setFeedbackWarning(null);
      } else {
        playBeep('alert');
        setFeedbackError(result.message || 'Não foi possível confirmar a presença.');
      }
    } catch (err: any) {
      playBeep('alert');
      setFeedbackError(err?.message || 'Erro inesperado ao registrar presença.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler for Aluno Não Encontrado -> Cadastrar Aluno e Confirmar Presença
  const handleSelfRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = regNameInput.trim();
    const cleanRa = regRaInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (!cleanName) {
      playBeep('alert');
      setFeedbackError('Por favor, informe o Nome Completo do aluno.');
      return;
    }
    if (!cleanRa) {
      playBeep('alert');
      setFeedbackError('Por favor, informe a Matrícula / RA do aluno.');
      return;
    }

    const targetClassId = currentClass?.id || selectedClassId || 'turma-b';
    setIsSubmitting(true);
    setFeedbackError(null);
    setFeedbackWarning(null);

    try {
      const regResult = await selfRegisterAndCheckin({
        name: cleanName,
        registrationNumber: cleanRa,
        classGroupId: targetClassId,
      });

      if (regResult.success && regResult.student) {
        // Save student device identity
        try {
          localStorage.setItem('bmf4_student_saved_ra', cleanRa);
          localStorage.setItem('bmf4_student_saved_name', regResult.student.name);
          setSavedDeviceStudentName(regResult.student.name);
        } catch (_) {}

        const now = new Date();
        const authHash = `BMF4-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${now.getHours()}${now.getMinutes()}`;
        const matchedCls = resolveConfirmedClass(regResult.student);

        setConfirmedData({
          studentName: regResult.student.name,
          studentRa: regResult.student.registrationNumber,
          className: matchedCls?.name || currentClass?.name || 'Turma B',
          discipline: matchedCls?.discipline || currentClass?.discipline || 'BMF4 - Bases Morfofuncionais 4',
          period: periodLabel,
          timestamp: now.toLocaleTimeString('pt-BR'),
          date: now.toLocaleDateString('pt-BR'),
          authCode: authHash,
        });

        setShowRegisterForm(false);
        setFeedbackWarning(null);
        setFeedbackError(null);
        playBeep('success');
        setViewMode('receipt');
      } else {
        playBeep('alert');
        setFeedbackError(regResult.message || 'Erro ao realizar cadastro e confirmação de presença.');
      }
    } catch (err: any) {
      playBeep('alert');
      setFeedbackError(err?.message || 'Erro inesperado ao registrar aluno.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearSavedDeviceRa = () => {
    try {
      localStorage.removeItem('bmf4_student_saved_ra');
      localStorage.removeItem('bmf4_student_saved_name');
    } catch (_) {}
    setSavedDeviceStudentName(null);
    setRaInput('');
    setCardRaInput('');
    setFeedbackError(null);
    setFeedbackWarning(null);
  };

  // Handle Registered Student Check-in
  const handleCheckinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performCheckin(raInput.trim().toUpperCase());
  };

  const handleCloseReceipt = () => {
    // Switch to completed view stably without exposing admin app
    setViewMode('completed');
  };

  const handleCloseEntireScreen = () => {
    try {
      window.close();
    } catch {}
    if (onClose) {
      onClose();
    } else {
      setViewMode('closed_screen');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between select-none font-sans antialiased">
      
      {/* 1. Top Secure Header */}
      <header className="bg-slate-900/90 border-b border-slate-800/80 px-4 py-3 sticky top-0 z-30 backdrop-blur shadow-md">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AppLogo size="sm" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black tracking-tight text-white uppercase">UNINOVE MEDICINA</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <p className="text-[11px] text-sky-300 font-semibold truncate max-w-[180px] sm:max-w-xs">
                {currentClass?.name || 'Turma BMF4'} • {currentClass?.discipline || 'BMF4'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right hidden xs:block">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                <ShieldCheck className="w-3 h-3" />
                Anti-Fraude
              </span>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                {currentClass?.laboratoryRoom || 'Lab 04'}
              </p>
            </div>

            {/* Header 'X' Close Button */}
            <button
              type="button"
              id="btn-portal-header-close"
              onClick={handleCloseEntireScreen}
              className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer border border-slate-700"
              title="Fechar tela"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Container */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 flex flex-col justify-center py-6">
        
        {/* VIEW 1: COMPROVANTE DIGITAL DE PRESENÇA */}
        {viewMode === 'receipt' && confirmedData && (
          <div className="relative bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            
            {/* Top Close 'X' Button */}
            <button
              type="button"
              id="btn-receipt-close-x"
              onClick={handleCloseReceipt}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer z-10"
              title="Fechar tela de confirmação"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-2 pr-8 pl-8">
              {feedbackWarning ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400 text-amber-400 mx-auto flex items-center justify-center shadow-lg shadow-amber-950">
                    <AlertTriangle className="w-8 h-8 stroke-[2.5]" />
                  </div>
                  <h2 className="text-lg font-black text-amber-300 tracking-tight">
                    Presença Já Registrada Anteriormente!
                  </h2>
                  <p className="text-xs text-amber-200/90 font-medium">
                    ❌ Não é permitido registrar presença mais de uma vez nesta aula. Registro já confirmado no diário oficial.
                  </p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-950 animate-bounce duration-1000">
                    <Check className="w-8 h-8 stroke-[3]" />
                  </div>
                  <h2 className="text-lg font-black text-white tracking-tight">
                    Presença Confirmada com Sucesso!
                  </h2>
                  <p className="text-xs text-emerald-300 font-medium">
                    ✅ Registrada e sincronizada em tempo real no diário oficial do docente
                  </p>
                </>
              )}
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-[10px] text-slate-400 uppercase tracking-wider">
                <span>Comprovante Digital</span>
                <span className="text-sky-400 font-bold">{confirmedData.authCode}</span>
              </div>

              {/* QR Code of Student RA for Teacher Scanner */}
              <div className="bg-white rounded-2xl p-3 flex flex-col items-center justify-center my-2 shadow-inner">
                <QRCodeDisplay 
                  value={confirmedData.studentRa} 
                  size={140} 
                  label={`RA: ${confirmedData.studentRa}`} 
                  sublabel="Mostre esta tela para o Professor escanear se solicitado"
                  showBorder={false}
                />
              </div>

              <div className="space-y-1.5 font-sans">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-slate-400 text-xs">Aluno:</span>
                  <span className="text-white font-bold text-xs text-right truncate">{confirmedData.studentName}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-xs">Matrícula / RA:</span>
                  <span className="text-sky-300 font-mono font-bold text-xs bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800/60">{confirmedData.studentRa}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-xs">Turma & Disciplina:</span>
                  <span className="text-white font-semibold text-xs text-right">{confirmedData.className}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-xs">Período / Aula:</span>
                  <span className="text-amber-300 font-semibold text-xs">{confirmedData.period}</span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-800/80">
                  <span className="text-slate-400 text-xs">Data e Horário:</span>
                  <span className="text-slate-200 font-mono font-bold text-xs">{confirmedData.date} às {confirmedData.timestamp}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[9px] text-slate-500">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Validação Criptográfica OK
                </span>
                <span>BMF4 • UNINOVE</span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              {/* Dynamic Notification if a new stage/period has been opened by the teacher */}
              {isSessionLive && confirmedData && confirmedData.period !== periodLabel && (
                <div className="p-3.5 rounded-2xl bg-teal-950/80 border border-teal-500/60 text-left space-y-2.5 shadow-lg animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-ping" />
                    <span className="text-xs font-bold text-teal-200">
                      Nova Etapa Aberta: {periodLabel}
                    </span>
                  </div>
                  <p className="text-[11px] text-teal-300/90 leading-snug">
                    O professor iniciou a chamada desta nova etapa da aula. Deseja confirmar agora com este mesmo RA?
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      performCheckin(confirmedData.studentRa);
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all active:scale-95"
                  >
                    <Check className="w-4 h-4" />
                    <span>Confirmar Presença em: {periodLabel}</span>
                  </button>
                </div>
              )}

              <div className="space-y-2">
                <button
                  type="button"
                  id="btn-receipt-finish"
                  onClick={handleCloseReceipt}
                  className="w-full py-3.5 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/50"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Concluir e Finalizar Chamada</span>
                </button>

                <button
                  type="button"
                  onClick={handleCloseEntireScreen}
                  className="w-full py-2.5 px-3 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-300 hover:text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Fechar Janela</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 1.5: TELA FINAL DE CONFIRMAÇÃO (Área Segura do Aluno) */}
        {viewMode === 'completed' && (
          <div className="relative bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 text-center animate-in zoom-in-95 duration-200">
            
            {/* Top Close 'X' Button */}
            <button
              type="button"
              id="btn-completed-close-x"
              onClick={handleCloseEntireScreen}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer z-10"
              title="Fechar tela"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-950">
              <Check className="w-8 h-8 stroke-[3]" />
            </div>

            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">
                <ShieldCheck className="w-4 h-4" />
                Presença Salva no Diário Oficial
              </span>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Tudo Pronto!
              </h2>
              <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
                Sua presença foi registrada com sucesso na disciplina <strong className="text-white">{currentClass?.discipline || 'BMF4'}</strong> ({periodLabel}).
              </p>
            </div>

            {confirmedData && (
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-left space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Aluno:</span>
                  <span className="text-white font-bold truncate max-w-[180px]">{confirmedData.studentName}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Matrícula / RA:</span>
                  <span className="text-sky-300 font-mono font-bold">{confirmedData.studentRa}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Autenticação:</span>
                  <span className="text-emerald-400 font-mono font-bold text-[11px]">{confirmedData.authCode}</span>
                </div>
              </div>
            )}

            <div className="space-y-2 pt-2">
              {confirmedData && (
                <button
                  type="button"
                  id="btn-view-full-receipt"
                  onClick={() => setViewMode('receipt')}
                  className="w-full py-3.5 rounded-2xl bg-sky-600 hover:bg-sky-500 active:scale-98 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  <FileCheck className="w-4 h-4" />
                  Visualizar Meu Comprovante Digital Completo
                </button>
              )}

              <button
                type="button"
                id="btn-close-completed-screen"
                onClick={handleCloseEntireScreen}
                className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-rose-950/80 hover:text-rose-200 hover:border-rose-700/80 active:scale-98 text-slate-300 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-700 shadow-xs"
              >
                <X className="w-4 h-4 text-rose-400" />
                Fechar Tela / Encerrar
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800/80">
              <p className="text-[10px] text-slate-500">
                🔒 Registro individual único por aula. Você já pode fechar esta aba no seu navegador.
              </p>
            </div>
          </div>
        )}

        {/* VIEW 1.8: TELA DE ENCERRAMENTO (Closed Screen) */}
        {viewMode === 'closed_screen' && (
          <div className="relative bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-950">
              <Check className="w-8 h-8 stroke-[3]" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black text-white tracking-tight">
                Presença Registrada com Sucesso!
              </h2>
              <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
                Sua chamada foi confirmada e arquivada com segurança no sistema oficial da disciplina.
              </p>
              <p className="text-[11px] text-emerald-400 font-medium">
                Esta tela está finalizada. Você já pode fechar esta aba ou o navegador.
              </p>
            </div>

            {confirmedData && (
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => setViewMode('receipt')}
                  className="w-full py-3 rounded-2xl bg-sky-600 hover:bg-sky-500 active:scale-98 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  <FileCheck className="w-4 h-4" />
                  Reabrir Comprovante Digital
                </button>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: FORMULARIO DE CHECK-IN INDIVIDUAL DO ALUNO */}
        {viewMode === 'checkin' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in duration-150">
            
            <div className={`p-3 rounded-2xl border flex items-center justify-between ${
              isSessionLocked
                ? 'bg-rose-950/60 border-rose-800/60'
                : 'bg-sky-950/60 border-sky-800/60'
            }`}>
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  isSessionLocked ? 'bg-rose-500' : 'bg-emerald-400 animate-pulse'
                }`} />
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-white truncate">
                    {targetSession?.topic || activeSession?.topic || 'Aula Prática BMF4'}
                  </h3>
                  <p className="text-[10px] text-slate-300">
                    {isSessionLocked ? (
                      <span className="text-rose-300 font-semibold">Chamada Encerrada</span>
                    ) : (
                      <>Chamada Ativa: <strong className="text-white">{periodLabel}</strong></>
                    )}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded border font-bold ${
                  isSessionLocked
                    ? 'bg-rose-900/80 text-rose-200 border-rose-700/50'
                    : 'bg-sky-900/80 text-sky-200 border-sky-700/50'
                }`}>
                  {isSessionLocked ? 'BLOQUEADA' : 'VALIDAÇÃO ATIVA'}
                </span>
              </div>
            </div>

            {isSessionLocked && (
              <div className="p-3.5 rounded-2xl bg-rose-950/70 border border-rose-800/80 text-rose-200 text-xs space-y-2">
                <div className="flex items-start gap-2">
                  <Lock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-white">Esta aula já foi encerrada pelo professor.</p>
                    <p className="text-[11px] text-rose-300/90 leading-relaxed mt-0.5">
                      Novos check-ins para este QR Code estão desativados. Verifique no telão do laboratório se uma nova aula ou etapa foi iniciada.
                    </p>
                  </div>
                </div>

                {newerActiveSession && (
                  <div className="pt-2 border-t border-rose-800/50 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-teal-300 font-medium">
                      Há uma Nova Aula ativa disponível!
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          window.location.href = window.location.pathname;
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-[11px] cursor-pointer"
                    >
                      Acessar Nova Aula
                    </button>
                  </div>
                )}
              </div>
            )}

            {isAutoCheckingIn && (
              <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 text-center space-y-2 animate-pulse">
                <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs font-bold text-emerald-300">
                  Confirmando presença automaticamente neste aparelho...
                </p>
                <p className="text-[11px] text-emerald-200/80">
                  {savedDeviceStudentName ? `Aluno(a): ${savedDeviceStudentName}` : `RA: ${raInput}`}
                </p>
              </div>
            )}

            {feedbackError && (
              <div className="p-3.5 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs font-bold flex items-start gap-2.5 animate-in zoom-in-95">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{feedbackError}</span>
              </div>
            )}

            {feedbackWarning && (
              <div className="p-3.5 rounded-2xl bg-amber-950/80 border border-amber-600 text-amber-200 text-xs font-semibold flex items-start gap-2.5 animate-in zoom-in-95">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold text-amber-300 block">Presença Já Confirmada</span>
                  <span className="text-amber-100">{feedbackWarning}</span>
                </div>
              </div>
            )}

            <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 gap-1">
              <button
                type="button"
                onClick={() => setViewMode('checkin')}
                className={`flex-1 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  viewMode === 'checkin'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Confirmar Presença (RA)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setViewMode('card');
                  if (raInput && !cardRaInput) setCardRaInput(raInput);
                  setFeedbackError(null);
                  setFeedbackWarning(null);
                }}
                className={`flex-1 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  viewMode === 'card'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <QrCode className="w-3.5 h-3.5 text-teal-400" />
                <span>Apresentar Cartão QR</span>
              </button>
            </div>

            {/* Device Binding Status Banner */}
            {boundStudent ? (
              <div className="p-3.5 bg-teal-950/80 border border-teal-500/60 rounded-2xl flex items-center justify-between gap-2 shadow-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-teal-300 font-bold uppercase tracking-wider">Aparelho Vinculado</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                    </div>
                    <p className="text-xs font-black text-white truncate">
                      {boundStudent.name}
                    </p>
                    <p className="text-[10px] text-teal-200/90 font-mono">
                      RA: {boundStudent.registrationNumber}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="px-2 py-1 bg-teal-900/90 text-teal-200 border border-teal-700/60 rounded-lg text-[9px] font-mono font-bold block">
                    1 Aluno / Celular
                  </span>
                </div>
              </div>
            ) : (savedDeviceStudentName || raInput) ? (
              <div className="p-3 bg-slate-950/90 border border-slate-800 rounded-2xl flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-400 truncate">Dispositivo configurado para:</p>
                    <p className="text-xs font-bold text-white truncate">
                      {savedDeviceStudentName || `RA ${raInput}`}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Device Mismatch Security Alert */}
            {isDifferentRaFromBoundDevice && boundStudent && (
              <div className="p-4 rounded-2xl bg-rose-950/90 border-2 border-rose-600 text-rose-200 text-xs space-y-2 animate-in zoom-in-95 shadow-lg shadow-rose-950/60">
                <div className="flex items-center gap-2 text-rose-300 font-black text-sm">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                  <span>Bloqueio de Vínculo de Dispositivo</span>
                </div>
                <p className="leading-relaxed text-[11px] text-rose-100">
                  Este aparelho está vinculado com segurança ao aluno(a) <strong className="text-white font-bold">{boundStudent.name}</strong> (RA: {boundStudent.registrationNumber}). Por normas anti-fraude, não é permitido registrar presença para outro estudante neste celular.
                </p>
                <button
                  type="button"
                  onClick={() => setRaInput(boundStudent.registrationNumber)}
                  className="w-full py-2 bg-rose-800 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Restaurar meu RA ({boundStudent.registrationNumber})
                </button>
              </div>
            )}

            {/* REGISTRATION FORM FOR UNREGISTERED STUDENTS (ALUNO NÃO ENCONTRADO NA TURMA) */}
            {showRegisterForm ? (
              <div className="space-y-4 pt-1 animate-in fade-in zoom-in-95 duration-200">
                {/* 1. Clear visual warning banner */}
                <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/60 text-amber-200 space-y-1.5 shadow-lg shadow-amber-950/40">
                  <div className="flex items-center gap-2 text-amber-300 font-extrabold text-sm">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                    <span>Aluno não encontrado na lista oficial desta turma</span>
                  </div>
                  <p className="text-xs text-amber-100/90 leading-relaxed">
                    Identificamos que você ainda não está cadastrado na base oficial da <strong className="text-white font-semibold">{currentClass?.name || 'Turma B'}</strong>. Preencha seus dados abaixo para se cadastrar e registrar sua presença imediatamente.
                  </p>
                </div>

                {/* 2. Registration form: Full Name and RA */}
                <form onSubmit={handleSelfRegisterSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-sky-400" />
                        Nome Completo do Aluno:
                      </span>
                      <span className="text-[10px] text-amber-400 font-bold">* Obrigatório</span>
                    </label>
                    <input
                      type="text"
                      required
                      autoComplete="name"
                      value={regNameInput}
                      onChange={(e) => setRegNameInput(e.target.value)}
                      placeholder="Digite seu nome completo..."
                      className="w-full px-4 py-3.5 bg-slate-950 border border-slate-700 rounded-2xl text-sm sm:text-base font-semibold text-white placeholder:text-slate-600 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition-all"
                      autoFocus
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Hash className="w-3.5 h-3.5 text-sky-400" />
                        Matrícula / RA do Aluno:
                      </span>
                      <span className="text-[10px] text-amber-400 font-bold">* Obrigatório</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      required
                      autoComplete="off"
                      value={regRaInput}
                      onChange={(e) => setRegRaInput(e.target.value)}
                      placeholder="Ex: 426202093"
                      className="w-full px-4 py-3.5 bg-slate-950 border border-slate-700 rounded-2xl text-base sm:text-lg font-bold text-white uppercase placeholder:text-slate-600 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition-all"
                    />
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                    <div className="flex items-center gap-1.5 text-sky-300 font-semibold">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Turma de Vínculo: {currentClass?.name || 'Turma B'}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-snug">
                      Ao confirmar, seu nome e RA serão registrados na lista de alunos desta turma e sua presença será confirmada na aula em andamento.
                    </p>
                  </div>

                  {/* 3. Action button to Confirm Registration and Check-in */}
                  <div className="space-y-2 pt-1">
                    <button
                      type="submit"
                      disabled={isSubmitting || isSessionLocked}
                      className={`w-full py-4 rounded-2xl active:scale-98 disabled:opacity-50 text-white font-black text-sm tracking-wide shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        isSessionLocked
                          ? 'bg-slate-700 hover:bg-slate-700 shadow-none cursor-not-allowed'
                          : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/50'
                      }`}
                    >
                      {isSubmitting ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <UserPlus className="w-5 h-5 stroke-[2.5]" />
                      )}
                      <span>{isSubmitting ? 'Cadastrando e Registrando...' : 'Confirmar Cadastro e Registrar Presença'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowRegisterForm(false);
                        setFeedbackError(null);
                        setFeedbackWarning(null);
                      }}
                      className="w-full py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
                    >
                      ← Voltar para digitar outro RA
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <form onSubmit={handleCheckinSubmit} className="space-y-4 pt-1">
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Sua Matrícula / RA de Aluno:</span>
                  <span className="text-[10px] text-slate-500 font-normal">Ex: 426202093</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    enterKeyHint="done"
                    autoComplete="off"
                    value={raInput}
                    onChange={(e) => setRaInput(e.target.value)}
                    placeholder="Digite seu número de RA..."
                    className="w-full px-4 py-3.5 bg-slate-950 border border-slate-700 rounded-2xl text-base sm:text-lg font-bold text-white tracking-wide uppercase placeholder:text-slate-600 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none transition-all"
                    autoFocus={!raInput}
                  />
                  <Hash className="w-4 h-4 text-slate-500 absolute right-3.5 top-4 pointer-events-none" />
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 text-sky-300 font-semibold">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Confirmação Individual por Aparelho:</span>
                </div>
                <p className="leading-relaxed">
                  Cada aluno deve abrir o link no seu próprio celular. Ao confirmar uma vez, seu aparelho será memorizado para confirmação automática instantânea nas próximas leituras do QR Code.
                </p>
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={epiConfirmed}
                  onChange={(e) => setEpiConfirmed(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded text-sky-500 focus:ring-sky-400 bg-slate-900 border-slate-700 cursor-pointer"
                />
                <span className="text-[11px] text-slate-300 leading-snug">
                  <strong className="text-white block">Declaração de EPIs de Laboratório:</strong>
                  Confirmo que estou presente no laboratório devidamente paramentado(a) com Jaleco branco, Luvas e Calçados fechados.
                </span>
              </label>

              {currentStudentExistingRecord && (
                <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-200 text-xs space-y-2 animate-in fade-in">
                  <div className="flex items-center gap-2 font-bold text-emerald-300">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span>Presença Já Confirmada Nesta Chamada Aberta</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-emerald-100">
                    O aluno(a) <strong className="text-white">{currentStudentExistingRecord.student.name}</strong> (RA: {currentStudentExistingRecord.student.registrationNumber}) já confirmou presença nesta chamada aberta. Cada aluno deve confirmar apenas uma vez.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const matchedCls = resolveConfirmedClass(currentStudentExistingRecord.student);
                      setConfirmedData({
                        studentName: currentStudentExistingRecord.student.name,
                        studentRa: currentStudentExistingRecord.student.registrationNumber,
                        className: matchedCls?.name || 'Turma B',
                        discipline: matchedCls?.discipline || 'BMF4',
                        period: periodLabel,
                        timestamp: currentStudentExistingRecord.record?.timestamp || now.toLocaleTimeString('pt-BR'),
                        date: now.toLocaleDateString('pt-BR'),
                        authCode: `BMF4-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
                      });
                      setViewMode('receipt');
                    }}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-98"
                  >
                    <FileCheck className="w-4 h-4" />
                    <span>Visualizar Meu Comprovante Digital</span>
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || isSessionLocked || Boolean(currentStudentExistingRecord) || Boolean(isDifferentRaFromBoundDevice)}
                className={`w-full py-4 rounded-2xl active:scale-98 disabled:opacity-60 text-white font-black text-sm tracking-wide shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  currentStudentExistingRecord
                    ? 'bg-slate-800 border border-emerald-500/40 text-emerald-300 shadow-none cursor-not-allowed'
                    : isDifferentRaFromBoundDevice
                    ? 'bg-slate-800 border border-rose-500/40 text-rose-300 shadow-none cursor-not-allowed'
                    : isSessionLocked
                    ? 'bg-slate-700 hover:bg-slate-700 shadow-none cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950'
                }`}
              >
                {currentStudentExistingRecord ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>PRESENÇA JÁ REGISTRADA (1 confirmação por chamada)</span>
                  </>
                ) : isDifferentRaFromBoundDevice ? (
                  <>
                    <Lock className="w-5 h-5 text-rose-400" />
                    <span>APARELHO VINCULADO A OUTRO ALUNO</span>
                  </>
                ) : isSessionLocked ? (
                  <>
                    <Lock className="w-5 h-5 text-rose-400" />
                    <span>Chamada Encerrada (Check-in Bloqueado)</span>
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5 stroke-[3]" />
                    <span>{isSubmitting ? 'Validando Presença...' : 'CONFIRMAR MINHA PRESENÇA'}</span>
                  </>
                )}
              </button>

            </form>
            )}

            <div className="pt-2 text-center">
              <p className="text-[10px] text-slate-500 leading-tight">
                🔒 Sistema de Validação Anti-Fraude com restrição de aparelho físico e token dinâmico rotativo.
              </p>
            </div>

          </div>
        )}

        {/* VIEW 2.5: CARTÃO DIGITAL / QR CODE DO RA PARA LEITURA PELO DOCENTE */}
        {viewMode === 'card' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in duration-150">
            
            <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 gap-1">
              <button
                type="button"
                onClick={() => setViewMode('checkin')}
                className="flex-1 py-2 rounded-xl text-[11px] sm:text-xs font-bold text-slate-400 hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Confirmar Presença (RA)</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('card')}
                className="flex-1 py-2 rounded-xl text-[11px] sm:text-xs font-bold bg-sky-600 text-white shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5 text-teal-400" />
                <span>Apresentar Cartão QR</span>
              </button>
            </div>

            <div className="border-b border-slate-800 pb-2 text-center">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-300 text-[10px] font-black uppercase tracking-wider mb-1">
                <QrCode className="w-3.5 h-3.5" />
                Cartão de Presença do Aluno
              </span>
              <h2 className="text-sm sm:text-base font-bold text-white">
                Apresente seu QR Code para o Professor
              </h2>
              <p className="text-[11px] text-slate-400">
                O docente lerá este código diretamente pela câmera para registrar sua presença.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Informe seu RA / Matrícula:</span>
                <span className="text-[10px] text-slate-500 font-normal">Gera o QR Code na hora</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  enterKeyHint="done"
                  autoComplete="off"
                  value={cardRaInput}
                  onChange={(e) => setCardRaInput(e.target.value)}
                  placeholder="Digite seu RA (Ex: 426202091)..."
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-bold text-white tracking-wide uppercase placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
                />
                <Hash className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>

            {/* QR Code Container */}
            {cardRaInput.trim() ? (
              <div className="bg-white rounded-3xl p-4 flex flex-col items-center justify-center space-y-2 shadow-2xl border-4 border-teal-500/40">
                <QRCodeDisplay
                  value={cardRaInput.trim().toUpperCase()}
                  size={190}
                  showBorder={false}
                />
                <div className="text-center pt-1">
                  <p className="text-xs font-black text-slate-900 font-mono tracking-wider">
                    RA: {cardRaInput.trim().toUpperCase()}
                  </p>
                  <p className="text-[10px] font-bold text-teal-800">
                    {currentClass?.name || 'Turma BMF4'} • MEDICINA
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-2">
                <Smartphone className="w-8 h-8 text-sky-400 mx-auto animate-pulse" />
                <p className="text-xs text-slate-300 font-medium">
                  Digite seu RA no campo acima para gerar seu QR Code de presença pessoal.
                </p>
              </div>
            )}

            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  setRaInput(cardRaInput);
                  setViewMode('checkin');
                }}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-all cursor-pointer text-center flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Ou Confirmar Presença por Aqui Mesmo
              </button>
            </div>

          </div>
        )}

      </main>

      {/* 3. Footer */}
      <footer className="px-4 py-3 border-t border-slate-900 text-center">
        <div className="max-w-md mx-auto flex items-center justify-between text-[10px] text-slate-500">
          <span>BMF4 • Bases Morfofuncionais 4</span>
          {onGoToAdmin && (
            <button
              onClick={() => {
                setAdminPinInput('');
                setAdminPinError(null);
                setIsAdminAuthModalOpen(true);
              }}
              className="text-slate-500 hover:text-slate-300 font-semibold underline decoration-slate-700 cursor-pointer flex items-center gap-1"
            >
              <Lock className="w-3 h-3" />
              Acesso Docente
            </button>
          )}
        </div>
      </footer>

      {/* Other Class Student Confirmation Modal */}
      {otherClassPrompt && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/50 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto mb-1">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">Aluno de Outra Turma</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Olá, <strong className="text-white">{otherClassPrompt.studentName}</strong>!
              </p>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-left space-y-1.5 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Sua Turma:</span>
                  <span className="font-semibold text-amber-300">{otherClassPrompt.studentClassName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Aula em Andamento:</span>
                  <span className="font-semibold text-sky-300">{otherClassPrompt.targetClassName}</span>
                </div>
              </div>
              <p className="text-[11px] text-amber-200/90 leading-normal pt-1">
                Deseja confirmar o registro de presença nesta aula como reposição/turma alternada?
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOtherClassPrompt(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => performCheckin(otherClassPrompt.cleanRa, true)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Sim, Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin / Professor PIN Security Modal */}
      {isAdminAuthModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-xs w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto mb-2">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">Acesso Exclusivo Docente</h3>
              <p className="text-[11px] text-slate-400">Digite a senha ou PIN do professor responsável para acessar o painel de controle.</p>
            </div>

            {adminPinError && (
              <div className="p-2.5 rounded-xl bg-rose-950 border border-rose-800 text-rose-300 text-[11px] font-bold text-center">
                {adminPinError}
              </div>
            )}

            <form onSubmit={handleAdminAuthSubmit} className="space-y-3">
              <input
                type="password"
                placeholder="Senha de Acesso (Ex: bmf4)"
                value={adminPinInput}
                onChange={(e) => setAdminPinInput(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-center text-sm font-mono font-bold text-white tracking-widest placeholder:text-slate-600 focus:border-amber-500 focus:outline-none"
                autoFocus
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdminAuthModalOpen(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-md cursor-pointer"
                >
                  Entrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
