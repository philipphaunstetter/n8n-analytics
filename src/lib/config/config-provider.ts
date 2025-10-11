import fs from 'fs'
import path from 'path'
import { getConfigManager, getConfig, setConfig } from './config-manager'

interface RuntimeConfig {
  firstRun: boolean
  detectedDatabaseType: 'sqlite' | 'supabase'
  hasSupabaseEnv: boolean
  containerStartTime: string
  dataDirectory: string
  environment: {
    nodeEnv: string
    port: string
    hostname: string
    demoMode: string
  }
}

/**
 * Configuration provider that handles app initialization and configuration loading
 */
export class ConfigProvider {
  private static instance: ConfigProvider | null = null
  private initialized = false
  private runtimeConfig: RuntimeConfig | null = null

  private constructor() {}

  static getInstance(): ConfigProvider {
    if (!ConfigProvider.instance) {
      ConfigProvider.instance = new ConfigProvider()
    }
    return ConfigProvider.instance
  }

  /**
   * Initialize the configuration system
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      console.log('Initializing Elova configuration system...')
      
      // Initialize the config manager
      const configManager = getConfigManager()
      await configManager.initialize()
      
      // Load runtime configuration hints
      await this.loadRuntimeConfig()
      
      // Apply first-run setup if needed
      if (this.runtimeConfig?.firstRun) {
        await this.handleFirstRunSetup()
      }
      
      // Validate and update configuration based on environment
      await this.syncEnvironmentConfig()
      
      this.initialized = true
      console.log('Configuration system initialized successfully')
      
    } catch (error) {
      console.error('Failed to initialize configuration system:', error)
      throw error
    }
  }

  /**
   * Get a configuration value with type safety
   */
  async get<T = any>(key: string): Promise<T | null> {
    await this.ensureInitialized()
    return getConfig<T>(key)
  }

  /**
   * Set a configuration value
   */
  async set(key: string, value: any, reason?: string): Promise<void> {
    await this.ensureInitialized()
    return setConfig(key, value, {
      changedBy: 'system',
      changeReason: reason
    })
  }

  /**
   * Get multiple configuration values for a category
   */
  async getCategory(category: string): Promise<Record<string, any>> {
    await this.ensureInitialized()
    const configManager = getConfigManager()
    return configManager.getByCategory(category)
  }

  /**
   * Get database configuration
   */
  async getDatabaseConfig(): Promise<{
    type: 'sqlite' | 'supabase' | 'postgresql'
    path?: string
    url?: string
    key?: string
  }> {
    await this.ensureInitialized()
    
    const dbType = await this.get<string>('database.type')
    const config: any = { type: dbType || 'sqlite' }
    
    if (dbType === 'sqlite') {
      config.path = await this.get<string>('database.path')
    } else if (dbType === 'supabase') {
      config.url = process.env.NEXT_PUBLIC_SUPABASE_URL
      config.key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    }
    
    return config
  }

  /**
   * Get authentication configuration
   */
  async getAuthConfig(): Promise<{
    provider: 'dev' | 'supabase' | 'oauth'
    developmentMode: boolean
    sessionTimeout: number
    requireEmailVerification: boolean
  }> {
    await this.ensureInitialized()
    
    return {
      provider: await this.get<string>('auth.provider') || 'dev',
      developmentMode: await this.get<boolean>('auth.development_mode') || false,
      sessionTimeout: await this.get<number>('auth.session_timeout') || 86400,
      requireEmailVerification: await this.get<boolean>('auth.require_email_verification') || false
    }
  }

  /**
   * Get feature flags
   */
  async getFeatures(): Promise<Record<string, boolean | number | string>> {
    await this.ensureInitialized()
    return this.getCategory('features')
  }

  /**
   * Get app configuration
   */
  async getAppConfig(): Promise<{
    name: string
    version: string
    timezone: string
    logLevel: string
    maxFileUploadMb: number
  }> {
    await this.ensureInitialized()
    
    return {
      name: await this.get<string>('app.name') || 'Elova',
      version: await this.get<string>('app.version') || '1.0.0',
      timezone: await this.get<string>('app.timezone') || 'UTC',
      logLevel: await this.get<string>('app.log_level') || 'info',
      maxFileUploadMb: await this.get<number>('app.max_file_upload_mb') || 10
    }
  }

  /**
   * Check if this is the first run
   */
  isFirstRun(): boolean {
    return this.runtimeConfig?.firstRun || false
  }

