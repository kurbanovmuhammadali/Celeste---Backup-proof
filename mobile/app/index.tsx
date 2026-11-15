import React, { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/auth';
import { PageSkeleton } from '@/kit/ui';
import { getFlag } from '@/storage';

export default function Index() {
  const { user, ready } = useAuth();
  const [introSeen, setIntroSeen] = useState<boolean | null>(null);
  useEffect(() => { getFlag('introSeen').then(setIntroSeen); }, []);
  if (!ready || introSeen === null) return <PageSkeleton tabs={false} />;
  if (user) return <Redirect href="/today" />;
  return <Redirect href={introSeen ? '/welcome' : '/intro'} />;
}
