import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';

const { width: windowWidth } = Dimensions.get('window');

export default function Footer({ navigation }) {
  const isNarrow = windowWidth < 760;

  const payments = [
    require('../assets/Master Card.avif'),
    require('../assets/China Union Pay.avif'),
    require('../assets/Diners.avif'),
    require('../assets/American Express.avif'),
    require('../assets/Discover.avif'),
    require('../assets/Visa.avif'),
  ];

  return (
    <View style={styles.footer}>
      <View style={[styles.topGrid, { flexDirection: isNarrow ? 'column' : 'row' }]}>
        <View style={styles.brandCol}>
          <Image source={require('../assets/autoparts-logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.desc}>ระบบจัดการสต็อกสำหรับร้านอะไหล่รถยนต์</Text>
        </View>

        <View style={styles.linkCols}>
          <View style={styles.col}><Text style={styles.heading}>Shop</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Products')}><Text style={styles.link}>Shop Parts</Text></TouchableOpacity>
            <Text style={styles.link}>Wheels &amp; Rims</Text>
            <Text style={styles.link}>Engine</Text>
            <Text style={styles.link}>Vehicle Body Parts</Text>
            <Text style={styles.link}>Accessories</Text>
          </View>

          <View style={styles.col}><Text style={styles.heading}>The Company</Text>
            <Text style={styles.link}>About Us</Text>
            <Text style={styles.link}>Reviews</Text>
            <Text style={styles.link}>Premium Area</Text>
            <Text style={styles.link}>FAQ</Text>
          </View>

          <View style={styles.col}><Text style={styles.heading}>Contact Us</Text>
            <Text style={styles.link}>info@mysite.com</Text>
            <Text style={styles.link}>500 Terry Francine St.</Text>
            <Text style={styles.link}>San Francisco, CA 94158</Text>
            <Text style={styles.link}>Tel: 123-456-7890</Text>
          </View>

          <View style={styles.col}><Text style={styles.heading}>Follow Us</Text>
            <Text style={styles.link}>Facebook</Text>
            <Text style={styles.link}>Instagram</Text>
            <Text style={styles.link}>Youtube</Text>
            <Text style={styles.link}>Twitter</Text>
          </View>
        </View>
      </View>

      <View style={styles.hr} />

      <View style={[styles.policyRow, { flexDirection: isNarrow ? 'column' : 'row' }]}>
        <TouchableOpacity><Text style={styles.policyLink}>Terms &amp; Conditions</Text></TouchableOpacity>
        <TouchableOpacity><Text style={styles.policyLink}>Privacy Policy</Text></TouchableOpacity>
        <TouchableOpacity><Text style={styles.policyLink}>Shipping Policy</Text></TouchableOpacity>
        <TouchableOpacity><Text style={styles.policyLink}>Refund Policy</Text></TouchableOpacity>
        <TouchableOpacity><Text style={styles.policyLink}>Cookie Policy</Text></TouchableOpacity>
      </View>

      <View style={styles.hrThin} />

      <View style={styles.paymentsWrap}>
        <Text style={styles.payTitle}>Payment Methods</Text>
        <View style={styles.paymentIcons}>
          {payments.map((p, i) => (
            <Image key={i} source={p} style={styles.payIcon} resizeMode="contain" />
          ))}
        </View>
      </View>

      <View style={styles.copyWrap}>
        <Text style={styles.copy}>© 2035 By Autopile. Powered and secured by Wix</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { backgroundColor: '#000', paddingVertical: 48, paddingHorizontal: 36 },
  topGrid: { alignItems: 'flex-start', justifyContent: 'space-between', gap: 18 },
  brandCol: { flex: 1, minWidth: 200, marginBottom: 12 },
  logo: { width: 180, height: 44, marginBottom: 16 },
  desc: { color: '#bfbfbf', fontSize: 14, lineHeight: 20 },
  linkCols: { flex: 3, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  col: { width: 180, marginBottom: 12 },
  heading: { color: '#fff', fontWeight: '700', marginBottom: 8 },
  link: { color: '#a9a9a9', marginBottom: 6, fontSize: 14 },
  hr: { height: 1, backgroundColor: 'rgba(255,255,255,0.04)', marginVertical: 24 },
  policyRow: { justifyContent: 'space-between', alignItems: 'center' },
  policyLink: { color: '#9e9e9e', marginVertical: 8, fontSize: 14 },
  hrThin: { height: 1, backgroundColor: 'rgba(255,255,255,0.02)', marginVertical: 16 },
  paymentsWrap: { alignItems: 'center', marginBottom: 20 },
  payTitle: { color: '#fff', marginBottom: 12, fontWeight: '600' },
  paymentIcons: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  payIcon: { width: 64, height: 36, marginHorizontal: 8 },
  copyWrap: { alignItems: 'center', marginTop: 8 },
  copy: { color: '#8b8b8b', fontSize: 13 },
});
