import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Dimensions, ScrollView, Image, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import assetsIndex from '../assets/assetsIndex';

const menuData = [
  { title: 'Home', route: 'Home' },
  { title: 'Recommended Products', route: 'Reviews' },
  { title: 'About Us', route: 'About' },
  {
    title: 'Our Business',
    children: [
      {
        title: 'Smartphone Distribution',
        children: [
          { title: 'Samsung', route: 'Products' },
          { title: 'HMD', route: 'Products' },
          { title: 'Infinix', route: 'Products' },
        ],
      },
      {
        title: 'LOGISTICS & SERVICE PROVIDER',
        children: [
          { title: 'B2B Warehousing & Fulfillment Services', route: 'Fulfillment' },
          { title: 'B2C Fulfillment Services', route: 'Fulfillment' },
          { title: 'Transportation', route: 'Transport' },
        ],
      },
    ],
  },
  { title: 'Blog', route: 'Blog' },
  { title: 'News', route: 'News' },
  { title: 'Track', route: 'Track' },
  { title: 'Contact', route: 'Contact' },
];

export default function NavMenu({ navigation }) {
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openIndexes, setOpenIndexes] = useState({});

  useEffect(() => {
    const onChange = ({ window }) => setWindowWidth(window.width);
    const sub = Dimensions.addEventListener ? Dimensions.addEventListener('change', onChange) : null;
    return () => {
      if (sub && sub.remove) sub.remove();
    };
  }, []);

  const isMobile = windowWidth < 720;

  const toggleOpen = (i) => {
    setOpenIndexes(prev => ({ ...prev, [i]: !prev[i] }));
  };

  const onNavigateOrOpen = (item) => {
  if (item.route) navigation?.navigate(item.route);
  else if (item.url) Linking.openURL(item.url).catch(() => {});
  };

  const renderItem = (item, i) => (
    <View key={i} style={styles.menuItemWrap}>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={() => (item.children ? toggleOpen(i) : onNavigateOrOpen(item))}
        style={styles.menuItem}
      >
        <Text style={styles.menuText}>{item.title}</Text>
        {item.children && <Icon name="keyboard-arrow-down" size={18} color="#fecaca" />}
      </TouchableOpacity>

      {item.children && openIndexes[i] && (
        <View style={styles.subMenu}>
          {item.children.map((sub, si) => (
            <View key={si}>
              <TouchableOpacity
                onPress={() => (sub.children ? null : (sub.route ? navigation?.navigate(sub.route) : (sub.url ? Linking.openURL(sub.url) : null)))}
                style={styles.subItem}
              >
                <Text style={styles.subText}>{sub.title}</Text>
                {sub.children && <Icon name="keyboard-arrow-right" size={14} color="#666" />}
              </TouchableOpacity>
              {sub.children && (
                <View style={styles.subSubMenu}>
                  {sub.children.map((s2, k2) => (
                    <TouchableOpacity key={k2} style={styles.subItem} onPress={() => s2.route ? navigation?.navigate(s2.route) : (s2.url ? Linking.openURL(s2.url) : null)}>
                      <Text style={styles.subText}>{s2.title}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <LinearGradient
      colors={['#000000', '#7f1d1d', '#dc2626']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
    >
      <View style={styles.inner}>
        <View style={styles.brandWrap}>
          <Image source={assetsIndex.map['autoparts-logo'] || assetsIndex.map['brake disc'] || assetsIndex.map['turbocharger'] || require('../assets/icon.png')} style={styles.logo} />
          <View>
            <Text style={styles.brand}>Auto Parts Store</Text>
            <Text style={styles.subtitle}>ระบบจัดการสต็อกสำหรับร้านอะไหล่รถยนต์</Text>
          </View>
        </View>
        {!isMobile ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.menuRow}>
            {menuData.map((m, i) => renderItem(m, i))}
            <TouchableOpacity style={styles.lang} onPress={() => {}}>
              <Text style={styles.flag}>TH</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <TouchableOpacity onPress={() => setMobileOpen(true)} style={styles.burger} accessibilityLabel="Menu">
            <Icon name="menu" size={26} color="#fecaca" />
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={mobileOpen} animationType="slide" onRequestClose={() => setMobileOpen(false)}>
        <View style={styles.mobileModalHeader}>
          <Text style={styles.brand}>Menu</Text>
          <TouchableOpacity onPress={() => setMobileOpen(false)}>
            <Icon name="close" size={28} color="#333" />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.mobileList}>
          {menuData.map((m, i) => (
            <View key={i} style={styles.mobileItemWrap}>
              <TouchableOpacity style={styles.mobileItem} onPress={() => (m.children ? toggleOpen(i) : onNavigateOrOpen(m))}>
                <Text style={styles.mobileText}>{m.title}</Text>
                {m.children && <Icon name={openIndexes[i] ? 'expand-less' : 'expand-more'} size={20} color="#333" />}
              </TouchableOpacity>
              {m.children && openIndexes[i] && (
                <View style={styles.mobileSubList}>
                  {m.children.map((sub, si) => (
                    <View key={si}>
                      <TouchableOpacity style={styles.mobileSubItem} onPress={() => (sub.children ? null : (sub.route ? navigation?.navigate(sub.route) : (sub.url ? Linking.openURL(sub.url) : null)))}>
                        <Text style={styles.mobileSubText}>{sub.title}</Text>
                      </TouchableOpacity>
                      {sub.children && (
                        <View style={styles.mobileSubSubList}>
                          {sub.children.map((s2, k2) => (
                            <TouchableOpacity key={k2} style={styles.mobileSubItem} onPress={() => s2.route ? navigation?.navigate(s2.route) : (s2.url ? Linking.openURL(s2.url) : null)}>
                              <Text style={styles.mobileSubText}>- {s2.title}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {},
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  brandWrap: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 36, height: 36, marginRight: 8, borderRadius: 6 },
  brand: { fontSize: 18, fontWeight: '800', color: '#fecaca', fontFamily: 'Poppins_600SemiBold' },
  subtitle: { color: '#fef2f2', fontSize: 10 },
  menuRow: { alignItems: 'center', paddingLeft: 12, paddingRight: 8 },
  menuItemWrap: { marginRight: 12 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 8 },
  menuText: { fontSize: 14, color: '#fecaca', marginRight: 6, fontFamily: 'Poppins_400Regular' },
  subMenu: { backgroundColor: '#fff', borderRadius: 8, padding: 8, marginTop: 6, elevation: 3, shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 } },
  subItem: { paddingVertical: 6, paddingHorizontal: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subText: { color: '#444' },
  subSubMenu: { paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: '#eee' },
  lang: { marginLeft: 8 },
  flag: { width: 20, height: 14, resizeMode: 'contain' },
  burger: { padding: 6 },

  mobileModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderColor: '#eee' },
  mobileList: { padding: 8 },
  mobileItemWrap: { marginBottom: 6 },
  mobileItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  mobileText: { fontSize: 16, color: '#0b1220', fontFamily: 'Poppins_400Regular' },
  mobileSubList: { paddingLeft: 14, paddingTop: 6 },
  mobileSubItem: { paddingVertical: 8 },
  mobileSubText: { color: '#444' },
  mobileSubSubList: { paddingLeft: 12 },
});
