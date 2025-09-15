import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { format } from 'date-fns';
import { apiUrl } from '../../utils/apiConfig';
import Constants from 'expo-constants';
import assetsIndex from '../../assets/assetsIndex';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';

const formatUSD = (v) => {
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(v) || 0); } catch (e) { return `$${v}`; }
};

// Build API base dynamically (same approach as ProductForm) for resolving relative image paths
const debuggerHost = (Constants.manifest && (Constants.manifest.debuggerHost || Constants.manifest.packagerOpts?.host)) || '';
const devHost = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
const API_BASE = `http://${devHost}:5000`;

// Resolve various product image shapes to a React Native Image source (adapted from ProductForm.getImageSource)
const getImageSource = (uOrItem) => {
  try {
    const productItem = (uOrItem && (uOrItem.product || uOrItem)) || {};
    const u = (typeof uOrItem === 'string') ? uOrItem : null;

    const tryKey = (k) => {
      if (!k) return null;
      const key = k.toString().toLowerCase();
      if (assetsIndex.map && assetsIndex.map[key]) return assetsIndex.map[key];
      const spaced = key.replace(/[_\-\s]+/g, ' ').trim();
      if (assetsIndex.map && assetsIndex.map[spaced]) return assetsIndex.map[spaced];
      const underscored = key.replace(/[_\-\s]+/g, '_').trim();
      if (assetsIndex.map && assetsIndex.map[underscored]) return assetsIndex.map[underscored];
      return null;
    };

    const s = u ? String(u) : (productItem && (productItem.imageUrl || productItem.image || productItem.imageFilename || productItem.filename || productItem.url || (Array.isArray(productItem.images) && productItem.images[0]) )) || null;

    if (!s) return { uri: `${API_BASE}/images/placeholder.png` };
    const str = String(s);

    // Absolute URL
    if (/^https?:\/\//i.test(str)) return { uri: str };

    // If path like /images/filename.ext -> try map by filename
    if (str.match(/\/images\/(.+)$/i)) {
      const fname = str.match(/\/images\/(.+)$/i)[1].replace(/\.[^/.]+$/, '').toLowerCase();
      const r = tryKey(fname);
      if (r) return r;
      return { uri: `${API_BASE}${str.startsWith('/') ? str : `/${str}`}` };
    }

    // server-relative
    if (str.startsWith('/')) {
      const name = str.replace(/\/.*\//, '').replace(/\.[^/.]+$/, '').toLowerCase();
      const r = tryKey(name);
      if (r) return r;
      return { uri: `${API_BASE}${str}` };
    }

    // bare filename
    if (!str.includes('/')) {
      const fname = str.replace(/\.[^/.]+$/, '').toLowerCase();
      const r = tryKey(fname);
      if (r) return r;
      return { uri: `${API_BASE}/images/${str}` };
    }

    // fallback to attempting productItem.imageUrl
    if (productItem && productItem.imageUrl) {
      const iv = productItem.imageUrl;
      if (typeof iv === 'string') {
        if (/^https?:\/\//i.test(iv)) return { uri: iv };
        if (iv.startsWith('/')) return { uri: `${API_BASE}${iv}` };
        return { uri: `${API_BASE}/images/${iv}` };
      }
    }

    return { uri: `${API_BASE}/images/${str || 'placeholder.png'}` };
  } catch (err) {
    console.debug && console.debug('Receipt.getImageSource fallback', err);
    try { return require('../../assets/favicon.png'); } catch (_) { return { uri: `${API_BASE}/images/placeholder.png` }; }
  }
};

// Normalize different backend shapes into a consistent order object
const normalizeOrder = (raw) => {
  if (!raw) return null;
  let o = raw;
  // unwrap common wrappers
  if (o.data && (o.data.order || o.data.result || o.data)) {
    if (o.data.order) o = o.data.order;
    else if (o.data.result) o = o.data.result;
    else o = o.data;
  }
  if (o.order) o = o.order;
  if (o.result && o.result.order) o = o.result.order;

  // some APIs return items under different keys
  if (!Array.isArray(o.items)) {
    if (Array.isArray(o.orderItems)) o.items = o.orderItems;
    else if (Array.isArray(o.products)) o.items = o.products;
    else o.items = Array.isArray(o.items) ? o.items : [];
  }

  // normalize created/updated
  o.createdAt = o.createdAt || o.created || o.created_at || o.date || null;
  o.updatedAt = o.updatedAt || o.updated || o.updated_at || null;

  // normalize id/user/payment/status/version
  o._id = o._id || o.id || o.orderId || o._id;
  o.userId = o.userId || o.user || o.customerId || o.customer || null;
  o.paymentMethod = o.paymentMethod || o.payment || o.payment_method || null;
  o.status = o.status || (o.state || null);
  o.__v = (typeof o.__v !== 'undefined') ? o.__v : (typeof o.v !== 'undefined' ? o.v : null);

  return o;
};

// human-friendly payment method display (prefer brand + last4)
const formatPaymentMethodDisplay = (pm, order) => {
  // prefer explicit payment object from pm, else try order.payment
  const p = (pm && typeof pm === 'object') ? pm : (order && order.payment && typeof order.payment === 'object' ? order.payment : null);
  if (p) {
    const brand = (p.brand || p.cardBrand || p.type || p.provider || '').toString();
    let last4 = (p.last4 || p.cardNumberMasked || p.last_4 || p.lastFour || '').toString();
    if (!last4 && p.cardNumber && typeof p.cardNumber === 'string') {
      last4 = p.cardNumber.slice(-4);
    }
    if (brand && last4) {
      // User requested compact form: Brand + last4 (e.g., MasterCard1841)
      return `${brand}${last4.slice(-4)}`;
    }
    if (brand) return brand;
    if (last4) return `•••• ${last4.slice(-4)}`;
  }

  // if pm is a primitive string (e.g. 'mastercard')
  if (pm && typeof pm === 'string') {
    let s = pm.trim();
    s = s.replace(/^[^a-zA-Z0-9]+/, '');
    if (!s) return 'Saved payment';
    // capitalize simple names
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  return 'Saved payment';
};

const Receipt = ({ route, navigation }) => {
  const params = route.params || {};
  const initialOrder = params.order || null;
  const orderId = params.orderId || (initialOrder && (initialOrder._id || initialOrder.id));
  const [order, setOrder] = useState(initialOrder ? normalizeOrder(initialOrder) : null);
  const [loading, setLoading] = useState(!initialOrder && !!orderId);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    // On web, inject print CSS to hide app chrome and buttons when user prints from browser
    if (Platform.OS === 'web') {
      try {
        const styleId = 'receipt-print-style';
        if (!document.getElementById(styleId)) {
          const s = document.createElement('style');
          s.id = styleId;
          s.innerHTML = `@media print { body * { visibility: hidden !important; } #printable-receipt, #printable-receipt * { visibility: visible !important; } #printable-receipt { position: absolute; left: 0; top: 0; width: 100%; } }`;
          document.head.appendChild(s);
        }
      } catch (e) {
        // ignore DOM errors on non-web or restricted env
      }
    }
    async function fetchOrder(id) {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(apiUrl(`/orders/${id}`));
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = await res.json();
        if (mounted) {
          const normalized = normalizeOrder(data || data.order || data.result || data.data || data);
          setOrder(normalized);
          // if paymentMethod is an id-like string, try to enrich with backend-stored paymentMethods
          try {
            const pm = normalized && normalized.paymentMethod;
            if (pm && typeof pm === 'string') {
              // attempt to fetch user's payment methods and find matching id
              setPaymentLoading(true);
              const token = await AsyncStorage.getItem('token');
              if (token) {
                const headers = { Authorization: `Bearer ${token}` };
                try {
                  const r2 = await fetch(apiUrl('/users/payment-methods'), { headers });
                  if (r2.ok) {
                    const j2 = await r2.json().catch(() => null);
                    const list = (j2 && (j2.data?.paymentMethods || j2.paymentMethods || j2.data)) || [];
                    const found = (Array.isArray(list) && list.find && list.find(x => (x._id && x._id.toString() === pm) || (x.id && x.id.toString() === pm))) || null;
                    if (found && mounted) setOrder(prev => ({ ...(prev || {}), payment: found, paymentMethod: found }));
                  }
                } catch (e) {
                  // ignore fetch errors
                }
              }
              setPaymentLoading(false);
            }
          } catch (e) {
            // ignore enrichment errors
          }
        }
      } catch (err) {
        console.warn('Failed to fetch order', err);
        if (mounted) setError(err.message || 'Failed to fetch order');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (!initialOrder && orderId) fetchOrder(orderId);
    return () => { mounted = false; };
  }, [orderId]);

  // If items are just IDs or missing product details, try to fetch product details
  useEffect(() => {
    let mounted = true;
    const enrichItemsWithProductData = async (itemsArr) => {
      if (!Array.isArray(itemsArr) || itemsArr.length === 0) return null;
      const out = [];
      let changed = false;
      for (const it of itemsArr) {
        // if item already has name/price/image, keep
        const hasName = !!((it.product && it.product.name) || it.name);
        const hasPrice = !!((it.product && (it.product.price || it.product.salePrice)) || it.price);
        const hasImage = !!((it.product && (it.product.imageUrl || it.product.image || (Array.isArray(it.product.images) && it.product.images[0]))) || it.image || it.imageUrl);
        if (hasName && hasPrice && hasImage) {
          out.push(it);
          continue;
        }

        // attempt to find product id
        const pid = (it.product && (it.product._id || it.product.id)) || it.productId || it.product || it._id || it.id;
        if (!pid || typeof pid === 'object') { out.push(it); continue; }
        try {
          const res = await fetch(apiUrl(`/products/${pid}`));
          if (!res.ok) { out.push(it); continue; }
          const pdata = await res.json();
          const prod = (pdata && (pdata.product || pdata.data || pdata)) || pdata;
          const merged = { ...it, product: { ...(it.product || {}), ...(prod || {}) } };
          out.push(merged);
          changed = true;
        } catch (e) {
          out.push(it);
        }
      }
      return changed ? out : null;
    };

    (async () => {
      if (!order || !Array.isArray(order.items) || order.items.length === 0) return;
      try {
        const enriched = await enrichItemsWithProductData(order.items);
        if (mounted && enriched) setOrder(prev => ({ ...prev, items: enriched }));
      } catch (err) {
        console.warn('Enrich items failed', err);
      }
    })();

    return () => { mounted = false; };
  }, [order]);

  // If order exists and paymentMethod is an id string, try to enrich with payment method details from backend
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!order) return;
        const pm = order.paymentMethod;
        if (!pm || typeof pm !== 'string') return;
        const token = await AsyncStorage.getItem('token');
        if (!token) return;
        setPaymentLoading(true);
        const headers = { Authorization: `Bearer ${token}` };
        try {
          const r = await fetch(apiUrl('/users/payment-methods'), { headers });
          if (!r.ok) return;
          const j = await r.json().catch(() => null);
          const list = (j && (j.data?.paymentMethods || j.paymentMethods || j.data)) || [];
          const found = (Array.isArray(list) && list.find && list.find(x => (x._id && x._id.toString() === pm) || (x.id && x.id.toString() === pm))) || null;
          if (found && mounted) setOrder(prev => ({ ...(prev || {}), payment: found, paymentMethod: found }));
        } catch (e) {
          // ignore
        }
        setPaymentLoading(false);
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [order]);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FF3B30" />
        <Text style={{ color: '#999', marginTop: 12 }}>Loading receipt…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Receipt</Text>
        <Text style={styles.empty}>Unable to load receipt: {error}</Text>
        <TouchableOpacity style={styles.doneBtn} onPress={() => { setError(null); navigation.goBack(); }}>
          <Text style={styles.doneText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Receipt</Text>
        <Text style={styles.empty}>No receipt data available.</Text>
      </View>
    );
  }

  const created = order.createdAt ? new Date(order.createdAt) : new Date();
  const items = Array.isArray(order.items) ? order.items : [];

  // Compute totals and the actual payable amount
  const computeTotals = () => {
    const subtotal = order.subtotal || items.reduce((s, i) => {
      const price = (i.product && (i.product.price || 0)) || (i.price || 0);
      const qty = i.quantity || 1;
      return s + (price * qty);
    }, 0);

    const shippingCost = Number(order.shippingCost || order.shipping_fee || 0) || 0;
    const tax = Number(order.tax || 0) || 0;

    // Item-level implicit discounts (price vs salePrice)
    const itemLineDiscount = items.reduce((s, i) => {
      const basePrice = (i.product && (i.product.price || 0)) || (i.price || 0);
      const salePrice = (i.product && (i.product.salePrice || i.product.sale_price)) || (i.salePrice || i.sale_price) || basePrice;
      const qty = i.quantity || 1;
      return s + Math.max(0, (basePrice - salePrice) * qty);
    }, 0);

    // Order-level discount detection (many possible shapes)
    let orderDiscount = 0;
    const maybe = (v) => (typeof v === 'number' ? v : (v && !isNaN(Number(v)) ? Number(v) : null));
    const knownAmounts = [
      maybe(order.discountAmount), maybe(order.discount_amount), maybe(order.discount_total), maybe(order.discountValue), maybe(order.couponValue), maybe(order.couponAmount), maybe(order.coupon_discount), maybe(order.discount)
    ].filter(v => v !== null && typeof v !== 'undefined');

    if (knownAmounts.length > 0) {
      // prefer explicit amount fields
      orderDiscount = knownAmounts.find(v => v >= 0) || 0;
    } else if (order.discount && typeof order.discount === 'string' && order.discount.trim().endsWith('%')) {
      const pct = parseFloat(order.discount.replace('%', '').trim()) / 100;
      if (!isNaN(pct)) orderDiscount = subtotal * pct;
    } else if (typeof order.discount === 'number' && order.discount > 0 && order.discount < 1) {
      // fractional percentage (0.10 -> 10%)
      orderDiscount = subtotal * order.discount;
    }

    // adjustments (rounding, manual adjustments)
    const adjustments = Number(order.adjustments || order.adjustment || order.rounding || 0) || 0;

    // final payable: prefer explicit order.total/order.amount if present and numeric
    const explicitTotal = maybe(order.total) ?? maybe(order.amount);
    const discountTotal = (Number(order.discountTotal || 0) || 0) + itemLineDiscount + orderDiscount;
    const computed = subtotal + shippingCost + tax - discountTotal + adjustments;
    const payable = (typeof explicitTotal === 'number' && !isNaN(explicitTotal)) ? explicitTotal : computed;

    return { subtotal, shippingCost, tax, itemLineDiscount, orderDiscount, discountTotal, adjustments, computed, payable };
  };

  const totals = computeTotals();

  // helper to build printable HTML for PDF
  const buildPrintableHtml = () => {
    const escapeHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const itemsHtml = items.map((it) => {
      const name = escapeHtml((it.product && it.product.name) || it.name || it.productId || 'Item');
      const qty = it.quantity || 1;
      const price = ((it.product && (it.product.salePrice || it.product.price)) || it.price || 0);
      const lineTotal = price * qty;
      return `<tr><td style="padding:6px 0">${name} x${qty}</td><td style="padding:6px 0;text-align:right">${formatUSD(lineTotal)}</td></tr>`;
    }).join('');

    const { subtotal, shippingCost, tax, discountTotal, payable } = totals;

    return `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            @page { size: A4; margin: 20mm; }
            body { font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; margin: 0; padding: 0; }
            .receipt { max-width: 800px; margin: 0 auto; padding: 18px; }
            .header { text-align: center; }
            h1 { margin: 0; font-size: 20px; }
            .muted { color: #666; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            td { font-size: 13px; vertical-align: top; }
            .totals td { padding-top: 8px; border-top: 1px solid #ddd; }
            .right { text-align: right; }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <h1>AUTOPARTS STORE</h1>
              <div class="muted">ใบเสร็จรับเงิน</div>
            </div>
            <div style="margin-top:12px;font-size:13px">
              <div><strong>เลขที่ผู้ใช้:</strong> ${escapeHtml(order._id || order.id || '-')}</div>
              <div><strong>สถานะ:</strong> ${escapeHtml(order.status || '-')}</div>
              <div><strong>ช่องทางการชำระเงิน:</strong> ${escapeHtml(formatPaymentMethodDisplay(order.paymentMethod, order) || '-')}</div>
              <div><strong>วันที่:</strong> ${escapeHtml(order.createdAt ? format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm') : '')}</div>
            </div>

            <div style="margin-top:12px;font-size:13px">
              <div style="font-weight:700;margin-bottom:6px">ที่อยู่จัดส่ง</div>
              <div>${escapeHtml(order.shipping ? (order.shipping.fullName || `${order.shipping.firstName || ''} ${order.shipping.lastName || ''}`.trim()) : '')}</div>
              <div>${escapeHtml(order.shipping && order.shipping.line1 ? order.shipping.line1 : '')}</div>
              <div>${escapeHtml(order.shipping && order.shipping.line2 ? order.shipping.line2 : '')}</div>
              <div>อำเภอ/เขต: ${escapeHtml((order.shipping && (order.shipping.city || order.shipping.district)) || '')}</div>
              <div>จังหวัด: ${escapeHtml((order.shipping && (order.shipping.state || order.shipping.province)) || '')}</div>
              <div>รหัสไปรษณีย์: ${escapeHtml((order.shipping && (order.shipping.postalCode || order.shipping.zip)) || '')}</div>
            </div>


            <table class="totals" style="width:100%;margin-top:12px">
              <tr><td class="right">Subtotal</td><td class="right">${formatUSD(subtotal)}</td></tr>
              <tr><td class="right">Shipping</td><td class="right">${formatUSD(shippingCost)}</td></tr>
              <tr><td class="right">Tax</td><td class="right">${formatUSD(tax)}</td></tr>
              ${discountTotal ? `<tr><td class="right">Discounts</td><td class="right">-${formatUSD(discountTotal)}</td></tr>` : ''}
              <tr><td class="right"><strong>Payable</strong></td><td class="right"><strong>${formatUSD(payable)}</strong></td></tr>
            </table>
          </div>
        </body>
      </html>`;
  };

  const onExportPdf = async () => {
    try {
      const html = buildPrintableHtml();
      const { uri } = await Print.printToFileAsync({ html });
      if (!uri) throw new Error('No PDF generated');
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
      else Alert.alert('ไฟล์ถูกบันทึก', uri);
    } catch (err) {
      console.warn('Export PDF failed', err);
      Alert.alert('เกิดข้อผิดพลาด', String(err));
    }
  };

  return (
    <ScrollView nativeID="printable-receipt" style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>ย้อนกลับ</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} />
      </View>
      <View style={{ alignItems: 'center', marginVertical: 8 }}>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>-----------------------------</Text>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', marginVertical: 6 }}>ใบเสร็จรับเงิน</Text>
        <Text style={{ color: '#fff', fontSize: 20 }}>-----------------------------</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>เลขที่ผู้ใช้: <Text style={styles.value}>{order._id || order.id || ''}</Text></Text>
        <Text style={styles.cardText}>สถานะคำสั่งซื้อ: <Text style={styles.value}>{order.status || ''}</Text></Text>
        <Text style={styles.cardText}>วันที่ออก: <Text style={styles.value}>{order.createdAt ? format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm') : ''}</Text></Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.cardText}>ช่องทางการชำระเงิน: </Text>
          <Text style={[styles.value, { marginLeft: 6 }]}>{formatPaymentMethodDisplay(order.paymentMethod, order)}</Text>
          {paymentLoading ? <ActivityIndicator size="small" color="#fff" style={{ marginLeft: 8 }} /> : null}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>ที่อยู่จัดส่ง</Text>
        {order.shipping ? (
          <View>
            <Text style={styles.value}>{order.shipping.fullName || `${order.shipping.firstName || ''} ${order.shipping.lastName || ''}`.trim()}</Text>
            {order.shipping.line1 && <Text style={styles.cardText}>{order.shipping.line1}</Text>}
            {order.shipping.line2 && <Text style={styles.cardText}>{order.shipping.line2}</Text>}
            <Text style={styles.cardText}>อำเภอ/เขต: {[order.shipping.city, order.shipping.district].filter(Boolean).join(' ')}</Text>
            <Text style={styles.cardText}>จังหวัด: {order.shipping.state || order.shipping.province || ''}</Text>
            <Text style={styles.cardText}>รหัสไปรษณีย์: {order.shipping.postalCode || order.shipping.zip || ''}</Text>
          </View>
        ) : (
          <Text style={styles.empty}>N/A</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Items</Text>
        {items.length > 0 ? (
          items.map((it, idx) => {
            const imgSrc = getImageSource(it);
            const name = (it.product && it.product.name) || it.name || it.productId || 'Item';
            const qty = it.quantity || 1;
            const price = ((it.product && (it.product.salePrice || it.product.price)) || it.price || 0);
            const lineTotal = price * qty;
            return (
              <View key={idx} style={styles.itemRow}>
                <Image source={imgSrc} style={styles.thumb} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.itemName}>{name}</Text>
                  <Text style={styles.itemQty}>Qty: {qty}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.itemPrice}>{formatUSD(price)}</Text>
                  <Text style={styles.cardText}>รวม {formatUSD(lineTotal)}</Text>
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.empty}>No items found on this order.</Text>
        )}
      </View>

      <View style={styles.totals}>
        <View>
          <Text style={styles.cardText}>ยอดรวมย่อย</Text>
          <Text style={styles.cardText}>ค่าจัดส่ง</Text>
          <Text style={styles.cardText}>ภาษี</Text>
          { (totals.discountTotal) ? <Text style={styles.cardText}>ส่วนลด</Text> : null }
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.cardText}>{formatUSD(totals.subtotal)}</Text>
          <Text style={styles.cardText}>{formatUSD(totals.shippingCost)}</Text>
          <Text style={styles.cardText}>{formatUSD(totals.tax)}</Text>
          { (totals.discountTotal) ? <Text style={styles.cardText}>-{formatUSD(totals.discountTotal)}</Text> : null }
        </View>
      </View>

      <View style={[styles.totals, { marginTop: 8, backgroundColor: '#0b0b0b' }]}>
        <Text style={styles.totalLabel}>รวมทั้งสิ้น</Text>
        <Text style={styles.totalValue}>{formatUSD(totals.payable)}</Text>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 }}>
        <TouchableOpacity style={[styles.ctaButton, { backgroundColor: '#1B6BFF', flex: 1 }]} onPress={onExportPdf}>
          <Text style={styles.ctaText}>ส่งออกเป็น PDF</Text>
        </TouchableOpacity>
      </View>

      {/* 'Done' button removed per request */}
    </ScrollView>
    );
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0a0a0a' },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    backButton: { paddingVertical: 6, paddingHorizontal: 10 },
    backText: { color: '#fff' },
    headerTitle: { flex: 1, textAlign: 'center' },
    title: { color: '#fff', fontSize: 20, fontWeight: '700', margin: 12 },
    empty: { color: '#999', margin: 12 },
    doneBtn: { padding: 10, backgroundColor: '#444', borderRadius: 6, alignSelf: 'center' },
    doneText: { color: '#fff' },
    card: { backgroundColor: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8, marginBottom: 12 },
    cardTitle: { color: '#fff', fontWeight: '800', marginBottom: 6 },
    cardText: { color: 'rgba(255,255,255,0.7)' },
    value: { color: '#fff', fontWeight: '400' },
    itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
    thumb: { width: 60, height: 60, borderRadius: 6, backgroundColor: '#222' },
    itemName: { color: '#fff', fontWeight: '700' },
    itemQty: { color: '#ddd', fontSize: 12 },
    itemPrice: { color: '#fff', fontWeight: '800' },
    totals: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderRadius: 6, backgroundColor: 'transparent', marginVertical: 8 },
    totalLabel: { color: '#fff', fontWeight: '700' },
    totalValue: { color: '#fff', fontWeight: '900' },
    ctaButton: { backgroundColor: '#0B7A3E', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 6, marginBottom: 12, alignItems: 'center' },
    ctaText: { color: '#fff', fontWeight: '800' },
  });

  export default Receipt;
