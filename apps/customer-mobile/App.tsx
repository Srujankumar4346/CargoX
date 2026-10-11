import React, { useRef, useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  BackHandler,
  Platform,
  Linking,
  Alert,
  Text,
  TouchableOpacity
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';

// Primary deployed URL for CargoX Customer Web Portal
const CUSTOMER_WEB_URL = 'https://cargox-frontend.onrender.com';
const FALLBACK_ADMIN_PORTAL = 'https://cargox-admin.onrender.com';

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUrl, setCurrentUrl] = useState(CUSTOMER_WEB_URL);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Handle hardware Android back button to navigate WebView history
  useEffect(() => {
    if (Platform.OS === 'android') {
      const onBackPress = () => {
        if (canGoBack && webViewRef.current) {
          webViewRef.current.goBack();
          return true; // prevent app exit, handle navigation internally
        }
        return false; // let system exit app if at root
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }
  }, [canGoBack]);

  // Determine whether URL should stay inside CargoX WebView or launch external
  const handleShouldStartLoadWithRequest = (request: { url: string }) => {
    const { url } = request;

    // Allow internal navigation to CargoX origins
    if (
      url.startsWith('https://cargox-frontend.onrender.com') ||
      url.startsWith('https://cargox-admin.onrender.com') ||
      url.startsWith('https://cargox-1.onrender.com') ||
      url.includes('clerk.accounts.dev') ||
      url.includes('accounts.google.com') ||
      url.includes('google.com/accounts') ||
      url.includes('razorpay.com') ||
      url.includes('api.razorpay.com')
    ) {
      return true;
    }

    // Handle deep links or tel/mailto/geo/upi protocols natively
    if (
      url.startsWith('tel:') ||
      url.startsWith('mailto:') ||
      url.startsWith('geo:') ||
      url.startsWith('upi:') ||
      url.startsWith('cargox-customer:') ||
      url.startsWith('whatsapp:')
    ) {
      Linking.canOpenURL(url).then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Alert.alert('Cannot Open App', `No application installed to handle this link: ${url}`);
        }
      });
      return false;
    }

    // Open other external URLs in device browser
    Linking.openURL(url).catch((err) => {
      console.warn('Failed to open external url:', err);
    });
    return false;
  };

  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
    setCurrentUrl(navState.url);
    if (!navState.loading) {
      setLoading(false);
    }
  };

  const handleReload = () => {
    setLoadError(null);
    setLoading(true);
    webViewRef.current?.reload();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#071425" />
      
      <WebView
        ref={webViewRef}
        source={{ uri: CUSTOMER_WEB_URL }}
        style={styles.webView}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        allowsBackForwardNavigationGestures={true}
        originWhitelist={['https://*', 'http://*', 'cargox-customer://*', 'upi://*', 'tel://*', 'mailto://*']}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        onNavigationStateChange={handleNavigationStateChange}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          setLoadError(nativeEvent.description || 'Failed to connect to CargoX Customer Web Portal');
          setLoading(false);
        }}
        // Enable file uploads for documents / photo proof
        allowFileAccess={true}
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
        // Enable geolocation support
        geolocationEnabled={true}
        // Modern Chrome User-Agent header to ensure responsive web features and OAuth compatibility
        userAgent="Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36 CargoXCustomerApp/1.0"
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Loading CargoX Customer Portal…</Text>
          </View>
        )}
      />

      {loadError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Portal Connection Error</Text>
          <Text style={styles.errorMessage}>{loadError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleReload}>
            <Text style={styles.retryButtonText}>Retry Connection</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#071425',
  },
  webView: {
    flex: 1,
    backgroundColor: '#071425',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#071425',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 14,
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#071425',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 20,
  },
  errorTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorMessage: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
});
