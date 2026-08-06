import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import { HomeRedirect } from './pages/HomeRedirect'
import { AuthPage } from './pages/AuthPage'
import { PassportPage } from './pages/PassportPage'
import { NewJourneyPage } from './pages/NewJourneyPage'
import { JourneyPage } from './pages/JourneyPage'
import './index.css'

const qc = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/p/:username" element={<PassportPage />} />
            <Route path="/nova-viagem" element={<NewJourneyPage />} />
            <Route path="/v/:slug" element={<JourneyPage mode="view" />} />
            <Route path="/v/:slug/edit" element={<JourneyPage mode="edit" />} />
          </Routes>
        </BrowserRouter>
        <Toaster
          position="top-center"
          toastOptions={{
            className: 'lume-toast',
            duration: 3200,
            success: {
              iconTheme: { primary: '#2F6F73', secondary: '#F7F1E6' },
            },
            error: {
              iconTheme: { primary: '#8B3A2A', secondary: '#F7F1E6' },
            },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  )
}
