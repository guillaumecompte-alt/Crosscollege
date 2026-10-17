import { useState } from 'react';
import { AlertCircle, Check, LoaderCircle, Lock, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.82-.07-1.6-.21-2.34H12v4.43h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.17 3.57-8.71Z" />
      <path fill="#34A853" d="M12 24c3.21 0 5.9-1.06 7.87-2.88l-3.87-3c-1.07.72-2.44 1.14-4 1.14-3.08 0-5.68-2.08-6.61-4.88H1.4v3.09A11.99 11.99 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.39 14.38A7.2 7.2 0 0 1 5 12c0-.83.14-1.63.39-2.38V6.53H1.4a11.99 11.99 0 0 0 0 10.94l3.99-3.09Z" />
      <path fill="#EA4335" d="M12 4.75c1.75 0 3.32.6 4.56 1.79l3.42-3.42A11.97 11.97 0 0 0 12 0 11.99 11.99 0 0 0 1.4 6.53l3.99 3.09C6.32 6.82 8.92 4.75 12 4.75Z" />
    </svg>
  );
}

export function AuthPanel() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setError('');
    setNotice('');

    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail)) { setError('Indiquez une adresse email valide.'); return; }
    if (password.length < 6) { setError('Le mot de passe doit contenir au moins 6 caractères.'); return; }

    setBusy(true);
    try {
      if (mode === 'in') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (signInError) setError('Email ou mot de passe incorrect. Vérifiez et réessayez.');
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (signUpError) setError('Ce compte existe déjà ou n’a pas pu être créé. Essayez de vous connecter.');
        else if (!data.session) setNotice(`Un message de confirmation part vers ${cleanEmail}. Cliquez sur son lien pour activer votre accès.`);
      }
    } catch {
      setError('Connexion impossible pour le moment. Réessayez dans un instant.');
    } finally {
      setBusy(false);
    }
  }

  async function withGoogle() {
    if (busy) return;
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth('google', { redirect_uri: window.location.origin });
      if (result.error) setError('La connexion Google n’a pas abouti. Réessayez.');
    } catch {
      setError('La connexion Google n’a pas abouti. Réessayez.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-eyebrow"><Lock size={13} /> ACCÈS PROTÉGÉ</div>
        <h2 className="auth-title">{mode === 'in' ? 'Reprenez votre liste' : 'Créez votre accès'}</h2>
        <p className="auth-sub">
          {mode === 'in'
            ? 'La liste des élèves est gardée dans l’appli. Connectez-vous pour la retrouver.'
            : 'Une seule adresse et un mot de passe suffisent. Ils ouvriront toujours le même espace.'}
        </p>

        <div className="auth-tabs" role="tablist" aria-label="Choix de l’écran">
          <button type="button" role="tab" aria-selected={mode === 'in'} className={`auth-tab ${mode === 'in' ? 'active' : ''}`} onClick={() => { setMode('in'); setError(''); setNotice(''); }}>Se connecter</button>
          <button type="button" role="tab" aria-selected={mode === 'up'} className={`auth-tab ${mode === 'up' ? 'active' : ''}`} onClick={() => { setMode('up'); setError(''); setNotice(''); }}>Créer un compte</button>
        </div>

        {error && <div className="auth-error" role="alert"><AlertCircle size={15} className="shrink-0 mt-0.5" /><span>{error}</span></div>}
        {notice && <div className="auth-note"><Check size={15} className="shrink-0 mt-0.5" /><span>{notice}</span></div>}

        <form onSubmit={event => void onSubmit(event)} noValidate>
          <label className="auth-field">Adresse email
            <Input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="prof@college.fr" disabled={busy} />
          </label>
          <label className="auth-field">Mot de passe
            <Input type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} placeholder="6 caractères minimum" disabled={busy} />
          </label>
          <Button type="submit" disabled={busy} className="w-full h-11 mt-1">
            {busy ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />}
            {busy ? 'Un instant…' : mode === 'in' ? 'Ouvrir ma liste' : 'Créer mon accès'}
          </Button>
        </form>

        <div className="auth-divider">ou</div>
        <Button variant="outline" className="auth-google" disabled={busy} onClick={() => void withGoogle()} type="button"><GoogleIcon /> Continuer avec Google</Button>
        <p className="auth-foot"><ShieldCheck size={12} className="inline mr-1 -mt-0.5" />Les noms des élèves ne sont visibles que d’un compte connecté.</p>
      </div>
    </div>
  );
}
