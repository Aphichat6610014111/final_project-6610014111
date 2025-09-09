import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function Footer({ navigation }) {
  return (
    <LinearGradient
      colors={['#000000', '#2b0000', '#3d0c0c']}
      style={styles.footer}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.topRow}>
        <View style={styles.col}>
          <Text style={styles.brand}>Auto Parts Store</Text>
          <Text style={styles.desc}>ระบบจัดการสต็อกสำหรับร้านอะไหล่รถยนต์</Text>
        </View>
        <View style={styles.col}>
          <Text style={styles.heading}>Menu</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Home')}><Text style={styles.link}>Home</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Products')}><Text style={styles.link}>Products</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Reports')}><Text style={styles.link}>Reports</Text></TouchableOpacity>
        </View>
        <View style={styles.col}>
          <Text style={styles.heading}>Services</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Fulfillment')}><Text style={styles.link}>Fulfillment</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Distribution')}><Text style={styles.link}>Distribution</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('WMS')}><Text style={styles.link}>WMS</Text></TouchableOpacity>
        </View>
      </View>
      <View style={styles.footerCTA}>
        <Text style={styles.ctaTitle}>พร้อมปรับปรุงระบบสต็อกของคุณหรือยัง?</Text>
        <TouchableOpacity style={styles.ctaButton} onPress={() => navigation.navigate('Contact')}>
          <Text style={styles.ctaButtonText}>ขอเดโม</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.bottomRow}>
        <Text style={styles.copy}>© 2025 ร้านค้าขายอะไหล่รถยนต์</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  footer: {
    padding: 24,
    borderTopWidth: 0,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  col: { flex: 1, paddingHorizontal: 12 },
  brand: { fontSize: 20, fontWeight: '700', marginBottom: 6, color: '#ffffff', fontFamily: 'Poppins_600SemiBold' },
  desc: { fontSize: 13, color: '#ffd6d6', marginTop: 4, lineHeight: 18, fontFamily: 'Poppins_300Light' },
  heading: { fontSize: 15, fontWeight: '600', marginBottom: 8, color: '#ffffff', fontFamily: 'Poppins_600SemiBold' },
  link: { fontSize: 13, color: '#ffd6d6', marginBottom: 6, fontFamily: 'Poppins_400Regular' },
  footerCTA: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ctaTitle: { fontSize: 14, color: '#ffffff', fontFamily: 'Poppins_600SemiBold' },
  ctaButton: { backgroundColor: '#dc2626', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
  ctaButtonText: { color: '#fff', fontWeight: '600', fontFamily: 'Poppins_600SemiBold' },
  bottomRow: { marginTop: 16, alignItems: 'center' },
  copy: { color: '#ffd6d6', fontSize: 12, fontFamily: 'Poppins_300Light' },
});
