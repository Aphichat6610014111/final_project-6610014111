import React, { useEffect, useState, useContext } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import AuthContext from '../../context/AuthContext';
import Constants from 'expo-constants';
import axios from 'axios';

const AdminOrders = ({ navigation }) => {
  const { user, token } = useContext(AuthContext);
  const debuggerHost = (Constants.manifest && (Constants.manifest.debuggerHost || Constants.manifest.packagerOpts?.host)) || '';
  const devHost = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
  const API_BASE = `http://${devHost}:5000`;

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    if (!token || !user) return;
    if (user.role !== 'admin') return;
    fetchOrders();
  }, [token, user]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API_BASE}/api/orders`, { headers });
      const data = (res && res.data && res.data.data && res.data.data.orders) || [];
      // filter pending orders
      const pending = (Array.isArray(data) ? data.filter(o => (o.status || '').toLowerCase() === 'pending') : []);
      setOrders(pending);
    } catch (err) {
      console.warn('Failed to fetch orders', err?.response?.data || err.message || err);
      Alert.alert('Error', 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const approveOrder = async (orderId) => {
    setActionLoading(orderId);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.post(`${API_BASE}/api/orders/${orderId}/approve`, {}, { headers });
      if (res && res.data && res.data.success) {
        Alert.alert('Success', 'Order approved');
        // remove approved order from list
        setOrders(prev => prev.filter(o => (o._id || o.id) !== orderId));
      } else {
        Alert.alert('Error', 'Approve request failed');
      }
    } catch (err) {
      console.warn('Approve failed', err?.response?.data || err.message || err);
      Alert.alert('Error', err?.response?.data?.message || 'Approve failed');
    } finally {
      setActionLoading(null);
    }
  };

  const renderItem = ({ item }) => {
    const id = item._id || item.id;
    return (
      <View style={styles.item}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Order: {id}</Text>
          <Text style={styles.meta}>Status: {item.status}</Text>
          <Text style={styles.meta}>Items: {(item.items || []).length}</Text>
        </View>
        <View style={{ width: 120, alignItems: 'flex-end' }}>
          <TouchableOpacity style={styles.approveBtn} onPress={() => approveOrder(id)} disabled={actionLoading === id}>
            {actionLoading === id ? <ActivityIndicator color="#fff" /> : <Text style={styles.approveText}>Approve</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (!token || !user) return (
    <View style={styles.container}><Text style={styles.empty}>Please login as admin to view orders.</Text></View>
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
        <Text style={styles.header}>Admin Orders</Text>
      </View>
      {loading ? <ActivityIndicator /> : (
        <FlatList data={orders} keyExtractor={o => (o._id || o.id)} renderItem={renderItem} ListEmptyComponent={<Text style={styles.empty}>No pending orders</Text>} />
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
  item: { backgroundColor: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  title: { color: '#fff', fontWeight: '700' },
  meta: { color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  empty: { color: '#999', textAlign: 'center', marginTop: 20 },
  approveBtn: { backgroundColor: '#0B7A3E', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
  approveText: { color: '#fff', fontWeight: '700' }
});

export default AdminOrders;
