'use client'

import Link from 'next/link'
import {
  ChartPieIcon,
  EyeIcon,
  ServerIcon,
  ShieldCheckIcon,
  BoltIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'

const features = [
  {
    name: 'Unified Dashboard',
    description: 'Monitor all your workflow executions across n8n, Zapier, Make.com and other platforms in one place.',
    icon: ChartPieIcon,
  },
  {
    name: 'Visual Debugging',
    description: 'See exactly where workflows fail with interactive flowchart visualizations and step-by-step execution traces.',
    icon: EyeIcon,
  },
  {
    name: 'Infrastructure Monitoring',
    description: 'Keep track of endpoint health, response times, and system status across all your automation instances.',
    icon: ServerIcon,
  },
  {
    name: 'Security & Compliance',
    description: 'Track data flows, monitor permissions, and maintain audit trails for compliance requirements.',
    icon: ShieldCheckIcon,
  },
  {
    name: 'Performance Analytics',
    description: 'Identify bottlenecks, optimize execution times, and improve workflow efficiency with detailed metrics.',
    icon: BoltIcon,
  },
]

const providers = [
  { name: 'n8n', logo: '/logos/n8n.svg' },
  { name: 'Zapier', logo: '/logos/zapier.svg' },
  { name: 'Make.com', logo: '/logos/make.svg' },
  { name: 'Pipedream', logo: '/logos/pipedream.svg' },
]

export default function LandingPage() {
  return (
    <div className="bg-white">
      {/* Header */}
      <header className="absolute inset-x-0 top-0 z-50">
        <nav className="flex items-center justify-between p-6 lg:px-8" aria-label="Global">
          <div className="flex lg:flex-1">
            <a href="#" className="-m-1.5 p-1.5">
              <span className="sr-only">Elova</span>
              <div className="flex items-center space-x-2">
                <ChartPieIcon className="h-8 w-8 text-indigo-600" />
                <span className="text-xl font-bold text-gray-900">Elova</span>
              </div>
            </a>
          </div>
          <div className="flex lg:flex-1 lg:justify-end">
            <Link
              href="/auth/signin"
              className="text-sm font-semibold leading-6 text-gray-900 hover:text-indigo-600"
            >
              Sign in <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero section */}
      <div className="relative isolate px-6 pt-14 lg:px-8">
        <div
          className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
          aria-hidden="true"
        >
          <div
            className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
            style={{
              clipPath:
                'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
            }}
          />
        </div>
        <div className="mx-auto max-w-2xl py-32 sm:py-48 lg:py-56">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              Monitor Your Workflow Automation
              <span className="block text-indigo-600">Across All Platforms</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Get unified observability for n8n, Zapier, Make.com and other automation platforms.
              Debug failures faster, optimize performance, and maintain compliance with a single dashboard.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                href="/auth/signup"
                className="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                Get started
              </Link>
              <a href="#features" className="text-sm font-semibold leading-6 text-gray-900">
                Learn more <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        </div>
        <div
          className="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]"
          aria-hidden="true"
        >
          <div
            className="relative left-[calc(50%+3rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:left-[calc(50%+36rem)] sm:w-[72.1875rem]"
            style={{
              clipPath:
                'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
            }}
          />
        </div>
      </div>

      {/* Provider logos */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:max-w-none">
          <p className="text-center text-lg font-semibold leading-8 text-gray-900">
            Works with all major automation platforms
          </p>
          <div className="mx-auto mt-10 grid max-w-lg grid-cols-4 items-center gap-x-8 gap-y-10 sm:max-w-xl sm:grid-cols-6 sm:gap-x-10 lg:mx-0 lg:max-w-none lg:grid-cols-4">
            {providers.map((provider) => (
              <div key={provider.name} className="flex justify-center">
                <div className="text-center">
                  <div className="mx-auto h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-600">{provider.name}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features section */}
      <div id="features" className="mx-auto mt-32 max-w-7xl px-6 sm:mt-56 lg:px-8">
        <div className="mx-auto max-w-2xl lg:text-center">
          <h2 className="text-base font-semibold leading-7 text-indigo-600">Everything you need</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Comprehensive workflow observability
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Monitor, debug, and optimize your automation workflows with powerful tools designed for modern DevOps teams.
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.name} className="flex flex-col">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900">
                  <feature.icon className="h-5 w-5 flex-none text-indigo-600" aria-hidden="true" />
                  {feature.name}
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600">
                  <p className="flex-auto">{feature.description}</p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* CTA section */}
      <div className="mx-auto mt-32 max-w-7xl sm:mt-56 sm:px-6 lg:px-8">
        <div className="relative isolate overflow-hidden bg-gray-900 px-6 py-24 text-center shadow-2xl sm:rounded-3xl sm:px-16">
          <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Start monitoring your workflows today
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-gray-300">
            Join teams already using Elova to improve their automation reliability and performance.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link
              href="/auth/signup"
              className="rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Get started
            </Link>
            <Link href="/auth/signin" className="text-sm font-semibold leading-6 text-white">
              Sign in <ArrowRightIcon className="ml-1 h-4 w-4 inline" />
            </Link>
          </div>
          <div
            className="absolute -top-24 right-0 -z-10 transform-gpu blur-3xl"
            aria-hidden="true"
          >
            <div
              className="aspect-[1404/767] w-[87.75rem] bg-gradient-to-r from-[#80caff] to-[#4f46e5] opacity-25"
              style={{
                clipPath:
                  'polygon(73.6% 51.7%, 91.7% 11.8%, 100% 46.4%, 97.4% 82.2%, 92.5% 84.9%, 75.7% 64%, 55.3% 47.5%, 46.5% 49.4%, 45% 62.9%, 50.3% 87.2%, 21.3% 64.1%, 0.1% 100%, 5.4% 51.1%, 21.4% 63.9%, 58.9% 0.2%, 73.6% 51.7%)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mx-auto mt-32 max-w-7xl px-6 lg:px-8">
        <div className="border-t border-gray-900/10 py-16 sm:py-24">
          <div className="flex items-center justify-center">
            <div className="flex items-center space-x-2">
              <ChartPieIcon className="h-6 w-6 text-indigo-600" />
              <span className="text-lg font-semibold text-gray-900">Elova</span>
            </div>
          </div>
          <p className="mt-8 text-center text-xs leading-5 text-gray-500">
            &copy; 2024 Elova. Built for modern DevOps teams.
          </p>
        </div>
      </footer>
    </div>
  )
}