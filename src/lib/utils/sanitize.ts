import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks
 *
 * This utility uses DOMPurify to clean user-generated HTML content
 * before rendering it in the DOM. It removes potentially dangerous
 * elements and attributes while preserving safe formatting.
 *
 * @param html - The HTML string to sanitize
 * @param options - Optional DOMPurify configuration
 * @returns Sanitized HTML string safe for rendering
 *
 * @example
 * ```typescript
 * const userContent = '<p>Hello <script>alert("XSS")</script></p>';
 * const safe = sanitizeHtml(userContent);
 * // Returns: '<p>Hello </p>'
 * ```
 */
export function sanitizeHtml(
	html: string,
	options?: Partial<DOMPurify.Config>
): string {
	const defaultConfig: Partial<DOMPurify.Config> = {
		// Allow common formatting tags
		ALLOWED_TAGS: [
			'p', 'br', 'strong', 'em', 'u', 's', 'a', 'span', 'div',
			'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
			'ul', 'ol', 'li',
			'blockquote', 'code', 'pre',
			'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
		],
		// Allow safe attributes
		ALLOWED_ATTR: [
			'href', 'target', 'rel', 'class', 'style',
			'src', 'alt', 'width', 'height',
			'colspan', 'rowspan'
		],
		// Forbid unsafe URI schemes
		ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
		// Keep all safe HTML entities
		KEEP_CONTENT: true,
		// Return a string (not a DOM node)
		RETURN_DOM: false,
		RETURN_DOM_FRAGMENT: false,
		// Sanitize in-place
		IN_PLACE: false
	};

	const config = options ? { ...defaultConfig, ...options } : defaultConfig;

	// Type assertion needed due to DOMPurify type incompatibilities
	// DOMPurify.sanitize returns TrustedHTML in newer versions, convert to string
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return DOMPurify.sanitize(html, config as any) as unknown as string;
}

/**
 * Sanitize HTML content with stricter rules for text editor content
 *
 * This variant allows only basic text formatting tags and removes
 * potentially dangerous attributes like inline styles and scripts.
 *
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML string with strict rules
 */
export function sanitizeTextContent(html: string): string {
	return sanitizeHtml(html, {
		ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'span', 'a'],
		ALLOWED_ATTR: ['href', 'target', 'rel'],
		ALLOW_DATA_ATTR: false
	});
}

/**
 * Strip all HTML tags from a string, leaving only text content
 *
 * @param html - The HTML string to strip
 * @returns Plain text without any HTML tags
 */
export function stripHtml(html: string): string {
	return DOMPurify.sanitize(html, {
		ALLOWED_TAGS: [],
		ALLOWED_ATTR: [],
		KEEP_CONTENT: true
	});
}
