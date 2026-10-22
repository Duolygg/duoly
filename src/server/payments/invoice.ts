import type Stripe from 'stripe';

/**
 * Keeps Checkout's post-purchase invoice (test mode only today) in step when an
 * order's money goes back. A refund gets a credit note linked to that refund; a
 * voided authorization gets an out-of-band credit note on a paid invoice, or the
 * invoice is voided while still open. Payments without an invoice are left alone.
 */
export type InvoiceRelease =
  | { kind: 'refund'; refundId: string }
  | { kind: 'void' };

export type InvoiceOutcome = 'none' | 'credited' | 'voided' | 'already_done';

/** The invoice Checkout created for this payment, if any. */
export async function invoiceFor(
  stripe: Stripe,
  paymentIntentId: string,
): Promise<Stripe.Invoice | null> {
  const sessions = await stripe.checkout.sessions.list({
    payment_intent: paymentIntentId,
    limit: 1,
  });
  const invoice = sessions.data[0]?.invoice;
  if (!invoice) return null;
  return typeof invoice === 'string'
    ? stripe.invoices.retrieve(invoice)
    : invoice;
}

export async function releaseInvoice(
  stripe: Stripe,
  paymentIntentId: string,
  release: InvoiceRelease,
  input: { key: string; reason: Stripe.CreditNoteCreateParams.Reason },
): Promise<InvoiceOutcome> {
  const invoice = await invoiceFor(stripe, paymentIntentId);
  if (!invoice?.id) return 'none';
  if (invoice.status === 'open') {
    await stripe.invoices.voidInvoice(
      invoice.id,
      {},
      { idempotencyKey: `invoice_void_${input.key}` },
    );
    return 'voided';
  }
  if (invoice.status !== 'paid') return 'already_done';
  // Survives retries past the idempotency window: a fully credited invoice is done.
  if (invoice.post_payment_credit_notes_amount >= invoice.total)
    return 'already_done';
  await stripe.creditNotes.create(
    {
      invoice: invoice.id,
      amount: invoice.total,
      reason: input.reason,
      ...(release.kind === 'refund'
        ? {
            refunds: [
              { refund: release.refundId, amount_refunded: invoice.total },
            ],
          }
        : {
            out_of_band_amount: invoice.total,
            memo: 'The payment authorization was released. Nothing was charged.',
          }),
      metadata: { payment_intent: paymentIntentId },
    },
    { idempotencyKey: `credit_note_${input.key}` },
  );
  return 'credited';
}
