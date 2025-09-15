import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ImageBackground,
  Dimensions,
  Modal,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AuthContext from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import assetsIndex from '../assets/assetsIndex';
import { apiUrl } from '../utils/apiConfig';

const ProfileScreen = () => {
  const { user, logout, updateUser } = useContext(AuthContext);
  const navigation = useNavigation();
  const [showLogoutOptions, setShowLogoutOptions] = React.useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  const handleLogout = async () => {
    console.log('Logout clicked');
    try {
      await logout(); // ลบ token/user อัตโนมัติ
      console.log('Logout successful');
      // After logout, reset navigation to the Main stack and show Home tab
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      });
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถออกจากระบบได้');
    }
  };

  const confirmLogout = () => {
  // Try modal, but also show native Alert as a reliable fallback
  console.log('Opening logout options modal (and native Alert fallback)');
  setShowLogoutOptions(true);

  Alert.alert(
    'ยืนยันการออกจากระบบ',
    'คุณต้องการออกจากระบบใช่หรือไม่?',
    [
      { text: 'ยกเลิก', style: 'cancel', onPress: () => console.log('Logout cancelled (alert)') },
      { text: 'ตกลง', style: 'destructive', onPress: async () => { console.log('Logout confirmed (alert)'); await handleLogout(); } },
    ],
    { cancelable: true }
  );
  };

  // menuItems removed — not used in this layout

  const windowW = Dimensions.get('window').width;
  const debuggerHost = (Constants.manifest && (Constants.manifest.debuggerHost || Constants.manifest.packagerOpts?.host)) || '';
  const devHost = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
  const API_BASE = `http://${devHost}:5000`;

  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [urlError, setUrlError] = useState(null);
  const [savingUrl, setSavingUrl] = useState(false);

  const fetchOrders = async () => {
    if (!user) return;
    setLoadingOrders(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const resp = await fetch(`${API_BASE}/api/orders/mine`, { headers });
      const data = await resp.json();
      if (data?.success) {
        setOrders(data.data.orders || []);
      } else {
        console.warn('Failed to load orders', data);
      }
    } catch (err) {
      console.error('Fetch orders error', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // also refetch when user changes
  }, [user]);

  const pickFromLibrary = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return Alert.alert('สิทธิ์ถูกปฏิเสธ', 'ต้องการสิทธิ์เข้าถึงรูปภาพเพื่ออัปโหลดรูปโปรไฟล์');
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, base64: false });
      const uri = res?.assets?.[0]?.uri || res?.uri;
      if (!uri) return;
      await uploadAvatarUri(uri);
    } catch (e) { console.error('Image pick error', e); }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') return Alert.alert('สิทธิ์ถูกปฏิเสธ', 'ต้องการสิทธิ์เข้าถึงกล้องเพื่อถ่ายรูป');
      const res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
      const uri = res?.assets?.[0]?.uri || res?.uri;
      if (!uri) return;
      await uploadAvatarUri(uri);
    } catch (e) { console.error('Camera error', e); }
  };

  const uploadAvatarUri = async (avatarUri) => {
    try {
      if (!avatarUri) return Alert.alert('ข้อผิดพลาด', 'ไม่พบรูปที่เลือก');
  const token = await AsyncStorage.getItem('token');
  // IMPORTANT: don't set 'Content-Type' header when sending FormData with fetch.
  // Let the runtime/browser set the correct multipart boundary.
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const fd = new FormData();
      const filename = String(avatarUri).split('/').pop() || `avatar.jpg`;
      const match = (filename || '').match(/\.([0-9a-z]+)(?:[?#]|$)/i);
      const ext = match ? match[1] : 'jpg';
      const name = filename || `avatar.${ext}`;
      if (Platform.OS === 'web') {
        // On web, fetch the URI and convert to a Blob/File so FormData contains a proper file
        const resp = await fetch(avatarUri);
        const blob = await resp.blob();
        // Some environments support File constructor
        let fileObj;
        try {
          fileObj = new File([blob], name, { type: `image/${ext}` });
        } catch (e) {
          // Fallback: append blob (some servers accept blobs with filename param)
          fileObj = blob;
          // When appending a blob directly, pass filename as third arg where supported
        }
        // Append file (if fileObj is Blob, append will accept (blob, name))
        fd.append('avatar', fileObj, name);
      } else {
        fd.append('avatar', { uri: avatarUri, name, type: `image/${ext}` });
      }
      const resp = await fetch(`${API_BASE}/api/users/profile/avatar`, { method: 'POST', headers, body: fd });
      const data = await resp.json();
      if (data?.success) {
        const updated = data.data.user;
        try { await updateUser(updated); } catch (e) { }
        Alert.alert('สำเร็จ', 'อัปเดตรูปโปรไฟล์เรียบร้อย');
      } else {
        console.warn('Avatar upload failed', data);
        Alert.alert('ข้อผิดพลาด', data?.message || 'ไม่สามารถอัปเดตรูปได้');
      }
    } catch (err) { console.error('Upload avatar failed', err); Alert.alert('ข้อผิดพลาด', 'ไม่สามารถอัปเดตรูปได้ โปรดลองอีกครั้ง'); }
  };

  const pickImage = () => {
    Alert.alert('รูปโปรไฟล์', 'เลือกที่มาของรูป', [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ถ่ายรูป', onPress: takePhoto },
      { text: 'เลือกจากคลัง', onPress: pickFromLibrary }
    ]);
  };

  const removeAvatar = async () => {
    Alert.alert(
      'ลบรูปโปรไฟล์',
      'คุณต้องการลบรูปโปรไฟล์ใช่หรือไม่?',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        { text: 'ตกลง', style: 'destructive', onPress: async () => {
          try {
            const token = await AsyncStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const resp = await fetch(`${API_BASE}/api/users/profile/avatar`, { method: 'DELETE', headers });
            const data = await resp.json();
            if (data?.success) {
              const updated = data.data.user;
              try { await updateUser(updated); } catch (e) { }
              Alert.alert('สำเร็จ', 'ลบรูปโปรไฟล์เรียบร้อย');
            } else {
              console.warn('Delete avatar failed', data);
              Alert.alert('ข้อผิดพลาด', data?.message || 'ไม่สามารถลบรูปได้');
            }
          } catch (err) {
            console.error('Delete avatar error', err);
            Alert.alert('ข้อผิดพลาด', 'ไม่สามารถลบรูปได้ โปรดลองอีกครั้ง');
          }
        }}
      ]
    );
  };

  // Helper: validate an image URL (simple check)
  const isValidImageUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    try {
      const u = new URL(url);
      return /\.(jpe?g|png|gif|webp|avif)(?:[?#].*)?$/i.test(u.pathname) || /^https?:\/\/.+$/i.test(url);
    } catch (e) {
      return false;
    }
  };

  const openUrlModal = () => {
    setImageUrl('');
    setUrlError(null);
    setShowUrlModal(true);
  };

  const saveImageUrl = async () => {
    if (!isValidImageUrl(imageUrl)) {
      setUrlError('โปรดใส่ URL รูปภาพที่ถูกต้อง (เช่น .jpg .png .webp)');
      return;
    }
    setSavingUrl(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      const resp = await fetch(`${API_BASE}/api/users/profile`, { method: 'PUT', headers, body: JSON.stringify({ avatar: imageUrl }) });
      const data = await resp.json();
      if (data?.success || data?.user || data?.data?.user) {
        const updated = data.user || data.data?.user || (data.success && data.data?.user);
        try { await updateUser(updated); } catch (e) { }
        Alert.alert('สำเร็จ', 'ตั้งค่ารูปโปรไฟล์เรียบร้อย');
        setShowUrlModal(false);
      } else {
        console.warn('Set avatar by URL failed', data);
        Alert.alert('ข้อผิดพลาด', data?.message || 'ไม่สามารถตั้งค่ารูปได้');
      }
    } catch (err) {
      console.error('Save image url failed', err);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถตั้งค่ารูปได้ โปรดลองอีกครั้ง');
    } finally {
      setSavingUrl(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* If not authenticated, show the same styled header + two-column layout but with CTAs to login/register */}
      {/* New improved header */}
      <ImageBackground
        source={assetsIndex.map['profile_header_background'] || assetsIndex.map['register_login_background']}
        style={styles.header}
        imageStyle={{ resizeMode: 'cover' }}
      >
        <LinearGradient colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.95)']} style={styles.headerOverlay}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>บัญชีของฉัน</Text>
            <View style={{ width: 56 }} />
          </View>

          <View style={styles.profileRow}>
            <TouchableOpacity onPress={() => setShowAvatarModal(true)} style={styles.profileAvatarWrap}>
              {user?.avatar ? (
                <ImageBackground source={{ uri: user.avatar && user.avatar.startsWith('/') ? apiUrl(user.avatar) : user.avatar }} style={styles.profileAvatar} imageStyle={{ borderRadius: 44 }}>
                </ImageBackground>
              ) : (
                <View style={styles.profileAvatarPlaceholder}><Icon name="person" size={40} color="#fff" /></View>
              )}
            </TouchableOpacity>

            <View style={styles.profileMeta}>
              <Text style={styles.profileName}>{user ? (user.name || user.username || 'ผู้ใช้') : 'ยังไม่ได้เข้าสู่ระบบ'}</Text>
              <Text style={styles.profileEmail}>{user ? user.email : 'กรุณาเข้าสู่ระบบเพื่อดูข้อมูล'}</Text>
              <View style={styles.actionRow}>
                {user ? (
                  <>
                    <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => navigation.navigate('EditProfile')}><Text style={styles.btnText}>แก้ไขโปรไฟล์</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={confirmLogout}><Text style={[styles.btnText, styles.btnOutlineText]}>ออกจากระบบ</Text></TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => navigation.navigate('Login')}><Text style={styles.btnText}>เข้าสู่ระบบ</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={() => navigation.navigate('Register')}><Text style={[styles.btnText, styles.btnOutlineText]}>สมัครสมาชิก</Text></TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>

      {/* Content cards */}
      <View style={styles.contentWrapper}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>สรุปคำสั่งซื้อ</Text>
          {loadingOrders ? (
            <Text style={styles.cardText}>กำลังโหลดคำสั่งซื้อ...</Text>
          ) : (
            <>
              <Text style={[styles.cardText, { marginBottom: 8 }]}>จำนวนคำสั่งซื้อทั้งหมด: {orders.length}</Text>
              {orders.length === 0 ? (
                <Text style={styles.emptyText}>ยังไม่มีคำสั่งซื้อ</Text>
              ) : (
                orders.slice(0, 3).map(o => {
                  const firstItem = o.items && o.items.length ? o.items[0] : null;
                  // try multiple fallbacks for the product name
                  const rawName = firstItem?.product?.name || firstItem?.name || firstItem?.product || null;
                  // remove tokens like 'Model 786' or 'Model786' (case-insensitive) and remove stray parentheses/extra spaces
                  const cleanName = rawName
                    ? String(rawName)
                        .replace(/\bModel\s*\d+\b/gi, '')
                        .replace(/\(.*?\)/g, '')
                        .replace(/\s{2,}/g, ' ')
                        .trim()
                    : null;
                  // compute total: prefer o.total, otherwise sum item price*quantity using product.price/product.salePrice or it.price
                  const computedTotal = (o.total != null)
                    ? Number(o.total)
                    : Number(o.items?.reduce((s, it) => {
                        const qty = Number(it.quantity) || Number(it.qty) || 1;
                        const price = (it.product && (it.product.salePrice || it.product.price)) || Number(it.price) || 0;
                        return s + (Number(price) * qty);
                      }, 0) || 0);
                  // format as THB currency
                  let totalStr;
                  try {
                    totalStr = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(computedTotal || 0);
                  } catch (e) {
                    totalStr = `฿${(computedTotal || 0).toFixed(2)}`;
                  }
                  // build thumbnail URL similar to Orders.makeImageSource
                  let imageUri = null;
                  try {
                    const p = firstItem?.product || firstItem || {};
                    const url = p?.imageUrl || p?.image || (p.images && p.images[0]) || null;
                    if (url) {
                      const s = String(url);
                      if (s.startsWith('/')) imageUri = `${API_BASE}${s}`;
                      else if (/^https?:\/\//i.test(s)) imageUri = s;
                      else imageUri = `${API_BASE}/images/${s}`;
                    }
                  } catch (e) { /* ignore */ }

                  return (
                    <View key={o._id} style={{ marginBottom: 8 }}>
                      <Text style={{ color: '#fff', fontWeight: '700' }}>{cleanName ? cleanName : `#${o._id.substring(0,8)}`} · {new Date(o.createdAt).toLocaleDateString()} · {totalStr}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.8)' }}>{o.status || 'pending'} · {o.items ? o.items.length : 0} รายการ</Text>
                    </View>
                  )
                })
              )}
              {orders.length > 0 && (
                <TouchableOpacity style={[styles.ctaOutline, { alignSelf: 'flex-start', paddingHorizontal: 12 }]} onPress={() => navigation.navigate('Orders')}>
                  <Text style={[styles.ctaOutlineText, { paddingVertical: 8 }]}>ดูคำสั่งซื้อทั้งหมด</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('AddressPayments')}>
          <Text style={styles.cardTitle}>ที่อยู่ & การชำระเงิน</Text>
          <Text style={styles.cardText}>จัดการที่อยู่และบัตรของคุณ</Text>
        </TouchableOpacity>

        <View style={styles.cardLast}>
          <Text style={styles.cardTitle}>ตั้งค่าบัญชี</Text>
          <TouchableOpacity style={styles.rowItem} onPress={() => navigation.navigate('EditProfile')}>
            <Text style={styles.rowItemText}>แก้ไขข้อมูลส่วนตัว</Text>
          </TouchableOpacity>
        </View>
      </View>
      {/* end new UI */}

      {/* Logout Options Modal */}
      <Modal
        visible={showLogoutOptions}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLogoutOptions(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>ยืนยันการออกจากระบบ</Text>
            <Text style={styles.modalText}>คุณต้องการออกจากระบบใช่หรือไม่?</Text>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => { console.log('Logout cancelled'); setShowLogoutOptions(false); }}>
                <Text style={styles.cancelButtonText}>ยกเลิก</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.modalButton, styles.logoutButton]} onPress={async () => { console.log('Logout confirmed'); setShowLogoutOptions(false); await handleLogout(); }}>
                <Text style={styles.logoutButtonText}>ตกลง</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Avatar viewer modal */}
      <Modal visible={showAvatarModal} transparent animationType="fade" onRequestClose={() => setShowAvatarModal(false)}>
        <View style={[styles.modalOverlay, { justifyContent: 'center' }]}> 
          <View style={{ width: '95%', maxWidth: 900, backgroundColor: '#000', borderRadius: 8, overflow: 'hidden' }}>
            <ImageBackground source={{ uri: user?.avatar && user.avatar.startsWith('/') ? apiUrl(user.avatar) : user?.avatar }} style={{ width: '100%', height: 600, backgroundColor: '#111' }} resizeMode="contain" />
            <View style={{ padding: 12, alignItems: 'flex-end', backgroundColor: '#000' }}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setShowAvatarModal(false)}><Text style={styles.cancelButtonText}>ปิด</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Use Image URL Modal */}
      <Modal visible={showUrlModal} transparent animationType="fade" onRequestClose={() => setShowUrlModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>ใช้ URL รูปโปรไฟล์</Text>
            <Text style={styles.modalText}>วาง URL ของรูปที่ต้องการใช้เป็นรูปโปรไฟล์</Text>
            <TextInput value={imageUrl} onChangeText={(t)=>{ setImageUrl(t); setUrlError(null); }} placeholder="https://.../avatar.jpg" placeholderTextColor="#999" style={{ backgroundColor: '#222', color:'#fff', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 8 }} />
            {urlError ? <Text style={{ color: '#ff6b6b', marginBottom: 8 }}>{urlError}</Text> : null}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={()=>setShowUrlModal(false)}><Text style={styles.cancelButtonText}>ยกเลิก</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.logoutButton]} onPress={saveImageUrl} disabled={savingUrl}><Text style={styles.logoutButtonText}>{savingUrl ? 'กำลังบันทึก...' : 'บันทึก'}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  statusText: {
    color: '#34C759',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  statCardGradient: {
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    fontWeight: '500',
  },
  menuContainer: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginHorizontal: 20,
    borderRadius: 16,
    marginTop: 20,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  menuSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  modalOverlay: {
    flex: 1,
  backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#111',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 8 },
  modalText: { color: 'rgba(255,255,255,0.8)', marginBottom: 16 },
  modalButtonsRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  modalButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, marginLeft: 8 },
  cancelButton: { backgroundColor: 'rgba(255,255,255,0.06)' },
  cancelButtonText: { color: '#fff' },
  logoutButton: { backgroundColor: '#FF4757' },
  logoutButtonText: { color: '#fff', fontWeight: '700' },
  lastMenuItem: {
    borderBottomWidth: 0,
    paddingBottom: 20,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  unauthContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  unauthTitle: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 12 },
  unauthText: { color: '#ccc', textAlign: 'center', marginTop: 8, marginBottom: 18 },
  unauthButtonsRow: { flexDirection: 'row', gap: 12 },
  unauthButtonPrimary: { backgroundColor: '#FF6B6B', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10, marginRight: 8 },
  unauthButtonPrimaryText: { color: '#fff', fontWeight: '700' },
  unauthButtonSecondary: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10 },
  unauthButtonSecondaryText: { color: '#fff', fontWeight: '600' },
  header: {
    height: 220,
    width: '100%',
    marginBottom: 8,
  },
  headerOverlay: { flex: 1, paddingHorizontal: 28, justifyContent: 'flex-end', paddingBottom: 28 },
  profileIconLarge: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.12)',
    marginRight: 18,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, marginBottom: 12 },
  headerBack: { padding: 6 },
  headerBackText: { color: '#fff' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  profileRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  profileAvatarWrap: { marginRight: 12 },
  profileAvatar: { width: 88, height: 88, borderRadius: 44, overflow: 'hidden' },
  profileAvatarPlaceholder: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  editBadge: { position: 'absolute', right: 6, bottom: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  editBadgeText: { color: '#fff', fontSize: 10 },
  profileMeta: { flex: 1 },
  profileName: { color: '#fff', fontSize: 20, fontWeight: '800' },
  profileEmail: { color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  btnPrimary: { backgroundColor: '#0B7A3E', marginRight: 8 },
  btnOutline: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'transparent' },
  btnText: { color: '#fff', fontWeight: '700' },
  btnOutlineText: { color: '#fff' },
  contentWrapper: { paddingHorizontal: 20, paddingTop: 18 },
  card: { backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  cardLast: { backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12, marginBottom: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  cardTitle: { color: '#fff', fontWeight: '800', marginBottom: 6 },
  cardText: { color: 'rgba(255,255,255,0.7)' },
  rowItem: { paddingVertical: 10 },
  rowItemText: { color: '#fff' },
  userInfoLarge: { flex: 1, justifyContent: 'center' },
  userNameLarge: { color: '#fff', fontSize: 28, fontWeight: '800', marginBottom: 6 },
  badgesRow: { flexDirection: 'row', gap: 12 },
  smallBadge: { flexDirection: 'row', alignItems: 'center', marginRight: 12, backgroundColor: 'rgba(255,255,255,0.03)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  smallBadgeText: { color: '#fff', marginLeft: 6, fontSize: 12 },
  contentWrapper: { paddingHorizontal: 20, paddingTop: 6 },
  contentWide: { maxWidth: 1100, alignSelf: 'center' },
  twoColumnRow: { flexDirection: 'row', gap: 20, marginTop: 10, paddingHorizontal: 10 },
  leftColumn: { flex: 1, paddingRight: 12 },
  rightColumn: { width: 220, justifyContent: 'flex-start', alignItems: 'stretch', gap: 14 },
  sectionTitle: { color: '#fff', fontWeight: '800', fontSize: 16, marginBottom: 8 },
  sectionSub: { color: 'rgba(255,255,255,0.6)', marginBottom: 12 },
  infoList: { marginTop: 8 },
  infoItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  infoTitle: { color: '#fff', fontWeight: '700' },
  infoText: { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 4, maxWidth: '92%' },
  infoItemSmall: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  infoTextSmall: { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginLeft: 8 },
  emptyText: { color: 'rgba(255,255,255,0.5)', marginTop: 8 },
  ctaButton: { backgroundColor: '#0B7A3E', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 6, marginBottom: 12, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '800' },
  ctaOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#0B7A3E' },
  ctaOutlineText: { color: '#0B7A3E' },
  joinButton: { backgroundColor: '#00C853' },
  logoutAction: { backgroundColor: '#FF4757' },
});

export default ProfileScreen;
