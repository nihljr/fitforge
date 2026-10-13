import type { Exercise, Profile } from '@/lib/supabase/client';

export type SplitType = 'push_pull_legs' | 'upper_lower' | 'full_body' | 'bro_split' | 'custom';

export type GeneratedWorkoutDay = {
  day_label: string;
  day_of_week: number;
  exercises: GeneratedExercise[];
};

export type GeneratedExercise = {
  exercise_name: string;
  muscle_group: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  suggested_weight: number | null;
  order_index: number;
  instructions: string;
  is_warmup: boolean;
  is_cooldown: boolean;
};

export const splitOptions: { id: SplitType; label: string; description: string }[] = [
  { id: 'push_pull_legs', label: 'Push / Pull / Legs', description: '6-day split — push, pull, legs, repeat' },
  { id: 'upper_lower', label: 'Upper / Lower', description: '4-day split — alternate upper and lower body' },
  { id: 'full_body', label: 'Full Body', description: '3-day split — train all muscles each session' },
  { id: 'bro_split', label: 'Bro Split', description: '5-day split — one muscle group per day' },
  { id: 'custom', label: 'Custom', description: 'Build your own workout from scratch' },
];

function filterByEquipment(exercises: Exercise[], equipment: string): Exercise[] {
  if (equipment === 'full_gym') return exercises;
  if (equipment === 'dumbbells') {
    return exercises.filter((e) => e.equipment === 'dumbbells' || e.equipment === 'bodyweight');
  }
  return exercises.filter((e) => e.equipment === 'bodyweight');
}

function filterByDifficulty(exercises: Exercise[], level: string): Exercise[] {
  if (level === 'beginner') {
    return exercises.filter((e) => e.difficulty === 'beginner');
  }
  if (level === 'intermediate') {
    return exercises.filter((e) => e.difficulty === 'beginner' || e.difficulty === 'intermediate');
  }
  return exercises;
}

