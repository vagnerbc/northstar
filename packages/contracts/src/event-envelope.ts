import { z } from 'zod';

export const eventEnvelopeMetadataSchema = z.object({
  eventId: z.uuid(),
  eventType: z.string().min(1),
  eventVersion: z.number().int().positive(),
  occurredAt: z.iso.datetime(),
  producer: z.string().min(1),
  aggregateId: z.uuid(),
  correlationId: z.uuid(),
  causationId: z.uuid().optional(),
  traceparent: z.string().optional(),
});

export function eventEnvelopeSchema<TData extends z.ZodType>(data: TData) {
  return eventEnvelopeMetadataSchema.extend({ data });
}

export type EventEnvelope<TData> = z.infer<typeof eventEnvelopeMetadataSchema> & {
  data: TData;
};
