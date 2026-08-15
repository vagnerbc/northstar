import { Button, Heading, Text } from '@chakra-ui/react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  public override state = { failed: false };

  public static getDerivedStateFromError() {
    return { failed: true };
  }
  public override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', { error, componentStack: info.componentStack });
  }
  public override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="centered-state">
        <Heading size="xl">Something went wrong</Heading>
        <Text>
          Reload the application. If the problem continues, share the correlation reference shown
          with the failed request.
        </Text>
        <Button onClick={() => window.location.reload()}>Reload</Button>
      </main>
    );
  }
}
