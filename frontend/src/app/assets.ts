/** Turn a catalog path such as "characters/sophie/world/idle.png" into a loadable URL. */
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}assets/${path}`;
}
