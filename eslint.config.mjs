import typeScriptParser from '@typescript-eslint/parser';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';

const baseConfig = [
  {
    plugins: {
      // @ts-ignore the plugin's type signature doesn't match but works anyway
      '@typescript-eslint': typescriptPlugin
    }
  },
  {
    ignores: ['**/dist/**', '**/node_modules/**']
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: typeScriptParser,
      parserOptions: {
        sourceType: 'module',
        ecmaVersion: 'latest',
        projectService: true
      }
    },
    rules: {
      ...typescriptPlugin.configs['eslint-recommended'].rules,
      ...typescriptPlugin.configs['recommended'].rules,
      ...typescriptPlugin.configs['recommended-requiring-type-checking'].rules,
      ...typescriptPlugin.configs['strict'].rules,

      /*
       * Always require === instead of ==.
       */
      eqeqeq: ['warn', 'always', {null: 'never'}],

      /*
       * Only allow TypeScript comment annotations if they include a description
       * (i.e. an explanation about why the annotation is there).
       */
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-nocheck': 'allow-with-description',
          'ts-ignore': 'allow-with-description'
        }
      ],

      /*
       * Require semicolons.
       */
      semi: 'error',

      /*
       * Allow explicit 'any' type.
       * Sometimes it's not worth the hassle to express the types.
       */
      '@typescript-eslint/no-explicit-any': 'off',

      // Don't warn about using the ! operator
      '@typescript-eslint/no-non-null-assertion': 'off',

      // Allow type namespaces
      '@typescript-eslint/no-namespace': 'off',

      /*
       * Only allow variables to be unused when they start with underscore.
       */
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
    // For test sources
    files: ['test/**'],
    rules: {
      // Don't warn about using the ! operator
      '@typescript-eslint/no-non-null-assertion': 'off',

      // Don't warn if an async function doesn't have await
      '@typescript-eslint/require-await': 'off'
    }
  }
];

/**
 * @return {import('eslint-define-config').FlatESLintConfig[]}
 */
export default baseConfig;
