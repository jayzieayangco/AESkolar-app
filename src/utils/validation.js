/** @param {string} email */
export function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim();
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return pattern.test(trimmed);
}

export function isAuthRateLimitError(error) {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return (
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("email rate limit")
  );
}

/** Maps Supabase auth errors to user-friendly messages */
export function getAuthErrorMessage(error) {
  if (!error) return "Something went wrong. Please try again.";
  const msg = (error.message ?? "").toLowerCase();
  if (isAuthRateLimitError(error)) {
    return "Too many sign-in attempts. Please wait about a minute and try again.";
  }
  if (
    msg.includes("invalid login") ||
    msg.includes("invalid credentials") ||
    msg.includes("invalid email or password") ||
    error.status === 400 ||
    error.status === 401
  ) {
    return "Wrong credentials. Please check your email and password.";
  }
  if (msg.includes("email not confirmed")) {
    return "Please confirm your email before signing in.";
  }
  if (msg.includes("user already registered")) {
    return "An account with this email already exists. Try signing in.";
  }
  return error.message || "Something went wrong. Please try again.";
}
