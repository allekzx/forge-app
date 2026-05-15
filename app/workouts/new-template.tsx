import { useEffect } from 'react';

import { useRouter } from 'expo-router';

import { initDatabase, createWorkoutTemplate } from '@/services/DatabaseService';

export default function NewWorkoutTemplateScreen() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      await initDatabase();
      const id = await createWorkoutTemplate();
      router.replace({ pathname: '/workouts/template', params: { templateId: id } });
    };

    run();
  }, [router]);

  return null;
}

