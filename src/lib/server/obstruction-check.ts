/**
 * Server only. Looks for roof obstructions on the job's satellite image with
 * Claude (vision), returning boxes on the image. Needs ANTHROPIC_API_KEY.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { OBSTRUCTION_TYPES, cleanObstructions, type ObstructionCheck } from "@/lib/domain/obstructions";
import { plainText } from "@/lib/domain/emails";
import { readWithClaude, type ReadOptions } from "./claude-reader";

const SCHEMA = {
  type: "object",
  properties: {
    obstructions: {
      type: "array",
      description: "Things on or over the roof that solar panels must avoid.",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: [...OBSTRUCTION_TYPES] },
          box: {
            type: "array",
            items: { type: "number" },
            description: "[left, top, right, bottom], each 0 to 1000 across the whole image (0,0 is the top-left corner).",
          },
          note: { type: "string", description: "A few words, e.g. 'two whirlybird vents'." },
        },
        required: ["type", "box", "note"],
        additionalProperties: false,
      },
    },
    structures: {
      type: "array",
      description:
        "Structures near the house that are not its own solid roof, where panels never go: pergolas, verandas, carports, glass, polycarbonate or other clear roofs, shade sails, sheds, and any neighbouring house whose roof touches this one.",
      items: {
        type: "object",
        properties: {
          box: {
            type: "array",
            items: { type: "number" },
            description: "[left, top, right, bottom], each 0 to 1000 across the whole image (0,0 is the top-left corner).",
          },
          note: { type: "string", description: "A few words, e.g. 'pergola with clear roof', 'house next door'." },
        },
        required: ["box", "note"],
        additionalProperties: false,
      },
    },
    summary: { type: "string", description: "One sentence for the installer about the roof's usable space." },
  },
  required: ["obstructions", "structures", "summary"],
  additionalProperties: false,
} as const;

const prompt = (roofBox: [number, number, number, number]) =>
  `This is a satellite image (north up) of a house in Australia where solar panels will be installed. The main roof is roughly within [${roofBox.join(", ")}] (left, top, right, bottom on a 0–1000 scale).
Find everything on that roof that panels must avoid: vents and whirlybirds, skylights, chimneys and flues, aerials, satellite dishes, air conditioner units, solar hot water, existing solar panels, and trees shading or overhanging the roof.
Only things fixed on the roof's tiles or sheeting count. Never box a pergola, a veranda, a carport, a glass or polycarbonate roof, a shed or any other structure beside or below the main roof, and never box a whole section of roof (a lower roof, a wing, a dormer, a gable or a patch of a different colour is roof, not an obstruction).
Separately, under structures, box each structure near the house that is not its own solid tiled or metal roof: a pergola, a veranda, a carport, a glass, polycarbonate or clear roof (over a side path, a patio or a yard), a shade sail, a shed, and the roof of any neighbouring house that touches this one. Box each whole, tightly round it, and never include the house's own solid roof in one.
Give a tight box for each, on the 0–1000 scale of the whole image, round the thing itself and no more. Only include what you can actually see; if the roof is clear, return an empty list. Ignore cars, the yard and neighbouring houses.`;

export async function checkObstructions(
  image: { data: ArrayBuffer; mediaType: "image/jpeg" | "image/png" },
  roofBox: [number, number, number, number],
  apiKey: string,
  options: ReadOptions = {},
): Promise<ObstructionCheck> {
  const files: Anthropic.Beta.BetaContentBlockParam[] = [
    { type: "image", source: { type: "base64", media_type: image.mediaType, data: Buffer.from(image.data).toString("base64") } },
  ];
  const raw = await readWithClaude<unknown>(files, SCHEMA, prompt(roofBox), apiKey, options);
  return {
    items: cleanObstructions(raw),
    structures: cleanObstructions({
      obstructions: ((raw as { structures?: unknown[] }).structures ?? []).map((s) => ({ ...(s as object), type: "other" })),
    }).map(({ box, note }) => ({ box, ...(note ? { note } : {}) })),
    summary: plainText((raw as { summary?: unknown }).summary, 200),
    checkedAt: new Date().toISOString(),
  };
}
