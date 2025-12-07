/**
 * Design Token Types
 * Global design system tokens for colors, typography, spacing, effects
 */

export interface ColorTokens {
	primary: string;
	secondary: string;
	accent: string;
	text: string;
	textMuted: string;
	background: string;
	backgroundAlt: string;
	border: string;
	error: string;
	warning: string;
	success: string;
}

export interface TypographyToken {
	fontFamily: string;
	fontSize: string;
	fontWeight: string;
	lineHeight: string;
	letterSpacing?: string;
}

export interface TypographyTokens {
	heading1: TypographyToken;
	heading2: TypographyToken;
	heading3: TypographyToken;
	heading4: TypographyToken;
	heading5: TypographyToken;
	heading6: TypographyToken;
	body: TypographyToken;
	caption: TypographyToken;
	small: TypographyToken;
}

export interface SpacingTokens {
	baseUnit: number; // Base spacing unit in px (e.g., 4 or 8)
	xs: string; // Extra small
	sm: string; // Small
	md: string; // Medium
	lg: string; // Large
	xl: string; // Extra large
	'2xl': string;
	'3xl': string;
	'4xl': string;
}

export interface EffectTokens {
	borderRadius: {
		none: string;
		sm: string;
		md: string;
		lg: string;
		full: string;
	};
	shadow: {
		none: string;
		sm: string;
		md: string;
		lg: string;
		xl: string;
	};
	transition: {
		fast: string;
		base: string;
		slow: string;
	};
}

export interface BaselineTokens {
	gridUnit: number; // Baseline grid unit in px (e.g., 8)
	lineHeightMultiplier: number; // Multiplier for line heights (e.g., 1.5)
}

export interface DesignTokens {
	colors: ColorTokens;
	typography: TypographyTokens;
	spacing: SpacingTokens;
	effects: EffectTokens;
	baseline: BaselineTokens;
}

/**
 * Default design tokens (Modern theme)
 */
export const defaultTokens: DesignTokens = {
	colors: {
		primary: '#3B82F6', // Blue
		secondary: '#10B981', // Green
		accent: '#F59E0B', // Orange
		text: '#1F2937', // Dark gray
		textMuted: '#6B7280', // Medium gray
		background: '#FFFFFF', // White
		backgroundAlt: '#F9FAFB', // Light gray
		border: '#E5E7EB', // Light gray
		error: '#EF4444', // Red
		warning: '#F59E0B', // Orange
		success: '#10B981' // Green
	},
	typography: {
		heading1: {
			fontFamily: 'system-ui, sans-serif',
			fontSize: '2.25rem', // 36px
			fontWeight: '700',
			lineHeight: '2.5rem'
		},
		heading2: {
			fontFamily: 'system-ui, sans-serif',
			fontSize: '1.875rem', // 30px
			fontWeight: '700',
			lineHeight: '2.25rem'
		},
		heading3: {
			fontFamily: 'system-ui, sans-serif',
			fontSize: '1.5rem', // 24px
			fontWeight: '600',
			lineHeight: '2rem'
		},
		heading4: {
			fontFamily: 'system-ui, sans-serif',
			fontSize: '1.25rem', // 20px
			fontWeight: '600',
			lineHeight: '1.75rem'
		},
		heading5: {
			fontFamily: 'system-ui, sans-serif',
			fontSize: '1.125rem', // 18px
			fontWeight: '600',
			lineHeight: '1.75rem'
		},
		heading6: {
			fontFamily: 'system-ui, sans-serif',
			fontSize: '1rem', // 16px
			fontWeight: '600',
			lineHeight: '1.5rem'
		},
		body: {
			fontFamily: 'system-ui, sans-serif',
			fontSize: '1rem', // 16px
			fontWeight: '400',
			lineHeight: '1.5rem'
		},
		caption: {
			fontFamily: 'system-ui, sans-serif',
			fontSize: '0.875rem', // 14px
			fontWeight: '400',
			lineHeight: '1.25rem'
		},
		small: {
			fontFamily: 'system-ui, sans-serif',
			fontSize: '0.75rem', // 12px
			fontWeight: '400',
			lineHeight: '1rem'
		}
	},
	spacing: {
		baseUnit: 4,
		xs: '0.25rem', // 4px
		sm: '0.5rem', // 8px
		md: '1rem', // 16px
		lg: '1.5rem', // 24px
		xl: '2rem', // 32px
		'2xl': '3rem', // 48px
		'3xl': '4rem', // 64px
		'4xl': '6rem' // 96px
	},
	effects: {
		borderRadius: {
			none: '0',
			sm: '0.125rem', // 2px
			md: '0.375rem', // 6px
			lg: '0.5rem', // 8px
			full: '9999px'
		},
		shadow: {
			none: 'none',
			sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
			md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
			lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
			xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)'
		},
		transition: {
			fast: 'all 150ms ease',
			base: 'all 250ms ease',
			slow: 'all 350ms ease'
		}
	},
	baseline: {
		gridUnit: 8,
		lineHeightMultiplier: 1.5
	}
};
