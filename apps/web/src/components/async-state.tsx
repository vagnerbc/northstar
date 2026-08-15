import { Button, Spinner, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { ApiError } from '../api/client';

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="centered-state" role="status">
      <Spinner size="lg" />
      <Text>{label}…</Text>
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const apiError = error instanceof ApiError ? error : undefined;
  return (
    <div className="centered-state" role="alert">
      <Text fontWeight="bold">We could not complete this request.</Text>
      <Text>{error instanceof Error ? error.message : 'An unexpected error occurred.'}</Text>
      {apiError?.correlationId && (
        <Text className="correlation">Reference: {apiError.correlationId}</Text>
      )}
      {retry && (
        <Button variant="outline" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="centered-state empty-state">{children}</div>;
}
