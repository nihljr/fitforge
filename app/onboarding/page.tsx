'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Dumbbell,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Target,
  Activity,
  Clock,
  Calendar,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const goals = [
  { id: 'muscle_gain', label: 'Muscle Gain', desc: 'Build size and strength', icon: '💪' },
  { id: 'fat_loss', label: 'Fat Loss', desc: 'Burn fat, get lean', icon: '🔥' },
  { id: 'strength', label: 'Strength', desc: 'Maximize your lifts', icon: '🏋️' },
  { id: 'general_fitness', label: 'General Fitness', desc: 'Stay fit and healthy', icon: '✨' },
];

const experiences = [
  { id: 'beginner', label: 'Beginner', desc: 'New to training or returning after a long break' },
  { id: 'intermediate', label: 'Intermediate', desc: '6+ months of consistent training' },
  { id: 'advanced', label: 'Advanced', desc: '2+ years of structured training' },
];

const equipmentOptions = [
  { id: 'full_gym', label: 'Full Gym', desc: 'Barbells, machines, cables, dumbbells' },
  { id: 'dumbbells', label: 'Dumbbells Only', desc: 'Dumbbells and adjustable bench at home' },
  { id: 'bodyweight', label: 'Bodyweight', desc: 'No equipment needed' },
];

const muscleGroups = [
  'chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'glutes',
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    full_name: '',
    age: '',
    height_cm: '',
    weight_kg: '',
    fitness_goal: '',
    experience_level: '',
    training_days_per_week: 3,
    preferred_duration_min: 60,
    available_equipment: '',
    target_muscle_groups: [] as string[],
    dietary_preferences: '',
  });

  const totalSteps = 6;

  function update<K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function toggleMuscleGroup(group: string) {
    setFormData((prev) => ({
      ...prev,
      target_muscle_groups: prev.target_muscle_groups.includes(group)
        ? prev.target_muscle_groups.filter((g) => g !== group)
        : [...prev.target_muscle_groups, group],
    }));
  }

  function canProceed() {
    switch (step) {
      case 0: return formData.full_name.trim().length > 0 && Number(formData.age) > 0 && Number(formData.height_cm) > 0 && Number(formData.weight_kg) > 0;
      case 1: return formData.fitness_goal !== '';
      case 2: return formData.experience_level !== '';
      case 3: return formData.training_days_per_week > 0 && formData.preferred_duration_min > 0;
      case 4: return formData.available_equipment !== '';
      case 5: return true;
      default: return false;
    }
  }

  async function handleComplete() {
    if (!user) return;
    setSubmitting(true);
    setError('');

    try {
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          full_name: formData.full_name,
          age: Number(formData.age),
          height_cm: Number(formData.height_cm),
          weight_kg: Number(formData.weight_kg),
          fitness_goal: formData.fitness_goal,
          experience_level: formData.experience_level,
          training_days_per_week: formData.training_days_per_week,
          preferred_duration_min: formData.preferred_duration_min,
          available_equipment: formData.available_equipment,
          target_muscle_groups: formData.target_muscle_groups,
          dietary_preferences: formData.dietary_preferences,
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
        });

      if (upsertError) throw upsertError;

      // Also create initial body measurement
      await supabase.from('body_measurements').insert({
        user_id: user.id,
        weight_kg: Number(formData.weight_kg),
        recorded_at: new Date().toISOString().split('T')[0],
      });

      await refreshProfile();
      router.replace('/dashboard');
    } catch (err) {
      setError('Failed to save your profile. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
              <Dumbbell className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-bold">SmartFit AI</span>
            <span className="text-xs text-muted-foreground ml-auto">Step {step + 1} of {totalSteps}</span>
          </div>
          <Progress value={((step + 1) / totalSteps) * 100} className="h-1.5" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start sm:items-center justify-center px-4 sm:px-6 py-8">
        <div className="w-full max-w-2xl">
          {/* Step 0: Personal Info */}
          {step === 0 && (
            <div className="animate-fade-in-up space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold mb-2">Let&apos;s get to know you</h1>
                <p className="text-muted-foreground">We&apos;ll use this to personalize your training plan.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={formData.full_name}
                    onChange={(e) => update('full_name', e.target.value)}
                    className="h-11"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="age">Age</Label>
                    <Input
                      id="age"
                      type="number"
                      placeholder="25"
                      value={formData.age}
                      onChange={(e) => update('age', e.target.value)}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="height">Height (cm)</Label>
                    <Input
                      id="height"
                      type="number"
                      placeholder="175"
                      value={formData.height_cm}
                      onChange={(e) => update('height_cm', e.target.value)}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weight">Weight (kg)</Label>
                    <Input
                      id="weight"
                      type="number"
                      placeholder="75"
                      value={formData.weight_kg}
                      onChange={(e) => update('weight_kg', e.target.value)}
                      className="h-11"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Fitness Goal */}
          {step === 1 && (
            <div className="animate-fade-in-up space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-5 w-5 text-primary" />
                  <h1 className="text-2xl sm:text-3xl font-bold">What&apos;s your main goal?</h1>
                </div>
                <p className="text-muted-foreground">Choose the one that matters most to you right now.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {goals.map((goal) => (
                  <button
                    key={goal.id}
                    onClick={() => update('fitness_goal', goal.id)}
                    className={cn(
                      'flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all',
                      formData.fitness_goal === goal.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/40 bg-card'
                    )}
                  >
                    <span className="text-2xl">{goal.icon}</span>
                    <div className="flex-1">
                      <p className="font-semibold">{goal.label}</p>
                      <p className="text-sm text-muted-foreground">{goal.desc}</p>
                    </div>
                    {formData.fitness_goal === goal.id && (
                      <Check className="h-5 w-5 text-primary shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Experience */}
          {step === 2 && (
            <div className="animate-fade-in-up space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-5 w-5 text-primary" />
                  <h1 className="text-2xl sm:text-3xl font-bold">Your experience level</h1>
                </div>
                <p className="text-muted-foreground">This helps us calibrate your workouts appropriately.</p>
              </div>

              <div className="space-y-3">
                {experiences.map((exp) => (
                  <button
                    key={exp.id}
                    onClick={() => update('experience_level', exp.id)}
                    className={cn(
                      'flex items-center justify-between p-4 rounded-xl border-2 text-left transition-all w-full',
                      formData.experience_level === exp.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/40 bg-card'
                    )}
                  >
                    <div>
                      <p className="font-semibold">{exp.label}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{exp.desc}</p>
                    </div>
                    {formData.experience_level === exp.id && (
                      <Check className="h-5 w-5 text-primary shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Schedule */}
          {step === 3 && (
            <div className="animate-fade-in-up space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  <h1 className="text-2xl sm:text-3xl font-bold">Your training schedule</h1>
                </div>
                <p className="text-muted-foreground">How often and how long can you train?</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base">Training days per week</Label>
                    <span className="text-2xl font-bold text-primary">{formData.training_days_per_week}</span>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                      <button
                        key={day}
                        onClick={() => update('training_days_per_week', day)}
                        className={cn(
                          'h-11 rounded-lg border-2 font-medium transition-all',
                          formData.training_days_per_week === day
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:border-muted-foreground/40'
                        )}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Preferred workout duration
                    </Label>
                    <span className="text-2xl font-bold text-primary">{formData.preferred_duration_min}<span className="text-sm font-normal text-muted-foreground"> min</span></span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[30, 45, 60, 90].map((dur) => (
                      <button
                        key={dur}
                        onClick={() => update('preferred_duration_min', dur)}
                        className={cn(
                          'h-11 rounded-lg border-2 font-medium transition-all',
                          formData.preferred_duration_min === dur
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:border-muted-foreground/40'
                        )}
                      >
                        {dur}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Equipment */}
          {step === 4 && (
            <div className="animate-fade-in-up space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Dumbbell className="h-5 w-5 text-primary" />
                  <h1 className="text-2xl sm:text-3xl font-bold">Available equipment</h1>
                </div>
                <p className="text-muted-foreground">What equipment do you have access to?</p>
              </div>

              <div className="space-y-3">
                {equipmentOptions.map((eq) => (
                  <button
                    key={eq.id}
                    onClick={() => update('available_equipment', eq.id)}
                    className={cn(
                      'flex items-center justify-between p-4 rounded-xl border-2 text-left transition-all w-full',
                      formData.available_equipment === eq.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/40 bg-card'
                    )}
                  >
                    <div>
                      <p className="font-semibold">{eq.label}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{eq.desc}</p>
                    </div>
                    {formData.available_equipment === eq.id && (
                      <Check className="h-5 w-5 text-primary shrink-0" />
                    )}
                  </button>
                ))}
              </div>

              <div className="space-y-3 pt-2">
                <Label className="text-base">Target muscle groups (optional)</Label>
                <p className="text-sm text-muted-foreground -mt-2">Select any you want to prioritize.</p>
                <div className="flex flex-wrap gap-2">
                  {muscleGroups.map((group) => (
                    <button
                      key={group}
                      onClick={() => toggleMuscleGroup(group)}
                      className={cn(
                        'px-4 py-2 rounded-lg border-2 text-sm font-medium capitalize transition-all',
                        formData.target_muscle_groups.includes(group)
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-muted-foreground/40'
                      )}
                    >
                      {group}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Dietary Preferences */}
          {step === 5 && (
            <div className="animate-fade-in-up space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold mb-2">Dietary preferences</h1>
                <p className="text-muted-foreground">Optional — helps your AI coach give better nutrition advice.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="diet">Preferences (optional)</Label>
                <textarea
                  id="diet"
                  placeholder="e.g., vegetarian, high-protein, intermittent fasting, no dairy..."
                  value={formData.dietary_preferences}
                  onChange={(e) => update('dietary_preferences', e.target.value)}
                  className="flex min-h-[120px] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                />
              </div>

              {error && (
                <div className="text-sm text-destructive">{error}</div>
              )}

              <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
                <p className="text-sm text-muted-foreground">
                  You&apos;re all set! We&apos;ll create your personalized dashboard and workout plan based on your profile.
                </p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || submitting}
              className="text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            {step < totalSteps - 1 ? (
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canProceed()}
                className="h-11 px-6"
              >
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                disabled={submitting}
                className="h-11 px-6"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Start Training
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
