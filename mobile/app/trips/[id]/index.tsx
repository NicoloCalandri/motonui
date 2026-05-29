import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, RefreshControl, ActivityIndicator, Image,
  Alert, TextInput, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/hooks/useAuth';
import { queryClient } from '@/lib/queryClient';
import { splitExpenses } from '@/lib/expenses';
import { sanitizeTextInput, validateExpenseInput, validateTripInput, type NewTripData } from '@/lib/validation';
import { EmptyState } from '@/components/EmptyState';
import {
  Trip, Day, Leg, Accommodation, DayWithDetails, Expense, Media, Restaurant,
  Activity, ActivityType, ExpenseCategory, Post,
} from '@/types';

type TabKey = 'overview' | 'itinerary' | 'expenses' | 'media' | 'bookings' | 'blog';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'grid-outline' },
  { key: 'itinerary', label: 'Itinerario', icon: 'map-outline' },
  { key: 'expenses', label: 'Spese', icon: 'wallet-outline' },
  { key: 'media', label: 'Media', icon: 'images-outline' },
  { key: 'bookings', label: 'Prenotazioni', icon: 'calendar-outline' },
  { key: 'blog', label: 'Blog', icon: 'book-outline' },
];

const LEG_ICONS: Record<string, string> = {
  flight: 'airplane-outline',
  train: 'train-outline',
  car: 'car-outline',
  ferry: 'boat-outline',
  walk: 'walk-outline',
  bus: 'bus-outline',
  other: 'navigate-outline',
};

const EXPENSE_ICONS: Record<string, string> = {
  food: 'restaurant-outline',
  transport: 'car-outline',
  accommodation: 'bed-outline',
  activity: 'ticket-outline',
  shopping: 'bag-outline',
  other: 'ellipsis-horizontal-outline',
};

const STATUS_COLORS: Record<string, string> = {
  planning: '#F59E0B',
  active: '#10B981',
  completed: '#6B7280',
  archived: '#9CA3AF',
};

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(d: string | null) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function safeSelectionHaptic() {
  if (Platform.OS === 'web') return;
  try {
    void Haptics.selectionAsync().catch(() => undefined);
  } catch {
    // expo-haptics may be unavailable in some native/runtime combinations
  }
}

function safeNotificationHaptic(type: Haptics.NotificationFeedbackType) {
  if (Platform.OS === 'web') return;
  try {
    void Haptics.notificationAsync(type).catch(() => undefined);
  } catch {
    // expo-haptics may be unavailable in some native/runtime combinations
  }
}

async function fetchTrip(id: string): Promise<Trip | null> {
  const { data, error } = await supabase.from('trips').select('*').eq('id', id).single();
  if (error) return null;
  return data;
}

async function fetchDays(tripId: string): Promise<DayWithDetails[]> {
  const { data, error } = await supabase
    .from('days')
    .select('*, legs(*), accommodations(*)')
    .eq('trip_id', tripId)
    .order('sort_order', { ascending: true });
  if (error) return [];
  return (data ?? []).map((d: any) => ({
    ...d,
    legs: (d.legs ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order),
    accommodations: d.accommodations ?? [],
  }));
}

async function fetchExpenses(tripId: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('trip_id', tripId)
    .order('date', { ascending: false });
  if (error) return [];
  return data ?? [];
}

async function fetchTripMemberIds(tripId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('trip_members')
    .select('user_id')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true });

  if (error) return [];
  return (data ?? []).map((row) => row.user_id).filter(Boolean);
}

async function fetchMedia(tripId: string): Promise<Media[]> {
  const { data, error } = await supabase
    .from('media')
    .select('*')
    .eq('trip_id', tripId)
    .order('sort_order', { ascending: true });
  if (error) return [];
  return data ?? [];
}

async function fetchRestaurants(tripId: string): Promise<Restaurant[]> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('trip_id', tripId)
    .order('date', { ascending: true });
  if (error) return [];
  return data ?? [];
}

async function fetchActivities(tripId: string): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('trip_id', tripId)
    .order('date', { ascending: true });
  if (error) return [];
  return data ?? [];
}

async function fetchTripPosts(tripId: string): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('id,title,slug,status,published_at,cover_image,reading_time,created_at,seo_description,content_json,trip_id,author_id')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return data ?? [];
}

async function requireTripMember(tripId: string, userId: string): Promise<void> {
  if (!tripId || !userId) {
    throw new Error('Sessione non valida. Riapri il viaggio e riprova.');
  }

  const { data, error } = await supabase
    .from('trip_members')
    .select('id')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Non hai i permessi per modificare questo viaggio.');
  }
}

async function convertCurrencyToEur(amount: number, currency: string): Promise<number> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Importo non valido per la conversione.');
  }

  if (currency === 'EUR') {
    return Math.round(amount * 100) / 100;
  }

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('currency_rates')
    .select('rates,fetched_at')
    .gte('fetched_at', oneDayAgo)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.rates) {
    // Graceful fallback aligned with web behavior when rates are unavailable.
    return Math.round(amount * 100) / 100;
  }

  const rates = data.rates as Record<string, number>;
  const fromRate = rates[currency];

  if (!fromRate || fromRate <= 0) {
    return Math.round(amount * 100) / 100;
  }

  const converted = amount / fromRate;
  return Math.round(converted * 100) / 100;
}

function toSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 300);
}

function tiptapDocFromText(text: string) {
  const clean = text.trim();
  if (!clean) return null;
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: clean }] }],
  };
}

function extractTextFromTiptap(contentJson: unknown): string {
  const root = contentJson as { content?: Array<{ type?: string; text?: string; content?: any[] }> } | null;
  if (!root?.content) return '';
  const extract = (nodes: Array<{ type?: string; text?: string; content?: any[] }>): string =>
    nodes
      .map((node) => {
        if (node.type === 'text') return node.text ?? '';
        if (node.content) return `${extract(node.content)}\n`;
        return '';
      })
      .join('');
  return extract(root.content).trim();
}

