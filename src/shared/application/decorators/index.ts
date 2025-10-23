// Legacy decorators
export { ApiPaginationSize } from './pagination-size.decorator';
export { ApiPaginationPage } from './pagination-page.decorator';
export { ApiListOf } from './list-of.decorator';
export { transformAndValidateRecord } from './validate-record.decorator';

export interface DecoratorOptions {
  required?: boolean;
}
