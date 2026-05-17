import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/hooks/useColors';
import { Post } from '@/types';

async function fetchPost(slug: string): Promise<Post | null> {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('slug', slug)
    .single();
  if (error) return null;
  return data;
}

function renderTiptapContent(contentJson: any): string {
  if (!contentJson?.content) return '';
  const extractText = (nodes: any[]): string =>
    nodes.map((node: any) => {
      if (node.type === 'text') return node.text ?? '';
      if (node.type === 'hardBreak') return '\n';
      if (node.content) return extractText(node.content) + '\n';
      return '';
    }).join('');
  return extractText(contentJson.content).trim();
}

export default function BlogPostScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: post, isLoading } = useQuery({
    queryKey: ['post', slug],
    queryFn: () => fetchPost(slug),
    enabled: !!slug,
  });

  const styles = makeStyles(colors, insets);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.foreground} />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>Post non trovato</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Torna indietro</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const bodyText = post.content_json ? renderTiptapContent(post.content_json as any) : '';

  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>Blog</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {post.cover_image ? (
          <Image source={{ uri: post.cover_image }} style={styles.coverImage} />
        ) : null}

        <View style={styles.articleContent}>
          <Text style={styles.title}>{post.title}</Text>

          <View style={styles.metaRow}>
            {post.published_at ? (
              <Text style={styles.date}>
                {new Date(post.published_at).toLocaleDateString('it-IT', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </Text>
            ) : null}
            {post.reading_time ? (
              <View style={styles.readingRow}>
                <Ionicons name="time-outline" size={13} color={colors.mutedForeground} />
                <Text style={styles.readingTime}>{post.reading_time} min di lettura</Text>
              </View>
            ) : null}
          </View>

          {post.seo_description ? (
            <Text style={styles.excerpt}>{post.seo_description}</Text>
          ) : null}

          {bodyText ? (
            <Text style={styles.body}>{bodyText}</Text>
          ) : (
            <Text style={styles.body}>Contenuto non disponibile.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof import('@/hooks/useColors').useColors>, insets: ReturnType<typeof import('react-native-safe-area-context').useSafeAreaInsets>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    center: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    navBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 8),
      paddingBottom: 12,
      paddingHorizontal: 20,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navTitle: {
      fontSize: 16,
      fontFamily: 'DMSans_700Bold',
      color: colors.foreground,
      flex: 1,
      textAlign: 'center',
      marginHorizontal: 8,
    },
    coverImage: {
      width: '100%',
      height: 240,
    },
    articleContent: {
      padding: 24,
      paddingBottom: insets.bottom + 40,
    },
    title: {
      fontSize: 26,
      fontFamily: 'DMSans_700Bold',
      color: colors.foreground,
      lineHeight: 34,
      marginBottom: 12,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    date: {
      fontSize: 13,
      fontFamily: 'DMSans_400Regular',
      color: colors.mutedForeground,
    },
    readingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    readingTime: {
      fontSize: 13,
      fontFamily: 'DMSans_400Regular',
      color: colors.mutedForeground,
    },
    excerpt: {
      fontSize: 16,
      fontFamily: 'DMSans_400Regular',
      color: colors.mutedForeground,
      lineHeight: 24,
      marginBottom: 20,
      fontStyle: 'italic',
    },
    body: {
      fontSize: 16,
      fontFamily: 'DMSans_400Regular',
      color: colors.foreground,
      lineHeight: 26,
    },
    errorText: {
      fontSize: 16,
      fontFamily: 'DMSans_500Medium',
      color: colors.mutedForeground,
      marginBottom: 12,
    },
    backLink: {
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    backLinkText: {
      fontSize: 15,
      fontFamily: 'DMSans_700Bold',
      color: colors.foreground,
    },
  });
}
