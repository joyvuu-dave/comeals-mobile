import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth';
import { ApiError, getReconciliation, updateBalancePaid, updateUnitBalancesPaid } from '@/lib/api';
import type { BalanceSide, ReconciliationBalance, ReconciliationDetail } from '@/lib/types';

type Tab = 'collect' | 'payout';

function parseMoney(value: string) {
  return Number.parseFloat(value);
}

function formatMoney(value: string) {
  const number = Math.abs(parseMoney(value));
  return new Intl.NumberFormat(undefined, { currency: 'USD', style: 'currency' }).format(number);
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(
    date
  );
}

function groupByUnit(balances: ReconciliationBalance[]) {
  return balances.reduce<Record<string, ReconciliationBalance[]>>((groups, balance) => {
    const key = `${balance.unit_id}:${balance.unit_name}`;
    groups[key] = groups[key] || [];
    groups[key].push(balance);
    return groups;
  }, {});
}

export default function ReconciliationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const reconciliationId = Number(id);
  const { signOut, token } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('collect');
  const [detail, setDetail] = useState<ReconciliationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingRows, setPendingRows] = useState<Set<number>>(() => new Set());
  const [pendingUnit, setPendingUnit] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const visibleSide: BalanceSide = activeTab === 'collect' ? 'owes' : 'owed';
  const visibleBalances = useMemo(
    () => (detail?.balances || []).filter((balance) => balance.side === visibleSide),
    [detail, visibleSide]
  );
  const groupedBalances = useMemo(() => groupByUnit(visibleBalances), [visibleBalances]);

  const load = useCallback(
    async (refresh = false) => {
      if (!token || !Number.isFinite(reconciliationId)) {
        return;
      }

      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        setDetail(await getReconciliation(token, reconciliationId));
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 401) {
          await signOut();
          return;
        }
        setError('Unable to load reconciliation.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [reconciliationId, signOut, token]
  );

  React.useEffect(() => {
    load();
  }, [load]);

  async function updateRow(balance: ReconciliationBalance) {
    if (!token || pendingRows.has(balance.id)) {
      return;
    }

    const nextPaid = !balance.paid_at;
    setError(null);
    setPendingRows((current) => new Set(current).add(balance.id));

    try {
      setDetail(await updateBalancePaid(token, reconciliationId, balance.id, nextPaid));
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        await signOut();
        return;
      }
      setError('Update failed.');
    } finally {
      setPendingRows((current) => {
        const next = new Set(current);
        next.delete(balance.id);
        return next;
      });
    }
  }

  function confirmUnitUpdate(unitId: number, unitName: string, balances: ReconciliationBalance[]) {
    if (!token || pendingUnit) {
      return;
    }

    const allPaid = balances.every((balance) => balance.paid_at);
    const nextPaid = !allPaid;
    const action = nextPaid ? 'Mark' : 'Undo';

    Alert.alert(`${action} Unit ${unitName}`, undefined, [
      { style: 'cancel', text: 'Cancel' },
      {
        onPress: () => updateUnit(unitId, unitName, nextPaid),
        text: action,
      },
    ]);
  }

  async function updateUnit(unitId: number, unitName: string, paid: boolean) {
    if (!token) {
      return;
    }

    const key = `${unitId}:${visibleSide}`;
    setError(null);
    setPendingUnit(key);

    try {
      setDetail(await updateUnitBalancesPaid(token, reconciliationId, unitId, visibleSide, paid));
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        await signOut();
        return;
      }
      setError(`Unit ${unitName} update failed.`);
    } finally {
      setPendingUnit(null);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centerState}>
        <ActivityIndicator color="#295f87" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
        {detail ? (
          <>
            <View style={styles.summary}>
              <Text style={styles.date}>{formatDate(detail.reconciliation.end_date)}</Text>
              <Text style={styles.summaryText}>
                {detail.reconciliation.paid_count}/{detail.reconciliation.balance_count} settled
              </Text>
            </View>

            <View style={styles.tabs}>
              <TabButton active={activeTab === 'collect'} label="Collect" onPress={() => setActiveTab('collect')} />
              <TabButton active={activeTab === 'payout'} label="Pay Out" onPress={() => setActiveTab('payout')} />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {visibleBalances.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No balances</Text>
              </View>
            ) : (
              Object.entries(groupedBalances).map(([key, balances]) => {
                const [unitIdValue, unitName] = key.split(':');
                const unitId = Number(unitIdValue);
                const amount = balances
                  .reduce((sum, balance) => sum + parseMoney(balance.amount), 0)
                  .toFixed(2);
                const allPaid = balances.every((balance) => balance.paid_at);
                const unitPending = pendingUnit === `${unitId}:${visibleSide}`;

                return (
                  <View key={key} style={styles.unitSection}>
                    <View style={styles.unitHeader}>
                      <View>
                        <Text style={styles.unitTitle}>Unit {unitName}</Text>
                        <Text style={styles.unitMeta}>
                          {formatMoney(amount)} {activeTab === 'collect' ? 'owed' : 'to pay'}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        disabled={unitPending}
                        onPress={() => confirmUnitUpdate(unitId, unitName, balances)}
                        style={({ pressed }) => [
                          styles.unitButton,
                          pressed && !unitPending ? styles.pressed : null,
                        ]}>
                        {unitPending ? (
                          <ActivityIndicator color="#295f87" />
                        ) : (
                          <Text style={styles.unitButtonText}>{allPaid ? 'Undo' : 'Mark'}</Text>
                        )}
                      </Pressable>
                    </View>

                    {balances.map((balance) => (
                      <BalanceRow
                        key={balance.id}
                        balance={balance}
                        mode={activeTab}
                        onPress={() => updateRow(balance)}
                        pending={pendingRows.has(balance.id)}
                      />
                    ))}
                  </View>
                );
              })
            )}
          </>
        ) : (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Reconciliation unavailable</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.tabButton, active ? styles.tabActive : null, pressed ? styles.pressed : null]}>
      <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function BalanceRow({
  balance,
  mode,
  onPress,
  pending,
}: {
  balance: ReconciliationBalance;
  mode: Tab;
  onPress: () => void;
  pending: boolean;
}) {
  const paid = Boolean(balance.paid_at);

  return (
    <View style={[styles.row, paid ? styles.rowPaid : null]}>
      <View style={styles.rowText}>
        <Text style={styles.residentName}>{balance.resident_name}</Text>
        <Text style={styles.amountText}>
          {mode === 'collect' ? 'owes' : 'owed'} {formatMoney(balance.amount)}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={pending}
        onPress={onPress}
        style={({ pressed }) => [
          styles.rowButton,
          paid ? styles.rowButtonUndo : styles.rowButtonMark,
          pressed && !pending ? styles.pressed : null,
        ]}>
        {pending ? (
          <ActivityIndicator color={paid ? '#295f87' : '#ffffff'} />
        ) : (
          <Text style={[styles.rowButtonText, paid ? styles.rowButtonUndoText : null]}>
            {paid ? 'Undo' : 'Mark'}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f7f4',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f7f7f4',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 14,
  },
  summary: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#deded8',
    borderRadius: 8,
    padding: 16,
    gap: 4,
  },
  date: {
    color: '#171a18',
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: 0,
  },
  summaryText: {
    color: '#6d746f',
    fontSize: 14,
    fontWeight: '700',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#e8e9e2',
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: '#ffffff',
  },
  tabText: {
    color: '#606861',
    fontSize: 15,
    fontWeight: '800',
  },
  tabTextActive: {
    color: '#295f87',
  },
  error: {
    color: '#a13d2d',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyBox: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#6d746f',
    fontSize: 16,
    fontWeight: '700',
  },
  unitSection: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#deded8',
    borderRadius: 8,
    overflow: 'hidden',
  },
  unitHeader: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#f0f3ef',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  unitTitle: {
    color: '#171a18',
    fontSize: 17,
    fontWeight: '800',
  },
  unitMeta: {
    color: '#59615b',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  unitButton: {
    minWidth: 72,
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cdd5d0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitButtonText: {
    color: '#295f87',
    fontSize: 14,
    fontWeight: '800',
  },
  row: {
    minHeight: 68,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#ecece7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowPaid: {
    backgroundColor: '#fafafa',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  residentName: {
    color: '#171a18',
    fontSize: 16,
    fontWeight: '800',
  },
  amountText: {
    color: '#6d746f',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 3,
  },
  rowButton: {
    minWidth: 78,
    minHeight: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  rowButtonMark: {
    backgroundColor: '#32665a',
  },
  rowButtonUndo: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cdd5d0',
  },
  rowButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  rowButtonUndoText: {
    color: '#295f87',
  },
  pressed: {
    opacity: 0.78,
  },
});
