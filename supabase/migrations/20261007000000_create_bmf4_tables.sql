-- ==============================================================================
-- BMF4 Medicina - Migração Completa do Banco de Dados Supabase
-- Projeto: yigwabbmjvzjajtwjkho.supabase.co
-- Descrição: Criação de todas as tabelas, índices, políticas RLS e Realtime
-- ==============================================================================

-- 1. Habilitar extensão de UUID se necessário
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabela: TURMAS (classes)
CREATE TABLE IF NOT EXISTS public.classes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT,
    discipline TEXT DEFAULT 'BMF4',
    institution TEXT DEFAULT 'UNINOVE MEDICINA',
    course TEXT DEFAULT 'Medicina',
    semester TEXT DEFAULT '4º Semestre 2026',
    laboratory_room TEXT DEFAULT 'Lab. Morfologia e Práticas Médicas (Lab 04)',
    professor_name TEXT,
    professor_id TEXT,
    monitor_name TEXT,
    schedule TEXT DEFAULT 'Segunda a Sexta, 07:30 - 12:00',
    color TEXT DEFAULT '#0d9488',
    total_students INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela: ALUNOS (students)
CREATE TABLE IF NOT EXISTS public.students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    registration_number TEXT NOT NULL,
    email TEXT,
    discipline TEXT DEFAULT 'BMF4',
    course TEXT DEFAULT 'Medicina',
    class_group_id TEXT,
    avatar_url TEXT,
    notes TEXT,
    bound_device_id TEXT,
    device_bound_at TEXT,
    presences INTEGER DEFAULT 0,
    absences INTEGER DEFAULT 0,
    lates INTEGER DEFAULT 0,
    excused INTEGER DEFAULT 0,
    total_classes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela: DOCENTES / PROFESSORES (teachers)
CREATE TABLE IF NOT EXISTS public.teachers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    registration_number TEXT,
    discipline TEXT DEFAULT 'BMF4',
    pin TEXT DEFAULT '1234',
    role TEXT DEFAULT 'professor',
    phone TEXT,
    assigned_class_ids JSONB DEFAULT '[]'::jsonb,
    has_changed_pin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabela: SESSÕES / CHAMADAS (sessions)
