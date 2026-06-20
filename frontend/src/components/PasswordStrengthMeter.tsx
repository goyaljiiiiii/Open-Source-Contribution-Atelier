import React from 'react';
import zxcvbn from 'zxcvbn';

interface PasswordStrengthMeterProps {
  password: string;
}

const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({ password }) => {
  const testResult = zxcvbn(password);
  const score = testResult.score; // 0-4

  const getStrengthLabel = (score: number) => {
    switch (score) {
      case 0:
        return { label: 'Weak', color: 'bg-red-500' };
      case 1:
        return { label: 'Weak', color: 'bg-red-400' };
      case 2:
        return { label: 'Medium', color: 'bg-yellow-500' };
      case 3:
        return { label: 'Strong', color: 'bg-green-400' };
      case 4:
        return { label: 'Strong', color: 'bg-green-600' };
      default:
        return { label: '', color: 'bg-gray-300' };
    }
  };

  const strength = getStrengthLabel(score);
  const width = password.length > 0 ? (score / 4) * 100 : 0;

  return (
    <div className="mt-2">
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${strength.color}`}
          style={{ width: `${width}%` }}
        />
      </div>
      {password.length > 0 && (
        <p className="text-sm mt-1 text-gray-600">
          Password strength: <span className="font-medium">{strength.label}</span>
        </p>
      )}
    </div>
  );
};

export default PasswordStrengthMeter;