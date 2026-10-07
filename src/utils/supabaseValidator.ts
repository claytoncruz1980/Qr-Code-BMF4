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
  if (!copy.id || (typeof copy.id !== 'string' && typeof copy.id !== 'number')) {
    errors.push(`Missing or invalid 'id' field in table [${table}]`);
    copy.id = `fallback-${table}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  } else {
    copy.id = String(copy.id).trim();
  }

  // 2. Table-specific schema normalizations and property mappings
  switch (table) {
    case 'classes':
      copy.name = String(copy.name || '').trim() || 'Turma Sem Nome';
      copy.code = String(copy.code || copy.id).toUpperCase().trim();
      copy.discipline = String(copy.discipline || 'BMF4');
      copy.laboratory_room = String(copy.laboratory_room || copy.laboratoryRoom || 'Laboratório de Práticas');
      copy.total_students = Number(copy.total_students ?? copy.totalStudents ?? 0);
      copy.professor_id = copy.professor_id ? String(copy.professor_id) : (copy.professorId ? String(copy.professorId) : null);
      break;

    case 'students':
      copy.name = String(copy.name || '').trim() || 'Aluno(a) sem Nome';
      copy.registration_number = String(copy.registration_number || copy.registrationNumber || '').trim().toUpperCase();
      copy.class_group_id = String(copy.class_group_id || copy.classGroupId || 'class-default');
      copy.course = String(copy.course || 'Medicina');
      copy.discipline = String(copy.discipline || 'BMF4');
      copy.email = String(copy.email || `${copy.registration_number.toLowerCase()}@uni9.edu.br`);
      break;

    case 'teachers':
      copy.name = String(copy.name || '').trim() || 'Professor(a)';
      copy.email = String(copy.email || '').trim().toLowerCase();
      copy.role = String(copy.role || 'professor');
      copy.discipline = String(copy.discipline || 'BMF4');
      break;

    case 'sessions':
      copy.class_group_id = String(copy.class_group_id || copy.classGroupId || 'class-default');
      copy.date = String(copy.date || new Date().toISOString().split('T')[0]);
      copy.discipline = String(copy.discipline || 'BMF4');
      copy.is_live = Boolean(copy.is_live ?? copy.isLive ?? false);
      copy.is_locked = Boolean(copy.is_locked ?? copy.isLocked ?? false);
      copy.active_period = String(copy.active_period || copy.activePeriod || '1');
      break;

    case 'attendance_records':
      copy.session_id = String(copy.session_id || copy.sessionId || '');
      copy.student_id = String(copy.student_id || copy.studentId || '');
      copy.class_group_id = String(copy.class_group_id || copy.classGroupId || '');
      copy.status = String(copy.status || 'absent');
      copy.period1_status = copy.period1_status || copy.period1Status || null;
      copy.period2_status = copy.period2_status || copy.period2Status || null;
      copy.timestamp = copy.timestamp || new Date().toLocaleTimeString();
      copy.epi_verified = Boolean(copy.epi_verified ?? copy.epiVerified ?? false);
      copy.checkin_method = String(copy.checkin_method || copy.checkinMethod || 'manual');
      break;

    case 'justifications':
      copy.student_id = String(copy.student_id || copy.studentId || '');
      copy.student_name = String(copy.student_name || copy.studentName || 'Aluno');
      copy.student_ra = String(copy.student_ra || copy.studentRa || '');
      copy.class_group_id = String(copy.class_group_id || copy.classGroupId || '');
      copy.status = String(copy.status || 'pending');
      copy.date = String(copy.date || new Date().toISOString().split('T')[0]);
      copy.period = String(copy.period || 'both');
      copy.description = String(copy.description || '');
      copy.doc_number = copy.doc_number || copy.docNumber || copy.documentNumber || null;
      copy.attachment_name = copy.attachment_name || copy.attachmentName || null;
      copy.attachment_url = copy.attachment_url || copy.attachmentUrl || null;
      break;

    case 'student_grades':
      copy.student_id = String(copy.student_id || copy.studentId || '');
      copy.class_group_id = String(copy.class_group_id || copy.classGroupId || '');
      if (!copy.id || copy.id.startsWith('fallback-')) {
        copy.id = `${copy.student_id}_${copy.class_group_id}`;
      }
      copy.scores = copy.scores || {};
      copy.substitute_exam_score = copy.substitute_exam_score ?? copy.substituteExamScore ?? null;
      copy.notes = copy.notes || '';
      copy.updated_at = copy.updated_at || copy.updatedAt || new Date().toISOString();
      break;

    case 'app_settings':
      copy.id = copy.id || 'global_settings';
      copy.settings_payload = copy.settings_payload || copy.settingsPayload || copy;
      copy.updated_at = new Date().toISOString();
      break;

    default:
      break;
  }

  return {
    isValid: errors.length === 0,
    sanitizedRecord: copy as T,
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
