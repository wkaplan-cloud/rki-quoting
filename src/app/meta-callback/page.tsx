'use client';

import { useEffect, useState } from 'react';

export default function MetaCallback() {
  const [href, setHref] = useState('');

  useEffect(() => {
    setHref(window.location.href);
  }, []);

  return (
    <>
      <h1>Meta Callback</h1>
      <pre id="out">{href}</pre>
    </>
  );
}
