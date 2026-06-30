-- Run as PostgreSQL superuser:
-- psql -U postgres -h localhost -f scripts/setup-local-db.sql
--
-- If role/database already exist, you may see harmless errors.

CREATE ROLE fieldpro LOGIN PASSWORD 'fieldpro';
CREATE DATABASE fieldpro OWNER fieldpro;
GRANT ALL PRIVILEGES ON DATABASE fieldpro TO fieldpro;
