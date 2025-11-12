'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/admin/me');
        if (response.ok) {
          router.push('/Dashboard');
        } else {
          router.push('/AdminLogin');
        }
      } catch (error) {
        router.push('/AdminLogin');
      }
    };
    checkAuth();
  }, [router]);

  return <div>Loading...</div>;
}
