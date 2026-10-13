/*
# SmartFit AI — Core Database Schema

1. Overview
This migration creates the complete data model for SmartFit AI, a personal trainer app.
All tables are user-scoped with RLS policies ensuring users only access their own data.

2. New Tables
- `profiles` — extends auth.users with fitness profile data (age, height, weight, goals, experience, etc.)
- `workout_plans` — user's training plans (split type, days, duration)
- `planned_exercises` — exercises within a workout plan
- `workout_sessions` — completed workout records
- `workout_sets` — individual sets logged during a session
- `body_measurements` — weight and body measurement history
- `personal_records` — PRs tracked per exercise
- `ai_conversations` — AI coach chat history
- `exercise_library` — shared exercise reference data (read-only, seeded)

3. Security
- RLS enabled on all tables.
- Owner-scoped CRUD policies on all user tables (select/insert/update/delete per table).
- exercise_library is readable by all (shared reference data) but only writable via service role.
- All owner columns default to auth.uid().
*/

-- ====================
-- PROFILES TABLE
-- ====================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text NOT NULL DEFAULT '',
  age integer,
  height_cm numeric,
  weight_kg numeric,
  fitness_goal text DEFAULT 'general_fitness',
  experience_level text DEFAULT 'beginner',
  training_days_per_week integer DEFAULT 3,
  preferred_duration_min integer DEFAULT 60,
  available_equipment text DEFAULT 'full_gym',
  target_muscle_groups text[] DEFAULT '{}',
  dietary_preferences text DEFAULT '',
  onboarding_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- ====================
-- EXERCISE LIBRARY (shared reference data)
-- ====================
CREATE TABLE IF NOT EXISTS exercise_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  muscle_group text NOT NULL,
  secondary_muscles text[] DEFAULT '{}',
  equipment text NOT NULL DEFAULT 'bodyweight',
  difficulty text NOT NULL DEFAULT 'beginner',
  instructions text NOT NULL DEFAULT '',
  default_sets integer DEFAULT 3,
  default_reps text DEFAULT '8-12',
  rest_seconds integer DEFAULT 90,
  substitutions text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE exercise_library ENABLE ROW LEVEL SECURITY;

-- Readable by all authenticated users (shared reference)
DROP POLICY IF EXISTS "read_exercise_library" ON exercise_library;
CREATE POLICY "read_exercise_library" ON exercise_library FOR SELECT
  TO authenticated USING (true);

-- ====================
-- WORKOUT PLANS TABLE
-- ====================
CREATE TABLE IF NOT EXISTS workout_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'My Workout Plan',
  split_type text NOT NULL DEFAULT 'full_body',
  days_per_week integer DEFAULT 3,
  duration_min integer DEFAULT 60,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE workout_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_plans" ON workout_plans;
CREATE POLICY "select_own_plans" ON workout_plans FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_plans" ON workout_plans;
CREATE POLICY "insert_own_plans" ON workout_plans FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_plans" ON workout_plans;
CREATE POLICY "update_own_plans" ON workout_plans FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_plans" ON workout_plans;
CREATE POLICY "delete_own_plans" ON workout_plans FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ====================
-- PLANNED EXERCISES TABLE
-- ====================
CREATE TABLE IF NOT EXISTS planned_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week integer DEFAULT 0,
  day_label text DEFAULT 'Day 1',
  exercise_name text NOT NULL,
  muscle_group text NOT NULL,
  sets integer DEFAULT 3,
  reps text DEFAULT '8-12',
  rest_seconds integer DEFAULT 90,
  suggested_weight numeric,
  order_index integer DEFAULT 0,
  instructions text DEFAULT '',
  is_warmup boolean DEFAULT false,
  is_cooldown boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE planned_exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_planned_exercises" ON planned_exercises;
