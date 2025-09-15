import React, { useContext, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ScrollView, ImageBackground, Modal, Platform } from 'react-native';
import AuthContext from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiUrl } from '../utils/apiConfig';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';

const EditProfileScreen = ({ navigation }) => {
  const { user, updateUser } = useContext(AuthContext);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || user?.mobile || '');
  const [saving, setSaving] = useState(false);
  // image URL feature removed — only file picker / camera upload supported
  // password change removed per UI requirement - only name/email/phone + avatar are editable here

  const onSave = async () => {
    if (!name || !email) return Alert.alert('กรอกข้อมูลไม่ครบ', 'กรุณากรอกชื่อและอีเมล');
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      const body = { name, email, phone };
      const res = await fetch(apiUrl('/users/profile'), { method: 'PUT', headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok && (data.success || data.user)) {
        const updated = data.user || data.data?.user || data;
        try { await updateUser(updated); } catch (e) { /* ignore */ }
        Alert.alert('สำเร็จ', 'อัปเดตข้อมูลเรียบร้อย');
        // navigate back after successful profile update
        navigation.goBack();
      } else {
        console.warn('Update profile failed', data);
        Alert.alert('ข้อผิดพลาด', data?.message || 'ไม่สามารถอัปเดตข้อมูลได้');
      }
    } catch (err) {
      console.error('Save profile error', err);
      Alert.alert('ข้อผิดพลาด', 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSaving(false);
    }
  };

  const pickFromLibrary = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return Alert.alert('สิทธิ์ถูกปฏิเสธ', 'ต้องการสิทธิ์เข้าถึงรูปภาพเพื่ออัปโหลดรูปโปรไฟล์');
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, base64: false });
      // Support both older (res.cancelled/res.uri) and newer (res.assets) shapes
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
  // Let the environment set Content-Type for multipart FormData (boundary)
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const fd = new FormData();
      const filename = String(avatarUri).split('/').pop() || `avatar.jpg`;
      const match = (filename || '').match(/\.([0-9a-z]+)(?:[?#]|$)/i);
      const ext = match ? match[1] : 'jpg';
      const name = filename || `avatar.${ext}`;
      if (Platform.OS === 'web') {
        const resp = await fetch(avatarUri);
        const blob = await resp.blob();
        let fileObj;
        try {
          fileObj = new File([blob], name, { type: `image/${ext}` });
        } catch (e) {
          fileObj = blob;
        }
        fd.append('avatar', fileObj, name);
      } else {
        fd.append('avatar', { uri: avatarUri, name, type: `image/${ext}` });
      }
      const resp = await fetch(apiUrl('/users/profile/avatar'), { method: 'POST', headers, body: fd });
      const data = await resp.json();
      if (data?.success) {
        const updated = data.data.user;
        try { await updateUser(updated); } catch (e) { }
        Alert.alert('สำเร็จ', 'อัปเดตรูปโปรไฟล์เรียบร้อย');
      } else {
        console.warn('Avatar upload failed', data);
        Alert.alert('ข้อผิดพลาด', data?.message || 'ไม่สามารถอัปเดตรูปได้');
      }
    } catch (err) { console.error('Upload avatar failed', err); Alert.alert('ข้อผิดพลาด', 'ไม่สามารถอัปเดตรูปได้'); }
  };


  const pickImage = () => {
    Alert.alert('รูปโปรไฟล์', 'เลือกที่มาของรูป', [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ถ่ายรูป', onPress: takePhoto },
      { text: 'เลือกจากคลัง', onPress: pickFromLibrary }
    ]);
  };

  const removeAvatar = async () => {
    Alert.alert('ลบรูปโปรไฟล์', 'คุณต้องการลบรูปโปรไฟล์ใช่หรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ตกลง', style: 'destructive', onPress: async () => {
        try {
          const token = await AsyncStorage.getItem('token');
          const headers = token ? { Authorization: `Bearer ${token}` } : {};
          const resp = await fetch(apiUrl('/users/profile/avatar'), { method: 'DELETE', headers });
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
          Alert.alert('ข้อผิดพลาด', 'ไม่สามารถลบรูปได้');
        }
      }}
    ]);
  };

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>ย้อนกลับ</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} />
      </View>
      <View style={styles.cardMain}>
        <View style={styles.cardLeft}>
          <Text style={styles.cardTitle}>ข้อมูลของฉัน</Text>

          <View style={styles.fieldSmall}>
            <Text style={styles.label}>ชื่อ</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="ชื่อ" placeholderTextColor="#999" />
          </View>

          <View style={styles.fieldSmall}>
            <Text style={styles.label}>อีเมล</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="email@domain" keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#999" />
          </View>

          <View style={styles.fieldSmall}>
            <Text style={styles.label}>โทรศัพท์</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="โทรศัพท์" keyboardType="phone-pad" placeholderTextColor="#999" />
          </View>

          <TouchableOpacity style={[styles.btnSave, { opacity: saving ? 0.7 : 1 }]} onPress={onSave} disabled={saving}>
            <Text style={styles.btnSaveText}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cardRight}>
          <TouchableOpacity style={styles.avatarWrapCard} onPress={pickImage} activeOpacity={0.8}>
            {user?.avatar ? (
              <ImageBackground source={{ uri: user.avatar && user.avatar.startsWith('/') ? apiUrl(user.avatar) : user.avatar }} style={styles.avatarLarge} imageStyle={{ borderRadius: 80 }}>
                <View style={styles.editBadge}><Text style={styles.editBadgeText}>แก้ไข</Text></View>
              </ImageBackground>
            ) : (
              <View style={[styles.avatarLarge, styles.avatarPlaceholderLarge]}><Text style={{ color: '#fff' }}>No photo</Text></View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={[styles.btn, styles.btnPrimary, { marginTop: 12 }]} onPress={pickFromLibrary}><Text style={styles.btnText}>เลือกภาพ</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnOutline, { marginTop: 8 }]} onPress={removeAvatar}><Text style={[styles.btnText, styles.btnOutlineText]}>ลบรูป</Text></TouchableOpacity>
        </View>
      </View>
    </ScrollView>
    {/* Image URL modal removed */}
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  title: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 12 },
  field: { marginBottom: 12 },
  label: { color: 'rgba(255,255,255,0.75)', marginBottom: 6 },
    input: { backgroundColor: '#fff', color: '#111', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  btn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  btnText: { color: '#fff', fontWeight: '700' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  backButton: { paddingVertical: 6, paddingHorizontal: 10 },
  backText: { color: '#fff' },
  headerTitle: { flex: 1, textAlign: 'center' },
    cardMain: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 20, gap: 18, alignItems: 'flex-start', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  cardLeft: { flex: 1 },
  cardRight: { width: 220, alignItems: 'center' },
  fieldSmall: { marginBottom: 12 },
  btnSave: { backgroundColor: '#0B7A3E', padding: 12, borderRadius: 8, marginTop: 12, alignItems: 'center' },
  btnSaveText: { color: '#fff', fontWeight: '800' },
  avatarWrapCard: { alignItems: 'center', justifyContent: 'center' },
  avatarLarge: { width: 160, height: 160, borderRadius: 80, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' },
  avatarPlaceholderLarge: { width:160, height:160, borderRadius:80, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  editBadge: { position: 'absolute', right: 8, bottom: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  editBadgeText: { color: '#fff', fontSize: 11 },
  btnPrimary: { backgroundColor: '#0B7A3E' },
  btnOutline: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'transparent' },
  btnOutlineText: { color: '#fff' },
});

export default EditProfileScreen;
