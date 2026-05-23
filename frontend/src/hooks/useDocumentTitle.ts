import { useEffect } from 'react';

/**
 * Sets the browser document title to CodeRipple | {title}
 */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `CodeRipple | ${title}`;
  }, [title]);
}
