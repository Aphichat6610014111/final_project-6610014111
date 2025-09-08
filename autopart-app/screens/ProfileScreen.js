import React, { useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AuthContext from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const ProfileScreen = () => {
  const { user, logout } = useContext(AuthContext);
  const navigation = useNavigation();

  const handleLogout = async () => {
    console.log('Logout clicked');
    try {
      await logout(); // ลบ token/user อัตโนมัติ
      console.log('Logout successful');
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถออกจากระบบได้');
    }
  };

  const confirmLogout = () => {
    console.log('confirmLogout called');
    handleLogout(); // เรียก logout ทันทีไม่ต้องถาม
  };

  const menuItems = [
    { icon: 'account-circle', title: 'ข้อมูลส่วนตัว', onPress: () => {}, color: '#dc2626' },
    { icon: 'history', title: 'ประวัติการสั่งซื้อ', onPress: () => {}, color: '#4A90E2' },
    { icon: 'favorite', title: 'รายการโปรด', onPress: () => {}, color: '#FF6B6B' },
    { icon: 'payment', title: 'ข้อมูลการชำระเงิน', onPress: () => {}, color: '#4ECDC4' },
    { icon: 'notifications', title: 'การแจ้งเตือน', onPress: () => {}, color: '#45B7D1' },
    { icon: 'help-center', title: 'ศูนย์ช่วยเหลือ', onPress: () => {}, color: '#96CEB4' },
    { icon: 'exit-to-app', title: 'ออกจากระบบ', onPress: confirmLogout, color: '#FF4757' },
  ];

  return (
    <ScrollView style={styles.container}>
      <LinearGradient
        colors={['#dc2626', '#7f1d1d', '#000000']}
        style={styles.header}
      >
        <View style={styles.profileSection}>
          <View style={styles.profileIcon}>
            <Icon name="person" size={50} color="#fff" />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.username || 'ผู้ใช้'}</Text>
            <Text style={styles.userEmail}>{user?.email || 'user@example.com'}</Text>
            <View style={styles.statusBadge}>
              <Icon name="verified" size={16} color="#34C759" />
              <Text style={styles.statusText}>ยืนยันแล้ว</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <LinearGradient
            colors={['#1a1a1a', '#2a2a2a']}
            style={styles.statCardGradient}
          >
            <Icon name="build" size={28} color="#dc2626" />
            <Text style={styles.statNumber}>24</Text>
            <Text style={styles.statLabel}>อะไหล่ในสต็อก</Text>
          </LinearGradient>
        </View>
        <View style={styles.statCard}>
          <LinearGradient
            colors={['#1a1a1a', '#2a2a2a']}
            style={styles.statCardGradient}
          >
            <Icon name="shopping-cart" size={28} color="#34C759" />
            <Text style={styles.statNumber}>12</Text>
            <Text style={styles.statLabel}>คำสั่งซื้อ</Text>
          </LinearGradient>
        </View>
        <View style={styles.statCard}>
          <LinearGradient
            colors={['#1a1a1a', '#2a2a2a']}
            style={styles.statCardGradient}
          >
            <Icon name="star" size={28} color="#FFD700" />
            <Text style={styles.statNumber}>4.8</Text>
            <Text style={styles.statLabel}>คะแนนรีวิว</Text>
          </LinearGradient>
        </View>
      </View>

      <View style={styles.menuContainer}>
        <Text style={styles.menuSectionTitle}>การจัดการบัญชี</Text>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.menuItem,
              index === menuItems.length - 1 && styles.lastMenuItem
            ]}
            onPress={item.onPress}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.iconContainer, { backgroundColor: `${item.color}15` }]}>
                <Icon 
                  name={item.icon} 
                  size={22} 
                  color={item.color} 
                />
              </View>
              <Text style={styles.menuText}>
                {item.title}
              </Text>
            </View>
            <Icon name="chevron-right" size={20} color="#666" />
          </TouchableOpacity>
        ))}
      </View>
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
    backgroundColor: '#1a1a1a',
    marginHorizontal: 20,
    borderRadius: 16,
    marginTop: 20,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
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
});

export default ProfileScreen;
