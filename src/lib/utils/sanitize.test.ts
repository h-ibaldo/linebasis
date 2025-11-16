import { describe, it, expect } from 'vitest';
import { sanitizeHtml, sanitizeTextContent, stripHtml } from './sanitize';

describe('sanitizeHtml', () => {
	it('should remove script tags', () => {
		const input = '<p>Hello <script>alert("XSS")</script> World</p>';
		const output = sanitizeHtml(input);
		expect(output).not.toContain('<script>');
		expect(output).not.toContain('alert');
		expect(output).toContain('Hello');
		expect(output).toContain('World');
	});

	it('should remove inline event handlers', () => {
		const input = '<p onclick="alert(\'XSS\')">Click me</p>';
		const output = sanitizeHtml(input);
		expect(output).not.toContain('onclick');
		expect(output).not.toContain('alert');
		expect(output).toContain('Click me');
	});

	it('should allow safe HTML tags', () => {
		const input = '<p><strong>Bold</strong> <em>Italic</em> <u>Underline</u></p>';
		const output = sanitizeHtml(input);
		expect(output).toContain('<strong>');
		expect(output).toContain('<em>');
		expect(output).toContain('<u>');
		expect(output).toContain('Bold');
	});

	it('should allow safe links', () => {
		const input = '<a href="https://example.com">Link</a>';
		const output = sanitizeHtml(input);
		expect(output).toContain('<a href="https://example.com"');
		expect(output).toContain('Link');
	});

	it('should remove javascript: protocol in links', () => {
		const input = '<a href="javascript:alert(\'XSS\')">Click</a>';
		const output = sanitizeHtml(input);
		expect(output).not.toContain('javascript:');
		expect(output).not.toContain('alert');
	});

	it('should allow data: URIs for images (DOMPurify default behavior)', () => {
		// Note: DOMPurify allows data URIs by default as they can be legitimate for inline images
		// This is safe because the image parser won't execute scripts
		const input = '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==">';
		const output = sanitizeHtml(input);
		expect(output).toContain('<img');
		expect(output).toContain('data:image/png');
	});

	it('should preserve empty strings', () => {
		const input = '';
		const output = sanitizeHtml(input);
		expect(output).toBe('');
	});

	it('should handle plain text without HTML', () => {
		const input = 'Just plain text';
		const output = sanitizeHtml(input);
		expect(output).toBe('Just plain text');
	});

	it('should remove iframe tags', () => {
		const input = '<iframe src="https://evil.com"></iframe>';
		const output = sanitizeHtml(input);
		expect(output).not.toContain('<iframe>');
		expect(output).not.toContain('evil.com');
	});

	it('should remove embed and object tags', () => {
		const input = '<embed src="evil.swf"><object data="evil.swf"></object>';
		const output = sanitizeHtml(input);
		expect(output).not.toContain('<embed>');
		expect(output).not.toContain('<object>');
	});

	it('should allow images with safe src', () => {
		const input = '<img src="https://example.com/image.jpg" alt="Test">';
		const output = sanitizeHtml(input);
		expect(output).toContain('<img');
		expect(output).toContain('src="https://example.com/image.jpg"');
		expect(output).toContain('alt="Test"');
	});
});

describe('sanitizeTextContent', () => {
	it('should allow only basic text formatting', () => {
		const input = '<p><strong>Bold</strong> <em>Italic</em></p>';
		const output = sanitizeTextContent(input);
		expect(output).toContain('<strong>');
		expect(output).toContain('<em>');
	});

	it('should remove headings and complex elements', () => {
		const input = '<h1>Title</h1><table><tr><td>Data</td></tr></table>';
		const output = sanitizeTextContent(input);
		expect(output).not.toContain('<h1>');
		expect(output).not.toContain('<table>');
		expect(output).toContain('Title'); // Content preserved
		expect(output).toContain('Data'); // Content preserved
	});

	it('should remove inline styles', () => {
		const input = '<p style="color: red;">Styled text</p>';
		const output = sanitizeTextContent(input);
		expect(output).not.toContain('style=');
		expect(output).toContain('Styled text');
	});

	it('should remove data attributes', () => {
		const input = '<span data-evil="xss">Text</span>';
		const output = sanitizeTextContent(input);
		expect(output).not.toContain('data-evil');
		expect(output).toContain('Text');
	});
});

describe('stripHtml', () => {
	it('should remove all HTML tags', () => {
		const input = '<p><strong>Bold</strong> and <em>italic</em></p>';
		const output = stripHtml(input);
		expect(output).toBe('Bold and italic');
		expect(output).not.toContain('<');
		expect(output).not.toContain('>');
	});

	it('should handle script tags by removing them', () => {
		const input = 'Before <script>alert("XSS")</script> After';
		const output = stripHtml(input);
		expect(output).toBe('Before  After');
		expect(output).not.toContain('script');
		expect(output).not.toContain('alert');
	});

	it('should preserve text content', () => {
		const input = '<div><p>Paragraph 1</p><p>Paragraph 2</p></div>';
		const output = stripHtml(input);
		expect(output).toContain('Paragraph 1');
		expect(output).toContain('Paragraph 2');
	});

	it('should handle empty input', () => {
		const input = '';
		const output = stripHtml(input);
		expect(output).toBe('');
	});

	it('should handle plain text', () => {
		const input = 'Just plain text';
		const output = stripHtml(input);
		expect(output).toBe('Just plain text');
	});
});
