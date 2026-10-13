'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/app-shell';
import { supabase, type Exercise, type WorkoutPlan, type PlannedExercise, type WorkoutSet } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Dumbbell,
  Play,
  Plus,
  RefreshCw,
  Clock,
  Timer,
  Check,
  ChevronLeft,
  ChevronRight,
  X,
  Pause,
  SkipForward,
  ArrowUp,
  ArrowDown,
  Trophy,
  Loader2,
  Layers,
  Zap,
  TrendingUp,
  Minus,
} from 'lucide-react';
import { generateWorkoutPlan, splitOptions, type SplitType, type GeneratedWorkoutDay } from '@/lib/workout-generator';
import { cn } from '@/lib/utils';

type WorkoutMode = 'plan' | 'live' | 'summary';
type LiveExercise = {
  name: string;
  muscle_group: string;
  sets: { reps: number; weight: number; completed: boolean; is_pr: boolean }[];
  rest_seconds: number;
  instructions: string;
};

export default function WorkoutPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [plannedExercises, setPlannedExercises] = useState<PlannedExercise[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [mode, setMode] = useState<WorkoutMode>('plan');
  const [selectedSplit, setSelectedSplit] = useState<SplitType>('full_body');
  const [generatedDays, setGeneratedDays] = useState<GeneratedWorkoutDay[]>([]);
  const [activeDay, setActiveDay] = useState(0);
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Live workout state
  const [liveExercises, setLiveExercises] = useState<LiveExercise[]>([]);
  const [currentExerciseIdx, setCurrentExerciseIdx] = useState(0);
  const [workoutStartTime, setWorkoutStartTime] = useState<number>(0);
  const [workoutPaused, setWorkoutPaused] = useState(false);
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [restTimerTotal, setRestTimerTotal] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [completedSummary, setCompletedSummary] = useState<{
    totalExercises: number;
    completedSets: number;
    totalSets: number;
    duration: number;
    prs: number;
    volume: number;
  } | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const restIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [previousBest, setPreviousBest] = useState<{ weight: number; reps: number } | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/auth'); return; }
    if (profile && !profile.onboarding_completed) { router.replace('/onboarding'); return; }
    loadData();
  }, [user, profile, loading, router]);

  // Elapsed time timer
  useEffect(() => {
    if (mode === 'live' && !workoutPaused) {
      intervalRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - workoutStartTime) / 1000));
      }, 1000);
      return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }
  }, [mode, workoutPaused, workoutStartTime]);

  // Rest timer countdown
  useEffect(() => {
    if (restTimer !== null && restTimer > 0) {
      restIntervalRef.current = setInterval(() => {
        setRestTimer((prev) => {
          if (prev === null || prev <= 1) {
            if (restIntervalRef.current) clearInterval(restIntervalRef.current);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
      return () => { if (restIntervalRef.current) clearInterval(restIntervalRef.current); };
    }
  }, [restTimer !== null]);

  // Load previous best for current exercise
  useEffect(() => {
    if (mode === 'live' && liveExercises[currentExerciseIdx] && user) {
      loadPreviousBest(liveExercises[currentExerciseIdx].name);
    }
  }, [mode, currentExerciseIdx, liveExercises, user]);

  async function loadData() {
    if (!user) return;

    const [exRes, planRes] = await Promise.all([
      supabase.from('exercise_library').select('*').order('name'),
      supabase.from('workout_plans').select('*').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
    ]);

    setExercises(exRes.data as Exercise[] || []);
    const plan = planRes.data as WorkoutPlan | null;
    setActivePlan(plan);

    if (plan) {
      const { data: peData } = await supabase
        .from('planned_exercises')
        .select('*')
        .eq('plan_id', plan.id)
        .order('day_of_week, order_index');
      setPlannedExercises(peData as PlannedExercise[] || []);

      // Set the split based on existing plan
      setSelectedSplit(plan.split_type as SplitType);

      // Build generated days from saved plan
      const days: GeneratedWorkoutDay[] = [];
      const dayMap = new Map<number, PlannedExercise[]>();
      (peData as PlannedExercise[] || []).forEach((pe) => {
        if (!dayMap.has(pe.day_of_week)) dayMap.set(pe.day_of_week, []);
        dayMap.get(pe.day_of_week)!.push(pe);
      });
      dayMap.forEach((pes, day) => {
        days.push({
          day_label: pes[0]?.day_label || `Day ${day + 1}`,
          day_of_week: day,
          exercises: pes.map((pe, idx) => ({
            exercise_name: pe.exercise_name,
            muscle_group: pe.muscle_group,
            sets: pe.sets,
            reps: pe.reps,
            rest_seconds: pe.rest_seconds,
            suggested_weight: pe.suggested_weight,
            order_index: idx,
            instructions: pe.instructions,
            is_warmup: pe.is_warmup,
            is_cooldown: pe.is_cooldown,
          })),
        });
      });
      days.sort((a, b) => a.day_of_week - b.day_of_week);
      setGeneratedDays(days);
    } else if (profile) {
      // Auto-generate a default plan
      autoGeneratePlan(profile.fitness_goal === 'strength' ? 'upper_lower' : 'full_body');
    }

    setDataLoading(false);
  }

  function autoGeneratePlan(split: SplitType) {
    if (!profile || exercises.length === 0) return;
    const days = generateWorkoutPlan(profile, exercises, split);
    setGeneratedDays(days);
    setSelectedSplit(split);
  }

  async function loadPreviousBest(exerciseName: string) {
    if (!user) return;
    const { data } = await supabase
      .from('workout_sets')
      .select('weight_kg, reps')
      .eq('user_id', user.id)
      .eq('exercise_name', exerciseName)
      .eq('completed', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      setPreviousBest({ weight: data[0].weight_kg, reps: data[0].reps });
    } else {
      setPreviousBest(null);
    }
  }

  async function savePlan(days: GeneratedWorkoutDay[]) {
    if (!user || !profile) return;
    setGenerating(true);

    try {
      // Deactivate old plan
      if (activePlan) {
        await supabase.from('workout_plans').update({ is_active: false }).eq('id', activePlan.id);
      }

      // Create new plan
      const { data: newPlan, error: planError } = await supabase
        .from('workout_plans')
        .insert({
          user_id: user.id,
          name: `${splitOptions.find((s) => s.id === selectedSplit)?.label || 'Custom'} Plan`,
          split_type: selectedSplit,
          days_per_week: days.length,
          duration_min: profile.preferred_duration_min,
          is_active: true,
        })
        .select()
        .single();

      if (planError || !newPlan) throw planError;

      // Insert planned exercises
      const exercisesToInsert = days.flatMap((day) =>
        day.exercises.map((ex, idx) => ({
          plan_id: newPlan.id,
          user_id: user.id,
          day_of_week: day.day_of_week,
          day_label: day.day_label,
          exercise_name: ex.exercise_name,
          muscle_group: ex.muscle_group,
          sets: ex.sets,
          reps: ex.reps,
          rest_seconds: ex.rest_seconds,
          suggested_weight: ex.suggested_weight,
          order_index: idx,
          instructions: ex.instructions,
          is_warmup: ex.is_warmup,
          is_cooldown: ex.is_cooldown,
        }))
      );

      const { error: exError } = await supabase.from('planned_exercises').insert(exercisesToInsert);
      if (exError) throw exError;

      setActivePlan(newPlan as WorkoutPlan);
      await loadData();
      setShowSplitDialog(false);
    } catch (err) {
      console.error('Failed to save plan:', err);
    }
    setGenerating(false);
  }

  function handleGenerate(split: SplitType) {
    if (!profile || exercises.length === 0) return;
    const days = generateWorkoutPlan(profile, exercises, split);
    setGeneratedDays(days);
    setSelectedSplit(split);
    savePlan(days);
  }

  function startWorkout(dayIdx: number) {
    const day = generatedDays[dayIdx];
    if (!day) return;

    const live: LiveExercise[] = day.exercises
      .filter((ex) => !ex.is_warmup && !ex.is_cooldown)
      .map((ex) => ({
        name: ex.exercise_name,
        muscle_group: ex.muscle_group,
        sets: Array.from({ length: ex.sets }, () => ({
          reps: parseInt(ex.reps.split('-')[0]) || 10,
          weight: ex.suggested_weight || 0,
          completed: false,
          is_pr: false,
        })),
        rest_seconds: ex.rest_seconds,
        instructions: ex.instructions,
      }));

    setLiveExercises(live);
    setCurrentExerciseIdx(0);
    setWorkoutStartTime(Date.now());
    setElapsedTime(0);
    setWorkoutPaused(false);
    setRestTimer(null);
    setMode('live');
  }

  function updateSet(exIdx: number, setIdx: number, field: 'reps' | 'weight', value: number) {
    setLiveExercises((prev) => {
      const next = [...prev];
      next[exIdx] = { ...next[exIdx], sets: [...next[exIdx].sets] };
      next[exIdx].sets[setIdx] = { ...next[exIdx].sets[setIdx], [field]: value };
      return next;
    });
  }

  const completeSet = useCallback(async (exIdx: number, setIdx: number) => {
    if (!user) return;

    setLiveExercises((prev) => {
      const next = [...prev];
      const wasCompleted = next[exIdx].sets[setIdx].completed;
      next[exIdx] = { ...next[exIdx], sets: [...next[exIdx].sets] };
      next[exIdx].sets[setIdx] = { ...next[exIdx].sets[setIdx], completed: !wasCompleted };

      // Start rest timer when completing
      if (!wasCompleted) {
        const rest = next[exIdx].rest_seconds;
        setRestTimer(rest);
        setRestTimerTotal(rest);
      } else {
        setRestTimer(null);
      }

      return next;
    });

    // Check for PR
    const current = liveExercises[exIdx];
    if (current && !current.sets[setIdx].completed) {
      const set = current.sets[setIdx];
      const { data: existingPR } = await supabase
        .from('personal_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('exercise_name', current.name)
        .order('weight_kg', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!existingPR || set.weight > existingPR.weight_kg || (set.weight === existingPR.weight_kg && set.reps > existingPR.reps)) {
        if (set.weight > 0 && set.reps > 0) {
          const est1rm = Math.round(set.weight * (1 + set.reps / 30) * 10) / 10;
          await supabase.from('personal_records').insert({
            user_id: user.id,
            exercise_name: current.name,
            weight_kg: set.weight,
            reps: set.reps,
            estimated_1rm: est1rm,
          });

          setLiveExercises((prev) => {
            const next = [...prev];
            next[exIdx] = { ...next[exIdx], sets: [...next[exIdx].sets] };
            next[exIdx].sets[setIdx] = { ...next[exIdx].sets[setIdx], is_pr: true };
            return next;
          });
        }
      }
    }
  }, [user, liveExercises]);

  function skipExercise() {
    if (currentExerciseIdx < liveExercises.length - 1) {
      setCurrentExerciseIdx((i) => i + 1);
      setRestTimer(null);
    }
  }

  function reorderExercise(dir: 'up' | 'down') {
    const idx = currentExerciseIdx;
    const newIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= liveExercises.length) return;
    setLiveExercises((prev) => {
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
    setCurrentExerciseIdx(newIdx);
  }

  async function endWorkout(save: boolean) {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);

    if (!save) {
      setMode('plan');
      return;
    }

    if (!user) return;

    const duration = Math.floor((Date.now() - workoutStartTime) / 1000);
    const allSets = liveExercises.flatMap((ex) => ex.sets);
    const completedSets = allSets.filter((s) => s.completed);
    const volume = completedSets.reduce((sum, s) => sum + s.weight * s.reps, 0);
    const prs = completedSets.filter((s) => s.is_pr).length;
    const totalExercises = liveExercises.filter((ex) => ex.sets.some((s) => s.completed)).length;

    // Save session
    const { data: session, error: sessionError } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: user.id,
        plan_id: activePlan?.id || null,
        name: generatedDays[activeDay]?.day_label || 'Workout',
        split_type: selectedSplit,
        total_exercises: totalExercises,
        completed_sets: completedSets.length,
        total_sets: allSets.length,
        duration_seconds: duration,
        volume_kg: volume,
        pr_count: prs,
        started_at: new Date(workoutStartTime).toISOString(),
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (sessionError || !session) {
      console.error('Failed to save session:', sessionError);
      setMode('plan');
      return;
    }

    // Save sets
    const setsToInsert: Omit<WorkoutSet, 'id' | 'created_at'>[] = [];
    liveExercises.forEach((ex, exIdx) => {
      ex.sets.forEach((set, setIdx) => {
        if (set.completed) {
          setsToInsert.push({
            session_id: session.id,
            user_id: user.id,
            exercise_name: ex.name,
            muscle_group: ex.muscle_group,
            set_number: setIdx + 1,
            reps: set.reps,
            weight_kg: set.weight,
            completed: true,
            is_pr: set.is_pr,
            rest_seconds: ex.rest_seconds,
          });
        }
      });
      void exIdx;
    });

    if (setsToInsert.length > 0) {
      await supabase.from('workout_sets').insert(setsToInsert);
    }

    setCompletedSummary({
      totalExercises,
      completedSets: completedSets.length,
      totalSets: allSets.length,
      duration,
      prs,
      volume,
    });
    setMode('summary');
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  if (loading || dataLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ==================== LIVE WORKOUT MODE ====================
  if (mode === 'live') {
    const current = liveExercises[currentExerciseIdx];
    const allCompleted = liveExercises.every((ex) => ex.sets.every((s) => s.completed));

    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur-xl">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => endWorkout(false)} className="text-muted-foreground">
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-sm">
                <Clock className="h-4 w-4 text-primary" />
                <span className="font-mono font-semibold">{formatTime(elapsedTime)}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setWorkoutPaused(!workoutPaused)}
                className="h-8 w-8 p-0"
              >
                {workoutPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => endWorkout(true)} className="text-primary">
              Finish
            </Button>
          </div>
        </div>

        {/* Rest Timer Banner */}
        {restTimer !== null && (
          <div className="sticky top-[57px] z-10 bg-primary/10 border-b border-primary/20">
            <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Timer className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-primary">Rest: {formatTime(restTimer)}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setRestTimer(Math.max(0, restTimer - 15))} className="text-xs px-2 py-1 rounded bg-secondary/50 hover:bg-secondary">-15s</button>
                <button onClick={() => setRestTimer(restTimer + 15)} className="text-xs px-2 py-1 rounded bg-secondary/50 hover:bg-secondary">+15s</button>
                <button onClick={() => setRestTimer(null)} className="text-xs px-2 py-1 rounded bg-secondary/50 hover:bg-secondary">Skip</button>
              </div>
            </div>
            <div className="h-0.5 bg-primary/20">
              <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${restTimerTotal > 0 ? (restTimer / restTimerTotal) * 100 : 0}%` }} />
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-4">
          {/* Exercise counter */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              Exercise {currentExerciseIdx + 1} of {liveExercises.length}
            </span>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => reorderExercise('up')} disabled={currentExerciseIdx === 0} className="h-8 w-8 p-0">
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => reorderExercise('down')} disabled={currentExerciseIdx === liveExercises.length - 1} className="h-8 w-8 p-0">
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={skipExercise} disabled={currentExerciseIdx === liveExercises.length - 1} className="h-8 w-8 p-0">
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Current Exercise */}
          <Card className="p-5 border-primary/20">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-xl font-bold">{current.name}</h2>
                <Badge variant="secondary" className="mt-1 capitalize">{current.muscle_group}</Badge>
              </div>
              {previousBest && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Last best</p>
                  <p className="text-sm font-semibold">{previousBest.weight}kg × {previousBest.reps}</p>
                </div>
              )}
            </div>

            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{current.instructions}</p>

            {/* Sets */}
            <div className="space-y-2">
              <div className="grid grid-cols-[40px_1fr_1fr_60px] gap-2 text-xs text-muted-foreground uppercase tracking-wider px-2">
                <span>Set</span>
                <span className="text-center">Weight (kg)</span>
                <span className="text-center">Reps</span>
                <span className="text-center">Done</span>
              </div>
              {current.sets.map((set, setIdx) => (
                <div
                  key={setIdx}
                  className={cn(
                    'grid grid-cols-[40px_1fr_1fr_60px] gap-2 items-center p-2 rounded-lg border transition-all',
                    set.completed ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'
                  )}
                >
                  <span className="text-sm font-medium text-muted-foreground text-center">{setIdx + 1}</span>
                  <Input
                    type="number"
                    value={set.weight || ''}
                    onChange={(e) => updateSet(currentExerciseIdx, setIdx, 'weight', Number(e.target.value))}
                    disabled={set.completed}
                    className="h-10 text-center"
                    placeholder="0"
                  />
                  <Input
                    type="number"
                    value={set.reps || ''}
                    onChange={(e) => updateSet(currentExerciseIdx, setIdx, 'reps', Number(e.target.value))}
                    disabled={set.completed}
                    className="h-10 text-center"
                    placeholder="0"
                  />
                  <button
                    onClick={() => completeSet(currentExerciseIdx, setIdx)}
                    className={cn(
                      'h-10 rounded-lg flex items-center justify-center border-2 transition-all',
                      set.completed
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-border hover:border-primary/40'
                    )}
                  >
                    {set.completed && <Check className="h-4 w-4" />}
                  </button>
                </div>
              ))}
              {current.sets.some(s => s.is_pr) && (
                <div className="flex items-center gap-2 mt-2 text-primary text-sm font-medium animate-scale-in">
                  <Trophy className="h-4 w-4" />
                  New personal record!
                </div>
              )}
            </div>
          </Card>

          {/* Navigation */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={currentExerciseIdx === 0}
              onClick={() => setCurrentExerciseIdx((i) => i - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              className="flex-1"
              disabled={currentExerciseIdx === liveExercises.length - 1}
              onClick={() => setCurrentExerciseIdx((i) => i + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          {allCompleted && (
            <Card className="p-5 border-primary/30 bg-primary/5 text-center animate-scale-in">
              <p className="font-semibold mb-3">All sets completed! Great work.</p>
              <Button onClick={() => endWorkout(true)} className="w-full">
                <Check className="h-4 w-4 mr-2" />
                Finish Workout
              </Button>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // ==================== SUMMARY MODE ====================
  if (mode === 'summary' && completedSummary) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <Card className="p-8 text-center border-primary/20 animate-scale-in">
            <div className="flex h-20 w-20 mx-auto items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 mb-6">
              <Trophy className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Workout Complete!</h1>
            <p className="text-muted-foreground mb-6">Great session. Here&apos;s your summary:</p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <SummaryStat label="Duration" value={formatTime(completedSummary.duration)} icon={Clock} />
              <SummaryStat label="Exercises" value={`${completedSummary.totalExercises}`} icon={Dumbbell} />
              <SummaryStat label="Sets Done" value={`${completedSummary.completedSets}/${completedSummary.totalSets}`} icon={Check} />
              <SummaryStat label="Volume" value={`${Math.round(completedSummary.volume)} kg`} icon={TrendingUp} />
            </div>

            {completedSummary.prs > 0 && (
              <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20 mb-6">
                <Trophy className="h-5 w-5 text-primary" />
                <span className="text-sm font-semibold text-primary">{completedSummary.prs} New Personal Record{completedSummary.prs > 1 ? 's' : ''}!</span>
              </div>
            )}

            <div className="space-y-2">
              <Button onClick={() => { setMode('plan'); setCompletedSummary(null); }} className="w-full">
                Back to Workout Plans
              </Button>
              <Button variant="outline" onClick={() => router.push('/dashboard')} className="w-full">
                Go to Dashboard
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // ==================== PLAN MODE ====================
  const todayDay = new Date().getDay();
  return (
    <AppShell>
      <div className="space-y-6 pb-6">
        <div className="flex items-center justify-between animate-fade-in-up">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Workout Plans</h1>
            <p className="text-muted-foreground mt-1">Choose a split and generate your training plan</p>
          </div>
          <Button onClick={() => setShowSplitDialog(true)} size="sm" className="shrink-0">
            <RefreshCw className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">New Plan</span>
          </Button>
        </div>

        {/* Generated Plan Days */}
        {generatedDays.length > 0 ? (
          <div className="space-y-4">
            {generatedDays.map((day, dayIdx) => {
              const isToday = dayIdx === (todayDay % generatedDays.length);
              const exerciseCount = day.exercises.filter((e) => !e.is_warmup && !e.is_cooldown).length;
              return (
                <Card
                  key={dayIdx}
                  className={cn(
                    'p-5 transition-all animate-fade-in-up',
                    isToday && 'border-primary/30 bg-primary/5'
                  )}
                  style={{ animationDelay: `${dayIdx * 50}ms` }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-lg',
                        isToday ? 'bg-primary/15 text-primary' : 'bg-secondary/50 text-muted-foreground'
                      )}>
                        <Dumbbell className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{day.day_label}</h3>
                        <p className="text-xs text-muted-foreground">
                          {exerciseCount} exercises · {profile?.preferred_duration_min || 60} min est.
                        </p>
                      </div>
                    </div>
                    {isToday && (
                      <Badge className="bg-primary/15 text-primary border-primary/20">Today</Badge>
                    )}
                  </div>

                  {/* Exercise list */}
                  <div className="space-y-1.5 mb-4">
                    {day.exercises.filter((e) => !e.is_warmup && !e.is_cooldown).map((ex, exIdx) => (
                      <div key={exIdx} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/20 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-xs w-4">{exIdx + 1}</span>
                          <span className="font-medium">{ex.exercise_name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{ex.sets} × {ex.reps}</span>
                          <Badge variant="outline" className="capitalize text-[10px]">{ex.muscle_group}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button onClick={() => startWorkout(dayIdx)} className="w-full" size="lg">
                    <Play className="h-4 w-4 mr-2" />
                    Start {day.day_label}
                  </Button>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-8 text-center border-dashed">
            <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 mb-4">
              <Layers className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">No workout plan yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
              Generate a personalized workout plan based on your fitness profile and goals.
            </p>
            <Button onClick={() => setShowSplitDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Generate Workout Plan
            </Button>
          </Card>
        )}
      </div>

      {/* Split Selection Dialog */}
      <Dialog open={showSplitDialog} onOpenChange={setShowSplitDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Choose Your Workout Split</DialogTitle>
            <DialogDescription>
              Select a training split that fits your schedule and goals. We&apos;ll generate exercises based on your profile.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            {splitOptions.map((split) => (
              <button
                key={split.id}
                onClick={() => generating ? null : handleGenerate(split.id)}
                disabled={generating || split.id === 'custom'}
                className={cn(
                  'flex items-center justify-between p-4 rounded-xl border-2 text-left transition-all w-full disabled:opacity-50',
                  selectedSplit === split.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/40'
                )}
              >
                <div>
                  <p className="font-semibold">{split.label}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{split.description}</p>
                </div>
                {generating && selectedSplit === split.id ? (
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                ) : (
                  <Zap className="h-5 w-5 text-primary" />
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function SummaryStat({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
      <Icon className="h-4 w-4 text-primary mx-auto mb-1" />
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
