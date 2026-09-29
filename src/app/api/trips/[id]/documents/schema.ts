import { z } from 'zod';

/** External document links must be https (no javascript:, data:, http:). */
export const httpsUrl = z
    .string()
    .trim()
    .max(2000)
    .url()
    .refine((value) => value.toLowerCase().startsWith('https://'), 'il link deve iniziare con https://');

const documentFields = {
    entity_type: z.enum(['leg', 'accommodation', 'restaurant', 'activity', 'trip']).optional().nullable(),
    entity_id: z.string().uuid().optional().nullable(),
    type: z.enum(['boarding_pass', 'hotel_voucher', 'ticket', 'reservation_confirmation', 'insurance', 'visa', 'other']),
    title: z.string().trim().min(1).max(200),
    file_type: z.enum(['pdf', 'image']).default('image'),
    valid_from: z.string().date().optional().nullable(),
    valid_until: z.string().date().optional().nullable(),
    barcode_data: z.string().max(1000).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
};

/** JSON body: a document that points to an external https link. */
export const CreateLinkDocumentSchema = z.object({ ...documentFields, file_url: httpsUrl });

/** Multipart fields of an uploaded document (the file itself is checked apart). */
export const CreateFileDocumentSchema = z.object(documentFields).omit({ file_type: true });

export const UpdateDocumentSchema = z
    .object({ ...documentFields, file_url: httpsUrl })
    .omit({ file_type: true })
    .partial();
