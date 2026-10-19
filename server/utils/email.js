/**
 * The Resend SDK reports API failures (unverified domain, bad key, rate limit)
 * by *returning* `{ data, error }` rather than throwing, so a bare .catch() never
 * sees them. Pass this to .then() / call it on the awaited result.
 */
export function logEmailResult(label) {
  return (result) => {
    if (result && result.error) {
      console.error(`[EMAIL] ${label} rejected by Resend:`, result.error.message || result.error);
    }
    return result;
  };
}
