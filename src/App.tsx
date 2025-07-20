import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Toaster } from '@/components/ui/toaster'
import blink from '@/blink/client'
import Header from '@/components/layout/Header'
import HomePage from '@/pages/HomePage'
import Dashboard from '@/pages/Dashboard'
import CreateNegotiation from '@/pages/CreateNegotiation'
import NegotiationDetails from '@/pages/NegotiationDetails'
import AdminDashboard from '@/pages/AdminDashboard'
import LoadingScreen from '@/components/LoadingScreen'

interface User {
  id: string
  email: string
  displayName?: string
  role?: string
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
      setLoading(state.isLoading)
      
      // Create user record if authenticated and doesn't exist
      if (state.user && !state.isLoading) {
        createUserIfNotExists(state.user)
      }
    })
    return unsubscribe
  }, [])

  const createUserIfNotExists = async (authUser: any) => {
    try {
      // Check if user exists by email first (since email has unique constraint)
      const existingUsersByEmail = await blink.db.users.list({
        where: { email: authUser.email }
      })
      
      // If user exists with same email, check if ID matches
      if (existingUsersByEmail.length > 0) {
        const existingUser = existingUsersByEmail[0]
        // If email exists but with different ID, update the existing record
        if (existingUser.id !== authUser.id) {
          await blink.db.users.update(existingUser.id, {
            id: authUser.id,
            displayName: authUser.displayName || authUser.email.split('@')[0]
          })
        }
        return // User already exists, no need to create
      }
      
      // Check by ID as well to be safe
      const existingUsersById = await blink.db.users.list({
        where: { id: authUser.id }
      })
      
      if (existingUsersById.length === 0) {
        await blink.db.users.create({
          id: authUser.id,
          email: authUser.email,
          displayName: authUser.displayName || authUser.email.split('@')[0],
          role: 'user',
          totalNegotiations: 0
        })
      }
    } catch (error) {
      // Only log error if it's not a duplicate constraint error
      if (!error.message?.includes('UNIQUE constraint') && !error.message?.includes('duplicate')) {
        console.error('Error creating user:', error)
      }
    }
  }

  if (loading) {
    return <LoadingScreen />
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Header user={user} />
        <main>
          <Routes>
            <Route path="/" element={<HomePage user={user} />} />
            <Route path="/dashboard" element={<Dashboard user={user} />} />
            <Route path="/create" element={<CreateNegotiation user={user} />} />
            <Route path="/negotiation/:id" element={<NegotiationDetails user={user} />} />
            <Route path="/admin" element={<AdminDashboard user={user} />} />
          </Routes>
        </main>
        <Toaster />
      </div>
    </Router>
  )
}

export default App