import { supabase } from '../lib/supabase';
import type { 
  Professor, 
  AttendanceRecord, 
  StudentBMF4Grades, 
  StudentGradeRecord,
  LabSession, 
  ClassGroup, 
  Student, 
  JustificationRequest 
} from '../types';

export interface SyncResponse<T = any> {
  success: boolean;
  data?: T;
  error?: any;
}

export interface AttendanceSyncInput {
  sessionId: string;
  studentId: string;
  studentName?: string;
  studentRa?: string;
  classGroupId?: string;
  status?: string;
  period1Status?: string;
  period2Status?: string;
  p1StartStatus?: string;
  p1EndStatus?: string;
  p2StartStatus?: string;
  p2EndStatus?: string;
  timestamp?: string;
  p1StartTimestamp?: string;
  p1EndTimestamp?: string;
  p2StartTimestamp?: string;
  p2EndTimestamp?: string;
  period1Timestamp?: string;
  period2Timestamp?: string;
  epiVerified?: boolean;
  checkinMethod?: string;
  deviceId?: string;
  deviceModel?: string;
  tokenUsed?: string;
  observation?: string;
  justificationReason?: string;
  justificationFileUrl?: string;
  justificationFileName?: string;
}

/**
 * Salva ou atualiza um professor na tabela 'teachers' do Supabase via upsert.
 */
export async function saveTeacher(
  teacher: Partial<Professor> & { id: string; name?: string; email?: string }
): Promise<SyncResponse> {
  try {
    if (!teacher || !teacher.id) {
      const err = new Error('ID do professor é obrigatório para sincronização.');
      console.error('❌ [syncService.saveTeacher] Erro de validação:', err.message);
      return { success: false, error: err.message };
    }

    const cleanName = String(teacher.name || 'Professor(a)').trim();
    const cleanEmail = teacher.email ? String(teacher.email).trim().toLowerCase() : '';

    const payload = {
      id: String(teacher.id).trim(),
      name: cleanName,
      email: cleanEmail,
      registration_number: teacher.registrationNumber || (teacher as any).registration_number || null,
      discipline: teacher.discipline || 'BMF4 - Bases Morfofuncionais 4',
      pin: teacher.pin || '1234',
      role: teacher.role || 'professor',
      phone: teacher.phone || null,
      assigned_class_ids: teacher.assignedClassIds || (teacher as any).assigned_class_ids || [],
      has_changed_pin: Boolean(teacher.hasChangedPin ?? (teacher as any).has_changed_pin ?? false),
      created_at: (teacher as any).created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('teachers')
      .upsert(payload, { onConflict: 'id' })
      .select();

    if (error) {
      console.error('❌ [syncService.saveTeacher] Erro ao sincronizar professor no Supabase:', error.message, error);
      return { success: false, error };
    }

    console.log(`✅ [syncService.saveTeacher] Professor "${cleanName}" (${payload.id}) salvo com sucesso no Supabase!`);
    return { success: true, data };
  } catch (err: any) {
    console.error('❌ [syncService.saveTeacher] Exceção ao salvar professor:', err?.message || err);
    return { success: false, error: err };
  }
}/**
 * Remove um professor da tabela 'teachers' do Supabase via ID.
 */
export async function deleteTeacher(id: string): Promise<SyncResponse> {
  try {
    if (!id) {
      const err = new Error('ID do professor é obrigatório para exclusão.');
      console.error('❌ [syncService.deleteTeacher] Erro de validação:', err.message);
      return { success: false, error: err.message };
    }

    const { error } = await supabase
      .from('teachers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ [syncService.deleteTeacher] Erro ao excluir professor no Supabase:', error);
      return { success: false, error };
    }

    console.log(`🗑️ [syncService.deleteTeacher] Professor ID "${id}" excluído com sucesso do Supabase.`);
    return { success: true };
  } catch (err: any) {
    console.error('❌ [syncService.deleteTeacher] Exceção ao excluir professor:', err?.message || err);
    return { success: false, error: err };
  }
}

