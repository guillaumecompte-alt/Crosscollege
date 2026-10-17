import { CloudOff, LoaderCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useOfflineSync } from '@/lib/offline';

export function OfflineBanner() {
  const { session } = useAuth();
  const status = useOfflineSync(session?.user.id);
  if (status.online && !status.pending) return null;
  return (
    <div className="page-container">
      <div className="offline-banner" role="status">
        {status.online
          ? <LoaderCircle size={15} className="animate-spin shrink-0" />
          : <CloudOff size={15} className="shrink-0" />}
        <span>
          {status.online
            ? `Synchronisation de ${status.pending} modification${status.pending > 1 ? 's' : ''} enregistrée${status.pending > 1 ? 's' : ''} hors connexion…`
            : `Hors connexion — vous consultez la copie enregistrée sur cet ordinateur.${status.pending ? ` ${status.pending} modification${status.pending > 1 ? 's' : ''} en attente de synchronisation.` : ''}`}
        </span>
      </div>
    </div>
  );
}
