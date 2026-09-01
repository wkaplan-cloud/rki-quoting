'use client';

import { useEffect, useState } from 'react';

export default function MetaCallback() {
  const [href, setHref] = useState('');

  useEffect(() => {
    // Reads the credentials the auth provider left in the URL, which only exist in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHref(window.location.href);
  }, []);

  return (
    <>
      <h1>Meta Callback</h1>
      <pre id="out">{href}</pre>
    </>
  );
}
