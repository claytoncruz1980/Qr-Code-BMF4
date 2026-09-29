/**
 * Centralized Attendance Helpers
 * Ensures 100% consistent presence, late, excused, and absence calculations
 * across all components (Telão, ReportsView, exportExcel, LabContext).
 */

import { LabSession, Student } from '../types';

export function normalizeStudentRa(ra: string | undefined | null): string {
  if (!ra) return '';
  return String(ra).trim().replace(/\D/g, '');
}

export function matchStudentRa(ra1: string | undefined | null, ra2: string | undefined | null): boolean {
  if (!ra1 || !ra2) return false;
  const clean1 = normalizeStudentRa(ra1);
  const clean2 = normalizeStudentRa(ra2);
  if (!clean1 || !clean2) return false;
  if (clean1 === clean2) return true;
  // Handle leading zeros or prefix variations
  const num1 = clean1.replace(/^0+/, '');
  const num2 = clean2.replace(/^0+/, '');
  if (num1 && num2 && num1 === num2) return true;
  return clean1.endsWith(clean2) || clean2.endsWith(clean1);
}

/**
 * Searches an attendance dictionary for a student's record using:
 * 1. Direct key by student ID
 * 2. Direct key by student RA
 * 3. Direct key by normalized numeric RA
 * 4. Value search by studentId, studentRa, or registrationNumber
 */
export function getStudentAttendanceRecord(
  attendance: Record<string, any> | undefined | null,
  student: { id?: string; registrationNumber?: string } | string | undefined | null
): any {
  if (!attendance || !student) return null;

  const studentId = typeof student === 'string' ? student : student.id;
  const studentRa = typeof student === 'string' ? '' : student.registrationNumber;
  const cleanRa = normalizeStudentRa(studentRa);

  // 1. Direct key match by ID
  if (studentId && attendance[studentId]) {
    return attendance[studentId];
  }

  // 2. Direct key match by raw RA
  if (studentRa && attendance[studentRa]) {
    return attendance[studentRa];
  }

  // 3. Direct key match by normalized RA
  if (cleanRa && attendance[cleanRa]) {
    return attendance[cleanRa];
  }

  // 4. Scan record objects inside attendance
  const records = Object.values(attendance);
  const matched = records.find((rec: any) => {
    if (!rec) return false;

    // Match by ID
    if (studentId && (rec.studentId === studentId || rec.id === studentId)) {
      return true;
    }

    // Match by RA
    if (cleanRa) {
      const recRa = rec.studentRa || rec.registrationNumber || rec.ra;
      if (matchStudentRa(recRa, cleanRa)) {
        return true;
      }
    }

    return false;
  });

  return matched || null;
}

/**
 * Checks if a record counts as "present".
 * Considers overall status, period 1, period 2, or sub-period presence.
 */
export function isRecordPresent(rec: any): boolean {
  if (!rec) return false;
  return (
    rec.status === 'present' ||
    rec.period1Status === 'present' ||
    rec.period2Status === 'present' ||
    rec.p1StartStatus === 'present' ||
    rec.p1EndStatus === 'present' ||
    rec.p2StartStatus === 'present' ||
    rec.p2EndStatus === 'present'
  );
}

/**
 * Checks if a record counts as "late".
 */
export function isRecordLate(rec: any): boolean {
  if (!rec) return false;
  return (
    rec.status === 'late' ||
    rec.period1Status === 'late' ||
    rec.period2Status === 'late' ||
    rec.p1StartStatus === 'late' ||
    rec.p2StartStatus === 'late'
  );
}

/**
 * Checks if a record counts as "excused" (medical certificate/atestado).
 */
export function isRecordExcused(rec: any): boolean {
  if (!rec) return false;
  return (
    rec.status === 'excused' ||
    rec.period1Status === 'excused' ||
    rec.period2Status === 'excused'
  );
}

/**
 * Checks if a record is definitely absent.
 */
export function isRecordAbsent(rec: any): boolean {
  if (!rec) return true;
  return !isRecordPresent(rec) && !isRecordLate(rec) && !isRecordExcused(rec);
}

/**
 * Determines consolidated status: 'present' | 'late' | 'excused' | 'absent'
 */
export function getRecordConsolidatedStatus(rec: any): 'present' | 'late' | 'excused' | 'absent' {
  if (!rec) return 'absent';
  if (isRecordPresent(rec)) return 'present';
  if (isRecordLate(rec)) return 'late';
  if (isRecordExcused(rec)) return 'excused';
  return 'absent';
}

