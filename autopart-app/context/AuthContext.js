// AuthContext.js
import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../utils/apiConfig';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      const storedUser = await AsyncStorage.getItem('user');
      if (storedToken && storedUser) {
        setToken(storedToken);
        try {
          const parsed = JSON.parse(storedUser) || {};
          // Normalize avatar: if it's an object with .url or .filename, convert to usable uri string
          if (parsed.avatar && typeof parsed.avatar === 'object') {
            if (parsed.avatar.url && typeof parsed.avatar.url === 'string') {
              parsed.avatar = parsed.avatar.url;
            } else if (parsed.avatar.filename) {
              parsed.avatar = `${API_BASE}/images/users/${parsed.avatar.filename}`;
            } else parsed.avatar = null;
          }
          // If avatar is a server-relative string (e.g. '/images/...'), prefix with API_BASE
          if (parsed.avatar && typeof parsed.avatar === 'string' && parsed.avatar.startsWith('/')) {
            parsed.avatar = `${API_BASE}${parsed.avatar}`;
          }
          setUser(parsed);
        } catch (e) {
          setUser(null);
        }
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (userData, authToken) => {
    await AsyncStorage.setItem('token', authToken);
    await AsyncStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    // Normalize avatar before storing
    const copy = { ...(userData || {}) };
    if (copy.avatar && typeof copy.avatar === 'object') {
      if (copy.avatar.url && typeof copy.avatar.url === 'string') {
        copy.avatar = copy.avatar.url;
      } else if (copy.avatar.filename) {
        copy.avatar = `${API_BASE}/images/users/${copy.avatar.filename}`;
      } else copy.avatar = null;
    }
    if (copy.avatar && typeof copy.avatar === 'string' && copy.avatar.startsWith('/')) {
      copy.avatar = `${API_BASE}${copy.avatar}`;
    }
    await AsyncStorage.setItem('user', JSON.stringify(copy));
    setUser(copy);
    setToken(authToken);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['token', 'user']);
    setUser(null);
    setToken(null);
  };

  const updateUser = async (patchedUser) => {
    try {
      const merged = { ...(user || {}), ...(patchedUser || {}) };
      // Normalize avatar if object present
      if (merged.avatar && typeof merged.avatar === 'object') {
        if (merged.avatar.url && typeof merged.avatar.url === 'string') merged.avatar = merged.avatar.url;
        else if (merged.avatar.filename) merged.avatar = `${API_BASE}/images/users/${merged.avatar.filename}`;
        else merged.avatar = null;
      }
      if (merged.avatar && typeof merged.avatar === 'string' && merged.avatar.startsWith('/')) {
        merged.avatar = `${API_BASE}${merged.avatar}`;
      }
      await AsyncStorage.setItem('user', JSON.stringify(merged));
      setUser(merged);
      return merged;
    } catch (e) {
      console.error('Failed to update stored user', e);
      return user;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      isLoading, 
      login, 
      logout,
      updateUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
