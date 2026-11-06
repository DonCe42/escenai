import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * La regla de frontera de la arquitectura hexagonal, convertida en error de lint.
 *
 * `packages/core` es el núcleo: no puede depender de frameworks, SDKs de proveedor,
 * APIs del sistema operativo ni de los otros paquetes del monorepo.
 * Si esto se relaja, la arquitectura se degrada en dos semanas.
 */
const CORE_FORBIDDEN = [
  {
    group: ['next', 'next/*', 'react', 'react-dom', 'react/*'],
    message: 'core/ no puede depender de frameworks de UI. Mueve eso a apps/web.',
  },
  {
    group: ['@supabase/*', '@google/*', '@google/genai', 'openai', 'remotion', 'remotion/*'],
    message: 'core/ no puede depender de SDKs de proveedor. Eso vive en packages/adapters.',
  },
  {
    group: ['node:*', 'fs', 'path', 'crypto', 'os', 'child_process', 'http', 'https'],
    message: 'core/ debe ser independiente del runtime. La E/S vive en los adaptadores.',
  },
  {
    group: ['@escenai/adapters', '@escenai/web'],
    message: 'core/ no puede importar capas superiores. Las dependencias apuntan hacia dentro.',
  },
  {
    group: ['axios', 'node-fetch', 'undici'],
    message: 'core/ no hace red. Define un puerto y impleméntalo en adapters/.',
  },
];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '.next/**',
      '**/.next/**',
      '**/dist/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/.data/**',
      'next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mjs'],
    rules: {
      'no-undef': 'off',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Los scripts de línea de comandos sí hablan por consola: es su interfaz.
    files: ['**/scripts/**/*.mjs', '**/remotion.config.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/triple-slash-reference': 'off',
    },
  },
  {
    files: ['packages/core/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: CORE_FORBIDDEN }],
    },
  },
);
