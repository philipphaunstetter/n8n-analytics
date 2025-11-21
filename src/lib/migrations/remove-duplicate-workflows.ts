import { getDb } from './db'

/**
 * Remove duplicate workflows keeping only the most recent one
 */
export async function removeDuplicateWorkflows(): Promise<{
    duplicatesFound: number
    duplicatesRemoved: number
}> {
    const db = getDb()

    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Find duplicates
            db.all(`
        SELECT provider_id, provider_workflow_id, COUNT(*) as count
        FROM workflows
        GROUP BY provider_id, provider_workflow_id
        HAVING COUNT(*) > 1
      `, (err, duplicates: any[]) => {
                if (err) {
                    reject(err)
                    return
                }

                if (duplicates.length === 0) {
                    console.log('✅ No duplicate workflows found')
                    resolve({ duplicatesFound: 0, duplicatesRemoved: 0 })
                    return
                }

                console.log(`🔍 Found ${duplicates.length} duplicate workflow groups`)

                let removed = 0
                let processed = 0

                // For each duplicate group, keep the most recent and delete the rest
                duplicates.forEach(dup => {
                    db.all(`
            SELECT id, name, updated_at
            FROM workflows
            WHERE provider_id = ? AND provider_workflow_id = ?
            ORDER BY updated_at DESC
          `, [dup.provider_id, dup.provider_workflow_id], (err, workflows: any[]) => {
                        if (err) {
                            console.error('Error fetching duplicate workflows:', err)
                            processed++
                            if (processed === duplicates.length) {
                                resolve({ duplicatesFound: duplicates.length, duplicatesRemoved: removed })
                            }
                            return
                        }

                        // Keep the first (most recent), delete the rest
                        const toDelete = workflows.slice(1)

                        if (toDelete.length > 0) {
                            const ids = toDelete.map(w => `'${w.id}'`).join(',')

                            db.run(`DELETE FROM workflows WHERE id IN (${ids})`, (err) => {
                                if (err) {
                                    console.error('Error deleting duplicate workflows:', err)
                                } else {
                                    console.log(`🗑️  Removed ${toDelete.length} duplicates of "${workflows[0].name}"`)
                                    removed += toDelete.length
                                }

                                processed++
                                if (processed === duplicates.length) {
                                    resolve({ duplicatesFound: duplicates.length, duplicatesRemoved: removed })
                                }
                            })
                        } else {
                            processed++
                            if (processed === duplicates.length) {
                                resolve({ duplicatesFound: duplicates.length, duplicatesRemoved: removed })
                            }
                        }
                    })
                })
            })
        })
    })
}
