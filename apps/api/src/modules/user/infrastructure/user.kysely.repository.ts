import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { KyselyService } from '../../../shared/infrastructure/database/kysely.service';
import { IUserRepository, CreateUserData, UpdateUserData, ListUsersOptions, PaginatedUsers } from '../domain/repositories/user.repository.interface';
import { UserEntity, UserRole } from '../domain/entities/user.entity';
import { UserMapper } from './user.mapper';

@Injectable()
export class UserKyselyRepository implements IUserRepository {
  constructor(private readonly kyselyService: KyselyService) {}

  async findById(id: string, tenantId: string): Promise<UserEntity | null> {
    const db = await this.kyselyService.getTenantDb(tenantId);
    const row = await db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', sql<string>`${id}::uuid`)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    return row ? UserMapper.toDomain(row as any) : null;
  }

  async findByUsername(username: string, tenantId: string): Promise<UserEntity | null> {
    const db = await this.kyselyService.getTenantDb(tenantId);
    const row = await db
      .selectFrom('users')
      .selectAll()
      .where('username', '=', username)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    return row ? UserMapper.toDomain(row as any) : null;
  }

  async list(options: ListUsersOptions, tenantId: string): Promise<PaginatedUsers> {
    const db = await this.kyselyService.getTenantDb(tenantId);
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    let baseQuery = db.selectFrom('users').where('deleted_at', 'is', null);

    if (options.search) {
      baseQuery = baseQuery.where((eb) =>
        eb.or([
          eb('name', 'ilike', `%${options.search}%`),
          eb('username', 'ilike', `%${options.search}%`),
        ]),
      );
    }

    if (options.role) {
      baseQuery = baseQuery.where('role', '=', options.role as UserRole);
    }

    if (options.isActive !== undefined) {
      baseQuery = baseQuery.where('is_active', '=', options.isActive);
    }

    const countResult = await baseQuery
      .select(db.fn.countAll<number>().as('count'))
      .executeTakeFirst();

    const total = Number(countResult?.count || 0);

    const rows = await baseQuery
      .selectAll()
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .execute();

    return {
      data: rows.map((row) => UserMapper.toDomain(row as any)),
      total,
      page,
      limit,
    };
  }

  async create(data: CreateUserData, tenantId: string): Promise<UserEntity> {
    const db = await this.kyselyService.getTenantDb(tenantId);
    const row = await db
      .insertInto('users')
      .values({
        name: data.name,
        email: data.email as any,
        username: data.username,
        password_hash: data.passwordHash,
        role: data.role as UserRole,
        permissions: JSON.stringify(data.permissions) as any,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return UserMapper.toDomain(row as any);
  }

  async update(id: string, data: UpdateUserData, tenantId: string): Promise<UserEntity> {
    const db = await this.kyselyService.getTenantDb(tenantId);
    const updateData: any = { updated_at: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.permissions !== undefined) updateData.permissions = JSON.stringify(data.permissions);
    if (data.isActive !== undefined) updateData.is_active = data.isActive;

    const row = await db
      .updateTable('users')
      .set(updateData)
      .where('id', '=', sql<string>`${id}::uuid`)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirstOrThrow();
    return UserMapper.toDomain(row as any);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const db = await this.kyselyService.getTenantDb(tenantId);
    await db
      .updateTable('users')
      .set({ deleted_at: new Date() } as any)
      .where('id', '=', sql<string>`${id}::uuid`)
      .execute();
  }

  async updatePassword(id: string, passwordHash: string, tenantId: string): Promise<void> {
    const db = await this.kyselyService.getTenantDb(tenantId);
    await db
      .updateTable('users')
      .set({ password_hash: passwordHash, updated_at: new Date() } as any)
      .where('id', '=', sql<string>`${id}::uuid`)
      .execute();
  }
}
