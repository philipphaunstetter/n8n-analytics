'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogBody } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    CheckCircleIcon,
    ArrowPathIcon,
    RocketLaunchIcon,
    ServerStackIcon
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface OnboardingModalProps {
    isOpen: boolean
    onComplete: () => void
}

type Step = 'welcome' | 'connect' | 'sync' | 'complete'

export function OnboardingModal({ isOpen, onComplete }: OnboardingModalProps) {
    const [step, setStep] = useState<Step>('welcome')
    const [url, setUrl] = useState('')
    const [apiKey, setApiKey] = useState('')
    const [isConnecting, setIsConnecting] = useState(false)
    const [isSyncing, setIsSyncing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [syncProgress, setSyncProgress] = useState(0)

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setStep('welcome')
            setError(null)
            setSyncProgress(0)
        }
    }, [isOpen])

    const handleConnect = async () => {
        if (!url || !apiKey) {
            setError('Please fill in all fields')
            return
        }

        setIsConnecting(true)
        setError(null)

        try {
            // First test the connection
            const testResponse = await fetch('/api/onboarding/test-n8n', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, apiKey })
            })

            if (!testResponse.ok) {
                const data = await testResponse.json()
                throw new Error(data.error || 'Failed to connect to n8n')
            }

            // If successful, save the configuration
            const saveResponse = await fetch('/api/onboarding/save-step', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    step: 'n8n-integration',
                    data: { url, apiKey }
                })
            })

            if (!saveResponse.ok) {
                throw new Error('Failed to save configuration')
            }

            setStep('sync')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred')
        } finally {
            setIsConnecting(false)
        }
    }

    const handleStartSync = async () => {
        setIsSyncing(true)
        setError(null)

        // Simulate progress for better UX
        const progressInterval = setInterval(() => {
            setSyncProgress(prev => {
                if (prev >= 90) return prev
                return prev + 10
            })
        }, 500)

        try {
            const response = await fetch('/api/sync/workflows', {
                method: 'POST'
            })

            if (!response.ok) {
                throw new Error('Sync failed')
            }

            clearInterval(progressInterval)
            setSyncProgress(100)

            // Small delay to show 100%
            setTimeout(() => {
                setStep('complete')
            }, 500)
        } catch (err) {
            clearInterval(progressInterval)
            setError('Failed to sync data. Please try again.')
            setSyncProgress(0)
        } finally {
            setIsSyncing(false)
        }
    }

    return (
        <Dialog open={isOpen} onClose={() => { }} size="2xl">
            <DialogBody className="p-0 sm:p-0">
                <div className="flex flex-col md:flex-row min-h-[500px]">
                    {/* Sidebar / Progress */}
                    <div className="w-full md:w-64 bg-slate-50 dark:bg-slate-900 p-6 md:border-r border-slate-200 dark:border-slate-800">
                        <div className="mb-8">
                            <div className="flex items-center gap-2 font-bold text-xl text-slate-900 dark:text-white">
                                <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                                    <RocketLaunchIcon className="h-5 w-5" />
                                </div>
                                <span>Setup</span>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <StepIndicator
                                active={step === 'welcome'}
                                completed={step !== 'welcome'}
                                label="Welcome"
                                index={1}
                            />
                            <StepIndicator
                                active={step === 'connect'}
                                completed={step === 'sync' || step === 'complete'}
                                label="Connect n8n"
                                index={2}
                            />
                            <StepIndicator
                                active={step === 'sync'}
                                completed={step === 'complete'}
                                label="Initial Sync"
                                index={3}
                            />
                            <StepIndicator
                                active={step === 'complete'}
                                completed={false}
                                label="Ready"
                                index={4}
                            />
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 p-8 flex flex-col">
                        {step === 'welcome' && (
                            <div className="flex-1 flex flex-col justify-center items-center text-center max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="h-16 w-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mb-6 text-indigo-600 dark:text-indigo-400">
                                    <RocketLaunchIcon className="h-8 w-8" />
                                </div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                                    Welcome to n8n Analytics
                                </h2>
                                <p className="text-slate-600 dark:text-slate-400 mb-8">
                                    Let's get you set up! We'll connect to your n8n instance and sync your workflow history so you can start monitoring right away.
                                </p>
                                <Button onClick={() => setStep('connect')} className="w-full sm:w-auto min-w-[200px] py-2.5 text-base">
                                    Get Started
                                </Button>
                            </div>
                        )}

                        {step === 'connect' && (
                            <div className="flex-1 flex flex-col max-w-md mx-auto w-full justify-center animate-in fade-in slide-in-from-right-8 duration-300">
                                <div className="mb-6">
                                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                                        Connect your Instance
                                    </h2>
                                    <p className="text-slate-600 dark:text-slate-400 text-sm">
                                        Enter your n8n instance details to establish a connection.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="url">n8n Instance URL</Label>
                                        <Input
                                            id="url"
                                            placeholder="https://n8n.your-company.com"
                                            value={url}
                                            onChange={(e) => setUrl(e.target.value)}
                                            disabled={isConnecting}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="apiKey">API Key</Label>
                                        <Input
                                            id="apiKey"
                                            type="password"
                                            placeholder="n8n_api_..."
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                            disabled={isConnecting}
                                            className="font-mono"
                                        />
                                        <p className="text-xs text-slate-500">
                                            Found in Settings &rarr; n8n API in your n8n instance.
                                        </p>
                                    </div>

                                    {error && (
                                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-md">
                                            {error}
                                        </div>
                                    )}

                                    <div className="pt-4">
                                        <Button
                                            className="w-full py-2.5 text-base"
                                            onClick={handleConnect}
                                            disabled={isConnecting || !url || !apiKey}
                                        >
                                            {isConnecting ? (
                                                <>
                                                    <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                                                    Connecting...
                                                </>
                                            ) : 'Connect & Continue'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 'sync' && (
                            <div className="flex-1 flex flex-col justify-center items-center text-center max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300">
                                <div className="mb-8 relative">
                                    <div className="h-20 w-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                                        <ArrowPathIcon className={clsx("h-10 w-10 text-blue-600 dark:text-blue-400", isSyncing && "animate-spin")} />
                                    </div>
                                    {/* Pulse effect */}
                                    {isSyncing && (
                                        <div className="absolute inset-0 rounded-full bg-blue-400/20 animate-ping" />
                                    )}
                                </div>

                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                                    Syncing Data
                                </h2>
                                <p className="text-slate-600 dark:text-slate-400 mb-8">
                                    We're fetching your workflows and execution history. This might take a moment depending on your data size.
                                </p>

                                {isSyncing ? (
                                    <div className="w-full max-w-xs space-y-2">
                                        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-blue-600 transition-all duration-500 ease-out"
                                                style={{ width: `${syncProgress}%` }}
                                            />
                                        </div>
                                        <p className="text-xs text-slate-500 text-right">{syncProgress}%</p>
                                    </div>
                                ) : (
                                    <div className="w-full">
                                        {error && (
                                            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-md">
                                                {error}
                                            </div>
                                        )}
                                        <Button onClick={handleStartSync} className="w-full sm:w-auto min-w-[200px] py-2.5 text-base">
                                            Start Sync
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}

                        {step === 'complete' && (
                            <div className="flex-1 flex flex-col justify-center items-center text-center max-w-md mx-auto animate-in fade-in zoom-in-95 duration-500">
                                <div className="h-20 w-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6 text-green-600 dark:text-green-400">
                                    <CheckCircleIcon className="h-10 w-10" />
                                </div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                                    All Set!
                                </h2>
                                <p className="text-slate-600 dark:text-slate-400 mb-8">
                                    Your n8n instance is connected and your data has been synced. You're ready to start monitoring.
                                </p>
                                <Button onClick={onComplete} className="w-full sm:w-auto min-w-[200px] py-2.5 text-base">
                                    Go to Dashboard
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </DialogBody>
        </Dialog>
    )
}

function StepIndicator({ active, completed, label, index }: { active: boolean, completed: boolean, label: string, index: number }) {
    return (
        <div className={clsx("flex items-center gap-3", active ? "opacity-100" : "opacity-60")}>
            <div className={clsx(
                "h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors",
                completed ? "bg-indigo-600 border-indigo-600 text-white" :
                    active ? "border-indigo-600 text-indigo-600" : "border-slate-300 text-slate-500 dark:border-slate-600"
            )}>
                {completed ? <CheckCircleIcon className="h-5 w-5" /> : index}
            </div>
            <span className={clsx("font-medium", active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400")}>
                {label}
            </span>
        </div>
    )
}
