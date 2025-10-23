// Export enhanced pagination model with backward compatibility
export * from './pagination.model';

// Re-export original simple functions for backward compatibility
export {
  makeListMeta_Simple as makeListMeta_Original,
  makeListResponse_Simple as makeListResponse_Original,
  toTakeSkip_Simple as toTakeSkip_Original,
} from './pagination.model';
