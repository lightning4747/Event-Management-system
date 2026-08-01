-- 1. Create composite index on (student_id, created_at)
CREATE INDEX IF NOT EXISTS "od_applications_student_created_at_idx" ON "od_applications" ("student_id", "created_at");

-- 2. Update number of events check constraint (1-4)
ALTER TABLE "od_applications" DROP CONSTRAINT IF EXISTS "number_of_events_positive_check";
ALTER TABLE "od_applications" DROP CONSTRAINT IF EXISTS "number_of_events_range_check";
ALTER TABLE "od_applications" ADD CONSTRAINT "number_of_events_range_check" CHECK ("number_of_events" >= 1 AND "number_of_events" <= 4);

-- 3. Daily Application Limit Trigger Function (Safety Net)
CREATE OR REPLACE FUNCTION enforce_daily_od_application_limit()
RETURNS TRIGGER AS $$
DECLARE
  today_count INT;
BEGIN
  SELECT COUNT(*) INTO today_count
  FROM od_applications
  WHERE student_id = NEW.student_id
    AND created_at >= CURRENT_DATE 
    AND created_at < CURRENT_DATE + INTERVAL '1 day';

  IF today_count >= 3 THEN
    RAISE EXCEPTION 'DAILY_LIMIT_EXCEEDED: Maximum 3 applications per day allowed.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_daily_od_application_limit ON od_applications;
CREATE TRIGGER trg_enforce_daily_od_application_limit
  BEFORE INSERT ON od_applications
  FOR EACH ROW
  EXECUTE FUNCTION enforce_daily_od_application_limit();
