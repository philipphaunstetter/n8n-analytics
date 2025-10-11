// Development Authentication
// Simple placeholder auth for development/demo purposes

export interface DevUser {
  id: string
  email: string
  name: string
  role: 'admin' | 'user'
}

const DEV_USERS: Record<string, { password: string; user: DevUser }> = {
  'admin@test.com': {
    password: '1234',
    user: {
      id: 'dev-admin-001',
      email: 'admin@test.com',
      name: 'Admin User',
      role: 'admin'
    }
  },
  'demo@test.com': {
    password: 'demo',
    user: {
      id: 'dev-demo-001', 
      email: 'demo@test.com',
      name: 'Demo User',
      role: 'user'
    }
  },
  // Keep backward compatibility with username-only logins
  'admin': {
    password: '1234',
    user: {
      id: 'dev-admin-001',
      email: 'admin@test.com',
      name: 'Admin User',
      role: 'admin'
    }
  },
  'demo': {
    password: 'demo',
    user: {
      id: 'dev-demo-001', 
      email: 'demo@test.com',
      name: 'Demo User',
      role: 'user'
    }
  }
}

/**
 * Simple development authentication
 * Only works when NODE_ENV is development
 */
export class DevAuth {
  private static SESSION_KEY = 'dev_auth_session'

  static isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development' && 
           process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH === 'true'
  }

  static authenticate(username: string, password: string): DevUser | null {
    if (!this.isDevelopment()) {
      return null
    }

    const userEntry = DEV_USERS[username.toLowerCase()]
    if (!userEntry || userEntry.password !== password) {
      return null
    }

    return userEntry.user
  }

  static setSession(user: DevUser): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(user))
    }
  }

  static getSession(): DevUser | null {
    if (!this.isDevelopment() || typeof window === 'undefined') {
      return null
    }

    const sessionData = localStorage.getItem(this.SESSION_KEY)
    if (!sessionData) {
      return null
    }

    try {
      return JSON.parse(sessionData)
    } catch {
      return null
    }
  }

  static clearSession(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.SESSION_KEY)
    }
  }

  static isAuthenticated(): boolean {
    return this.getSession() !== null
  }
}