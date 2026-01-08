import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify';
import { Readable } from 'stream';
import { ContactService } from './contactService';
import { validateAndFormatPhoneNumber } from '../validators/phoneValidator';
import { csvRowSchema } from '../validators/contactValidator';
import logger from '../config/logger';
import prisma from '../utils/prisma';

export interface CsvImportError {
  row: number;
  phone?: string;
  error: string;
}

export interface CsvImportResult {
  total: number;
  imported: number;
  failed: number;
  duplicates: number;
  errors: CsvImportError[];
}

export interface CsvRow {
  phone: string;
  name?: string;
  email?: string;
  tags?: string | string[];
  opt_in_source?: 'manual' | 'csv' | 'api' | 'webhook';
}

/**
 * CSV Service for importing and exporting contacts
 */
export class CsvService {
  private contactService: ContactService;

  constructor(contactService?: ContactService) {
    this.contactService = contactService || new ContactService();
  }

  /**
   * Parse and validate CSV content
   */
  private async parseCsvContent(
    buffer: Buffer,
  ): Promise<{ rows: CsvRow[]; errors: CsvImportError[] }> {
    const rows: CsvRow[] = [];
    const errors: CsvImportError[] = [];

    return new Promise((resolve, reject) => {
      const parser = parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
        cast: false,
      });

      let rowNumber = 1; // Header is row 0

      parser.on('readable', () => {
        let record: any;
        // eslint-disable-next-line no-cond-assign
        while ((record = parser.read()) !== null) {
          rowNumber += 1;

          try {
            // Parse tags if it's a string
            if (record.tags && typeof record.tags === 'string') {
              // Split by comma and clean up
              record.tags = record.tags
                .split(',')
                .map((tag: string) => tag.trim())
                .filter((tag: string) => tag.length > 0);
            }

            // Validate row
            const { error, value } = csvRowSchema.validate(record, {
              abortEarly: false,
              stripUnknown: true,
            });

            if (error) {
              errors.push({
                row: rowNumber,
                phone: record.phone,
                error: error.details.map((d) => d.message).join(', '),
              });
            } else {
              rows.push(value);
            }
          } catch (err) {
            errors.push({
              row: rowNumber,
              phone: record.phone,
              error: err instanceof Error ? err.message : 'Validation error',
            });
          }
        }
      });

      parser.on('error', (err) => {
        reject(new Error(`CSV parsing error: ${err.message}`));
      });

      parser.on('end', () => {
        resolve({ rows, errors });
      });

      // Write buffer to parser
      parser.write(buffer);
      parser.end();
    });
  }

  /**
   * Import contacts from CSV file
   */
  async importCsv(
    userId: string,
    fileBuffer: Buffer,
  ): Promise<CsvImportResult> {
    logger.info(`Starting CSV import for user ${userId}`);

    // Parse and validate CSV
    const { rows, errors: parseErrors } = await this.parseCsvContent(fileBuffer);

    const result: CsvImportResult = {
      total: rows.length,
      imported: 0,
      failed: parseErrors.length,
      duplicates: 0,
      errors: [...parseErrors],
    };

    if (rows.length === 0) {
      logger.warn('No valid rows found in CSV');
      return result;
    }

    // Batch import contacts in chunks
    const BATCH_SIZE = 100;
    const batches: CsvRow[][] = [];

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      batches.push(rows.slice(i, i + BATCH_SIZE));
    }

    // Process each batch
    // eslint-disable-next-line no-restricted-syntax
    for (const batch of batches) {
      // eslint-disable-next-line no-await-in-loop
      await prisma.$transaction(async (tx: any) => {
        // eslint-disable-next-line no-restricted-syntax
        for (const row of batch) {
          try {
            // Format phone number
            const formattedPhone = validateAndFormatPhoneNumber(row.phone);

            // Check for duplicates
            // eslint-disable-next-line no-await-in-loop
            const existing = await tx.contact.findUnique({
              where: {
                userId_phone: {
                  userId,
                  phone: formattedPhone,
                },
              },
            });

            if (existing) {
              result.duplicates += 1;
              result.failed += 1;
              result.errors.push({
                row: batch.indexOf(row) + rows.indexOf(batch[0]) + 2, // Calculate actual row
                phone: row.phone,
                error: 'Duplicate phone number',
              });
              // eslint-disable-next-line no-continue
              continue;
            }

            // Create contact
            // eslint-disable-next-line no-await-in-loop
            await tx.contact.create({
              data: {
                userId,
                phone: formattedPhone,
                name: row.name || null,
                email: row.email || null,
                tags: Array.isArray(row.tags) ? row.tags : [],
                optedIn: !!row.opt_in_source,
                optedInAt: row.opt_in_source ? new Date() : null,
                optInSource: row.opt_in_source || 'csv',
              },
            });

            result.imported += 1;
          } catch (error) {
            result.failed += 1;
            result.errors.push({
              row: batch.indexOf(row) + rows.indexOf(batch[0]) + 2, // Calculate actual row
              phone: row.phone,
              error: error instanceof Error ? error.message : 'Import error',
            });
            logger.error(`Error importing contact ${row.phone}:`, error);
          }
        }
      });
    }

    logger.info(
      `CSV import completed: ${result.imported} imported, ${result.failed} failed, ${result.duplicates} duplicates`,
    );

    return result;
  }

  /**
   * Export contacts to CSV
   */
  async exportCsv(params: {
    userId: string;
    optedIn?: boolean;
    tags?: string | string[];
    search?: string;
    isBlocked?: boolean;
  }): Promise<Readable> {
    logger.info(`Starting CSV export for user ${params.userId}`);

    // Get contacts based on filters
    const { contacts } = await this.contactService.listContacts({
      userId: params.userId,
      optedIn: params.optedIn,
      tags: params.tags,
      search: params.search,
      isBlocked: params.isBlocked,
      limit: 100000, // Large limit for export
      offset: 0,
    });

    // Create CSV stringifier
    const stringifier = stringify({
      header: true,
      columns: {
        phone: 'phone',
        name: 'name',
        email: 'email',
        opted_in: 'opted_in',
        tags: 'tags',
        created_at: 'created_at',
      },
    });

    // Convert contacts to CSV rows
    const csvRows = contacts.map((contact) => ({
      phone: contact.phone,
      name: contact.name || '',
      email: contact.email || '',
      opted_in: contact.optedIn ? 'true' : 'false',
      tags: contact.tags.join(','),
      created_at: contact.createdAt.toISOString(),
    }));

    // Write rows to stringifier
    csvRows.forEach((row) => stringifier.write(row));
    stringifier.end();

    logger.info(`CSV export completed: ${contacts.length} contacts exported`);

    return stringifier;
  }
}

export default new CsvService();
