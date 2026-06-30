-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "agents" INTEGER NOT NULL DEFAULT 0,
    "officers" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "mrr" INTEGER NOT NULL DEFAULT 0,
    "since" TEXT NOT NULL,
    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "company_id" TEXT,
    "scope" TEXT NOT NULL,
    "zone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Zone" (
    "name" TEXT NOT NULL,
    CONSTRAINT "Zone_pkey" PRIMARY KEY ("name")
);

CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "efloat" INTEGER NOT NULL DEFAULT 0,
    "cash" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 0,
    "visits" INTEGER NOT NULL DEFAULT 0,
    "officer" TEXT NOT NULL,
    "joined" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "kyc" TEXT NOT NULL DEFAULT 'pending',
    "last_visit" TEXT,
    "national_id" TEXT,
    "business_type" TEXT,
    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KycDocument" (
    "id" SERIAL NOT NULL,
    "agent_id" TEXT NOT NULL,
    "doc_type" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "mime_type" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KycDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Officer" (
    "id" SERIAL NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "agents" INTEGER NOT NULL DEFAULT 0,
    "visits" INTEGER NOT NULL DEFAULT 0,
    "target" INTEGER NOT NULL DEFAULT 25,
    "score" INTEGER NOT NULL DEFAULT 0,
    "zone" TEXT NOT NULL,
    CONSTRAINT "Officer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Visit" (
    "id" SERIAL NOT NULL,
    "company_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "agent_name" TEXT NOT NULL,
    "officer" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'done',
    "time" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "visit_date" TEXT NOT NULL,
    "efloat" INTEGER,
    "cash" INTEGER,
    "notes" TEXT,
    "compliance_passed" INTEGER,
    "compliance_total" INTEGER,
    "check_in_lat" DOUBLE PRECISION,
    "check_in_lng" DOUBLE PRECISION,
    "gps_verified" BOOLEAN NOT NULL DEFAULT false,
    "distance_meters" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Alert" (
    "id" SERIAL NOT NULL,
    "company_id" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "agent_id" TEXT,
    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrainingModule" (
    "id" SERIAL NOT NULL,
    "company_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "assigned" INTEGER NOT NULL,
    "completed" INTEGER NOT NULL,
    "passing" INTEGER NOT NULL,
    CONSTRAINT "TrainingModule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FloatTrendPoint" (
    "id" SERIAL NOT NULL,
    "company_id" TEXT NOT NULL,
    "day_index" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "efloat" INTEGER NOT NULL,
    "cash" INTEGER NOT NULL,
    CONSTRAINT "FloatTrendPoint_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

ALTER TABLE "User" ADD CONSTRAINT "User_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KycDocument" ADD CONSTRAINT "KycDocument_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Officer" ADD CONSTRAINT "Officer_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrainingModule" ADD CONSTRAINT "TrainingModule_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FloatTrendPoint" ADD CONSTRAINT "FloatTrendPoint_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
