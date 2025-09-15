// MainTabNavigator.js

import React from 'react';
import { useWindowDimensions, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/HomeScreen';
import ProductList from '../screens/Products/ProductList';
import ProfileScreen from '../screens/ProfileScreen';
import Icon from 'react-native-vector-icons/MaterialIcons';

const Tab = createBottomTabNavigator();

const MainTabNavigator = () => {
  const { width } = useWindowDimensions();
  const isSmall = width < 480;
  const isMedium = width >= 480 && width < 900;
  const isLarge = width >= 900;

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
        tabBarStyle: {
          backgroundColor: '#2b0000',
          borderTopColor: 'rgba(255,255,255,0.06)',
          height: tabBarHeight,
          paddingBottom: Platform.OS === 'ios' ? 6 : 4,
        },
        tabBarLabelStyle: { fontSize: labelFontSize, paddingBottom: 4 },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Products" component={ProductList} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

export default MainTabNavigator;
