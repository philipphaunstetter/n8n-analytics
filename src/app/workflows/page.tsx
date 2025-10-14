'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { AppLayout } from '@/components/app-layout'
import { WithN8NConnection } from '@/components/with-n8n-connection'
import { apiClient } from '@/lib/api-client'
import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon,
  ArchiveBoxIcon
} from '@heroicons/react/24/outline'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/table'
import { Badge } from '@/components/badge'
import { Button } from '@/components/button'
import { Input } from '@/components/input'
import { Select } from '@/components/select'
import { showToast } from '@/components/toast'

interface Workflow {
  id: string
  providerId: string
  providerWorkflowId: string
  name: string
  description?: string
  isActive: boolean
  isArchived?: boolean
  tags: string[]
  createdAt: Date
  updatedAt: Date
  lastExecutedAt?: Date
  totalExecutions: number
  successCount: number
  failureCount: number
  successRate: number
  avgDuration?: number
  metadata?: {
    nodeCount: number
    n8nWorkflowId: string
    connections?: Record<string, unknown>
  }
  lastExecutionStatus?: 'success' | 'error' | 'running' | 'waiting' | 'canceled'
}

function WorkflowsContent() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [backing, setBacking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'archived'>('all')
  const router = useRouter()

  const fetchWorkflows = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        if (statusFilter === 'active') {
          params.append('isActive', 'true')
        } else if (statusFilter === 'inactive') {
          params.append('isActive', 'false')
          params.append('isArchived', 'false')
        } else if (statusFilter === 'archived') {
          params.append('isArchived', 'true')
        }
      }
      
      const response = await apiClient.get<{ data: { items: Workflow[] } }>(`/workflows?${params}`)
      setWorkflows(response.data.items)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch workflows:', err)
      setError('Failed to load workflows')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchWorkflows()
  }, [fetchWorkflows])

  const syncWorkflows = async () => {
    try {
      setSyncing(true)
      await apiClient.post('/sync/workflows')
      // After successful sync, refresh the data
      await fetchWorkflows()
      setError(null)
      
      showToast({
        type: 'success',
        title: 'Workflows synced successfully',
        message: 'Latest workflow data has been fetched from n8n'
      })
    } catch (err) {
      console.error('Failed to sync workflows:', err)
      const errorMessage = 'Failed to sync workflows. Please try again.'
      setError(errorMessage)
      
      showToast({
        type: 'error',
        title: 'Sync failed',
        message: errorMessage
      })
    } finally {
      setSyncing(false)
    }
  }

  const backupWorkflows = async () => {
    try {
      setBacking(true)
      await apiClient.post('/sync/backup')
      setError(null)
      
      showToast({
        type: 'success',
        title: 'Workflows backed up successfully',
        message: 'All workflows have been backed up to the database'
      })
    } catch (err) {
      console.error('Failed to backup workflows:', err)
      const errorMessage = 'Failed to backup workflows. Please try again.'
      setError(errorMessage)
      
      showToast({
        type: 'error',
        title: 'Backup failed',
        message: errorMessage
      })
    } finally {
      setBacking(false)
    }
  }

  const filteredWorkflows = workflows.filter(workflow => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      workflow.id.toLowerCase().includes(searchLower) ||
      workflow.name.toLowerCase().includes(searchLower) ||
      workflow.tags.some(tag => tag.toLowerCase().includes(searchLower))
    )
  })

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date))
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-400" />
        <h3 className="mt-2 text-sm font-semibold text-gray-900">Error loading workflows</h3>
        <p className="mt-1 text-sm text-gray-500">{error}</p>
        <Button onClick={fetchWorkflows} className="mt-4">
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workflows</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage and monitor your n8n workflows
          </p>
        </div>
        <div className="flex space-x-3">
          <Button 
            outline
            onClick={backupWorkflows} 
            disabled={backing || loading}
            className="flex items-center space-x-2"
          >
            <ArchiveBoxIcon className={`h-4 w-4 ${backing ? 'animate-pulse' : ''}`} />
            <span>{backing ? 'Backing up...' : 'Backup now'}</span>
          </Button>
          <Button 
            outline
            onClick={syncWorkflows} 
            disabled={syncing || loading}
            className="flex items-center space-x-2"
          >
            <ArrowPathIcon className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing...' : 'Sync'}</span>
          </Button>
          <Button onClick={fetchWorkflows} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div>
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <div className="relative">
            <Input
              id="search"
              type="text"
              placeholder="Search workflows..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          </div>
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <Select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive' | 'archived')}
          >
            <option value="all">All workflows</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </Select>
        </div>

        <div className="flex items-end">
          <Button outline className="flex items-center space-x-2">
            <FunnelIcon className="h-4 w-4" />
            <span>More Filters</span>
          </Button>
        </div>
      </div>

      {/* Results Summary */}
      <div className="bg-white px-4 py-3 border border-gray-200 rounded-md">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Showing {filteredWorkflows.length} of {workflows.length} workflows
          </span>
          <span>
            {workflows.filter(w => w.isActive).length} active, {workflows.filter(w => !w.isActive && !(w.isArchived ?? false)).length} inactive, {workflows.filter(w => w.isArchived ?? false).length} archived
          </span>
        </div>
      </div>

      {/* Workflows Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Status</TableHeader>
              <TableHeader>Name</TableHeader>
              <TableHeader>Tags</TableHeader>
              <TableHeader>Last Execution</TableHeader>
              <TableHeader>Total Executions</TableHeader>
              <TableHeader>Updated</TableHeader>
              <TableHeader>Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              // Loading rows
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <div className="animate-pulse flex space-x-4 py-4">
                      <div className="rounded-full bg-gray-300 h-6 w-6"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                        <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : filteredWorkflows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  {workflows.length === 0 
                    ? 'No workflows found'
                    : 'No workflows match your search criteria'
                  }
                </TableCell>
              </TableRow>
            ) : (
              filteredWorkflows.map((workflow) => (
                <TableRow 
                  key={workflow.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/workflows/${workflow.id}`)}
                >
                  <TableCell>
                    <Badge 
                      color={workflow.isActive ? 'green' : (workflow.isArchived ?? false) ? 'orange' : 'zinc'} 
                      className="flex items-center space-x-1"
                    >
                      {workflow.isActive ? (
                        <CheckCircleIcon className="h-3 w-3" />
                      ) : (workflow.isArchived ?? false) ? (
                        <ArchiveBoxIcon className="h-3 w-3" />
                      ) : (
                        <ClockIcon className="h-3 w-3" />
                      )}
                      <span>
                        {workflow.isActive ? 'Active' : (workflow.isArchived ?? false) ? 'Archived' : 'Inactive'}
                      </span>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span 
                        className="font-medium text-gray-900 truncate max-w-xs" 
                        title={workflow.name}
                      >
                        {workflow.name}
                      </span>
                      <span className="text-xs text-gray-500 font-mono truncate max-w-xs" title={workflow.id}>
                        {workflow.id}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {workflow.tags.length > 0 ? (
                        workflow.tags.slice(0, 3).map((tag, index) => (
                          <Badge key={index} color="zinc" className="text-xs">
                            {tag}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-gray-400 text-sm">No tags</span>
                      )}
                      {workflow.tags.length > 3 && (
                        <Badge color="zinc" className="text-xs">
                          +{workflow.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {workflow.lastExecutedAt ? (
                      <span className="text-sm">
                        {formatDate(workflow.lastExecutedAt)}
                      </span>
                    ) : (
                      <span className="text-gray-400">Never</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{workflow.totalExecutions}</span>
                  </TableCell>
                  <TableCell>
                    {formatDate(workflow.updatedAt)}
                  </TableCell>
                  <TableCell>
                    <Button 
                      outline 
                      className="text-sm px-3 py-1"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation()
                        router.push(`/workflows/${workflow.id}`)
                      }}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export default function WorkflowsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <AppLayout>
      <WithN8NConnection>
        <WorkflowsContent />
      </WithN8NConnection>
    </AppLayout>
  )
}