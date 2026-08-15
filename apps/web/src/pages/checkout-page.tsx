import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Heading, Text } from '@chakra-ui/react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { api } from '../api/client';
import { useAuth } from '../auth/auth-context';
import { ErrorState } from '../components/async-state';

const schema = z.object({
  recipientName: z.string().min(2, 'Enter the recipient name.'),
  line1: z.string().min(3, 'Enter the street address.'),
  line2: z.string().optional(),
  city: z.string().min(2, 'Enter the city.'),
  state: z
    .string()
    .length(2, 'Use the two-letter state code.')
    .transform((value) => value.toUpperCase()),
  postalCode: z.string().regex(/^\d{5}-?\d{3}$/, 'Use a Brazilian postal code.'),
  country: z.literal('BR'),
});
type AddressInput = z.input<typeof schema>;

export function CheckoutPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const form = useForm<AddressInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      country: 'BR',
      state: '',
      recipientName: '',
      line1: '',
      line2: '',
      city: '',
      postalCode: '',
    },
  });
  const checkout = useMutation({
    mutationFn: (value: AddressInput) => {
      const parsed = schema.parse(value);
      return api.checkout(
        {
          recipientName: parsed.recipientName,
          line1: parsed.line1,
          ...(parsed.line2 ? { line2: parsed.line2 } : {}),
          city: parsed.city,
          state: parsed.state,
          postalCode: parsed.postalCode,
          country: parsed.country,
        },
        crypto.randomUUID(),
        auth.getToken,
      );
    },
    onSuccess: (result) => void navigate(`/orders/${result.orderId}?checkout=true`),
  });
  return (
    <div className="page-shell form-page">
      <Text className="eyebrow">CHECKOUT</Text>
      <Heading as="h1" size="3xl">
        Where should it go?
      </Heading>
      <Text color="fg.muted">
        Your address is snapshotted on the order and redacted from application logs.
      </Text>
      {checkout.isError && <ErrorState error={checkout.error} />}
      <form
        className="address-form"
        onSubmit={(event) => void form.handleSubmit((value) => checkout.mutate(value))(event)}
        noValidate
      >
        <FormField label="Recipient name" error={form.formState.errors.recipientName?.message}>
          <input autoComplete="name" {...form.register('recipientName')} />
        </FormField>
        <FormField label="Address line 1" error={form.formState.errors.line1?.message}>
          <input autoComplete="address-line1" {...form.register('line1')} />
        </FormField>
        <FormField label="Address line 2 (optional)" error={form.formState.errors.line2?.message}>
          <input autoComplete="address-line2" {...form.register('line2')} />
        </FormField>
        <div className="form-row">
          <FormField label="City" error={form.formState.errors.city?.message}>
            <input autoComplete="address-level2" {...form.register('city')} />
          </FormField>
          <FormField label="State" error={form.formState.errors.state?.message}>
            <input maxLength={2} autoComplete="address-level1" {...form.register('state')} />
          </FormField>
        </div>
        <FormField label="Postal code" error={form.formState.errors.postalCode?.message}>
          <input autoComplete="postal-code" {...form.register('postalCode')} />
        </FormField>
        <input type="hidden" {...form.register('country')} />
        <Button type="submit" size="lg" loading={checkout.isPending}>
          Reserve inventory and continue
        </Button>
      </form>
    </div>
  );
}

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error: string | undefined;
  children: ReactNode;
}) {
  return (
    <label className="form-field">
      <span>{label}</span>
      {children}
      {error && <small role="alert">{error}</small>}
    </label>
  );
}
