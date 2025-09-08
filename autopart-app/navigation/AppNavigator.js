// AppNavigator.js

import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import AuthContext from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import ProductList from '../screens/Products/ProductList';
import ProductForm from '../screens/Products/ProductForm';
// reports removed for simplified auto-parts app
import ProfileScreen from '../screens/ProfileScreen';
import Fulfillment from '../screens/Services/Fulfillment';
import Distribution from '../screens/Services/Distribution';
import Transport from '../screens/Services/Transport';
import WMS from '../screens/Services/WMS';
// blog/news removed
import Track from '../screens/Track';
import Reviews from '../screens/Reviews';
import Icon from 'react-native-vector-icons/MaterialIcons';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName = 'circle';
          if (route.name === 'Home') iconName = 'home';
          else if (route.name === 'Products') iconName = 'inventory';
          else if (route.name === 'Profile') iconName = 'person';
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
  headerShown: false,
      })}
    >
  <Tab.Screen name="Home" component={HomeScreen} />
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
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
  {/* web-specific homepage removed - using main HomeScreen for all platforms */}
        {user ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="ProductForm" component={ProductForm} />
            <Stack.Screen name="Fulfillment" component={Fulfillment} />
            <Stack.Screen name="Distribution" component={Distribution} />
            <Stack.Screen name="Transport" component={Transport} />
            <Stack.Screen name="WMS" component={WMS} />
            <Stack.Screen name="Reviews" component={Reviews} />
            
            <Stack.Screen name="Track" component={Track} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
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
