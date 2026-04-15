import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import react from 'eslint-plugin-react';
import importPlugin from "eslint-plugin-import";
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';


export default defineConfig([
	globalIgnores(['dist']),
	{
		files: ['**/*.{ts,tsx}'],
		plugins: { import: importPlugin },
		extends: [
			js.configs.recommended,
			...tseslint.configs.recommended,
			react.configs.flat.recommended,
			react.configs.flat['jsx-runtime'],
			reactHooks.configs.flat.recommended,
			reactRefresh.configs.vite,
		],
		settings: { react: { version: 'detect' } },
		languageOptions: {
			ecmaVersion: 2020,
			globals: globals.browser,
			parserOptions: {
				ecmaVersion: 'latest',
				ecmaFeatures: { jsx: true },
				sourceType: 'module',
			},
		},
		rules: {
			'no-unused-vars': 'off',
			"@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
			"no-console": ["error", { "allow": ["warn", "error"] }],
			"indent": ["error", "tab"],
			"semi": ["error", "always"],
			"import/no-unused-modules": ["error", { "unusedExports": true }],
			"import/no-absolute-path": "error",
		},
	},
])
