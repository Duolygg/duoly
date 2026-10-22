import { createCleanupHandler } from './handler.ts';

// Ambient type only: production uses the native Supabase Edge/Deno global.
// Keeping it local lets the app's Node TypeScript checks inspect this entry too.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): unknown;
};

Deno.serve(
  createCleanupHandler({
    SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
    // Reserved runtime keys can differ from the native project's legacy JWT.
    // Use the explicitly provisioned project service-role credential for both
    // exact caller authentication and service-only provider operations.
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get(
      'PRIVATE_PROOF_CLEANUP_SERVICE_ROLE_KEY',
    ),
  }),
);
