const noop = () => {};

const createLogger = (method) => {
  if (!__DEV__) {
    return noop;
  }

  return (...args) => console[method](...args);
};

export const debug = createLogger("log");
export const info = createLogger("info");
export const warn = createLogger("warn");
export const error = createLogger("error");

export default {
  debug,
  info,
  warn,
  error,
};
