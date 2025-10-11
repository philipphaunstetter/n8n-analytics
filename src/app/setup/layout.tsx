import { ChartPieIcon } from '@heroicons/react/24/outline'

export default function SetupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-2">
              <ChartPieIcon className="h-8 w-8 text-indigo-600" />
              <span className="text-2xl font-bold text-gray-900">Elova</span>
            </div>
            <div className="text-sm text-gray-500">
              Setup Wizard
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {children}
      </main>

      {/* Footer */}
      <footer className="mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="text-center text-sm text-gray-500">
            Need help? Check our{' '}
            <a 
              href="#" 
              className="text-indigo-600 hover:text-indigo-500 font-medium"
            >
              documentation
            </a>{' '}
            or{' '}
            <a 
              href="#" 
              className="text-indigo-600 hover:text-indigo-500 font-medium"
            >
              contact support
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}