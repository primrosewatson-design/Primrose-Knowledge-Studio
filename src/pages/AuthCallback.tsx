import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'working' | 'success' | 'error'>('working')
  const [message, setMessage] = useState('Signing you in…')

  useEffect(() => {
    // Supabase JS v2 automatically parses the URL hash/fragment on client init
    // and stores the session. We just need to wait for it to land.
    let mounted = true
    const run = async () => {
      try {
        // Handle both hash-based (#access_token=...) and code-based (?code=...) callbacks.
        const url = new URL(window.location.href)
        const code = url.searchParams.get('code')
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
        }
        const { data } = await supabase.auth.getSession()
        if (!mounted) return
        if (data.session) {
          // Best-effort: claim any email-matched purchases made before this account existed.
          const uid = data.session.user.id
          const email = data.session.user.email
          if (uid && email) {
            await supabase
              .from('purchases')
              .update({ user_id: uid })
              .is('user_id', null)
              .eq('email', email)
          }
          setStatus('success')
          setMessage('Signed in! Redirecting…')
          setTimeout(() => navigate('/how-to-choose'), 800)
        } else {
          setStatus('error')
          setMessage('Sign-in link expired or invalid. Please request a new one.')
        }
      } catch (err) {
        if (!mounted) return
        setStatus('error')
        setMessage((err as Error).message || 'Could not complete sign-in.')
      }
    }
    run()
    return () => {
      mounted = false
    }
  }, [navigate])

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      {status === 'working' && (
        <>
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-royal-600 border-t-transparent"></div>
          <p className="text-gray-700">{message}</p>
        </>
      )}
      {status === 'success' && (
        <div className="rounded-lg bg-green-50 p-6">
          <div className="mb-2 text-4xl">✅</div>
          <p className="font-semibold text-green-700">{message}</p>
        </div>
      )}
      {status === 'error' && (
        <div className="rounded-lg bg-red-50 p-6">
          <div className="mb-2 text-4xl">⚠️</div>
          <p className="mb-4 text-red-700">{message}</p>
          <Link
            to="/"
            className="inline-block rounded-lg bg-royal-600 px-5 py-2 font-medium text-white hover:bg-royal-700"
          >
            Back to home
          </Link>
        </div>
      )}
    </div>
  )
}
