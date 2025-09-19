import React, { useState, useContext, useEffect, useRef } from 'react';
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
import AuthContext from '../context/AuthContext';
import axios from 'axios';
import { apiUrl } from '../utils/apiConfig';
import Icon from 'react-native-vector-icons/MaterialIcons';
import FA from 'react-native-vector-icons/FontAwesome5';
import theme from '../theme';

const { width, height } = Dimensions.get('window');

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState('error');
  const [showAlert, setShowAlert] = useState(false);
  
  const { login } = useContext(AuthContext);
  
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

  const handleLogin = async () => {
    if (!email || !password) {
      showCustomAlert('ข้อผิดพลาด', 'กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }

    if (!email.includes('@')) {
      showCustomAlert('ข้อผิดพลาด', 'กรุณากรอกอีเมลที่ถูกต้อง');
      return;
    }

    setLoading(true);
    try {
      // normalize email to avoid mismatches (user may type uppercase or trailing spaces)
      const payload = {
        email: email.trim().toLowerCase(),
        password
      };

  const response = await axios.post(apiUrl('/api/auth/login'), payload);
      const { token, user } = response.data.data;
      
      // Save auth state then navigate into the Main tabs and open the Home tab.
      // MainTabs selects the actual component (AdminDashboard or EmployeeDashboard)
      // based on user.role stored by AuthContext.
      try {
        await login(user, token);
      } catch (e) {
        console.log('AuthContext.login error:', e);
      }

      // Reset navigation so user can't go back to Login. Navigate to nested Home tab.
      try {
        navigation.reset({
          index: 0,
          routes: [
            {
              name: 'Main',
              params: { screen: 'Home' },
            },
          ],
        });
      } catch (e) {
        // Fallback: replace to Main
        try {
          navigation.replace('Main');
        } catch (err) {
          navigation.navigate('Main');
        }
      }
    } catch (error) {
      // log for debugging in Metro/console
      console.log('Login error response:', error.response?.status, error.response?.data);

      const status = error.response?.status;
      let message = error.response?.data?.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ';
      if (status === 401) {
        message = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบหรือสมัครสมาชิก';
      }

      showCustomAlert('เข้าสู่ระบบไม่สำเร็จ', message);
    } finally {
      setLoading(false);
    }
  };

  // Function แสดง Custom Alert (ใช้กับหน้า Login เช่นกัน)
  const showCustomAlert = (title, message, type = 'error') => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertType(type);
    setShowAlert(true);
    // Fallback native alert for immediate visibility
    Alert.alert(title, message);
  };

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
            {showAlert && (
              <View style={[styles.alertBox, alertType === 'error' ? styles.alertError : styles.alertSuccess]}>
                <Text style={styles.alertTitle}>{alertTitle}</Text>
                <Text style={styles.alertMessage}>{alertMessage}</Text>
              </View>
            )}
            {/* Logo Section */}
            <View style={styles.logoSection}>
              <View style={styles.logoContainer}>
                <Icon name="build" size={50} color="#fff" />
              </View>
              <Text style={styles.appTitle}>AUTOPARTS STORE</Text>
            </View>

            {/* Centered dark panel similar to design */}
            <Animated.View style={styles.formContainer}>
              {/* Social / alternative login row */}
              <View style={styles.socialRow}>
                <TouchableOpacity style={styles.socialBtn}><FA name="apple" size={18} color="#000" /></TouchableOpacity>
                <TouchableOpacity style={styles.socialBtn}><FA name="facebook-f" size={18} color="#1877F2" /></TouchableOpacity>
                <TouchableOpacity style={styles.socialBtn}><FA name="google" size={18} color="#DB4437" /></TouchableOpacity>
                <TouchableOpacity style={styles.socialBtn}><FA name="twitch" size={18} color="#6441A4" /></TouchableOpacity>
              </View>

              <Text style={styles.orText}>or log in with</Text>
              {/* Email Input */}
              <View style={[
                styles.inputContainer,
                emailFocused && styles.inputContainerFocused
              ]}>
                <Icon name="email" size={20} color={emailFocused ? "#dc2626" : "#ccc"} />
                <TextInput
                  style={styles.input}
                  placeholder="อีเมล"
                  testID="login-email"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                  placeholderTextColor="#999"
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                />
              </View>

              {/* Password Input */}
              <View style={[
                styles.inputContainer,
                passwordFocused && styles.inputContainerFocused
              ]}>
                <Icon name="lock" size={20} color={passwordFocused ? "#dc2626" : "#ccc"} />
                <TextInput
                  style={styles.input}
                  placeholder="รหัสผ่าน"
                  testID="login-password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCorrect={false}
                  placeholderTextColor="#999"
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
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

              {/* Login Button */}
              <TouchableOpacity
                style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                onPress={handleLogin}
                disabled={loading}
                testID="login-submit"
              >
                <LinearGradient
                  colors={loading ? ['#ccc', '#999'] : ['#dc2626', '#7f1d1d']}
                  style={styles.loginButtonGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.loginButtonText}>เข้าสู่ระบบ</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Register Link */}
              <View style={styles.registerContainer}>
                <Text style={styles.registerText}>ยังไม่มีบัญชี? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Register')} testID="go-register">
                  <Text style={styles.registerLink}>สมัครสมาชิก</Text>
                </TouchableOpacity>
                
                {/* Back to Home button */}
                <TouchableOpacity style={{ marginLeft: 12 }} onPress={() => {
                  try {
                    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
                  } catch (e) {
                    navigation.navigate('Main');
                  }
                }}>
                  <Text style={[styles.registerLink, { color: '#fff' }]}>กลับไปหน้าโฮม</Text>
                </TouchableOpacity>
              </View>

              {/* Dev-only: autofill test admin credentials for quick testing */}
              <View style={{ alignItems: 'center', marginTop: 8 }}>
                <TouchableOpacity
                  onPress={() => {
                    setEmail('admin@autoparts.test');
                    setPassword('Admin123!');
                    console.log('Autofill: admin@autoparts.test / Admin123!');
                  }}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)'}}
                >
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
  logoSection: {
    alignItems: 'center',
    marginBottom: 60,
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
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
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
  loginButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 20,
    marginBottom: 30,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
  },
  registerLink: {
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

export default LoginScreen;