  /**
   * Get the detected database type from environment
   */
  getDetectedDatabaseType(): 'sqlite' | 'supabase' {
    return this.runtimeConfig?.detectedDatabaseType || 'sqlite'
  }

  // Private methods

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  private async loadRuntimeConfig(): Promise<void> {
    try {
      const runtimeConfigPath = path.join(process.cwd(), 'data', 'runtime-config.json')
      
      // For containerized environments
      if (!fs.existsSync(runtimeConfigPath)) {
        const containerPath = '/app/data/runtime-config.json'
        if (fs.existsSync(containerPath)) {
          const content = fs.readFileSync(containerPath, 'utf8')
          this.runtimeConfig = JSON.parse(content)
          return
        }
      }
      
      // For development environments
      if (fs.existsSync(runtimeConfigPath)) {
        const content = fs.readFileSync(runtimeConfigPath, 'utf8')
        this.runtimeConfig = JSON.parse(content)
      } else {
        // Create default runtime config
        this.runtimeConfig = {
          firstRun: true,
          detectedDatabaseType: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'supabase' : 'sqlite',
          hasSupabaseEnv: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
          containerStartTime: new Date().toISOString(),
          dataDirectory: path.join(process.cwd(), 'data'),
          environment: {
            nodeEnv: process.env.NODE_ENV || 'development',
            port: process.env.PORT || '3000',
            hostname: process.env.HOSTNAME || 'localhost',
            demoMode: process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE || 'false'
          }
        }
      }
    } catch (error) {
      console.error('Failed to load runtime configuration:', error)
      // Use defaults
      this.runtimeConfig = {
        firstRun: false,
        detectedDatabaseType: 'sqlite',
        hasSupabaseEnv: false,
        containerStartTime: new Date().toISOString(),
        dataDirectory: '/app/data',
        environment: {
          nodeEnv: 'production',
          port: '3000',
          hostname: '0.0.0.0',
          demoMode: 'false'
        }
      }
    }
  }

  private async handleFirstRunSetup(): Promise<void> {
    console.log('Handling first-run configuration setup...')
    
    if (!this.runtimeConfig) return

    try {
      // Update database type based on detected environment
      const detectedType = this.runtimeConfig.detectedDatabaseType
      await this.set('database.type', detectedType, 'First run setup - detected from environment')
      
      // Update auth provider based on database type
      if (detectedType === 'supabase' && this.runtimeConfig.hasSupabaseEnv) {
        await this.set('auth.provider', 'supabase', 'First run setup - using Supabase auth')
        await this.set('auth.development_mode', false, 'First run setup - production mode with Supabase')
      } else {
        await this.set('auth.provider', 'dev', 'First run setup - using development auth')
        await this.set('auth.development_mode', true, 'First run setup - development mode')
      }
      
      // Set demo mode based on environment
      const demoMode = this.runtimeConfig.environment.demoMode === 'true'
      await this.set('features.demo_mode', demoMode, 'First run setup - demo mode from environment')
      
      // Update app timezone if we can detect it
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      await this.set('app.timezone', timezone, 'First run setup - detected timezone')
      
      console.log('First-run configuration setup completed')
      
    } catch (error) {
      console.error('Failed to complete first-run setup:', error)
    }
  }

  private async syncEnvironmentConfig(): Promise<void> {
    // Update configuration based on current environment variables
    // This ensures that environment changes are reflected in the database
    
    try {
      // Sync Supabase configuration if environment variables are present
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        const currentDbType = await this.get<string>('database.type')
        if (currentDbType !== 'supabase') {
          console.log('Supabase environment detected, updating database configuration')
          await this.set('database.type', 'supabase', 'Environment sync - Supabase credentials detected')
        }
      }
      
      // Sync demo mode
      const envDemoMode = process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE === 'true'
      const currentDemoMode = await this.get<boolean>('features.demo_mode')
      if (currentDemoMode !== envDemoMode) {
        await this.set('features.demo_mode', envDemoMode, 'Environment sync - demo mode updated')
      }
      
    } catch (error) {
      console.error('Failed to sync environment configuration:', error)
    }
  }
}

// Export singleton instance
export const configProvider = ConfigProvider.getInstance()

// Helper functions for common operations
export async function getAppConfiguration() {
  return configProvider.getAppConfig()
}

export async function getDatabaseConfiguration() {
  return configProvider.getDatabaseConfig()
}

export async function getAuthConfiguration() {
  return configProvider.getAuthConfig()
}

export async function getFeatureFlags() {
  return configProvider.getFeatures()
}