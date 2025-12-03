import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		fs: {
			allow: [
				// Allow access to worktree node_modules
				path.resolve(__dirname, 'node_modules'),
				// Allow access to parent directory node_modules (for worktree setup)
				path.resolve(__dirname, '../node_modules'),
				// Allow access to root node_modules (for shared dependencies)
				path.resolve(__dirname, '../../node_modules')
			]
		}
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'jsdom',
		globals: true,
		setupFiles: ['./src/tests/setup.ts']
	}
});
