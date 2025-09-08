// MainTabNavigator.js

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/HomeScreen';
import ProductList from '../screens/Products/ProductList';
import ProfileScreen from '../screens/ProfileScreen';
import Icon from 'react-native-vector-icons/MaterialIcons';

const Tab = createBottomTabNavigator();

const MainTabNavigator = () => (
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

export default MainTabNavigator;
