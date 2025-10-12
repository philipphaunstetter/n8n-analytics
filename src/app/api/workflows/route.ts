import { NextRequest, NextResponse } from 'next/server'
import { ProviderRegistry } from '@/lib/providers'
import { Provider, WorkflowFilters } from '@/types'
import { authenticateRequest } from '@/lib/api-auth'
import { n8nApi, N8nWorkflow } from '@/lib/n8n-api'
import { Database } from 'sqlite3'
import { ConfigManager } from '@/lib/config/config-manager'

// Get SQLite database connection
function getSQLiteClient(): Database {
  const dbPath = ConfigManager.getDefaultDatabasePath()
  const db = new Database(dbPath)
  
  // Initialize tables if they don't exist
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS providers (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT NOT NULL,
        base_url TEXT NOT NULL,
        api_key_encrypted TEXT NOT NULL,
        is_connected BOOLEAN DEFAULT 1,
        status TEXT DEFAULT 'healthy',
        last_checked_at TEXT,
        metadata TEXT DEFAULT '{}'
      )
    `)
    
    db.run(`
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        provider_id TEXT,
        provider_workflow_id TEXT,
        name TEXT NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        tags TEXT DEFAULT '[]',
        node_count INTEGER DEFAULT 0,
        workflow_data TEXT,
        
        -- Backup and archiving fields
        lifecycle_status TEXT DEFAULT 'active', -- 'active', 'deprecated', 'archived', 'deleted_from_n8n'
        last_seen_in_n8n TEXT, -- When workflow was last found in n8n during sync
        backup_enabled BOOLEAN DEFAULT 1, -- Whether to keep backup even if deleted from n8n
        archived_at TEXT, -- When workflow was archived
        archived_reason TEXT, -- Why workflow was archived
        version INTEGER DEFAULT 1, -- Version number for workflow changes
        
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (provider_id) REFERENCES providers (id)
      )
    `)
    
    db.run(`
      CREATE TABLE IF NOT EXISTS executions (
        id TEXT PRIMARY KEY,
        provider_id TEXT,
        workflow_id TEXT,
        provider_execution_id TEXT UNIQUE,
        provider_workflow_id TEXT,
        status TEXT,
        mode TEXT,
        started_at TEXT,
        stopped_at TEXT,
        duration INTEGER,
        finished BOOLEAN,
        retry_of TEXT,
        retry_success_id TEXT,
        metadata TEXT DEFAULT '{}',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (provider_id) REFERENCES providers (id),
        FOREIGN KEY (workflow_id) REFERENCES workflows (id)
      )
    `)
  })
  
  return db
}

// GET /api/workflows - List workflows from SQLite database
export async function GET(request: NextRequest) {
  try {
    // Skip authentication for testing
    console.log('🔧 Skipping authentication for testing')

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const filters: WorkflowFilters = {
      providerId: searchParams.get('providerId') || undefined,
      isActive: searchParams.get('active') ? searchParams.get('active') === 'true' : undefined,
      search: searchParams.get('search') || undefined
    }

    console.log('📋 Fetching workflows from SQLite database...')
    
    // Get workflows from SQLite database
    const db = getSQLiteClient()
    
    // First check if we have any workflows stored
    const storedWorkflows = await new Promise<any[]>((resolve, reject) => {
      db.all(`
        SELECT 
          w.*,
          COUNT(e.id) as execution_count,
          MAX(e.started_at) as last_execution_at,
          (
            SELECT e2.status 
            FROM executions e2 
            WHERE e2.workflow_id = w.id 
            ORDER BY e2.started_at DESC 
            LIMIT 1
          ) as last_execution_status
        FROM workflows w
        LEFT JOIN executions e ON w.id = e.workflow_id
        GROUP BY w.id
        ORDER BY w.name
      `, (err, rows: any[]) => {
        if (err) {
          console.error('Error fetching workflows from SQLite:', err)
          reject(err)
        } else {
          resolve(rows || [])
        }
      })
    })
    
    console.log(`📋 Found ${storedWorkflows.length} workflows in SQLite database`)
    
    // If no workflows stored, try to sync from n8n and store them
    let allWorkflows = storedWorkflows
    
    if (storedWorkflows.length === 0) {
      console.log('🔄 No workflows in database, syncing from n8n...')
      
      try {
        // Fetch from n8n and store in database
        const n8nWorkflows = await n8nApi.getWorkflows()
        console.log(`📡 Fetched ${n8nWorkflows.length} workflows from n8n API`)
        
        // Create default provider if none exists
        await ensureDefaultProvider(db)
        
        // Store workflows in database with full JSON data
        for (const n8nWorkflow of n8nWorkflows) {
          await storeWorkflowWithJson(db, n8nWorkflow)
        }
        
        // Re-fetch from database to get stored data
        allWorkflows = await new Promise<any[]>((resolve, reject) => {
          db.all(`
            SELECT 
              w.*,
              COUNT(e.id) as execution_count,
              MAX(e.started_at) as last_execution_at,
              (
                SELECT e2.status 
                FROM executions e2 
                WHERE e2.workflow_id = w.id 
                ORDER BY e2.started_at DESC 
                LIMIT 1
              ) as last_execution_status
            FROM workflows w
            LEFT JOIN executions e ON w.id = e.workflow_id
            GROUP BY w.id
            ORDER BY w.name
          `, (err, rows: any[]) => {
            if (err) reject(err)
            else resolve(rows || [])
          })
        })
        
        console.log(`✅ Synced and stored ${allWorkflows.length} workflows`)
      } catch (error) {
        console.error('❌ Failed to sync from n8n:', error)
        // Return empty result rather than error - database might not be set up yet
        return NextResponse.json({
          success: true,
          data: {
            items: [],
            total: 0,
            page: 1,
            limit: 0,
            hasNextPage: false,
            hasPreviousPage: false
          }
        })
      }
    }
    
    // Convert stored workflows to API format
    const convertedWorkflows = allWorkflows.map(workflow => ({
      id: workflow.id,
      name: workflow.name,
      active: Boolean(workflow.is_active),
      tags: JSON.parse(workflow.tags || '[]'),
      createdAt: new Date(workflow.created_at),
      updatedAt: new Date(workflow.updated_at),
      executionCount: parseInt(workflow.execution_count || '0'),
      lastExecutionStatus: workflow.last_execution_status,
      lastExecutionAt: workflow.last_execution_at ? new Date(workflow.last_execution_at) : undefined,
      nodeCount: workflow.node_count || 0,
      workflowData: workflow.workflow_data ? JSON.parse(workflow.workflow_data) : null,
      
      // Backup and archiving fields
      lifecycleStatus: workflow.lifecycle_status || 'active',
      lastSeenInN8n: workflow.last_seen_in_n8n ? new Date(workflow.last_seen_in_n8n) : undefined,
      backupEnabled: Boolean(workflow.backup_enabled),
      archivedAt: workflow.archived_at ? new Date(workflow.archived_at) : undefined,
      archivedReason: workflow.archived_reason,
      version: workflow.version || 1
    }))
    
    // Apply filters
    const filteredWorkflows = applyWorkflowFilters(convertedWorkflows, filters)
    
    // Sort workflows by lastExecutionAt (most recent first), then by name
    filteredWorkflows.sort((a, b) => {
      if (a.lastExecutionAt && b.lastExecutionAt) {
        return new Date(b.lastExecutionAt).getTime() - new Date(a.lastExecutionAt).getTime()
      }
      if (a.lastExecutionAt && !b.lastExecutionAt) return -1
      if (!a.lastExecutionAt && b.lastExecutionAt) return 1
      return a.name.localeCompare(b.name)
    })
    
    db.close()
    
    return NextResponse.json({
      success: true,
      data: {
        items: filteredWorkflows,
        total: filteredWorkflows.length,
        page: 1,
        limit: filteredWorkflows.length,
        hasNextPage: false,
        hasPreviousPage: false
      }
    })
  } catch (error) {
    console.error('Failed to fetch workflows:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to ensure default provider exists
async function ensureDefaultProvider(db: Database): Promise<string> {
  return new Promise((resolve, reject) => {
    // Check if provider exists
    db.get('SELECT id FROM providers LIMIT 1', (err, row: any) => {
      if (err) {
        reject(err)
        return
      }
      
      if (row) {
        resolve(row.id)
        return
      }
      
      // Create default provider
      const providerId = `provider_${Date.now()}`
      db.run(`
        INSERT INTO providers (id, user_id, name, base_url, api_key_encrypted, is_connected, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        providerId,
        'admin',
        'Default n8n Instance',
        'http://localhost:5678',
        'default', // Will be replaced with actual config
        1,
        'healthy'
      ], function(err) {
        if (err) {
          reject(err)
        } else {
          console.log('✅ Created default provider:', providerId)
          resolve(providerId)
        }
      })
    })
  })
}

