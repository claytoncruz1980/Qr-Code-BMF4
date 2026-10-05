import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Tv, 
  ChevronLeft, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Minimize2, 
  ShieldCheck, 
  Clock, 
  Users, 
  UserCheck, 
  Sparkles, 
  RefreshCw, 
  Lock, 
  CheckCircle2, 
  Sun, 
  Smartphone,
  Check,
  X,
  ExternalLink,
  Zap,
  Monitor,
  RotateCcw,
  LogOut,
  ChevronDown,
  Plus,
  ArrowRight,
  FastForward,
  ArrowRightCircle,
  PlayCircle,
  Layers,
  ToggleLeft,
  ToggleRight,
  Info,
  Calendar
} from 'lucide-react';
import { useLab, isDateToday } from '../context/LabContext';
import { ClassPeriod, Student, getActivityTypeLabel, ActiveSessionDocument, LabSession } from '../types';
import { 
  getStudentAttendanceRecord, 
  isRecordPresent, 
  isRecordLate, 
  normalizeStudentRa, 
  matchStudentRa 
} from '../utils/attendanceHelpers';
import { QRCodeDisplay } from './QRCodeDisplay';
import { StudentAvatar } from './StudentAvatar';
import { AppLogo } from './AppLogo';
import { getPublicTelaoUrl, getPublicStudentCheckinUrl } from '../utils/publicUrl';
import { NewSessionModal } from './NewSessionModal';
import { supabase } from '../lib/supabase';

interface LabProjectionScreenProps {
  onExitAndClose?: () => void;
  onBackToDashboard?: () => void;
  isStandalonePortal?: boolean;
  initialPeriod?: ClassPeriod;
}

// Helper to extract parameters from window.location.search or window.location.hash
const getProjectionParam = (key: string): string => {
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

const formatTimeDisplay = (val: any): string => {
  if (!val) return 'Presente';
  if (typeof val === 'string') {
    if (val.includes(':') && val.length <= 8) return val;
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
    } catch {}
  }
  if (typeof val === 'number') {
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
    } catch {}
  }
  return String(val);
};

