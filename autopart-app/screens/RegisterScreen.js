
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
import axios from 'axios';
import Icon from 'react-native-vector-icons/MaterialIcons';

const { width, height } = Dimensions.get('window');

const RegisterScreen = ({ navigation }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
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

  const validateForm = () => {
    const { username, email, password, confirmPassword } = formData;
    
    if (!username.trim()) {
      Alert.alert('ข้อผิดพลาด', 'กรุณากรอกชื่อผู้ใช้');
      return false;
    }
    if (username.length < 3) {
      Alert.alert('ข้อผิดพลาด', 'ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร');
      return false;
    }
    if (!email.trim()) {
      Alert.alert('ข้อผิดพลาด', 'กรุณากรอกอีเมล');
      return false;
    }
    if (!email.includes('@')) {
      Alert.alert('ข้อผิดพลาด', 'กรุณากรอกอีเมลที่ถูกต้อง');
      return false;
    }
    if (!password) {
      Alert.alert('ข้อผิดพลาด', 'กรุณากรอกรหัสผ่าน');
      return false;
    }
    if (password.length < 6) {
      Alert.alert('ข้อผิดพลาด', 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return false;
    }
    if (password !== confirmPassword) {
      Alert.alert('ข้อผิดพลาด', 'รหัสผ่านไม่ตรงกัน');
      return false;
    }
    
    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const payload = {
        name: formData.username.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      };

      await axios.post('http://localhost:5000/api/auth/register', payload);
      
      // แสดง loading 3 วินาที
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      Alert.alert(
        'สมัครสมาชิกสำเร็จ',
        'ยินดีต้อนรับ! กรุณาเข้าสู่ระบบด้วยบัญชีใหม่ของคุณ',
        [
          {
            text: 'ตกลง',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        'สมัครสมาชิกไม่สำเร็จ',
        error.response?.data?.message || 'เกิดข้อผิดพลาดในการสมัครสมาชิก'
      );
    } finally {
      setLoading(false);
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
      <LinearGradient
        colors={['#dc2626', '#7f1d1d', '#000000']}
        style={styles.gradient}
      >
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
              <Text style={styles.appTitle}>Auto Parts</Text>
            </View>

            {/* Register Form */}
            <Animated.View style={styles.formContainer}>
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
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
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
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  appTitle: {
    fontSize: 36,
    fontWeight: '300',
    color: '#fff',
    letterSpacing: 2,
  },
  formContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 20,
    padding: 40,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.2)',
  },
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
    paddingVertical: 18,
    paddingHorizontal: 20,
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
});

export default RegisterScreen;
