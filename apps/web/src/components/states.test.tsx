// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { ChakraProvider } from '@chakra-ui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { system } from '../theme';
import { ErrorState, LoadingState } from './async-state';
import { OrderStatusBadge, terminalStatuses } from './order-status';

function renderWithTheme(component: ReactNode) {
  return render(<ChakraProvider value={system}>{component}</ChakraProvider>);
}

describe('buyer-facing asynchronous states', () => {
  it('announces loading and maps terminal order states to readable labels', () => {
    renderWithTheme(
      <>
        <LoadingState label="Loading orders" />
        <OrderStatusBadge status="MANUAL_REVIEW" />
      </>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Loading orders');
    expect(screen.getByText('Manual review')).toBeVisible();
    expect(terminalStatuses).toEqual(['CONFIRMED', 'FAILED', 'MANUAL_REVIEW']);
  });

  it('shows a safe correlation reference and lets the buyer retry', () => {
    const retry = vi.fn();
    renderWithTheme(
      <ErrorState error={new ApiError('Checkout failed.', 409, 'correlation-123')} retry={retry} />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Reference: correlation-123');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
