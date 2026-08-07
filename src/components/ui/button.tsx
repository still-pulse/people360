import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  icon?: React.ReactNode
}

const variants = {
  primary: 'text-white shadow-sm hover:opacity-90 active:opacity-80',
  secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
  outline: 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50',
  ghost: 'text-gray-600 hover:bg-gray-100',
  danger: 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg',
  md: 'px-4 py-2.5 text-sm gap-2 rounded-xl',
  lg: 'px-5 py-3 text-sm gap-2 rounded-xl',
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading,
  icon,
  className,
  disabled,
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || isLoading}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap',
        variants[variant],
        sizes[size],
        className
      )}
      style={variant === 'primary' ? { background: 'linear-gradient(135deg, #15AFA4, #0d8c83)', ...style } : style}
      {...props}
    >
      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  )
}
