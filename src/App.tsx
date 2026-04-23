import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import MainLayout from './layouts/MainLayout'
import Home from './pages/Home'
import HowToView from './pages/HowToView'
import HowToChoose from './pages/HowToChoose'
import HowToGet from './pages/HowToGet'
import About from './pages/About'
import CheckoutSuccess from './pages/CheckoutSuccess'
import CheckoutCancel from './pages/CheckoutCancel'
import AuthCallback from './pages/AuthCallback'
import Library from './pages/Library'
import GiftRedeem from './pages/GiftRedeem'
import CodeRedeem from './pages/CodeRedeem'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/how-to-view" element={<HowToView />} />
            <Route path="/how-to-choose" element={<HowToChoose />} />
            <Route path="/how-to-pay" element={<HowToGet />} />
            <Route path="/about" element={<About />} />
            <Route path="/library" element={<Library />} />
            <Route path="/gift/:token" element={<GiftRedeem />} />
            <Route path="/code/:code" element={<CodeRedeem />} />
            <Route path="/checkout/success" element={<CheckoutSuccess />} />
            <Route path="/checkout/cancel" element={<CheckoutCancel />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