/**
 * Salva ou atualiza um registro de presença na tabela 'attendance_records' do Supabase via upsert.
 * Aceita tanto payload estruturado quanto argumentos posicionais.
 */
export async function updateAttendance(
  arg1: AttendanceSyncInput | string,
  arg2?: string | (Partial<AttendanceRecord> & { studentName?: string; studentRa?: string; classGroupId?: string }),
  arg3?: Partial<AttendanceRecord> & { studentName?: string; studentRa?: string; classGroupId?: string }
): Promise<SyncResponse> {
  try {
    let sessionId = '';
    let studentId = '';
    let recordData: any = {};

    if (typeof arg1 === 'object' && arg1 !== null) {
      sessionId = arg1.sessionId || (arg1 as any).session_id || '';
      studentId = arg1.studentId || (arg1 as any).student_id || '';
      recordData = arg1;
    } else if (typeof arg1 === 'string' && typeof arg2 === 'string') {
      sessionId = arg1;
      studentId = arg2;
      recordData = arg3 || {};
    } else if (typeof arg1 === 'string' && typeof arg2 === 'object' && arg2 !== null) {
      sessionId = arg1;
      studentId = (arg2 as any).studentId || (arg2 as any).student_id || '';
      recordData = arg2;
    }

    if (!studentId) {
      const err = new Error('studentId é obrigatório para registrar presença.');
      console.error('❌ [syncService.updateAttendance] Erro de validação:', err.message);
      return { success: false, error: err.message };
    }

    const recordId = recordData.id || `${sessionId || 'global'}_${studentId}`;

    const payload = {
      id: recordId,
      session_id: sessionId || null,
      student_id: studentId,
      student_name: recordData.studentName || recordData.student_name || null,
      student_ra: recordData.studentRa || recordData.student_ra || null,
      class_group_id: recordData.classGroupId || recordData.class_group_id || null,
      status: String(recordData.status || 'absent'),
      period1_status: recordData.period1Status || recordData.period1_status || null,
      period2_status: recordData.period2Status || recordData.period2_status || null,
      p1_start_status: recordData.p1StartStatus || recordData.p1_start_status || null,
      p1_end_status: recordData.p1EndStatus || recordData.p1_end_status || null,
      p2_start_status: recordData.p2StartStatus || recordData.p2_start_status || null,
      p2_end_status: recordData.p2EndStatus || recordData.p2_end_status || null,
      timestamp: recordData.timestamp || null,
      p1_start_timestamp: recordData.p1StartTimestamp || recordData.p1_start_timestamp || null,
      p1_end_timestamp: recordData.p1EndTimestamp || recordData.p1_end_timestamp || null,
      p2_start_timestamp: recordData.p2StartTimestamp || recordData.p2_start_timestamp || null,
      p2_end_timestamp: recordData.p2EndTimestamp || recordData.p2_end_timestamp || null,
      period1_timestamp: recordData.period1Timestamp || recordData.period1_timestamp || null,
      period2_timestamp: recordData.period2Timestamp || recordData.period2_timestamp || null,
      epi_verified: Boolean(recordData.epiVerified ?? recordData.epi_verified ?? false),
      checkin_method: recordData.checkinMethod || recordData.checkin_method || 'manual',
      device_id: recordData.deviceId || recordData.device_id || null,
      device_model: recordData.deviceModel || recordData.device_model || null,
      token_used: recordData.tokenUsed || recordData.token_used || null,
      observation: recordData.observation || null,
      justification_reason: recordData.justificationReason || recordData.justification_reason || null,
      justification_file_url: recordData.justificationFileUrl || recordData.justification_file_url || null,
      justification_file_name: recordData.justificationFileName || recordData.justification_file_name || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('attendance_records')
      .upsert(payload, { onConflict: 'id' })
      .select();

    if (error) {
      console.error('❌ [syncService.updateAttendance] Erro ao salvar presença no Supabase:', error.message, error);
      return { success: false, error };
    }

    console.log(`✅ [syncService.updateAttendance] Presença (${recordId}) salva com sucesso no Supabase!`);
    return { success: true, data };
  } catch (err: any) {
    console.error('❌ [syncService.updateAttendance] Exceção ao atualizar presença:', err?.message || err);
    return { success: false, error: err };
  }
}

/**
 * Salva ou atualiza as notas de um estudante na tabela 'student_grades' do Supabase via upsert.
 */
export async function saveStudentGrade(
  arg1: StudentBMF4Grades | StudentGradeRecord | { studentId: string; classGroupId: string; scores?: any; substituteExamScore?: number | null; notes?: string },
  arg2?: string,
  arg3?: Record<string, any>,
  options?: { substituteExamScore?: number | null; notes?: string }
): Promise<SyncResponse> {
  try {
    let studentId = '';
    let classGroupId = '';
    let scores: Record<string, any> = {};
    let substituteExamScore: number | null = null;
    let notes: string | null = null;

    if (typeof arg1 === 'string' && typeof arg2 === 'string') {
      studentId = arg1;
      classGroupId = arg2;
      scores = arg3 || {};
      substituteExamScore = options?.substituteExamScore ?? null;
      notes = options?.notes || null;
    } else if (typeof arg1 === 'object' && arg1 !== null) {
      studentId = arg1.studentId || (arg1 as any).student_id || '';
      classGroupId = arg1.classGroupId || (arg1 as any).class_group_id || '';
      
      if ('scores' in arg1 && typeof (arg1 as any).scores === 'object') {
        scores = (arg1 as any).scores || {};
      } else {
        // Objeto StudentBMF4Grades direto (t1, t2, ..., a1, ..., h1)
        const gradeObj: any = arg1;
        ['t1','t2','t3','t4','t5','a1','a2','a3','a4','a5','h1','h2','h3','h4','h5'].forEach(key => {
          if (key in gradeObj && gradeObj[key] !== undefined) {
            scores[key] = gradeObj[key];
          }
        });
      }

      substituteExamScore = (arg1 as any).substituteExamScore ?? (arg1 as any).substitute_exam_score ?? null;
      notes = (arg1 as any).notes || null;
    }

    if (!studentId || !classGroupId) {
      const err = new Error('studentId e classGroupId são obrigatórios para registrar notas.');
      console.error('❌ [syncService.saveStudentGrade] Erro de validação:', err.message);
      return { success: false, error: err.message };
    }

    const gradeId = `${studentId}_${classGroupId}`;

    const payload = {
      id: gradeId,
      student_id: studentId,
      class_group_id: classGroupId,
      scores,
      substitute_exam_score: substituteExamScore,
      notes,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('student_grades')
      .upsert(payload, { onConflict: 'id' })
      .select();

    if (error) {
      console.error('❌ [syncService.saveStudentGrade] Erro ao salvar notas no Supabase:', error.message, error);
      return { success: false, error };
    }

    console.log(`✅ [syncService.saveStudentGrade] Notas do aluno (${gradeId}) salvas com sucesso no Supabase!`);
    return { success: true, data };
  } catch (err: any) {
    console.error('❌ [syncService.saveStudentGrade] Exceção ao salvar nota:', err?.message || err);
    return { success: false, error: err };
  }
}

/**
 * Salva ou atualiza uma sessão de chamada na tabela 'sessions' do Supabase via upsert.
 */
export async function saveSession(session: Partial<LabSession> & { id: string; classGroupId?: string }): Promise<SyncResponse> {
  try {
    if (!session || !session.id) {
      const err = new Error('ID da sessão é obrigatório.');
      console.error('❌ [syncService.saveSession] Erro de validação:', err.message);
      return { success: false, error: err.message };
    }

    const payload = {
      id: session.id,
      class_group_id: session.classGroupId || (session as any).class_group_id || 'class-default',
      topic: session.topic || 'Aula BMF4',
      date: session.date || new Date().toISOString().split('T')[0],
      start_time: session.startTime || (session as any).start_time || null,
      end_time: session.endTime || (session as any).end_time || null,
      is_live: Boolean(session.isLive ?? (session as any).is_live ?? true),
      is_locked: Boolean(session.isLocked ?? (session as any).is_locked ?? false),
      is_paused: Boolean(session.isPaused ?? (session as any).is_paused ?? false),
      active_period: session.activePeriod || (session as any).active_period || '1',
      is_period1_locked: Boolean(session.isPeriod1Locked ?? (session as any).is_period1_locked ?? false),
      is_period2_locked: Boolean(session.isPeriod2Locked ?? (session as any).is_period2_locked ?? false),
      attendance: session.attendance || {},
      activity_type: session.activityType || (session as any).activity_type || null,
      activity_category: session.activityCategory || (session as any).activity_category || null,
      lab_location: session.labLocation || (session as any).lab_location || null,
      checkin_code: session.checkinCode || (session as any).checkin_code || null,
      version: Number(session.version ?? 1),
      professor_id: session.professorId || (session as any).professor_id || null,
      professor_name: session.professorName || (session as any).professor_name || null,
      last_update_timestamp: session.lastUpdateTimestamp || (session as any).last_update_timestamp || Date.now(),
      updated_by: (session as any).updatedBy || (session as any).updated_by || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('sessions')
      .upsert(payload, { onConflict: 'id' })
      .select();

    if (error) {
      console.error('❌ [syncService.saveSession] Erro ao salvar sessão no Supabase:', error.message, error);
      return { success: false, error };
    }

    console.log(`✅ [syncService.saveSession] Sessão (${session.id}) salva com sucesso no Supabase!`);
    return { success: true, data };
  } catch (err: any) {
    console.error('❌ [syncService.saveSession] Exceção ao salvar sessão:', err?.message || err);
    return { success: false, error: err };
  }
}

/**
 * Salva ou atualiza uma turma na tabela 'classes' do Supabase via upsert.
 */
export async function saveClass(classGroup: Partial<ClassGroup> & { id: string; name?: string }): Promise<SyncResponse> {
  try {
    if (!classGroup || !classGroup.id) {
      const err = new Error('ID da turma é obrigatório.');
      console.error('❌ [syncService.saveClass] Erro de validação:', err.message);
      return { success: false, error: err.message };
    }

    const payload = {
      id: classGroup.id,
      name: classGroup.name || 'Nova Turma',
      code: classGroup.code || 'BMF4',
      discipline: classGroup.discipline || 'BMF4 - Bases Morfofuncionais 4',
      institution: classGroup.institution || 'UNINOVE MEDICINA',
      course: classGroup.course || 'Medicina',
      semester: classGroup.semester || '4º Semestre 2026',
      laboratory_room: classGroup.laboratoryRoom || (classGroup as any).laboratory_room || 'Lab. Morfologia',
      professor_name: classGroup.professorName || (classGroup as any).professor_name || null,
      professor_id: classGroup.professorId || (classGroup as any).professor_id || null,
      monitor_name: classGroup.monitorName || (classGroup as any).monitor_name || null,
      schedule: classGroup.schedule || 'Segunda a Sexta, 07:30 - 12:00',
      color: classGroup.color || '#0d9488',
      total_students: Number(classGroup.totalStudents ?? (classGroup as any).total_students ?? 0),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('classes')
      .upsert(payload, { onConflict: 'id' })
      .select();

    if (error) {
      console.error('❌ [syncService.saveClass] Erro ao salvar turma no Supabase:', error.message, error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error('❌ [syncService.saveClass] Exceção ao salvar turma:', err?.message || err);
    return { success: false, error: err };
  }
}

/**
 * Remove uma turma da tabela 'classes' do Supabase via ID.
 */
export async function deleteClass(id: string): Promise<SyncResponse> {
  try {
    if (!id) {
      const err = new Error('ID da turma é obrigatório para exclusão.');
      console.error('❌ [syncService.deleteClass] Erro de validação:', err.message);
      return { success: false, error: err.message };
    }

    const { error } = await supabase
      .from('classes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ [syncService.deleteClass] Erro ao excluir turma no Supabase:', error);
      return { success: false, error };
    }

    console.log(`🗑️ [syncService.deleteClass] Turma ID "${id}" excluída com sucesso do Supabase.`);
    return { success: true };
  } catch (err: any) {
    console.error('❌ [syncService.deleteClass] Exceção ao excluir turma:', err?.message || err);
    return { success: false, error: err };
  }
}

/**
 * Salva ou atualiza um aluno na tabela 'students' do Supabase via upsert.
 */
export async function saveStudent(student: Partial<Student> & { id: string; name?: string; registrationNumber?: string }): Promise<SyncResponse> {
  try {
    if (!student || !student.id) {
      const err = new Error('ID do aluno é obrigatório.');
      console.error('❌ [syncService.saveStudent] Erro de validação:', err.message);
      return { success: false, error: err.message };
    }

    const regNum = String(student.registrationNumber || (student as any).registration_number || '').trim().toUpperCase();
    const payload = {
      id: student.id,
      name: String(student.name || 'Aluno(a)').trim(),
      registration_number: regNum,
      email: String(student.email || `${regNum.toLowerCase() || 'aluno'}@uni9.edu.br`),
      discipline: student.discipline || 'BMF4',
      course: student.course || 'Medicina',
      class_group_id: student.classGroupId || (student as any).class_group_id || 'class-default',
      avatar_url: student.avatarUrl || (student as any).avatar_url || null,
      notes: student.notes || null,
      bound_device_id: student.boundDeviceId || (student as any).bound_device_id || null,
      device_bound_at: student.deviceBoundAt || (student as any).device_bound_at || null,
      presences: Number(student.presences ?? 0),
      absences: Number(student.absences ?? 0),
      lates: Number(student.lates ?? 0),
      excused: Number(student.excused ?? 0),
      total_classes: Number(student.totalClasses ?? (student as any).total_classes ?? 0),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('students')
      .upsert(payload, { onConflict: 'id' })
      .select();

    if (error) {
      console.error('❌ [syncService.saveStudent] Erro ao salvar aluno no Supabase:', error.message, error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error('❌ [syncService.saveStudent] Exceção ao salvar aluno:', err?.message || err);
    return { success: false, error: err };
  }
}

/**
 * Salva ou atualiza uma justificativa/atestado na tabela 'justifications' do Supabase via upsert.
 */
export async function saveJustification(just: Partial<JustificationRequest> & { id: string }): Promise<SyncResponse> {
  try {
    if (!just || !just.id) {
      const err = new Error('ID da justificativa é obrigatório.');
      console.error('❌ [syncService.saveJustification] Erro de validação:', err.message);
      return { success: false, error: err.message };
    }

    const payload = {
      id: just.id,
      student_id: just.studentId || (just as any).student_id || '',
      student_name: just.studentName || (just as any).student_name || null,
      student_ra: just.studentRa || (just as any).student_ra || null,
      class_group_id: just.classGroupId || (just as any).class_group_id || null,
      session_id: just.sessionId || (just as any).session_id || null,
      date: just.sessionDate || (just as any).date || new Date().toISOString().split('T')[0],
      period: just.period || 'both',
      category: just.reason || (just as any).category || 'medical',
      doc_number: just.documentNumber || (just as any).doc_number || null,
      description: just.description || '',
      status: just.status || 'pending',
      attachment_name: just.attachmentName || (just as any).attachment_name || null,
      attachment_url: just.attachmentUrl || (just as any).attachment_url || null,
      reviewer_id: (just as any).reviewer_id || null,
      reviewer_name: just.reviewedBy || (just as any).reviewer_name || null,
      review_notes: (just as any).review_notes || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('justifications')
      .upsert(payload, { onConflict: 'id' })
      .select();

    if (error) {
      console.error('❌ [syncService.saveJustification] Erro ao salvar justificativa no Supabase:', error.message, error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error('❌ [syncService.saveJustification] Exceção ao salvar justificativa:', err?.message || err);
    return { success: false, error: err };
  }
}
