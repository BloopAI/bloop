export const mapShortcuts = (shortcut?: string[], osType?: string) => {
  return shortcut?.map((k) => {
    switch (k) {
      case 'option':
        return osType === 'Darwin' ? '⌥' : 'Alt';
      case 'entr':
        return '↵';
      case 'cmd':
        return osType === 'Darwin' ? '⌘' : 'Ctrl';
      case 'bksp':
        return '⌫';
      case 'shift':
        return '⇧';
      default:
        return k;
    }
  });
};

export const checkEventKeys = (e: KeyboardEvent, shortcut?: string[]) => {
  if (!shortcut) {
    return false;
  }
  const keys = shortcut.map((k) => k.toLowerCase());
  if (
    (keys.includes('cmd') && !(e.metaKey || e.ctrlKey)) ||
    (!keys.includes('cmd') && (e.metaKey || e.ctrlKey))
  ) {
    return false;
  }
  if (
    (keys.includes('shift') && !e.shiftKey) ||
    (!keys.includes('shift') && e.shiftKey)
  ) {
    return false;
  }
  if (
    (keys.includes('option') && !e.altKey) ||
    (!keys.includes('option') && e.altKey)
  ) {
    return false;
  }
  if (e.key === 'Enter' && keys.includes('entr')) {
    return true;
  }
  if (e.key === 'Backspace' && keys.includes('bksp')) {
    return true;
  }
  if (e.key === 'Escape' && keys.includes('esc')) {
    return true;
  }
  if (!keys.includes(e.key)) {
    if (
      (e.altKey &&
        keys.includes(
          e.code.replace('Key', '').replace('Digit', '').toLowerCase(),
        )) ||
      (e.shiftKey && keys.includes(e.code.replace('Digit', '').toLowerCase()))
    ) {
      return true;
    }
    if (e.key === '=' && keys.includes('+')) {
      return true;
    }
    return false;
  }
  return true;
};
