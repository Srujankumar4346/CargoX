import React, { useRef, useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  StatusBar,
  BackHandler,
  Platform,
  ActivityIndicator,
  View,
  Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';

const CUSTOMER_URL = 'https://cargox-frontend.onrender.com/';

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    if (Platform.OS === 'android') {
      const onBackPress = () => {
        if (canGoBack && webViewRef.current) {
          webViewRef.current.goBack();
          return true;
        }
        return false;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }
  }, [canGoBack]);

  const handleShouldStartLoadWithRequest = (request: { url: string }) => {
    const { url } = request;
    if (
      url.startsWith('https://cargox-frontend.onrender.com') ||
      url.startsWith('https://cargox-admin.onrender.com') ||
      url.startsWith('https://cargox-drivers.onrender.com') ||
      url.includes('clerk.accounts.dev') ||
      url.includes('clerk.com') ||
      url.includes('accounts.google.com') ||
      url.startsWith('blob:') ||
      url.startsWith('data:')
    ) {
      return true;
    }

    if (
      url.startsWith('tel:') ||
      url.startsWith('mailto:') ||
      url.startsWith('geo:') ||
      url.startsWith('intent:') ||
      url.startsWith('market:') ||
      url.includes('maps.google.com') ||
      url.includes('google.com/maps')
    ) {
      Linking.openURL(url).catch(() => {});
      return false;
    }

    return true;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0b0f19" />
      <WebView
        ref={webViewRef}
        source={{ uri: CUSTOMER_URL }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={true}
        startInLoadingState={true}
        allowFileAccess={false}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        geolocationEnabled={true}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        setSupportMultipleWindows={false}
        mixedContentMode="compatibility"
        injectedJavaScript={`
          (function() {
            var css = \`
              .-translate-x-full {
                -webkit-transform: translateX(-100%) !important;
                transform: translateX(-100%) !important;
                visibility: hidden !important;
                pointer-events: none !important;
              }
              .translate-x-0 {
                -webkit-transform: translateX(0) !important;
                transform: translateX(0) !important;
                visibility: visible !important;
                pointer-events: auto !important;
              }
              @media (min-width: 768px) {
                .-translate-x-full, .translate-x-0 {
                  -webkit-transform: none !important;
                  transform: none !important;
                  visibility: visible !important;
                  pointer-events: auto !important;
                }
              }
            \`;
            function injectStyle() {
              if (document.getElementById('cargox-mobile-drawer-fix')) return;
              var style = document.createElement('style');
              style.id = 'cargox-mobile-drawer-fix';
              style.type = 'text/css';
              style.appendChild(document.createTextNode(css));
              (document.head || document.documentElement).appendChild(style);
            }
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', injectStyle);
            } else {
              injectStyle();
            }
            setInterval(injectStyle, 1000);
          })();
          true;
        `}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        onNavigationStateChange={(navState) => {
          setCanGoBack(navState.canGoBack);
          setIsLoading(navState.loading);
        }}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#f97316" />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0b0f19',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0b0f19',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
