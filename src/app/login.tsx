import { Redirect, router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth';
import { ApiError } from '@/lib/api';

export default function LoginScreen() {
  const { isLoading, signIn, token } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isLoading && token) {
    return <Redirect href="/reconciliations" />;
  }

  async function handleSubmit() {
    if (submitting) {
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      router.replace('/reconciliations');
    } catch (caught) {
      if (caught instanceof ApiError && caught.status >= 500) {
        setError('Comeals is unavailable.');
      } else {
        setError('Invalid email or password.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.eyebrow}>Comeals</Text>
            <Text style={styles.title}>Reconciliation</Text>
          </View>

          <View style={styles.form}>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor="#7b817c"
              returnKeyType="next"
              style={styles.input}
              textContentType="emailAddress"
              value={email}
            />
            <TextInput
              autoCapitalize="none"
              onChangeText={setPassword}
              onSubmitEditing={handleSubmit}
              placeholder="Password"
              placeholderTextColor="#7b817c"
              returnKeyType="go"
              secureTextEntry
              style={styles.input}
              textContentType="password"
              value={password}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={handleSubmit}
              style={({ pressed }) => [
                styles.button,
                pressed && !submitting ? styles.buttonPressed : null,
                submitting ? styles.buttonDisabled : null,
              ]}>
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f7f4',
  },
  keyboard: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 28,
  },
  header: {
    gap: 6,
  },
  eyebrow: {
    color: '#32665a',
    fontSize: 15,
    fontWeight: '700',
  },
  title: {
    color: '#171a18',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0,
  },
  form: {
    gap: 14,
  },
  input: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: '#d8ddd6',
    backgroundColor: '#ffffff',
    color: '#171a18',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 17,
  },
  error: {
    color: '#a13d2d',
    fontSize: 14,
    fontWeight: '600',
  },
  button: {
    minHeight: 54,
    borderRadius: 8,
    backgroundColor: '#295f87',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  buttonPressed: {
    opacity: 0.84,
  },
  buttonDisabled: {
    opacity: 0.72,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },
});
