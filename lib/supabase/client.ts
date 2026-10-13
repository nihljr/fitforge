import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type Profile = {
  id: string;
  email: string | null;
  full_name: string;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  fitness_goal: string;
  experience_level: string;
  training_days_per_week: number;
  preferred_duration_min: number;
  available_equipment: string;
  target_muscle_groups: string[];
  dietary_preferences: string;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
};

export type Exercise = {
  id: string;
  name: string;
  muscle_group: string;
  secondary_muscles: string[];
  equipment: string;
  difficulty: string;
  instructions: string;
  default_sets: number;
  default_reps: string;
  rest_seconds: number;
  substitutions: string[];
};

export type WorkoutPlan = {
  id: string;
  user_id: string;
  name: string;
  split_type: string;
  days_per_week: number;
  duration_min: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PlannedExercise = {
  id: string;
  plan_id: string;
  user_id: string;
  day_of_week: number;
  day_label: string;
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

export type WorkoutSession = {
  id: string;
  user_id: string;
  plan_id: string | null;
  name: string;
  split_type: string;
  total_exercises: number;
  completed_sets: number;
  total_sets: number;
  duration_seconds: number;
  volume_kg: number;
  pr_count: number;
  started_at: string;
  completed_at: string | null;
};

export type WorkoutSet = {
  id: string;
  session_id: string;
  user_id: string;
  exercise_name: string;
  muscle_group: string;
  set_number: number;
  reps: number;
  weight_kg: number;
  completed: boolean;
  is_pr: boolean;
  rest_seconds: number;
  created_at: string;
};

export type BodyMeasurement = {
  id: string;
  user_id: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  notes: string;
  recorded_at: string;
};

export type PersonalRecord = {
  id: string;
  user_id: string;
  exercise_name: string;
  record_type: string;
  weight_kg: number;
  reps: number;
  estimated_1rm: number;
  achieved_at: string;
};

export type AiConversation = {
  id: string;
  user_id: string;
  role: string;
  content: string;
  created_at: string;
};
