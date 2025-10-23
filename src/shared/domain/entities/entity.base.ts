/**
 * Entity Base Class
 *
 * Base class for all domain entities.
 * Provides identity comparison and basic entity functionality.
 */

export abstract class EntityBase<TProps, TId = string> {
  protected readonly _props: TProps;

  constructor(props: TProps) {
    this._props = props;
  }

  protected get props(): TProps {
    return this._props;
  }

  public equals(entity: EntityBase<any, TId>): boolean {
    if (!entity || !(entity instanceof EntityBase)) {
      return false;
    }

    if (this === entity) {
      return true;
    }

    return false;
  }
}
