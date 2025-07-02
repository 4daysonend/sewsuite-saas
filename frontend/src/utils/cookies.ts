import Cookies, { CookieAttributes } from 'js-cookie';

// Check if we're in production
const isProd = process.env.NODE_ENV === 'production';

/**
 * Sets a secure cookie with appropriate attributes
 */
export function setSecureCookie(
  name: string, 
  value: string, 
  options: CookieAttributes = {}
): void {
  // Default to secure in production
  const secure = options.secure !== undefined ? options.secure : isProd;
  
  // Set the cookie with provided options
  Cookies.set(name, value, {
    ...options,
    secure,
    sameSite: options.sameSite || 'lax',
  });
}

/**
 * Gets a cookie by name
 */
export function getSecureCookie(name: string): string | undefined {
  return Cookies.get(name);
}

/**
 * Removes a cookie by name
 */
export function removeSecureCookie(name: string): void {
  Cookies.remove(name);
}

/**
 * For http-only cookies that can't be accessed via JavaScript,
 * we rely on the backend to set and clear them properly.
 * This utility helps manage the parts we can control from the frontend.
 */