import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Image } from 'react-native';
import { /* useNavigation, */ } from '@react-navigation/native';
import { navigate } from '../navigation/navigationService';
import CartContext from '../context/CartContext';
import AuthContext from '../context/AuthContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import assetsIndex from '../assets/assetsIndex';
import Constants from 'expo-constants';

const QuickCartSidebar = ({ visible, onClose }) => {
  const { items, removeFromCart, clearCart, updateQty } = useContext(CartContext);
  const { user, token } = useContext(AuthContext);
  // useNavigation cannot be used when this component is mounted outside a NavigationContainer
  // (the quick-cart sidebar is mounted at the app root). Use the navigation service helper.

  // Build API base dynamically to match ProductForm image resolution logic
  const debuggerHost = (Constants.manifest && (Constants.manifest.debuggerHost || Constants.manifest.packagerOpts?.host)) || '';
  const devHost = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
  const API_BASE = `http://${devHost}:5000`;

  const tryKey = (k) => {
    if (!k) return null;
    const key = k.toString().toLowerCase();
    if (assetsIndex.map[key]) return assetsIndex.map[key];
    const spaced = key.replace(/[_\-\s]+/g, ' ').trim();
    if (assetsIndex.map[spaced]) return assetsIndex.map[spaced];
    const underscored = key.replace(/[_\-\s]+/g, '_').trim();
    if (assetsIndex.map[underscored]) return assetsIndex.map[underscored];
    return null;
  };

  const getImageSource = (u, productItem = null) => {
    if (!u && !productItem) return { uri: `${API_BASE}/images/placeholder.png` };
    if (typeof u === 'number') return u;

    const s = u ? String(u) : null;

    // 1) Absolute URL
    if (s && /^https?:\/\//i.test(s)) return { uri: s };

    // 2) If path like /images/filename.ext -> try map by filename
    if (s && s.match(/\/images\/(.+)$/i)) {
      const fname = s.match(/\/images\/(.+)$/i)[1].replace(/\.[^/.]+$/, '').toLowerCase();
      const r = tryKey(fname);
      if (r) return r;
      return { uri: `${API_BASE}${s.startsWith('/') ? s : `/${s}`}` };
    }

    // 3) Server-relative path starting with '/'
    if (s && s.startsWith('/')) {
      const name = s.replace(/\/.+\//, '').replace(/\.[^/.]+$/, '').toLowerCase();
      const r = tryKey(name);
      if (r) return r;
      return { uri: `${API_BASE}${s}` };
    }

    // 4) If productItem provided, try fields
    if (productItem) {
      if (productItem.imageUrl && typeof productItem.imageUrl === 'string') {
        const m = productItem.imageUrl.match(/\/images\/(.+)$/i);
        if (m && m[1]) {
          const fname = m[1].replace(/\.[^/.]+$/, '').toLowerCase();
          const r = tryKey(fname);
          if (r) return r;
        }
      }
      if (productItem.imageFilename) {
        const nameNoExt = productItem.imageFilename.toString().replace(/\.[^/.]+$/, '');
        const r = tryKey(nameNoExt);
        if (r) return r;
      }
      if (productItem.category) {
        const r = tryKey(productItem.category);
        if (r) return r;
      }
      if (productItem.sku) {
        const skuBase = productItem.sku.toString().toLowerCase().replace(/\d+$/,'');
        const r = tryKey(skuBase);
        if (r) return r;
      }
      if (productItem.name) {
        const name = productItem.name.toString();
        const simple = name.replace(/\.[^/.]+$/, '').toLowerCase().replace(/[^a-z0-9\s]/gi, ' ').trim();
        const r1 = tryKey(simple);
        if (r1) return r1;
        const compact = simple.replace(/\s+/g, '');
        const r2 = tryKey(compact);
        if (r2) return r2;
      }
    }

    // 5) Bare filename -> try map or backend images/<filename>
    if (s && !s.includes('/')) {
      const fname = s.replace(/\.[^/.]+$/, '').toLowerCase();
      const r = tryKey(fname);
      if (r) return r;
      return { uri: `${API_BASE}/images/${s}` };
    }

    // final fallback: try productItem.imageUrl or placeholder
    if (productItem && productItem.imageUrl) {
      const iv = productItem.imageUrl;
      if (typeof iv === 'string') {
        if (/^https?:\/\//i.test(iv)) return { uri: iv };
        if (iv.startsWith('/')) return { uri: `${API_BASE}${iv}` };
        return { uri: `${API_BASE}/images/${iv}` };
      }
    }

    return { uri: `${API_BASE}/images/${s || 'placeholder.png'}` };
  };

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.panel}>
        <View style={styles.header}>
          <Text style={styles.title}>Cart</Text>
          <TouchableOpacity onPress={onClose}><Icon name="close" size={20} color="#fff" /></TouchableOpacity>
        </View>

        <FlatList
          data={items}
          keyExtractor={(i) => i._id}
          renderItem={({ item }) => (
            <View style={styles.itemRow}>
              <View style={styles.thumbWrap}>
                {(() => {
                  try {
                    const src = getImageSource(item.imageUrl || (item.images && item.images[0]) || item.image || item.imageKey || item.name, item);
                    return src ? <Image source={src} style={styles.thumb} /> : <View style={styles.thumbPlaceholder} />;
                  } catch (e) {
                    return <View style={styles.thumbPlaceholder} />;
                  }
                })()}
              </View>

              <View style={styles.itemInfo}>
                <Text style={styles.name}>{item.name || item.title}</Text>
                <Text style={styles.price}>{`$${(item.price || 0).toFixed(2)}`}</Text>

                <View style={styles.qtyRow}>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item._id, -1)}><Text style={styles.qtyBtnText}>—</Text></TouchableOpacity>
                  <Text style={styles.qtyText}>{item.qty || 1}</Text>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item._id, 1)}><Text style={styles.qtyBtnText}>+</Text></TouchableOpacity>
                </View>
              </View>

              <View style={styles.itemRight}>
                <Text style={styles.lineTotal}>{`$${(((item.price||0) * (item.qty||1)) || 0).toFixed(2)}`}</Text>
                <TouchableOpacity onPress={() => removeFromCart(item._id)} style={styles.removeBtn}><Icon name="delete" size={18} color="#fff" /></TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={() => <Text style={styles.empty}>Your cart is empty</Text>}
        />

        <View style={styles.footerRow}>
            <TouchableOpacity style={styles.viewCartBtn} onPress={() => {
            if (!user || !token) {
              alert('กรุณาเข้าสู่ระบบเพื่อดูตะกร้า');
              return;
            }
            onClose && onClose();
              navigate('Cart');
          }}><Text style={styles.viewCartText}>View Cart</Text></TouchableOpacity>
          <TouchableOpacity style={styles.checkoutBtn} onPress={() => {
            if (!user || !token) {
              alert('กรุณาเข้าสู่ระบบก่อนชำระเงิน');
              return;
            }
            onClose && onClose();
              navigate('Transaction', { cart: items.map(i => ({ productId: i._id, name: i.name, price: i.price, quantity: i.qty })) });
          }}><Text style={styles.checkoutText}>Checkout</Text></TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    zIndex: 2000,
  },
  panel: {
    width: 360,
    maxWidth: '100%',
    height: '100%',
    backgroundColor: '#0b0b0b',
    borderLeftWidth: 1,
    borderLeftColor: '#222',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.6,
    elevation: 12,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { color: '#fff', fontWeight: '700', fontSize: 18 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#111' },
  thumbWrap: { width: 64, height: 64, marginRight: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  thumb: { width: '100%', height: '100%' },
  thumbPlaceholder: { width: '100%', height: '100%', backgroundColor: '#222' },
  itemInfo: { flex: 1 },
  name: { color: '#d1d5db', fontWeight: '700' },
  price: { color: '#9ca3af', marginTop: 6 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  qtyBtn: { width: 36, height: 28, borderWidth: 1, borderColor: '#333', justifyContent: 'center', alignItems: 'center', borderRadius: 4, marginHorizontal: 6 },
  qtyBtnText: { color: '#fff', fontSize: 18 },
  qtyText: { color: '#fff', minWidth: 28, textAlign: 'center' },
  itemRight: { alignItems: 'flex-end' },
  lineTotal: { color: '#fff', fontWeight: '700' },
  removeBtn: { marginTop: 8 },
  empty: { color: '#9ca3af', textAlign: 'center', marginTop: 40 },
  footerRow: { flexDirection: 'column', marginTop: 12 },
  viewCartBtn: { borderWidth: 1, borderColor: '#ff4d36', paddingVertical: 12, borderRadius: 6, marginBottom: 8, alignItems: 'center' },
  viewCartText: { color: '#ff4d36', fontWeight: '700' },
  checkoutBtn: { paddingVertical: 12, backgroundColor: '#ff4d36', borderRadius: 6, alignItems: 'center' },
  checkoutText: { color: '#fff', fontWeight: '700' },
});

export default QuickCartSidebar;
