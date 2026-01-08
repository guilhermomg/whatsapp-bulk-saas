import { ContactRepository } from '../../src/repositories/contactRepository';
import { UserRepository } from '../../src/repositories/userRepository';
import { setupTestDatabase } from '../utils/testDb';
import {
  createUserData, createContactData, resetUserCounter, resetContactCounter,
} from '../factories';

describe('ContactRepository', () => {
  setupTestDatabase();

  let contactRepository: ContactRepository;
  let userRepository: UserRepository;
  let testUserId: string;

  beforeEach(async () => {
    contactRepository = new ContactRepository();
    userRepository = new UserRepository();
    resetUserCounter();
    resetContactCounter();

    // Create a test user for foreign key relations
    const user = await userRepository.create(createUserData());
    testUserId = user.id;
  });

  describe('create', () => {
    it('should create a new contact', async () => {
      const contactData = createContactData({ userId: testUserId });
      const contact = await contactRepository.create(contactData);

      expect(contact).toBeDefined();
      expect(contact.id).toBeDefined();
      expect(contact.userId).toBe(testUserId);
      expect(contact.optedIn).toBe(true);
    });

    it('should create contact with tags', async () => {
      const contactData = createContactData({
        userId: testUserId,
        tags: ['customer', 'vip'],
      });
      const contact = await contactRepository.create(contactData);

      expect(contact.tags).toEqual(['customer', 'vip']);
    });
  });

  describe('findById', () => {
    it('should find a contact by id', async () => {
      const contactData = createContactData({ userId: testUserId });
      const created = await contactRepository.create(contactData);

      const found = await contactRepository.findById(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });
  });

  describe('findByPhone', () => {
    it('should find a contact by phone number', async () => {
      const contactData = createContactData({
        userId: testUserId,
        phone: '+14155551234',
      });
      await contactRepository.create(contactData);

      const found = await contactRepository.findByPhone(testUserId, '+14155551234');

      expect(found).toBeDefined();
      expect(found?.phone).toBe('+14155551234');
    });

    it('should enforce unique constraint on userId+phone', async () => {
      const contactData = createContactData({
        userId: testUserId,
        phone: '+14155551234',
      });
      await contactRepository.create(contactData);

      // Attempting to create duplicate should fail
      await expect(
        contactRepository.create(contactData),
      ).rejects.toThrow();
    });
  });

  describe('findByUserId', () => {
    it('should find all contacts for a user', async () => {
      await contactRepository.create(createContactData({ userId: testUserId }));
      await contactRepository.create(createContactData({ userId: testUserId }));

      const contacts = await contactRepository.findByUserId(testUserId);

      expect(contacts).toHaveLength(2);
    });

    it('should filter by optedIn status', async () => {
      await contactRepository.create(createContactData({ userId: testUserId, optedIn: true }));
      await contactRepository.create(createContactData({ userId: testUserId, optedIn: false }));

      const optedInContacts = await contactRepository.findByUserId(testUserId, {
        optedIn: true,
      });

      expect(optedInContacts).toHaveLength(1);
      expect(optedInContacts[0].optedIn).toBe(true);
    });

    it('should filter by tags', async () => {
      await contactRepository.create(
        createContactData({ userId: testUserId, tags: ['customer', 'vip'] }),
      );
      await contactRepository.create(
        createContactData({ userId: testUserId, tags: ['prospect'] }),
      );

      const vipContacts = await contactRepository.findByUserId(testUserId, {
        tags: ['vip'],
      });

      expect(vipContacts).toHaveLength(1);
      expect(vipContacts[0].tags).toContain('vip');
    });
  });

  describe('findOptedInContacts', () => {
    it('should find only opted-in, non-blocked contacts', async () => {
      await contactRepository.create(
        createContactData({ userId: testUserId, optedIn: true, isBlocked: false }),
      );
      await contactRepository.create(
        createContactData({ userId: testUserId, optedIn: false, isBlocked: false }),
      );
      await contactRepository.create(
        createContactData({ userId: testUserId, optedIn: true, isBlocked: true }),
      );

      const contacts = await contactRepository.findOptedInContacts(testUserId);

      expect(contacts).toHaveLength(1);
      expect(contacts[0].optedIn).toBe(true);
      expect(contacts[0].isBlocked).toBe(false);
    });
  });

  describe('updateOptInStatus', () => {
    it('should update opt-in status and timestamp', async () => {
      const contact = await contactRepository.create(
        createContactData({ userId: testUserId, optedIn: false }),
      );

      const updated = await contactRepository.updateOptInStatus(contact.id, true);

      expect(updated.optedIn).toBe(true);
      expect(updated.optedInAt).toBeDefined();
      expect(updated.optedOutAt).toBeNull();
    });

    it('should update opt-out status and timestamp', async () => {
      const contact = await contactRepository.create(
        createContactData({ userId: testUserId, optedIn: true }),
      );

      const updated = await contactRepository.updateOptInStatus(contact.id, false);

      expect(updated.optedIn).toBe(false);
      expect(updated.optedOutAt).toBeDefined();
      expect(updated.optedInAt).toBeNull();
    });
  });

  describe('blockContact', () => {
    it('should block a contact with reason', async () => {
      const contact = await contactRepository.create(
        createContactData({ userId: testUserId }),
      );

      const blocked = await contactRepository.blockContact(contact.id, 'Spam complaints');

      expect(blocked.isBlocked).toBe(true);
      expect(blocked.blockedReason).toBe('Spam complaints');
    });
  });

  describe('unblockContact', () => {
    it('should unblock a contact', async () => {
      const contact = await contactRepository.create(
        createContactData({ userId: testUserId, isBlocked: true }),
      );

      const unblocked = await contactRepository.unblockContact(contact.id);

      expect(unblocked.isBlocked).toBe(false);
      expect(unblocked.blockedReason).toBeNull();
    });
  });

  describe('bulkCreate', () => {
    it('should create multiple contacts', async () => {
      const contacts = [
        createContactData({ userId: testUserId, phone: '+14155551001' }),
        createContactData({ userId: testUserId, phone: '+14155551002' }),
        createContactData({ userId: testUserId, phone: '+14155551003' }),
      ];

      const count = await contactRepository.bulkCreate(contacts);

      expect(count).toBe(3);
    });

    it('should skip duplicates', async () => {
      const contactData = createContactData({ userId: testUserId, phone: '+14155551234' });
      await contactRepository.create(contactData);

      const contacts = [
        contactData,
        createContactData({ userId: testUserId, phone: '+14155551235' }),
      ];

      const count = await contactRepository.bulkCreate(contacts);

      expect(count).toBe(1); // Only the new one
    });
  });

  describe('count', () => {
    it('should count all contacts', async () => {
      await contactRepository.create(createContactData({ userId: testUserId }));
      await contactRepository.create(createContactData({ userId: testUserId }));

      const count = await contactRepository.count({ userId: testUserId });

      expect(count).toBe(2);
    });
  });
});
