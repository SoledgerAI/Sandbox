import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: ['node_modules/', 'dist/', 'babel.config.js', 'metro.config.js', 'jest.setup.js', 'jest.setup.afterenv.js', 'app.config.ts'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // Only enable standard hooks rules — project does not use React Compiler
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Align with existing codebase patterns
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off', // pervasive in test mocks and API boundaries
      '@typescript-eslint/no-require-imports': 'off', // jest tests use require()
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
);
