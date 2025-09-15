import React, { useContext, useMemo, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Image, Dimensions } from 'react-native';
import axios from 'axios';
import Constants from 'expo-constants';
import { API_BASE, apiUrl } from '../utils/apiConfig';
import CartContext from '../context/CartContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import assetsIndex from '../assets/assetsIndex';

const CartScreen = ({ navigation, route }) => {
  const { items: ctxItems, updateQty, removeFromCart, clearCart } = useContext(CartContext);

  // Use centralized API base helper so mobile/web/devhost resolve consistently
  // `API_BASE` and `apiUrl()` come from `utils/apiConfig.js`

  const [localItems, setLocalItems] = useState(null);
  const [loading, setLoading] = useState(false);
  const [width, setWidth] = useState(Dimensions.get('window').width);
  useEffect(() => {
    const sub = Dimensions.addEventListener?.('change', ({ window }) => setWidth(window.width));
    return () => { try { sub?.remove?.(); } catch (e) {} };
  }, []);

  // Robust image resolver (adapted from ProductForm.getImageSource)
  const getImageSource = (u, productItem = null) => {
    // if explicit resource id (require) passed
  if (!u && !productItem) return { uri: apiUrl('/images/placeholder.png') };
    if (typeof u === 'number') return u;

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

    const s = u ? String(u) : null;

    // absolute URL
    if (s && /^https?:\/\//i.test(s)) return { uri: s };

    // /images/filename.ext -> try assets by filename or fallback to server path
    if (s && s.match(/\/images\/(.+)$/i)) {
      const fname = s.match(/\/images\/(.+)$/i)[1].replace(/\.[^/.]+$/, '').toLowerCase();
      const r = tryKey(fname);
  if (r) return r;
  return { uri: apiUrl(s.startsWith('/') ? s : `/${s}`) };
    }

    // server-relative path
    if (s && s.startsWith('/')) {
      const name = s.replace(/\/.*\//, '').replace(/\.[^/.]+$/, '').toLowerCase();
      const r = tryKey(name);
  if (r) return r;
  return { uri: apiUrl(s) };
    }

    // try productItem fields (imageFilename, category, sku, name)
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

    // bare filename
    if (s && !s.includes('/')) {
      const fname = s.replace(/\.[^/.]+$/, '').toLowerCase();
      const r = tryKey(fname);
  if (r) return r;
  return { uri: apiUrl(`/images/${s}`) };
    }

    // fallback to productItem.imageUrl absolute or placeholder
    if (productItem && productItem.imageUrl) {
      const iv = productItem.imageUrl;
      if (typeof iv === 'string') {
        if (/^https?:\/\//i.test(iv)) return { uri: iv };
        if (iv.startsWith('/')) return { uri: apiUrl(iv) };
        return { uri: apiUrl(`/images/${iv}`) };
      }
    }

  return { uri: apiUrl(`/images/${s || 'placeholder.png'}`) };
  };

  // Normalize incoming cart items: prefer route.params.cart if present
  useEffect(() => {
    const routeCart = route?.params?.cart;
    if (!routeCart || !Array.isArray(routeCart)) {
      setLocalItems(null);
      return;
    }

    let cancelled = false;
    const normalizeAndFetch = async () => {
      setLoading(true);
      try {
        // routeCart may contain productId-only items; ensure we have name/price/image
        const resolved = await Promise.all(routeCart.map(async (it) => {
          const id = it.productId || it._id || it.id;
          let out = {
            _id: id || it._id || it.id || (it.name && it.name.replace(/\s+/g, '-').toLowerCase()),
            name: it.name || it.title || '',
            price: Number(it.price || it.unitPrice || 0),
            qty: it.quantity || it.qty || 1,
            imageUrl: it.imageUrl || null,
          };

          // If we don't have a name or imageUrl but have id, fetch product details from backend
          if ((!out.name || !out.imageUrl) && id) {
            try {
              const res = await axios.get(`${API_BASE}/api/public/products/${id}`);
              const p = res.data && res.data.product ? res.data.product : res.data;
              if (p) {
                out.name = out.name || p.name || p.title;
                out.price = out.price || Number(p.salePrice || p.price || 0);
                out.imageUrl = out.imageUrl || (p.imageUrl || (p.images && p.images[0]) || null);
                out.images = p.images || p.gallery || null;
              }
            } catch (e) {
              // best-effort: ignore fetch errors, keep existing data
              // console.warn('Could not fetch product for cart item', id, e.message || e);
            }
          }

          out._imageSrc = getImageSource(out.imageUrl || (out.images && out.images[0]) || null, out);
          return out;
        }));

        if (!cancelled) setLocalItems(resolved);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    normalizeAndFetch();
    return () => { cancelled = true; };
  }, [route, API_BASE]);

  const sourceItems = localItems || ctxItems;

  const subtotal = useMemo(() => (sourceItems || []).reduce((s, it) => {
    const price = Number(it.price || 0) || 0;
    const qty = Number(it.qty || it.quantity || 1) || 0;
    return s + (price * qty);
  }, 0), [sourceItems]);

  const isMobile = width < 480;
  const renderSummary = () => (
    <View style={[styles.right, isMobile && styles.rightMobile]}>
      <Text style={styles.heading}>Order summary</Text>
      <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Subtotal</Text><Text style={styles.summaryValue}>${subtotal.toFixed(2)}</Text></View>
      <TouchableOpacity><Text style={styles.estimate}>Estimate Delivery</Text></TouchableOpacity>
      <View style={styles.summaryRow}><Text style={[styles.summaryLabel, { fontWeight: '800' }]}>Total</Text><Text style={[styles.summaryValue, { fontWeight: '800' }]}>${subtotal.toFixed(2)}</Text></View>

      <TouchableOpacity style={styles.checkoutBtn} onPress={() => navigation.navigate('Transaction', { cart: (sourceItems || []).map(i => ({ productId: i._id || i.productId, name: i.name, price: i.price, quantity: i.qty || i.quantity })) })}>
        <Text style={styles.checkoutText}>Checkout</Text>
      </TouchableOpacity>

      <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center' }}>
        <Icon name="lock" size={16} color="#fff" />
        <Text style={{ color: '#fff', marginLeft: 8 }}>Secure Checkout</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Breadcrumb */}
      <View style={styles.breadcrumbRow}>
        <TouchableOpacity onPress={() => navigation.navigate('Main', { screen: 'Home' })}>
          <Text style={styles.breadcrumbText}>Home</Text>
        </TouchableOpacity>
        <Text style={styles.breadcrumbSep}> / </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Main', { screen: 'Products' }) }>
          <Text style={styles.breadcrumbText}>All Products</Text>
        </TouchableOpacity>
        <Text style={styles.breadcrumbSep}> / </Text>
        <Text style={styles.breadcrumbActive}>{route?.params?.categoryName || 'Lamps'}</Text>
      </View>
      <View style={[styles.inner, isMobile && styles.innerMobile]}>
        <View style={[styles.left, isMobile && styles.leftMobile]}>
          <Text style={styles.heading}>My cart</Text>
          <FlatList
            data={sourceItems}
            keyExtractor={i => i._id || i.productId || i.name}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            ListEmptyComponent={() => <Text style={styles.empty}>Your cart is empty</Text>}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Image source={item._imageSrc || getImageSource(item.imageUrl || (item.images && item.images[0]) || null, item)} style={styles.thumb} />
                <View style={styles.info}>
                  <Text style={styles.title}>{item.name}</Text>
                  <Text style={styles.price}>${(item.price || 0).toFixed(2)}</Text>
                </View>
                <View style={styles.controls}>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item._id || item.productId, -1)}><Text style={styles.qtyBtnText}>-</Text></TouchableOpacity>
                  <Text style={styles.qtyText}>{item.qty || item.quantity || 1}</Text>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item._id || item.productId, 1)}><Text style={styles.qtyBtnText}>+</Text></TouchableOpacity>
                </View>
                <View style={styles.lineTotal}><Text style={styles.lineTotalText}>${(((item.price||0) * (item.qty||item.quantity||1)) || 0).toFixed(2)}</Text></View>
                <TouchableOpacity style={styles.delete} onPress={() => removeFromCart(item._id || item.productId)}><Icon name="delete" size={18} color="#fff" /></TouchableOpacity>
              </View>
            )}
          />

          <View style={{ marginTop: 20 }}>
            <TouchableOpacity style={styles.linkRow}><Icon name="local-offer" size={18} color="#ff4d36" /><Text style={styles.linkText}>  Enter a promo code</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.linkRow, { marginTop: 8 }]}><Icon name="note" size={18} color="#ff4d36" /><Text style={styles.linkText}>  Add a note</Text></TouchableOpacity>
          </View>
          {isMobile && renderSummary()}
        </View>

        {!isMobile && renderSummary()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 20 },
  inner: { flexDirection: 'row', width: '100%', maxWidth: 1200, marginHorizontal: 'auto', paddingHorizontal: 20 },
  left: { flex: 1, paddingRight: 40 },
  right: { width: 360, paddingLeft: 20, borderLeftWidth: 1, borderLeftColor: '#222' },
  // Mobile adjustments
  innerMobile: { flexDirection: 'column', paddingHorizontal: 12 },
  leftMobile: { paddingRight: 0 },
  rightMobile: { width: '100%', marginLeft: 0, marginTop: 16 },
  heading: { color: '#fff', fontWeight: '700', fontSize: 20, marginBottom: 12 },
  breadcrumbRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 8 },
  breadcrumbText: { color: '#9ca3af', marginRight: 4 },
  breadcrumbSep: { color: '#444', marginHorizontal: 4 },
  breadcrumbActive: { color: '#fff', fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#111' },
  thumb: { width: 86, height: 86, backgroundColor: '#f2f2f2', marginRight: 18 },
  thumbMobile: { width: 64, height: 64, marginRight: 12 },
  info: { flex: 1 },
  title: { color: '#fff', fontWeight: '700' },
  price: { color: '#ccc', marginTop: 6 },
  controls: { width: 120, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  qtyBtn: { width: 36, height: 28, borderWidth: 1, borderColor: '#333', justifyContent: 'center', alignItems: 'center', borderRadius: 4 },
  qtyBtnText: { color: '#fff', fontSize: 18 },
  qtyText: { color: '#fff', minWidth: 28, textAlign: 'center' },
  lineTotal: { width: 90, alignItems: 'flex-end', marginLeft: 12 },
  lineTotalText: { color: '#fff', fontWeight: '700' },
  delete: { marginLeft: 12 },
  sep: { height: 1, backgroundColor: '#111', marginVertical: 0 },
  empty: { color: '#9ca3af', textAlign: 'center', marginTop: 40 },
  linkRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  linkText: { color: '#ff4d36', marginLeft: 6 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#111' },
  summaryLabel: { color: '#fff' },
  summaryValue: { color: '#fff' },
  estimate: { color: '#ff4d36', marginTop: 8, textDecorationLine: 'underline' },
  checkoutBtn: { marginTop: 20, backgroundColor: '#ff4d36', paddingVertical: 14, borderRadius: 24, alignItems: 'center' },
  checkoutText: { color: '#fff', fontWeight: '800' },
});

export default CartScreen;