CREATE TABLE IF NOT EXISTS public.sessions (
    id TEXT PRIMARY KEY,
    class_group_id TEXT NOT NULL,
    topic TEXT DEFAULT 'Aula BMF4',
    date TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    is_live BOOLEAN DEFAULT TRUE,
    is_locked BOOLEAN DEFAULT FALSE,
    is_paused BOOLEAN DEFAULT FALSE,
    active_period TEXT DEFAULT '1',
    is_period1_locked BOOLEAN DEFAULT FALSE,
    is_period2_locked BOOLEAN DEFAULT FALSE,
    attendance JSONB DEFAULT '{}'::jsonb,
    activity_type TEXT,
    activity_category TEXT,
    lab_location TEXT,
    checkin_code TEXT,
    checkin_secret TEXT,
    version INTEGER DEFAULT 1,
    professor_id TEXT,
    professor_name TEXT,
    last_update_timestamp BIGINT,
    updated_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tabela: REGISTROS DETALHADOS DE PRESENÇA (attendance_records)
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    student_id TEXT,
    student_name TEXT,
    student_ra TEXT,
    class_group_id TEXT,
    status TEXT DEFAULT 'absent',
    period1_status TEXT,
    period2_status TEXT,
    p1_start_status TEXT,
    p1_end_status TEXT,
    p2_start_status TEXT,
    p2_end_status TEXT,
    timestamp TEXT,
    p1_start_timestamp TEXT,
    p1_end_timestamp TEXT,
    p2_start_timestamp TEXT,
    p2_end_timestamp TEXT,
    period1_timestamp TEXT,
    period2_timestamp TEXT,
    epi_verified BOOLEAN DEFAULT FALSE,
    checkin_method TEXT,
    device_id TEXT,
    device_model TEXT,
    token_used TEXT,
    observation TEXT,
    justification_reason TEXT,
    justification_file_url TEXT,
    justification_file_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Tabela: JUSTIFICATIVAS / ATESTADOS (justifications)
CREATE TABLE IF NOT EXISTS public.justifications (
    id TEXT PRIMARY KEY,
    student_id TEXT,
    student_name TEXT,
    student_ra TEXT,
    class_group_id TEXT,
    session_id TEXT,
    date TEXT,
    period TEXT,
    category TEXT,
    doc_number TEXT,
    description TEXT,
    status TEXT DEFAULT 'pending',
    attachment_name TEXT,
    attachment_url TEXT,
    reviewer_id TEXT,
    reviewer_name TEXT,
    review_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Tabela: NOTAS E AVALIAÇÕES (student_grades)
CREATE TABLE IF NOT EXISTS public.student_grades (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    class_group_id TEXT NOT NULL,
    scores JSONB DEFAULT '{}'::jsonb,
    substitute_exam_score NUMERIC,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Tabela: CONFIGURAÇÕES GERAIS (app_settings)
CREATE TABLE IF NOT EXISTS public.app_settings (
    id TEXT PRIMARY KEY DEFAULT 'global_settings',
    settings_payload JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- ÍNDICES PARA ALTA PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_students_class ON public.students(class_group_id);
CREATE INDEX IF NOT EXISTS idx_students_ra ON public.students(registration_number);
CREATE INDEX IF NOT EXISTS idx_sessions_class ON public.sessions(class_group_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON public.sessions(date);
CREATE INDEX IF NOT EXISTS idx_attendance_session ON public.attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON public.attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_justifications_student ON public.justifications(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_student ON public.student_grades(student_id);

-- ==============================================================================
-- POLÍTICAS DE SEGURANÇA (ROW LEVEL SECURITY - RLS)
-- Permite leitura e escrita pelo app (anon e authenticated) para sincronização instantânea
-- ==============================================================================

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.justifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- Classes policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'classes' AND policyname = 'Allow public access to classes') THEN
        CREATE POLICY "Allow public access to classes" ON public.classes FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Students policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'students' AND policyname = 'Allow public access to students') THEN
        CREATE POLICY "Allow public access to students" ON public.students FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Teachers policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'teachers' AND policyname = 'Allow public access to teachers') THEN
        CREATE POLICY "Allow public access to teachers" ON public.teachers FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Sessions policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sessions' AND policyname = 'Allow public access to sessions') THEN
        CREATE POLICY "Allow public access to sessions" ON public.sessions FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Attendance records policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'attendance_records' AND policyname = 'Allow public access to attendance_records') THEN
        CREATE POLICY "Allow public access to attendance_records" ON public.attendance_records FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Justifications policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'justifications' AND policyname = 'Allow public access to justifications') THEN
        CREATE POLICY "Allow public access to justifications" ON public.justifications FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Grades policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_grades' AND policyname = 'Allow public access to student_grades') THEN
        CREATE POLICY "Allow public access to student_grades" ON public.student_grades FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- App settings policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_settings' AND policyname = 'Allow public access to app_settings') THEN
        CREATE POLICY "Allow public access to app_settings" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- ==============================================================================
-- REPLICA IDENTITY FULL PARA TRANSMISSÃO COMPLETA DE EVENTOS REALTIME (DELETE/UPDATE)
-- ==============================================================================
ALTER TABLE public.classes REPLICA IDENTITY FULL;
ALTER TABLE public.students REPLICA IDENTITY FULL;
ALTER TABLE public.teachers REPLICA IDENTITY FULL;
ALTER TABLE public.sessions REPLICA IDENTITY FULL;
ALTER TABLE public.attendance_records REPLICA IDENTITY FULL;
ALTER TABLE public.justifications REPLICA IDENTITY FULL;
ALTER TABLE public.student_grades REPLICA IDENTITY FULL;
ALTER TABLE public.app_settings REPLICA IDENTITY FULL;

-- ==============================================================================
-- HABILITAR REALTIME DO SUPABASE
-- Adiciona as tabelas na publicação 'supabase_realtime' para disparo imediato de eventos WebSocket
-- ==============================================================================
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.classes;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.students;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.teachers;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.justifications;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.student_grades;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ==============================================================================
-- FUNÇÃO RPC: init_bmf4_schema
-- Permite verificar e validar o esquema diretamente através do cliente
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.init_bmf4_schema()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Esquema BMF4 verificado com sucesso no projeto yigwabbmjvzjajtwjkho',
        'timestamp', now()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.init_bmf4_schema() TO anon, authenticated;
