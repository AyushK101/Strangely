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
