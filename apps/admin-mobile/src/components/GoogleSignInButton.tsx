import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useOAuth } from '@clerk/clerk-expo';
import { GoogleLogo } from './GoogleLogo';
import { Colors } from '../theme/colors';

// Ensure complete web browser authentication session lifecycle
WebBrowser.maybeCompleteAuthSession();

interface GoogleSignInButtonProps {
  onSuccess: (session: any) => Promise<void> | void;
  onError: (errorMessage: string) => void;
  disabled?: boolean;
  label?: string;
  scheme?: string;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onSuccess,
  onError,
  disabled = false,
  label = 'Continue with Google',
  scheme = 'cargox-operations',
}) => {
  const [loading, setLoading] = useState(false);
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);

      const redirectUrl = Linking.createURL('/', { scheme });

      const { createdSessionId, signIn, signUp, setActive } = await startOAuthFlow({
        redirectUrl,
      });

      if (createdSessionId) {
        if (setActive) {
          await setActive({ session: createdSessionId });
        }
        await onSuccess({ sessionId: createdSessionId });
      } else if (signIn?.status === 'complete' && signIn?.createdSessionId) {
        if (setActive) {
          await setActive({ session: signIn.createdSessionId });
        }
        await onSuccess({ sessionId: signIn.createdSessionId });
      } else if (signIn || signUp) {
        onError('Additional authentication factors required in browser.');
      } else {
        onError('Google sign-in was cancelled.');
      }
    } catch (err: any) {
      // Check if Clerk throws "You're already signed in" or similar error
      if (err?.errors?.[0]?.code === 'session_exists' || (err?.message && err.message.includes('already signed in'))) {
        await onSuccess({ sessionId: 'existing_session' });
        return;
      }
      const msg = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || 'Google sign-in failed.';
      onError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.googleButton,
        (disabled || loading) && styles.googleButtonDisabled,
      ]}
      onPress={handleGoogleSignIn}
      disabled={disabled || loading}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {loading ? (
        <View style={styles.contentRow}>
          <ActivityIndicator size="small" color="#ffffff" style={styles.spinner} />
          <Text style={styles.googleButtonText}>Connecting to Google...</Text>
        </View>
      ) : (
        <View style={styles.contentRow}>
          <GoogleLogo size={22} />
          <Text style={styles.googleButtonText}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  googleButton: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 3,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  spinner: {
    marginRight: 6,
  },
  googleButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
