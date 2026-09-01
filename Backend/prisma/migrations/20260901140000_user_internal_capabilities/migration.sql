-- Manager-assignable capabilities for internal (back-office) users
ALTER TABLE "User" ADD COLUMN "internal_capabilities" JSONB;
