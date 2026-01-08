# Database Setup Guide

This guide will help you set up the PostgreSQL database for the WhatsApp Bulk SaaS application.

## Quick Start

### 1. Choose Your Database

You can use either a local PostgreSQL instance or a cloud provider:

**Local Development (Docker - Recommended)**
```bash
docker run --name postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=whatsapp_bulk_saas \
  -p 5432:5432 \
  -d postgres:15
```

**Free Cloud Options**
- [Supabase](https://supabase.com) - 500MB free, excellent UI
- [Neon](https://neon.tech) - 3GB free, serverless PostgreSQL
- [Railway](https://railway.app) - $5 credit/month
- [ElephantSQL](https://www.elephantsql.com) - 20MB free (minimal)

### 2. Configure Environment

Create a `.env` file from the example:
```bash
cp .env.example .env
```

Update the following variables in `.env`:

```env
# Database Configuration
DATABASE_URL="postgresql://postgres:password@localhost:5432/whatsapp_bulk_saas?schema=public"

# Encryption Key (generate with the command below)
ENCRYPTION_KEY=your_32_byte_hex_key_here
```

**Generate Encryption Key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Run Database Setup

```bash
# Install dependencies (if not already done)
npm install

# Generate Prisma Client
npm run db:generate

# Run migrations to create tables
npm run db:migrate

# (Optional) Seed sample data for development
npm run db:seed
```

## Database Scripts Reference

| Command | Description | When to Use |
|---------|-------------|-------------|
| `npm run db:generate` | Generate Prisma Client | After schema changes |
| `npm run db:migrate` | Create and run migration | Development (prompts for name) |
| `npm run db:migrate:prod` | Deploy migrations | Production (no prompts) |
| `npm run db:reset` | Reset database | Development only |
| `npm run db:seed` | Seed sample data | After migrations |
| `npm run db:studio` | Open Prisma Studio | View/edit data visually |
| `npm run db:push` | Push schema without migrations | Prototyping only |

## Database Schema Overview

The database includes 6 main tables:

1. **Users** - Multi-tenant user accounts with encrypted WhatsApp credentials
2. **Contacts** - Contact management with opt-in/opt-out tracking (GDPR compliant)
3. **Templates** - WhatsApp message templates (approved by Meta)
4. **Campaigns** - Bulk messaging campaigns with statistics
5. **Messages** - Individual message tracking with status updates
6. **WebhookEvents** - Complete audit trail of WhatsApp webhook events

See [docs/database-schema.md](./database-schema.md) for detailed documentation.

## Verifying Setup

### 1. Check Database Connection

The application will test the database connection on startup. Look for:
```
Database connection established successfully
```

### 2. View Data with Prisma Studio

```bash
npm run db:studio
```

Opens at http://localhost:5555 - you can view and edit all tables visually.

### 3. Check Seed Data

If you ran `npm run db:seed`, you should see:
- 1 demo user (demo@whatsapp-saas.com)
- 10 contacts (5 opted-in, 5 opted-out)
- 2 approved templates
- 1 test campaign
- Sample messages and webhook events

## Common Issues

### Issue: "DATABASE_URL environment variable is not set"

**Solution:** Make sure `.env` file exists and contains `DATABASE_URL`

### Issue: "Can't reach database server"

**Solutions:**
- Check PostgreSQL is running: `docker ps` or `brew services list`
- Verify connection string in `DATABASE_URL`
- Check firewall settings

### Issue: "Prisma schema validation error"

**Solution:** Run `npx prisma validate` to see specific errors

### Issue: Migration fails

**Solutions:**
- Check database permissions
- Ensure database exists: `createdb whatsapp_bulk_saas`
- For production, use `db:migrate:prod` instead of `db:migrate`

## Running Tests

Tests require a database connection. By default, they use the same database as development.

**Recommended:** Use a separate test database:

```env
# In .env.test
DATABASE_URL="postgresql://postgres:password@localhost:5432/whatsapp_bulk_saas_test?schema=public"
```

Run tests:
```bash
npm test
```

**Note:** Tests will clean all data before running. Never point tests at production database!

## Production Deployment

### 1. Secure Your Database

- Use strong passwords
- Enable SSL connections
- Restrict IP access
- Regular backups

### 2. Set Environment Variables

```bash
DATABASE_URL="postgresql://user:password@host:5432/db?sslmode=require"
ENCRYPTION_KEY="<secure-32-byte-hex-key>"
```

### 3. Run Migrations

```bash
npm run db:migrate:prod
```

### 4. Connection Pooling

For production, configure connection pooling:

```env
DATABASE_URL="postgresql://user:password@host:5432/db?schema=public&connection_limit=20"
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20
```

### 5. Monitoring

Monitor these metrics:
- Connection pool usage
- Query performance
- Database size
- Slow queries

Use `npm run db:studio` or your hosting provider's dashboard.

## Backup and Recovery

### Backup

```bash
# Manual backup
pg_dump -h localhost -U postgres whatsapp_bulk_saas > backup_$(date +%Y%m%d).sql

# Restore
psql -h localhost -U postgres whatsapp_bulk_saas < backup_20240108.sql
```

### Automated Backups

Enable automated backups on your database provider:
- Supabase: Automatic daily backups
- Neon: Point-in-time recovery
- Railway: Project-level backups

## Security Best Practices

1. **Encrypted Tokens**: User access tokens are encrypted at rest using AES-256-GCM
2. **Environment Variables**: Never commit `.env` files
3. **Connection String**: Keep `DATABASE_URL` secret
4. **Encryption Key**: Store `ENCRYPTION_KEY` securely (use secrets manager in production)
5. **Multi-tenancy**: All queries filtered by `userId`

## Schema Migrations

### Creating a Migration

When you change `prisma/schema.prisma`:

```bash
npm run db:migrate
# Enter migration name when prompted, e.g., "add_user_status_field"
```

### Rolling Back

Prisma doesn't support automatic rollbacks. To revert:

1. Create a new migration that reverses the change
2. Test thoroughly in staging
3. Deploy to production

### Viewing Migration History

```bash
npx prisma migrate status
```

## Getting Help

- **Prisma Docs**: https://www.prisma.io/docs
- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **Database Schema**: See [docs/database-schema.md](./database-schema.md)
- **Issues**: Check GitHub issues or create a new one

## Next Steps

After setting up the database:

1. Configure WhatsApp credentials (see [WHATSAPP_SETUP.md](./WHATSAPP_SETUP.md))
2. Build the application: `npm run build`
3. Start the server: `npm run dev`
4. Test the API: `http://localhost:3000/api-docs`

Your database is now ready for the WhatsApp Bulk SaaS application! 🚀
