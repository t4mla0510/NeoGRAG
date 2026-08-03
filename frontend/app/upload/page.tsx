'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Upload() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/files');
  }, [router]);

  return null;
}
