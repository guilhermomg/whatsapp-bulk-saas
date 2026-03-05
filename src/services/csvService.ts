import { stringify } from 'csv-stringify';
import { Readable } from 'stream';
import { OptInSource } from '@prisma/client';
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
   * Parse headers from the first row and return column indices
   * Throws error if required headers are not found
   */
  private parseHeaders(firstRow: string): { [key: string]: number } {
    const columns = firstRow.split(',').map((col) => col.trim().toLowerCase());
    logger.debug(`Parsing headers from first row: ${JSON.stringify(columns)}`);

    const headerMap: { [key: string]: number } = {};

    // Map each known header to its column index
    for (let i = 0; i < columns.length; i += 1) {
      const col = columns[i];
      if (col === 'phone') headerMap.phone = i;
      else if (col === 'name') headerMap.name = i;
      else if (col === 'email') headerMap.email = i;
      else if (col === 'tags') headerMap.tags = i;
      else if (col === 'opt_in_source' || col === 'opt-in-source' || col === 'optin_source') {
        headerMap.opt_in_source = i;
      }
    }

    // Phone is required
    if (headerMap.phone === undefined) {
      logger.error(`Required header "phone" not found. Headers: ${JSON.stringify(columns)}`);
      throw new Error('CSV file must contain a "phone" header column');
    }

    logger.debug(`Headers parsed successfully: ${JSON.stringify(headerMap)}`);
    return headerMap;
  }

  /**
   * Parse and validate CSV content
   * Requires CSV to have headers in the first row
   * Throws error if headers are not found
   */
  private async parseCsvContent(
    buffer: Buffer,
  ): Promise<{ rows: CsvRow[]; errors: CsvImportError[] }> {
    const rows: CsvRow[] = [];
    const errors: CsvImportError[] = [];

    return new Promise((resolve, reject) => {
      try {
        // Convert buffer to string, removing any BOM
        let content = buffer.toString('utf-8');
        if (content.charCodeAt(0) === 0xFEFF) {
          content = content.slice(1);
        }
        content = content.trim();

        // Split by \r\n or \n to handle both Windows and Unix line endings
        const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);

        if (lines.length === 0) {
          logger.error('CSV file is empty');
          throw new Error('CSV file is empty');
        }

        if (lines.length < 2) {
          logger.error('CSV file must contain headers and at least one data row');
          throw new Error('CSV file must contain headers and at least one data row');
        }

        // Parse headers from first row (will throw if phone header not found)
        const headerMap = this.parseHeaders(lines[0]);

        // Process data rows (starting from line 1, skipping header row 0)
        for (let i = 1; i < lines.length; i += 1) {
          const line = lines[i].trim();
          const rowNumber = i + 1; // +1 because of header row

          if (!line) {
            // eslint-disable-next-line no-continue
            continue;
          }

          try {
            // Split the line by comma
            const values = line.split(',').map((v) => v.trim());
            logger.debug(`Row ${rowNumber}: raw values = ${JSON.stringify(values)}`);

            // Map values to fields using header indices
            const record: any = {
              name: headerMap.name !== undefined ? values[headerMap.name] : undefined,
              phone: values[headerMap.phone] || undefined,
              email: headerMap.email !== undefined
                ? values[headerMap.email]
                : undefined,
              tags: headerMap.tags !== undefined ? values[headerMap.tags] : undefined,
              opt_in_source: headerMap.opt_in_source !== undefined
                ? values[headerMap.opt_in_source]
                : undefined,
            };

            logger.debug(`Row ${rowNumber} mapped: ${JSON.stringify(record)}`);

            // Parse tags if it's a string
            if (record.tags && typeof record.tags === 'string') {
              record.tags = record.tags
                .split(',')
                .map((tag: string) => tag.trim())
                .filter((tag: string) => tag.length > 0);
              logger.debug(`Row ${rowNumber} - Parsed tags: ${JSON.stringify(record.tags)}`);
            }

            // Validate row
            const { error, value } = csvRowSchema.validate(record, {
              abortEarly: false,
              stripUnknown: true,
            });

            if (error) {
              const errorMsg = error.details.map((d) => d.message).join(', ');
              logger.warn(`Row ${rowNumber} validation error: ${errorMsg}. Record: ${JSON.stringify(record)}`);
              errors.push({
                row: rowNumber,
                phone: record.phone,
                error: errorMsg,
              });
            } else {
              logger.debug(`Row ${rowNumber} validated successfully: phone=${value.phone}, name=${value.name}`);
              rows.push(value);
            }
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Validation error';
            logger.error(`Row ${rowNumber} exception: ${errMsg}`);
            errors.push({
              row: rowNumber,
              phone: undefined,
              error: errMsg,
            });
          }
        }

        logger.info(
          `CSV parsing complete: ${rows.length} valid rows, ${errors.length} errors`,
        );
        resolve({ rows, errors });
      } catch (err) {
        logger.error(`Error in parseCsvContent: ${err instanceof Error ? err.message : 'Unknown error'}`);
        reject(err);
      }
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
      logger.warn(`Import for user ${userId}: No valid rows found in CSV. Parse errors: ${parseErrors.length}`);
      return result;
    }

    logger.info(`Proceeding with import: ${rows.length} valid rows, ${parseErrors.length} parse errors`);

    // Pre-process all rows: format phone numbers
    const contactsToInsert: {
      userId: string;
      phone: string;
      name: string | null;
      email: string | null;
      tags: string[];
      optedIn: boolean;
      optedInAt: Date | null;
      optInSource: OptInSource | null;
    }[] = [];

    // eslint-disable-next-line no-restricted-syntax
    for (const row of rows) {
      try {
        const formattedPhone = validateAndFormatPhoneNumber(row.phone);
        contactsToInsert.push({
          userId,
          phone: formattedPhone,
          name: row.name || null,
          email: row.email || null,
          tags: Array.isArray(row.tags) ? row.tags : [],
          optedIn: !!row.opt_in_source,
          optedInAt: row.opt_in_source ? new Date() : null,
          optInSource: (row.opt_in_source as OptInSource) || OptInSource.csv,
        });
      } catch (formatErr) {
        const errMsg = formatErr instanceof Error ? formatErr.message : 'Phone format error';
        logger.error(`Error formatting phone "${row.phone}": ${errMsg}`);
        result.failed += 1;
        result.errors.push({ row: 0, phone: row.phone, error: `Phone format error: ${errMsg}` });
      }
    }

    // Batch import contacts in chunks using createMany (no interactive transaction)
    const BATCH_SIZE = 100;
    logger.info(`Inserting ${contactsToInsert.length} contacts in batches of ${BATCH_SIZE}`);

    for (let i = 0; i < contactsToInsert.length; i += BATCH_SIZE) {
      const batch = contactsToInsert.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(contactsToInsert.length / BATCH_SIZE);
      logger.info(`Processing batch ${batchNumber}/${totalBatches} with ${batch.length} contacts`);

      try {
        // eslint-disable-next-line no-await-in-loop
        const insertResult = await prisma.contact.createMany({
          data: batch,
          skipDuplicates: true,
        });

        result.imported += insertResult.count;
        const skipped = batch.length - insertResult.count;
        if (skipped > 0) {
          result.duplicates += skipped;
          result.failed += skipped;
          logger.info(`Batch ${batchNumber}: ${insertResult.count} inserted, ${skipped} duplicates skipped`);
        } else {
          logger.info(`Batch ${batchNumber}: ${insertResult.count} inserted`);
        }
      } catch (batchError) {
        const errMsg = batchError instanceof Error ? batchError.message : 'Batch insert error';
        logger.error(`Error in batch ${batchNumber}: ${errMsg}`, batchError);
        result.failed += batch.length;
        result.errors.push({ row: i + 2, phone: undefined, error: errMsg });
      }
    }

    logger.info(
      `CSV import completed for user ${userId}: ${result.imported} imported, ${result.failed} failed, ${result.duplicates} duplicates`,
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
    logger.info(`Starting CSV export for user ${params.userId}`, {
      optedIn: params.optedIn,
      hasTags: !!params.tags,
      hasSearch: !!params.search,
      isBlocked: params.isBlocked,
    });

    try {
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

      logger.info(`Retrieved ${contacts.length} contacts for export`);

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

      logger.debug(`Converted ${csvRows.length} contacts to CSV rows`);

      // Write rows to stringifier
      csvRows.forEach((row) => stringifier.write(row));
      stringifier.end();

      logger.info(`CSV export completed: ${contacts.length} contacts exported`);

      return stringifier;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Export error';
      logger.error(`Error in CSV export: ${errMsg}`, error);
      throw error;
    }
  }
}

export default new CsvService();
