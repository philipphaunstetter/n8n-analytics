'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { AppLayout } from '@/components/app-layout'
import { WithN8NConnection } from '@/components/with-n8n-connection'
import { apiClient } from '@/lib/api-client'
import {
  ArrowLeftIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlayIcon,
  ExclamationTriangleIcon,
  ArrowTopRightOnSquareIcon,
  CpuChipIcon,
  CurrencyDollarIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline'
import { Badge } from '@/components/badge'
import { Button } from '@/components/button'
import { createN8nExecutionUrl } from '@/lib/utils'

interface ExecutionData {
  id: string
  providerId: string
  workflowId: string
  providerExecutionId: string
  providerWorkflowId: string
  status: 'success' | 'error' | 'running' | 'waiting' | 'canceled' | 'unknown'
  mode: string
  startedAt: Date
  stoppedAt?: Date
  duration?: number
  finished: boolean
  retryOf?: string
  retrySuccessId?: string
  totalTokens: number
  inputTokens: number
  outputTokens: number
  aiCost: number
  aiProvider?: string | null
  metadata: {
    workflowName: string
    providerName: string
    [key: string]: any
  }
  executionData?: {
    resultData?: {
      runData?: Record<string, any[]>
      error?: any
      lastNodeExecuted?: string
    }
    executionData?: any
    startData?: any
  }
  workflow: {
    name: string
    providerWorkflowId: string
    workflowJson?: any
  }
  provider: {
    name: string
    baseUrl: string
  }
}

const statusIcons = {
  'success': CheckCircleIcon,
  'error': XCircleIcon,
  'running': PlayIcon,
  'waiting': ClockIcon,
  'canceled': ExclamationTriangleIcon,
  'unknown': ClockIcon
}

const statusColors = {
  'success': 'green',
  'error': 'red',
  'running': 'blue',
  'waiting': 'yellow',
  'canceled': 'zinc',
  'unknown': 'zinc'
} as const

function ExecutionDetailContent() {
  const params = useParams()
  const router = useRouter()
  const executionId = params?.id as string
  
  const [execution, setExecution] = useState<ExecutionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)

  const fetchExecution = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get<{ data: ExecutionData }>(`/executions/${executionId}`)
      setExecution(response.data)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch execution:', err)
      setError('Failed to load execution details')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (executionId) {
      fetchExecution()
    }
  }, [executionId])

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(new Date(date))
  }

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A'
    if (ms < 1000) return `${ms}ms`
    const seconds = Math.floor(ms / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    return `${minutes}m ${seconds % 60}s`
  }

  const openInN8n = () => {
    if (!execution) return
    const url = createN8nExecutionUrl(
      execution.provider.baseUrl,
      execution.providerWorkflowId,
      execution.providerExecutionId
    )
    window.open(url, '_blank')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (error || !execution) {
    return (
      <div className="text-center py-12">
        <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-400" />
        <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">Error loading execution</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{error || 'Execution not found'}</p>
        <div className="mt-6 space-x-3">
          <Button onClick={() => router.back()}>
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Go Back
          </Button>
          <Button outline onClick={fetchExecution}>
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  const StatusIcon = statusIcons[execution.status]
  const nodeNames = execution.executionData?.resultData?.runData ? Object.keys(execution.executionData.resultData.runData) : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-4">
          <Button 
            outline 
            onClick={() => router.back()}
            className="flex items-center"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{execution.workflow.name}</h1>
              <Badge 
                color={statusColors[execution.status]}
                className="flex items-center space-x-1"
              >
                <StatusIcon className="h-3 w-3" />
                <span className="capitalize">{execution.status}</span>
              </Badge>
            </div>
            <p className="text-gray-600 dark:text-slate-400">Execution Details</p>
            <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-slate-400 mt-2">
              <span className="font-mono">{execution.providerExecutionId}</span>
              <span>•</span>
              <span>{execution.metadata.providerName}</span>
              <span>•</span>
              <span className="capitalize">{execution.mode} mode</span>
            </div>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button onClick={openInN8n}>
            <ArrowTopRightOnSquareIcon className="h-4 w-4 mr-2" />
            Open in n8n
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
        <div className="bg-white dark:bg-slate-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClockIcon className="h-6 w-6 text-blue-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-slate-400 truncate">Duration</dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">{formatDuration(execution.duration)}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-6 w-6 text-purple-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-slate-400 truncate">Nodes Executed</dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">{nodeNames.length}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CpuChipIcon className="h-6 w-6 text-indigo-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-slate-400 truncate">Total Tokens</dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {execution.totalTokens > 0 ? execution.totalTokens.toLocaleString() : '-'}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CurrencyDollarIcon className="h-6 w-6 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-slate-400 truncate">AI Cost</dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {execution.aiCost > 0 ? `$${execution.aiCost.toFixed(4)}` : '-'}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Node Execution Details */}
      {nodeNames.length > 0 && (
        <div className="bg-white dark:bg-slate-800 shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-300">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Node Execution Log</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Execution details for each workflow node</p>
          </div>
          <div className="divide-y divide-gray-200 dark:border-slate-300">
            {nodeNames.map((nodeName) => {
              const nodeData = execution.executionData?.resultData?.runData?.[nodeName]
              if (!nodeData || nodeData.length === 0) return null
              
              const run = nodeData[0]
              const startTime = run.startTime
              const executionTime = run.executionTime
              const hasError = run.error
              
              return (
                <div key={nodeName} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-slate-800">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">{nodeName}</h4>
                        {hasError ? (
                          <Badge color="red" className="flex items-center space-x-1">
                            <XCircleIcon className="h-3 w-3" />
                            <span>Error</span>
                          </Badge>
                        ) : (
                          <Badge color="green" className="flex items-center space-x-1">
                            <CheckCircleIcon className="h-3 w-3" />
                            <span>Success</span>
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-slate-400">
                        {startTime && (
                          <span>Started: {new Date(startTime).toLocaleTimeString()}</span>
                        )}
                        {executionTime && (
                          <span>Duration: {executionTime}ms</span>
                        )}
                        {run.data?.main?.[0] && (
                          <span>Output: {run.data.main[0].length} items</span>
                        )}
                      </div>
                      {hasError && (
                        <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
                          <p className="text-sm text-red-800 dark:text-red-200 font-mono">
                            {run.error.message || 'Unknown error'}
                          </p>
                        </div>
                      )}
                    </div>
                    <Button
                      outline
                      className="text-xs px-2 py-1"
                      onClick={() => setSelectedNode(selectedNode === nodeName ? null : nodeName)}
                    >
                      {selectedNode === nodeName ? 'Hide' : 'View'} Data
                    </Button>
                  </div>
                  
                  {selectedNode === nodeName && run.data && (
                    <div className="mt-4 p-4 bg-gray-50 dark:bg-slate-900 rounded-md overflow-x-auto">
                      <pre className="text-xs text-gray-800 dark:text-gray-200 font-mono whitespace-pre-wrap">
                        {JSON.stringify(run.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Execution Timeline */}
      <div className="bg-white dark:bg-slate-800 shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-300">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Execution Timeline</h3>
        </div>
        <div className="px-6 py-4">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-slate-400">Started At</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-white">{formatDate(execution.startedAt)}</dd>
            </div>
            {execution.stoppedAt && (
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-slate-400">Stopped At</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">{formatDate(execution.stoppedAt)}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-slate-400">Execution ID</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-white font-mono">{execution.providerExecutionId}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-slate-400">Workflow ID</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-white font-mono">{execution.providerWorkflowId}</dd>
            </div>
            {execution.aiProvider && (
              <>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-slate-400">AI Provider</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white capitalize">{execution.aiProvider}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-slate-400">Token Usage</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                    {execution.inputTokens.toLocaleString()} in / {execution.outputTokens.toLocaleString()} out
                  </dd>
                </div>
              </>
            )}
            {execution.retryOf && (
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-slate-400">Retry Of</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white font-mono">{execution.retryOf}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-slate-400">Finished</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-white">{execution.finished ? 'Yes' : 'No'}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  )
}

export default function ExecutionDetailPage() {
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
        <ExecutionDetailContent />
      </WithN8NConnection>
    </AppLayout>
  )
}
