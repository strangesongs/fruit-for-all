/**
 * Express 4 ignores the promise an async handler returns, so a throw inside one
 * becomes an unhandled rejection. wrap() forwards it to the error middleware instead.
 */
export function wrap(handler) {
  return function wrapped(req, res, next) {
    try {
      return Promise.resolve(handler(req, res, next)).catch(next);
    } catch (err) {
      return next(err);
    }
  };
}
