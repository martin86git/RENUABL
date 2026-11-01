/**
 * Server only. A proposal as a PDF file, for the customer to keep and send
 * on: a real file, not the browser's print window.
 *
 * It is made from the customer's copy of the proposal (`ProposalView`) and
 * nothing else, so it cannot carry a cost, a margin or a product code: none
 * is in what it is given. Each design opens as it does on the page (a band
 * of the business's colour, the title alone, or a photo beside it), sets its
 * parts' headings the same way (numbered in Minimal, down the left in Split)
 * and draws the year's output in the chart style chosen, in the business's
 * own colour with its logo, on A4: the cover, then the blocks in the order the business has
 * put them in, as on the page (`view.blocks`). Type is the faces built into
 * every PDF (Helvetica, and Times for "Editorial" headings): no font file is
 * embedded. The roof is drawn as the layout of the panels on a plain
 * ground; the picture from above stays on the page. Every estimate carries
 * the same wording as the page.
 */
import { Document, Image, Page, Polygon, Polyline, Rect, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { blockHeading, viewBlocks, type BlockId, type ViewBlock } from "@/lib/domain/design/blocks";
import { contrast, inkOn, lookOf, shownAbn, shownBsb, shownWebsite, type ChartStyle } from "@/lib/domain/design/brand";
import { money } from "@/lib/domain/design/deposit";
import {
  BANK_NOTE,
  INDICATIVE_LABEL,
  INDICATIVE_PRICE_NOTE,
  INDICATIVE_STEPS,
  acceptLine,
  contractDetails,
  ESTIMATE_NOTE,
  NO_SUNSHINE_NOTE,
  PRODUCTION_NOTE,
  ROOF_NOTE,
  SAVING_NOTE,
  STC_NOTE,
  VARIATIONS_NOTE,
  TIMING_NOTE,
  warrantyNote,
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

/** A year month by month, as on the page: bars, a line, a shaded area, or each month's figure written out. */
function Months({ kwh, colour, style = "bars" }: { kwh: number[]; colour: string; style?: ChartStyle }) {
  const W = 507;
  const H = 90;
  const top = Math.max(1, ...kwh);
  const slot = W / 12;
  if (style === "table")
    return (
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {kwh.map((m, i) => (
          <View key={i} style={{ width: "16.66%", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: LINE }}>
            <Text style={s.small}>{MONTHS[i]}</Text>
            <Text>{m.toLocaleString("en-AU")} kWh</Text>
          </View>
        ))}
      </View>
    );
  const at = kwh.map((m, i) => [i * slot + slot / 2, H - 4 - (m / top) * (H - 10)] as const);
  const line = at.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <View>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {style === "bars" &&
          kwh.map((m, i) => {
            const h = Math.max(1, (m / top) * (H - 4));
            return <Rect key={i} x={i * slot + 6} y={H - h} width={slot - 12} height={h} fill={colour} />;
          })}
        {style === "area" && (
          <Polygon points={`${line} ${at[11][0].toFixed(1)},${H} ${at[0][0].toFixed(1)},${H}`} fill={colour} fillOpacity={0.18} />
        )}
        {style !== "bars" && <Polyline points={line} fill="none" stroke={colour} strokeWidth={1.8} />}
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
  const terms = view.terms;
  const colour = view.theme.primary;
  const onColour = inkOn(colour);
  // The file is always set on white, whatever page the proposal's own palette uses: it is made to be printed.
  // So a colour too pale to see on white gives way to black for the drawing and the bars.
  const accent = contrast(colour, "#ffffff") >= 1.6 ? colour : INK;
  // Headings in the face the business chose, as near as the faces built into every PDF come to it.
  const heading = [s.h2, { fontFamily: view.theme.font === "editorial" ? "Times-Bold" : "Helvetica-Bold" }];
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

  const look = lookOf(view.template);
  const headingFace = view.theme.font === "editorial" ? "Times-Bold" : "Helvetica-Bold";
  /** The proposal's title, in the colours it sits on. */
  const titleBlock = (ink: string, soft: string, size?: number) => (
    <>
      <Text style={[s.eyebrow, { color: soft }]}>{view.indicative ? INDICATIVE_LABEL : "Proposal"}</Text>
      <Text style={[s.h1, { color: ink, fontFamily: headingFace }, size ? { fontSize: size } : {}]}>
        {view.title} for {view.customer.name}
      </Text>
      <Text style={{ marginTop: 8, color: ink }}>{view.customer.address}</Text>
      <Text style={{ marginTop: 14, fontSize: 9, color: soft }}>
        Prepared {day(view.publishedAt)}. The price stands until {day(view.validUntil)}.
      </Text>
    </>
  );

  // Each block's own content, by its id, as on the page: null when this proposal has nothing for it.
  const content: Record<BlockId, () => React.ReactNode> = {
    cover: () => null,
    system: () => (
      <>
        {/* With a choice of systems: each one in a line, and which one the rest of this file shows. */}
        {view.options && view.options.length > 1 && (
          <View wrap={false} style={{ marginBottom: 14 }}>
            {view.options.map((o) => {
              const shown = o.price.youPay === view.price.youPay && o.system.kw === view.system.kw;
              return (
                <View key={o.goal} style={[s.row, { alignItems: "flex-start" }]}>
                  <View style={{ width: "46%" }}>
                    <Text style={{ fontFamily: "Helvetica-Bold" }}>
                      {o.name}
                      {o.recommended ? " (recommended)" : ""}
                      {shown ? " · shown in this proposal" : ""}
                    </Text>
                    <Text style={s.small}>{o.promise}</Text>
                  </View>
                  <Text style={{ width: "22%" }}>
                    {o.system.kw.toFixed(2)} kW{o.system.batteryKwh > 0 ? ` · ${o.system.batteryKwh} kWh` : ""}
                  </Text>
                  <View style={{ width: "32%", alignItems: "flex-end" }}>
                    <Text style={{ fontFamily: "Helvetica-Bold" }}>{dollars(o.price.youPay)}</Text>
                    {o.bill && (
                      <Text style={s.small}>
                        saves about {dollars(o.bill.saving)} a year
                        {o.paybackYears !== null ? `, pays back in about ${o.paybackYears} years` : ""}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
            <Text style={[s.small, { marginTop: 6 }]}>
              Each system is priced in full, after the federal rebate. Savings and payback are estimates. {ESTIMATE_NOTE}
            </Text>
          </View>
        )}
        {view.system.details.map((d) => (
          <Row key={d.label} label={d.label} value={d.value} />
        ))}
      </>
    ),
    roof: () =>
      view.roof.panels.length > 0 ? (
        <View wrap={false}>
          <RoofDrawing panels={view.roof.panels} colour={accent} />
          <Text style={[s.small, { marginTop: 6 }]}>
            The {view.system.panels} panels as designed, seen from above, north at the top. {ROOF_NOTE}
          </Text>
        </View>
      ) : null,
    production: () =>
      view.production ? (
        <View wrap={false}>
          <Months kwh={view.production.monthlyKwh} colour={accent} style={view.theme.chart ?? "bars"} />
          <Text style={[s.small, { marginTop: 6 }]}>
            About {view.production.yearKwh.toLocaleString("en-AU")} kWh a year. {PRODUCTION_NOTE}
          </Text>
        </View>
      ) : (
        <Text style={s.muted}>{NO_SUNSHINE_NOTE}</Text>
      ),
    bill: () =>
      view.bill ? (
        <View wrap={false}>
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
            {view.bill.assumed.feedIn.toFixed(2)} a kWh feed-in, and {Math.round(view.bill.assumed.selfUseShare * 100)}% of solar used as it
            is made.
          </Text>
        </View>
      ) : null,
    price: () => (
      <>
        <View wrap={false}>
          {view.price.gstShown === "excluded" && view.price.beforeGst !== undefined && view.price.gst !== undefined ? (
            <>
              <Row label="Price before GST" value={dollars(view.price.beforeGst)} />
              <Row label="GST" value={dollars(view.price.gst)} />
              <Row label="Price with GST" value={dollars(view.price.incGst)} />
            </>
          ) : (
            <Row label="Price, GST included" value={dollars(view.price.incGst)} />
          )}
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
            {view.indicative ? ` ${INDICATIVE_PRICE_NOTE}` : ""}
          </Text>
          {view.variations && view.variations.length > 0 ? (
            <Text style={[s.small, { marginTop: 6 }]}>
              May apply: {view.variations.join(", ")}. {VARIATIONS_NOTE}
            </Text>
          ) : null}
        </View>
        {view.price.solarVic ? (
          <View style={{ marginTop: 14 }} wrap={false}>
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
      </>
    ),
    payment: () =>
      terms && (terms.deposit !== null || terms.milestones.length > 0 || terms.bank) ? (
        <View wrap={false}>
          {terms.deposit !== null && <Row label="Deposit to go ahead" value={money(terms.deposit)} bold />}
          {terms.milestones.map((m) => (
            <Row key={m.name} label={`${m.name} (${m.percent}%)`} value={money(m.amount)} />
          ))}
          {terms.bank ? (
            <View style={[s.card, { marginTop: 10 }]}>
              <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 4 }}>Pay by bank transfer to</Text>
              <Row label="Account name" value={terms.bank.name} />
              <Row label="BSB" value={shownBsb(terms.bank.bsb)} />
              <Row label="Account number" value={terms.bank.number} />
              {terms.bank.reference ? <Row label="Reference" value={terms.bank.reference} /> : null}
              <Text style={[s.small, { marginTop: 6 }]}>{BANK_NOTE}</Text>
            </View>
          ) : null}
        </View>
      ) : null,
    timing: () =>
      terms?.installTime ? (
        <View wrap={false}>
          <Row label="Usual time from going ahead to installation" value={terms.installTime} bold />
          <Text style={[s.small, { marginTop: 6 }]}>{TIMING_NOTE}</Text>
        </View>
      ) : null,
    warranty: () =>
      terms?.warranty ? (
        <View>
          {terms.warranty.years !== null && (
            <Row
              label={`${b.name}'s workmanship warranty`}
              value={`${terms.warranty.years} ${terms.warranty.years === 1 ? "year" : "years"}`}
              bold
            />
          )}
          {terms.warranty.words ? <Text style={{ marginTop: 6 }}>{terms.warranty.words}</Text> : null}
          <Text style={[s.small, { marginTop: 6 }]}>{warrantyNote(b.name)}</Text>
        </View>
      ) : null,
    about: () =>
      b.about || b.points.length > 0 ? (
        <View>
          {b.about ? <Text>{b.about}</Text> : null}
          {b.points.map((point) => (
            <Text key={point} style={{ marginTop: 4 }}>
              • {point}
            </Text>
          ))}
        </View>
      ) : null,
    "custom-1": () => null,
    "custom-2": () => null,
    "custom-3": () => null,
    accept: () => (
      <View wrap={false}>
        {accepted ? (
          <View style={s.card}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>Accepted by {accepted.name}</Text>
            <Text style={s.small}>
              on {day(accepted.at)}: &ldquo;{acceptLine(view)}&rdquo;
            </Text>
          </View>
        ) : view.indicative ? (
          <Text>
            How we work: {INDICATIVE_STEPS.map((step, i) => `${i + 1}. ${step.name}: ${step.words}`).join(" ")} Tell us what you think in
            the chat on your proposal online, or get in touch: {contact || b.name}.
          </Text>
        ) : (
          <Text>
            To go ahead, open your proposal online and choose &ldquo;I&apos;d like to go ahead&rdquo;, or get in touch: {contact || b.name}.
          </Text>
        )}
        {b.address ? <Text style={[s.small, { marginTop: 10 }]}>{b.address}</Text> : null}
      </View>
    ),
    // The standard terms and conditions, printed in full: the details of this agreement, the consumer information, the terms.
    terms: () => {
      if (view.ownTerms)
        return (
          <Text>
            {b.name}&apos;s terms and conditions go with this proposal, in their own document: {view.ownTerms.name} (PDF). It can be
            downloaded from the proposal&apos;s page. Going ahead with this proposal accepts them.
          </Text>
        );
      const contract = view.contract;
      if (!contract) return null;
      const details = contractDetails(view);
      const small = { fontSize: 8.5, lineHeight: 1.5 };
      const bold = { fontFamily: "Helvetica-Bold", marginTop: 10, marginBottom: 3 };
      return (
        <View>
          <Text style={bold}>Details</Text>
          {details.rows.map((row) => (
            <View key={row.label} style={[s.row, { alignItems: "flex-start" }]}>
              <Text style={[s.muted, { width: "38%" }]}>{row.label}</Text>
              <Text style={{ width: "60%", textAlign: "right" }}>{row.value}</Text>
            </View>
          ))}
          <Text style={[small, { marginTop: 8 }]}>The documents that make up this agreement, in the order they apply:</Text>
          {details.documents.map((document, i) => (
            <Text key={document} style={small}>
              {i + 1}. {document}
            </Text>
          ))}
          <Text style={bold}>{contract.netcc.heading}</Text>
          <Text style={small}>{contract.netcc.intro}</Text>
          {contract.netcc.guides.map((guide) => (
            <Text key={guide} style={small}>
              • {guide}
            </Text>
          ))}
          <Text style={small}>
            The guides are at {contract.netcc.url}. {contract.netcc.seller}
          </Text>
          {contract.terms.map((part) => (
            <View key={part.heading}>
              <Text style={bold} minPresenceAhead={30}>
                {part.heading}
              </Text>
              {part.clauses.map((clause) => (
                <Text key={clause} style={[small, { marginBottom: 4 }]}>
                  {clause}
                </Text>
              ))}
            </View>
          ))}
          <Text style={[s.small, { marginTop: 8 }]}>Terms version {contract.version}.</Text>
        </View>
      );
    },
    conditions: () => (b.conditions ? <Text style={{ fontSize: 8.5, lineHeight: 1.5 }}>{b.conditions}</Text> : null),
  };

  const blocks = viewBlocks(view);
  const coverBlock = blocks.find((block) => block.id === "cover");
  /** A block's own words and picture, as the business set them in the customiser. */
  const own = (block: ViewBlock) => {
    const image = picture(block.image?.id);
    return (
      <>
        {block.words ? <Text style={{ marginBottom: 6 }}>{block.words}</Text> : null}
        {image ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- a PDF image has no alt attribute
          <Image src={image} style={{ maxHeight: 200, width: "100%", objectFit: "cover", borderRadius: 4, marginBottom: 8 }} />
        ) : null}
      </>
    );
  };

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
        {look.cover === "split" ? (
          // A photo (or a block of the colour) beside the title.
          <View style={{ marginTop: 26, flexDirection: "row", gap: 18, alignItems: "stretch" }}>
            {cover ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- a PDF image has no alt attribute
              <Image src={cover} style={{ width: "45%", height: 220, objectFit: "cover", borderRadius: 4 }} />
            ) : (
              <View style={{ width: "45%", height: 220, backgroundColor: colour, borderRadius: 4 }} />
            )}
            <View style={{ flex: 1, justifyContent: "center" }}>{titleBlock(INK, MUTED)}</View>
          </View>
        ) : look.cover === "plain" ? (
          // The title alone, larger, over a fine line.
          <View style={{ marginTop: 40, paddingBottom: 22, borderBottomWidth: 0.5, borderBottomColor: LINE }}>
            {titleBlock(INK, MUTED, 34)}
          </View>
        ) : (
          <>
            {cover && look.cover === "photo" && (
              // eslint-disable-next-line jsx-a11y/alt-text -- a PDF image has no alt attribute
              <Image src={cover} style={{ marginTop: 20, height: 190, width: "100%", objectFit: "cover", borderRadius: 4 }} />
            )}
            <View style={{ marginTop: 26, backgroundColor: colour, borderRadius: 4, padding: 22 }}>{titleBlock(onColour, onColour)}</View>
          </>
        )}
        {view.note ? <Text style={{ marginTop: 18 }}>{view.note}</Text> : null}
        {coverBlock && (coverBlock.words || coverBlock.image) ? <View style={{ marginTop: 14 }}>{own(coverBlock)}</View> : null}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
          {[
            [`${view.system.kw} kW`, `${view.system.panels} panels`],
            ...(view.system.batteryKwh ? [[`${view.system.batteryKwh} kWh`, "battery storage"]] : []),
            ...(view.production ? [[`${view.production.yearKwh.toLocaleString("en-AU")} kWh`, "a year, estimated"]] : []),
            [dollars(view.price.youPay), "you pay, after the federal rebate"],
          ].map(([figure, words]) => (
            <View key={words} style={[s.card, { flex: 1 }]}>
              <Text style={{ fontSize: 15, fontFamily: "Helvetica-Bold" }}>{figure}</Text>
              <Text style={s.small}>{words}</Text>
            </View>
          ))}
        </View>
        {footer}
      </Page>

      {/* The rest, in the business's own order, as on the page: each block under its heading, running on over as many pages as it needs. */}
      <Page size="A4" style={s.page}>
        {blocks
          .filter((block) => block.id !== "cover")
          .map((block) => ({ block, inner: content[block.id](), hasOwn: Boolean(block.words || block.image) }))
          .filter(({ inner, hasOwn }) => inner || hasOwn)
          .map(({ block, inner, hasOwn }, i) => {
            const title = blockHeading(block, block.id === "about" ? `About ${b.name}` : block.id === "accept" ? "Going ahead" : "");
            const numbered = look.numbered ? `${String(i + 1).padStart(2, "0")}   ` : "";
            const lined = look.parts === "lined" && i > 0 ? { borderTopWidth: 0.5, borderTopColor: LINE, paddingTop: 14 } : {};
            if (look.headings === "side")
              return (
                <View key={block.id} style={[i === 0 ? {} : s.section, { flexDirection: "row", gap: 14 }]}>
                  <View style={{ width: "26%" }}>{title ? <Text style={[heading, { fontSize: 12 }]}>{title}</Text> : null}</View>
                  <View style={{ flex: 1 }}>
                    {hasOwn ? own(block) : null}
                    {inner}
                  </View>
                </View>
              );
            return (
              <View key={block.id} style={[i === 0 ? {} : s.section, lined]}>
                {title ? (
                  <Text style={heading} minPresenceAhead={40}>
                    {numbered}
                    {title}
                  </Text>
                ) : null}
                {hasOwn ? own(block) : null}
                {inner}
              </View>
            );
          })}
        {footer}
      </Page>
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
