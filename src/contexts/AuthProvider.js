import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../relationship/supabaseConfig';
import { authErrorMessage } from '../utils/passwordPolicy';

const AuthContext = createContext();

/** Does this session still need a second factor (TOTP) before data is available? */
async function needsMfa() {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return false;
  return data.nextLevel === 'aal2' && data.currentLevel !== 'aal2';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [mfaPending, setMfaPending] = useState(false);
  const loadingRef = useRef(null);

  const clear = useCallback((reason = null) => {
    setUser(null);
    setProfile(null);
    setCompany(null);
    setAuthError(reason);
  }, []);

  /** Resolves the signed-in user's profile + company. Returns an error code or null. */
  const hydrate = useCallback(
    async sessionUser => {
      if (!sessionUser) {
        clear('no-session');
        return 'no-session';
      }
      if (await needsMfa()) {
        setMfaPending(true);
        clear(null);
        return 'mfa-required';
      }
      setMfaPending(false);

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', sessionUser.id)
        .maybeSingle();
      if (profileError || !profileData) {
        // the session may have ended while we were fetching (e.g. sign-out after a password reset)
        const { data: { session: still } } = await supabase.auth.getSession();
        if (!still?.user) {
          clear(null);
          return 'no-session';
        }
        clear('profile-fetch-failed');
        return 'profile-fetch-failed';
      }
      if (!profileData.active) {
        clear('user-inactive');
        return 'user-inactive';
      }
      const { data: companyData, error: companyError } = await supabase
        .from('current_company_versions')
        .select('*')
        .eq('company_id', profileData.company_id)
        .maybeSingle();
      if (companyError || !companyData || companyData.company_active === false) {
        clear('company-inactive');
        return 'company-inactive';
      }
      setUser(sessionUser);
      setProfile(profileData);
      setCompany(companyData);
      setAuthError(null);
      return null;
    },
    [clear]
  );

  // serialise hydrations so auth events don't race each other
  const hydrateOnce = useCallback(
    sessionUser => {
      const run = (loadingRef.current || Promise.resolve()).then(() => hydrate(sessionUser));
      loadingRef.current = run.catch(() => {});
      return run;
    },
    [hydrate]
  );

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) await hydrateOnce(session.user);
      else clear(null);
      setLoading(false);
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        setMfaPending(false);
        clear(null);
        return;
      }
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || event === 'MFA_CHALLENGE_VERIFIED') {
        // let supabase-js finish its own work before querying
        setTimeout(() => hydrateOnce(session.user), 0);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [clear, hydrateOnce]);

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data?.session?.user) return { error: authErrorMessage(error) };
    return { error: await hydrateOnce(data.session.user) };
  };

  /** Complete the TOTP second factor for the current session. */
  const verifyMfa = async code => {
    const { data: factors, error: fErr } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp?.find(f => f.status === 'verified');
    if (fErr || !factor) return { error: 'No authenticator app is set up for this account.' };
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (error) return { error: 'That code isn’t valid. Check your authenticator app and try again.' };
    const { data: { user: u } } = await supabase.auth.getUser();
    return { error: await hydrateOnce(u) };
  };

  const signOut = async () => {
    setMfaPending(false);
    clear(null);
    return supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, company, loading, authError, mfaPending, signIn, signOut, verifyMfa }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
