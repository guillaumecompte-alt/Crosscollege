import { Link } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, Flag, Lock, LogOut, Timer, Trophy, Trash2 } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { clearCrossData } from '@/lib/clear-data.functions';

export function AppHeader({ session, active }: { session: Session | null; active: 'import' | 'course' | 'results' }) {
  const email = session?.user.email ?? '';
  const queryClient = useQueryClient();
  const clearData = useServerFn(clearCrossData);
  async function handleClearData() {
    if (!session || !navigator.onLine) { toast.error('Connectez-vous à Internet avant de supprimer les données.'); return; }
    const confirmed = window.confirm('Effacer toutes les données de votre cross ?\n\nCela supprimera la liste des élèves, les courses, les pointages et les résultats de votre compte. Cette action est irréversible.');
    if (!confirmed) return;
    try {
      await clearData();
      try { window.localStorage.removeItem('cross-offline:' + session.user.id); } catch { /* storage may be unavailable */ }
      await queryClient.invalidateQueries();
      toast.success('Les données du cross ont été supprimées.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'La suppression a échoué. Réessayez.'); }
  }
  return <header className="site-header bg-card border-b border-border">
    <div className="page-container flex items-center justify-between gap-4 py-5">
      <Link to="/" className="flex items-center gap-3" aria-label="Cross du collège, accueil"><span className="brand-icon"><Flag size={23} strokeWidth={2.3} /></span><div className="leading-tight"><span className="brand-title">CROSS<span className="text-primary">.</span></span><span className="block text-[11px] font-semibold text-muted-foreground mt-1">DU COLLÈGE</span></div></Link>
      {session ? <div className="flex items-center gap-2 min-w-0 flex-wrap justify-end">
        <span className="account-chip" title={email}><Lock size={12} className="shrink-0" />{email}</span>
        <Button variant="outline" size="sm" className="text-destructive shrink-0" onClick={() => void handleClearData()}><Trash2 />Effacer les données</Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground shrink-0" onClick={() => void supabase.auth.signOut()}><LogOut />Se déconnecter</Button>
      </div> : <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><span className="status-dot" /><span>Édition 2026</span></div>}
    </div>
    <nav className="page-container flex gap-5 sm:gap-10" aria-label="Étapes du cross">
      <Button asChild variant="ghost" className={`nav-tab ${active === 'import' ? 'active' : ''}`}><Link to="/"><FileSpreadsheet /><span>Import Liste</span><span className="step-number">01</span></Link></Button>
      <Button asChild variant="ghost" className={`nav-tab ${active === 'course' ? 'active' : ''}`}><Link to="/course"><Timer /><span>Course</span><span className="step-number">02</span></Link></Button>
      <Button asChild variant="ghost" className={`nav-tab ${active === 'results' ? 'active' : ''}`}><Link to="/resultats"><Trophy /><span>Résultats</span><span className="step-number">03</span></Link></Button>
    </nav>
  </header>;
}
