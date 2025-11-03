/**
 * Authentication Service
 * Handles user authentication, JWT tokens, and session management
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { db } from '../db/client';
import type { User } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-in-production';
const JWT_EXPIRES_IN = '15m'; // Short-lived access tokens
const REFRESH_TOKEN_EXPIRES_DAYS = 30;

/**
 * Validate JWT_SECRET is present and valid
 */
function validateJWTSecret(): void {
	if (!JWT_SECRET || JWT_SECRET.trim().length === 0) {
		throw new Error('JWT_SECRET is not configured. Please set JWT_SECRET environment variable.');
	}
	if (JWT_SECRET === 'development-secret-change-in-production') {
		console.warn('[auth] Warning: Using default JWT_SECRET. This should be changed in production.');
	}
}

export interface AuthTokens {
	accessToken: string;
	refreshToken: string;
}

export interface JWTPayload {
	userId: string;
	email: string;
	role: string;
	teamId: string | null;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
	const saltRounds = 10;
	return bcrypt.hash(password, saltRounds);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
	return bcrypt.compare(password, hash);
}

/**
 * Generate JWT access token
 */
export function generateAccessToken(user: User): string {
	try {
		validateJWTSecret();

		const payload: JWTPayload = {
			userId: user.id,
			email: user.email,
			role: user.role,
			teamId: user.teamId
		};

		const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
		return token;
	} catch (error) {
		console.error('[generateAccessToken] Error:', error);
		if (error instanceof Error) {
			console.error('[generateAccessToken] Error message:', error.message);
		}
		throw new Error(`Failed to generate access token: ${error instanceof Error ? error.message : String(error)}`);
	}
}

/**
 * Generate refresh token and store in database
 */
