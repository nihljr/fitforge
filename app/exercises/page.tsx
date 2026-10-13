'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/app-shell';
import { supabase, type Exercise } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  Dumbbell,
  Loader2,
  Filter,
  X,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const muscleGroups = ['all', 'chest', 'back', 'shoulders', 'arms', 'legs', 'core'];
const equipmentTypes = [
  { id: 'all', label: 'All Equipment' },
  { id: 'full_gym', label: 'Full Gym' },
  { id: 'dumbbells', label: 'Dumbbells' },
  { id: 'bodyweight', label: 'Bodyweight' },
];
const difficultyLevels = [
  { id: 'all', label: 'All Levels' },
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
];

export default function ExercisesPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState('all');
  const [equipmentFilter, setEquipmentFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/auth'); return; }
    if (profile && !profile.onboarding_completed) { router.replace('/onboarding'); return; }
    loadExercises();
  }, [user, profile, loading, router]);

  async function loadExercises() {
    const { data, error } = await supabase.from('exercise_library').select('*').order('name');
    if (error) {
      console.error(error);
    }
    setExercises(data as Exercise[] || []);
    setDataLoading(false);
  }

  const filtered = useMemo(() => {
    return exercises.filter((ex) => {
      if (search && !ex.name.toLowerCase().includes(search.toLowerCase()) && !ex.muscle_group.toLowerCase().includes(search.toLowerCase())) return false;
      if (muscleFilter !== 'all' && ex.muscle_group !== muscleFilter) return false;
      if (equipmentFilter !== 'all' && ex.equipment !== equipmentFilter) return false;
      if (difficultyFilter !== 'all' && ex.difficulty !== difficultyFilter) return false;
      return true;
    });
  }, [exercises, search, muscleFilter, equipmentFilter, difficultyFilter]);

  if (loading || dataLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasActiveFilters = muscleFilter !== 'all' || equipmentFilter !== 'all' || difficultyFilter !== 'all' || search !== '';

  return (
    <AppShell>
      <div className="space-y-6 pb-6">
        <div className="animate-fade-in-up">
          <h1 className="text-2xl sm:text-3xl font-bold">Exercise Library</h1>
          <p className="text-muted-foreground mt-1">{exercises.length} exercises with detailed instructions</p>
        </div>

        {/* Search */}
        <div className="relative animate-fade-in-up" style={{ animationDelay: '50ms' }}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search exercises..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="space-y-3 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          {/* Muscle Groups */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            {muscleGroups.map((group) => (
              <button
                key={group}
                onClick={() => setMuscleFilter(group)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium capitalize whitespace-nowrap transition-all border',
                  muscleFilter === group
                    ? 'bg-primary/10 text-primary border-primary/20'
                    : 'text-muted-foreground border-border hover:border-muted-foreground/40'
                )}
              >
                {group === 'all' ? 'All Muscles' : group}
              </button>
            ))}
          </div>

          {/* Equipment + Difficulty */}
          <div className="flex flex-wrap gap-2">
            <select
              value={equipmentFilter}
              onChange={(e) => setEquipmentFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-card border border-border text-foreground focus:outline-none focus:border-primary/40 cursor-pointer"
            >
              {equipmentTypes.map((eq) => (
                <option key={eq.id} value={eq.id}>{eq.label}</option>
              ))}
            </select>
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-card border border-border text-foreground focus:outline-none focus:border-primary/40 cursor-pointer"
            >
              {difficultyLevels.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setMuscleFilter('all'); setEquipmentFilter('all'); setDifficultyFilter('all'); setSearch(''); }}
                className="text-muted-foreground"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* Results count */}
        <p className="text-sm text-muted-foreground animate-fade-in-up" style={{ animationDelay: '120ms' }}>
          Showing {filtered.length} exercise{filtered.length !== 1 ? 's' : ''}
        </p>

        {/* Exercise Grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
            {filtered.map((ex) => (
              <Card
                key={ex.id}
                className="p-4 cursor-pointer hover:border-primary/30 transition-all group"
                onClick={() => setSelectedExercise(ex)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 group-hover:scale-110 transition-transform">
                    <Dumbbell className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex gap-1.5">
                    <Badge variant="secondary" className="capitalize text-[10px]">{ex.muscle_group}</Badge>
                  </div>
                </div>
                <h3 className="font-semibold mb-1">{ex.name}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{ex.instructions}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="capitalize">{ex.equipment.replace('_', ' ')}</span>
                  <span>·</span>
                  <span className="capitalize">{ex.difficulty}</span>
                  <span>·</span>
                  <span>{ex.default_sets} × {ex.default_reps}</span>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center border-dashed">
            <Dumbbell className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold mb-1">No exercises found</h3>
            <p className="text-sm text-muted-foreground">Try adjusting your search or filters.</p>
          </Card>
        )}
      </div>

      {/* Exercise Detail Dialog */}
      <Dialog open={!!selectedExercise} onOpenChange={(open) => !open && setSelectedExercise(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedExercise && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{selectedExercise.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="flex flex-wrap gap-2">
                  <Badge className="capitalize">{selectedExercise.muscle_group}</Badge>
                  <Badge variant="secondary" className="capitalize">{selectedExercise.equipment.replace('_', ' ')}</Badge>
                  <Badge variant="outline" className="capitalize">{selectedExercise.difficulty}</Badge>
                </div>

                {selectedExercise.secondary_muscles && selectedExercise.secondary_muscles.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Secondary Muscles</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedExercise.secondary_muscles.map((m) => (
                        <Badge key={m} variant="outline" className="capitalize text-xs">{m}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Instructions</p>
                  <p className="text-sm text-foreground/90 leading-relaxed">{selectedExercise.instructions}</p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-secondary/30 border border-border/50 text-center">
                    <p className="text-lg font-bold text-primary">{selectedExercise.default_sets}</p>
                    <p className="text-xs text-muted-foreground">Sets</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/30 border border-border/50 text-center">
                    <p className="text-lg font-bold text-primary">{selectedExercise.default_reps}</p>
                    <p className="text-xs text-muted-foreground">Reps</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/30 border border-border/50 text-center">
                    <p className="text-lg font-bold text-primary">{selectedExercise.rest_seconds}s</p>
                    <p className="text-xs text-muted-foreground">Rest</p>
                  </div>
                </div>

                {selectedExercise.substitutions && selectedExercise.substitutions.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Substitutions</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedExercise.substitutions.map((s) => (
                        <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
