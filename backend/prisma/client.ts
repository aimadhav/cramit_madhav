import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;
// let instanceId = 0; // No longer needed

export const getPrismaClient = () => {
  if (!prisma) {
    // instanceId++; // No longer needed
    // console.log(`[getPrismaClient] Condition '!prisma' is true. Creating NEW PrismaClient instance (ID: ${instanceId}). NODE_ENV: ${process.env.NODE_ENV}, DB_URL_PART: ${process.env.DATABASE_URL?.split('@')[1] || process.env.DATABASE_URL}`);
    prisma = new PrismaClient({
      log: (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test")
        ? ["query", "error", "warn"]
        : ["error"],
    });
    // console.log(`[getPrismaClient] NEW PrismaClient instance (ID: ${instanceId}) created.`);
  } else {
    // console.log(`[getPrismaClient] Condition '!prisma' is false. Returning EXISTING PrismaClient instance (ID: ${instanceId}).`);
  }
  return prisma;
};

// Exported only for testing purposes to allow full reset
export const _TEST_ONLY_disconnectAndResetPrismaClient = async () => {
  if (prisma) {
    // const oldInstanceId = instanceId; // No longer needed
    // console.log(`[_TEST_ONLY_disconnectAndResetPrismaClient] Disconnecting EXISTING PrismaClient instance (ID: ${oldInstanceId}).`);
    await prisma.$disconnect();
    // console.log(`[_TEST_ONLY_disconnectAndResetPrismaClient] Disconnected EXISTING PrismaClient instance (ID: ${oldInstanceId}).`);
  }
  // console.log('[_TEST_ONLY_disconnectAndResetPrismaClient] Setting prisma to null.');
  prisma = null;
}; 