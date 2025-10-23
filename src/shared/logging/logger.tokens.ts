export const LOGGER_FACTORY = Symbol('LOGGER_FACTORY'); // provides ServiceLoggerFactory
export const BOUNDED_CONTEXT_LOGGER = Symbol('BOUNDED_CONTEXT_LOGGER'); // provides Logger scoped to bounded context (service+BC)
export const APP_LOGGER = Symbol('APP_LOGGER'); // provides Logger scoped to module (service+BC+app)
