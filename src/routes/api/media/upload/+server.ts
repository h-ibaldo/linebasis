/**
 * POST /api/media/upload - Upload media file
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/middleware/auth';
import { uploadMedia } from '$lib/server/services/media';

export const POST: RequestHandler = requireAuth(async ({ request, locals }) => {
	const user = locals.user;

	if (!user.teamId) {
		return json({ error: 'User must belong to a team' }, { status: 403 });
	}

	try {
		const formData = await request.formData();
		const file = formData.get('file');
		const altText = formData.get('altText');

		// Validate file exists
		if (!file) {
			return json({ error: 'No file provided' }, { status: 400 });
		}

		// Validate file is actually a File instance
		if (!(file instanceof File)) {
			return json({ error: 'Invalid file format' }, { status: 400 });
		}

		// Validate file has required properties
		if (!file.name || !file.type || file.size === undefined) {
			return json({ error: 'Invalid file: missing required properties' }, { status: 400 });
		}

		// Validate file type (must be image or video)
		const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'video/mp4', 'video/webm'];
		if (!validTypes.includes(file.type)) {
			return json({
				error: `Invalid file type: ${file.type}. Allowed types: images (JPEG, PNG, GIF, WebP, SVG) and videos (MP4, WebM)`
			}, { status: 400 });
		}

		// Validate file size (max 50MB)
		const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
		if (file.size > MAX_FILE_SIZE) {
			return json({
				error: `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum allowed: 50MB`
			}, { status: 400 });
		}

		// Validate altText if provided
		let validatedAltText: string | undefined = undefined;
		if (altText) {
			if (typeof altText !== 'string') {
				return json({ error: 'Invalid altText: must be a string' }, { status: 400 });
			}
			// Limit length and sanitize
			if (altText.length > 500) {
				return json({ error: 'altText too long: maximum 500 characters' }, { status: 400 });
			}
			validatedAltText = altText.trim();
		}

		const result = await uploadMedia({
			file,
			userId: user.id,
			teamId: user.teamId,
			altText: validatedAltText
		});

		if ('error' in result) {
			return json({ error: result.error }, { status: 400 });
		}

		return json({ media: result.media }, { status: 201 });
	} catch (error) {
		console.error('Upload error:', error);
		return json({ error: 'Failed to upload file' }, { status: 500 });
	}
});