export const LabProjectionScreen: React.FC<LabProjectionScreenProps> = ({
  onExitAndClose,
  onBackToDashboard,
  isStandalonePortal = false,
  initialPeriod,
}) => {
  const { 
    activeSession,
    sessions, 
    classes, 
    selectedClassId, 
    setSelectedClassId,
    students, 
    soundEnabled, 
    setSoundEnabled,
    dynamicToken,
    dynamicSecondsLeft,
    dynamicCycleNumber,
    lastEmailDispatch,
    triggerManualEmailDispatch,
    appSettings,
    toggleLiveSession,
    startNewSession,
    lockCurrentSession,
    clearActiveSessionCache,
    reopenCurrentSession,
    lockPeriod1,
    lockPeriod2,
    setActivePeriod,
    transitionToPeriod,
    playBeep,
    activeProfessor,
    logoutProfessor,
    forceSyncMaster
  } = useLab();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [millisecondCounter, setMillisecondCounter] = useState('00');
  const [isConfirmLockOpen, setIsConfirmLockOpen] = useState(false);
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [latestCheckedInIds, setLatestCheckedInIds] = useState<string[]>([]);
  const [lastCheckedStudentName, setLastCheckedStudentName] = useState<string | null>(null);

  // High-frequency polling on Telão (1.5s) to guarantee instant reflection of confirmed student check-ins
  useEffect(() => {
    forceSyncMaster();
    const interval = setInterval(() => {
      forceSyncMaster();
    }, 1500);
    return () => clearInterval(interval);
  }, [forceSyncMaster]);

  // Auto-advance configuration & state
  const [autoAdvanceOnClose, setAutoAdvanceOnClose] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('bmf4_telao_auto_advance');
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });
  const [selectedNextStageOverride, setSelectedNextStageOverride] = useState<ClassPeriod | 'next_class' | null>(null);
  const [transitionToast, setTransitionToast] = useState<{ title: string; message: string; badge?: string } | null>(null);

  // Read URL params on mount
  const urlTurma = getProjectionParam('turma') || getProjectionParam('turmaid') || getProjectionParam('classId');
  const urlPeriod = getProjectionParam('period') || getProjectionParam('etapa');

  // Local period state allowing instant switching on the projection screen
  const [selectedPeriod, setSelectedPeriod] = useState<ClassPeriod | null>(() => {
    if (initialPeriod) return initialPeriod;
    if (urlPeriod) return urlPeriod as ClassPeriod;
    return null;
  });

  // Responsive screen width state for perfectly proportioned QR code across mobile and desktop/TV screens
  const [screenWidth, setScreenWidth] = useState(() => 
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  const prevPresentIdsRef = React.useRef<Set<string>>(new Set());
  const isInitialMountRef = React.useRef(true);
  const hasAutoStartedRef = React.useRef(false);

  // Sync class from URL if present
  useEffect(() => {
    if (urlTurma) {
      const found = classes.find(c => 
        c.id === urlTurma || 
        c.name.trim().toLowerCase() === urlTurma.trim().toLowerCase() ||
        (c.code && c.code.trim().toLowerCase() === urlTurma.trim().toLowerCase())
      );
      if (found && found.id !== selectedClassId) {
        setSelectedClassId(found.id);
      }
    }
  }, [urlTurma, classes, selectedClassId, setSelectedClassId]);

  // Safe fallback for effective class so it always displays correctly on new devices/TVs
  const effectiveClassId = useMemo(() => {
    if (urlTurma) {
      const foundByUrl = classes.find(c => 
        c.id === urlTurma || 
        c.name.trim().toLowerCase() === urlTurma.trim().toLowerCase() ||
        (c.code && c.code.trim().toLowerCase() === urlTurma.trim().toLowerCase())
      );
      if (foundByUrl) return foundByUrl.id;
      return urlTurma;
    }
    if (activeSession?.classGroupId && classes.some(c => c.id === activeSession.classGroupId)) {
      return activeSession.classGroupId;
    }
    if (selectedClassId && classes.some(c => c.id === selectedClassId)) {
      return selectedClassId;
    }
    if (classes.length > 0) {
      return classes[0].id;
    }
    return selectedClassId || 'class-bmf4-default';
  }, [urlTurma, classes, selectedClassId, activeSession?.classGroupId]);

  const urlSessionId = getProjectionParam('session') || getProjectionParam('sessionid') || '';

  // 1. Find local effective session for this specific class from LabContext
  const localEffectiveSession = useMemo(() => {
    if (urlSessionId) {
      const explicit = sessions.find(s => s.id === urlSessionId);
      if (explicit) return explicit;
    }
    const classSessions = sessions
      .filter(s => s.classGroupId === effectiveClassId)
      .sort((a, b) => {
        const scoreA = (a.isLive && !a.isLocked) ? 1000 : a.isLive ? 500 : 0;
        const scoreB = (b.isLive && !b.isLocked) ? 1000 : b.isLive ? 500 : 0;
        if (scoreA !== scoreB) return scoreB - scoreA;
        const timeA = a.timestamp || (a.date ? new Date(a.date).getTime() : 0);
        const timeB = b.timestamp || (b.date ? new Date(b.date).getTime() : 0);
        return timeB - timeA;
      });

    // 1. Live & unlocked session for today (HIGHEST PRIORITY)
    const todayLiveUnlocked = classSessions.find(s => isDateToday(s.date) && s.isLive && !s.isLocked);
    if (todayLiveUnlocked) return todayLiveUnlocked;

    // 2. Active session from LabContext if matching class and live
    if (activeSession && activeSession.classGroupId === effectiveClassId && activeSession.isLive && !activeSession.isLocked) {
      return activeSession;
    }

    // 3. Any live & unlocked session for this class
    const anyLiveUnlocked = classSessions.find(s => s.isLive && !s.isLocked);
    if (anyLiveUnlocked) return anyLiveUnlocked;

    // 4. Any live session today
    const todayLive = classSessions.find(s => isDateToday(s.date) && s.isLive);
    if (todayLive) return todayLive;

    // 5. Active session from LabContext
    if (activeSession && activeSession.classGroupId === effectiveClassId) {
      return activeSession;
    }

    // 6. Most recent session today (even if locked)
    const todaySession = classSessions.find(s => isDateToday(s.date));
    if (todaySession) return todaySession;

    // 7. Most recent session overall
    if (classSessions.length > 0) {
      return classSessions[0];
    }

    return null;
  }, [urlSessionId, activeSession, sessions, effectiveClassId]);

  // 2. Real-time Cloud Data Versioning state for activeSession
  const [cloudSessionData, setCloudSessionData] = useState<ActiveSessionDocument | null>(null);
  const currentVersionRef = useRef<number>(0);
  const lastUpdateTimestampRef = useRef<number>(0);

  // Fetch session directly from Supabase if urlSessionId is provided (e.g. from email link)
  useEffect(() => {
    if (!urlSessionId) return;
    const fetchSessionFromCloud = async () => {
      try {
        const { data, error } = await supabase.from('sessions').select('*').eq('id', urlSessionId).maybeSingle();
        if (!error && data) {
          setCloudSessionData({
            sessionId: data.id,
            classGroupId: data.class_group_id,
            discipline: data.discipline,
            professorId: data.professor_id,
            professorName: data.professor_name,
            activityCategory: data.activity_category,
            activityType: data.activity_type,
            labLocation: data.lab_location,
            activePeriod: data.active_period,
            isPeriod1Locked: data.is_period_1_locked,
            isPeriod2Locked: data.is_period_2_locked,
            date: data.date,
            startTime: data.start_time,
            endTime: data.end_time,
            topic: data.topic,
            checkinCode: data.checkin_code,
            isLive: data.is_live,
            isLocked: data.is_locked,
            attendance: data.attendance || {},
            version: data.version || 1,
            lastUpdateTimestamp: data.last_update_timestamp || Date.now(),
          } as any);
        }
      } catch (e) {
        console.debug('Error fetching session by urlSessionId:', e);
      }
    };
    fetchSessionFromCloud();

    const channel = supabase.channel(`telao_session_link_${urlSessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `id=eq.${urlSessionId}` }, (payload: any) => {
        if (payload.new) {
          const row = payload.new;
          setCloudSessionData({
            sessionId: row.id,
            classGroupId: row.class_group_id,
            discipline: row.discipline,
            professorId: row.professor_id,
            professorName: row.professor_name,
            activityCategory: row.activity_category,
            activityType: row.activity_type,
            labLocation: row.lab_location,
            activePeriod: row.active_period,
            isPeriod1Locked: row.is_period_1_locked,
            isPeriod2Locked: row.is_period_2_locked,
            date: row.date,
            startTime: row.start_time,
            endTime: row.end_time,
            topic: row.topic,
            checkinCode: row.checkin_code,
            isLive: row.is_live,
            isLocked: row.is_locked,
            attendance: row.attendance || {},
            version: row.version || 1,
            lastUpdateTimestamp: row.last_update_timestamp || Date.now(),
          } as any);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [urlSessionId]);

  // Synchronize current local version tracker with local session version
  useEffect(() => {
    if (localEffectiveSession?.version && localEffectiveSession.version > currentVersionRef.current) {
      currentVersionRef.current = localEffectiveSession.version;
    }
    if (localEffectiveSession?.lastUpdateTimestamp && localEffectiveSession.lastUpdateTimestamp > lastUpdateTimestampRef.current) {
      lastUpdateTimestampRef.current = localEffectiveSession.lastUpdateTimestamp;
    }
  }, [localEffectiveSession?.version, localEffectiveSession?.lastUpdateTimestamp]);

  // 4. Resolve effectiveSession using strictly the active/base session without leaking attendance from past sessions
  const effectiveSession = useMemo<LabSession | null>(() => {
    const isCloudMatching = !cloudSessionData || 
      !cloudSessionData.sessionId || 
      !localEffectiveSession || 
      cloudSessionData.sessionId === localEffectiveSession.id ||
      cloudSessionData.classGroupId === effectiveClassId;

    const foundLiveSess = sessions.find(s => s.classGroupId === effectiveClassId && s.isLive && !s.isLocked);
    const foundAnySess = sessions.find(s => s.classGroupId === effectiveClassId);

    const base = localEffectiveSession || (isCloudMatching && cloudSessionData?.isLive && !cloudSessionData?.isLocked ? cloudSessionData : null) || foundLiveSess || foundAnySess || sessions[0];

    if (!base && sessions.length === 0 && !cloudSessionData) return null;

    const targetSession = base || sessions[0];
    const mergedAttendance: Record<string, any> = {};

    if (targetSession?.attendance) {
      Object.assign(mergedAttendance, targetSession.attendance);
    }
    if (localEffectiveSession?.attendance && localEffectiveSession.id === targetSession?.id) {
      Object.assign(mergedAttendance, localEffectiveSession.attendance);
    }
    if (cloudSessionData?.attendance && cloudSessionData.sessionId === targetSession?.id) {
      Object.assign(mergedAttendance, cloudSessionData.attendance);
    }

    // Determine lock and live status authority: localEffectiveSession takes precedence
    const isExplicitlyLocked = Boolean(
      localEffectiveSession 
        ? (localEffectiveSession.isLocked && !localEffectiveSession.isLive)
        : (isCloudMatching && cloudSessionData?.isLocked && !cloudSessionData?.isLive)
    );

    const isExplicitlyLive = Boolean(
      localEffectiveSession
        ? (localEffectiveSession.isLive && !localEffectiveSession.isLocked)
        : (isCloudMatching && cloudSessionData?.isLive && !cloudSessionData?.isLocked)
    );

    const activePeriodToUse = (
      (localEffectiveSession && localEffectiveSession.activePeriod) ||
      (isCloudMatching && cloudSessionData?.activePeriod) ||
      '1'
    ) as ClassPeriod;

    return {
      ...(base || {}),
      ...(isCloudMatching ? (cloudSessionData || {}) : {}),
      id: localEffectiveSession?.id || (isCloudMatching && (cloudSessionData?.sessionId || cloudSessionData?.id)) || `session-proj-${effectiveClassId}`,
      classGroupId: localEffectiveSession?.classGroupId || (isCloudMatching && cloudSessionData?.classGroupId) || effectiveClassId,
      discipline: localEffectiveSession?.discipline || cloudSessionData?.discipline || 'BMF4',
      professorId: localEffectiveSession?.professorId || cloudSessionData?.professorId || 'prof-admin-1',
      professorName: localEffectiveSession?.professorName || cloudSessionData?.professorName || 'Prof. Dr. Juliano Pereira',
      activityCategory: localEffectiveSession?.activityCategory || cloudSessionData?.activityCategory || 'pratica',
      activityType: localEffectiveSession?.activityType || cloudSessionData?.activityType || 'aula_pratica',
      labLocation: localEffectiveSession?.labLocation || cloudSessionData?.labLocation || 'anatomia',
      activePeriod: activePeriodToUse,
      isPeriod1Locked: localEffectiveSession?.isPeriod1Locked ?? cloudSessionData?.isPeriod1Locked ?? false,
      isPeriod2Locked: localEffectiveSession?.isPeriod2Locked ?? cloudSessionData?.isPeriod2Locked ?? false,
      date: localEffectiveSession?.date || cloudSessionData?.date || new Date().toISOString().split('T')[0],
      startTime: localEffectiveSession?.startTime || '07:30',
      endTime: localEffectiveSession?.endTime || '12:00',
      topic: localEffectiveSession?.topic || cloudSessionData?.topic || 'Aula BMF4',
      anatomicalSpecimens: localEffectiveSession?.anatomicalSpecimens || [],
      checkinCode: localEffectiveSession?.checkinCode || cloudSessionData?.checkinCode || '123456',
      isLive: isExplicitlyLocked ? false : isExplicitlyLive,
      isLocked: isExplicitlyLocked,
      isPaused: false,
      attendance: mergedAttendance,
      version: Math.max(cloudSessionData?.version || 0, localEffectiveSession?.version || 0, 1),
      lastUpdateTimestamp: Math.max(cloudSessionData?.lastUpdateTimestamp || 0, localEffectiveSession?.lastUpdateTimestamp || 0, Date.now()),
    } as LabSession;
  }, [localEffectiveSession, cloudSessionData, sessions, effectiveClassId]);

  const currentDateStr = useMemo(() => {
    const d = effectiveSession?.date ? new Date(effectiveSession.date + 'T00:00:00') : new Date();
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }, [effectiveSession?.date]);

  const selectedClass = useMemo(() => {
    const found = classes.find(c => 
      c.id === effectiveClassId || 
      (c.name && c.name.trim().toLowerCase() === effectiveClassId.trim().toLowerCase())
    );
    if (found) return found;
    if (classes.length > 0) return classes[0];
    return {
      id: effectiveClassId,
      name: 'Turma Ativa',
      code: 'TURMA',
      discipline: 'BMF4 - Bases Morfofuncionais 4',
      course: 'Medicina' as const,
      semester: 'Semestre Letivo 2026',
      laboratoryRoom: 'Laboratório de Anatomia & Morfologia',
      schedule: '07:30 - 12:00',
      color: '#0284c7',
      totalStudents: 0,
      professorId: activeProfessor?.id || 'prof-admin-1',
      professorName: activeProfessor?.name || 'Docente Responsável'
    };
  }, [classes, effectiveClassId, activeProfessor]);

  const classStudents = useMemo(() => {
    return students
      .filter(s => s.classGroupId === effectiveClassId)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [students, effectiveClassId]);

  // Check if projection is explicitly locked or active
  const isLocked = Boolean(effectiveSession && effectiveSession.isLocked && !effectiveSession.isLive);
  
  // Projection is live strictly if the session is live and not locked
  const isLive = Boolean(effectiveSession && effectiveSession.isLive && !effectiveSession.isLocked);

  // Check if active live session exists for today on projection mount
  useEffect(() => {
    if (hasAutoStartedRef.current) return;
    hasAutoStartedRef.current = true;

    const hasTodayLiveSession = sessions.some(s => 
      s.classGroupId === effectiveClassId && isDateToday(s.date) && s.isLive && !s.isLocked
    );
    if (hasTodayLiveSession) return;

    const hasAnySessionToday = sessions.some(s => 
      s.classGroupId === effectiveClassId && isDateToday(s.date)
    );

    // If starting explicitly with period '2' or no session exists today, open the lesson configuration modal
    if (initialPeriod === '2' || urlPeriod === '2' || !hasAnySessionToday) {
      if (effectiveClassId) {
        setIsLessonModalOpen(true);
      }
    }
  }, [effectiveClassId, sessions, initialPeriod, urlPeriod]);

  const rotationInterval = appSettings.tokenRotationSeconds || 600;

  // Real-time clock updated every second (prevents excessive re-renders)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const currentPeriod: ClassPeriod = (
    selectedPeriod ||
    effectiveSession?.activePeriod || 
    activeSession?.activePeriod || 
    '1'
  ) as ClassPeriod;

  // Filter present students in real-time for current period
  const presentStudents = useMemo(() => {
    if (!effectiveSession?.attendance) return [];

    const seenStudentIds = new Set<string>();
    const seenRas = new Set<string>();
    const result: Student[] = [];
    const activePer = currentPeriod;

    const entries = Object.entries(effectiveSession.attendance);
    for (const [key, recVal] of entries) {
      if (!recVal) continue;
      const rec = recVal as any;

      let isPresentForPeriod = false;
      if (activePer === '1' || activePer === 'p1_start' || activePer === 'p1_end') {
        isPresentForPeriod = rec.period1Status === 'present' || rec.p1StartStatus === 'present' || rec.p1EndStatus === 'present';
      } else if (activePer === '2' || activePer === 'p2_start' || activePer === 'p2_end') {
        isPresentForPeriod = rec.period2Status === 'present' || rec.p2StartStatus === 'present' || rec.p2EndStatus === 'present';
      } else if (activePer === 'both') {
        isPresentForPeriod = isRecordPresent(rec) || isRecordLate(rec) || rec.status === 'present' || rec.status === 'late';
      } else {
        isPresentForPeriod = isRecordPresent(rec) || isRecordLate(rec) || rec.status === 'present' || rec.status === 'late';
      }

      if (!isPresentForPeriod) continue;

      const recRa = normalizeStudentRa(rec.studentRa || rec.registrationNumber || (key.length >= 6 && /^\d+$/.test(key) ? key : ''));
      const studentId = rec.studentId || (key.startsWith('student-') ? key : '');

      // Find student in students array
      const foundStudent = students.find(s => 
        (studentId && s.id === studentId) ||
        (recRa && matchStudentRa(s.registrationNumber, recRa)) ||
        s.id === key
      );

      const canonicalId = foundStudent?.id || studentId || key;
      const canonicalRa = foundStudent?.registrationNumber || rec.studentRa || recRa;

      if (canonicalId && seenStudentIds.has(canonicalId)) continue;
      if (canonicalRa && seenRas.has(normalizeStudentRa(canonicalRa))) continue;

      if (canonicalId) seenStudentIds.add(canonicalId);
      if (canonicalRa) seenRas.add(normalizeStudentRa(canonicalRa));

      const studentObj: Student = foundStudent || {
        id: canonicalId,
        name: rec.studentName || (recRa ? `Aluno RA ${recRa}` : 'Aluno Confirmado'),
        registrationNumber: canonicalRa || 'RA Registrado',
        classGroupId: effectiveClassId,
        email: '',
        attendanceStats: { totalClasses: 0, attended: 0, percentage: 100, consecutiveAbsences: 0, riskLevel: 'low' as const }
      };

      result.push(studentObj);
    }

    return result.sort((a, b) => {
      const recA = getStudentAttendanceRecord(effectiveSession.attendance, a) as any;
      const recB = getStudentAttendanceRecord(effectiveSession.attendance, b) as any;
      const timeA = (activePer === '2' || activePer === 'p2_start' || activePer === 'p2_end' || activePer === 'both')
        ? (recA?.period2Timestamp || recA?.p2StartTimestamp || recA?.timestamp || '00:00')
        : (recA?.period1Timestamp || recA?.p1StartTimestamp || recA?.timestamp || '00:00');
      const timeB = (activePer === '2' || activePer === 'p2_start' || activePer === 'p2_end' || activePer === 'both')
        ? (recB?.period2Timestamp || recB?.p2StartTimestamp || recB?.timestamp || '00:00')
        : (recB?.period1Timestamp || recB?.p1StartTimestamp || recB?.timestamp || '00:00');
      return timeB.localeCompare(timeA);
    });
  }, [effectiveSession?.attendance, students, effectiveClassId, currentPeriod]);

  const totalStudents = Math.max(classStudents.length, presentStudents.length);
  const presentCount = presentStudents.length;
  const presencePercentage = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

  // Live Sound BEEP & Visual Notification on New Student Check-in
  useEffect(() => {
    const currentIds = new Set(presentStudents.map(s => s.id));

    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      prevPresentIdsRef.current = currentIds;
      return;
    }

    const newlyAdded = presentStudents.filter(s => !prevPresentIdsRef.current.has(s.id));
    if (newlyAdded.length > 0) {
      // 1. Play auditory confirmation beep chime
      playBeep('success');

      // 2. Highlight new attendees with animated glow & banner
      const newIds = newlyAdded.map(s => s.id);
      setLatestCheckedInIds(prev => [...new Set([...prev, ...newIds])]);
      setLastCheckedStudentName(newlyAdded[0]?.name || null);

      setTimeout(() => {
        setLatestCheckedInIds(prev => prev.filter(id => !newIds.includes(id)));
      }, 5000);

      setTimeout(() => {
        setLastCheckedStudentName(null);
      }, 4000);
    }

    prevPresentIdsRef.current = currentIds;
  }, [presentStudents, playBeep]);

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {
        setIsFullscreen(true);
      });
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {
        setIsFullscreen(false);
      });
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Whenever initialPeriod prop changes, update selectedPeriod immediately
  useEffect(() => {
    if (initialPeriod) {
      setSelectedPeriod(initialPeriod);
    }
  }, [initialPeriod]);

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Adaptive QR Code size: 140px on mobile for optimal visual proportion and handheld scanning, 210px on tablet, 290px on projector/TV
  const qrCodeSize = useMemo(() => {
    if (screenWidth < 640) return 140;
    if (screenWidth < 1024) return 210;
    return 290;
  }, [screenWidth]);

  const dynamicCheckinUrl = useMemo(() => {
    return getPublicStudentCheckinUrl(
      dynamicToken || 'AUTO', 
      effectiveClassId, 
      'checkin',
      currentPeriod,
      (effectiveSession && effectiveSession.isLive && !effectiveSession.isLocked) ? effectiveSession.id : undefined
    );
  }, [dynamicToken, effectiveClassId, currentPeriod, effectiveSession?.isLive, effectiveSession?.isLocked, effectiveSession?.id]);

  // Universal link for students (adapts dynamically to whichever period is currently active)
  const dynamicStudentUniversalUrl = useMemo(() => {
    return getPublicStudentCheckinUrl(
      dynamicToken || 'AUTO',
      effectiveClassId,
      'checkin',
      undefined,
      (effectiveSession && effectiveSession.isLive && !effectiveSession.isLocked) ? effectiveSession.id : undefined
    );
  }, [dynamicToken, effectiveClassId, effectiveSession?.isLive, effectiveSession?.isLocked, effectiveSession?.id]);
  const tvScreenUrl = getPublicTelaoUrl(effectiveClassId, currentPeriod, effectiveSession?.id);
  const tvScreenAlternativeUrl = tvScreenUrl;

  // Stage names map
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

  // Rich stage configurations for high-contrast, crystal-clear projection
  const stageConfig: Record<string, { label: string; shortLabel: string; badgeColor: string; bgSoft: string; border: string; desc: string }> = {
    '1': {
      label: '1ª Aula',
      shortLabel: '1ª Aula',
      badgeColor: 'bg-emerald-600 text-white',
      bgSoft: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      border: 'border-emerald-500',
      desc: 'Registro de presença para a primeira aula',
    },
    '2': {
      label: '2ª Aula',
      shortLabel: '2ª Aula',
      badgeColor: 'bg-sky-600 text-white',
      bgSoft: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
      border: 'border-sky-500',
      desc: 'Registro de presença para a segunda aula',
    },
    'p1_start': {
      label: '1ª Aula (Início)',
      shortLabel: '1ª Aula (Início)',
      badgeColor: 'bg-emerald-600 text-white',
      bgSoft: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      border: 'border-emerald-500',
      desc: 'Registro de presença no início da 1ª aula',
    },
    'p1_end': {
      label: '1ª Aula (Final)',
      shortLabel: '1ª Aula (Final)',
      badgeColor: 'bg-emerald-600 text-white',
      bgSoft: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      border: 'border-emerald-500',
      desc: 'Confirmação de presença no final da 1ª aula',
    },
    'p2_start': {
      label: '2ª Aula (Início)',
      shortLabel: '2ª Aula (Início)',
      badgeColor: 'bg-sky-600 text-white',
      bgSoft: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
      border: 'border-sky-500',
      desc: 'Registro de presença no início da 2ª aula',
    },
    'p2_end': {
      label: '2ª Aula (Final)',
      shortLabel: '2ª Aula (Final)',
      badgeColor: 'bg-sky-600 text-white',
      bgSoft: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
      border: 'border-sky-500',
      desc: 'Confirmação de presença no final da 2ª aula',
    },
    'both': {
      label: 'Chamada Integral',
      shortLabel: 'Chamada Integral',
      badgeColor: 'bg-amber-500 text-slate-950 font-bold',
      bgSoft: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      border: 'border-amber-500',
      desc: 'Presença integral para ambas as aulas (1ª e 2ª)',
    },
    'activity_single': {
      label: 'Chamada Integral',
      shortLabel: 'Chamada Integral',
      badgeColor: 'bg-teal-600 text-white',
      bgSoft: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
      border: 'border-teal-500',
      desc: 'Chamada integral de atividade prática em laboratório',
    }
  };

  const currentStageName = stageLabels[currentPeriod] || '1ª Aula';
  const currentStageInfo = stageConfig[currentPeriod] || {
    label: currentStageName,
    shortLabel: currentStageName,
    badgeColor: 'bg-teal-600 text-white',
    bgSoft: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    border: 'border-teal-500',
    desc: 'Chamada ativa em tempo real',
  };

  // Determine the next sequential stage or class in order
  const nextStage = useMemo(() => {
    switch (currentPeriod) {
      case 'p1_start':
      case 'p1_end':
      case '1':
        return {
          period: '2' as ClassPeriod,
          name: '2ª Aula',
          fullName: '2ª Aula',
          actionName: 'Avançar para 2ª Aula',
          type: 'period' as const,
          classId: effectiveClassId,
          badgeColor: 'bg-sky-600 text-white',
        };
      case 'p2_start':
      case 'p2_end':
      case '2':
      case 'both':
      case 'activity_single':
      default: {
        return {
          period: 'p1_start' as ClassPeriod,
          name: 'Encerrar Chamada',
          fullName: 'Encerrar Chamada e Voltar para Tela de Abrir Aula',
          actionName: 'Encerrar Chamada',
          type: 'lock_and_open' as const,
          classId: effectiveClassId,
          badgeColor: 'bg-rose-600 text-white',
        };
      }
    }
  }, [currentPeriod, effectiveClassId]);

  // Handler to close current stage and automatically transition to the next selected stage
  const handleCloseAndAdvanceToNextStage = (targetPeriodOverride?: ClassPeriod, targetClassOverride?: string) => {
    const targetPeriod = targetPeriodOverride || nextStage.period;
    const targetClassId = targetClassOverride || nextStage.classId;
    const isLockAndOpen = nextStage.type === 'lock_and_open';
    const isNextClass = (nextStage.type === 'class' && targetClassId !== effectiveClassId) || (targetClassOverride && targetClassOverride !== effectiveClassId);
    const isNewSession = nextStage.type === 'new_session';

    setSelectedPeriod(null);
    setSelectedNextStageOverride(null);

    const realSessId = effectiveSession?.id && !effectiveSession.id.startsWith('session-proj-') 
      ? effectiveSession.id 
      : (sessions.find(s => s.classGroupId === effectiveClassId && s.isLive)?.id || sessions.find(s => s.classGroupId === effectiveClassId)?.id);

    if (isLockAndOpen) {
      lockCurrentSession(realSessId, effectiveClassId);
      setCloudSessionData(prev => prev ? { ...prev, isLocked: true, isLive: false } : null);
      setIsConfirmLockOpen(false);
      setIsLessonModalOpen(true);
      playBeep('lock');
      setTransitionToast({
        title: '2ª Chamada Encerrada!',
        message: 'A chamada da 2ª aula foi encerrada. Abrindo a tela para identificação e abertura de aula.',
        badge: 'Encerrada',
      });
      setTimeout(() => {
        setTransitionToast(null);
      }, 5000);
      return;
    }

    if (isNextClass) {
      lockCurrentSession(realSessId, effectiveClassId);
      setSelectedClassId(targetClassId);
      startNewSession({
        classGroupId: targetClassId,
        topic: effectiveSession?.topic || 'Aula BMF4 - Morfofuncional',
        activityCategory: effectiveSession?.activityCategory || 'pratica',
        activityType: effectiveSession?.activityType || 'aula_pratica',
        labLocation: effectiveSession?.labLocation,
        activePeriod: '1',
      });
      const targetClassName = classes.find(c => c.id === targetClassId)?.name || 'Nova Turma';
      setTransitionToast({
        title: 'Turma Concluída e Nova Chamada Aberta!',
        message: `A chamada da turma anterior foi encerrada. O Telão abriu a chamada da: ${targetClassName}`,
        badge: 'Nova Turma',
      });
    } else if (isNewSession) {
      lockCurrentSession(realSessId, effectiveClassId);
      setIsLessonModalOpen(true);
      return;
    } else {
      transitionToPeriod(currentPeriod, targetPeriod, realSessId);
      const nextInfo = stageConfig[targetPeriod] || { shortLabel: targetPeriod, label: targetPeriod };
      setTransitionToast({
        title: 'Etapa Anterior Encerrada com Sucesso!',
        message: `O Telão avançou automaticamente. Exibindo agora o QR Code da: ${nextInfo.label || nextInfo.shortLabel}.`,
        badge: nextInfo.shortLabel,
      });
    }

    playBeep('session_start');
    setTimeout(() => {
      setTransitionToast(null);
    }, 5000);

    setIsConfirmLockOpen(false);
  };

  const handleOpenLockModal = () => {
    setSelectedNextStageOverride(null);
    setIsConfirmLockOpen(true);
  };

  const handleConfirmLockSession = () => {
    const realSessId = effectiveSession?.id && !effectiveSession.id.startsWith('session-proj-') 
      ? effectiveSession.id 
      : (sessions.find(s => s.classGroupId === effectiveClassId && s.isLive)?.id || sessions.find(s => s.classGroupId === effectiveClassId)?.id);

    lockCurrentSession(realSessId, effectiveClassId);
    setCloudSessionData(prev => prev ? { ...prev, isLocked: true, isLive: false } : null);
    setIsConfirmLockOpen(false);
    playBeep('lock');
    setTransitionToast({
      title: 'Chamada Encerrada!',
      message: 'A chamada foi encerrada com sucesso.',
      badge: 'Encerrada',
    });
    setTimeout(() => {
      setTransitionToast(null);
    }, 5000);
  };

  const handleExitAndClose = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    clearActiveSessionCache();
    setSelectedPeriod(null);
    setSelectedNextStageOverride(null);
    playBeep('click');
    logoutProfessor();
    if (onExitAndClose) {
      onExitAndClose();
    } else if (onBackToDashboard) {
      onBackToDashboard();
    }
    try {
      window.close();
    } catch {
      // Ignored if window cannot be closed by script
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col justify-between overflow-y-auto overflow-x-hidden select-none font-sans">
      
      {/* Top Header of Projection Screen - Minimalist, Responsive & Sleek */}
      <header className="px-3 sm:px-6 md:px-8 py-1.5 sm:py-3.5 border-b border-slate-800/80 bg-slate-900/95 backdrop-blur sticky top-0 z-20 shadow-md w-full shrink-0">
        {/* Row 1: Left (Sair), Center/Left (Turma + Info), Right (Actions/Utilities) */}
        <div className="flex items-center justify-between gap-2 sm:gap-4 w-full">
          {/* Left: Sair button & Turma Selector */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 md:flex-initial">
            <button
              id="btn-telao-sair-fechar"
              onClick={handleExitAndClose}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-slate-800 hover:bg-rose-950/80 hover:text-rose-300 hover:border-rose-700/80 text-slate-300 text-xs font-bold transition-all border border-slate-700 shadow-xs shrink-0 cursor-pointer active:scale-95"
              title="Sair da projeção e fechar tela"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="hidden sm:inline">Sair e Fechar</span>
              <span className="sm:hidden">Sair</span>
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2 relative">
                {/* Class Dropdown Selector */}
                <div className="relative min-w-0">
                  <button
                    type="button"
                    onClick={() => setIsClassDropdownOpen(!isClassDropdownOpen)}
                    className="flex items-center gap-1 sm:gap-1.5 text-sm sm:text-base md:text-lg font-black text-white tracking-tight hover:text-teal-300 transition-colors cursor-pointer max-w-full"
                    title="Clique para alternar a turma projetada"
                  >
                    <span className="truncate max-w-[130px] xs:max-w-[180px] sm:max-w-[240px] md:max-w-[280px]">
                      {selectedClass?.name || 'Turma BMF4'}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-400 shrink-0" />
                  </button>

                  {isClassDropdownOpen && (
                    <div className="absolute top-full left-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 z-50 space-y-1 animate-in fade-in zoom-in-95">
                      <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider">
                        Selecionar Turma
                      </div>
                      {classes.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedClassId(c.id);
                            setIsClassDropdownOpen(false);
                            playBeep('click');
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                            c.id === effectiveClassId 
                              ? 'bg-teal-600 text-white shadow-sm' 
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <span className="truncate">{c.name}</span>
                          {c.id === effectiveClassId && <Check className="w-3.5 h-3.5" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <span className="hidden lg:inline-flex px-2.5 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-[10px] font-bold uppercase tracking-wider shrink-0">
                  {currentStageName}
                </span>
              </div>
              <p className="hidden md:flex text-xs text-slate-400 truncate items-center flex-wrap gap-1.5">
                <span>{effectiveSession?.topic || 'Bases Morfofuncionais 4'} • Prof. {effectiveSession?.professorName || selectedClass?.professorName || 'Docente'}</span>
                {effectiveSession?.activityType && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-teal-500/20 text-teal-300 border-teal-500/40">
                    {getActivityTypeLabel(effectiveSession.activityType)}
                  </span>
                )}
                {effectiveSession?.activityCategory === 'pratica' && effectiveSession.labLocation && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    effectiveSession.labLocation === 'anatomia' 
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                      : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                  }`}>
                    {effectiveSession.labLocation === 'anatomia' ? '🫀 Lab. Anatomia' : '🔬 Lab. Histologia'}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Desktop Right Controls: Link do Modo Telão, Actions, Clock, Sound, Fullscreen */}
          <div className="hidden md:flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Direct Link do Modo Telão */}
            <a
              href={tvScreenUrl}
              target="_blank"
              rel="noreferrer"
              id="link-modo-telao-header"
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-teal-300 hover:text-teal-200 border border-teal-500/40 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
              title="Abrir Link do Modo Telão em tela cheia na TV ou Projetor"
            >
              <ExternalLink className="w-3.5 h-3.5 text-teal-400" />
              <span>Link do Modo Telão</span>
            </a>

            {/* Quick Advance & Lock Controls */}
            {!isLocked ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  id="btn-telao-encerrar-chamada"
                  type="button"
                  onClick={handleOpenLockModal}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                  title="Encerrar chamada e escolher opções de avanço"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Encerrar</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  id="btn-telao-reabrir-chamada"
                  onClick={() => {
                    reopenCurrentSession(effectiveSession?.id, effectiveClassId);
                    playBeep('session_start');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                  title="Reabrir chamada encerrada"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reabrir Chamada</span>
                </button>

                <button
                  id="btn-telao-nova-aula-header"
                  onClick={() => {
                    setIsLessonModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                  title="Iniciar uma nova aula para esta turma identificando o tipo de aula"
                >
                  <Plus className="w-3.5 h-3.5 text-teal-400" />
                  <span>Nova Aula</span>
                </button>
              </div>
            )}

            {/* Real-time Date and Digital Clock */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 bg-slate-800/80 rounded-xl border border-slate-700/80 text-[11px] sm:text-xs font-mono font-bold text-teal-300 shrink-0">
              <Calendar className="w-3.5 h-3.5 text-teal-400 hidden xs:block" />
              <span>{currentDateStr}</span>
              <span className="text-slate-500">•</span>
              <Clock className="w-3.5 h-3.5 text-teal-400" />
              <span>{currentTime}</span>
            </div>

            {/* Real-time Data Version Badge */}
            <div 
              id="badge-data-version"
              className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800/80 rounded-xl border border-teal-500/30 text-xs font-mono font-bold text-teal-300 shrink-0"
              title={`Sincronização em tempo real com controle de versão ativo: v${effectiveSession?.version || 1}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>v{effectiveSession?.version || 1}</span>
            </div>

            {/* Sound Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 cursor-pointer shrink-0"
              title={soundEnabled ? 'Sinal sonoro ativado (Bip na presença)' : 'Silencioso'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-teal-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 cursor-pointer shrink-0"
              title="Alternar Tela Cheia"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>

          {/* Mobile Right Utilities (Sound + Fullscreen on Row 1) */}
          <div className="md:hidden flex items-center gap-1 shrink-0">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 cursor-pointer"
              title={soundEnabled ? 'Sinal sonoro ativado' : 'Silencioso'}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-teal-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 cursor-pointer"
              title="Alternar Tela Cheia"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Mobile Row 2: Action Buttons - Ultra-compact, Distinct, No Overlap! */}
        <div className="md:hidden flex items-center gap-1.5 w-full justify-between pt-1.5 mt-1 border-t border-slate-800/80 overflow-x-auto no-scrollbar">
          <a
            href={tvScreenUrl}
            target="_blank"
            rel="noreferrer"
            id="link-modo-telao-mobile"
            className="px-2 py-1 bg-slate-800 active:bg-slate-700 text-teal-300 border border-teal-500/40 text-[10px] font-bold rounded-lg flex items-center gap-1 shadow-xs shrink-0 whitespace-nowrap"
            title="Abrir Link do Modo Telão"
          >
            <ExternalLink className="w-3 h-3 text-teal-400" />
            <span>Link Modo Telão</span>
          </a>

          {!isLocked ? (
            <div className="flex items-center gap-1 shrink-0">
              <button
                id="btn-telao-encerrar-chamada-mobile"
                type="button"
                onClick={handleOpenLockModal}
                className="px-2 py-1 rounded-lg bg-rose-600 active:bg-rose-500 text-white text-[10px] font-black flex items-center gap-1 shadow-xs shrink-0 whitespace-nowrap"
                title="Encerrar chamada"
              >
                <Lock className="w-3 h-3" />
                <span>Encerrar</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 shrink-0">
              <button
                id="btn-telao-reabrir-chamada-mobile"
                onClick={() => {
                  reopenCurrentSession(effectiveSession?.id, effectiveClassId);
                  playBeep('session_start');
                }}
                className="px-2 py-1 rounded-lg bg-emerald-600 active:bg-emerald-500 text-white text-[10px] font-black flex items-center gap-1 shadow-xs shrink-0 whitespace-nowrap"
                title="Reabrir chamada encerrada"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reabrir</span>
              </button>

              <button
                id="btn-telao-nova-aula-header-mobile"
                onClick={() => {
                  setIsLessonModalOpen(true);
                }}
                className="px-2 py-1 rounded-lg bg-slate-800 text-teal-300 border border-teal-500/30 text-[10px] font-black flex items-center gap-1 shadow-xs shrink-0 whitespace-nowrap cursor-pointer"
                title="Iniciar uma nova aula para esta turma identificando o tipo de aula"
              >
                <Plus className="w-3 h-3 text-teal-400" />
                <span>Nova</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Telão Content Body - Spacious, High Legibility, Clean, Never Cut-off */}
      <main className="flex-1 flex flex-col items-center justify-start lg:justify-center px-3 sm:px-6 md:px-8 py-2.5 sm:py-6 max-w-7xl mx-auto w-full overflow-x-hidden">
        
        {/* Floating Transition Toast Notification Banner */}
        {transitionToast && (
          <div className="w-full max-w-2xl mb-4 px-4 py-3 bg-teal-950/90 border-2 border-teal-400 rounded-2xl shadow-2xl flex items-center justify-between gap-3 text-white animate-in slide-in-from-top-4 fade-in duration-300">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-400/40 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-teal-300 animate-spin" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-black text-sm text-teal-200">{transitionToast.title}</h4>
                  {transitionToast.badge && (
                    <span className="px-2 py-0.5 rounded-full bg-teal-500 text-slate-950 text-[10px] font-black uppercase">
                      {transitionToast.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-200 truncate">{transitionToast.message}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setTransitionToast(null)}
              className="p-1 rounded-lg hover:bg-teal-900/60 text-teal-300 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {isLive ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center w-full">
            
            {/* Left Column (7 Cols): Dynamic QR Code */}
            <div className="lg:col-span-7 flex flex-col items-center text-center space-y-2.5 sm:space-y-4 w-full">
              
              {/* Stage / Period Selector Pills in Telão */}
              <div className="flex items-center justify-start sm:justify-center gap-1.5 p-1.5 bg-slate-900/90 rounded-xl sm:rounded-2xl border border-slate-800 shadow-inner w-full max-w-full overflow-x-auto no-scrollbar sm:flex-wrap">
                <button
                  type="button"
                  id="btn-telao-period-1"
                  onClick={() => {
                    setSelectedPeriod('1');
                    setActivePeriod('1', effectiveSession?.id, effectiveClassId);
                    playBeep('click');
                  }}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    currentPeriod === '1' || currentPeriod === 'p1_start' || currentPeriod === 'p1_end'
                      ? 'bg-emerald-600 text-white shadow-md scale-102 ring-1 sm:ring-2 ring-emerald-400/50'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title="1ª Aula - Chamada da primeira aula"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-300"></span>
                  <span>1ª Aula</span>
                </button>

                <button
                  type="button"
                  id="btn-telao-period-2"
                  onClick={() => {
                    setSelectedPeriod('2');
                    setActivePeriod('2', effectiveSession?.id, effectiveClassId);
                    playBeep('click');
                  }}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    currentPeriod === '2' || currentPeriod === 'p2_start' || currentPeriod === 'p2_end'
                      ? 'bg-sky-600 text-white shadow-md scale-102 ring-1 sm:ring-2 ring-sky-400/50'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title="2ª Aula - Chamada da segunda aula"
                >
                  <span className="w-2 h-2 rounded-full bg-sky-300"></span>
                  <span>2ª Aula</span>
                </button>

                <button
                  type="button"
                  id="btn-telao-period-both"
                  onClick={() => {
                    setSelectedPeriod('both');
                    setActivePeriod('both', effectiveSession?.id, effectiveClassId);
                    playBeep('click');
                  }}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    currentPeriod === 'both'
                      ? 'bg-amber-400 text-slate-950 font-black shadow-md scale-102 ring-1 sm:ring-2 ring-amber-300'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title="Chamada Integral (1ª e 2ª Aulas)"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                  <span>Chamada Integral</span>
                </button>
              </div>

              {/* QR Code Container with Crisp Contrast and Balanced Dimensions */}
              <div className="relative w-full max-w-[215px] xs:max-w-[230px] sm:max-w-[280px] md:max-w-[320px] lg:max-w-[380px] bg-white rounded-2xl sm:rounded-3xl shadow-2xl border-2 sm:border-4 border-teal-500/90 flex flex-col items-center justify-center overflow-hidden mx-auto">
                
                {/* Header of the QR Card: Corresponding Lesson Banner */}
                <div className="w-full bg-slate-900 px-2 sm:px-4 py-1.5 sm:py-3 border-b-2 border-teal-500/60 text-center space-y-0.5">
                  <div className="flex items-center justify-center gap-1 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 sm:px-3 py-0.5 rounded-full text-[9px] sm:text-xs font-black uppercase tracking-wider shadow-sm ${currentStageInfo.badgeColor}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                      <span>{currentStageInfo.label}</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-center gap-1.5 flex-wrap px-1">
                    <p className="text-[10px] sm:text-xs font-bold text-white tracking-tight truncate">
                      {selectedClass?.name || 'Turma BMF4'} • <span className="text-teal-300">{effectiveSession?.topic || selectedClass?.discipline || 'BMF4'}</span>
                    </p>
                    {effectiveSession?.activityType && (
                      <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40 text-[9px] sm:text-[10px] font-bold">
                        {getActivityTypeLabel(effectiveSession.activityType)}
                      </span>
                    )}
                  </div>
                  
                  <div className="hidden sm:flex text-[9px] sm:text-[10px] text-slate-300 items-center justify-center gap-1.5">
                    <span>Data: {effectiveSession?.date ? effectiveSession.date.split('-').reverse().join('/') : new Date().toLocaleDateString('pt-BR')}</span>
                    <span>•</span>
                    <span className="text-emerald-400 font-bold">QR Code Oficial</span>
                  </div>
                </div>

                {/* QR Code Display Area - Strictly Sized Container */}
                <div className="p-1.5 sm:p-4 flex flex-col items-center justify-center w-full max-w-full">
                  <div className="w-[135px] h-[135px] sm:w-[195px] sm:h-[195px] lg:w-[275px] lg:h-[275px] flex items-center justify-center overflow-hidden">
                    <QRCodeDisplay 
                      value={dynamicCheckinUrl} 
                      size={qrCodeSize} 
                      showBorder={false}
                    />
                  </div>

                  {/* Rotating Countdown Bar & Badge */}
                  <div className="mt-1.5 sm:mt-2.5 px-2 sm:px-3.5 py-0.5 sm:py-1 rounded-full bg-slate-950 text-teal-300 border border-teal-500/40 text-[9px] sm:text-xs font-mono font-bold flex items-center gap-1 sm:gap-1.5 shadow-inner">
                    <RefreshCw className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-teal-400 animate-spin" />
                    <span>Atualiza em <strong>{dynamicSecondsLeft}s</strong></span>
                  </div>
                </div>
              </div>

              {/* Minimal Clean Projection Instructions */}
              <div className="space-y-0.5 max-w-lg text-center px-2">
                <h2 className="text-xs sm:text-lg lg:text-xl font-bold text-white tracking-tight">
                  Aponte a Câmera do Celular • <span className="text-teal-400">{currentStageInfo.shortLabel}</span>
                </h2>
                <p className="hidden sm:block text-xs text-slate-300">
                  Confirmação instantânea de presença na tela • Sem necessidade de digitação
                </p>
              </div>

            </div>

            {/* Right Column (5 Cols): Live Real-time Attendance Feed */}
            <div className="lg:col-span-5 bg-slate-900/90 rounded-2xl sm:rounded-3xl p-3 sm:p-6 border border-slate-800 shadow-xl space-y-2 sm:space-y-4 w-full">
              
              {/* Header of Live Feed */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 sm:pb-3">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                    Presenças Confirmadas
                  </h3>
                </div>
                <span className="text-[10px] sm:text-xs font-mono font-bold text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800/80">
                  {presentCount} / {totalStudents} ({presencePercentage}%)
                </span>
              </div>

              {/* Latest student alert banner */}
              {lastCheckedStudentName && (
                <div className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[11px] sm:text-xs font-bold flex items-center gap-2 animate-in fade-in zoom-in-95 shadow-md">
                  <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
                  <span className="truncate">Presença confirmada: {lastCheckedStudentName}</span>
                </div>
              )}

              {/* Scrollable list of attendees */}
              <div className="max-h-[180px] sm:max-h-[340px] overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-800/40">
                {presentStudents.length === 0 ? (
                  <div className="py-3.5 sm:py-14 text-center text-slate-500 text-xs space-y-1 sm:space-y-2">
                    <Smartphone className="w-5 h-5 sm:w-8 sm:h-8 mx-auto text-slate-600 animate-bounce" />
                    <p className="font-semibold text-slate-400 text-[11px] sm:text-xs">Aguardando confirmações...</p>
                    <p className="hidden sm:block text-[11px] text-slate-500">Ao ler o QR Code ou clicar no link, o nome aparece aqui instantaneamente com bip sonoro.</p>
                  </div>
                ) : (
                  presentStudents.map((st) => {
                    const rec = effectiveSession?.attendance ? getStudentAttendanceRecord(effectiveSession.attendance, st) : undefined;
                    const isRecentlyChecked = latestCheckedInIds.includes(st.id);

                    return (
                      <div 
                        key={st.id} 
                        className={`pt-1.5 pb-1 flex items-center justify-between text-xs transition-all duration-300 ${
                          isRecentlyChecked 
                            ? 'bg-emerald-950/80 border border-emerald-500/80 p-2 rounded-xl ring-2 ring-emerald-400/40 shadow-md' 
                            : ''
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <StudentAvatar name={st.name} size="sm" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-200 block truncate max-w-[150px] sm:max-w-[190px]">
                                {st.name}
                              </span>
                              {isRecentlyChecked && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-400 text-slate-950 uppercase animate-pulse">
                                  AGORA
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-[10px] text-slate-400">
                              RA: {st.registrationNumber}
                            </span>
                          </div>
                        </div>

                        <span className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                          isRecentlyChecked
                            ? 'text-white bg-emerald-600 border-emerald-400'
                            : 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60'
                        }`}>
                          {formatTimeDisplay(
                            (currentPeriod === '2' || currentPeriod === 'p2_start' || currentPeriod === 'p2_end')
                              ? (rec?.period2Timestamp || rec?.p2StartTimestamp || rec?.timestamp)
                              : (rec?.period1Timestamp || rec?.p1StartTimestamp || rec?.timestamp)
                          )}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

            </div>

          </div>
        ) : (
          /* When session is CLOSED / LOCKED */
          <div className="text-center py-10 sm:py-16 space-y-4 sm:space-y-5 bg-slate-900/90 rounded-3xl p-5 sm:p-12 border border-slate-800 w-full max-w-lg shadow-2xl mx-auto">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto border border-slate-700">
              <Lock className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-black text-white">
                {isLocked ? 'Chamada Encerrada pelo Professor' : 'Chamada Não Iniciada'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                O QR Code de presença fica oculto quando a chamada está fechada para segurança acadêmica.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3 pt-2 w-full">
              {isLocked && effectiveSession && (
                <button
                  id="btn-telao-reopen-center"
                  onClick={() => {
                    reopenCurrentSession(effectiveSession.id, effectiveClassId);
                    playBeep('session_start');
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 sm:py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/40 text-xs font-black shadow-lg transition-all active:scale-95 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reabrir Chamada Atual</span>
                </button>
              )}

              <button
                id="btn-telao-nova-aula-center"
                onClick={() => {
                  setIsLessonModalOpen(true);
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 sm:py-3 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black shadow-lg transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-teal-200" />
                <span>Configurar & Abrir Nova Aula</span>
              </button>
            </div>
          </div>
        )}

      </main>

      {/* Confirmation Modal for Encerrar Chamada with Auto-Next Options */}
      {isConfirmLockOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shadow-inner">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Encerrar Chamada da Aula
                  </h3>
                  <p className="text-xs text-slate-400">
                    Turma: {selectedClass?.name} • <span className="text-teal-300">{currentStageInfo.label}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmLockOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 text-xs text-slate-300 space-y-1">
              <p className="font-semibold text-white">
                Deseja encerrar e bloquear a chamada agora?
              </p>
              <p className="text-slate-400 leading-relaxed">
                Ao confirmar, a chamada será bloqueada no sistema. Novos check-ins de presença nesta aula serão imediatamente interrompidos.
              </p>
            </div>

            {/* Direct Clear Actions */}
            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                id="btn-confirm-lock-telao-yes"
                onClick={handleConfirmLockSession}
                className="w-full py-3.5 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-98 text-white font-black text-xs shadow-lg shadow-rose-950/50 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                <span>Sim, Encerrar e Bloquear Chamada Agora</span>
              </button>

              <button
                type="button"
                onClick={() => setIsConfirmLockOpen(false)}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center"
              >
                Cancelar / Continuar Chamada Aberta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer of Projection Screen */}
      <footer className="px-4 sm:px-8 py-3 border-t border-slate-800/80 bg-slate-900/90 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-teal-400" />
          <span>Sistema Anti-Fraude com Rotação Criptografada BMF4</span>
        </div>
        <div>
          <span>Presenças registradas sincronizadas instantaneamente.</span>
        </div>
      </footer>

      {/* Identify Lesson Type & Configure Session Modal */}
      {isLessonModalOpen && (
        <NewSessionModal
          isOpen={isLessonModalOpen}
          onClose={() => setIsLessonModalOpen(false)}
          isTelaoIntent={true}
          onSessionStarted={(startedPeriod) => {
            if (startedPeriod) {
              setSelectedPeriod(startedPeriod);
            } else {
              setSelectedPeriod(null);
            }
            setIsLessonModalOpen(false);
            playBeep('session_start');
          }}
        />
      )}

    </div>
  );
};
