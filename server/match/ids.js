/** Match-local identifiers shared by ores, mobs, crates and items. */
export class IdSequence {
  constructor(start = 1) { this.value = start; }

  next() { return this.value++; }
}
