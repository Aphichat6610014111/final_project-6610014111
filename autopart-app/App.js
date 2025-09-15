import React, { useState, useEffect } from 'react';
import { StatusBar, View, Platform, Text } from 'react-native';
// removed custom font loading
import { ActivityIndicator } from 'react-native';
import AppNavigator from './navigation/AppNavigator';
import { AuthProvider } from './context/AuthContext';
import NavBar from './components/NavBar';
import { CartProvider } from './context/CartContext';
import QuickCartSidebar from './components/QuickCartSidebar';
import { on as eventOn } from './utils/eventBus';

export default function App() {
  if (Platform.OS === 'web') {
    try {
      require('./web.css');
    } catch (e) {
      // ignore in non-web environments
    }
  }
  const [quickCartVisible, setQuickCartVisible] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(true);

  useEffect(() => {
    const off = eventOn('openQuickCart', () => setQuickCartVisible(true));
    return () => off();
  }, []);

  useEffect(() => {
    const off = eventOn('openQuickCart', () => setQuickCartVisible(true));
    return () => off();
  }, []);

  return (
    <AuthProvider>
      <CartProvider>
        <View style={{ flex: 1, paddingTop: 96 }}>
          <StatusBar />
          <NavBar onOpenCart={() => setQuickCartVisible(true)} />
          <AppNavigator />
          <QuickCartSidebar visible={quickCartVisible} onClose={() => setQuickCartVisible(false)} />
        </View>
      </CartProvider>
    </AuthProvider>
  );
}
