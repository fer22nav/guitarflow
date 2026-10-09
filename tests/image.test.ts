import { it, expect } from "vitest";
import { textFromLines } from "../src/core/ImageImport";
it("la extracción mantiene posiciones relativas sin completar notas ausentes", () => {
  const symbols = [
    ["e", 0],
    ["|", 10],
    ["1", 60],
    ["2", 70],
    ["b", 80],
    ["1", 90],
    ["5", 100],
  ] as const;
  const line = {
    text: "e|12b15",
    bbox: { x0: 0, y0: 0, x1: 108, y1: 20 },
    words: [
      {
        symbols: symbols.map(([text, x]) => ({
          text,
          bbox: { x0: x, y0: 0, x1: x + 8, y1: 20 },
          confidence: 99,
        })),
        text: "e|12b15",
        bbox: { x0: 0, y0: 0, x1: 108, y1: 20 },
        confidence: 99,
        choices: [],
        font_name: "",
      },
    ],
  };
  expect(textFromLines([line])).toBe("e|    12b15");
});
