import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import NavMenu from '../../components/NavMenu';
import Footer from '../../components/Footer';

export default function Distribution({ navigation }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#f6f7fb' }}>
      <NavMenu navigation={navigation} />
      <View style={styles.container}>
        <Text style={styles.title}>การกระจายสินค้า</Text>
        <Text style={styles.body}>รายละเอียดบริการ Distribution (placeholder)</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>กลับ</Text>
        </TouchableOpacity>
      </View>
      <Footer navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 10 },
  body: { color: '#555' },
  back: { marginTop: 20, padding: 10, backgroundColor: '#007AFF', borderRadius: 8 },
  backText: { color: '#fff', fontWeight: '700' },
});
