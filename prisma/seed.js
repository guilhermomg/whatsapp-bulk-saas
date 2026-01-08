/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

// Simple encryption function for seed data
function encrypt(text) {
  const key = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
  const iv = crypto.randomBytes(16);
  const algorithm = 'aes-256-gcm';
  
  const keyBuffer = key.length === 64 ? Buffer.from(key, 'hex') : crypto.pbkdf2Sync(key, crypto.randomBytes(64), 100000, 32, 'sha512');
  const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${encrypted}:${tag.toString('hex')}`;
}

async function main() {
  console.log('🌱 Starting database seed...');

  // Create a sample user
  console.log('Creating sample user...');
  const user = await prisma.user.create({
    data: {
      email: 'demo@whatsapp-saas.com',
      businessName: 'Demo Business',
      wabaId: '123456789',
      phoneNumberId: '987654321',
      accessToken: encrypt('SAMPLE_ACCESS_TOKEN_12345'),
      webhookVerifyToken: encrypt('SAMPLE_WEBHOOK_TOKEN'),
      subscriptionTier: 'pro',
      isActive: true,
    },
  });
  console.log(`✅ Created user: ${user.email}`);

  // Create sample contacts
  console.log('Creating sample contacts...');
  const contacts = [];
  
  // 5 opted-in contacts
  for (let i = 1; i <= 5; i++) {
    contacts.push({
      userId: user.id,
      phone: `+1415555010${i}`,
      name: `Contact ${i}`,
      email: `contact${i}@example.com`,
      optedIn: true,
      optedInAt: new Date(),
      optInSource: 'manual',
      tags: ['customer', 'active'],
      metadata: { source: 'seed', tier: 'premium' },
      isBlocked: false,
    });
  }

  // 5 opted-out contacts
  for (let i = 6; i <= 10; i++) {
    contacts.push({
      userId: user.id,
      phone: `+1415555010${i}`,
      name: `Contact ${i}`,
      email: `contact${i}@example.com`,
      optedIn: false,
      optedOutAt: new Date(),
      optInSource: 'csv',
      tags: ['prospect'],
      metadata: { source: 'seed' },
      isBlocked: false,
    });
  }

  await prisma.contact.createMany({ data: contacts });
  console.log(`✅ Created ${contacts.length} contacts`);

  // Create approved templates
  console.log('Creating sample templates...');
  
  const template1 = await prisma.template.create({
    data: {
      userId: user.id,
      name: 'welcome_message',
      whatsappTemplateId: 'template_123',
      language: 'en_US',
      category: 'marketing',
      status: 'approved',
      components: {
        header: { type: 'text', text: 'Welcome!' },
        body: { type: 'text', text: 'Welcome {{1}} to our service!' },
        footer: { type: 'text', text: 'Reply STOP to unsubscribe' },
      },
      approvedAt: new Date(),
    },
  });

  const template2 = await prisma.template.create({
    data: {
      userId: user.id,
      name: 'order_confirmation',
      whatsappTemplateId: 'template_456',
      language: 'en_US',
      category: 'utility',
      status: 'approved',
      components: {
        header: { type: 'text', text: 'Order Confirmation' },
        body: { 
          type: 'text', 
          text: 'Your order {{1}} has been confirmed. Expected delivery: {{2}}' 
        },
        footer: { type: 'text', text: 'Thank you for your business!' },
      },
      approvedAt: new Date(),
    },
  });

  console.log(`✅ Created 2 templates`);

  // Create a test campaign
  console.log('Creating sample campaign...');
  
  const campaign = await prisma.campaign.create({
    data: {
      userId: user.id,
      name: 'Welcome Campaign',
      templateId: template1.id,
      messageType: 'template',
      messageContent: {
        templateName: 'welcome_message',
        parameters: ['Customer'],
      },
      status: 'draft',
      totalRecipients: 5,
      sentCount: 0,
      deliveredCount: 0,
      failedCount: 0,
      readCount: 0,
    },
  });

  console.log(`✅ Created campaign: ${campaign.name}`);

  // Create sample messages for the campaign
  console.log('Creating sample messages...');
  
  const optedInContacts = await prisma.contact.findMany({
    where: { userId: user.id, optedIn: true },
    take: 3,
  });

  const messages = optedInContacts.map((contact, index) => ({
    campaignId: campaign.id,
    contactId: contact.id,
    userId: user.id,
    direction: 'outbound',
    type: 'template',
    content: {
      templateName: 'welcome_message',
      parameters: [contact.name],
    },
    status: index === 0 ? 'delivered' : index === 1 ? 'sent' : 'queued',
    sentAt: index <= 1 ? new Date() : null,
    deliveredAt: index === 0 ? new Date() : null,
  }));

  await prisma.message.createMany({ data: messages });
  console.log(`✅ Created ${messages.length} messages`);

  // Create sample webhook events
  console.log('Creating sample webhook events...');
  
  const firstMessage = await prisma.message.findFirst({
    where: { campaignId: campaign.id },
  });

  if (firstMessage) {
    await prisma.webhookEvent.create({
      data: {
        userId: user.id,
        eventType: 'message_status',
        payload: {
          entry: [{
            changes: [{
              value: {
                statuses: [{
                  id: 'wamid.12345',
                  status: 'delivered',
                  timestamp: Date.now(),
                }],
              },
            }],
          }],
        },
        messageId: firstMessage.id,
        processed: true,
        processedAt: new Date(),
      },
    });

    console.log(`✅ Created webhook event`);
  }

  console.log('✨ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
