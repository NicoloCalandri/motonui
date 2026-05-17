import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, Image, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/hooks/useColors';
import { EmptyState } from '@/components/EmptyState';
import { Post } from '@/types';

async function fetchPosts(): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('it-IT', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

export default function BlogScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: posts = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['posts'],
    queryFn: fetchPosts,
  });

  const styles = makeStyles(colors, insets);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Blog</Text>
      </View>

      <FlatList<Post>
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.postCard}
            onPress={() => router.push(`/blog/${item.slug}` as any)}
            activeOpacity={0.85}
          >
            {item.cover_image ? (
              <Image source={{ uri: item.cover_image }} style={styles.postImage} />
            ) : (
              <View style={styles.postImagePlaceholder}>
                <Ionicons name="book-outline" size={28} color={colors.mutedForeground} />
              </View>
            )}
            <View style={styles.postContent}>
              <Text style={styles.postTitle} numberOfLines={2}>{item.title}</Text>
              {item.seo_description ? (
                <Text style={styles.postExcerpt} numberOfLines={2}>{item.seo_description}</Text>
              ) : null}
              <View style={styles.postMeta}>
                {item.published_at ? (
                  <Text style={styles.postDate}>{formatDate(item.published_at)}</Text>
                ) : null}
                {item.reading_time ? (
                  <View style={styles.readingTime}>
                    <Ionicons name="time-outline" size={12} color={colors.mutedForeground} />
                    <Text style={styles.readingTimeText}>{item.reading_time} min</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.foreground}
          />
        }
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState
              icon="book-outline"
              title="Nessun post ancora"
              subtitle="I post pubblicati dei tuoi viaggi appariranno qui."
            />
          )
        }
      />
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof import('@/hooks/useColors').useColors>, insets: ReturnType<typeof import('react-native-safe-area-context').useSafeAreaInsets>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 12),
      paddingBottom: 16,
      paddingHorizontal: 20,
      backgroundColor: colors.background,
    },
    headerTitle: {
      fontSize: 26,
      fontFamily: 'DMSans_700Bold',
      color: colors.foreground,
    },
    list: {
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    postCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      marginBottom: 16,
    },
    postImage: {
      width: '100%',
      height: 180,
    },
    postImagePlaceholder: {
      width: '100%',
      height: 120,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    postContent: {
      padding: 16,
    },
    postTitle: {
      fontSize: 17,
      fontFamily: 'DMSans_700Bold',
      color: colors.foreground,
      marginBottom: 6,
      lineHeight: 22,
    },
    postExcerpt: {
      fontSize: 13,
      fontFamily: 'DMSans_400Regular',
      color: colors.mutedForeground,
      lineHeight: 18,
      marginBottom: 10,
    },
    postMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    postDate: {
      fontSize: 12,
      fontFamily: 'DMSans_400Regular',
      color: colors.mutedForeground,
    },
    readingTime: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    readingTimeText: {
      fontSize: 12,
      fontFamily: 'DMSans_400Regular',
      color: colors.mutedForeground,
    },
  });
}
