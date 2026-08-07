import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <input
        className={cn(
          'w-full px-3.5 py-2.5 rounded-xl border text-sm text-gray-900 placeholder:text-gray-400 transition-all outline-none',
          'bg-white border-gray-200 focus:border-[#15AFA4] focus:ring-2 focus:ring-[#15AFA4]/20',
          error && 'border-red-300 focus:border-red-400 focus:ring-red-100',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options?: { value: string; label: string }[]
  placeholder?: string
}

export function Select({ label, error, options, placeholder, className, children, ...props }: SelectProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <select
        className={cn(
          'w-full px-3.5 py-2.5 rounded-xl border text-sm text-gray-900 transition-all outline-none',
          'bg-white border-gray-200 focus:border-[#15AFA4] focus:ring-2 focus:ring-[#15AFA4]/20',
          error && 'border-red-300',
          className
        )}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options
          ? options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)
          : children}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export function Textarea({ label, error, className, ...props }: TextareaProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <textarea
        className={cn(
          'w-full px-3.5 py-2.5 rounded-xl border text-sm text-gray-900 placeholder:text-gray-400 transition-all outline-none resize-none',
          'bg-white border-gray-200 focus:border-[#15AFA4] focus:ring-2 focus:ring-[#15AFA4]/20',
          error && 'border-red-300',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
