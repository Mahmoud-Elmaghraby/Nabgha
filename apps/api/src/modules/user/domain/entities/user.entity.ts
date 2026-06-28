import type { UserRole } from '@nabgha/types';
export type { UserRole };

export interface UserProps {
  id: string;
  name: string;
  email: string | null;
  username: string;
  role: UserRole;
  permissions: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export class UserEntity {
  private readonly props: UserProps;

  constructor(props: UserProps) {
    this.props = props;
  }

  get id(): string { return this.props.id; }
  get name(): string { return this.props.name; }
  get email(): string | null { return this.props.email; }
  get username(): string { return this.props.username; }
  get role(): UserRole { return this.props.role; }
  get permissions(): string[] { return this.props.permissions; }
  get isActive(): boolean { return this.props.isActive; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get deletedAt(): Date | null { return this.props.deletedAt; }

  hasPermission(permission: string): boolean {
    if (this.props.permissions.includes('*')) return true;
    if (this.props.permissions.includes(permission)) return true;
    const [resource] = permission.split('.');
    if (this.props.permissions.includes(`${resource}.*`)) return true;
    return false;
  }

  isDeleted(): boolean {
    return this.props.deletedAt !== null;
  }

  canBeDeletedBy(requesterId: string): boolean {
    return this.props.id !== requesterId;
  }

  toObject(): UserProps {
    return { ...this.props };
  }
}
