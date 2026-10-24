/**
 * The wire protocol's gameplay actions, mapped to match commands. This is the
 * one place a client message meets the simulation: Room dispatches through it,
 * and Tutorial gates the same actions before running them on its Game.
 *
 * Adding a command means adding a Game method and one row here.
 */
export const COMMANDS = {
  mode: (game, slot, a) => game.setMode(slot, a.mode),
  gather: (game, slot, a) => game.gather(slot, a.id),
  progress: (game, slot, a) => game.progress(slot, a.id, a.wi, a.typed),
  hit: (game, slot, a) => game.hitMob(slot, a.id, a.wi),
  miss: (game, slot) => game.miss(slot),
  buy: (game, slot, a) => game.buy(slot, String(a.item)),
  ult: (game, slot) => game.ultimate(slot),
  dropProgress: (game, slot, a) => game.claimProgress(slot, a.id, a.typed),
  claim: (game, slot, a) => game.claim(slot, a.id),
  use: (game, slot, a) => game.useItem(slot, a.id),
};

export const isCommand = (action) => Object.hasOwn(COMMANDS, action?.t);

/** Runs `action` on `game`; unknown actions do nothing. */
export function runCommand(game, slot, action) {
  return isCommand(action) ? COMMANDS[action.t](game, slot, action) : undefined;
}
