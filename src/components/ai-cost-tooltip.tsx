'use client'

import { useState } from 'react'
import { InformationCircleIcon } from '@heroicons/react/24/outline'
import { AI_PRICING, getModelPricing } from '@/lib/ai-pricing'
import { Drawer } from '@/components/drawer'

interface AICostTooltipProps {
    type: 'header' | 'cell'
    model?: string | null
    inputTokens?: number
    outputTokens?: number
    cost?: number
}

export function AICostTooltip({ type, model, inputTokens, outputTokens, cost }: AICostTooltipProps) {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)

    if (type === 'header') {
        return (
            <>
                <div className="relative inline-block ml-1">
                    <button
                        onClick={() => setIsDrawerOpen(true)}
                        className="focus:outline-none"
                        title="Click to view pricing details"
                    >
                        <InformationCircleIcon
                            className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 cursor-pointer"
                        />
                    </button>
                </div>

                <Drawer
                    isOpen={isDrawerOpen}
                    onClose={() => setIsDrawerOpen(false)}
                    title="AI Cost Calculation"
                    description="Costs are estimated based on token usage and standard pricing per 1K tokens."
                >
                    <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
                            Current Pricing Models (per 1K tokens)
                        </h4>
                        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                            <table className="min-w-full divide-y divide-gray-300 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-800">
                                    <tr>
                                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">
                                            Model
                                        </th>
                                        <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-white">
                                            Input
                                        </th>
                                        <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-white">
                                            Output
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
                                    {Object.entries(AI_PRICING).map(([name, pricing]) => (
                                        <tr key={name}>
                                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white sm:pl-6">
                                                {name}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-500 dark:text-slate-400">
                                                ${pricing.input}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-500 dark:text-slate-400">
                                                ${pricing.output}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-6 p-4 bg-gray-50 dark:bg-slate-800 rounded-md">
                            <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">How it works</h5>
                            <p className="text-sm text-gray-600 dark:text-slate-400">
                                We automatically detect the AI model used in your n8n workflows and apply the standard pricing for that model.
                                If a model is not recognized, we use an average pricing estimate.
                            </p>
                        </div>
                    </div>
                </Drawer>
            </>
        )
    }

    // Cell tooltip
    if (!model && !cost) return null

    const pricing = model ? getModelPricing(model) : null

    return (
        <div className="relative group inline-block">
            <div className="cursor-help border-b border-dotted border-gray-400 dark:border-slate-500">
                {cost !== undefined ? `$${cost.toFixed(4)}` : '-'}
            </div>

            <div className="absolute z-50 hidden group-hover:block w-64 p-3 mt-1 -ml-20 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 text-xs">
                <div className="space-y-2">
                    <div className="flex justify-between border-b border-gray-200 dark:border-slate-700 pb-2">
                        <span className="text-gray-500 dark:text-slate-400">Model:</span>
                        <span className="font-mono font-medium text-gray-900 dark:text-white">{model || 'Unknown'}</span>
                    </div>

                    {inputTokens !== undefined && (
                        <div className="flex justify-between">
                            <span className="text-gray-500 dark:text-slate-400">Input ({inputTokens.toLocaleString()}):</span>
                            <span className="text-gray-900 dark:text-white">
                                ${pricing ? ((inputTokens / 1000) * pricing.input).toFixed(5) : '-'}
                            </span>
                        </div>
                    )}

                    {outputTokens !== undefined && (
                        <div className="flex justify-between">
                            <span className="text-gray-500 dark:text-slate-400">Output ({outputTokens.toLocaleString()}):</span>
                            <span className="text-gray-900 dark:text-white">
                                ${pricing ? ((outputTokens / 1000) * pricing.output).toFixed(5) : '-'}
                            </span>
                        </div>
                    )}

                    <div className="flex justify-between border-t border-gray-200 dark:border-slate-700 pt-2 font-semibold">
                        <span className="text-gray-900 dark:text-white">Total:</span>
                        <span className="text-indigo-600 dark:text-indigo-400">${cost?.toFixed(5)}</span>
                    </div>

                    {!pricing && (
                        <div className="mt-2 text-[10px] text-yellow-600 dark:text-yellow-500 italic">
                            * Using average pricing (model unknown)
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