function pickExercises(pool: Exercise[], count: number, exclude: string[] = []): Exercise[] {
  const filtered = pool.filter((e) => !exclude.includes(e.name));
  const shuffled = [...filtered].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function exerciseToGenerated(ex: Exercise, index: number, goal: string): GeneratedExercise {
  let sets = ex.default_sets;
  let reps = ex.default_reps;
  let rest = ex.rest_seconds;

  // Adjust based on goal
  if (goal === 'strength') {
    sets = 5;
    reps = '3-6';
    rest = 180;
  } else if (goal === 'muscle_gain') {
    sets = 4;
    reps = '6-12';
    rest = 90;
  } else if (goal === 'fat_loss') {
    sets = 3;
    reps = '12-20';
    rest = 45;
  }

  // Suggested starting weights based on experience
  let suggestedWeight: number | null = null;
  if (ex.equipment !== 'bodyweight') {
    const baseWeights: Record<string, [number, number, number]> = {
      beginner: [20, 30, 15],
      intermediate: [40, 60, 25],
      advanced: [60, 80, 40],
    };
    // This is just a suggestion - will be overridden by actual logged data
    suggestedWeight = null;
    void baseWeights;
  }

  return {
    exercise_name: ex.name,
    muscle_group: ex.muscle_group,
    sets,
    reps,
    rest_seconds: rest,
    suggested_weight: suggestedWeight,
    order_index: index,
    instructions: ex.instructions,
    is_warmup: false,
    is_cooldown: false,
  };
}

function warmupExercise(): GeneratedExercise {
  return {
    exercise_name: 'Dynamic Warm-Up',
    muscle_group: 'full body',
    sets: 1,
    reps: '5-10 min',
    rest_seconds: 0,
    suggested_weight: null,
    order_index: 0,
    instructions: 'Arm circles, leg swings, hip rotations, light jogging in place, and dynamic stretching to prepare for the workout.',
    is_warmup: true,
    is_cooldown: false,
  };
}

function cooldownExercise(): GeneratedExercise {
  return {
    exercise_name: 'Static Stretching',
    muscle_group: 'full body',
    sets: 1,
    reps: '5-10 min',
    rest_seconds: 0,
    suggested_weight: null,
    order_index: 99,
    instructions: 'Hold stretches for 30 seconds each: chest, lats, hamstrings, quads, and shoulders. Focus on areas trained today.',
    is_warmup: false,
    is_cooldown: true,
  };
}

export function generateWorkoutPlan(
  profile: Profile,
  exercises: Exercise[],
  splitType: SplitType,
): GeneratedWorkoutDay[] {
  const pool = filterByDifficulty(filterByEquipment(exercises, profile.available_equipment), profile.experience_level);
  const goal = profile.fitness_goal;
  const duration = profile.preferred_duration_min;

  // Estimate how many exercises fit in the duration (roughly 6-8 min per exercise including rest)
  const maxExercises = Math.max(3, Math.min(7, Math.floor(duration / 8)));

  const days: GeneratedWorkoutDay[] = [];

  const pushMuscles = ['chest', 'shoulders', 'arms'];
  const pullMuscles = ['back', 'arms'];
  const legMuscles = ['legs', 'core'];

  if (splitType === 'full_body') {
    const dayCount = Math.min(profile.training_days_per_week, 4);
    const labels = ['Day 1 — Full Body A', 'Day 2 — Full Body B', 'Day 3 — Full Body A', 'Day 4 — Full Body B'];

    for (let i = 0; i < dayCount; i++) {
      const isVariantA = i % 2 === 0;
      const compoundPick = isVariantA
        ? ['Barbell Bench Press', 'Barbell Squat', 'Bent-Over Barbell Row']
        : ['Overhead Press', 'Romanian Deadlift', 'Dumbbell Bench Press'];
      const compound = pool.filter((e) => compoundPick.includes(e.name));
      const remaining = pickExercises(pool.filter((e) => !compoundPick.includes(e.name)), maxExercises - compound.length);
      const selected = [...compound, ...remaining];

      const exs = [warmupExercise(), ...selected.map((e, idx) => exerciseToGenerated(e, idx + 1, goal)), cooldownExercise()];
      days.push({ day_label: labels[i] || `Day ${i + 1}`, day_of_week: i, exercises: exs });
    }
  } else if (splitType === 'upper_lower') {
    const labels = ['Day 1 — Upper', 'Day 2 — Lower', 'Day 3 — Upper', 'Day 4 — Lower'];
    const dayCount = Math.min(profile.training_days_per_week, 4);

    for (let i = 0; i < dayCount; i++) {
      const isUpper = i % 2 === 0;
      const muscleFilter = isUpper ? pushMuscles.concat(pullMuscles) : legMuscles;
      const filtered = pool.filter((e) => muscleFilter.includes(e.muscle_group));
      const selected = pickExercises(filtered, maxExercises);

      const exs = [warmupExercise(), ...selected.map((e, idx) => exerciseToGenerated(e, idx + 1, goal)), cooldownExercise()];
      days.push({ day_label: labels[i] || `Day ${i + 1}`, day_of_week: i, exercises: exs });
    }
  } else if (splitType === 'push_pull_legs') {
    const labels = ['Day 1 — Push', 'Day 2 — Pull', 'Day 3 — Legs', 'Day 4 — Push', 'Day 5 — Pull', 'Day 6 — Legs'];
    const dayCount = Math.min(profile.training_days_per_week, 6);

    for (let i = 0; i < dayCount; i++) {
      const phase = i % 3;
      const muscleFilter = phase === 0 ? pushMuscles : phase === 1 ? pullMuscles : legMuscles;
      const filtered = pool.filter((e) => muscleFilter.includes(e.muscle_group));
      const selected = pickExercises(filtered, maxExercises);

      const exs = [warmupExercise(), ...selected.map((e, idx) => exerciseToGenerated(e, idx + 1, goal)), cooldownExercise()];
      days.push({ day_label: labels[i] || `Day ${i + 1}`, day_of_week: i, exercises: exs });
    }
  } else if (splitType === 'bro_split') {
    const musclePerDay = ['chest', 'back', 'legs', 'shoulders', 'arms'];
    const labels = ['Day 1 — Chest', 'Day 2 — Back', 'Day 3 — Legs', 'Day 4 — Shoulders', 'Day 5 — Arms'];
    const dayCount = Math.min(profile.training_days_per_week, 5);

    for (let i = 0; i < dayCount; i++) {
      const targetMuscle = musclePerDay[i % musclePerDay.length];
      const filtered = pool.filter((e) => e.muscle_group === targetMuscle || e.secondary_muscles?.includes(targetMuscle));
      const selected = pickExercises(filtered, maxExercises);

      const exs = [warmupExercise(), ...selected.map((e, idx) => exerciseToGenerated(e, idx + 1, goal)), cooldownExercise()];
      days.push({ day_label: labels[i] || `Day ${i + 1}`, day_of_week: i, exercises: exs });
    }
  }

  return days;
}

export function estimate1RM(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  // Epley formula
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function calculateVolume(sets: { weight_kg: number; reps: number }[]): number {
  return sets.reduce((total, s) => total + s.weight_kg * s.reps, 0);
}
