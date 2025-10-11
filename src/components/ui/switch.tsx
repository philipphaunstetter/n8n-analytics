import React from 'react'
import { Switch as HeadlessSwitch } from '@/components/switch'

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  className?: string
}

export function Switch({ checked, onCheckedChange, className, ...props }: SwitchProps) {
  return (
    <HeadlessSwitch
      checked={checked}
      onChange={onCheckedChange}
      className={className}
      {...props}
    />
  )
}

export default Switch
