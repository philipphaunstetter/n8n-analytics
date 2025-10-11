'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
// Removed missing UI components
import { 
  CircleStackIcon as Database, 
  ShieldCheckIcon as Shield, 
  Cog6ToothIcon as ToggleLeft, 
  BellIcon as Bell, 
  LinkIcon as Plug, 
  PaintBrushIcon as Palette, 
  CogIcon as SettingsIcon,
  BookmarkIcon as Save,
  ArrowPathIcon as RotateCcw,
  ExclamationTriangleIcon as AlertTriangle,
  InformationCircleIcon as Info,
  EyeIcon as Eye,
  EyeSlashIcon as EyeOff
} from '@heroicons/react/24/outline'
import { useToast } from '@/components/ui/use-toast'

interface ConfigItem {
  key: string
  value: string
  valueType: 'string' | 'number' | 'boolean' | 'json' | 'encrypted'
  category: string
  description?: string
  isSensitive: boolean
  isReadonly: boolean
  validationRules?: string
  updatedAt: string
  categoryDisplayName?: string
  categoryIcon?: string
}

interface ConfigCategory {
  name: string
  displayName: string
  description?: string
  icon?: string
  sortOrder: number
  isSystem: boolean
}

const categoryIcons = {
  database: Database,
  authentication: Shield,
  features: ToggleLeft,
  notifications: Bell,
  integration: Plug,
  appearance: Palette,
  advanced: SettingsIcon
}

