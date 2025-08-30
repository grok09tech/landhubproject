import React from 'react';
import { Home, Building2, Tractor, Factory, MapPin } from 'lucide-react';

interface IntendedUseSelectorProps {
  value: 'residential' | 'commercial' | 'agricultural' | 'industrial' | 'mixed';
  onChange: (value: 'residential' | 'commercial' | 'agricultural' | 'industrial' | 'mixed') => void;
  disabled?: boolean;
}

const IntendedUseSelector: React.FC<IntendedUseSelectorProps> = ({
  value,
  onChange,
  disabled = false
}) => {
  const options = [
    {
      value: 'residential' as const,
      label: 'Residential',
      description: 'For building homes and residential properties',
      icon: Home,
      color: 'bg-blue-500'
    },
    {
      value: 'commercial' as const,
      label: 'Commercial',
      description: 'For business and commercial activities',
      icon: Building2,
      color: 'bg-green-500'
    },
    {
      value: 'agricultural' as const,
      label: 'Agricultural',
      description: 'For farming and agricultural purposes',
      icon: Tractor,
      color: 'bg-yellow-500'
    },
    {
      value: 'industrial' as const,
      label: 'Industrial',
      description: 'For industrial and manufacturing use',
      icon: Factory,
      color: 'bg-red-500'
    },
    {
      value: 'mixed' as const,
      label: 'Mixed Use',
      description: 'For mixed residential and commercial use',
      icon: MapPin,
      color: 'bg-purple-500'
    }
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Select Intended Use</h3>
        <p className="text-sm text-gray-600 mb-4">
          Choose how you plan to use this land plot. This helps us process your application appropriately.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {options.map((option) => {
          const Icon = option.icon;
          const isSelected = value === option.value;

          return (
            <div
              key={option.value}
              onClick={() => !disabled && onChange(option.value)}
              className={`
                relative p-4 border-2 rounded-lg cursor-pointer transition-all duration-200
                ${isSelected
                  ? 'border-green-500 bg-green-50 shadow-md'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <div className="flex items-start space-x-3">
                <div className={`
                  flex items-center justify-center w-10 h-10 rounded-lg ${option.color} text-white
                  ${isSelected ? 'ring-2 ring-green-300' : ''}
                `}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900">{option.label}</h4>
                  <p className="text-sm text-gray-600 mt-1">{option.description}</p>
                </div>
              </div>

              {isSelected && (
                <div className="absolute top-2 right-2">
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {value && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">
            <strong>Selected:</strong> {options.find(opt => opt.value === value)?.label}
          </p>
        </div>
      )}
    </div>
  );
};

export default IntendedUseSelector;
