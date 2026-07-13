-- Run in Coolify → PostgreSQL → Terminal (NOT the app container).
-- Wipes migration state and all tables. Safe only on a fresh deploy with no real data.

DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
