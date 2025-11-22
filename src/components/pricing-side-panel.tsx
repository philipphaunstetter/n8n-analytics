'use client'

import { XMarkIcon } from '@heroicons/react/24/outline'
import { AI_PRICING } from '@/lib/ai-pricing'

interface PricingSidePanelProps {
    isOpen: boolean
    onClose: () => void
}

export function PricingSidePanel({ isOpen, onClose }: PricingSidePanelProps) {
    return (
        <div className="fixed inset-y-0 right-0 flex max-w-full pointer-events-none">
            <div
                className={`pointer-events-auto w-full max-w-2xl transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                <div className="h-full flex flex-col overflow-y-scroll bg-white dark:bg-slate-900 shadow-xl border-l border-gray-200 dark:border-slate-800 mt-6 mr-6 mb-6 sm:mt-10 sm:mr-10 sm:mb-10 rounded-l-lg">
                    <div className="px-4 py-6 sm:px-6">
                        <div className="flex items-start justify-between">
                            <h2 className="text-base font-semibold leading-6 text-gray-900 dark:text-white">
                                AI Cost Calculation
                            </h2>
                            <div className="ml-3 flex h-7 items-center">
                                <button
                                    type="button"
                                    className="relative rounded-md bg-white dark:bg-slate-900 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                                    onClick={onClose}
                                >
                                    <span className="absolute -inset-2.5" />
                                    <span className="sr-only">Close panel</span>
                                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                                </button>
                            </div>
                        </div>
                        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                            Costs are estimated based on token usage and standard pricing per 1K tokens.
                        </p>
                    </div>

                    <div className="relative flex-1 px-4 py-6 sm:px-6 border-t border-gray-200 dark:border-slate-800">
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
                </div>
            </div>
        </div>
    )
}
