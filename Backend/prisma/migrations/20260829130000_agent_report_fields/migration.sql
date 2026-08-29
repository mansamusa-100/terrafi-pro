-- Agent report fields: created_at, onboarded_by_id, gender

ALTER TABLE "Agent" ADD COLUMN "created_at" TIMESTAMP(3);
ALTER TABLE "Agent" ADD COLUMN "onboarded_by_id" TEXT;
ALTER TABLE "Agent" ADD COLUMN "gender" TEXT;

-- Backfill created_at and onboarded_by_id from audit log
UPDATE "Agent" AS a
SET
  "created_at" = sub.onboarded_at,
  "onboarded_by_id" = sub.actor_id
FROM (
  SELECT
    al.entity_id AS agent_id,
    MIN(al.created_at) AS onboarded_at,
    (
      SELECT al2.actor_id
      FROM "AuditLog" al2
      WHERE al2.action = 'agent.onboarded'
        AND al2.entity_id = al.entity_id
      ORDER BY al2.created_at ASC
      LIMIT 1
    ) AS actor_id
  FROM "AuditLog" al
  WHERE al.action = 'agent.onboarded'
    AND al.entity_id IS NOT NULL
  GROUP BY al.entity_id
) AS sub
WHERE a.id = sub.agent_id;

UPDATE "Agent" SET "created_at" = CURRENT_TIMESTAMP WHERE "created_at" IS NULL;

ALTER TABLE "Agent" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "Agent" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Agent"
  ADD CONSTRAINT "Agent_onboarded_by_id_fkey"
  FOREIGN KEY ("onboarded_by_id") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
