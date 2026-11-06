// Dominio
export * from './domain/video-plan';
export * from './domain/project';
export * from './domain/script-project';
export * from './domain/plan-validator';
export * from './domain/scene-timing';
export * from './domain/cost-estimator';
export * from './domain/result';
export * from './domain/word-timing';
export * from './domain/errors';

// Puertos
export * from './application/ports/index';
export type { ProjectRepositoryPort } from './application/ports/project-repository.port';

// Casos de uso
export * from './application/use-cases/generate-script';
export * from './application/use-cases/compact-script';
export * from './application/use-cases/save-plan';

// Prompts (versionados con el contrato)
export * from './application/prompts/script-prompt';
export * from './application/prompts/compact-prompt';
export * from './application/prompts/default-style-token';
