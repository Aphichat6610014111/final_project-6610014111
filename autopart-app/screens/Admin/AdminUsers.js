import React, { useEffect, useState, useContext } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native';
import AuthContext from '../../context/AuthContext';
import Constants from 'expo-constants';
import axios from 'axios';

const AdminUsers = ({ navigation }) => {
  const { user, token } = useContext(AuthContext);
  const debuggerHost = (Constants.manifest && (Constants.manifest.debuggerHost || Constants.manifest.packagerOpts?.host)) || '';
  const devHost = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
  const API_BASE = `http://${devHost}:5000`;

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    if (!token || !user) return;
    if (user.role !== 'admin') return;
    fetchUsers();
  }, [token, user]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API_BASE}/api/users`, { headers });
      const data = (res && res.data && res.data.data && res.data.data.users) || [];
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Failed to fetch users', err?.response?.data || err.message || err);
      Alert.alert('Error', 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId) => {
    setActionLoading(userId);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.delete(`${API_BASE}/api/users/${userId}`, { headers });
      if (res && res.data && res.data.success) {
        Alert.alert('Success', 'User deleted');
        setUsers(prev => prev.filter(u => (u._id || u.id) !== userId));
      } else {
        Alert.alert('Error', 'Delete request failed');
      }
    } catch (err) {
      console.warn('Delete failed', err?.response?.data || err.message || err);
      Alert.alert('Error', err?.response?.data?.message || 'Delete failed');
    } finally {
      setActionLoading(null);
    }
  };

  const changeRole = async (userId, newRole) => {
    setActionLoading(userId);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.patch(`${API_BASE}/api/users/${userId}/role`, { role: newRole }, { headers });
      if (res && res.data && res.data.success) {
        Alert.alert('Success', 'Role updated');
        setUsers(prev => prev.map(u => (u._id || u.id) === userId ? { ...u, role: newRole } : u));
      } else {
        Alert.alert('Error', 'Role update failed');
      }
    } catch (err) {
      console.warn('Role update failed', err?.response?.data || err.message || err);
      Alert.alert('Error', err?.response?.data?.message || 'Role update failed');
    } finally {
      setActionLoading(null);
    }
  };

  const renderItem = ({ item }) => {
    const id = item._id || item.id;
    const avatarUrl = item.avatar?.url ? `${API_BASE}${item.avatar.url}` : null;
    return (
      <View style={styles.item}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          {avatarUrl ? (
            <View style={styles.avatarWrap}>
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{item.name || 'No Name'} ({id})</Text>
            <Text style={styles.meta}>Email: {item.email}</Text>
            <Text style={styles.meta}>Role: {item.role}</Text>
            <Text style={styles.meta}>Created: {item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}</Text>
            <Text style={styles.meta}>Updated: {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '-'}</Text>
          </View>
        </View>
        <View style={{ width: 120, alignItems: 'flex-end' }}>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteUser(id)} disabled={actionLoading === id}>
            {actionLoading === id ? <ActivityIndicator color="#fff" /> : <Text style={styles.deleteText}>Delete</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.roleBtn} onPress={() => changeRole(id, item.role === 'admin' ? 'user' : 'admin')} disabled={actionLoading === id}>
            <Text style={styles.roleText}>{item.role === 'admin' ? 'Set User' : 'Set Admin'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (!token || !user) return (
    <View style={styles.container}><Text style={styles.empty}>Please login as admin to view users.</Text></View>
  );

  if (user.role !== 'admin') return (
    <View style={styles.container}><Text style={styles.empty}>Access denied. Admins only.</Text></View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.header}>Admin Users</Text>
      </View>
      {loading ? <ActivityIndicator /> : (
        <FlatList data={users} keyExtractor={u => (u._id || u.id)} renderItem={renderItem} ListEmptyComponent={<Text style={styles.empty}>No users found</Text>} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, backgroundColor: '#0a0a0a' },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backBtn: { marginRight: 8, paddingHorizontal: 6, paddingVertical: 4 },
  backText: { color: '#fff', fontSize: 16 },
  header: { fontSize: 20, fontWeight: '800', color: '#fff' },
  item: { backgroundColor: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8, marginBottom: 12, flexDirection: 'row', alignItems: 'flex-start' },
  avatarWrap: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden', marginRight: 12, backgroundColor: '#222' },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  title: { color: '#fff', fontWeight: '700' },
  meta: { color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  empty: { color: '#999', textAlign: 'center', marginTop: 20 },
  deleteBtn: { backgroundColor: '#B71C1C', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, marginBottom: 6 },
  deleteText: { color: '#fff', fontWeight: '700' },
  roleBtn: { backgroundColor: '#0B7A3E', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
  roleText: { color: '#fff', fontWeight: '700' }
});

export default AdminUsers;
