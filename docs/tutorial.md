# Tutorial policy and completion

`shared/tutorial-policy.js` owns the shipped lesson definitions and the `tutorialPolicy(lesson, mode, slot)` interface. Its `allows(action)`, `guidance` and `complete` decisions serve authoritative enforcement, browser input, shared shop legality and the overlay. The predicted mode determines whether upgrade guidance asks for Tab or Pickaxe. Unknown lessons fail closed. Tutorial progression and resource grants remain in `Tutorial`, after successful real match actions.

The module includes lesson meaning and permissions. Its depth removes repeated lesson-ID branches from input, shop tiles and guidance, giving locality to permission changes and leverage to both server and browser. Game and Tutorial remain the two adapters at Room's match seam. DOM and canvas anchor measurement remain local to the overlay and renderer, with no new adapter abstraction.

Completion means the `done` lesson. Simulation stops, gameplay permissions close, and the browser retains the final battlefield with easy-practice and lobby choices. Room remains playing and broadcasts at the existing 20 Hz cadence. There is no win/loss event. The tutorial snapshot retains its existing fields and adds the anchor description from the shared lesson definition.

Countdown, match start, end, disconnect and room exit discard client prediction. Socket callbacks ignore replaced connections. Leaving cancels server countdown and match timers when the last human exits. Easy practice uses a fresh room, match-local sequence and unrestricted Game instance.
