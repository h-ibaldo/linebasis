/**
 * GET /api/media/:id - Get single media
 * PUT /api/media/:id - Update media metadata
 * DELETE /api/media/:id - Delete media
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/middleware/auth';
import { getMediaById, updateMedia, deleteMedia } from '$lib/server/services/media';

export const GET: RequestHandler = requireAuth(async ({ params, locals }) => {
	const user = locals.user;

	if (!user.teamId) {
		return json({ error: 'User must belong to a team' }, { status: 403 });
	}

	const media = await getMediaById(params.id, user.teamId);

	if (!media) {
		return json({ error: 'Media not found' }, { status: 404 });
	}

	return json({ media });
});

export const PUT: RequestHandler = requireAuth(async ({ params, request, locals }) => {
	const user = locals.user;

	if (!user.teamId) {
		return json({ error: 'User must belong to a team' }, { status: 403 });
	}

	const body = await request.json();
	const { altText, filename } = body;

	// Validate at least one field is provided
	if (altText === undefined && filename === undefined) {
		return json({ error: 'At least one field (altText or filename) must be provided' }, { status: 400 });
	}

	// Validate altText if provided
	let validatedAltText: string | undefined = undefined;
	if (altText !== undefined) {
		if (typeof altText !== 'string') {
			return json({ error: 'Invalid altText: must be a string' }, { status: 400 });
		}
		if (altText.length > 500) {
			return json({ error: 'altText too long: maximum 500 characters' }, { status: 400 });
		}
		validatedAltText = altText.trim();
	}

	// Validate filename if provided
	let validatedFilename: string | undefined = undefined;
	if (filename !== undefined) {
		if (typeof filename !== 'string') {
			return json({ error: 'Invalid filename: must be a string' }, { status: 400 });
		}
		if (filename.length === 0 || filename.length > 255) {
			return json({ error: 'Invalid filename length: must be 1-255 characters' }, { status: 400 });
		}
		// Basic sanitization: remove path separators and dangerous characters
		const sanitizedFilename = filename.replace(/[/\\<>:"|?*\x00-\x1F]/g, '');
		if (sanitizedFilename !== filename) {
			return json({ error: 'Invalid filename: contains illegal characters' }, { status: 400 });
		}
		validatedFilename = sanitizedFilename.trim();
	}

	const result = await updateMedia(params.id, user.teamId, {
		altText: validatedAltText,
		filename: validatedFilename
	});

	if ('error' in result) {
		return json({ error: result.error }, { status: 404 });
	}

	return json({ media: result.media });
});

export const DELETE: RequestHandler = requireAuth(async ({ params, locals }) => {
	const user = locals.user;

	if (!user.teamId) {
		return json({ error: 'User must belong to a team' }, { status: 403 });
	}

	const result = await deleteMedia(params.id, user.teamId);

	if ('error' in result) {
		return json({ error: result.error }, { status: 404 });
	}

	return json({ success: true });
});
