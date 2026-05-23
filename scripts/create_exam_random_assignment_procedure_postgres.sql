-- =========================================================
-- Procedure/Function: tạo đăng ký + random đề + tạo assignment
--
-- Hàm này chạy trong 1 transaction của PostgreSQL function.
-- Đầu ra: registration_id, assignment_id, selected_set_id
-- =========================================================

CREATE OR REPLACE FUNCTION assign_random_set_on_registration(
  p_teacher_code VARCHAR,
  p_exam_type exam_type_enum,
  p_registration_type registration_type_enum,
  p_block_code VARCHAR,
  p_subject_code VARCHAR,
  p_center_code VARCHAR,
  p_scheduled_at TIMESTAMP,
  p_source_form VARCHAR,
  p_open_at TIMESTAMP,
  p_close_at TIMESTAMP,
  p_random_seed VARCHAR DEFAULT NULL
)
RETURNS TABLE (
  registration_id BIGINT,
  assignment_id BIGINT,
  selected_set_id BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_subject_id BIGINT;
  v_set_id BIGINT;
  v_set_duration_minutes INTEGER;
  v_subject_duration_minutes INTEGER;
  v_effective_duration_minutes INTEGER;
  v_selection_mode VARCHAR;
  v_default_set_id BIGINT;
  v_registration_id BIGINT;
  v_assignment_id BIGINT;
BEGIN
  -- Validate input
  IF p_teacher_code IS NULL OR TRIM(p_teacher_code) = '' THEN
    RAISE EXCEPTION 'teacher_code is required';
  END IF;

  IF p_source_form NOT IN ('main_form', 'additional_form', 'system') THEN
    RAISE EXCEPTION 'source_form must be one of: main_form, additional_form, system';
  END IF;

  -- Validate teacher exists
  PERFORM 1
  FROM training_teacher_stats t
  WHERE LOWER(TRIM(t.teacher_code)) = LOWER(TRIM(p_teacher_code));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Teacher code not found in training_teacher_stats: %', p_teacher_code;
  END IF;

  -- Find active subject catalog row
  -- Find active subject config row (subject-driven model)
  SELECT csm.id,
         csm.set_selection_mode,
         csm.default_set_id,
         csm.exam_duration_minutes
    INTO v_subject_id, v_selection_mode, v_default_set_id, v_subject_duration_minutes
  FROM chuyen_sau_monhoc csm
  WHERE csm.exam_type = p_exam_type::TEXT
    AND csm.block_code = p_block_code
    AND csm.subject_code = p_subject_code
    AND csm.is_active = TRUE
  LIMIT 1;

  IF v_subject_id IS NULL THEN
    RAISE EXCEPTION 'No active subject config found for exam_type=%, block_code=%, subject_code=%',
      p_exam_type, p_block_code, p_subject_code;
  END IF;

  -- Default mode: try subject default set first (must be eligible and have questions)
  IF COALESCE(v_selection_mode, 'default') = 'default' AND v_default_set_id IS NOT NULL THEN
    SELECT es.id, es.duration_minutes
      INTO v_set_id, v_set_duration_minutes
    FROM chuyen_sau_bode es
    WHERE es.id = v_default_set_id
      AND es.subject_id = v_subject_id
      AND es.status = 'active'
      AND (es.valid_from IS NULL OR p_scheduled_at >= es.valid_from)
      AND (es.valid_to IS NULL OR p_scheduled_at <= es.valid_to)
      AND EXISTS (
        SELECT 1
        FROM chuyen_sau_bode_cauhoi map
        WHERE map.set_id = es.id
      )
    LIMIT 1;
  END IF;

  -- Random mode OR fallback when default set is not eligible.
  IF v_set_id IS NULL THEN
    IF p_random_seed IS NULL OR TRIM(p_random_seed) = '' THEN
      SELECT es.id, es.duration_minutes
        INTO v_set_id, v_set_duration_minutes
      FROM chuyen_sau_bode es
      WHERE es.subject_id = v_subject_id
        AND es.status = 'active'
        AND (es.valid_from IS NULL OR p_scheduled_at >= es.valid_from)
        AND (es.valid_to IS NULL OR p_scheduled_at <= es.valid_to)
        AND EXISTS (
          SELECT 1
          FROM chuyen_sau_bode_cauhoi map
          WHERE map.set_id = es.id
        )
      ORDER BY RANDOM()
      LIMIT 1;
    ELSE
      SELECT es.id, es.duration_minutes
        INTO v_set_id, v_set_duration_minutes
      FROM chuyen_sau_bode es
      WHERE es.subject_id = v_subject_id
        AND es.status = 'active'
        AND (es.valid_from IS NULL OR p_scheduled_at >= es.valid_from)
        AND (es.valid_to IS NULL OR p_scheduled_at <= es.valid_to)
        AND EXISTS (
          SELECT 1
          FROM chuyen_sau_bode_cauhoi map
          WHERE map.set_id = es.id
        )
      ORDER BY md5(es.id::text || p_random_seed)
      LIMIT 1;
    END IF;
  END IF;

  v_effective_duration_minutes := GREATEST(1, COALESCE(v_subject_duration_minutes, v_set_duration_minutes, 45));

  IF p_open_at IS NULL THEN
    p_open_at := p_scheduled_at;
  END IF;

  -- Always persist close_at from configured duration to keep timeline consistent.
  p_close_at := p_open_at + make_interval(mins => v_effective_duration_minutes);

  IF p_close_at <= p_open_at THEN
    RAISE EXCEPTION 'close_at must be greater than open_at';
  END IF;

  IF v_set_id IS NULL THEN
    RAISE EXCEPTION 'No active/valid exam set with questions available for subject_id=% at scheduled_at=%',
      v_subject_id, p_scheduled_at;
  END IF;

  -- Create registration
  INSERT INTO exam_registrations (
    teacher_code,
    exam_type,
    registration_type,
    block_code,
    subject_code,
    center_code,
    scheduled_at,
    source_form
  ) VALUES (
    p_teacher_code,
    p_exam_type,
    p_registration_type,
    p_block_code,
    p_subject_code,
    p_center_code,
    p_scheduled_at,
    p_source_form
  )
  RETURNING id INTO v_registration_id;

  -- Create assignment mapped to random set
  INSERT INTO teacher_exam_assignments (
    registration_id,
    teacher_code,
    exam_type,
    registration_type,
    block_code,
    subject_code,
    selected_set_id,
    random_seed,
    random_assigned_at,
    open_at,
    close_at,
    assignment_status,
    score,
    score_status,
    expired_at
  ) VALUES (
    v_registration_id,
    p_teacher_code,
    p_exam_type,
    p_registration_type,
    p_block_code,
    p_subject_code,
    v_set_id,
    p_random_seed,
    CURRENT_TIMESTAMP,
    p_open_at,
    p_close_at,
    'assigned',
    NULL,
    'null',
    NULL
  )
  RETURNING id INTO v_assignment_id;

  -- Event log
  INSERT INTO exam_assignment_events (
    assignment_id,
    event_type,
    actor_type,
    actor_code,
    payload
  ) VALUES (
    v_assignment_id,
    'assigned',
    'system',
    NULL,
    jsonb_build_object(
      'registration_id', v_registration_id,
      'selected_set_id', v_set_id,
      'scheduled_at', p_scheduled_at,
      'open_at', p_open_at,
      'close_at', p_close_at,
      'source_form', p_source_form
    )
  );

  RETURN QUERY
  SELECT v_registration_id, v_assignment_id, v_set_id;
END;
$$;

-- =========================================================
-- Helper function: auto-expire assignment quá hạn và set điểm = 0
-- Có thể chạy định kỳ (cron / pg_cron)
-- =========================================================
CREATE OR REPLACE FUNCTION expire_overdue_exam_assignments()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated_count INTEGER := 0;
BEGIN
  WITH updated AS (
    UPDATE teacher_exam_assignments tea
    SET
      assignment_status = 'expired',
      score = 0,
      score_status = 'auto_zero',
      expired_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE tea.assignment_status IN ('assigned', 'in_progress')
      AND tea.close_at < CURRENT_TIMESTAMP
    RETURNING tea.id, tea.teacher_code
  ),
  ins_sub AS (
    INSERT INTO teacher_exam_submissions (
      assignment_id,
      teacher_code,
      started_at,
      submitted_at,
      time_spent_seconds,
      raw_score,
      percentage,
      is_passed,
      status
    )
    SELECT
      u.id,
      u.teacher_code,
      NULL,
      CURRENT_TIMESTAMP,
      0,
      0,
      0,
      FALSE,
      'auto_closed'
    FROM updated u
    ON CONFLICT (assignment_id) DO NOTHING
  ),
  ins_event AS (
    INSERT INTO exam_assignment_events (
      assignment_id,
      event_type,
      actor_type,
      actor_code,
      payload
    )
    SELECT
      u.id,
      'expired_auto_zero',
      'system',
      NULL,
      jsonb_build_object('reason', 'close_at_passed')
    FROM updated u
  )
  SELECT COUNT(*) INTO v_updated_count FROM updated;

  RETURN v_updated_count;
END;
$$;
