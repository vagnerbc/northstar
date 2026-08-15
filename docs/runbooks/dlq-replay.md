# Runbook: inspect and replay a DLQ

1. Open Kafka UI in the full stack and identify the `.dlq` topic, consumer group, event ID, aggregate/order ID, failure metadata, and original partition/offset.
2. Use the correlation ID to inspect Loki and the trace ID to inspect Tempo. Resolve the cause before replaying.
3. Confirm the target consumer's inbox has not completed the event and confirm replay remains safe for the aggregate's current state.
4. Publish the original validated envelope to its original domain topic with the order ID as key. Preserve `eventId`, `correlationId`, and `causationId`; attach operator/replay metadata outside the domain payload if tooling supports headers.
5. Verify inbox completion and business state, then record the operator, reason, timestamp, source DLQ offset, and outcome.

Never edit monetary, ownership, payment-provider, or reservation fields to make an event pass. A corrected business fact is a new event with a new event ID and explicit causation.
