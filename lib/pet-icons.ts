/**
 * Pet icon defaults.
 *
 * Stock icons live in R2 under `stock/` and are referenced by KEY only
 * (e.g. 'stock/dog-01.png'). They are pre-uploaded outside this task and are
 * not managed by the documents API.
 */

export const STOCK_ICON_CAT = "stock/cat-default.png";
export const STOCK_ICON_DOG = "stock/dog-default.png";
export const STOCK_ICON_PET = "stock/pet-default.png";

/** Default stock icon key for a given pet type. */
export function defaultIconKey(type: string): string {
  switch (type) {
    case "cat":
      return STOCK_ICON_CAT;
    case "dog":
      return STOCK_ICON_DOG;
    default:
      return STOCK_ICON_PET;
  }
}
