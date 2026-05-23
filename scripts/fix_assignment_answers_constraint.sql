      -- Delete duplicates, keeping the latest one based on ID (higher ID = later insertion)
      DELETE FROM training_assignment_answers a
      WHERE id < (
        SELECT MAX(id)
        FROM training_assignment_answers b
        WHERE a.submission_id = b.submission_id
          AND a.question_id = b.question_id
      );

      -- Add unique constraint to support ON CONFLICT
      -- We drop it first to be idempotent in case of partial runs
      ALTER TABLE training_assignment_answers
      DROP CONSTRAINT IF EXISTS unique_submission_question;

      ALTER TABLE training_assignment_answers
      ADD CONSTRAINT unique_submission_question UNIQUE (submission_id, question_id);