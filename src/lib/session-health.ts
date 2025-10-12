// Session Health Check Utility
// Helps debug session persistence issues


export interface SessionHealthReport {
  timestamp: string
  mode: 'development' | 'production'
  sessionAuth: {
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
      sessionAuth: {
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

    // Check session auth
    if (typeof window !== 'undefined') {
      const sessionToken = localStorage.getItem('sessionToken')
      report.sessionAuth.hasSession = !!sessionToken
      if (sessionToken) {
        try {
          const decoded = Buffer.from(sessionToken, 'base64').toString('utf-8')
          report.sessionAuth.sessionData = JSON.parse(decoded)
        } catch {
          report.sessionAuth.sessionData = 'Invalid token'
        }
      }
      report.sessionAuth.localStorage = {
        sessionToken: !!localStorage.getItem('sessionToken')
      }
      report.sessionAuth.sessionStorage = {
        sessionToken: !!sessionStorage.getItem('sessionToken')
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
    
    console.group('🔐 Session Auth')
    console.log('Has Session:', report.sessionAuth.hasSession)
    if (report.sessionAuth.sessionData) {
      console.log('User:', report.sessionAuth.sessionData.email)
      if (report.sessionAuth.sessionData.expires) {
        console.log('Expires:', new Date(report.sessionAuth.sessionData.expires))
      }
    }
    console.log('LocalStorage:', report.sessionAuth.localStorage)
    console.log('SessionStorage:', report.sessionAuth.sessionStorage)
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
      if (report.sessionAuth.hasSession) {
        console.log('✅ Session active:', 
          `User: ${report.sessionAuth.sessionData?.email || 'Unknown'}`
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