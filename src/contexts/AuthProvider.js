import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../relationship/supabaseConfig'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  async function fetchProfileAndCompany(sessionUser) {
    const userId = sessionUser?.id
    if (!userId) {
      setUser(null)
      setProfile(null)
      setCompany(null)
      setAuthError('no-session')
      return 'no-session'
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (profileError || !profileData) {
      setUser(null)
      setProfile(null)
      setCompany(null)
      setAuthError('profile-fetch-failed')
      return 'profile-fetch-failed'
    }

    if (!profileData.active) {
      setUser(null)
      setProfile(null)
      setCompany(null)
      setAuthError('user-inactive')
      return 'user-inactive'
    }

    const { data: companyData, error: companyError } = await supabase
      .from('current_company_versions')
      .select('*')
      .eq('company_id', profileData.company_id)
      .maybeSingle()

    if (companyError || !companyData || companyData.active === false) {
      setUser(null)
      setProfile(null)
      setCompany(null)
      setAuthError('company-inactive')
      return 'company-inactive'
    }

    // ✅ All good
    setUser(sessionUser)
    setProfile(profileData)
    setCompany(companyData)
    setAuthError(null)
    return null
  }

  useEffect(() => {
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const sessionUser = session?.user ?? null

      if (sessionUser) {
        await fetchProfileAndCompany(sessionUser)
      } else {
        setUser(null)
        setProfile(null)
        setCompany(null)
        setAuthError(null)
      }

      setLoading(false)
    }

    initSession()

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const newUser = session?.user ?? null;
        if (newUser) {
          fetchProfileAndCompany(newUser);
        } else {
          setUser(null); setProfile(null); setCompany(null); setAuthError(null);
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe()
    }
  }, []) // ✅ Only run once on mount

  const signIn = async (email, password) => {
    const result = await supabase.auth.signInWithPassword({ email, password })

    if (result.data?.session?.user) {
      const inactiveReason = await fetchProfileAndCompany(result.data.session.user)
      return { error: inactiveReason || result.error }
    }

    return { error: result.error?.message || 'invalid-credentials' }
  }

  const signOut = () => {
    setUser(null)
    setProfile(null)
    setCompany(null)
    setAuthError(null)
    return supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, profile, company, loading, signIn, signOut, authError }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
