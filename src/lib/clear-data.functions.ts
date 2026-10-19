import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

// Database-side function performs the account-scoped deletion atomically.
export const clearCrossData = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase.rpc('clear_cross_data');
    if (error) {
      console.error('[Crosscollege] Failed to clear event data:', error.message);
      throw new Error('Les données n’ont pas pu être supprimées. Vérifiez la configuration de la base puis réessayez.');
    }
    return { cleared: true };
  });
