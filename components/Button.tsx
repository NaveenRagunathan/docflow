import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  active = false,
  className = '', 
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 disabled:pointer-events-none disabled:opacity-50";
  
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
    secondary: "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700",
    ghost: "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800",
    icon: "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-full",
  };

  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-9 px-4 py-2 text-sm",
    lg: "h-10 px-8 text-base",
  };
  
  const iconSizes = {
      sm: "h-8 w-8",
      md: "h-9 w-9",
      lg: "h-10 w-10"
  };

  const activeStyles = active ? "bg-zinc-700 text-zinc-100" : "";
  
  const sizeClass = variant === 'icon' ? (iconSizes[size] || iconSizes.md) : (sizes[size] || sizes.md);

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizeClass} ${activeStyles} ${className}`} 
      {...props}
    >
      {children}
    </button>
  );
};