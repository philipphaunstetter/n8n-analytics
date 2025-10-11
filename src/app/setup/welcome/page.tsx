'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function WelcomePage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to admin setup since we're removing the welcome screen
    router.replace('/setup/admin')
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to setup...</p>
      </div>
    </div>
  )
}
