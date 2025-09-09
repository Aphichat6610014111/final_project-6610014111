import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const EmployeeDashboard = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Employee Dashboard (Wireframe)</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tasks</Text>
        <Text style={styles.sectionText}>Assigned orders, pick lists, and shipping tasks.</Text>
      </View>

      <View style={styles.sectionRow}>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Fulfillment')}>
          <Text style={styles.cardTitle}>Fulfillment</Text>
          <Text style={styles.cardDesc}>Process incoming orders</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('WMS')}>
          <Text style={styles.cardTitle}>WMS</Text>
          <Text style={styles.cardDesc}>Warehouse management tools</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <Text style={styles.sectionText}>Scan, update inventory, report issues.</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f3f4f6' },
  title: { fontSize: 22, fontWeight: '800', color: '#065f46', marginBottom: 16 },
  section: { marginBottom: 14 },
  sectionTitle: { fontWeight: '800', color: '#111827', marginBottom: 6 },
  sectionText: { color: '#374151' },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  card: { flex: 1, backgroundColor: '#fff', padding: 12, marginRight: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  cardTitle: { fontWeight: '800', color: '#065f46' },
  cardDesc: { color: '#6b7280', marginTop: 6 }
});

export default EmployeeDashboard;
