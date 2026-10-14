import { useEffect, useState } from 'react';

/** Delays a fast-changing value (typing) so we don't fire a request per keystroke. */
export default function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
