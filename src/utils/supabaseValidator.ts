/**
 * Supabase Data Validation & Schema Consistency Utility
 * Ensures all records have valid string IDs and correct column structures 
 * before writing to Supabase tables, preventing schema conflicts.
 */

export interface ValidationResult<T> {
  isValid: boolean;
  sanitizedRecord: T;
  errors: string[];
}

export const validateAndSanitizeRecord = <T extends Record<string, any>>(
  table: string,
  record: T
): ValidationResult<T> => {
  const errors: string[] = [];
  if (!record || typeof record !== 'object') {
    return {
      isValid: false,
      sanitizedRecord: record,
      errors: ['Record is null or not a valid object'],
    };
  }

  const copy = { ...record } as any;

  // 1. Ensure ID is a valid non-empty string
  let id = copy.id;
  if (!id || (typeof id !== 'string' && typeof id !== 'number')) {
    errors.push(`Missing or invalid 'id' field in table [${table}]`);
    id = `fallback-${table}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  } else {
    id = String(id).trim();
  }

  let sanitized: any = { id };

  // 2. Table-specific schema normalizations and property mappings (pure DB columns)
  switch (table) {
    case 'classes': {
      sanitized = {
        id,
        name: String(copy.name || '').trim() || 'Turma Sem Nome',
        code: String(copy.code || id).toUpperCase().trim(),
        discipline: String(copy.discipline || 'BMF4'),
        institution: String(copy.institution || 'UNINOVE MEDICINA'),
        course: String(copy.course || 'Medicina'),
        semester: String(copy.semester || '4º Semestre 2026'),
        laboratory_room: String(copy.laboratory_room || copy.laboratoryRoom || 'Laboratório de Práticas'),
        professor_name: copy.professor_name || copy.professorName || null,
        professor_id: copy.professor_id ? String(copy.professor_id) : (copy.professorId ? String(copy.professorId) : null),
        monitor_name: copy.monitor_name || copy.monitorName || null,
        schedule: String(copy.schedule || 'Segunda a Sexta, 07:30 - 12:00'),
        color: String(copy.color || '#0d9488'),
        total_students: Number(copy.total_students ?? copy.totalStudents ?? 0),
      };
      break;
    }

    case 'students': {
      const regNum = String(copy.registration_number || copy.registrationNumber || '').trim().toUpperCase();
      sanitized = {
        id,
        name: String(copy.name || '').trim() || 'Aluno(a) sem Nome',
        registration_number: regNum,
        email: String(copy.email || `${regNum.toLowerCase() || 'aluno'}@uni9.edu.br`),
        discipline: String(copy.discipline || 'BMF4'),
        course: String(copy.course || 'Medicina'),
        class_group_id: String(copy.class_group_id || copy.classGroupId || 'class-default'),
        avatar_url: copy.avatar_url || copy.avatar || copy.avatarUrl || null,
        notes: copy.notes || null,
        bound_device_id: copy.bound_device_id || copy.boundDeviceId || null,
        device_bound_at: copy.device_bound_at || copy.deviceBoundAt || null,
        presences: Number(copy.presences ?? 0),
        absences: Number(copy.absences ?? 0),
        lates: Number(copy.lates ?? 0),
        excused: Number(copy.excused ?? 0),
        total_classes: Number(copy.total_classes ?? copy.totalClasses ?? 0),
      };
      break;
    }

    case 'teachers': {
      sanitized = {
        id,
        name: String(copy.name || '').trim() || 'Professor(a)',
        email: copy.email ? String(copy.email).trim().toLowerCase() : '',
        registration_number: copy.registration_number || copy.registrationNumber || null,
        discipline: String(copy.discipline || 'BMF4 - Bases Morfofuncionais 4'),
        pin: String(copy.pin || '1234'),
        role: String(copy.role || 'professor'),
        phone: copy.phone || null,
        assigned_class_ids: copy.assigned_class_ids || copy.assignedClassIds || [],
        has_changed_pin: Boolean(copy.has_changed_pin ?? copy.hasChangedPin ?? false),
        created_at: copy.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      break;
    }

    case 'sessions': {
      sanitized = {
        id,
        class_group_id: String(copy.class_group_id || copy.classGroupId || 'class-default'),
        topic: String(copy.topic || 'Aula BMF4'),
        date: String(copy.date || new Date().toISOString().split('T')[0]),
        start_time: copy.start_time || copy.startTime || null,
        end_time: copy.end_time || copy.endTime || null,
        is_live: Boolean(copy.is_live ?? copy.isLive ?? true),
        is_locked: Boolean(copy.is_locked ?? copy.isLocked ?? false),
        is_paused: Boolean(copy.is_paused ?? copy.isPaused ?? false),
        active_period: String(copy.active_period || copy.activePeriod || '1'),
        is_period1_locked: Boolean(copy.is_period1_locked ?? copy.isPeriod1Locked ?? false),
        is_period2_locked: Boolean(copy.is_period2_locked ?? copy.isPeriod2Locked ?? false),
        attendance: copy.attendance || {},
        activity_type: copy.activity_type || copy.activityType || null,
        activity_category: copy.activity_category || copy.activityCategory || null,
        lab_location: copy.lab_location || copy.labLocation || null,
        checkin_code: copy.checkin_code || copy.checkinCode || null,
        checkin_secret: copy.checkin_secret || copy.checkinSecret || null,
        version: Number(copy.version ?? 1),
        professor_id: copy.professor_id || copy.professorId || null,
        professor_name: copy.professor_name || copy.professorName || null,
        last_update_timestamp: copy.last_update_timestamp || copy.lastUpdateTimestamp || null,
        updated_by: copy.updated_by || copy.updatedBy || null,
      };
      break;
    }

    case 'attendance_records': {
      sanitized = {
        id,
        session_id: String(copy.session_id || copy.sessionId || ''),
        student_id: String(copy.student_id || copy.studentId || ''),
        student_name: copy.student_name || copy.studentName || null,
        student_ra: copy.student_ra || copy.studentRa || null,
        class_group_id: copy.class_group_id || copy.classGroupId || null,
        status: String(copy.status || 'absent'),
        period1_status: copy.period1_status || copy.period1Status || null,
        period2_status: copy.period2_status || copy.period2Status || null,
        p1_start_status: copy.p1_start_status || copy.p1StartStatus || null,
        p1_end_status: copy.p1_end_status || copy.p1EndStatus || null,
        p2_start_status: copy.p2_start_status || copy.p2StartStatus || null,
        p2_end_status: copy.p2_end_status || copy.p2EndStatus || null,
        timestamp: copy.timestamp || null,
        p1_start_timestamp: copy.p1_start_timestamp || copy.p1StartTimestamp || null,
        p1_end_timestamp: copy.p1_end_timestamp || copy.p1EndTimestamp || null,
        p2_start_timestamp: copy.p2_start_timestamp || copy.p2StartTimestamp || null,
        p2_end_timestamp: copy.p2_end_timestamp || copy.p2EndTimestamp || null,
        period1_timestamp: copy.period1_timestamp || copy.period1Timestamp || null,
        period2_timestamp: copy.period2_timestamp || copy.period2Timestamp || null,
        epi_verified: Boolean(copy.epi_verified ?? copy.epiVerified ?? false),
        checkin_method: copy.checkin_method || copy.checkinMethod || null,
        device_id: copy.device_id || copy.deviceId || null,
        device_model: copy.device_model || copy.deviceModel || null,
        token_used: copy.token_used || copy.tokenUsed || null,
        observation: copy.observation || null,
        justification_reason: copy.justification_reason || copy.justificationReason || null,
        justification_file_url: copy.justification_file_url || copy.justificationFileUrl || null,
        justification_file_name: copy.justification_file_name || copy.justificationFileName || null,
      };
      break;
    }

    case 'justifications': {
      sanitized = {
        id,
        student_id: String(copy.student_id || copy.studentId || ''),
        student_name: copy.student_name || copy.studentName || null,
        student_ra: copy.student_ra || copy.studentRa || null,
        class_group_id: copy.class_group_id || copy.classGroupId || null,
        session_id: copy.session_id || copy.sessionId || null,
        date: String(copy.date || new Date().toISOString().split('T')[0]),
        period: String(copy.period || 'both'),
        category: copy.category || copy.reason || 'medical',
        doc_number: copy.doc_number || copy.docNumber || copy.documentNumber || null,
        description: copy.description || '',
        status: String(copy.status || 'pending'),
        attachment_name: copy.attachment_name || copy.attachmentName || null,
        attachment_url: copy.attachment_url || copy.attachmentUrl || null,
        reviewer_id: copy.reviewer_id || copy.reviewerId || null,
        reviewer_name: copy.reviewer_name || copy.reviewerName || null,
        review_notes: copy.review_notes || copy.reviewNotes || null,
      };
      break;
    }

    case 'student_grades': {
      const studentId = String(copy.student_id || copy.studentId || '');
      const classGroupId = String(copy.class_group_id || copy.classGroupId || '');
      const gradeId = (!id || id.startsWith('fallback-')) ? `${studentId}_${classGroupId}` : id;
      sanitized = {
        id: gradeId,
        student_id: studentId,
        class_group_id: classGroupId,
        scores: copy.scores || {},
        substitute_exam_score: copy.substitute_exam_score ?? copy.substituteExamScore ?? null,
        notes: copy.notes || null,
      };
      break;
    }

    case 'app_settings': {
      sanitized = {
        id: id || 'global_settings',
        settings_payload: copy.settings_payload || copy.settingsPayload || copy,
      };
      break;
    }

    default:
      sanitized = copy;
      break;
  }

  return {
    isValid: errors.length === 0,
    sanitizedRecord: sanitized as T,
    errors,
  };
};

export const validateAndSanitizeBatch = <T extends Record<string, any>>(
  table: string,
  records: T[]
): T[] => {
  if (!Array.isArray(records)) return [];
  return records.map(r => {
    const result = validateAndSanitizeRecord(table, r);
    if (!result.isValid) {
      console.warn(`⚠️ [Supabase Validation Warning] Table [${table}]:`, result.errors);
    }
    return result.sanitizedRecord;
  });
};
