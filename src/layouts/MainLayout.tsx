import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import AuthModal from '../components/AuthModal'

const baseNavLinks = [
  { to: '/', label: 'Home' },
  { to: '/how-to-view', label: 'How to View' },
  { to: '/how-to-choose', label: 'How to Choose' },
  { to: '/how-to-pay', label: 'How to Pay' },
  { to: '/about', label: 'Primrose Watson' },
]

// Library only makes sense when signed in — unauthenticated users get an
// auth-prompt page otherwise, which is correct but not something to advertise
// in the top nav.
const libraryLink = { to: '/library', label: 'My Library' }

export default function MainLayout() {
  const { user, signOut, loading } = useAuth()
  const [authOpen, setAuthOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const location = useLocation()

  const navLinks = user ? [...baseNavLinks, libraryLink] : baseNavLinks

  // Close the mobile menu whenever the route changes, so tapping a link
  // actually dismisses the overlay instead of leaving it covering the new
  // page. Using the "reset state on prop change" pattern from the React docs
  // (https://react.dev/learn/you-might-not-need-an-effect) instead of an
  // Effect — setState during render is safe and cheaper than scheduling a
  // second commit, and sidesteps the react-hooks/set-state-in-effect lint.
  const [prevPath, setPrevPath] = useState(location.pathname)
  if (prevPath !== location.pathname) {
    setPrevPath(location.pathname)
    setMobileNavOpen(false)
  }

  // Lock body scroll while the mobile menu is open so the backdrop doesn't
  // scroll the underlying page on small screens.
  useEffect(() => {
    if (mobileNavOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [mobileNavOpen])

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-royal-100 bg-white">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <Link
            to="/"
            className="flex-shrink-0 text-sm font-bold text-royal-500 sm:text-xl"
            aria-label="Primrose Knowledge Studio home"
          >
            Primrose Knowledge Studio
          </Link>

          <ul className="hidden gap-6 md:flex">
            {navLinks.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className="text-sm font-medium text-gray-600 transition-colors hover:text-royal-500"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2 sm:gap-3">
            {loading ? (
              <span className="text-xs text-gray-400">…</span>
            ) : user ? (
              <>
                <span className="hidden max-w-[200px] truncate text-xs text-gray-500 md:inline">
                  {user.email}
                </span>
                <button
                  onClick={() => signOut()}
                  className="whitespace-nowrap rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Sign out
                </button>
              </>
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                className="whitespace-nowrap rounded-md bg-royal-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-royal-700 sm:px-4"
              >
                Sign in
              </button>
            )}

            {/* Mobile menu trigger — only visible below md breakpoint */}
            <button
              type="button"
              aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-nav"
              onClick={() => setMobileNavOpen((v) => !v)}
              className="rounded-md p-2 text-gray-700 transition-colors hover:bg-gray-100 md:hidden"
            >
              {mobileNavOpen ? (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </nav>

        {/* Mobile nav drawer — rendered inline under the header for full-width links */}
        {mobileNavOpen && (
          <div
            id="mobile-nav"
            className="border-t border-royal-100 bg-white md:hidden"
          >
            <ul className="mx-auto flex max-w-6xl flex-col px-2 py-2">
              {navLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="block rounded-md px-4 py-3 text-base font-medium text-gray-700 transition-colors hover:bg-royal-50 hover:text-royal-600"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              {user && (
                <li className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
                  Signed in as {user.email}
                </li>
              )}
            </ul>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-royal-100 bg-white py-8 text-center text-sm text-gray-500">
        <div className="mb-4 flex justify-center gap-6">
          <a href="https://www.linkedin.com/in/primrosewatson" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="text-gray-400 transition-colors hover:text-royal-500">
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          </a>
          <a href="https://www.instagram.com/primrosewatson" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-gray-400 transition-colors hover:text-royal-500">
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
          </a>
        </div>
        &copy; {new Date().getFullYear()} Primrose Knowledge Studio. All rights reserved.
      </footer>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        title="Sign in to Primrose Knowledge Studio"
        subtitle="We'll email you a one-click sign-in link — no password needed."
      />
    </div>
  )
}
