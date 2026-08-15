-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "objectId" TEXT,
    "blockId" TEXT,
    "scopeLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstructionObject" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "floorsTotal" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "pctPlan" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pctFact" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deltaDays" INTEGER NOT NULL DEFAULT 0,
    "responsibleUserId" TEXT,

    CONSTRAINT "ConstructionObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "floors" INTEGER NOT NULL,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectionDef" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entryCondition" TEXT,
    "blockReason" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SectionDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessDef" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "requiresAosr" BOOLEAN NOT NULL DEFAULT false,
    "subcycle" TEXT,
    "critical" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProcessDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessState" (
    "id" TEXT NOT NULL,
    "processDefId" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "planQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "doneQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "blockedReason" TEXT,
    "dueDate" TIMESTAMP(3),
    "presentedAt" TIMESTAMP(3),
    "presentedOfDays" INTEGER,
    "aosrNumber" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "assigneeUserId" TEXT,

    CONSTRAINT "ProcessState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessComment" (
    "id" TEXT NOT NULL,
    "processStateId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "materialName" TEXT,
    "materialQty" DOUBLE PRECISION,
    "materialUnit" TEXT,
    "neededBy" TIMESTAMP(3),
    "idleWorkers" INTEGER,
    "idleSince" TIMESTAMP(3),
    "idleCost" DOUBLE PRECISION,
    "zayavkaId" TEXT,

    CONSTRAINT "ProcessComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Presentation" (
    "id" TEXT NOT NULL,
    "processStateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "checklist" TEXT NOT NULL,
    "notified" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "authorId" TEXT NOT NULL,

    CONSTRAINT "Presentation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyReport" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "authorId" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "submittedAt" TIMESTAMP(3),
    "fillSeconds" INTEGER,
    "returnComment" TEXT,
    "returnedFields" TEXT,

    CONSTRAINT "DailyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportEntry" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "processStateId" TEXT NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "workers" INTEGER NOT NULL,
    "appliedVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "problems" TEXT NOT NULL DEFAULT '[]',
    "tempAir" DOUBLE PRECISION,
    "tempMix" DOUBLE PRECISION,
    "winterMethod" TEXT,
    "comment" TEXT,

    CONSTRAINT "ReportEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportPhoto" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "fileId" TEXT,
    "url" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "lat" DOUBLE PRECISION,
    "lon" DOUBLE PRECISION,

    CONSTRAINT "ReportPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportCheck" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "comment" TEXT,
    "entryId" TEXT,
    "adjustFrom" DOUBLE PRECISION,
    "adjustTo" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Zayavka" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "objectId" TEXT NOT NULL,
    "blockId" TEXT,
    "floor" INTEGER,
    "processStateId" TEXT,
    "authorId" TEXT NOT NULL,
    "holderId" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'norm',
    "deliveryBy" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idleWorkers" INTEGER,
    "idleSince" TIMESTAMP(3),
    "idleCost" DOUBLE PRECISION,

    CONSTRAINT "Zayavka_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZayavkaItem" (
    "id" TEXT NOT NULL,
    "zayavkaId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "catalogItemId" TEXT,
    "qty" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "note" TEXT,
    "specRemainder" DOUBLE PRECISION,
    "overspendReason" TEXT,

    CONSTRAINT "ZayavkaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZayavkaEvent" (
    "id" TEXT NOT NULL,
    "zayavkaId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "ZayavkaEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechRequest" (
    "id" TEXT NOT NULL,
    "zayavkaId" TEXT NOT NULL,
    "machineType" TEXT NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "timeFrom" TEXT NOT NULL,
    "frontChecklist" TEXT NOT NULL,
    "machineId" TEXT,
    "operatorId" TEXT,

    CONSTRAINT "TechRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'free',
    "nextServiceAt" TIMESTAMP(3),
    "permitUntil" TIMESTAMP(3),

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechReport" (
    "id" TEXT NOT NULL,
    "techRequestId" TEXT NOT NULL,
    "hoursPlanned" DOUBLE PRECISION NOT NULL,
    "hoursActual" DOUBLE PRECISION NOT NULL,
    "idleHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "idleReason" TEXT,
    "fuel" DOUBLE PRECISION,
    "faults" TEXT,
    "ratedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "aliases" TEXT NOT NULL DEFAULT '[]',

    CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockBalance" (
    "id" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "specRemainder" DOUBLE PRECISION,
    "hasPassport" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialAcceptance" (
    "id" TEXT NOT NULL,
    "zayavkaId" TEXT NOT NULL,
    "acceptedById" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qtyAccepted" DOUBLE PRECISION NOT NULL,
    "passportOk" BOOLEAN NOT NULL,
    "passportNumber" TEXT,
    "discrepancy" TEXT,
    "photos" TEXT NOT NULL DEFAULT '[]',

    CONSTRAINT "MaterialAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialIssue" (
    "id" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "toUserId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signature" TEXT NOT NULL,

    CONSTRAINT "MaterialIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contractor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "activeWorkers" INTEGER NOT NULL DEFAULT 0,
    "autoOnTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "autoRework" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "autoSafety" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "autoDocs" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Contractor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorRating" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "quality" INTEGER NOT NULL,
    "safety" INTEGER NOT NULL,
    "management" INTEGER NOT NULL,
    "culture" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractorRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prescription" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "dueDays" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "photos" TEXT NOT NULL DEFAULT '[]',

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawingSet" (
    "id" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "mark" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "revision" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrawingSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawingSheet" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currentVersionId" TEXT,

    CONSTRAINT "DrawingSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SheetVersion" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "revision" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "changeSummary" TEXT,
    "fileId" TEXT,
    "supersededAt" TIMESTAMP(3),
    "supersededByaId" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SheetVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rfi" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "sheetId" TEXT,
    "question" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "answer" TEXT,
    "answeredAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',

    CONSTRAINT "Rfi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteDocument" (
    "id" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "processStateId" TEXT,
    "fileUrl" TEXT,

    CONSTRAINT "SiteDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConcreteStrengthProtocol" (
    "id" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "processStateId" TEXT NOT NULL,
    "pouredAt" TIMESTAMP(3) NOT NULL,
    "sampleAt" TIMESTAMP(3) NOT NULL,
    "strengthPct" DOUBLE PRECISION NOT NULL,
    "requiredPct" DOUBLE PRECISION NOT NULL,
    "labName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'awaiting',

    CONSTRAINT "ConcreteStrengthProtocol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObjectFinance" (
    "id" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "budget" DOUBLE PRECISION NOT NULL,
    "ev" DOUBLE PRECISION NOT NULL,
    "ac" DOUBLE PRECISION NOT NULL,
    "closedByActs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "receivable" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "ObjectFinance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostArticle" (
    "id" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT,

    CONSTRAINT "CostArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedById" TEXT,
    "aboveLimit" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutonomyLimit" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "limit" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "AutonomyLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "blockId" TEXT,
    "floor" INTEGER,
    "sectionId" TEXT,
    "assigneeId" TEXT,
    "authorId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "origin" TEXT NOT NULL DEFAULT 'manual',
    "sourceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workersIdle" INTEGER,
    "cost" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'open',
    "taskId" TEXT,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "toRole" TEXT NOT NULL,
    "toUserId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorLabel" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "aggregate" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,

    CONSTRAINT "DomainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Threshold" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT,
    "roleKey" TEXT,
    "value" DECIMAL(14,3) NOT NULL,
    "unit" TEXT,
    "source" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "Threshold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "bodyHash" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "responseBody" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gate" (
    "id" TEXT NOT NULL,
    "processStateId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedById" TEXT,
    "releasedAt" TIMESTAMP(3),
    "justification" TEXT,

    CONSTRAINT "Gate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileObject" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "takenAt" TIMESTAMP(3),
    "lat" DOUBLE PRECISION,
    "lon" DOUBLE PRECISION,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedAt" TIMESTAMP(3),

    CONSTRAINT "FileObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncOperation" (
    "id" TEXT NOT NULL,
    "clientOpId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceTime" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "result" JSONB,
    "conflictNote" TEXT,
    "conflictTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationSetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'push',

    CONSTRAINT "NotificationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SheetView" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "versionId" TEXT,
    "revision" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SheetView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshHash" TEXT NOT NULL,
    "deviceName" TEXT,
    "deviceId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "rotatedFromId" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoqItem" (
    "id" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sectionId" TEXT,
    "processDefId" TEXT,
    "unit" TEXT NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,
    "rate" DECIMAL(18,2) NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoqItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostFact" (
    "id" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "article" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "actualAsOf" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT '1C',
    "importId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostImport" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT '1C',
    "status" TEXT NOT NULL DEFAULT 'running',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "actualAsOf" TIMESTAMP(3) NOT NULL,
    "rowsTotal" INTEGER NOT NULL DEFAULT 0,
    "rowsImported" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "CostImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractAct" (
    "id" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "amountCompleted" DECIMAL(18,2) NOT NULL,
    "amountSubmitted" DECIMAL(18,2),
    "amountSigned" DECIMAL(18,2),
    "amountPaid" DECIMAL(18,2),
    "extraWorkUnformalized" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "submittedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractAct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueRouting" (
    "id" TEXT NOT NULL,
    "issueKind" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL DEFAULT 'company',
    "scopeId" TEXT NOT NULL DEFAULT '',
    "toRole" TEXT NOT NULL,
    "createsTask" BOOLEAN NOT NULL DEFAULT true,
    "escalateAbove" DECIMAL(18,2),
    "escalateToRole" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueRouting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiTarget" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL DEFAULT 'company',
    "scopeId" TEXT NOT NULL DEFAULT '',
    "goodAbove" DECIMAL(12,3),
    "goodBelow" DECIMAL(12,3),
    "measuringUntil" TIMESTAMP(3),
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KpiTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "loginValue" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_login_key" ON "User"("login");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "ConstructionObject_code_key" ON "ConstructionObject"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Block_objectId_name_key" ON "Block"("objectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "SectionDef_name_key" ON "SectionDef"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessDef_sectionId_order_key" ON "ProcessDef"("sectionId", "order");

-- CreateIndex
CREATE INDEX "ProcessState_objectId_status_idx" ON "ProcessState"("objectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessState_processDefId_blockId_floor_key" ON "ProcessState"("processDefId", "blockId", "floor");

-- CreateIndex
CREATE UNIQUE INDEX "DailyReport_date_authorId_key" ON "DailyReport"("date", "authorId");

-- CreateIndex
CREATE UNIQUE INDEX "Zayavka_number_key" ON "Zayavka"("number");

-- CreateIndex
CREATE UNIQUE INDEX "TechRequest_zayavkaId_key" ON "TechRequest"("zayavkaId");

-- CreateIndex
CREATE UNIQUE INDEX "TechReport_techRequestId_key" ON "TechReport"("techRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogItem_name_key" ON "CatalogItem"("name");

-- CreateIndex
CREATE UNIQUE INDEX "StockBalance_objectId_catalogItemId_key" ON "StockBalance"("objectId", "catalogItemId");

-- CreateIndex
CREATE UNIQUE INDEX "DrawingSheet_currentVersionId_key" ON "DrawingSheet"("currentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "DrawingSheet_setId_number_key" ON "DrawingSheet"("setId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "SheetVersion_sheetId_revision_key" ON "SheetVersion"("sheetId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "ObjectFinance_objectId_key" ON "ObjectFinance"("objectId");

-- CreateIndex
CREATE UNIQUE INDEX "AutonomyLimit_role_scope_key" ON "AutonomyLimit"("role", "scope");

-- CreateIndex
CREATE INDEX "Notification_toRole_read_idx" ON "Notification"("toRole", "read");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_at_idx" ON "AuditLog"("at");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "DomainEvent_publishedAt_idx" ON "DomainEvent"("publishedAt");

-- CreateIndex
CREATE INDEX "DomainEvent_aggregate_aggregateId_idx" ON "DomainEvent"("aggregate", "aggregateId");

-- CreateIndex
CREATE INDEX "Threshold_key_scopeType_scopeId_idx" ON "Threshold"("key", "scopeType", "scopeId");

-- CreateIndex
CREATE INDEX "IdempotencyKey_createdAt_idx" ON "IdempotencyKey"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_key_userId_key" ON "IdempotencyKey"("key", "userId");

-- CreateIndex
CREATE INDEX "Gate_processStateId_status_idx" ON "Gate"("processStateId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FileObject_key_key" ON "FileObject"("key");

-- CreateIndex
CREATE INDEX "FileObject_status_idx" ON "FileObject"("status");

-- CreateIndex
CREATE INDEX "SyncOperation_status_idx" ON "SyncOperation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SyncOperation_clientOpId_userId_key" ON "SyncOperation"("clientOpId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSetting_userId_eventType_key" ON "NotificationSetting"("userId", "eventType");

-- CreateIndex
CREATE UNIQUE INDEX "SheetView_sheetId_userId_key" ON "SheetView"("sheetId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshHash_key" ON "Session"("refreshHash");

-- CreateIndex
CREATE INDEX "Session_userId_revokedAt_idx" ON "Session"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "BoqItem_objectId_sectionId_idx" ON "BoqItem"("objectId", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "BoqItem_objectId_code_key" ON "BoqItem"("objectId", "code");

-- CreateIndex
CREATE INDEX "CostFact_objectId_actualAsOf_idx" ON "CostFact"("objectId", "actualAsOf");

-- CreateIndex
CREATE UNIQUE INDEX "CostFact_objectId_article_periodStart_periodEnd_source_key" ON "CostFact"("objectId", "article", "periodStart", "periodEnd", "source");

-- CreateIndex
CREATE INDEX "ContractAct_objectId_status_idx" ON "ContractAct"("objectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ContractAct_objectId_number_key" ON "ContractAct"("objectId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "IssueRouting_issueKind_scopeType_scopeId_key" ON "IssueRouting"("issueKind", "scopeType", "scopeId");

-- CreateIndex
CREATE INDEX "KpiTarget_department_idx" ON "KpiTarget"("department");

-- CreateIndex
CREATE UNIQUE INDEX "KpiTarget_key_scopeType_scopeId_key" ON "KpiTarget"("key", "scopeType", "scopeId");

-- CreateIndex
CREATE INDEX "LoginAttempt_loginValue_at_idx" ON "LoginAttempt"("loginValue", "at");

-- CreateIndex
CREATE INDEX "LoginAttempt_ip_at_idx" ON "LoginAttempt"("ip", "at");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "ConstructionObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionObject" ADD CONSTRAINT "ConstructionObject_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "ConstructionObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessDef" ADD CONSTRAINT "ProcessDef_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "SectionDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessState" ADD CONSTRAINT "ProcessState_processDefId_fkey" FOREIGN KEY ("processDefId") REFERENCES "ProcessDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessState" ADD CONSTRAINT "ProcessState_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "ConstructionObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessState" ADD CONSTRAINT "ProcessState_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessComment" ADD CONSTRAINT "ProcessComment_processStateId_fkey" FOREIGN KEY ("processStateId") REFERENCES "ProcessState"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presentation" ADD CONSTRAINT "Presentation_processStateId_fkey" FOREIGN KEY ("processStateId") REFERENCES "ProcessState"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "ConstructionObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportEntry" ADD CONSTRAINT "ReportEntry_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "DailyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportEntry" ADD CONSTRAINT "ReportEntry_processStateId_fkey" FOREIGN KEY ("processStateId") REFERENCES "ProcessState"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportPhoto" ADD CONSTRAINT "ReportPhoto_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ReportEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportPhoto" ADD CONSTRAINT "ReportPhoto_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCheck" ADD CONSTRAINT "ReportCheck_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "DailyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCheck" ADD CONSTRAINT "ReportCheck_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Zayavka" ADD CONSTRAINT "Zayavka_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "ConstructionObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Zayavka" ADD CONSTRAINT "Zayavka_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Zayavka" ADD CONSTRAINT "Zayavka_processStateId_fkey" FOREIGN KEY ("processStateId") REFERENCES "ProcessState"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Zayavka" ADD CONSTRAINT "Zayavka_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Zayavka" ADD CONSTRAINT "Zayavka_holderId_fkey" FOREIGN KEY ("holderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZayavkaItem" ADD CONSTRAINT "ZayavkaItem_zayavkaId_fkey" FOREIGN KEY ("zayavkaId") REFERENCES "Zayavka"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZayavkaItem" ADD CONSTRAINT "ZayavkaItem_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZayavkaEvent" ADD CONSTRAINT "ZayavkaEvent_zayavkaId_fkey" FOREIGN KEY ("zayavkaId") REFERENCES "Zayavka"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZayavkaEvent" ADD CONSTRAINT "ZayavkaEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechRequest" ADD CONSTRAINT "TechRequest_zayavkaId_fkey" FOREIGN KEY ("zayavkaId") REFERENCES "Zayavka"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechRequest" ADD CONSTRAINT "TechRequest_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechReport" ADD CONSTRAINT "TechReport_techRequestId_fkey" FOREIGN KEY ("techRequestId") REFERENCES "TechRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "ConstructionObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialAcceptance" ADD CONSTRAINT "MaterialAcceptance_zayavkaId_fkey" FOREIGN KEY ("zayavkaId") REFERENCES "Zayavka"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialAcceptance" ADD CONSTRAINT "MaterialAcceptance_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIssue" ADD CONSTRAINT "MaterialIssue_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "ConstructionObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIssue" ADD CONSTRAINT "MaterialIssue_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIssue" ADD CONSTRAINT "MaterialIssue_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorRating" ADD CONSTRAINT "ContractorRating_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorRating" ADD CONSTRAINT "ContractorRating_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawingSet" ADD CONSTRAINT "DrawingSet_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "ConstructionObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawingSheet" ADD CONSTRAINT "DrawingSheet_setId_fkey" FOREIGN KEY ("setId") REFERENCES "DrawingSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawingSheet" ADD CONSTRAINT "DrawingSheet_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "SheetVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SheetVersion" ADD CONSTRAINT "SheetVersion_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "DrawingSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SheetVersion" ADD CONSTRAINT "SheetVersion_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfi" ADD CONSTRAINT "Rfi_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "ConstructionObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfi" ADD CONSTRAINT "Rfi_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfi" ADD CONSTRAINT "Rfi_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "DrawingSheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteDocument" ADD CONSTRAINT "SiteDocument_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "ConstructionObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteDocument" ADD CONSTRAINT "SiteDocument_processStateId_fkey" FOREIGN KEY ("processStateId") REFERENCES "ProcessState"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConcreteStrengthProtocol" ADD CONSTRAINT "ConcreteStrengthProtocol_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "ConstructionObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConcreteStrengthProtocol" ADD CONSTRAINT "ConcreteStrengthProtocol_processStateId_fkey" FOREIGN KEY ("processStateId") REFERENCES "ProcessState"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObjectFinance" ADD CONSTRAINT "ObjectFinance_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "ConstructionObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostArticle" ADD CONSTRAINT "CostArticle_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "ConstructionObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "ConstructionObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "ConstructionObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "SectionDef"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "ConstructionObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileObject" ADD CONSTRAINT "FileObject_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncOperation" ADD CONSTRAINT "SyncOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationSetting" ADD CONSTRAINT "NotificationSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SheetView" ADD CONSTRAINT "SheetView_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "DrawingSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SheetView" ADD CONSTRAINT "SheetView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SheetView" ADD CONSTRAINT "SheetView_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "SheetVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoqItem" ADD CONSTRAINT "BoqItem_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "ConstructionObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoqItem" ADD CONSTRAINT "BoqItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "SectionDef"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoqItem" ADD CONSTRAINT "BoqItem_processDefId_fkey" FOREIGN KEY ("processDefId") REFERENCES "ProcessDef"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostFact" ADD CONSTRAINT "CostFact_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "ConstructionObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostFact" ADD CONSTRAINT "CostFact_importId_fkey" FOREIGN KEY ("importId") REFERENCES "CostImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractAct" ADD CONSTRAINT "ContractAct_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "ConstructionObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

