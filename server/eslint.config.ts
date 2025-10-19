import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import jsdoc from 'eslint-plugin-jsdoc';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json'
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      jsdoc
    },
    rules: {
      // JSDoc Requirements
      'jsdoc/require-jsdoc': [
        'error',
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: true,
            FunctionExpression: true
          },
          exemptEmptyFunctions: false,
          exemptEmptyConstructors: false,
          enableFixer: true,
          contexts: [
            'ExportNamedDeclaration > FunctionDeclaration',
            'ExportDefaultDeclaration > FunctionDeclaration',
            'ExportNamedDeclaration > ArrowFunctionExpression',
            'VariableDeclarator > ArrowFunctionExpression'
          ]
        }
      ],
      'jsdoc/require-description': [
        'error',
        {
          contexts: ['any']
        }
      ],
      'jsdoc/require-param': 'error',
      'jsdoc/require-param-description': 'error',
      'jsdoc/require-param-type': 'off',
      'jsdoc/require-returns': [
        'error',
        {
          forceRequireReturn: false,
          forceReturnsWithAsync: true
        }
      ],
      'jsdoc/require-returns-description': 'error',
      'jsdoc/require-returns-type': 'off',

      // JSDoc Quality Rules
      'jsdoc/check-alignment': 'error',
      'jsdoc/check-indentation': 'off',
      'jsdoc/check-syntax': 'error',
      'jsdoc/check-tag-names': 'error',
      'jsdoc/check-types': 'off',
      'jsdoc/no-undefined-types': 'off',
      'jsdoc/valid-types': 'off',

      // JSDoc Style Rules
      'jsdoc/multiline-blocks': 'error',
      'jsdoc/no-multi-asterisks': 'error',
      'jsdoc/require-asterisk-prefix': 'error',
      'jsdoc/tag-lines': ['error', 'never', {startLines: 1}],

      // Educational Code Quality
      'jsdoc/require-example': [
        'warn',
        {
          contexts: [
            'ExportNamedDeclaration > FunctionDeclaration',
            'ExportDefaultDeclaration > FunctionDeclaration'
          ],
          exemptedBy: ['override', 'inheritdoc']
        }
      ]
    }
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/test/**/*.ts'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly'
      }
    },
    rules: {
      'jsdoc/require-jsdoc': 'off',
      'jsdoc/require-example': 'off',
      'no-unused-vars': 'off',
      'no-undef': 'off'
    }
  },
  {
    files: ['src/core/types/*.ts'],
    rules: {
      'jsdoc/require-jsdoc': 'warn',
      'jsdoc/require-example': 'off'
    }
  },
  {
    files: ['src/core/utilities/errorCodes.ts'],
    rules: {
      'jsdoc/require-example': 'off'
    }
  }
];