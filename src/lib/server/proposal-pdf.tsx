/**
 * Server only. A proposal as a PDF file, for the customer to keep and send
 * on: a real file, not the browser's print window.
 *
 * It is made from the customer's copy of the proposal (`ProposalView`) and
 * nothing else, so it cannot carry a cost, a margin or a product code: none
 * is in what it is given. One layout for every template (the templates
 * differ on the page, not in the file), in the business's own colour with
 * its logo, on A4. The roof is drawn as the layout of the panels on a plain
 * ground; the picture from above stays on the page. Every estimate carries
 * the same wording as the page.
 */
import { Document, Image, Page, Polygon, Rect, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { contrast, inkOn, shownAbn, shownWebsite } from "@/lib/domain/design/brand";
import {
  ACCEPT_LINE,
  ACCEPT_WITH_CONDITIONS,
  ESTIMATE_NOTE,
  NO_SUNSHINE_NOTE,
  PRODUCTION_NOTE,
  ROOF_NOTE,
  SAVING_NOTE,
  STC_NOTE,
  type ProposalView,
} from "@/lib/domain/design/proposal";

/** The pictures a proposal was sent with, by their id, as bytes: only PNG and JPEG are ever kept. */
export type PdfImages = Record<string, { bytes: Buffer; contentType: string }>;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dollars = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;
const day = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: iso.length === 10 ? "UTC" : "Australia/Melbourne",
  });

const INK = "#16181d";
const MUTED = "#676b75";
const LINE = "#e3e4e8";

const s = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 56, paddingHorizontal: 44, fontFamily: "Helvetica", fontSize: 10, color: INK, lineHeight: 1.45 },
  eyebrow: { fontSize: 8, letterSpacing: 1.4, textTransform: "uppercase", color: MUTED },
  h1: { fontSize: 26, fontFamily: "Helvetica-Bold", lineHeight: 1.15, marginTop: 6 },
  h2: { fontSize: 15, fontFamily: "Helvetica-Bold", marginBottom: 8 },
  muted: { color: MUTED },
  small: { fontSize: 8, color: MUTED, lineHeight: 1.4 },
  section: { marginTop: 22 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: LINE },
  card: { borderWidth: 0.5, borderColor: LINE, borderRadius: 4, padding: 12 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: MUTED,
  },
});

/** The panels drawn to scale in a box, on a plain ground: their own shape and place, without the picture from above. */
function RoofDrawing({ panels, colour }: { panels: number[][]; colour: string }) {
  const W = 507;
  const H = 240;
  const xs = panels.flatMap((p) => p.filter((_, i) => i % 2 === 0));
  const ys = panels.flatMap((p) => p.filter((_, i) => i % 2 === 1));
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = Math.min((W - 40) / Math.max(1, maxX - minX), (H - 40) / Math.max(1, maxY - minY));
  const ox = (W - (maxX - minX) * scale) / 2 - minX * scale;
  const oy = (H - (maxY - minY) * scale) / 2 - minY * scale;
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <Rect x={0} y={0} width={W} height={H} fill="#f3f4f6" />
      {panels.map((p, i) => (
        <Polygon
          key={i}
          points={[0, 2, 4, 6].map((k) => `${(p[k] * scale + ox).toFixed(1)},${(p[k + 1] * scale + oy).toFixed(1)}`).join(" ")}
          fill={colour}
          stroke="#ffffff"
          strokeWidth={0.6}
        />
      ))}
    </Svg>
  );
}

/** A year month by month as bars: each month's estimate against the best month. */
function Months({ kwh, colour }: { kwh: number[]; colour: string }) {
  const W = 507;
  const H = 90;
  const top = Math.max(1, ...kwh);
  const slot = W / 12;
  return (
    <View>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {kwh.map((m, i) => {
          const h = Math.max(1, (m / top) * (H - 4));
          return <Rect key={i} x={i * slot + 6} y={H - h} width={slot - 12} height={h} fill={colour} />;
        })}
      </Svg>
      <View style={{ flexDirection: "row" }}>
        {MONTHS.map((m) => (
          <Text key={m} style={[s.small, { width: slot, textAlign: "center" }]}>
            {m}
          </Text>
        ))}
      </View>
    </View>
  );
}

const Row = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
  <View style={s.row}>
    <Text style={bold ? { fontFamily: "Helvetica-Bold" } : s.muted}>{label}</Text>
    <Text style={bold ? { fontFamily: "Helvetica-Bold" } : undefined}>{value}</Text>
  </View>
);

