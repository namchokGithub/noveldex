import { expect, it } from "vitest";

import { volumeTitlePayload } from "./VolumeTitleEditor";

it("trims bilingual titles and clears an empty source image URL", () => {
  expect(
    volumeTitlePayload("  Volume One  ", " เล่มหนึ่ง ", "   "),
  ).toEqual({
    title_en: "Volume One",
    title_th: "เล่มหนึ่ง",
    source_img_url: null,
  });
});
