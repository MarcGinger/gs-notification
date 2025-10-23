/**
 * Entity Base Class
 *
 * Base class for all domain entities.
 * Provides identity comparison and basic entity functionality.
 */

export abstract class EntityIdBase<TProps, TId = string> {
  protected readonly _props: TProps;
  protected readonly _id: TId;

  constructor(props: TProps, id: TId) {
    this._props = props;
    this._id = id;
  }

  protected get props(): TProps {
    return this._props;
  }

  public equals(entity: EntityIdBase<any, TId>): boolean {
    if (!entity || !(entity instanceof EntityIdBase)) {
      return false;
    }

    if (this === entity) {
      return true;
    }

    const idWithEquals = this._id as unknown as {
      equals?: (other: unknown) => boolean;
    };
    if (typeof idWithEquals?.equals === 'function') {
      return idWithEquals.equals(entity._id);
    }

    return this._id === entity._id;
  }
}
