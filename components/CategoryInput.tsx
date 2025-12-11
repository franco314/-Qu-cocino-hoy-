import React from 'react';
import { LucideIcon } from 'lucide-react';

interface CategoryInputProps {
  label: string;
  icon: LucideIcon;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  colorClass: string;
}

export const CategoryInput: React.FC<CategoryInputProps> = ({ 
  label, 
  icon: Icon, 
  value, 
  onChange, 
  placeholder,
  colorClass
}) => {
  return (
    <div className="group bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-black/5">
      <div className="flex items-center mb-3 space-x-2">
        <div className={`p-2 rounded-lg ${colorClass} bg-opacity-10`}>
          <Icon className={`w-5 h-5 ${colorClass.replace('bg-', 'text-')}`} />
        </div>
        <label className="font-semibold text-gray-700 text-sm tracking-wide uppercase">
          {label}
        </label>
      </div>
      <textarea
        className="w-full text-gray-600 placeholder-gray-300 bg-transparent border-none focus:ring-0 resize-none text-base leading-relaxed h-20 p-0"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};