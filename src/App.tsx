import { BrowserRouter, Routes, Route } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import Home from './pages/Home'
import HowToView from './pages/HowToView'
import HowToChoose from './pages/HowToChoose'
import HowToGet from './pages/HowToGet'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/how-to-view" element={<HowToView />} />
          <Route path="/how-to-choose" element={<HowToChoose />} />
          <Route path="/how-to-get" element={<HowToGet />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
