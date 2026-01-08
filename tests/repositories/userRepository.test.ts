import { UserRepository } from '../../src/repositories/userRepository';
import { setupTestDatabase, TestDatabase } from '../utils/testDb';
import { createUserData, resetUserCounter } from '../factories/userFactory';
import { decrypt } from '../../src/utils/encryption';

describe('UserRepository', () => {
  setupTestDatabase();

  let userRepository: UserRepository;
  const prisma = TestDatabase.getPrisma();

  beforeEach(() => {
    userRepository = new UserRepository();
    resetUserCounter();
  });

  describe('create', () => {
    it('should create a new user with encrypted tokens', async () => {
      const userData = createUserData({
        email: 'test@example.com',
        accessToken: 'plain_access_token',
      });

      const user = await userRepository.create(userData);

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.accessToken).toBe('plain_access_token'); // Should be decrypted

      // Verify it's encrypted in the database
      const rawUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(rawUser?.accessToken).not.toBe('plain_access_token');
      expect(decrypt(rawUser!.accessToken)).toBe('plain_access_token');
    });

    it('should create a user with default subscription tier', async () => {
      const userData = createUserData();
      const user = await userRepository.create(userData);

      expect(user.subscriptionTier).toBe('free');
    });
  });

  describe('findById', () => {
    it('should find a user by id with decrypted tokens', async () => {
      const userData = createUserData();
      const createdUser = await userRepository.create(userData);

      const foundUser = await userRepository.findById(createdUser.id);

      expect(foundUser).toBeDefined();
      expect(foundUser?.id).toBe(createdUser.id);
      expect(foundUser?.email).toBe(createdUser.email);
    });

    it('should return null for non-existent user', async () => {
      const foundUser = await userRepository.findById('non-existent-id');

      expect(foundUser).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find a user by email', async () => {
      const userData = createUserData({ email: 'unique@example.com' });
      await userRepository.create(userData);

      const foundUser = await userRepository.findByEmail('unique@example.com');

      expect(foundUser).toBeDefined();
      expect(foundUser?.email).toBe('unique@example.com');
    });

    it('should return null for non-existent email', async () => {
      const foundUser = await userRepository.findByEmail('nonexistent@example.com');

      expect(foundUser).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should find all users', async () => {
      await userRepository.create(createUserData());
      await userRepository.create(createUserData());
      await userRepository.create(createUserData());

      const users = await userRepository.findAll();

      expect(users).toHaveLength(3);
    });

    it('should support pagination', async () => {
      const createPromises = [];
      for (let i = 0; i < 5; i += 1) {
        createPromises.push(userRepository.create(createUserData()));
      }
      await Promise.all(createPromises);

      const users = await userRepository.findAll({ skip: 2, take: 2 });

      expect(users).toHaveLength(2);
    });

    it('should support filtering', async () => {
      await userRepository.create(createUserData({ isActive: true }));
      await userRepository.create(createUserData({ isActive: false }));

      const activeUsers = await userRepository.findAll({ where: { isActive: true } });

      expect(activeUsers).toHaveLength(1);
      expect(activeUsers[0].isActive).toBe(true);
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const userData = createUserData();
      const user = await userRepository.create(userData);

      const updatedUser = await userRepository.update(user.id, {
        businessName: 'Updated Business',
      });

      expect(updatedUser.businessName).toBe('Updated Business');
    });

    it('should encrypt tokens when updating', async () => {
      const userData = createUserData();
      const user = await userRepository.create(userData);

      const updatedUser = await userRepository.update(user.id, {
        accessToken: 'new_access_token',
      });

      expect(updatedUser.accessToken).toBe('new_access_token');

      // Verify it's encrypted in the database
      const rawUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(rawUser?.accessToken).not.toBe('new_access_token');
      expect(decrypt(rawUser!.accessToken)).toBe('new_access_token');
    });
  });

  describe('delete', () => {
    it('should delete a user', async () => {
      const userData = createUserData();
      const user = await userRepository.create(userData);

      await userRepository.delete(user.id);

      const foundUser = await userRepository.findById(user.id);
      expect(foundUser).toBeNull();
    });
  });

  describe('count', () => {
    it('should count all users', async () => {
      await userRepository.create(createUserData());
      await userRepository.create(createUserData());

      const count = await userRepository.count();

      expect(count).toBe(2);
    });

    it('should count users with filter', async () => {
      await userRepository.create(createUserData({ isActive: true }));
      await userRepository.create(createUserData({ isActive: false }));

      const activeCount = await userRepository.count({ isActive: true });

      expect(activeCount).toBe(1);
    });
  });

  describe('findActiveUsers', () => {
    it('should find only active users', async () => {
      await userRepository.create(createUserData({ isActive: true }));
      await userRepository.create(createUserData({ isActive: false }));
      await userRepository.create(createUserData({ isActive: true }));

      const activeUsers = await userRepository.findActiveUsers();

      expect(activeUsers).toHaveLength(2);
      activeUsers.forEach((user) => {
        expect(user.isActive).toBe(true);
      });
    });
  });
});
