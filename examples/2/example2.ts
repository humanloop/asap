export interface Thing {
  id: number;
  name: string;
}

/**
 * Gets the thing with id `id` from `things`.
 */
export const getThing = (id: number, things: Thing[]): Thing | undefined => {
  return things.find((x) => x.id == id);
};
