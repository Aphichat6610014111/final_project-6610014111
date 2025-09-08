import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import axios from 'axios';
import AuthContext from '../../context/AuthContext';
import Icon from 'react-native-vector-icons/MaterialIcons';

const ProductForm = ({ route, navigation }) => {
  const { user, token, logout } = useContext(AuthContext);
  const product = route?.params?.product;
  const isEdit = !!product;

  const [formData, setFormData] = useState({
    name: product?.name || '',
    category: product?.category || '',
    description: product?.description || '',
  imageUrl: product?.imageUrl || '',
    price: product?.price?.toString() || '',
    quantity: product?.stock?.toString() || '', // ใช้ stock จาก backend
  });
  const [loading, setLoading] = useState(false);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const { name, category, price, quantity } = formData;

    if (!name.trim()) {
      Alert.alert('ข้อผิดพลาด', 'กรุณากรอกชื่อสินค้า');
      return false;
    }
    if (!category.trim()) {
      Alert.alert('ข้อผิดพลาด', 'กรุณากรอกหมวดหมู่');
      return false;
    }
    if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
      Alert.alert('ข้อผิดพลาด', 'กรุณากรอกราคาที่ถูกต้อง');
      return false;
    }
    if (!quantity || isNaN(parseInt(quantity)) || parseInt(quantity) < 0) {
      Alert.alert('ข้อผิดพลาด', 'กรุณากรอกจำนวนที่ถูกต้อง');
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    // ตรวจสอบว่า user login แล้วหรือไม่
    if (!user || !token) {
      Alert.alert('ข้อผิดพลาด', 'กรุณาเข้าสู่ระบบก่อน');
      await logout();
      return;
    }

    // Debug: ตรวจสอบ user และ token
    console.log('User:', user);
    console.log('Token:', token);

    setLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        category: formData.category.trim(),
  imageUrl: formData.imageUrl?.trim() || '',
        description: formData.description.trim(),
        price: parseFloat(formData.price),
        stock: parseInt(formData.quantity), // ใช้ stock แทน quantity
      };

      if (isEdit) {
        await axios.put(`http://localhost:5000/api/products/${product._id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // แสดงข้อความสำเร็จ 2 วินาที แล้วกลับไปหน้าเดิม
        setTimeout(() => {
          setLoading(false);
          navigation.goBack(); // กลับไปหน้าเดิม (ProductList จะ refresh อัตโนมัติ)
        }, 2000);
        
      } else {
        await axios.post('http://localhost:5000/api/products', payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // แสดงข้อความสำเร็จ 2 วินาที แล้วกลับไปหน้าเดิม
        setTimeout(() => {
          setLoading(false);
          navigation.goBack(); // กลับไปหน้าเดิม (ProductList จะ refresh อัตโนมัติ)
        }, 2000);
      }
    } catch (error) {
      console.log(error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        Alert.alert('เซสชันหมดอายุ', 'กรุณาเข้าสู่ระบบใหม่', [
          { text: 'ตกลง', onPress: async () => await logout() }
        ]);
        return;
      }
      Alert.alert(
        'ข้อผิดพลาด',
        isEdit ? 'ไม่สามารถอัปเดตสินค้าได้' : 'ไม่สามารถเพิ่มสินค้าได้'
      );
    } finally {
        // setLoading(false); // Removed to allow loading to persist for 2 seconds
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>{isEdit ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
          {/* ชื่อสินค้า */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              <Icon name="inventory" size={16} color="#666" /> ชื่อสินค้า *
            </Text>
            <TextInput
              style={styles.input}
              placeholder="กรอกชื่อสินค้า"
              value={formData.name}
              onChangeText={value => updateField('name', value)}
              placeholderTextColor="#999"
            />
          </View>

          {/* หมวดหมู่ */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              <Icon name="category" size={16} color="#666" /> หมวดหมู่ *
            </Text>
            <TextInput
              style={styles.input}
              placeholder="เช่น เบรก, ไส้กรอง, ระบบไฟ"
              value={formData.category}
              onChangeText={value => updateField('category', value)}
              placeholderTextColor="#999"
            />
          </View>

          {/* Image URL */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              <Icon name="image" size={16} color="#666" /> Image URL
            </Text>
            <TextInput
              style={styles.input}
              placeholder="https://example.com/part.jpg"
              value={formData.imageUrl}
              onChangeText={value => updateField('imageUrl', value)}
              placeholderTextColor="#999"
            />
          </View>

          {/* รายละเอียด */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              <Icon name="description" size={16} color="#666" /> รายละเอียด
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="รายละเอียดเพิ่มเติมของสินค้า"
              value={formData.description}
              onChangeText={value => updateField('description', value)}
              multiline
              numberOfLines={3}
              placeholderTextColor="#999"
            />
          </View>

          {/* ราคา & จำนวน */}
          <View style={styles.row}>
            <View style={[styles.formGroup, styles.halfWidth]}>
              <Text style={styles.label}>
                <Icon name="attach-money" size={16} color="#666" /> ราคา (บาท) *
              </Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                value={formData.price}
                onChangeText={value => updateField('price', value)}
                keyboardType="decimal-pad"
                placeholderTextColor="#999"
              />
            </View>
            <View style={[styles.formGroup, styles.halfWidth]}>
              <Text style={styles.label}>
                <Icon name="inventory-2" size={16} color="#666" /> จำนวน *
              </Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                value={formData.quantity}
                onChangeText={value => updateField('quantity', value)}
                keyboardType="number-pad"
                placeholderTextColor="#999"
              />
            </View>
          </View>

          {/* Preview */}
          <View style={styles.preview}>
            <Text style={styles.previewTitle}>Preview</Text>
            <View style={styles.previewCard}>
              {formData.imageUrl ? (
                <Image source={{ uri: formData.imageUrl }} style={{ width: 120, height: 90, borderRadius: 8, marginBottom: 10 }} />
              ) : (
                <View style={{ width: 120, height: 90, borderRadius: 8, backgroundColor: '#f1f3f4', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <Icon name="image" size={28} color="#bbb" />
                </View>
              )}
              <Text style={styles.previewName}>{formData.name || 'Part name'}</Text>
              <Text style={styles.previewCategory}>{formData.category || 'Category'}</Text>
              <View style={styles.previewDetails}>
                <Text style={styles.previewPrice}>฿{formData.price ? parseFloat(formData.price).toLocaleString() : '0'}</Text>
                <Text style={styles.previewQuantity}>stock: {formData.quantity || '0'}</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Icon name="save" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>{isEdit ? 'อัปเดต' : 'บันทึก'}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: { padding: 8 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  content: { flex: 1 },
  form: { padding: 20 },
  formGroup: { marginBottom: 20 },
  row: { flexDirection: 'row', gap: 15 },
  halfWidth: { flex: 1 },
  label: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  preview: { marginTop: 20 },
  previewTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12 },
  previewCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  previewName: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  previewCategory: { fontSize: 14, color: '#666', marginBottom: 8 },
  previewDetails: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f3f4' },
  previewPrice: { fontSize: 18, fontWeight: 'bold', color: '#007AFF' },
  previewQuantity: { fontSize: 14, color: '#34C759', fontWeight: '600' },
  footer: { padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e9ecef' },
  saveButton: { backgroundColor: '#007AFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, shadowColor: '#007AFF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  saveButtonDisabled: { backgroundColor: '#ccc' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
});

export default ProductForm;
