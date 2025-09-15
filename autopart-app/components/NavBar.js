import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Image } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import CartContext from '../context/CartContext';
import AuthContext from '../context/AuthContext';
import { apiUrl } from '../utils/apiConfig';
import { LinearGradient } from 'expo-linear-gradient';

const NavBar = ({ onOpenCart }) => {
  const { count } = useContext(CartContext);
  const { user } = useContext(AuthContext);
  return (
    <View style={styles.container}>
      <View style={styles.promoBar}>
        <Text style={styles.promoText} />
      </View>

      <LinearGradient
        // solid black header by using identical colors
        colors={[ '#000000', '#000000' ]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.left}>
          <Text style={styles.siteTitle}>AUTOPARTS STORE</Text>
        </View>

        <View style={styles.right}>
          {!user ? (
            <TouchableOpacity style={styles.iconBtn} onPress={() => {
              try { const { navigate } = require('../navigation/navigationService'); navigate('Login'); } catch (e) { /* fallback no-op */ }
            }}>
              <Text style={styles.loginText}>Log In</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.avatarWrap} onPress={() => {
              try { const { navigate } = require('../navigation/navigationService'); navigate('Main', { screen: 'Profile' }); } catch (e) {}
            }}>
              {(() => {
                const img = user.avatar || user.image || user.picture || user.photoUrl || user.photo;
                if (img && typeof img === 'string') {
                  // absolute or server-relative
                  const src = /^https?:\/\//i.test(img) ? { uri: img } : { uri: img && img.startsWith('/') ? apiUrl(img) : img };
                  return <Image source={src} style={styles.avatar} />;
                }
                // fallback: initials
                const name = user.name || user.fullName || user.username || user.email || '';
                const initials = name.split(' ').filter(Boolean).slice(0,2).map(n => n[0].toUpperCase()).join('') || '?';
                return (
                  <View style={styles.avatarPlaceholder}><Text style={styles.avatarInitials}>{initials}</Text></View>
                );
              })()}
            </TouchableOpacity>
          )}
          {(!(user && user.role === 'admin')) && (
            <TouchableOpacity style={styles.cartBtn} onPress={() => onOpenCart && onOpenCart()}>
              {(count || 0) >= 0 && (
                <Svg width={36} height={36} viewBox="0 0 164.9 196.4" style={styles.cartBadgeSvg} preserveAspectRatio="xMinYMax meet">
                  <SvgText x={84} y={131} dy={'.35em'} textAnchor="middle" fill="#fff" fontSize="60" fontWeight="700">{String(count || 0)}</SvgText>
                  <Path d="M81.9 11.5c-18.8 0-34.1 16-34.1 35.7v18.1h7.8V47.2c0-15.4 11.8-27.9 26.4-27.9 14.5 0 26.4 12.5 26.4 27.9v18.1h6.6V64h1.1V47.2c-.1-19.7-15.4-35.7-34.2-35.7z" fill="#fff" />
                  <Path d="M156.9 70.5v118H8v-118h148.9m8-8H0v134h164.9v-134z" fill="#fff" />
                </Svg>
              )}
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <LinearGradient
        colors={[ '#000000', '#000000' ]}
        style={styles.navLinks}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View />
        <View style={styles.linksRight} />
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 999 },
  promoBar: { backgroundColor: 'transparent', paddingVertical: 6, paddingHorizontal: 12 },
  promoText: { color: '#fff', textAlign: 'center' },
  header: { paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#000' },
  left: { flexDirection: 'row', alignItems: 'center' },
  siteTitle: { color: '#fff', fontWeight: '700', fontSize: 26, letterSpacing: 1 },
  right: { flexDirection: 'row', alignItems: 'center' },
  // removed search input styles
  iconBtn: { marginRight: 12 },
  loginText: { color: '#fff', fontSize: 13, marginRight: 12 },
  avatarWrap: { marginRight: 12 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#222' },
  avatarPlaceholder: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: '#fff', fontWeight: '700' },
  cartBtn: { backgroundColor: 'transparent', borderWidth: 0, width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center', overflow: 'visible' },
  cartCount: { color: '#fff', fontSize: 12, fontWeight: '700' },
  cartBadgeSvg: { position: 'absolute', right: -6, top: -6, width: 36, height: 36 },
  navLinks: { paddingVertical: 10, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#000' },
  linksRight: { flexDirection: 'row', alignItems: 'center' },
  link: { color: '#fff', marginLeft: 14, fontSize: 13 },
});

export default NavBar;
