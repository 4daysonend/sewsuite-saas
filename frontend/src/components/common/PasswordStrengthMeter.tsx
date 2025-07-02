import React, { useMemo } from 'react';

interface PasswordStrengthMeterProps {
  password: string;
}

const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({ password }) => {
  const { strength, label, color } = useMemo(() => {
    if (!password) {
      return { strength: 0, label: '', color: 'bg-gray-200' };
    }
    
    // Calculate password strength
    let score = 0;
    
    // Length check
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    
    // Complexity checks
    if (/[A-Z]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    
    // Determine strength level
    let strength = 0;
    let label = '';
    let color = '';
    
    if (score <= 2) {
      strength = 1;
      label = 'Weak';
      color = 'bg-red-500';
    } else if (score <= 4) {
      strength = 2;
      label = 'Fair';
      color = 'bg-yellow-500';
    } else if (score <= 5) {
      strength = 3;
      label = 'Good';
      color = 'bg-blue-500';
    } else {
      strength = 4;
      label = 'Strong';
      color = 'bg-green-500';
    }
    
    return { strength, label, color };
  }, [password]);
  
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <div className="flex-1 flex h-2 bg-gray-200 rounded-full overflow-hidden">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className={`flex-1 ${
                index < strength ? color : 'bg-gray-200'
              } ${index > 0 ? 'ml-1' : ''}`}
            />
          ))}
        </div>
        <span className="ml-2 text-xs font-medium text-gray-600">{label}</span>
      </div>
      
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500 mt-2">
        <div className="flex items-center">
          <svg className={`h-3 w-3 mr-1 ${/[A-Z]/.test(password) ? 'text-green-500' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
            {/[A-Z]/.test(password) ? (
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            ) : (
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
            )}
          </svg>
          Uppercase letter
        </div>
        
        <div className="flex items-center">
          <svg className={`h-3 w-3 mr-1 ${/[a-z]/.test(password) ? 'text-green-500' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
            {/[a-z]/.test(password) ? (
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            ) : (
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
            )}
          </svg>
          Lowercase letter
        </div>
        
        <div className="flex items-center">
          <svg className={`h-3 w-3 mr-1 ${/[0-9]/.test(password) ? 'text-green-500' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
            {/[0-9]/.test(password) ? (
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            ) : (
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
            )}
          </svg>
          Number
        </div>
        
        <div className="flex items-center">
          <svg className={`h-3 w-3 mr-1 ${/[^A-Za-z0-9]/.test(password) ? 'text-green-500' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
            {/[^A-Za-z0-9]/.test(password) ? (
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            ) : (
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
            )}
          </svg>
          Special character
        </div>
        
        <div className="flex items-center">
          <svg className={`h-3 w-3 mr-1 ${password.length >= 8 ? 'text-green-500' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
            {password.length >= 8 ? (
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            ) : (
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
            )}
          </svg>
          Minimum 8 characters
        </div>
      </div>
    </div>
  );
};

export default PasswordStrengthMeter;