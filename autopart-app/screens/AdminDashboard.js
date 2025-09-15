import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const AdminDashboard = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Admin Dashboard (Wireframe)</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Overview</Text>
        <Text style={styles.sectionText}>Quick stats, pending approvals, recent activity.</Text>
      </View>

      <View style={styles.sectionRow}>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ProductForm')}>
          <Text style={styles.cardTitle}>Manage Products</Text>
          <Text style={styles.cardDesc}>Add, edit or remove products</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Reviews')}>
          <Text style={styles.cardTitle}>Manage Reviews</Text>
          <Text style={styles.cardDesc}>Moderate customer feedback</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('AdminOrders')}>
          <Text style={styles.cardTitle}>Pending Orders</Text>
          <Text style={styles.cardDesc}>View and approve pending orders</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>User Management</Text>
        <Text style={styles.sectionText}>Create or modify employee accounts and roles.</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f3f4f6' },
  title: { fontSize: 22, fontWeight: '800', color: '#7f1d1d', marginBottom: 16 },
  section: { marginBottom: 14 },
  sectionTitle: { fontWeight: '800', color: '#111827', marginBottom: 6 },
  sectionText: { color: '#374151' },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  card: { flex: 1, backgroundColor: '#fff', padding: 12, marginRight: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  cardTitle: { fontWeight: '800', color: '#7f1d1d' },
  cardDesc: { color: '#6b7280', marginTop: 6 }
});

export default AdminDashboard;
