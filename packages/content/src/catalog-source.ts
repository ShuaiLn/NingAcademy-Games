import { RAW_SURVIVOR_CARDS_001_040 } from "./catalog-source-s001-s040.js";
import { RAW_SURVIVOR_CARDS_041_080 } from "./catalog-source-s041-s080.js";
import { RAW_SURVIVOR_CARDS_081_120 } from "./catalog-source-s081-s120.js";
import { RAW_SURVIVOR_CARDS_121_160 } from "./catalog-source-s121-s160.js";
import { RAW_ZOMBIE_CARDS_001_050 } from "./catalog-source-z001-z050.js";
import { RAW_ZOMBIE_CARDS_051_100 } from "./catalog-source-z051-z100.js";

export interface RawCatalogCard {
  readonly id: string;
  readonly rarity: string;
  readonly name: string;
  readonly description: string;
  readonly limit: string;
}

// Faithful machine-readable transcription of card_catalog_v1_draft. Source
// Chinese values remain immutable; normalized presentation is compiled later.
export const RAW_CARD_CATALOG: readonly RawCatalogCard[] = Object.freeze([
  ...RAW_SURVIVOR_CARDS_001_040,
  ...RAW_SURVIVOR_CARDS_041_080,
  ...RAW_SURVIVOR_CARDS_081_120,
  ...RAW_SURVIVOR_CARDS_121_160,
  ...RAW_ZOMBIE_CARDS_001_050,
  ...RAW_ZOMBIE_CARDS_051_100,
]);
