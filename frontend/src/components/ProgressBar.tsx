import React from 'react';
import { Check } from 'lucide-react';

interface ProgressBarProps {
  currentStep: number;
}

const steps = [
  { id: 0, label: 'Upload' },
  { id: 1, label: 'Review' },
  { id: 2, label: 'Assign' },
  { id: 3, label: 'Split' },
];

export const ProgressBar: React.FC<ProgressBarProps> = ({ currentStep }) => {
  return (
    <div className="w-full py-6 mb-8">
      <div className="flex items-center justify-between max-w-2xl mx-auto relative">
        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-gray-200 -z-10"></div>
        <div 
          className="absolute left-0 top-1/2 transform -translate-y-1/2 h-1 bg-indigo-600 -z-10 transition-all duration-300"
          style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
        ></div>
        
        {steps.map((step) => (
          <div key={step.id} className="flex flex-col items-center">
            <div 
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                currentStep > step.id 
                  ? 'bg-indigo-600 text-white' 
                  : currentStep === step.id 
                    ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' 
                    : 'bg-white text-gray-500 border-2 border-gray-200'
              }`}
            >
              {currentStep > step.id ? <Check className="w-5 h-5" /> : step.id + 1}
            </div>
            <span className={`mt-2 text-sm font-medium ${
              currentStep >= step.id ? 'text-indigo-900' : 'text-gray-500'
            }`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
