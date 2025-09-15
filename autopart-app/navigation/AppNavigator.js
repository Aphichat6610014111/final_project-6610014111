// AppNavigator.js

import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { navigationRef } from './navigationService';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, ActivityIndicator, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import AuthContext from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import AdminDashboard from '../screens/AdminDashboard';
import AdminOrders from '../screens/Admin/AdminOrders';
import ProductList from '../screens/Products/ProductList';
import ProductForm from '../screens/Products/ProductForm';
import AddToCartScreen from '../screens/Products/AddToCartScreen';
import CartScreen from '../screens/CartScreen';
// reports removed for simplified auto-parts app
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import TransactionScreen from '../screens/Transactions/TransactionScreen';
import Receipt from '../screens/Transactions/Receipt';
import Orders from '../screens/Orders';
// blog/news removed
import Reviews from '../screens/Reviews';
import Track from '../screens/Track';
import Fulfillment from '../screens/Services/Fulfillment';
import Distribution from '../screens/Services/Distribution';
import Transport from '../screens/Services/Transport';
import WMS from '../screens/Services/WMS';
import AddressPaymentsScreen from '../screens/AddressPaymentsScreen';
import Icon from 'react-native-vector-icons/MaterialIcons';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { user } = useContext(AuthContext);
  const { width } = useWindowDimensions();
  const isSmall = width < 480;
  const isMedium = width >= 480 && width < 900;

  // Determine which Home/dashboard to show based on role
  const HomeComponent = (user && user.role === 'admin') ? AdminDashboard : HomeScreen;

  const iconSize = isSmall ? 18 : isMedium ? 20 : 22;
  const labelFontSize = isSmall ? 10 : isMedium ? 12 : 13;
  const tabBarHeight = Platform.OS === 'web' ? (isSmall ? 56 : 64) : (isSmall ? 56 : 64);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color }) => {
          let iconName = 'circle';
          if (route.name === 'Home') iconName = 'home';
          else if (route.name === 'Products') iconName = 'inventory';
          else if (route.name === 'Profile') iconName = 'person';
          return <Icon name={iconName} size={iconSize} color={color} />;
        },
        tabBarActiveTintColor: '#ff6b6b',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.7)',
        tabBarStyle: { backgroundColor: '#000000', borderTopColor: 'rgba(255,255,255,0.03)', height: tabBarHeight, paddingBottom: Platform.OS === 'ios' ? 6 : 4 },
        tabBarLabelStyle: { fontSize: labelFontSize, paddingBottom: 4 },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeComponent} />
      <Tab.Screen name="Products" component={ProductList} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const AppNavigator = () => {
  const { user, isLoading } = useContext(AuthContext);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
  <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* Always expose MainTabs so Home is the default landing (even when not authenticated) */}
        <Stack.Screen name="Main" component={MainTabs} />
        {/* Publicly accessible screens for product browsing */}
        <Stack.Screen name="ProductForm" component={ProductForm} />
        <Stack.Screen name="AddToCart" component={AddToCartScreen} />
  <Stack.Screen name="Cart" component={CartScreen} />
    <Stack.Screen name="Transaction" component={TransactionScreen} />
  <Stack.Screen name="Receipt" component={Receipt} />
  <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Orders" component={Orders} />
    <Stack.Screen name="Reviews" component={Reviews} />
        <Stack.Screen name="Track" component={Track} />
        <Stack.Screen name="AddressPayments" component={AddressPaymentsScreen} />
  <Stack.Screen name="AdminOrders" component={AdminOrders} />

        {/* Service screens (admin/privileged). Keep them registered but we'll preserve access checks in those screens if needed */}
        <Stack.Screen name="Fulfillment" component={Fulfillment} />
        <Stack.Screen name="Distribution" component={Distribution} />
        <Stack.Screen name="Transport" component={Transport} />
        <Stack.Screen name="WMS" component={WMS} />

        {/* Auth screens should remain reachable */}
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});

export default AppNavigator;
