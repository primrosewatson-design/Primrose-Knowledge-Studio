import { Link, Outlet } from 'react-router-dom'

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/how-to-view', label: 'How to View' },
  { to: '/how-to-choose', label: 'How to Choose' },
  { to: '/how-to-get', label: 'How to Get' },
]

export default function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-royal-100 bg-white">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="text-xl font-bold text-royal-500">
            Primrose Knowledge Studio
          </Link>
          <ul className="flex gap-6">
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
        </nav>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-royal-100 bg-white py-8 text-center text-sm text-gray-500">
        &copy; {new Date().getFullYear()} Primrose Knowledge Studio. All rights reserved.
      </footer>
    </div>
  )
}
