/**
 * Prisma Database Client
 *
 * Singleton instance of Prisma Client for database access.
 * Uses connection pooling and proper cleanup in development.
 */

import { PrismaClient } from '@prisma/client';

// Check if we're in development mode
const isDev = process.env.NODE_ENV !== 'production';

// Singleton pattern to prevent multiple Prisma Client instances
const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};

let db: PrismaClient;

try {
	db = globalForPrisma.prisma ?? new PrismaClient({
		log: isDev ? ['query', 'error', 'warn'] : ['error']
	});

	if (isDev) {
		globalForPrisma.prisma = db;
	}
} catch (error) {
	console.error('[db] Failed to initialize Prisma Client:', error);
	if (error instanceof Error) {
		console.error('[db] Error message:', error.message);
		console.error('[db] Error stack:', error.stack);
	}
	throw new Error('Failed to initialize database client. Please check DATABASE_URL and database file permissions.');
}

export { db };

/**
 * Test database connectivity
 * Returns true if connection is successful, false otherwise
 */
export async function testDatabaseConnection(): Promise<boolean> {
	try {
		await db.$queryRaw`SELECT 1`;
		return true;
	} catch (error) {
		console.error('[db] Database connection test failed:', error);
		if (error instanceof Error) {
			console.error('[db] Connection error message:', error.message);
			console.error('[db] Connection error stack:', error.stack);
		}
		return false;
	}
}

// Test connection on startup in development mode
if (isDev) {
	testDatabaseConnection().catch((error) => {
		console.error('[db] Failed to test database connection on startup:', error);
	});
}

// Graceful shutdown
if (!isDev) {
	process.on('beforeExit', async () => {
		await db.$disconnect();
	});
}
