// @ts-check

import js from '@eslint/js';
import {defineConfig} from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: ['**/dist/**', '**/node_modules/**']
  },
  {
    files: ['**/*.ts'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      tseslint.configs.strict
    ],
    languageOptions: {
      parserOptions: {
        projectService: true
      }
    },
    rules: {
      // Always require === instead of ==.
      eqeqeq: ['warn', 'always', {null: 'never'}],

      // Only allow TypeScript comment annotations if they include a description
      // (i.e. an explanation about why the annotation is there).
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-nocheck': 'allow-with-description',
          'ts-ignore': 'allow-with-description'
        }
      ],

      // Require semicolons.
      semi: 'error',

      // Allow explicit 'any' type.
      // Sometimes it's not worth the hassle to express the types.
      '@typescript-eslint/no-explicit-any': 'off',

      // Don't warn about using the ! operator
      '@typescript-eslint/no-non-null-assertion': 'off',

      // Allow type namespaces
      '@typescript-eslint/no-namespace': 'off',

      // Only allow variables to be unused when they start with underscore.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ]
    }
  },
  {
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/require-await': 'off'
    }
  }
);
