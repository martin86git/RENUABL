/**
 * Server only. RENUABL's tax invoice to a solar business as a PDF (`taxInvoice` in `domain/design/billing-invoice.ts`):
 * plain A4 in RENUABL's ink, made from the invoice's figures alone. No card details: Stripe has the card.
 */
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { TaxInvoiceView } from "@/lib/domain/design/billing-invoice";
import { dollars } from "@/lib/domain/design/plans";

const INK = "#1A1A1A";
const MUTED = "#6B6B6B";
const LINE = "#E4E4E4";

const s = StyleSheet.create({
  page: { padding: 48, fontFamily: "Helvetica", fontSize: 10, color: INK },
  top: { flexDirection: "row", justifyContent: "space-between", marginBottom: 32 },
  mark: { fontFamily: "Helvetica-Bold", fontSize: 16, letterSpacing: 2 },
  title: { fontSize: 22, marginBottom: 4 },
  muted: { color: MUTED },
  parties: { flexDirection: "row", gap: 24, marginBottom: 28 },
  party: { flex: 1, gap: 2 },
  label: { color: MUTED, fontSize: 8, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  row: { flexDirection: "row", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: LINE },
  head: { color: MUTED, fontSize: 8, textTransform: "uppercase", letterSpacing: 1 },
  what: { flex: 1 },
  qty: { width: 40, textAlign: "right" },
  gst: { width: 70, textAlign: "right" },
  amount: { width: 80, textAlign: "right" },
  totals: { marginTop: 16, marginLeft: "auto", width: 220, gap: 4 },
  total: { flexDirection: "row", justifyContent: "space-between" },
  grand: { fontFamily: "Helvetica-Bold", fontSize: 12, borderTopWidth: 1, borderTopColor: INK, paddingTop: 6, marginTop: 4 },
  notes: { marginTop: 36, gap: 3, color: MUTED, fontSize: 8.5 },
});

function TaxInvoiceDocument({ view }: { view: TaxInvoiceView }) {
  return (
    <Document title={`${view.title} ${view.number}`} author={view.supplier.tradingAs}>
      <Page size="A4" style={s.page}>
        <View style={s.top}>
          <Text style={s.mark}>{view.supplier.tradingAs}</Text>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.title}>{view.title}</Text>
            <Text style={s.muted}>No. {view.number}</Text>
            <Text style={s.muted}>Issued {view.issued}</Text>
            {view.paid && <Text style={s.muted}>Paid {view.paid}</Text>}
          </View>
        </View>
        <View style={s.parties}>
          <View style={s.party}>
            <Text style={s.label}>From</Text>
            <Text>
              {view.supplier.name} trading as {view.supplier.tradingAs}
            </Text>
            <Text>ABN {view.supplier.abn}</Text>
          </View>
          <View style={s.party}>
            <Text style={s.label}>To</Text>
            <Text>{view.buyer.name || "–"}</Text>
            {view.buyer.abn && <Text>ABN {view.buyer.abn}</Text>}
            {view.buyer.address ? <Text>{view.buyer.address}</Text> : null}
            {view.buyer.email ? <Text>{view.buyer.email}</Text> : null}
          </View>
        </View>
        <View style={[s.row, s.head]}>
          <Text style={s.what}>Description</Text>
          <Text style={s.qty}>Qty</Text>
          <Text style={s.gst}>GST</Text>
          <Text style={s.amount}>Amount</Text>
        </View>
        {view.lines.map((l, i) => (
          <View key={i} style={s.row} wrap={false}>
            <Text style={s.what}>{l.description}</Text>
            <Text style={s.qty}>{l.quantity}</Text>
            <Text style={s.gst}>{dollars(l.gstCents)}</Text>
            <Text style={s.amount}>{dollars(l.totalCents)}</Text>
          </View>
        ))}
        <View style={s.totals}>
          <View style={s.total}>
            <Text style={s.muted}>Total excluding GST</Text>
            <Text>{dollars(view.exGstCents)}</Text>
          </View>
          <View style={s.total}>
            <Text style={s.muted}>GST</Text>
            <Text>{dollars(view.gstCents)}</Text>
          </View>
          <View style={[s.total, s.grand]}>
            <Text>Total including GST</Text>
            <Text>{dollars(view.totalCents)}</Text>
          </View>
        </View>
        <View style={s.notes}>
          {view.notes.map((n) => (
            <Text key={n}>{n}</Text>
          ))}
        </View>
      </Page>
    </Document>
  );
}

export function taxInvoicePdf(view: TaxInvoiceView): Promise<Buffer> {
  return renderToBuffer(<TaxInvoiceDocument view={view} />);
}