function ProposalDocument({
  view,
  images,
  accepted,
}: {
  view: ProposalView;
  images: PdfImages;
  accepted: { name: string; at: string } | null;
}) {
  const b = view.business;
  const colour = view.theme.primary;
  const onColour = inkOn(colour);
  // The file is always set on white, whatever page the proposal's own palette uses: it is made to be printed.
  // So a colour too pale to see on white gives way to black for the drawing and the bars.
  const accent = contrast(colour, "#ffffff") >= 1.6 ? colour : INK;
  const picture = (id: string | undefined) => {
    const image = id ? images[id] : undefined;
    return image ? { data: image.bytes, format: image.contentType === "image/png" ? ("png" as const) : ("jpg" as const) } : null;
  };
  const logo = picture(b.logo?.id);
  const cover = picture(b.cover?.id);
  const contact = [b.phone, b.email, b.website && shownWebsite(b.website)].filter(Boolean).join("  ·  ");
  const legal = [b.abn && `ABN ${shownAbn(b.abn)}`, ...b.licences].filter(Boolean).join("  ·  ");
  // The same line at the foot of every page.
  const footer = (
    <View style={s.footer} fixed>
      <Text>
        {b.name}
        {legal ? `  ·  ${legal}` : ""}
      </Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );

  return (
    <Document title={`${view.title}: ${view.customer.name}`} author={b.name} creator={b.name} producer={b.name}>
      <Page size="A4" style={s.page}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          {logo ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- a PDF image has no alt attribute
            <Image src={logo} style={{ height: 40, maxWidth: 180, objectFit: "contain", objectPosition: "left" }} />
          ) : (
            <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold" }}>{b.name}</Text>
          )}
          <Text style={s.small}>{contact}</Text>
        </View>
        {cover && (
          // eslint-disable-next-line jsx-a11y/alt-text -- a PDF image has no alt attribute
          <Image src={cover} style={{ marginTop: 20, height: 190, width: "100%", objectFit: "cover", borderRadius: 4 }} />
        )}
        <View style={{ marginTop: 26, backgroundColor: colour, borderRadius: 4, padding: 22 }}>
          <Text style={[s.eyebrow, { color: onColour }]}>Proposal</Text>
          <Text style={[s.h1, { color: onColour }]}>
            {view.title} for {view.customer.name}
          </Text>
          <Text style={{ marginTop: 8, color: onColour }}>{view.customer.address}</Text>
          <Text style={{ marginTop: 14, fontSize: 9, color: onColour }}>
            Prepared {day(view.publishedAt)}. The price stands until {day(view.validUntil)}.
          </Text>
        </View>
        {view.note ? <Text style={{ marginTop: 18 }}>{view.note}</Text> : null}

        <View style={s.section}>
          <Text style={s.h2}>Your system</Text>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
            {[
              [`${view.system.kw} kW`, `${view.system.panels} panels`],
              ...(view.system.batteryKwh ? [[`${view.system.batteryKwh} kWh`, "battery storage"]] : []),
              ...(view.production ? [[`${view.production.yearKwh.toLocaleString("en-AU")} kWh`, "a year, estimated"]] : []),
            ].map(([figure, words]) => (
              <View key={words} style={[s.card, { flex: 1 }]}>
                <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold" }}>{figure}</Text>
                <Text style={s.small}>{words}</Text>
              </View>
            ))}
          </View>
          {view.system.details.map((d) => (
            <Row key={d.label} label={d.label} value={d.value} />
          ))}
        </View>
        {footer}
      </Page>

      <Page size="A4" style={s.page}>
        {view.roof.panels.length > 0 && (
          <View>
            <Text style={s.h2}>Your roof</Text>
            <RoofDrawing panels={view.roof.panels} colour={accent} />
            <Text style={[s.small, { marginTop: 6 }]}>
              The {view.system.panels} panels as designed, seen from above, north at the top. {ROOF_NOTE}
            </Text>
          </View>
        )}
        <View style={s.section}>
          <Text style={s.h2}>What it makes</Text>
          {view.production ? (
            <>
              <Months kwh={view.production.monthlyKwh} colour={accent} />
              <Text style={[s.small, { marginTop: 6 }]}>
                About {view.production.yearKwh.toLocaleString("en-AU")} kWh a year. {PRODUCTION_NOTE}
              </Text>
            </>
          ) : (
            <Text style={s.muted}>{NO_SUNSHINE_NOTE}</Text>
          )}
        </View>
        {view.bill && (
          <View style={s.section}>
            <Text style={s.h2}>Your power bill</Text>
            <Row label="A year's bill now (estimate)" value={dollars(view.bill.now)} />
            <Row label="A year's bill with this system (estimate)" value={dollars(view.bill.after)} />
            <Row label="Estimated saving a year" value={`about ${dollars(view.bill.saving)}`} bold />
            {view.paybackYears !== null && <Row label="Years for the saving to add up to the price" value={`about ${view.paybackYears}`} />}
            <Text style={[s.small, { marginTop: 6 }]}>
              {SAVING_NOTE} {ESTIMATE_NOTE}
            </Text>
            <Text style={[s.small, { marginTop: 4 }]}>
              Worked out from: a {view.bill.assumed.interval} bill of {dollars(view.bill.assumed.amount)}, $
              {view.bill.assumed.supplyPerDay.toFixed(2)} a day supply charge, ${view.bill.assumed.rate.toFixed(2)} a kWh, $
              {view.bill.assumed.feedIn.toFixed(2)} a kWh feed-in, and {Math.round(view.bill.assumed.selfUseShare * 100)}% of solar used as
              it is made.
            </Text>
          </View>
        )}
        {footer}
      </Page>

      <Page size="A4" style={s.page}>
        <Text style={s.h2}>Your price</Text>
        <Row label="Price, GST included" value={dollars(view.price.incGst)} />
        <Row label="Less the federal rebate (estimate)" value={`- ${dollars(view.price.stc)}`} />
        <View
          style={[
            s.row,
            { borderBottomWidth: 0, backgroundColor: colour, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 4, marginTop: 6 },
          ]}
        >
          <Text style={{ color: onColour, fontFamily: "Helvetica-Bold" }}>You pay</Text>
          <Text style={{ color: onColour, fontFamily: "Helvetica-Bold", fontSize: 14 }}>{dollars(view.price.youPay)}</Text>
        </View>
        <Text style={[s.small, { marginTop: 8 }]}>
          Covers: {view.price.includes.join(", ")}. {STC_NOTE} The price stands until {day(view.validUntil)}.
        </Text>
        {view.price.solarVic ? (
          <View style={{ marginTop: 14 }}>
            <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 4 }}>With Solar Victoria, if you are eligible and approved</Text>
            <Row label="Solar Victoria rebate" value={`- ${dollars(view.price.solarVic.rebate)}`} />
            <Row label="You would pay" value={dollars(view.price.solarVic.afterRebate)} />
            {view.price.solarVic.loan > 0 ? (
              <>
                <Row label="Solar Victoria interest-free loan" value={`- ${dollars(view.price.solarVic.loan)}`} />
                <Row label="To pay up front" value={dollars(view.price.solarVic.upfront)} />
                <Row
                  label={`Then, for ${view.price.solarVic.loanMonths} months, with no interest`}
                  value={`$${view.price.solarVic.monthly.toFixed(2)} a month`}
                />
              </>
            ) : null}
            <Text style={[s.small, { marginTop: 6 }]}>{view.price.solarVic.note}</Text>
          </View>
        ) : null}
        {b.extra ? <Text style={{ marginTop: 14 }}>{b.extra}</Text> : null}

        {(b.about || b.points.length > 0) && (
          <View style={s.section}>
            <Text style={s.h2}>About {b.name}</Text>
            {b.about ? <Text>{b.about}</Text> : null}
            {b.points.map((point) => (
              <Text key={point} style={{ marginTop: 4 }}>
                • {point}
              </Text>
            ))}
          </View>
        )}

        <View style={s.section}>
          <Text style={s.h2}>Going ahead</Text>
          {accepted ? (
            <View style={s.card}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>Accepted by {accepted.name}</Text>
              <Text style={s.small}>
                on {day(accepted.at)}: &ldquo;{b.conditions ? ACCEPT_WITH_CONDITIONS : ACCEPT_LINE}&rdquo;
              </Text>
            </View>
          ) : (
            <Text>
              To go ahead, open your proposal online and choose &ldquo;I&apos;d like to go ahead&rdquo;, or get in touch:{" "}
              {contact || b.name}.
            </Text>
          )}
          {b.address ? <Text style={[s.small, { marginTop: 10 }]}>{b.address}</Text> : null}
        </View>
        {footer}
      </Page>

      {b.conditions ? (
        <Page size="A4" style={s.page}>
          <Text style={s.h2}>Conditions</Text>
          <Text style={{ fontSize: 8.5, lineHeight: 1.5 }}>{b.conditions}</Text>
          {footer}
        </Page>
      ) : null}
    </Document>
  );
}

/** The proposal as the bytes of a PDF file. */
export async function proposalPdf(view: ProposalView, images: PdfImages, accepted: { name: string; at: string } | null): Promise<Buffer> {
  return renderToBuffer(<ProposalDocument view={view} images={images} accepted={accepted} />);
}

/** A name for the file: "Proposal - Alex Example.pdf", with nothing a file name can't hold. */
export function pdfName(view: Pick<ProposalView, "customer">): string {
  const who = view.customer.name.replace(/[^\p{L}\p{N} .'-]/gu, "").trim() || "customer";
  return `Proposal - ${who}.pdf`;
}
