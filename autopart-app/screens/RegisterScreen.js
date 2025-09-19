
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ImageBackground } from 'react-native';
import assetsIndex from '../assets/assetsIndex';
import axios from 'axios';
import { apiUrl } from '../utils/apiConfig';
import Icon from 'react-native-vector-icons/MaterialIcons';
import FA from 'react-native-vector-icons/FontAwesome5';
import theme from '../theme';

const { width, height } = Dimensions.get('window');

const RegisterScreen = ({ navigation }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState('error');
  const [showAlert, setShowAlert] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedField, setFocusedField] = useState('');
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Function สำหรับแสดง Custom Alert
  const showCustomAlert = (title, message, type = 'error') => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertType(type);
    setShowAlert(true);
    // Fallback to native alert for immediate feedback
    Alert.alert(title, message);
  };

  const handleRegister = async () => {
    const username = formData.username || '';
    const password = formData.password || '';
    const confirmPassword = formData.confirmPassword || '';
    const name = formData.username || '';

    console.log('Register attempt:', { 
      username: username.trim(), 
      password: password.trim(), 
      name: name.trim(),
      confirmPassword: confirmPassword.trim()
    });
    
    // ตรวจสอบว่ากรอกข้อมูลครบหรือไม่
    if (!username.trim() || !password.trim() || !name.trim()) {
      console.log('Validation failed: Missing required fields');
      showCustomAlert('ข้อผิดพลาด', 'กรุณากรอกข้อมูลให้ครบทุกช่อง');
      return;
    }

    // ตรวจสอบความยาว username
    if (username.trim().length < 3) {
      console.log('Validation failed: Username too short');
      showCustomAlert('ข้อผิดพลาด', 'Username ต้องมีอย่างน้อย 3 ตัวอักษร');
      return;
    }

    // ตรวจสอบความยาว name
    if (name.trim().length < 2) {
      console.log('Validation failed: Name too short');
      showCustomAlert('ข้อผิดพลาด', 'ชื่อต้องมีอย่างน้อย 2 ตัวอักษร');
      return;
    }

    // ตรวจสอบรหัสผ่าน
    if (password.length < 6) {
      console.log('Validation failed: Password too short');
      showCustomAlert('ข้อผิดพลาด', 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }

    // ตรวจสอบรหัสผ่านตรงกันหรือไม่
    if (password !== confirmPassword) {
      console.log('Validation failed: Password mismatch');
      showCustomAlert('ข้อผิดพลาด', 'รหัสผ่านไม่ตรงกัน');
      return;
    }

    console.log('Validation passed, proceeding with registration');
    setLoading(true);
    
    try {
      const payload = {
        name: name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: password,
      };

  const response = await axios.post(apiUrl('/api/auth/register'), payload);
      setLoading(false);

      const result = response.data || { success: true };
      if (result.success) {
        setShowSuccess(true);
        // รีเซ็ตฟอร์ม
        setFormData({ username: '', email: '', password: '', confirmPassword: '' });
        
        // แสดงข้อความสำเร็จ 3 วินาที แล้วกลับไปหน้า Login
        setTimeout(() => {
          setShowSuccess(false);
          navigation.goBack();
        }, 3000);
      } else {
        showCustomAlert('สมัครสมาชิกไม่สำเร็จ', result.message || 'เกิดข้อผิดพลาดในการสมัครสมาชิก');
      }
    } catch (error) {
      setLoading(false);
      console.error('Register error:', error);
      showCustomAlert('ข้อผิดพลาด', 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่');
    }
  };

  const getPasswordStrength = (password) => {
    if (!password) return { text: '', color: '#ccc', width: 0 };
    if (password.length < 4) return { text: 'อ่อน', color: '#FF3B30', width: 25 };
    if (password.length < 6) return { text: 'ปานกลาง', color: '#FF9500', width: 50 };
    if (password.length < 8) return { text: 'ดี', color: '#007AFF', width: 75 };
    return { text: 'แข็งแกร่ง', color: '#34C759', width: 100 };
  };

  const passwordStrength = getPasswordStrength(formData.password);

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ImageBackground source={assetsIndex.map['register_login_background']} style={styles.gradient} resizeMode="cover">
        <View style={styles.bgOverlay} />
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }
          ]}>
            {/* Inline alert / success banner */}
            {showAlert && (
              <View style={[styles.alertBox, alertType === 'error' ? styles.alertError : styles.alertSuccess]}>
                <Text style={styles.alertTitle}>{alertTitle}</Text>
                <Text style={styles.alertMessage}>{alertMessage}</Text>
              </View>
            )}

            {showSuccess && (
              <View style={[styles.alertBox, styles.alertSuccess]}>
                <Text style={styles.alertTitle}>สมัครสมาชิกสำเร็จ</Text>
                <Text style={styles.alertMessage}>กำลังกลับไปยังหน้าล็อกอิน...</Text>
              </View>
            )}
            {/* Header Section */}
            <View style={styles.headerSection}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => navigation.goBack()}
              >
                <Icon name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              
              <View style={styles.logoContainer}>
                <Icon name="build" size={50} color="#fff" />
              </View>
              <Text style={styles.appTitle}>AUTOPARTS STORE</Text>
            </View>

            {/* Register Form */}
            <Animated.View style={styles.formContainer}>
              <View style={styles.socialRow}>
                <TouchableOpacity style={styles.socialBtn}><FA name="apple" size={18} color="#000" /></TouchableOpacity>
                <TouchableOpacity style={styles.socialBtn}><FA name="facebook-f" size={18} color="#1877F2" /></TouchableOpacity>
                <TouchableOpacity style={styles.socialBtn}><FA name="google" size={18} color="#DB4437" /></TouchableOpacity>
                <TouchableOpacity style={styles.socialBtn}><FA name="twitch" size={18} color="#6441A4" /></TouchableOpacity>
              </View>
              <Text style={styles.orText}>or sign up with</Text>
              {/* Username Input */}
              <View style={[
                styles.inputContainer,
                focusedField === 'username' && styles.inputContainerFocused
              ]}>
                <Icon 
                  name="person" 
                  size={20} 
                  color={focusedField === 'username' ? "#dc2626" : "#ccc"} 
                />
                <TextInput
                  style={styles.input}
                  placeholder="ชื่อผู้ใช้"
                  value={formData.username}
                  testID="register-username"
                  onChangeText={(value) => setFormData({...formData, username: value})}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor="#999"
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField('')}
                />
              </View>

              {/* Email Input */}
              <View style={[
                styles.inputContainer,
                focusedField === 'email' && styles.inputContainerFocused
              ]}>
                <Icon 
                  name="email" 
                  size={20} 
                  color={focusedField === 'email' ? "#dc2626" : "#ccc"} 
                />
                <TextInput
                  style={styles.input}
                  placeholder="อีเมล"
                  value={formData.email}
                  testID="register-email"
                  onChangeText={(value) => setFormData({...formData, email: value})}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                  placeholderTextColor="#999"
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField('')}
                />
              </View>

              {/* Password Input */}
              <View style={[
                styles.inputContainer,
                focusedField === 'password' && styles.inputContainerFocused
              ]}>
                <Icon 
                  name="lock" 
                  size={20} 
                  color={focusedField === 'password' ? "#dc2626" : "#ccc"} 
                />
                <TextInput
                  style={styles.input}
                  placeholder="รหัสผ่าน"
                  value={formData.password}
                  testID="register-password"
                  onChangeText={(value) => setFormData({...formData, password: value})}
                  secureTextEntry={!showPassword}
                  autoCorrect={false}
                  placeholderTextColor="#999"
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField('')}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  <Icon 
                    name={showPassword ? "visibility" : "visibility-off"} 
                    size={20} 
                    color="#ccc" 
                  />
                </TouchableOpacity>
              </View>

              {/* Password Strength Indicator */}
              {formData.password.length > 0 && (
                <View style={styles.passwordStrengthContainer}>
                  <View style={styles.passwordStrengthBar}>
                    <View 
                      style={[
                        styles.passwordStrengthFill,
                        { 
                          width: `${passwordStrength.width}%`,
                          backgroundColor: passwordStrength.color 
                        }
                      ]} 
                    />
                  </View>
                  <Text style={[styles.passwordStrengthText, { color: passwordStrength.color }]}>
                    {passwordStrength.text}
                  </Text>
                </View>
              )}

              {/* Confirm Password Input */}
              <View style={[
                styles.inputContainer,
                focusedField === 'confirmPassword' && styles.inputContainerFocused
              ]}>
                <Icon 
                  name="lock" 
                  size={20} 
                  color={focusedField === 'confirmPassword' ? "#dc2626" : "#ccc"} 
                />
                <TextInput
                  style={styles.input}
                  placeholder="ยืนยันรหัสผ่าน"
                  value={formData.confirmPassword}
                  testID="register-confirmPassword"
                  onChangeText={(value) => setFormData({...formData, confirmPassword: value})}
                  secureTextEntry={!showConfirmPassword}
                  autoCorrect={false}
                  placeholderTextColor="#999"
                  onFocus={() => setFocusedField('confirmPassword')}
                  onBlur={() => setFocusedField('')}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeButton}
                >
                  <Icon 
                    name={showConfirmPassword ? "visibility" : "visibility-off"} 
                    size={20} 
                    color="#ccc" 
                  />
                </TouchableOpacity>
              </View>

              {/* Register Button */}
              <TouchableOpacity
                style={[styles.registerButton, loading && styles.registerButtonDisabled]}
                onPress={handleRegister}
                disabled={loading}
                testID="register-submit"
              >
                <LinearGradient
                  colors={loading ? ['#ccc', '#999'] : ['#dc2626', '#7f1d1d']}
                  style={styles.registerButtonGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.registerButtonText}>สมัครสมาชิก</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Login Link */}
              <View style={styles.loginContainer}>
                <Text style={styles.loginText}>มีบัญชีอยู่แล้ว? </Text>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                  <Text style={styles.loginLink}>เข้าสู่ระบบ</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </Animated.View>
        </ScrollView>
      </ImageBackground>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: height,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)'
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 60,
  },
  backButton: {
    position: 'absolute',
    top: -20,
    left: -10,
    padding: 10,
    zIndex: 1,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
  backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  appTitle: {
    fontSize: 36,
    fontWeight: '300',
  color: theme.colors.surface,
    letterSpacing: 2,
  },
  formContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 6,
    padding: 24,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 520,
    minWidth: 320,
  },
  socialRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  socialBtn: { width: 42, height: 36, borderRadius: 6, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginHorizontal: 6 },
  orText: { textAlign: 'center', color: 'rgba(255,255,255,0.6)', marginVertical: 8 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  inputContainerFocused: {
    borderColor: '#dc2626',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 15,
  },
  eyeButton: {
    padding: 8,
  },
  passwordStrengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  passwordStrengthBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#e1e5e9',
    borderRadius: 2,
    marginRight: 10,
    overflow: 'hidden',
  },
  passwordStrengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  passwordStrengthText: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 60,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 20,
    paddingHorizontal: 10,
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginLeft: 8,
  },
  termsLink: {
    color: '#007AFF',
    fontWeight: '600',
  },
  registerButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 20,
    marginBottom: 30,
  },
  registerButtonDisabled: {
    opacity: 0.7,
  },
  registerButtonGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: theme.colors.primary,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
  },
  loginLink: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '600',
  },
  alertBox: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: theme.space.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    ...theme.shadow.card,
  },
  alertError: {
    borderColor: '#FEE2E2',
    borderWidth: 1,
  },
  alertSuccess: {
    borderColor: '#DCFCE7',
    borderWidth: 1,
  },
  alertTitle: { fontWeight: '800', color: theme.colors.text, marginBottom: 6, fontSize: theme.typography.body },
  alertMessage: { color: theme.colors.muted, fontSize: theme.typography.small },
});

export default RegisterScreen;
