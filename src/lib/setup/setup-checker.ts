import { configProvider } from '@/lib/config/config-provider'
import fs from 'fs'
import path from 'path'

export interface SetupStatus {
  isComplete: boolean
  completedSteps: {
    database: boolean
    adminAccount: boolean
    basicConfiguration: boolean
    integrations: boolean
  }
  nextStep: 'welcome' | 'admin' | 'database' | 'integrations' | 'complete'
  requiresSetup: boolean
}

/**
 * Service to check setup completion status
 */
export class SetupChecker {
  private static instance: SetupChecker | null = null

  static getInstance(): SetupChecker {
    if (!SetupChecker.instance) {
      SetupChecker.instance = new SetupChecker()
    }
    return SetupChecker.instance
  }

  /**
   * Check overall setup status
   */
  async checkSetupStatus(): Promise<SetupStatus> {
    try {
      const completedSteps = {
        database: await this.isDatabaseSetup(),
        adminAccount: await this.isAdminAccountSetup(),
        basicConfiguration: await this.isBasicConfigurationSetup(),
        integrations: await this.areIntegrationsSetup()
      }

      const isComplete = Object.values(completedSteps).every(step => step)
      const nextStep = this.getNextStep(completedSteps)
      const requiresSetup = !isComplete

      return {
        isComplete,
        completedSteps,
        nextStep,
        requiresSetup
      }
    } catch (error) {
      console.error('Failed to check setup status:', error)
      // On error, assume setup is required
      return {
        isComplete: false,
        completedSteps: {
          database: false,
          adminAccount: false,
          basicConfiguration: false,
          integrations: false
        },
        nextStep: 'welcome',
        requiresSetup: true
      }
    }
  }

  /**
   * Check if this is the first run of the application
   */
  async isFirstRun(): Promise<boolean> {
    try {
      // Check for first run marker files
      const markerPaths = [
        '/app/data/.initialized',
        path.join(process.cwd(), 'data', '.initialized'),
        path.join(process.cwd(), '.initialized')
      ]

      for (const markerPath of markerPaths) {
        if (fs.existsSync(markerPath)) {
          // Check if setup was completed after initialization
          const setupComplete = await this.isSetupComplete()
          return !setupComplete
        }
      }

      return true // No marker found, definitely first run
    } catch (error) {
      console.error('Failed to check first run status:', error)
      return true // On error, assume first run
    }
  }

  /**
   * Mark setup as complete
   */
  async markSetupComplete(): Promise<void> {
    try {
      // Set both completion flags for compatibility
      await configProvider.set(
        'app.setup_completed',
        true,
        'Setup wizard completed successfully'
      )
      
      await configProvider.set(
        'app.initDone',
        true,
        'Application initialization completed'
      )

      await configProvider.set(
        'app.setup_completed_at',
        new Date().toISOString(),
        'Setup completion timestamp'
      )

      console.log('Setup marked as complete')
    } catch (error) {
      console.error('Failed to mark setup as complete:', error)
      throw error
    }
  }

  /**
   * Get setup progress percentage
   */
  async getSetupProgress(): Promise<number> {
    const status = await this.checkSetupStatus()
    const completedCount = Object.values(status.completedSteps).filter(Boolean).length
    const totalSteps = Object.keys(status.completedSteps).length
    return Math.round((completedCount / totalSteps) * 100)
  }

  // Private helper methods

  private async isSetupComplete(): Promise<boolean> {
    try {
      // Check both possible completion flags
      const setupCompleted = await configProvider.get<string>('app.setup_completed')
      const initDone = await configProvider.get<string>('app.initDone')
      return setupCompleted === 'true' || initDone === 'true'
    } catch (error) {
      return false
    }
  }

  private async isDatabaseSetup(): Promise<boolean> {
    try {
      // Check if database configuration exists and is valid
      const dbConfig = await configProvider.getDatabaseConfig()
      
      if (dbConfig.type === 'sqlite') {
        // For SQLite, check if database file exists
        const dbPath = dbConfig.path || '/app/data/elova.db'
        return fs.existsSync(dbPath)
      } else if (dbConfig.type === 'supabase') {
        // For Supabase, check if URL and key are configured
        return Boolean(dbConfig.url && dbConfig.key)
      }

      return false
    } catch (error) {
      return false
    }
  }

  private async isAdminAccountSetup(): Promise<boolean> {
    try {
      // Check if admin user data actually exists (not just a flag)
      const adminEmail = await configProvider.get<string>('setup.admin_email')
      const adminPasswordHash = await configProvider.get<string>('setup.admin_password_hash')
      const adminUserId = await configProvider.get<string>('setup.admin_user_id')
      
      // Admin account is considered set up if we have email, password hash, and user ID
      const hasAdminData = Boolean(adminEmail && adminPasswordHash && adminUserId)
      
      if (hasAdminData) {
        console.log(`Admin account found: ${adminEmail} (ID: ${adminUserId})`)
        return true
      }
      
      console.log('No admin account data found - setup required')
      return false
    } catch (error) {
      console.error('Error checking admin account setup:', error)
      return false
    }
  }

  private async isBasicConfigurationSetup(): Promise<boolean> {
    try {
      // Check if basic app configuration has been set
      const appName = await configProvider.get<string>('app.name')
      const authProvider = await configProvider.get<string>('auth.provider')
      
      // Basic configuration is considered setup if app name and auth provider are configured
      return Boolean(appName && authProvider)
    } catch (error) {
      return false
    }
  }

  private async areIntegrationsSetup(): Promise<boolean> {
    try {
      // With multi-provider architecture, integrations are now managed through
      // the providers page, not during setup. This step is always considered complete
      // once onboarding finishes. Users add n8n instances via /providers page.
      const onboardingCompleted = await configProvider.get<string>('app.onboarding_completed')
      const setupComplete = await this.isSetupComplete()
      
      // Integrations are optional during setup - they're added later via providers page
      return onboardingCompleted === 'true' || setupComplete
    } catch (error) {
      return false
    }
  }

  private getNextStep(completedSteps: SetupStatus['completedSteps']): SetupStatus['nextStep'] {
    if (!completedSteps.database) {
      return 'welcome'
    }
    if (!completedSteps.adminAccount) {
      return 'admin'
    }
    if (!completedSteps.basicConfiguration) {
      return 'database'
    }
    if (!completedSteps.integrations) {
      return 'integrations'
    }
    return 'complete'
  }
}

// Export singleton instance
export const setupChecker = SetupChecker.getInstance()

// Helper functions
export async function isSetupRequired(): Promise<boolean> {
  const status = await setupChecker.checkSetupStatus()
  return status.requiresSetup
}

export async function getSetupStatus(): Promise<SetupStatus> {
  return setupChecker.checkSetupStatus()
}

export async function markSetupComplete(): Promise<void> {
  return setupChecker.markSetupComplete()
}