import type { AppMode } from './container';

export interface WorkspaceContext {
  readonly id: string;
  readonly mode: AppMode;
}

export const DEMO_WORKSPACE_ID = 'demo-local';

/** Fase 0: un workspace fijo por proceso. La sesión de Supabase entra en el siguiente paso. */
export async function getWorkspace(): Promise<WorkspaceContext> {
  return { id: DEMO_WORKSPACE_ID, mode: 'demo' };
}
