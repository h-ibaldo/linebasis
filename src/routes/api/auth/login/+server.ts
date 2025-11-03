/**
 * POST /api/auth/login
 * Login with email and password
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { login } from '$lib/server/services/auth';

export const POST: RequestHandler = async ({ request }) => {
	let email: string | undefined;
	
	try {
		const body = await request.json();
		email = body.email;
		const password = body.password;

		// Validate input
		if (!email || !password) {
			return json({ error: 'Email and password are required' }, { status: 400 });
		}

		const result = await login(email, password);

		if ('error' in result) {
			return json({ error: result.error }, { status: 401 });
		}

		// Don't return passwordHash to client
		const { passwordHash: _, ...userWithoutPassword } = result.user;

		return json({
			user: userWithoutPassword,
			accessToken: result.tokens.accessToken,
			refreshToken: result.tokens.refreshToken
		});
	} catch (error) {
		// Enhanced error logging with stack traces and context
		console.error('[POST /api/auth/login] Error details:');
		console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
		console.error('Error message:', error instanceof Error ? error.message : String(error));
		console.error('Email attempted:', email || 'unknown');
		if (error instanceof Error && error.stack) {
			console.error('Stack trace:', error.stack);
		}
		console.error('Full error object:', error);
		
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
