# Shared purchase rules

`shared/shop.js` owns pricing, legality and predictable player changes. Its interface accepts either server players or snapshot players. Callers supply ended, sudden-death and tutorial context. `Game` retains spawning, opponent effects, statistics and events. Bot preferences and tile artwork remain in their callers. Charge progress stays in base recharge seconds on the server, so Drill Sergeant preserves its percentage.

`ShopPrediction` receives an authoritative snapshot before purchases. Its `buy` interface requires an increasing match-local sequence. It replays only purchases beyond the snapshot's processed watermark. This ordering invariant prevents duplicate deductions and prevents earlier frames from erasing pending purchases. The server remains authoritative over acceptance.

Room snapshots add `processed: {p1, p2}` and `winner`. Sequenced actions at or below the watermark are ignored; legacy actions without sequences remain supported. Watermarks reset on match start. All clients and the server must be deployed together for reliable prediction correction.

The module's depth hides purchase knowledge behind a small interface. This gives locality to rule changes and leverage to the match, bot, input handler and tiles. No adapter abstraction is needed for these in-process rules.
