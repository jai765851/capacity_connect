export interface AppIntegrationConfig {
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  isSupabaseConfigured: boolean;
  environmentLabel: 'Supabase Not Configured' | 'Supabase Connected';
}

export interface ServerHealthStatus {
  status: string;
  supabaseClientConfigured: boolean;
  supabaseAdminConfigured: boolean;
  bootstrapConfigured: boolean;
  databaseSchemaReady: boolean;
  competencyScoringEngineReady?: boolean;
  trainingWorkflowSchemaReady?: boolean;
  hasAdminAccount: boolean | null;
}

export function getAppIntegrationConfig(): AppIntegrationConfig {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || null;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || null;
  const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

  return {
    supabaseUrl,
    supabaseAnonKey,
    isSupabaseConfigured,
    environmentLabel: isSupabaseConfigured
      ? 'Supabase Connected'
      : 'Supabase Not Configured',
  };
}

export async function fetchServerHealthStatus(): Promise<ServerHealthStatus | null> {
  try {
    const response = await fetch('/api/health');
    if (!response.ok) return null;
    return (await response.json()) as ServerHealthStatus;
  } catch {
    return null;
  }
}
