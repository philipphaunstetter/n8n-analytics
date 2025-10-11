import { Select as HeadlessSelect } from '@/components/select'

// For now, create simple wrappers that match the expected interface
export function Select({ children, ...props }: any) {
  return <HeadlessSelect {...props}>{children}</HeadlessSelect>
}

export function SelectContent({ children, ...props }: any) {
  return <div {...props}>{children}</div>
}

export function SelectItem({ children, value, ...props }: any) {
  return <option value={value} {...props}>{children}</option>
}

export function SelectTrigger({ children, ...props }: any) {
  return <div {...props}>{children}</div>
}

export function SelectValue({ placeholder, ...props }: any) {
  return <span {...props}>{placeholder}</span>
}