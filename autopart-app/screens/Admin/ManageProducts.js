import React, { useEffect, useState, useContext } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import axios from 'axios';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'react-native';
import AuthContext from '../../context/AuthContext';

const ManageProducts = ({ navigation }) => {
  const { user, token } = useContext(AuthContext);
  const debuggerHost = (Constants.manifest && (Constants.manifest.debuggerHost || Constants.manifest.packagerOpts?.host)) || '';
  const devHost = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
  const API_BASE = `http://${devHost}:5000`;

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({ name: '', category: '', price: '', stock: '' });
  const [editingProduct, setEditingProduct] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    if (!token || !user) return;
    fetchProducts();
  }, [token, user]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API_BASE}/api/products`, { headers });
      const list = res && res.data && res.data.data && res.data.data.products ? res.data.data.products : [];
      setProducts(list);
    } catch (err) {
      console.warn('Failed to fetch products', err?.response?.data || err.message || err);
      Alert.alert('Error', 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const pickImageAndUpload = async (productId) => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return Alert.alert('Permission', 'Image library permission required');
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
      if (res.cancelled) return;
      // res.uri available
      setActionLoading(productId);
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' };
      const formData = new FormData();
      const uriParts = res.uri.split('/');
      const name = uriParts[uriParts.length - 1] || `photo-${Date.now()}.jpg`;
      // On Android expo returns file:// URIs; on web it's a blob
      formData.append('image', { uri: res.uri, name, type: 'image/jpeg' });

      const uploadRes = await axios.post(`${API_BASE}/api/products/${productId}/image`, formData, { headers });
      if (uploadRes && uploadRes.data && uploadRes.data.success) {
        const updated = uploadRes.data.data.product;
        setProducts(prev => prev.map(p => String(p._id) === String(productId) ? updated : p));
      } else {
        Alert.alert('Error', 'Image upload failed');
      }
    } catch (err) {
      console.warn('Image upload error', err?.response?.data || err.message || err);
      Alert.alert('Error', err?.response?.data?.message || 'Upload failed');
    } finally {
      setActionLoading(null);
    }
  };

  const confirmDeleteImage = (productId) => {
    Alert.alert('Confirm', 'Delete product image?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteImage(productId) }
    ]);
  };

  const deleteImage = async (productId) => {
    setActionLoading(productId);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.delete(`${API_BASE}/api/products/${productId}/image`, { headers });
      if (res && res.data && res.data.success) {
        const updated = res.data.data.product;
        setProducts(prev => prev.map(p => String(p._id) === String(productId) ? updated : p));
      } else {
        Alert.alert('Error', 'Failed to remove image');
      }
    } catch (err) {
      console.warn('Delete image failed', err?.response?.data || err.message || err);
      Alert.alert('Error', err?.response?.data?.message || 'Delete failed');
    } finally {
      setActionLoading(null);
    }
  };

  const openAdd = () => {
    setEditingProduct(null);
    setForm({ name: '', category: '', price: '', stock: '' });
    setModalVisible(true);
  };

  const openEdit = (product) => {
    setEditingProduct(product);
    setForm({ name: product.name || '', category: product.category || '', price: String(product.price || ''), stock: String(product.stock || 0) });
    setModalVisible(true);
  };

  const submitCreate = async () => {
    const { name, category, price, stock } = form;
    if (!name || !category || !price) return Alert.alert('Validation', 'Please provide name, category and price');
    setActionLoading(editingProduct ? editingProduct._id : 'create');
    try {
      const headers = { Authorization: `Bearer ${token}` };
      if (editingProduct) {
        // update existing
        const res = await axios.put(`${API_BASE}/api/products/${editingProduct._id}`, { name: name.trim(), category: category.trim(), price: Number(price), stock: Number(stock || 0) }, { headers });
        if (res && res.data && res.data.success) {
          const updated = res.data.data.product;
          setProducts(prev => prev.map(p => String(p._id) === String(updated._id) ? updated : p));
          setModalVisible(false);
          setEditingProduct(null);
          Alert.alert('Success', 'Product updated');
        } else {
          Alert.alert('Error', 'Failed to update product');
        }
      } else {
        const body = { name: name.trim(), category: category.trim(), price: Number(price), stock: Number(stock || 0) };
        const res = await axios.post(`${API_BASE}/api/products`, body, { headers });
        if (res && res.data && res.data.success) {
          const p = res.data.data.product;
          setProducts(prev => [p, ...prev]);
          setModalVisible(false);
          Alert.alert('Success', 'Product created');
        } else {
          Alert.alert('Error', 'Failed to create product');
        }
      }
    } catch (err) {
      console.warn('Create/update product error', err?.response?.data || err.message || err);
      Alert.alert('Error', err?.response?.data?.message || (editingProduct ? 'Update failed' : 'Create failed'));
    } finally {
      setActionLoading(null);
    }
  };

  const confirmDelete = (id) => {
    Alert.alert('Confirm', 'Delete this product?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteProduct(id) }
    ]);
  };

  const deleteProduct = async (id) => {
    setActionLoading(id);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.delete(`${API_BASE}/api/products/${id}`, { headers });
      if (res && res.data && res.data.success) {
        setProducts(prev => prev.filter(p => String(p._id) !== String(id)));
        Alert.alert('Deleted', 'Product removed');
      } else {
        Alert.alert('Error', 'Failed to delete product');
      }
    } catch (err) {
      console.warn('Delete product failed', err?.response?.data || err.message || err);
      Alert.alert('Error', err?.response?.data?.message || 'Delete failed');
    } finally {
      setActionLoading(null);
    }
  };

  const updateStock = async (id, delta) => {
    // delta can be positive or negative amount to adjust stock
    const product = products.find(p => String(p._id) === String(id));
    if (!product) return;
    const newStock = Math.max(0, Number(product.stock || 0) + Number(delta));
    setActionLoading(id);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.put(`${API_BASE}/api/products/${id}`, { stock: newStock }, { headers });
      if (res && res.data && res.data.success) {
        setProducts(prev => prev.map(p => String(p._id) === String(id) ? res.data.data.product : p));
      } else {
        Alert.alert('Error', 'Failed to update stock');
      }
    } catch (err) {
      console.warn('Update stock failed', err?.response?.data || err.message || err);
      Alert.alert('Error', err?.response?.data?.message || 'Update failed');
    } finally {
      setActionLoading(null);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.item}>
      <View style={{ flex: 1 }}>
        {item.imageUrl ? <Image source={{ uri: (item.imageUrl.startsWith('http') ? item.imageUrl : `${API_BASE}${item.imageUrl}`) }} style={{ width: 80, height: 60, marginBottom: 8, borderRadius: 6 }} /> : null}
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.meta}>{item.category} • ฿{item.price}</Text>
        <Text style={styles.meta}>Stock: {item.stock}</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.smallBtn} onPress={() => pickImageAndUpload(item._id)} disabled={actionLoading === item._id}>
          <Text style={styles.smallBtnText}>Image</Text>
        </TouchableOpacity>
        {item.imageUrl ? (
          <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#b32626' }]} onPress={() => confirmDeleteImage(item._id)} disabled={actionLoading === item._id}>
            <Text style={styles.smallBtnText}>Remove</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.smallBtn} onPress={() => updateStock(item._id, 1)} disabled={actionLoading === item._id}>
          <Text style={styles.smallBtnText}>+1</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#1f6feb' }]} onPress={() => openEdit(item)} disabled={actionLoading === item._id}>
          <Text style={styles.smallBtnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.smallBtn} onPress={() => updateStock(item._id, -1)} disabled={actionLoading === item._id}>
          <Text style={styles.smallBtnText}>-1</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#ff6b6b' }]} onPress={() => confirmDelete(item._id)} disabled={actionLoading === item._id}>
          <Text style={styles.smallBtnText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!token || !user) return <View style={styles.container}><Text style={styles.empty}>Please login as admin</Text></View>;
  if (user.role !== 'admin') return <View style={styles.container}><Text style={styles.empty}>Access denied. Admins only.</Text></View>;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Manage Products</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
        <TouchableOpacity style={styles.primaryBtn} onPress={openAdd}><Text style={{ color: '#fff', fontWeight: '700' }}>Add Product</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={fetchProducts}><Text style={{ color: '#111' }}>Refresh</Text></TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator /> : (
        <FlatList data={products} keyExtractor={p => String(p._id)} renderItem={renderItem} ListEmptyComponent={<Text style={styles.empty}>No products</Text>} />
      )}

      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Product</Text>
            <TextInput placeholder="Name" value={form.name} onChangeText={t => setForm(f => ({ ...f, name: t }))} style={styles.input} />
            <TextInput placeholder="Category" value={form.category} onChangeText={t => setForm(f => ({ ...f, category: t }))} style={styles.input} />
            <TextInput placeholder="Price" keyboardType="numeric" value={form.price} onChangeText={t => setForm(f => ({ ...f, price: t }))} style={styles.input} />
            <TextInput placeholder="Stock" keyboardType="numeric" value={form.stock} onChangeText={t => setForm(f => ({ ...f, stock: t }))} style={styles.input} />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
              <TouchableOpacity style={{ marginRight: 8 }} onPress={() => { setModalVisible(false); setEditingProduct(null); }}><Text style={{ color: '#333' }}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.formSubmit} onPress={submitCreate}><Text style={{ color: '#fff' }}>{actionLoading === 'create' ? '...' : 'Create'}</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, backgroundColor: '#0a0a0a' },
  header: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 12 },
  item: { backgroundColor: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  name: { color: '#fff', fontWeight: '700' },
  meta: { color: '#ccc', marginTop: 4 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  smallBtn: { backgroundColor: '#111', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, marginLeft: 8 },
  smallBtnText: { color: '#fff', fontWeight: '700' },
  empty: { color: '#999', textAlign: 'center', marginTop: 20 },
  primaryBtn: { backgroundColor: '#0B7A3E', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  secondaryBtn: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  modalWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalCard: { width: 520, maxWidth: '95%', backgroundColor: '#111', padding: 16, borderRadius: 8 },
  modalTitle: { color: '#fff', fontWeight: '800', marginBottom: 8 },
  input: { backgroundColor: '#222', color: '#fff', padding: 8, borderRadius: 6, marginBottom: 8 },
  formSubmit: { backgroundColor: '#0B7A3E', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 }
});

export default ManageProducts;
