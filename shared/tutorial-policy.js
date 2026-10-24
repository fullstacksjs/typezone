const LESSONS = [
  { id: 'mine', title: 'Type an ore word', key: 'A–Z', anchor: 'ore' },
  { id: 'send', title: 'Send a goblin', key: '1', item: 'goblin', cue: 'Send', anchor: 'control' },
  { id: 'switch', title: 'Switch to Fight', key: 'Tab', focus: 'mode-key', cue: 'Fight', anchor: 'control' },
  { id: 'defend', title: 'Type the enemy word', key: 'A–Z', anchor: 'enemy' },
  { id: 'lightning', title: 'Fire Lightning', key: 'Enter', focus: 'ult', cue: 'Fire', anchor: 'control' },
  { id: 'upgrade', title: 'Upgrade your Pickaxe', key: '8', item: 'pickaxe', cue: '+25% gold', anchor: 'control' },
  { id: 'done', title: 'You are ready to play', anchor: 'complete' },
];

export function lessonAt(step) {
  return { ...LESSONS[step], step: step + 1, total: LESSONS.length - 1 };
}

/** Shared lesson meaning. Progression and resource grants stay authoritative. */
export function tutorialPolicy(lesson, mode, slot = 'p1') {
  const definition = lesson && LESSONS.find((step) => step.id === lesson.id);
  const complete = definition?.id === 'done';
  const gatherFirst = definition?.id === 'upgrade' && mode !== 'gather';
  const guidance = !definition ? null : gatherFirst
    ? { anchor: 'control', focus: 'mode-key', title: 'Back to Gather', key: 'Tab', verb: 'Press' }
    : { ...definition, verb: definition.item ? 'Click or press' : definition.anchor === 'ore' || definition.anchor === 'enemy' ? 'Type' : 'Press' };
  return {
    complete,
    guidance,
    allows(action) {
      if (!lesson) return true;
      if (!definition || slot !== 'p1' || complete) return false;
      switch (action.t) {
        case 'type': case 'miss': return (definition.id === 'mine' && mode === 'gather') || (definition.id === 'defend' && mode === 'fight');
        case 'gather': return definition.id === 'mine' && mode === 'gather';
        case 'hit': case 'progress': return definition.id === 'defend' && mode === 'fight';
        case 'mode': return (definition.id === 'switch' && action.mode === 'fight') || (definition.id === 'upgrade' && action.mode === 'gather');
        case 'buy': return definition.item === action.item && !gatherFirst;
        case 'ult': return definition.id === 'lightning';
        default: return false;
      }
    },
  };
}