export async function generateRefreshToken(userId: string): Promise<string> {
	try {
		const token = nanoid(64);
		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);

		try {
			await db.session.create({
				data: {
					userId,
					token,
					expiresAt
				}
			});
		} catch (dbError) {
			console.error('[generateRefreshToken] Database error creating session:', dbError);
			if (dbError instanceof Error) {
				console.error('[generateRefreshToken] Database error message:', dbError.message);
				console.error('[generateRefreshToken] Database error stack:', dbError.stack);
			}
			throw new Error(`Failed to create session in database: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
		}

		return token;
	} catch (error) {
		console.error('[generateRefreshToken] Error:', error);
		if (error instanceof Error && error.stack) {
			console.error('[generateRefreshToken] Error stack:', error.stack);
		}
		throw error;
	}
}

/**
 * Verify and decode JWT access token
 */
export function verifyAccessToken(token: string): JWTPayload | null {
	try {
		return jwt.verify(token, JWT_SECRET) as JWTPayload;
	} catch (error) {
		return null;
	}
}

/**
 * Verify refresh token and get associated user
 */
export async function verifyRefreshToken(token: string): Promise<User | null> {
	const session = await db.session.findUnique({
		where: { token },
		include: { user: true }
	});

	if (!session || session.expiresAt < new Date()) {
		// Delete expired session
		if (session) {
			await db.session.delete({ where: { id: session.id } });
		}
		return null;
	}

	return session.user;
}

/**
 * Register a new user
 */
export async function register(data: {
	email: string;
	password: string;
	name: string;
	role?: string;
}): Promise<{ user: User; tokens: AuthTokens } | { error: string }> {
	// Check if user already exists
	const existing = await db.user.findUnique({
		where: { email: data.email }
	});

	if (existing) {
		return { error: 'User with this email already exists' };
	}

	// Hash password
	const passwordHash = await hashPassword(data.password);

	// Create user
	const user = await db.user.create({
		data: {
			email: data.email,
			passwordHash,
			name: data.name,
			role: data.role || 'designer'
		}
	});

	// Generate tokens
	const accessToken = generateAccessToken(user);
	const refreshToken = await generateRefreshToken(user.id);

	return {
		user,
		tokens: { accessToken, refreshToken }
	};
}

/**
 * Login with email and password
 */
export async function login(
	email: string,
	password: string
): Promise<{ user: User; tokens: AuthTokens } | { error: string }> {
	try {
		// Find user
		let user: User | null;
		try {
			user = await db.user.findUnique({
				where: { email }
			});
		} catch (dbError) {
			console.error('[login] Database error finding user:', dbError);
			if (dbError instanceof Error) {
				console.error('[login] Database error message:', dbError.message);
				console.error('[login] Database error stack:', dbError.stack);
			}
			return { error: 'Database connection error. Please try again.' };
		}

		if (!user) {
			return { error: 'Invalid email or password' };
		}

		// Verify password
		let isValid: boolean;
		try {
			isValid = await verifyPassword(password, user.passwordHash);
		} catch (passwordError) {
			console.error('[login] Password verification error:', passwordError);
			return { error: 'Authentication error. Please try again.' };
		}

		if (!isValid) {
			return { error: 'Invalid email or password' };
		}

		// Update last login
		try {
			await db.user.update({
				where: { id: user.id },
				data: { lastLoginAt: new Date() }
			});
		} catch (updateError) {
			console.error('[login] Database error updating last login:', updateError);
			// Non-critical error, continue with login
		}

		// Generate tokens
		let accessToken: string;
		try {
			accessToken = generateAccessToken(user);
		} catch (tokenError) {
			console.error('[login] Error generating access token:', tokenError);
			if (tokenError instanceof Error) {
				console.error('[login] Token error message:', tokenError.message);
			}
			return { error: 'Token generation failed. Please try again.' };
		}

		let refreshToken: string;
		try {
			refreshToken = await generateRefreshToken(user.id);
		} catch (refreshError) {
			console.error('[login] Error generating refresh token:', refreshError);
			if (refreshError instanceof Error) {
				console.error('[login] Refresh token error message:', refreshError.message);
				console.error('[login] Refresh token error stack:', refreshError.stack);
			}
			return { error: 'Session creation failed. Please try again.' };
		}

		return {
			user,
			tokens: { accessToken, refreshToken }
		};
	} catch (error) {
		console.error('[login] Unexpected error:', error);
		if (error instanceof Error) {
			console.error('[login] Unexpected error message:', error.message);
			console.error('[login] Unexpected error stack:', error.stack);
		}
		return { error: 'Login failed. Please try again.' };
	}
}

/**
 * Refresh access token using refresh token
 */
export async function refresh(
	refreshToken: string
): Promise<{ tokens: AuthTokens } | { error: string }> {
	const user = await verifyRefreshToken(refreshToken);

	if (!user) {
		return { error: 'Invalid or expired refresh token' };
	}

	// Generate new tokens
	const accessToken = generateAccessToken(user);
	const newRefreshToken = await generateRefreshToken(user.id);

	// Delete old refresh token
	await db.session.delete({ where: { token: refreshToken } });

	return {
		tokens: { accessToken, refreshToken: newRefreshToken }
	};
}

/**
 * Logout - delete refresh token
 */
export async function logout(refreshToken: string): Promise<void> {
	await db.session.deleteMany({
		where: { token: refreshToken }
	});
}

/**
 * Logout from all devices - delete all user sessions
 */
export async function logoutAll(userId: string): Promise<void> {
	await db.session.deleteMany({
		where: { userId }
	});
}

/**
 * Get user by ID (for authenticated requests)
 */
export async function getUserById(userId: string): Promise<User | null> {
	return db.user.findUnique({
		where: { id: userId }
	});
}

/**
 * Clean up expired sessions (should be run periodically)
 */
export async function cleanupExpiredSessions(): Promise<number> {
	const result = await db.session.deleteMany({
		where: {
			expiresAt: {
				lt: new Date()
			}
		}
	});
	return result.count;
}
