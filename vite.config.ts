import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const tailwindcss = require('@tailwindcss/vite').default;

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()]
});