CREATE POLICY "select_own_planned_exercises" ON planned_exercises FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_planned_exercises" ON planned_exercises;
CREATE POLICY "insert_own_planned_exercises" ON planned_exercises FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_planned_exercises" ON planned_exercises;
CREATE POLICY "update_own_planned_exercises" ON planned_exercises FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_planned_exercises" ON planned_exercises;
CREATE POLICY "delete_own_planned_exercises" ON planned_exercises FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ====================
-- WORKOUT SESSIONS TABLE
-- ====================
CREATE TABLE IF NOT EXISTS workout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES workout_plans(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT 'Workout',
  split_type text DEFAULT 'full_body',
  total_exercises integer DEFAULT 0,
  completed_sets integer DEFAULT 0,
  total_sets integer DEFAULT 0,
  duration_seconds integer DEFAULT 0,
  volume_kg numeric DEFAULT 0,
  pr_count integer DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_sessions" ON workout_sessions;
CREATE POLICY "select_own_sessions" ON workout_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_sessions" ON workout_sessions;
CREATE POLICY "insert_own_sessions" ON workout_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_sessions" ON workout_sessions;
CREATE POLICY "update_own_sessions" ON workout_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_sessions" ON workout_sessions;
CREATE POLICY "delete_own_sessions" ON workout_sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ====================
-- WORKOUT SETS TABLE
-- ====================
CREATE TABLE IF NOT EXISTS workout_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_name text NOT NULL,
  muscle_group text DEFAULT '',
  set_number integer NOT NULL,
  reps integer DEFAULT 0,
  weight_kg numeric DEFAULT 0,
  completed boolean DEFAULT false,
  is_pr boolean DEFAULT false,
  rest_seconds integer DEFAULT 90,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_sets" ON workout_sets;
CREATE POLICY "select_own_sets" ON workout_sets FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_sets" ON workout_sets;
CREATE POLICY "insert_own_sets" ON workout_sets FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_sets" ON workout_sets;
CREATE POLICY "update_own_sets" ON workout_sets FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_sets" ON workout_sets;
CREATE POLICY "delete_own_sets" ON workout_sets FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ====================
-- BODY MEASUREMENTS TABLE
-- ====================
CREATE TABLE IF NOT EXISTS body_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_kg numeric,
  body_fat_pct numeric,
  chest_cm numeric,
  waist_cm numeric,
  arm_cm numeric,
  thigh_cm numeric,
  notes text DEFAULT '',
  recorded_at date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_measurements" ON body_measurements;
CREATE POLICY "select_own_measurements" ON body_measurements FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_measurements" ON body_measurements;
CREATE POLICY "insert_own_measurements" ON body_measurements FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_measurements" ON body_measurements;
CREATE POLICY "update_own_measurements" ON body_measurements FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_measurements" ON body_measurements;
CREATE POLICY "delete_own_measurements" ON body_measurements FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ====================
-- PERSONAL RECORDS TABLE
-- ====================
CREATE TABLE IF NOT EXISTS personal_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_name text NOT NULL,
  record_type text NOT NULL DEFAULT 'weight',
  weight_kg numeric DEFAULT 0,
  reps integer DEFAULT 0,
  estimated_1rm numeric DEFAULT 0,
  achieved_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_prs" ON personal_records;
CREATE POLICY "select_own_prs" ON personal_records FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_prs" ON personal_records;
CREATE POLICY "insert_own_prs" ON personal_records FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_prs" ON personal_records;
CREATE POLICY "update_own_prs" ON personal_records FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_prs" ON personal_records;
CREATE POLICY "delete_own_prs" ON personal_records FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ====================
-- AI CONVERSATIONS TABLE
-- ====================
CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_conversations" ON ai_conversations;
CREATE POLICY "select_own_conversations" ON ai_conversations FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_conversations" ON ai_conversations;
CREATE POLICY "insert_own_conversations" ON ai_conversations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_conversations" ON ai_conversations;
CREATE POLICY "delete_own_conversations" ON ai_conversations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ====================
-- INDEXES
-- ====================
CREATE INDEX IF NOT EXISTS idx_planned_exercises_plan_id ON planned_exercises(plan_id);
CREATE INDEX IF NOT EXISTS idx_workout_sets_session_id ON workout_sets(session_id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_id ON workout_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_completed ON workout_sessions(user_id, completed_at);
CREATE INDEX IF NOT EXISTS idx_body_measurements_user_id ON body_measurements(user_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_personal_records_user_id ON personal_records(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_exercise_library_muscle ON exercise_library(muscle_group);
CREATE INDEX IF NOT EXISTS idx_exercise_library_equipment ON exercise_library(equipment);
