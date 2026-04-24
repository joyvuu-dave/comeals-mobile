import { Redirect, Stack } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/context/auth';

export default function AppLayout() {
  const { isLoading, token } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#295f87" />
      </View>
    );
  }

  if (!token) {
    return <Redirect href="/login" />;
  }

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: '#f7f7f4' },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#f7f7f4' },
        headerTintColor: '#171a18',
      }}>
      <Stack.Screen
        name="reconciliations/index"
        options={{
          title: 'Reconciliations',
        }}
      />
      <Stack.Screen
        name="reconciliations/[id]"
        options={{
          title: 'Reconciliation',
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f7f7f4',
  },
});
