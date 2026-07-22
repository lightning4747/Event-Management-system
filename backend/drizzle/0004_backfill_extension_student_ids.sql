UPDATE certificate_deadline_extensions cde
SET student_id = app.student_id
FROM od_applications app
WHERE cde.application_id = app.application_id
  AND cde.student_id IS NULL;
