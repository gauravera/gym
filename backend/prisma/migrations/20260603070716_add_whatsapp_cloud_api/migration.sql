-- AlterTable
ALTER TABLE "Gym" ADD COLUMN     "whatsapp_access_token" TEXT,
ADD COLUMN     "whatsapp_business_id" TEXT,
ADD COLUMN     "whatsapp_connected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsapp_phone_number" TEXT,
ADD COLUMN     "whatsapp_phone_number_id" TEXT,
ADD COLUMN     "whatsapp_waba_id" TEXT;

-- CreateTable
CREATE TABLE "WhatsAppMessages" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "senderPhone" TEXT NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppMessages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppEvents" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppEvents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppTemplates" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "metaTemplateId" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en_US',
    "category" TEXT NOT NULL DEFAULT 'UTILITY',
    "status" TEXT NOT NULL,
    "components" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppTemplates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppMessages_messageId_key" ON "WhatsAppMessages"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppTemplates_gymId_templateName_key" ON "WhatsAppTemplates"("gymId", "templateName");

-- AddForeignKey
ALTER TABLE "WhatsAppMessages" ADD CONSTRAINT "WhatsAppMessages_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppEvents" ADD CONSTRAINT "WhatsAppEvents_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "WhatsAppMessages"("messageId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppTemplates" ADD CONSTRAINT "WhatsAppTemplates_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;