export default function SettingsPage() {
  const [config, setConfig] = useState<ConfigItem[]>([])
  const [categories, setCategories] = useState<ConfigCategory[]>([])
  const [activeCategory, setActiveCategory] = useState<string>('database')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [changes, setChanges] = useState<Record<string, any>>({})
  const [showSensitive, setShowSensitive] = useState<Record<string, boolean>>({})
  const { toast } = useToast()

  useEffect(() => {
    loadConfiguration()
  }, [])

  const loadConfiguration = async () => {
    try {
      setLoading(true)
      
      // Load configuration items
      const configResponse = await fetch('/api/admin/config')
      if (!configResponse.ok) throw new Error('Failed to load configuration')
      const configData = await configResponse.json()
      
      // Load categories
      const categoriesResponse = await fetch('/api/admin/config/categories')
      if (!categoriesResponse.ok) throw new Error('Failed to load categories')
      const categoriesData = await categoriesResponse.json()
      
      setConfig(configData)
      setCategories(categoriesData)
      
      // Set first category as active if none selected
      if (categoriesData.length > 0 && !activeCategory) {
        setActiveCategory(categoriesData[0].name)
      }
    } catch (error) {
      console.error('Failed to load configuration:', error)
      toast({
        title: 'Error',
        description: 'Failed to load configuration settings',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleValueChange = (key: string, value: any) => {
    setChanges(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const saveChanges = async () => {
    if (Object.keys(changes).length === 0) return

    try {
      setSaving(true)
      
      const response = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          changes,
          changeReason: 'Updated via admin settings page'
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to save configuration')
      }

      toast({
        title: 'Success',
        description: `Saved ${Object.keys(changes).length} configuration changes`
      })

      // Clear changes and reload configuration
      setChanges({})
      await loadConfiguration()
      
    } catch (error) {
      console.error('Failed to save configuration:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save configuration',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const resetToDefaults = async () => {
    if (!confirm('Are you sure you want to reset all configuration to defaults? This action cannot be undone.')) {
      return
    }

    try {
      setSaving(true)
      
      const response = await fetch('/api/admin/config/reset', {
        method: 'POST'
      })

      if (!response.ok) throw new Error('Failed to reset configuration')

      toast({
        title: 'Success',
        description: 'Configuration reset to defaults successfully'
      })

      // Clear changes and reload
      setChanges({})
      await loadConfiguration()
      
    } catch (error) {
      console.error('Failed to reset configuration:', error)
      toast({
        title: 'Error',
        description: 'Failed to reset configuration to defaults',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const renderConfigInput = (item: ConfigItem) => {
    const currentValue = changes[item.key] !== undefined ? changes[item.key] : deserializeValue(item.value, item.valueType)
    const isChanged = changes[item.key] !== undefined

    if (item.isReadonly) {
      return (
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            {item.key}
            <Badge color="zinc" className="text-xs">Readonly</Badge>
          </Label>
          <Input 
            value={item.isSensitive ? '***PROTECTED***' : currentValue} 
            disabled 
            className="bg-muted" 
          />
          {item.description && (
            <p className="text-xs text-muted-foreground">{item.description}</p>
          )}
        </div>
      )
    }

    switch (item.valueType) {
      case 'boolean':
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium flex items-center gap-2">
                {item.key}
                {isChanged && <Badge color="blue" className="text-xs">Modified</Badge>}
              </Label>
              <Switch
                checked={Boolean(currentValue)}
                onCheckedChange={(checked) => handleValueChange(item.key, checked)}
              />
            </div>
            {item.description && (
              <p className="text-xs text-muted-foreground">{item.description}</p>
            )}
          </div>
        )

      case 'number':
        return (
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              {item.key}
              {isChanged && <Badge color="blue" className="text-xs">Modified</Badge>}
            </Label>
            <Input
              type="number"
              value={currentValue}
              onChange={(e) => handleValueChange(item.key, Number(e.target.value))}
            />
            {item.description && (
              <p className="text-xs text-muted-foreground">{item.description}</p>
            )}
          </div>
        )

      case 'json':
        return (
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              {item.key}
              {isChanged && <Badge color="blue" className="text-xs">Modified</Badge>}
              <Badge color="zinc" className="text-xs">JSON</Badge>
            </Label>
            <Textarea
              value={typeof currentValue === 'string' ? currentValue : JSON.stringify(currentValue, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value)
                  handleValueChange(item.key, parsed)
                } catch {
                  // Allow invalid JSON while typing
                  handleValueChange(item.key, e.target.value)
                }
              }}
              className="font-mono text-sm"
              rows={4}
            />
            {item.description && (
              <p className="text-xs text-muted-foreground">{item.description}</p>
            )}
          </div>
        )

      case 'encrypted':
        const isVisible = showSensitive[item.key]
        return (
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              {item.key}
              {isChanged && <Badge color="blue" className="text-xs">Modified</Badge>}
              <Badge color="red" className="text-xs">Sensitive</Badge>
            </Label>
            <div className="relative">
              <Input
                type={isVisible ? 'text' : 'password'}
                value={isVisible ? currentValue : '***HIDDEN***'}
                onChange={(e) => handleValueChange(item.key, e.target.value)}
                className="pr-10"
                placeholder={isVisible ? undefined : 'Leave empty to keep current value'}
              />
              <Button
                type="button"
                plain
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowSensitive(prev => ({ ...prev, [item.key]: !isVisible }))}
              >
                {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {item.description && (
              <p className="text-xs text-muted-foreground">{item.description}</p>
            )}
          </div>
        )

      default:
        return (
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              {item.key}
              {isChanged && <Badge color="blue" className="text-xs">Modified</Badge>}
            </Label>
            <Input
              value={currentValue}
              onChange={(e) => handleValueChange(item.key, e.target.value)}
            />
            {item.description && (
              <p className="text-xs text-muted-foreground">{item.description}</p>
            )}
          </div>
        )
    }
  }

  const deserializeValue = (value: string, valueType: ConfigItem['valueType']) => {
    switch (valueType) {
      case 'boolean':
        return value === 'true' || value === '1'
      case 'number':
        return Number(value)
      case 'json':
        try {
          return JSON.parse(value)
        } catch {
          return value
        }
      default:
        return value
    }
  }

  const getConfigByCategory = (categoryName: string) => {
    return config.filter(item => item.category === categoryName)
  }

  const hasUnsavedChanges = Object.keys(changes).length > 0

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <SettingsIcon className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Loading configuration...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your Elova configuration</p>
        </div>
        
        <div className="flex gap-2">
          <Button
            outline
            onClick={resetToDefaults}
            disabled={saving}
            className="text-destructive hover:text-destructive"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          
          <Button
            onClick={saveChanges}
            disabled={!hasUnsavedChanges || saving}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : `Save Changes${hasUnsavedChanges ? ` (${Object.keys(changes).length})` : ''}`}
          </Button>
        </div>
      </div>

      {hasUnsavedChanges && (
        <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-md flex items-center gap-2">
          <Info className="h-4 w-4 text-blue-600" />
          <p className="text-sm text-blue-600">
            You have {Object.keys(changes).length} unsaved change{Object.keys(changes).length !== 1 ? 's' : ''}. 
            Don't forget to save your changes.
          </p>
        </div>
      )}

      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className="grid w-full grid-cols-7">
          {categories.map(category => {
            const Icon = categoryIcons[category.name as keyof typeof categoryIcons] || SettingsIcon
            return (
              <TabsTrigger key={category.name} value={category.name} className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{category.displayName}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        {categories.map(category => {
          const categoryConfig = getConfigByCategory(category.name)
          const Icon = categoryIcons[category.name as keyof typeof categoryIcons] || SettingsIcon

          return (
            <TabsContent key={category.name} value={category.name} className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="h-5 w-5" />
                    {category.displayName}
                  </CardTitle>
                  {category.description && (
                    <CardDescription>{category.description}</CardDescription>
                  )}
                </CardHeader>
                
                <CardContent className="space-y-6">
                  {categoryConfig.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No configuration options available in this category.
                    </p>
                  ) : (
                    <div className="grid gap-6">
                      {categoryConfig.map((item, index) => (
                        <div key={item.key}>
                          {renderConfigInput(item)}
                          {index < categoryConfig.length - 1 && <div className="mt-6 h-px bg-border" />}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}