/**
 * Authentication Middleware
 * Validates JWT tokens and enforces role-based permissions
 */

import { error, type RequestEvent } from '@sveltejs/kit';
import { verifyAccessToken, getUserById } from '../services/auth';
import type { User } from '@prisma/client';

/**
 * Extract and verify JWT token from Authorization header
 */
function extractToken(event: RequestEvent): string | null {
	const authHeader = event.request.headers.get('Authorization');
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return null;
	}
	return authHeader.substring(7);
}

/**
 * Require authentication for a route handler
 * Attaches user to locals.user if valid token
 */
export function requireAuth(
	handler: (event: RequestEvent & { locals: { user: User } }) => Promise<Response>
) {
	return async (event: RequestEvent): Promise<Response> => {
		try {
			const token = extractToken(event);

			if (!token) {
				throw error(401, { message: 'Missing authentication token' });
			}

			const payload = verifyAccessToken(token);
			if (!payload) {
				throw error(401, { message: 'Invalid or expired token' });
			}

			const user = await getUserById(payload.userId);
			if (!user) {
				throw error(401, { message: 'User not found' });
			}

			// Attach user to locals
			event.locals.user = user;

			return handler(event as RequestEvent & { locals: { user: User } });
		} catch (err) {
			// If it's already a SvelteKit error, rethrow it
			if (err && typeof err === 'object' && 'status' in err) {
				throw err;
			}
			// Otherwise, log and return a 500 error
			console.error('Auth middleware error:', err);
			throw error(500, { message: 'Authentication failed' });
		}
	};
}

/**
 * Require specific role(s) for a route handler
 * Checks user role after authentication
 */
export function requireRole(
	roles: string | string[],
	handler: (event: RequestEvent & { locals: { user: User } }) => Promise<Response>
) {
	const allowedRoles = Array.isArray(roles) ? roles : [roles];

	return requireAuth(async (event) => {
		const user = event.locals.user;

		if (!allowedRoles.includes(user.role)) {
			throw error(403, {
				message: `Forbidden: Requires one of these roles: ${allowedRoles.join(', ')}`
			});
		}

		return handler(event);
	});
}

/**
 * Require Owner role (highest permission level)
 */
export function requireOwner(
	handler: (event: RequestEvent & { locals: { user: User } }) => Promise<Response>
) {
	return requireRole('owner', handler);
}

/**
 * Require Manager role or higher
 */
export function requireManager(
	handler: (event: RequestEvent & { locals: { user: User } }) => Promise<Response>
) {
	return requireRole(['owner', 'manager'], handler);
}

/**
 * Require Designer role or higher
 */
export function requireDesigner(
	handler: (event: RequestEvent & { locals: { user: User } }) => Promise<Response>
) {
	return requireRole(['owner', 'manager', 'designer'], handler);
}

/**
 * Optional authentication - doesn't fail if no token
 * Attaches user to locals.user if token is valid, otherwise locals.user is undefined
 */
export function optionalAuth(
	handler: (
		event: RequestEvent & { locals: { user?: User } }
	) => Promise<Response>
) {
	return async (event: RequestEvent): Promise<Response> => {
		const token = extractToken(event);

		if (token) {
			try {
				const payload = verifyAccessToken(token);
				if (payload) {
					const user = await getUserById(payload.userId);
					if (user) {
						event.locals.user = user;
					}
				}
			} catch (err) {
				// Silently fail for optional auth - just don't set user
				console.error('Optional auth error (ignored):', err);
			}
		}

		return handler(event as RequestEvent & { locals: { user?: User } });
	};
}
