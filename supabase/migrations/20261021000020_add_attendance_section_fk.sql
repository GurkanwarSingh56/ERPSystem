-- Migration: 20261021000020_add_attendance_section_fk.sql
-- Description: Add foreign key constraint between attendance and sections to resolve PostgREST schema cache relationship.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_attendance_section'
  ) THEN
    ALTER TABLE attendance
      ADD CONSTRAINT fk_attendance_section
      FOREIGN KEY (institution_id, section_id)
      REFERENCES sections(institution_id, id)
      ON DELETE RESTRICT;
  END IF;
END $$;

COMMIT;
