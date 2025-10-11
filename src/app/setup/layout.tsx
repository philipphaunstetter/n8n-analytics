export default function SetupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {children}
    </div>
  )
}
