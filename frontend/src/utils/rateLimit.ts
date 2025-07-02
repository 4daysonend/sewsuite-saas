const STORAGE_KEY = 'auth_rate_limit';

interface RateLimitData {
  attempts: number;
  lockUntil: number;
}

export const checkLoginRateLimit = (): { allowed: boolean; message?: string } => {
  try {
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (!storedData) return { allowed: true };
    
    const data: RateLimitData = JSON.parse(storedData);
    const now = Date.now();
    
    // Check if currently locked out
    if (data.lockUntil && now < data.lockUntil) {
      const minutesLeft = Math.ceil((data.lockUntil - now) / (60 * 1000));
      return { 
        allowed: false, 
        message: `Too many login attempts. Try again in ${minutesLeft} ${minutesLeft === 1 ? 'minute' : 'minutes'}.`
      };
    }
    
    // Reset expired lockouts
    if (data.lockUntil && now >= data.lockUntil) {
      localStorage.removeItem(STORAGE_KEY);
      return { allowed: true };
    }
    
    // If attempts exist but no lockout, we're good
    return { allowed: true };
  } catch (error) {
    // If anything fails, allow the request but log the error
    console.error('Error checking rate limit:', error);
    return { allowed: true };
  }
};

export const recordLoginAttempt = (successful: boolean): void => {
  try {
    // If successful, clear any rate limiting
    if (successful) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    
    // Get current data
    let data: RateLimitData = { attempts: 0, lockUntil: 0 };
    const storedData = localStorage.getItem(STORAGE_KEY);
    
    if (storedData) {
      data = JSON.parse(storedData);
    }
    
    // Increment attempts
    data.attempts += 1;
    
    // Set lockout if threshold reached
    if (data.attempts >= 5) {
      // Lock for 15 minutes
      data.lockUntil = Date.now() + (15 * 60 * 1000);
    }
    
    // Store updated data
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error recording login attempt:', error);
  }
};