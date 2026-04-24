import { Link } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth';
import { ApiError, getReconciliations } from '@/lib/api';
import type { ReconciliationSummary } from '@/lib/types';

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(
    date
  );
}

function progressLabel(item: ReconciliationSummary) {
  if (item.balance_count === 0) {
    return 'No balances';
  }

  return `${item.paid_count}/${item.balance_count} settled`;
}

function ReconciliationCard({ item }: { item: ReconciliationSummary }) {
  const active = !item.settled_at;

  return (
    <Link href={`/reconciliations/${item.id}`} asChild>
      <Pressable style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardDate}>{formatDate(item.end_date)}</Text>
            <Text style={styles.cardMeta}>{item.meal_count} meals</Text>
          </View>
          <View style={[styles.statusPill, active ? styles.activePill : styles.settledPill]}>
            <Text style={[styles.statusText, active ? styles.activeText : styles.settledText]}>
              {active ? 'Active' : 'Settled'}
            </Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width:
                  item.balance_count === 0
                    ? '100%'
                    : `${Math.round((item.paid_count / item.balance_count) * 100)}%`,
              },
            ]}
          />
        </View>

        <View style={styles.countRow}>
          <Text style={styles.countText}>{progressLabel(item)}</Text>
          <Text style={styles.countText}>{item.collect_count} collect</Text>
          <Text style={styles.countText}>{item.payout_count} pay out</Text>
        </View>
      </Pressable>
    </Link>
  );
}

export default function ReconciliationsScreen() {
  const { signOut, token } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ReconciliationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        if (!a.settled_at && b.settled_at) {
          return -1;
        }
        if (a.settled_at && !b.settled_at) {
          return 1;
        }
        return b.end_date.localeCompare(a.end_date);
      }),
    [items]
  );

  const load = useCallback(
    async (refresh = false) => {
      if (!token) {
        return;
      }

      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const response = await getReconciliations(token);
        setItems(response.reconciliations);
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 401) {
          await signOut();
          return;
        }
        setError('Unable to load reconciliations.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [signOut, token]
  );

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Reconciliations</Text>
          <Text style={styles.subtitle}>Collection and payout status</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={signOut} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color="#295f87" />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={sortedItems}
          keyExtractor={(item) => String(item.id)}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Text style={styles.emptyText}>No reconciliations</Text>
            </View>
          }
          ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          renderItem={({ item }) => <ReconciliationCard item={item} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f7f4',
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  title: {
    color: '#171a18',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0,
  },
  subtitle: {
    color: '#6d746f',
    fontSize: 14,
    marginTop: 2,
  },
  signOutButton: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#ece6dd',
    justifyContent: 'center',
  },
  signOutText: {
    color: '#684b24',
    fontSize: 13,
    fontWeight: '800',
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 32,
    gap: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#deded8',
    borderRadius: 8,
    padding: 16,
    gap: 14,
  },
  cardPressed: {
    opacity: 0.82,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardDate: {
    color: '#171a18',
    fontSize: 19,
    fontWeight: '800',
  },
  cardMeta: {
    color: '#6d746f',
    fontSize: 14,
    marginTop: 4,
  },
  statusPill: {
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: 8,
    justifyContent: 'center',
  },
  activePill: {
    backgroundColor: '#e4f1ec',
  },
  settledPill: {
    backgroundColor: '#e9ebef',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '800',
  },
  activeText: {
    color: '#286653',
  },
  settledText: {
    color: '#4d5665',
  },
  progressTrack: {
    height: 8,
    borderRadius: 8,
    backgroundColor: '#e7e9e4',
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    backgroundColor: '#32665a',
  },
  countRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  countText: {
    color: '#4e5650',
    fontSize: 13,
    fontWeight: '700',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    color: '#6d746f',
    fontSize: 16,
    fontWeight: '700',
  },
  error: {
    color: '#a13d2d',
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 8,
  },
});
