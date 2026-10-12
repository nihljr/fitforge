'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/app-shell';
import { supabase, type WorkoutSession, type WorkoutSet, type PersonalRecord, type BodyMeasurement, type WorkoutPlan, type PlannedExercise } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Flame,
  Dumbbell,
  TrendingUp,
  Trophy,
  Play,
  Calendar,
  Target,
  Zap,
  ChevronRight,
  Loader2,
  Activity,
  Award,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [recentPRs, setRecentPRs] = useState<PersonalRecord[]>([]);
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [plannedExercises, setPlannedExercises] = useState<PlannedExercise[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/auth');
      return;
    }
    if (profile && !profile.onboarding_completed) {
      router.replace('/onboarding');
      return;
    }
    loadDashboardData();
  }, [user, profile, loading, router]);

  async function loadDashboardData() {
    if (!user) return;

    const [sessionsRes, prsRes, measurementsRes, planRes] = await Promise.all([
      supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(30),
      supabase
        .from('personal_records')
        .select('*')
        .eq('user_id', user.id)
        .order('achieved_at', { ascending: false })
        .limit(5),
      supabase
        .from('body_measurements')
        .select('*')
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: true })
        .limit(30),
      supabase
        .from('workout_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle(),
    ]);

    setSessions(sessionsRes.data as WorkoutSession[] || []);
    setRecentPRs(prsRes.data as PersonalRecord[] || []);
    setMeasurements(measurementsRes.data as BodyMeasurement[] || []);
    const plan = planRes.data as WorkoutPlan | null;
    setActivePlan(plan);

    if (plan) {
      const { data: exData } = await supabase
        .from('planned_exercises')
        .select('*')
        .eq('plan_id', plan.id)
        .order('day_of_week, order_index');
      setPlannedExercises(exData as PlannedExercise[] || []);
    }

    setDataLoading(false);
  }

  if (loading || dataLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'Athlete';

  // Calculate stats
  const completedSessions = sessions.filter((s) => s.completed_at !== null);
  const totalWorkouts = completedSessions.length;

  // Calculate streak
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = checkDate.toISOString().split('T')[0];
    const hasWorkout = completedSessions.some((s) => {
      if (!s.completed_at) return false;
      return s.completed_at.split('T')[0] === dateStr;
    });
    if (hasWorkout) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  // Weekly completion
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const workoutsThisWeek = completedSessions.filter((s) => {
    if (!s.completed_at) return false;
    return new Date(s.completed_at) >= weekStart;
  }).length;
  const weeklyGoal = profile?.training_days_per_week || 3;
  const weeklyPct = Math.min(100, (workoutsThisWeek / weeklyGoal) * 100);

  // Weight trend
  const latestWeight = measurements.length > 0 ? measurements[measurements.length - 1].weight_kg : profile?.weight_kg;
  const weightData = measurements.map((m) => ({
    date: new Date(m.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    weight: m.weight_kg,
  }));

  // Today's workout from plan
  const todayDay = new Date().getDay();
  const todaysExercises = plannedExercises.filter((e) => e.day_of_week === (todayDay % Math.max(1, activePlan?.days_per_week || 1)));
  const hasTodaysWorkout = todaysExercises.length > 0;
  const todayDuration = activePlan?.duration_min || profile?.preferred_duration_min || 60;

  // AI recommendation
  const recommendations: string[] = [];
  if (totalWorkouts === 0) {
    recommendations.push('Start your first workout to begin building your training history.');
  } else if (streak === 0) {
    recommendations.push(`Welcome back, ${firstName}! Let's restart your streak with a workout today.`);
  } else if (streak >= 3) {
    recommendations.push(`You're on a ${streak}-day streak! Keep the momentum going.`);
  }
  if (weeklyPct < 50 && workoutsThisWeek < weeklyGoal) {
    recommendations.push(`You've completed ${workoutsThisWeek}/${weeklyGoal} workouts this week. Stay consistent!`);
  } else if (weeklyPct >= 100) {
    recommendations.push('You hit your weekly training goal. Consider a rest day or light mobility work.');
  }
  if (recommendations.length === 0) {
    recommendations.push('Focus on progressive overload — try increasing weight or reps this session.');
  }

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <AppShell>
      <div className="space-y-6 pb-6">
        {/* Greeting */}
        <div className="animate-fade-in-up">
          <h1 className="text-2xl sm:text-3xl font-bold">
            {greeting}, <span className="text-primary">{firstName}</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            {streak > 0 ? `${streak}-day streak — let's keep it going!` : 'Ready to start training today?'}
          </p>
        </div>

        {/* Today's Workout + Start Button */}
        <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card animate-fade-in-up" style={{ animationDelay: '50ms' }}>
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl" />
          <div className="relative p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Today&apos;s Workout</p>
                <h2 className="text-xl font-bold">
                  {hasTodaysWorkout ? todaysExercises[0]?.day_label : activePlan ? 'Rest Day' : 'No Plan Yet'}
                </h2>
                <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Dumbbell className="h-3.5 w-3.5" />
                    {hasTodaysWorkout ? `${todaysExercises.filter(e => !e.is_warmup && !e.is_cooldown).length} exercises` : '—'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    ~{todayDuration} min
                  </span>
                </div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 shrink-0">
                <Flame className="h-6 w-6 text-primary" />
              </div>
            </div>

            <Button
              onClick={() => router.push('/workout')}
              className="w-full h-11 font-semibold glow-primary"
              size="lg"
            >
              <Play className="h-4 w-4 mr-2" />
              Start Workout
            </Button>
          </div>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <StatCard
            icon={Flame}
            label="Current Streak"
            value={`${streak}`}
            unit="days"
            color="text-primary"
          />
          <StatCard
            icon={Dumbbell}
            label="Total Workouts"
            value={`${totalWorkouts}`}
            unit="sessions"
            color="text-chart-2"
          />
          <StatCard
            icon={Activity}
            label="Current Weight"
            value={latestWeight ? `${latestWeight}` : '—'}
            unit={latestWeight ? 'kg' : ''}
            color="text-chart-3"
          />
          <StatCard
            icon={Trophy}
            label="Personal Records"
            value={`${recentPRs.length}`}
            unit="PRs"
            color="text-chart-4"
          />
        </div>

        {/* Weekly Progress */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
          <Card className="lg:col-span-2 p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Weekly Activity</h3>
                <p className="text-sm text-muted-foreground">Your workout frequency this week</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">{workoutsThisWeek}<span className="text-sm text-muted-foreground font-normal">/{weeklyGoal}</span></p>
                <p className="text-xs text-muted-foreground">workouts</p>
              </div>
            </div>
            <Progress value={weeklyPct} className="h-2 mb-4" />

            {/* Day dots */}
            <div className="grid grid-cols-7 gap-2">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((dayLabel, idx) => {
                const dayStart = new Date(weekStart);
                dayStart.setDate(dayStart.getDate() + idx);
                const dayStr = dayStart.toISOString().split('T')[0];
                const hasWorkout = completedSessions.some((s) => {
                  if (!s.completed_at) return false;
                  return s.completed_at.split('T')[0] === dayStr;
                });
                const isToday = dayStr === today.toISOString().split('T')[0];
                return (
                  <div key={idx} className="flex flex-col items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">{dayLabel}</span>
                    <div
                      className={`h-9 w-9 rounded-lg flex items-center justify-center border ${
                        hasWorkout
                          ? 'bg-primary/15 border-primary/30 text-primary'
                          : isToday
                          ? 'border-primary/20 text-foreground'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      {hasWorkout ? <Check className="h-4 w-4" /> : dayStart.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Weight Trend */}
          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Weight Trend</h3>
                <p className="text-sm text-muted-foreground">Recent history</p>
              </div>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            {weightData.length > 1 ? (
              <div className="h-32 -mx-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weightData}>
                    <defs>
                      <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="weight"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#weightGradient)"
                      dot={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-32 flex flex-col items-center justify-center text-center">
                <p className="text-sm text-muted-foreground mb-2">No weight history yet</p>
                <Button variant="outline" size="sm" onClick={() => router.push('/progress')}>
                  Log your weight
                </Button>
              </div>
            )}
          </Card>
        </div>

        {/* AI Coach Recommendations */}
        <Card className="p-5 sm:p-6 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">AI Coach Recommendations</h3>
              <p className="text-sm text-muted-foreground">Based on your activity and progress</p>
            </div>
          </div>
          <div className="space-y-2">
            {recommendations.map((rec, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50">
                <div className="flex h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
                <p className="text-sm text-muted-foreground">{rec}</p>
              </div>
            ))}
          </div>
          <Button
            variant="ghost"
            className="w-full mt-3 text-primary hover:text-primary"
            onClick={() => router.push('/coach')}
          >
            Chat with your AI Coach
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </Card>

        {/* Recent Personal Records */}
        {recentPRs.length > 0 && (
          <Card className="p-5 sm:p-6 animate-fade-in-up" style={{ animationDelay: '250ms' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Recent Personal Records</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => router.push('/progress')}>
                View all
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
            <div className="space-y-2">
              {recentPRs.slice(0, 5).map((pr) => (
                <div key={pr.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <Trophy className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{pr.exercise_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(pr.achieved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-primary">{pr.weight_kg} kg</p>
                    <p className="text-xs text-muted-foreground">{pr.reps} reps</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Empty State */}
        {totalWorkouts === 0 && (
          <Card className="p-8 text-center border-dashed animate-fade-in-up" style={{ animationDelay: '300ms' }}>
            <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 mb-4">
              <Target className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Start your fitness journey</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
              You haven&apos;t completed any workouts yet. Generate a plan and start your first session to see your stats here.
            </p>
            <Button onClick={() => router.push('/workout')}>
              <Dumbbell className="h-4 w-4 mr-2" />
              Go to Workout
            </Button>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  unit,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl sm:text-3xl font-bold">{value}</span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
    </Card>
  );
}

function Check({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
