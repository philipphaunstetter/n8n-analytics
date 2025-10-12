import { Database } from 'sqlite3'
import { ConfigManager } from '@/lib/config/config-manager'
import { n8nApi, N8nWorkflow } from '@/lib/n8n-api'

export class WorkflowSyncService {
  private getSQLiteClient(): Database {
    const dbPath = ConfigManager.getDefaultDatabasePath()
    return new Database(dbPath)
  }

  /**
   * Sync workflows from n8n with backup and archiving logic
   */
  async syncWorkflows(): Promise<{
    synced: number
    created: number
    updated: number
    archived: number
    skipped: number
    errors: string[]
  }> {
    const db = this.getSQLiteClient()
    const errors: string[] = []
    let synced = 0
    let created = 0
    let updated = 0
    let archived = 0

    console.log('🔄 Starting workflow sync with backup and archiving...')

    try {
      // Get current workflows from n8n
      const n8nWorkflows = await n8nApi.getWorkflows()
      const n8nWorkflowIds = new Set(n8nWorkflows.map(w => w.id))
      
      console.log(`📡 Found ${n8nWorkflows.length} workflows in n8n`)

      // Ensure default provider exists
      const providerId = await this.ensureDefaultProvider(db)

      // Process each n8n workflow with smart change detection
      let skipped = 0
      for (const n8nWorkflow of n8nWorkflows) {
        try {
          const result = await this.syncWorkflow(db, providerId, n8nWorkflow)
          synced++
          if (result.created) created++
          if (result.updated) updated++
          if (result.skipped) skipped++
        } catch (error) {
          const message = `Failed to sync workflow ${n8nWorkflow.name}: ${error}`
          console.error('❌', message)
          errors.push(message)
        }
      }
      
      if (skipped > 0) {
        console.log(`⏭️ Skipped ${skipped} unchanged workflows (smart sync)`)
      }

      // Mark workflows as deleted from n8n if they're no longer found
      const archivedCount = await this.archiveDeletedWorkflows(db, n8nWorkflowIds)
      archived = archivedCount

      db.close()

      console.log(`✅ Workflow sync completed: ${synced} synced, ${created} created, ${updated} updated, ${archived} archived`)

      return {
        synced,
        created,
        updated,
        archived,
        errors,
        skipped: skipped || 0
      }
    } catch (error) {
      console.error('❌ Workflow sync failed:', error)
      db.close()
      throw error
    }
  }