export default function TripDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const tripId = Array.isArray(params.id) ? params.id[0] : params.id;
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showEditTrip, setShowEditTrip] = useState(false);
  const [showDayForm, setShowDayForm] = useState(false);
  const [editingDay, setEditingDay] = useState<Day | null>(null);
  const [showRestaurantForm, setShowRestaurantForm] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [showMediaForm, setShowMediaForm] = useState(false);
  const [editingMedia, setEditingMedia] = useState<Media | null>(null);
  const [legFormDayId, setLegFormDayId] = useState<string | null>(null);
  const [editingLeg, setEditingLeg] = useState<{ dayId: string; leg: Leg } | null>(null);
  const [accFormDayId, setAccFormDayId] = useState<string | null>(null);
  const [editingAccommodation, setEditingAccommodation] = useState<{ dayId: string; accommodation: Accommodation } | null>(null);
  const [showPostForm, setShowPostForm] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);

  const styles = makeStyles(colors, insets);

  const { data: trip, isLoading: tripLoading } = useQuery({
    queryKey: ['trip', tripId],
    queryFn: () => fetchTrip(tripId!),
    enabled: !!tripId,
  });

  const { data: days = [], refetch: refetchDays, isRefetching: refreshingDays } = useQuery({
    queryKey: ['days', tripId],
    queryFn: () => fetchDays(tripId!),
    enabled: !!tripId && activeTab === 'itinerary',
  });

  const { data: expenses = [], refetch: refetchExpenses, isRefetching: refreshingExpenses } = useQuery({
    queryKey: ['expenses', tripId],
    queryFn: () => fetchExpenses(tripId!),
    enabled: !!tripId && activeTab === 'expenses',
  });

  const { data: tripMemberIds = [] } = useQuery({
    queryKey: ['trip-members', tripId],
    queryFn: () => fetchTripMemberIds(tripId!),
    enabled: !!tripId && activeTab === 'expenses',
  });

  const { data: media = [], refetch: refetchMedia, isRefetching: refreshingMedia } = useQuery({
    queryKey: ['media', tripId],
    queryFn: () => fetchMedia(tripId!),
    enabled: !!tripId && activeTab === 'media',
  });

  const { data: restaurants = [], refetch: refetchRestaurants } = useQuery({
    queryKey: ['restaurants', tripId],
    queryFn: () => fetchRestaurants(tripId!),
    enabled: !!tripId && activeTab === 'bookings',
  });

  const { data: activities = [], refetch: refetchActivities } = useQuery({
    queryKey: ['activities', tripId],
    queryFn: () => fetchActivities(tripId!),
    enabled: !!tripId && activeTab === 'bookings',
  });

  const { data: posts = [], refetch: refetchPosts, isRefetching: refreshingPosts } = useQuery({
    queryKey: ['trip-posts', tripId],
    queryFn: () => fetchTripPosts(tripId!),
    enabled: !!tripId && activeTab === 'blog',
  });

  const deleteTripMutation = useMutation({
    mutationFn: async () => {
      if (!tripId || !user?.id) {
        throw new Error('Sessione non valida.');
      }

      if (!trip || trip.owner_id !== user.id) {
        throw new Error('Solo il proprietario puo eliminare il viaggio.');
      }

      const { error } = await supabase
        .from('trips')
        .update({ status: 'archived' })
        .eq('id', tripId)
        .eq('owner_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', user?.id] });
      queryClient.removeQueries({ queryKey: ['trip', tripId] });
      safeNotificationHaptic(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)/trips' as any);
    },
    onError: (err: Error) => {
      Alert.alert('Errore eliminazione', err.message);
    },
  });

  const updateTripMutation = useMutation({
    mutationFn: async (payload: NewTripData) => {
      if (!tripId || !user?.id) {
        throw new Error('Sessione non valida.');
      }

      if (!trip || trip.owner_id !== user.id) {
        throw new Error('Solo il proprietario puo modificare il viaggio.');
      }

      const validated = validateTripInput(payload);
      const { error } = await supabase
        .from('trips')
        .update({
          title: validated.title,
          destination: validated.destination,
          start_date: validated.start_date || null,
          end_date: validated.end_date || null,
          description: validated.description || null,
        })
        .eq('id', tripId)
        .eq('owner_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      queryClient.invalidateQueries({ queryKey: ['trips', user?.id] });
      setShowEditTrip(false);
      safeNotificationHaptic(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err: Error) => {
      Alert.alert('Errore modifica', err.message);
    },
  });

  const toggleDay = useCallback((dayId: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dayId)) next.delete(dayId);
      else next.add(dayId);
      return next;
    });
  }, []);

  const totalEur = expenses.reduce((sum, e) => sum + (e.amount_eur ?? e.amount), 0);
  const splitResult = useMemo(() => splitExpenses(expenses, tripMemberIds), [expenses, tripMemberIds]);
  const mySettlement = splitResult.settlements.find((s) => s.from_user_id === user?.id || s.to_user_id === user?.id);

  if (tripLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.foreground} />
      </View>
    );
  }

  if (!tripId) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={{ color: colors.foreground, fontFamily: 'DMSans_500Medium' }}>ID viaggio non valido</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={{ color: colors.foreground, fontFamily: 'DMSans_700Bold' }}>Torna indietro</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={{ color: colors.foreground, fontFamily: 'DMSans_500Medium' }}>Viaggio non trovato</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={{ color: colors.foreground, fontFamily: 'DMSans_700Bold' }}>Torna indietro</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>{trip.title}</Text>
        <View style={styles.navActions}>
          {trip.owner_id === user?.id ? (
            <TouchableOpacity
              onPress={() => setShowEditTrip((prev) => !prev)}
              style={styles.deleteButton}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={18} color={colors.foreground} />
            </TouchableOpacity>
          ) : null}
          {trip.owner_id === user?.id ? (
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  'Elimina viaggio',
                  'Questa azione archivia il viaggio. Vuoi continuare?',
                  [
                    { text: 'Annulla', style: 'cancel' },
                    {
                      text: 'Elimina',
                      style: 'destructive',
                      onPress: () => deleteTripMutation.mutate(),
                    },
                  ]
                );
              }}
              style={styles.deleteButton}
              activeOpacity={0.7}
              disabled={deleteTripMutation.isPending}
            >
              {deleteTripMutation.isPending ? (
                <ActivityIndicator color={colors.destructive} size="small" />
              ) : (
                <Ionicons name="trash-outline" size={18} color={colors.destructive} />
              )}
            </TouchableOpacity>
          ) : null}
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[trip.status] ?? colors.mutedForeground }]} />
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => {
              safeSelectionHaptic();
              setActiveTab(tab.key);
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name={tab.icon as any}
              size={15}
              color={activeTab === tab.key ? colors.primaryForeground : colors.mutedForeground}
            />
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {activeTab === 'overview' && (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentPadded} showsVerticalScrollIndicator={false}>
          {trip.cover_image ? (
            <Image source={{ uri: trip.cover_image }} style={styles.coverImage} />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="compass" size={40} color={colors.mutedForeground} />
            </View>
          )}

          <View style={styles.overviewHeader}>
            <Text style={styles.overviewTitle}>{trip.title}</Text>
            <View style={styles.destinationRow}>
              <Ionicons name="location-outline" size={15} color={colors.mutedForeground} />
              <Text style={styles.destinationText}>{trip.destination}</Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <StatBox icon="calendar-outline" label="Inizio" value={formatDate(trip.start_date)} colors={colors} />
            <StatBox icon="calendar-clear-outline" label="Fine" value={formatDate(trip.end_date)} colors={colors} />
            <StatBox icon="wallet-outline" label="Budget" value={trip.budget_eur ? `€${trip.budget_eur}` : '—'} colors={colors} />
            <StatBox icon="flag-outline" label="Stato" value={trip.status} colors={colors} />
          </View>

          {trip.description ? (
            <View style={styles.descriptionCard}>
              <Text style={styles.sectionLabel}>Descrizione</Text>
              <Text style={styles.descriptionText}>{trip.description}</Text>
            </View>
          ) : null}

          <View style={styles.quickActions}>
            <Text style={styles.sectionLabel}>Accesso rapido</Text>
            {trip.owner_id === user?.id && (
              <TouchableOpacity
                style={styles.quickActionRow}
                onPress={() => setShowEditTrip((prev) => !prev)}
                activeOpacity={0.7}
              >
                <View style={styles.quickActionIcon}>
                  <Ionicons name="create-outline" size={18} color={colors.foreground} />
                </View>
                <Text style={styles.quickActionLabel}>Modifica viaggio</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
            {TABS.filter(t => t.key !== 'overview').map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={styles.quickActionRow}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
              >
                <View style={styles.quickActionIcon}>
                  <Ionicons name={tab.icon as any} size={18} color={colors.foreground} />
                </View>
                <Text style={styles.quickActionLabel}>{tab.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            ))}
          </View>

          {showEditTrip && trip.owner_id === user?.id && (
            <EditTripForm
              trip={trip}
              isPending={updateTripMutation.isPending}
              onClose={() => setShowEditTrip(false)}
              onSave={(payload) => updateTripMutation.mutate(payload)}
              colors={colors}
            />
          )}
        </ScrollView>
      )}

      {activeTab === 'itinerary' && (
        <ScrollView
          style={styles.tabContent}
          contentContainerStyle={styles.tabContentPadded}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshingDays} onRefresh={refetchDays} tintColor={colors.foreground} />
          }
        >
          <View style={styles.sectionActionBar}>
            <Text style={styles.sectionActionTitle}>Giorni itinerario</Text>
            <TouchableOpacity
              style={styles.sectionAddBtn}
              onPress={() => {
                setEditingDay(null);
                setShowDayForm((prev) => !prev);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={16} color={colors.primaryForeground} />
              <Text style={styles.sectionAddBtnText}>Aggiungi giorno</Text>
            </TouchableOpacity>
          </View>

          {showDayForm && (
            <DayForm
              tripId={tripId}
              userId={user?.id ?? ''}
              colors={colors}
              day={editingDay}
              nextSortOrder={days.length}
              onClose={() => {
                setShowDayForm(false);
                setEditingDay(null);
              }}
              onSaved={() => {
                setShowDayForm(false);
                setEditingDay(null);
                refetchDays();
              }}
              onDeleted={() => {
                setShowDayForm(false);
                setEditingDay(null);
                refetchDays();
              }}
            />
          )}

          {days.length === 0 ? (
            <EmptyState icon="map-outline" title="Nessun giorno" subtitle="Aggiungi giorni all'itinerario dal sito web." />
          ) : (
            days.map((day) => {
              const isExpanded = expandedDays.has(day.id);
              const dayLabel = new Date(day.date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
              return (
                <View key={day.id} style={styles.dayCard}>
                  <TouchableOpacity style={styles.dayHeader} onPress={() => toggleDay(day.id)} activeOpacity={0.7}>
                    <View style={styles.dayDateBadge}>
                      <Text style={styles.dayDateNum}>{new Date(day.date).getDate()}</Text>
                      <Text style={styles.dayDateMon}>{new Date(day.date).toLocaleDateString('it-IT', { month: 'short' })}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dayTitle}>{day.title ?? dayLabel}</Text>
                      <Text style={styles.dayMeta}>
                        {day.legs.length} tratt{day.legs.length === 1 ? 'a' : 'e'} · {day.accommodations.length} alloggi
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.inlineActionBtn}
                      onPress={() => {
                        setEditingDay(day);
                        setShowDayForm(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="create-outline" size={16} color={colors.foreground} />
                    </TouchableOpacity>
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.dayContent}>
                        <View style={styles.inlineToolbar}>
                          <TouchableOpacity
                            style={styles.inlineToolbarBtn}
                            onPress={() => {
                              setLegFormDayId(day.id);
                              setEditingLeg(null);
                            }}
                          >
                            <Ionicons name="add" size={14} color={colors.primaryForeground} />
                            <Text style={styles.inlineToolbarBtnText}>Tratta</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.inlineToolbarBtn}
                            onPress={() => {
                              setAccFormDayId(day.id);
                              setEditingAccommodation(null);
                            }}
                          >
                            <Ionicons name="add" size={14} color={colors.primaryForeground} />
                            <Text style={styles.inlineToolbarBtnText}>Alloggio</Text>
                          </TouchableOpacity>
                        </View>

                        {legFormDayId === day.id && (
                          <LegForm
                            tripId={tripId}
                            day={day}
                            leg={editingLeg?.dayId === day.id ? editingLeg.leg : null}
                            userId={user?.id ?? ''}
                            colors={colors}
                            onClose={() => {
                              setLegFormDayId(null);
                              setEditingLeg(null);
                            }}
                            onSaved={() => {
                              setLegFormDayId(null);
                              setEditingLeg(null);
                              refetchDays();
                              refetchExpenses();
                            }}
                            onDeleted={() => {
                              setLegFormDayId(null);
                              setEditingLeg(null);
                              refetchDays();
                              refetchExpenses();
                            }}
                          />
                        )}

                        {accFormDayId === day.id && (
                          <AccommodationForm
                            tripId={tripId}
                            day={day}
                            accommodation={editingAccommodation?.dayId === day.id ? editingAccommodation.accommodation : null}
                            userId={user?.id ?? ''}
                            colors={colors}
                            onClose={() => {
                              setAccFormDayId(null);
                              setEditingAccommodation(null);
                            }}
                            onSaved={() => {
                              setAccFormDayId(null);
                              setEditingAccommodation(null);
                              refetchDays();
                              refetchExpenses();
                            }}
                            onDeleted={() => {
                              setAccFormDayId(null);
                              setEditingAccommodation(null);
                              refetchDays();
                              refetchExpenses();
                            }}
                          />
                        )}

                      {day.legs.map((leg) => (
                        <View key={leg.id} style={styles.legRow}>
                          <View style={styles.legIconCircle}>
                            <Ionicons name={LEG_ICONS[leg.type] as any} size={16} color={colors.foreground} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.legRoute}>{leg.from_name} → {leg.to_name}</Text>
                            {leg.departure_at ? (
                              <Text style={styles.legMeta}>{formatTime(leg.departure_at)}{leg.arrival_at ? ` → ${formatTime(leg.arrival_at)}` : ''}</Text>
                            ) : null}
                            {leg.carrier ? <Text style={styles.legMeta}>{leg.carrier}</Text> : null}
                            {leg.cost ? <Text style={styles.legCost}>{leg.cost} {leg.currency}</Text> : null}
                          </View>
                          <TouchableOpacity
                            style={styles.inlineActionBtn}
                            onPress={() => {
                              setEditingLeg({ dayId: day.id, leg });
                              setLegFormDayId(day.id);
                            }}
                          >
                            <Ionicons name="create-outline" size={14} color={colors.foreground} />
                          </TouchableOpacity>
                        </View>
                      ))}
                      {day.accommodations.map((acc) => (
                        <View key={acc.id} style={styles.accRow}>
                          <View style={styles.legIconCircle}>
                            <Ionicons name="bed-outline" size={16} color={colors.foreground} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.legRoute}>{acc.name}</Text>
                            {acc.address ? <Text style={styles.legMeta}>{acc.address}</Text> : null}
                            {acc.check_in && acc.check_out ? (
                              <Text style={styles.legMeta}>{formatDate(acc.check_in)} → {formatDate(acc.check_out)}</Text>
                            ) : null}
                            {acc.cost ? <Text style={styles.legCost}>{acc.cost} {acc.currency}</Text> : null}
                          </View>
                          <TouchableOpacity
                            style={styles.inlineActionBtn}
                            onPress={() => {
                              setEditingAccommodation({ dayId: day.id, accommodation: acc });
                              setAccFormDayId(day.id);
                            }}
                          >
                            <Ionicons name="create-outline" size={14} color={colors.foreground} />
                          </TouchableOpacity>
                        </View>
                      ))}
                      {day.legs.length === 0 && day.accommodations.length === 0 && (
                        <Text style={styles.emptyDayText}>Nessun evento per questo giorno.</Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {activeTab === 'expenses' && (
        <View style={{ flex: 1 }}>
          <View style={styles.expenseSummary}>
            <View>
              <Text style={styles.expenseTotalLabel}>Totale spese</Text>
              <Text style={styles.expenseTotalValue}>€{totalEur.toFixed(2)}</Text>
            </View>
            <TouchableOpacity
              style={styles.addExpenseBtn}
              onPress={() => setShowAddExpense(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={20} color={colors.primaryForeground} />
              <Text style={styles.addExpenseBtnText}>Aggiungi</Text>
            </TouchableOpacity>
          </View>

          {tripMemberIds.length >= 2 && (
            <View style={styles.settlementCard}>
              <View style={styles.settlementIconWrap}>
                <Ionicons name="swap-horizontal-outline" size={18} color={colors.foreground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.settlementTitle}>Regolazione partner</Text>
                {splitResult.is_even || !mySettlement ? (
                  <Text style={styles.settlementText}>Siete in pari.</Text>
                ) : mySettlement.from_user_id === user?.id ? (
                  <Text style={styles.settlementText}>Devi €{mySettlement.amount_eur.toFixed(2)} al partner.</Text>
                ) : (
                  <Text style={styles.settlementText}>Il partner ti deve €{mySettlement.amount_eur.toFixed(2)}.</Text>
                )}
              </View>
            </View>
          )}

          {showAddExpense && (
            <ExpenseForm
              tripId={tripId}
              userId={user?.id ?? ''}
              days={days}
              colors={colors}
              onClose={() => setShowAddExpense(false)}
              onSaved={() => {
                setShowAddExpense(false);
                refetchExpenses();
              }}
            />
          )}

          {editingExpense && (
            <ExpenseForm
              expense={editingExpense}
              tripId={tripId}
              userId={user?.id ?? ''}
              days={days}
              colors={colors}
              onClose={() => setEditingExpense(null)}
              onSaved={() => {
                setEditingExpense(null);
                refetchExpenses();
              }}
              onDeleted={() => {
                setEditingExpense(null);
                refetchExpenses();
              }}
            />
          )}

          <FlatList<Expense>
            data={expenses}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.expenseRow}>
                <View style={styles.expenseCategoryIcon}>
                  <Ionicons name={EXPENSE_ICONS[item.category] as any} size={18} color={colors.foreground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.expenseDesc}>{item.description}</Text>
                  <Text style={styles.expenseMeta}>
                    {item.category} · {item.split ? 'Diviso' : 'Personale'}
                    {item.date ? ` · ${formatDate(item.date)}` : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.expenseAmount}>{item.amount} {item.currency}</Text>
                  {item.amount_eur ? (
                    <Text style={styles.expenseAmountEur}>€{item.amount_eur.toFixed(2)}</Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={styles.expenseActionBtn}
                  onPress={() => setEditingExpense(item)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="create-outline" size={16} color={colors.foreground} />
                </TouchableOpacity>
              </View>
            )}
            contentContainerStyle={styles.tabContentPadded}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshingExpenses} onRefresh={refetchExpenses} tintColor={colors.foreground} />
            }
            ListEmptyComponent={
              !showAddExpense ? (
                <EmptyState icon="wallet-outline" title="Nessuna spesa" subtitle="Aggiungi la prima spesa di questo viaggio." />
              ) : null
            }
          />
        </View>
      )}

      {activeTab === 'media' && (
        <ScrollView
          style={styles.tabContent}
          contentContainerStyle={styles.mediaGrid}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshingMedia} onRefresh={refetchMedia} tintColor={colors.foreground} />
          }
        >
          <View style={[styles.sectionActionBar, { marginHorizontal: 8, marginBottom: 10 }]}>
            <Text style={styles.sectionActionTitle}>Galleria viaggio</Text>
            <TouchableOpacity
              style={styles.sectionAddBtn}
              onPress={() => {
                setEditingMedia(null);
                setShowMediaForm((prev) => !prev);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={16} color={colors.primaryForeground} />
              <Text style={styles.sectionAddBtnText}>Aggiungi media</Text>
            </TouchableOpacity>
          </View>

          {showMediaForm && (
            <MediaForm
              tripId={tripId}
              userId={user?.id ?? ''}
              colors={colors}
              media={editingMedia}
              onClose={() => {
                setShowMediaForm(false);
                setEditingMedia(null);
              }}
              onSaved={() => {
                setShowMediaForm(false);
                setEditingMedia(null);
                refetchMedia();
              }}
              onDeleted={() => {
                setShowMediaForm(false);
                setEditingMedia(null);
                refetchMedia();
              }}
            />
          )}

          {media.length === 0 ? (
            <EmptyState icon="images-outline" title="Nessuna foto" subtitle="Aggiungi la prima foto o link media del viaggio." />
          ) : (
            <View style={styles.mediaGridInner}>
              {media.map((item) => (
                <TouchableOpacity key={item.id} style={styles.mediaCell} activeOpacity={0.85}>
                  <Image source={{ uri: item.thumbnail_url ?? item.url }} style={styles.mediaCellImage} />
                  <TouchableOpacity
                    style={styles.mediaEditBtn}
                    onPress={() => {
                      setEditingMedia(item);
                      setShowMediaForm(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="create-outline" size={14} color="#fff" />
                  </TouchableOpacity>
                  {item.caption ? (
                    <View style={styles.mediaCaptionOverlay}>
                      <Text style={styles.mediaCaptionText} numberOfLines={1}>{item.caption}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {activeTab === 'bookings' && (
        <ScrollView
          style={styles.tabContent}
          contentContainerStyle={styles.tabContentPadded}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={() => { refetchRestaurants(); refetchActivities(); }} tintColor={colors.foreground} />
          }
        >
          <View style={styles.sectionActionBar}>
            <Text style={styles.sectionActionTitle}>Prenotazioni</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={styles.sectionAddBtn}
                onPress={() => {
                  setEditingRestaurant(null);
                  setShowRestaurantForm((prev) => !prev);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="restaurant-outline" size={14} color={colors.primaryForeground} />
                <Text style={styles.sectionAddBtnText}>Ristorante</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sectionAddBtn}
                onPress={() => {
                  setEditingActivity(null);
                  setShowActivityForm((prev) => !prev);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="ticket-outline" size={14} color={colors.primaryForeground} />
                <Text style={styles.sectionAddBtnText}>Attività</Text>
              </TouchableOpacity>
            </View>
          </View>

          {showRestaurantForm && (
            <RestaurantForm
              tripId={tripId}
              userId={user?.id ?? ''}
              colors={colors}
              restaurant={editingRestaurant}
              onClose={() => {
                setShowRestaurantForm(false);
                setEditingRestaurant(null);
              }}
              onSaved={() => {
                setShowRestaurantForm(false);
                setEditingRestaurant(null);
                refetchRestaurants();
              }}
              onDeleted={() => {
                setShowRestaurantForm(false);
                setEditingRestaurant(null);
                refetchRestaurants();
              }}
            />
          )}

          {showActivityForm && (
            <ActivityForm
              tripId={tripId}
              userId={user?.id ?? ''}
              colors={colors}
              activity={editingActivity}
              onClose={() => {
                setShowActivityForm(false);
                setEditingActivity(null);
              }}
              onSaved={() => {
                setShowActivityForm(false);
                setEditingActivity(null);
                refetchActivities();
              }}
              onDeleted={() => {
                setShowActivityForm(false);
                setEditingActivity(null);
                refetchActivities();
              }}
            />
          )}

          {restaurants.length > 0 && (
            <>
              <Text style={styles.bookingsSectionTitle}>Ristoranti</Text>
              {restaurants.map((r) => (
                <View key={r.id} style={styles.bookingCard}>
                  <View style={styles.bookingIconCircle}>
                    <Ionicons name="restaurant-outline" size={18} color={colors.foreground} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bookingName}>{r.name}</Text>
                    {r.cuisine_type ? <Text style={styles.bookingMeta}>{r.cuisine_type}</Text> : null}
                    {r.date ? <Text style={styles.bookingMeta}>{formatDate(r.date)}{r.time ? ` alle ${r.time}` : ''}</Text> : null}
                    {r.booking_ref ? <Text style={styles.bookingRef}>Ref: {r.booking_ref}</Text> : null}
                  </View>
                  {r.cost ? <Text style={styles.bookingCost}>{r.cost} {r.currency}</Text> : null}
                  <TouchableOpacity
                    style={styles.inlineActionBtn}
                    onPress={() => {
                      setEditingRestaurant(r);
                      setShowRestaurantForm(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="create-outline" size={16} color={colors.foreground} />
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          {activities.length > 0 && (
            <>
              <Text style={[styles.bookingsSectionTitle, restaurants.length > 0 && { marginTop: 20 }]}>Attività</Text>
              {activities.map((a) => (
                <View key={a.id} style={styles.bookingCard}>
                  <View style={styles.bookingIconCircle}>
                    <Ionicons name="ticket-outline" size={18} color={colors.foreground} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bookingName}>{a.name}</Text>
                    <Text style={styles.bookingMeta}>{a.type}</Text>
                    {a.date ? <Text style={styles.bookingMeta}>{formatDate(a.date)}{a.time ? ` alle ${a.time}` : ''}</Text> : null}
                    {a.duration_min ? <Text style={styles.bookingMeta}>{a.duration_min} min</Text> : null}
                    {a.booking_ref ? <Text style={styles.bookingRef}>Ref: {a.booking_ref}</Text> : null}
                  </View>
                  {a.cost ? <Text style={styles.bookingCost}>{a.cost} {a.currency}</Text> : null}
                  <TouchableOpacity
                    style={styles.inlineActionBtn}
                    onPress={() => {
                      setEditingActivity(a);
                      setShowActivityForm(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="create-outline" size={16} color={colors.foreground} />
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          {restaurants.length === 0 && activities.length === 0 && (
            <EmptyState icon="calendar-outline" title="Nessuna prenotazione" subtitle="Ristoranti e attività prenotate appariranno qui." />
          )}
        </ScrollView>
      )}

      {activeTab === 'blog' && (
        <ScrollView
          style={styles.tabContent}
          contentContainerStyle={styles.tabContentPadded}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshingPosts} onRefresh={refetchPosts} tintColor={colors.foreground} />
          }
        >
          <View style={styles.sectionActionBar}>
            <Text style={styles.sectionActionTitle}>Post del viaggio</Text>
            <TouchableOpacity
              style={styles.sectionAddBtn}
              onPress={() => {
                setEditingPost(null);
                setShowPostForm((prev) => !prev);
              }}
            >
              <Ionicons name="add" size={16} color={colors.primaryForeground} />
              <Text style={styles.sectionAddBtnText}>Nuovo post</Text>
            </TouchableOpacity>
          </View>

          {showPostForm && (
            <PostForm
              tripId={tripId}
              userId={user?.id ?? ''}
              colors={colors}
              post={editingPost}
              onClose={() => {
                setShowPostForm(false);
                setEditingPost(null);
              }}
              onSaved={() => {
                setShowPostForm(false);
                setEditingPost(null);
                refetchPosts();
              }}
              onDeleted={() => {
                setShowPostForm(false);
                setEditingPost(null);
                refetchPosts();
              }}
            />
          )}

          {posts.length === 0 ? (
            <EmptyState icon="book-outline" title="Nessun post" subtitle="Crea il primo post blog per questo viaggio." />
          ) : (
            posts.map((post) => (
              <View key={post.id} style={styles.bookingCard}>
                <View style={styles.bookingIconCircle}>
                  <Ionicons name="book-outline" size={18} color={colors.foreground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bookingName}>{post.title}</Text>
                  <Text style={styles.bookingMeta}>/{post.slug}</Text>
                  <Text style={styles.bookingMeta}>{post.status === 'published' ? 'Pubblicato' : 'Bozza'}</Text>
                  {post.published_at ? <Text style={styles.bookingMeta}>{formatDate(post.published_at)}</Text> : null}
                </View>
                <TouchableOpacity
                  style={styles.inlineActionBtn}
                  onPress={() => {
                    setEditingPost(post);
                    setShowPostForm(true);
                  }}
                >
                  <Ionicons name="create-outline" size={16} color={colors.foreground} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

function DayForm({
  tripId,
  userId,
  colors,
  day,
  nextSortOrder,
  onClose,
  onSaved,
  onDeleted,
}: {
  tripId: string;
  userId: string;
  colors: any;
  day?: Day | null;
  nextSortOrder: number;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}) {
  const [date, setDate] = useState(day?.date ?? '');
  const [title, setTitle] = useState(day?.title ?? '');
  const [notes, setNotes] = useState(day?.notes ?? '');

  useEffect(() => {
    setDate(day?.date ?? '');
    setTitle(day?.title ?? '');
    setNotes(day?.notes ?? '');
  }, [day]);

  const mutation = useMutation({
    mutationFn: async () => {
      await requireTripMember(tripId, userId);
      const cleanDate = date.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
        throw new Error('Data non valida. Usa il formato AAAA-MM-GG.');
      }

      const payload = {
        date: cleanDate,
        title: sanitizeTextInput(title, 120) || null,
        notes: sanitizeTextInput(notes, 1000) || null,
      };

      const { error } = day
        ? await supabase.from('days').update(payload).eq('id', day.id).eq('trip_id', tripId)
        : await supabase.from('days').insert({ ...payload, trip_id: tripId, sort_order: nextSortOrder });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['days', tripId] });
      safeNotificationHaptic(Haptics.NotificationFeedbackType.Success);
      onSaved();
    },
    onError: (err: Error) => Alert.alert('Errore', err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!day) return;
      await requireTripMember(tripId, userId);
      const { error } = await supabase.from('days').delete().eq('id', day.id).eq('trip_id', tripId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['days', tripId] });
      safeNotificationHaptic(Haptics.NotificationFeedbackType.Success);
      onDeleted?.();
    },
    onError: (err: Error) => Alert.alert('Errore', err.message),
  });

  const styles = StyleSheet.create({
    form: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12 },
    input: { backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontFamily: 'DMSans_400Regular', color: colors.foreground, marginBottom: 10 },
    label: { fontSize: 12, fontFamily: 'DMSans_700Bold', color: colors.mutedForeground, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 6 },
    actions: { flexDirection: 'row' as const, gap: 8 },
    btn: { flex: 1, backgroundColor: colors.primary, borderRadius: 10, height: 44, alignItems: 'center' as const, justifyContent: 'center' as const },
    btnSec: { flex: 1, backgroundColor: colors.muted, borderRadius: 10, height: 44, alignItems: 'center' as const, justifyContent: 'center' as const },
    btnTxt: { color: colors.primaryForeground, fontFamily: 'DMSans_700Bold', fontSize: 14 },
    btnTxtSec: { color: colors.foreground, fontFamily: 'DMSans_700Bold', fontSize: 14 },
  });

  return (
    <View style={styles.form}>
      <Text style={styles.label}>{day ? 'Modifica giorno' : 'Nuovo giorno'}</Text>
      <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="AAAA-MM-GG" placeholderTextColor={colors.mutedForeground} />
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Titolo (opzionale)" placeholderTextColor={colors.mutedForeground} />
      <TextInput style={[styles.input, { minHeight: 70 }]} value={notes} onChangeText={setNotes} multiline placeholder="Note (opzionale)" placeholderTextColor={colors.mutedForeground} />
      <View style={styles.actions}>
        <TouchableOpacity style={styles.btnSec} onPress={onClose}><Text style={styles.btnTxtSec}>Annulla</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? <ActivityIndicator color={colors.primaryForeground} size="small" /> : <Text style={styles.btnTxt}>Salva</Text>}
        </TouchableOpacity>
      </View>
      {day && (
        <TouchableOpacity
          style={[styles.btnSec, { marginTop: 8, backgroundColor: colors.destructive }]}
          onPress={() => {
            Alert.alert('Elimina giorno', 'Vuoi eliminare questo giorno?', [
              { text: 'Annulla', style: 'cancel' },
              { text: 'Elimina', style: 'destructive', onPress: () => deleteMutation.mutate() },
            ]);
          }}
        >
          <Text style={[styles.btnTxtSec, { color: colors.destructiveForeground }]}>Elimina</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function RestaurantForm({
  tripId,
  userId,
  colors,
  restaurant,
  onClose,
  onSaved,
  onDeleted,
}: {
  tripId: string;
  userId: string;
  colors: any;
  restaurant?: Restaurant | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}) {
  const [name, setName] = useState(restaurant?.name ?? '');
  const [cuisine, setCuisine] = useState(restaurant?.cuisine_type ?? '');
  const [date, setDate] = useState(restaurant?.date ?? '');
  const [time, setTime] = useState(restaurant?.time ?? '');
  const [cost, setCost] = useState(restaurant?.cost ? String(restaurant.cost) : '');
  const [currency, setCurrency] = useState(restaurant?.currency ?? 'EUR');
  const [bookingRef, setBookingRef] = useState(restaurant?.booking_ref ?? '');

  useEffect(() => {
    setName(restaurant?.name ?? '');
    setCuisine(restaurant?.cuisine_type ?? '');
    setDate(restaurant?.date ?? '');
    setTime(restaurant?.time ?? '');
    setCost(restaurant?.cost ? String(restaurant.cost) : '');
    setCurrency(restaurant?.currency ?? 'EUR');
    setBookingRef(restaurant?.booking_ref ?? '');
  }, [restaurant]);

  const mutation = useMutation({
    mutationFn: async () => {
      await requireTripMember(tripId, userId);
      const cleanName = sanitizeTextInput(name, 180);
      if (!cleanName) throw new Error('Inserisci il nome del ristorante.');
      const parsedCost = cost.trim() ? Number.parseFloat(cost) : null;
      if (parsedCost !== null && (!Number.isFinite(parsedCost) || parsedCost < 0)) {
        throw new Error('Costo non valido.');
      }
      const cleanCurrency = currency.trim().toUpperCase() || 'EUR';

      const payload = {
        name: cleanName,
        cuisine_type: sanitizeTextInput(cuisine, 80) || null,
        date: date.trim() || null,
        time: time.trim() || null,
        cost: parsedCost,
        currency: cleanCurrency,
        booking_ref: sanitizeTextInput(bookingRef, 80) || null,
      };

      const { error } = restaurant
        ? await supabase.from('restaurants').update(payload).eq('id', restaurant.id).eq('trip_id', tripId)
        : await supabase.from('restaurants').insert({ ...payload, trip_id: tripId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurants', tripId] });
      safeNotificationHaptic(Haptics.NotificationFeedbackType.Success);
      onSaved();
    },
    onError: (err: Error) => Alert.alert('Errore', err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!restaurant) return;
      await requireTripMember(tripId, userId);
      const { error } = await supabase.from('restaurants').delete().eq('id', restaurant.id).eq('trip_id', tripId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurants', tripId] });
      safeNotificationHaptic(Haptics.NotificationFeedbackType.Success);
      onDeleted?.();
    },
    onError: (err: Error) => Alert.alert('Errore', err.message),
  });

  const styles = StyleSheet.create({
    form: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12 },
    row: { flexDirection: 'row' as const, gap: 8, marginBottom: 10 },
    input: { flex: 1, backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontFamily: 'DMSans_400Regular', color: colors.foreground },
    label: { fontSize: 12, fontFamily: 'DMSans_700Bold', color: colors.mutedForeground, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 10 },
    actions: { flexDirection: 'row' as const, gap: 8 },
    btn: { flex: 1, backgroundColor: colors.primary, borderRadius: 10, height: 44, alignItems: 'center' as const, justifyContent: 'center' as const },
    btnSec: { flex: 1, backgroundColor: colors.muted, borderRadius: 10, height: 44, alignItems: 'center' as const, justifyContent: 'center' as const },
    btnTxt: { color: colors.primaryForeground, fontFamily: 'DMSans_700Bold', fontSize: 14 },
    btnTxtSec: { color: colors.foreground, fontFamily: 'DMSans_700Bold', fontSize: 14 },
  });

  return (
    <View style={styles.form}>
      <Text style={styles.label}>{restaurant ? 'Modifica ristorante' : 'Nuovo ristorante'}</Text>
      <View style={styles.row}>
        <TextInput style={[styles.input, { flex: 1.4 }]} value={name} onChangeText={setName} placeholder="Nome" placeholderTextColor={colors.mutedForeground} />
        <TextInput style={styles.input} value={cuisine} onChangeText={setCuisine} placeholder="Cucina" placeholderTextColor={colors.mutedForeground} />
      </View>
      <View style={styles.row}>
        <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="AAAA-MM-GG" placeholderTextColor={colors.mutedForeground} />
        <TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="HH:MM" placeholderTextColor={colors.mutedForeground} />
      </View>
      <View style={styles.row}>
        <TextInput style={styles.input} value={cost} onChangeText={setCost} placeholder="Costo" keyboardType="numeric" placeholderTextColor={colors.mutedForeground} />
        <TextInput style={styles.input} value={currency} onChangeText={setCurrency} placeholder="EUR" maxLength={3} autoCapitalize="characters" placeholderTextColor={colors.mutedForeground} />
        <TextInput style={[styles.input, { flex: 1.4 }]} value={bookingRef} onChangeText={setBookingRef} placeholder="Ref" placeholderTextColor={colors.mutedForeground} />
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.btnSec} onPress={onClose}><Text style={styles.btnTxtSec}>Annulla</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? <ActivityIndicator color={colors.primaryForeground} size="small" /> : <Text style={styles.btnTxt}>Salva</Text>}
        </TouchableOpacity>
      </View>
      {restaurant && (
        <TouchableOpacity
          style={[styles.btnSec, { marginTop: 8, backgroundColor: colors.destructive }]}
          onPress={() => {
            Alert.alert('Elimina ristorante', 'Vuoi eliminare questa prenotazione?', [
              { text: 'Annulla', style: 'cancel' },
              { text: 'Elimina', style: 'destructive', onPress: () => deleteMutation.mutate() },
            ]);
          }}
        >
          <Text style={[styles.btnTxtSec, { color: colors.destructiveForeground }]}>Elimina</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function ActivityForm({
  tripId,
  userId,
  colors,
  activity,
  onClose,
  onSaved,
  onDeleted,
}: {
  tripId: string;
  userId: string;
  colors: any;
  activity?: Activity | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}) {
  const [name, setName] = useState(activity?.name ?? '');
  const [type, setType] = useState<ActivityType>(activity?.type ?? 'tour');
  const [date, setDate] = useState(activity?.date ?? '');
  const [time, setTime] = useState(activity?.time ?? '');
  const [duration, setDuration] = useState(activity?.duration_min ? String(activity.duration_min) : '');
  const [cost, setCost] = useState(activity?.cost ? String(activity.cost) : '');
  const [currency, setCurrency] = useState(activity?.currency ?? 'EUR');
  const [bookingRef, setBookingRef] = useState(activity?.booking_ref ?? '');

  useEffect(() => {
    setName(activity?.name ?? '');
    setType(activity?.type ?? 'tour');
    setDate(activity?.date ?? '');
    setTime(activity?.time ?? '');
    setDuration(activity?.duration_min ? String(activity.duration_min) : '');
    setCost(activity?.cost ? String(activity.cost) : '');
    setCurrency(activity?.currency ?? 'EUR');
    setBookingRef(activity?.booking_ref ?? '');
  }, [activity]);

  const TYPES: ActivityType[] = ['museum', 'tour', 'excursion', 'show', 'sport', 'other'];

  const mutation = useMutation({
    mutationFn: async () => {
      await requireTripMember(tripId, userId);
      const cleanName = sanitizeTextInput(name, 180);
      if (!cleanName) throw new Error('Inserisci il nome dell\'attivita.');

      const parsedCost = cost.trim() ? Number.parseFloat(cost) : null;
      if (parsedCost !== null && (!Number.isFinite(parsedCost) || parsedCost < 0)) {
        throw new Error('Costo non valido.');
      }

      const parsedDuration = duration.trim() ? Number.parseInt(duration, 10) : null;
      if (parsedDuration !== null && (!Number.isFinite(parsedDuration) || parsedDuration < 0)) {
        throw new Error('Durata non valida.');
      }

      const payload = {
        name: cleanName,
        type,
        date: date.trim() || null,
        time: time.trim() || null,
        duration_min: parsedDuration,
        cost: parsedCost,
        currency: currency.trim().toUpperCase() || 'EUR',
        booking_ref: sanitizeTextInput(bookingRef, 80) || null,
      };

      const { error } = activity
        ? await supabase.from('activities').update(payload).eq('id', activity.id).eq('trip_id', tripId)
        : await supabase.from('activities').insert({ ...payload, trip_id: tripId });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', tripId] });
      safeNotificationHaptic(Haptics.NotificationFeedbackType.Success);
      onSaved();
    },
    onError: (err: Error) => Alert.alert('Errore', err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!activity) return;
      await requireTripMember(tripId, userId);
      const { error } = await supabase.from('activities').delete().eq('id', activity.id).eq('trip_id', tripId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', tripId] });
      safeNotificationHaptic(Haptics.NotificationFeedbackType.Success);
      onDeleted?.();
    },
    onError: (err: Error) => Alert.alert('Errore', err.message),
  });

  const styles = StyleSheet.create({
    form: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12 },
    row: { flexDirection: 'row' as const, gap: 8, marginBottom: 10 },
    input: { flex: 1, backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontFamily: 'DMSans_400Regular', color: colors.foreground },
    label: { fontSize: 12, fontFamily: 'DMSans_700Bold', color: colors.mutedForeground, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 10 },
    actions: { flexDirection: 'row' as const, gap: 8 },
    btn: { flex: 1, backgroundColor: colors.primary, borderRadius: 10, height: 44, alignItems: 'center' as const, justifyContent: 'center' as const },
    btnSec: { flex: 1, backgroundColor: colors.muted, borderRadius: 10, height: 44, alignItems: 'center' as const, justifyContent: 'center' as const },
    btnTxt: { color: colors.primaryForeground, fontFamily: 'DMSans_700Bold', fontSize: 14 },
    btnTxtSec: { color: colors.foreground, fontFamily: 'DMSans_700Bold', fontSize: 14 },
  });

  return (
    <View style={styles.form}>
      <Text style={styles.label}>{activity ? 'Modifica attività' : 'Nuova attività'}</Text>
      <View style={styles.row}>
        <TextInput style={[styles.input, { flex: 1.5 }]} value={name} onChangeText={setName} placeholder="Nome" placeholderTextColor={colors.mutedForeground} />
        <View style={[styles.input, { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 4 }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setType(t)}
                  style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: type === t ? colors.primary : colors.muted }}
                >
                  <Text style={{ fontSize: 11, fontFamily: 'DMSans_500Medium', color: type === t ? colors.primaryForeground : colors.mutedForeground }}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
      <View style={styles.row}>
        <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="AAAA-MM-GG" placeholderTextColor={colors.mutedForeground} />
        <TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="HH:MM" placeholderTextColor={colors.mutedForeground} />
      </View>
      <View style={styles.row}>
        <TextInput style={styles.input} value={duration} onChangeText={setDuration} keyboardType="numeric" placeholder="Durata min" placeholderTextColor={colors.mutedForeground} />
        <TextInput style={styles.input} value={cost} onChangeText={setCost} keyboardType="numeric" placeholder="Costo" placeholderTextColor={colors.mutedForeground} />
        <TextInput style={[styles.input, { flex: 0.7 }]} value={currency} onChangeText={setCurrency} placeholder="EUR" maxLength={3} autoCapitalize="characters" placeholderTextColor={colors.mutedForeground} />
      </View>
      <TextInput style={styles.input} value={bookingRef} onChangeText={setBookingRef} placeholder="Riferimento prenotazione" placeholderTextColor={colors.mutedForeground} />
      <View style={styles.actions}>
        <TouchableOpacity style={styles.btnSec} onPress={onClose}><Text style={styles.btnTxtSec}>Annulla</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? <ActivityIndicator color={colors.primaryForeground} size="small" /> : <Text style={styles.btnTxt}>Salva</Text>}
        </TouchableOpacity>
      </View>
      {activity && (
        <TouchableOpacity
          style={[styles.btnSec, { marginTop: 8, backgroundColor: colors.destructive }]}
          onPress={() => {
            Alert.alert('Elimina attività', 'Vuoi eliminare questa attività?', [
              { text: 'Annulla', style: 'cancel' },
              { text: 'Elimina', style: 'destructive', onPress: () => deleteMutation.mutate() },
            ]);
          }}
        >
          <Text style={[styles.btnTxtSec, { color: colors.destructiveForeground }]}>Elimina</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function MediaForm({
  tripId,
  userId,
  colors,
  media,
  onClose,
  onSaved,
  onDeleted,
}: {
  tripId: string;
  userId: string;
  colors: any;
  media?: Media | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}) {
  const [url, setUrl] = useState(media?.url ?? '');
  const [thumbnailUrl, setThumbnailUrl] = useState(media?.thumbnail_url ?? '');
  const [caption, setCaption] = useState(media?.caption ?? '');

  useEffect(() => {
    setUrl(media?.url ?? '');
    setThumbnailUrl(media?.thumbnail_url ?? '');
    setCaption(media?.caption ?? '');
  }, [media]);

  const mutation = useMutation({
    mutationFn: async () => {
      await requireTripMember(tripId, userId);
      const cleanUrl = url.trim();
      if (!/^https?:\/\//i.test(cleanUrl)) {
        throw new Error('Inserisci una URL valida (http/https).');
      }

      const payload = {
        url: cleanUrl,
        thumbnail_url: thumbnailUrl.trim() || null,
        caption: sanitizeTextInput(caption, 300) || null,
      };

      const { error } = media
        ? await supabase.from('media').update(payload).eq('id', media.id).eq('trip_id', tripId)
        : await supabase.from('media').insert({ ...payload, trip_id: tripId, uploaded_by: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media', tripId] });
      safeNotificationHaptic(Haptics.NotificationFeedbackType.Success);
      onSaved();
    },
    onError: (err: Error) => Alert.alert('Errore', err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!media) return;
      await requireTripMember(tripId, userId);
      const { error } = await supabase.from('media').delete().eq('id', media.id).eq('trip_id', tripId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media', tripId] });
      safeNotificationHaptic(Haptics.NotificationFeedbackType.Success);
      onDeleted?.();
    },
    onError: (err: Error) => Alert.alert('Errore', err.message),
  });

  const styles = StyleSheet.create({
    form: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12, marginHorizontal: 8 },
    input: { backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontFamily: 'DMSans_400Regular', color: colors.foreground, marginBottom: 10 },
    label: { fontSize: 12, fontFamily: 'DMSans_700Bold', color: colors.mutedForeground, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 10 },
    actions: { flexDirection: 'row' as const, gap: 8 },
    btn: { flex: 1, backgroundColor: colors.primary, borderRadius: 10, height: 44, alignItems: 'center' as const, justifyContent: 'center' as const },
    btnSec: { flex: 1, backgroundColor: colors.muted, borderRadius: 10, height: 44, alignItems: 'center' as const, justifyContent: 'center' as const },
    btnTxt: { color: colors.primaryForeground, fontFamily: 'DMSans_700Bold', fontSize: 14 },
    btnTxtSec: { color: colors.foreground, fontFamily: 'DMSans_700Bold', fontSize: 14 },
  });

  return (
    <View style={styles.form}>
      <Text style={styles.label}>{media ? 'Modifica media' : 'Nuovo media'}</Text>
      <TextInput style={styles.input} value={url} onChangeText={setUrl} placeholder="URL file" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" />
      <TextInput style={styles.input} value={thumbnailUrl} onChangeText={setThumbnailUrl} placeholder="URL thumbnail (opzionale)" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" />
      <TextInput style={styles.input} value={caption} onChangeText={setCaption} placeholder="Caption" placeholderTextColor={colors.mutedForeground} />
      <View style={styles.actions}>
        <TouchableOpacity style={styles.btnSec} onPress={onClose}><Text style={styles.btnTxtSec}>Annulla</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? <ActivityIndicator color={colors.primaryForeground} size="small" /> : <Text style={styles.btnTxt}>Salva</Text>}
        </TouchableOpacity>
      </View>
      {media && (
        <TouchableOpacity
          style={[styles.btnSec, { marginTop: 8, backgroundColor: colors.destructive }]}
          onPress={() => {
            Alert.alert('Elimina media', 'Vuoi eliminare questo elemento?', [
              { text: 'Annulla', style: 'cancel' },
              { text: 'Elimina', style: 'destructive', onPress: () => deleteMutation.mutate() },
            ]);
          }}
        >
          <Text style={[styles.btnTxtSec, { color: colors.destructiveForeground }]}>Elimina</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function StatBox({ icon, label, value, colors }: { icon: string; label: string; value: string; colors: any }) {
  return (
    <View style={{ flex: 1, minWidth: '45%', backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, margin: 4 }}>
      <Ionicons name={icon as any} size={18} color={colors.mutedForeground} />
      <Text style={{ fontSize: 11, fontFamily: 'DMSans_400Regular', color: colors.mutedForeground, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
      <Text style={{ fontSize: 15, fontFamily: 'DMSans_700Bold', color: colors.foreground, marginTop: 2 }}>{value}</Text>
    </View>
  );
}

function EditTripForm({
  trip,
  isPending,
  onClose,
  onSave,
  colors,
}: {
  trip: Trip;
  isPending: boolean;
  onClose: () => void;
  onSave: (payload: NewTripData) => void;
  colors: any;
}) {
  const [title, setTitle] = useState(trip.title);
  const [destination, setDestination] = useState(trip.destination);
  const [startDate, setStartDate] = useState(trip.start_date ?? '');
  const [endDate, setEndDate] = useState(trip.end_date ?? '');
  const [description, setDescription] = useState(trip.description ?? '');

  useEffect(() => {
    setTitle(trip.title);
    setDestination(trip.destination);
    setStartDate(trip.start_date ?? '');
    setEndDate(trip.end_date ?? '');
    setDescription(trip.description ?? '');
  }, [trip]);

  const styles = StyleSheet.create({
    form: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16, marginTop: 12 },
    label: { fontSize: 12, fontFamily: 'DMSans_700Bold', color: colors.mutedForeground, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 6 },
    input: { backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontFamily: 'DMSans_400Regular', color: colors.foreground, marginBottom: 10 },
    row: { flexDirection: 'row' as const, gap: 8 },
    actions: { flexDirection: 'row' as const, gap: 8, marginTop: 4 },
    btn: { flex: 1, backgroundColor: colors.primary, borderRadius: 10, height: 44, alignItems: 'center' as const, justifyContent: 'center' as const },
    btnSec: { flex: 1, backgroundColor: colors.muted, borderRadius: 10, height: 44, alignItems: 'center' as const, justifyContent: 'center' as const },
    btnTxt: { color: colors.primaryForeground, fontFamily: 'DMSans_700Bold', fontSize: 14 },
    btnTxtSec: { color: colors.foreground, fontFamily: 'DMSans_700Bold', fontSize: 14 },
  });

  return (
    <View style={styles.form}>
      <Text style={styles.label}>Modifica viaggio</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Titolo" placeholderTextColor={colors.mutedForeground} />
      <TextInput style={styles.input} value={destination} onChangeText={setDestination} placeholder="Destinazione" placeholderTextColor={colors.mutedForeground} />
      <View style={styles.row}>
        <TextInput style={[styles.input, { flex: 1 }]} value={startDate} onChangeText={setStartDate} placeholder="AAAA-MM-GG" placeholderTextColor={colors.mutedForeground} />
        <TextInput style={[styles.input, { flex: 1 }]} value={endDate} onChangeText={setEndDate} placeholder="AAAA-MM-GG" placeholderTextColor={colors.mutedForeground} />
      </View>
      <TextInput
        style={[styles.input, { minHeight: 80 }]}
        value={description}
        onChangeText={setDescription}
        multiline
        placeholder="Descrizione"
        placeholderTextColor={colors.mutedForeground}
      />
      <View style={styles.actions}>
        <TouchableOpacity style={styles.btnSec} onPress={onClose}>
          <Text style={styles.btnTxtSec}>Annulla</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => onSave({ title, destination, start_date: startDate, end_date: endDate, description })}
          disabled={isPending}
        >
          {isPending ? <ActivityIndicator color={colors.primaryForeground} size="small" /> : <Text style={styles.btnTxt}>Salva</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ExpenseForm({ tripId, userId, days, colors, onClose, onSaved, expense, onDeleted }: {
  tripId: string; userId: string; days: DayWithDetails[]; colors: any; onClose: () => void; onSaved: () => void; expense?: Expense | null; onDeleted?: () => void;
}) {
  const [desc, setDesc] = useState(expense?.description ?? '');
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [currency, setCurrency] = useState(expense?.currency ?? 'EUR');
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? 'other');
  const [split, setSplit] = useState(expense?.split ?? true);
  const [date, setDate] = useState(expense?.date ?? '');
  const [notes, setNotes] = useState(expense?.notes ?? '');
  const [dayId, setDayId] = useState<string>(expense?.day_id ?? '');

  useEffect(() => {
    setDesc(expense?.description ?? '');
    setAmount(expense ? String(expense.amount) : '');
    setCurrency(expense?.currency ?? 'EUR');
    setCategory(expense?.category ?? 'other');
    setSplit(expense?.split ?? true);
    setDate(expense?.date ?? '');
    setNotes(expense?.notes ?? '');
    setDayId(expense?.day_id ?? '');
  }, [expense]);

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = validateExpenseInput(desc, amount, currency);

      // Enforce app-level authorization before insert; payer is the current user on mobile.
      await requireTripMember(tripId, userId);
      const amountInEur = await convertCurrencyToEur(parsed.amount, parsed.currency);

      const payload = {
        description: parsed.description,
        amount: parsed.amount,
        currency: parsed.currency,
        category,
        split,
        day_id: dayId || null,
        date: date.trim() || null,
        notes: sanitizeTextInput(notes, 1000) || null,
        amount_eur: amountInEur,
      };

      const { error } = expense
        ? await supabase
            .from('expenses')
            .update(payload)
            .eq('id', expense.id)
            .eq('trip_id', tripId)
        : await supabase.from('expenses').insert({
            ...payload,
            trip_id: tripId,
            paid_by: userId,
            date: new Date().toISOString().split('T')[0],
          });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', tripId] });
      safeNotificationHaptic(Haptics.NotificationFeedbackType.Success);
      onSaved();
    },
    onError: (err: Error) => Alert.alert('Errore', err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!expense) return;
      await requireTripMember(tripId, userId);
      const { error } = await supabase.from('expenses').delete().eq('id', expense.id).eq('trip_id', tripId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', tripId] });
      safeNotificationHaptic(Haptics.NotificationFeedbackType.Success);
      onDeleted?.();
    },
    onError: (err: Error) => Alert.alert('Errore', err.message),
  });

  const styles = StyleSheet.create({
    form: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12 },
    row: { flexDirection: 'row' as const, gap: 8, marginBottom: 10 },
    input: { flex: 1, backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontFamily: 'DMSans_400Regular', color: colors.foreground },
    label: { fontSize: 12, fontFamily: 'DMSans_700Bold', color: colors.mutedForeground, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 6 },
    splitRow: { flexDirection: 'row' as const, alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    actions: { flexDirection: 'row' as const, gap: 8 },
    btn: { flex: 1, backgroundColor: colors.primary, borderRadius: 10, height: 44, alignItems: 'center' as const, justifyContent: 'center' as const },
    btnSec: { flex: 1, backgroundColor: colors.muted, borderRadius: 10, height: 44, alignItems: 'center' as const, justifyContent: 'center' as const },
    btnTxt: { color: colors.primaryForeground, fontFamily: 'DMSans_700Bold', fontSize: 14 },
    btnTxtSec: { color: colors.foreground, fontFamily: 'DMSans_700Bold', fontSize: 14 },
  });

  const CATEGORIES: ExpenseCategory[] = ['food', 'transport', 'accommodation', 'activity', 'shopping', 'other'];
  const CAT_LABELS: Record<ExpenseCategory, string> = { food: 'Cibo', transport: 'Trasporto', accommodation: 'Alloggio', activity: 'Attività', shopping: 'Shopping', other: 'Altro' };

  return (
    <View style={[styles.form, { marginHorizontal: 16 }]}>
      <Text style={[styles.label, { marginBottom: 10 }]}>{expense ? 'Modifica spesa' : 'Nuova spesa'}</Text>
      <View style={styles.row}>
        <TextInput style={[styles.input, { flex: 2 }]} placeholder="Descrizione" placeholderTextColor={colors.mutedForeground} value={desc} onChangeText={setDesc} />
        <TextInput style={styles.input} placeholder="Importo" placeholderTextColor={colors.mutedForeground} value={amount} onChangeText={setAmount} keyboardType="numeric" />
        <TextInput style={[styles.input, { flex: 0.6 }]} placeholder="EUR" placeholderTextColor={colors.mutedForeground} value={currency} onChangeText={setCurrency} autoCapitalize="characters" maxLength={3} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: category === cat ? colors.primary : colors.muted, borderWidth: 1, borderColor: category === cat ? colors.primary : colors.border }}
              onPress={() => setCategory(cat)}
            >
              <Text style={{ fontSize: 12, fontFamily: 'DMSans_500Medium', color: category === cat ? colors.primaryForeground : colors.mutedForeground }}>{CAT_LABELS[cat]}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <View style={styles.splitRow}>
        <Text style={{ fontFamily: 'DMSans_500Medium', color: colors.foreground, fontSize: 14 }}>Dividi con il partner</Text>
        <TouchableOpacity onPress={() => setSplit(!split)} style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: split ? colors.success : colors.muted, justifyContent: 'center', paddingHorizontal: 2 }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.surface, transform: [{ translateX: split ? 18 : 0 }] }} />
        </TouchableOpacity>
      </View>
      <TextInput style={styles.input} placeholder="Data (AAAA-MM-GG)" placeholderTextColor={colors.mutedForeground} value={date} onChangeText={setDate} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity
            style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: !dayId ? colors.primary : colors.muted }}
            onPress={() => setDayId('')}
          >
            <Text style={{ color: !dayId ? colors.primaryForeground : colors.mutedForeground, fontFamily: 'DMSans_500Medium', fontSize: 12 }}>Nessun giorno</Text>
          </TouchableOpacity>
          {days.map((d) => (
            <TouchableOpacity
              key={d.id}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: dayId === d.id ? colors.primary : colors.muted }}
              onPress={() => setDayId(d.id)}
            >
              <Text style={{ color: dayId === d.id ? colors.primaryForeground : colors.mutedForeground, fontFamily: 'DMSans_500Medium', fontSize: 12 }}>
                {d.title || formatDate(d.date)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <TextInput
        style={[styles.input, { minHeight: 70 }]}
        multiline
        placeholder="Note"
        placeholderTextColor={colors.mutedForeground}
        value={notes}
        onChangeText={setNotes}
      />
      <View style={styles.actions}>
        <TouchableOpacity style={styles.btnSec} onPress={onClose}><Text style={styles.btnTxtSec}>Annulla</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => mutation.mutate()} disabled={!desc || !amount || mutation.isPending}>
          {mutation.isPending ? <ActivityIndicator color={colors.primaryForeground} size="small" /> : <Text style={styles.btnTxt}>Salva</Text>}
        </TouchableOpacity>
      </View>
      {expense && (
        <TouchableOpacity
          style={[styles.btnSec, { marginTop: 8, backgroundColor: colors.destructive }]}
          onPress={() => {
            Alert.alert('Elimina spesa', 'Vuoi eliminare questa spesa?', [
              { text: 'Annulla', style: 'cancel' },
              {
                text: 'Elimina',
                style: 'destructive',
                onPress: () => deleteMutation.mutate(),
              },
            ]);
          }}
          disabled={deleteMutation.isPending}
        >
          {deleteMutation.isPending ? <ActivityIndicator color={colors.destructiveForeground} size="small" /> : <Text style={[styles.btnTxtSec, { color: colors.destructiveForeground }]}>Elimina</Text>}
        </TouchableOpacity>
      )}
    </View>
  );
}

function LegForm({
  tripId,
  day,
  leg,
  userId,
  colors,
  onClose,
  onSaved,
  onDeleted,
}: {
  tripId: string;
  day: DayWithDetails;
  leg?: Leg | null;
  userId: string;
  colors: any;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}) {
  const [fromName, setFromName] = useState(leg?.from_name ?? '');
  const [toName, setToName] = useState(leg?.to_name ?? '');
  const [type, setType] = useState<Leg['type']>(leg?.type ?? 'train');
  const [cost, setCost] = useState(leg?.cost ? String(leg.cost) : '');
  const [currency, setCurrency] = useState(leg?.currency ?? 'EUR');

  useEffect(() => {
    setFromName(leg?.from_name ?? '');
    setToName(leg?.to_name ?? '');
    setType(leg?.type ?? 'train');
    setCost(leg?.cost ? String(leg.cost) : '');
    setCurrency(leg?.currency ?? 'EUR');
  }, [leg]);

  const mutation = useMutation({
    mutationFn: async () => {
      await requireTripMember(tripId, userId);
      const cleanFrom = sanitizeTextInput(fromName, 200);
      const cleanTo = sanitizeTextInput(toName, 200);
      if (!cleanFrom || !cleanTo) throw new Error('Inserisci partenza e destinazione.');

      const parsedCost = cost.trim() ? Number.parseFloat(cost) : null;
      if (parsedCost !== null && (!Number.isFinite(parsedCost) || parsedCost < 0)) {
        throw new Error('Costo non valido.');
      }

      const payload = {
        from_name: cleanFrom,
        to_name: cleanTo,
        type,
        cost: parsedCost,
        currency: currency.trim().toUpperCase() || 'EUR',
      };

      const { data, error } = leg
        ? await supabase.from('legs').update(payload).eq('id', leg.id).eq('trip_id', tripId).eq('day_id', day.id).select().single()
        : await supabase.from('legs').insert({ ...payload, trip_id: tripId, day_id: day.id }).select().single();

      if (error) throw error;

      const description = `Spostamento: ${data.from_name} → ${data.to_name}`;
      if (data.cost && data.cost > 0) {
        const amount_eur = await convertCurrencyToEur(Number(data.cost), data.currency);
        const { data: existing } = await supabase
          .from('expenses')
          .select('id')
          .eq('trip_id', tripId)
          .eq('day_id', day.id)
          .like('description', 'Spostamento:%')
          .maybeSingle();
        if (existing?.id) {
          await supabase.from('expenses').update({
            description,
            amount: data.cost,
            currency: data.currency,
            amount_eur,
            category: 'transport',
            date: day.date,
          }).eq('id', existing.id);
        } else {
          await supabase.from('expenses').insert({
            trip_id: tripId,
            day_id: day.id,
            description,
            amount: data.cost,
            currency: data.currency,
            amount_eur,
            category: 'transport',
            paid_by: userId,
            split: true,
            date: day.date,
          });
        }
      } else {
        await supabase.from('expenses').delete().eq('trip_id', tripId).eq('day_id', day.id).like('description', 'Spostamento:%');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['days', tripId] });
      queryClient.invalidateQueries({ queryKey: ['expenses', tripId] });
      onSaved();
    },
    onError: (err: Error) => Alert.alert('Errore', err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!leg) return;
      await requireTripMember(tripId, userId);
      await supabase.from('expenses').delete().eq('trip_id', tripId).eq('day_id', day.id).like('description', 'Spostamento:%');
      const { error } = await supabase.from('legs').delete().eq('id', leg.id).eq('trip_id', tripId).eq('day_id', day.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['days', tripId] });
      queryClient.invalidateQueries({ queryKey: ['expenses', tripId] });
      onDeleted?.();
    },
    onError: (err: Error) => Alert.alert('Errore', err.message),
  });

  return (
    <View style={stylesInlineForm(colors)}>
      <Text style={stylesInlineFormLabel(colors)}>{leg ? 'Modifica tratta' : 'Nuova tratta'}</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        <TextInput style={stylesInlineInput(colors)} placeholder="Da" placeholderTextColor={colors.mutedForeground} value={fromName} onChangeText={setFromName} />
        <TextInput style={stylesInlineInput(colors)} placeholder="A" placeholderTextColor={colors.mutedForeground} value={toName} onChangeText={setToName} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {(['flight', 'train', 'car', 'ferry', 'walk', 'bus', 'other'] as Leg['type'][]).map((t) => (
            <TouchableOpacity
              key={t}
              style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: type === t ? colors.primary : colors.muted }}
              onPress={() => setType(t)}
            >
              <Text style={{ color: type === t ? colors.primaryForeground : colors.mutedForeground, fontSize: 12, fontFamily: 'DMSans_500Medium' }}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        <TextInput style={stylesInlineInput(colors)} placeholder="Costo" placeholderTextColor={colors.mutedForeground} value={cost} onChangeText={setCost} keyboardType="numeric" />
        <TextInput style={stylesInlineInput(colors)} placeholder="EUR" placeholderTextColor={colors.mutedForeground} value={currency} onChangeText={setCurrency} autoCapitalize="characters" maxLength={3} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity style={stylesInlineBtnSec(colors)} onPress={onClose}><Text style={stylesInlineBtnSecText(colors)}>Annulla</Text></TouchableOpacity>
        <TouchableOpacity style={stylesInlineBtn(colors)} onPress={() => mutation.mutate()}>
          {mutation.isPending ? <ActivityIndicator color={colors.primaryForeground} size="small" /> : <Text style={stylesInlineBtnText(colors)}>Salva</Text>}
        </TouchableOpacity>
      </View>
      {leg && (
        <TouchableOpacity style={[stylesInlineBtnSec(colors), { marginTop: 8, backgroundColor: colors.destructive }]} onPress={() => deleteMutation.mutate()}>
          <Text style={[stylesInlineBtnSecText(colors), { color: colors.destructiveForeground }]}>Elimina</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function AccommodationForm({
  tripId,
  day,
  accommodation,
  userId,
  colors,
  onClose,
  onSaved,
  onDeleted,
}: {
  tripId: string;
  day: DayWithDetails;
  accommodation?: Accommodation | null;
  userId: string;
  colors: any;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}) {
  const [name, setName] = useState(accommodation?.name ?? '');
  const [checkIn, setCheckIn] = useState(accommodation?.check_in ?? '');
  const [checkOut, setCheckOut] = useState(accommodation?.check_out ?? '');
  const [cost, setCost] = useState(accommodation?.cost ? String(accommodation.cost) : '');
  const [currency, setCurrency] = useState(accommodation?.currency ?? 'EUR');

  useEffect(() => {
    setName(accommodation?.name ?? '');
    setCheckIn(accommodation?.check_in ?? '');
    setCheckOut(accommodation?.check_out ?? '');
    setCost(accommodation?.cost ? String(accommodation.cost) : '');
    setCurrency(accommodation?.currency ?? 'EUR');
  }, [accommodation]);

  const mutation = useMutation({
    mutationFn: async () => {
      await requireTripMember(tripId, userId);
      const cleanName = sanitizeTextInput(name, 200);
      if (!cleanName) throw new Error('Inserisci il nome alloggio.');
      const parsedCost = cost.trim() ? Number.parseFloat(cost) : null;
      if (parsedCost !== null && (!Number.isFinite(parsedCost) || parsedCost < 0)) throw new Error('Costo non valido.');

      const payload = {
        name: cleanName,
        check_in: checkIn.trim() || null,
        check_out: checkOut.trim() || null,
        cost: parsedCost,
        currency: currency.trim().toUpperCase() || 'EUR',
      };

      const { data, error } = accommodation
        ? await supabase.from('accommodations').update(payload).eq('id', accommodation.id).eq('trip_id', tripId).eq('day_id', day.id).select().single()
        : await supabase.from('accommodations').insert({ ...payload, trip_id: tripId, day_id: day.id }).select().single();
      if (error) throw error;

      const description = `Alloggio: ${data.name}`;
      if (data.cost && data.cost > 0) {
        const amount_eur = await convertCurrencyToEur(Number(data.cost), data.currency);
        const { data: existing } = await supabase
          .from('expenses')
          .select('id')
          .eq('trip_id', tripId)
          .eq('day_id', day.id)
          .like('description', 'Alloggio:%')
          .maybeSingle();
        if (existing?.id) {
          await supabase.from('expenses').update({
            description,
            amount: data.cost,
            currency: data.currency,
            amount_eur,
            category: 'accommodation',
            date: day.date,
          }).eq('id', existing.id);
        } else {
          await supabase.from('expenses').insert({
            trip_id: tripId,
            day_id: day.id,
            description,
            amount: data.cost,
            currency: data.currency,
            amount_eur,
            category: 'accommodation',
            paid_by: userId,
            split: true,
            date: day.date,
          });
        }
      } else {
        await supabase.from('expenses').delete().eq('trip_id', tripId).eq('day_id', day.id).like('description', 'Alloggio:%');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['days', tripId] });
      queryClient.invalidateQueries({ queryKey: ['expenses', tripId] });
      onSaved();
    },
    onError: (err: Error) => Alert.alert('Errore', err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!accommodation) return;
      await requireTripMember(tripId, userId);
      await supabase.from('expenses').delete().eq('trip_id', tripId).eq('day_id', day.id).like('description', 'Alloggio:%');
      const { error } = await supabase.from('accommodations').delete().eq('id', accommodation.id).eq('trip_id', tripId).eq('day_id', day.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['days', tripId] });
      queryClient.invalidateQueries({ queryKey: ['expenses', tripId] });
      onDeleted?.();
    },
    onError: (err: Error) => Alert.alert('Errore', err.message),
  });

  return (
    <View style={stylesInlineForm(colors)}>
      <Text style={stylesInlineFormLabel(colors)}>{accommodation ? 'Modifica alloggio' : 'Nuovo alloggio'}</Text>
      <TextInput style={[stylesInlineInput(colors), { marginBottom: 8 }]} placeholder="Nome" placeholderTextColor={colors.mutedForeground} value={name} onChangeText={setName} />
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        <TextInput style={stylesInlineInput(colors)} placeholder="Check-in AAAA-MM-GG" placeholderTextColor={colors.mutedForeground} value={checkIn} onChangeText={setCheckIn} />
        <TextInput style={stylesInlineInput(colors)} placeholder="Check-out AAAA-MM-GG" placeholderTextColor={colors.mutedForeground} value={checkOut} onChangeText={setCheckOut} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        <TextInput style={stylesInlineInput(colors)} placeholder="Costo" placeholderTextColor={colors.mutedForeground} value={cost} onChangeText={setCost} keyboardType="numeric" />
        <TextInput style={stylesInlineInput(colors)} placeholder="EUR" placeholderTextColor={colors.mutedForeground} value={currency} onChangeText={setCurrency} autoCapitalize="characters" maxLength={3} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity style={stylesInlineBtnSec(colors)} onPress={onClose}><Text style={stylesInlineBtnSecText(colors)}>Annulla</Text></TouchableOpacity>
        <TouchableOpacity style={stylesInlineBtn(colors)} onPress={() => mutation.mutate()}>
          {mutation.isPending ? <ActivityIndicator color={colors.primaryForeground} size="small" /> : <Text style={stylesInlineBtnText(colors)}>Salva</Text>}
        </TouchableOpacity>
      </View>
      {accommodation && (
        <TouchableOpacity style={[stylesInlineBtnSec(colors), { marginTop: 8, backgroundColor: colors.destructive }]} onPress={() => deleteMutation.mutate()}>
          <Text style={[stylesInlineBtnSecText(colors), { color: colors.destructiveForeground }]}>Elimina</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function PostForm({
  tripId,
  userId,
  colors,
  post,
  onClose,
  onSaved,
  onDeleted,
}: {
  tripId: string;
  userId: string;
  colors: any;
  post?: Post | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}) {
  const [title, setTitle] = useState(post?.title ?? '');
  const [slug, setSlug] = useState(post?.slug ?? '');
  const [status, setStatus] = useState<Post['status']>(post?.status ?? 'draft');
  const [coverImage, setCoverImage] = useState(post?.cover_image ?? '');
  const [seoDescription, setSeoDescription] = useState(post?.seo_description ?? '');
  const [bodyText, setBodyText] = useState(extractTextFromTiptap(post?.content_json));

  useEffect(() => {
    setTitle(post?.title ?? '');
    setSlug(post?.slug ?? '');
    setStatus(post?.status ?? 'draft');
    setCoverImage(post?.cover_image ?? '');
    setSeoDescription(post?.seo_description ?? '');
    setBodyText(extractTextFromTiptap(post?.content_json));
  }, [post]);

  const mutation = useMutation({
    mutationFn: async () => {
      await requireTripMember(tripId, userId);
      const cleanTitle = sanitizeTextInput(title, 300);
      if (!cleanTitle) throw new Error('Inserisci il titolo del post.');
      const finalSlug = sanitizeTextInput(slug, 300) || toSlug(cleanTitle);
      if (!/^[a-z0-9-]+$/.test(finalSlug)) throw new Error('Slug non valido. Usa solo lettere minuscole, numeri e trattini.');

      const payload = {
        title: cleanTitle,
        slug: finalSlug,
        status,
        cover_image: coverImage.trim() || null,
        seo_description: sanitizeTextInput(seoDescription, 160) || null,
        content_json: tiptapDocFromText(bodyText),
        published_at: status === 'published' ? (post?.published_at ?? new Date().toISOString()) : null,
      };

      const { error } = post
        ? await supabase.from('posts').update(payload).eq('id', post.id).eq('trip_id', tripId).eq('author_id', userId)
        : await supabase.from('posts').insert({ ...payload, trip_id: tripId, author_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip-posts', tripId] });
      onSaved();
    },
    onError: (err: Error) => Alert.alert('Errore', err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!post) return;
      const { error } = await supabase.from('posts').delete().eq('id', post.id).eq('trip_id', tripId).eq('author_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip-posts', tripId] });
      onDeleted?.();
    },
    onError: (err: Error) => Alert.alert('Errore', err.message),
  });

  return (
    <View style={stylesInlineForm(colors)}>
      <Text style={stylesInlineFormLabel(colors)}>{post ? 'Modifica post' : 'Nuovo post'}</Text>
      <TextInput style={[stylesInlineInput(colors), { marginBottom: 8 }]} value={title} onChangeText={(val) => { setTitle(val); if (!post) setSlug(toSlug(val)); }} placeholder="Titolo" placeholderTextColor={colors.mutedForeground} />
      <TextInput style={[stylesInlineInput(colors), { marginBottom: 8 }]} value={slug} onChangeText={setSlug} placeholder="slug-url" autoCapitalize="none" placeholderTextColor={colors.mutedForeground} />
      <TextInput style={[stylesInlineInput(colors), { marginBottom: 8 }]} value={coverImage} onChangeText={setCoverImage} placeholder="Cover image URL" autoCapitalize="none" placeholderTextColor={colors.mutedForeground} />
      <TextInput style={[stylesInlineInput(colors), { marginBottom: 8 }]} value={seoDescription} onChangeText={setSeoDescription} placeholder="Descrizione SEO" placeholderTextColor={colors.mutedForeground} />
      <TextInput style={[stylesInlineInput(colors), { minHeight: 90, marginBottom: 8 }]} multiline value={bodyText} onChangeText={setBodyText} placeholder="Contenuto" placeholderTextColor={colors.mutedForeground} />
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        <TouchableOpacity style={[{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }, { backgroundColor: status === 'draft' ? colors.primary : colors.muted }]} onPress={() => setStatus('draft')}>
          <Text style={{ color: status === 'draft' ? colors.primaryForeground : colors.mutedForeground, fontFamily: 'DMSans_500Medium', fontSize: 12 }}>Bozza</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }, { backgroundColor: status === 'published' ? colors.primary : colors.muted }]} onPress={() => setStatus('published')}>
          <Text style={{ color: status === 'published' ? colors.primaryForeground : colors.mutedForeground, fontFamily: 'DMSans_500Medium', fontSize: 12 }}>Pubblicato</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity style={stylesInlineBtnSec(colors)} onPress={onClose}><Text style={stylesInlineBtnSecText(colors)}>Annulla</Text></TouchableOpacity>
        <TouchableOpacity style={stylesInlineBtn(colors)} onPress={() => mutation.mutate()}>
          {mutation.isPending ? <ActivityIndicator color={colors.primaryForeground} size="small" /> : <Text style={stylesInlineBtnText(colors)}>Salva</Text>}
        </TouchableOpacity>
      </View>
      {post && (
        <TouchableOpacity style={[stylesInlineBtnSec(colors), { marginTop: 8, backgroundColor: colors.destructive }]} onPress={() => deleteMutation.mutate()}>
          <Text style={[stylesInlineBtnSecText(colors), { color: colors.destructiveForeground }]}>Elimina</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function stylesInlineForm(colors: any) {
  return {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 10,
  } as const;
}

function stylesInlineFormLabel(colors: any) {
  return {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: colors.mutedForeground,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 8,
  } as const;
}

function stylesInlineInput(colors: any) {
  return {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: colors.foreground,
  } as const;
}

function stylesInlineBtn(colors: any) {
  return {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    height: 40,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  } as const;
}

function stylesInlineBtnSec(colors: any) {
  return {
    flex: 1,
    backgroundColor: colors.muted,
    borderRadius: 10,
    height: 40,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  } as const;
}

function stylesInlineBtnText(colors: any) {
  return {
    color: colors.primaryForeground,
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
  } as const;
}

function stylesInlineBtnSecText(colors: any) {
  return {
    color: colors.foreground,
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
  } as const;
}

function makeStyles(colors: ReturnType<typeof import('@/hooks/useColors').useColors>, insets: ReturnType<typeof import('react-native-safe-area-context').useSafeAreaInsets>) {
  const MEDIA_SIZE = Platform.OS === 'web' ? 160 : 110;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { alignItems: 'center', justifyContent: 'center' },
    navBar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 8),
      paddingBottom: 12, paddingHorizontal: 20,
      backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    navActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    backButton: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
    deleteButton: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
    navTitle: { flex: 1, marginHorizontal: 12, fontSize: 17, fontFamily: 'DMSans_700Bold', color: colors.foreground },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    tabBar: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, maxHeight: 48 },
    tabBarContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
    tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.muted },
    tabActive: { backgroundColor: colors.primary },
    tabLabel: { fontSize: 13, fontFamily: 'DMSans_500Medium', color: colors.mutedForeground },
    tabLabelActive: { color: colors.primaryForeground },
    tabContent: { flex: 1 },
    tabContentPadded: { padding: 16, paddingBottom: insets.bottom + 24 },
    coverImage: { width: '100%', height: 180, borderRadius: 12, marginBottom: 16 },
    coverPlaceholder: { width: '100%', height: 120, borderRadius: 12, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    overviewHeader: { marginBottom: 16 },
    overviewTitle: { fontSize: 22, fontFamily: 'DMSans_700Bold', color: colors.foreground, marginBottom: 4 },
    destinationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    destinationText: { fontSize: 14, fontFamily: 'DMSans_400Regular', color: colors.mutedForeground },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16, margin: -4 },
    descriptionCard: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16 },
    sectionLabel: { fontSize: 12, fontFamily: 'DMSans_700Bold', color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
    descriptionText: { fontSize: 14, fontFamily: 'DMSans_400Regular', color: colors.foreground, lineHeight: 20 },
    quickActions: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    quickActionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    quickActionIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
    quickActionLabel: { flex: 1, fontSize: 15, fontFamily: 'DMSans_500Medium', color: colors.foreground },
    sectionActionBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    sectionActionTitle: { fontSize: 12, fontFamily: 'DMSans_700Bold', color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.5 },
    sectionAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
    sectionAddBtnText: { color: colors.primaryForeground, fontFamily: 'DMSans_700Bold', fontSize: 12 },
    dayCard: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 10, overflow: 'hidden' },
    dayHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
    dayDateBadge: { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    dayDateNum: { fontSize: 18, fontFamily: 'DMSans_700Bold', color: colors.primaryForeground },
    dayDateMon: { fontSize: 10, fontFamily: 'DMSans_500Medium', color: colors.primaryForeground, textTransform: 'uppercase' },
    dayTitle: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: colors.foreground },
    dayMeta: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: colors.mutedForeground, marginTop: 2 },
    dayContent: { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: colors.border },
    inlineToolbar: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    inlineToolbarBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
    inlineToolbarBtnText: { color: colors.primaryForeground, fontSize: 12, fontFamily: 'DMSans_700Bold' },
    legRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    accRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10 },
    legIconCircle: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    legRoute: { fontSize: 14, fontFamily: 'DMSans_700Bold', color: colors.foreground },
    legMeta: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: colors.mutedForeground, marginTop: 2 },
    legCost: { fontSize: 12, fontFamily: 'DMSans_700Bold', color: colors.foreground, marginTop: 2 },
    emptyDayText: { fontSize: 13, fontFamily: 'DMSans_400Regular', color: colors.mutedForeground, paddingVertical: 12, textAlign: 'center' },
    expenseSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 16, paddingVertical: 14 },
    expenseTotalLabel: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: colors.mutedForeground },
    expenseTotalValue: { fontSize: 24, fontFamily: 'DMSans_700Bold', color: colors.foreground },
    addExpenseBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
    addExpenseBtnText: { color: colors.primaryForeground, fontFamily: 'DMSans_700Bold', fontSize: 14 },
    settlementCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 12, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12 },
    settlementIconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
    settlementTitle: { fontSize: 13, fontFamily: 'DMSans_700Bold', color: colors.foreground, marginBottom: 2 },
    settlementText: { fontSize: 13, fontFamily: 'DMSans_400Regular', color: colors.mutedForeground },
    expenseRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 8 },
    expenseCategoryIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
    expenseDesc: { fontSize: 15, fontFamily: 'DMSans_500Medium', color: colors.foreground },
    expenseMeta: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: colors.mutedForeground, marginTop: 2 },
    expenseAmount: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: colors.foreground },
    expenseAmountEur: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: colors.mutedForeground },
    expenseActionBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
    inlineActionBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
    mediaGrid: { padding: 8, paddingBottom: insets.bottom + 24 },
    mediaGridInner: { flexDirection: 'row', flexWrap: 'wrap' },
    mediaCell: { width: MEDIA_SIZE, height: MEDIA_SIZE, margin: 2, borderRadius: 8, overflow: 'hidden', position: 'relative' },
    mediaCellImage: { width: '100%', height: '100%' },
    mediaEditBtn: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
    mediaCaptionOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 6, paddingVertical: 4 },
    mediaCaptionText: { color: '#fff', fontSize: 10, fontFamily: 'DMSans_400Regular' },
    bookingsSectionTitle: { fontSize: 13, fontFamily: 'DMSans_700Bold', color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
    bookingCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 8 },
    bookingIconCircle: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
    bookingName: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: colors.foreground },
    bookingMeta: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: colors.mutedForeground, marginTop: 2 },
    bookingRef: { fontSize: 12, fontFamily: 'DMSans_500Medium', color: colors.foreground, marginTop: 4 },
    bookingCost: { fontSize: 14, fontFamily: 'DMSans_700Bold', color: colors.foreground },
  });
}
