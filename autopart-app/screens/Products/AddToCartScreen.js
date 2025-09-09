import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, TextInput, Alert, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import assetsIndex from '../../assets/assetsIndex';
import AuthContext from '../../context/AuthContext';

const AddToCartScreen = ({ navigation, route }) => {
  const { product } = route.params || {};
  const { user, token } = useContext(AuthContext);

  const [quantity, setQuantity] = useState(1);

  if (!product) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>ไม่พบสินค้าที่เลือก</Text>
      </View>
    );
  }

  const getImageSource = (item) => {
    if (!item) return { uri: 'https://via.placeholder.com/530x708.png?text=Part' };
    const key = (item.imageFilename || item.name || item.category || item.sku || '').toString().toLowerCase().replace(/\.[^/.]+$/, '').replace(/[^a-z0-9\s_\-]/g, '');
    if (assetsIndex.map[key]) return assetsIndex.map[key];
    return { uri: 'https://via.placeholder.com/530x708.png?text=Part' };
  };

  const price = product.salePrice || product.price || product.originalPrice || 0;
  const total = price * (quantity || 0);

  const onCheckout = () => {
    if (!user || !token) {
      Alert.alert('ต้องเข้าสู่ระบบ', 'กรุณาเข้าสู่ระบบก่อนทำการชำระเงิน', [
        { text: 'ตกลง', onPress: () => navigation.navigate('Login') }
      ]);
      return;
    }

    // Build simple cart payload and navigate to Transaction screen
    const cartItem = {
      productId: product._id || product.id,
      name: product.name,
      price,
      quantity,
      subtotal: total,
      image: product.imageUrl || product.imageFilename || null,
    };

    navigation.navigate('Transaction', { cart: [cartItem] });
  };


  const inc = () => setQuantity(q => Math.min((q || 0) + 1, 999));
  const dec = () => setQuantity(q => Math.max((q || 1) - 1, 1));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Navigation bar: left = breadcrumb, right = pagination */}
      <View style={styles.navbar}>
        <View style={styles.breadcrumb}>
          <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.breadcrumbLink}>
            <Text style={styles.linkText}>Home</Text>
          </TouchableOpacity>
          <Text style={styles.sep}>/</Text>
          <Text style={styles.current}>{product.name || 'Door Handle'}</Text>
        </View>

  {/* right-side pagination removed per request */}
      </View>
      <View style={styles.card}>
        <Image source={getImageSource(product)} style={styles.image} resizeMode="cover" />
        <View style={styles.info}>
          <Text style={styles.name}>{product.name}</Text>
          <Text style={styles.category}>{product.category}</Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>฿{price?.toLocaleString?.() ?? price}</Text>
            {product.salePrice && (
              <Text style={styles.original}>฿{(product.price || product.originalPrice)?.toLocaleString?.()}</Text>
            )}
          </View>

          <View style={styles.stockRow}>
            <Text style={styles.stockLabel}>สต็อก: </Text>
            <Text style={styles.stockValue}>{product.stock ?? 'ไม่ระบุ'}</Text>
          </View>

          <View style={styles.qtyRow}>
            <TouchableOpacity style={styles.qtyBtn} onPress={dec}>
              <Icon name="remove" size={20} color="#fff" />
            </TouchableOpacity>
            <TextInput
              style={styles.qtyInput}
              value={String(quantity)}
              keyboardType="number-pad"
              onChangeText={(t) => {
                const n = parseInt(t.replace(/[^0-9]/g, ''), 10) || 0;
                if (n <= 0) setQuantity(1);
                else if (n > 999) setQuantity(999);
                else setQuantity(n);
              }}
            />
            <TouchableOpacity style={styles.qtyBtn} onPress={inc}>
              <Icon name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>รวมทั้งสิ้น</Text>
            <Text style={styles.totalValue}>฿{total?.toLocaleString?.()}</Text>
          </View>

          <TouchableOpacity style={styles.checkoutBtn} onPress={onCheckout}>
            <Text style={styles.checkoutText}>ชำระเงิน</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.descBlock}>
        <Text style={styles.descTitle}>รายละเอียด</Text>
        <Text style={styles.descText}>{product.description || 'ไม่มีรายละเอียดเพิ่มเติม'}</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#f8f9fa', paddingBottom: 40 },
  navbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, backgroundColor: '#ffffff', padding: 8, borderRadius: 10, elevation: 1 },
  breadcrumb: { flexDirection: 'row', alignItems: 'center' },
  breadcrumbLink: { paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6 },
  linkText: { color: '#007AFF', fontWeight: '600' },
  sep: { marginHorizontal: 6, color: '#666' },
  current: { color: '#333', fontWeight: '700' },
  /* pagination styles removed */
  card: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', flexDirection: 'row', elevation: 2 },
  image: { width: 160, height: 160 },
  info: { flex: 1, padding: 12 },
  name: { fontSize: 18, fontWeight: '700', color: '#222' },
  category: { fontSize: 13, color: '#666', marginTop: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 8 },
  price: { fontSize: 20, fontWeight: '700', color: '#007AFF', marginRight: 8 },
  original: { fontSize: 14, color: '#999', textDecorationLine: 'line-through' },
  stockRow: { flexDirection: 'row', marginTop: 8, alignItems: 'center' },
  stockLabel: { color: '#333', fontWeight: '600' },
  stockValue: { color: '#666', marginLeft: 6 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  qtyBtn: { backgroundColor: '#007AFF', padding: 8, borderRadius: 8 },
  qtyInput: { borderWidth: 1, borderColor: '#eaeaea', marginHorizontal: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, minWidth: 60, textAlign: 'center' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  totalLabel: { fontSize: 16, color: '#333', fontWeight: '600' },
  totalValue: { fontSize: 18, color: '#ff6b6b', fontWeight: '700' },
  checkoutBtn: { marginTop: 16, backgroundColor: '#ff6b6b', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  checkoutText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  descBlock: { marginTop: 12, backgroundColor: '#fff', padding: 12, borderRadius: 10 },
  descTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  descText: { color: '#555', lineHeight: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { color: '#666' },
});

export default AddToCartScreen;
