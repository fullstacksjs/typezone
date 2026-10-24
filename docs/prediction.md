# Shared purchase rules

`shared/shop.js` owns pricing, legality and predictable player changes. Its interface accepts either server players or snapshot players. Callers supply ended, sudden-death and tutorial context. `Game` retains spawning, opponent effects, statistics and events. Bot preferences and tile artwork remain in their callers. Charge progress stays in base recharge seconds on the server, so Drill Sergeant preserves its percentage.

`ShopPrediction` receives an authoritative snapshot before purchases. Its `buy` interface requires an increasing match-local sequence. It replays only purchases beyond the snapshot's processed watermark. This ordering invariant prevents duplicate deductions and prevents earlier frames from erasing pending purchases. The server remains authoritative over acceptance.

Room snapshots add `processed: {p1, p2}` and `winner`. Sequenced actions at or below the watermark are ignored; legacy actions without sequences remain supported. Watermarks reset on match start. All clients and the server must be deployed together for reliable prediction correction.

Each purchasable is an `Offer` subclass in `OFFERS`: `cost`, `cooldown` and `ready` decide legality, `predict` applies shared player changes, and `resolve` applies server effects through `Game.sendMob` / `castSpell`. Adding a spell or upgrade means adding one offer plus its config. `purchase`, `itemCost` and `applyPurchase` remain the call-site interface. Upgrades also expose their derived stats (`PICKAXE.multiplier`, `LUCK.odds`, `DRILL.recharge`), so no caller recomputes level math.

The module's depth hides purchase knowledge behind a small interface. This gives locality to rule changes and leverage to the match, bot, input handler and tiles. No adapter abstraction is needed for these in-process rules.

`shared/items.js` owns claim eligibility and item use. Each `ItemKind` in `ITEM_KINDS` supplies its `usable` conditions and `apply` effect. `ShopPrediction.use` replays item uses alongside purchases under the same watermark. The Heal effect is predicted, so HP rises immediately.

# Typing view

`TypingState.receive(snapshot)` reconciles pending completions using the same processed watermark. `type(character, sequence)` returns an optional wire action and local feedback, while `setMode` predicts a mode until processing is confirmed. `drop` releases only the current lock. Construct a new state on countdown, match start, end, disconnect or exit.

The `view` interface supplies a coherent snapshot, mode and lock. Pending ores and defeated mobs are absent, and armored mobs expose their predicted word index. HUD, canvas and tutorial consume that view without interpreting pending ID collections. Earlier frames retain predictions. A processed rejection restores the authoritative target. Lightning, removed targets and corrected modes invalidate incompatible locks. Geometry, interpolation, sound and particles stay outside the module. Confirmed kill events carry a local `predicted` marker to avoid repeating the responsive burst.

In Fight mode the airdrop word takes priority over mobs that share its first letter. Spawned words avoid that letter. A pending claim hides the crate. When the opponent wins the race, the next frame has no crate, and the lock is released.

The module includes target priority, pending actions and reconciliation behind one interface. That depth gives callers leverage without exposing a second representation of hidden targets. Game and Tutorial remain adapters at Room's existing match seam.