/**
 * Returns human-readable label in Portuguese.
 */
export function getRecordStatusLabel(rec: any): string {
  const status = getRecordConsolidatedStatus(rec);
  switch (status) {
    case 'present': return 'Presente';
    case 'late': return 'Atraso';
    case 'excused': return 'Justificada';
    case 'absent': return 'Falta';
  }
}

export function matchStudentClass(
  studentClassGroupId?: string | null,
  targetClassId?: string | null,
  classesList?: Array<{ id: string; name: string; code?: string }> | null
): boolean {
  if (!studentClassGroupId || !targetClassId) return false;
  const cleanStudent = String(studentClassGroupId).trim().toLowerCase();
  const cleanTarget = String(targetClassId).trim().toLowerCase();
  if (cleanStudent === cleanTarget) return true;

  if (classesList && Array.isArray(classesList)) {
    const targetClass = classesList.find(
      c =>
        c.id.toLowerCase() === cleanTarget ||
        c.name.trim().toLowerCase() === cleanTarget ||
        (c.code && c.code.trim().toLowerCase() === cleanTarget)
    );
    if (targetClass) {
      if (
        cleanStudent === targetClass.id.toLowerCase() ||
        cleanStudent === targetClass.name.trim().toLowerCase() ||
        (targetClass.code && cleanStudent === targetClass.code.trim().toLowerCase())
      ) {
        return true;
      }
    }

    const studentClass = classesList.find(
      c =>
        c.id.toLowerCase() === cleanStudent ||
        c.name.trim().toLowerCase() === cleanStudent ||
        (c.code && c.code.trim().toLowerCase() === cleanStudent)
    );
    if (studentClass && targetClass) {
      if (
        studentClass.id.toLowerCase() === targetClass.id.toLowerCase() ||
        studentClass.name.trim().toLowerCase() === targetClass.name.trim().toLowerCase()
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Reconciles student attendance across sessions on the same date (e.g., Aula Teórica and Aula Prática rotation).
 * Resolves the issue where a student who attended 1ª Aula in Teórica and 2ª Aula in Prática
 * is incorrectly marked absent for 2ª Aula Teórica or 1ª Aula Prática.
 */
export function reconcileSessionsAttendance(
  sessionsList: LabSession[],
  studentsList?: Student[] | Array<{ id: string; registrationNumber?: string; name?: string; classGroupId?: string }>
): LabSession[] {
  if (!Array.isArray(sessionsList) || sessionsList.length === 0) return sessionsList;

  // Group sessions by normalized date (YYYY-MM-DD)
  const sessionsByDate: Record<string, LabSession[]> = {};
  sessionsList.forEach(s => {
    if (!s) return;
    const dateKey = (s.date || '').split('T')[0] || 'sem_data';
    if (!sessionsByDate[dateKey]) {
      sessionsByDate[dateKey] = [];
    }
    sessionsByDate[dateKey].push(s);
  });

  let hasChanges = false;
  // Deep clone sessions map for safe immutability
  const newSessionsMap: Record<string, LabSession> = {};
  sessionsList.forEach(s => {
    const clonedAtt: Record<string, any> = {};
    if (s.attendance) {
      Object.entries(s.attendance).forEach(([k, v]) => {
        clonedAtt[k] = v ? { ...v } : v;
      });
    }
    newSessionsMap[s.id] = {
      ...s,
      attendance: clonedAtt
    };
  });

  for (const [, daySessions] of Object.entries(sessionsByDate)) {
    if (daySessions.length === 1) {
      // Single session on this date: check if only 1 period was ever held
      const s = daySessions[0];
      if (!s || !s.attendance) continue;

      const records = Object.values(s.attendance);
      const hasAnyP1 = records.some((rec: any) => rec?.period1Status === 'present' || rec?.p1StartStatus === 'present' || rec?.p1EndStatus === 'present');
      const hasAnyP2 = records.some((rec: any) => rec?.period2Status === 'present' || rec?.p2StartStatus === 'present' || rec?.p2EndStatus === 'present');

      // Periods 1 and 2 must remain strictly independent; do not auto-copy presence between periods.
      continue;
    }

    // Multiple sessions on this date (e.g. Aula Teórica + Aula Prática)
    // Gather all students recorded or known on this day
    interface CandidateStudent {
      id?: string;
      ra?: string;
      cleanRa?: string;
      name?: string;
      originalKeys: Set<string>;
    }
    const studentCandidates: CandidateStudent[] = [];

    const getOrAddCandidate = (id?: string, ra?: string, name?: string, keyUsed?: string): CandidateStudent => {
      const cleanRa = normalizeStudentRa(ra);
      let found = studentCandidates.find(c => {
        if (id && c.id && c.id === id) return true;
        if (cleanRa && c.cleanRa && matchStudentRa(c.cleanRa, cleanRa)) return true;
        return false;
      });
      if (!found) {
        found = {
          id: id || undefined,
          ra: ra || undefined,
          cleanRa: cleanRa || undefined,
          name: name || undefined,
          originalKeys: new Set<string>()
        };
        studentCandidates.push(found);
      }
      if (id && !found.id) found.id = id;
      if (ra && !found.ra) found.ra = ra;
      if (cleanRa && !found.cleanRa) found.cleanRa = cleanRa;
      if (name && !found.name) found.name = name;
      if (keyUsed) found.originalKeys.add(keyUsed);
      return found;
    };

    // Scan day sessions to index all students who have checkins
    daySessions.forEach(s => {
      if (!s.attendance) return;
      Object.entries(s.attendance).forEach(([k, rec]: [string, any]) => {
        if (!rec) return;
        const stId = rec.studentId || rec.id || (!k.match(/^\d+$/) ? k : undefined);
        const stRa = rec.studentRa || rec.registrationNumber || rec.ra || (k.match(/^\d+$/) ? k : undefined);
        const stName = rec.studentName || rec.name;
        getOrAddCandidate(stId, stRa, stName, k);
      });
    });

    // Also include studentsList if provided and matching class
    if (Array.isArray(studentsList)) {
      studentsList.forEach(st => {
        getOrAddCandidate(st.id, st.registrationNumber, st.name);
      });
    }

    // For each student, check Period 1 and Period 2 attendance across all sessions of the day
    for (const candidate of studentCandidates) {
      let bestP1Status: 'present' | 'late' | 'excused' | 'absent' = 'absent';
      let bestP1Time: string | undefined;
      let bestP2Status: 'present' | 'late' | 'excused' | 'absent' = 'absent';
      let bestP2Time: string | undefined;
      let recordedStudentName = candidate.name;
      let recordedStudentRa = candidate.ra;
      let recordedStudentId = candidate.id;

      for (const s of daySessions) {
        const rec = getStudentAttendanceRecord(s.attendance, {
          id: candidate.id,
          registrationNumber: candidate.ra || candidate.cleanRa
        });
        if (!rec) continue;

        if (!recordedStudentName && rec.studentName) recordedStudentName = rec.studentName;
        if (!recordedStudentRa && (rec.studentRa || rec.registrationNumber)) recordedStudentRa = rec.studentRa || rec.registrationNumber;
        if (!recordedStudentId && (rec.studentId || rec.id)) recordedStudentId = rec.studentId || rec.id;

        // Check Period 1
        const isP1Pres = rec.period1Status === 'present' || rec.p1StartStatus === 'present' || rec.p1EndStatus === 'present';
        const isP1Late = rec.period1Status === 'late' || rec.p1StartStatus === 'late';
        const isP1Exc = rec.period1Status === 'excused';

        if (isP1Pres) {
          bestP1Status = 'present';
          bestP1Time = bestP1Time || rec.period1Timestamp || rec.p1StartTimestamp || rec.p1EndTimestamp || rec.timestamp;
        } else if (isP1Late && bestP1Status !== 'present') {
          bestP1Status = 'late';
          bestP1Time = bestP1Time || rec.period1Timestamp || rec.timestamp;
        } else if (isP1Exc && bestP1Status === 'absent') {
          bestP1Status = 'excused';
        }

        // Check Period 2
        const isP2Pres = rec.period2Status === 'present' || rec.p2StartStatus === 'present' || rec.p2EndStatus === 'present';
        const isP2Late = rec.period2Status === 'late' || rec.p2StartStatus === 'late';
        const isP2Exc = rec.period2Status === 'excused';

        if (isP2Pres) {
          bestP2Status = 'present';
          bestP2Time = bestP2Time || rec.period2Timestamp || rec.p2StartTimestamp || rec.p2EndTimestamp || rec.timestamp;
        } else if (isP2Late && bestP2Status !== 'present') {
          bestP2Status = 'late';
          bestP2Time = bestP2Time || rec.period2Timestamp || rec.timestamp;
        } else if (isP2Exc && bestP2Status === 'absent') {
          bestP2Status = 'excused';
        }
      }

      // If student attended at least one period on this date in ANY session:
      // Reconcile across all sessions on this date so they do NOT get absence in the other session
      if (bestP1Status !== 'absent' || bestP2Status !== 'absent') {
        for (const s of daySessions) {
          const currentAtt = newSessionsMap[s.id].attendance || {};
          const matchedKey = Object.keys(currentAtt).find(k => {
            if (candidate.originalKeys.has(k)) return true;
            if (candidate.id && k === candidate.id) return true;
            if (candidate.ra && (k === candidate.ra || matchStudentRa(k, candidate.ra))) return true;
            const item = currentAtt[k] as any;
            if (!item) return false;
            if (candidate.id && (item.studentId === candidate.id || item.id === candidate.id)) return true;
            if (candidate.cleanRa && matchStudentRa(item.studentRa || item.registrationNumber, candidate.cleanRa)) return true;
            return false;
          });

          const primaryKey = matchedKey || candidate.id || candidate.ra || Array.from(candidate.originalKeys)[0];
          if (!primaryKey) continue;

          const existingRecord = currentAtt[primaryKey];

          if (existingRecord) {
            let recordChanged = false;
            const updatedRec = { ...existingRecord };

            // Reconcile Period 1
            if (bestP1Status !== 'absent' && (updatedRec.period1Status === 'absent' || !updatedRec.period1Status)) {
              updatedRec.period1Status = bestP1Status;
              if (bestP1Status === 'present') {
                updatedRec.p1StartStatus = 'present';
                updatedRec.p1EndStatus = 'present';
              }
              if (bestP1Time && !updatedRec.period1Timestamp) {
                updatedRec.period1Timestamp = bestP1Time;
              }
              recordChanged = true;
            }

            // Reconcile Period 2
            if (bestP2Status !== 'absent' && (updatedRec.period2Status === 'absent' || !updatedRec.period2Status)) {
              updatedRec.period2Status = bestP2Status;
              if (bestP2Status === 'present') {
                updatedRec.p2StartStatus = 'present';
                updatedRec.p2EndStatus = 'present';
              }
              if (bestP2Time && !updatedRec.period2Timestamp) {
                updatedRec.period2Timestamp = bestP2Time;
              }
              recordChanged = true;
            }

            // Consolidate overall status
            if (updatedRec.period1Status === 'present' || updatedRec.period2Status === 'present') {
              if (updatedRec.status !== 'present') {
                updatedRec.status = 'present';
                recordChanged = true;
              }
            }

            if (recordChanged) {
              currentAtt[primaryKey] = updatedRec;
              hasChanges = true;
            }
          } else {
            // Student was present in another session today (e.g. Theory), cross-populate into Practice
            currentAtt[primaryKey] = {
              studentId: candidate.id || primaryKey,
              studentRa: candidate.ra || recordedStudentRa || primaryKey,
              studentName: candidate.name || recordedStudentName || 'Estudante',
              period1Status: bestP1Status,
              period2Status: bestP2Status,
              p1StartStatus: bestP1Status,
              p1EndStatus: bestP1Status,
              p2StartStatus: bestP2Status,
              p2EndStatus: bestP2Status,
              status: (bestP1Status === 'present' || bestP2Status === 'present') ? 'present' : (bestP1Status === 'late' || bestP2Status === 'late') ? 'late' : 'excused',
              timestamp: bestP1Time || bestP2Time || '08:00:00',
              period1Timestamp: bestP1Time,
              period2Timestamp: bestP2Time,
              checkinMethod: 'dynamic_qr',
              observation: 'Presença conciliada entre Teoria e Prática'
            };
            hasChanges = true;
          }
        }
      }
    }
  }

  return hasChanges ? Object.values(newSessionsMap) : sessionsList;
}

export function filterDeletedSessions(sessionsList: LabSession[], deletedIds: string[]): LabSession[] {
  if (!Array.isArray(sessionsList)) return [];
  const delSet = new Set(deletedIds || []);
  return sessionsList.filter(s => s && s.id && !delSet.has(s.id));
}

