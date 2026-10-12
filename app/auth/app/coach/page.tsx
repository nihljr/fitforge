'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/app-shell';
import { supabase, type AiConversation, type Profile, type WorkoutSession, type WorkoutSet, type WorkoutPlan } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  MessageSquare,
  Send,
  Loader2,
  Sparkles,
  Bot,
  User,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

export default function CoachPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/auth'); return; }
    if (profile && !profile.onboarding_completed) { router.replace('/onboarding'); return; }
    loadMessages();
  }, [user, profile, loading, router]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function loadMessages() {
    if (!user) return;
    const { data } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(50);

    if (data && data.length > 0) {
      setMessages(data as Message[]);
    } else {
      // Welcome message
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `Hi ${profile?.full_name?.split(' ')[0] || 'there'}! I'm your AI fitness coach. I can help you with workout plans, exercise tips, progression advice, and more. What would you like to know?`,
        created_at: new Date().toISOString(),
      }]);
    }
    setDataLoading(false);
  }

  async function sendMessage() {
    if (!input.trim() || sending || !user) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSending(true);
    setError('');

    // Save user message to DB
    await supabase.from('ai_conversations').insert({
      user_id: user.id,
      role: 'user',
      content: userMessage.content,
    });

    try {
      // Gather context for the AI
      const context = await gatherContext();

      // Call edge function
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ai-coach`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          message: userMessage.content,
          history: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
          context,
        }),
      });

      if (!response.ok) {
        throw new Error('Coach service unavailable');
      }

      const data = await response.json();

      if (!data.reply) {
        throw new Error('Invalid response from coach');
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.reply,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Save assistant message to DB
      await supabase.from('ai_conversations').insert({
        user_id: user.id,
        role: 'assistant',
        content: data.reply,
      });
    } catch (err) {
      // Fallback response
      const fallback = generateFallbackResponse(userMessage.content, profile);
      const fallbackMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: fallback,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, fallbackMessage]);
      setError('The AI coach service is currently unavailable. Showing a general response.');

      // Clear error after a few seconds
      setTimeout(() => setError(''), 5000);
    }

    setSending(false);
  }

  async function gatherContext() {
    if (!user || !profile) return null;

    const [sessionsRes, setsRes, plansRes] = await Promise.all([
      supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(10),
      supabase
        .from('workout_sets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('workout_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle(),
    ]);

    return {
      profile: {
        name: profile.full_name,
        age: profile.age,
        goal: profile.fitness_goal,
        experience: profile.experience_level,
        equipment: profile.available_equipment,
        daysPerWeek: profile.training_days_per_week,
        duration: profile.preferred_duration_min,
        weight: profile.weight_kg,
        height: profile.height_cm,
        dietaryPreferences: profile.dietary_preferences,
      },
      recentSessions: (sessionsRes.data as WorkoutSession[]) || [],
      recentSets: (setsRes.data as WorkoutSet[]) || [],
      activePlan: plansRes.data as WorkoutPlan | null,
    };
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  if (loading || dataLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const suggestions = [
    'How can I build bigger shoulders?',
    'Create a 4-day workout plan for muscle gain',
    'How should I progress on my bench press?',
    'What can I do instead of lat pulldowns?',
  ];

  return (
    <AppShell>
      <div className="flex flex-col h-[calc(100vh-3.5rem-4rem)] lg:h-[calc(100vh-3rem)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 animate-fade-in-up">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">AI Fitness Coach</h1>
              <p className="text-xs text-muted-foreground">Get personalized advice anytime</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex gap-3 animate-fade-in-up',
                msg.role === 'user' && 'flex-row-reverse'
              )}
            >
              <div className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg shrink-0',
                msg.role === 'user'
                  ? 'bg-secondary/50 text-muted-foreground'
                  : 'bg-primary/10 border border-primary/20 text-primary'
              )}>
                {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div className={cn(
                'max-w-[80%] rounded-2xl px-4 py-3',
                msg.role === 'user'
                  ? 'bg-secondary/40 text-foreground rounded-tr-sm'
                  : 'bg-card border border-border text-foreground rounded-tl-sm'
              )}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex gap-3 animate-fade-in-up">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary shrink-0">
                <Bot className="h-4 w-4" />
              </div>
              <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-primary/60 animate-pulse" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 rounded-full bg-primary/60 animate-pulse" style={{ animationDelay: '200ms' }} />
                  <span className="h-2 w-2 rounded-full bg-primary/60 animate-pulse" style={{ animationDelay: '400ms' }} />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Suggestion Chips */}
        {messages.length <= 1 && !sending && (
          <div className="space-y-2 mb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="px-3 py-2 rounded-lg bg-secondary/30 border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2 pb-2">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask your AI coach anything..."
              rows={1}
              disabled={sending}
              className="flex w-full rounded-xl border border-input bg-card px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none max-h-32 disabled:opacity-50"
              style={{ minHeight: '48px' }}
            />
          </div>
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="h-12 w-12 p-0 shrink-0"
          >
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

function generateFallbackResponse(message: string, profile: Profile | null): string {
  const msg = message.toLowerCase();
  const name = profile?.full_name?.split(' ')[0] || 'there';

  if (msg.includes('shoulder')) {
    return `To build bigger shoulders, ${name}, focus on:

1. **Overhead Press** — your primary mass builder. 3-4 sets of 6-8 reps.
2. **Lateral Raises** — for side delts that create width. 3 sets of 12-15 reps.
3. **Face Pulls** — for rear delts and posture. 3 sets of 15-20 reps.
4. **Arnold Press** — full shoulder development. 3 sets of 8-12 reps.

Train shoulders 2-3 times per week with progressive overload. Make sure to eat enough protein (1.6-2.2g per kg of bodyweight) to support growth.

Note: The AI coaching service is currently offline, so this is a general response. Please try again later for more personalized advice.`;
  }

  if (msg.includes('plan') || msg.includes('workout') || msg.includes('routine')) {
    return `Here's a general 4-day workout plan for muscle gain, ${name}:

**Day 1 — Push (Chest/Shoulders/Triceps)**
- Bench Press: 4×6-8
- Overhead Press: 3×8-10
- Lateral Raises: 3×12-15
- Triceps Pushdown: 3×10-15

**Day 2 — Pull (Back/Biceps)**
- Pull-Ups or Lat Pulldowns: 4×8-12
- Bent-Over Rows: 4×6-8
- Face Pulls: 3×15-20
- Barbell Curls: 3×8-12

**Day 3 — Legs**
- Squats: 4×6-8
- Romanian Deadlifts: 3×8-12
- Leg Press: 3×10-15
- Calf Raises: 4×12-20

**Day 4 — Upper Body**
- Incline Dumbbell Press: 3×8-12
- Seated Cable Row: 3×8-12
- Dumbbell Shoulder Press: 3×8-12
- Hammer Curls: 3×10-12
- Skull Crushers: 3×10-12

Rest 90 seconds between sets. Progressively increase weight or reps each week.

Note: The AI coaching service is currently offline. Try again later for a plan tailored to your specific profile.`;
  }

  if (msg.includes('bench') || msg.includes('progress')) {
    return `To progress on your bench press, ${name}:

1. **Use progressive overload** — add 1-2.5kg per week or add 1 rep to each set.
2. **Train bench 2x per week** — one heavy day (4-6 reps) and one volume day (8-12 reps).
3. **Strengthen accessories** — triceps, shoulders, and upper back all support your bench.
4. **Focus on technique** — tight setup, leg drive, controlled descent, explosive press.
5. **Deload every 4-6 weeks** — reduce weight by 40-60% for a recovery week.

If you stall for 2+ weeks, try a 5x5 protocol or switch to 3x3 with heavier weight.

Note: The AI coaching service is currently offline. This is a general response.`;
  }

  if (msg.includes('instead') || msg.includes('alternative') || msg.includes('substitut')) {
    return `Here are some common exercise substitutions, ${name}:

- **Lat Pulldowns** → Pull-Ups, Inverted Rows, Resistance Band Pulldowns
- **Barbell Bench** → Dumbbell Press, Push-Ups, Machine Chest Press
- **Barbell Squats** → Goblet Squats, Leg Press, Bulgarian Split Squats
- **Deadlifts** → Romanian Deadlifts, Trap Bar Deadlifts, Hip Thrusts
- **Overhead Press** → Dumbbell Shoulder Press, Push Press, Arnold Press

Choose based on available equipment and comfort level. The key is to maintain similar movement patterns and muscle activation.

Note: The AI coaching service is currently offline. This is a general response.`;
  }

  if (msg.includes('miss') || msg.includes('skip')) {
    return `If you missed a training day, ${name}, don't worry! Here's what to do:

1. **Don't try to make it up immediately** — cramming workouts leads to poor recovery.
2. **Just continue with your next scheduled session** — consistency over time matters more than any single workout.
3. **If you missed 2+ days**, consider a lighter session to ease back in.
4. **If you missed a week**, reduce weights by 10-15% for your first session back.
5. **Adjust your plan if needed** — if your schedule changed, modify your training days accordingly.

The most important thing is getting back to training consistently. One missed workout won't derail your progress!

Note: The AI coaching service is currently offline. This is a general response.`;
  }

  if (msg.includes('pain') || msg.includes('injury') || msg.includes('hurt')) {
    return `I'm not able to diagnose injuries or medical conditions, ${name}. If you're experiencing pain during exercise:

1. **Stop the exercise** that causes sharp or unusual pain.
2. **Rest the affected area** for a few days.
3. **Apply ice** for 15-20 minutes if there's swelling.
4. **See a healthcare professional** if pain persists or is severe.

For general muscle soreness (DOMS), light activity, proper nutrition, and adequate sleep will help with recovery.

Please consult a doctor or physical therapist for any persistent or concerning symptoms.`;
  }

  return `Great question, ${name}! While the AI coaching service is temporarily offline, I can share some general fitness advice:

- **Consistency** is the most important factor in fitness progress.
- **Progressive overload** — gradually increase weight, reps, or sets over time.
- **Nutrition** — eat enough protein (1.6-2.2g per kg bodyweight) and maintain a slight caloric surplus for muscle gain or deficit for fat loss.
- **Recovery** — sleep 7-9 hours, stay hydrated, and take rest days seriously.
- **Form first** — never sacrifice technique for heavier weights.

Please try again later when the AI service is back online for more detailed, personalized advice based on your training history.`;
}
