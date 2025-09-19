import React, { useContext, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AuthContext from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import assetsIndex from '../assets/assetsIndex';

const Orders = ({ navigation }) => {
  const { user } = useContext(AuthContext);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  const debuggerHost = (Constants.manifest && (Constants.manifest.debuggerHost || Constants.manifest.packagerOpts?.host)) || '';
  const devHost = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
  const API_BASE = `http://${devHost}:5000`;

  const getImageSource = (u, productItem = null) => {
    // if explicit resource id (require) passed
    if (!u && !productItem) return { uri: `${API_BASE}/images/placeholder.png` };
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

    // 1) Absolute URL
    if (s && /^https?:\/\//i.test(s)) return { uri: s };

    // 2) If path like /images/filename.ext -> try map by filename
    if (s && s.match(/\/images\/(.+)$/i)) {
      const fname = s.match(/\/images\/(.+)$/i)[1].replace(/\.[^/.]+$/, '').toLowerCase();
      const r = tryKey(fname);
      if (r) return r;
      // fallback to backend-hosted absolute
      return { uri: `${API_BASE}${s.startsWith('/') ? s : `/${s}`}` };
    }

    // 3) If starts with leading slash (server-relative)
    if (s && s.startsWith('/')) {
      const name = s.replace(/\/.+\//, '').replace(/\.[^/.]+$/, '').toLowerCase();
      const r = tryKey(name);
      if (r) return r;
      return { uri: `${API_BASE}${s}` };
    }

    // 4) If productItem provided, try fields (imageFilename, category, sku, name)
    if (productItem) {
      try {
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
      } catch (e) { /* ignore */ }
    }

    // 5) If given a bare filename (no slashes) try map by filename
    if (s && !s.includes('/')) {
      const fname = s.replace(/\.[^/.]+$/, '').toLowerCase();
      const r = tryKey(fname);
      if (r) return r;
      // fallback to backend /images/<filename>
      return { uri: `${API_BASE}/images/${s}` };
    }

    // final fallback: try to use productItem.imageUrl as absolute or a placeholder
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

  const makeImageSource = (item) => {
    try {
      const first = item?.items?.[0];
      const p = first?.product || first || {};
      const url = p?.imageUrl || p?.image || (p.images && p.images[0]) || null;
      return getImageSource(url, p);
    } catch (e) { /* ignore */ }
    return { uri: `${API_BASE}/images/placeholder.png` };
  };

  const fetchOrders = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const resp = await fetch(`${API_BASE}/api/orders/mine`, { headers });
      const data = await resp.json();
      if (data?.success) setOrders(data.data.orders || []);
    } catch (err) {
      console.error('Load orders failed', err);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchOrders(); }, [user]);

  const [width, setWidth] = useState(Dimensions.get('window').width);
  useEffect(() => {
    const sub = Dimensions.addEventListener?.('change', ({ window }) => setWidth(window.width));
    return () => { try { sub?.remove?.(); } catch (e) {} };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
          <Icon name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>คำสั่งซื้อของฉัน</Text>
      </View>
      {loading ? <Text style={styles.info}>กำลังโหลด...</Text> : (
        <FlatList
          data={orders}
          keyExtractor={o => o._id || o.id}
          renderItem={({ item }) => {
            const first = item.items && item.items[0];
            const rawTitle = (first && ((first.product && first.product.name) || first.name)) || `Order ${(item._id||item.id||'').toString().substring(0,8)}`;
            // remove 'Model ###' tokens and parentheses
            const title = String(rawTitle).replace(/\bModel\s*\d+\b/gi, '').replace(/\(.*?\)/g, '').replace(/\s{2,}/g, ' ').trim();
            const thumb = makeImageSource(item);
            // compute total similar to Receipt/Profile: prefer item.total else sum item.product.price*qty
            const orderTotalNum = (item.total != null)
              ? Number(item.total)
              : Number((item.items || []).reduce((s, it) => {
                  const qty = Number(it?.quantity) || Number(it?.qty) || 1;
                  const price = (it?.product && (it.product.salePrice || it.product.price)) || Number(it?.price) || 0;
                  return s + (Number(price) * qty);
                }, 0) || 0);
            let orderTotalStr;
            try { orderTotalStr = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(orderTotalNum || 0); }
            catch (e) { orderTotalStr = `฿${(orderTotalNum || 0).toFixed(2)}`; }
            // aggregate item counts by cleaned product name
            const agg = (item.items || []).reduce((m, it) => {
              const raw = (it?.product && it.product.name) || it?.name || it?.product || 'Unknown';
              const name = String(raw).replace(/\bModel\s*\d+\b/gi, '').replace(/\(.*?\)/g, '').replace(/\s{2,}/g, ' ').trim() || 'Unknown';
              const qty = Number(it?.quantity) || Number(it?.qty) || 1;
              m[name] = (m[name] || 0) + qty;
              return m;
            }, {});
            const aggStr = Object.keys(agg).map(k => `${k} x${agg[k]}`).join(' · ');
            const isMobile = width < 480;
            return (
            <TouchableOpacity style={[styles.row, isMobile && styles.rowMobile]} onPress={() => navigation.navigate('Receipt', { order: item })}>
              <Image source={thumb} style={[styles.rowThumb, isMobile && styles.rowThumbMobile]} />
              <View style={{ flex: 1, marginLeft: isMobile ? 8 : 12 }}>
                <Text style={styles.orderId}>{title}</Text>
                <Text style={styles.orderMeta}>{new Date(item.createdAt).toLocaleString()} · {item.items?.length || 0} รายการ</Text>
                {aggStr ? <Text style={[styles.orderMeta, { marginTop: 6 }]}>{aggStr}</Text> : null}
                {isMobile ? <Text style={[styles.orderTotal, { marginTop: 8 }]}>{orderTotalStr}</Text> : null}
              </View>
              {!isMobile && <Text style={styles.orderTotal}>{orderTotalStr}</Text>}
            </TouchableOpacity>
          )}}
          ListEmptyComponent={<Text style={styles.info}>ยังไม่มีคำสั่งซื้อ</Text>}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#000' },
  title: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 12 },
  info: { color: '#999' },
  row: { padding: 12, backgroundColor: '#111', marginBottom: 8, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowThumb: { width: 56, height: 56, borderRadius: 6, backgroundColor: '#222' },
  rowMobile: { flexDirection: 'row', alignItems: 'flex-start' },
  rowThumbMobile: { width: 48, height: 48 },
  orderId: { color: '#fff', fontWeight: '700' },
  orderMeta: { color: '#999', fontSize: 12 },
  orderTotal: { color: '#fff', fontWeight: '800' },
});

export default Orders;