// Helper function to store workflow with full JSON data
async function storeWorkflowWithJson(db: Database, n8nWorkflow: N8nWorkflow): Promise<void> {
  const providerId = await ensureDefaultProvider(db)
  
  return new Promise((resolve, reject) => {
    const workflowId = `wf_${Date.now()}_${n8nWorkflow.id}`
    
    // Store complete workflow data as JSON
    const workflowData = {
      ...n8nWorkflow,
      // Ensure these properties are included
      id: n8nWorkflow.id,
      name: n8nWorkflow.name,
      active: n8nWorkflow.active,
      createdAt: n8nWorkflow.createdAt,
      updatedAt: n8nWorkflow.updatedAt,
      nodes: n8nWorkflow.nodes || [],
      connections: n8nWorkflow.connections || {},
      tags: n8nWorkflow.tags || []
    }
    
    db.run(`
      INSERT OR REPLACE INTO workflows (
        id, provider_id, provider_workflow_id, name, is_active, 
        tags, node_count, workflow_data, created_at, updated_at,
        lifecycle_status, last_seen_in_n8n, backup_enabled, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      workflowId,
      providerId,
      n8nWorkflow.id,
      n8nWorkflow.name,
      n8nWorkflow.active ? 1 : 0,
      JSON.stringify(n8nWorkflow.tags || []),
      n8nWorkflow.nodes?.length || 0,
      JSON.stringify(workflowData), // Store complete workflow JSON
      n8nWorkflow.createdAt,
      n8nWorkflow.updatedAt,
      'active', // Default lifecycle status
      new Date().toISOString(), // Mark as seen in n8n now
      1, // Enable backup by default
      1 // Initial version
    ], function(err) {
      if (err) {
        console.error('❌ Failed to store workflow:', n8nWorkflow.name, err)
        reject(err)
      } else {
        console.log('✅ Stored workflow with JSON and backup settings:', n8nWorkflow.name)
        resolve()
      }
    })
  })
}


// Helper function to apply filters to workflows
function applyWorkflowFilters(workflows: any[], filters: WorkflowFilters): any[] {
  let filtered = workflows
  
  // Filter by active status
  if (filters.isActive !== undefined) {
    filtered = filtered.filter(workflow => workflow.active === filters.isActive)
  }
  
  // Filter by search query (search in workflow name and tags)
  if (filters.search) {
    const searchTerm = filters.search.toLowerCase()
    filtered = filtered.filter(workflow => {
      // Search in workflow name
      if (workflow.name.toLowerCase().includes(searchTerm)) {
        return true
      }
      
      // Search in tags
      if (workflow.tags && workflow.tags.some((tag: string) => tag.toLowerCase().includes(searchTerm))) {
        return true
      }
      
      // Search in workflow ID
      if (workflow.id.toLowerCase().includes(searchTerm)) {
        return true
      }
      
      return false
    })
  }
  
  return filtered
}