  /**
   * Sync a single workflow with intelligent change detection using updatedAt timestamps
   */
  private async syncWorkflow(
    db: Database,
    providerId: string,
    n8nWorkflow: N8nWorkflow
  ): Promise<{ created: boolean; updated: boolean; skipped: boolean }> {
    return new Promise((resolve, reject) => {
      // Check if workflow already exists and get last known updated timestamp
      db.get(`
        SELECT id, workflow_data, version, lifecycle_status, updated_at
        FROM workflows 
        WHERE provider_id = ? AND provider_workflow_id = ?
      `, [providerId, n8nWorkflow.id], (err, existing: any) => {
        if (err) {
          reject(err)
          return
        }

        const workflowData = {
          ...n8nWorkflow,
          id: n8nWorkflow.id,
          name: n8nWorkflow.name,
          active: n8nWorkflow.active,
          createdAt: n8nWorkflow.createdAt,
          updatedAt: n8nWorkflow.updatedAt,
          nodes: n8nWorkflow.nodes || [],
          connections: n8nWorkflow.connections || {},
          tags: n8nWorkflow.tags || []
        }

        const now = new Date().toISOString()
        const n8nUpdatedAt = new Date(n8nWorkflow.updatedAt)

        if (!existing) {
          // Create new workflow
          const workflowId = `wf_${Date.now()}_${n8nWorkflow.id}`
          
          db.run(`
            INSERT INTO workflows (
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
            JSON.stringify(workflowData),
            n8nWorkflow.createdAt,
            n8nWorkflow.updatedAt,
            'active',
            now,
            1, // backup enabled by default
            1  // initial version
          ], (err) => {
            if (err) {
              reject(err)
            } else {
              console.log(`✅ Created workflow backup: ${n8nWorkflow.name}`)
              resolve({ created: true, updated: false, skipped: false })
            }
          })
        } else {
          const existingUpdatedAt = new Date(existing.updated_at)
          
          // SMART CHANGE DETECTION: Compare n8n's updatedAt with our stored updatedAt
          const hasTimestampChanged = n8nUpdatedAt.getTime() !== existingUpdatedAt.getTime()
          
          if (!hasTimestampChanged) {
            // Workflow hasn't changed since last sync - just update last_seen_in_n8n and active status
            db.run(`
              UPDATE workflows SET
                last_seen_in_n8n = ?,
                is_active = ?,
                lifecycle_status = 'active'
              WHERE id = ?
            `, [now, n8nWorkflow.active ? 1 : 0, existing.id], (err) => {
              if (err) {
                reject(err)
              } else {
                // console.log(`⏭️ Skipped unchanged workflow: ${n8nWorkflow.name}`)
                resolve({ created: false, updated: false, skipped: true })
              }
            })
            return
          }
          
          // Workflow has changed - check content for version bump
          const existingData = existing.workflow_data ? JSON.parse(existing.workflow_data) : {}
          const hasContentChanged = JSON.stringify(existingData.nodes) !== JSON.stringify(workflowData.nodes) ||
                                  JSON.stringify(existingData.connections) !== JSON.stringify(workflowData.connections)
          
          const newVersion = hasContentChanged ? (existing.version || 1) + 1 : existing.version
          
          if (hasContentChanged) {
            console.log(`📝 Workflow content changed (v${newVersion}): ${n8nWorkflow.name}`)
          } else {
            console.log(`📋 Workflow metadata updated: ${n8nWorkflow.name}`)
          }

          // Update existing workflow with new timestamp and data
          db.run(`
            UPDATE workflows SET
              name = ?, is_active = ?, tags = ?, node_count = ?,
              workflow_data = ?, updated_at = ?, last_seen_in_n8n = ?,
              lifecycle_status = ?, version = ?
            WHERE id = ?
          `, [
            n8nWorkflow.name,
            n8nWorkflow.active ? 1 : 0,
            JSON.stringify(n8nWorkflow.tags || []),
            n8nWorkflow.nodes?.length || 0,
            JSON.stringify(workflowData),
            n8nWorkflow.updatedAt, // Store n8n's updatedAt
            now,
            'active', // Reset to active since it exists in n8n
            newVersion,
            existing.id
          ], (err) => {
            if (err) {
              reject(err)
            } else {
              console.log(`✅ Updated workflow backup: ${n8nWorkflow.name}`)
              resolve({ created: false, updated: true, skipped: false })
            }
          })
        }
      })
    })
  }

  /**
   * Mark workflows as deleted from n8n if they're no longer found
   */
  private async archiveDeletedWorkflows(
    db: Database,
    currentN8nWorkflowIds: Set<string>
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      // Get all active workflows from our database
      db.all(`
        SELECT id, provider_workflow_id, name, backup_enabled
        FROM workflows 
        WHERE lifecycle_status = 'active'
      `, (err, workflows: any[]) => {
        if (err) {
          reject(err)
          return
        }

        let archivedCount = 0
        let processed = 0

        if (workflows.length === 0) {
          resolve(0)
          return
        }

        // Check each stored workflow
        for (const workflow of workflows) {
          if (!currentN8nWorkflowIds.has(workflow.provider_workflow_id)) {
            // Workflow no longer exists in n8n
            const newStatus = workflow.backup_enabled ? 'deleted_from_n8n' : 'archived'
            const archivedReason = 'Workflow no longer found in n8n instance during sync'

            db.run(`
              UPDATE workflows SET
                lifecycle_status = ?,
                archived_at = ?,
                archived_reason = ?
              WHERE id = ?
            `, [newStatus, new Date().toISOString(), archivedReason, workflow.id], (err) => {
              processed++
              
              if (err) {
                console.error(`❌ Failed to archive workflow ${workflow.name}:`, err)
              } else {
                console.log(`📦 Archived workflow (${newStatus}): ${workflow.name}`)
                archivedCount++
              }

              if (processed === workflows.length) {
                resolve(archivedCount)
              }
            })
          } else {
            processed++
            if (processed === workflows.length) {
              resolve(archivedCount)
            }
          }
        }
      })
    })
  }

  /**
   * Manually archive a workflow (user action)
   */
  async archiveWorkflow(
    workflowId: string,
    reason: string = 'Manually archived by user'
  ): Promise<void> {
    const db = this.getSQLiteClient()

    return new Promise((resolve, reject) => {
      db.run(`
        UPDATE workflows SET
          lifecycle_status = 'archived',
          archived_at = ?,
          archived_reason = ?
        WHERE id = ?
      `, [new Date().toISOString(), reason, workflowId], (err) => {
        db.close()
        if (err) {
          reject(err)
        } else {
          console.log(`📦 Manually archived workflow: ${workflowId}`)
          resolve()
        }
      })
    })
  }

  /**
   * Delete workflow backup from database (user action)
   */
  async deleteWorkflowBackup(workflowId: string): Promise<void> {
    const db = this.getSQLiteClient()

    return new Promise((resolve, reject) => {
      db.run('DELETE FROM workflows WHERE id = ?', [workflowId], (err) => {
        db.close()
        if (err) {
          reject(err)
        } else {
          console.log(`🗑️ Deleted workflow backup: ${workflowId}`)
          resolve()
        }
      })
    })
  }

  /**
   * Toggle backup setting for a workflow
   */
  async toggleWorkflowBackup(
    workflowId: string,
    backupEnabled: boolean
  ): Promise<void> {
    const db = this.getSQLiteClient()

    return new Promise((resolve, reject) => {
      db.run(`
        UPDATE workflows SET backup_enabled = ?
        WHERE id = ?
      `, [backupEnabled ? 1 : 0, workflowId], (err) => {
        db.close()
        if (err) {
          reject(err)
        } else {
          console.log(`💾 ${backupEnabled ? 'Enabled' : 'Disabled'} backup for workflow: ${workflowId}`)
          resolve()
        }
      })
    })
  }

  private async ensureDefaultProvider(db: Database): Promise<string> {
    return new Promise((resolve, reject) => {
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
          'default',
          1,
          'healthy'
        ], (err) => {
          if (err) {
            reject(err)
          } else {
            console.log('✅ Created default provider for workflow sync')
            resolve(providerId)
          }
        })
      })
    })
  }
}

// Export singleton instance
export const workflowSync = new WorkflowSyncService()