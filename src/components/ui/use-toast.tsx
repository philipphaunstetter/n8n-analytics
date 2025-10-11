import { showToast } from '@/components/toast'

interface ToastOptions {
  title: string
  description?: string
  variant?: 'default' | 'destructive'
}

export function useToast() {
  const toast = ({ title, description, variant = 'default' }: ToastOptions) => {
    const type = variant === 'destructive' ? 'error' : 'info'
    
    showToast({
      type,
      title,
      message: description,
      duration: 5000
    })
  }

  return { toast }
}