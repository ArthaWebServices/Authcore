// Common breached passwords (top common passwords — extend with HIBP list in production)
const COMMON_PASSWORDS = new Set([
  'password', '123456', '12345678', 'qwerty', 'abc123', 'monkey', 'master',
  'dragon', '111111', 'baseball', 'iloveyou', 'trustno1', 'sunshine',
  'princess', 'football', 'charlie', 'shadow', 'michael', 'qwerty123',
  'password1', 'password123', 'letmein', 'welcome', 'admin', 'admin123',
  'login', 'starwars', '123456789', '1234567890', '00000000', 'passw0rd',
  'p@ssw0rd', 'p@ssword', 'pass1234', 'change-me', 'changeme', 'test',
  'test123', 'guest', 'guest123', 'default', 'root', 'toor', 'secret',
  'qwertyuiop', 'asdfghjkl', 'zxcvbnm', '000000', '11111111', 'abc1234',
  'iloveu', '0000', 'abcd1234', 'qwertyu', 'freedom', 'whatever', 'qazwsx',
  'trustme', '1q2w3e4r', '1q2w3e', 'jordan', 'harley', 'ranger',
  'fuckyou', 'biteme', 'michael1', 'love123', 'jessica', 'killer',
  'robert', 'joshua', 'nicole', 'daniel', 'thomas', 'ashley',
]);

export function isCommonPassword(password: string): boolean {
  const normalized = password.toLowerCase().trim();
  return COMMON_PASSWORDS.has(normalized);
}

export function checkPasswordStrength(password: string): { valid: boolean; reason?: string } {
  if (isCommonPassword(password)) {
    return { valid: false, reason: 'Password is too common. Please choose a stronger password.' };
  }
  // Check keyboard sequences
  if (/^(qwerty|asdfgh|zxcvbn|12345|abcde)/i.test(password)) {
    return { valid: false, reason: 'Password contains a keyboard sequence.' };
  }
  // Check for repeated chars
  if (/(.)\1{4,}/.test(password)) {
    return { valid: false, reason: 'Password contains too many repeated characters.' };
  }
  return { valid: true };
}
