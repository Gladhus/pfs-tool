import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        getComputedStyle: 'readonly',
        confirm: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        MutationObserver: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        HTMLElement: 'readonly',
        gapi: 'readonly',
        google: 'readonly',
        __APP_VERSION__: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'app.js'],
  },
];
