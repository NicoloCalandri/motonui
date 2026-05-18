import { useState, useCallback } from 'react';
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
import { EmptyState } from '@/components/EmptyState';
import {
  Trip, DayWithDetails, Expense, Media, Restaurant,
  Activity, ExpenseCategory,
} from '@/types';

type TabKey = 'overview' | 'itinerary' | 'expenses' | 'media' | 'bookings';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'grid-outline' },
  { key: 'itinerary', label: 'Itinerario', icon: 'map-outline' },
  { key: 'expenses', label: 'Spese', icon: 'wallet-outline' },
  { key: 'media', label: 'Media', icon: 'images-outline' },
  { key: 'bookings', label: 'Prenotazioni', icon: 'calendar-outline' },
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

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [showAddExpense, setShowAddExpense] = useState(false);

  const styles = makeStyles(colors, insets);

  const { data: trip, isLoading: tripLoading } = useQuery({
    queryKey: ['trip', id],
    queryFn: () => fetchTrip(id),
    enabled: !!id,
  });

  const { data: days = [], refetch: refetchDays, isRefetching: refreshingDays } = useQuery({
    queryKey: ['days', id],
    queryFn: () => fetchDays(id),
    enabled: !!id && activeTab === 'itinerary',
  });

  const { data: expenses = [], refetch: refetchExpenses, isRefetching: refreshingExpenses } = useQuery({
    queryKey: ['expenses', id],
    queryFn: () => fetchExpenses(id),
    enabled: !!id && activeTab === 'expenses',
  });

  const { data: media = [], refetch: refetchMedia, isRefetching: refreshingMedia } = useQuery({
    queryKey: ['media', id],
    queryFn: () => fetchMedia(id),
    enabled: !!id && activeTab === 'media',
  });

  const { data: restaurants = [], refetch: refetchRestaurants } = useQuery({
    queryKey: ['restaurants', id],
    queryFn: () => fetchRestaurants(id),
    enabled: !!id && activeTab === 'bookings',
  });

  const { data: activities = [], refetch: refetchActivities } = useQuery({
    queryKey: ['activities', id],
    queryFn: () => fetchActivities(id),
    enabled: !!id && activeTab === 'bookings',
  });

  const toggleDay = useCallback((dayId: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dayId)) next.delete(dayId);
      else next.add(dayId);
      return next;
    });
  }, []);

  if (tripLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.foreground} />
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

  const totalEur = expenses.reduce((sum, e) => sum + (e.amount_eur ?? e.amount), 0);

  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>{trip.title}</Text>
        <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[trip.status] }]} />
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
              Haptics.selectionAsync();
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
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.dayContent}>
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

          {showAddExpense && (
            <AddExpenseForm
              tripId={id}
              userId={user?.id ?? ''}
              colors={colors}
              onClose={() => setShowAddExpense(false)}
              onSaved={() => {
                setShowAddExpense(false);
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
          {media.length === 0 ? (
            <EmptyState icon="images-outline" title="Nessuna foto" subtitle="Aggiungi foto dal sito web o carica direttamente." />
          ) : (
            <View style={styles.mediaGridInner}>
              {media.map((item) => (
                <TouchableOpacity key={item.id} style={styles.mediaCell} activeOpacity={0.85}>
                  <Image source={{ uri: item.thumbnail_url ?? item.url }} style={styles.mediaCellImage} />
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
                </View>
              ))}
            </>
          )}

          {restaurants.length === 0 && activities.length === 0 && (
            <EmptyState icon="calendar-outline" title="Nessuna prenotazione" subtitle="Ristoranti e attività prenotate appariranno qui." />
          )}
        </ScrollView>
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

function AddExpenseForm({ tripId, userId, colors, onClose, onSaved }: {
  tripId: string; userId: string; colors: any; onClose: () => void; onSaved: () => void;
}) {
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [category, setCategory] = useState<ExpenseCategory>('other');
  const [split, setSplit] = useState(true);

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('expenses').insert({
        trip_id: tripId,
        description: desc,
        amount: parseFloat(amount),
        currency,
        category,
        paid_by: userId,
        split,
        date: new Date().toISOString().split('T')[0],
        amount_eur: currency === 'EUR' ? parseFloat(amount) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', tripId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved();
    },
    onError: (err: Error) => Alert.alert('Errore', err.message),
  });
  const isSaveDisabled = !desc || !amount || mutation.isPending;
  const handleSave = () => {
    if (isSaveDisabled) return;
    mutation.mutate();
  };

  const styles = StyleSheet.create({
    form: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12 },
    row: { flexDirection: 'row' as const, gap: 8, marginBottom: 10 },
    input: { flex: 1, backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontFamily: 'DMSans_400Regular', color: colors.foreground },
    label: { fontSize: 12, fontFamily: 'DMSans_700Bold', color: colors.mutedForeground, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 6 },
    splitRow: { flexDirection: 'row' as const, alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    actions: { flexDirection: 'row' as const, gap: 8 },
    btn: { flex: 1, backgroundColor: colors.primary, borderRadius: 10, height: 44, alignItems: 'center' as const, justifyContent: 'center' as const },
    noPointerEvents: { pointerEvents: 'none' as const },
    btnSec: { flex: 1, backgroundColor: colors.muted, borderRadius: 10, height: 44, alignItems: 'center' as const, justifyContent: 'center' as const },
    btnTxt: { color: colors.primaryForeground, fontFamily: 'DMSans_700Bold', fontSize: 14 },
    btnTxtSec: { color: colors.foreground, fontFamily: 'DMSans_700Bold', fontSize: 14 },
  });

  const CATEGORIES: ExpenseCategory[] = ['food', 'transport', 'accommodation', 'activity', 'shopping', 'other'];
  const CAT_LABELS: Record<ExpenseCategory, string> = { food: 'Cibo', transport: 'Trasporto', accommodation: 'Alloggio', activity: 'Attività', shopping: 'Shopping', other: 'Altro' };

  return (
    <View style={[styles.form, { marginHorizontal: 16 }]}>
      <Text style={[styles.label, { marginBottom: 10 }]}>Nuova spesa</Text>
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
      <View style={styles.actions}>
        <TouchableOpacity style={styles.btnSec} onPress={onClose}><Text style={styles.btnTxtSec}>Annulla</Text></TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, isSaveDisabled && styles.noPointerEvents]}
          onPress={handleSave}
          accessibilityState={{ disabled: isSaveDisabled }}
        >
          {mutation.isPending ? <ActivityIndicator color={colors.primaryForeground} size="small" /> : <Text style={styles.btnTxt}>Salva</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
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
    backButton: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
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
    dayCard: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 10, overflow: 'hidden' },
    dayHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
    dayDateBadge: { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    dayDateNum: { fontSize: 18, fontFamily: 'DMSans_700Bold', color: colors.primaryForeground },
    dayDateMon: { fontSize: 10, fontFamily: 'DMSans_500Medium', color: colors.primaryForeground, textTransform: 'uppercase' },
    dayTitle: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: colors.foreground },
    dayMeta: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: colors.mutedForeground, marginTop: 2 },
    dayContent: { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: colors.border },
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
    expenseRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 8 },
    expenseCategoryIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
    expenseDesc: { fontSize: 15, fontFamily: 'DMSans_500Medium', color: colors.foreground },
    expenseMeta: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: colors.mutedForeground, marginTop: 2 },
    expenseAmount: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: colors.foreground },
    expenseAmountEur: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: colors.mutedForeground },
    mediaGrid: { padding: 8, paddingBottom: insets.bottom + 24 },
    mediaGridInner: { flexDirection: 'row', flexWrap: 'wrap' },
    mediaCell: { width: MEDIA_SIZE, height: MEDIA_SIZE, margin: 2, borderRadius: 8, overflow: 'hidden', position: 'relative' },
    mediaCellImage: { width: '100%', height: '100%' },
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
