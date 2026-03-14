// src/pages/LoginPage.js
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthProvider'

export default function LoginPage() {
  const navigate = useNavigate()
  const { user, loading, signIn, authError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading && user) {
      navigate('/')
    } else if (!loading && authError && !error) {
      // Only show this if there's an authError on initial mount
      if (authError === 'company-inactive') {
        setError('Your company is inactive. Please contact support if this is correct.')
      } else if (authError === 'user-inactive') {
        setError('Your account is inactive. Please contact your admin.')
      } else if (authError === 'profile-fetch-failed') {
        setError('There was a problem fetching your profile. Try again later or contact us.')
      }
    }
  }, [user, loading, navigate, authError, error])

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')

    const { error } = await signIn(email, password)

    if (error === 'company-inactive') {
      setError('Your company is inactive. Please contact support if this is correct.')
    } else if (error === 'user-inactive') {
      setError('Your account is inactive. Please contact your admin.')
    } else if (error === 'profile-fetch-failed') {
      setError('There was a problem fetching your profile. Try again later or contact us.')
    } else if (error === 'unexpected-error') {
      setError('Unexpected error. Please try again.')
    } else if (error) {
      setError('Invalid credentials, please try again.')
    }
  }

  if (loading) return <p>Loading…</p>

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <h1>Login</h1>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <div className="error">{error}</div>}
        <button type="submit">Log In</button>
      </form>
    </div>
  )
}
