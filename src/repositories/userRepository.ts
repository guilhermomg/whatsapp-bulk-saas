import { User, Prisma } from '@prisma/client';
import { BaseRepository } from './baseRepository';
import { encrypt, decrypt } from '../utils/encryption';

export class UserRepository extends BaseRepository<User> {
  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (user) {
      return this.decryptSensitiveFields(user);
    }
    return null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      return this.decryptSensitiveFields(user);
    }
    return null;
  }

  async findAll(options?: {
    skip?: number;
    take?: number;
    where?: Prisma.UserWhereInput;
    orderBy?: Prisma.UserOrderByWithRelationInput;
  }): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      skip: options?.skip,
      take: options?.take,
      where: options?.where,
      orderBy: options?.orderBy,
    });

    return users.map(user => this.decryptSensitiveFields(user));
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    const encryptedData = this.encryptSensitiveFields(data);
    const user = await this.prisma.user.create({
      data: encryptedData,
    });

    return this.decryptSensitiveFields(user);
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    const encryptedData = this.encryptSensitiveFields(data);
    const user = await this.prisma.user.update({
      where: { id },
      data: encryptedData,
    });

    return this.decryptSensitiveFields(user);
  }

  async delete(id: string): Promise<User> {
    const user = await this.prisma.user.delete({
      where: { id },
    });

    return this.decryptSensitiveFields(user);
  }

  async count(where?: Prisma.UserWhereInput): Promise<number> {
    return this.prisma.user.count({ where });
  }

  async findActiveUsers(): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
    });

    return users.map(user => this.decryptSensitiveFields(user));
  }

  /**
   * Encrypts sensitive fields before saving to database
   */
  private encryptSensitiveFields(data: any): any {
    const encrypted = { ...data };

    if (encrypted.accessToken) {
      encrypted.accessToken = encrypt(encrypted.accessToken);
    }

    if (encrypted.webhookVerifyToken) {
      encrypted.webhookVerifyToken = encrypt(encrypted.webhookVerifyToken);
    }

    return encrypted;
  }

  /**
   * Decrypts sensitive fields after reading from database
   */
  private decryptSensitiveFields(user: User): User {
    return {
      ...user,
      accessToken: user.accessToken ? decrypt(user.accessToken) : user.accessToken,
      webhookVerifyToken: user.webhookVerifyToken ? decrypt(user.webhookVerifyToken) : user.webhookVerifyToken,
    };
  }
}

export default new UserRepository();
