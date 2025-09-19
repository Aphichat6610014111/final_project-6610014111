import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Video } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const HeaderHero = ({ navigation }) => {
  const isNarrow = width < 860;
  const heroTitleSize = isNarrow ? 40 : 96;

  return (
    <View style={styles.heroWrap}>
      <Video
        source={require('../assets/Engine_Machinery_bg.mp4')}
        shouldPlay
        isLooping
        isMuted
        resizeMode="cover"
        style={styles.heroVideo}
      />

      <LinearGradient colors={['rgba(0,0,0,0.45)','rgba(0,0,0,0.45)']} style={StyleSheet.absoluteFill} />

      <View style={styles.heroContent}>
        <Text style={styles.kicker}>Shop Our Premium Auto Parts</Text>
        <Text style={[styles.heroTitle, { fontSize: heroTitleSize }]}>Build Your Dream Car Today.{"\n"}Now 15% Off On All Items.</Text>

        <View style={styles.heroCtas}>
          <TouchableOpacity style={styles.ctaPrimary} onPress={() => navigation.navigate('Products')} testID="cta-shop-now">
            <Text style={styles.ctaPrimaryText}>Shop Now</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctaOutlined} onPress={() => navigation.navigate('Products')} testID="cta-view-categories">
            <Text style={styles.ctaOutlinedText}>View Categories</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  heroWrap: { height: Math.max(width * 0.5, 560), minHeight: 520, overflow: 'hidden', justifyContent: 'center', backgroundColor: '#000' },
  heroVideo: { ...StyleSheet.absoluteFillObject },
  heroContent: { paddingHorizontal: 28, maxWidth: 900, zIndex: 10 },
  kicker: { color: '#fef2f2', fontWeight: '400', marginBottom: 8, letterSpacing: 1 },
  heroTitle: { color: '#fff', fontSize: 34, fontWeight: '400', marginBottom: 8 },
  heroCtas: { flexDirection: 'row', marginTop: 8 },
  ctaPrimary: { backgroundColor: '#ff4d36', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 28, marginRight: 12 },
  ctaPrimaryText: { color: '#fff', fontWeight: '800' },
  ctaOutlined: { borderWidth: 1, borderColor: '#fecaca', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 8 },
  ctaOutlinedText: { color: '#fecaca', fontWeight: '700' },
});

export default HeaderHero;
