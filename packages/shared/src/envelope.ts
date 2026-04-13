import { z } from "zod";

export const MESSAGE_ENVELOPE_VERSION = "v1" as const;

export interface MessageEnvelope<TType extends string, TPayload> {
  version: typeof MESSAGE_ENVELOPE_VERSION;
  type: TType;
  payload: TPayload;
  requestId?: string;
  timestampMs: number;
}

export function makeEnvelope<TType extends string, TPayload>(
  type: TType,
  payload: TPayload,
  requestId?: string,
): MessageEnvelope<TType, TPayload> {
  return {
    version: MESSAGE_ENVELOPE_VERSION,
    type,
    payload,
    ...(requestId ? { requestId } : {}),
    timestampMs: Date.now(),
  };
}

export const messageEnvelopeBaseSchema = z.object({
  version: z.literal(MESSAGE_ENVELOPE_VERSION),
  type: z.string().min(1),
  payload: z.unknown(),
  requestId: z.string().min(1).optional(),
  timestampMs: z.number().finite(),
});

export function makeMessageEnvelopeSchema<
  TTypeSchema extends z.ZodType<string>,
  TPayloadSchema extends z.ZodTypeAny,
>(typeSchema: TTypeSchema, payloadSchema: TPayloadSchema) {
  return messageEnvelopeBaseSchema.extend({
    type: typeSchema,
    payload: payloadSchema,
  });
}
