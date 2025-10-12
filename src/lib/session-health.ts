// Session Health Check Utility
// Helps debug session persistence issues

import { DevAuth } from './dev-auth'

export interface SessionHealthReport {
  timestamp: string
  mode: 'development' | 'production'
  devAuth: {
    enabled: boolean
    hasSession: boolean
    sessionData: any
    localStorage: any
    sessionStorage: any
  }
  browser: {
    userAgent: string
    localStorage: boolean
    sessionStorage: boolean
  }
}

export class SessionHealthChecker {
  static async generateReport(): Promise<SessionHealthReport> {
    const report: SessionHealthReport = {
      timestamp: new Date().toISOString(),
      mode: process.env.NODE_ENV === 'development' ? 'development' : 'production',
      devAuth: {
        enabled: DevAuth.isDevelopment(),
        hasSession: false,
        sessionData: null,
        localStorage: null,
        sessionStorage: null
      },
      browser: {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
        localStorage: typeof Storage !== 'undefined',
        sessionStorage: typeof Storage !== 'undefined'
      }
    }

    // Check dev auth
    if (typeof window !== 'undefined' && DevAuth.isDevelopment()) {
      report.devAuth.hasSession = DevAuth.isAuthenticated()
      report.devAuth.sessionData = DevAuth.getSession()
      report.devAuth.localStorage = {
        session: localStorage.getItem('dev_auth_session'),
        expiry: localStorage.getItem('dev_auth_expiry')
      }
      report.devAuth.sessionStorage = {
        session: sessionStorage.getItem('dev_auth_session'),
        expiry: sessionStorage.getItem('dev_auth_expiry')
      }
    }


    return report
  }

  static logReport(report?: SessionHealthReport) {
    if (!report) {
      this.generateReport().then(r => this.logReport(r))
      return
    }

    console.group('🔍 Session Health Report')
    console.log('📅 Timestamp:', report.timestamp)
    console.log('⚙️  Mode:', report.mode)
    
    console.group('🛠️  Dev Auth')
    console.log('Enabled:', report.devAuth.enabled)
    console.log('Has Session:', report.devAuth.hasSession)
    if (report.devAuth.sessionData) {
      console.log('User:', report.devAuth.sessionData.email)
    }
    console.log('LocalStorage:', report.devAuth.localStorage)
    console.log('SessionStorage:', report.devAuth.sessionStorage)
    console.groupEnd()
    
    
    console.group('🌐 Browser')
    console.log('LocalStorage Available:', report.browser.localStorage)
    console.log('SessionStorage Available:', report.browser.sessionStorage)
    console.log('User Agent:', report.browser.userAgent.substring(0, 50) + '...')
    console.groupEnd()
    
    console.groupEnd()
  }

  static startMonitoring(intervalMs: number = 10000) {
    if (typeof window === 'undefined') return

    console.log('🔍 Starting session health monitoring...')
    
    const interval = setInterval(async () => {
      const report = await this.generateReport()
      if (report.devAuth.hasSession) {
        console.log('✅ Session active:', 
          report.devAuth.hasSession ? `Dev: ${report.devAuth.sessionData?.email}` : ''
        )
      } else {
        console.log('❌ No active session detected')
      }
    }, intervalMs)

    // Return cleanup function
    return () => {
      console.log('🔍 Stopping session health monitoring')
      clearInterval(interval)
    }
  }
}

// Expose to window for debugging in dev mode
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).sessionHealth = SessionHealthChecker
}