import { useEffect, useState } from 'react';

/** Tailwind's `lg` breakpoint — at and above this width the desktop 60/40 split is shown. */
export const DESKTOP_QUERY = '(min-width: 1024px)';

function matches(query) {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : true;
}

/** Live boolean for a CSS media query; re-renders when the viewport crosses it. */
export function useMediaQuery(query) {
  const [value, setValue] = useState(() => matches(query));
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mql = window.matchMedia(query);
    const onChange = () => setValue(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return value;
}

export function useIsDesktop() {
  return useMediaQuery(DESKTOP_QUERY);
}
