-- AlterTable
ALTER TABLE "ChatbotSettings" ALTER COLUMN "welcomeMessage" SET DEFAULT 'Welcome to {{gym_name}}!

1. My Membership
2. Renew Membership
3. View Plans
4. Contact Gym
5. Offers';

-- AlterTable
ALTER TABLE "Gym" ADD COLUMN     "whatsappDisplayPhoneNumber" TEXT,
ADD COLUMN     "whatsappLastError" TEXT,
ADD COLUMN     "whatsappMessagingTier" TEXT DEFAULT 'UNKNOWN',
ADD COLUMN     "whatsappQualityRating" TEXT DEFAULT 'UNKNOWN',
ADD COLUMN     "whatsappStatus" TEXT DEFAULT 'disconnected',
ADD COLUMN     "whatsappVerificationStatus" TEXT DEFAULT 'NOT_VERIFIED',
ADD COLUMN     "whatsappVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "whatsappVerifiedName" TEXT;
