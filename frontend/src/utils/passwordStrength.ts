const COMMON_PASSWORDS = [
  'password', 'password123', 'password1', 'passw0rd',
  'admin', 'admin123', 'administrator',
  'qwerty', 'qwerty123', 'qwertyuiop',
  '123456', '12345678', '123456789', '12345', '1234', '123',
  'abc123', 'abcd1234',
  'letmein', 'letmein123',
  'welcome', 'welcome123',
  'monkey', 'monkey123',
  'dragon', 'dragon123',
  'master', 'master123',
  'hello', 'hello123',
  'freedom', 'freedom123',
  'whatever', 'whatever123',
  'trustno1',
];

export interface PasswordStrength {
  score: number; // 0-4 (0=weak, 4=strong)
  label: string;
  color: string;
  suggestions: string[];
}

export function checkPasswordStrength(password: string): PasswordStrength {
  let score = 0;
  const suggestions: string[] = [];

  //  Check if password is empty
  if (!password) {
    return { score: 0, label: 'Empty', color: '#9e9e9e', suggestions: ['Enter a password'] };
  }

  //  Check against common passwords (immediate fail)
  if (COMMON_PASSWORDS.includes(password.toLowerCase())) {
    return {
      score: 0,
      label: 'Weak',
      color: '#f44336',
      suggestions: ['This password is too common. Choose a more unique password.']
    };
  }

  //  Check length
  if (password.length < 8) {
    suggestions.push('Use at least 8 characters');
  } else if (password.length >= 12) {
    score += 1;
  }

  //  Check for lowercase
  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    suggestions.push('Add lowercase letters');
  }

  //  Check for uppercase
  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    suggestions.push('Add uppercase letters');
  }

  // ✅ Check for numbers
  if (/\d/.test(password)) {
    score += 1;
  } else {
    suggestions.push('Add numbers');
  }

  //  Check for special characters
  if (/[^a-zA-Z0-9]/.test(password)) {
    score += 1;
  } else {
    suggestions.push('Add special characters (!@#$%^&*)');
  }

  //  Normalize score (0-4)
  score = Math.min(score, 4);

  //  Additional checks for weak patterns
  if (password.length >= 6 && /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    // If it passes basic checks but is still weak
    const repeated = /(.)\1{2,}/.test(password); // repeated chars
    const sequential = /(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i.test(password);
    
    if (repeated || sequential) {
      score = Math.min(score, 2);
      suggestions.push('Avoid repeated or sequential characters');
    }
  }

  //  Determine label and color
  const labels = ['Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
  const colors = ['#f44336', '#FF9800', '#FFC107', '#8BC34A', '#4CAF50'];
  
  return {
    score,
    label: labels[score] || 'Weak',
    color: colors[score] || '#f44336',
    suggestions: suggestions.slice(0, 3)
  };
}
